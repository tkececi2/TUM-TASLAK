import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths, getYear, getMonth, startOfYear, endOfYear } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Sun, 
  Calendar, 
  Download, 
  RefreshCw,
  DollarSign,
  TrendingUp,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Wallet,
  PieChart,
  BarChart2,
  Zap,
  CreditCard,
  Percent,
  AlertTriangle
} from 'lucide-react';
import { Card, Title, Text, AreaChart, BarChart, DonutChart, Metric, Flex, ProgressBar, Grid, Col, Badge, BadgeDelta } from '@tremor/react';
import { LoadingSpinner } from '../components/LoadingSpinner';
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
}

interface Santral {
  id: string;
  ad: string;
  kapasite: number;
  yillikHedefUretim: number;
  aylikHedefler?: Record<string, number>;
  kurulumTarihi: Timestamp;
  elektrikFiyatlari?: Record<string, Record<string, { birimFiyat: number, dagitimBedeli: number }>>;
}

export const FinansalAnaliz: React.FC = () => {
  const { kullanici } = useAuth();
  const navigate = useNavigate();
  const [uretimVerileri, setUretimVerileri] = useState<UretimVerisi[]>([]);
  const [yillikUretimVerileri, setYillikUretimVerileri] = useState<UretimVerisi[]>([]);
  const [santraller, setSantraller] = useState<Santral[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yillikVerilerYukleniyor, setYillikVerilerYukleniyor] = useState(false);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [secilenSantral, setSecilenSantral] = useState<string>('');
  const [secilenYil, setSecilenYil] = useState<number>(new Date().getFullYear());
  const [secilenAy, setSecilenAy] = useState<number>(new Date().getMonth());
  const [detayliTablo, setDetayliTablo] = useState(false);
  const [santralDetay, setSantralDetay] = useState<Santral | null>(null);
  
  // Yıl seçeneklerini oluştur (2022-2030)
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

  useEffect(() => {
    const santralleriGetir = async () => {
      if (!kullanici) return;

      try {
        let santralQuery;
        if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          if (kullanici.sahalar.length === 0) {
            setSantraller([]);
            setYukleniyor(false);
            return;
          }
          
          santralQuery = query(
            collection(db, 'santraller'),
            where('__name__', 'in', kullanici.sahalar)
          );
        } else {
          santralQuery = query(collection(db, 'santraller'), orderBy('ad'));
        }
        
        const snapshot = await getDocs(santralQuery);
        const santralListesi = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Santral[];
        
        setSantraller(santralListesi);
        
        // Eğer santral seçilmemişse ve santral listesi varsa ilk santralı seç
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
      }
    };

    santralleriGetir();
  }, [kullanici, secilenSantral]);

  // Yıllık verileri getir
  useEffect(() => {
    const yillikVerileriGetir = async () => {
      if (!secilenSantral) {
        setYillikUretimVerileri([]);
        return;
      }

      try {
        setYillikVerilerYukleniyor(true);
        
        // Seçilen yıl için tarih aralığı
        const yilBaslangic = new Date(secilenYil, 0, 1); // Ocak 1
        const yilBitis = new Date(secilenYil, 11, 31); // Aralık 31
        
        const yilBaslangicTimestamp = Timestamp.fromDate(yilBaslangic);
        const yilBitisTimestamp = Timestamp.fromDate(yilBitis);
        
        // Yıllık üretim verilerini getir
        const yillikUretimQuery = query(
          collection(db, 'uretimVerileri'),
          where('santralId', '==', secilenSantral),
          where('tarih', '>=', yilBaslangicTimestamp),
          where('tarih', '<=', yilBitisTimestamp),
          orderBy('tarih', 'asc')
        );
        
        const snapshot = await getDocs(yillikUretimQuery);
        const veriler = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UretimVerisi[];
        
        setYillikUretimVerileri(veriler);
      } catch (error) {
        console.error('Yıllık üretim verileri getirilemedi:', error);
      } finally {
        setYillikVerilerYukleniyor(false);
      }
    };

    yillikVerileriGetir();
  }, [secilenSantral, secilenYil]);

  useEffect(() => {
    const verileriGetir = async () => {
      if (!secilenSantral) {
        setUretimVerileri([]);
        setYukleniyor(false);
        return;
      }

      try {
        setYukleniyor(true);
        
        // Seçilen yıl ve ay için tarih aralığı
        const ayBaslangic = new Date(secilenYil, secilenAy, 1);
        const ayBitis = endOfMonth(ayBaslangic);
        
        const ayBaslangicTimestamp = Timestamp.fromDate(ayBaslangic);
        const ayBitisTimestamp = Timestamp.fromDate(ayBitis);
        
        // Üretim verilerini getir
        const uretimQuery = query(
          collection(db, 'uretimVerileri'),
          where('santralId', '==', secilenSantral),
          where('tarih', '>=', ayBaslangicTimestamp),
          where('tarih', '<=', ayBitisTimestamp),
          orderBy('tarih', 'asc')
        );
        
        const snapshot = await getDocs(uretimQuery);
        const veriler = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UretimVerisi[];
        
        setUretimVerileri(veriler);
      } catch (error) {
        console.error('Üretim verileri getirilemedi:', error);
        toast.error('Üretim verileri yüklenirken bir hata oluştu');
      } finally {
        setYukleniyor(false);
      }
    };

    verileriGetir();
  }, [secilenSantral, secilenYil, secilenAy]);

  const handleVeriSil = async (id: string) => {
    if (!kullanici?.rol === 'yonetici') {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }

    try {
      setYukleniyor(true);
      await deleteDoc(doc(db, 'uretimVerileri', id));
      toast.success('Üretim verisi başarıyla silindi');
      
      // Listeyi güncelle
      setUretimVerileri(prev => prev.filter(veri => veri.id !== id));
    } catch (error) {
      console.error('Veri silme hatası:', error);
      toast.error('Veri silinirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  const handleYenile = async () => {
    setYenileniyor(true);
    
    try {
      // Seçilen yıl ve ay için tarih aralığı
      const ayBaslangic = new Date(secilenYil, secilenAy, 1);
      const ayBitis = endOfMonth(ayBaslangic);
      
      const ayBaslangicTimestamp = Timestamp.fromDate(ayBaslangic);
      const ayBitisTimestamp = Timestamp.fromDate(ayBitis);
      
      // Üretim verilerini getir
      const uretimQuery = query(
        collection(db, 'uretimVerileri'),
        where('santralId', '==', secilenSantral),
        where('tarih', '>=', ayBaslangicTimestamp),
        where('tarih', '<=', ayBitisTimestamp),
        orderBy('tarih', 'asc')
      );
      
      const snapshot = await getDocs(uretimQuery);
      const veriler = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UretimVerisi[];
      
      setUretimVerileri(veriler);
      
      // Yıllık verileri de yenile
      const yilBaslangic = new Date(secilenYil, 0, 1);
      const yilBitis = new Date(secilenYil, 11, 31);
      
      const yilBaslangicTimestamp = Timestamp.fromDate(yilBaslangic);
      const yilBitisTimestamp = Timestamp.fromDate(yilBitis);
      
      const yillikUretimQuery = query(
        collection(db, 'uretimVerileri'),
        where('santralId', '==', secilenSantral),
        where('tarih', '>=', yilBaslangicTimestamp),
        where('tarih', '<=', yilBitisTimestamp),
        orderBy('tarih', 'asc')
      );
      
      const yillikSnapshot = await getDocs(yillikUretimQuery);
      const yillikVeriler = yillikSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UretimVerisi[];
      
      setYillikUretimVerileri(yillikVeriler);
      
      // Santral bilgilerini de yenile
      const santralQuery = query(
        collection(db, 'santraller'),
        where('__name__', '==', secilenSantral)
      );
      
      const santralSnapshot = await getDocs(santralQuery);
      if (!santralSnapshot.empty) {
        const santralData = santralSnapshot.docs[0].data() as Santral;
        santralData.id = santralSnapshot.docs[0].id;
        setSantralDetay(santralData);
      }
      
      toast.success('Veriler yenilendi');
    } catch (error) {
      console.error('Veri yenileme hatası:', error);
      toast.error('Veriler yenilenirken bir hata oluştu');
    } finally {
      setYenileniyor(false);
    }
  };

  const handleExcelExport = () => {
    try {
      // Veri yoksa uyarı ver
      if (uretimVerileri.length === 0) {
        toast.error('Dışa aktarılacak veri bulunamadı');
        return;
      }
      
      // Excel için veri hazırla
      const excelData = uretimVerileri.map(veri => ({
        'Tarih': format(veri.tarih.toDate(), 'dd.MM.yyyy'),
        'Günlük Üretim (kWh)': veri.gunlukUretim,
        'Birim Fiyat (₺/kWh)': (veri.gelir + veri.dagitimBedeli) / veri.gunlukUretim,
        'Dağıtım Bedeli (₺)': veri.dagitimBedeli,
        'Brüt Gelir (₺)': veri.gelir + veri.dagitimBedeli,
        'Net Gelir (₺)': veri.gelir,
        'Dağıtım Bedeli (₺/kWh)': veri.dagitimBedeli / veri.gunlukUretim
      }));
      
      // Excel dosyası oluştur
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Finansal Veriler');
      
      // Sütun genişliklerini ayarla
      const maxWidth = excelData.reduce((acc, row) => {
        return Math.max(acc, Object.keys(row).length);
      }, 0);
      
      const colWidths = Array(maxWidth).fill({ wch: 15 });
      worksheet['!cols'] = colWidths;
      
      // Dosyayı indir
      const santralAdi = santraller.find(s => s.id === secilenSantral)?.ad || 'Santral';
      const dosyaAdi = `${santralAdi}_Finansal_${secilenYil}_${aySecenekleri[secilenAy].label}.xlsx`;
      
      XLSX.writeFile(workbook, dosyaAdi);
      toast.success('Excel dosyası başarıyla indirildi');
    } catch (error) {
      console.error('Excel dışa aktarma hatası:', error);
      toast.error('Excel dosyası oluşturulurken bir hata oluştu');
    }
  };

  // İstatistikler
  const hesaplaFinansalIstatistikler = () => {
    if (!uretimVerileri.length || !santralDetay) return null;
    
    // Aylık toplam üretim
    const toplamUretim = uretimVerileri.reduce((acc, veri) => acc + veri.gunlukUretim, 0);
    
    // Aylık toplam brüt gelir (dağıtım bedeli dahil)
    const toplamBrutGelir = uretimVerileri.reduce((acc, veri) => acc + veri.gelir + veri.dagitimBedeli, 0);
    
    // Aylık toplam net gelir
    const toplamNetGelir = uretimVerileri.reduce((acc, veri) => acc + veri.gelir, 0);
    
    // Aylık toplam dağıtım bedeli
    const toplamDagitimBedeli = uretimVerileri.reduce((acc, veri) => acc + veri.dagitimBedeli, 0);
    
    // Ortalama birim fiyat
    const ortalamaBirimFiyat = toplamUretim > 0 ? toplamBrutGelir / toplamUretim : 0;
    
    // Ortalama dağıtım bedeli (₺/kWh)
    const ortalamaDagitimBedeli = toplamUretim > 0 ? toplamDagitimBedeli / toplamUretim : 0;
    
    // Günlük gelir verileri
    const gunlukGelirVerileri = uretimVerileri.map(veri => ({
      date: format(veri.tarih.toDate(), 'dd MMM', { locale: tr }),
      brutGelir: veri.gelir + veri.dagitimBedeli,
      netGelir: veri.gelir,
      dagitimBedeli: veri.dagitimBedeli
    }));
    
    // Yıllık gelir verileri
    const aylikGelirVerileri = aySecenekleri.map(ay => {
      // Ayın verilerini bul
      const ayVerileri = yillikUretimVerileri.filter(veri => {
        const veriTarihi = veri.tarih.toDate();
        return veriTarihi.getMonth() === ay.value && veriTarihi.getFullYear() === secilenYil;
      });
      
      // Ayın toplam geliri
      const ayBrutGelir = ayVerileri.reduce((acc, veri) => acc + veri.gelir + veri.dagitimBedeli, 0);
      const ayNetGelir = ayVerileri.reduce((acc, veri) => acc + veri.gelir, 0);
      const ayDagitimBedeli = ayVerileri.reduce((acc, veri) => acc + veri.dagitimBedeli, 0);
      
      return {
        ay: ay.label,
        brutGelir: ayBrutGelir,
        netGelir: ayNetGelir,
        dagitimBedeli: ayDagitimBedeli
      };
    });
    
    // Elektrik fiyatları
    const aylar = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik'];
    
    // Seçilen yıl için elektrik fiyatları
    const yilFiyatlari = santralDetay.elektrikFiyatlari?.[secilenYil.toString()] || {};
    
    // Seçilen ayın fiyatları
    const elektrikFiyati = yilFiyatlari[aylar[secilenAy]]?.birimFiyat || 2.5;
    const dagitimBedeliFiyati = yilFiyatlari[aylar[secilenAy]]?.dagitimBedeli || 0.5;
    
    // Yıllık elektrik fiyatı değişimi
    const yillikFiyatVerileri = aySecenekleri.map(ay => {
      const birimFiyat = yilFiyatlari[aylar[ay.value]]?.birimFiyat || 2.5;
      const dagitimBedeliFiyati = yilFiyatlari[aylar[ay.value]]?.dagitimBedeli || 0.5;
      
      return {
        ay: ay.label,
        birimFiyat,
        dagitimBedeliFiyati
      };
    });
    
    return {
      toplamUretim,
      toplamBrutGelir,
      toplamNetGelir,
      toplamDagitimBedeli,
      ortalamaBirimFiyat,
      ortalamaDagitimBedeli,
      gunlukGelirVerileri,
      aylikGelirVerileri,
      elektrikFiyati,
      dagitimBedeliFiyati,
      yillikFiyatVerileri
    };
  };
  
  const finansalIstatistikler = hesaplaFinansalIstatistikler();

  // Santral kapasitesi yoksa uyarı göster
  if (santralDetay && santralDetay.kapasite === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Finansal Analiz</h1>
            <p className="mt-1 text-sm text-gray-500">
              {santralDetay.ad} santralinin gelir ve gider analizi
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
                Bu santral için kapasite bilgisi tanımlanmamış. Finansal hesaplamalar için santral kapasitesinin tanımlanması gerekiyor.
              </p>
              <button
                onClick={() => navigate('/ges-yonetimi')}
                className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200"
              >
                <ArrowRight className="h-4 w-4 mr-1.5" />
                Santral Yönetimine Git
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (yukleniyor && !santralDetay) {
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
            <h1 className="text-2xl font-bold text-gray-900">Finansal Analiz</h1>
            <p className="mt-1 text-sm text-gray-500">
              Santral gelir ve gider analizi
            </p>
          </div>
        </div>
        
        <Card className="bg-yellow-50 border-yellow-200">
          <div className="flex flex-col items-center justify-center py-12">
            <DollarSign className="h-16 w-16 text-yellow-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">Santral Bulunamadı</h3>
            <p className="text-gray-500 text-center max-w-md">
              Henüz hiç santral kaydı bulunmuyor. Finansal analiz için önce bir santral eklemelisiniz.
            </p>
            <button
              onClick={() => navigate('/ges-yonetimi')}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700"
            >
              <ArrowRight className="h-5 w-5 mr-2" />
              Santral Yönetimine Git
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Üst Başlık ve Kontroller */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl shadow-sm border border-green-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <DollarSign className="h-7 w-7 mr-2 text-green-500" />
              Finansal Analiz
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {santralDetay?.ad} santralinin gelir ve gider analizi
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <select
              value={secilenSantral}
              onChange={(e) => setSecilenSantral(e.target.value)}
              className="rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 text-sm"
            >
              {santraller.map(santral => (
                <option key={santral.id} value={santral.id}>{santral.ad}</option>
              ))}
            </select>
            
            <select
              value={secilenYil}
              onChange={(e) => setSecilenYil(parseInt(e.target.value))}
              className="rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 text-sm"
            >
              {yilSecenekleri.map(yil => (
                <option key={yil} value={yil}>{yil}</option>
              ))}
            </select>
            
            <select
              value={secilenAy}
              onChange={(e) => setSecilenAy(parseInt(e.target.value))}
              className="rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 text-sm"
            >
              {aySecenekleri.map(ay => (
                <option key={ay.value} value={ay.value}>{ay.label}</option>
              ))}
            </select>
            
            <div className="flex space-x-2">
              <button
                onClick={handleYenile}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                disabled={yenileniyor}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${yenileniyor ? 'animate-spin' : ''}`} />
                Yenile
              </button>
              
              <button
                onClick={handleExcelExport}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {yukleniyor ? (
        <div className="flex justify-center items-center min-h-[200px]">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* Santral Bilgileri */}
          {santralDetay && (
            <Card className="bg-gradient-to-r from-green-50 to-teal-50 border-none">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="flex items-center mb-4 md:mb-0">
                  <div className="p-3 bg-green-100 rounded-full mr-4">
                    <DollarSign className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <Title>{santralDetay.ad}</Title>
                    <Text className="text-green-700">
                      Finansal Performans Analizi
                    </Text>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="bg-white px-4 py-2 rounded-lg shadow-sm flex items-center">
                    <CreditCard className="h-5 w-5 text-green-500 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">Birim Fiyat</p>
                      <p className="text-sm font-semibold">
                        {finansalIstatistikler?.elektrikFiyati.toFixed(2)} ₺/kWh
                      </p>
                    </div>
                  </div>
                  <div className="bg-white px-4 py-2 rounded-lg shadow-sm flex items-center">
                    <Percent className="h-5 w-5 text-red-500 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">Dağıtım Bedeli</p>
                      <p className="text-sm font-semibold">{(finansalIstatistikler?.dagitimBedeliFiyati || 0).toFixed(2)} ₺/kWh</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Aylık Özet Kartları */}
          {finansalIstatistikler && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card decoration="top" decorationColor="green">
                <div className="flex items-center justify-between">
                  <div>
                    <Text className="text-sm">Brüt Gelir</Text>
                    <Metric>{finansalIstatistikler.toplamBrutGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})} ₺</Metric>
                    <Text className="text-xs text-gray-500 mt-1">
                      Dağıtım bedeli dahil toplam gelir
                    </Text>
                  </div>
                  <div className="rounded-full p-3 bg-green-100">
                    <DollarSign className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </Card>
              
              <Card decoration="top" decorationColor="blue">
                <div className="flex items-center justify-between">
                  <div>
                    <Text className="text-sm">Net Gelir</Text>
                    <Metric>{finansalIstatistikler.toplamNetGelir.toLocaleString('tr-TR', {maximumFractionDigits: 0})} ₺</Metric>
                    <Text className="text-xs text-gray-500 mt-1">
                      Dağıtım bedeli çıkarılmış net gelir
                    </Text>
                  </div>
                  <div className="rounded-full p-3 bg-blue-100">
                    <Wallet className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </Card>
              
              <Card decoration="top" decorationColor="red">
                <div className="flex items-center justify-between">
                  <div>
                    <Text className="text-sm">Dağıtım Bedeli</Text>
                    <Metric>{finansalIstatistikler.toplamDagitimBedeli.toLocaleString('tr-TR', {maximumFractionDigits: 0})} ₺</Metric>
                    <Text className="text-xs text-gray-500 mt-1">
                      Toplam dağıtım bedeli gideri
                    </Text>
                  </div>
                  <div className="rounded-full p-3 bg-red-100">
                    <Percent className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </Card>
              
              <Card decoration="top" decorationColor="amber">
                <div className="flex items-center justify-between">
                  <div>
                    <Text className="text-sm">Birim Fiyat</Text>
                    <Metric>{finansalIstatistikler.ortalamaBirimFiyat.toFixed(2)} ₺/kWh</Metric>
                    <Text className="text-xs text-gray-500 mt-1">
                      Ortalama elektrik satış fiyatı
                    </Text>
                  </div>
                  <div className="rounded-full p-3 bg-amber-100">
                    <Zap className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Yıllık Gelir Grafiği */}
          {finansalIstatistikler && (
            <Card>
              <Title>Yıllık Gelir Analizi - {secilenYil}</Title>
              <Text>Aylık gelir ve dağıtım bedeli dağılımı</Text>
              {yillikVerilerYukleniyor ? (
                <div className="flex justify-center items-center h-80">
                  <LoadingSpinner size="lg" />
                </div>
              ) : (
                <AreaChart
                  className="mt-4 h-80"
                  data={finansalIstatistikler.aylikGelirVerileri}
                  index="ay"
                  categories={["brutGelir", "netGelir", "dagitimBedeli"]}
                  colors={["green", "blue", "red"]}
                  valueFormatter={(value) => `${value.toLocaleString('tr-TR')} ₺`}
                  yAxisWidth={80}
                  showLegend={true}
                  showAnimation={true}
                  showGradient={true}
                />
              )}
            </Card>
          )}

          {/* Aylık Gelir Grafiği */}
          {finansalIstatistikler && finansalIstatistikler.gunlukGelirVerileri.length > 0 && (
            <Card>
              <Title>Günlük Gelir Detayı - {aySecenekleri[secilenAy].label} {secilenYil}</Title>
              <Text>Günlük gelir ve dağıtım bedeli dağılımı</Text>
              <AreaChart
                className="mt-4 h-80"
                data={finansalIstatistikler.gunlukGelirVerileri}
                index="date"
                categories={["brutGelir", "netGelir", "dagitimBedeli"]}
                colors={["green", "blue", "red"]}
                valueFormatter={(value) => `${value.toLocaleString('tr-TR')} ₺`}
                showLegend={true}
                showAnimation={true}
                showGradient={true}
                yAxisWidth={80}
                customTooltip={(props) => {
                  const { payload, active } = props;
                  if (!active || !payload) return null;
                  
                  const data = payload[0]?.payload;
                  const brutGelir = data?.brutGelir || 0;
                  const netGelir = data?.netGelir || 0;
                  const dagitimBedeli = data?.dagitimBedeli || 0;
                  const dagitimOrani = brutGelir > 0 ? (dagitimBedeli / brutGelir) * 100 : 0;
                  
                  return (
                    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                      <div className="text-sm font-medium text-gray-900 mb-2">{data?.date}</div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600 flex items-center">
                            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                            Brüt Gelir:
                          </span>
                          <span className="text-xs font-medium">{brutGelir.toLocaleString('tr-TR')} ₺</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600 flex items-center">
                            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                            Net Gelir:
                          </span>
                          <span className="text-xs font-medium">{netGelir.toLocaleString('tr-TR')} ₺</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600 flex items-center">
                            <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                            Dağıtım Bedeli:
                          </span>
                          <span className="text-xs font-medium">{dagitimBedeli.toLocaleString('tr-TR')} ₺</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                          <span className="text-xs text-gray-600">Dağıtım Oranı:</span>
                          <span className="text-xs font-medium">%{dagitimOrani.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            </Card>
          )}

          {/* Gelir Dağılımı */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <Title>Gelir Dağılımı</Title>
              <Text>Net gelir ve dağıtım bedeli oranları</Text>
              {finansalIstatistikler && (
                <DonutChart
                  className="mt-6 h-60"
                  data={[
                    { name: 'Net Gelir', value: finansalIstatistikler.toplamNetGelir },
                    { name: 'Dağıtım Bedeli', value: finansalIstatistikler.toplamDagitimBedeli }
                  ]}
                  category="value"
                  index="name"
                  colors={["blue", "red"]}
                  valueFormatter={(value) => `${value.toLocaleString('tr-TR')} ₺`}
                  label={`${finansalIstatistikler.toplamBrutGelir.toLocaleString('tr-TR')} ₺`}
                />
              )}
            </Card>
            
            <Card>
              <Title>Elektrik Fiyatı Değişimi - {secilenYil}</Title>
              <Text>Aylık birim fiyat değişimi</Text>
              {finansalIstatistikler && (
                <BarChart
                  className="mt-6 h-60"
                  data={finansalIstatistikler.yillikFiyatVerileri}
                  index="ay"
                  categories={["birimFiyat"]}
                  colors={["amber"]}
                  valueFormatter={(value) => `${value.toFixed(2)} ₺/kWh`}
                  yAxisWidth={60}
                />
              )}
            </Card>
          </div>

          {/* Dağıtım Bedeli Analizi */}
          <Card>
            <Title>Dağıtım Bedeli Analizi - {secilenYil}</Title>
            <Text>Aylık dağıtım bedeli (₺/kWh) değişimi</Text>
            {finansalIstatistikler && (
              <BarChart
                className="mt-4 h-60"
                data={finansalIstatistikler.yillikFiyatVerileri}
                index="ay"
                categories={["dagitimBedeliFiyati"]}
                colors={["red"]}
                valueFormatter={(value) => `${value.toFixed(2)} ₺/kWh`}
                yAxisWidth={60}
              />
            )}
          </Card>

          {/* Detaylı Tablo */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <Title>Finansal Veriler Tablosu</Title>
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
                        Üretim (kWh)
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Birim Fiyat (₺/kWh)
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Brüt Gelir (₺)
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dağıtım Bedeli (₺)
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Net Gelir (₺)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {uretimVerileri.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                          Bu ay için finansal veri bulunamadı
                        </td>
                      </tr>
                    ) : (
                      uretimVerileri.map((veri) => {
                        const tarih = veri.tarih.toDate();
                        const brutGelir = veri.gelir + veri.dagitimBedeli;
                        const birimFiyat = veri.gunlukUretim > 0 ? brutGelir / veri.gunlukUretim : 0;
                        
                        return (
                          <tr key={veri.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {format(tarih, 'dd MMMM yyyy', { locale: tr })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {veri.gunlukUretim.toLocaleString('tr-TR')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {birimFiyat.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {brutGelir.toLocaleString('tr-TR', {maximumFractionDigits: 2})}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {veri.dagitimBedeli.toLocaleString('tr-TR', {maximumFractionDigits: 2})}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {veri.gelir.toLocaleString('tr-TR', {maximumFractionDigits: 2})}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            {!detayliTablo && uretimVerileri.length === 0 && (
              <div className="py-12 text-center">
                <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <Text className="text-gray-500">Bu ay için finansal veri bulunamadı</Text>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};