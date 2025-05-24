
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, getDocs, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  FileBarChart,
  AlertTriangle,
  Package,
  Building,
  Wrench,
  Zap,
  Clock,
  FileText,
  Calendar,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { Card, Text, Title, Grid, Metric, ProgressBar } from '@tremor/react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export const RaporYonetimi: React.FC = () => {
  const { kullanici } = useAuth();
  const [sahalar, setSahalar] = useState<Array<{id: string, ad: string}>>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [istatistikler, setIstatistikler] = useState({
    arizalar: 0,
    stoklar: 0,
    santraller: 0,
    isRaporlari: 0,
    kesintiler: 0,
    invertorKontroller: 0,
    mekanikBakimlar: 0,
    elektrikBakimlar: 0,
    uretimVerileri: 0
  });
  const navigate = useNavigate();

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

    const istatistikleriGetir = async () => {
      if (!kullanici) return;
      
      setYukleniyor(true);
      
      try {
        // Arıza sayısı
        const arizaQuery = query(
          collection(db, 'arizalar'),
          where('companyId', '==', kullanici.companyId),
          limit(1)
        );
        const arizaSnapshot = await getDocs(arizaQuery);
        
        // Stok sayısı
        const stokQuery = query(
          collection(db, 'stoklar'),
          where('companyId', '==', kullanici.companyId),
          limit(1)
        );
        const stokSnapshot = await getDocs(stokQuery);
        
        // Santral sayısı
        const santralQuery = query(
          collection(db, 'santraller'),
          where('companyId', '==', kullanici.companyId),
          limit(1)
        );
        const santralSnapshot = await getDocs(santralQuery);
        
        // İş raporu sayısı
        const isRaporuQuery = query(
          collection(db, 'isRaporlari'),
          where('companyId', '==', kullanici.companyId),
          limit(1)
        );
        const isRaporuSnapshot = await getDocs(isRaporuQuery);
        
        // Kesinti sayısı
        const kesintiQuery = query(
          collection(db, 'elektrikKesintileri'),
          where('companyId', '==', kullanici.companyId),
          limit(1)
        );
        const kesintiSnapshot = await getDocs(kesintiQuery);
        
        // İnvertör kontrol sayısı
        const invertorQuery = query(
          collection(db, 'invertorKontroller'),
          where('companyId', '==', kullanici.companyId),
          limit(1)
        );
        const invertorSnapshot = await getDocs(invertorQuery);
        
        // Mekanik bakım sayısı
        const mekanikQuery = query(
          collection(db, 'mekanikBakimlar'),
          where('companyId', '==', kullanici.companyId),
          limit(1)
        );
        const mekanikSnapshot = await getDocs(mekanikQuery);
        
        // Elektrik bakım sayısı
        const elektrikQuery = query(
          collection(db, 'elektrikBakimlar'),
          where('companyId', '==', kullanici.companyId),
          limit(1)
        );
        const elektrikSnapshot = await getDocs(elektrikQuery);
        
        // Üretim verisi sayısı
        const uretimQuery = query(
          collection(db, 'uretimVerileri'),
          where('companyId', '==', kullanici.companyId),
          limit(1)
        );
        const uretimSnapshot = await getDocs(uretimQuery);
        
        setIstatistikler({
          arizalar: arizaSnapshot.size,
          stoklar: stokSnapshot.size,
          santraller: santralSnapshot.size,
          isRaporlari: isRaporuSnapshot.size,
          kesintiler: kesintiSnapshot.size,
          invertorKontroller: invertorSnapshot.size,
          mekanikBakimlar: mekanikSnapshot.size,
          elektrikBakimlar: elektrikSnapshot.size,
          uretimVerileri: uretimSnapshot.size
        });
        
      } catch (error) {
        console.error('İstatistikler getirilemedi:', error);
        toast.error('Veriler yüklenirken bir hata oluştu');
      } finally {
        setYukleniyor(false);
      }
    };

    sahalariGetir();
    istatistikleriGetir();
  }, [kullanici]);

  const navigateToReport = (reportType: string) => {
    navigate(`/rapor/${reportType}`);
  };

  const raporOgeleri = [
    {
      id: 'ariza',
      title: 'Arıza Raporu',
      description: 'Aylık arıza durumu, çözüm süreleri ve öncelik dağılımları',
      icon: <AlertTriangle className="h-10 w-10 text-red-500" />,
      color: 'red',
      navigate: () => navigateToReport('ariza')
    },
    {
      id: 'stok',
      title: 'Stok Raporu',
      description: 'Stok seviyesi, kritik malzemeler ve stok hareketleri',
      icon: <Package className="h-10 w-10 text-indigo-500" />,
      color: 'indigo',
      navigate: () => navigateToReport('stok')
    },
    {
      id: 'santral',
      title: 'Santral Yönetimi',
      description: 'Santral performansı ve genel durum değerlendirmesi',
      icon: <Building className="h-10 w-10 text-sky-500" />,
      color: 'sky',
      navigate: () => navigateToReport('santral')
    },
    {
      id: 'uretim',
      title: 'Üretim Raporu',
      description: 'Günlük, aylık üretim verileri ve karşılaştırmalı analizler',
      icon: <FileBarChart className="h-10 w-10 text-amber-500" />,
      color: 'amber',
      navigate: () => navigateToReport('uretim')
    },
    {
      id: 'isler',
      title: 'Yapılan İşler',
      description: 'Tamamlanan işler, iş süreleri ve personel performansı',
      icon: <FileText className="h-10 w-10 text-emerald-500" />,
      color: 'emerald',
      navigate: () => navigateToReport('isler')
    },
    {
      id: 'kesinti',
      title: 'Elektrik Kesintileri',
      description: 'Elektrik kesinti süreleri ve etki analizleri',
      icon: <Clock className="h-10 w-10 text-orange-500" />,
      color: 'orange',
      navigate: () => navigateToReport('kesinti')
    },
    {
      id: 'invertor',
      title: 'İnvertör Kontrolleri',
      description: 'İnvertör performansı ve çalışma durumu analizi',
      icon: <Zap className="h-10 w-10 text-violet-500" />,
      color: 'violet',
      navigate: () => navigateToReport('invertor')
    },
    {
      id: 'mekanik',
      title: 'Mekanik Bakımlar',
      description: 'Mekanik bakım durumu ve sorun analizleri',
      icon: <Wrench className="h-10 w-10 text-cyan-500" />,
      color: 'cyan',
      navigate: () => navigateToReport('mekanik')
    },
    {
      id: 'elektrik',
      title: 'Elektrik Bakımları',
      description: 'Elektrik bakım durumu ve tespit edilen sorunlar',
      icon: <Zap className="h-10 w-10 text-blue-500" />,
      color: 'blue',
      navigate: () => navigateToReport('elektrik')
    },
    {
      id: 'kapsamli',
      title: 'Kapsamlı Rapor',
      description: 'Tüm verileri içeren aylık kapsamlı rapor',
      icon: <Calendar className="h-10 w-10 text-gray-500" />,
      color: 'gray',
      navigate: () => navigateToReport('kapsamli')
    }
  ];

  if (yukleniyor) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapor Yönetimi</h1>
          <p className="mt-1 text-sm text-gray-500">
            Santral ve bakım verilerinizi analiz edin ve çeşitli raporları görüntüleyin
          </p>
        </div>
        <button
          onClick={() => navigate('/rapor/ayarlar')}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <Settings className="h-4 w-4 mr-2" />
          Rapor Ayarları
        </button>
      </div>

      <Grid numItemsMd={2} numItemsLg={3} className="gap-6">
        {raporOgeleri.map((rapor) => (
          <Card key={rapor.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={rapor.navigate}>
            <div className="flex items-start space-x-4">
              <div className={`p-3 rounded-full bg-${rapor.color}-100`}>
                {rapor.icon}
              </div>
              <div className="flex-1">
                <Title className="text-lg font-medium">{rapor.title}</Title>
                <Text className="mt-1 text-sm text-gray-500">{rapor.description}</Text>
              </div>
              <ChevronRight className="h-6 w-6 text-gray-400" />
            </div>
          </Card>
        ))}
      </Grid>

      <div className="mt-8">
        <Card>
          <Title>Rapor Verileri</Title>
          <Text className="mt-2 mb-4 text-gray-500">
            Rapor oluşturulması için kullanılabilecek veriler
          </Text>

          <Grid numItemsMd={2} numItemsLg={4} className="gap-4 mt-6">
            <Card decoration="top" decorationColor="red">
              <Text className="text-sm font-medium">Arıza Kayıtları</Text>
              <Metric className="mt-1">{istatistikler.arizalar > 0 ? 'Mevcut' : 'Yok'}</Metric>
              <ProgressBar className="mt-2" value={istatistikler.arizalar > 0 ? 100 : 0} color="red" />
            </Card>
            
            <Card decoration="top" decorationColor="indigo">
              <Text className="text-sm font-medium">Stok Kayıtları</Text>
              <Metric className="mt-1">{istatistikler.stoklar > 0 ? 'Mevcut' : 'Yok'}</Metric>
              <ProgressBar className="mt-2" value={istatistikler.stoklar > 0 ? 100 : 0} color="indigo" />
            </Card>
            
            <Card decoration="top" decorationColor="amber">
              <Text className="text-sm font-medium">Üretim Verileri</Text>
              <Metric className="mt-1">{istatistikler.uretimVerileri > 0 ? 'Mevcut' : 'Yok'}</Metric>
              <ProgressBar className="mt-2" value={istatistikler.uretimVerileri > 0 ? 100 : 0} color="amber" />
            </Card>
            
            <Card decoration="top" decorationColor="emerald">
              <Text className="text-sm font-medium">İş Raporları</Text>
              <Metric className="mt-1">{istatistikler.isRaporlari > 0 ? 'Mevcut' : 'Yok'}</Metric>
              <ProgressBar className="mt-2" value={istatistikler.isRaporlari > 0 ? 100 : 0} color="emerald" />
            </Card>
          </Grid>

          <div className="mt-4 border-t border-gray-200 pt-4">
            <Text className="text-sm text-gray-500">
              Son güncelleme: {format(new Date(), 'dd MMMM yyyy HH:mm', { locale: tr })}
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RaporYonetimi;
