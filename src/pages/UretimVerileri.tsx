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
  Minus
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

interface HedefGerceklesmeAnalizi {
  yillikHedef: number;
  yillikGerceklesen: number;
  yillikGerceklesmeOrani: number;
  aylikHedef: number;
  aylikGerceklesen: number;
  aylikGerceklesmeOrani: number;
  toplamGelir: number;
  toplamDagitimBedeli: number;
  netGelir: number;
  ortalamaBirimFiyat: number;
  performansTrendi: 'yukselis' | 'dusus' | 'sabit';
}

interface AylikKarsilastirma {
  ay: string;
  ayIndex: number;
  hedefUretim: number;
  gerceklesenUretim: number;
  gerceklesmeOrani: number;
  hedefGelir: number;
  gerceklesenGelir: number;
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
  const [secilenAy, setSecilenAy] = useState<number>(new Date().getMonth());
  const [goruntulemeSecenegi, setGoruntulemeSecenegi] = useState<'yillik' | 'aylik'>('yillik');

  // Modal states
  const [importModalAcik, setImportModalAcik] = useState(false);
  const [silmeOnayModalAcik, setSilmeOnayModalAcik] = useState(false);
  const [silinecekVeriId, setSilinecekVeriId] = useState<string | null>(null);
  const [detayModalAcik, setDetayModalAcik] = useState(false);
  const [secilenVeriDetay, setSecilenVeriDetay] = useState<UretimVerisi | null>(null);

  // Yıl ve ay seçenekleri
  const yilSecenekleri = Array.from({ length: 10 }, (_, i) => 2022 + i);
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

  // Elektrik fiyatlarını al (santral yönetimi sayfasından)
  const getElektrikFiyatlari = (santral: Santral, tarih: Date) => {
    const yil = tarih.getFullYear().toString();
    const ayKey = aySecenekleri[tarih.getMonth()]?.key;

    if (santral.elektrikFiyatlari?.[yil]?.[ayKey]) {
      return santral.elektrikFiyatlari[yil][ayKey];
    }

    // Varsayılan fiyatlar
    return {
      birimFiyat: 5.0,
      dagitimBedeli: 0.5
    };
  };

  // Santral hedef üretimini al (santral yönetimi sayfasından)
  const getSantralHedefUretim = (santral: Santral, ayIndex?: number) => {
    if (ayIndex !== undefined && santral.aylikHedefler) {
      const ayKey = aySecenekleri[ayIndex]?.key;
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
        let tarihBaslangic: Date;
        let tarihBitis: Date;

        if (goruntulemeSecenegi === 'yillik') {
          tarihBaslangic = startOfYear(new Date(secilenYil, 0, 1));
          tarihBitis = endOfYear(new Date(secilenYil, 0, 1));
        } else {
          tarihBaslangic = new Date(secilenYil, secilenAy, 1);
          tarihBitis = endOfMonth(tarihBaslangic);
        }

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
  }, [secilenSantral, secilenYil, secilenAy, goruntulemeSecenegi, santraller, kullanici]);

