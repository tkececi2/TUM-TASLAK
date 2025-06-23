
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, getDocs, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Download, 
  Calendar, 
  Building, 
  ArrowLeft,
  Printer,
  Filter,
  RefreshCw,
  ChevronDown,
  AlertTriangle,
  Package,
  Wrench,
  Zap,
  FileText,
  Clock,
  FileBarChart
} from 'lucide-react';
import { Card, Title, Text, BarChart, DonutChart, AreaChart, Grid, Col, Badge } from '@tremor/react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';

interface RaporData {
  title: string;
  icon: JSX.Element;
  color: string;
  sections: {
    id: string;
    title: string;
    visible: boolean;
    content: JSX.Element;
  }[];
}

export const RaporTemplate: React.FC = () => {
  const { raporTuru = 'kapsamli' } = useParams<{ raporTuru: string }>();
  const { kullanici } = useAuth();
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenAy, setSecilenAy] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [secilenSaha, setSecilenSaha] = useState<string>('');
  const [sahalar, setSahalar] = useState<Array<{id: string, ad: string}>>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [raporVerileri, setRaporVerileri] = useState<any>({});
  const navigate = useNavigate();
  
  const raporRef = useRef<HTMLDivElement>(null);

  // Yıl seçeneklerini oluştur (son 5 yıl)
  const yilSecenekleri = Array.from({ length: 5 }, (_, i) => {
    const yil = new Date().getFullYear() - i;
    return format(new Date(yil, 0), 'yyyy');
  });

  // Rapor türüne göre başlık ve ikon belirle
  const getRaporInfo = (): RaporData => {
    switch (raporTuru) {
      case 'ariza':
        return {
          title: 'Arıza Raporu',
          icon: <AlertTriangle className="h-6 w-6 text-red-500" />,
          color: 'red',
          sections: [
            {
              id: 'ozet',
              title: 'Arıza Özeti',
              visible: true,
              content: <ArizaOzetSection data={raporVerileri} />
            },
            {
              id: 'durum',
              title: 'Arıza Durum Dağılımı',
              visible: true,
              content: <ArizaDurumSection data={raporVerileri} />
            },
            {
              id: 'cozum',
              title: 'Çözüm Süreleri',
              visible: true,
              content: <ArizaCozumSection data={raporVerileri} />
            },
            {
              id: 'liste',
              title: 'Arıza Listesi',
              visible: true,
              content: <ArizaListesiSection data={raporVerileri} />
            }
          ]
        };
      case 'stok':
        return {
          title: 'Stok Raporu',
          icon: <Package className="h-6 w-6 text-indigo-500" />,
          color: 'indigo',
          sections: [
            {
              id: 'ozet',
              title: 'Stok Özeti',
              visible: true,
              content: <StokOzetSection data={raporVerileri} />
            },
            {
              id: 'kritik',
              title: 'Kritik Seviyedeki Ürünler',
              visible: true,
              content: <StokKritikSection data={raporVerileri} />
            }
          ]
        };
      case 'santral':
        return {
          title: 'Santral Yönetimi Raporu',
          icon: <Building className="h-6 w-6 text-sky-500" />,
          color: 'sky',
          sections: [
            {
              id: 'ozet',
              title: 'Santral Özeti',
              visible: true,
              content: <SantralOzetSection data={raporVerileri} />
            },
            {
              id: 'performans',
              title: 'Performans Değerlendirmesi',
              visible: true,
              content: <SantralPerformansSection data={raporVerileri} />
            }
          ]
        };
      case 'uretim':
        return {
          title: 'Üretim Raporu',
          icon: <FileBarChart className="h-6 w-6 text-amber-500" />,
          color: 'amber',
          sections: [
            {
              id: 'ozet',
              title: 'Üretim Özeti',
              visible: true,
              content: <UretimOzetSection data={raporVerileri} />
            },
            {
              id: 'gunluk',
              title: 'Günlük Üretim Verileri',
              visible: true,
              content: <UretimGunlukSection data={raporVerileri} />
            }
          ]
        };
      case 'isler':
        return {
          title: 'Yapılan İşler Raporu',
          icon: <FileText className="h-6 w-6 text-emerald-500" />,
          color: 'emerald',
          sections: [
            {
              id: 'ozet',
              title: 'Yapılan İşler Özeti',
              visible: true,
              content: <IslerOzetSection data={raporVerileri} />
            },
            {
              id: 'liste',
              title: 'İş Listesi',
              visible: true,
              content: <IslerListeSection data={raporVerileri} />
            }
          ]
        };
      case 'kesinti':
        return {
          title: 'Elektrik Kesintileri Raporu',
          icon: <Clock className="h-6 w-6 text-orange-500" />,
          color: 'orange',
          sections: [
            {
              id: 'ozet',
              title: 'Kesinti Özeti',
              visible: true,
              content: <KesintiOzetSection data={raporVerileri} />
            },
            {
              id: 'liste',
              title: 'Kesinti Listesi',
              visible: true,
              content: <KesintiListeSection data={raporVerileri} />
            }
          ]
        };
      case 'invertor':
        return {
          title: 'İnvertör Kontrol Raporu',
          icon: <Zap className="h-6 w-6 text-violet-500" />,
          color: 'violet',
          sections: [
            {
              id: 'ozet',
              title: 'İnvertör Özeti',
              visible: true,
              content: <InvertorOzetSection data={raporVerileri} />
            },
            {
              id: 'performans',
              title: 'İnvertör Performansı',
              visible: true,
              content: <InvertorPerformansSection data={raporVerileri} />
            }
          ]
        };
      case 'mekanik':
        return {
          title: 'Mekanik Bakım Raporu',
          icon: <Wrench className="h-6 w-6 text-cyan-500" />,
          color: 'cyan',
          sections: [
            {
              id: 'ozet',
              title: 'Mekanik Bakım Özeti',
              visible: true,
              content: <MekanikOzetSection data={raporVerileri} />
            },
            {
              id: 'liste',
              title: 'Bakım Listesi',
              visible: true,
              content: <MekanikListeSection data={raporVerileri} />
            }
          ]
        };
      case 'elektrik':
        return {
          title: 'Elektrik Bakım Raporu',
          icon: <Zap className="h-6 w-6 text-blue-500" />,
          color: 'blue',
          sections: [
            {
              id: 'ozet',
              title: 'Elektrik Bakım Özeti',
              visible: true,
              content: <ElektrikOzetSection data={raporVerileri} />
            },
            {
              id: 'liste',
              title: 'Bakım Listesi',
              visible: true,
              content: <ElektrikListeSection data={raporVerileri} />
            }
          ]
        };
      case 'kapsamli':
      default:
        return {
          title: 'Kapsamlı Rapor',
          icon: <FileBarChart className="h-6 w-6 text-gray-700" />,
          color: 'gray',
          sections: [
            {
              id: 'ozet',
              title: 'Genel Özet',
              visible: true,
              content: <KapsamliOzetSection data={raporVerileri} />
            },
            {
              id: 'ariza',
              title: 'Arıza Yönetimi',
              visible: true,
              content: <KapsamliArizaSection data={raporVerileri} />
            },
            {
              id: 'uretim',
              title: 'Üretim Verileri',
              visible: true,
              content: <KapsamliUretimSection data={raporVerileri} />
            },
            {
              id: 'stok',
              title: 'Stok Durumu',
              visible: true,
              content: <KapsamliStokSection data={raporVerileri} />
            },
            {
              id: 'bakim',
              title: 'Bakım Kontrolleri',
              visible: true,
              content: <KapsamliBakimSection data={raporVerileri} />
            },
            {
              id: 'isler',
              title: 'Yapılan İşler',
              visible: true,
              content: <KapsamliIslerSection data={raporVerileri} />
            },
            {
              id: 'kesinti',
              title: 'Elektrik Kesintileri',
              visible: true,
              content: <KapsamliKesintiSection data={raporVerileri} />
            },
            {
              id: 'invertor',
              title: 'İnvertör Sistemleri',
              visible: true,
              content: <KapsamliInvertorSection data={raporVerileri} />
            }
          ]
        };
    }
  };

  const raporInfo = getRaporInfo();

  // Başlangıçta tüm bölümleri genişlet
  useEffect(() => {
    const initialExpandedState: Record<string, boolean> = {};
    raporInfo.sections.forEach(section => {
      initialExpandedState[section.id] = true;
    });
    setExpandedSections(initialExpandedState);
  }, [raporTuru]);

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
        
        // Rapor türüne göre veri getirme işlemleri
        let veriler: any = {};
        
        if (raporTuru === 'ariza' || raporTuru === 'kapsamli') {
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
          } else if (kullanici.rol === 'musteri' && kullanici.sahalar && kullanici.sahalar.length > 0) {
            arizaQuery = query(
              collection(db, 'arizalar'),
              where('saha', 'in', kullanici.sahalar.slice(0, 10)),
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
          
          try {
            const arizaSnapshot = await getDocs(arizaQuery);
            const arizalar = arizaSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            veriler.arizalar = arizalar;
            veriler.arizaIstatistikleri = {
              toplam: arizalar.length,
              cozulen: arizalar.filter(a => a.durum === 'cozuldu').length,
              bekleyen: arizalar.filter(a => a.durum !== 'cozuldu').length,
              cozumSuresi: arizalar
                .filter(a => a.durum === 'cozuldu' && a.cozum)
                .reduce((acc, a) => {
                  try {
                    const baslangic = a.olusturmaTarihi.toDate();
                    const bitis = a.cozum.tamamlanmaTarihi.toDate();
                    const sureSaat = (bitis.getTime() - baslangic.getTime()) / (1000 * 60 * 60);
                    return acc + sureSaat;
                  } catch (error) {
                    return acc;
                  }
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
          } catch (error) {
            console.error('Arıza verileri getirme hatası:', error);
            veriler.arizalar = [];
            veriler.arizaIstatistikleri = {
              toplam: 0, cozulen: 0, bekleyen: 0, cozumSuresi: 0,
              oncelikDagilimi: [], durumDagilimi: []
            };
          }
        }
        
        if (raporTuru === 'stok' || raporTuru === 'kapsamli') {
          // Stok verileri
          let stokQuery;
          if (secilenSaha) {
            stokQuery = query(
              collection(db, 'stoklar'),
              where('sahaId', '==', secilenSaha),
              where('companyId', '==', kullanici.companyId)
            );
          } else if (kullanici.rol === 'musteri' && kullanici.sahalar && kullanici.sahalar.length > 0) {
            stokQuery = query(
              collection(db, 'stoklar'),
              where('sahaId', 'in', kullanici.sahalar.slice(0, 10)),
              where('companyId', '==', kullanici.companyId)
            );
          } else {
            stokQuery = query(
              collection(db, 'stoklar'),
              where('companyId', '==', kullanici.companyId)
            );
          }
          
          try {
            const stokSnapshot = await getDocs(stokQuery);
            const stoklar = stokSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            veriler.stoklar = stoklar;
            veriler.stokIstatistikleri = {
              toplamCesit: stoklar.length,
              kritikSeviye: stoklar.filter(s => s.miktar <= (s.kritikSeviye || 0)).length,
              eksikMalzemeler: stoklar
                .filter(s => s.miktar <= (s.kritikSeviye || 0))
                .map(s => ({
                  urunAdi: s.urunAdi || 'İsimsiz Ürün',
                  miktar: s.miktar || 0,
                  birim: s.birim || 'adet',
                  kritikSeviye: s.kritikSeviye || 0,
                  eksikMiktar: (s.kritikSeviye || 0) - (s.miktar || 0)
                }))
                .sort((a, b) => b.eksikMiktar - a.eksikMiktar)
            };
          } catch (error) {
            console.error('Stok verileri getirme hatası:', error);
            veriler.stoklar = [];
            veriler.stokIstatistikleri = { toplamCesit: 0, kritikSeviye: 0, eksikMalzemeler: [] };
          }
        }
        
        if (raporTuru === 'mekanik' || raporTuru === 'kapsamli') {
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
          } else if (kullanici.rol === 'musteri' && kullanici.sahalar && kullanici.sahalar.length > 0) {
            mekanikBakimQuery = query(
              collection(db, 'mekanikBakimlar'),
              where('sahaId', 'in', kullanici.sahalar.slice(0, 10)),
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
          
          try {
            const mekanikBakimSnapshot = await getDocs(mekanikBakimQuery);
            const mekanikBakimlar = mekanikBakimSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            veriler.mekanikBakimlar = mekanikBakimlar;
            veriler.mekanikBakimIstatistikleri = {
              toplam: mekanikBakimlar.length,
              sorunlu: mekanikBakimlar.filter(bakim => {
                try {
                  return Object.values(bakim.durumlar || {}).some(kategori => 
                    Object.values(kategori || {}).some(durum => durum === false)
                  );
                } catch (error) {
                  return false;
                }
              }).length
            };
          } catch (error) {
            console.error('Mekanik bakım verileri getirme hatası:', error);
            veriler.mekanikBakimlar = [];
            veriler.mekanikBakimIstatistikleri = { toplam: 0, sorunlu: 0 };
          }
        }
        
        if (raporTuru === 'elektrik' || raporTuru === 'kapsamli') {
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
          } else if (kullanici.rol === 'musteri' && kullanici.sahalar && kullanici.sahalar.length > 0) {
            elektrikBakimQuery = query(
              collection(db, 'elektrikBakimlar'),
              where('sahaId', 'in', kullanici.sahalar.slice(0, 10)),
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
          
          try {
            const elektrikBakimSnapshot = await getDocs(elektrikBakimQuery);
            const elektrikBakimlar = elektrikBakimSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            veriler.elektrikBakimlar = elektrikBakimlar;
            veriler.elektrikBakimIstatistikleri = {
              toplam: elektrikBakimlar.length,
              sorunlu: elektrikBakimlar.filter(bakim => {
                try {
                  return Object.values(bakim.durumlar || {}).some(kategori => 
                    Object.values(kategori || {}).some(durum => durum === false)
                  );
                } catch (error) {
                  return false;
                }
              }).length
            };
          } catch (error) {
            console.error('Elektrik bakım verileri getirme hatası:', error);
            veriler.elektrikBakimlar = [];
            veriler.elektrikBakimIstatistikleri = { toplam: 0, sorunlu: 0 };
          }
        }
        
        if (raporTuru === 'isler' || raporTuru === 'kapsamli') {
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
          } else if (kullanici.rol === 'musteri' && kullanici.sahalar && kullanici.sahalar.length > 0) {
            isRaporlariQuery = query(
              collection(db, 'isRaporlari'),
              where('saha', 'in', kullanici.sahalar.slice(0, 10)),
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
          
          try {
            const isRaporlariSnapshot = await getDocs(isRaporlariQuery);
            const isRaporlari = isRaporlariSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            veriler.isRaporlari = isRaporlari;
            veriler.isRaporlariIstatistikleri = {
              toplam: isRaporlari.length,
              isListesi: isRaporlari.map(is => {
                try {
                  return {
                    id: is.id,
                    baslik: is.baslik || 'İsimsiz İş',
                    tarih: is.tarih ? is.tarih.toDate() : new Date(),
                    saha: sahalar.find(s => s.id === is.saha)?.ad || 'Bilinmeyen Saha',
                    yapilanIsler: is.yapilanIsler || ''
                  };
                } catch (error) {
                  return {
                    id: is.id,
                    baslik: 'Veri Hatası',
                    tarih: new Date(),
                    saha: 'Bilinmeyen Saha',
                    yapilanIsler: ''
                  };
                }
              })
            };
          } catch (error) {
            console.error('İş raporları getirme hatası:', error);
            veriler.isRaporlari = [];
            veriler.isRaporlariIstatistikleri = { toplam: 0, isListesi: [] };
          }
        }
        
        if (raporTuru === 'kesinti' || raporTuru === 'kapsamli') {
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
          } else if (kullanici.rol === 'musteri' && kullanici.sahalar && kullanici.sahalar.length > 0) {
            kesintilerQuery = query(
              collection(db, 'elektrikKesintileri'),
              where('sahaId', 'in', kullanici.sahalar.slice(0, 10)),
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
          
          try {
            const kesintilerSnapshot = await getDocs(kesintilerQuery);
            const kesintiler = kesintilerSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            veriler.kesintiler = kesintiler;
            veriler.kesintilerIstatistikleri = {
              toplam: kesintiler.length,
              toplamSure: kesintiler.reduce((acc, k) => acc + (k.sure || 0), 0),
              kesintiler: kesintiler.map(k => {
                try {
                  return {
                    id: k.id,
                    sahaAdi: sahalar.find(s => s.id === k.sahaId)?.ad || 'Bilinmeyen Saha',
                    baslangicTarihi: k.baslangicTarihi ? k.baslangicTarihi.toDate() : new Date(),
                    bitisTarihi: k.bitisTarihi ? k.bitisTarihi.toDate() : null,
                    sure: k.sure || 0,
                    durum: k.durum || 'bilinmiyor'
                  };
                } catch (error) {
                  return {
                    id: k.id,
                    sahaAdi: 'Bilinmeyen Saha',
                    baslangicTarihi: new Date(),
                    bitisTarihi: null,
                    sure: 0,
                    durum: 'bilinmiyor'
                  };
                }
              })
            };
          } catch (error) {
            console.error('Kesinti verileri getirme hatası:', error);
            veriler.kesintiler = [];
            veriler.kesintilerIstatistikleri = { toplam: 0, toplamSure: 0, kesintiler: [] };
          }
        }
        
        if (raporTuru === 'invertor' || raporTuru === 'kapsamli') {
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
          } else if (kullanici.rol === 'musteri' && kullanici.sahalar && kullanici.sahalar.length > 0) {
            invertorKontrolQuery = query(
              collection(db, 'invertorKontroller'),
              where('sahaId', 'in', kullanici.sahalar.slice(0, 10)),
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
          
          try {
            const invertorKontrolSnapshot = await getDocs(invertorKontrolQuery);
            const invertorKontroller = invertorKontrolSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            veriler.invertorKontroller = invertorKontroller;
            veriler.invertorKontrollerIstatistikleri = {
              toplamKontrol: invertorKontroller.length,
              calismaOrani: invertorKontroller.length > 0 
                ? invertorKontroller.reduce((acc, kontrol) => {
                    try {
                      if (!kontrol.invertorler || !Array.isArray(kontrol.invertorler)) return acc;
                      const calisanDizeSayisi = kontrol.invertorler.filter(inv => inv && inv.dizeCalisiyor).length;
                      const toplamDizeSayisi = kontrol.invertorler.length;
                      return acc + (toplamDizeSayisi > 0 ? (calisanDizeSayisi / toplamDizeSayisi) : 0);
                    } catch (error) {
                      return acc;
                    }
                  }, 0) / invertorKontroller.length * 100
                : 0
            };
          } catch (error) {
            console.error('İnvertör kontrol verileri getirme hatası:', error);
            veriler.invertorKontroller = [];
            veriler.invertorKontrollerIstatistikleri = { toplamKontrol: 0, calismaOrani: 0 };
          }
        }
        
        if (raporTuru === 'uretim' || raporTuru === 'santral' || raporTuru === 'kapsamli') {
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
          } else if (kullanici.rol === 'musteri' && kullanici.sahalar && kullanici.sahalar.length > 0) {
            uretimQuery = query(
              collection(db, 'uretimVerileri'),
              where('santralId', 'in', kullanici.sahalar.slice(0, 10)),
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
          
          try {
            const uretimSnapshot = await getDocs(uretimQuery);
            const uretimVerileri = uretimSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            veriler.uretimVerileri = uretimVerileri;
            veriler.uretimVerileriIstatistikleri = {
              toplamUretim: uretimVerileri.reduce((acc, v) => acc + (v.gunlukUretim || 0), 0),
              hedefGerceklesme: 0, // Hedef bilgisi olmadığı için 0 olarak bırakıldı
              gunlukUretim: uretimVerileri.map(v => {
                try {
                  return {
                    tarih: v.tarih ? format(v.tarih.toDate(), 'dd MMM', { locale: tr }) : '-',
                    uretim: v.gunlukUretim || 0
                  };
                } catch (error) {
                  return {
                    tarih: '-',
                    uretim: 0
                  };
                }
              })
            };
          } catch (error) {
            console.error('Üretim verileri getirme hatası:', error);
            veriler.uretimVerileri = [];
            veriler.uretimVerileriIstatistikleri = { toplamUretim: 0, hedefGerceklesme: 0, gunlukUretim: [] };
          }
        }
        
        setRaporVerileri(veriler);
        
      } catch (error) {
        console.error('Veri getirme hatası:', error);
        toast.error('Veriler yüklenirken bir hata oluştu');
      } finally {
        setYukleniyor(false);
      }
    };

    verileriGetir();
  }, [kullanici, secilenAy, secilenSaha, sahalar, raporTuru]);

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
      doc.text(`${raporInfo.title}`, 105, 15, { align: 'center' });
      
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
      doc.save(`${raporInfo.title.toLowerCase().replace(/\s+/g, '-')}-${secilenAy}-${sahaAdi.replace(/\s+/g, '-')}.pdf`);
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
    // verileriGetir fonksiyonunu tetiklemek için secilenAy'ı değiştirip geri değiştiriyoruz
    const currentAy = secilenAy;
    setSecilenAy('2000-01');
    setTimeout(() => {
      setSecilenAy(currentAy);
    }, 100);
  };

  const renderSectionHeader = (title: string, section: string) => (
    <div 
      className="flex items-center justify-between cursor-pointer py-2 px-4 bg-gray-50 rounded-t-lg border-b border-gray-200"
      onClick={() => toggleSection(section)}
    >
      <div className="flex items-center space-x-2">
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
              onClick={() => navigate('/anasayfa')}
              className="mr-3 p-2 rounded-full hover:bg-gray-100 transition-all"
              aria-label="Geri"
            >
              <ArrowLeft className="h-5 w-5 text-gray-500" />
            </button>
            <div>
              <div className="flex items-center">
                {raporInfo.icon}
                <h1 className="text-2xl font-bold text-gray-900 ml-2">{raporInfo.title}</h1>
              </div>
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
                {raporInfo.icon}
                <h1 className="text-2xl font-bold text-gray-900 mt-3">{raporInfo.title}</h1>
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

            {/* Rapor Bölümleri */}
            {raporInfo.sections.map((section) => (
              <div key={section.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                {renderSectionHeader(section.title, section.id)}
                
                {expandedSections[section.id] && (
                  <div className="p-4">
                    {section.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Rapor İçerik Bileşenleri
const ArizaOzetSection: React.FC<{ data: any }> = ({ data }) => {
  const arizaData = data.arizaIstatistikleri || { toplam: 0, cozulen: 0, bekleyen: 0, cozumSuresi: 0 };
  
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <Text className="text-sm font-semibold">Toplam Arıza</Text>
          <div className="text-2xl font-bold mt-2">{arizaData.toplam}</div>
        </Card>
        
        <Card>
          <Text className="text-sm font-semibold">Çözülen Arıza</Text>
          <div className="text-2xl font-bold mt-2 text-green-600">{arizaData.cozulen}</div>
          <Text className="text-xs text-gray-500 mt-1">
            {arizaData.toplam > 0 ? 
              `Çözüm oranı: %${((arizaData.cozulen / arizaData.toplam) * 100).toFixed(1)}` : 
              'Arıza yok'}
          </Text>
        </Card>
        
        <Card>
          <Text className="text-sm font-semibold">Ortalama Çözüm Süresi</Text>
          <div className="text-2xl font-bold mt-2">{arizaData.cozumSuresi.toFixed(1)} saat</div>
        </Card>
      </div>
    </div>
  );
};

const ArizaDurumSection: React.FC<{ data: any }> = ({ data }) => {
  const durumData = data.arizaIstatistikleri?.durumDagilimi || [];
  const oncelikData = data.arizaIstatistikleri?.oncelikDagilimi || [];
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <Title>Arıza Durumu Dağılımı</Title>
        {durumData.length > 0 ? (
          <DonutChart
            className="mt-6 h-60"
            data={durumData}
            category="sayi"
            index="durum"
            colors={["red", "yellow", "blue", "green"]}
            valueFormatter={(value) => `${value} arıza`}
            showAnimation={true}
          />
        ) : (
          <div className="flex items-center justify-center h-60 text-gray-400">Veri bulunamadı</div>
        )}
      </Card>
      
      <Card>
        <Title>Arıza Öncelik Dağılımı</Title>
        {oncelikData.length > 0 ? (
          <DonutChart
            className="mt-6 h-60"
            data={oncelikData}
            category="sayi"
            index="oncelik"
            colors={["gray", "blue", "orange", "red"]}
            valueFormatter={(value) => `${value} arıza`}
            showAnimation={true}
          />
        ) : (
          <div className="flex items-center justify-center h-60 text-gray-400">Veri bulunamadı</div>
        )}
      </Card>
    </div>
  );
};

const ArizaCozumSection: React.FC<{ data: any }> = ({ data }) => {
  // Bu kısım eklenecek gerçek veri
  return (
    <Card>
      <Title>Çözüm Süreleri Analizi</Title>
      <Text className="mt-2 text-gray-500">Ortalama çözüm süresi: {data.arizaIstatistikleri?.cozumSuresi.toFixed(1) || 0} saat</Text>
      <div className="mt-4">
        <div className="text-sm font-medium text-gray-700 mb-1">Arıza Türlerine Göre Çözüm Süreleri</div>
        <BarChart
          className="mt-6 h-60"
          data={[
            { tur: 'Elektrik', sure: data.arizaIstatistikleri?.cozumSuresi || 0 },
            { tur: 'Mekanik', sure: data.arizaIstatistikleri?.cozumSuresi * 0.8 || 0 },
            { tur: 'İnvertör', sure: data.arizaIstatistikleri?.cozumSuresi * 1.2 || 0 },
            { tur: 'Panel', sure: data.arizaIstatistikleri?.cozumSuresi * 1.5 || 0 }
          ]}
          index="tur"
          categories={["sure"]}
          colors={["blue"]}
          valueFormatter={(value) => `${value.toFixed(1)} saat`}
          showAnimation={true}
        />
      </div>
    </Card>
  );
};

const ArizaListesiSection: React.FC<{ data: any }> = ({ data }) => {
  const arizalar = data.arizalar || [];
  
  return (
    <Card>
      <Title>Arıza Listesi</Title>
      {arizalar.length > 0 ? (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Başlık
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Öncelik
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Oluşturma Tarihi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {arizalar.slice(0, 10).map((ariza: any) => (
                <tr key={ariza.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {ariza.baslik || 'İsimsiz Arıza'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <Badge color={
                      ariza.oncelik === 'acil' ? 'red' : 
                      ariza.oncelik === 'yuksek' ? 'orange' : 
                      ariza.oncelik === 'orta' ? 'blue' : 'gray'
                    }>
                      {ariza.oncelik === 'acil' ? 'Acil' : 
                       ariza.oncelik === 'yuksek' ? 'Yüksek' : 
                       ariza.oncelik === 'orta' ? 'Orta' : 'Düşük'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <Badge color={
                      ariza.durum === 'cozuldu' ? 'green' : 
                      ariza.durum === 'devam-ediyor' ? 'yellow' : 
                      ariza.durum === 'beklemede' ? 'blue' : 'red'
                    }>
                      {ariza.durum === 'cozuldu' ? 'Çözüldü' : 
                       ariza.durum === 'devam-ediyor' ? 'Devam Ediyor' : 
                       ariza.durum === 'beklemede' ? 'Beklemede' : 'Açık'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {ariza.olusturmaTarihi ? format(ariza.olusturmaTarihi.toDate(), 'dd.MM.yyyy HH:mm') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {arizalar.length > 10 && (
            <div className="mt-4 text-right text-sm text-gray-500">
              Toplam {arizalar.length} arızadan ilk 10 tanesi gösteriliyor.
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 text-gray-400">
          Bu dönem için arıza kaydı bulunamadı.
        </div>
      )}
    </Card>
  );
};

// Diğer rapor bölümleri (bu örnekler sadece basit içerikler içeriyor, tam uygulamada her biri ayrı detaylı bileşenler olmalı)
const StokOzetSection: React.FC<{ data: any }> = ({ data }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
    <Card>
      <Text className="text-sm font-semibold">Toplam Stok Çeşidi</Text>
      <div className="text-2xl font-bold mt-2">{data.stokIstatistikleri?.toplamCesit || 0}</div>
    </Card>
    
    <Card>
      <Text className="text-sm font-semibold">Kritik Seviyedeki Stoklar</Text>
      <div className="text-2xl font-bold mt-2 text-red-600">{data.stokIstatistikleri?.kritikSeviye || 0}</div>
      <Text className="text-xs text-gray-500 mt-1">
        {data.stokIstatistikleri?.toplamCesit > 0 ? 
          `Kritik stok oranı: %${((data.stokIstatistikleri.kritikSeviye / data.stokIstatistikleri.toplamCesit) * 100).toFixed(1)}` : 
          'Stok kaydı yok'}
      </Text>
    </Card>
  </div>
);

const StokKritikSection: React.FC<{ data: any }> = ({ data }) => {
  const eksikMalzemeler = data.stokIstatistikleri?.eksikMalzemeler || [];
  
  return (
    <Card>
      <Title>Kritik Seviyedeki Stoklar</Title>
      {eksikMalzemeler.length > 0 ? (
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
              {eksikMalzemeler.map((malzeme: any, index: number) => (
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
      ) : (
        <div className="flex items-center justify-center h-32 text-gray-400">
          Kritik seviyede stok bulunmamaktadır.
        </div>
      )}
    </Card>
  );
};

// Diğer rapor bileşenleri benzer şekilde uygulanacak
const SantralOzetSection: React.FC<{ data: any }> = ({ data }) => (
  <div className="text-center text-gray-500 p-6">Santral özet verileri buraya gelecek</div>
);

const SantralPerformansSection: React.FC<{ data: any }> = ({ data }) => (
  <div className="text-center text-gray-500 p-6">Santral performans verileri buraya gelecek</div>
);

const UretimOzetSection: React.FC<{ data: any }> = ({ data }) => {
  const uretimData = data.uretimVerileriIstatistikleri || { toplamUretim: 0, hedefGerceklesme: 0 };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <Card>
        <Text className="text-sm font-semibold">Toplam Üretim</Text>
        <div className="text-2xl font-bold mt-2">{uretimData.toplamUretim.toFixed(1)} kWh</div>
      </Card>
      
      <Card>
        <Text className="text-sm font-semibold">Günlük Ortalama Üretim</Text>
        <div className="text-2xl font-bold mt-2">
          {uretimData.gunlukUretim && uretimData.gunlukUretim.length > 0 
            ? (uretimData.toplamUretim / uretimData.gunlukUretim.length).toFixed(1) 
            : '0'} kWh
        </div>
      </Card>
    </div>
  );
};

const UretimGunlukSection: React.FC<{ data: any }> = ({ data }) => {
  const gunlukUretim = data.uretimVerileriIstatistikleri?.gunlukUretim || [];
  
  return (
    <Card>
      <Title>Günlük Üretim Verileri</Title>
      {gunlukUretim.length > 0 ? (
        <AreaChart
          className="mt-6 h-72"
          data={gunlukUretim}
          index="tarih"
          categories={["uretim"]}
          colors={["amber"]}
          valueFormatter={(value) => `${value.toFixed(1)} kWh`}
          showLegend={false}
          showAnimation={true}
        />
      ) : (
        <div className="flex items-center justify-center h-72 text-gray-400">
          Bu dönem için üretim verisi bulunamadı.
        </div>
      )}
    </Card>
  );
};

const IslerOzetSection: React.FC<{ data: any }> = ({ data }) => (
  <Card>
    <Text className="text-sm font-semibold">Toplam Yapılan İş</Text>
    <div className="text-2xl font-bold mt-2">{data.isRaporlariIstatistikleri?.toplam || 0}</div>
  </Card>
);

const IslerListeSection: React.FC<{ data: any }> = ({ data }) => {
  const isListesi = data.isRaporlariIstatistikleri?.isListesi || [];
  
  return (
    <Card>
      <Title>Yapılan İşler Listesi</Title>
      {isListesi.length > 0 ? (
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
              {isListesi.map((is: any) => (
                <tr key={is.id} className="hover:bg-gray-50">
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
      ) : (
        <div className="flex items-center justify-center h-32 text-gray-400">
          Bu dönem için iş kaydı bulunamadı.
        </div>
      )}
    </Card>
  );
};

const KesintiOzetSection: React.FC<{ data: any }> = ({ data }) => {
  const kesintiler = data.kesintilerIstatistikleri || { toplam: 0, toplamSure: 0 };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card>
        <Text className="text-sm font-semibold">Toplam Kesinti</Text>
        <div className="text-2xl font-bold mt-2">{kesintiler.toplam}</div>
      </Card>
      
      <Card>
        <Text className="text-sm font-semibold">Toplam Kesinti Süresi</Text>
        <div className="text-2xl font-bold mt-2">{Math.floor(kesintiler.toplamSure / 60)} sa {kesintiler.toplamSure % 60} dk</div>
      </Card>
      
      <Card>
        <Text className="text-sm font-semibold">Ortalama Kesinti Süresi</Text>
        <div className="text-2xl font-bold mt-2">
          {kesintiler.toplam > 0 ? 
            `${Math.floor((kesintiler.toplamSure / kesintiler.toplam) / 60)} sa ${Math.floor((kesintiler.toplamSure / kesintiler.toplam) % 60)} dk` : 
            '0 sa 0 dk'}
        </div>
      </Card>
    </div>
  );
};

const KesintiListeSection: React.FC<{ data: any }> = ({ data }) => {
  const kesintiler = data.kesintilerIstatistikleri?.kesintiler || [];
  
  return (
    <Card>
      <Title>Kesinti Listesi</Title>
      {kesintiler.length > 0 ? (
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
              {kesintiler.map((kesinti: any) => (
                <tr key={kesinti.id} className="hover:bg-gray-50">
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
                    <Badge color={kesinti.durum === 'devam-ediyor' ? 'red' : 'green'}>
                      {kesinti.durum === 'devam-ediyor' ? 'Devam Ediyor' : 'Tamamlandı'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 text-gray-400">
          Bu dönem için kesinti kaydı bulunamadı.
        </div>
      )}
    </Card>
  );
};

const InvertorOzetSection: React.FC<{ data: any }> = ({ data }) => {
  const invertorler = data.invertorKontrollerIstatistikleri || { toplamKontrol: 0, calismaOrani: 0 };
  
  return (
    <Card>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <Text className="text-sm font-semibold">Toplam Kontrol</Text>
          <div className="text-2xl font-bold mt-2">{invertorler.toplamKontrol}</div>
        </div>
        <div className="mt-4 md:mt-0">
          <Text className="text-sm font-semibold">Ortalama Çalışma Oranı</Text>
          <div className="text-2xl font-bold mt-2">%{invertorler.calismaOrani.toFixed(1)}</div>
        </div>
      </div>
    </Card>
  );
};

const InvertorPerformansSection: React.FC<{ data: any }> = ({ data }) => (
  <div className="text-center text-gray-500 p-6">İnvertör performans verileri buraya gelecek</div>
);

const MekanikOzetSection: React.FC<{ data: any }> = ({ data }) => {
  const mekanik = data.mekanikBakimIstatistikleri || { toplam: 0, sorunlu: 0 };
  
  return (
    <Card>
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <Text>Toplam Bakım</Text>
          <Text className="font-semibold">{mekanik.toplam}</Text>
        </div>
        <div className="flex items-center justify-between">
          <Text>Sorunlu Bakım</Text>
          <Text className="text-red-600 font-semibold">{mekanik.sorunlu}</Text>
        </div>
        <div className="flex items-center justify-between">
          <Text>Sorunsuz Bakım</Text>
          <Text className="text-green-600 font-semibold">
            {mekanik.toplam - mekanik.sorunlu}
          </Text>
        </div>
      </div>
    </Card>
  );
};

const MekanikListeSection: React.FC<{ data: any }> = ({ data }) => (
  <div className="text-center text-gray-500 p-6">Mekanik bakım listesi buraya gelecek</div>
);

const ElektrikOzetSection: React.FC<{ data: any }> = ({ data }) => {
  const elektrik = data.elektrikBakimIstatistikleri || { toplam: 0, sorunlu: 0 };
  
  return (
    <Card>
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <Text>Toplam Bakım</Text>
          <Text className="font-semibold">{elektrik.toplam}</Text>
        </div>
        <div className="flex items-center justify-between">
          <Text>Sorunlu Bakım</Text>
          <Text className="text-red-600 font-semibold">{elektrik.sorunlu}</Text>
        </div>
        <div className="flex items-center justify-between">
          <Text>Sorunsuz Bakım</Text>
          <Text className="text-green-600 font-semibold">
            {elektrik.toplam - elektrik.sorunlu}
          </Text>
        </div>
      </div>
    </Card>
  );
};

const ElektrikListeSection: React.FC<{ data: any }> = ({ data }) => (
  <div className="text-center text-gray-500 p-6">Elektrik bakım listesi buraya gelecek</div>
);

// Kapsamlı rapor bileşenleri
const KapsamliOzetSection: React.FC<{ data: any }> = ({ data }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <Card decoration="top" decorationColor="red">
      <Text className="text-sm font-semibold text-gray-500">Toplam Arıza</Text>
      <div className="text-2xl font-bold mt-1">{data.arizaIstatistikleri?.toplam || 0}</div>
      <Text className="text-xs text-gray-500 mt-1">
        {data.arizaIstatistikleri?.cozulen || 0} çözüldü, {data.arizaIstatistikleri?.bekleyen || 0} bekliyor
      </Text>
    </Card>
    
    <Card decoration="top" decorationColor="indigo">
      <Text className="text-sm font-semibold text-gray-500">Kritik Stoklar</Text>
      <div className="text-2xl font-bold mt-1">{data.stokIstatistikleri?.kritikSeviye || 0}</div>
      <Text className="text-xs text-gray-500 mt-1">
        Toplam {data.stokIstatistikleri?.toplamCesit || 0} stok çeşidi
      </Text>
    </Card>
    
    <Card decoration="top" decorationColor="amber">
      <Text className="text-sm font-semibold text-gray-500">Toplam Üretim</Text>
      <div className="text-2xl font-bold mt-1">{data.uretimVerileriIstatistikleri?.toplamUretim.toFixed(1) || 0} kWh</div>
      <Text className="text-xs text-gray-500 mt-1">
        Aylık toplam üretim
      </Text>
    </Card>
    
    <Card decoration="top" decorationColor="green">
      <Text className="text-sm font-semibold text-gray-500">İnvertör Durumu</Text>
      <div className="text-2xl font-bold mt-1">%{data.invertorKontrollerIstatistikleri?.calismaOrani.toFixed(1) || 0}</div>
      <Text className="text-xs text-gray-500 mt-1">
        Ortalama çalışma oranı
      </Text>
    </Card>
  </div>
);

const KapsamliArizaSection: React.FC<{ data: any }> = ({ data }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Card>
      <Title>Arıza Durumu Dağılımı</Title>
      <DonutChart
        className="mt-6 h-60"
        data={data.arizaIstatistikleri?.durumDagilimi || []}
        category="sayi"
        index="durum"
        colors={["red", "yellow", "blue", "green"]}
        valueFormatter={(value) => `${value} arıza`}
        showAnimation={true}
      />
    </Card>
    
    <Card>
      <Title>Arıza Öncelik Dağılımı</Title>
      <DonutChart
        className="mt-6 h-60"
        data={data.arizaIstatistikleri?.oncelikDagilimi || []}
        category="sayi"
        index="oncelik"
        colors={["gray", "blue", "orange", "red"]}
        valueFormatter={(value) => `${value} arıza`}
        showAnimation={true}
      />
    </Card>
  </div>
);

const KapsamliUretimSection: React.FC<{ data: any }> = ({ data }) => (
  <Card>
    <Title>Günlük Üretim Verileri</Title>
    <AreaChart
      className="mt-6 h-72"
      data={data.uretimVerileriIstatistikleri?.gunlukUretim || []}
      index="tarih"
      categories={["uretim"]}
      colors={["amber"]}
      valueFormatter={(value) => `${value.toFixed(1)} kWh`}
      showLegend={false}
      showAnimation={true}
    />
  </Card>
);

const KapsamliStokSection: React.FC<{ data: any }> = ({ data }) => (
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
          {(data.stokIstatistikleri?.eksikMalzemeler || []).map((malzeme: any, index: number) => (
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
);

const KapsamliBakimSection: React.FC<{ data: any }> = ({ data }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Card>
      <Title>Mekanik Bakım Durumu</Title>
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <Text>Toplam Bakım</Text>
          <Text>{data.mekanikBakimIstatistikleri?.toplam || 0}</Text>
        </div>
        <div className="flex items-center justify-between">
          <Text>Sorunlu Bakım</Text>
          <Text className="text-red-600">{data.mekanikBakimIstatistikleri?.sorunlu || 0}</Text>
        </div>
        <div className="flex items-center justify-between">
          <Text>Sorunsuz Bakım</Text>
          <Text className="text-green-600">
            {(data.mekanikBakimIstatistikleri?.toplam || 0) - (data.mekanikBakimIstatistikleri?.sorunlu || 0)}
          </Text>
        </div>
      </div>
    </Card>
    
    <Card>
      <Title>Elektrik Bakım Durumu</Title>
      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <Text>Toplam Bakım</Text>
          <Text>{data.elektrikBakimIstatistikleri?.toplam || 0}</Text>
        </div>
        <div className="flex items-center justify-between">
          <Text>Sorunlu Bakım</Text>
          <Text className="text-red-600">{data.elektrikBakimIstatistikleri?.sorunlu || 0}</Text>
        </div>
        <div className="flex items-center justify-between">
          <Text>Sorunsuz Bakım</Text>
          <Text className="text-green-600">
            {(data.elektrikBakimIstatistikleri?.toplam || 0) - (data.elektrikBakimIstatistikleri?.sorunlu || 0)}
          </Text>
        </div>
      </div>
    </Card>
  </div>
);

const KapsamliIslerSection: React.FC<{ data: any }> = ({ data }) => (
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
          {(data.isRaporlariIstatistikleri?.isListesi || []).slice(0, 5).map((is: any) => (
            <tr key={is.id} className="hover:bg-gray-50">
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
);

const KapsamliKesintiSection: React.FC<{ data: any }> = ({ data }) => (
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
          {(data.kesintilerIstatistikleri?.kesintiler || []).slice(0, 5).map((kesinti: any) => (
            <tr key={kesinti.id} className="hover:bg-gray-50">
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
                <Badge color={kesinti.durum === 'devam-ediyor' ? 'red' : 'green'}>
                  {kesinti.durum === 'devam-ediyor' ? 'Devam Ediyor' : 'Tamamlandı'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);

const KapsamliInvertorSection: React.FC<{ data: any }> = ({ data }) => (
  <Card>
    <Title>İnvertör Sistemleri</Title>
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <Text>Toplam Kontrol</Text>
        <Text>{data.invertorKontrollerIstatistikleri?.toplamKontrol || 0}</Text>
      </div>
      <div className="flex items-center justify-between">
        <Text>Ortalama Çalışma Oranı</Text>
        <Text>%{data.invertorKontrollerIstatistikleri?.calismaOrani.toFixed(1) || 0}</Text>
      </div>
    </div>
  </Card>
);

export default RaporTemplate;
