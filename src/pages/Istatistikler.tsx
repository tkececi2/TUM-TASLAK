
import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  Building, 
  TrendingUp, 
  BarChart3,
  Target,
  Activity,
  RefreshCw,
  Filter,
  Eye,
  Users,
  Award,
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { Card, Title, Text, Metric, Flex, ProgressBar, Grid, Col, Badge, AreaChart, DonutChart, BarChart } from '@tremor/react';
import type { Ariza } from '../types';
import toast from 'react-hot-toast';

export const Istatistikler: React.FC = () => {
  const { kullanici } = useAuth();
  const [arizalar, setArizalar] = useState<Ariza[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenSaha, setSecilenSaha] = useState<string>('');
  const [sahalar, setSahalar] = useState<Record<string, string>>({});
  const [yenileniyor, setYenileniyor] = useState(false);

  const veriYenile = async () => {
    setYenileniyor(true);
    try {
      await veriGetir();
      toast.success('Veriler başarıyla güncellendi');
    } catch (error) {
      toast.error('Veriler güncellenirken bir hata oluştu');
    } finally {
      setYenileniyor(false);
    }
  };

  const veriGetir = async () => {
    if (!kullanici) return;

    try {
      // Sahaları getir
      let sahaQuery;
      if (kullanici.rol === 'musteri' && kullanici.sahalar) {
        sahaQuery = query(
          collection(db, 'sahalar'),
          where('__name__', 'in', kullanici.sahalar),
          where('companyId', '==', kullanici.companyId)
        );
      } else if (kullanici.rol === 'superadmin') {
        sahaQuery = query(collection(db, 'sahalar'));
      } else {
        sahaQuery = query(
          collection(db, 'sahalar'),
          where('companyId', '==', kullanici.companyId)
        );
      }
      
      const sahaSnapshot = await getDocs(sahaQuery);
      const sahaMap: Record<string, string> = {};
      const sahaIdList: string[] = [];
      
      sahaSnapshot.docs.forEach(doc => {
        sahaMap[doc.id] = doc.data().ad;
        sahaIdList.push(doc.id);
      });
      setSahalar(sahaMap);

      // Arızaları getir
      let arizaQuery;
      const companyFilter = kullanici.rol !== 'superadmin' 
        ? where('companyId', '==', kullanici.companyId) 
        : null;
          
      if (kullanici.rol !== 'superadmin' && !kullanici.companyId) {
        console.error("Kullanıcının şirket ID'si yok, veri getirilemez");
        setArizalar([]);
        setYukleniyor(false);
        return;
      }
      
      if (kullanici.rol === 'musteri' && kullanici.sahalar) {
        if (secilenSaha) {
          if (!kullanici.sahalar.includes(secilenSaha)) {
            setArizalar([]);
            return;
          }
          
          const filters = [where('saha', '==', secilenSaha)];
          if (companyFilter) filters.push(companyFilter);
          
          arizaQuery = query(
            collection(db, 'arizalar'),
            ...filters,
            orderBy('olusturmaTarihi', 'desc')
          );
        } else {
          const filters = [where('saha', 'in', kullanici.sahalar)];
          if (companyFilter) filters.push(companyFilter);
          
          arizaQuery = query(
            collection(db, 'arizalar'),
            ...filters,
            orderBy('olusturmaTarihi', 'desc')
          );
        }
      } else if (secilenSaha) {
        const filters = [where('saha', '==', secilenSaha)];
        if (companyFilter) filters.push(companyFilter);
        
        arizaQuery = query(
          collection(db, 'arizalar'),
          ...filters,
          orderBy('olusturmaTarihi', 'desc')
        );
      } else if (sahaIdList.length > 0) {
        const filters = [];
        if (kullanici.rol !== 'superadmin' && sahaIdList.length <= 10) {
          filters.push(where('saha', 'in', sahaIdList));
        }
        
        if (companyFilter) filters.push(companyFilter);
        
        arizaQuery = query(
          collection(db, 'arizalar'),
          ...filters,
          orderBy('olusturmaTarihi', 'desc')
        );
      } else {
        const filters = [];
        if (companyFilter) filters.push(companyFilter);
        
        arizaQuery = query(
          collection(db, 'arizalar'),
          ...filters,
          orderBy('olusturmaTarihi', 'desc')
        );
      }

      const snapshot = await getDocs(arizaQuery);
      const arizaVerileri = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ariza[];
      
      if (kullanici.rol !== 'superadmin') {
        const yabanciSirketVerileri = arizaVerileri.filter(ariza => 
          ariza.companyId !== kullanici.companyId
        );
        
        if (yabanciSirketVerileri.length > 0) {
          console.error("UYARI: Farklı şirketlere ait veriler tespit edildi:", 
            yabanciSirketVerileri.map(v => v.companyId));
          
          const filtrelenmisVeriler = arizaVerileri.filter(
            ariza => ariza.companyId === kullanici.companyId
          );
          
          setArizalar(filtrelenmisVeriler);
        } else {
          setArizalar(arizaVerileri);
        }
      } else {
        setArizalar(arizaVerileri);
      }
    } catch (error) {
      console.error('Veri getirme hatası:', error);
      toast.error('Veriler yüklenirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    veriGetir();
  }, [kullanici, secilenSaha]);

  if (yukleniyor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const acikArizalar = arizalar.filter(a => a.durum === 'acik').length;
  const devamEdenArizalar = arizalar.filter(a => a.durum === 'devam-ediyor').length;
  const bekleyenArizalar = arizalar.filter(a => a.durum === 'beklemede').length;
  const cozulenArizalar = arizalar.filter(a => a.durum === 'cozuldu').length;
  const toplamArizalar = arizalar.length;

  const basariOrani = toplamArizalar > 0 ? (cozulenArizalar / toplamArizalar) * 100 : 0;

  // Son 7 günün arızaları için grafik verisi
  const son7Gun = Array.from({ length: 7 }, (_, i) => {
    const tarih = new Date();
    tarih.setDate(tarih.getDate() - 6 + i);
    const gunStr = format(tarih, 'dd MMM', { locale: tr });
    const gunArizalar = arizalar.filter(a => {
      const arizaTarihi = a.olusturmaTarihi.toDate();
      return format(arizaTarihi, 'dd MMM', { locale: tr }) === gunStr;
    }).length;
    
    return {
      tarih: gunStr,
      arizaSayisi: gunArizalar
    };
  });

  // Durum dağılımı verisi
  const durumDagilimi = [
    { durum: 'Açık', sayi: acikArizalar, color: 'red' },
    { durum: 'Devam Eden', sayi: devamEdenArizalar, color: 'yellow' },
    { durum: 'Bekleyen', sayi: bekleyenArizalar, color: 'blue' },
    { durum: 'Çözülen', sayi: cozulenArizalar, color: 'green' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  İstatistikler ve Analiz
                </h1>
                <p className="text-gray-600 mt-1">
                  {kullanici?.rol === 'musteri' 
                    ? 'Sahalarınıza ait detaylı arıza istatistikleri'
                    : 'Genel sistem performansı ve arıza analizi'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4 mt-6 lg:mt-0">
              <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg">
                <Activity className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Aktif İzleme</span>
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
        {/* Filtre */}
        {Object.keys(sahalar).length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center space-x-4">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={secilenSaha}
                onChange={(e) => setSecilenSaha(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
              >
                <option value="">Tüm Sahalar</option>
                {Object.entries(sahalar).map(([id, ad]) => (
                  <option key={id} value={id}>{ad}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: 'Acil Arızalar',
              value: acikArizalar,
              change: '-12%',
              changeType: 'positive',
              icon: AlertTriangle,
              color: 'red'
            },
            {
              title: 'Devam Eden',
              value: devamEdenArizalar,
              change: '+5%',
              changeType: 'neutral',
              icon: Clock,
              color: 'yellow'
            },
            {
              title: 'Çözülen Arızalar',
              value: cozulenArizalar,
              change: '+8%',
              changeType: 'positive',
              icon: CheckCircle,
              color: 'green'
            },
            {
              title: 'Başarı Oranı',
              value: `%${basariOrani.toFixed(1)}`,
              change: '+5%',
              changeType: 'positive',
              icon: Target,
              color: 'blue'
            }
          ].map((kpi, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    kpi.color === 'red' ? 'bg-red-100' :
                    kpi.color === 'yellow' ? 'bg-yellow-100' :
                    kpi.color === 'green' ? 'bg-green-100' : 'bg-blue-100'
                  }`}>
                    <kpi.icon className={`w-5 h-5 ${
                      kpi.color === 'red' ? 'text-red-600' :
                      kpi.color === 'yellow' ? 'text-yellow-600' :
                      kpi.color === 'green' ? 'text-green-600' : 'text-blue-600'
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
                <Eye className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="h-64">
              <AreaChart
                data={son7Gun}
                index="tarih"
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
                data={durumDagilimi}
                category="sayi"
                index="durum"
                colors={["red", "yellow", "blue", "green"]}
                valueFormatter={(value) => `${value} arıza`}
                showAnimation={true}
                className="h-full"
              />
            </div>
          </div>
        </div>

        {/* Performans Kartları */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Genel Performans</h3>
              <Award className="w-5 h-5 text-blue-600" />
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Başarı Oranı</span>
                  <span className="font-semibold">%{basariOrani.toFixed(1)}</span>
                </div>
                <ProgressBar 
                  value={basariOrani} 
                  color={basariOrani >= 80 ? "green" : basariOrani >= 60 ? "yellow" : "red"} 
                  className="mt-2" 
                />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Aktif Arızalar</span>
                  <span className="font-semibold">{acikArizalar + devamEdenArizalar}</span>
                </div>
                <ProgressBar 
                  value={toplamArizalar > 0 ? ((acikArizalar + devamEdenArizalar) / toplamArizalar) * 100 : 0} 
                  color="red" 
                  className="mt-2" 
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Sistem Durumu</h3>
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600">Toplam Saha</span>
                <Badge color="gray" size="lg">{Object.keys(sahalar).length}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <span className="text-gray-600">Toplam Arıza</span>
                <Badge color="blue" size="lg">{toplamArizalar}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <span className="text-gray-600">Çözüm Oranı</span>
                <Badge color="green" size="lg">%{basariOrani.toFixed(0)}</Badge>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Hızlı Erişim</h3>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="text-gray-700">Acil Müdahale</span>
                </div>
                <Badge color="red">{acikArizalar}</Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  <span className="text-gray-700">Takip Gereken</span>
                </div>
                <Badge color="yellow">{devamEdenArizalar}</Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="text-gray-700">Başarılı Çözüm</span>
                </div>
                <Badge color="green">{cozulenArizalar}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Saha Bazlı İstatistikler */}
        {!secilenSaha && Object.keys(sahalar).length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Saha Bazlı Detaylı Analiz</h3>
              <Users className="w-5 h-5 text-gray-600" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(sahalar).map(([sahaId, sahaAdi]) => {
                const sahaArizalari = arizalar.filter(a => a.saha === sahaId);
                const acik = sahaArizalari.filter(a => a.durum === 'acik').length;
                const devamEden = sahaArizalari.filter(a => a.durum === 'devam-ediyor').length;
                const cozulen = sahaArizalari.filter(a => a.durum === 'cozuldu').length;
                const sahaBasariOrani = sahaArizalari.length > 0 ? (cozulen / sahaArizalari.length) * 100 : 0;

                return (
                  <div key={sahaId} className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center mb-4">
                      <div className="p-2 bg-blue-100 rounded-lg mr-3">
                        <Building className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{sahaAdi}</h3>
                        <p className="text-sm text-gray-500">Saha Performansı</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Başarı Oranı</span>
                        <Badge color={sahaBasariOrani >= 80 ? "green" : sahaBasariOrani >= 60 ? "yellow" : "red"}>
                          %{sahaBasariOrani.toFixed(0)}
                        </Badge>
                      </div>
                      
                      <ProgressBar 
                        value={sahaBasariOrani} 
                        color={sahaBasariOrani >= 80 ? "green" : sahaBasariOrani >= 60 ? "yellow" : "red"} 
                        className="mb-4" 
                      />
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="text-center p-2 bg-red-50 rounded-lg">
                          <div className="font-semibold text-red-600">{acik}</div>
                          <div className="text-gray-500">Acil</div>
                        </div>
                        <div className="text-center p-2 bg-yellow-50 rounded-lg">
                          <div className="font-semibold text-yellow-600">{devamEden}</div>
                          <div className="text-gray-500">Devam Eden</div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                        <span className="text-sm font-medium text-gray-700">Toplam Arıza</span>
                        <Badge color="gray" size="lg">{sahaArizalari.length}</Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