  // Hedef vs Gerçekleşen analizi
  const hedefGerceklesmeAnalizi = useMemo((): HedefGerceklesmeAnalizi => {
    const filtrelenmisVeriler = secilenSantral !== 'tumu'
      ? uretimVerileri.filter(v => v.santralId === secilenSantral)
      : uretimVerileri;

    const secilenSantralData = secilenSantral !== 'tumu' 
      ? santraller.find(s => s.id === secilenSantral)
      : null;

    // Yıllık hedef ve gerçekleşme
    let yillikHedef = 0;
    if (secilenSantralData) {
      yillikHedef = secilenSantralData.yillikHedefUretim || 0;
    } else if (secilenSantral === 'tumu') {
      yillikHedef = santraller.reduce((total, s) => total + (s.yillikHedefUretim || 0), 0);
    }

    const yillikGerceklesen = filtrelenmisVeriler.reduce((total, v) => total + v.gunlukUretim, 0);

    // Aylık hedef ve gerçekleşme
    let aylikHedef = 0;
    if (secilenSantralData?.aylikHedefler) {
      const ayKey = aySecenekleri[secilenAy]?.key;
      aylikHedef = secilenSantralData.aylikHedefler[ayKey] || (yillikHedef / 12);
    } else if (secilenSantral === 'tumu') {
      const ayKey = aySecenekleri[secilenAy]?.key;
      aylikHedef = santraller.reduce((total, santral) => {
        const santralAylikHedef = santral.aylikHedefler?.[ayKey] || (santral.yillikHedefUretim || 0) / 12;
        return total + santralAylikHedef;
      }, 0);
    } else {
      aylikHedef = yillikHedef / 12;
    }

    const aylikGerceklesen = filtrelenmisVeriler
      .filter(v => {
        if (goruntulemeSecenegi !== 'aylik') return true;
        const veriTarihi = v.tarih.toDate();
        return veriTarihi.getFullYear() === secilenYil && veriTarihi.getMonth() === secilenAy;
      })
      .reduce((total, v) => total + v.gunlukUretim, 0);

    // Gelir analizi (santral fiyatlarını kullan)
    let toplamGelir = 0;
    let toplamDagitimBedeli = 0;

    filtrelenmisVeriler.forEach(veri => {
      const santral = santraller.find(s => s.id === veri.santralId);
      if (santral) {
        const fiyatlar = getElektrikFiyatlari(santral, veri.tarih.toDate());
        toplamGelir += veri.gunlukUretim * fiyatlar.birimFiyat;
        toplamDagitimBedeli += veri.gunlukUretim * fiyatlar.dagitimBedeli;
      } else {
        toplamGelir += veri.gelir || 0;
        toplamDagitimBedeli += veri.dagitimBedeli || 0;
      }
    });

    // Performans trendi hesaplama
    const sonVeriler = filtrelenmisVeriler.slice(0, 15);
    const oncekiVeriler = filtrelenmisVeriler.slice(15, 30);
    const sonOrtalama = sonVeriler.length > 0 ? 
      sonVeriler.reduce((total, v) => total + v.gunlukUretim, 0) / sonVeriler.length : 0;
    const oncekiOrtalama = oncekiVeriler.length > 0 ? 
      oncekiVeriler.reduce((total, v) => total + v.gunlukUretim, 0) / oncekiVeriler.length : 0;

    let performansTrendi: 'yukselis' | 'dusus' | 'sabit' = 'sabit';
    if (sonOrtalama > oncekiOrtalama * 1.05) {
      performansTrendi = 'yukselis';
    } else if (sonOrtalama < oncekiOrtalama * 0.95) {
      performansTrendi = 'dusus';
    }

    return {
      yillikHedef,
      yillikGerceklesen,
      yillikGerceklesmeOrani: yillikHedef > 0 ? (yillikGerceklesen / yillikHedef) * 100 : 0,
      aylikHedef,
      aylikGerceklesen,
      aylikGerceklesmeOrani: aylikHedef > 0 ? (aylikGerceklesen / aylikHedef) * 100 : 0,
      toplamGelir,
      toplamDagitimBedeli,
      netGelir: toplamGelir - toplamDagitimBedeli,
      ortalamaBirimFiyat: yillikGerceklesen > 0 ? toplamGelir / yillikGerceklesen : 0,
      performansTrendi
    };
  }, [uretimVerileri, santraller, secilenSantral, secilenYil, secilenAy, goruntulemeSecenegi]);

