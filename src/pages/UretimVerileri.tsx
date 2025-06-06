
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfMonth, endOfMonth, subDays, addDays, isSameDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Sun, 
  Calendar, 
  Download, 
  Trash2, 
  Plus, 
  RefreshCw,
  Battery,
  Leaf,
  TrendingUp,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  BarChart2,
  Zap,
  Target,
  Building,
  MapPin,
  Filter,
  Search,
  Edit,
  Eye,
  FileText,
  Activity,
  Thermometer,
  Cloud,
  Wind,
  DollarSign,
  X
} from 'lucide-react';
import { Card, Title, Text, AreaChart, BarChart, LineChart, Metric, Flex, ProgressBar, Grid, Col, Badge, BadgeDelta } from '@tremor/react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { BulkImportModal } from '../components/BulkImportModal';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface UretimVerisi {
  id: string;
  santralId: string;
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
  olusturanKisi: {
    id: string;
    ad: string;
  };
  olusturmaTarihi: Timestamp;
  companyId: string;
}

interface Santral {
  id: string;
  ad: string;
  kapasite: number;
  yillikHedefUretim: number;
  aylikHedefler?: Record<string, number>;
  kurulumTarihi: Timestamp;
  elektrikFiyatlari?: Record<string, Record<string, { birimFiyat: number, dagitimBedeli: number }>>;
  companyId: string;
  konum: {
    adres: string;
    lat?: number;
    lng?: number;
  };
  panelSayisi: number;
  inverterSayisi: number;
  teknikOzellikler?: {
    panelTipi: string;
    inverterTipi: string;
    panelGucu: number;
    sistemVerimi: number;
  };
  musteriId?: string;
}

interface DashboardStats {
  toplamUretim: number;
  ortalamaPerformans: number;
  toplamGelir: number;
  toplamCO2: number;
  hedefGerceklesme: number;
  aktifSantralSayisi: number;
  gunlukOrtalama: number;
  enYuksekUretim: number;
}

interface WeatherData {
  sicaklik: number;
  nem: number;
  radyasyon: number;
  havaKodu: string;
}

