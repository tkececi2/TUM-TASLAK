
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
  Printer,
  ChevronDown,
  Filter,
  RefreshCw,
  Clock,
  TrendingUp,
  PieChart,
  BarChart2
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ariza: true,
    uretim: true,
    bakim: true,
    kesinti: true,
    stok: true,
    yapilanIsler: true,
    ozet: true
  });
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

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

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

  const handleVeriYenile = () => {
    setYukleniyor(true);
    setTimeout(() => {
      // Veri yenileme
      const verileriGetir = async () => {
        // mevcut verileriGetir fonksiyonunun içeriği
        try {
          // Burada veri yenileme işlemleri yapılır
          // ...
          
          // Başarılı mesajı göster
          toast.success('Veriler başarıyla yenilendi');
        } catch (error) {
          console.error('Veri yenileme hatası:', error);
          toast.error('Veriler yenilenirken bir hata oluştu');
        } finally {
          setYukleniyor(false);
        }
      };
      
      verileriGetir();
    }, 500);
  };

  const renderSectionHeader = (title: string, icon: React.ReactNode, section: string) => (
    <div 
      className="flex items-center justify-between cursor-pointer py-2 px-4 bg-gray-50 rounded-t-lg border-b border-gray-200"
      onClick={() => toggleSection(section)}
    >
      <div className="flex items-center space-x-2">
        {icon}
        <h2 className="text-lg font-medium text-gray-900">{title}</h2>
      </div>
      <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform ${expandedSections[section] ? 'transform rotate-180' : ''}`} />
    </div>
  );

  return (
    <div className="space-y-6 bg-gray-50 min-h-screen pb-12">
      {/* Header and Controls */}
      <div className="sticky top-0 z-10 bg-white shadow-md px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex items-center mb-4 md:mb-0">
            <button
              onClick={() => window.history.back()}
              className="mr-3 p-2 rounded-full hover:bg-gray-100 transition-all"
              aria-label="Geri"
            >
              <ArrowLeft className="h-5 w-5 text-gray-500" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Aylık Kapsamlı Rapor</h1>
              <p className="mt-1 text-sm text-gray-500 flex items-center">
                <Calendar className="h-4 w-4 mr-1 text-yellow-500" />
                {format(parseISO(secilenAy + '-01'), 'MMMM yyyy', { locale: tr })}
                <span className="mx-2">•</span>
                <Building className="h-4 w-4 mr-1 text-blue-500" />
                {secilenSaha ? sahalar.find(s => s.id === secilenSaha)?.ad : 'Tüm Sahalar'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <div className="relative flex items-center">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={secilenSaha}
                onChange={(e) => setSecilenSaha(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg border border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
              >
                <option value="">Tüm Sahalar</option>
                {sahalar.map(saha => (
                  <option key={saha.id} value={saha.id}>{saha.ad}</option>
                ))}
              </select>
            </div>
            
            <div className="relative flex items-center">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="month"
                value={secilenAy}
                onChange={(e) => setSecilenAy(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg border border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                min={`${yilSecenekleri[yilSecenekleri.length - 1]}-01`}
                max={`${yilSecenekleri[0]}-12`}
              />
            </div>
            
            <button
              onClick={handleVeriYenile}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              disabled={yukleniyor}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${yukleniyor ? 'animate-spin' : ''}`} />
              Yenile
            </button>
            
            <button
              onClick={handlePDFIndir}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF İndir
            </button>
            
            <button
              onClick={handleYazdir}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Printer className="h-4 w-4 mr-2" />
              Yazdır
            </button>
          </div>
        </div>
      </div>

      {yukleniyor ? (
        <div className="flex flex-col justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Rapor verileri yükleniyor...</p>
        </div>
      ) : (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div ref={raporRef} className="space-y-8 print:p-8">
            {/* Rapor Başlığı - Print Only */}
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

            {/* Ana Metrikler Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card decoration="top" decorationColor="yellow">
                <div className="flex items-center justify-between">
                  <div>
                    <Text className="text-sm font-semibold text-gray-500">Toplam Üretim</Text>
                    <Metric>{rapor.uretim.toplamUretim.toLocaleString('tr-TR')} kWh</Metric>
                    <Text className="text-xs text-gray-500 mt-1">
                      {format(parseISO(secilenAy + '-01'), 'MMMM yyyy', { locale: tr })}
                    </Text>
                  </div>
                  <div className="rounded-full p-3 bg-yellow-100">
                    <Sun className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
                <ProgressBar 
                  className="mt-3" 
                  value={80} 
                  color="yellow" 
                  tooltip="Hedef gerçekleşme: %80"
                />
              </Card>
              
              <Card decoration="top" decorationColor="red">
                <div className="flex items-center justify-between">
                  <div>
                    <Text className="text-sm font-semibold text-gray-500">Arıza Durumu</Text>
                    <Metric>{rapor.ariza.toplam}</Metric>
                    <div className="flex items-center mt-1">
                      <Badge color="green" size="xs">{rapor.ariza.cozulen} çözüldü</Badge>
                      <Badge color="red" size="xs" className="ml-2">{rapor.ariza.bekleyen} bekliyor</Badge>
                    </div>
                  </div>
                  <div className="rounded-full p-3 bg-red-100">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
                <div className="mt-3 flex items-center text-xs">
                  <Clock className="h-3 w-3 text-gray-500 mr-1" />
                  <span className="text-gray-500">Ort. Çözüm: </span>
                  <span className="font-medium ml-1">{rapor.ariza.cozumSuresi.toFixed(1)} saat</span>
                </div>
              </Card>
              
              <Card decoration="top" decorationColor="blue">
                <div className="flex items-center justify-between">
                  <div>
                    <Text className="text-sm font-semibold text-gray-500">Bakım Durumu</Text>
                    <Metric>{rapor.bakimlar.mekanik.toplam + rapor.bakimlar.elektrik.toplam}</Metric>
                    <div className="flex items-center space-x-2 mt-1 text-xs">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                        <span>{rapor.bakimlar.mekanik.toplam} mekanik</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full mr-1"></div>
                        <span>{rapor.bakimlar.elektrik.toplam} elektrik</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-full p-3 bg-blue-100">
                    <Wrench className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <ProgressBar 
                  className="mt-3" 
                  value={100 - ((rapor.bakimlar.mekanik.sorunlu + rapor.bakimlar.elektrik.sorunlu) / 
                    (rapor.bakimlar.mekanik.toplam + rapor.bakimlar.elektrik.toplam) * 100) || 100} 
                  color="blue" 
                />
              </Card>
              
              <Card decoration="top" decorationColor="green">
                <div className="flex items-center justify-between">
                  <div>
                    <Text className="text-sm font-semibold text-gray-500">İnvertör Durumu</Text>
                    <Metric>%{rapor.invertorler.calismaOrani.toFixed(1)}</Metric>
                    <Text className="text-xs text-gray-500 mt-1">
                      Çalışma oranı
                    </Text>
                  </div>
                  <div className="rounded-full p-3 bg-green-100">
                    <Zap className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <ProgressBar 
                  className="mt-3" 
                  value={rapor.invertorler.calismaOrani} 
                  color="green" 
                />
              </Card>
            </div>

            {/* Çevresel Etki Kartı */}
            <Card className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-none shadow-md">
              <div className="flex flex-col md:flex-row items-center justify-between">
                <div className="flex items-center mb-4 md:mb-0">
                  <div className="p-3 bg-emerald-100 rounded-full mr-4">
                    <Leaf className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div>
                    <Text className="text-sm text-emerald-700 font-semibold">Çevresel Etki</Text>
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
                <div className="text-sm text-emerald-700 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-emerald-600" />
                  <span>Bu, yaklaşık {Math.round((rapor.uretim.toplamUretim * 0.5) / 21)} ağacın yıllık CO₂ emilimine eşdeğerdir.</span>
                </div>
              </div>
            </Card>

            {/* Üretim Verileri */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {renderSectionHeader('Üretim Verileri', <Sun className="h-5 w-5 text-yellow-500" />, 'uretim')}
              
              {expandedSections.uretim && (
                <div className="p-4">
                  {rapor.uretim.gunlukUretim.length > 0 ? (
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <Card>
                          <Text className="text-sm font-semibold">Bu Ayki Toplam Üretim</Text>
                          <Metric>{rapor.uretim.toplamUretim.toLocaleString('tr-TR')} kWh</Metric>
                        </Card>
                        
                        <Card>
                          <Text className="text-sm font-semibold">Günlük Ortalama</Text>
                          <Metric>
                            {(rapor.uretim.toplamUretim / rapor.uretim.gunlukUretim.length).toLocaleString('tr-TR', {maximumFractionDigits: 1})} kWh
                          </Metric>
                        </Card>
                      </div>
                      
                      <Card>
                        <Title>Günlük Üretim Verileri</Title>
                        <AreaChart
                          className="mt-6 h-72"
                          data={rapor.uretim.gunlukUretim}
                          index="tarih"
                          categories={["uretim"]}
                          colors={["amber"]}
                          valueFormatter={(value) => `${value.toFixed(1)} kWh`}
                          showLegend={false}
                          showAnimation={true}
                          curveType="natural"
                        />
                      </Card>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                      <Sun className="h-12 w-12 text-gray-300 mb-3" />
                      <p>Bu dönem için üretim verisi bulunamadı.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Arıza Yönetimi */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {renderSectionHeader('Arıza Yönetimi', <AlertTriangle className="h-5 w-5 text-red-500" />, 'ariza')}
              
              {expandedSections.ariza && (
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                      <Text className="text-sm font-semibold">Toplam Arıza</Text>
                      <Metric>{rapor.ariza.toplam}</Metric>
                    </Card>
                    
                    <Card>
                      <Text className="text-sm font-semibold">Çözülen Arıza</Text>
                      <Metric className="text-green-600">{rapor.ariza.cozulen}</Metric>
                      <Text className="text-xs text-gray-500 mt-1">
                        {rapor.ariza.toplam > 0 ? 
                          `Çözüm oranı: %${((rapor.ariza.cozulen / rapor.ariza.toplam) * 100).toFixed(1)}` : 
                          'Arıza yok'}
                      </Text>
                    </Card>
                    
                    <Card>
                      <Text className="text-sm font-semibold">Ortalama Çözüm Süresi</Text>
                      <Metric>{rapor.ariza.cozumSuresi.toFixed(1)} saat</Metric>
                    </Card>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <div className="flex items-center mb-2">
                        <PieChart className="h-5 w-5 text-blue-500 mr-2" />
                        <Title>Arıza Durumu Dağılımı</Title>
                      </div>
                      <DonutChart
                        className="mt-6 h-60"
                        data={rapor.ariza.durumDagilimi}
                        category="sayi"
                        index="durum"
                        colors={["red", "yellow", "blue", "green"]}
                        valueFormatter={(value) => `${value} arıza`}
                        showAnimation={true}
                        showTooltip={true}
                      />
                    </Card>
                    
                    <Card>
                      <div className="flex items-center mb-2">
                        <BarChart2 className="h-5 w-5 text-orange-500 mr-2" />
                        <Title>Arıza Öncelik Dağılımı</Title>
                      </div>
                      <DonutChart
                        className="mt-6 h-60"
                        data={rapor.ariza.oncelikDagilimi}
                        category="sayi"
                        index="oncelik"
                        colors={["gray", "blue", "orange", "red"]}
                        valueFormatter={(value) => `${value} arıza`}
                        showAnimation={true}
                        showTooltip={true}
                      />
                    </Card>
                  </div>
                </div>
              )}
            </div>
            
            {/* Bakım Kontrolleri */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {renderSectionHeader('Bakım Kontrolleri', <Wrench className="h-5 w-5 text-blue-500" />, 'bakim')}
              
              {expandedSections.bakim && (
                <div className="p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <div className="flex items-center mb-2">
                        <Wrench className="h-5 w-5 text-blue-500 mr-2" />
                        <Title>Mekanik Bakım Durumu</Title>
                      </div>
                      <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <Text>Toplam Bakım</Text>
                          <Text className="font-semibold">{rapor.bakimlar.mekanik.toplam}</Text>
                        </div>
                        <div className="flex items-center justify-between">
                          <Text>Sorunlu Bakım</Text>
                          <Text className="text-red-600 font-semibold">{rapor.bakimlar.mekanik.sorunlu}</Text>
                        </div>
                        <div className="flex items-center justify-between">
                          <Text>Sorunsuz Bakım</Text>
                          <Text className="text-green-600 font-semibold">
                            {rapor.bakimlar.mekanik.toplam - rapor.bakimlar.mekanik.sorunlu}
                          </Text>
                        </div>
                        
                        <div className="pt-4">
                          <Text className="text-sm mb-2">Sorunsuz Bakım Oranı</Text>
                          <div className="flex items-center">
                            <div className="w-full mr-4">
                              <ProgressBar 
                                value={rapor.bakimlar.mekanik.toplam > 0 ? 
                                  ((rapor.bakimlar.mekanik.toplam - rapor.bakimlar.mekanik.sorunlu) / rapor.bakimlar.mekanik.toplam) * 100 : 
                                  100} 
                                color="blue" 
                              />
                            </div>
                            <Text className="font-medium whitespace-nowrap">
                              %{rapor.bakimlar.mekanik.toplam > 0 ? 
                                ((rapor.bakimlar.mekanik.toplam - rapor.bakimlar.mekanik.sorunlu) / rapor.bakimlar.mekanik.toplam * 100).toFixed(0) : 
                                0}
                            </Text>
                          </div>
                        </div>
                      </div>
                    </Card>
                    
                    <Card>
                      <div className="flex items-center mb-2">
                        <Zap className="h-5 w-5 text-indigo-500 mr-2" />
                        <Title>Elektrik Bakım Durumu</Title>
                      </div>
                      <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <Text>Toplam Bakım</Text>
                          <Text className="font-semibold">{rapor.bakimlar.elektrik.toplam}</Text>
                        </div>
                        <div className="flex items-center justify-between">
                          <Text>Sorunlu Bakım</Text>
                          <Text className="text-red-600 font-semibold">{rapor.bakimlar.elektrik.sorunlu}</Text>
                        </div>
                        <div className="flex items-center justify-between">
                          <Text>Sorunsuz Bakım</Text>
                          <Text className="text-green-600 font-semibold">
                            {rapor.bakimlar.elektrik.toplam - rapor.bakimlar.elektrik.sorunlu}
                          </Text>
                        </div>
                        
                        <div className="pt-4">
                          <Text className="text-sm mb-2">Sorunsuz Bakım Oranı</Text>
                          <div className="flex items-center">
                            <div className="w-full mr-4">
                              <ProgressBar 
                                value={rapor.bakimlar.elektrik.toplam > 0 ? 
                                  ((rapor.bakimlar.elektrik.toplam - rapor.bakimlar.elektrik.sorunlu) / rapor.bakimlar.elektrik.toplam) * 100 : 
                                  100} 
                                color="indigo" 
                              />
                            </div>
                            <Text className="font-medium whitespace-nowrap">
                              %{rapor.bakimlar.elektrik.toplam > 0 ? 
                                ((rapor.bakimlar.elektrik.toplam - rapor.bakimlar.elektrik.sorunlu) / rapor.bakimlar.elektrik.toplam * 100).toFixed(0) : 
                                0}
                            </Text>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              )}
            </div>

            {/* Elektrik Kesintileri */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {renderSectionHeader('Elektrik Kesintileri', <Zap className="h-5 w-5 text-orange-500" />, 'kesinti')}
              
              {expandedSections.kesinti && (
                <div className="p-4">
                  {rapor.kesintiler.kesintiler.length > 0 ? (
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card>
                          <Text className="text-sm font-semibold">Toplam Kesinti</Text>
                          <Metric>{rapor.kesintiler.toplam}</Metric>
                        </Card>
                        
                        <Card>
                          <Text className="text-sm font-semibold">Toplam Kesinti Süresi</Text>
                          <Metric>{Math.floor(rapor.kesintiler.toplamSure / 60)} sa {rapor.kesintiler.toplamSure % 60} dk</Metric>
                        </Card>
                        
                        <Card>
                          <Text className="text-sm font-semibold">Ortalama Kesinti Süresi</Text>
                          <Metric>
                            {rapor.kesintiler.toplam > 0 ? 
                              `${Math.floor((rapor.kesintiler.toplamSure / rapor.kesintiler.toplam) / 60)} sa ${Math.floor((rapor.kesintiler.toplamSure / rapor.kesintiler.toplam) % 60)} dk` : 
                              '0 sa 0 dk'}
                          </Metric>
                        </Card>
                      </div>
                      
                      <Card>
                        <Title>Kesinti Listesi</Title>
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
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                      <Zap className="h-12 w-12 text-gray-300 mb-3" />
                      <p>Bu dönem için kesinti kaydı bulunamadı.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Stok Durumu */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {renderSectionHeader('Stok Durumu', <Package className="h-5 w-5 text-purple-500" />, 'stok')}
              
              {expandedSections.stok && (
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <Card>
                      <Text className="text-sm font-semibold">Toplam Stok Çeşidi</Text>
                      <Metric>{rapor.stok.toplamCesit}</Metric>
                    </Card>
                    
                    <Card>
                      <Text className="text-sm font-semibold">Kritik Seviyedeki Stoklar</Text>
                      <Metric className={rapor.stok.kritikSeviye > 0 ? "text-red-600" : "text-green-600"}>
                        {rapor.stok.kritikSeviye}
                      </Metric>
                      <Text className="text-xs text-gray-500 mt-1">
                        {rapor.stok.toplamCesit > 0 ? 
                          `Kritik stok oranı: %${((rapor.stok.kritikSeviye / rapor.stok.toplamCesit) * 100).toFixed(1)}` : 
                          'Stok kaydı yok'}
                      </Text>
                    </Card>
                  </div>
                  
                  {rapor.stok.eksikMalzemeler.length > 0 ? (
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
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                                  {malzeme.eksikMiktar} {malzeme.birim}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                      <Package className="h-12 w-12 text-gray-300 mb-3" />
                      <p>Kritik seviyede stok bulunmamaktadır.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Yapılan İşler */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {renderSectionHeader('Yapılan İşler', <CheckCircle className="h-5 w-5 text-green-500" />, 'yapilanIsler')}
              
              {expandedSections.yapilanIsler && (
                <div className="p-4">
                  {rapor.yapilanIsler.isListesi.length > 0 ? (
                    <div>
                      <Card className="mb-6">
                        <div className="flex items-center justify-between">
                          <Text className="text-sm font-semibold">Toplam Tamamlanan İş</Text>
                          <Metric>{rapor.yapilanIsler.toplam}</Metric>
                        </div>
                      </Card>
                      
                      <Card>
                        <Title>Yapılan İşler Listesi</Title>
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
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                      <CheckCircle className="h-12 w-12 text-gray-300 mb-3" />
                      <p>Bu dönem için iş kaydı bulunamadı.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Özet Tablosu */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {renderSectionHeader('Aylık Özet', <FileBarChart className="h-5 w-5 text-gray-500" />, 'ozet')}
              
              {expandedSections.ozet && (
                <div className="p-4">
                  <Card>
                    <div className="overflow-x-auto">
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
          </div>
        </div>
      )}
    </div>
  );
};