  // Aylık karşılaştırma verileri
  const aylikKarsilastirmaVerileri = useMemo((): AylikKarsilastirma[] => {
    const secilenSantralData = secilenSantral !== 'tumu' 
      ? santraller.find(s => s.id === secilenSantral)
      : null;

    return aySecenekleri.map(ay => {
      const ayBaslangic = new Date(secilenYil, ay.value, 1);
      const ayBitis = endOfMonth(ayBaslangic);

      const ayVerileri = uretimVerileri.filter(v => {
        const veriTarihi = v.tarih.toDate();
        return veriTarihi >= ayBaslangic && veriTarihi <= ayBitis &&
          (secilenSantral === 'tumu' || v.santralId === secilenSantral);
      });

      const gerceklesenUretim = ayVerileri.reduce((total, v) => total + v.gunlukUretim, 0);

      // Hedef üretim (santral yönetimi sayfasından)
      let hedefUretim = 0;
      if (secilenSantralData?.aylikHedefler) {
        hedefUretim = secilenSantralData.aylikHedefler[ay.key] || (secilenSantralData.yillikHedefUretim || 0) / 12;
      } else if (secilenSantral === 'tumu') {
        hedefUretim = santraller.reduce((total, santral) => {
          const santralAylikHedef = santral.aylikHedefler?.[ay.key] || (santral.yillikHedefUretim || 0) / 12;
          return total + santralAylikHedef;
        }, 0);
      }

      // Gelir hesaplama (santral fiyatlarını kullan)
      let gerceklesenGelir = 0;
      let dagitimBedeli = 0;
      let toplamBirimFiyat = 0;
      let fiyatSayaci = 0;

      ayVerileri.forEach(veri => {
        const santral = santraller.find(s => s.id === veri.santralId);
        if (santral) {
          const fiyatlar = getElektrikFiyatlari(santral, veri.tarih.toDate());
          gerceklesenGelir += veri.gunlukUretim * fiyatlar.birimFiyat;
          dagitimBedeli += veri.gunlukUretim * fiyatlar.dagitimBedeli;
          toplamBirimFiyat += fiyatlar.birimFiyat;
          fiyatSayaci++;
        } else {
          gerceklesenGelir += veri.gelir || 0;
          dagitimBedeli += veri.dagitimBedeli || 0;
        }
      });

      const ortalamaBirimFiyat = fiyatSayaci > 0 ? toplamBirimFiyat / fiyatSayaci : 0;
      const hedefGelir = hedefUretim * ortalamaBirimFiyat;

      return {
        ay: ay.label,
        ayIndex: ay.value,
        hedefUretim,
        gerceklesenUretim,
        gerceklesmeOrani: hedefUretim > 0 ? (gerceklesenUretim / hedefUretim) * 100 : 0,
        hedefGelir,
        gerceklesenGelir,
        dagitimBedeli,
        netGelir: gerceklesenGelir - dagitimBedeli,
        birimFiyat: ortalamaBirimFiyat
      };
    });
  }, [uretimVerileri, santraller, secilenSantral, secilenYil, secilenAy]);

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
      if (aylikKarsilastirmaVerileri.length === 0) {
        toast.error('Dışa aktarılacak veri bulunamadı');
        return;
      }

