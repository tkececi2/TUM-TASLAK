import React, { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  FileBarChart, 
  Download, 
  Calendar, 
  Building, 
  AlertTriangle, 
  CheckCircle, 
  Wrench, 
  Zap, 
  Battery, 
  Leaf, 
  Sun, 
  Package,
  ArrowLeft,
  Printer
} from 'lucide-react';
import { Card, Title, Text, BarChart, DonutChart, AreaChart, Metric, Flex, ProgressBar, Grid, Col, Badge } from '@tremor/react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';

export const AylikKapsamliRapor: React.FC = () => {
  const { kullanici } = useAuth();
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenAy, setSecilenAy] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [secilenSaha, setSecilenSaha] = useState<string>('');
  const [sahalar, setSahalar] = useState<Array<{id: string, ad: string}>>([]);
  const [santraller, setSantraller] = useState<Array<{id: string, ad: string}>>([]);
  const [rapor, setRapor] = useState<any>({
    ariza: {
      toplam: 0,
      cozulen: 0,
      bekleyen: 0,
      cozumSuresi: 0,
      oncelikDagilimi: [] as any[],
      durumDagilimi: [] as any[]
    },
    stok: {
      toplamCesit: 0,
      kritikSeviye: 0,
      eksikMalzemeler: [] as any[]
    },
    bakimlar: {
      mekanik: {
        toplam: 0,
        sorunlu: 0
      },
      elektrik: {
        toplam: 0,
        sorunlu: 0
      }
    },
    yapilanIsler: {
      toplam: 0,
      isListesi: [] as any[]
    },
    kesintiler: {
      toplam: 0,
      toplamSure: 0,
      kesintiler: [] as any[]
    },
    invertorler: {
      toplamKontrol: 0,
      calismaOrani: 0
    },
    uretim: {
      toplamUretim: 0,
      hedefGerceklesme: 0,
      gunlukUretim: [] as any[]
    }
  });

  const raporRef = useRef<HTMLDivElement>(null);

  // Yıl seçeneklerini oluştur (son 5 yıl)
  const yilSecenekleri = Array.from({ length: 5 }, (_, i) => {
    const yil = new Date().getFullYear() - i;
    return format(new Date(yil, 0), 'yyyy');
  });

  useEffect(() => {
    const sahalariGetir = async () => {
      if (!kullanici) return;

      try {
        let sahaQuery;
        if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          sahaQuery = query(
            collection(db, 'sahalar'),
            where('__name__', 'in', kullanici.sahalar)
          );
        } else {
          sahaQuery = query(
            collection(db, 'sahalar'),
            where('companyId', '==', kullanici.companyId),
            orderBy('ad')
          );
        }
        
        const sahaSnapshot = await getDocs(sahaQuery);
        const sahaListesi = sahaSnapshot.docs.map(doc => ({
          id: doc.id,
          ad: doc.data().ad
        }));
        setSahalar(sahaListesi);
        
        // Santralleri getir
        let santralQuery;
        if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          santralQuery = query(
            collection(db, 'santraller'),
            where('__name__', 'in', kullanici.sahalar)
          );
        } else {
          santralQuery = query(
            collection(db, 'santraller'),
            where('companyId', '==', kullanici.companyId),
            orderBy('ad')
          );
        }
        
        const santralSnapshot = await getDocs(santralQuery);
        const santralListesi = santralSnapshot.docs.map(doc => ({
          id: doc.id,
          ad: doc.data().ad
        }));
        setSantraller(santralListesi);
      } catch (error) {
        console.error('Sahalar getirilemedi:', error);
        toast.error('Sahalar yüklenirken bir hata oluştu');
      }
    };

    sahalariGetir();
  }, [kullanici]);

  useEffect(() => {
    const verileriGetir = async () => {
      if (!kullanici) return;
      
      try {
        setYukleniyor(true);
        
        const ayBaslangic = startOfMonth(parseISO(secilenAy + '-01'));
        const ayBitis = endOfMonth(parseISO(secilenAy + '-01'));
        const ayBaslangicTimestamp = Timestamp.fromDate(ayBaslangic);
        const ayBitisTimestamp = Timestamp.fromDate(ayBitis);
        
        // Arıza verileri
        let arizaQuery;
        if (secilenSaha) {
          arizaQuery = query(
            collection(db, 'arizalar'),
            where('saha', '==', secilenSaha),
            where('companyId', '==', kullanici.companyId),
            where('olusturmaTarihi', '>=', ayBaslangicTimestamp),
            where('olusturmaTarihi', '<=', ayBitisTimestamp),
            orderBy('olusturmaTarihi', 'desc')
          );
        } else if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          arizaQuery = query(
            collection(db, 'arizalar'),
            where('saha', 'in', kullanici.sahalar),
            where('companyId', '==', kullanici.companyId),
            where('olusturmaTarihi', '>=', ayBaslangicTimestamp),
            where('olusturmaTarihi', '<=', ayBitisTimestamp),
            orderBy('olusturmaTarihi', 'desc')
          );
        } else {
          arizaQuery = query(
            collection(db, 'arizalar'),
            where('companyId', '==', kullanici.companyId),
            where('olusturmaTarihi', '>=', ayBaslangicTimestamp),
            where('olusturmaTarihi', '<=', ayBitisTimestamp),
            orderBy('olusturmaTarihi', 'desc')
          );
        }
        
        const arizaSnapshot = await getDocs(arizaQuery);
        const arizalar = arizaSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Stok verileri
        let stokQuery;
        if (secilenSaha) {
          stokQuery = query(
            collection(db, 'stoklar'),
            where('sahaId', '==', secilenSaha),
            where('companyId', '==', kullanici.companyId)
          );
        } else if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          stokQuery = query(
            collection(db, 'stoklar'),
            where('sahaId', 'in', kullanici.sahalar),
            where('companyId', '==', kullanici.companyId)
          );
        } else {
          stokQuery = query(
            collection(db, 'stoklar'),
            where('companyId', '==', kullanici.companyId)
          );
        }
        
        const stokSnapshot = await getDocs(stokQuery);
        const stoklar = stokSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Mekanik bakım verileri
        let mekanikBakimQuery;
        if (secilenSaha) {
          mekanikBakimQuery = query(
            collection(db, 'mekanikBakimlar'),
            where('sahaId', '==', secilenSaha),
            where('companyId', '==', kullanici.companyId),
            where('tarih', '>=', ayBaslangicTimestamp),
            where('tarih', '<=', ayBitisTimestamp)
          );
        } else if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          mekanikBakimQuery = query(
            collection(db, 'mekanikBakimlar'),
            where('sahaId', 'in', kullanici.sahalar),
            where('companyId', '==', kullanici.companyId),
            where('tarih', '>=', ayBaslangicTimestamp),
            where('tarih', '<=', ayBitisTimestamp)
          );
        } else {
          mekanikBakimQuery = query(
            collection(db, 'mekanikBakimlar'),
            where('companyId', '==', kullanici.companyId),
            where('tarih', '>=', ayBaslangicTimestamp),
            where('tarih', '<=', ayBitisTimestamp)
          );
        }
        
        const mekanikBakimSnapshot = await getDocs(mekanikBakimQuery);
        const mekanikBakimlar = mekanikBakimSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Elektrik bakım verileri
        let elektrikBakimQuery;
        if (secilenSaha) {
          elektrikBakimQuery = query(
            collection(db, 'elektrikBakimlar'),
            where('sahaId', '==', secilenSaha),
            where('companyId', '==', kullanici.companyId),
            where('tarih', '>=', ayBaslangicTimestamp),
            where('tarih', '<=', ayBitisTimestamp)
          );
        } else if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          elektrikBakimQuery = query(
            collection(db, 'elektrikBakimlar'),
            where('sahaId', 'in', kullanici.sahalar),
            where('companyId', '==', kullanici.companyId),
            where('tarih', '>=', ayBaslangicTimestamp),
            where('tarih', '<=', ayBitisTimestamp)
          );
        } else {
          elektrikBakimQuery = query(
            collection(db, 'elektrikBakimlar'),
            where('companyId', '==', kullanici.companyId),
            where('tarih', '>=', ayBaslangicTimestamp),
            where('tarih', '<=', ayBitisTimestamp)
          );
        }
        
        const elektrikBakimSnapshot = await getDocs(elektrikBakimQuery);
        const elektrikBakimlar = elektrikBakimSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Yapılan işler verileri
        let isRaporlariQuery;
        if (secilenSaha) {
          isRaporlariQuery = query(
            collection(db, 'isRaporlari'),
            where('saha', '==', secilenSaha),
            where('companyId', '==', kullanici.companyId),
            where('tarih', '>=', ayBaslangicTimestamp),
            where('tarih', '<=', ayBitisTimestamp)
          );
        } else if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          isRaporlariQuery = query(
            collection(db, 'isRaporlari'),
            where('saha', 'in', kullanici.sahalar),
            where('companyId', '==', kullanici.companyId),
            where('tarih', '>=', ayBaslangicTimestamp),
            where('tarih', '<=', ayBitisTimestamp)
          );
        } else {
          isRaporlariQuery = query(
            collection(db, 'isRaporlari'),
            where('companyId', '==', kullanici.companyId),
            where('tarih', '>=', ayBaslangicTimestamp),
            where('tarih', '<=', ayBitisTimestamp)
          );
        }
        
        const isRaporlariSnapshot = await getDocs(isRaporlariQuery);
        const isRaporlari = isRaporlariSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Elektrik kesintileri verileri
        let kesintilerQuery;
        if (secilenSaha) {
          kesintilerQuery = query(
            collection(db, 'elektrikKesintileri'),
            where('sahaId', '==', secilenSaha),
            where('companyId', '==', kullanici.companyId),
            where('baslangicTarihi', '>=', ayBaslangicTimestamp),
            where('baslangicTarihi', '<=', ayBitisTimestamp)
          );
        } else if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          kesintilerQuery = query(
            collection(db, 'elektrikKesintileri'),
            where('sahaId', 'in', kullanici.sahalar),
            where('companyId', '==', kullanici.companyId),
            where('baslangicTarihi', '>=', ayBaslangicTimestamp),
            where('baslangicTarihi', '<=', ayBitisTimestamp)
          );
        } else {
          kesintilerQuery = query(
            collection(db, 'elektrikKesintileri'),
            where('companyId', '==', kullanici.companyId),
            where('baslangicTarihi', '>=', ayBaslangicTimestamp),
            where('baslangicTarihi', '<=', ayBitisTimestamp)
          );
        }
        
        const kesintilerSnapshot = await getDocs(kesintilerQuery);
        const kesintiler = kesintilerSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // İnvertör kontrol verileri
        let invertorKontrolQuery;
        if (secilenSaha) {
          invertorKontrolQuery = query(
            collection(db, 'invertorKontroller'),
            where('sahaId', '==', secilenSaha),
            where('companyId', '==', kullanici.companyId),
            where('tarih', '>=', ayBaslangicTimestamp),
            where('tarih', '<=', ayBitisTimestamp)
          );
        } else if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          invertorKontrolQuery = query(
            collection(db, 'invertorKontroller'),
            where('sahaId', 'in', kullanici.sahalar),
            where('companyId', '==', kullanici.companyId),
            where('tarih', '>=', ayBaslangicTimestamp),
            where('tarih', '<=', ayBitisTimestamp)
          );
        } else {
          invertorKontrolQuery = query(
            collection(db, 'invertorKontroller'),
            where('companyId', '==', kullanici.companyId),
            where('tarih', '>=', ayBaslangicTimestamp),
            where('tarih', '<=', ayBitisTimestamp)
          );
        }
        
        const invertorKontrolSnapshot = await getDocs(invertorKontrolQuery);
        const invertorKontroller = invertorKontrolSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Üretim verileri
        let uretimQuery;
        if (secilenSaha) {
          uretimQuery = query(
            collection(db, 'uretimVerileri'),
            where('santralId', '==', secilenSaha),
            where('companyId', '==', kullanici.companyId),
            where('tarih', '>=', ayBaslangicTimestamp),
            where('tarih', '<=', ayBitisTimestamp),
            orderBy('tarih', 'asc')
          );
        } else if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          // Müşteri için tüm santrallerin üretim verilerini getir
          uretimQuery = query(
            collection(db, 'uretimVerileri'),
            where('santralId', 'in', kullanici.sahalar),
            where('companyId', '==', kullanici.companyId),
            where('tarih', '>=', ayBaslangicTimestamp),
            where('tarih', '<=', ayBitisTimestamp),
            orderBy('tarih', 'asc')
          );
        } else {
          uretimQuery = query(
            collection(db, 'uretimVerileri'),
            where('companyId', '==', kullanici.companyId),
            where('tarih', '>=', ayBaslangicTimestamp),
            where('tarih', '<=', ayBitisTimestamp),
            orderBy('tarih', 'asc')
          );
        }
        
        const uretimSnapshot = await getDocs(uretimQuery);
        const uretimVerileri = uretimSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Rapor verilerini hazırla
        const arizaRaporu = {
          toplam: arizalar.length,
          cozulen: arizalar.filter(a => a.durum === 'cozuldu').length,
          bekleyen: arizalar.filter(a => a.durum !== 'cozuldu').length,
          cozumSuresi: arizalar
            .filter(a => a.durum === 'cozuldu' && a.cozum)
            .reduce((acc, a) => {
              const baslangic = a.olusturmaTarihi.toDate();
              const bitis = a.cozum.tamamlanmaTarihi.toDate();
              const sureSaat = (bitis.getTime() - baslangic.getTime()) / (1000 * 60 * 60);
              return acc + sureSaat;
            }, 0) / (arizalar.filter(a => a.durum === 'cozuldu' && a.cozum).length || 1),
          oncelikDagilimi: [
            { oncelik: 'Düşük', sayi: arizalar.filter(a => a.oncelik === 'dusuk').length },
            { oncelik: 'Orta', sayi: arizalar.filter(a => a.oncelik === 'orta').length },
            { oncelik: 'Yüksek', sayi: arizalar.filter(a => a.oncelik === 'yuksek').length },
            { oncelik: 'Acil', sayi: arizalar.filter(a => a.oncelik === 'acil').length }
          ],
          durumDagilimi: [
            { durum: 'Açık', sayi: arizalar.filter(a => a.durum === 'acik').length },
            { durum: 'Devam Ediyor', sayi: arizalar.filter(a => a.durum === 'devam-ediyor').length },
            { durum: 'Beklemede', sayi: arizalar.filter(a => a.durum === 'beklemede').length },
            { durum: 'Çözüldü', sayi: arizalar.filter(a => a.durum === 'cozuldu').length }
          ]
        };
        
        const stokRaporu = {
          toplamCesit: stoklar.length,
          kritikSeviye: stoklar.filter(s => s.miktar <= s.kritikSeviye).length,
          eksikMalzemeler: stoklar
            .filter(s => s.miktar <= s.kritikSeviye)
            .map(s => ({
              urunAdi: s.urunAdi,
              miktar: s.miktar,
              birim: s.birim,
              kritikSeviye: s.kritikSeviye,
              eksikMiktar: s.kritikSeviye - s.miktar
            }))
            .sort((a, b) => b.eksikMiktar - a.eksikMiktar)
            .slice(0, 5)
        };
        
        const mekanikBakimRaporu = {
          toplam: mekanikBakimlar.length,
          sorunlu: mekanikBakimlar.filter(bakim => 
            Object.values(bakim.durumlar).some(kategori => 
              Object.values(kategori).some(durum => durum === false)
            )
          ).length
        };
        
        const elektrikBakimRaporu = {
          toplam: elektrikBakimlar.length,
          sorunlu: elektrikBakimlar.filter(bakim => 
            Object.values(bakim.durumlar).some(kategori => 
              Object.values(kategori).some(durum => durum === false)
            )
          ).length
        };
        
        const yapilanIslerRaporu = {
          toplam: isRaporlari.length,
          isListesi: isRaporlari.map(is => ({
            id: is.id,
            baslik: is.baslik,
            tarih: is.tarih.toDate(),
            saha: sahalar.find(s => s.id === is.saha)?.ad || 'Bilinmeyen Saha',
            yapilanIsler: is.yapilanIsler
          }))
        };
        
        const kesintilerRaporu = {
          toplam: kesintiler.length,
          toplamSure: kesintiler.reduce((acc, k) => acc + k.sure, 0),
          kesintiler: kesintiler.map(k => ({
            id: k.id,
            sahaAdi: sahalar.find(s => s.id === k.sahaId)?.ad || 'Bilinmeyen Saha',
            baslangicTarihi: k.baslangicTarihi.toDate(),
            bitisTarihi: k.bitisTarihi ? k.bitisTarihi.toDate() : null,
            sure: k.sure,
            durum: k.durum
          }))
        };
        
        const invertorRaporu = {
          toplamKontrol: invertorKontroller.length,
          calismaOrani: invertorKontroller.length > 0 
            ? invertorKontroller.reduce((acc, kontrol) => {
                const calisanDizeSayisi = kontrol.invertorler.filter(inv => inv.dizeCalisiyor).length;
                const toplamDizeSayisi = kontrol.invertorler.length;
                return acc + (calisanDizeSayisi / toplamDizeSayisi);
              }, 0) / invertorKontroller.length * 100
            : 0
        };
        
        const uretimRaporu = {
          toplamUretim: uretimVerileri.reduce((acc, v) => acc + v.gunlukUretim, 0),
          hedefGerceklesme: 0, // Hedef bilgisi olmadığı için 0 olarak bırakıldı
          gunlukUretim: uretimVerileri.map(v => ({
            tarih: format(v.tarih.toDate(), 'dd MMM', { locale: tr }),
            uretim: v.gunlukUretim
          }))
        };
        
        setRapor({
          ariza: arizaRaporu,
          stok: stokRaporu,
          bakimlar: {
            mekanik: mekanikBakimRaporu,
            elektrik: elektrikBakimRaporu
          },
          yapilanIsler: yapilanIslerRaporu,
          kesintiler: kesintilerRaporu,
          invertorler: invertorRaporu,
          uretim: uretimRaporu
        });
        
      } catch (error) {
        console.error('Veri getirme hatası:', error);
        toast.error('Veriler yüklenirken bir hata oluştu');
      } finally {
        setYukleniyor(false);
      }
    };

    verileriGetir();
  }, [kullanici, secilenAy, secilenSaha, sahalar]);

  const handlePDFIndir = async () => {
    if (!raporRef.current) return;
    
    try {
      toast.loading('PDF oluşturuluyor...', { id: 'pdf-loading' });
      
      const sahaAdi = secilenSaha 
        ? sahalar.find(s => s.id === secilenSaha)?.ad 
        : 'Tüm Sahalar';
      
      const doc = new jsPDF('p', 'mm', 'a4');
      
      // Başlık
      doc.setFontSize(18);
      doc.text(`Aylık Tesis Bakım ve Arıza Raporu`, 105, 15, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text(`Dönem: ${format(parseISO(secilenAy + '-01'), 'MMMM yyyy', { locale: tr })}`, 105, 22, { align: 'center' });
      doc.text(`Saha: ${sahaAdi}`, 105, 28, { align: 'center' });
      doc.text(`Oluşturma Tarihi: ${format(new Date(), 'dd MMMM yyyy', { locale: tr })}`, 105, 34, { align: 'center' });
      
      // Rapor içeriğini canvas olarak çek
      const canvas = await html2canvas(raporRef.current, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      
      // Canvas'ı PDF'e ekle
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Sayfa sayısını hesapla
      const pageHeight = 280;
      const pageCount = Math.ceil(imgHeight / pageHeight);
      
      // İlk sayfaya başlık ekledik, şimdi içeriği ekleyelim
      let position = 40;
      
      // Birden fazla sayfa gerekiyorsa
      for (let i = 0; i < pageCount; i++) {
        if (i > 0) {
          doc.addPage();
          position = 10;
        }
        
        // Canvas'ın ilgili kısmını ekle
        doc.addImage(
          imgData,
          'PNG',
          10,
          position,
          imgWidth,
          Math.min(pageHeight, imgHeight - i * pageHeight)
        );
      }
      
      // PDF'i indir
      doc.save(`aylik-rapor-${secilenAy}-${sahaAdi.replace(/\s+/g, '-')}.pdf`);
      toast.success('Rapor başarıyla indirildi', { id: 'pdf-loading' });
    } catch (error) {
      console.error('Rapor indirme hatası:', error);
      toast.error('Rapor indirilirken bir hata oluştu', { id: 'pdf-loading' });
    }
  };

  const handleYazdir = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => window.history.back()}
            className="mr-3 p-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Aylık Kapsamlı Rapor</h1>
            <p className="mt-1 text-sm text-gray-500">
              {format(parseISO(secilenAy + '-01'), 'MMMM yyyy', { locale: tr })}
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <select
            value={secilenSaha}
            onChange={(e) => setSecilenSaha(e.target.value)}
            className="rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
          >
            <option value="">Tüm Sahalar</option>
            {sahalar.map(saha => (
              <option key={saha.id} value={saha.id}>{saha.ad}</option>
            ))}
          </select>
          <input
            type="month"
            value={secilenAy}
            onChange={(e) => setSecilenAy(e.target.value)}
            className="rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
            min={`${yilSecenekleri[yilSecenekleri.length - 1]}-01`}
            max={`${yilSecenekleri[0]}-12`}
          />
          <button
            onClick={handlePDFIndir}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700"
          >
            <Download className="h-5 w-5 mr-2" />
            PDF İndir
          </button>
          <button
            onClick={handleYazdir}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Printer className="h-5 w-5 mr-2" />
            Yazdır
          </button>
        </div>
      </div>

      {yukleniyor ? (
        <div className="flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div ref={raporRef} className="space-y-8 print:p-8">
          {/* Rapor Başlığı */}
          <div className="print:block hidden bg-gradient-to-r from-yellow-50 to-amber-50 p-6 rounded-xl shadow-sm border border-yellow-100">
            <div className="flex flex-col items-center text-center">
              <FileBarChart className="h-12 w-12 text-yellow-500 mb-3" />
              <h1 className="text-2xl font-bold text-gray-900">Aylık Kapsamlı Rapor</h1>
              <p className="text-lg text-gray-600">
                {format(parseISO(secilenAy + '-01'), 'MMMM yyyy', { locale: tr })}
              </p>
              <p className="text-md text-gray-500 mt-2">
                {secilenSaha ? sahalar.find(s => s.id === secilenSaha)?.ad : 'Tüm Sahalar'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Oluşturma Tarihi: {format(new Date(), 'dd MMMM yyyy', { locale: tr })}
              </p>
            </div>
          </div>

          {/* Özet Kartları */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card decoration="top" decorationColor="red">
              <div className="flex items-center justify-between">
                <div>
                  <Text className="text-sm">Arıza Durumu</Text>
                  <Metric>{rapor.ariza.toplam}</Metric>
                  <Text className="text-xs text-gray-500 mt-1">
                    {rapor.ariza.cozulen} çözüldü, {rapor.ariza.bekleyen} bekliyor
                  </Text>
                </div>
                <div className="rounded-full p-3 bg-red-100">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </Card>
            
            <Card decoration="top" decorationColor="green">
              <div className="flex items-center justify-between">
                <div>
                  <Text className="text-sm">Üretim Durumu</Text>
                  <Metric>{rapor.uretim.toplamUretim.toLocaleString('tr-TR')} kWh</Metric>
                  <Text className="text-xs text-gray-500 mt-1">
                    Aylık toplam üretim
                  </Text>
                </div>
                <div className="rounded-full p-3 bg-green-100">
                  <Battery className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </Card>
            
            <Card decoration="top" decorationColor="blue">
              <div className="flex items-center justify-between">
                <div>
                  <Text className="text-sm">Bakım Durumu</Text>
                  <Metric>{rapor.bakimlar.mekanik.toplam + rapor.bakimlar.elektrik.toplam}</Metric>
                  <Text className="text-xs text-gray-500 mt-1">
                    {rapor.bakimlar.mekanik.toplam} mekanik, {rapor.bakimlar.elektrik.toplam} elektrik
                  </Text>
                </div>
                <div className="rounded-full p-3 bg-blue-100">
                  <Wrench className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </Card>
          </div>

          {/* Arıza Yönetimi */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <Title>Arıza Durumu Dağılımı</Title>
              <DonutChart
                className="mt-6 h-60"
                data={rapor.ariza.durumDagilimi}
                category="sayi"
                index="durum"
                colors={["red", "yellow", "blue", "green"]}
                valueFormatter={(value) => `${value} arıza`}
              />
            </Card>
            
            <Card>
              <Title>Arıza Öncelik Dağılımı</Title>
              <DonutChart
                className="mt-6 h-60"
                data={rapor.ariza.oncelikDagilimi}
                category="sayi"
                index="oncelik"
                colors={["gray", "blue", "orange", "red"]}
                valueFormatter={(value) => `${value} arıza`}
              />
            </Card>
          </div>
          
          {/* Üretim Verileri */}
          {rapor.uretim.gunlukUretim.length > 0 && (
            <Card>
              <Title>Günlük Üretim Verileri</Title>
              <AreaChart
                className="mt-6 h-72"
                data={rapor.uretim.gunlukUretim}
                index="tarih"
                categories={["uretim"]}
                colors={["green"]}
                valueFormatter={(value) => `${value.toFixed(1)} kWh`}
              />
            </Card>
          )}
          
          {/* Stok Durumu */}
          {rapor.stok.eksikMalzemeler.length > 0 && (
            <Card>
              <Title>Kritik Seviyedeki Stoklar</Title>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ürün Adı
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mevcut Miktar
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kritik Seviye
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Eksik Miktar
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rapor.stok.eksikMalzemeler.map((malzeme, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {malzeme.urunAdi}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {malzeme.miktar} {malzeme.birim}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {malzeme.kritikSeviye} {malzeme.birim}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                          {malzeme.eksikMiktar} {malzeme.birim}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          
          {/* Bakım Durumu */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <Title>Mekanik Bakım Durumu</Title>
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Text>Toplam Bakım</Text>
                  <Text>{rapor.bakimlar.mekanik.toplam}</Text>
                </div>
                <div className="flex items-center justify-between">
                  <Text>Sorunlu Bakım</Text>
                  <Text className="text-red-600">{rapor.bakimlar.mekanik.sorunlu}</Text>
                </div>
                <div className="flex items-center justify-between">
                  <Text>Sorunsuz Bakım</Text>
                  <Text className="text-green-600">
                    {rapor.bakimlar.mekanik.toplam - rapor.bakimlar.mekanik.sorunlu}
                  </Text>
                </div>
              </div>
            </Card>
            
            <Card>
              <Title>Elektrik Bakım Durumu</Title>
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Text>Toplam Bakım</Text>
                  <Text>{rapor.bakimlar.elektrik.toplam}</Text>
                </div>
                <div className="flex items-center justify-between">
                  <Text>Sorunlu Bakım</Text>
                  <Text className="text-red-600">{rapor.bakimlar.elektrik.sorunlu}</Text>
                </div>
                <div className="flex items-center justify-between">
                  <Text>Sorunsuz Bakım</Text>
                  <Text className="text-green-600">
                    {rapor.bakimlar.elektrik.toplam - rapor.bakimlar.elektrik.sorunlu}
                  </Text>
                </div>
              </div>
            </Card>
          </div>
          
          {/* Elektrik Kesintileri */}
          {rapor.kesintiler.kesintiler.length > 0 && (
            <Card>
              <Title>Elektrik Kesintileri</Title>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Saha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Başlangıç
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Bitiş
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Süre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Durum
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rapor.kesintiler.kesintiler.map((kesinti, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {kesinti.sahaAdi}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(kesinti.baslangicTarihi, 'dd MMM yyyy HH:mm', { locale: tr })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {kesinti.bitisTarihi 
                            ? format(kesinti.bitisTarihi, 'dd MMM yyyy HH:mm', { locale: tr })
                            : '-'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Math.floor(kesinti.sure / 60)} saat {kesinti.sure % 60} dk
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            kesinti.durum === 'devam-ediyor' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {kesinti.durum === 'devam-ediyor' ? 'Devam Ediyor' : 'Tamamlandı'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          
          {/* Çevresel Etki */}
          <Card className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-none shadow-md">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center mb-4 md:mb-0">
                <div className="p-3 bg-emerald-100 rounded-full mr-4">
                  <Leaf className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <Text className="text-sm text-emerald-700">Çevresel Etki</Text>
                  <div className="flex items-center">
                    <span className="text-xl font-bold text-emerald-800">
                      {(rapor.uretim.toplamUretim * 0.5).toLocaleString('tr-TR', {maximumFractionDigits: 0})} kg
                    </span>
                    <span className="ml-2 text-sm text-emerald-600">
                      CO₂ tasarrufu
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-sm text-emerald-700">
                Bu, yaklaşık {Math.round((rapor.uretim.toplamUretim * 0.5) / 21)} ağacın yıllık CO₂ emilimine eşdeğerdir.
              </div>
            </div>
          </Card>
          
          {/* Yapılan İşler */}
          {rapor.yapilanIsler.isListesi.length > 0 && (
            <Card>
              <Title>Yapılan İşler</Title>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Başlık
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Saha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tarih
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rapor.yapilanIsler.isListesi.map((is, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {is.baslik}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {is.saha}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(is.tarih, 'dd MMM yyyy', { locale: tr })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          
          {/* Özet Tablosu */}
          <Card>
            <Title>Aylık Özet</Title>
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Metrik
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Değer
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Toplam Arıza
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rapor.ariza.toplam}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Çözülen Arıza
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rapor.ariza.cozulen}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Bekleyen Arıza
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rapor.ariza.bekleyen}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Ortalama Çözüm Süresi
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rapor.ariza.cozumSuresi.toFixed(1)} saat
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Kritik Stok Seviyesi
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rapor.stok.kritikSeviye}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Mekanik Bakım
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rapor.bakimlar.mekanik.toplam}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Elektrik Bakım
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rapor.bakimlar.elektrik.toplam}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Yapılan İşler
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rapor.yapilanIsler.toplam}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Elektrik Kesintileri
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rapor.kesintiler.toplam}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Toplam Kesinti Süresi
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {Math.floor(rapor.kesintiler.toplamSure / 60)} saat {rapor.kesintiler.toplamSure % 60} dk
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      İnvertör Çalışma Oranı
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      %{rapor.invertorler.calismaOrani.toFixed(1)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Toplam Üretim
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rapor.uretim.toplamUretim.toFixed(1)} kWh
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};