
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, Timestamp, writeBatch } from 'firebase/firestore';
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
  Edit2,
  DollarSign,
  FileText,
  Check
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
  gelir: number;
  co2Tasarrufu: number;
  birimFiyat: number;
}

type GorunumTipi = 'yillik' | 'aylik';

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
  const [gorunumTipi, setGorunumTipi] = useState<GorunumTipi>('yillik');

  // Modal states
  const [importModalAcik, setImportModalAcik] = useState(false);
  const [silmeOnayModalAcik, setSilmeOnayModalAcik] = useState(false);
  const [silinecekVeriId, setSilinecekVeriId] = useState<string | null>(null);
  const [topluSilmeModalAcik, setTopluSilmeModalAcik] = useState(false);
  const [secilenVeriler, setSecilenVeriler] = useState<string[]>([]);
  const [detayModalAcik, setDetayModalAcik] = useState(false);
  const [secilenVeriDetay, setSecilenVeriDetay] = useState<UretimVerisi | null>(null);

  // Yıl ve ay seçenekleri
  const yilSecenekleri = Array.from({ length: 10 }, (_, i) => 2020 + i);
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

  // Elektrik fiyatını santraldan al
  const getElektrikFiyati = (santral: Santral, yil: number, ayIndex: number): number => {
    if (!santral.elektrikFiyatlari) return 2.5; // Varsayılan fiyat
    
    const yilFiyatlari = santral.elektrikFiyatlari[yil.toString()];
    if (!yilFiyatlari) return 2.5;
    
    const ayKey = aylar[ayIndex]?.key;
    if (!yilFiyatlari[ayKey]) return 2.5;
    
    return yilFiyatlari[ayKey].birimFiyat || 2.5;
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

        if (gorunumTipi === 'yillik') {
          tarihBaslangic = startOfYear(new Date(secilenYil, 0, 1));
          tarihBitis = endOfYear(new Date(secilenYil, 0, 1));
        } else {
          tarihBaslangic = startOfMonth(new Date(secilenYil, secilenAy, 1));
          tarihBitis = endOfMonth(new Date(secilenYil, secilenAy, 1));
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
  }, [secilenSantral, secilenYil, secilenAy, gorunumTipi, santraller, kullanici]);

  // Performans özetini hesapla
  const performansOzeti = useMemo((): PerformansOzeti => {
    const filtrelenmisVeriler = secilenSantral !== 'tumu'
      ? uretimVerileri.filter(v => v.santralId === secilenSantral)
      : uretimVerileri;

    const ilgiliSantraller = secilenSantral !== 'tumu' 
      ? santraller.filter(s => s.id === secilenSantral)
      : santraller;

    // Hedef hesaplama
    let toplamHedef = 0;
    if (gorunumTipi === 'yillik') {
      toplamHedef = ilgiliSantraller.reduce((total, santral) => {
        return total + (santral.yillikHedefUretim || 0);
      }, 0);
    } else {
      toplamHedef = ilgiliSantraller.reduce((total, santral) => {
        return total + getSantralHedef(santral, secilenAy);
      }, 0);
    }

    // Gerçekleşen hesaplama
    const toplamGerceklesen = filtrelenmisVeriler.reduce((total, veri) => {
      return total + veri.gunlukUretim;
    }, 0);

    // Gelir hesaplama - santral elektrik fiyatlarından
    let toplamGelir = 0;
    let toplamBirimFiyat = 0;
    let fiyatSayisi = 0;

    filtrelenmisVeriler.forEach(veri => {
      const santral = santraller.find(s => s.id === veri.santralId);
      if (santral) {
        const veriTarihi = veri.tarih.toDate();
        const birimFiyat = getElektrikFiyati(santral, veriTarihi.getFullYear(), veriTarihi.getMonth());
        toplamGelir += veri.gunlukUretim * birimFiyat;
        toplamBirimFiyat += birimFiyat;
        fiyatSayisi++;
      }
    });

    const ortalamaBirimFiyat = fiyatSayisi > 0 ? toplamBirimFiyat / fiyatSayisi : 2.5;

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
      toplamGelir,
      ortalamaBirimFiyat,
      aktifSantralSayisi: ilgiliSantraller.length,
      veriGunSayisi: uniqueTarihler.size,
      toplamCO2Tasarrufu
    };
  }, [uretimVerileri, santraller, secilenSantral, secilenYil, secilenAy, gorunumTipi]);

  // Aylık veri hesaplama
  const aylikVeriler = useMemo((): AylikVeri[] => {
    const ilgiliSantraller = secilenSantral !== 'tumu' 
      ? santraller.filter(s => s.id === secilenSantral)
      : santraller;

    if (gorunumTipi === 'aylik') {
      // Aylık görünümde günlük veriler
      const ayBaslangic = startOfMonth(new Date(secilenYil, secilenAy, 1));
      const ayBitis = endOfMonth(new Date(secilenYil, secilenAy, 1));
      const gunSayisi = ayBitis.getDate();

      return Array.from({ length: gunSayisi }, (_, index) => {
        const gun = index + 1;
        const gunTarihi = new Date(secilenYil, secilenAy, gun);
        
        const gunVerileri = uretimVerileri.filter(v => {
          const veriTarihi = v.tarih.toDate();
          return veriTarihi.getDate() === gun &&
            veriTarihi.getMonth() === secilenAy &&
            veriTarihi.getFullYear() === secilenYil &&
            (secilenSantral === 'tumu' || v.santralId === secilenSantral);
        });

        // Günlük hedef (aylık hedefin gün sayısına bölümü)
        const gunlukHedef = ilgiliSantraller.reduce((total, santral) => {
          const aylikHedef = getSantralHedef(santral, secilenAy);
          return total + (aylikHedef / gunSayisi);
        }, 0);

        // Gerçekleşen hesaplama
        const gerceklesen = gunVerileri.reduce((total, v) => total + v.gunlukUretim, 0);

        // Gelir hesaplama - santral elektrik fiyatlarından
        let gelir = 0;
        let ortalamaBirimFiyat = 0;

        if (gunVerileri.length > 0) {
          let toplamFiyat = 0;
          gunVerileri.forEach(veri => {
            const santral = santraller.find(s => s.id === veri.santralId);
            if (santral) {
              const birimFiyat = getElektrikFiyati(santral, secilenYil, secilenAy);
              gelir += veri.gunlukUretim * birimFiyat;
              toplamFiyat += birimFiyat;
            }
          });
          ortalamaBirimFiyat = toplamFiyat / gunVerileri.length;
        } else {
          // Veri yoksa ortalama fiyat kullan
          const santral = ilgiliSantraller[0];
          if (santral) {
            ortalamaBirimFiyat = getElektrikFiyati(santral, secilenYil, secilenAy);
          }
        }

        // CO2 tasarrufu hesaplama
        const co2Tasarrufu = gunVerileri.reduce((total, v) => 
          total + (v.tasarrufEdilenCO2 || (v.gunlukUretim * 0.5)), 0);

        return {
          ay: `${gun}`,
          ayIndex: gun - 1,
          hedef: gunlukHedef,
          gerceklesen,
          basariOrani: gunlukHedef > 0 ? (gerceklesen / gunlukHedef) * 100 : 0,
          gelir,
          co2Tasarrufu,
          birimFiyat: ortalamaBirimFiyat
        };
      });
    } else {
      // Yıllık görünümde aylık veriler
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

        // Gelir hesaplama - santral elektrik fiyatlarından
        let gelir = 0;
        let ortalamaBirimFiyat = 0;

        if (ayVerileri.length > 0) {
          let toplamFiyat = 0;
          ayVerileri.forEach(veri => {
            const santral = santraller.find(s => s.id === veri.santralId);
            if (santral) {
              const birimFiyat = getElektrikFiyati(santral, secilenYil, ay.index);
              gelir += veri.gunlukUretim * birimFiyat;
              toplamFiyat += birimFiyat;
            }
          });
          ortalamaBirimFiyat = toplamFiyat / ayVerileri.length;
        } else {
          // Veri yoksa ilk santralın fiyatını kullan
          const santral = ilgiliSantraller[0];
          if (santral) {
            ortalamaBirimFiyat = getElektrikFiyati(santral, secilenYil, ay.index);
          }
        }

        // CO2 tasarrufu hesaplama
        const co2Tasarrufu = ayVerileri.reduce((total, v) => 
          total + (v.tasarrufEdilenCO2 || (v.gunlukUretim * 0.5)), 0);

        return {
          ay: ay.label,
          ayIndex: ay.index,
          hedef,
          gerceklesen,
          basariOrani: hedef > 0 ? (gerceklesen / hedef) * 100 : 0,
          gelir,
          co2Tasarrufu,
          birimFiyat: ortalamaBirimFiyat
        };
      });
    }
  }, [uretimVerileri, santraller, secilenSantral, secilenYil, secilenAy, gorunumTipi]);

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
        [gorunumTipi === 'aylik' ? 'Gün' : 'Ay']: veri.ay,
        'Hedef Üretim (kWh)': veri.hedef.toFixed(0),
        'Gerçekleşen Üretim (kWh)': veri.gerceklesen.toFixed(0),
        'Başarı Oranı (%)': veri.basariOrani.toFixed(1),
        'Gelir (₺)': veri.gelir.toFixed(2),
        'Birim Fiyat (₺/kWh)': veri.birimFiyat.toFixed(2),
        'CO2 Tasarrufu (kg)': veri.co2Tasarrufu.toFixed(1)
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Üretim Analizi');

      const dosyaAdi = gorunumTipi === 'aylik' 
        ? `Uretim_Analizi_${secilenYil}_${aySecenekleri[secilenAy].label}.xlsx`
        : `Uretim_Analizi_${secilenYil}.xlsx`;
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

  const handleTopluSil = async () => {
    if (!canDelete || secilenVeriler.length === 0) {
      toast.error('Silmek için veri seçiniz');
      return;
    }

    try {
      const batch = writeBatch(db);
      
      secilenVeriler.forEach(veriId => {
        const veriRef = doc(db, 'uretimVerileri', veriId);
        batch.delete(veriRef);
      });

      await batch.commit();
      
      toast.success(`${secilenVeriler.length} adet veri başarıyla silindi`);
      setUretimVerileri(prev => prev.filter(veri => !secilenVeriler.includes(veri.id)));
      setSecilenVeriler([]);
      setTopluSilmeModalAcik(false);
    } catch (error) {
      console.error('Toplu silme hatası:', error);
      toast.error('Veriler silinirken bir hata oluştu');
    }
  };

  const handleVeriSecimDegistir = (veriId: string, secili: boolean) => {
    if (secili) {
      setSecilenVeriler(prev => [...prev, veriId]);
    } else {
      setSecilenVeriler(prev => prev.filter(id => id !== veriId));
    }
  };

  const handleTumunuSec = () => {
    if (secilenVeriler.length === uretimVerileri.length) {
      setSecilenVeriler([]);
    } else {
      setSecilenVeriler(uretimVerileri.map(v => v.id));
    }
  };

  // Gelir hesaplama fonksiyonu (detay modal için)
  const hesaplaVeriGeliri = (veri: UretimVerisi): number => {
    const santral = santraller.find(s => s.id === veri.santralId);
    if (!santral) return 0;
    
    const veriTarihi = veri.tarih.toDate();
    const birimFiyat = getElektrikFiyati(santral, veriTarihi.getFullYear(), veriTarihi.getMonth());
    return veri.gunlukUretim * birimFiyat;
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
            <h1 className="text-2xl font-bold text-gray-900">Üretim Verileri ve Gelir Analizi</h1>
            <p className="mt-1 text-sm text-gray-500">Santral üretim verilerini ve gelir hesaplarını analiz edin</p>
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
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Üretim Verileri ve Gelir Analizi</h1>
              <p className="text-gray-600">
                {performansOzeti.aktifSantralSayisi} santral • {performansOzeti.veriGunSayisi} {gorunumTipi === 'aylik' ? 'gün' : 'gün'} veri
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
                  ₺{(performansOzeti.toplamGelir / 1000).toFixed(1)}K
                </div>
                <div className="text-xs text-gray-500">Toplam Gelir</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtre Çubuğu */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* Görünüm Tipi */}
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <select
              value={gorunumTipi}
              onChange={(e) => setGorunumTipi(e.target.value as GorunumTipi)}
              className="rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm bg-white"
            >
              <option value="yillik">Yıllık Görünüm</option>
              <option value="aylik">Aylık Görünüm</option>
            </select>
          </div>

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

          {/* Ay Seçimi (Aylık görünümde) */}
          {gorunumTipi === 'aylik' && (
            <div className="flex items-center space-x-2">
              <select
                value={secilenAy}
                onChange={(e) => setSecilenAy(parseInt(e.target.value))}
                className="rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
              >
                {aySecenekleri.map(ay => (
                  <option key={ay.value} value={ay.value}>{ay.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Ortalama Fiyat Gösterimi */}
          <div className="flex items-center space-x-2 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
            <DollarSign className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-700 font-medium">
              Ort. ₺{performansOzeti.ortalamaBirimFiyat.toFixed(2)}/kWh
            </span>
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
              <Text className="text-sm font-medium text-gray-600">
                {gorunumTipi === 'aylik' ? 'Aylık' : 'Yıllık'} Hedef
              </Text>
              <Metric className="text-xl font-bold text-gray-900">
                {(performansOzeti.toplamHedef / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
              </Metric>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl">
              <Target className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card decoration="top" decorationColor="teal">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Gerçekleşen</Text>
              <Metric className="text-xl font-bold text-gray-900">
                {(performansOzeti.toplamGerceklesen / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 1})} MWh
              </Metric>
            </div>
            <div className="p-3 bg-teal-100 rounded-xl">
              <Activity className="h-6 w-6 text-teal-600" />
            </div>
          </div>
        </Card>

        <Card decoration="top" decorationColor="amber">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Toplam Gelir</Text>
              <Metric className="text-xl font-bold text-gray-900">
                ₺{performansOzeti.toplamGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
              </Metric>
            </div>
            <div className="p-3 bg-amber-100 rounded-xl">
              <DollarSign className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card decoration="top" decorationColor="blue">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium text-gray-600">Başarı Oranı</Text>
              <Metric className="text-xl font-bold text-gray-900">
                %{performansOzeti.basariOrani.toFixed(1)}
              </Metric>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Ana Grafik */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <Title>
              {gorunumTipi === 'aylik' ? 'Günlük' : 'Aylık'} Hedef vs Gerçekleşen Üretim
            </Title>
            <Text className="text-sm text-gray-500">
              Performans analizi ve gelir hesaplaması - Santral elektrik fiyatları kullanılıyor
            </Text>
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
              {gorunumTipi === 'aylik' ? `${aySecenekleri[secilenAy].label} ${secilenYil}` : secilenYil}
            </Badge>
          </div>
        </div>

        <AreaChart
          className="mt-4 h-96"
          data={aylikVeriler}
          index="ay"
          categories={["hedef", "gerceklesen"]}
          colors={["blue", "emerald"]}
          valueFormatter={(value) => `${(value / (gorunumTipi === 'aylik' ? 1 : 1000)).toFixed(1)} ${gorunumTipi === 'aylik' ? 'kWh' : 'MWh'}`}
          showAnimation={true}
          showGradient={true}
          showLegend={true}
          showGridLines={true}
          showXAxis={true}
          showYAxis={true}
          enableLegendSlider={true}
        />

        {/* Gelir Özeti */}
        <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-amber-900">
                ₺{performansOzeti.toplamGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})}
              </div>
              <div className="text-xs text-amber-600">Toplam Gelir</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-900">
                ₺{gorunumTipi === 'aylik' 
                  ? (performansOzeti.toplamGelir / aylikVeriler.filter(v => v.gerceklesen > 0).length || 0).toLocaleString('tr-TR', {maximumFractionDigits: 0})
                  : (performansOzeti.toplamGelir / 12).toLocaleString('tr-TR', {maximumFractionDigits: 0})
                }
              </div>
              <div className="text-xs text-amber-600">
                {gorunumTipi === 'aylik' ? 'Günlük Ortalama' : 'Aylık Ortalama'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-900">
                ₺{performansOzeti.ortalamaBirimFiyat.toFixed(2)}
              </div>
              <div className="text-xs text-amber-600">Ortalama Birim Fiyat (₺/kWh)</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-900">
                {aylikVeriler.length > 0 && aylikVeriler.some(v => v.birimFiyat > 0) ? (
                  `₺${(aylikVeriler.reduce((sum, v) => sum + v.birimFiyat, 0) / aylikVeriler.filter(v => v.birimFiyat > 0).length).toFixed(2)}`
                ) : (
                  '₺0.00'
                )}
              </div>
              <div className="text-xs text-amber-600">
                {gorunumTipi === 'aylik' ? 'Günlük Ort. Fiyat' : 'Aylık Ort. Fiyat'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Üretim Verilerini Listele */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <Title>Üretim Verileri Listesi</Title>
          <div className="flex items-center space-x-3">
            <Text>{uretimVerileri.length} kayıt</Text>
            {canDelete && secilenVeriler.length > 0 && (
              <button
                onClick={() => setTopluSilmeModalAcik(true)}
                className="inline-flex items-center px-3 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Seçilenleri Sil ({secilenVeriler.length})
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {canDelete && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={secilenVeriler.length === uretimVerileri.length && uretimVerileri.length > 0}
                      onChange={handleTumunuSec}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Santral</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Üretim</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Birim Fiyat</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gelir</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Performans</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {uretimVerileri.slice(0, 50).map((veri) => {
                const santral = santraller.find(s => s.id === veri.santralId);
                const gelir = hesaplaVeriGeliri(veri);
                const veriTarihi = veri.tarih.toDate();
                const birimFiyat = santral ? getElektrikFiyati(santral, veriTarihi.getFullYear(), veriTarihi.getMonth()) : 0;
                
                return (
                  <tr key={veri.id} className="hover:bg-gray-50">
                    {canDelete && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={secilenVeriler.includes(veri.id)}
                          onChange={(e) => handleVeriSecimDegistir(veri.id, e.target.checked)}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(veriTarihi, 'dd MMM yyyy', { locale: tr })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {santral?.ad || 'Bilinmeyen Santral'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {veri.gunlukUretim.toLocaleString('tr-TR', {maximumFractionDigits: 1})} kWh
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                      ₺{birimFiyat.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-emerald-600">
                      ₺{gelir.toLocaleString('tr-TR', {maximumFractionDigits: 2})}
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

      {topluSilmeModalAcik && (
        <SilmeOnayModal
          onConfirm={handleTopluSil}
          onCancel={() => setTopluSilmeModalAcik(false)}
          mesaj={`${secilenVeriler.length} adet üretim verisini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`}
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
                <label className="text-sm font-medium text-gray-600">Birim Fiyat</label>
                <p className="text-sm text-gray-600">
                  ₺{(() => {
                    const santral = santraller.find(s => s.id === secilenVeriDetay.santralId);
                    const veriTarihi = secilenVeriDetay.tarih.toDate();
                    return santral ? getElektrikFiyati(santral, veriTarihi.getFullYear(), veriTarihi.getMonth()).toFixed(2) : '0.00';
                  })()} / kWh
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Gelir</label>
                <p className="text-sm font-bold text-emerald-600">
                  ₺{hesaplaVeriGeliri(secilenVeriDetay).toLocaleString('tr-TR', {maximumFractionDigits: 2})}
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
