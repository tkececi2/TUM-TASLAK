import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfMonth, endOfMonth, subDays, addDays, isSameDay, startOfYear, endOfYear, getMonth } from 'date-fns';
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
  X,
  PieChart,
  TrendingDown
} from 'lucide-react';
import { Card, Title, Text, AreaChart, BarChart, LineChart, Metric, Flex, ProgressBar, Grid, Col, Badge, BadgeDelta, DonutChart } from '@tremor/react';
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

interface PerformansAnalizi {
  yillikHedefGerceklesme: number;
  aylikHedefGerceklesme: number;
  toplamGerceklesenUretim: number;
  toplamHedefUretim: number;
  aylikGerceklesenUretim: number;
  aylikHedefUretim: number;
  performansTrendi: 'yukselen' | 'dusen' | 'sabit';
  hedefeFark: number;
  gelirAnalizi: {
    toplamGelir: number;
    toplamDagitimBedeli: number;
    netGelir: number;
    ortalamaBirimFiyat: number;
  };
}

interface AylikVeri {
  ay: string;
  ayIndex: number;
  hedefUretim: number;
  gerceklesenUretim: number;
  gerceklesmeOrani: number;
  gelir: number;
  dagitimBedeli: number;
  netGelir: number;
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
  const [secilenTarihAraligi, setSecilenTarihAraligi] = useState<'aylik' | 'yillik'>('yillik');
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

    console.log('UretimVerileri - Müşteri saha verisi kontrolü:', {
      userId: kullanici.id,
      sahalar: kullanici.sahalar,
      santraller: kullanici.santraller,
      atananSahalar: kullanici.atananSahalar,
      atananSantraller: kullanici.atananSantraller
    });

    let sahaIds: string[] = [];

    // Tüm olası alanları kontrol et ve birleştir
    const possibleFields = [
      kullanici.sahalar,
      kullanici.santraller,
      kullanici.atananSahalar,
      kullanici.atananSantraller
    ];

    for (const field of possibleFields) {
      if (field) {
        if (Array.isArray(field)) {
          const validIds = field.filter(id => id && typeof id === 'string' && id.trim() !== '');
          sahaIds = [...sahaIds, ...validIds];
        } else if (typeof field === 'object' && field !== null) {
          const validIds = Object.keys(field).filter(key => 
            field[key] === true && key && key.trim() !== ''
          );
          sahaIds = [...sahaIds, ...validIds];
        }
      }
    }

    // Tekrarları kaldır
    sahaIds = [...new Set(sahaIds)];

    console.log('UretimVerileri - Müşteri erişebilir saha/santral IDs:', sahaIds);

    if (sahaIds.length === 0) {
      console.warn('UretimVerileri - Müşteriye atanmış santral bulunamadı!');
      console.warn('Müşteri yönetimi sayfasından bu müşteriye santral ataması yapın.');
    }

