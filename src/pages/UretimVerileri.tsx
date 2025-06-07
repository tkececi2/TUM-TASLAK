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
  DollarSign,
  X,
  PieChart,
  Zap,
  ArrowUp,
  ArrowDown,
  Minus,
  Leaf
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
  elektrikFiyatlari?: Record<string, Record<string, { birimFiyat: number, dagitimBedeli: number }>>;
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
  toplamGelir: number;
  toplamDagitimBedeli: number;
  netGelir: number;
  ortalamaBirimFiyat: number;
  aktifSantralSayisi: number;
  veriGunSayisi: number;
}

interface AylikVeri {
  ay: string;
  ayIndex: number;
  hedef: number;
  gerceklesen: number;
  basariOrani: number;
  gelir: number;
  dagitimBedeli: number;
  netGelir: number;
  birimFiyat: number;
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
  const aySecenekleri = [
    { value: 0, label: 'Ocak', key: 'ocak' }, 
    { value: 1, label: 'Şubat', key: 'subat' }, 
    { value: 2, label: 'Mart', key: 'mart' },
    { value: 3, label: 'Nisan', key: 'nisan' }, 
    { value: 4, label: 'Mayıs', key: 'mayis' }, 
    { value: 5, label: 'Haziran', key: 'haziran' },
    { value: 6, label: 'Temmuz', key: 'temmuz' }, 
    { value: 7, label: 'Ağustos', key: 'agustos' }, 
    { value: 8, label: 'Eylül', key: 'eylul' },
    { value: 9, label: 'Ekim', key: 'ekim' }, 
    { value: 10, label: 'Kasım', key: 'kasim' }, 
    { value: 11, label: 'Aralık', key: 'aralik' }
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

  // Santral fiyat bilgilerini getir
  const getSantralFiyat = (santral: Santral, tarih: Date) => {
    const yil = tarih.getFullYear().toString();
    const ayKey = aylar[tarih.getMonth()]?.key;

    if (santral.elektrikFiyatlari?.[yil]?.[ayKey]) {
      return santral.elektrikFiyatlari[yil][ayKey];
    }

    return {
      birimFiyat: 5.0,
      dagitimBedeli: 0.5
    };
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

    // Gelir hesaplama (santral fiyatlarını kullan)
    let toplamGelir = 0;
    let toplamDagitimBedeli = 0;
    let birimFiyatToplam = 0;
    let fiyatSayaci = 0;

    filtrelenmisVeriler.forEach(veri => {
      const santral = santraller.find(s => s.id === veri.santralId);
      if (santral) {
        const fiyatlar = getSantralFiyat(santral, veri.tarih.toDate());
        toplamGelir += veri.gunlukUretim * fiyatlar.birimFiyat;
        toplamDagitimBedeli += veri.gunlukUretim * fiyatlar.dagitimBedeli;
        birimFiyatToplam += fiyatlar.birimFiyat;
        fiyatSayaci++;
      } else {
        toplamGelir += veri.gelir || 0;
        toplamDagitimBedeli += veri.dagitimBedeli || 0;
      }
    });

    // Veri gün sayısı (unique tarihler)
    const uniqueTarihler = new Set(
      filtrelenmisVeriler.map(v => v.tarih.toDate().toDateString())
    );

    return {
      toplamHedef,
      toplamGerceklesen,
      basariOrani: toplamHedef > 0 ? (toplamGerceklesen / toplamHedef) * 100 : 0,
      toplamGelir,
      toplamDagitimBedeli,
      netGelir: toplamGelir - toplamDagitimBedeli,
      ortalamaBirimFiyat: fiyatSayaci > 0 ? birimFiyatToplam / fiyatSayaci : 0,
      aktifSantralSayisi: ilgiliSantraller.length,
      veriGunSayisi: uniqueTarihler.size
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

      // Gelir hesaplama
      let gelir = 0;
      let dagitimBedeli = 0;
      let birimFiyatToplam = 0;
      let fiyatSayaci = 0;

      ayVerileri.forEach(veri => {
        const santral = santraller.find(s => s.id === veri.santralId);
        if (santral) {
          const fiyatlar = getSantralFiyat(santral, veri.tarih.toDate());
          gelir += veri.gunlukUretim * fiyatlar.birimFiyat;
          dagitimBedeli += veri.gunlukUretim * fiyatlar.dagitimBedeli;
          birimFiyatToplam += fiyatlar.birimFiyat;
          fiyatSayaci++;
        } else {
          gelir += veri.gelir || 0;
          dagitimBedeli += veri.dagitimBedeli || 0;
        }
      });

      return {
        ay: ay.label,
        ayIndex: ay.index,
        hedef,
        gerceklesen,
        basariOrani: hedef > 0 ? (gerceklesen / hedef) * 100 : 0,
        gelir,
        dagitimBedeli,
        netGelir: gelir - dagitimBedeli,
        birimFiyat: fiyatSayaci > 0 ? birimFiyatToplam / fiyatSayaci : 0
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
        'Gelir (₺)': veri.gelir.toFixed(2),
        'Dağıtım Bedeli (₺)': veri.dagitimBedeli.toFixed(2),
        'Net Gelir (₺)': veri.netGelir.toFixed(2),
        'Ortalama Birim Fiyat (₺/kWh)': veri.birimFiyat.toFixed(3)
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Hedef vs Gerçekleşen');

      const dosyaAdi = `Hedef_Gerceklesen_${secilenYil}.xlsx`;
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
            <h1 className="text-2xl font-bold text-gray-900">Hedef vs Gerçekleşen Üretim</h1>
            <p className="mt-1 text-sm text-gray-500">Santral performans analizi</p>
          </div>
        </div>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex flex-col items-center justify-center py-16">
            <Target className="h-20 w-20 text-blue-400 mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 mb-3">Santral Bulunamadı</h3>
            <p className="text-gray-600 text-center max-w-md mb-6">
              Hedef karşılaştırma analizi yapmak için önce santrallerinizi sisteme eklemelisiniz.
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
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl shadow-lg border border-blue-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center">
            <div className="relative">
              <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mr-6 shadow-lg">
                <Target className="h-10 w-10 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Hedef vs Gerçekleşen Üretim</h1>
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
                <div className="text-xl font-bold text-green-600">
                  ₺{performansOzeti.netGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                </div>
                <div className="text-xs text-gray-500">Net Gelir</div>
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
              className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm min-w-[180px] bg-white"
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
              className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
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
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-colors"
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
        <Card decoration="top" decorationColor="blue">
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
            <div className="p-3 bg-blue-100 rounded-xl">
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card decoration="top" decorationColor="green">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Gerçekleşen Üretim</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                {(performansOzeti.toplamGerceklesen / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
              </Metric>
              <div className="flex items-center mt-1">
                <Badge 
                  color={
                    performansOzeti.basariOrani >= 90 ? "green" : 
                    performansOzeti.basariOrani >= 70 ? "yellow" : "red"
                  }
                  className="text-xs"
                >
                  %{performansOzeti.basariOrani.toFixed(1)}
                </Badge>
              </div>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </Card>

        <Card decoration="top" decorationColor="amber">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Toplam Gelir</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                ₺{performansOzeti.toplamGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
              </Metric>
              <Text className="text-xs text-gray-500 mt-1">
                Ort. ₺{performansOzeti.ortalamaBirimFiyat.toFixed(3)}/kWh
              </Text>
            </div>
            <div className="p-3 bg-amber-100 rounded-xl">
              <DollarSign className="h-8 w-8 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card decoration="top" decorationColor="emerald">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Net Gelir</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                ₺{performansOzeti.netGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
              </Metric>
              <Text className="text-xs text-gray-500 mt-1">
                Dağıtım bedeli düşülmüş
              </Text>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl">
              <TrendingUp className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Ana Grafik Alanı */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gelişmiş Hedef vs Gerçekleşen Grafiği */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <Title>Aylık Hedef vs Gerçekleşen Üretim</Title>
                <Text className="text-sm text-gray-500">Performans trend analizi</Text>
              </div>
              <div className="flex items-center space-x-2">
                <Badge 
                  color={performansOzeti.basariOrani >= 90 ? "green" : 
                         performansOzeti.basariOrani >= 70 ? "yellow" : "red"}
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
              colors={["blue", "emerald"]}
              valueFormatter={(value) => `${(value / 1000).toFixed(1)} MWh`}
              showAnimation={true}
              showGradient={true}
              showLegend={true}
              showGridLines={true}
              showXAxis={true}
              showYAxis={true}
              enableLegendSlider={true}
              customTooltip={(props) => {
                const { payload, active } = props;
                if (!active || !payload || !payload[0]) return null;

                const data = payload[0].payload;
                const basariOrani = data.hedef > 0 ? (data.gerceklesen / data.hedef) * 100 : 0;

                return (
                  <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-lg">
                    <div className="font-semibold text-gray-900 mb-2">{data.ay} {secilenYil}</div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-blue-600 text-sm">Hedef:</span>
                        <span className="font-medium">{(data.hedef / 1000).toFixed(1)} MWh</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-600 text-sm">Gerçekleşen:</span>
                        <span className="font-medium">{(data.gerceklesen / 1000).toFixed(1)} MWh</span>
                      </div>
                      <div className="flex items-center justify-between border-t pt-1 mt-2">
                        <span className="text-gray-600 text-sm">Başarı:</span>
                        <Badge 
                          color={basariOrani >= 90 ? "green" : basariOrani >= 70 ? "yellow" : "red"}
                          className="text-xs"
                        >
                          %{basariOrani.toFixed(1)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
          </Card>

          {/* Gelişmiş Gelir Analizi Grafiği */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <Title>Aylık Gelir & Karlılık Analizi</Title>
                <Text className="text-sm text-gray-500">Net gelir trendi</Text>
              </div>
              <div className="flex items-center space-x-2">
                <Badge color="emerald" className="text-xs">
                  Net: ₺{performansOzeti.netGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                </Badge>
              </div>
            </div>
            <BarChart
              className="mt-4 h-80"
              data={aylikVeriler.map(veri => ({
                ...veri,
                karMarji: veri.gelir > 0 ? ((veri.netGelir / veri.gelir) * 100) : 0
              }))}
              index="ay"
              categories={["gelir", "dagitimBedeli", "netGelir"]}
              colors={["lime", "rose", "teal"]}
              valueFormatter={(value) => `₺${value.toLocaleString('tr-TR', {maximumFractionDigits: 0})}`}
              showAnimation={true}
              showLegend={true}
              showGridLines={true}
              enableLegendSlider={true}
              customTooltip={(props) => {
                const { payload, active } = props;
                if (!active || !payload || !payload[0]) return null;

                const data = payload[0].payload;
                const karMarji = data.gelir > 0 ? ((data.netGelir / data.gelir) * 100) : 0;

                return (
                  <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-lg">
                    <div className="font-semibold text-gray-900 mb-2">{data.ay} {secilenYil}</div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-green-600 text-sm">Toplam Gelir:</span>
                        <span className="font-medium">₺{data.gelir.toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-red-600 text-sm">Dağıtım Bedeli:</span>
                        <span className="font-medium">₺{data.dagitimBedeli.toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="flex items-center justify-between border-t pt-1 mt-2">
                        <span className="text-emerald-600 text-sm">Net Gelir:</span>
                        <span className="font-medium">₺{data.netGelir.toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 text-sm">Kar Marjı:</span>
                        <span className="font-medium">%{karMarji.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
          </Card>
        </div>

        {/* Yeniden Tasarlanmış Performans Trend Analizi */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div>
              <Title>Performans Trend Analizi</Title>
              <Text className="text-sm text-gray-500">Aylık başarı oranları ve trendler</Text>
            </div>
            <div className="flex items-center space-x-2">
              <Badge 
                color={performansOzeti.basariOrani >= 90 ? "green" : 
                       performansOzeti.basariOrani >= 70 ? "yellow" : "red"}
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
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-blue-600 uppercase tracking-wide font-medium">En Yüksek</div>
                  <div className="text-lg font-bold text-blue-900">
                    %{Math.max(...aylikVeriler.map(v => v.basariOrani)).toFixed(1)}
                  </div>
                  <div className="text-xs text-blue-600">
                    {aylikVeriler.find(v => v.basariOrani === Math.max(...aylikVeriler.map(v => v.basariOrani)))?.ay}
                  </div>
                </div>
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-red-600 uppercase tracking-wide font-medium">En Düşük</div>
                  <div className="text-lg font-bold text-red-900">
                    %{Math.min(...aylikVeriler.map(v => v.basariOrani)).toFixed(1)}
                  </div>
                  <div className="text-xs text-red-600">
                    {aylikVeriler.find(v => v.basariOrani === Math.min(...aylikVeriler.map(v => v.basariOrani)))?.ay}
                  </div>
                </div>
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 border border-emerald-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-600 uppercase tracking-wide font-medium">Standart Sapma</div>
                  <div className="text-lg font-bold text-emerald-900">
                    ±{(() => {
                      const ortalama = aylikVeriler.reduce((sum, v) => sum + v.basariOrani, 0) / aylikVeriler.length;
                      const varyans = aylikVeriler.reduce((sum, v) => sum + Math.pow(v.basariOrani - ortalama, 2), 0) / aylikVeriler.length;
                      return Math.sqrt(varyans).toFixed(1);
                    })()}%
                  </div>
                  <div className="text-xs text-emerald-600">Tutarlılık</div>
                </div>
                <Activity className="h-6 w-6 text-emerald-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-amber-600 uppercase tracking-wide font-medium">Trend Eğilimi</div>
                  <div className="text-lg font-bold text-amber-900">
                    {(() => {
                      const sonUcAy = aylikVeriler.slice(-3).reduce((sum, v) => sum + v.basariOrani, 0) / 3;
                      const ilkUcAy = aylikVeriler.slice(0, 3).reduce((sum, v) => sum + v.basariOrani, 0) / 3;
                      const trend = sonUcAy - ilkUcAy;
                      return trend > 0 ? `+${trend.toFixed(1)}%` : `${trend.toFixed(1)}%`;
                    })()}
                  </div>
                  <div className="text-xs text-amber-600">
                    {(() => {
                      const sonUcAy = aylikVeriler.slice(-3).reduce((sum, v) => sum + v.basariOrani, 0) / 3;
                      const ilkUcAy = aylikVeriler.slice(0, 3).reduce((sum, v) => sum + v.basariOrani, 0) / 3;
                      return sonUcAy > ilkUcAy ? 'Yükseliş' : 'Düşüş';
                    })()}
                  </div>
                </div>
                <BarChart2 className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </div>

          {/* Gelişmiş Trend Grafiği */}
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-200">
            <LineChart
              className="h-80"
              data={aylikVeriler.map((veri, index) => ({
                ay: veri.ay,
                basariOrani: veri.basariOrani,
                hareketliOrtalama: index >= 2 ? 
                  aylikVeriler.slice(Math.max(0, index - 2), index + 1)
                    .reduce((sum, v) => sum + v.basariOrani, 0) / 3 : veri.basariOrani,
                hedefCizgi: 90, // Hedef başarı çizgisi
                minimumEsik: 70 // Minimum kabul edilebilir seviye
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
              customTooltip={(props) => {
                const { payload, active } = props;
                if (!active || !payload || !payload[0]) return null;

                const data = payload[0].payload;
                const trendDurum = data.basariOrani >= 90 ? 'Mükemmel' : 
                                   data.basariOrani >= 70 ? 'İyi' : 'Gelişim Gerekli';

                return (
                  <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-lg max-w-xs">
                    <div className="font-semibold text-gray-900 mb-3 text-center">{data.ay} {secilenYil}</div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                        <span className="text-red-700 text-sm font-medium">Başarı Oranı:</span>
                        <span className="font-bold text-red-900">%{data.basariOrani.toFixed(1)}</span>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                        <span className="text-orange-700 text-sm font-medium">3 Aylık Ortalama:</span>
                        <span className="font-bold text-orange-900">%{data.hareketliOrtalama.toFixed(1)}</span>
                      </div>

                      <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                        <span className="text-blue-700 text-sm font-medium">Durum:</span>
                        <Badge 
                          color={data.basariOrani >= 90 ? "green" : 
                                 data.basariOrani >= 70 ? "yellow" : "red"}
                          className="text-xs"
                        >
                          {trendDurum}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              }}
              yAxisConfig={{
                domain: [0, 100],
                tickFormatter: (value) => `%${value}`
              }}
            />
          </div>

          {/* Performans Analiz Önerileri */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center mb-2">
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                <h4 className="font-semibold text-green-900">Güçlü Yönler</h4>
              </div>
              <ul className="text-sm text-green-700 space-y-1">
                {aylikVeriler.filter(v => v.basariOrani >= 90).length > 0 && (
                  <li>• {aylikVeriler.filter(v => v.basariOrani >= 90).length} ay mükemmel performans</li>
                )}
                {(() => {
                  const sonUcAy = aylikVeriler.slice(-3);
                  const ortalama = sonUcAy.reduce((sum, v) => sum + v.basariOrani, 0) / 3;
                  return ortalama > performansOzeti.basariOrani && (
                    <li>• Son 3 ayda pozitif trend (%{ortalama.toFixed(1)})</li>
                  );
                })()}
                <li>• Tutarlı {(aylikVeriler.filter(v => v.basariOrani >= 70).length / 12 * 100).toFixed(0)}% başarı oranı</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center mb-2">
                <AlertTriangle className="h-5 w-5 text-orange-600 mr-2" />
                <h4 className="font-semibold text-orange-900">Gelişim Alanları</h4>
              </div>
              <ul className="text-sm text-orange-700 space-y-1">
                {aylikVeriler.filter(v => v.basariOrani < 70).length > 0 && (
                  <li>• {aylikVeriler.filter(v => v.basariOrani < 70).length} ay hedefin altında performans</li>
                )}
                {(() => {
                  const enDusukAy = aylikVeriler.reduce((prev, current) => 
                    (prev.basariOrani < current.basariOrani) ? prev : current
                  );
                  return <li>• {enDusukAy.ay} ayında %{enDusukAy.basariOrani.toFixed(1)} ile en düşük</li>;
                })()}
                <li>• Hedef %90 başarı oranına ulaşmak için optimizasyon</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Yeni Çok Boyutlu Analiz Paneli */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Başarı Oranı Dağılımı */}
          <Card>
            <div className="flex items-center mb-4">
              <PieChart className="h-5 w-5 text-blue-500 mr-2" />
              <Title>Aylık Başarı Dağılımı</Title>
            </div>
            <DonutChart
              className="mt-4 h-60"
              data={[
                {
                  kategori: "Mükemmel (≥90%)",
                  sayi: aylikVeriler.filter(v => v.basariOrani >= 90).length,
                  oran: (aylikVeriler.filter(v => v.basariOrani >= 90).length / 12) * 100
                },
                {
                  kategori: "İyi (70-90%)",
                  sayi: aylikVeriler.filter(v => v.basariOrani >= 70 && v.basariOrani < 90).length,
                  oran: (aylikVeriler.filter(v => v.basariOrani >= 70 && v.basariOrani < 90).length / 12) * 100
                },
                {
                  kategori: "Orta (50-70%)",
                  sayi: aylikVeriler.filter(v => v.basariOrani >= 50 && v.basariOrani < 70).length,
                  oran: (aylikVeriler.filter(v => v.basariOrani >= 50 && v.basariOrani < 70).length / 12) * 100
                },
                {
                  kategori: "Düşük (<50%)",
                  sayi: aylikVeriler.filter(v => v.basariOrani < 50).length,
                  oran: (aylikVeriler.filter(v => v.basariOrani < 50).length / 12) * 100
                }
              ]}
              category="sayi"
              index="kategori"
              colors={["emerald", "blue", "yellow", "red"]}
              valueFormatter={(value) => `${value} ay`}
              showAnimation={true}
              showTooltip={true}
            />
          </Card>

          {/* Gelir Momentum Analizi */}
          <Card>
            <div className="flex items-center mb-4">
              <TrendingUp className="h-5 w-5 text-green-500 mr-2" />
              <Title>Gelir Momentum</Title>
            </div>
            <div className="space-y-4 mt-4">
              {aylikVeriler.slice(-6).map((veri, index, arr) => {
                const oncekiVeri = index > 0 ? arr[index - 1] : null;
                const degisim = oncekiVeri ? 
                  ((veri.netGelir - oncekiVeri.netGelir) / oncekiVeri.netGelir) * 100 : 0;

                return (
                  <div key={veri.ay} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{veri.ay}</div>
                      <div className="text-xs text-gray-500">
                        ₺{veri.netGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                      </div>
                    </div>
                    <div className="flex items-center">
                      {degisim > 0 ? (
                        <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                      ) : degisim < 0 ? (
                        <ArrowDown className="h-4 w-4 text-red-500 mr-1" />
                      ) : (
                        <Minus className="h-4 w-4 text-gray-400 mr-1" />
                      )}
                      <span className={`text-xs font-medium ${
                        degisim > 0 ? 'text-green-600' : 
                        degisim < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {Math.abs(degisim).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Verimlilik İndeksi */}
          <Card>
            <div className="flex items-center mb-4">
              <Zap className="h-5 w-5 text-amber-500 mr-2" />
              <Title>Verimlilik İndeksi</Title>
            </div>
            <div className="space-y-4 mt-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {((performansOzeti.netGelir / performansOzeti.toplamGerceklesen) * 1000).toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">₺/MWh Net Gelir</div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Kapasite Kullanımı</span>
                  <div className="flex items-center">
                    <div className="w-16 h-2 bg-gray-200 rounded-full mr-2">
                      <div 
                        className="h-2 bg-blue-500 rounded-full"
                        style={{ 
                          width: `${Math.min(100, (performansOzeti.toplamGerceklesen / performansOzeti.toplamHedef) * 100)}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium">
                      %{((performansOzeti.toplamGerceklesen / performansOzeti.toplamHedef) * 100).toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Finansal Verim</span>
                  <div className="flex items-center">
                    <div className="w-16 h-2 bg-gray-200 rounded-full mr-2">
                      <div 
                        className="h-2 bg-green-500 rounded-full"
                        style={{ 
                          width: `${Math.min(100, (performansOzeti.netGelir / performansOzeti.toplamGelir) * 100)}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium">
                      %{((performansOzeti.netGelir / performansOzeti.toplamGelir) * 100).toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Fiyat Optimizasyonu</span>
                  <div className="flex items-center">
                    <div className="w-16 h-2 bg-gray-200 rounded-full mr-2">
                      <div 
                        className="h-2 bg-amber-500 rounded-full"
                        style={{ 
                          width: `${Math.min(100, (performansOzeti.ortalamaBirimFiyat / 6.0) * 100)}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium">
                      ₺{performansOzeti.ortalamaBirimFiyat.toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Aylık Detay Tablo */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <Title>Aylık Performans Detayı - {secilenYil}</Title>
          <Text>{aylikVeriler.filter(v => v.gerceklesen > 0).length} ay aktif</Text>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ay</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hedef</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gerçekleşen</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Başarı %</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gelir</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Dağıtım</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Gelir</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Birim Fiyat</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {aylikVeriler.map((veri) => (
                <tr key={veri.ay} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{veri.ay}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {(veri.hedef / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {(veri.gerceklesen / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Badge
                      color={veri.basariOrani >= 90 ? "green" : 
                             veri.basariOrani >= 70 ? "yellow" : "red"}
                      className="text-xs"
                    >
                      %{veri.basariOrani.toFixed(1)}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    ₺{veri.gelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                    ₺{veri.dagitimBedeli.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-green-600">
                    ₺{veri.netGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    ₺{veri.birimFiyat.toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mevsimsel ve Çeyreklik Analiz */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mevsimsel Performans */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <Title>Mevsimsel Performans Analizi</Title>
              <Text className="text-sm text-gray-500">Mevsim bazında karşılaştırma</Text>
            </div>
          </div>

          
<BarChart
              className="mt-4 h-64"
              data={[
                {
                  mevsim: "Kış (Ara-Şub)",
                  hedef: aylikVeriler.slice(11, 12).concat(aylikVeriler.slice(0, 2)).reduce((sum, v) => sum + v.hedef, 0),
                  gerceklesen: aylikVeriler.slice(11, 12).concat(aylikVeriler.slice(0, 2)).reduce((sum, v) => sum + v.gerceklesen, 0),
                  gelir: aylikVeriler.slice(11, 12).concat(aylikVeriler.slice(0, 2)).reduce((sum, v) => sum + v.netGelir, 0)
                },
                {
                  mevsim: "İlkbahar (Mar-May)",
                  hedef: aylikVeriler.slice(2, 5).reduce((sum, v) => sum + v.hedef, 0),
                  gerceklesen: aylikVeriler.slice(2, 5).reduce((sum, v) => sum + v.gerceklesen, 0),
                  gelir: aylikVeriler.slice(2, 5).reduce((sum, v) => sum + v.netGelir, 0)
                },
                {
                  mevsim: "Yaz (Haz-Ağu)",
                  hedef: aylikVeriler.slice(5, 8).reduce((sum, v) => sum + v.hedef, 0),
                  gerceklesen: aylikVeriler.slice(5, 8).reduce((sum, v) => sum + v.gerceklesen, 0),
                  gelir: aylikVeriler.slice(5, 8).reduce((sum, v) => sum + v.netGelir, 0)
                },
                {
                  mevsim: "Sonbahar (Eyl-Kas)",
                  hedef: aylikVeriler.slice(8, 11).reduce((sum, v) => sum + v.hedef, 0),
                  gerceklesen: aylikVeriler.slice(8, 11).reduce((sum, v) => sum + v.gerceklesen, 0),
                  gelir: aylikVeriler.slice(8, 11).reduce((sum, v) => sum + v.netGelir, 0)
                }
              ]}
              index="mevsim"
              categories={["hedef", "gerceklesen"]}
              colors={["cyan", "teal"]}
              valueFormatter={(value) => `${(value / 1000).toFixed(1)} MWh`}
              showAnimation={true}
              showLegend={true}
            />
        </Card>

        {/* Çeyreklik Finansal Analiz */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <Title>Çeyreklik Finansal Performans</Title>
              <Text className="text-sm text-gray-500">Üç aylık dönemler karşılaştırması</Text>
            </div>
          </div>

          
<AreaChart
              className="mt-4 h-64"
              data={[
                {
                  ceyrek: "Q1",
                  gelir: aylikVeriler.slice(0, 3).reduce((sum, v) => sum + v.gelir, 0),
                  gider: aylikVeriler.slice(0, 3).reduce((sum, v) => sum + v.dagitimBedeli, 0),
                  netGelir: aylikVeriler.slice(0, 3).reduce((sum, v) => sum + v.netGelir, 0)
                },
                {
                  ceyrek: "Q2",
                  gelir: aylikVeriler.slice(3, 6).reduce((sum, v) => sum + v.gelir, 0),
                  gider: aylikVeriler.slice(3, 6).reduce((sum, v) => sum + v.dagitimBedeli, 0),
                  netGelir: aylikVeriler.slice(3, 6).reduce((sum, v) => sum + v.netGelir, 0)
                },
                {
                  ceyrek: "Q3",
                  gelir: aylikVeriler.slice(6, 9).reduce((sum, v) => sum + v.gelir, 0),
                  gider: aylikVeriler.slice(6, 9).reduce((sum, v) => sum + v.dagitimBedeli, 0),
                  netGelir: aylikVeriler.slice(6, 9).reduce((sum, v) => sum + v.netGelir, 0)
                },
                {
                  ceyrek: "Q4",
                  gelir: aylikVeriler.slice(9, 12).reduce((sum, v) => sum + v.gelir, 0),
                  gider: aylikVeriler.slice(9, 12).reduce((sum, v) => sum + v.dagitimBedeli, 0),
                  netGelir: aylikVeriler.slice(9, 12).reduce((sum, v) => sum + v.netGelir, 0)
                }
              ]}
              index="ceyrek"
              categories={["gelir", "netGelir"]}
              colors={["amber", "emerald"]}
              valueFormatter={(value) => `₺${value.toLocaleString('tr-TR', {maximumFractionDigits: 0})}`}
              showAnimation={true}
              showLegend={true}
              showGradient={true}
            />
        </Card>
      </div>

      {/* Gelişmiş Performans İçgörüleri */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <Title>Akıllı Performans İçgörüleri - {secilenYil}</Title>
            <Text className="text-sm text-gray-500">AI destekli analiz ve öneriler</Text>
          </div>
          <div className="flex items-center space-x-2">
            <Badge 
              color={performansOzeti.basariOrani >= 90 ? "green" : 
                     performansOzeti.basariOrani >= 70 ? "yellow" : "red"}
              className="text-sm"
            >
              %{performansOzeti.basariOrani.toFixed(1)} Başarı
            </Badge>
          </div>
        </div>

        {/* Akıllı İçgörüler ve Öneriler */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performans İçgörüleri */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-blue-500 rounded-lg mr-3">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Performans İçgörüleri</h4>
                <p className="text-xs text-gray-600">AI destekli analiz</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* En İyi Performans Ayı */}
              {(() => {
                const enIyiAy = aylikVeriler.reduce((prev, current) => 
                  (prev.basariOrani > current.basariOrani) ? prev : current
                );
                return (
                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">En İyi Performans</div>
                        <div className="text-xs text-gray-600">{enIyiAy.ay} - %{enIyiAy.basariOrani.toFixed(1)}</div>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                  </div>
                );
              })()}

              {/* Gelişime Açık Alan */}
              {(() => {
                const enDusukAy = aylikVeriler.reduce((prev, current) => 
                  (prev.basariOrani < current.basariOrani) ? prev : current
                );
                return (
                  <div className="bg-white rounded-lg p-4 border border-orange-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Gelişim Fırsatı</div>
                        <div className="text-xs text-gray-600">{enDusukAy.ay} - %{enDusukAy.basariOrani.toFixed(1)}</div>
                      </div>
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                    </div>
                  </div>
                );
              })()}

              {/* Trend Analizi */}
              {(() => {
                const son3Ay = aylikVeriler.slice(-3);
                const ilk3Ay = aylikVeriler.slice(0, 3);
                const trendDegisim = (
                  son3Ay.reduce((sum, v) => sum + v.basariOrani, 0) / 3 -
                  ilk3Ay.reduce((sum, v) => sum + v.basariOrani, 0) / 3
                );
                return (
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Yıllık Trend</div>
                        <div className="text-xs text-gray-600">
                          {trendDegisim > 0 ? 'Yükseliş' : 'Düşüş'} trendi: %{Math.abs(trendDegisim).toFixed(1)}
                        </div>
                      </div>
                      {trendDegisim > 0 ? (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Finansal İçgörüler */}
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6 border border-emerald-100">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-emerald-500 rounded-lg mr-3">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Finansal İçgörüler</h4>
                <p className="text-xs text-gray-600">Gelir optimizasyonu</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* En Karlı Ay */}
              {(() => {
                const enKarliAy = aylikVeriler.reduce((prev, current) => 
                  (prev.netGelir > current.netGelir) ? prev : current
                );
                return (
                  <div className="bg-white rounded-lg p-4 border border-emerald-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">En Karlı Dönem</div>
                        <div className="text-xs text-gray-600">
                          {enKarliAy.ay} - ₺{enKarliAy.netGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                        </div>
                      </div>
                      <Badge color="emerald" className="text-xs">Peak</Badge>
                    </div>
                  </div>
                );
              })()}

              {/* ROI Hesaplama */}
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">Yıllık ROI Tahmini</div>
                    <div className="text-xs text-gray-600">
                      %{((performansOzeti.netGelir / (performansOzeti.aktifSantralSayisi * 500000)) * 100).toFixed(1)} (Tahmini)
                    </div>
                  </div>
                  <BarChart2 className="h-5 w-5 text-blue-500" />
                </div>
              </div>

              {/* Fiyat Optimizasyonu */}
              {(() => {
                const enYuksekFiyatAy = aylikVeriler.reduce((prev, current) => 
                  (prev.birimFiyat > current.birimFiyat) ? prev : current
                );
                return (
                  <div className="bg-white rounded-lg p-4 border border-amber-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">En İyi Fiyat Dönemi</div>
                        <div className="text-xs text-gray-600">
                          {enYuksekFiyatAy.ay} - ₺{enYuksekFiyatAy.birimFiyat.toFixed(3)}/kWh
                        </div>
                      </div>
                      <Zap className="h-5 w-5 text-amber-500" />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Detaylı Sistem Metrikleri */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Toplam Kapasite</div>
                <div className="text-lg font-bold text-gray-900 mt-1">
                  {santraller.reduce((sum, s) => sum + (s.kapasite || 0), 0).toLocaleString('tr-TR')} kW
                </div>
              </div>
              <Building className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Kapasite Faktörü</div>
                <div className="text-lg font-bold text-gray-900 mt-1">
                  %{((performansOzeti.toplamGerceklesen / (santraller.reduce((sum, s) => sum + (s.kapasite || 0), 0) * 365 * 24)) * 100).toFixed(1)}
                </div>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Kar Marjı</div>
                <div className="text-lg font-bold text-gray-900 mt-1">
                  %{((performansOzeti.netGelir / performansOzeti.toplamGelir) * 100).toFixed(1)}
                </div>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">CO₂ Tasarrufu</div>
                <div className="text-lg font-bold text-gray-900 mt-1">
                  {(performansOzeti.toplamGerceklesen * 0.5 / 1000).toFixed(1)} ton
                </div>
              </div>
              <Leaf className="h-8 w-8 text-green-600" />
            </div>
          </div>
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
    </div>
  );
};