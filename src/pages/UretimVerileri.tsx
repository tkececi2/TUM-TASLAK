import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, isValid, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Target, 
  Calendar, 
  Download, 
  Trash2, 
  Plus, 
  RefreshCw,
  TrendingUp,
  Building,
  Eye,
  Activity,
  X,
  CheckSquare,
  Square,
  BarChart3,
  UploadCloud,
  Filter,
  ChevronDown
} from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { BulkImportModal } from '../components/BulkImportModal';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { AreaChart, ValueFormatter } from '@tremor/react';

interface UretimVerisi {
  id: string;
  santralId: string;
  tarih: Timestamp;
  gunlukUretim: number;
  anlikGuc?: number;
  performansOrani: number;
  tasarrufEdilenCO2: number;
  hava?: {
    sicaklik: number;
    nem: number;
    radyasyon: number;
  };
  olusturanKisi?: {
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
    [key: string]: number;
  };
  elektrikFiyatlari?: {
    [yil: string]: {
      [ay: string]: {
        birimFiyat: number;
        dagitimBedeli: number;
      }
    }
  };
  kurulumTarihi: Timestamp;
  companyId: string;
  konum: {
    adres: string;
    lat?: number;
    lng?: number;
  };
  panelSayisi?: number;
  inverterSayisi?: number;
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
  aktifSantralSayisi: number;
  veriGunSayisi: number;
  toplamCO2Tasarrufu: number;
}

interface ChartData {
  name: string;
  "Hedef Üretim": number;
  "Gerçekleşen Üretim": number;
}

type GorunumTipi = 'yillik' | 'aylik';

const ayTurkce = [
  { key: 'ocak', label: 'Ocak', index: 0 }, { key: 'subat', label: 'Şubat', index: 1 },
  { key: 'mart', label: 'Mart', index: 2 }, { key: 'nisan', label: 'Nisan', index: 3 },
  { key: 'mayis', label: 'Mayıs', index: 4 }, { key: 'haziran', label: 'Haziran', index: 5 },
  { key: 'temmuz', label: 'Temmuz', index: 6 }, { key: 'agustos', label: 'Ağustos', index: 7 },
  { key: 'eylul', label: 'Eylül', index: 8 }, { key: 'ekim', label: 'Ekim', index: 9 },
  { key: 'kasim', label: 'Kasım', index: 10 }, { key: 'aralik', label: 'Aralık', index: 11 },
];