    return sahaIds;
  };

  // Elektrik fiyatlarını hesapla
  const getElektrikFiyatlari = (santral: Santral, tarih: Date) => {
    const yil = tarih.getFullYear().toString();
    const ay = (tarih.getMonth() + 1).toString().padStart(2, '0');

    const fiyatlar = santral.elektrikFiyatlari?.[yil]?.[ay] || {
      birimFiyat: 1.5, // Varsayılan fiyat
      dagitimBedeli: 0.3 // Varsayılan dağıtım bedeli
    };

    return fiyatlar;
  };

  // Santralleri getir
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
      console.log('Santraller güncellendi:', santralListesi.length);
    } catch (error) {
      console.error('Santral getirme hatası:', error);
      toast.error('Santraller yüklenirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    santralleriGetir();
  }, [kullanici]);

  // Sayfa odaklandığında verileri yenile (başka sekmeden dönüldüğünde)
  useEffect(() => {
    const handleFocus = () => {
      if (!yukleniyor && !yenileniyor && santraller.length > 0) {
        console.log('Sayfa odaklandı, santral verilerini yenileniyor...');
        santralleriGetir();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [yukleniyor, yenileniyor, santraller.length]);

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

        if (secilenTarihAraligi === 'yillik') {
          tarihBaslangic = startOfYear(new Date(secilenYil, 0, 1));
          tarihBitis = endOfYear(new Date(secilenYil, 0, 1));
        } else {
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
            if (!sahaIds.includes(secilenSantral)) {
              console.warn('Seçilen santral müşteriye ait değil:', secilenSantral);
              setUretimVerileri([]);
              return;
            }

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

  // Performans analizi hesaplama
  const performansAnalizi = useMemo((): PerformansAnalizi => {
    const secilenSantralData = secilenSantral !== 'tumu' 
      ? santraller.find(s => s.id === secilenSantral)
      : null;

    const filtrelenmisVeriler = secilenSantral !== 'tumu'
      ? uretimVerileri.filter(v => v.santralId === secilenSantral)
      : uretimVerileri;

    // Yıllık hedef ve gerçekleşme
    const yillikHedef = secilenSantralData?.yillikHedefUretim || 
      santraller.reduce((total, s) => total + (s.yillikHedefUretim || 0), 0);

    const toplamGerceklesen = filtrelenmisVeriler.reduce((total, v) => total + v.gunlukUretim, 0);

    // Aylık hedef ve gerçekleşme (sadece aylık görünümde)
    let aylikHedef = 0;
    let aylikGerceklesen = 0;

    if (secilenTarihAraligi === 'aylik') {
      const aylikHedefKey = `${secilenYil}-${(secilenAy + 1).toString().padStart(2, '0')}`;
      aylikHedef = secilenSantralData?.aylikHedefler?.[aylikHedefKey] || (yillikHedef / 12);

      aylikGerceklesen = filtrelenmisVeriler
        .filter(v => {
          const veriTarihi = v.tarih.toDate();
          return veriTarihi.getFullYear() === secilenYil && veriTarihi.getMonth() === secilenAy;
        })
        .reduce((total, v) => total + v.gunlukUretim, 0);
    }

    // Gelir analizi
    const toplamGelir = filtrelenmisVeriler.reduce((total, v) => total + v.gelir, 0);
    const toplamDagitimBedeli = filtrelenmisVeriler.reduce((total, v) => total + v.dagitimBedeli, 0);

    // Performans trendi hesaplama
    const sonAyVerileri = filtrelenmisVeriler.slice(0, 30);
    const oncekiAyVerileri = filtrelenmisVeriler.slice(30, 60);
    const sonAyOrtalama = sonAyVerileri.length > 0 ? 
      sonAyVerileri.reduce((total, v) => total + v.gunlukUretim, 0) / sonAyVerileri.length : 0;
    const oncekiAyOrtalama = oncekiAyVerileri.length > 0 ? 
      oncekiAyVerileri.reduce((total, v) => total + v.gunlukUretim, 0) / oncekiAyVerileri.length : 0;

    let performansTrendi: 'yukselen' | 'dusen' | 'sabit' = 'sabit';
    if (sonAyOrtalama > oncekiAyOrtalama * 1.05) {
      performansTrendi = 'yukselen';
    } else if (sonAyOrtalama < oncekiAyOrtalama * 0.95) {
      performansTrendi = 'dusen';
    }

    return {
      yillikHedefGerceklesme: yillikHedef > 0 ? (toplamGerceklesen / yillikHedef) * 100 : 0,
      aylikHedefGerceklesme: aylikHedef > 0 ? (aylikGerceklesen / aylikHedef) * 100 : 0,
      toplamGerceklesenUretim: toplamGerceklesen,
      toplamHedefUretim: yillikHedef,
      aylikGerceklesenUretim: aylikGerceklesen,
      aylikHedefUretim: aylikHedef,
      performansTrendi,
      hedefeFark: toplamGerceklesen - yillikHedef,
      gelirAnalizi: {
        toplamGelir,
        toplamDagitimBedeli,
        netGelir: toplamGelir - toplamDagitimBedeli,
        ortalamaBirimFiyat: toplamGerceklesen > 0 ? toplamGelir / toplamGerceklesen : 0
      }
    };
  }, [uretimVerileri, santraller, secilenSantral, secilenYil, secilenAy, secilenTarihAraligi]);

  // Aylık karşılaştırma verileri
  const aylikKarsilastirmaVerileri = useMemo((): AylikVeri[] => {
    const secilenSantralData = secilenSantral !== 'tumu' 
      ? santraller.find(s => s.id === secilenSantral)
      : null;

    const yillikHedef = secilenSantralData?.yillikHedefUretim || 
      santraller.reduce((total, s) => total + (s.yillikHedefUretim || 0), 0);

    return aySecenekleri.map(ay => {
      const ayBaslangic = new Date(secilenYil, ay.value, 1);
      const ayBitis = endOfMonth(ayBaslangic);

      const ayVerileri = uretimVerileri.filter(v => {
        const veriTarihi = v.tarih.toDate();
        return veriTarihi >= ayBaslangic && veriTarihi <= ayBitis &&
          (secilenSantral === 'tumu' || v.santralId === secilenSantral);
      });

      const gerceklesenUretim = ayVerileri.reduce((total, v) => total + v.gunlukUretim, 0);
      const aylikHedefKey = `${secilenYil}-${(ay.value + 1).toString().padStart(2, '0')}`;
      const hedefUretim = secilenSantralData?.aylikHedefler?.[aylikHedefKey] || (yillikHedef / 12);

      const gelir = ayVerileri.reduce((total, v) => total + v.gelir, 0);
      const dagitimBedeli = ayVerileri.reduce((total, v) => total + v.dagitimBedeli, 0);

      return {
        ay: ay.label,
        ayIndex: ay.value,
        hedefUretim,
        gerceklesenUretim,
        gerceklesmeOrani: hedefUretim > 0 ? (gerceklesenUretim / hedefUretim) * 100 : 0,
        gelir,
        dagitimBedeli,
        netGelir: gelir - dagitimBedeli
      };
    });
  }, [uretimVerileri, santraller, secilenSantral, secilenYil]);

  // Grafik verileri
  const yillikGrafikVerileri = useMemo(() => {
    return aylikKarsilastirmaVerileri.map(veri => ({
      ay: veri.ay,
      hedefUretim: veri.hedefUretim,
      gerceklesenUretim: veri.gerceklesenUretim,
      gerceklesmeOrani: veri.gerceklesmeOrani,
      gelir: veri.gelir,
      netGelir: veri.netGelir
    }));
  }, [aylikKarsilastirmaVerileri]);

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
      // Santral verilerini yenile
      await santralleriGetir();
      
      // Üretim verilerini de tetikle (useEffect dependency'leri sayesinde otomatik çalışacak)
      // Bu sayede hem santral bilgileri hem de hesaplamalar güncellenecek
      
      toast.success('Veriler başarıyla yenilendi');
    } catch (error) {
      console.error('Yenileme hatası:', error);
      toast.error('Veriler yenilenirken bir hata oluştu');
    }

    setYenileniyor(false);
  };

  const handleExcelExport = () => {
    try {
      if (yillikGrafikVerileri.length === 0) {
        toast.error('Dışa aktarılacak veri bulunamadı');
        return;
      }

      const excelData = yillikGrafikVerileri.map(veri => ({
        'Ay': veri.ay,
        'Hedef Üretim (kWh)': veri.hedefUretim.toFixed(0),
        'Gerçekleşen Üretim (kWh)': veri.gerceklesenUretim.toFixed(0),
        'Gerçekleşme Oranı (%)': veri.gerceklesmeOrani.toFixed(1),
        'Toplam Gelir (₺)': veri.gelir.toFixed(2),
        'Net Gelir (₺)': veri.netGelir.toFixed(2)
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Hedef vs Gerçekleşen');

      const dosyaAdi = `Hedef_Gerceklesen_Analizi_${secilenYil}.xlsx`;
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
            <h1 className="text-2xl font-bold text-gray-900">Hedef vs Gerçekleşen Üretim</h1>
            <p className="mt-1 text-sm text-gray-500">Santral performans analizi</p>
          </div>
        </div>

        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <Target className="h-20 w-20 text-yellow-400 mb-6" />
              <div className="absolute -top-2 -right-2 h-6 w-6 bg-orange-500 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Santral Bulunamadı</h3>
            <p className="text-gray-600 text-center max-w-md mb-6">
              Henüz hiç santral kaydı bulunmuyor. Hedef karşılaştırma analizi yapmak için önce santrallerinizi sisteme eklemelisiniz.
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
                <Target className="h-10 w-10 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 h-5 w-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                <TrendingUp className="h-3 w-3 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Hedef vs Gerçekleşen Üretim</h1>
              <p className="text-gray-600">
                {santraller.length} santral • Performans analizi ve maliyet hesaplaması
              </p>
            </div>
          </div>

          {/* Hızlı İstatistikler */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">
                  %{performansAnalizi.yillikHedefGerceklesme.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">Yıllık</div>
              </div>
              <div className="w-px h-8 bg-gray-200"></div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">
                  ₺{performansAnalizi.gelirAnalizi.netGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                </div>
                <div className="text-xs text-gray-500">Net Gelir</div>
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
              <option value="yillik">Yıllık Analiz</option>
              <option value="aylik">Aylık Detay</option>
            </select>
          </div>

          {/* Yıl Seçimi */}
          <select
            value={secilenYil}
            onChange={(e) => setSecilenYil(parseInt(e.target.value))}
            className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          >
            {yilSecenekleri.map(yil => (
              <option key={yil} value={yil}>{yil}</option>
            ))}
          </select>

          {/* Ay Seçimi - Sadece aylık görünümde */}
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
      </div>

      {/* Ana Performans Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card decoration="top" decorationColor="blue" className="bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Yıllık Hedef Gerçekleşme</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                %{performansAnalizi.yillikHedefGerceklesme.toFixed(1)}
              </Metric>
              <div className="mt-2">
                <ProgressBar 
                  value={performansAnalizi.yillikHedefGerceklesme} 
                  color={performansAnalizi.yillikHedefGerceklesme >= 90 ? "green" : 
                         performansAnalizi.yillikHedefGerceklesme >= 70 ? "yellow" : "red"}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card decoration="top" decorationColor="green" className="bg-gradient-to-br from-green-50 to-emerald-50">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Toplam Üretim</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                {(performansAnalizi.toplamGerceklesenUretim / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
              </Metric>
              <div className="flex items-center mt-1">
                <Badge 
                  color={performansAnalizi.performansTrendi === 'yukselen' ? "green" : 
                         performansAnalizi.performansTrendi === 'dusen' ? "red" : "yellow"}
                  className="text-xs"
                >
                  {performansAnalizi.performansTrendi === 'yukselen' ? 'Yükseliş' : 
                   performansAnalizi.performansTrendi === 'dusen' ? 'Düşüş' : 'Sabit'}
                </Badge>
              </div>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <Battery className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </Card>

        <Card decoration="top" decorationColor="amber" className="bg-gradient-to-br from-amber-50 to-yellow-50">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Net Gelir</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                ₺{performansAnalizi.gelirAnalizi.netGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
              </Metric>
              <Text className="text-xs text-gray-500 mt-1">
                Ort. fiyat: ₺{performansAnalizi.gelirAnalizi.ortalamaBirimFiyat.toFixed(3)}/kWh
              </Text>
            </div>
            <div className="p-3 bg-amber-100 rounded-xl">
              <DollarSign className="h-8 w-8 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card decoration="top" decorationColor="emerald" className="bg-gradient-to-br from-emerald-50 to-teal-50">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Dağıtım Bedeli</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                ₺{performansAnalizi.gelirAnalizi.toplamDagitimBedeli.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
              </Metric>
              <Text className="text-xs text-gray-500 mt-1">
                Toplam gelirin %{((performansAnalizi.gelirAnalizi.toplamDagitimBedeli / performansAnalizi.gelirAnalizi.toplamGelir) * 100).toFixed(1)}'i
              </Text>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl">
              <TrendingDown className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Ana Grafik Alanı */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Yıllık Hedef vs Gerçekleşen Grafiği */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <Title>Aylık Hedef vs Gerçekleşen Üretim</Title>
            <Badge color="blue" className="text-xs">
              {secilenYil}
            </Badge>
          </div>
          <AreaChart
            className="mt-4 h-80"
            data={yillikGrafikVerileri}
            index="ay"
            categories={["hedefUretim", "gerceklesenUretim"]}
            colors={["blue", "green"]}
            valueFormatter={(value) => `${(value / 1000).toFixed(1)} MWh`}
            showAnimation={true}
            showGradient={true}
            showLegend={true}
            customTooltip={(props) => {
              const { payload, active } = props;
              if (!active || !payload) return null;

              const data = payload[0]?.payload;
              if (!data) return null;

              return (
                <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                  <div className="text-sm font-medium text-gray-900 mb-2">{data.ay} {secilenYil}</div>
                  <div className="space-y-1">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                      <span className="text-xs text-gray-600">Hedef:</span>
                      <span className="ml-1 text-xs font-medium">
                        {(data.hedefUretim / 1000).toFixed(1)} MWh
                      </span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                      <span className="text-xs text-gray-600">Gerçekleşen:</span>
                      <span className="ml-1 text-xs font-medium">
                        {(data.gerceklesenUretim / 1000).toFixed(1)} MWh
                      </span>
                    </div>
                    <div className="border-t pt-1 mt-2">
                      <span className="text-xs text-gray-600">Gerçekleşme: </span> 
                      <span className={`text-xs font-medium ${
                        data.gerceklesmeOrani >= 90 ? 'text-green-600' : 
                        data.gerceklesmeOrani >= 70 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        %{data.gerceklesmeOrani.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }}
          />
        </Card>

        {/* Gelir Analizi Grafiği */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <Title>Aylık Gelir ve Maliyet Analizi</Title>
            <Badge color="green" className="text-xs">
              Net: ₺{performansAnalizi.gelirAnalizi.netGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
            </Badge>
          </div>
          <BarChart
            className="mt-4 h-80"
            data={yillikGrafikVerileri}
            index="ay"
            categories={["gelir", "netGelir"]}
            colors={["amber", "green"]}
            valueFormatter={(value) => `₺${value.toLocaleString('tr-TR', {maximumFractionDigits: 0})}`}
            showAnimation={true}
            showLegend={true}
          />
        </Card>
      </div>

      {/* Detay Tablolar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aylık Performans Tablosu */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <Title>Aylık Performans Detayı</Title>
            <Text>{aylikKarsilastirmaVerileri.filter(v => v.gerceklesenUretim > 0).length} aktif ay</Text>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ay</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hedef</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gerçekleşen</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Oran</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {aylikKarsilastirmaVerileri.map((veri) => (
                  <tr key={veri.ay} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{veri.ay}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {(veri.hedefUretim / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {(veri.gerceklesenUretim / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge
                        color={veri.gerceklesmeOrani >= 90 ? "green" : 
                               veri.gerceklesmeOrani >= 70 ? "yellow" : "red"}
                        className="text-xs"
                      >
                        %{veri.gerceklesmeOrani.toFixed(1)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Finansal Detay */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <Title>Aylık Finansal Detay</Title>
            <Text>₺{performansAnalizi.gelirAnalizi.toplamGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})} toplam</Text>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ay</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gelir</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Dağıtım</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {aylikKarsilastirmaVerileri.map((veri) => (
                  <tr key={veri.ay} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{veri.ay}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      ₺{veri.gelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">
                      ₺{veri.dagitimBedeli.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                      ₺{veri.netGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Performans Özeti */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <Title>Yıllık Performans Özeti</Title>
          <div className="flex items-center space-x-2">
            <Badge 
              color={performansAnalizi.hedefeFark >= 0 ? "green" : "red"}
              className="text-sm"
            >
              {performansAnalizi.hedefeFark >= 0 ? '+' : ''}
              {(performansAnalizi.hedefeFark / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
            </Badge>
            <Text className="text-sm text-gray-500">hedefe göre</Text>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900">Üretim Performansı</h4>
              <Target className="h-6 w-6 text-blue-600" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Hedef</span>
                <span className="font-medium">
                  {(performansAnalizi.toplamHedefUretim / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Gerçekleşen</span>
                <span className="font-medium">
                  {(performansAnalizi.toplamGerceklesenUretim / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Başarı Oranı</span>
                <Badge 
                  color={performansAnalizi.yillikHedefGerceklesme >= 90 ? "green" : 
                         performansAnalizi.yillikHedefGerceklesme >= 70 ? "yellow" : "red"}
                >
                  %{performansAnalizi.yillikHedefGerceklesme.toFixed(1)}
                </Badge>
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900">Finansal Performans</h4>
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Toplam Gelir</span>
                <span className="font-medium">
                  ₺{performansAnalizi.gelirAnalizi.toplamGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Dağıtım Bedeli</span>
                <span className="font-medium text-red-600">
                  ₺{performansAnalizi.gelirAnalizi.toplamDagitimBedeli.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Net Gelir</span>
                <span className="font-medium text-green-600">
                  ₺{performansAnalizi.gelirAnalizi.netGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900">Maliyet Analizi</h4>
              <BarChart2 className="h-6 w-6 text-amber-600" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Birim Fiyat</span>
                <span className="font-medium">
                  ₺{performansAnalizi.gelirAnalizi.ortalamaBirimFiyat.toFixed(3)}/kWh
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Dağıtım Oranı</span>
                <span className="font-medium">
                  %{((performansAnalizi.gelirAnalizi.toplamDagitimBedeli / performansAnalizi.gelirAnalizi.toplamGelir) * 100).toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Net Marj</span>
                <span className="font-medium text-green-600">
                  %{((performansAnalizi.gelirAnalizi.netGelir / performansAnalizi.gelirAnalizi.toplamGelir) * 100).toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

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
                    <Trash2 classNameName="h-4 w-4 mr-2 inline" />
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