      const excelData = aylikKarsilastirmaVerileri.map(veri => ({
        'Ay': veri.ay,
        'Hedef Üretim (kWh)': veri.hedefUretim.toFixed(0),
        'Gerçekleşen Üretim (kWh)': veri.gerceklesenUretim.toFixed(0),
        'Gerçekleşme Oranı (%)': veri.gerceklesmeOrani.toFixed(1),
        'Hedef Gelir (₺)': veri.hedefGelir.toFixed(2),
        'Gerçekleşen Gelir (₺)': veri.gerceklesenGelir.toFixed(2),
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
            <p className="mt-1 text-sm text-gray-500">Santral performans karşılaştırması</p>
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
                {santraller.length} santral • Performans karşılaştırması ve finansal analiz
              </p>
            </div>
          </div>

          {/* Ana İstatistikler */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">
                  %{goruntulemeSecenegi === 'yillik' ? 
                    hedefGerceklesmeAnalizi.yillikGerceklesmeOrani.toFixed(1) : 
                    hedefGerceklesmeAnalizi.aylikGerceklesmeOrani.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">
                  {goruntulemeSecenegi === 'yillik' ? 'Yıllık' : 'Aylık'} Gerçekleşme
                </div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">
                  ₺{hedefGerceklesmeAnalizi.netGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
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

          {/* Görüntüleme Seçeneği */}
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <select
              value={goruntulemeSecenegi}
              onChange={(e) => setGoruntulemeSecenegi(e.target.value as any)}
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
          {goruntulemeSecenegi === 'aylik' && (
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

      {/* Ana Metrik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card decoration="top" decorationColor="blue" className="bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">
                {goruntulemeSecenegi === 'yillik' ? 'Yıllık' : 'Aylık'} Hedef
              </Text>
              <Metric className="text-2xl font-bold text-gray-900">
                {((goruntulemeSecenegi === 'yillik' ? hedefGerceklesmeAnalizi.yillikHedef : hedefGerceklesmeAnalizi.aylikHedef) / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
              </Metric>
              <div className="mt-2">
                <Text className="text-xs text-gray-500">
                  Santral yönetiminden alındı
                </Text>
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
              <Text className="text-sm font-medium text-gray-600">Gerçekleşen Üretim</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                {((goruntulemeSecenegi === 'yillik' ? hedefGerceklesmeAnalizi.yillikGerceklesen : hedefGerceklesmeAnalizi.aylikGerceklesen) / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
              </Metric>
              <div className="flex items-center mt-1">
                <Badge 
                  color={
                    (goruntulemeSecenegi === 'yillik' ? hedefGerceklesmeAnalizi.yillikGerceklesmeOrani : hedefGerceklesmeAnalizi.aylikGerceklesmeOrani) >= 90 ? "green" : 
                    (goruntulemeSecenegi === 'yillik' ? hedefGerceklesmeAnalizi.yillikGerceklesmeOrani : hedefGerceklesmeAnalizi.aylikGerceklesmeOrani) >= 70 ? "yellow" : "red"
                  }
                  className="text-xs"
                >
                  %{(goruntulemeSecenegi === 'yillik' ? hedefGerceklesmeAnalizi.yillikGerceklesmeOrani : hedefGerceklesmeAnalizi.aylikGerceklesmeOrani).toFixed(1)}
                </Badge>
              </div>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </Card>

        <Card decoration="top" decorationColor="amber" className="bg-gradient-to-br from-amber-50 to-yellow-50">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Toplam Gelir</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                ₺{hedefGerceklesmeAnalizi.toplamGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
              </Metric>
              <Text className="text-xs text-gray-500 mt-1">
                Ort. fiyat: ₺{hedefGerceklesmeAnalizi.ortalamaBirimFiyat.toFixed(3)}/kWh
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
              <Text className="text-sm font-medium text-gray-600">Net Gelir</Text>
              <Metric className="text-2xl font-bold text-gray-900">
                ₺{hedefGerceklesmeAnalizi.netGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
              </Metric>
              <div className="flex items-center mt-1">
                {hedefGerceklesmeAnalizi.performansTrendi === 'yukselis' && <ArrowUp className="h-4 w-4 text-green-500 mr-1" />}
                {hedefGerceklesmeAnalizi.performansTrendi === 'dusus' && <ArrowDown className="h-4 w-4 text-red-500 mr-1" />}
                {hedefGerceklesmeAnalizi.performansTrendi === 'sabit' && <Minus className="h-4 w-4 text-gray-500 mr-1" />}
                <Text className="text-xs text-gray-500">
                  {hedefGerceklesmeAnalizi.performansTrendi === 'yukselis' ? 'Yükselişte' : 
                   hedefGerceklesmeAnalizi.performansTrendi === 'dusus' ? 'Düşüşte' : 'Sabit'}
                </Text>
              </div>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl">
              <TrendingUp className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Ana Grafik Alanı */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hedef vs Gerçekleşen Grafiği */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <Title>Aylık Hedef vs Gerçekleşen Üretim</Title>
            <Badge color="blue" className="text-xs">
              {secilenYil}
            </Badge>
          </div>
          <AreaChart
            className="mt-4 h-80"
            data={aylikKarsilastirmaVerileri}
            index="ay"
            categories={["hedefUretim", "gerceklesenUretim"]}
            colors={["blue", "green"]}
            valueFormatter={(value) => `${(value / 1000).toFixed(1)} MWh`}
            showAnimation={true}
            showGradient={true}
            showLegend={true}
          />
        </Card>

        {/* Gelir Karşılaştırması Grafiği */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <Title>Aylık Gelir Karşılaştırması</Title>
            <Badge color="green" className="text-xs">
              Net: ₺{hedefGerceklesmeAnalizi.netGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
            </Badge>
          </div>
          <BarChart
            className="mt-4 h-80"
            data={aylikKarsilastirmaVerileri}
            index="ay"
            categories={["hedefGelir", "gerceklesenGelir"]}
            colors={["amber", "green"]}
            valueFormatter={(value) => `₺${value.toLocaleString('tr-TR', {maximumFractionDigits: 0})}`}
            showAnimation={true}
            showLegend={true}
          />
        </Card>
      </div>

      {/* Aylık Detay Tablo */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <Title>Aylık Performans Detayı</Title>
          <Text>{aylikKarsilastirmaVerileri.filter(v => v.gerceklesenUretim > 0).length} ay aktif</Text>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ay</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hedef Üretim</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gerçekleşen</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gerçekleşme %</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hedef Gelir</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gerçekleşen Gelir</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Gelir</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Birim Fiyat</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {aylikKarsilastirmaVerileri.map((veri) => (
                <tr key={veri.ay} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{veri.ay}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {(veri.hedefUretim / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {(veri.gerceklesenUretim / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Badge
                      color={veri.gerceklesmeOrani >= 90 ? "green" : 
                             veri.gerceklesmeOrani >= 70 ? "yellow" : "red"}
                      className="text-xs"
                    >
                      %{veri.gerceklesmeOrani.toFixed(1)}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    ₺{veri.hedefGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    ₺{veri.gerceklesenGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
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

      {/* Özet Kart */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <Title>Performans Özeti - {secilenYil}</Title>
          <div className="flex items-center space-x-2">
            <Badge 
              color={hedefGerceklesmeAnalizi.yillikGerceklesmeOrani >= 90 ? "green" : 
                     hedefGerceklesmeAnalizi.yillikGerceklesmeOrani >= 70 ? "yellow" : "red"}
              className="text-sm"
            >
              %{hedefGerceklesmeAnalizi.yillikGerceklesmeOrani.toFixed(1)} Başarı
            </Badge>
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
                <span className="text-sm text-gray-600">Yıllık Hedef</span>
                <span className="font-medium">
                  {(hedefGerceklesmeAnalizi.yillikHedef / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Gerçekleşen</span>
                <span className="font-medium">
                  {(hedefGerceklesmeAnalizi.yillikGerceklesen / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Başarı Oranı</span>
                <Badge 
                  color={hedefGerceklesmeAnalizi.yillikGerceklesmeOrani >= 90 ? "green" : 
                         hedefGerceklesmeAnalizi.yillikGerceklesmeOrani >= 70 ? "yellow" : "red"}
                >
                  %{hedefGerceklesmeAnalizi.yillikGerceklesmeOrani.toFixed(1)}
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
                  ₺{hedefGerceklesmeAnalizi.toplamGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Dağıtım Bedeli</span>
                <span className="font-medium text-red-600">
                  ₺{hedefGerceklesmeAnalizi.toplamDagitimBedeli.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Net Gelir</span>
                <span className="font-medium text-green-600">
                  ₺{hedefGerceklesmeAnalizi.netGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900">Fiyat Analizi</h4>
              <BarChart2 className="h-6 w-6 text-amber-600" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Ortalama Birim Fiyat</span>
                <span className="font-medium">
                  ₺{hedefGerceklesmeAnalizi.ortalamaBirimFiyat.toFixed(3)}/kWh
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Dağıtım Oranı</span>
                <span className="font-medium">
                  %{((hedefGerceklesmeAnalizi.toplamDagitimBedeli / hedefGerceklesmeAnalizi.toplamGelir) * 100).toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Veri Kaynağı</span>
                <span className="text-xs text-green-600 font-medium">
                  Santral Yönetimi
                </span>
              </div>
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