export const UretimVerileri: React.FC = () => {
  const { kullanici } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [uretimVerileri, setUretimVerileri] = useState<UretimVerisi[]>([]);
  const [santraller, setSantraller] = useState<Santral[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  
  const queryParams = new URLSearchParams(location.search);
  const initialSantralId = queryParams.get('santralId') || 'tumu';
  const initialSantralAdi = queryParams.get('santralAdi');

  const [secilenSantral, setSecilenSantral] = useState<string>(initialSantralId);
  const [secilenYil, setSecilenYil] = useState<number>(new Date().getFullYear());
  const [secilenAy, setSecilenAy] = useState<number>(new Date().getMonth()); 
  const [gorunumTipi, setGorunumTipi] = useState<GorunumTipi>('yillik');

  const [seciliSilinecekKayitId, setSeciliSilinecekKayitId] = useState<string | null>(null);
  const [topluSilinecekKayitIdleri, setTopluSilinecekKayitIdleri] = useState<string[]>([]);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isSilmeOnayModalOpen, setIsSilmeOnayModalOpen] = useState(false);
  const [isTopluSilmeOnayModalOpen, setIsTopluSilmeOnayModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [secilenVeriDetay, setSecilenVeriDetay] = useState<UretimVerisi | null>(null);

  const yilSecenekleri = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
  
  const canAdd = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis', 'superadmin'].includes(kullanici.rol);
  const canDelete = kullanici?.rol === 'yonetici' || kullanici?.rol === 'superadmin';

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

  const getSantralHedef = (santral: Santral, ayIndex?: number): number => {
    if (ayIndex !== undefined && santral.aylikHedefler) {
      const ayKey = ayTurkce[ayIndex]?.key;
      return ayKey && santral.aylikHedefler[ayKey] ? santral.aylikHedefler[ayKey] : (santral.yillikHedefUretim / 12);
    }
    return santral.yillikHedefUretim;
  };

  useEffect(() => {
    const santralleriGetir = async () => {
      if (!kullanici?.companyId) {
        setYukleniyor(false); return;
      }
      try {
        setYukleniyor(true);
        let santralQuery;
        if (kullanici.rol === 'musteri') {
          const sahaIds = getMusteriSahaIds();
          if (sahaIds.length === 0) { setSantraller([]); setYukleniyor(false); return; }
          const allS: Santral[] = [];
          for (let i = 0; i < sahaIds.length; i += 10) {
            const batch = sahaIds.slice(i, i + 10);
            const bQuery = query(collection(db, 'santraller'), where('__name__', 'in', batch));
            const bSnapshot = await getDocs(bQuery);
            allS.push(...bSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Santral)));
          }
          setSantraller(allS);
        } else {
          santralQuery = query(collection(db, 'santraller'), where('companyId', '==', kullanici.companyId), orderBy('ad'));
          const sSnapshot = await getDocs(santralQuery);
          setSantraller(sSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Santral)));
        }
      } catch (error) {
        console.error('Santral getirme hatası:', error);
        toast.error('Santraller yüklenirken bir hata oluştu');
      } finally {
        setYukleniyor(false);
      }
    };
    santralleriGetir();
  }, [kullanici]);

  useEffect(() => {
    const verileriGetir = async () => {
      if (!kullanici?.companyId || (kullanici.rol !== 'musteri' && santraller.length === 0)) {
        setUretimVerileri([]); return;
      }
      if (kullanici.rol === 'musteri' && getMusteriSahaIds().length === 0 && secilenSantral === 'tumu'){
        setUretimVerileri([]); return;
      }
      try {
        setYenileniyor(true);
        const tarihBaslangic = gorunumTipi === 'yillik' ? startOfYear(new Date(secilenYil, 0, 1)) : startOfMonth(new Date(secilenYil, secilenAy, 1));
        const tarihBitis = gorunumTipi === 'yillik' ? endOfYear(new Date(secilenYil, 0, 1)) : endOfMonth(new Date(secilenYil, secilenAy, 1));
        let q;
        const baseQueryConditions = [
          where('companyId', '==', kullanici.companyId),
          where('tarih', '>=', Timestamp.fromDate(tarihBaslangic)),
          where('tarih', '<=', Timestamp.fromDate(tarihBitis))
        ];

        if (kullanici.rol === 'musteri') {
          const sahaIds = getMusteriSahaIds();
          if (sahaIds.length === 0) { setUretimVerileri([]); setYenileniyor(false); return; }
          if (secilenSantral !== 'tumu') {
            if (!sahaIds.includes(secilenSantral)) { setUretimVerileri([]); setYenileniyor(false); return; }
            q = query(collection(db, 'uretimVerileri'), ...baseQueryConditions, where('santralId', '==', secilenSantral), orderBy('tarih', 'desc'));
          } else {
            const limitedSahaIds = sahaIds.slice(0, 10);
            if (limitedSahaIds.length > 0) {
               q = query(collection(db, 'uretimVerileri'), ...baseQueryConditions, where('santralId', 'in', limitedSahaIds), orderBy('tarih', 'desc'));
            } else {
               setUretimVerileri([]); setYenileniyor(false); return;
            }
          }
        } else {
          if (secilenSantral !== 'tumu') {
            q = query(collection(db, 'uretimVerileri'), ...baseQueryConditions, where('santralId', '==', secilenSantral), orderBy('tarih', 'desc'));
          } else {
            q = query(collection(db, 'uretimVerileri'), ...baseQueryConditions, orderBy('tarih', 'desc'));
          }
        }
        const snapshot = await getDocs(q);
        setUretimVerileri(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UretimVerisi)));
      } catch (error) {
        console.error('Üretim verileri getirme hatası:', error);
        toast.error('Üretim verileri yüklenirken bir hata oluştu');
        setUretimVerileri([]);
      } finally {
        setYenileniyor(false);
      }
    };
    verileriGetir();
  }, [secilenSantral, secilenYil, secilenAy, gorunumTipi, santraller, kullanici, initialSantralId]);

  const performansOzeti = useMemo((): PerformansOzeti => {
    const filtrelenmisVeriler = uretimVerileri;
    const ilgiliSantraller = secilenSantral !== 'tumu' 
      ? santraller.filter(s => s.id === secilenSantral)
      : santraller;

    let toplamHedef = 0;
    if (gorunumTipi === 'yillik') {
      toplamHedef = ilgiliSantraller.reduce((total, santral) => total + (santral.yillikHedefUretim || 0), 0);
    } else {
      toplamHedef = ilgiliSantraller.reduce((total, santral) => total + getSantralHedef(santral, secilenAy), 0);
    }
    const toplamGerceklesen = filtrelenmisVeriler.reduce((total, veri) => total + veri.gunlukUretim, 0);
    const toplamCO2Tasarrufu = filtrelenmisVeriler.reduce((total, veri) => total + (veri.tasarrufEdilenCO2 || (veri.gunlukUretim * 0.5)), 0);
    const uniqueTarihler = new Set(filtrelenmisVeriler.map(v => v.tarih.toDate().toDateString()));

    return {
      toplamHedef, toplamGerceklesen,
      basariOrani: toplamHedef > 0 ? (toplamGerceklesen / toplamHedef) * 100 : 0,
      aktifSantralSayisi: ilgiliSantraller.length,
      veriGunSayisi: uniqueTarihler.size,
      toplamCO2Tasarrufu
    };
  }, [uretimVerileri, santraller, secilenSantral, secilenYil, secilenAy, gorunumTipi]);

  const chartData = useMemo((): ChartData[] => {
    const ilgiliSantraller = secilenSantral !== 'tumu' 
        ? santraller.filter(s => s.id === secilenSantral)
        : santraller;

    if (gorunumTipi === 'aylik') {
        const ayBaslangic = startOfMonth(new Date(secilenYil, secilenAy, 1));
        const gunSayisi = endOfMonth(ayBaslangic).getDate();
        return Array.from({ length: gunSayisi }, (_, index) => {
            const gun = index + 1;
            const gunTarihi = new Date(secilenYil, secilenAy, gun);
            const gunVerileri = uretimVerileri.filter(v => {
                const veriTarihi = v.tarih.toDate();
                return isValid(veriTarihi) && veriTarihi.getDate() === gun && veriTarihi.getMonth() === secilenAy && veriTarihi.getFullYear() === secilenYil;
            });
            const gunlukHedef = ilgiliSantraller.reduce((total, santral) => total + (getSantralHedef(santral, secilenAy) / gunSayisi), 0);
            const gerceklesen = gunVerileri.reduce((total, v) => total + v.gunlukUretim, 0);
            return { name: `${gun}`, "Hedef Üretim": gunlukHedef, "Gerçekleşen Üretim": gerceklesen };
        });
    } else {
        return ayTurkce.map(ay => {
            const ayBaslangic = new Date(secilenYil, ay.index, 1);
            const ayBitis = endOfMonth(ayBaslangic);
            const ayVerileri = uretimVerileri.filter(v => {
                const veriTarihi = v.tarih.toDate();
                return isValid(veriTarihi) && veriTarihi >= ayBaslangic && veriTarihi <= ayBitis;
            });
            const hedef = ilgiliSantraller.reduce((total, santral) => total + getSantralHedef(santral, ay.index), 0);
            const gerceklesen = ayVerileri.reduce((total, v) => total + v.gunlukUretim, 0);
            return { name: ay.label, "Hedef Üretim": hedef, "Gerçekleşen Üretim": gerceklesen };
        });
    }
  }, [uretimVerileri, santraller, secilenSantral, secilenYil, secilenAy, gorunumTipi]);

  const valueFormatter: ValueFormatter = (number) => 
    `${(number / (gorunumTipi === 'aylik' ? 1 : 1000)).toLocaleString('tr-TR', {maximumFractionDigits:1})} ${gorunumTipi === 'aylik' ? 'kWh' : 'MWh'}`;

  const handleYenile = async () => {
    setYenileniyor(true);
    try {
      if (!kullanici?.companyId) { setYenileniyor(false); return;}
      let sQuery;
      if (kullanici.rol === 'musteri') {
        const sahaIds = getMusteriSahaIds();
        if (sahaIds.length === 0) { setSantraller([]); setYenileniyor(false); return; }
        const allS: Santral[] = [];
        for (let i = 0; i < sahaIds.length; i += 10) {
          const batch = sahaIds.slice(i, i + 10);
          const bQuery = query(collection(db, 'santraller'), where('__name__', 'in', batch));
          const bSnapshot = await getDocs(bQuery);
          allS.push(...bSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Santral)));
        }
        setSantraller(allS);
      } else {
        sQuery = query(collection(db, 'santraller'), where('companyId', '==', kullanici.companyId), orderBy('ad'));
        const sSnapshot = await getDocs(sQuery);
        setSantraller(sSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Santral)));
      }
      toast.success('Veriler başarıyla yenilendi');
    } catch (error) {
      console.error('Yenileme hatası:', error);
      toast.error('Veriler yenilenirken bir hata oluştu');
    } finally {
        setYenileniyor(false);
    }
  };

  const handleExcelExport = () => {
    try {
      if (chartData.length === 0) {
        toast.error('Dışa aktarılacak veri bulunamadı'); return;
      }
      const excelData = chartData.map(veri => ({
        [gorunumTipi === 'aylik' ? 'Gün' : 'Ay']: veri.name,
        'Hedef Üretim (kWh)': veri["Hedef Üretim"].toFixed(0),
        'Gerçekleşen Üretim (kWh)': veri["Gerçekleşen Üretim"].toFixed(0),
        'Başarı Oranı (%)': (veri["Hedef Üretim"] > 0 ? (veri["Gerçekleşen Üretim"] / veri["Hedef Üretim"]) * 100 : 0).toFixed(1),
      }));
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Üretim Analizi');
      const dosyaAdi = gorunumTipi === 'aylik' 
        ? `Uretim_Analizi_${secilenYil}_${ayTurkce[secilenAy].label}.xlsx`
        : `Uretim_Analizi_${secilenYil}.xlsx`;
      XLSX.writeFile(workbook, dosyaAdi);
      toast.success('Excel dosyası başarıyla indirildi');
    } catch (error) {
      console.error('Excel dışa aktarma hatası:', error);
      toast.error('Excel dosyası oluşturulurken bir hata oluştu');
    }
  };

  const handleVeriSil = async (id: string) => {
    if (!canDelete) { toast.error('Bu işlem için yetkiniz yok'); return; }
    try {
      await deleteDoc(doc(db, 'uretimVerileri', id));
      toast.success('Üretim verisi başarıyla silindi');
      setUretimVerileri(prev => prev.filter(veri => veri.id !== id));
      setSeciliSilinecekKayitId(null);
      setIsSilmeOnayModalOpen(false);
    } catch (error) {
      console.error('Veri silme hatası:', error);
      toast.error('Veri silinirken bir hata oluştu');
    }
  };

  const handleTopluSil = async () => {
    if (!canDelete || topluSilinecekKayitIdleri.length === 0) { toast.error('Silmek için veri seçiniz veya yetkiniz yok.'); return; }
    try {
      const batch = writeBatch(db);
      topluSilinecekKayitIdleri.forEach(veriId => batch.delete(doc(db, 'uretimVerileri', veriId)));
      await batch.commit();
      toast.success(`${topluSilinecekKayitIdleri.length} adet veri başarıyla silindi`);
      setUretimVerileri(prev => prev.filter(veri => !topluSilinecekKayitIdleri.includes(veri.id)));
      setTopluSilinecekKayitIdleri([]);
      setIsTopluSilmeOnayModalOpen(false);
    } catch (error) {
      console.error('Toplu silme hatası:', error);
      toast.error('Veriler silinirken bir hata oluştu');
    }
  };

  const handleVeriSecimDegistir = (veriId: string, secili: boolean) => {
    if (secili) {
      setTopluSilinecekKayitIdleri(prev => [...prev, veriId]);
    } else {
      setTopluSilinecekKayitIdleri(prev => prev.filter(id => id !== veriId));
    }
  };

  const handleTumunuSec = () => {
    if (uretimVerileri.length === 0) return;
    setTopluSilinecekKayitIdleri(prev => prev.length === uretimVerileri.length ? [] : uretimVerileri.map(v => v.id));
  };

  const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType; color: string }> = 
  ({ title, value, icon: Icon, color }) => (
    <div className={`bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center`}>
      <div className={`p-3 rounded-lg bg-${color}-100 text-${color}-600 mr-4`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-xl font-semibold text-gray-800">{value}</p>
      </div>
    </div>
  );
  
  if (yukleniyor && santraller.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)] bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center">
            <div className={`p-3 bg-blue-600 rounded-lg mr-4`}>
              <BarChart3 className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Üretim Verileri {initialSantralAdi ? `- ${initialSantralAdi}` : ''}
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                { secilenSantral === 'tumu' 
                    ? `${performansOzeti.aktifSantralSayisi} santral` 
                    : `${santraller.find(s=>s.id === secilenSantral)?.ad || 'Seçili Santral'}`
                } • {performansOzeti.veriGunSayisi} gün veri • {gorunumTipi === 'aylik' ? `${ayTurkce[secilenAy].label} ${secilenYil}` : secilenYil}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleYenile}
              disabled={yenileniyor}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 transition-colors disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 mr-2 ${yenileniyor ? 'animate-spin' : ''}`} />
              Yenile
            </button>
            {canAdd && (
              <button
                onClick={() => setIsBulkImportModalOpen(true)}
                className="flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                <UploadCloud className="h-4 w-4 mr-2" />
                Veri İçe Aktar
              </button>
            )}
             <button
              onClick={handleExcelExport}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 transition-colors">
              <Download className="h-4 w-4 mr-2" />
              Excel İndir
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label htmlFor="gorunumTipi" className="block text-xs font-medium text-gray-500 mb-1">Görünüm</label>
            <select id="gorunumTipi" value={gorunumTipi} onChange={(e) => setGorunumTipi(e.target.value as GorunumTipi)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2">
              <option value="yillik">Yıllık İzleme</option>
              <option value="aylik">Aylık İzleme</option>
            </select>
          </div>
          <div>
            <label htmlFor="santralSecimi" className="block text-xs font-medium text-gray-500 mb-1">Santral</label>
            <select id="santralSecimi" value={secilenSantral} onChange={(e) => setSecilenSantral(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2">
              <option value="tumu">Tüm Santraller</option>
              {santraller.map(santral => (
                <option key={santral.id} value={santral.id}>{santral.ad}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="yilSecimi" className="block text-xs font-medium text-gray-500 mb-1">Yıl</label>
            <select id="yilSecimi" value={secilenYil} onChange={(e) => setSecilenYil(parseInt(e.target.value))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2">
              {yilSecenekleri.map(yil => (
                <option key={yil} value={yil}>{yil}</option>
              ))}
            </select>
          </div>
          {gorunumTipi === 'aylik' && (
            <div>
              <label htmlFor="aySecimi" className="block text-xs font-medium text-gray-500 mb-1">Ay</label>
              <select id="aySecimi" value={secilenAy} onChange={(e) => setSecilenAy(parseInt(e.target.value))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-2">
                {ayTurkce.map(ay => (
                  <option key={ay.index} value={ay.index}>{ay.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={`${gorunumTipi === 'aylik' ? 'Aylık' : 'Yıllık'} Hedef`} value={`${(performansOzeti.toplamHedef / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh`} icon={Target} color="blue" />
        <StatCard title="Gerçekleşen Üretim" value={`${(performansOzeti.toplamGerceklesen / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh`} icon={Activity} color="green" />
        <StatCard title="Toplam CO₂ Tasarrufu" value={`${performansOzeti.toplamCO2Tasarrufu.toLocaleString('tr-TR')} kg`} icon={Building} color="yellow" />
        <StatCard title="Başarı Oranı" value={`%${performansOzeti.basariOrani.toFixed(1)}`} icon={TrendingUp} color="indigo" />
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">
          {gorunumTipi === 'aylik' ? 'Günlük' : 'Aylık'} Üretim Performansı
        </h3>
        <p className="text-sm text-gray-500 mb-4">Hedeflenen ve gerçekleşen üretim miktarlarının karşılaştırması.</p>
        {chartData.length > 0 ? (
            <AreaChart
                className="h-80"
                data={chartData}
                index="name"
                categories={["Hedef Üretim", "Gerçekleşen Üretim"]}
                colors={["blue", "green"]}
                valueFormatter={valueFormatter}
                yAxisWidth={60}
                showAnimation={true}
            />
         ) : (
            <div className="h-80 flex items-center justify-center text-gray-500 bg-gray-50 rounded-md">
                Grafik için yeterli veri bulunamadı.
            </div>
        )}
      </div>

      <div className="bg-white p-0 rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
                <h3 className="text-lg font-semibold text-gray-800">Detaylı Üretim Kayıtları</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {gorunumTipi === 'aylik' 
                    ? `Toplam ${uretimVerileri.length} günlük kayıt bulundu. (İlk 50 gösteriliyor)`
                    : `${secilenYil} yılının aylık özet verileri`
                  }
                </p>
            </div>
            {canDelete && topluSilinecekKayitIdleri.length > 0 && gorunumTipi === 'aylik' && (
              <button onClick={() => setIsTopluSilmeOnayModalOpen(true)}
                className="flex items-center px-3 py-1.5 border border-transparent rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors">
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Seçilenleri Sil ({topluSilinecekKayitIdleri.length})
              </button>
            )}
        </div>
        <div className="overflow-x-auto">
          {gorunumTipi === 'aylik' ? (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {canDelete && (
                    <th className="py-3 pl-4 pr-3 text-left w-12">
                      <button onClick={handleTumunuSec} className={`p-1 rounded ${topluSilinecekKayitIdleri.length === uretimVerileri.length && uretimVerileri.length > 0 ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}>
                        {topluSilinecekKayitIdleri.length === uretimVerileri.length && uretimVerileri.length > 0 ? <CheckSquare size={16}/> : <Square size={16}/>}
                      </button>
                    </th>
                  )}
                  <th className="py-3 px-3 text-left font-medium text-gray-500 uppercase">Tarih</th>
                  <th className="py-3 px-3 text-left font-medium text-gray-500 uppercase">Santral</th>
                  <th className="py-3 px-3 text-right font-medium text-gray-500 uppercase">Üretim (kWh)</th>
                  <th className="py-3 pl-3 pr-4 text-center font-medium text-gray-500 uppercase w-20">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {uretimVerileri.length === 0 && !yenileniyor && (
                  <tr><td colSpan={canDelete ? 5 : 4} className="text-center py-10 text-gray-500">Filtrelerle eşleşen üretim verisi bulunamadı.</td></tr>
                )}
                {yenileniyor && uretimVerileri.length === 0 && (
                   <tr><td colSpan={canDelete ? 5 : 4} className="text-center py-10 text-gray-500"><LoadingSpinner/> Veriler yükleniyor...</td></tr>
                )}
                {uretimVerileri.slice(0, 50).map((veri) => {
                  const santral = santraller.find(s => s.id === veri.santralId);
                  const veriTarihi = veri.tarih.toDate();
                  
                  return (
                    <tr key={veri.id} className={`hover:bg-gray-50 transition-colors ${topluSilinecekKayitIdleri.includes(veri.id) ? 'bg-blue-50' : ''}`}>
                      {canDelete && (
                        <td className="py-3 pl-4 pr-3 whitespace-nowrap">
                          <button onClick={() => handleVeriSecimDegistir(veri.id, !topluSilinecekKayitIdleri.includes(veri.id))}
                             className={`p-1 rounded ${topluSilinecekKayitIdleri.includes(veri.id) ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}>
                             {topluSilinecekKayitIdleri.includes(veri.id) ? <CheckSquare size={16}/> : <Square size={16}/>}
                          </button>
                        </td>
                      )}
                      <td className="py-3 px-3 whitespace-nowrap text-gray-700 font-medium">{isValid(veriTarihi) ? format(veriTarihi, 'dd MMM yyyy', { locale: tr }) : 'Geçersiz Tarih'}</td>
                      <td className="py-3 px-3 whitespace-nowrap text-gray-700">{santral?.ad || '-'}</td>
                      <td className="py-3 px-3 whitespace-nowrap text-right text-gray-800 font-semibold">{veri.gunlukUretim.toLocaleString('tr-TR', {maximumFractionDigits: 1})}</td>
                      <td className="py-3 pl-3 pr-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button onClick={() => { setSecilenVeriDetay(veri); setIsDetailModalOpen(true); }} title="Detayları Görüntüle"
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"><Eye size={16} /></button>
                          {canDelete && (
                            <button onClick={() => { setSeciliSilinecekKayitId(veri.id); setIsSilmeOnayModalOpen(true); }} title="Veriyi Sil"
                              className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors"><Trash2 size={16} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* Yıllık görünüm - Aylık toplamlar */
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-3 text-left font-medium text-gray-500 uppercase">Ay</th>
                  <th className="py-3 px-3 text-center font-medium text-gray-500 uppercase">Santral Sayısı</th>
                  <th className="py-3 px-3 text-right font-medium text-gray-500 uppercase">Hedef (kWh)</th>
                  <th className="py-3 px-3 text-right font-medium text-gray-500 uppercase">Gerçekleşen (kWh)</th>
                  <th className="py-3 px-3 text-center font-medium text-gray-500 uppercase">Başarı Oranı</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {chartData.map((ayVeri) => {
                  const basariOrani = ayVeri["Hedef Üretim"] > 0 ? (ayVeri["Gerçekleşen Üretim"] / ayVeri["Hedef Üretim"]) * 100 : 0;
                  const ayIndeksi = ayTurkce.findIndex(ay => ay.label === ayVeri.name);
                  const ayBaslangic = new Date(secilenYil, ayIndeksi, 1);
                  const ayBitis = endOfMonth(ayBaslangic);
                  const ayVerileri = uretimVerileri.filter(v => {
                    const veriTarihi = v.tarih.toDate();
                    return isValid(veriTarihi) && veriTarihi >= ayBaslangic && veriTarihi <= ayBitis;
                  });
                  const benzersizSantrallar = new Set(ayVerileri.map(v => v.santralId)).size;
                  
                  return (
                    <tr key={ayVeri.name} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap text-gray-700 font-medium">{ayVeri.name} {secilenYil}</td>
                      <td className="py-3 px-3 whitespace-nowrap text-center text-gray-700">{benzersizSantrallar}</td>
                      <td className="py-3 px-3 whitespace-nowrap text-right text-gray-700">{ayVeri["Hedef Üretim"].toLocaleString('tr-TR', {maximumFractionDigits: 0})}</td>
                      <td className="py-3 px-3 whitespace-nowrap text-right text-gray-800 font-semibold">{ayVeri["Gerçekleşen Üretim"].toLocaleString('tr-TR', {maximumFractionDigits: 0})}</td>
                      <td className="py-3 px-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          basariOrani >= 80 ? 'bg-green-100 text-green-800' :
                          basariOrani >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                        }`}>
                          %{basariOrani.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isBulkImportModalOpen && secilenSantral && (
        <BulkImportModal
          onClose={() => setIsBulkImportModalOpen(false)}
          onSuccess={() => {
            handleYenile();
            setIsBulkImportModalOpen(false);
          }}
          santralId={secilenSantral}
          santralKapasite={santraller.find(s => s.id === secilenSantral)?.kapasite || 0}
        />
      )}

      {isSilmeOnayModalOpen && seciliSilinecekKayitId && (
        <SilmeOnayModal
          baslik="Üretim Kaydını Sil"
          mesaj="Bu üretim kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
          onConfirm={() => handleVeriSil(seciliSilinecekKayitId)}
          onCancel={() => {
            setSeciliSilinecekKayitId(null);
            setIsSilmeOnayModalOpen(false);
          }}
        />
      )}

      {isTopluSilmeOnayModalOpen && topluSilinecekKayitIdleri.length > 0 && (
        <SilmeOnayModal
          baslik="Toplu Kayıt Silme"
          mesaj={`${topluSilinecekKayitIdleri.length} adet üretim kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
          onConfirm={handleTopluSil}
          onCancel={() => {
            setTopluSilinecekKayitIdleri([]);
            setIsTopluSilmeOnayModalOpen(false);
          }}
        />
      )}

      {isDetailModalOpen && secilenVeriDetay && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-[50] overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between rounded-t-lg">
              <h3 className="text-lg font-semibold text-gray-900">Üretim Verisi Detayı</h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-3 overflow-y-auto flex-grow text-sm">
              {[ 
                { label: 'Tarih', value: format(secilenVeriDetay.tarih.toDate(), 'dd MMMM yyyy, EEEE', { locale: tr }) },
                { label: 'Santral', value: santraller.find(s => s.id === secilenVeriDetay.santralId)?.ad || 'Bilinmeyen' },
                { label: 'Günlük Üretim', value: `${secilenVeriDetay.gunlukUretim.toLocaleString('tr-TR')} kWh`, bold: true },
                { label: 'Anlık Güç', value: secilenVeriDetay.anlikGuc ? `${secilenVeriDetay.anlikGuc.toLocaleString('tr-TR')} kW` : '-' },
                { label: 'Performans Oranı', value: `%${secilenVeriDetay.performansOrani.toFixed(1)}` },
                { label: 'CO₂ Tasarrufu', value: `${secilenVeriDetay.tasarrufEdilenCO2.toLocaleString('tr-TR')} kg` },
                secilenVeriDetay.hava && {
                    label: 'Hava Durumu', 
                    value: `Sıcaklık: ${secilenVeriDetay.hava.sicaklik}°C, Nem: %${secilenVeriDetay.hava.nem}, Radyasyon: ${secilenVeriDetay.hava.radyasyon} W/m²` 
                },
                secilenVeriDetay.olusturanKisi && { label: 'Oluşturan Kişi', value: `${secilenVeriDetay.olusturanKisi.ad} (${secilenVeriDetay.olusturanKisi.id.substring(0,5)}...)` },
                { label: 'Kayıt Tarihi', value: format(secilenVeriDetay.olusturmaTarihi.toDate(), 'dd MMM yyyy, HH:mm', { locale: tr }) },
              ].filter(Boolean).map((item: any) => (
                <div key={item.label} className="grid grid-cols-3 gap-2 py-1.5 border-b border-gray-100 last:border-b-0">
                  <p className="text-gray-500 col-span-1">{item.label}</p>
                  <p className={`col-span-2 text-gray-800 ${item.bold ? 'font-semibold' : ''} ${item.color || ''}`}>{item.value}</p>
                </div>
              ))}
            </div>
             <div className="sticky bottom-0 bg-gray-50 px-6 py-3 border-t border-gray-200 flex justify-end rounded-b-lg">
                <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    Kapat
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
