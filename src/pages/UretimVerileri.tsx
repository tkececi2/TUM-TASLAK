import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfMonth, endOfMonth, subDays, addDays, isSameDay, startOfYear, endOfYear, getMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Target, 
  Calendar, 
  Download, 
  Trash2, 
  Plus, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  BarChart2,
  Building,
  Filter,
  Eye,
  Activity,
  X,
  PieChart,
  Zap,
  ArrowUp,
  ArrowDown,
  Minus,
  Leaf,
  Edit2
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
  aylikHedefler?: {
    ocak: number;
    subat: number;
    mart: number;
    nisan: number;
    mayis: number;
    haziran: number;
    temmuz: number;
    agustos: number;
    eylul: number;
    ekim: number;
    kasim: number;
    aralik: number;
  };
  kurulumTarihi: Timestamp;
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

interface PerformansOzeti {
  toplamHedef: number;
  toplamGerceklesen: number;
  basariOrani: number;
  ortalamaBirimFiyat: number;
  aktifSantralSayisi: number;
  veriGunSayisi: number;
  toplamCO2Tasarrufu: number;
}

interface AylikVeri {
  ay: string;
  ayIndex: number;
  hedef: number;
  gerceklesen: number;
  basariOrani: number;
  co2Tasarrufu: number;
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
  const [goruntulemeSecenegi, setGoruntulemeSecenegi] = useState<'yillik' | 'aylik'>('yillik');

  // Modal states
  const [importModalAcik, setImportModalAcik] = useState(false);
  const [silmeOnayModalAcik, setSilmeOnayModalAcik] = useState(false);
  const [silinecekVeriId, setSilinecekVeriId] = useState<string | null>(null);
  const [detayModalAcik, setDetayModalAcik] = useState(false);
  const [secilenVeriDetay, setSecilenVeriDetay] = useState<UretimVerisi | null>(null);

  // Yıl seçenekleri
  const yilSecenekleri = Array.from({ length: 10 }, (_, i) => 2020 + i);
  const aylar = [
    { key: 'ocak', label: 'Ocak', index: 0 },
    { key: 'subat', label: 'Şubat', index: 1 },
    { key: 'mart', label: 'Mart', index: 2 },
    { key: 'nisan', label: 'Nisan', index: 3 },
    { key: 'mayis', label: 'Mayıs', index: 4 },
    { key: 'haziran', label: 'Haziran', index: 5 },
    { key: 'temmuz', label: 'Temmuz', index: 6 },
    { key: 'agustos', label: 'Ağustos', index: 7 },
    { key: 'eylul', label: 'Eylül', index: 8 },
    { key: 'ekim', label: 'Ekim', index: 9 },
    { key: 'kasim', label: 'Kasım', index: 10 },
    { key: 'aralik', label: 'Aralık', index: 11 }
  ];

  // İzinler
  const canAdd = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis', 'superadmin'].includes(kullanici.rol);
  const canDelete = kullanici?.rol === 'yonetici' || kullanici?.rol === 'superadmin';
  const canEdit = kullanici?.rol && ['yonetici', 'muhendis', 'superadmin'].includes(kullanici.rol);

  // Müşteri sahalarını normalize et
  const getMusteriSahaIds = (): string[] => {
    if (!kullanici || kullanici.rol !== 'musteri') return [];

    let sahaIds: string[] = [];
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

    return [...new Set(sahaIds)];
  };

