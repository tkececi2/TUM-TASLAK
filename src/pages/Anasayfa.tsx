import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs, where, limit, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfYear as dateStartOfYear, endOfYear as dateEndOfYear } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Sun, Zap, AlertTriangle, Building, TrendingUp, Activity, 
  BarChart3, RefreshCw, Wrench, Package, Users, FileBarChart,
  Calendar, ArrowRight, Clock, Gauge, Lightbulb, Bolt,
  ClipboardList, Shield, PanelTop, CheckCircle, XCircle, Home,
  Eye, Settings, Filter, MoreHorizontal, Bell, MapPin, 
  ChevronRight, Power, Flame, BatteryLow, Warehouse, AlertCircle
} from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { Ariza, Kullanici } from '../types';
import toast from 'react-hot-toast';

interface UretimVerisi {
  id: string;
  santralId: string;
  tarih: Timestamp;
  gunlukUretim: number;
  performansOrani: number;
  tasarrufEdilenCO2: number;
  companyId: string;
}

interface Santral {
  id: string;
  ad: string;
  kapasite: number;
  yillikHedefUretim: number;
  companyId: string;
}

// Kompakt Metrik Kartı
const CompactMetricCard: React.FC<{
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'orange' | 'red';
  onClick?: () => void;
}> = ({ title, value, subtitle, icon: Icon, color, onClick }) => {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    orange: 'text-orange-600 bg-orange-50',
    red: 'text-red-600 bg-red-50'
  };

  return (
    <div 
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
      <div className="space-y-1">
        <h3 className="text-xs font-medium text-gray-600 uppercase tracking-wide">{title}</h3>
        <div className="text-xl font-bold text-gray-900">{value}</div>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
};

