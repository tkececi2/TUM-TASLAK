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
  Eye,
  Smartphone,
  Globe,
  Award,
  Target,
  Briefcase,
  Users,
  Database,
  Monitor
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
    planliBackimYuzdesi: 30,
    stokDurumu: [] as { urun: string; miktar: number; kritikSeviye: number }[]
  });

  // Boş istatistikler oluştur
  const createEmptyStats = () => {
    return {
      toplamAriza: 0,
      acikArizalar: 0,
      devamEdenArizalar: 0,
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
      planliBackimYuzdesi: 30,
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
          kritikStokSayisi = 0;
        }

        if (stokQuery) {
          const stokSnapshot = await getDocs(stokQuery);
          kritikStokSayisi = stokSnapshot.docs.filter(doc => {
            const stok = doc.data();
            return stok.miktar <= stok.kritikSeviye;
          }).length;

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
              const aKritik = a.miktar <= a.kritikSeviye;
              const bKritik = b.miktar <= b.kritikSeviye;

              if (aKritik && !bKritik) return -1;
              if (!aKritik && bKritik) return 1;

              const aOran = a.miktar / a.kritikSeviye;
              const bOran = b.miktar / b.kritikSeviye;

              return aOran - bOran;
            })
            .slice(0, 5);
        }
      } catch (error) {
        console.error('Stoklar getirilemedi:', error);
        kritikStokSayisi = 0;
      }

      // Planlı bakım sayısını getir
      let planlanmisBakimlar = 0;
      let sonBakimTarihi = null;
      let sonrakiBakimTarihi = null;
      let planliBackimYuzdesi = 30;

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
          planlanmisBakimlar = 0;
        }

        if (bakimQuery) {
          const bakimSnapshot = await getDocs(bakimQuery);
          planlanmisBakimlar = bakimSnapshot.docs.length;

          if (bakimSnapshot.docs.length > 0) {
            const sonBakim = bakimSnapshot.docs[0].data();
            sonBakimTarihi = sonBakim.tarih.toDate();
            sonrakiBakimTarihi = addMonths(sonBakimTarihi, 3);

            const bugun = new Date();
            const toplamGun = 90;
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
      }

      // Performans skoru hesapla
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
      let yillikHedefUretim = 0;

      try {
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
          yillikHedefUretim = santralSnapshot.docs.reduce((acc, doc) => {
            const santralData = doc.data();
            return acc + (santralData.yillikHedefUretim || 0);
          }, 0);
        }

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
    <div className="space-y-8 p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 rounded-3xl shadow-2xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-400/20 to-transparent rounded-full blur-3xl transform translate-x-32 -translate-y-32"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-indigo-400/20 to-transparent rounded-full blur-3xl transform -translate-x-32 translate-y-32"></div>

        <div className="relative z-10 p-8">
          <div className="flex flex-col lg:flex-row items-center justify-between space-y-6 lg:space-y-0">
            <div className="flex items-center space-x-6">
              <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
                <img src="/solarveyo-logo.png" alt="SolarVeyo" className="h-12 w-12 object-contain" />
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-white">
                  Hoş Geldiniz, {kullanici?.ad}
                </h1>
                <p className="text-lg text-blue-100 mt-2">
                  {format(new Date(), 'dd MMMM yyyy, EEEE', { locale: tr })}
                </p>
                <div className="flex items-center mt-3 space-x-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-500/20 text-emerald-100 border border-emerald-400/30">
                    <Activity className="w-4 h-4 mr-2" />
                    Sistem Aktif
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-500/20 text-blue-100 border border-blue-400/30">
                    <Shield className="w-4 h-4 mr-2" />
                    {kullanici?.rol || 'Kullanıcı'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-6">
              <button
                onClick={veriYenile}
                disabled={yenileniyor}
                className="group inline-flex items-center px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl text-white font-medium transition-all duration-300 hover:scale-105 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 mr-2 ${yenileniyor ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                {yenileniyor ? 'Yenileniyor...' : 'Verileri Yenile'}
              </button>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <div className="flex items-center justify-center mb-2">
                    <Battery className="w-5 h-5 text-emerald-400 mr-2" />
                    <span className="text-sm text-blue-100">Aylık Üretim</span>
                  </div>
                  <p className="text-xl font-bold text-white">{istatistikler.aylikUretim.toLocaleString('tr-TR')} kWh</p>
                </div>
                <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <div className="flex items-center justify-center mb-2">
                    <Target className="w-5 h-5 text-amber-400 mr-2" />
                    <span className="text-sm text-blue-100">Yıllık Hedef</span>
                  </div>
                  <p className="text-xl font-bold text-white">{istatistikler.yillikHedefUretim.toLocaleString('tr-TR')} kWh</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { 
            icon: AlertTriangle, 
            title: 'Arızalar', 
            description: 'Arıza takibi ve yönetimi',
            route: '/arizalar',
            color: 'red',
            count: istatistikler.acikArizalar + istatistikler.devamEdenArizalar
          },
          { 
            icon: Sun, 
            title: 'Üretim Verileri', 
            description: 'Enerji üretim takibi',
            route: '/uretim-verileri',
            color: 'yellow',
            count: Math.round(istatistikler.aylikUretim / 1000)
          },
          { 
            icon: Zap, 
            title: 'Elektrik Bakım', 
            description: 'Elektrik bakım kontrolleri',
            route: '/elektrik-bakim',
            color: 'amber',
            count: istatistikler.planliBakimlar
          },
          { 
            icon: PanelTop, 
            title: 'Mekanik Bakım', 
            description: 'Mekanik bakım kontrolleri',
            route: '/mekanik-bakim',
            color: 'blue',
            count: istatistikler.planliBakimlar
          },
          { 
            icon: Package, 
            title: 'Stok Kontrol', 
            description: 'Malzeme ve envanter',
            route: '/stok-kontrol',
            color: 'purple',
            count: istatistikler.kritikStoklar
          },
          { 
            icon: FileBarChart, 
            title: 'İstatistikler', 
            description: 'Analiz ve raporlar',
            route: '/istatistikler',
            color: 'emerald',
            count: istatistikler.performansSkoru
          }
        ].map((item, index) => (
          <div
            key={index}
            onClick={() => navigate(item.route)}
            className="group relative overflow-hidden bg-white hover:bg-gradient-to-br hover:from-white hover:to-slate-50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer border border-slate-200/50 hover:border-slate-300/50 transform hover:scale-105"
          >
            <div className="p-6">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 bg-${item.color}-100 group-hover:bg-${item.color}-200 transition-colors duration-300`}>
                <item.icon className={`w-6 h-6 text-${item.color}-600`} />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-slate-800 transition-colors">
                {item.title}
              </h3>
              <p className="text-sm text-slate-600 mb-3 leading-relaxed">{item.description}</p>
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${item.color}-100 text-${item.color}-700`}>
                  {item.count}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all duration-300" />
              </div>
            </div>
            <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-${item.color}-400 to-${item.color}-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left`}></div>
          </div>
        ))}
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            title: 'Arıza Durumu',
            value: istatistikler.acikArizalar + istatistikler.devamEdenArizalar,
            subtitle: 'Aktif Arıza',
            icon: AlertTriangle,
            gradient: 'from-red-500 to-pink-600',
            progress: istatistikler.performansSkoru,
            progressLabel: 'Çözüm Oranı',
            badge: istatistikler.acikArizalar > 3 ? 'Dikkat' : 'Normal',
            badgeColor: istatistikler.acikArizalar > 3 ? 'red' : 'green'
          },
          {
            title: 'Üretim Performansı',
            value: `${(istatistikler.aylikUretim / 1000).toFixed(1)}k`,
            subtitle: 'kWh / Ay',
            icon: Battery,
            gradient: 'from-emerald-500 to-teal-600',
            progress: istatistikler.yillikHedefUretim > 0 ? Math.min((istatistikler.yillikUretim / istatistikler.yillikHedefUretim) * 100, 100) : 0,
            progressLabel: 'Yıllık Hedef',
            badge: 'Hedef Üzerinde',
            badgeColor: 'emerald'
          },
          {
            title: 'Bakım Durumu',
            value: istatistikler.planliBakimlar,
            subtitle: 'Planlı Bakım',
            icon: Wrench,
            gradient: 'from-blue-500 to-indigo-600',
            progress: istatistikler.planliBackimYuzdesi,
            progressLabel: 'Bakım Döngüsü',
            badge: istatistikler.sonrakiBakimTarihi && new Date() > istatistikler.sonrakiBakimTarihi ? 'Bakım Gerekli' : 'Güncel',
            badgeColor: istatistikler.sonrakiBakimTarihi && new Date() > istatistikler.sonrakiBakimTarihi ? 'amber' : 'blue'
          },
          {
            title: 'Stok Durumu',
            value: istatistikler.kritikStoklar,
            subtitle: 'Kritik Stok',
            icon: Package,
            gradient: 'from-purple-500 to-violet-600',
            progress: Math.max(0, 100 - (istatistikler.kritikStoklar * 10)),
            progressLabel: 'Stok Seviyesi',
            badge: istatistikler.kritikStoklar > 0 ? 'Sipariş Gerekli' : 'Yeterli',
            badgeColor: istatistikler.kritikStoklar > 0 ? 'orange' : 'green'
          }
        ].map((kpi, index) => (
          <Card key={index} className="relative overflow-hidden bg-white border-0 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:scale-105">
            <div className={`absolute inset-0 bg-gradient-to-br ${kpi.gradient} opacity-5`}></div>
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${kpi.gradient} bg-opacity-10`}>
                  <kpi.icon className={`w-6 h-6 text-white`} style={{filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.3))'}} />
                </div>
                <Badge 
                  size="sm" 
                  color={kpi.badgeColor as any}
                  className="font-medium"
                >
                  {kpi.badge}
                </Badge>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-slate-600">{kpi.title}</h3>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold text-slate-900">{kpi.value}</span>
                  <span className="text-sm text-slate-500">{kpi.subtitle}</span>
                </div>

                <div className="pt-3">
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                    <span>{kpi.progressLabel}</span>
                    <span>{kpi.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full bg-gradient-to-r ${kpi.gradient} transition-all duration-1000 ease-out`}
                      style={{ width: `${kpi.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Üretim Trendi */}
        {istatistikler.uretimVerileri.length > 0 && (
          <Card className="shadow-xl hover:shadow-2xl transition-all duration-500 bg-white border-0 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 border-b border-emerald-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-500 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Title className="text-emerald-900">Üretim Performans Analizi</Title>
                    <Text className="text-emerald-700">Son 14 günün detaylı üretim verileri</Text>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/uretim-verileri')}
                  className="inline-flex items-center px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors duration-200 text-sm font-medium"
                >
                  Detaylı Analiz <ExternalLink className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <AreaChart
                className="h-80"
                data={istatistikler.uretimVerileri}
                index="date"
                categories={["uretim"]}
                colors={["emerald"]}
                valueFormatter={(value) => `${value.toLocaleString('tr-TR')} kWh`}
                showAnimation={true}
                showGradient={true}
                showLegend={false}
              />

              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-emerald-50 rounded-xl">
                  <Text className="text-xs text-emerald-600 font-medium">Günlük Ortalama</Text>
                  <Metric className="text-xl font-bold text-emerald-800 mt-1">
                    {istatistikler.uretimVerileri.length > 0 
                      ? Math.round(istatistikler.uretimVerileri.reduce((acc, item) => acc + item.uretim, 0) / istatistikler.uretimVerileri.length).toLocaleString('tr-TR')
                      : '0'} kWh
                  </Metric>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <Text className="text-xs text-blue-600 font-medium">En Yüksek Üretim</Text>
                  <Metric className="text-xl font-bold text-blue-800 mt-1">
                    {istatistikler.uretimVerileri.length > 0 
                      ? Math.max(...istatistikler.uretimVerileri.map(item => item.uretim)).toLocaleString('tr-TR')
                      : '0'} kWh
                  </Metric>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-xl">
                  <Text className="text-xs text-amber-600 font-medium">Hedef Tamamlama</Text>
                  <Metric className="text-xl font-bold text-amber-800 mt-1">
                    {istatistikler.yillikHedefUretim > 0 
                      ? Math.round((istatistikler.yillikUretim / istatistikler.yillikHedefUretim) * 100)
                      : '0'}%
                  </Metric>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Arıza Trendi */}
        <Card className="shadow-xl hover:shadow-2xl transition-all duration-500 bg-white border-0 overflow-hidden">
          <div className="bg-gradient-to-r from-red-50 to-pink-50 p-6 border-b border-red-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-500 rounded-lg">
                  <BarChart2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <Title className="text-red-900">Arıza Trend Analizi</Title>
                  <Text className="text-red-700">Haftalık arıza dağılımı ve çözüm oranları</Text>
                </div>
              </div>
              <button 
                onClick={() => navigate('/arizalar')}
                className="inline-flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                Arıza Yönetimi <ExternalLink className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>

          <div className="p-6">
            <TremorBarChart
              className="h-80"
              data={istatistikler.haftalikArizalar}
              index="date"
              categories={["arizaSayisi"]}
              colors={["red"]}
              valueFormatter={(value) => `${value} arıza`}
              showAnimation={true}
              showLegend={false}
            />

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-red-50 rounded-xl">
                <Text className="text-xs text-red-600 font-medium">Haftalık Toplam</Text>
                <Metric className="text-xl font-bold text-red-800 mt-1">
                  {istatistikler.haftalikArizalar.reduce((acc, item) => acc + item.arizaSayisi, 0)} arıza
                </Metric>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-xl">
                <Text className="text-xs text-amber-600 font-medium">Ortalama Çözüm</Text>
                <Metric className="text-xl font-bold text-amber-800 mt-1">
                  48 saat
                </Metric>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-xl">
                <Text className="text-xs text-emerald-600 font-medium">Başarı Oranı</Text>
                <Metric className="text-xl font-bold text-emerald-800 mt-1">
                  {istatistikler.performansSkoru}%
                </Metric>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Detaylı İstatistikler */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Arıza Dağılımı */}
        <Card className="shadow-xl hover:shadow-2xl transition-all duration-500 bg-white border-0">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <PieChart className="w-5 h-5 text-slate-600" />
                <Title>Arıza Durum Dağılımı</Title>
              </div>
              <button 
                onClick={() => navigate('/istatistikler')}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                Detaylar →
              </button>
            </div>
          </div>

          <div className="p-6">
            <DonutChart
              className="h-60"
              data={istatistikler.arizaDagilimi}
              category="sayi"
              index="durum"
              colors={["rose", "amber", "emerald"]}
              valueFormatter={(value) => `${value} arıza`}
              showAnimation={true}
            />

            <div className="mt-6 space-y-3">
              {istatistikler.arizaDagilimi.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      item.durum === 'Açık' ? 'bg-rose-500' :
                      item.durum === 'Devam Eden' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}></div>
                    <span className="text-sm font-medium text-slate-700">{item.durum}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">{item.sayi}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Saha Performansı */}
        <Card className="shadow-xl hover:shadow-2xl transition-all duration-500 bg-white border-0">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Building className="w-5 h-5 text-slate-600" />
                <Title>Saha Performans Skoru</Title>
              </div>
              <button 
                onClick={() => navigate('/sahalar')}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                Detaylar →
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {istatistikler.sahaPerformansi.length > 0 ? (
              istatistikler.sahaPerformansi.slice(0, 5).map((saha, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700">{saha.saha}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-slate-600">{saha.performans}%</span>
                      <Badge 
                        size="sm"
                        color={saha.performans > 90 ? "emerald" : saha.performans > 70 ? "amber" : "rose"}
                      >
                        {saha.performans > 90 ? "Mükemmel" : saha.performans > 70 ? "İyi" : "Geliştirilmeli"}
                      </Badge>
                    </div>
                  </div>
                  <ProgressBar 
                    value={saha.performans} 
                    color={saha.performans > 90 ? "emerald" : saha.performans > 70 ? "amber" : "rose"} 
                  />
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Saha performans verisi bulunamadı</p>
              </div>
            )}
          </div>
        </Card>

        {/* Kritik Durumlar */}
        <Card className="shadow-xl hover:shadow-2xl transition-all duration-500 bg-white border-0">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <Title>Kritik Durumlar</Title>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-red-800">Aktif Arızalar</span>
                <Badge color="red" size="sm">{istatistikler.acikArizalar + istatistikler.devamEdenArizalar}</Badge>
              </div>
              <p className="text-xs text-red-600">Acil müdahale gerektiren arızalar mevcut</p>
            </div>

            {istatistikler.kritikStoklar > 0 && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-orange-800">Kritik Stoklar</span>
                  <Badge color="orange" size="sm">{istatistikler.kritikStoklar}</Badge>
                </div>
                <p className="text-xs text-orange-600">Stok seviyeleri kritik eşiğin altında</p>
              </div>
            )}

            {istatistikler.sonrakiBakimTarihi && new Date() > istatistikler.sonrakiBakimTarihi && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-800">Bakım Gerekli</span>
                  <Badge color="amber" size="sm">Gecikmiş</Badge>
                </div>
                <p className="text-xs text-amber-600">Planlı bakım tarihi geçti</p>
              </div>
            )}

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-emerald-800">CO₂ Tasarrufu</span>
                <Badge color="emerald" size="sm">{Math.round(istatistikler.toplamCO2Tasarrufu)} kg</Badge>
              </div>
              <p className="text-xs text-emerald-600">Çevresel etki pozitif seviyelerde</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Son Arızalar Listesi */}
      <Card className="shadow-xl hover:shadow-2xl transition-all duration-500 bg-white border-0 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <Title className="text-slate-900">Son Arıza Kayıtları</Title>
                <Text className="text-slate-600">En güncel 5 arıza kaydı</Text>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {kullanici?.rol !== 'musteri' && (
                <button
                  onClick={() => navigate('/arizalar')}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 text-sm font-medium"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Yeni Arıza
                </button>
              )}
              <button 
                onClick={() => navigate('/arizalar')}
                className="inline-flex items-center px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors duration-200 text-sm font-medium"
              >
                Tümünü Görüntüle <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {arizalar.length === 0 ? (
            <div className="p-12 text-center">
              <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Henüz arıza kaydı bulunmuyor</h3>
              <p className="text-slate-500">Sistem şu anda arıza kaydı içermiyor.</p>
            </div>
          ) : (
            arizalar.map((ariza) => (
              <div
                key={ariza.id}
                onClick={() => setSeciliAriza(ariza)}
                className="group p-6 hover:bg-slate-50 cursor-pointer transition-all duration-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className={`p-2 rounded-lg ${
                      ariza.durum === 'cozuldu' ? 'bg-emerald-100' :
                      ariza.durum === 'devam-ediyor' ? 'bg-blue-100' : 'bg-red-100'
                    }`}>
                      {ariza.durum === 'cozuldu' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                      {ariza.durum === 'devam-ediyor' && <Clock className="w-5 h-5 text-blue-600" />}
                      {ariza.durum === 'acik' && <AlertTriangle className="w-5 h-5 text-red-600" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {ariza.baslik}
                        </h3>
                        <Badge 
                          color={
                            ariza.durum === 'cozuldu' ? 'emerald' :
                            ariza.durum === 'devam-ediyor' ? 'blue' : 'red'
                          }
                          size="sm"
                        >
                          {ariza.durum === 'cozuldu' ? 'Çözüldü' : 
                           ariza.durum === 'devam-ediyor' ? 'Devam Ediyor' : 'Açık'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-slate-600">
                        <div className="flex items-center space-x-2">
                          <Building className="w-4 h-4 text-slate-400" />
                          <span>{sahalar[ariza.saha] || 'Bilinmeyen Saha'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <span>{ariza.konum || 'Konum belirtilmemiş'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span>{ariza.olusturanAd || 'Bilinmeyen Kullanıcı'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-slate-500">
                      {format(ariza.olusturmaTarihi.toDate(), 'dd MMM yyyy', { locale: tr })}
                    </span>
                    <div className="p-2 bg-slate-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <Eye className="w-4 h-4 text-slate-600" />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Hızlı Eylemler - Sadece Yetkili Kullanıcılar İçin */}
      {(kullanici?.rol === 'yonetici' || kullanici?.rol === 'tekniker' || kullanici?.rol === 'muhendis') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="shadow-xl hover:shadow-2xl transition-all duration-500 bg-white border-0">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <Settings className="w-5 h-5 text-slate-600" />
                <Title>Hızlı Yönetim Araçları</Title>
              </div>
            </div>

            <div className="p-6 space-y-3">
              {[
                { icon: Sun, title: 'Santral Yönetimi', route: '/ges-yonetimi', color: 'yellow' },
                { icon: Users, title: 'Ekip Yönetimi', route: '/ekip', color: 'blue' },
                { icon: Settings, title: 'Sistem Ayarları', route: '/ayarlar', color: 'slate' }
              ].map((item, index) => (
                <button
                  key={index}
                  onClick={() => navigate(item.route)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all duration-300 group hover:scale-105"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 bg-${item.color}-100 rounded-lg group-hover:bg-${item.color}-200 transition-colors`}>
                      <item.icon className={`w-5 h-5 text-${item.color}-600`} />
                    </div>
                    <span className="font-medium text-slate-900">{item.title}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all duration-300" />
                </button>
              ))}
            </div>
          </Card>

          {(kullanici?.rol === 'yonetici' || kullanici?.rol === 'muhendis') && (
            <Card className="shadow-xl hover:shadow-2xl transition-all duration-500 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
              <div className="p-6 border-b border-amber-200">
                <div className="flex items-center space-x-3">
                  <Award className="w-5 h-5 text-amber-600" />
                  <Title className="text-amber-900">Kapsamlı Raporlama</Title>
                </div>
              </div>

              <div className="p-6">
                <p className="text-amber-800 mb-6 leading-relaxed">
                  Tüm santral verilerini, arızaları, yapılan işleri ve bakım kontrollerini içeren 
                  detaylı aylık raporu görüntüleyin ve PDF formatında indirin.
                </p>
                <button
                  onClick={() => navigate('/aylik-kapsamli-rapor')}
                  className="w-full flex items-center justify-center p-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl transition-all duration-300 font-medium hover:scale-105"
                >
                  <FileBarChart className="w-5 h-5 mr-3" />
                  Aylık Kapsamlı Raporu Görüntüle
                </button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Arıza Detay Modal */}
      {seciliAriza && (
        <ArizaDetayModal
          ariza={seciliAriza}
          sahaAdi={sahalar[seciliAriza.saha] || 'Bilinmeyen Saha'}
          onClose={() => setSeciliAriza(null)}
        />
      )}
    </div>
  );
};