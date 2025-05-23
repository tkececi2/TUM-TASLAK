
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs, where, limit, Timestamp, getDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Plus,
  Building,
  MapPin,
  User,
  Calendar,
  Package,
  Zap,
  Wrench,
  BarChart2,
  TrendingUp,
  Sun,
  Battery,
  Leaf,
  Activity,
  FileText,
  Bolt,
  PanelTop,
  ArrowRight,
  FileBarChart,
  BrainCircuit,
  Gauge,
  Lightbulb,
  Shield,
  Settings,
  ExternalLink,
  BarChart,
  PieChart,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Eye
} from 'lucide-react';
import { StatsCard } from '../components/StatsCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ArizaDetayModal } from '../components/ArizaDetayModal';
import { Card, Title, BarChart as TremorBarChart, DonutChart, AreaChart, ProgressBar, Text, Flex, Metric, Badge, BadgeDelta } from '@tremor/react';
import type { Ariza } from '../types';
import toast from 'react-hot-toast';

export const Anasayfa: React.FC = () => {
  const { kullanici } = useAuth();
  const navigate = useNavigate();
  const [arizalar, setArizalar] = useState<Ariza[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [sahalar, setSahalar] = useState<Record<string, string>>({});
  const [seciliAriza, setSeciliAriza] = useState<Ariza | null>(null);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [genisletilenPanel, setGenisletilenPanel] = useState<string | null>(null);
  const [istatistikler, setIstatistikler] = useState({
    toplamAriza: 0,
    acikArizalar: 0,
    devamEdenArizalar: 0,
    cozulenArizalar: 0,
    kritikStoklar: 0,
    planliBakimlar: 0,
    performansSkoru: 0,
    haftalikArizalar: [] as { date: string; arizaSayisi: number }[],
    arizaDagilimi: [] as { durum: string; sayi: number }[],
    sahaPerformansi: [] as { saha: string; performans: number }[],
    uretimVerileri: [] as { date: string; uretim: number }[],
    toplamUretim: 0,
    aylikUretim: 0,
    yillikUretim: 0,
    toplamCO2Tasarrufu: 0,
    yillikHedefUretim: 0,
    sonBakimTarihi: null as Date | null,
    sonrakiBakimTarihi: null as Date | null,
    planliBackimYuzdesi: 30, // Varsayılan değer
    stokDurumu: [] as { urun: string; miktar: number; kritikSeviye: number }[]
  });

  // Boş istatistikler oluştur
  const createEmptyStats = () => {
    return {
      toplamAriza: 0,
      acikArizalar: 0,
      devamEdenArizalar: 0,
      cozulenArizalar: 0,
      kritikStoklar: 0,
      planliBakimlar: 0,
      performansSkoru: 0,
      haftalikArizalar: Array.from({ length: 7 }, (_, i) => ({
        date: format(subDays(new Date(), 6 - i), 'dd MMM', { locale: tr }),
        arizaSayisi: 0
      })),
      arizaDagilimi: [
        { durum: 'Açık', sayi: 0 },
        { durum: 'Devam Eden', sayi: 0 },
        { durum: 'Çözülen', sayi: 0 }
      ],
      sahaPerformansi: [],
      uretimVerileri: [],
      toplamUretim: 0,
      aylikUretim: 0,
      yillikUretim: 0,
      toplamCO2Tasarrufu: 0,
      yillikHedefUretim: 0,
      sonBakimTarihi: null as Date | null,
      sonrakiBakimTarihi: null as Date | null,
      planliBackimYuzdesi: 30, // Varsayılan değer
      stokDurumu: [] as { urun: string; miktar: number; kritikSeviye: number }[]
    };
  };

  const veriYenile = async () => {
    setYenileniyor(true);
    try {
      await veriGetir();
      toast.success('Veriler başarıyla güncellendi');
    } catch (error) {
      toast.error('Veriler güncellenirken bir hata oluştu');
      console.error('Veri yenileme hatası:', error);
    } finally {
      setYenileniyor(false);
    }
  };

  const veriGetir = async () => {
    if (!kullanici) return;

    try {
      setYukleniyor(true);
      
      // Kullanıcının sahalarını kontrol et
      const userSahalar = kullanici.sahalar || [];
      
      // Sahaları getir
      let sahaMap: Record<string, string> = {};
      
      try {
        let sahaQuery;
        if (kullanici.rol === 'musteri' && userSahalar.length > 0) {
          sahaQuery = query(
            collection(db, 'sahalar'),
            where('__name__', 'in', userSahalar)
          );
        } else if (kullanici.rol !== 'musteri') {
          sahaQuery = query(
            collection(db, 'sahalar'),
            where('companyId', '==', kullanici.companyId)
          );
        } else {
          // Müşteri rolü ve sahası yoksa boş veriler göster
          setArizalar([]);
          setIstatistikler(createEmptyStats());
          setSahalar({});
          setYukleniyor(false);
          return;
        }
        
        const sahaSnapshot = await getDocs(sahaQuery);
        sahaMap = {};
        sahaSnapshot.docs.forEach(doc => {
          sahaMap[doc.id] = doc.data().ad;
        });
        setSahalar(sahaMap);
      } catch (error) {
        console.error('Sahalar getirilemedi:', error);
        setSahalar({});
        // Sahalar getirilemezse devam et, diğer verileri almaya çalış
      }

      // Müşteri rolü ve sahası yoksa boş veriler göster
      if (kullanici.rol === 'musteri' && userSahalar.length === 0) {
        setArizalar([]);
        setIstatistikler(createEmptyStats());
        setYukleniyor(false);
        return;
      }

      // Arızaları getir
      let sonArizalar: Ariza[] = [];
      let butunArizalar: Ariza[] = [];
      
      try {
        let arizaQuery;
        if (kullanici.rol === 'musteri' && userSahalar.length > 0) {
          arizaQuery = query(
            collection(db, 'arizalar'),
            where('saha', 'in', userSahalar),
            where('companyId', '==', kullanici.companyId),
            orderBy('olusturmaTarihi', 'desc'),
            limit(5)
          );
        } else if (kullanici.rol !== 'musteri') {
          arizaQuery = query(
            collection(db, 'arizalar'),
            where('companyId', '==', kullanici.companyId),
            orderBy('olusturmaTarihi', 'desc'),
            limit(5)
          );
        } else {
          setArizalar([]);
          setIstatistikler(createEmptyStats());
          setYukleniyor(false);
          return;
        }

        const snapshot = await getDocs(arizaQuery);
        sonArizalar = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Ariza[];
        
        setArizalar(sonArizalar);

        // Tüm arızaları getir (istatistikler için)
        let tumArizalarQuery;
        if (kullanici.rol === 'musteri' && userSahalar.length > 0) {
          tumArizalarQuery = query(
            collection(db, 'arizalar'),
            where('saha', 'in', userSahalar),
            where('companyId', '==', kullanici.companyId)
          );
        } else if (kullanici.rol !== 'musteri') {
          tumArizalarQuery = query(
            collection(db, 'arizalar'),
            where('companyId', '==', kullanici.companyId)
          );
        } else {
          setIstatistikler(createEmptyStats());
          setYukleniyor(false);
          return;
        }
        
        const tumArizalarSnapshot = await getDocs(tumArizalarQuery);
        butunArizalar = tumArizalarSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Ariza[];
      } catch (error) {
        console.error('Arızalar getirilemedi:', error);
        setArizalar([]);
        butunArizalar = [];
        // Arızalar getirilemezse devam et, diğer verileri almaya çalış
      }

      // İstatistikleri hesapla
      const acik = butunArizalar.filter(a => a.durum === 'acik').length;
      const devamEden = butunArizalar.filter(a => a.durum === 'devam-ediyor').length;
      const cozulen = butunArizalar.filter(a => a.durum === 'cozuldu').length;
      const toplam = butunArizalar.length;

      // Kritik stok sayısını getir
      let kritikStokSayisi = 0;
      let stokDurumu: { urun: string; miktar: number; kritikSeviye: number }[] = [];
      try {
        let stokQuery;
        if (kullanici.rol === 'musteri' && userSahalar.length > 0) {
          stokQuery = query(
            collection(db, 'stoklar'),
            where('sahaId', 'in', userSahalar),
            where('companyId', '==', kullanici.companyId)
          );
        } else if (kullanici.rol !== 'musteri') {
          stokQuery = query(
            collection(db, 'stoklar'),
            where('companyId', '==', kullanici.companyId)
          );
        } else {
          // Müşteri rolü ve sahası yoksa bu kısmı atla
          kritikStokSayisi = 0;
        }
        
        if (stokQuery) {
          const stokSnapshot = await getDocs(stokQuery);
          kritikStokSayisi = stokSnapshot.docs.filter(doc => {
            const stok = doc.data();
            return stok.miktar <= stok.kritikSeviye;
          }).length;
          
          // Kritik stoklara yakın olanları listele
          stokDurumu = stokSnapshot.docs
            .map(doc => {
              const data = doc.data();
              return {
                urun: data.urunAdi,
                miktar: data.miktar,
                kritikSeviye: data.kritikSeviye
              };
            })
            .sort((a, b) => {
              // Kritik seviyenin altındakileri önce göster
              const aKritik = a.miktar <= a.kritikSeviye;
              const bKritik = b.miktar <= b.kritikSeviye;
              
              if (aKritik && !bKritik) return -1;
              if (!aKritik && bKritik) return 1;
              
              // Her iki ürün de kritik seviyenin altındaysa veya üstündeyse, kritik seviyeye olan yakınlığına göre sırala
              const aOran = a.miktar / a.kritikSeviye;
              const bOran = b.miktar / b.kritikSeviye;
              
              return aOran - bOran;
            })
            .slice(0, 5); // Sadece ilk 5 ürünü al
        }
      } catch (error) {
        console.error('Stoklar getirilemedi:', error);
        kritikStokSayisi = 0;
        // Stoklar getirilemezse devam et, diğer verileri almaya çalış
      }

      // Planlı bakım sayısını getir
      let planlanmisBakimlar = 0;
      let sonBakimTarihi = null;
      let sonrakiBakimTarihi = null;
      let planliBackimYuzdesi = 30; // Varsayılan değer
      
      try {
        let bakimQuery;
        if (kullanici.rol === 'musteri' && userSahalar.length > 0) {
          bakimQuery = query(
            collection(db, 'mekanikBakimlar'),
            where('sahaId', 'in', userSahalar),
            where('companyId', '==', kullanici.companyId),
            orderBy('tarih', 'desc')
          );
        } else if (kullanici.rol !== 'musteri') {
          bakimQuery = query(
            collection(db, 'mekanikBakimlar'),
            where('companyId', '==', kullanici.companyId),
            orderBy('tarih', 'desc')
          );
        } else {
          // Müşteri rolü ve sahası yoksa bu kısmı atla
          planlanmisBakimlar = 0;
        }
        
        if (bakimQuery) {
          const bakimSnapshot = await getDocs(bakimQuery);
          planlanmisBakimlar = bakimSnapshot.docs.length;
          
          if (bakimSnapshot.docs.length > 0) {
            const sonBakim = bakimSnapshot.docs[0].data();
            sonBakimTarihi = sonBakim.tarih.toDate();
            
            // Sonraki bakım için 3 ay sonrasını tahmin et
            sonrakiBakimTarihi = addMonths(sonBakimTarihi, 3);
            
            // Planlı bakım yüzdesini hesapla (3 aylık döngüde ne kadar ilerlendiği)
            const bugun = new Date();
            const toplamGun = 90; // 3 ay
            const gecenGun = Math.min(
              Math.floor((bugun.getTime() - sonBakimTarihi.getTime()) / (1000 * 60 * 60 * 24)),
              toplamGun
            );
            planliBackimYuzdesi = Math.round((gecenGun / toplamGun) * 100);
          }
        }
      } catch (error) {
        console.error('Bakımlar getirilemedi:', error);
        planlanmisBakimlar = 0;
        // Bakımlar getirilemezse devam et, diğer verileri almaya çalış
      }

      // Performans skoru hesapla (0-100 arası)
      const performans = toplam > 0 ? Math.round((cozulen / toplam) * 100) : 0;

      // Son 7 günün arızaları
      const sonYediGun = Array.from({ length: 7 }, (_, i) => {
        const tarih = subDays(new Date(), 6 - i);
        const gunlukArizalar = butunArizalar.filter(ariza => {
          const arizaTarihi = ariza.olusturmaTarihi.toDate();
          return format(arizaTarihi, 'yyyy-MM-dd') === format(tarih, 'yyyy-MM-dd');
        });
        return {
          date: format(tarih, 'dd MMM', { locale: tr }),
          arizaSayisi: gunlukArizalar.length
        };
      });

      // Arıza durumu dağılımı
      const durumDagilimi = [
        { durum: 'Açık', sayi: acik },
        { durum: 'Devam Eden', sayi: devamEden },
        { durum: 'Çözülen', sayi: cozulen }
      ];

      // Saha bazlı performans
      const sahaPerformansi = Object.entries(sahaMap).map(([sahaId, sahaAdi]) => {
        const sahaArizalari = butunArizalar.filter(a => a.saha === sahaId);
        const sahaCozulen = sahaArizalari.filter(a => a.durum === 'cozuldu').length;
        const sahaPerformans = sahaArizalari.length > 0 
          ? (sahaCozulen / sahaArizalari.length) * 100 
          : 100;
        return {
          saha: sahaAdi,
          performans: Math.round(sahaPerformans)
        };
      });

      // Üretim verilerini getir
      let uretimGrafigi: { date: string; uretim: number }[] = [];
      let toplamUretim = 0;
      let aylikUretim = 0;
      let yillikUretim = 0;
      let toplamCO2Tasarrufu = 0;
      let yillikHedefUretim = 0; // Yıllık hedef üretim değeri
      
      try {
        // Önce santralleri getir
        let santralQuery;
        if (kullanici.rol === 'musteri' && userSahalar.length > 0) {
          santralQuery = query(
            collection(db, 'santraller'),
            where('__name__', 'in', userSahalar),
            where('companyId', '==', kullanici.companyId)
          );
        } else if (kullanici.rol !== 'musteri') {
          santralQuery = query(
            collection(db, 'santraller'),
            where('companyId', '==', kullanici.companyId)
          );
        }
        
        if (santralQuery) {
          const santralSnapshot = await getDocs(santralQuery);
          // Tüm santrallerin yıllık hedeflerini topla
          yillikHedefUretim = santralSnapshot.docs.reduce((acc, doc) => {
            const santralData = doc.data();
            return acc + (santralData.yillikHedefUretim || 0);
          }, 0);
        }
        
        // Üretim verilerini getir
        let uretimQuery;
        if (kullanici.rol === 'musteri' && userSahalar.length > 0) {
          uretimQuery = query(
            collection(db, 'uretimVerileri'),
            where('santralId', 'in', userSahalar),
            where('companyId', '==', kullanici.companyId),
            orderBy('tarih', 'desc'),
            limit(30)
          );
        } else if (kullanici.rol !== 'musteri') {
          uretimQuery = query(
            collection(db, 'uretimVerileri'),
            where('companyId', '==', kullanici.companyId),
            orderBy('tarih', 'desc'),
            limit(30)
          );
        } else {
          // Müşteri rolü ve sahası yoksa bu kısmı atla
          uretimGrafigi = [];
          toplamUretim = 0;
          aylikUretim = 0;
          yillikUretim = 0;
          toplamCO2Tasarrufu = 0;
          yillikHedefUretim = 0;
        }
        
        if (uretimQuery) {
          const uretimSnapshot = await getDocs(uretimQuery);
          const uretimVerileri = uretimSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // Üretim istatistikleri
          const bugun = new Date();
          const ayBaslangic = startOfMonth(bugun);
          const ayBitis = endOfMonth(bugun);
          const yilBaslangic = startOfYear(bugun);
          const yilBitis = endOfYear(bugun);
          
          toplamUretim = uretimVerileri.reduce((acc, veri) => acc + veri.gunlukUretim, 0);
          
          aylikUretim = uretimVerileri.filter(veri => {
            const veriTarihi = veri.tarih.toDate();
            return veriTarihi >= ayBaslangic && veriTarihi <= ayBitis;
          }).reduce((acc, veri) => acc + veri.gunlukUretim, 0);
          
          yillikUretim = uretimVerileri.filter(veri => {
            const veriTarihi = veri.tarih.toDate();
            return veriTarihi >= yilBaslangic && veriTarihi <= yilBitis;
          }).reduce((acc, veri) => acc + veri.gunlukUretim, 0);
          
          toplamCO2Tasarrufu = uretimVerileri.reduce((acc, veri) => acc + (veri.tasarrufEdilenCO2 || 0), 0);
          
          // Üretim grafiği için verileri hazırla
          uretimGrafigi = uretimVerileri
            .slice(0, 14)
            .sort((a, b) => a.tarih.toDate().getTime() - b.tarih.toDate().getTime())
            .map(veri => ({
              date: format(veri.tarih.toDate(), 'dd MMM', { locale: tr }),
              uretim: veri.gunlukUretim
            }));
        }
      } catch (error) {
        console.error('Üretim verileri getirilemedi:', error);
        uretimGrafigi = [];
        toplamUretim = 0;
        aylikUretim = 0;
        yillikUretim = 0;
        toplamCO2Tasarrufu = 0;
        yillikHedefUretim = 0;
        // Üretim verileri getirilemezse devam et
      }

      setIstatistikler({
        toplamAriza: toplam,
        acikArizalar: acik,
        devamEdenArizalar: devamEden,
        cozulenArizalar: cozulen,
        kritikStoklar: kritikStokSayisi,
        planliBakimlar: planlanmisBakimlar,
        performansSkoru: performans,
        haftalikArizalar: sonYediGun,
        arizaDagilimi: durumDagilimi,
        sahaPerformansi,
        uretimVerileri: uretimGrafigi,
        toplamUretim,
        aylikUretim,
        yillikUretim,
        toplamCO2Tasarrufu,
        yillikHedefUretim,
        sonBakimTarihi,
        sonrakiBakimTarihi,
        planliBackimYuzdesi,
        stokDurumu
      });

    } catch (error) {
      console.error('Veri getirme hatası:', error);
      // Hata durumunda boş veriler göster
      setArizalar([]);
      setIstatistikler(createEmptyStats());
      setSahalar({});
      toast.error('Veriler yüklenirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    veriGetir();
  }, [kullanici]);

  const togglePanel = (panel: string) => {
    if (genisletilenPanel === panel) {
      setGenisletilenPanel(null);
    } else {
      setGenisletilenPanel(panel);
    }
  };

  if (yukleniyor) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hoş Geldiniz Kartı */}
      <Card className="bg-gradient-to-r from-primary-50 to-primary-100 border-none shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex items-center mb-4 md:mb-0">
            <div className="p-3 bg-primary-100 rounded-full mr-4">
              <Sun className="h-8 w-8 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Hoş Geldiniz, {kullanici?.ad}</h2>
              <p className="text-sm text-gray-600">
                {format(new Date(), 'dd MMMM yyyy, EEEE', { locale: tr })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={veriYenile}
              className="flex items-center gap-2 text-primary-600 bg-white py-2 px-4 rounded-lg shadow-sm hover:bg-primary-50 transition-colors"
              disabled={yenileniyor}
            >
              <RefreshCw className={`h-4 w-4 ${yenileniyor ? 'animate-spin' : ''}`} />
              <span>{yenileniyor ? 'Yenileniyor...' : 'Verileri Yenile'}</span>
            </button>
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm flex items-center">
              <Battery className="h-5 w-5 text-green-500 mr-2" />
              <div>
                <p className="text-xs text-gray-500">Aylık Üretim</p>
                <p className="text-sm font-semibold">{istatistikler.aylikUretim.toLocaleString('tr-TR')} kWh</p>
              </div>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm flex items-center">
              <Battery className="h-5 w-5 text-blue-500 mr-2" />
              <div>
                <p className="text-xs text-gray-500">Yıllık Üretim</p>
                <p className="text-sm font-semibold">{istatistikler.yillikUretim.toLocaleString('tr-TR')} kWh</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Hızlı Erişim Kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div 
          className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:shadow-md transition-all duration-200 cursor-pointer hover:bg-primary-50 hover:scale-105"
          onClick={() => navigate('/arizalar')}
        >
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-red-100 rounded-full mb-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">Arızalar</h3>
            <p className="text-xs text-gray-500 mt-1">Arıza takibi ve yönetimi</p>
          </div>
        </div>
        
        <div 
          className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:shadow-md transition-all duration-200 cursor-pointer hover:bg-primary-50 hover:scale-105"
          onClick={() => navigate('/uretim-verileri')}
        >
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-green-100 rounded-full mb-3">
              <Sun className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">Üretim Verileri</h3>
            <p className="text-xs text-gray-500 mt-1">Enerji üretim takibi</p>
          </div>
        </div>
        
        <div 
          className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:shadow-md transition-all duration-200 cursor-pointer hover:bg-primary-50 hover:scale-105"
          onClick={() => navigate('/elektrik-bakim')}
        >
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-yellow-100 rounded-full mb-3">
              <Zap className="h-6 w-6 text-yellow-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">Elektrik Bakım</h3>
            <p className="text-xs text-gray-500 mt-1">Elektrik bakım kontrolleri</p>
          </div>
        </div>
        
        <div 
          className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:shadow-md transition-all duration-200 cursor-pointer hover:bg-primary-50 hover:scale-105"
          onClick={() => navigate('/mekanik-bakim')}
        >
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-blue-100 rounded-full mb-3">
              <PanelTop className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">Mekanik Bakım</h3>
            <p className="text-xs text-gray-500 mt-1">Mekanik bakım kontrolleri</p>
          </div>
        </div>
        
        <div 
          className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:shadow-md transition-all duration-200 cursor-pointer hover:bg-primary-50 hover:scale-105"
          onClick={() => navigate('/stok-kontrol')}
        >
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-indigo-100 rounded-full mb-3">
              <Package className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">Stok Kontrol</h3>
            <p className="text-xs text-gray-500 mt-1">Malzeme ve envanter</p>
          </div>
        </div>
        
        <div 
          className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:shadow-md transition-all duration-200 cursor-pointer hover:bg-primary-50 hover:scale-105"
          onClick={() => navigate('/istatistikler')}
        >
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-purple-100 rounded-full mb-3">
              <FileBarChart className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">İstatistikler</h3>
            <p className="text-xs text-gray-500 mt-1">Analiz ve istatistikler</p>
          </div>
        </div>
      </div>

      {/* Genel Durum Özeti */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 border-none shadow-sm hover:shadow-md transition-all duration-300">
          <div className="relative z-10 flex items-center">
            <div className="p-3 bg-blue-100 rounded-full mr-3">
              <AlertTriangle className="h-6 w-6 text-blue-600" />
            </div>
            <div className="w-full">
              <p className="text-sm font-medium text-blue-900">Arıza Durumu</p>
              <div className="flex items-center mt-1">
                <span className="text-2xl font-bold text-blue-800">{istatistikler.acikArizalar + istatistikler.devamEdenArizalar}</span>
                <span className="ml-2 text-sm text-blue-700">Aktif Arıza</span>
                {istatistikler.acikArizalar > 3 && (
                  <Badge color="red" className="ml-2">Dikkat</Badge>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-blue-700">Çözüm Oranı: %{istatistikler.performansSkoru}</span>
                <span className="text-xs text-blue-700">{istatistikler.cozulenArizalar} çözüldü</span>
              </div>
              <div className="mt-1 bg-blue-200 rounded-full h-1.5">
                <div 
                  className="bg-blue-600 h-1.5 rounded-full" 
                  style={{ width: `${istatistikler.performansSkoru}%` }}
                ></div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 h-32 w-32 bg-blue-200 rounded-full opacity-20"></div>
          <div className="absolute -top-10 -left-10 h-24 w-24 bg-blue-300 rounded-full opacity-10"></div>
        </Card>
        
        <Card className="relative overflow-hidden bg-gradient-to-br from-green-50 to-green-100 border-none shadow-sm hover:shadow-md transition-all duration-300">
          <div className="relative z-10 flex items-center">
            <div className="p-3 bg-green-100 rounded-full mr-3">
              <Battery className="h-6 w-6 text-green-600" />
            </div>
            <div className="w-full">
              <p className="text-sm font-medium text-green-900">Üretim Durumu</p>
              <div className="flex items-center mt-1">
                <span className="text-2xl font-bold text-green-800">{istatistikler.aylikUretim.toLocaleString('tr-TR')}</span>
                <span className="ml-2 text-sm text-green-700">kWh / Ay</span>
                {istatistikler.yillikUretim > 0 && istatistikler.yillikHedefUretim > 0 && 
                 (istatistikler.yillikUretim / istatistikler.yillikHedefUretim) > 0.5 && (
                  <Badge color="green" className="ml-2">İyi Gidiyor</Badge>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-green-700">Yıllık: {istatistikler.yillikUretim.toLocaleString('tr-TR')} kWh</span>
                <span className="text-xs text-green-700">Hedef: {istatistikler.yillikHedefUretim.toLocaleString('tr-TR')} kWh</span>
              </div>
              <div className="mt-1 bg-green-200 rounded-full h-1.5">
                <div 
                  className="bg-green-600 h-1.5 rounded-full" 
                  style={{ width: `${istatistikler.yillikHedefUretim > 0 ? Math.min((istatistikler.yillikUretim / istatistikler.yillikHedefUretim) * 100, 100) : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 h-32 w-32 bg-green-200 rounded-full opacity-20"></div>
          <div className="absolute -top-10 -left-10 h-24 w-24 bg-green-300 rounded-full opacity-10"></div>
        </Card>
        
        <Card className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-amber-100 border-none shadow-sm hover:shadow-md transition-all duration-300">
          <div className="relative z-10 flex items-center">
            <div className="p-3 bg-amber-100 rounded-full mr-3">
              <Wrench className="h-6 w-6 text-amber-600" />
            </div>
            <div className="w-full">
              <p className="text-sm font-medium text-amber-900">Bakım Durumu</p>
              <div className="flex items-center mt-1">
                <span className="text-2xl font-bold text-amber-800">{istatistikler.planliBakimlar}</span>
                <span className="ml-2 text-sm text-amber-700">Planlı Bakım</span>
                {istatistikler.sonrakiBakimTarihi && new Date() > istatistikler.sonrakiBakimTarihi && (
                  <Badge color="red" className="ml-2">Bakım Gerekli</Badge>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-amber-700">
                  Son Bakım: {istatistikler.sonBakimTarihi 
                    ? format(istatistikler.sonBakimTarihi, 'dd MMM yyyy', { locale: tr }) 
                    : 'Bilgi yok'}
                </span>
                <span className="text-xs text-amber-700">
                  Sonraki: {istatistikler.sonrakiBakimTarihi 
                    ? format(istatistikler.sonrakiBakimTarihi, 'dd MMM yyyy', { locale: tr })
                    : 'Bilgi yok'}
                </span>
              </div>
              <div className="mt-1 bg-amber-200 rounded-full h-1.5">
                <div 
                  className="bg-amber-600 h-1.5 rounded-full" 
                  style={{ width: `${istatistikler.planliBackimYuzdesi}%` }}
                ></div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 h-32 w-32 bg-amber-200 rounded-full opacity-20"></div>
          <div className="absolute -top-10 -left-10 h-24 w-24 bg-amber-300 rounded-full opacity-10"></div>
        </Card>
        
        <Card className="relative overflow-hidden bg-gradient-to-br from-red-50 to-red-100 border-none shadow-sm hover:shadow-md transition-all duration-300">
          <div className="relative z-10 flex items-center">
            <div className="p-3 bg-red-100 rounded-full mr-3">
              <Package className="h-6 w-6 text-red-600" />
            </div>
            <div className="w-full">
              <p className="text-sm font-medium text-red-900">Stok Durumu</p>
              <div className="flex items-center mt-1">
                <span className="text-2xl font-bold text-red-800">{istatistikler.kritikStoklar}</span>
                <span className="ml-2 text-sm text-red-700">Kritik Stok</span>
                {istatistikler.kritikStoklar > 0 && (
                  <Badge color="red" className="ml-2">Sipariş Gerekli</Badge>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-red-700">
                  Acil Sipariş: {istatistikler.kritikStoklar > 0 ? `${istatistikler.kritikStoklar} ürün` : 'Yok'}
                </span>
                <button 
                  onClick={() => navigate('/stok-kontrol')} 
                  className="text-xs text-red-700 hover:text-red-900 transition-colors"
                >
                  Stok Takibi
                </button>
              </div>
              <div className="mt-1 bg-red-200 rounded-full h-1.5">
                <div 
                  className="bg-red-600 h-1.5 rounded-full" 
                  style={{ width: `${Math.min(istatistikler.kritikStoklar * 10, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 h-32 w-32 bg-red-200 rounded-full opacity-20"></div>
          <div className="absolute -top-10 -left-10 h-24 w-24 bg-red-300 rounded-full opacity-10"></div>
        </Card>
      </div>

      {/* Üretim ve Arıza Grafikleri */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Üretim Grafiği */}
        {istatistikler.uretimVerileri.length > 0 && (
          <Card className="shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Title>Günlük Üretim Trendi</Title>
                <Text className="text-gray-500">Son 14 günün üretim verileri</Text>
              </div>
              <button 
                onClick={() => navigate('/uretim-verileri')}
                className="text-sm text-primary-600 hover:text-primary-800 flex items-center"
              >
                Detaylar <ArrowRight className="h-4 w-4 ml-1" />
              </button>
            </div>
            <AreaChart
              className="h-72 mt-4"
              data={istatistikler.uretimVerileri}
              index="date"
              categories={["uretim"]}
              colors={["emerald"]}
              valueFormatter={(value) => `${value.toLocaleString('tr-TR')} kWh`}
              showLegend={false}
              showAnimation={true}
              showGradient={true}
            />
            <div className="mt-4 grid grid-cols-3 gap-2 p-3 bg-emerald-50 rounded-lg">
              <div className="text-center">
                <Text className="text-xs text-emerald-600">Günlük Ortalama</Text>
                <Metric className="text-lg font-bold text-emerald-700">
                  {istatistikler.uretimVerileri.length > 0 
                    ? Math.round(istatistikler.uretimVerileri.reduce((acc, item) => acc + item.uretim, 0) / istatistikler.uretimVerileri.length).toLocaleString('tr-TR')
                    : '0'} kWh
                </Metric>
              </div>
              <div className="text-center">
                <Text className="text-xs text-emerald-600">En Yüksek Üretim</Text>
                <Metric className="text-lg font-bold text-emerald-700">
                  {istatistikler.uretimVerileri.length > 0 
                    ? Math.max(...istatistikler.uretimVerileri.map(item => item.uretim)).toLocaleString('tr-TR')
                    : '0'} kWh
                </Metric>
              </div>
              <div className="text-center">
                <Text className="text-xs text-emerald-600">Performans</Text>
                <Flex justifyContent="center" alignItems="center">
                  <Metric className="text-lg font-bold text-emerald-700">
                    {istatistikler.yillikHedefUretim > 0 
                      ? Math.round((istatistikler.yillikUretim / istatistikler.yillikHedefUretim) * 100)
                      : '0'}%
                  </Metric>
                  <BadgeDelta deltaType="moderateIncrease" className="ml-1" size="xs" />
                </Flex>
              </div>
            </div>
          </Card>
        )}

        {/* Haftalık Arıza Trendi */}
        <Card className="shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Title>Haftalık Arıza Trendi</Title>
              <Text className="text-gray-500">Son 7 günün arıza verileri</Text>
            </div>
            <button 
              onClick={() => navigate('/arizalar')}
              className="text-sm text-primary-600 hover:text-primary-800 flex items-center"
            >
              Detaylar <ArrowRight className="h-4 w-4 ml-1" />
            </button>
          </div>
          <TremorBarChart
            className="h-72 mt-4"
            data={istatistikler.haftalikArizalar}
            index="date"
            categories={["arizaSayisi"]}
            colors={["amber"]}
            valueFormatter={(value) => `${value} arıza`}
            showLegend={false}
            showAnimation={true}
          />
          <div className="mt-4 grid grid-cols-3 gap-2 p-3 bg-amber-50 rounded-lg">
            <div className="text-center">
              <Text className="text-xs text-amber-600">Haftalık Toplam</Text>
              <Metric className="text-lg font-bold text-amber-700">
                {istatistikler.haftalikArizalar.reduce((acc, item) => acc + item.arizaSayisi, 0)} arıza
              </Metric>
            </div>
            <div className="text-center">
              <Text className="text-xs text-amber-600">Çözüm Hızı</Text>
              <Metric className="text-lg font-bold text-amber-700">
                48 saat
              </Metric>
            </div>
            <div className="text-center">
              <Text className="text-xs text-amber-600">Durum</Text>
              <Flex justifyContent="center" alignItems="center">
                <Metric className="text-lg font-bold text-amber-700">
                  {istatistikler.performansSkoru}%
                </Metric>
                <BadgeDelta 
                  deltaType={istatistikler.performansSkoru > 70 ? "moderateIncrease" : "moderateDecrease"} 
                  className="ml-1" 
                  size="xs" 
                />
              </Flex>
            </div>
          </div>
        </Card>
      </div>

      {/* Bakım ve Kontrol Durumu */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Arıza Durumu Dağılımı */}
        <Card className="shadow-md hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Title>Arıza Durumu Dağılımı</Title>
              <Text className="text-gray-500">Tüm arızaların durum bilgisi</Text>
            </div>
            <button 
              onClick={() => navigate('/istatistikler')}
              className="text-sm text-primary-600 hover:text-primary-800 flex items-center"
            >
              Detaylar <ArrowRight className="h-4 w-4 ml-1" />
            </button>
          </div>
          <DonutChart
            className="h-60 mt-4"
            data={istatistikler.arizaDagilimi}
            category="sayi"
            index="durum"
            colors={["rose", "amber", "emerald"]}
            valueFormatter={(value) => `${value} arıza`}
            showAnimation={true}
          />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="text-center py-2 px-3 bg-rose-50 rounded-lg">
              <Text className="text-xs text-rose-600">Açık</Text>
              <Metric className="text-lg font-bold text-rose-700">
                {istatistikler.acikArizalar}
              </Metric>
            </div>
            <div className="text-center py-2 px-3 bg-amber-50 rounded-lg">
              <Text className="text-xs text-amber-600">Devam Eden</Text>
              <Metric className="text-lg font-bold text-amber-700">
                {istatistikler.devamEdenArizalar}
              </Metric>
            </div>
            <div className="text-center py-2 px-3 bg-emerald-50 rounded-lg">
              <Text className="text-xs text-emerald-600">Çözülen</Text>
              <Metric className="text-lg font-bold text-emerald-700">
                {istatistikler.cozulenArizalar}
              </Metric>
            </div>
          </div>
        </Card>

        {/* Bakım Kontrol Durumu */}
        <Card className="shadow-md hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Title>Bakım Kontrol Durumu</Title>
              <Text className="text-gray-500">Bakım ve performans durumu</Text>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => navigate('/mekanik-bakim')}
                className="text-xs text-primary-600 hover:text-primary-800"
              >
                Mekanik
              </button>
              <span className="text-gray-300">|</span>
              <button 
                onClick={() => navigate('/elektrik-bakim')}
                className="text-xs text-primary-600 hover:text-primary-800"
              >
                Elektrik
              </button>
            </div>
          </div>
          <div className="space-y-6 mt-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <PanelTop className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-700">Mekanik Bakım</span>
                </div>
                <div className="flex items-center">
                  <span className="text-xs font-medium text-green-600">Son 30 gün</span>
                  <Badge className="ml-2" color="emerald" size="xs">Tamamlandı</Badge>
                </div>
              </div>
              <ProgressBar value={75} color="blue" />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <Zap className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-700">Elektrik Bakım</span>
                </div>
                <div className="flex items-center">
                  <span className="text-xs font-medium text-green-600">Son 30 gün</span>
                  <Badge className="ml-2" color="amber" size="xs">Devam Ediyor</Badge>
                </div>
              </div>
              <ProgressBar value={60} color="amber" />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <Activity className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-700">İnvertör Kontrol</span>
                </div>
                <div className="flex items-center">
                  <span className="text-xs font-medium text-green-600">Son 30 gün</span>
                  <Badge className="ml-2" color="emerald" size="xs">Tamamlandı</Badge>
                </div>
              </div>
              <ProgressBar value={85} color="emerald" />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <Bolt className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-700">Elektrik Kesintileri</span>
                </div>
                <div className="flex items-center">
                  <span className="text-xs font-medium text-red-600">Son 30 gün</span>
                  <Badge className="ml-2" color="rose" size="xs">Dikkat</Badge>
                </div>
              </div>
              <ProgressBar value={15} color="rose" />
            </div>
          </div>
        </Card>

        {/* Saha Performansı */}
        <Card className="shadow-md hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Title>Saha Performansı</Title>
              <Text className="text-gray-500">Santral bazlı performans durumu</Text>
            </div>
            <button 
              onClick={() => navigate('/sahalar')}
              className="text-sm text-primary-600 hover:text-primary-800 flex items-center"
            >
              Detaylar <ArrowRight className="h-4 w-4 ml-1" />
            </button>
          </div>
          <div className="mt-6 space-y-4">
            {istatistikler.sahaPerformansi.length > 0 ? (
              <>
                {istatistikler.sahaPerformansi.slice(0, 5).map((saha) => (
                  <div key={saha.saha}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700">{saha.saha}</span>
                      <div className="flex items-center">
                        <span className="text-sm text-gray-600">%{saha.performans}</span>
                        <Badge 
                          className="ml-2" 
                          color={saha.performans > 90 ? "emerald" : saha.performans > 70 ? "amber" : "rose"} 
                          size="xs"
                        >
                          {saha.performans > 90 ? "Mükemmel" : saha.performans > 70 ? "İyi" : "Geliştirilebilir"}
                        </Badge>
                      </div>
                    </div>
                    <ProgressBar 
                      value={saha.performans} 
                      color={saha.performans > 90 ? "emerald" : saha.performans > 70 ? "amber" : "rose"} 
                    />
                  </div>
                ))}
                {istatistikler.sahaPerformansi.length > 5 && (
                  <div className="text-center mt-4 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <button 
                      onClick={() => navigate('/sahalar')}
                      className="text-sm text-primary-600 hover:text-primary-800 flex items-center justify-center w-full"
                    >
                      {istatistikler.sahaPerformansi.length - 5} saha daha göster <ArrowRight className="h-4 w-4 ml-1" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-6">
                <Building className="h-8 w-8 text-gray-300 mb-2" />
                <p className="text-gray-500 text-center">Henüz saha performans verisi bulunmuyor</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Önemli Bilgiler */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kritik Stoklar */}
        <Card className="shadow-md hover:shadow-lg transition-all duration-300">
          <div 
            className="flex items-center justify-between mb-4 cursor-pointer"
            onClick={() => togglePanel('stoklar')}
          >
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-full mr-2">
                <Package className="h-5 w-5 text-red-600" />
              </div>
              <Title>Kritik Stoklar</Title>
            </div>
            <button className="text-gray-400">
              {genisletilenPanel === 'stoklar' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
          
          {genisletilenPanel === 'stoklar' ? (
            <div className="space-y-4 mt-4 animate-fade-in-down">
              {istatistikler.stokDurumu.length > 0 ? (
                <>
                  {istatistikler.stokDurumu.map((stok, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">{stok.urun}</span>
                        <div className="flex items-center">
                          <span className="text-sm text-gray-600">{stok.miktar} adet</span>
                          {stok.miktar <= stok.kritikSeviye && (
                            <Badge color="red" size="xs" className="ml-2">Kritik</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Kritik Seviye: {stok.kritikSeviye}</span>
                        <span>Durum: {stok.miktar <= stok.kritikSeviye ? 'Sipariş Gerekli' : 'Yeterli'}</span>
                      </div>
                      <ProgressBar 
                        value={Math.min((stok.miktar / stok.kritikSeviye) * 100, 100)} 
                        color={stok.miktar <= stok.kritikSeviye ? "rose" : "emerald"} 
                      />
                    </div>
                  ))}
                  <div className="text-center mt-2">
                    <button 
                      onClick={() => navigate('/stok-kontrol')}
                      className="text-sm text-primary-600 hover:text-primary-800 flex items-center justify-center w-full"
                    >
                      Tüm Stokları Görüntüle <ArrowRight className="h-4 w-4 ml-1" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-6">
                  <Package className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-gray-500 text-center">Kritik stok bilgisi bulunmuyor</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">
                {istatistikler.kritikStoklar > 0 
                  ? `${istatistikler.kritikStoklar} ürün kritik stok seviyesinin altında`
                  : 'Tüm stoklar yeterli seviyede'}
              </span>
              <Badge color={istatistikler.kritikStoklar > 0 ? "red" : "green"}>
                {istatistikler.kritikStoklar > 0 ? 'Acil' : 'İyi'}
              </Badge>
            </div>
          )}
        </Card>
        
        {/* Yaklaşan Bakımlar */}
        <Card className="shadow-md hover:shadow-lg transition-all duration-300">
          <div 
            className="flex items-center justify-between mb-4 cursor-pointer"
            onClick={() => togglePanel('bakimlar')}
          >
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-full mr-2">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <Title>Yaklaşan Bakımlar</Title>
            </div>
            <button className="text-gray-400">
              {genisletilenPanel === 'bakimlar' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
          
          {genisletilenPanel === 'bakimlar' ? (
            <div className="space-y-4 mt-4 animate-fade-in-down">
              {istatistikler.sonBakimTarihi ? (
                <>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Mekanik Bakım</span>
                      <Badge color="amber">Yaklaşan</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Planlanan: {format(addMonths(new Date(), 1), 'dd MMM yyyy', { locale: tr })}</span>
                      <span>Tip: Periyodik</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      <p>İnvertör kontrolleri, panel temizliği ve sistem kontrolü yapılacak</p>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Elektrik Bakım</span>
                      <Badge color="emerald">Tamamlandı</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Tarih: {format(istatistikler.sonBakimTarihi, 'dd MMM yyyy', { locale: tr })}</span>
                      <span>Tip: Aylık</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      <p>Kablo kontrolü, topraklama testi ve şalt sahası kontrolü yapıldı</p>
                    </div>
                  </div>
                  
                  <div className="text-center mt-2">
                    <button 
                      onClick={() => navigate('/mekanik-bakim')}
                      className="text-sm text-primary-600 hover:text-primary-800 flex items-center justify-center w-full"
                    >
                      Tüm Bakımları Görüntüle <ArrowRight className="h-4 w-4 ml-1" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-6">
                  <Calendar className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-gray-500 text-center">Yaklaşan bakım bilgisi bulunmuyor</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">
                {istatistikler.sonBakimTarihi 
                  ? `Son bakım: ${format(istatistikler.sonBakimTarihi, 'dd MMM yyyy', { locale: tr })}`
                  : 'Bakım bilgisi bulunamadı'}
              </span>
              {istatistikler.sonrakiBakimTarihi && (
                <Badge color={new Date() > istatistikler.sonrakiBakimTarihi ? "red" : "amber"}>
                  {new Date() > istatistikler.sonrakiBakimTarihi ? 'Gecikti' : 'Yaklaşıyor'}
                </Badge>
              )}
            </div>
          )}
        </Card>
        
        {/* CO2 Tasarrufu */}
        <Card className="shadow-md hover:shadow-lg transition-all duration-300">
          <div 
            className="flex items-center justify-between mb-4 cursor-pointer"
            onClick={() => togglePanel('co2')}
          >
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-full mr-2">
                <Leaf className="h-5 w-5 text-green-600" />
              </div>
              <Title>CO2 Tasarrufu</Title>
            </div>
            <button className="text-gray-400">
              {genisletilenPanel === 'co2' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
          
          {genisletilenPanel === 'co2' ? (
            <div className="space-y-4 mt-4 animate-fade-in-down">
              {istatistikler.toplamCO2Tasarrufu > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-green-50 rounded-lg text-center">
                      <Text className="text-xs text-green-600">Toplam CO₂ Tasarrufu</Text>
                      <Metric className="text-xl text-green-700 mt-1">
                        {Math.round(istatistikler.toplamCO2Tasarrufu).toLocaleString('tr-TR')} kg
                      </Metric>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <Text className="text-xs text-blue-600">Ağaç Eşdeğeri</Text>
                      <Metric className="text-xl text-blue-700 mt-1">
                        ~ {Math.round(istatistikler.toplamCO2Tasarrufu / 21)} ağaç
                      </Metric>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <Text className="text-sm text-gray-700 mb-2">Çevresel Katkı</Text>
                    <div className="space-y-2">
                      <div className="flex items-center text-xs text-gray-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        <span>1 ağaç yılda ortalama 21 kg CO₂ emer</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-600">
                        <div className="w-2 h-2 bg-amber-500 rounded-full mr-2"></div>
                        <span>1 kWh güneş enerjisi üretimi ~0.5 kg CO₂ tasarrufu sağlar</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-600">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                        <span>Bir araç yılda ortalama 2 ton CO₂ üretir</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <div className="text-center">
                      <Text className="text-sm text-emerald-700">
                        Sistemleriniz {Math.round(istatistikler.toplamCO2Tasarrufu / 2000)} arabanın yıllık emisyonunu engelledi
                      </Text>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-6">
                  <Leaf className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-gray-500 text-center">CO₂ tasarruf bilgisi bulunamadı</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg">
              <span className="text-sm text-emerald-600">
                {istatistikler.toplamCO2Tasarrufu > 0 
                  ? `Toplam ${Math.round(istatistikler.toplamCO2Tasarrufu).toLocaleString('tr-TR')} kg CO₂ tasarrufu sağlandı`
                  : 'Henüz CO₂ tasarruf verisi yok'}
              </span>
              {istatistikler.toplamCO2Tasarrufu > 0 && (
                <Badge color="green">
                  Çevre Dostu
                </Badge>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Son Arızalar */}
      <Card className="shadow-md hover:shadow-lg transition-all duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-full mr-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <Title>Son Arızalar</Title>
              <Text className="text-gray-500">En son kaydedilen 5 arıza kaydı</Text>
            </div>
          </div>
          <button 
            onClick={() => navigate('/arizalar')}
            className="text-sm text-primary-600 hover:text-primary-800 flex items-center"
          >
            Tümünü Görüntüle <ArrowRight className="h-4 w-4 ml-1" />
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {arizalar.length === 0 ? (
            <div className="py-6 text-center">
              <AlertTriangle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">Henüz arıza kaydı bulunmuyor</p>
            </div>
          ) : (
            arizalar.map((ariza) => (
              <div
                key={ariza.id}
                onClick={() => setSeciliAriza(ariza)}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-150 rounded-lg group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      ariza.durum === 'cozuldu' ? 'bg-green-100 text-green-800' :
                      ariza.durum === 'devam-ediyor' ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {ariza.durum === 'cozuldu' && <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                      {ariza.durum === 'devam-ediyor' && <Clock className="h-3.5 w-3.5 mr-1" />}
                      {ariza.durum === 'acik' && <AlertTriangle className="h-3.5 w-3.5 mr-1" />}
                      {ariza.durum === 'cozuldu' ? 'Çözüldü' : 
                       ariza.durum === 'devam-ediyor' ? 'Devam Ediyor' : 'Açık'}
                    </span>
                    <h3 className="text-sm font-medium text-gray-900">{ariza.baslik}</h3>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 mr-2">
                      {format(ariza.olusturmaTarihi.toDate(), 'dd MMM yyyy', { locale: tr })}
                    </span>
                    <Eye className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="mt-2 sm:flex sm:justify-between">
                  <div className="sm:flex">
                    <p className="flex items-center text-xs text-gray-500">
                      <Building className="flex-shrink-0 mr-1.5 h-3.5 w-3.5 text-gray-400" />
                      {sahalar[ariza.saha] || 'Bilinmeyen Saha'}
                    </p>
                    <p className="mt-2 flex items-center text-xs text-gray-500 sm:mt-0 sm:ml-6">
                      <MapPin className="flex-shrink-0 mr-1.5 h-3.5 w-3.5 text-gray-400" />
                      {ariza.konum || 'Konum belirtilmemiş'}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center text-xs text-gray-500 sm:mt-0">
                    <User className="flex-shrink-0 mr-1.5 h-3.5 w-3.5 text-gray-400" />
                    {ariza.olusturanAd || 'Bilinmeyen Kullanıcı'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {arizalar.length > 0 && kullanici?.rol !== 'musteri' && (
          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/arizalar')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Yeni Arıza Kaydı
            </button>
          </div>
        )}
      </Card>

      {/* Çevre Etkisi */}
      {istatistikler.toplamCO2Tasarrufu > 0 && (
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
                    {istatistikler.toplamCO2Tasarrufu.toLocaleString('tr-TR', {maximumFractionDigits: 0})} kg
                  </span>
                  <span className="ml-2 text-sm text-emerald-600">
                    CO₂ tasarrufu
                  </span>
                </div>
              </div>
            </div>
            <div className="text-sm text-emerald-700 flex items-center">
              <div className="mr-2 bg-white p-3 rounded-lg shadow-sm">
                <Metric className="text-lg text-emerald-600">{Math.round(istatistikler.toplamCO2Tasarrufu / 21)}</Metric>
                <Text className="text-xs text-emerald-500">Ağaç Eşdeğeri</Text>
              </div>
              <div>Bu, yaklaşık {Math.round(istatistikler.toplamCO2Tasarrufu / 21)} ağacın yıllık CO₂ emilimine eşdeğerdir.</div>
            </div>
          </div>
        </Card>
      )}

      {/* Hızlı Ayarlar */}
      {(kullanici?.rol === 'yonetici' || kullanici?.rol === 'tekniker' || kullanici?.rol === 'muhendis') && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-gray-100 rounded-full mr-3">
                <Settings className="h-5 w-5 text-gray-600" />
              </div>
              <Title>Hızlı Ayarlar</Title>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => navigate('/ges-yonetimi')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                  <Sun className="h-5 w-5 text-yellow-500 mr-2" />
                  <span className="text-sm font-medium">Santral Yönetimi</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </button>
              
              <button 
                onClick={() => navigate('/ekip')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                  <User className="h-5 w-5 text-blue-500 mr-2" />
                  <span className="text-sm font-medium">Ekip Yönetimi</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </button>
              
              <button 
                onClick={() => navigate('/ayarlar')}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center">
                  <Settings className="h-5 w-5 text-gray-500 mr-2" />
                  <span className="text-sm font-medium">Sistem Ayarları</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </Card>
          
          {(kullanici?.rol === 'yonetici' || kullanici?.rol === 'muhendis') && (
            <Card className="shadow-sm hover:shadow-md transition-all duration-300 md:col-span-2">
              <div className="flex items-center mb-4">
                <div className="p-2 bg-yellow-100 rounded-full mr-3">
                  <FileBarChart className="h-5 w-5 text-yellow-600" />
                </div>
                <Title>Aylık Kapsamlı Rapor</Title>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
                <p className="text-sm text-yellow-800 mb-4">
                  Tüm santral verilerini, arızaları, yapılan işleri ve bakım kontrollerini tek ekranda gösteren kapsamlı aylık raporu görüntüleyin ve PDF olarak indirin.
                </p>
                <button
                  onClick={() => navigate('/aylik-kapsamli-rapor')}
                  className="w-full flex items-center justify-center p-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  <FileBarChart className="h-5 w-5 mr-2" />
                  <span className="text-sm font-medium">Aylık Kapsamlı Raporu Görüntüle</span>
                </button>
              </div>
            </Card>
          )}
        </div>
      )}

      {seciliAriza && (
        <ArizaDetayModal
          ariza={seciliAriza}
          sahaAdi={sahalar[seciliAriza.saha] || 'Bilinmeyen Saha'}
          onClose={() => setSeciliAriza(null)}
        />
      )}
    </div>
  );
}
