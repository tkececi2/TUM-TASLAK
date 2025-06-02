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
  Activity,
  FileText,
  ArrowRight,
  RefreshCw,
  Eye,
  Award,
  Target,
  Users,
  Settings,
  ExternalLink,
  ChevronRight,
  Filter,
  Download,
  Bell,
  Maximize2
} from 'lucide-react';
import { StatsCard } from '../components/StatsCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ArizaDetayModal } from '../components/ArizaDetayModal';
import { Card, Title, BarChart as TremorBarChart, DonutChart, AreaChart, ProgressBar, Text, Flex, Metric, Badge } from '@tremor/react';
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

      setIstatistikler({
        toplamAriza: toplam,
        acikArizalar: acik,
        devamEdenArizalar: devamEden,
        cozulenArizalar: cozulen,
        kritikStoklar: 0,
        planliBakimlar: 0,
        performansSkoru: performans,
        haftalikArizalar: sonYediGun,
        arizaDagilimi: durumDagilimi,
        sahaPerformansi: [],
        uretimVerileri: [],
        toplamUretim: 0,
        aylikUretim: 0,
        yillikUretim: 0,
        toplamCO2Tasarrufu: 0,
        yillikHedefUretim: 0,
        sonBakimTarihi: null,
        sonrakiBakimTarihi: null,
        planliBackimYuzdesi: 30,
        stokDurumu: []
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

  if (yukleniyor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                <Sun className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Hoş Geldiniz, {kullanici?.ad}
                </h1>
                <p className="text-gray-600 mt-1">
                  {format(new Date(), 'dd MMMM yyyy, EEEE', { locale: tr })}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4 mt-6 lg:mt-0">
              <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg">
                <Activity className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Sistem Aktif</span>
              </div>

              <button
                onClick={veriYenile}
                disabled={yenileniyor}
                className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${yenileniyor ? 'animate-spin' : ''}`} />
                {yenileniyor ? 'Yenileniyor...' : 'Yenile'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: 'Aktif Arızalar',
              value: istatistikler.acikArizalar + istatistikler.devamEdenArizalar,
              change: '-12%',
              changeType: 'positive',
              icon: AlertTriangle,
              color: 'red'
            },
            {
              title: 'Çözülen Arızalar',
              value: istatistikler.cozulenArizalar,
              change: '+8%',
              changeType: 'positive',
              icon: CheckCircle,
              color: 'green'
            },
            {
              title: 'Başarı Oranı',
              value: `${istatistikler.performansSkoru}%`,
              change: '+5%',
              changeType: 'positive',
              icon: Target,
              color: 'blue'
            },
            {
              title: 'Toplam Arıza',
              value: istatistikler.toplamAriza,
              change: '+3%',
              changeType: 'neutral',
              icon: BarChart2,
              color: 'gray'
            }
          ].map((kpi, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    kpi.color === 'red' ? 'bg-red-100' :
                    kpi.color === 'green' ? 'bg-green-100' :
                    kpi.color === 'blue' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <kpi.icon className={`w-5 h-5 ${
                      kpi.color === 'red' ? 'text-red-600' :
                      kpi.color === 'green' ? 'text-green-600' :
                      kpi.color === 'blue' ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">{kpi.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                  </div>
                </div>
                <div className={`text-sm font-medium ${
                  kpi.changeType === 'positive' ? 'text-green-600' :
                  kpi.changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {kpi.change}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Hızlı Erişim</h2>
            <button className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Tümünü Görüntüle
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: AlertTriangle, title: 'Arızalar', route: '/arizalar', count: istatistikler.acikArizalar },
              { icon: Sun, title: 'Üretim', route: '/uretim-verileri', count: 0 },
              { icon: Zap, title: 'Elektrik Bakım', route: '/elektrik-bakim', count: 0 },
              { icon: Wrench, title: 'Mekanik Bakım', route: '/mekanik-bakim', count: 0 },
              { icon: Package, title: 'Stok', route: '/stok-kontrol', count: 0 },
              { icon: BarChart2, title: 'Raporlar', route: '/istatistikler', count: 0 }
            ].map((item, index) => (
              <button
                key={index}
                onClick={() => navigate(item.route)}
                className="group p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-left"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                    <item.icon className="w-4 h-4 text-gray-600" />
                  </div>
                  {item.count > 0 && (
                    <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {item.count}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 group-hover:text-gray-700 transition-colors">
                  {item.title}
                </p>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all mt-2" />
              </button>
            ))}
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Arıza Trendi */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Arıza Trendi</h3>
                <p className="text-sm text-gray-600">Son 7 günün arıza durumu</p>
              </div>
              <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                <Maximize2 className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="h-64">
              <TremorBarChart
                data={istatistikler.haftalikArizalar}
                index="date"
                categories={["arizaSayisi"]}
                colors={["gray"]}
                valueFormatter={(value) => `${value} arıza`}
                showAnimation={true}
                showLegend={false}
                showGridLines={false}
                className="h-full"
              />
            </div>
          </div>

          {/* Arıza Dağılımı */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Durum Dağılımı</h3>
                <p className="text-sm text-gray-600">Arıza durumlarının oranı</p>
              </div>
              <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                <Filter className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="h-64">
              <DonutChart
                data={istatistikler.arizaDagilimi}
                category="sayi"
                index="durum"
                colors={["red", "yellow", "green"]}
                valueFormatter={(value) => `${value} arıza`}
                showAnimation={true}
                className="h-full"
              />
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-2xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Son Arıza Kayıtları</h3>
                <p className="text-sm text-gray-600">En güncel arıza durumları</p>
              </div>
              <div className="flex items-center space-x-3">
                {kullanici?.rol !== 'musteri' && (
                  <button
                    onClick={() => navigate('/arizalar')}
                    className="inline-flex items-center px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Yeni Arıza
                  </button>
                )}
                <button
                  onClick={() => navigate('/arizalar')}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Tümünü Görüntüle
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {arizalar.length === 0 ? (
              <div className="p-12 text-center">
                <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">Henüz arıza kaydı bulunmuyor</h4>
                <p className="text-gray-600">Sistem şu anda herhangi bir arıza kaydı içermiyor.</p>
              </div>
            ) : (
              arizalar.map((ariza) => (
                <div
                  key={ariza.id}
                  onClick={() => setSeciliAriza(ariza)}
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        ariza.durum === 'cozuldu' ? 'bg-green-100' :
                        ariza.durum === 'devam-ediyor' ? 'bg-yellow-100' : 'bg-red-100'
                      }`}>
                        {ariza.durum === 'cozuldu' && <CheckCircle className="w-5 h-5 text-green-600" />}
                        {ariza.durum === 'devam-ediyor' && <Clock className="w-5 h-5 text-yellow-600" />}
                        {ariza.durum === 'acik' && <AlertTriangle className="w-5 h-5 text-red-600" />}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-medium text-gray-900">{ariza.baslik}</h4>
                          <Badge
                            color={
                              ariza.durum === 'cozuldu' ? 'green' :
                              ariza.durum === 'devam-ediyor' ? 'yellow' : 'red'
                            }
                            size="sm"
                          >
                            {ariza.durum === 'cozuldu' ? 'Çözüldü' : 
                             ariza.durum === 'devam-ediyor' ? 'Devam Ediyor' : 'Açık'}
                          </Badge>
                        </div>

                        <div className="flex items-center space-x-6 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <Building className="w-4 h-4" />
                            <span>{sahalar[ariza.saha] || 'Bilinmeyen Saha'}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <User className="w-4 h-4" />
                            <span>{ariza.olusturanAd || 'Bilinmeyen Kullanıcı'}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span>{format(ariza.olusturmaTarihi.toDate(), 'dd MMM yyyy', { locale: tr })}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button className="p-2 hover:bg-white rounded-lg transition-colors">
                      <Eye className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

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