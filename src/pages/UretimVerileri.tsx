import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';
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
  MapPin
} from 'lucide-react';
import { Card, Title, Text, AreaChart, BarChart, Metric, Flex, ProgressBar, Grid, Col, Badge } from '@tremor/react';
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
  };
  panelSayisi: number;
  inverterSayisi: number;
}

export const UretimVerileri: React.FC = () => {
  const { kullanici } = useAuth();
  const navigate = useNavigate();
  const [uretimVerileri, setUretimVerileri] = useState<UretimVerisi[]>([]);
  const [santraller, setSantraller] = useState<Santral[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [secilenSantral, setSecilenSantral] = useState<string>('');
  const [secilenYil, setSecilenYil] = useState<number>(new Date().getFullYear());
  const [secilenAy, setSecilenAy] = useState<number>(new Date().getMonth());
  const [importModalAcik, setImportModalAcik] = useState(false);
  const [silmeOnayModalAcik, setSilmeOnayModalAcik] = useState(false);
  const [silinecekVeriId, setSilinecekVeriId] = useState<string | null>(null);
  const [aylikSilmeModalAcik, setAylikSilmeModalAcik] = useState(false);
  const [detayliTablo, setDetayliTablo] = useState(false);
  const [santralDetay, setSantralDetay] = useState<Santral | null>(null);
  const [yillikGrafik, setYillikGrafik] = useState(true);

  // Yıl seçenekleri
  const yilSecenekleri = Array.from({ length: 9 }, (_, i) => 2022 + i);

  // Ay seçenekleri
  const aySecenekleri = [
    { value: 0, label: 'Ocak' },
    { value: 1, label: 'Şubat' },
    { value: 2, label: 'Mart' },
    { value: 3, label: 'Nisan' },
    { value: 4, label: 'Mayıs' },
    { value: 5, label: 'Haziran' },
    { value: 6, label: 'Temmuz' },
    { value: 7, label: 'Ağustos' },
    { value: 8, label: 'Eylül' },
    { value: 9, label: 'Ekim' },
    { value: 10, label: 'Kasım' },
    { value: 11, label: 'Aralık' }
  ];

  const canAdd = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis', 'superadmin'].includes(kullanici.rol);
  const canDelete = kullanici?.rol === 'yonetici' || kullanici?.rol === 'superadmin';

  // Santralleri getir
  useEffect(() => {
    const santralleriGetir = async () => {
      if (!kullanici?.companyId) return;

      try {
        setYukleniyor(true);

        let santralQuery;
        if (kullanici.rol === 'musteri') {
          // Müşteri için sahalar kontrolü
          let sahaIds: string[] = [];

          if (kullanici.sahalar) {
            if (Array.isArray(kullanici.sahalar)) {
              sahaIds = kullanici.sahalar;
            } else if (typeof kullanici.sahalar === 'object') {
              sahaIds = Object.keys(kullanici.sahalar).filter(key => kullanici.sahalar[key] === true);
            }
          }

          console.log('UretimVerileri - Müşteri saha IDs:', sahaIds);
          console.log('UretimVerileri - kullanici.sahalar raw:', kullanici.sahalar);

        if (sahaIds.length === 0) {
          console.log('Müşterinin sahası yok, boş liste döndürülüyor');
          setSantraller([]);
          return;
        }

          santralQuery = query(
            collection(db, 'santraller'),
            where('__name__', 'in', sahaIds.slice(0, 10)) // Firestore limiti 10
          );
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

        if (!secilenSantral && santralListesi.length > 0) {
          setSecilenSantral(santralListesi[0].id);
          setSantralDetay(santralListesi[0]);
        } else if (secilenSantral) {
          const seciliSantral = santralListesi.find(s => s.id === secilenSantral);
          if (seciliSantral) {
            setSantralDetay(seciliSantral);
          }
        }
      } catch (error) {
        console.error('Santraller getirilemedi:', error);
        toast.error('Santraller yüklenirken bir hata oluştu');
      } finally {
        setYukleniyor(false);
      }
    };

    santralleriGetir();
  }, [kullanici, secilenSantral]);

  // Üretim verilerini getir
  useEffect(() => {
    const verileriGetir = async () => {
      if (!secilenSantral) {
        setUretimVerileri([]);
        return;
      }

      try {
        setYukleniyor(true);

        // Seçilen yıl ve ay için tarih aralığı
        const ayBaslangic = new Date(secilenYil, secilenAy, 1);
        const ayBitis = endOfMonth(ayBaslangic);

        let uretimQuery;

        // Müşteri rol kontrolü
        if (kullanici?.rol === 'musteri') {
          // Müşteri için sadece kendi santrallerinin verilerini getir
          let sahaIds: string[] = [];

          if (kullanici.sahalar) {
            if (Array.isArray(kullanici.sahalar)) {
              sahaIds = kullanici.sahalar.filter(id => id && id.trim() !== '');
            } else if (typeof kullanici.sahalar === 'object') {
              sahaIds = Object.keys(kullanici.sahalar).filter(key => kullanici.sahalar[key] === true && key && key.trim() !== '');
            }
          }

          console.log('UretimVerileri - Üretim sorgusu için saha IDs:', sahaIds);
          console.log('UretimVerileri - Seçilen santral:', secilenSantral);

          if (sahaIds.length === 0 || !sahaIds.includes(secilenSantral)) {
            console.log('Müşteri bu santralin verilerine erişemiyor');
            setUretimVerileri([]);
            setYukleniyor(false);
            return;
          }

          // Müşteri için sadece santral ID'si ile sorgu
          uretimQuery = query(
            collection(db, 'uretimVerileri'),
            where('santralId', '==', secilenSantral),
            orderBy('tarih', 'desc')
          );
        } else {
          // Diğer roller için companyId ile sorgu
          if (!kullanici?.companyId) {
            setUretimVerileri([]);
            setYukleniyor(false);
            return;
          }

          uretimQuery = query(
            collection(db, 'uretimVerileri'),
            where('santralId', '==', secilenSantral),
            where('companyId', '==', kullanici.companyId),
            orderBy('tarih', 'desc')
          );
        }

        const snapshot = await getDocs(uretimQuery);
        const tumVeriler = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UretimVerisi[];

        console.log('UretimVerileri - Toplam bulunan veri sayısı:', tumVeriler.length);

        // Manuel tarih filtreleme
        const filtreliVeriler = tumVeriler.filter(veri => {
          try {
            const veriTarih = veri.tarih.toDate();
            const tarihKontrol = veriTarih >= ayBaslangic && veriTarih <= ayBitis;
            console.log('Veri tarihi:', format(veriTarih, 'dd.MM.yyyy'), 'Kontrol:', tarihKontrol);
            return tarihKontrol;
          } catch (err) {
            console.error('Tarih dönüştürme hatası:', err);
            return false;
          }
        });

        console.log('UretimVerileri - Filtrelenmiş veri sayısı:', filtreliVeriler.length);
        setUretimVerileri(filtreliVeriler.sort((a, b) => a.tarih.toDate().getTime() - b.tarih.toDate().getTime()));
      } catch (error) {
        console.error('Üretim verileri getirilemedi:', error);
        toast.error('Üretim verileri yüklenirken bir hata oluştu');
        setUretimVerileri([]);
      } finally {
        setYukleniyor(false);
      }
    };

    if (santraller.length > 0) {
      verileriGetir();
    }
  }, [secilenSantral, secilenYil, secilenAy, kullanici, santraller]);

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

  const handleAylikSil = async () => {
    if (!canDelete) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }

    if (!secilenSantral || !kullanici?.companyId) {
      toast.error('Santral seçili değil');
      return;
    }

    try {
      // Ayın tüm verilerini sil
      const silmePromises = uretimVerileri.map(veri => 
        deleteDoc(doc(db, 'uretimVerileri', veri.id))
      );

      await Promise.all(silmePromises);
      toast.success(`${aySecenekleri[secilenAy].label} ${secilenYil} ayının tüm verileri başarıyla silindi`);

      setUretimVerileri([]);
      setAylikSilmeModalAcik(false);
    } catch (error) {
      console.error('Aylık veri silme hatası:', error);
      toast.error('Aylık veriler silinirken bir hata oluştu');
    }
  };

  const handleYenile = async () => {
    setYenileniyor(true);
    try {
      // Sadece verileri yeniden getir, sayfa yenilemeyi önle
      if (!secilenSantral) {
        setUretimVerileri([]);
        return;
      }

      // Seçilen yıl ve ay için tarih aralığı
      const ayBaslangic = new Date(secilenYil, secilenAy, 1);
      const ayBitis = endOfMonth(ayBaslangic);

      let uretimQuery;

      // Müşteri rol kontrolü
      if (kullanici?.rol === 'musteri') {
        // Müşteri için sadece kendi santrallerinin verilerini getir
        let sahaIds: string[] = [];

        if (kullanici.sahalar) {
          if (Array.isArray(kullanici.sahalar)) {
            sahaIds = kullanici.sahalar.filter(id => id && id.trim() !== '');
          } else if (typeof kullanici.sahalar === 'object') {
            sahaIds = Object.keys(kullanici.sahalar).filter(key => kullanici.sahalar[key] === true && key && key.trim() !== '');
          }
        }

        if (sahaIds.length === 0 || !sahaIds.includes(secilenSantral)) {
          setUretimVerileri([]);
          setYenileniyor(false);
          return;
        }

        // Müşteri için sadece santral ID'si ile sorgu
        uretimQuery = query(
          collection(db, 'uretimVerileri'),
          where('santralId', '==', secilenSantral),
          orderBy('tarih', 'desc')
        );
      } else {
        if (!kullanici?.companyId) {
          setUretimVerileri([]);
          setYenileniyor(false);
          return;
        }

        uretimQuery = query(
          collection(db, 'uretimVerileri'),
          where('santralId', '==', secilenSantral),
          where('companyId', '==', kullanici.companyId),
          orderBy('tarih', 'desc')
        );
      }

      const snapshot = await getDocs(uretimQuery);
      const tumVeriler = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UretimVerisi[];

      // Manuel tarih filtreleme
      const filtreliVeriler = tumVeriler.filter(veri => {
        try {
          const veriTarih = veri.tarih.toDate();
          return veriTarih >= ayBaslangic && veriTarih <= ayBitis;
        } catch (err) {
          return false;
        }
      });

      setUretimVerileri(filtreliVeriler.sort((a, b) => a.tarih.toDate().getTime() - b.tarih.toDate().getTime()));
      toast.success('Veriler başarıyla yenilendi');
    } catch (error) {
      console.error('Veri yenileme hatası:', error);
      toast.error('Veriler yenilenirken bir hata oluştu');
    } finally {
      setYenileniyor(false);
    }
  };

  const handleExcelExport = () => {
    try {
      if (uretimVerileri.length === 0) {
        toast.error('Dışa aktarılacak veri bulunamadı');
        return;
      }

      const excelData = uretimVerileri.map(veri => ({
        'Tarih': format(veri.tarih.toDate(), 'dd.MM.yyyy'),
        'Günlük Üretim (kWh)': veri.gunlukUretim,
        'Kapasite Faktörü (%)': veri.performansOrani.toFixed(2),
        'CO2 Tasarrufu (kg)': veri.tasarrufEdilenCO2.toFixed(2),
        'Gelir (₺)': veri.gelir.toFixed(2),
        'Dağıtım Bedeli (₺)': veri.dagitimBedeli.toFixed(2)
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Üretim Verileri');

      const santralAdi = santralDetay?.ad || 'Santral';
      const dosyaAdi = `${santralAdi}_Uretim_${secilenYil}_${aySecenekleri[secilenAy].label}.xlsx`;

      XLSX.writeFile(workbook, dosyaAdi);
      toast.success('Excel dosyası başarıyla indirildi');
    } catch (error) {
      console.error('Excel dışa aktarma hatası:', error);
      toast.error('Excel dosyası oluşturulurken bir hata oluştu');
    }
  };

  // İstatistikler hesapla
  const hesaplaIstatistikler = () => {
    if (!uretimVerileri.length || !santralDetay) return null;

    const toplamUretim = uretimVerileri.reduce((acc, veri) => acc + veri.gunlukUretim, 0);
    const toplamCO2 = uretimVerileri.reduce((acc, veri) => acc + veri.tasarrufEdilenCO2, 0);

    const aylar = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik'];
    const aylikHedef = santralDetay.aylikHedefler?.[aylar[secilenAy]] || (santralDetay.yillikHedefUretim / 12);

    const hedefGerceklesme = aylikHedef > 0 ? (toplamUretim / aylikHedef) * 100 : 0;
    const ortalamaKapasiteFaktoru = uretimVerileri.reduce((acc, veri) => acc + veri.performansOrani, 0) / uretimVerileri.length;

    const grafikVerileri = uretimVerileri.map(veri => ({
      date: format(veri.tarih.toDate(), 'dd MMM', { locale: tr }),
      uretim: veri.gunlukUretim,
      kapasiteFaktoru: veri.performansOrani
    }));

    return {
      toplamUretim,
      toplamCO2,
      aylikHedef,
      hedefGerceklesme,
      ortalamaKapasiteFaktoru,
      grafikVerileri
    };
  };

  // Yıllık veriler için ayrı bir hesaplama
  const [yillikVeriler, setYillikVeriler] = useState<any[]>([]);

  useEffect(() => {
    const yillikVerileriGetir = async () => {
      if (!secilenSantral || !santralDetay) return;

      try {
        // Seçilen yıl için tüm ayların verilerini getir
        const yilBaslangic = new Date(secilenYil, 0, 1);
        const yilBitis = new Date(secilenYil, 11, 31);

        let uretimQuery;

        // Müşteri rol kontrolü
        if (kullanici?.rol === 'musteri') {
          // Müşteri için sadece kendi santrallerinin verilerini getir
          let sahaIds: string[] = [];

          if (kullanici.sahalar) {
            if (Array.isArray(kullanici.sahalar)) {
              sahaIds = kullanici.sahalar.filter(id => id && id.trim() !== '');
            } else if (typeof kullanici.sahalar === 'object') {
              sahaIds = Object.keys(kullanici.sahalar).filter(key => kullanici.sahalar[key] === true && key && key.trim() !== '');
            }
          }

          if (sahaIds.length === 0 || !sahaIds.includes(secilenSantral)) {
            setYillikVeriler([]);
            return;
          }

          uretimQuery = query(
            collection(db, 'uretimVerileri'),
            where('santralId', '==', secilenSantral),
            orderBy('tarih', 'desc')
          );
        } else {
          if (!kullanici?.companyId) {
            setYillikVeriler([]);
            return;
          }

          uretimQuery = query(
            collection(db, 'uretimVerileri'),
            where('santralId', '==', secilenSantral),
            where('companyId', '==', kullanici.companyId),
            orderBy('tarih', 'desc')
          );
        }

        const snapshot = await getDocs(uretimQuery);
        const tumVeriler = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UretimVerisi[];

        // Yıllık veriler için filtreleme
        const yillikFiltreliVeriler = tumVeriler.filter(veri => {
          try {
            const veriTarih = veri.tarih.toDate();
            return veriTarih >= yilBaslangic && veriTarih <= yilBitis;
          } catch (err) {
            return false;
          }
        });

        // Aylık gruplandırma
        const aylikGruplar: Record<number, number> = {};
        yillikFiltreliVeriler.forEach(veri => {
          const ay = veri.tarih.toDate().getMonth();
          if (!aylikGruplar[ay]) aylikGruplar[ay] = 0;
          aylikGruplar[ay] += veri.gunlukUretim;
        });

        // Grafik verilerini hazırla
        const yillikGrafikVerileri = aySecenekleri.map((ay, index) => {
          const gercekUretim = aylikGruplar[index] || 0;
          const hedefUretim = santralDetay.aylikHedefler?.[['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik'][index]] || (santralDetay.yillikHedefUretim / 12);

          return {
            ay: ay.label,
            gercekUretim,
            hedefUretim,
            fark: gercekUretim - hedefUretim
          };
        });

        setYillikVeriler(yillikGrafikVerileri);
      } catch (error) {
        console.error('Yıllık veriler getirilemedi:', error);
      }
    };

    if (yillikGrafik && santraller.length > 0) {
      yillikVerileriGetir();
    }
  }, [secilenSantral, secilenYil, kullanici, santralDetay, yillikGrafik, santraller]);

  const istatistikler = hesaplaIstatistikler();

    // Santral kapasitesi yoksa uyarı göster
    if (santralDetay && santralDetay.kapasite === 0) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Üretim Verileri</h1>
              <p className="mt-1 text-sm text-gray-500">
                {santralDetay.ad} santralinin üretim verileri
              </p>
            </div>
          </div>

          <Card className="bg-yellow-50 border-yellow-200">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-yellow-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-yellow-800">Santral Kapasitesi Tanımlanmamış</h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Bu santral için kapasite bilgisi tanımlanmamış. Performans hesaplamaları için santral kapasitesinin tanımlanması gerekiyor.
                </p>
                {canAdd && (
                  <button
                    onClick={() => navigate('/ges-yonetimi')}
                    className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200"
                  >
                    <ArrowRight className="h-4 w-4 mr-1.5" />
                    Santral Yönetimine Git
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
      );
    }

  if (yukleniyor) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (santraller.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Üretim Verileri</h1>
            <p className="mt-1 text-sm text-gray-500">Santral üretim verileri</p>
          </div>
        </div>

        <Card className="bg-yellow-50 border-yellow-200">
          <div className="flex flex-col items-center justify-center py-12">
            <Sun className="h-16 w-16 text-yellow-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">Santral Bulunamadı</h3>
            <p className="text-gray-500 text-center max-w-md">
              Henüz hiç santral kaydı bulunmuyor. Üretim verilerini görmek için önce bir santral eklemelisiniz.
            </p>
            {canAdd && (
              <button
                onClick={() => navigate('/ges-yonetimi')}
                className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Santral Ekle
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl mr-4">
              <BarChart2 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Üretim Verileri</h1>
              <p className="text-gray-600 mt-1">
                {santralDetay?.ad} santralinin üretim performansı ve analizi
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Santral:</label>
              <select
                value={secilenSantral}
                onChange={(e) => setSecilenSantral(e.target.value)}
                className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm min-w-[150px]"
              >
                {santraller.map(santral => (
                  <option key={santral.id} value={santral.id}>{santral.ad}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Yıl:</label>
              <select
                value={secilenYil}
                onChange={(e) => setSecilenYil(parseInt(e.target.value))}
                className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                {yilSecenekleri.map(yil => (
                  <option key={yil} value={yil}>{yil}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Ay:</label>
              <select
                value={secilenAy}
                onChange={(e) => setSecilenAy(parseInt(e.target.value))}
                className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                {aySecenekleri.map(ay => (
                  <option key={ay.value} value={ay.value}>{ay.label}</option>
                ))}
              </select>
            </div>

            <div className="flex space-x-2 ml-auto">
              <button
                onClick={() => navigate('/ges-yonetimi')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <Building className="h-4 w-4 mr-2" />
                Santral Yönetimi
              </button>

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

              {canDelete && uretimVerileri.length > 0 && (
                <button
                  onClick={() => setAylikSilmeModalAcik(true)}
                  className="inline-flex items-center px-3 py-2 border border-red-300 rounded-lg shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Aylık Sil
                </button>
              )}

              {canAdd && (
                <button
                  onClick={() => setImportModalAcik(true)}
                  className="inline-flex items-center px-3 pyy-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Veri Ekle
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Santral Bilgileri */}
      {santralDetay && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-none shadow-md">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center mb-4 lg:mb-0">
              <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl mr-4">
                <Sun className="h-10 w-10 text-white" />
              </div>
              <div>
                <Title className="text-xl text-gray-900">{santralDetay.ad}</Title>
                <Text className="text-blue-700 font-medium">
                  {santralDetay.kapasite} kWp kurulu güç • {santralDetay.panelSayisi} Panel • {santralDetay.inverterSayisi} İnvertör
                </Text>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:flex lg:flex-wrap gap-3">
              <div className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-100">
                <div className="flex items-center mb-1">
                  <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                  <p className="text-xs text-gray-500 font-medium">Kurulum Tarihi</p>
                </div>
                <p className="text-sm font-bold text-gray-900">
                  {format(santralDetay.kurulumTarihi.toDate(), 'dd MMM yyyy', { locale: tr })}
                </p>
              </div>
              <div className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-100">
                <div className="flex items-center mb-1">
                  <Target className="h-4 w-4 text-gray-500 mr-2" />
                  <p className="text-xs text-gray-500 font-medium">Yıllık Hedef</p>
                </div>
                <p className="text-sm font-bold text-gray-900">{santralDetay.yillikHedefUretim.toLocaleString('tr-TR')} kWh</p>
              </div>
              <div className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-100">
                <div className="flex items-center mb-1">
                  <MapPin className="h-4 w-4 text-gray-500 mr-2" />
                  <p className="text-xs text-gray-500 font-medium">Konum</p>
                </div>
                <p className="text-sm font-bold text-gray-900 truncate max-w-[150px]">{santralDetay.konum.adres}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Aylık Özet Kartları */}
      {istatistikler && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card decoration="top" decorationColor="yellow">
            <div className="flex items-center justify-between">
              <div>
                <Text className="text-sm">Aylık Üretim</Text>
                <Metric>{istatistikler.toplamUretim.toLocaleString('tr-TR')} kWh</Metric>
                <Text className="text-xs text-gray-500 mt-1">
                  Hedef: {istatistikler.aylikHedef.toLocaleString('tr-TR')} kWh
                </Text>
              </div>
              <div className="rounded-full p-3 bg-yellow-100">
                <Battery className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <ProgressBar 
              value={Math.min(istatistikler.hedefGerceklesme, 100)} 
              color={istatistikler.hedefGerceklesme >= 100 ? "green" : istatistikler.hedefGerceklesme >= 75 ? "yellow" : "orange"} 
              className="mt-3" 
            />
            <Text className="text-right text-xs mt-1">
              %{istatistikler.hedefGerceklesme.toFixed(1)} gerçekleşme
            </Text>
          </Card>

          <Card decoration="top" decorationColor="emerald">
            <div className="flex items-center justify-between">
              <div>
                <Text className="text-sm">CO2 Tasarrufu</Text>
                <Metric>{istatistikler.toplamCO2.toLocaleString('tr-TR', {maximumFractionDigits: 0})} kg</Metric>
                <Text className="text-xs text-gray-500 mt-1">
                  {(istatistikler.toplamCO2 / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 2})} ton CO2
                </Text>
              </div>
              <div className="rounded-full p-3 bg-emerald-100">
                <Leaf className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </Card>

          <Card decoration="top" decorationColor="blue">
            <div className="flex items-center justify-between">
              <div>
                <Text className="text-sm">Kapasite Faktörü</Text>
                <Metric>%{istatistikler.ortalamaKapasiteFaktoru.toFixed(1)}</Metric>
                <Text className="text-xs text-gray-500 mt-1">
                  Ortalama kapasite faktörü
                </Text>
              </div>
              <div className="rounded-full p-3 bg-blue-100">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Grafik Geçiş Butonları */}
      <div className="flex justify-center mb-6">
        <div className="bg-white rounded-lg p-1 shadow-sm border border-gray-200 inline-flex">
          <button
            onClick={() => setYillikGrafik(false)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              !yillikGrafik 
                ? 'bg-blue-500 text-white shadow-sm' 
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Aylık Detay
          </button>
          <button
            onClick={() => setYillikGrafik(true)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              yillikGrafik 
                ? 'bg-blue-500 text-white shadow-sm' 
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Yıllık Tahmin-Gerçekleşme
          </button>
        </div>
      </div>

      {/* Aylık Üretim Grafiği */}
      {!yillikGrafik && istatistikler && istatistikler.grafikVerileri.length > 0 && (
        <Card>
          <Title>Günlük Üretim Detayı - {aySecenekleri[secilenAy].label} {secilenYil}</Title>
          <Text>Günlük üretim performansı</Text>
          <AreaChart
            className="mt-4 h-80"
            data={istatistikler.grafikVerileri}
            index="date"
            categories={["uretim"]}
            colors={["yellow"]}
            valueFormatter={(value) => `${value.toLocaleString('tr-TR')} kWh`}
            showLegend={true}
            showAnimation={true}
            showGradient={true}
            yAxisWidth={80}
          />
        </Card>
      )}

      {/* Yıllık Tahmin-Gerçekleşme Grafiği */}
      {yillikGrafik && yillikVeriler.length > 0 && (
        <Card>
          <Title>Yıllık Tahmin vs Gerçekleşme - {secilenYil}</Title>
          <Text>Aylık hedef ve gerçekleşen üretim karşılaştırması</Text>
          <AreaChart
            className="mt-4 h-80"
            data={yillikVeriler}
            index="ay"
            categories={["hedefUretim", "gercekUretim"]}
            colors={["blue", "green"]}
            valueFormatter={(value) => `${value.toLocaleString('tr-TR')} kWh`}
            showLegend={true}
            showAnimation={true}
            showGradient={true}
            yAxisWidth={80}
            curveType="natural"
            connectNulls={true}
            customTooltip={(props) => {
              const { payload, active } = props;
              if (!active || !payload) return null;

              const data = payload[0]?.payload;
              const hedef = data?.hedefUretim || 0;
              const gercek = data?.gercekUretim || 0;
              const fark = data?.fark || 0;
              const yuzde = hedef > 0 ? ((gercek / hedef) * 100).toFixed(1) : '0';

              return (
                <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                  <div className="text-sm font-medium text-gray-900 mb-2">{data?.ay}</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                        <span className="text-xs text-gray-600">Hedef:</span>
                      </div>
                      <span className="text-xs font-medium">{hedef.toLocaleString('tr-TR')} kWh</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                        <span className="text-xs text-gray-600">Gerçekleşen:</span>
                      </div>
                      <span className="text-xs font-medium">{gercek.toLocaleString('tr-TR')} kWh</span>
                    </div>
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">Gerçekleşme:</span>
                        <span className={`text-xs font-medium ${parseFloat(yuzde) >= 100 ? 'text-green-600' : parseFloat(yuzde) >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                          %{yuzde}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">Fark:</span>
                        <span className={`text-xs font-medium ${fark >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {fark >= 0 ? '+' : ''}{fark.toLocaleString('tr-TR')} kWh
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }}
          />
        </Card>
      )}

      {/* Detaylı Tablo */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <Title>Üretim Verileri Tablosu</Title>
          <button
            onClick={() => setDetayliTablo(!detayliTablo)}
            className="text-sm text-primary-600 hover:text-primary-800 flex items-center"
          >
            {detayliTablo ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Tabloyu Gizle
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Detaylı Tabloyu Göster
              </>
            )}
          </button>
        </div>

        {detayliTablo && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tarih
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Günlük Üretim (kWh)
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kapasite Faktörü (%)
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CO₂ Tasarrufu (kg)
                  </th>
                  {canDelete && (
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İşlemler
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {uretimVerileri.length === 0 ? (
                  <tr>
                    <td colSpan={canDelete ? 5 : 4} className="px-6 py-4 text-center text-sm text-gray-500">
                      Bu ay için üretim verisi bulunamadı
                    </td>
                  </tr>
                ) : (
                  uretimVerileri.map((veri) => (
                    <tr key={veri.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(veri.tarih.toDate(), 'dd MMMM yyyy', { locale: tr })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {veri.gunlukUretim.toLocaleString('tr-TR')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          veri.performansOrani >= 20 ? 'bg-green-100 text-green-800' :
                          veri.performansOrani >= 15 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          %{veri.performansOrani.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {veri.tasarrufEdilenCO2.toLocaleString('tr-TR', {maximumFractionDigits: 1})}
                      </td>
                      {canDelete && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => {
                              setSilinecekVeriId(veri.id);
                              setSilmeOnayModalAcik(true);
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!detayliTablo && uretimVerileri.length === 0 && (
          <div className="py-12 text-center">
            <Zap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <Text className="text-gray-500">Bu ay için üretim verisi bulunamadı</Text>
            {canAdd && (
              <button
                onClick={() => setImportModalAcik(true)}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Veri Ekle
              </button>
            )}
          </div>
        )}
      </Card>

      {/* Toplu Veri İçe Aktarma Modalı */}
      {importModalAcik && santralDetay && (
        <BulkImportModal
          onClose={() => setImportModalAcik(false)}
          santralId={secilenSantral}
          santralKapasite={santralDetay.kapasite}
          onSuccess={handleYenile}
          secilenSantral={santralDetay}
        />
      )}

      {/* Silme Onay Modalı */}
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

      {/* Aylık Silme Onay Modalı */}
      {aylikSilmeModalAcik && (
        <SilmeOnayModal
          onConfirm={handleAylikSil}
          onCancel={() => setAylikSilmeModalAcik(false)}
          mesaj={`${aySecenekleri[secilenAy].label} ${secilenYil} ayının tüm üretim verilerini (${uretimVerileri.length} adet) silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
        />
      )}
    </div>
  );
};