export const UretimVerileri: React.FC = () => {
  const { kullanici } = useAuth();
  const navigate = useNavigate();
  
  // State tanımlamaları
  const [uretimVerileri, setUretimVerileri] = useState<UretimVerisi[]>([]);
  const [santraller, setSantraller] = useState<Santral[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [secilenSantral, setSecilenSantral] = useState<string>('tumu');
  const [secilenYil, setSecilenYil] = useState<number>(new Date().getFullYear());
  const [secilenAy, setSecilenAy] = useState<number>(new Date().getMonth());
  const [secilenTarihAraligi, setSecilenTarihAraligi] = useState<'gunluk' | 'haftalik' | 'aylik' | 'yillik'>('aylik');
  const [searchTerm, setSearchTerm] = useState('');
  const [filtreAcik, setFiltreAcik] = useState(false);
  const [performansFiltresi, setPerformansFiltresi] = useState<'tumu' | 'yuksek' | 'orta' | 'dusuk'>('tumu');
  
  // Modal states
  const [importModalAcik, setImportModalAcik] = useState(false);
  const [silmeOnayModalAcik, setSilmeOnayModalAcik] = useState(false);
  const [silinecekVeriId, setSilinecekVeriId] = useState<string | null>(null);
  const [detayModalAcik, setDetayModalAcik] = useState(false);
  const [secilenVeriDetay, setSecilenVeriDetay] = useState<UretimVerisi | null>(null);
  
  // Görünüm states
  const [goruntulemeSecenegi, setGoruntulemeSecenegi] = useState<'kartlar' | 'tablo' | 'grafik'>('kartlar');
  const [animasyonAktif, setAnimasyonAktif] = useState(true);

  // Yıl ve ay seçenekleri
  const yilSecenekleri = Array.from({ length: 9 }, (_, i) => 2022 + i);
  const aySecenekleri = [
    { value: 0, label: 'Ocak' }, { value: 1, label: 'Şubat' }, { value: 2, label: 'Mart' },
    { value: 3, label: 'Nisan' }, { value: 4, label: 'Mayıs' }, { value: 5, label: 'Haziran' },
    { value: 6, label: 'Temmuz' }, { value: 7, label: 'Ağustos' }, { value: 8, label: 'Eylül' },
    { value: 9, label: 'Ekim' }, { value: 10, label: 'Kasım' }, { value: 11, label: 'Aralık' }
  ];

  // İzinler
  const canAdd = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis', 'superadmin'].includes(kullanici.rol);
  const canDelete = kullanici?.rol === 'yonetici' || kullanici?.rol === 'superadmin';
  const canEdit = kullanici?.rol && ['yonetici', 'muhendis', 'superadmin'].includes(kullanici.rol);

  // Müşteri sahalarını normalize et
  const getMusteriSahaIds = (): string[] => {
    if (!kullanici || kullanici.rol !== 'musteri') return [];

    console.log('Müşteri saha verisi kontrolü:', kullanici.sahalar);
    console.log('Müşteri santraller verisi:', kullanici.santraller);
    
    let sahaIds: string[] = [];
    
    // Önce sahalar alanını kontrol et
    if (kullanici.sahalar) {
      if (Array.isArray(kullanici.sahalar)) {
        // Array formatında: ["sahaId1", "sahaId2"]
        sahaIds = kullanici.sahalar.filter(id => id && id.trim() !== '');
      } else if (typeof kullanici.sahalar === 'object' && !Array.isArray(kullanici.sahalar)) {
        // Object formatında: { sahaId: true, sahaId2: true }
        sahaIds = Object.keys(kullanici.sahalar).filter(key => 
          kullanici.sahalar[key] === true && key && key.trim() !== ''
        );
      }
    }
    
    // Eğer sahalar boşsa, santraller alanını kontrol et (santralId genellikle sahaId ile aynı)
    if (sahaIds.length === 0 && kullanici.santraller) {
      if (Array.isArray(kullanici.santraller)) {
        sahaIds = kullanici.santraller.filter(id => id && id.trim() !== '');
      } else if (typeof kullanici.santraller === 'object') {
        sahaIds = Object.keys(kullanici.santraller).filter(key => 
          kullanici.santraller[key] === true && key && key.trim() !== ''
        );
      }
    }
    
    console.log('UretimVerileri - Müşteri erişebilir saha/santral IDs:', sahaIds);
    return sahaIds;
  };

  // Santralleri getir
  useEffect(() => {
    const santralleriGetir = async () => {
      if (!kullanici?.companyId) {
        setYukleniyor(false);
        return;
      }

      try {
        let santralQuery;

        if (kullanici.rol === 'musteri') {
          const sahaIds = getMusteriSahaIds();
          console.log('Müşteri için santral sorgusu - Saha IDs:', sahaIds);
          
          if (sahaIds.length === 0) {
            console.warn('Müşteriye atanmış saha bulunamadı');
            setSantraller([]);
            setYukleniyor(false);
            return;
          }

          // Firestore 'in' operatörü maksimum 10 element kabul eder
          const limitedSahaIds = sahaIds.slice(0, 10);
          console.log('Sorgulanacak sahalar:', limitedSahaIds);
          
          try {
            santralQuery = query(
              collection(db, 'santraller'),
              where('__name__', 'in', limitedSahaIds)
            );
          } catch (error) {
            console.error('Müşteri santral sorgusu oluşturma hatası:', error);
            setSantraller([]);
            setYukleniyor(false);
            return;
          }
        } else {
          santralQuery = query(
            collection(db, 'santraller'),
            where('companyId', '==', kullanici.companyId),
            orderBy('ad')
          );
        }

        const snapshot = await getDocs(santralQuery);
        const santralListesi = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Santral[];

        setSantraller(santralListesi);
      } catch (error) {
        console.error('Santral getirme hatası:', error);
        toast.error('Santraller yüklenirken bir hata oluştu');
      } finally {
        setYukleniyor(false);
      }
    };

    santralleriGetir();
  }, [kullanici]);

  // Üretim verilerini getir
  useEffect(() => {
    const verileriGetir = async () => {
      if (!kullanici?.companyId) {
        setUretimVerileri([]);
        return;
      }

      try {
        let tarihBaslangic: Date;
        let tarihBitis: Date;

        switch (secilenTarihAraligi) {
          case 'gunluk':
            tarihBaslangic = new Date();
            tarihBitis = new Date();
            break;
          case 'haftalik':
            tarihBaslangic = subDays(new Date(), 7);
            tarihBitis = new Date();
            break;
          case 'aylik':
            tarihBaslangic = new Date(secilenYil, secilenAy, 1);
            tarihBitis = endOfMonth(tarihBaslangic);
            break;
          case 'yillik':
            tarihBaslangic = new Date(secilenYil, 0, 1);
            tarihBitis = new Date(secilenYil, 11, 31);
            break;
          default:
            tarihBaslangic = new Date(secilenYil, secilenAy, 1);
            tarihBitis = endOfMonth(tarihBaslangic);
        }

        let uretimQuery;

        if (kullanici.rol === 'musteri') {
          const sahaIds = getMusteriSahaIds();
          console.log('Müşteri için üretim verileri sorgusu - Saha IDs:', sahaIds);
          console.log('Seçilen santral:', secilenSantral);
          console.log('Tarih aralığı:', tarihBaslangic, 'ile', tarihBitis);
          console.log('Müşteri companyId:', kullanici.companyId);
          
          if (sahaIds.length === 0) {
            console.warn('Müşteriye atanmış saha bulunamadı - üretim verileri boş');
            setUretimVerileri([]);
            return;
          }

          if (secilenSantral !== 'tumu') {
            // Seçilen santralın müşteriye ait olup olmadığını kontrol et
            if (!sahaIds.includes(secilenSantral)) {
              console.warn('Seçilen santral müşteriye ait değil:', secilenSantral);
              setUretimVerileri([]);
              return;
            }
            
            console.log('Tek santral için sorgu oluşturuluyor:', secilenSantral);
            try {
              uretimQuery = query(
                collection(db, 'uretimVerileri'),
                where('companyId', '==', kullanici.companyId),
                where('santralId', '==', secilenSantral),
                where('tarih', '>=', Timestamp.fromDate(tarihBaslangic)),
                where('tarih', '<=', Timestamp.fromDate(tarihBitis)),
                orderBy('tarih', 'desc')
              );
            } catch (error) {
              console.error('Tek santral sorgusu oluşturma hatası:', error);
              setUretimVerileri([]);
              return;
            }
          } else {
            // Tüm sahalar için sorgu - companyId ile birlikte
            const limitedSahaIds = sahaIds.slice(0, 10);
            console.log('Tüm sahalar için sorgu oluşturuluyor:', limitedSahaIds);
            
            try {
              uretimQuery = query(
                collection(db, 'uretimVerileri'),
                where('companyId', '==', kullanici.companyId),
                where('santralId', 'in', limitedSahaIds),
                where('tarih', '>=', Timestamp.fromDate(tarihBaslangic)),
                where('tarih', '<=', Timestamp.fromDate(tarihBitis)),
                orderBy('tarih', 'desc')
              );
            } catch (error) {
              console.error('Çoklu santral sorgusu oluşturma hatası:', error);
              setUretimVerileri([]);
              return;
            }
          }
        } else {
          if (secilenSantral !== 'tumu') {
            uretimQuery = query(
              collection(db, 'uretimVerileri'),
              where('santralId', '==', secilenSantral),
              where('companyId', '==', kullanici.companyId),
              where('tarih', '>=', Timestamp.fromDate(tarihBaslangic)),
              where('tarih', '<=', Timestamp.fromDate(tarihBitis)),
              orderBy('tarih', 'desc')
            );
          } else {
            uretimQuery = query(
              collection(db, 'uretimVerileri'),
              where('companyId', '==', kullanici.companyId),
              where('tarih', '>=', Timestamp.fromDate(tarihBaslangic)),
              where('tarih', '<=', Timestamp.fromDate(tarihBitis)),
              orderBy('tarih', 'desc')
            );
          }
        }

        console.log('Sorgu çalıştırılıyor...');
        const snapshot = await getDocs(uretimQuery);
        console.log('Sorgu tamamlandı, döküman sayısı:', snapshot.docs.length);
        
        const veriler = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UretimVerisi[];

        console.log('Getirilen üretim verileri sayısı:', veriler.length);
        console.log('İlk 3 veri:', veriler.slice(0, 3));
        
        if (kullanici.rol === 'musteri') {
          console.log('Müşteri üretim verileri detayı:');
          console.log('- Sorgu döküman sayısı:', snapshot.docs.length);
          console.log('- İşlenen veri sayısı:', veriler.length);
          console.log('- Kullanıcı sahalar:', kullanici.sahalar);
          console.log('- Kullanıcı santraller:', kullanici.santraller);
          
          if (veriler.length === 0) {
            console.warn('Müşteri için üretim verisi bulunamadı!');
            console.warn('Kontrol edilecek durumlar:');
            console.warn('1. Firestore rules müşteri erişimine izin veriyor mu?');
            console.warn('2. Üretim verilerinde santralId doğru mu?');
            console.warn('3. Müşteri sahalar/santraller doğru atanmış mı?');
          }
        }
        
        setUretimVerileri(veriler);
      } catch (error) {
        console.error('Üretim verileri getirme hatası:', error);
        console.error('Hata detayı:', {
          code: error.code,
          message: error.message,
          stack: error.stack
        });
        toast.error('Üretim verileri yüklenirken bir hata oluştu');
        setUretimVerileri([]);
      }
    };

    if (santraller.length > 0 || kullanici?.rol === 'musteri') {
      verileriGetir();
    }
  }, [secilenSantral, secilenYil, secilenAy, secilenTarihAraligi, santraller, kullanici]);

  // Filtrelenmiş veriler
  const filtrelenmisVeriler = useMemo(() => {
    let sonuc = uretimVerileri;

    // Arama filtresi
    if (searchTerm) {
      const santralAdi = santraller.find(s => s.id === secilenSantral)?.ad || '';
      sonuc = sonuc.filter(veri => 
        santralAdi.toLowerCase().includes(searchTerm.toLowerCase()) ||
        format(veri.tarih.toDate(), 'dd.MM.yyyy').includes(searchTerm)
      );
    }

    // Performans filtresi
    if (performansFiltresi !== 'tumu') {
      sonuc = sonuc.filter(veri => {
        if (performansFiltresi === 'yuksek') return veri.performansOrani >= 20;
        if (performansFiltresi === 'orta') return veri.performansOrani >= 15 && veri.performansOrani < 20;
        if (performansFiltresi === 'dusuk') return veri.performansOrani < 15;
        return true;
      });
    }

    return sonuc;
  }, [uretimVerileri, searchTerm, performansFiltresi, santraller, secilenSantral]);

  // Dashboard istatistikleri
  const dashboardStats = useMemo((): DashboardStats => {
    const veriler = filtrelenmisVeriler;
    
    return {
      toplamUretim: veriler.reduce((acc, v) => acc + v.gunlukUretim, 0),
      ortalamaPerformans: veriler.length > 0 ? veriler.reduce((acc, v) => acc + v.performansOrani, 0) / veriler.length : 0,
      toplamGelir: veriler.reduce((acc, v) => acc + v.gelir, 0),
      toplamCO2: veriler.reduce((acc, v) => acc + v.tasarrufEdilenCO2, 0),
      hedefGerceklesme: 0, // Hesaplanacak
      aktifSantralSayisi: new Set(veriler.map(v => v.santralId)).size,
      gunlukOrtalama: veriler.length > 0 ? veriler.reduce((acc, v) => acc + v.gunlukUretim, 0) / veriler.length : 0,
      enYuksekUretim: Math.max(...veriler.map(v => v.gunlukUretim), 0)
    };
  }, [filtrelenmisVeriler]);

  // Grafik verileri
  const grafikVerileri = useMemo(() => {
    return filtrelenmisVeriler
      .slice(0, 30)
      .sort((a, b) => a.tarih.toDate().getTime() - b.tarih.toDate().getTime())
      .map(veri => ({
        date: format(veri.tarih.toDate(), 'dd MMM', { locale: tr }),
        uretim: veri.gunlukUretim,
        performans: veri.performansOrani,
        gelir: veri.gelir,
        co2: veri.tasarrufEdilenCO2
      }));
  }, [filtrelenmisVeriler]);

  // Hava durumu verileri (örnek)
  const havaVerileri = useMemo((): WeatherData => {
    const sonVeri = filtrelenmisVeriler[0];
    if (sonVeri?.hava) {
      return {
        sicaklik: sonVeri.hava.sicaklik,
        nem: sonVeri.hava.nem,
        radyasyon: sonVeri.hava.radyasyon,
        havaKodu: sonVeri.hava.sicaklik > 25 ? 'sunny' : 'cloudy'
      };
    }
    return { sicaklik: 0, nem: 0, radyasyon: 0, havaKodu: 'unknown' };
  }, [filtrelenmisVeriler]);

  // Event handlers
  const handleVeriSil = async (id: string) => {
    if (!canDelete) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }

    try {
      await deleteDoc(doc(db, 'uretimVerileri', id));
      toast.success('Üretim verisi başarıyla silindi');
      setUretimVerileri(prev => prev.filter(veri => veri.id !== id));
      setSilmeOnayModalAcik(false);
      setSilinecekVeriId(null);
    } catch (error) {
      console.error('Veri silme hatası:', error);
      toast.error('Veri silinirken bir hata oluştu');
    }
  };

  const handleYenile = async () => {
    setYenileniyor(true);
    
    try {
      // Santralleri yeniden getir
      if (kullanici?.companyId) {
        let santralQuery;

        if (kullanici.rol === 'musteri') {
          const sahaIds = getMusteriSahaIds();
          if (sahaIds.length > 0) {
            santralQuery = query(
              collection(db, 'santraller'),
              where('__name__', 'in', sahaIds.slice(0, 10)),
              orderBy('ad')
            );

            const snapshot = await getDocs(santralQuery);
            const santralListesi = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Santral[];

            setSantraller(santralListesi);
          }
        } else {
          santralQuery = query(
            collection(db, 'santraller'),
            where('companyId', '==', kullanici.companyId),
            orderBy('ad')
          );

          const snapshot = await getDocs(santralQuery);
          const santralListesi = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Santral[];

          setSantraller(santralListesi);
        }
      }

      toast.success('Veriler başarıyla yenilendi');
    } catch (error) {
      console.error('Yenileme hatası:', error);
      toast.error('Veriler yenilenirken bir hata oluştu');
    }

    setYenileniyor(false);
  };

  const handleExcelExport = () => {
    try {
      if (filtrelenmisVeriler.length === 0) {
        toast.error('Dışa aktarılacak veri bulunamadı');
        return;
      }

      const excelData = filtrelenmisVeriler.map(veri => {
        const santral = santraller.find(s => s.id === veri.santralId);
        return {
          'Santral': santral?.ad || 'Bilinmiyor',
          'Tarih': format(veri.tarih.toDate(), 'dd.MM.yyyy'),
          'Günlük Üretim (kWh)': veri.gunlukUretim,
          'Anlık Güç (kW)': veri.anlikGuc,
          'Performans Oranı (%)': veri.performansOrani.toFixed(2),
          'Gelir (₺)': veri.gelir.toFixed(2),
          'Dağıtım Bedeli (₺)': veri.dagitimBedeli.toFixed(2),
          'CO2 Tasarrufu (kg)': veri.tasarrufEdilenCO2.toFixed(2),
          'Sıcaklık (°C)': veri.hava.sicaklik,
          'Nem (%)': veri.hava.nem,
          'Radyasyon (W/m²)': veri.hava.radyasyon
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Üretim Verileri');

      const dosyaAdi = `Uretim_Verileri_${format(new Date(), 'dd_MM_yyyy')}.xlsx`;
      XLSX.writeFile(workbook, dosyaAdi);
      toast.success('Excel dosyası başarıyla indirildi');
    } catch (error) {
      console.error('Excel dışa aktarma hatası:', error);
      toast.error('Excel dosyası oluşturulurken bir hata oluştu');
    }
  };

  const handleVeriDetayGoster = (veri: UretimVerisi) => {
    setSecilenVeriDetay(veri);
    setDetayModalAcik(true);
  };

  if (yukleniyor) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (santraller.length === 0 && kullanici?.rol !== 'musteri') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Üretim Verileri</h1>
            <p className="mt-1 text-sm text-gray-500">Santral üretim performans analizi</p>
          </div>
        </div>

        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <Sun className="h-20 w-20 text-yellow-400 mb-6" />
              <div className="absolute -top-2 -right-2 h-6 w-6 bg-orange-500 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Santral Bulunamadı</h3>
            <p className="text-gray-600 text-center max-w-md mb-6">
              Henüz hiç santral kaydı bulunmuyor. Üretim verilerini analiz etmek için önce santrallerinizi sisteme eklemelisiniz.
            </p>
            {canAdd && (
              <button
                onClick={() => navigate('/ges-yonetimi')}
                className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 transition-all duration-200"
              >
                <Plus className="h-5 w-5 mr-2" />
                İlk Santralı Ekle
              </button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Üst Başlık ve Kontroller */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl shadow-lg border border-blue-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center">
            <div className="relative">
              <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mr-6 shadow-lg">
                <BarChart2 className="h-10 w-10 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 h-5 w-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                <Activity className="h-3 w-3 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Üretim Verileri</h1>
              <p className="text-gray-600">
                {santraller.length} santral • {dashboardStats.aktifSantralSayisi} aktif santral
              </p>
            </div>
          </div>

          {/* Hava Durumu Göstergesi */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Thermometer className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-gray-900">{havaVerileri.sicaklik}°C</p>
                <p className="text-gray-500">Nem: %{havaVerileri.nem}</p>
              </div>
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Sun className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-gray-900">{havaVerileri.radyasyon} W/m²</p>
                <p className="text-gray-500">Radyasyon</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtre ve Kontrol Çubuğu */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* Santral Seçimi */}
          <div className="flex items-center space-x-2">
            <Building className="h-4 w-4 text-gray-500" />
            <select
              value={secilenSantral}
              onChange={(e) => setSecilenSantral(e.target.value)}
              className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm min-w-[180px] bg-white"
            >
              <option value="tumu">Tüm Santraller</option>
              {santraller.map(santral => (
                <option key={santral.id} value={santral.id}>{santral.ad}</option>
              ))}
            </select>
          </div>

          {/* Tarih Aralığı */}
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <select
              value={secilenTarihAraligi}
              onChange={(e) => setSecilenTarihAraligi(e.target.value as any)}
              className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="gunluk">Bugün</option>
              <option value="haftalik">Son 7 Gün</option>
              <option value="aylik">Aylık</option>
              <option value="yillik">Yıllık</option>
            </select>
          </div>

          {/* Ay/Yıl Seçimi - Sadece aylık/yıllık görünümde */}
          {(secilenTarihAraligi === 'aylik' || secilenTarihAraligi === 'yillik') && (
            <>
              <select
                value={secilenYil}
                onChange={(e) => setSecilenYil(parseInt(e.target.value))}
                className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                {yilSecenekleri.map(yil => (
                  <option key={yil} value={yil}>{yil}</option>
                ))}
              </select>

              {secilenTarihAraligi === 'aylik' && (
                <select
                  value={secilenAy}
                  onChange={(e) => setSecilenAy(parseInt(e.target.value))}
                  className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                  {aySecenekleri.map(ay => (
                    <option key={ay.value} value={ay.value}>{ay.label}</option>
                  ))}
                </select>
              )}
            </>
          )}

          {/* Arama */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Filtre Butonu */}
          <button
            onClick={() => setFiltreAcik(!filtreAcik)}
            className={`inline-flex items-center px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              filtreAcik || performansFiltresi !== 'tumu'
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtrele
            {(performansFiltresi !== 'tumu') && (
              <Badge className="ml-2" color="blue">1</Badge>
            )}
          </button>

          {/* Görünüm Seçenekleri */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setGoruntulemeSecenegi('kartlar')}
              className={`px-3 py-2 text-sm font-medium ${
                goruntulemeSecenegi === 'kartlar'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <BarChart2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setGoruntulemeSecenegi('tablo')}
              className={`px-3 py-2 text-sm font-medium border-l border-gray-300 ${
                goruntulemeSecenegi === 'tablo'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FileText className="h-4 w-4" />
            </button>
            <button
              onClick={() => setGoruntulemeSecenegi('grafik')}
              className={`px-3 py-2 text-sm font-medium border-l border-gray-300 ${
                goruntulemeSecenegi === 'grafik'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
            </button>
          </div>

          <div className="flex space-x-2 ml-auto">
            <button
              onClick={handleYenile}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              disabled={yenileniyor}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${yenileniyor ? 'animate-spin' : ''}`} />
              Yenile
            </button>

            <button
              onClick={handleExcelExport}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Excel
            </button>

            {canAdd && (
              <button
                onClick={() => setImportModalAcik(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Veri Ekle
              </button>
            )}
          </div>
        </div>

        {/* Gelişmiş Filtreler */}
        {filtreAcik && (
          <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Performans:</label>
                <select
                  value={performansFiltresi}
                  onChange={(e) => setPerformansFiltresi(e.target.value as any)}
                  className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                  <option value="tumu">Tüm Performans</option>
                  <option value="yuksek">Yüksek (≥%20)</option>
                  <option value="orta">Orta (%15-%20)</option>
                  <option value="dusuk">Düşük (&lt;%15)</option>
                </select>
              </div>

              <button
                onClick={() => {
                  setPerformansFiltresi('tumu');
                  setSearchTerm('');
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Filtreleri Temizle
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dashboard Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card decoration="top" decorationColor="yellow" className="bg-gradient-to-br from-yellow-50 to-orange-50">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Toplam Üretim</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                {dashboardStats.toplamUretim.toLocaleString('tr-TR')} kWh
              </Metric>
              <Text className="text-xs text-gray-500 mt-1">
                Günlük ort: {dashboardStats.gunlukOrtalama.toLocaleString('tr-TR', {maximumFractionDigits: 0})} kWh
              </Text>
            </div>
            <div className="p-3 bg-yellow-100 rounded-xl">
              <Battery className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </Card>

        <Card decoration="top" decorationColor="green" className="bg-gradient-to-br from-green-50 to-emerald-50">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Ortalama Performans</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                %{dashboardStats.ortalamaPerformans.toFixed(1)}
              </Metric>
              <Text className="text-xs text-gray-500 mt-1">
                En yüksek: {dashboardStats.enYuksekUretim.toLocaleString('tr-TR')} kWh
              </Text>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </Card>

        <Card decoration="top" decorationColor="blue" className="bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Toplam Gelir</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                ₺{dashboardStats.toplamGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
              </Metric>
              <Text className="text-xs text-gray-500 mt-1">
                Bu dönem
              </Text>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card decoration="top" decorationColor="emerald" className="bg-gradient-to-br from-emerald-50 to-teal-50">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">CO₂ Tasarrufu</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                {(dashboardStats.toplamCO2 / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} ton
              </Metric>
              <Text className="text-xs text-gray-500 mt-1">
                {dashboardStats.toplamCO2.toLocaleString('tr-TR', {maximumFractionDigits: 0})} kg CO₂
              </Text>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl">
              <Leaf className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Ana İçerik */}
      {goruntulemeSecenegi === 'grafik' && grafikVerileri.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <Title>Günlük Üretim Trendi</Title>
            <AreaChart
              className="mt-4 h-80"
              data={grafikVerileri}
              index="date"
              categories={["uretim"]}
              colors={["yellow"]}
              valueFormatter={(value) => `${value.toLocaleString('tr-TR')} kWh`}
              showAnimation={animasyonAktif}
              showGradient={true}
            />
          </Card>

          <Card>
            <Title>Performans Analizi</Title>
            <LineChart
              className="mt-4 h-80"
              data={grafikVerileri}
              index="date"
              categories={["performans"]}
              colors={["blue"]}
              valueFormatter={(value) => `%${value.toFixed(1)}`}
              showAnimation={animasyonAktif}
            />
          </Card>

          <Card>
            <Title>Gelir Analizi</Title>
            <BarChart
              className="mt-4 h-80"
              data={grafikVerileri}
              index="date"
              categories={["gelir"]}
              colors={["green"]}
              valueFormatter={(value) => `₺${value.toLocaleString('tr-TR')}`}
              showAnimation={animasyonAktif}
            />
          </Card>

          <Card>
            <Title>CO₂ Tasarrufu</Title>
            <AreaChart
              className="mt-4 h-80"
              data={grafikVerileri}
              index="date"
              categories={["co2"]}
              colors={["emerald"]}
              valueFormatter={(value) => `${value.toFixed(1)} kg`}
              showAnimation={animasyonAktif}
              showGradient={true}
            />
          </Card>
        </div>
      )}

      {/* Kartlar Görünümü */}
      {goruntulemeSecenegi === 'kartlar' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtrelenmisVeriler.length === 0 ? (
            <div className="col-span-full">
              <Card className="bg-gray-50">
                <div className="text-center py-12">
                  <Zap className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <Text className="text-gray-500 text-lg">Seçilen kriterlere uygun veri bulunamadı</Text>
                  {canAdd && (
                    <button
                      onClick={() => setImportModalAcik(true)}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Veri Ekle
                    </button>
                  )}
                </div>
              </Card>
            </div>
          ) : (
            filtrelenmisVeriler.map((veri) => {
              const santral = santraller.find(s => s.id === veri.santralId);
              return (
                <Card key={veri.id} className="hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                      onClick={() => handleVeriDetayGoster(veri)}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <Text className="text-sm font-medium text-gray-600">
                        {format(veri.tarih.toDate(), 'dd MMMM yyyy', { locale: tr })}
                      </Text>
                      <Title className="text-lg font-bold text-gray-900">
                        {santral?.ad || 'Bilinmiyor'}
                      </Title>
                    </div>
                    <Badge
                      color={
                        veri.performansOrani >= 20 ? "green" :
                        veri.performansOrani >= 15 ? "yellow" :
                        "red"
                      }
                    >
                      %{veri.performansOrani.toFixed(1)}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Battery className="h-4 w-4 text-yellow-500 mr-2" />
                        <Text className="text-sm text-gray-600">Üretim</Text>
                      </div>
                      <Text className="font-semibold text-gray-900">
                        {veri.gunlukUretim.toLocaleString('tr-TR')} kWh
                      </Text>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 text-green-500 mr-2" />
                        <Text className="text-sm text-gray-600">Gelir</Text>
                      </div>
                      <Text className="font-semibold text-gray-900">
                        ₺{veri.gelir.toLocaleString('tr-TR')}
                      </Text>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Leaf className="h-4 w-4 text-emerald-500 mr-2" />
                        <Text className="text-sm text-gray-600">CO₂ Tasarrufu</Text>
                      </div>
                      <Text className="font-semibold text-gray-900">
                        {veri.tasarrufEdilenCO2.toFixed(1)} kg
                      </Text>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Sıcaklık: {veri.hava.sicaklik}°C</span>
                        <span>Nem: %{veri.hava.nem}</span>
                        <span>Radyasyon: {veri.hava.radyasyon} W/m²</span>
                      </div>
                    </div>
                  </div>

                  {canDelete && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSilinecekVeriId(veri.id);
                          setSilmeOnayModalAcik(true);
                        }}
                        className="text-red-600 hover:text-red-800 text-sm flex items-center"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Sil
                      </button>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Tablo Görünümü */}
      {goruntulemeSecenegi === 'tablo' && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <Title>Detaylı Üretim Verileri</Title>
            <Text>{filtrelenmisVeriler.length} kayıt</Text>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Santral / Tarih
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Üretim (kWh)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Performans (%)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gelir (₺)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CO₂ (kg)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hava Koşulları
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtrelenmisVeriler.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                      <Zap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      Seçilen kriterlere uygun veri bulunamadı
                    </td>
                  </tr>
                ) : (
                  filtrelenmisVeriler.map((veri) => {
                    const santral = santraller.find(s => s.id === veri.santralId);
                    return (
                      <tr key={veri.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {santral?.ad || 'Bilinmiyor'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {format(veri.tarih.toDate(), 'dd MMMM yyyy', { locale: tr })}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">
                            {veri.gunlukUretim.toLocaleString('tr-TR')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {veri.anlikGuc} kW
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge
                            color={
                              veri.performansOrani >= 20 ? "green" :
                              veri.performansOrani >= 15 ? "yellow" :
                              "red"
                            }
                          >
                            %{veri.performansOrani.toFixed(1)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">
                            ₺{veri.gelir.toLocaleString('tr-TR')}
                          </div>
                          <div className="text-xs text-gray-500">
                            Dağıtım: ₺{veri.dagitimBedeli.toLocaleString('tr-TR')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {veri.tasarrufEdilenCO2.toFixed(1)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs text-gray-500">
                            <div>{veri.hava.sicaklik}°C, %{veri.hava.nem}</div>
                            <div>{veri.hava.radyasyon} W/m²</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleVeriDetayGoster(veri)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Detayları Görüntüle"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => {
                                  setSilinecekVeriId(veri.id);
                                  setSilmeOnayModalAcik(true);
                                }}
                                className="text-red-600 hover:text-red-900"
                                title="Sil"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Detay Modal */}
      {detayModalAcik && secilenVeriDetay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Üretim Verisi Detayı</h3>
                <button
                  onClick={() => setDetayModalAcik(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Temel Bilgiler */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Text className="text-sm font-medium text-gray-600">Santral</Text>
                    <Text className="text-lg font-semibold text-gray-900">
                      {santraller.find(s => s.id === secilenVeriDetay.santralId)?.ad || 'Bilinmiyor'}
                    </Text>
                  </div>
                  <div>
                    <Text className="text-sm font-medium text-gray-600">Tarih</Text>
                    <Text className="text-lg font-semibold text-gray-900">
                      {format(secilenVeriDetay.tarih.toDate(), 'dd MMMM yyyy', { locale: tr })}
                    </Text>
                  </div>
                </div>

                {/* Üretim Bilgileri */}
                <div className="bg-yellow-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Üretim Bilgileri</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Text className="text-sm text-gray-600">Günlük Üretim</Text>
                      <Text className="text-xl font-bold text-yellow-600">
                        {secilenVeriDetay.gunlukUretim.toLocaleString('tr-TR')} kWh
                      </Text>
                    </div>
                    <div>
                      <Text className="text-sm text-gray-600">Anlık Güç</Text>
                      <Text className="text-xl font-bold text-yellow-600">
                        {secilenVeriDetay.anlikGuc.toLocaleString('tr-TR')} kW
                      </Text>
                    </div>
                    <div>
                      <Text className="text-sm text-gray-600">Performans Oranı</Text>
                      <Text className="text-xl font-bold text-yellow-600">
                        %{secilenVeriDetay.performansOrani.toFixed(2)}
                      </Text>
                    </div>
                  </div>
                </div>

                {/* Finansal Bilgiler */}
                <div className="bg-green-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Finansal Bilgiler</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Text className="text-sm text-gray-600">Günlük Gelir</Text>
                      <Text className="text-xl font-bold text-green-600">
                        ₺{secilenVeriDetay.gelir.toLocaleString('tr-TR')}
                      </Text>
                    </div>
                    <div>
                      <Text className="text-sm text-gray-600">Dağıtım Bedeli</Text>
                      <Text className="text-xl font-bold text-green-600">
                        ₺{secilenVeriDetay.dagitimBedeli.toLocaleString('tr-TR')}
                      </Text>
                    </div>
                  </div>
                </div>

                {/* Çevresel Etki */}
                <div className="bg-emerald-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Çevresel Etki</h4>
                  <div>
                    <Text className="text-sm text-gray-600">CO₂ Tasarrufu</Text>
                    <Text className="text-xl font-bold text-emerald-600">
                      {secilenVeriDetay.tasarrufEdilenCO2.toFixed(2)} kg
                    </Text>
                    <Text className="text-sm text-gray-500">
                      ({(secilenVeriDetay.tasarrufEdilenCO2 / 1000).toFixed(3)} ton CO₂)
                    </Text>
                  </div>
                </div>

                {/* Hava Koşulları */}
                <div className="bg-blue-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Hava Koşulları</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <Thermometer className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                      <Text className="text-lg font-bold text-blue-600">
                        {secilenVeriDetay.hava.sicaklik}°C
                      </Text>
                      <Text className="text-sm text-gray-600">Sıcaklık</Text>
                    </div>
                    <div className="text-center">
                      <Cloud className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                      <Text className="text-lg font-bold text-blue-600">
                        %{secilenVeriDetay.hava.nem}
                      </Text>
                      <Text className="text-sm text-gray-600">Nem</Text>
                    </div>
                    <div className="text-center">
                      <Sun className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                      <Text className="text-lg font-bold text-yellow-600">
                        {secilenVeriDetay.hava.radyasyon} W/m²
                      </Text>
                      <Text className="text-sm text-gray-600">Radyasyon</Text>
                    </div>
                  </div>
                </div>

                {/* Meta Bilgiler */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Kayıt Bilgileri</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Text className="text-sm text-gray-600">Oluşturan</Text>
                      <Text className="font-semibold text-gray-900">
                        {secilenVeriDetay.olusturanKisi.ad}
                      </Text>
                    </div>
                    <div>
                      <Text className="text-sm text-gray-600">Oluşturulma Tarihi</Text>
                      <Text className="font-semibold text-gray-900">
                        {format(secilenVeriDetay.olusturmaTarihi.toDate(), 'dd.MM.yyyy HH:mm', { locale: tr })}
                      </Text>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                {canDelete && (
                  <button
                    onClick={() => {
                      setSilinecekVeriId(secilenVeriDetay.id);
                      setSilmeOnayModalAcik(true);
                      setDetayModalAcik(false);
                    }}
                    className="px-4 py-2 border border-red-300 rounded-lg text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2 inline" />
                    Sil
                  </button>
                )}
                <button
                  onClick={() => setDetayModalAcik(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modaller */}
      {importModalAcik && santraller.length > 0 && (
        <BulkImportModal
          onClose={() => setImportModalAcik(false)}
          santralId={secilenSantral !== 'tumu' ? secilenSantral : santraller[0].id}
          santralKapasite={secilenSantral !== 'tumu' 
            ? santraller.find(s => s.id === secilenSantral)?.kapasite || 0
            : santraller[0].kapasite
          }
          onSuccess={handleYenile}
          secilenSantral={secilenSantral !== 'tumu' 
            ? santraller.find(s => s.id === secilenSantral) || santraller[0]
            : santraller[0]
          }
        />
      )}

      {silmeOnayModalAcik && (
        <SilmeOnayModal
          onConfirm={() => silinecekVeriId && handleVeriSil(silinecekVeriId)}
          onCancel={() => {
            setSilmeOnayModalAcik(false);
            setSilinecekVeriId(null);
          }}
          mesaj="Bu üretim verisini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        />
      )}
    </div>
  );
};
