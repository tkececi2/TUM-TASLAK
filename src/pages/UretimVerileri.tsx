
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  TrendingUp, 
  Calendar, 
  Download, 
  RefreshCw,
  Sun,
  DollarSign,
  Leaf,
  BarChart3,
  Filter,
  Plus,
  Settings
} from 'lucide-react';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  where, 
  Timestamp,
  addDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface UretimVerisi {
  id: string;
  santralId: string;
  santralAdi: string;
  tarih: Timestamp;
  gunlukUretim: number;
  anlikGuc: number;
  performansOrani: number;
  gelir: number;
  dagitimBedeli: number;
  tasarrufEdilenCO2: number;
  hava: {
    sicaklik: number;
    nem: number;
    radyasyon: number;
  };
  companyId?: string;
}

interface Santral {
  id: string;
  ad: string;
  kapasite: number;
  kurulumTarihi: Timestamp;
  konum: string;
  companyId?: string;
}

const UretimVerileri: React.FC = () => {
  const { kullanici } = useAuth();
  const [uretimVerileri, setUretimVerileri] = useState<UretimVerisi[]>([]);
  const [santraller, setSantraller] = useState<Santral[]>([]);
  const [secilenSantral, setSecilenSantral] = useState<string>('');
  const [secilenTarihAraligi, setSecilenTarihAraligi] = useState('30gun');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [modalAcik, setModalAcik] = useState(false);

  // Yeni veri ekleme formu
  const [yeniVeri, setYeniVeri] = useState({
    santralId: '',
    gunlukUretim: '',
    anlikGuc: '',
    performansOrani: '',
    gelir: '',
    sicaklik: '',
    nem: '',
    radyasyon: ''
  });

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  useEffect(() => {
    santrallerGetir();
  }, [kullanici]);

  useEffect(() => {
    if (secilenSantral) {
      uretimVerileriniGetir();
    }
  }, [secilenSantral, secilenTarihAraligi]);

  const santrallerGetir = async () => {
    if (!kullanici?.companyId) return;

    try {
      let santralQuery;
      
      if (kullanici.rol === 'musteri' && kullanici.sahalar?.length > 0) {
        santralQuery = query(
          collection(db, 'santraller'),
          where('__name__', 'in', kullanici.sahalar.slice(0, 10))
        );
      } else {
        santralQuery = query(
          collection(db, 'santraller'),
          where('companyId', '==', kullanici.companyId),
          orderBy('ad', 'asc')
        );
      }

      const snapshot = await getDocs(santralQuery);
      const santralListesi = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Santral[];

      setSantraller(santralListesi);
      
      if (santralListesi.length > 0 && !secilenSantral) {
        setSecilenSantral(santralListesi[0].id);
      }
    } catch (error) {
      console.error('Santraller getirilemedi:', error);
      toast.error('Santraller yüklenirken bir hata oluştu');
    }
  };

  const uretimVerileriniGetir = async () => {
    if (!secilenSantral) return;

    try {
      setYukleniyor(true);

      let baslangicTarihi: Date;
      const bugun = new Date();

      switch (secilenTarihAraligi) {
        case '7gun':
          baslangicTarihi = subDays(bugun, 7);
          break;
        case '30gun':
          baslangicTarihi = subDays(bugun, 30);
          break;
        case 'buay':
          baslangicTarihi = startOfMonth(bugun);
          break;
        case '90gun':
          baslangicTarihi = subDays(bugun, 90);
          break;
        default:
          baslangicTarihi = subDays(bugun, 30);
      }

      const baslangicTimestamp = Timestamp.fromDate(baslangicTarihi);
      const bitisTimestamp = Timestamp.fromDate(bugun);

      const uretimQuery = query(
        collection(db, 'uretimVerileri'),
        where('santralId', '==', secilenSantral),
        where('tarih', '>=', baslangicTimestamp),
        where('tarih', '<=', bitisTimestamp),
        orderBy('tarih', 'desc')
      );

      const snapshot = await getDocs(uretimQuery);
      const veriler = snapshot.docs.map(doc => {
        const data = doc.data();
        const santral = santraller.find(s => s.id === data.santralId);
        return {
          id: doc.id,
          santralAdi: santral?.ad || 'Bilinmeyen Santral',
          ...data
        };
      }) as UretimVerisi[];

      setUretimVerileri(veriler);
    } catch (error) {
      console.error('Üretim verileri getirilemedi:', error);
      toast.error('Üretim verileri yüklenirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  const yeniVeriEkle = async () => {
    if (!secilenSantral || !yeniVeri.gunlukUretim) {
      toast.error('Lütfen gerekli alanları doldurunuz');
      return;
    }

    try {
      const yeniVeriObj = {
        santralId: secilenSantral,
        tarih: Timestamp.fromDate(new Date()),
        gunlukUretim: parseFloat(yeniVeri.gunlukUretim),
        anlikGuc: parseFloat(yeniVeri.anlikGuc) || 0,
        performansOrani: parseFloat(yeniVeri.performansOrani) || 85,
        gelir: parseFloat(yeniVeri.gelir) || 0,
        dagitimBedeli: parseFloat(yeniVeri.gelir || '0') * 0.15,
        tasarrufEdilenCO2: parseFloat(yeniVeri.gunlukUretim) * 0.4,
        hava: {
          sicaklik: parseFloat(yeniVeri.sicaklik) || 25,
          nem: parseFloat(yeniVeri.nem) || 60,
          radyasyon: parseFloat(yeniVeri.radyasyon) || 800
        },
        companyId: kullanici?.companyId,
        olusturanKisi: {
          id: kullanici?.uid,
          ad: kullanici?.ad || kullanici?.email
        },
        olusturmaTarihi: Timestamp.fromDate(new Date())
      };

      await addDoc(collection(db, 'uretimVerileri'), yeniVeriObj);
      
      toast.success('Üretim verisi başarıyla eklendi');
      setModalAcik(false);
      setYeniVeri({
        santralId: '',
        gunlukUretim: '',
        anlikGuc: '',
        performansOrani: '',
        gelir: '',
        sicaklik: '',
        nem: '',
        radyasyon: ''
      });
      
      await uretimVerileriniGetir();
    } catch (error) {
      console.error('Veri ekleme hatası:', error);
      toast.error('Veri eklenirken bir hata oluştu');
    }
  };

  const handleYenile = async () => {
    setYenileniyor(true);
    await uretimVerileriniGetir();
    setYenileniyor(false);
    toast.success('Veriler yenilendi');
  };

  const excelIndir = () => {
    // Excel indirme fonksiyonu burada implementasyonu olacak
    toast.success('Excel dosyası indiriliyor...');
  };

  // İstatistikleri hesapla
  const toplamUretim = uretimVerileri.reduce((acc, veri) => acc + veri.gunlukUretim, 0);
  const ortalamaUretim = uretimVerileri.length > 0 ? toplamUretim / uretimVerileri.length : 0;
  const toplamGelir = uretimVerileri.reduce((acc, veri) => acc + veri.gelir, 0);
  const toplamCO2Tasarrufu = uretimVerileri.reduce((acc, veri) => acc + veri.tasarrufEdilenCO2, 0);
  const ortalemaPerformans = uretimVerileri.length > 0 
    ? uretimVerileri.reduce((acc, veri) => acc + veri.performansOrani, 0) / uretimVerileri.length 
    : 0;

  // Grafik verileri hazırla
  const gunlukUretimVerileri = uretimVerileri
    .slice(0, 30)
    .reverse()
    .map(veri => ({
      tarih: format(veri.tarih.toDate(), 'dd MMM', { locale: tr }),
      uretim: veri.gunlukUretim,
      performans: veri.performansOrani,
      gelir: veri.gelir
    }));

  const performansVerileri = uretimVerileri
    .slice(0, 7)
    .map(veri => ({
      gun: format(veri.tarih.toDate(), 'EEE', { locale: tr }),
      performans: veri.performansOrani,
      hedef: 90
    }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Zap className="h-8 w-8 text-blue-600" />
                Üretim Verileri
              </h1>
              <p className="mt-2 text-gray-600">Solar panel sistemlerinin üretim performansını takip edin</p>
            </div>
            
            <div className="mt-4 sm:mt-0 flex items-center space-x-3">
              <button
                onClick={handleYenile}
                disabled={yenileniyor}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${yenileniyor ? 'animate-spin' : ''}`} />
                Yenile
              </button>
              
              <button
                onClick={excelIndir}
                className="inline-flex items-center px-3 py-2 border border-green-300 shadow-sm text-sm leading-4 font-medium rounded-lg text-green-700 bg-green-50 hover:bg-green-100"
              >
                <Download className="h-4 w-4 mr-2" />
                Excel İndir
              </button>
              
              <button
                onClick={() => setModalAcik(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Veri Ekle
              </button>
            </div>
          </motion.div>
        </div>

        {/* Filtreler */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Santral Seçiniz
              </label>
              <select
                value={secilenSantral}
                onChange={(e) => setSecilenSantral(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Santral seçiniz...</option>
                {santraller.map(santral => (
                  <option key={santral.id} value={santral.id}>
                    {santral.ad} ({santral.kapasite} kW)
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tarih Aralığı
              </label>
              <select
                value={secilenTarihAraligi}
                onChange={(e) => setSecilenTarihAraligi(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="7gun">Son 7 Gün</option>
                <option value="30gun">Son 30 Gün</option>
                <option value="buay">Bu Ay</option>
                <option value="90gun">Son 90 Gün</option>
              </select>
            </div>
          </div>
        </motion.div>

        {yukleniyor ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            {/* İstatistik Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Zap className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Toplam Üretim</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {toplamUretim.toLocaleString('tr-TR')} kWh
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Ortalama Performans</p>
                    <p className="text-2xl font-bold text-gray-900">
                      %{ortalemaPerformans.toFixed(1)}
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <DollarSign className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Toplam Gelir</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ₺{toplamGelir.toLocaleString('tr-TR')}
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
              >
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Leaf className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">CO₂ Tasarrufu</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {toplamCO2Tasarrufu.toFixed(1)} kg
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Grafikler */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Günlük Üretim Grafiği */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Günlük Üretim Trendi</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={gunlukUretimVerileri}>
                    <defs>
                      <linearGradient id="colorUretim" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="tarih" 
                      stroke="#6b7280"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="#6b7280"
                      fontSize={12}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="uretim" 
                      stroke="#3b82f6" 
                      fillOpacity={1} 
                      fill="url(#colorUretim)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Performans Grafiği */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Haftalık Performans</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performansVerileri}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="gun" 
                      stroke="#6b7280"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="#6b7280"
                      fontSize={12}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="performans" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="hedef" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            {/* Veri Tablosu */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Detaylı Üretim Verileri</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tarih
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Günlük Üretim
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Anlık Güç
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Performans
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gelir
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hava Durumu
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {uretimVerileri.slice(0, 20).map((veri) => (
                      <tr key={veri.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {format(veri.tarih.toDate(), 'dd MMM yyyy', { locale: tr })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {veri.gunlukUretim.toLocaleString('tr-TR')} kWh
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {veri.anlikGuc.toFixed(1)} kW
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            veri.performansOrani >= 90 
                              ? 'bg-green-100 text-green-800' 
                              : veri.performansOrani >= 70 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            %{veri.performansOrani.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₺{veri.gelir.toLocaleString('tr-TR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {veri.hava.sicaklik}°C, %{veri.hava.nem} nem
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {uretimVerileri.length === 0 && !yukleniyor && (
                <div className="text-center py-12">
                  <Sun className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz veri bulunmuyor</h3>
                  <p className="text-gray-500 mb-4">Seçilen santral ve tarih aralığında üretim verisi bulunamadı.</p>
                  <button
                    onClick={() => setModalAcik(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    İlk Veriyi Ekle
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>

      {/* Veri Ekleme Modal */}
      {modalAcik && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Yeni Üretim Verisi Ekle</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Günlük Üretim (kWh) *
                </label>
                <input
                  type="number"
                  value={yeniVeri.gunlukUretim}
                  onChange={(e) => setYeniVeri({...yeniVeri, gunlukUretim: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Örn: 1250"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anlık Güç (kW)
                </label>
                <input
                  type="number"
                  value={yeniVeri.anlikGuc}
                  onChange={(e) => setYeniVeri({...yeniVeri, anlikGuc: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Örn: 450"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Performans (%)
                  </label>
                  <input
                    type="number"
                    value={yeniVeri.performansOrani}
                    onChange={(e) => setYeniVeri({...yeniVeri, performansOrani: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="85"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gelir (₺)
                  </label>
                  <input
                    type="number"
                    value={yeniVeri.gelir}
                    onChange={(e) => setYeniVeri({...yeniVeri, gelir: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="320"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sıcaklık (°C)
                  </label>
                  <input
                    type="number"
                    value={yeniVeri.sicaklik}
                    onChange={(e) => setYeniVeri({...yeniVeri, sicaklik: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="25"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nem (%)
                  </label>
                  <input
                    type="number"
                    value={yeniVeri.nem}
                    onChange={(e) => setYeniVeri({...yeniVeri, nem: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="60"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Radyasyon
                  </label>
                  <input
                    type="number"
                    value={yeniVeri.radyasyon}
                    onChange={(e) => setYeniVeri({...yeniVeri, radyasyon: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="800"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setModalAcik(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                İptal
              </button>
              <button
                onClick={yeniVeriEkle}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Ekle
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default UretimVerileri;
export { UretimVerileri };