  // Santral hedef bilgilerini getir
  const getSantralHedef = (santral: Santral, ayIndex?: number) => {
    if (ayIndex !== undefined && santral.aylikHedefler) {
      const ayKey = aylar[ayIndex]?.key;
      return santral.aylikHedefler[ayKey] || (santral.yillikHedefUretim / 12);
    }
    return santral.yillikHedefUretim;
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

        if (sahaIds.length === 0) {
          setSantraller([]);
          setYukleniyor(false);
          return;
        }

        const allSantraller: Santral[] = [];

        for (let i = 0; i < sahaIds.length; i += 10) {
          const batch = sahaIds.slice(i, i + 10);

          try {
            const batchQuery = query(
              collection(db, 'santraller'),
              where('__name__', 'in', batch)
            );

            const batchSnapshot = await getDocs(batchQuery);
            const batchSantraller = batchSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Santral[];

            allSantraller.push(...batchSantraller);
          } catch (batchError) {
            console.error(`Batch sorgu hatası:`, batchError);
          }
        }

        setSantraller(allSantraller);
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

  // Üretim verilerini getir
  useEffect(() => {
    const verileriGetir = async () => {
      if (!kullanici?.companyId || santraller.length === 0) {
        setUretimVerileri([]);
        return;
      }

      try {
        const tarihBaslangic = startOfYear(new Date(secilenYil, 0, 1));
        const tarihBitis = endOfYear(new Date(secilenYil, 0, 1));

        let uretimQuery;

        if (kullanici.rol === 'musteri') {
          const sahaIds = getMusteriSahaIds();

          if (sahaIds.length === 0) {
            setUretimVerileri([]);
            return;
          }

          if (secilenSantral !== 'tumu') {
            if (!sahaIds.includes(secilenSantral)) {
              setUretimVerileri([]);
              return;
            }

            uretimQuery = query(
              collection(db, 'uretimVerileri'),
              where('companyId', '==', kullanici.companyId),
              where('santralId', '==', secilenSantral),
              where('tarih', '>=', Timestamp.fromDate(tarihBaslangic)),
              where('tarih', '<=', Timestamp.fromDate(tarihBitis)),
              orderBy('tarih', 'desc')
            );
          } else {
            const limitedSahaIds = sahaIds.slice(0, 10);

            uretimQuery = query(
              collection(db, 'uretimVerileri'),
              where('companyId', '==', kullanici.companyId),
              where('santralId', 'in', limitedSahaIds),
              where('tarih', '>=', Timestamp.fromDate(tarihBaslangic)),
              where('tarih', '<=', Timestamp.fromDate(tarihBitis)),
              orderBy('tarih', 'desc')
            );
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

        const snapshot = await getDocs(uretimQuery);
        const veriler = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UretimVerisi[];

        setUretimVerileri(veriler);
      } catch (error) {
        console.error('Üretim verileri getirme hatası:', error);
        toast.error('Üretim verileri yüklenirken bir hata oluştu');
        setUretimVerileri([]);
      }
    };

    if (santraller.length > 0) {
      verileriGetir();
    }
  }, [secilenSantral, secilenYil, santraller, kullanici]);

  // Performans özetini hesapla
  const performansOzeti = useMemo((): PerformansOzeti => {
    const filtrelenmisVeriler = secilenSantral !== 'tumu'
      ? uretimVerileri.filter(v => v.santralId === secilenSantral)
      : uretimVerileri;

    const ilgiliSantraller = secilenSantral !== 'tumu' 
      ? santraller.filter(s => s.id === secilenSantral)
      : santraller;

    // Hedef hesaplama
    const toplamHedef = ilgiliSantraller.reduce((total, santral) => {
      return total + (santral.yillikHedefUretim || 0);
    }, 0);

    // Gerçekleşen hesaplama
    const toplamGerceklesen = filtrelenmisVeriler.reduce((total, veri) => {
      return total + veri.gunlukUretim;
    }, 0);

    // CO2 tasarrufu hesaplama
    const toplamCO2Tasarrufu = filtrelenmisVeriler.reduce((total, veri) => {
      return total + (veri.tasarrufEdilenCO2 || (veri.gunlukUretim * 0.5));
    }, 0);

    // Veri gün sayısı (unique tarihler)
    const uniqueTarihler = new Set(
      filtrelenmisVeriler.map(v => v.tarih.toDate().toDateString())
    );

    return {
      toplamHedef,
      toplamGerceklesen,
      basariOrani: toplamHedef > 0 ? (toplamGerceklesen / toplamHedef) * 100 : 0,
      ortalamaBirimFiyat: 5.2,
      aktifSantralSayisi: ilgiliSantraller.length,
      veriGunSayisi: uniqueTarihler.size,
      toplamCO2Tasarrufu
    };
  }, [uretimVerileri, santraller, secilenSantral]);

  // Aylık veri hesaplama
  const aylikVeriler = useMemo((): AylikVeri[] => {
    const ilgiliSantraller = secilenSantral !== 'tumu' 
      ? santraller.filter(s => s.id === secilenSantral)
      : santraller;

    return aylar.map(ay => {
      const ayBaslangic = new Date(secilenYil, ay.index, 1);
      const ayBitis = endOfMonth(ayBaslangic);

      const ayVerileri = uretimVerileri.filter(v => {
        const veriTarihi = v.tarih.toDate();
        return veriTarihi >= ayBaslangic && veriTarihi <= ayBitis &&
          (secilenSantral === 'tumu' || v.santralId === secilenSantral);
      });

      // Hedef hesaplama
      const hedef = ilgiliSantraller.reduce((total, santral) => {
        return total + getSantralHedef(santral, ay.index);
      }, 0);

      // Gerçekleşen hesaplama
      const gerceklesen = ayVerileri.reduce((total, v) => total + v.gunlukUretim, 0);

      // CO2 tasarrufu hesaplama
      const co2Tasarrufu = ayVerileri.reduce((total, v) => 
        total + (v.tasarrufEdilenCO2 || (v.gunlukUretim * 0.5)), 0);

      return {
        ay: ay.label,
        ayIndex: ay.index,
        hedef,
        gerceklesen,
        basariOrani: hedef > 0 ? (gerceklesen / hedef) * 100 : 0,
        co2Tasarrufu
      };
    });
  }, [uretimVerileri, santraller, secilenSantral, secilenYil]);

  // Event handlers
  const handleYenile = async () => {
    setYenileniyor(true);
    try {
      await santralleriGetir();
      toast.success('Veriler başarıyla yenilendi');
    } catch (error) {
      console.error('Yenileme hatası:', error);
      toast.error('Veriler yenilenirken bir hata oluştu');
    }
    setYenileniyor(false);
  };

  const handleExcelExport = () => {
    try {
      if (aylikVeriler.length === 0) {
        toast.error('Dışa aktarılacak veri bulunamadı');
        return;
      }

      const excelData = aylikVeriler.map(veri => ({
        'Ay': veri.ay,
        'Hedef Üretim (kWh)': veri.hedef.toFixed(0),
        'Gerçekleşen Üretim (kWh)': veri.gerceklesen.toFixed(0),
        'Başarı Oranı (%)': veri.basariOrani.toFixed(1),
        'CO2 Tasarrufu (kg)': veri.co2Tasarrufu.toFixed(1)
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Üretim Analizi');

      const dosyaAdi = `Uretim_Analizi_${secilenYil}.xlsx`;
      XLSX.writeFile(workbook, dosyaAdi);
      toast.success('Excel dosyası başarıyla indirildi');
    } catch (error) {
      console.error('Excel dışa aktarma hatası:', error);
      toast.error('Excel dosyası oluşturulurken bir hata oluştu');
    }
  };

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
            <h1 className="text-2xl font-bold text-gray-900">Üretim Performans Analizi</h1>
            <p className="mt-1 text-sm text-gray-500">Santral üretim verilerini analiz edin</p>
          </div>
        </div>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex flex-col items-center justify-center py-16">
            <Target className="h-20 w-20 text-blue-400 mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Santral Bulunamadı</h3>
            <p className="text-gray-600 text-center max-w-md mb-6">
              Üretim analizi yapmak için önce santrallerinizi sisteme eklemelisiniz.
            </p>
            {canAdd && (
              <button
                onClick={() => navigate('/ges-yonetimi')}
                className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 transition-all duration-200"
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
      <div className="bg-gradient-to-br from-emerald-50 to-teal-100 rounded-2xl shadow-lg border border-emerald-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center">
            <div className="relative">
              <div className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mr-6 shadow-lg">
                <Activity className="h-10 w-10 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Üretim Performans Analizi</h1>
              <p className="text-gray-600">
                {performansOzeti.aktifSantralSayisi} santral • {performansOzeti.veriGunSayisi} gün veri
              </p>
            </div>
          </div>

          {/* Ana İstatistikler */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">
                  %{performansOzeti.basariOrani.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">Başarı Oranı</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-600">
                  {(performansOzeti.toplamCO2Tasarrufu / 1000).toFixed(1)}t
                </div>
                <div className="text-xs text-gray-500">CO₂ Tasarrufu</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtre Çubuğu */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* Santral Seçimi */}
          <div className="flex items-center space-x-2">
            <Building className="h-4 w-4 text-gray-500" />
            <select
              value={secilenSantral}
              onChange={(e) => setSecilenSantral(e.target.value)}
              className="rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm min-w-[180px] bg-white"
            >
              <option value="tumu">Tüm Santraller</option>
              {santraller.map(santral => (
                <option key={santral.id} value={santral.id}>{santral.ad}</option>
              ))}
            </select>
          </div>

          {/* Yıl Seçimi */}
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <select
              value={secilenYil}
              onChange={(e) => setSecilenYil(parseInt(e.target.value))}
              className="rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
            >
              {yilSecenekleri.map(yil => (
                <option key={yil} value={yil}>{yil}</option>
              ))}
            </select>
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
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Veri Ekle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ana Metrik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card decoration="top" decorationColor="emerald">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Yıllık Hedef</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                {(performansOzeti.toplamHedef / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
              </Metric>
              <Text className="text-xs text-gray-500 mt-1">
                Santral yönetiminden
              </Text>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl">
              <Target className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card decoration="top" decorationColor="teal">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Gerçekleşen Üretim</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                {(performansOzeti.toplamGerceklesen / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
              </Metric>
              <div className="flex items-center mt-1">
                <Badge 
                  color={
                    performansOzeti.basariOrani >= 90 ? "emerald" : 
                    performansOzeti.basariOrani >= 70 ? "amber" : "rose"
                  }
                  className="text-xs"
                >
                  %{performansOzeti.basariOrani.toFixed(1)}
                </Badge>
              </div>
            </div>
            <div className="p-3 bg-teal-100 rounded-xl">
              <Activity className="h-8 w-8 text-teal-600" />
            </div>
          </div>
        </Card>

        <Card decoration="top" decorationColor="blue">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Toplam Kapasite</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                {santraller.reduce((sum, s) => sum + (s.kapasite || 0), 0).toLocaleString('tr-TR')} kW
              </Metric>
              <Text className="text-xs text-gray-500 mt-1">
                Kurulu güç
              </Text>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <Zap className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card decoration="top" decorationColor="green">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">CO₂ Tasarrufu</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                {(performansOzeti.toplamCO2Tasarrufu / 1000).toFixed(1)} ton
              </Metric>
              <Text className="text-xs text-gray-500 mt-1">
                Çevre katkısı
              </Text>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <Leaf className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Ana Grafik Alanı */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hedef vs Gerçekleşen Grafiği */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <Title>Aylık Hedef vs Gerçekleşen Üretim</Title>
              <Text className="text-sm text-gray-500">Performans trend analizi</Text>
            </div>
            <div className="flex items-center space-x-2">
              <Badge 
                color={performansOzeti.basariOrani >= 90 ? "emerald" : 
                       performansOzeti.basariOrani >= 70 ? "amber" : "rose"}
                className="text-xs"
              >
                %{performansOzeti.basariOrani.toFixed(1)}
              </Badge>
              <Badge color="blue" className="text-xs">
                {secilenYil}
              </Badge>
            </div>
          </div>
          <AreaChart
            className="mt-4 h-80"
            data={aylikVeriler}
            index="ay"
            categories={["hedef", "gerceklesen"]}
            colors={["cyan", "emerald"]}
            valueFormatter={(value) => `${(value / 1000).toFixed(1)} MWh`}
            showAnimation={true}
            showGradient={true}
            showLegend={true}
            showGridLines={true}
            showXAxis={true}
            showYAxis={true}
            enableLegendSlider={true}
          />
        </Card>

        {/* CO2 Tasarrufu Grafiği */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <Title>Aylık CO₂ Tasarrufu</Title>
              <Text className="text-sm text-gray-500">Çevresel etki analizi</Text>
            </div>
            <div className="flex items-center space-x-2">
              <Badge color="emerald" className="text-xs">
                {(performansOzeti.toplamCO2Tasarrufu / 1000).toFixed(1)} ton
              </Badge>
            </div>
          </div>
          <BarChart
            className="mt-4 h-80"
            data={aylikVeriler}
            index="ay"
            categories={["co2Tasarrufu"]}
            colors={["emerald"]}
            valueFormatter={(value) => `${(value / 1000).toFixed(2)} ton`}
            showAnimation={true}
            showLegend={false}
            showGridLines={true}
            enableLegendSlider={false}
          />
        </Card>
      </div>

      {/* Performans Trend Analizi */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <Title>Performans Trend Analizi</Title>
            <Text className="text-sm text-gray-500">Aylık başarı oranları ve trendler</Text>
          </div>
          <div className="flex items-center space-x-2">
            <Badge 
              color={performansOzeti.basariOrani >= 90 ? "emerald" : 
                     performansOzeti.basariOrani >= 70 ? "amber" : "rose"}
              className="text-xs"
            >
              Ortalama: %{performansOzeti.basariOrani.toFixed(1)}
            </Badge>
            <Badge color="blue" className="text-xs">
              {secilenYil}
            </Badge>
          </div>
        </div>

        {/* Trend İstatistikleri */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 border border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-emerald-600 uppercase tracking-wide font-medium">En Yüksek</div>
                <div className="text-lg font-bold text-emerald-900">
                  %{Math.max(...aylikVeriler.map(v => v.basariOrani)).toFixed(1)}
                </div>
                <div className="text-xs text-emerald-600">
                  {aylikVeriler.find(v => v.basariOrani === Math.max(...aylikVeriler.map(v => v.basariOrani)))?.ay}
                </div>
              </div>
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-lg p-4 border border-rose-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-rose-600 uppercase tracking-wide font-medium">En Düşük</div>
                <div className="text-lg font-bold text-rose-900">
                  %{Math.min(...aylikVeriler.map(v => v.basariOrani)).toFixed(1)}
                </div>
                <div className="text-xs text-rose-600">
                  {aylikVeriler.find(v => v.basariOrani === Math.min(...aylikVeriler.map(v => v.basariOrani)))?.ay}
                </div>
              </div>
              <TrendingDown className="h-6 w-6 text-rose-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-4 border border-teal-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-teal-600 uppercase tracking-wide font-medium">Standart Sapma</div>
                <div className="text-lg font-bold text-teal-900">
                  ±{(() => {
                    const ortalama = aylikVeriler.reduce((sum, v) => sum + v.basariOrani, 0) / aylikVeriler.length;
                    const varyans = aylikVeriler.reduce((sum, v) => sum + Math.pow(v.basariOrani - ortalama, 2), 0) / aylikVeriler.length;
                    return Math.sqrt(varyans).toFixed(1);
                  })()}%
                </div>
                <div className="text-xs text-teal-600">Tutarlılık</div>
              </div>
              <Activity className="h-6 w-6 text-teal-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-blue-600 uppercase tracking-wide font-medium">Trend Eğilimi</div>
                <div className="text-lg font-bold text-blue-900">
                  {(() => {
                    const sonUcAy = aylikVeriler.slice(-3).reduce((sum, v) => sum + v.basariOrani, 0) / 3;
                    const ilkUcAy = aylikVeriler.slice(0, 3).reduce((sum, v) => sum + v.basariOrani, 0) / 3;
                    const trend = sonUcAy - ilkUcAy;
                    return trend > 0 ? `+${trend.toFixed(1)}%` : `${trend.toFixed(1)}%`;
                  })()}
                </div>
                <div className="text-xs text-blue-600">
                  {(() => {
                    const sonUcAy = aylikVeriler.slice(-3).reduce((sum, v) => sum + v.basariOrani, 0) / 3;
                    const ilkUcAy = aylikVeriler.slice(0, 3).reduce((sum, v) => sum + v.basariOrani, 0) / 3;
                    return sonUcAy > ilkUcAy ? 'Yükseliş' : 'Düşüş';
                  })()}
                </div>
              </div>
              <BarChart2 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Trend Grafiği */}
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-200">
          <LineChart
            className="h-80"
            data={aylikVeriler.map((veri, index) => ({
              ay: veri.ay,
              basariOrani: veri.basariOrani,
              hareketliOrtalama: index >= 2 ? 
                aylikVeriler.slice(Math.max(0, index - 2), index + 1)
                  .reduce((sum, v) => sum + v.basariOrani, 0) / 3 : veri.basariOrani,
              hedefCizgi: 90,
              minimumEsik: 70
            }))}
            index="ay"
            categories={["basariOrani", "hareketliOrtalama", "hedefCizgi", "minimumEsik"]}
            colors={["rose", "amber", "emerald", "slate"]}
            valueFormatter={(value) => `%${value.toFixed(1)}`}
            showAnimation={true}
            showLegend={true}
            showGridLines={true}
            connectNulls={false}
            strokeWidth={3}
          />
        </div>
      </Card>

      {/* Üretim Verilerini Listele */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <Title>Son Üretim Verileri</Title>
          <Text>{uretimVerileri.length} kayıt</Text>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Santral</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Üretim</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Performans</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">CO₂ Tasarrufu</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {uretimVerileri.slice(0, 20).map((veri) => {
                const santral = santraller.find(s => s.id === veri.santralId);
                return (
                  <tr key={veri.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(veri.tarih.toDate(), 'dd MMM yyyy', { locale: tr })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {santral?.ad || 'Bilinmeyen Santral'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {veri.gunlukUretim.toLocaleString('tr-TR', {maximumFractionDigits: 1})} kWh
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Badge
                        color={veri.performansOrani >= 90 ? "emerald" : 
                               veri.performansOrani >= 70 ? "amber" : "rose"}
                        className="text-xs"
                      >
                        %{veri.performansOrani.toFixed(1)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {(veri.tasarrufEdilenCO2 || (veri.gunlukUretim * 0.5)).toFixed(1)} kg
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => {
                            setSecilenVeriDetay(veri);
                            setDetayModalAcik(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
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
                            className="text-rose-600 hover:text-rose-900 transition-colors"
                            title="Veriyi Sil"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

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

      {/* Detay Modal */}
      {detayModalAcik && secilenVeriDetay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Üretim Verisi Detayı</h3>
              <button
                onClick={() => setDetayModalAcik(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600">Tarih</label>
                <p className="text-sm text-gray-900">
                  {format(secilenVeriDetay.tarih.toDate(), 'dd MMMM yyyy', { locale: tr })}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Santral</label>
                <p className="text-sm text-gray-900">
                  {santraller.find(s => s.id === secilenVeriDetay.santralId)?.ad || 'Bilinmeyen'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Günlük Üretim</label>
                <p className="text-sm text-gray-900">
                  {secilenVeriDetay.gunlukUretim.toLocaleString('tr-TR')} kWh
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Performans Oranı</label>
                <p className="text-sm text-gray-900">%{secilenVeriDetay.performansOrani.toFixed(1)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">CO₂ Tasarrufu</label>
                <p className="text-sm text-gray-900">
                  {(secilenVeriDetay.tasarrufEdilenCO2 || (secilenVeriDetay.gunlukUretim * 0.5)).toFixed(1)} kg
                </p>
              </div>
              {secilenVeriDetay.hava && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Hava Durumu</label>
                  <p className="text-sm text-gray-900">
                    Sıcaklık: {secilenVeriDetay.hava.sicaklik}°C, 
                    Nem: %{secilenVeriDetay.hava.nem}, 
                    Radyasyon: {secilenVeriDetay.hava.radyasyon} W/m²
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};