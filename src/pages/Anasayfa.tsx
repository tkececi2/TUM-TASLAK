import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  Sun, 
  Zap, 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  Battery,
  BarChart3,
  Calendar,
  Clock,
  MapPin,
  Settings,
  Bell,
  ChevronRight,
  Wrench,
  Package,
  ThermometerSun,
  Wind
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

interface DashboardStats {
  totalArizalar: number;
  aktifArizalar: number;
  toplamUretim: number;
  verimlilik: number;
  toplamSantral: number;
  aktifEkip: number;
  kritikStok: number;
  bakimBekleyen: number;
}

interface RecentActivity {
  id: string;
  type: 'ariza' | 'bakim' | 'uretim';
  title: string;
  description: string;
  time: string;
  priority: 'low' | 'medium' | 'high';
}

const Anasayfa: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalArizalar: 0,
    aktifArizalar: 0,
    toplamUretim: 0,
    verimlilik: 95,
    toplamSantral: 0,
    aktifEkip: 0,
    kritikStok: 0,
    bakimBekleyen: 0
  });

  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Gerçek zamanlı saat
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real data states
  const [uretimVerileri, setUretimVerileri] = useState<any[]>([]);
  const [performansVerileri, setPerformansVerileri] = useState<any[]>([]);
  const [bakimVerileri, setBakimVerileri] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Kullanıcı doğrulaması
        if (!user) {
          console.log('Kullanıcı oturum açmamış');
          setLoading(false);
          return;
        }

        // Kullanıcı verilerini Firestore'dan al
        const userDocRef = doc(db, 'kullanicilar', user.uid);
        const userDocSnapshot = await getDoc(userDocRef);

        if (!userDocSnapshot.exists()) {
          console.error('Kullanıcı belgesi bulunamadı');
          return;
        }

        const userData = userDocSnapshot.data();
        const userRole = userData.rol;
        const userCompanyId = userData.companyId;

        console.log('Kullanıcı rolü:', userRole);
        console.log('Şirket ID:', userCompanyId);

        // SuperAdmin için tüm verileri, diğer kullanıcılar için şirket bazlı verileri getir
        let arizalarRef, santrallerRef, sahalarRef, ekiplerRef, uretimRef, mekanikBakimRef, elektrikBakimRef, stokRef;

        if (userRole === 'superadmin') {
          // SuperAdmin tüm verilere erişebilir
          arizalarRef = collection(db, 'arizalar');
          santrallerRef = collection(db, 'santraller');
          sahalarRef = collection(db, 'sahalar');
          ekiplerRef = collection(db, 'ekipler');
          uretimRef = collection(db, 'uretimVerileri');
          mekanikBakimRef = collection(db, 'mekanikBakimlar');
          elektrikBakimRef = collection(db, 'elektrikBakimlar');
          stokRef = collection(db, 'stokKontrol');
        } else {
          // Diğer kullanıcılar sadece kendi şirketlerinin verilerine erişebilir
          if (!userCompanyId) {
            console.error('Kullanıcının şirket ID\'si bulunamadı');
            return;
          }

          arizalarRef = query(
            collection(db, 'arizalar'), 
            where('companyId', '==', userCompanyId),
            orderBy('olusturmaTarihi', 'desc')
          );
          santrallerRef = query(collection(db, 'santraller'), where('companyId', '==', userCompanyId));
          sahalarRef = query(collection(db, 'sahalar'), where('companyId', '==', userCompanyId));
          ekiplerRef = query(collection(db, 'ekipler'), where('companyId', '==', userCompanyId));
          uretimRef = query(collection(db, 'uretimVerileri'), where('companyId', '==', userCompanyId));
          mekanikBakimRef = query(collection(db, 'mekanikBakimlar'), where('companyId', '==', userCompanyId));
          elektrikBakimRef = query(collection(db, 'elektrikBakimlar'), where('companyId', '==', userCompanyId));
          stokRef = query(collection(db, 'stokKontrol'), where('companyId', '==', userCompanyId));
        }

        // Veri çekme işlemlerini tek tek try-catch ile yapıyoruz
        let arizalarSnapshot, santrallerSnapshot, sahalarSnapshot, ekiplerSnapshot;
        let uretimSnapshot, mekanikBakimSnapshot, elektrikBakimSnapshot, stokSnapshot;

        try {
          arizalarSnapshot = await getDocs(arizalarRef);
          console.log('Toplam arıza sayısı:', arizalarSnapshot.size);
        } catch (error) {
          console.error('Arıza verileri getirme hatası:', error);
          arizalarSnapshot = { docs: [], size: 0 };
        }

        try {
          santrallerSnapshot = await getDocs(santrallerRef);
        } catch (error) {
          console.error('Santral verileri getirme hatası:', error);
          santrallerSnapshot = { docs: [], size: 0 };
        }

        try {
          sahalarSnapshot = await getDocs(sahalarRef);
        } catch (error) {
          console.error('Saha verileri getirme hatası:', error);
          sahalarSnapshot = { docs: [], size: 0 };
        }

        try {
          ekiplerSnapshot = await getDocs(ekiplerRef);
        } catch (error) {
          console.error('Ekip verileri getirme hatası:', error);
          ekiplerSnapshot = { docs: [], size: 0 };
        }

        try {
          uretimSnapshot = await getDocs(uretimRef);
        } catch (error) {
          console.error('Üretim verileri getirme hatası:', error);
          uretimSnapshot = { docs: [], size: 0 };
        }

        try {
          mekanikBakimSnapshot = await getDocs(mekanikBakimRef);
        } catch (error) {
          console.error('Mekanik bakım verileri getirme hatası:', error);
          mekanikBakimSnapshot = { docs: [], size: 0 };
        }

        try {
          elektrikBakimSnapshot = await getDocs(elektrikBakimRef);
        } catch (error) {
          console.error('Elektrik bakım verileri getirme hatası:', error);
          elektrikBakimSnapshot = { docs: [], size: 0 };
        }

        try {
          stokSnapshot = await getDocs(stokRef);
        } catch (error) {
          console.error('Stok verileri getirme hatası:', error);
          stokSnapshot = { docs: [], size: 0 };
        }

        // Aktif arızalar (açık, devam ediyor, beklemede)
        const aktifArizalar = arizalarSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.durum !== 'cozuldu';
        });
        
        console.log('Aktif arıza sayısı:', aktifArizalar.length);
        const kritikStoklar = stokSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.stokMiktari <= data.kritikSeviye;
        });

        // Toplam üretim hesapla
        let toplamUretim = 0;
        uretimSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.uretimMiktari && typeof data.uretimMiktari === 'number') {
            toplamUretim += data.uretimMiktari;
          }
        });

        // Bekleyen bakımları hesapla
        const toplamMekanikBakim = mekanikBakimSnapshot.size;
        const toplamElektrikBakim = elektrikBakimSnapshot.size;
        const bekleyenBakimlar = toplamMekanikBakim + toplamElektrikBakim;

        // Verimlilik hesapla (sahalar bazında)
        let toplamKapasite = 0;
        let aktifKapasite = 0;
        sahalarSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.kapasite) {
            const kapasiteNumber = parseFloat(data.kapasite.toString().replace(/[^0-9.]/g, ''));
            toplamKapasite += kapasiteNumber;
            // Aktif sahalar için (arızası olmayan)
            const sahaArizalari = arizalarSnapshot.docs.filter(arizaDoc => 
              arizaDoc.data().saha === doc.id && arizaDoc.data().durum !== 'cozuldu'
            );
            if (sahaArizalari.length === 0) {
              aktifKapasite += kapasiteNumber;
            }
          }
        });

        const verimlilik = toplamKapasite > 0 ? (aktifKapasite / toplamKapasite) * 100 : 0;

        setStats({
          totalArizalar: arizalarSnapshot.size,
          aktifArizalar: aktifArizalar.length,
          toplamUretim: Math.round(toplamUretim),
          verimlilik: Math.round(verimlilik * 10) / 10,
          toplamSantral: sahalarSnapshot.size,
          aktifEkip: ekiplerSnapshot.size,
          kritikStok: kritikStoklar.length,
          bakimBekleyen: bekleyenBakimlar
        });

        // Son aktiviteler - mevcut arıza listesinden al
        const sonArizalar = arizalarSnapshot.docs
          .slice(0, 5)
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              type: 'ariza' as const,
              title: data.baslik || 'Arıza Bildirimi',
              description: data.aciklama || 'Detay bilgi yok',
              time: data.olusturmaTarihi?.toDate?.()?.toLocaleTimeString('tr-TR') || 'Bilinmiyor',
              priority: (data.oncelik || 'medium') as 'low' | 'medium' | 'high'
            };
          });

        setRecentActivities(sonArizalar);

        // Günlük üretim verilerini hazırla (son 7 gün)
        const gunlukUretim = [];
        for (let i = 6; i >= 0; i--) {
          const tarih = new Date();
          tarih.setDate(tarih.getDate() - i);
          const tarihStr = tarih.toISOString().split('T')[0];
          
          const gunlukVeri = uretimSnapshot.docs.filter(doc => {
            const data = doc.data();
            if (data.tarih?.toDate) {
              const veriTarih = data.tarih.toDate().toISOString().split('T')[0];
              return veriTarih === tarihStr;
            }
            return false;
          });

          let gunlukToplam = 0;
          gunlukVeri.forEach(doc => {
            const data = doc.data();
            if (data.uretimMiktari) {
              gunlukToplam += data.uretimMiktari;
            }
          });

          gunlukUretim.push({
            saat: tarih.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
            uretim: Math.round(gunlukToplam),
            hedef: Math.round(gunlukToplam * 1.1) // %10 daha yüksek hedef
          });
        }

        setUretimVerileri(gunlukUretim);

        // Saha performans verilerini hazırla
        const sahaPerformans = sahalarSnapshot.docs.slice(0, 4).map((doc, index) => {
          const data = doc.data();
          const sahaArizalari = arizalarSnapshot.docs.filter(arizaDoc => 
            arizaDoc.data().saha === doc.id && arizaDoc.data().durum !== 'cozuldu'
          );
          
          // Performans hesapla (arıza sayısına göre)
          const performans = Math.max(70, 100 - (sahaArizalari.length * 5));
          
          const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];
          
          return {
            name: data.ad || `Saha ${index + 1}`,
            deger: performans,
            fill: colors[index]
          };
        });

        setPerformansVerileri(sahaPerformans);

        // Aylık bakım trendleri (son 5 ay)
        const aylikBakim = [];
        for (let i = 4; i >= 0; i--) {
          const tarih = new Date();
          tarih.setMonth(tarih.getMonth() - i);
          const ay = tarih.toLocaleDateString('tr-TR', { month: 'short' });
          
          const aylikMekanikBakim = mekanikBakimSnapshot.docs.filter(doc => {
            const data = doc.data();
            if (data.tarih?.toDate) {
              const bakimTarih = data.tarih.toDate();
              return bakimTarih.getMonth() === tarih.getMonth() && 
                     bakimTarih.getFullYear() === tarih.getFullYear();
            }
            return false;
          });

          const aylikElektrikBakim = elektrikBakimSnapshot.docs.filter(doc => {
            const data = doc.data();
            if (data.tarih?.toDate) {
              const bakimTarih = data.tarih.toDate();
              return bakimTarih.getMonth() === tarih.getMonth() && 
                     bakimTarih.getFullYear() === tarih.getFullYear();
            }
            return false;
          });

          const tamamlanan = aylikMekanikBakim.length + aylikElektrikBakim.length;
          const planlanan = Math.round(tamamlanan * 1.2); // %20 daha fazla planlanmış

          aylikBakim.push({
            ay,
            tamamlanan,
            planlanan
          });
        }

        setBakimVerileri(aylikBakim);

      } catch (error) {
        console.error('Dashboard verileri yüklenirken hata:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    hover: { y: -5, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }
  };

  const statsCards = [
    {
      title: 'Toplam Üretim',
      value: `${stats.toplamUretim.toLocaleString()} kWh`,
      change: '+12.5%',
      icon: <Sun className="h-6 w-6" />,
      color: 'from-yellow-400 to-orange-500',
      textColor: 'text-yellow-600'
    },
    {
      title: 'Sistem Verimliliği',
      value: `%${stats.verimlilik}`,
      change: '+2.1%',
      icon: <TrendingUp className="h-6 w-6" />,
      color: 'from-green-400 to-emerald-500',
      textColor: 'text-green-600'
    },
    {
      title: 'Aktif Arızalar',
      value: stats.aktifArizalar.toString(),
      change: '-15%',
      icon: <AlertTriangle className="h-6 w-6" />,
      color: 'from-red-400 to-pink-500',
      textColor: 'text-red-600'
    },
    {
      title: 'Aktif Santral',
      value: stats.toplamSantral.toString(),
      change: '+5',
      icon: <Battery className="h-6 w-6" />,
      color: 'from-blue-400 to-indigo-500',
      textColor: 'text-blue-600'
    }
  ];

  const quickActions = [
    { title: 'Yeni Arıza Bildir', icon: <AlertTriangle className="h-5 w-5" />, link: '/arizalar', color: 'bg-red-500' },
    { title: 'Bakım Planla', icon: <Wrench className="h-5 w-5" />, link: '/mekanik-bakim', color: 'bg-blue-500' },
    { title: 'Stok Kontrol', icon: <Package className="h-5 w-5" />, link: '/stok-kontrol', color: 'bg-purple-500' },
    { title: 'Performans', icon: <BarChart3 className="h-5 w-5" />, link: '/performans', color: 'bg-green-500' },
    { title: 'Ekip Yönetimi', icon: <Users className="h-5 w-5" />, link: '/ekip', color: 'bg-orange-500' },
    { title: 'Raporlar', icon: <Calendar className="h-5 w-5" />, link: '/raporlar', color: 'bg-indigo-500' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Sun className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Hoş Geldiniz, {user?.email?.split('@')[0]}!
                </h1>
                <p className="text-gray-600">
                  {currentTime.toLocaleDateString('tr-TR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })} • {currentTime.toLocaleTimeString('tr-TR')}
                </p>
              </div>
            </div>

            <div className="mt-4 lg:mt-0 flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-green-100 text-green-800 px-4 py-2 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Sistem Aktif</span>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Bell className="h-4 w-4" />
                <span>Bildirimler</span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      >
        {statsCards.map((card, index) => (
          <motion.div
            key={card.title}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover="hover"
            transition={{ delay: index * 0.1 }}
            className="relative overflow-hidden bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-5`}></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${card.color} text-white`}>
                  {card.icon}
                </div>
                <span className={`text-sm font-medium ${card.textColor} bg-opacity-20 px-2 py-1 rounded-full`}>
                  {card.change}
                </span>
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">{card.title}</h3>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Üretim Grafiği */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Günlük Üretim Performansı</h3>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-xs text-gray-600">Gerçek</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                <span className="text-xs text-gray-600">Hedef</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={uretimVerileri}>
              <defs>
                <linearGradient id="colorUretim" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="saat" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: 'none', 
                  borderRadius: '12px', 
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' 
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="uretim" 
                stroke="#3b82f6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorUretim)" 
              />
              <Line 
                type="monotone" 
                dataKey="hedef" 
                stroke="#e2e8f0" 
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Hızlı Aksiyonlar */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Hızlı Aksiyonlar</h3>
          <div className="space-y-3">
            {quickActions.map((action, index) => (
              <motion.div
                key={action.title}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link 
                  to={action.link}
                  className="flex items-center p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className={`${action.color} p-2 rounded-lg text-white mr-3`}>
                    {action.icon}
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 flex-1">
                    {action.title}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Performans Dağılımı */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Panel Performans Dağılımı</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={performansVerileri}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="deger"
              >
                {performansVerileri.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => [`%${value}`, 'Verimlilik']}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: 'none', 
                  borderRadius: '12px', 
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' 
                }} 
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {performansVerileri.map((item) => (
              <div key={item.name} className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }}></div>
                <span className="text-sm text-gray-600">{item.name}</span>
                <span className="text-sm font-medium">%{item.deger}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Bakım Trendleri */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Aylık Bakım Trendleri</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={bakimVerileri}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="ay" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: 'none', 
                  borderRadius: '12px', 
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' 
                }} 
              />
              <Bar dataKey="tamamlanan" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="planlanan" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Son Aktiviteler ve Sistem Durumu */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Son Aktiviteler */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Son Aktiviteler</h3>
            <Link to="/arizalar" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Tümünü Gör
            </Link>
          </div>
          <div className="space-y-4">
            {recentActivities.length > 0 ? recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-4 p-4 rounded-xl hover:bg-gray-50 transition-colors">
                <div className={`p-2 rounded-lg ${
                  activity.priority === 'high' ? 'bg-red-100 text-red-600' :
                  activity.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                  'bg-green-100 text-green-600'
                }`}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
                  <p className="text-sm text-gray-500 truncate">{activity.description}</p>
                </div>
                <span className="text-xs text-gray-400">{activity.time}</span>
              </div>
            )) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Henüz aktivite bulunmuyor</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Sistem Durumu */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h3 className="text-lg font-semibold text-gray-900">Sistem Durumu</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ThermometerSun className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-gray-600">Sıcaklık</span>
              </div>
              <span className="text-sm font-medium">32°C</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Wind className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-gray-600">Rüzgar Hızı</span>
              </div>
              <span className="text-sm font-medium">15 km/h</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sun className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-gray-600">Güneş Işığı</span>
              </div>
              <span className="text-sm font-medium">850 W/m²</span>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Sistem Sağlığı</span>
                <span className="text-sm font-medium text-green-600">%98</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '98%' }}></div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2"
            >
              <Settings className="h-4 w-4" />
              <span className="text-sm">Detaylı Analiz</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Anasayfa;
export { Anasayfa };