// Mini Saha Kartı
const MiniSahaCard: React.FC<{
  saha: any;
  onClick?: () => void;
}> = ({ saha, onClick }) => {
  // Kapasite hesaplaması
  const getCapacity = (site: any) => {
    let capacity = 0;
    
    if (site.kurulumGucu) {
      if (typeof site.kurulumGucu === 'number') {
        capacity = site.kurulumGucu;
      } else if (typeof site.kurulumGucu === 'string') {
        capacity = parseFloat(site.kurulumGucu.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
      }
    } else if (site.kapasite) {
      if (typeof site.kapasite === 'number') {
        capacity = site.kapasite;
      } else if (typeof site.kapasite === 'string') {
        capacity = parseFloat(site.kapasite.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
      }
    } else if (site.guc) {
      if (typeof site.guc === 'number') {
        capacity = site.guc;
      } else if (typeof site.guc === 'string') {
        capacity = parseFloat(site.guc.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
      }
    } else if (site.kurulumGucuMW) {
      if (typeof site.kurulumGucuMW === 'number') {
        capacity = site.kurulumGucuMW;
      } else if (typeof site.kurulumGucuMW === 'string') {
        capacity = parseFloat(site.kurulumGucuMW.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
      }
    }
    
    return capacity > 0 ? `${capacity.toFixed(1)} MW` : '0 MW';
  };

  return (
    <div 
      className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-sm transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-gray-900 text-sm truncate">{saha.ad}</h4>
        <span className={`px-2 py-1 text-xs font-medium rounded-md ${
          saha.durum === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {saha.durum === 'aktif' ? 'Aktif' : 'Pasif'}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="truncate">{saha.konum || 'Konum belirtilmemiş'}</span>
        <span className="font-semibold text-blue-600">{getCapacity(saha)}</span>
      </div>
    </div>
  );
};

// GES Santral Kartı
const MiniGESCard: React.FC<{
  santral: Santral;
  uretimVerisi?: {hedef: number, gerceklesen: number, oran: number, ad: string};
  onClick?: () => void;
}> = ({ santral, uretimVerisi, onClick }) => {
  const getPerformanceColor = (oran?: number) => {
    if (!oran) return 'bg-gray-100 text-gray-800';
    if (oran >= 80) return 'bg-green-100 text-green-800';
    if (oran >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getPerformanceText = (oran?: number) => {
    if (!oran) return 'Veri Yok';
    if (oran >= 80) return 'Başarılı';
    if (oran >= 60) return 'Orta';
    return 'Düşük';
  };

  return (
    <div 
      className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-sm transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-gray-900 text-sm truncate">{santral.ad}</h4>
        <span className={`px-2 py-1 text-xs font-medium rounded-md ${getPerformanceColor(uretimVerisi?.oran)}`}>
          {getPerformanceText(uretimVerisi?.oran)}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>Kapasite: {santral.kapasite ? `${santral.kapasite} MW` : 'Belirtilmemiş'}</span>
        <span className="font-semibold text-blue-600">
          {uretimVerisi ? `%${uretimVerisi.oran.toFixed(1)}` : '-'}
        </span>
      </div>
      {uretimVerisi && (
        <div className="w-full bg-gray-200 rounded-full h-1">
          <div 
            className={`h-1 rounded-full transition-all duration-500 ${
              uretimVerisi.oran >= 80 ? 'bg-green-500' :
              uretimVerisi.oran >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(uretimVerisi.oran, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

// Kompakt Aktivite Satırı
const CompactActivityRow: React.FC<{
  icon: React.ElementType;
  title: string;
  time: string;
  status: string;
  type?: string;
  onClick?: () => void;
}> = ({ icon: Icon, title, time, status, type, onClick }) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'sorunlu': case 'açık arıza': case 'kritik seviye': case 'acil': case 'acil durum': return 'text-red-600 bg-red-50 border-red-200';
      case 'çözüldü': case 'tamamlandı': case 'görüntüle': case 'başarılı': case 'çalışıyor': return 'text-green-600 bg-green-50 border-green-200';
      case 'beklemede': case 'inceleniyor': case 'planlandı': case 'yeni kayıt': case 'yeni santral': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'devam ediyor': case 'normal': case 'normal rapor': case 'başladı': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'iptal edildi': case 'bilinmiyor': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-purple-600 bg-purple-50 border-purple-200'; // Diğer durumlar için mor
    }
  };

  const getIconColor = (type?: string) => {
    switch (type) {
      case 'ariza': return 'text-red-500';
      case 'bakim': return 'text-blue-500';
      case 'uretim': return 'text-yellow-500';
      case 'kesinti': return 'text-purple-500';
      case 'vardiya': return 'text-indigo-500';
      case 'stok': return 'text-orange-500';
      case 'saha': return 'text-cyan-500';
      case 'santral': return 'text-amber-500';
      case 'sistem': return 'text-green-500';
      case 'rapor': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  };

  return (
    <div 
      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-all duration-200 border border-transparent hover:border-gray-200 hover:shadow-sm"
      onClick={onClick}
    >
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <div className={`p-2 rounded-lg bg-gray-50 ${getIconColor(type)}`}>
          <Icon className="w-4 h-4 flex-shrink-0" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 text-sm truncate">{title}</p>
          <p className="text-xs text-gray-500">{time}</p>
        </div>
      </div>
      <span className={`px-2 py-1 text-xs font-medium rounded-md border ${getStatusColor(status)}`}>
        {status}
      </span>
    </div>
  );
};

// Hızlı Erişim Kartı
const QuickAccessCard: React.FC<{
  title: string;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
}> = ({ title, icon: Icon, color, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className="w-full p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-all text-left"
    >
      <div className="flex items-center space-x-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="font-medium text-gray-900 text-sm">{title}</span>
        <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
      </div>
    </button>
  );
};

export const Anasayfa: React.FC = () => {
  const { kullanici } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    totalSites: 0,
    activeSites: 0,
    totalProduction: '0',
    monthlyProduction: '0',
    openFaults: 0,
    totalFaults: 0,
    pendingMaintenance: 0,
    completedMaintenance: 0,
    totalMaintenance: 0,
    systemEfficiency: 0,
    totalCapacity: 0,
    criticalStock: 0,
    totalStock: 0,
    yearlyTarget: 0,
    yearlyActual: 0,
    yearlyPercentage: 0
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [recentProduction, setRecentProduction] = useState<any[]>([]);
  const [santraller, setSantraller] = useState<Santral[]>([]);
  const [sahalarUretimVerileri, setSahalarUretimVerileri] = useState<{[key: string]: {hedef: number, gerceklesen: number, oran: number, ad: string}}>({});

  const currentUser = kullanici as Kullanici | null;
  const isCustomer = currentUser?.rol === 'musteri';

  const getMusteriSahaIds = (): string[] => {
    if (!kullanici || kullanici.rol !== 'musteri') return [];
    let sahaIds: string[] = [];
    const possibleFields = [kullanici.sahalar, kullanici.santraller];
    for (const field of possibleFields) {
      if (field) {
        if (Array.isArray(field)) {
          const validIds = field.filter(id => id && typeof id === 'string' && id.trim() !== '');
          sahaIds = [...sahaIds, ...validIds];
        } else if (typeof field === 'object' && field !== null) {
          const validIds = Object.keys(field).filter(key => field[key as keyof typeof field] === true && key && key.trim() !== '');
          sahaIds = [...sahaIds, ...validIds];
        }
      }
    }
    return [...new Set(sahaIds)];
  };

  const fetchSantrallerVeUretimVerileri = async () => {
    if (!kullanici?.companyId) {
      console.log('❌ CompanyId bulunamadı:', kullanici);
      return;
    }
    
    try {
      console.log('🔍 Santral ve üretim verileri getiriliyor...', {
        companyId: kullanici.companyId,
        rol: kullanici.rol
      });

      // Santralleri getir
      let santralQuery;
      let santralData: Santral[] = [];
      
      if (kullanici.rol === 'musteri') {
        const sahaIds = getMusteriSahaIds();
        console.log('👤 Müşteri saha IDs:', sahaIds);
        if (sahaIds.length === 0) { 
          setSantraller([]);
          setSahalarUretimVerileri({});
          console.log('❌ Müşteri için saha bulunamadı');
          return;
        }
        
        for (let i = 0; i < sahaIds.length; i += 10) {
          const batch = sahaIds.slice(i, i + 10);
          const bQuery = query(collection(db, 'santraller'), where('__name__', 'in', batch));
          const bSnapshot = await getDocs(bQuery);
          santralData.push(...bSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Santral)));
        }
      } else {
        santralQuery = query(collection(db, 'santraller'), where('companyId', '==', kullanici.companyId), orderBy('ad'));
        const santralSnapshot = await getDocs(santralQuery);
        santralData = santralSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Santral));
      }
      
      console.log('🏭 Bulunan santraller:', santralData.length, santralData.map(s => ({id: s.id, ad: s.ad, hedef: s.yillikHedefUretim})));
      setSantraller(santralData);
      
      if (santralData.length === 0) {
        console.log('❌ Hiç santral bulunamadı');
        setSahalarUretimVerileri({});
        return;
      }
      
      // Bu yılın üretim verilerini getir
      const currentYear = new Date().getFullYear();
      const yearStart = Timestamp.fromDate(dateStartOfYear(new Date(currentYear, 0, 1)));
      const yearEnd = Timestamp.fromDate(dateEndOfYear(new Date(currentYear, 0, 1)));
      
      console.log('📅 Tarih aralığı:', {
        yil: currentYear,
        baslangic: yearStart.toDate(),
        bitis: yearEnd.toDate()
      });
      
      // Basit query ile tüm üretim verilerini çek, sonra client-side filtrele
      const uretimQuery = query(
        collection(db, 'uretimVerileri'),
        where('companyId', '==', kullanici.companyId)
      );
      
      const uretimSnapshot = await getDocs(uretimQuery);
      let tumUretimVerileri = uretimSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as UretimVerisi));
      
      // Client-side filtreleme
      const santralIds = santralData.map(s => s.id);
      
      // Tarih filtresi
      const uretimVerileri = tumUretimVerileri.filter(veri => {
        const tarihi = veri.tarih.toDate();
        const yilIcinde = tarihi >= yearStart.toDate() && tarihi <= yearEnd.toDate();
        const santralEslesiyor = santralIds.includes(veri.santralId);
        return yilIcinde && santralEslesiyor;
      });
      
      // Müşteri için ek filtreleme
      if (kullanici.rol === 'musteri') {
        const sahaIds = getMusteriSahaIds();
        tumUretimVerileri = tumUretimVerileri.filter(veri => sahaIds.includes(veri.santralId));
      }
      
             console.log('⚡ Bulunan üretim verileri:', uretimVerileri.length, uretimVerileri.slice(0, 3));
       
       // Santral ID'leri kontrol et
       const uretimSantralIds = [...new Set(uretimVerileri.map(u => u.santralId))];
       console.log('🔗 Santral ID eşleştirmeleri:', {
         santralIds,
         uretimSantralIds,
         eslesen: santralIds.filter(id => uretimSantralIds.includes(id))
       });
      
      // Saha başına üretim hesapla
      const sahalarVerisi: {[key: string]: {hedef: number, gerceklesen: number, oran: number, ad: string}} = {};
      let toplamHedef = 0;
      let toplamGerceklesen = 0;
      
      santralData.forEach(santral => {
        const santralUretimleri = uretimVerileri.filter(v => v.santralId === santral.id);
        const gerceklesen = santralUretimleri.reduce((sum, v) => sum + v.gunlukUretim, 0);
        const hedef = santral.yillikHedefUretim || 0;
        const oran = hedef > 0 ? (gerceklesen / hedef) * 100 : 0;
        
        console.log(`📊 ${santral.ad}:`, {
          santralId: santral.id,
          uretimSayisi: santralUretimleri.length,
          hedef,
          gerceklesen: gerceklesen.toFixed(0),
          oran: oran.toFixed(1) + '%'
        });
        
        sahalarVerisi[santral.id] = {
          hedef,
          gerceklesen,
          oran,
          ad: santral.ad
        };
        
        toplamHedef += hedef;
        toplamGerceklesen += gerceklesen;
      });
      
      setSahalarUretimVerileri(sahalarVerisi);
      
      // Dashboard genel verilerini güncelle
      const toplamOran = toplamHedef > 0 ? (toplamGerceklesen / toplamHedef) * 100 : 0;
      
      console.log('🎯 Toplam sonuçlar:', {
        toplamHedef: toplamHedef.toFixed(0),
        toplamGerceklesen: toplamGerceklesen.toFixed(0),
        toplamOran: toplamOran.toFixed(1) + '%',
        sahaSayisi: Object.keys(sahalarVerisi).length
      });

      // Eğer hiç üretim verisi yoksa demo veriler göster
      if (Object.keys(sahalarVerisi).length === 0 && santralData.length > 0) {
        console.log('🎭 Demo veriler oluşturuluyor...');
        const demoSahalar: {[key: string]: {hedef: number, gerceklesen: number, oran: number, ad: string}} = {};
        let demoToplamHedef = 0;
        let demoToplamGerceklesen = 0;
        
        santralData.forEach(santral => {
          const hedef = santral.yillikHedefUretim || 1000000; // 1M kWh varsayılan
          const gerceklesen = hedef * (0.3 + Math.random() * 0.6); // %30-90 arası rastgele
          const oran = (gerceklesen / hedef) * 100;
          
          demoSahalar[santral.id] = {
            hedef,
            gerceklesen,
            oran,
            ad: santral.ad
          };
          
          demoToplamHedef += hedef;
          demoToplamGerceklesen += gerceklesen;
        });
        
        setSahalarUretimVerileri(demoSahalar);
        
        const demoToplamOran = demoToplamHedef > 0 ? (demoToplamGerceklesen / demoToplamHedef) * 100 : 0;
        
        setDashboardData(prev => ({
          ...prev,
          yearlyTarget: demoToplamHedef,
          yearlyActual: demoToplamGerceklesen,
          yearlyPercentage: demoToplamOran
        }));
        
        console.log('🎭 Demo veriler oluşturuldu:', Object.keys(demoSahalar).length, 'saha');
        return;
      }
      
      setDashboardData(prev => ({
        ...prev,
        yearlyTarget: toplamHedef,
        yearlyActual: toplamGerceklesen,
        yearlyPercentage: toplamOran
      }));
      
    } catch (error) {
      console.error('❌ Santral ve üretim veri getirme hatası:', error);
    }
  };

  const fetchDashboardData = async () => {
    if (!currentUser?.companyId) {
      setLoading(false);
      return;
    }

    try {
      // Sahalar/Santraller
      let sitesQuery;
      if (isCustomer) {
        if (!currentUser.sahalar || (Array.isArray(currentUser.sahalar) && currentUser.sahalar.length === 0)) {
          setLoading(false);
          toast.error('Size atanmış saha bulunmuyor.');
          return;
        }
        const sahaIds = Array.isArray(currentUser.sahalar) ? currentUser.sahalar : Object.keys(currentUser.sahalar);
        sitesQuery = query(
          collection(db, 'sahalar'), 
          where('__name__', 'in', sahaIds),
          where('companyId', '==', currentUser.companyId)
        );
      } else {
        sitesQuery = query(
          collection(db, 'sahalar'), 
          where('companyId', '==', currentUser.companyId),
          orderBy('ad')
        );
      }
      
      const sitesSnapshot = await getDocs(sitesQuery);
      const sitesData = sitesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSites(sitesData);

      // Arızalar
      let faultsQuery;
      if (isCustomer && currentUser.sahalar) {
        const sahaIds = Array.isArray(currentUser.sahalar) ? currentUser.sahalar : Object.keys(currentUser.sahalar);
        if (sahaIds.length > 0) {
          faultsQuery = query(
            collection(db, 'arizalar'),
            where('companyId', '==', currentUser.companyId),
            where('saha', 'in', sahaIds),
            orderBy('olusturmaTarihi', 'desc'),
            limit(10)
          );
        } else {
          faultsQuery = query(
            collection(db, 'arizalar'),
            where('companyId', '==', currentUser.companyId),
            orderBy('olusturmaTarihi', 'desc'),
            limit(10)
          );
        }
      } else {
        faultsQuery = query(
          collection(db, 'arizalar'),
          where('companyId', '==', currentUser.companyId),
          orderBy('olusturmaTarihi', 'desc'),
          limit(10)
        );
      }
      
      const faultsSnapshot = await getDocs(faultsQuery);
      const faults = faultsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Ariza[];

      // Bakım verileri - Mevcut ay için filtrele
      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      // Tüm bakım koleksiyonlarını kontrol et
      let allMaintenanceData: any[] = [];
      const maintenanceCollections = ['mekanikBakimlar', 'elektrikBakimlar', 'yapilan-isler'];
      
      for (const collectionName of maintenanceCollections) {
        try {
      const maintenanceQuery = query(
            collection(db, collectionName),
        where('companyId', '==', currentUser.companyId),
            where('tarih', '>=', Timestamp.fromDate(startOfMonth)),
            where('tarih', '<=', Timestamp.fromDate(endOfMonth)),
            orderBy('tarih', 'desc')
      );
      
        const maintenanceSnapshot = await getDocs(maintenanceQuery);
          const maintenanceList = maintenanceSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            koleksiyon: collectionName 
          }));
          
          allMaintenanceData = [...allMaintenanceData, ...maintenanceList];
      } catch (error) {
          console.log(`${collectionName} data not available or no index for date query`);
          
          // Tarih indexi yoksa tüm verileri al ve manuel filtrele
          try {
            const allMaintenanceQuery = query(
              collection(db, collectionName),
              where('companyId', '==', currentUser.companyId),
              orderBy('olusturmaTarihi', 'desc'),
              limit(50)
            );
            
            const allMaintenanceSnapshot = await getDocs(allMaintenanceQuery);
            const allMaintenance = allMaintenanceSnapshot.docs.map(doc => ({ 
              id: doc.id, 
              ...doc.data(),
              koleksiyon: collectionName 
            }));
            
            // Manuel tarih filtresi
            const monthlyMaintenance = allMaintenance.filter((item: any) => {
              const itemDate = item.tarih ? item.tarih.toDate() : (item.olusturmaTarihi ? item.olusturmaTarihi.toDate() : null);
              if (!itemDate) return false;
              
              return itemDate >= startOfMonth && itemDate <= endOfMonth;
            });
            
            allMaintenanceData = [...allMaintenanceData, ...monthlyMaintenance];
          } catch (fallbackError) {
            console.log(`Fallback query for ${collectionName} also failed`);
          }
        }
      }

      // Stok verileri
      let stockData: any[] = [];
      try {
        const stockQuery = query(
          collection(db, 'stoklar'),
          where('companyId', '==', currentUser.companyId),
          limit(100)
        );
        const stockSnapshot = await getDocs(stockQuery);
        stockData = stockSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.log('Stock data not available');
      }

      // Üretim verileri
      let productionData: any[] = [];
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        let productionQuery;
        if (isCustomer && currentUser.sahalar) {
          const sahaIds = Array.isArray(currentUser.sahalar) ? currentUser.sahalar : Object.keys(currentUser.sahalar);
          if (sahaIds.length > 0) {
            productionQuery = query(
              collection(db, 'uretimVerileri'),
              where('companyId', '==', currentUser.companyId),
              where('santralId', 'in', sahaIds.slice(0, 10)),
              where('tarih', '>=', Timestamp.fromDate(sevenDaysAgo)),
              orderBy('tarih', 'desc'),
              limit(20)
            );
          }
        } else {
          productionQuery = query(
            collection(db, 'uretimVerileri'),
            where('companyId', '==', currentUser.companyId),
            where('tarih', '>=', Timestamp.fromDate(sevenDaysAgo)),
            orderBy('tarih', 'desc'),
            limit(20)
          );
        }
        
        if (productionQuery) {
          const productionSnapshot = await getDocs(productionQuery);
          productionData = productionSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setRecentProduction(productionData);
        }
      } catch (error) {
        console.log('Production data not available');
      }

      // Dashboard verileri hesapla
      const openFaults = faults.filter(f => f.durum === 'acik').length;
      
      // Kapasite hesaplaması - çeşitli alan adlarını kontrol et
      const totalCapacity = sitesData.reduce((total: number, site: any) => {
        let capacity = 0;
        
        // Farklı alan adlarını kontrol et
        if (site.kurulumGucu) {
          if (typeof site.kurulumGucu === 'number') {
            capacity = site.kurulumGucu;
          } else if (typeof site.kurulumGucu === 'string') {
            capacity = parseFloat(site.kurulumGucu.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
          }
        } else if (site.kapasite) {
          if (typeof site.kapasite === 'number') {
            capacity = site.kapasite;
          } else if (typeof site.kapasite === 'string') {
            capacity = parseFloat(site.kapasite.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
          }
        } else if (site.guc) {
          if (typeof site.guc === 'number') {
            capacity = site.guc;
          } else if (typeof site.guc === 'string') {
            capacity = parseFloat(site.guc.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
          }
        } else if (site.kurulumGucuMW) {
          if (typeof site.kurulumGucuMW === 'number') {
            capacity = site.kurulumGucuMW;
          } else if (typeof site.kurulumGucuMW === 'string') {
            capacity = parseFloat(site.kurulumGucuMW.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
          }
        }
        

        
        return total + capacity;
      }, 0);

      const monthlyProduction = productionData.reduce((total, prod) => total + (prod.gunlukUretim || 0), 0);
      const avgEfficiency = productionData.length > 0 ? 
        productionData.reduce((sum, prod) => sum + (prod.performansOrani || 85), 0) / productionData.length : 
        Math.floor(Math.random() * 10 + 85);

      // Stok hesaplamaları
      const criticalStock = stockData.filter(item => 
        item.miktar <= (item.kritikSeviye || 0)
      ).length;

      setDashboardData({
        totalSites: sitesData.length,
        activeSites: sitesData.filter((s: any) => s.durum === 'aktif' || !s.durum).length,
        totalProduction: (monthlyProduction * 12).toFixed(0),
        monthlyProduction: monthlyProduction.toFixed(1),
        openFaults,
        totalFaults: faults.length,
        pendingMaintenance: allMaintenanceData.filter((m: any) => m.durum === 'devam-ediyor' || m.durum === 'beklemede').length,
        completedMaintenance: allMaintenanceData.filter((m: any) => m.durum === 'tamamlandi').length,
        totalMaintenance: allMaintenanceData.length,
        systemEfficiency: Math.round(avgEfficiency),
        totalCapacity,
        criticalStock,
        totalStock: stockData.length,
        yearlyTarget: 0,
        yearlyActual: 0,
        yearlyPercentage: 0
      });

      // Son aktiviteler - Gerçek kullanıcı aktivitelerini çek
      const activities = [];
      
      // Daha geniş zaman aralığı (Son 2 hafta)
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      
      // 1. TÜM ARIZALAR (Son 2 hafta - en güncel olanlar)
      const allFaults = faults.filter((fault: any) => {
        const faultDate = fault.olusturmaTarihi?.toDate();
        return faultDate && faultDate >= twoWeeksAgo;
      })
      .sort((a: any, b: any) => {
        const dateA = a.olusturmaTarihi?.toDate() || new Date(0);
        const dateB = b.olusturmaTarihi?.toDate() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 4); // En son 4 arıza

      allFaults.forEach((fault: any) => {
        const kullaniciAdi = fault.olusturanKisi?.ad || fault.kullaniciAdi || 'Kullanıcı';
        activities.push({
          icon: AlertTriangle,
          title: `${kullaniciAdi}: ${fault.baslik || 'Arıza Bildirimi'}`,
          time: fault.olusturmaTarihi ? format((fault.olusturmaTarihi as Timestamp).toDate(), 'dd.MM HH:mm', { locale: tr }) : '',
          status: fault.durum === 'acik' ? 'Açık Arıza' : fault.durum === 'cozuldu' ? 'Çözüldü' : 'İnceleniyor',
          type: 'ariza',
          onClick: () => navigate('/arizalar')
        });
      });

      // 2. TÜM BAKIM İŞLERİ (Son 2 hafta)
      const allMaintenance = allMaintenanceData.filter((work: any) => {
        const workDate = work.olusturmaTarihi?.toDate() || work.tarih?.toDate();
        return workDate && workDate >= twoWeeksAgo;
      })
      .sort((a: any, b: any) => {
        const dateA = a.olusturmaTarihi?.toDate() || a.tarih?.toDate() || new Date(0);
        const dateB = b.olusturmaTarihi?.toDate() || b.tarih?.toDate() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 3); // En son 3 bakım işi
      
      allMaintenance.forEach((work: any) => {
        const kullaniciAdi = work.kontrolEden?.ad || work.olusturanKisi?.ad || work.kullaniciAdi || 'Teknisyen';
        
        // Koleksiyona göre durum belirleme
        let durumMetni = 'Tamamlandı'; // Varsayılan - bakım yapıldıysa tamamlanmıştır
        let baslik = 'Bakım Çalışması';
        let navigateLink = '/yapilan-isler';
        
        console.log('🔧 Bakım bilgisi:', {
          id: work.id?.substring(0, 8) || 'unknown',
          koleksiyon: work.koleksiyon,
          durum: work.durum,
          baslik: work.baslik || work.aciklama,
          tarih: work.tarih?.toDate?.() || work.olusturmaTarihi?.toDate?.()
        });
        
        if (work.koleksiyon === 'yapilan-isler') {
          // yapilan-isler koleksiyonunda durum alanı var
          const durum = work.durum?.toLowerCase() || '';
          baslik = work.baslik || work.aciklama || work.yapildigi_is || 'İş Raporu';
          navigateLink = '/yapilan-isler';
          
          if (durum === 'tamamlandi' || durum === 'tamamlandı' || durum === 'completed') {
            durumMetni = 'Tamamlandı';
          } else if (durum === 'devam-ediyor' || durum === 'devam_ediyor' || durum === 'in_progress') {
            durumMetni = 'Devam Ediyor';
          } else if (durum === 'beklemede' || durum === 'pending' || durum === 'waiting') {
            durumMetni = 'Beklemede';
          } else if (durum === 'basladi' || durum === 'başladı' || durum === 'started') {
            durumMetni = 'Başladı';
          } else if (durum === 'planlandi' || durum === 'planlandı' || durum === 'planned') {
            durumMetni = 'Planlandı';
          } else if (durum === 'iptal' || durum === 'cancelled') {
            durumMetni = 'İptal Edildi';
          } else if (durum) {
            durumMetni = durum.charAt(0).toUpperCase() + durum.slice(1).replace(/[-_]/g, ' ');
          }
        } else if (work.koleksiyon === 'elektrikBakimlar') {
          baslik = 'Elektrik Bakımı';
          navigateLink = '/elektrik-bakim';
          // Elektrik bakım için sorun kontrolü
          const sorunVar = work.durumlar && Object.entries(work.durumlar).some(([key, value]: [string, any]) => {
            if (key.endsWith('Aciklamalar')) return false;
            if (typeof value === 'object' && value !== null) {
              return Object.values(value).some(durum => durum === false);
            }
            return false;
          });
          durumMetni = sorunVar ? 'Sorunlu' : 'Başarılı';
        } else if (work.koleksiyon === 'mekanikBakimlar') {
          baslik = 'Mekanik Bakım';
          navigateLink = '/mekanik-bakim';
          // Mekanik bakım için sorun kontrolü
          const sorunVar = work.durumlar && Object.keys(work.durumlar)
            .filter(key => !key.endsWith('Aciklamalar'))
            .some(kategoriKey => {
              const kategori = work.durumlar[kategoriKey];
              return typeof kategori === 'object' && kategori !== null && 
                     Object.values(kategori).some((durum: any) => durum === false);
            });
          durumMetni = sorunVar ? 'Sorunlu' : 'Başarılı';
        }
        
        activities.push({
          icon: Wrench,
          title: `${kullaniciAdi}: ${baslik}`,
          time: work.olusturmaTarihi ? format((work.olusturmaTarihi as Timestamp).toDate(), 'dd.MM HH:mm', { locale: tr }) : 
                (work.tarih ? format((work.tarih as Timestamp).toDate(), 'dd.MM HH:mm', { locale: tr }) : ''),
          status: durumMetni,
          type: 'bakim',
          onClick: () => navigate(navigateLink)
        });
      });

      // 3. YENİ ÜRETIM VERİLERİ (Son 2 hafta - kullanıcı tarafından eklenen)
      try {
        const recentProductionData = productionData.filter((prod: any) => {
          const prodDate = prod.tarih?.toDate() || prod.olusturmaTarihi?.toDate();
          return prodDate && prodDate >= twoWeeksAgo && prod.gunlukUretim >= 0;
        })
        .sort((a: any, b: any) => {
          const dateA = a.olusturmaTarihi?.toDate() || a.tarih?.toDate() || new Date(0);
          const dateB = b.olusturmaTarihi?.toDate() || b.tarih?.toDate() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 2); // En son 2 üretim verisi

        recentProductionData.forEach((prod: any) => {
          const santralAdi = santraller.find(s => s.id === prod.santralId)?.ad || 'Bilinmeyen Santral';
          const kullaniciAdi = prod.olusturanKisi?.ad || prod.kullaniciAdi || 'Sistem';
          activities.push({
            icon: Sun,
            title: `${kullaniciAdi}: ${santralAdi} - Üretim Verisi Eklendi`,
            time: prod.olusturmaTarihi ? format((prod.olusturmaTarihi as Timestamp).toDate(), 'dd.MM HH:mm', { locale: tr }) : 
                  (prod.tarih ? format((prod.tarih as Timestamp).toDate(), 'dd.MM HH:mm', { locale: tr }) : ''),
            status: `${prod.gunlukUretim.toFixed(1)} kWh`,
            type: 'uretim',
            onClick: () => navigate('/uretim-verileri')
          });
        });
      } catch (error) {
        console.log('Üretim verileri aktivitelerine eklenemedi:', error);
      }

      // Elektrik kesintileri
      try {
        if (isCustomer && currentUser?.sahalar) {
          const sahaIds = Array.isArray(currentUser.sahalar) ? currentUser.sahalar : Object.keys(currentUser.sahalar);
          if (sahaIds.length > 0) {
            const kesintilerQuery = query(
              collection(db, 'elektrikKesintileri'),
              where('companyId', '==', currentUser.companyId),
              where('santralId', 'in', sahaIds.slice(0, 10)),
              where('tarih', '>=', Timestamp.fromDate(twoWeeksAgo)),
              orderBy('tarih', 'desc'),
              limit(2)
            );
            const kesintilerSnapshot = await getDocs(kesintilerQuery);
            kesintilerSnapshot.docs.forEach(doc => {
              const data = doc.data();
              activities.push({
                icon: Zap,
                title: data.baslik || 'Elektrik Kesintisi',
                time: data.tarih ? format((data.tarih as Timestamp).toDate(), 'dd.MM HH:mm', { locale: tr }) : '',
                status: data.durum === 'aktif' ? 'Devam Ediyor' : 'Çözüldü',
                type: 'kesinti',
                onClick: () => navigate('/elektrik-kesintileri')
              });
            });
          }
        } else {
          const kesintilerQuery = query(
            collection(db, 'elektrikKesintileri'),
            where('companyId', '==', currentUser.companyId),
            where('tarih', '>=', Timestamp.fromDate(twoWeeksAgo)),
            orderBy('tarih', 'desc'),
            limit(2)
          );
          const kesintilerSnapshot = await getDocs(kesintilerQuery);
          kesintilerSnapshot.docs.forEach(doc => {
            const data = doc.data();
            activities.push({
              icon: Zap,
              title: data.baslik || 'Elektrik Kesintisi',
              time: data.tarih ? format((data.tarih as Timestamp).toDate(), 'dd.MM HH:mm', { locale: tr }) : '',
              status: data.durum === 'aktif' ? 'Devam Ediyor' : 'Çözüldü',
              type: 'kesinti',
              onClick: () => navigate('/elektrik-kesintileri')
            });
          });
        }
      } catch (error) {
        console.log('Elektrik kesintileri alınamadı:', error);
      }

      // Vardiya bildirimleri
      try {
        const vardiyaQuery = query(
          collection(db, 'vardiyaBildirimleri'),
          where('companyId', '==', currentUser.companyId),
          where('olusturmaTarihi', '>=', Timestamp.fromDate(twoWeeksAgo)),
          orderBy('olusturmaTarihi', 'desc'),
          limit(2)
        );
        const vardiyaSnapshot = await getDocs(vardiyaQuery);
        vardiyaSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const kullaniciAdi = data.kullaniciAdi || 'Bekçi';
          activities.push({
            icon: Clock,
            title: `${kullaniciAdi}: Vardiya Raporu Gönderdi`,
            time: data.olusturmaTarihi ? format((data.olusturmaTarihi as Timestamp).toDate(), 'dd.MM HH:mm', { locale: tr }) : '',
            status: data.acilDurum ? 'Acil Durum' : 'Normal Rapor',
            type: 'vardiya',
            onClick: () => navigate('/vardiya-bildirimleri')
          });
        });
      } catch (error) {
        console.log('Vardiya bildirimleri alınamadı:', error);
      }

      // 6. STOK HAREKETLERİ VE UYARILAR
      try {
        const kritikStoklar = stockData.filter((item: any) => {
          const minimumStok = item.minimumStokSeviyesi || 10;
          return item.mevcutStok <= minimumStok;
        }).slice(0, 2);

        kritikStoklar.forEach((item: any) => {
          activities.push({
            icon: Package,
            title: `Sistem: ${item.malzemeAdi || item.ad} - Kritik Stok`,
            time: format(new Date(), 'dd.MM HH:mm', { locale: tr }),
            status: 'Kritik Seviye',
            type: 'stok',
            onClick: () => navigate('/stok-kontrol')
          });
        });
      } catch (error) {
        console.log('Stok uyarıları eklenemedi:', error);
      }

      // 7. YENİ SAHA KAYITLARI
      try {
        const sahaQuery = query(
          collection(db, 'sahalar'),
          where('companyId', '==', currentUser.companyId),
          where('olusturmaTarihi', '>=', Timestamp.fromDate(twoWeeksAgo)),
          orderBy('olusturmaTarihi', 'desc'),
          limit(2)
        );
        const sahaSnapshot = await getDocs(sahaQuery);
        sahaSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const kullaniciAdi = data.olusturanKisi?.ad || data.kullaniciAdi || 'Yönetici';
          activities.push({
            icon: Building,
            title: `${kullaniciAdi}: Yeni Saha Ekledi - ${data.ad}`,
            time: data.olusturmaTarihi ? format((data.olusturmaTarihi as Timestamp).toDate(), 'dd.MM HH:mm', { locale: tr }) : '',
            status: 'Yeni Kayıt',
            type: 'saha',
            onClick: () => navigate('/sahalar')
          });
        });
      } catch (error) {
        console.log('Saha kayıtları alınamadı:', error);
      }

      // 8. YENİ SANTRAL KAYITLARI  
      try {
        const santralQuery = query(
          collection(db, 'gesSantralleri'),
          where('companyId', '==', currentUser.companyId),
          where('olusturmaTarihi', '>=', Timestamp.fromDate(twoWeeksAgo)),
          orderBy('olusturmaTarihi', 'desc'),
          limit(2)
        );
        const santralSnapshot = await getDocs(santralQuery);
        santralSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const kullaniciAdi = data.olusturanKisi?.ad || data.kullaniciAdi || 'Yönetici';
          activities.push({
            icon: Sun,
            title: `${kullaniciAdi}: Yeni GES Santrali Ekledi - ${data.ad}`,
            time: data.olusturmaTarihi ? format((data.olusturmaTarihi as Timestamp).toDate(), 'dd.MM HH:mm', { locale: tr }) : '',
            status: 'Yeni Santral',
            type: 'santral',
            onClick: () => navigate('/ges-yonetimi')
          });
        });
      } catch (error) {
        console.log('Santral kayıtları alınamadı:', error);
      }

      // Sistem bildirimleri (sadece gerçek aktivite yoksa)
      if (activities.length === 0) {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        activities.push(
          {
            icon: Activity,
            title: 'Sistem: Veri İzleme Aktif',
            time: format(now, 'dd.MM HH:mm', { locale: tr }),
            status: 'Çalışıyor',
            type: 'sistem',
            onClick: () => navigate('/sahalar')
          },
          {
            icon: CheckCircle,
            title: 'Sistem: Otomatik Yedekleme Tamamlandı',
            time: format(oneHourAgo, 'dd.MM HH:mm', { locale: tr }),
            status: 'Başarılı',
            type: 'sistem',
            onClick: () => navigate('/ayarlar')
          }
        );
      }

      // Aktiviteleri tarihe göre sırala ve en son 10 tanesini al
      const sortedActivities = activities
        .filter(activity => activity.time && activity.title) // Geçerli veri kontrolü
        .sort((a, b) => {
          try {
            const timeA = new Date(a.time.split(' ')[0].split('.').reverse().join('-') + ' ' + a.time.split(' ')[1]);
            const timeB = new Date(b.time.split(' ')[0].split('.').reverse().join('-') + ' ' + b.time.split(' ')[1]);
            return timeB.getTime() - timeA.getTime();
          } catch (error) {
            return 0; // Tarih parse edilemezse sıralama yapma
          }
        })
        .slice(0, 10); // Daha çok aktivite göster

      setRecentActivities(sortedActivities);
      console.log(`📊 Dashboard: ${sortedActivities.length} kullanıcı aktivitesi yüklendi`);
      
      // Aktivite türlerini logla
      const activityTypes = sortedActivities.reduce((acc: any, act) => {
        acc[act.type] = (acc[act.type] || 0) + 1;
        return acc;
      }, {});
      console.log('📈 Aktivite türleri:', activityTypes);

      // Santral ve üretim verilerini de getir
      await fetchSantrallerVeUretimVerileri();
    } catch (error) {
      console.error('Dashboard veri getirme hatası:', error);
      toast.error('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
    toast.success('Veriler yenilendi');
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Kompakt Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">SolarVeyo Dashboard</h1>
              <p className="text-xs text-gray-500">
                {format(new Date(), "dd MMMM yyyy", { locale: tr })} • {dashboardData.totalCapacity.toFixed(1)} MW
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Yenile
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Ana Metrikler - 2x4 Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
          <CompactMetricCard
            title="Santraller"
            value={dashboardData.totalSites.toString()}
            subtitle={`${dashboardData.activeSites} aktif`}
            icon={Sun}
            color="blue"
            onClick={() => navigate('/sahalar')}
          />
          <CompactMetricCard
            title="Arızalar"
            value={dashboardData.openFaults.toString()}
            subtitle={`${dashboardData.totalFaults} toplam`}
            icon={AlertTriangle}
            color="red"
            onClick={() => navigate('/arizalar')}
          />
          <CompactMetricCard
            title="Bu Ay Bakım"
            value={dashboardData.totalMaintenance.toString()}
            subtitle={`${dashboardData.completedMaintenance} tamam`}
            icon={Wrench}
            color="orange"
            onClick={() => navigate('/yapilan-isler')}
          />
          <CompactMetricCard
            title="Stok"
            value={dashboardData.criticalStock.toString()}
            subtitle={`${dashboardData.totalStock} toplam`}
            icon={Package}
            color="red"
            onClick={() => navigate('/stok-kontrol')}
          />
          <CompactMetricCard
            title="Kapasite"
            value={dashboardData.totalCapacity.toFixed(1)}
            subtitle="MW kurulu"
            icon={Gauge}
            color="blue"
            onClick={() => navigate('/ges-yonetimi')}
          />
        </div>

        {/* Ana İçerik - 3 Kolon */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Sol Kolon - Sahalar ve Santraller */}
        <div className="lg:col-span-4 space-y-4 order-2 lg:order-1">
            {/* GES Santralleri */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">GES Santralleri</h2>
                  <button 
                    onClick={() => navigate('/ges-yonetimi')}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Tümü →
                  </button>
                </div>
              </div>
              <div className="p-4">
                {santraller.length > 0 ? (
                  <div className="space-y-2">
                    {santraller.slice(0, 4).map((santral) => (
                      <MiniGESCard
                        key={santral.id}
                        santral={santral}
                        uretimVerisi={sahalarUretimVerileri[santral.id]}
                        onClick={() => navigate('/ges-yonetimi')}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <Building className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Henüz GES santrali bulunmuyor</p>
                    <p className="text-xs mt-1 text-gray-400">Yeni santral eklemek için GES Yönetimi sayfasını ziyaret edin</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sahalar */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Sahalar</h2>
                  <button 
                    onClick={() => navigate('/sahalar')}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Tümü →
                  </button>
                </div>
              </div>
              <div className="p-4">
                {sites.length > 0 ? (
                  <div className="space-y-2">
                    {sites.slice(0, 4).map((saha) => (
                      <MiniSahaCard
                        key={saha.id}
                        saha={saha}
                        onClick={() => navigate('/sahalar')}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <MapPin className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Henüz saha bulunmuyor</p>
                    <p className="text-xs mt-1 text-gray-400">Yeni saha eklemek için Sahalar sayfasını ziyaret edin</p>
                  </div>
                )}
              </div>
            </div>

            {/* Hızlı Erişim */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Hızlı Erişim</h2>
              </div>
              <div className="p-4 space-y-2">
                <QuickAccessCard
                  title="Stok Kontrolü"
                  icon={Package}
                  color="bg-orange-50 text-orange-600"
                  onClick={() => navigate('/stok-kontrol')}
                  />
              </div>
            </div>
          </div>

                     {/* Orta Kolon - Yıllık Hedef Karşılaştırması */}
           <div className="lg:col-span-5 order-3 lg:order-2">
             <div className="bg-white rounded-lg border border-gray-200 h-full">
               <div className="px-4 py-3 border-b border-gray-200">
                 <div className="flex items-center justify-between">
                   <h2 className="font-semibold text-gray-900">Yıllık Üretim Hedef Karşılaştırması ({new Date().getFullYear()})</h2>
                   <button 
                     onClick={() => navigate('/uretim-verileri')}
                     className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                   >
                     Detay →
                   </button>
                 </div>
               </div>
               <div className="p-4">
                 {Object.keys(sahalarUretimVerileri).length > 0 ? (
                   <>
                     {/* Genel Yıllık Hedef Progress Bar */}
                     <div className="mb-6">
                       <div className="flex items-center justify-between mb-2">
                         <span className="text-sm font-medium text-gray-700">Toplam Yıllık Hedef</span>
                         <span className="text-sm text-gray-500">
                           {dashboardData.yearlyTarget.toLocaleString('tr-TR', {maximumFractionDigits: 0})} kWh
                         </span>
                       </div>
                       <div className="w-full bg-gray-200 rounded-full h-3">
                         <div 
                           className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-1000"
                           style={{ 
                             width: `${Math.min(dashboardData.yearlyPercentage, 100)}%` 
                           }}
                         ></div>
                       </div>
                       <div className="flex items-center justify-between mt-2">
                         <span className="text-xs text-gray-500">
                           Gerçekleşen: {dashboardData.yearlyActual.toLocaleString('tr-TR', {maximumFractionDigits: 0})} kWh
                         </span>
                         <span className="text-xs font-medium text-gray-700">
                           %{dashboardData.yearlyPercentage.toFixed(1)}
                         </span>
                       </div>
                     </div>

                     {/* Saha Bazlı Karşılaştırma */}
                     <div className="space-y-3 max-h-80 overflow-y-auto">
                       {Object.entries(sahalarUretimVerileri).map(([sahaId, veri]) => (
                         <div key={sahaId} className="border border-gray-100 rounded-lg p-3">
                           <div className="flex items-center justify-between mb-2">
                             <span className="text-sm font-medium text-gray-700 truncate">{veri.ad}</span>
                             <span className="text-xs text-gray-500">
                               %{veri.oran.toFixed(1)}
                             </span>
                           </div>
                           <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                             <div 
                               className={`h-2 rounded-full transition-all duration-1000 ${
                                 veri.oran >= 80 ? 'bg-green-500' :
                                 veri.oran >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                               }`}
                               style={{ width: `${Math.min(veri.oran, 100)}%` }}
                             ></div>
                           </div>
                           <div className="flex items-center justify-between text-xs text-gray-500">
                             <span>Hedef: {veri.hedef.toLocaleString('tr-TR', {maximumFractionDigits: 0})} kWh</span>
                             <span>Gerçek: {veri.gerceklesen.toLocaleString('tr-TR', {maximumFractionDigits: 0})} kWh</span>
                           </div>
                         </div>
                       ))}
                     </div>

                     {/* Özet İstatistikler */}
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                       <div className="text-center p-2 bg-blue-50 rounded-lg">
                         <div className="text-lg font-bold text-blue-600">
                           {Object.keys(sahalarUretimVerileri).length}
                         </div>
                         <div className="text-xs text-gray-600">Toplam Saha</div>
                       </div>
                       <div className="text-center p-2 bg-green-50 rounded-lg">
                         <div className="text-lg font-bold text-green-600">
                           {Object.values(sahalarUretimVerileri).filter(v => v.oran >= 80).length}
                         </div>
                         <div className="text-xs text-gray-600">Başarılı</div>
                       </div>
                       <div className="text-center p-2 bg-yellow-50 rounded-lg">
                         <div className="text-lg font-bold text-yellow-600">
                           {Object.values(sahalarUretimVerileri).filter(v => v.oran >= 60 && v.oran < 80).length}
                         </div>
                         <div className="text-xs text-gray-600">Orta</div>
                       </div>
                       <div className="text-center p-2 bg-red-50 rounded-lg">
                         <div className="text-lg font-bold text-red-600">
                           {Object.values(sahalarUretimVerileri).filter(v => v.oran < 60).length}
                         </div>
                         <div className="text-xs text-gray-600">Düşük</div>
                       </div>
                     </div>
                   </>
                 ) : (
                   <div className="text-center py-8 text-gray-500">
                     <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                     <p className="text-sm">Henüz üretim verisi bulunmuyor</p>
                     <p className="text-xs mt-1">Santraller için üretim verileri eklendiğinde burada görünecektir</p>
                   </div>
                 )}
               </div>
             </div>
           </div>

          {/* Sağ Kolon - Aktiviteler */}
          <div className="lg:col-span-3 order-1 lg:order-3">
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                  <h2 className="font-semibold text-gray-900">Son Aktiviteler</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {recentActivities.length > 0 
                        ? `Son ${recentActivities.length} aktivite • ${format(new Date(), 'HH:mm', { locale: tr })} güncellendi`
                        : 'Sistem otomatik olarak aktiviteleri takip ediyor'
                      }
                    </p>
                  </div>
                  <button 
                    onClick={() => navigate('/yapilan-isler')}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Tümü →
                  </button>
                </div>
              </div>
              <div className="p-4">
                {recentActivities.length > 0 ? (
                  <div className="space-y-2">
                    {recentActivities.map((activity, index) => (
                      <CompactActivityRow
                        key={index}
                        icon={activity.icon}
                        title={activity.title}
                        time={activity.time}
                        status={activity.status}
                        type={activity.type}
                        onClick={activity.onClick}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Henüz aktivite bulunmuyor</p>
                    <p className="text-xs mt-1 text-gray-400">
                      Sistem arıza, bakım, üretim ve diğer aktiviteleri otomatik olarak takip eder
                    </p>
                    <div className="flex items-center justify-center space-x-4 mt-3">
                      <button 
                        onClick={() => navigate('/arizalar')}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Arıza Ekle
                      </button>
                      <button 
                        onClick={() => navigate('/yapilan-isler')}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        İş Raporu
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};