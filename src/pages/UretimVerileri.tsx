import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, addMonths, getYear, getMonth, startOfYear, endOfYear } from 'date-fns';
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
  Target
} from 'lucide-react';
import { Card, Title, Text, AreaChart, BarChart, DonutChart, Metric, Flex, ProgressBar, Grid, Col, Badge, BadgeDelta } from '@tremor/react';
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
}

export const UretimVerileri: React.FC = () => {
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
  const [importModalAcik, setImportModalAcik] = useState(false);
  const [silmeOnayModalAcik, setSilmeOnayModalAcik] = useState(false);
  const [silinecekVeriId, setSilinecekVeriId] = useState<string | null>(null);
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

  const canAdd = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);
  const canDelete = kullanici?.rol === 'yonetici';

  useEffect(() => {
    const santralleriGetir = async () => {
      if (!kullanici?.companyId) return;

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
        
        try {
          // Daha az karmaşık sorgu - sorgu başarısızlık oranını azaltmak için where koşullarını azaltıyoruz
          const yillikUretimQuery = query(
            collection(db, 'uretimVerileri'),
            where('santralId', '==', secilenSantral),
            orderBy('tarih', 'asc')
          );
          
          const snapshot = await getDocs(yillikUretimQuery);
          const tumVeriler = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as UretimVerisi[];
          
          // Filtrelemeyi JavaScript ile yap - daha güvenilir
          const filtreliVeriler = tumVeriler.filter(veri => {
            try {
              const veriTarih = veri.tarih.toDate();
              const dogruCompany = kullanici?.companyId ? veri.companyId === kullanici.companyId : true;
              return veriTarih >= yilBaslangic && veriTarih <= yilBitis && dogruCompany;
            } catch (err) {
              console.warn('Veri filtreleme hatası:', err);
              return false;
            }
          });
          
          setYillikUretimVerileri(filtreliVeriler);
        } catch (queryError) {
          console.error('Yıllık veri sorgusu başarısız:', queryError);
          
          // Tam bir fallback çözümü - tüm verileri getir
          try {
            const fallbackQuery = query(
              collection(db, 'uretimVerileri')
            );
            
            const fallbackSnapshot = await getDocs(fallbackQuery);
            const tumVeriler = fallbackSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as UretimVerisi[];
            
            // Tüm filtrelemeyi manuel yap
            const filtreliVeriler = tumVeriler.filter(veri => {
              try {
                const veriTarih = veri.tarih.toDate();
                return veri.santralId === secilenSantral && 
                       veriTarih >= yilBaslangic && 
                       veriTarih <= yilBitis && 
                       veri.companyId === kullanici?.companyId;
              } catch (err) {
                return false;
              }
            });
            
            setYillikUretimVerileri(filtreliVeriler);
            toast.warning('Veriler yedek modda yüklendi', {duration: 3000});
          } catch (fallbackError) {
            console.error('Yedek sorgu da başarısız oldu:', fallbackError);
            setYillikUretimVerileri([]);
            toast.error('Veri yüklenirken tekrarlanan hatalar oluştu');
          }
        }
      } catch (error) {
        console.error('Yıllık üretim verileri getirilemedi:', error);
        toast.error('Yıllık üretim verileri yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.');
        setYillikUretimVerileri([]);
      } finally {
        setYillikVerilerYukleniyor(false);
      }
    };

    yillikVerileriGetir();
  }, [secilenSantral, secilenYil, kullanici?.companyId]);

  useEffect(() => {
    const verileriGetir = async () => {
      if (!secilenSantral || !kullanici?.companyId) {
        setUretimVerileri([]);
        setYukleniyor(false);
        return;
      }

      try {
        setYukleniyor(true);
        
        // Token yenileme - Firestore izin sorunlarını önlemek için
        if (auth.currentUser) {
          try {
            await auth.currentUser.getIdToken(true);
            console.log('Veri getirme öncesi token başarıyla yenilendi');
          } catch (tokenError) {
            console.warn('Token yenileme sırasında hata:', tokenError);
          }
        }
        
        // Seçilen yıl ve ay için tarih aralığı
        const ayBaslangic = new Date(secilenYil, secilenAy, 1);
        const ayBitis = endOfMonth(ayBaslangic);
        
        // Başlangıçta en basit sorguyla başla - bu hataya düşme olasılığını azaltır
        try {
          const uretimQuery = query(
            collection(db, 'uretimVerileri'),
            where('santralId', '==', secilenSantral),
            orderBy('tarih', 'asc')
          );
          
          const snapshot = await getDocs(uretimQuery);
          const tumVeriler = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as UretimVerisi[];
          
          // Tüm filtrelemeyi manuel olarak yap - daha güvenilir
          const filtreliVeriler = tumVeriler.filter(veri => {
            try {
              const veriTarih = veri.tarih.toDate();
              return veri.companyId === kullanici.companyId && 
                     veriTarih >= ayBaslangic && 
                     veriTarih <= ayBitis;
            } catch (err) {
              console.warn('Veri filtreleme hatası (ay):', err);
              return false;
            }
          });
          
          setUretimVerileri(filtreliVeriler);
          
          if (filtreliVeriler.length === 0) {
            // Veri bulunamadı, ancak hata oluşmadı - kullanıcıyı sessizce bilgilendir
            console.log(`${secilenYil} yılı ${secilenAy+1}. ayında veri bulunamadı.`);
          }
        } catch (ilkSorguHatasi) {
          console.error('İlk sorgu başarısız, son çare sorgusunu deneniyor:', ilkSorguHatasi);
          
          // Son çare - hiçbir filtre olmadan tüm koleksiyonu getir
          try {
            const sonCareQuery = query(collection(db, 'uretimVerileri'));
            const sonCareSnapshot = await getDocs(sonCareQuery);
            const tumVeriler = sonCareSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as UretimVerisi[];
            
            // Tüm filtreleri manuel uygula
            const tamamenFiltreliVeriler = tumVeriler.filter(veri => {
              try {
                const veriTarih = veri.tarih.toDate();
                return veri.santralId === secilenSantral &&
                       veri.companyId === kullanici.companyId &&
                       veriTarih >= ayBaslangic && 
                       veriTarih <= ayBitis;
              } catch (filtreHatasi) {
                return false;
              }
            });
            
            setUretimVerileri(tamamenFiltreliVeriler);
            toast.warning('Veriler acil durum modunda yüklendi', {duration: 3000});
          } catch (sonHata) {
            console.error('Tüm sorgu denemeleri başarısız oldu:', sonHata);
            setUretimVerileri([]);
            toast.error('Üretim verileri yüklenemedi. Lütfen internet bağlantınızı kontrol edin ve sayfayı yenileyiniz.');
          }
        }
      } catch (error) {
        console.error('Üretim verileri getirilemedi:', error);
        
        // FirebaseError için özel işleme
        if (error && error.code === 'failed-precondition') {
          toast.error('Veritabanı bağlantısı kurulamadı. Oturum yenileniyor...');
          
          // IndexedDB veritabanlarını temizle
          try {
            const databases = window.indexedDB.databases ? await window.indexedDB.databases() : [];
            for (const database of databases) {
              if (database.name && database.name.includes('firestore')) {
                console.log('Temizleniyor:', database.name);
                window.indexedDB.deleteDatabase(database.name);
              }
            }
          } catch (cleanupError) {
            console.warn('IndexedDB temizleme hatası:', cleanupError);
          }
          
          // Token'ı yenilemeyi dene
          if (auth.currentUser) {
            try {
              await auth.currentUser.getIdToken(true);
              console.log('Token başarıyla yenilendi');
              
              // 2 saniye bekle ve yeniden dene
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Yeniden veri getirme denemesi
              handleYenile();
              return;
            } catch (tokenError) {
              console.error('Token yenileme hatası:', tokenError);
            }
          }
          
          // Yenileme işlemleri başarısız olduysa, sayfayı yenile
          setTimeout(() => {
            console.log('Veritabanı bağlantısı yeniden deneniyor...');
            window.location.reload();
          }, 5000);
        } else {
          toast.error('Üretim verileri yüklenirken bir hata oluştu. Tekrar deneyiniz.');
        }
        
        setUretimVerileri([]);
      } finally {
        setYukleniyor(false);
      }
    };

    verileriGetir();
  }, [secilenSantral, secilenYil, secilenAy, kullanici?.companyId]);

  const handleVeriSil = async (id: string) => {
    if (!canDelete) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }

    try {
      setYukleniyor(true);
      await deleteDoc(doc(db, 'uretimVerileri', id));
      toast.success('Üretim verisi başarıyla silindi');
      
      // Listeyi güncelle
      setUretimVerileri(prev => prev.filter(veri => veri.id !== id));
      
      // Modalı kapat
      setSilmeOnayModalAcik(false);
      setSilinecekVeriId(null);
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
        where('companyId', '==', kullanici?.companyId),
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
        where('companyId', '==', kullanici?.companyId),
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
        'Kapasite Faktörü (%)': veri.performansOrani.toFixed(2),
        'CO2 Tasarrufu (kg)': veri.tasarrufEdilenCO2.toFixed(2),
        'Gelir (₺)': veri.gelir.toFixed(2),
        'Dağıtım Bedeli (₺)': veri.dagitimBedeli.toFixed(2)
      }));
      
      // Excel dosyası oluştur
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Üretim Verileri');
      
      // Sütun genişliklerini ayarla
      const maxWidth = excelData.reduce((acc, row) => {
        return Math.max(acc, Object.keys(row).length);
      }, 0);
      
      const colWidths = Array(maxWidth).fill({ wch: 15 });
      worksheet['!cols'] = colWidths;
      
      // Dosyayı indir
      const santralAdi = santraller.find(s => s.id === secilenSantral)?.ad || 'Santral';
      const dosyaAdi = `${santralAdi}_Uretim_${secilenYil}_${aySecenekleri[secilenAy].label}.xlsx`;
      
      XLSX.writeFile(workbook, dosyaAdi);
      toast.success('Excel dosyası başarıyla indirildi');
    } catch (error) {
      console.error('Excel dışa aktarma hatası:', error);
      toast.error('Excel dosyası oluşturulurken bir hata oluştu');
    }
  };

  // İstatistikler
  const hesaplaIstatistikler = () => {
    if (!uretimVerileri.length || !santralDetay) return null;
    
    // Aylık toplam üretim
    const toplamUretim = uretimVerileri.reduce((acc, veri) => acc + veri.gunlukUretim, 0);
    
    // Aylık toplam CO2 tasarrufu
    const toplamCO2 = uretimVerileri.reduce((acc, veri) => acc + veri.tasarrufEdilenCO2, 0);
    
    // Aylık hedef üretim
    const aylar = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik'];
    const aylikHedef = santralDetay.aylikHedefler?.[aylar[secilenAy]] || (santralDetay.yillikHedefUretim / 12);
    
    // Hedef gerçekleşme oranı
    const hedefGerceklesme = aylikHedef > 0 ? (toplamUretim / aylikHedef) * 100 : 0;
    
    // Günlük hedef
    const gunlukHedef = aylikHedef / new Date(secilenYil, secilenAy + 1, 0).getDate();
    
    // Hedefin üzerinde ve altında olan günler
    const hedefUstuGunler = uretimVerileri.filter(veri => veri.gunlukUretim >= gunlukHedef).length;
    const hedefAltiGunler = uretimVerileri.filter(veri => veri.gunlukUretim < gunlukHedef).length;
    
    // En yüksek üretim
    const enYuksekUretim = Math.max(...uretimVerileri.map(veri => veri.gunlukUretim));
    const enYuksekUretimTarihi = uretimVerileri.find(veri => veri.gunlukUretim === enYuksekUretim)?.tarih.toDate();
    
    // Ortalama kapasite faktörü
    const ortalamaKapasiteFaktoru = uretimVerileri.reduce((acc, veri) => acc + veri.performansOrani, 0) / uretimVerileri.length;
    
    // Grafik verileri
    const grafikVerileri = uretimVerileri.map(veri => ({
      date: format(veri.tarih.toDate(), 'dd MMM', { locale: tr }),
      uretim: veri.gunlukUretim,
      hedef: gunlukHedef,
      kapasiteFaktoru: veri.performansOrani
    }));
    
    // Yıllık üretim verileri
    const yillikGrafikVerileri = aySecenekleri.map(ay => {
      // Ayın verilerini bul
      const ayVerileri = yillikUretimVerileri.filter(veri => {
        const veriTarihi = veri.tarih.toDate();
        return veriTarihi.getMonth() === ay.value && veriTarihi.getFullYear() === secilenYil;
      });
      
      // Ayın toplam üretimi
      const ayUretimi = ayVerileri.reduce((acc, veri) => acc + veri.gunlukUretim, 0);
      
      // Ayın hedefi
      const ayHedefi = santralDetay.aylikHedefler?.[aylar[ay.value]] || (santralDetay.yillikHedefUretim / 12);
      
      return {
        ay: ay.label,
        uretim: ayUretimi,
        hedef: ayHedefi
      };
    });
    
    // Yıllık toplam üretim
    const yillikToplamUretim = yillikUretimVerileri.reduce((acc, veri) => acc + veri.gunlukUretim, 0);
    
    // Yıllık hedef gerçekleşme oranı
    const yillikHedefGerceklesme = santralDetay.yillikHedefUretim > 0 ? 
      (yillikToplamUretim / santralDetay.yillikHedefUretim) * 100 : 0;
    
    return {
      toplamUretim,
      toplamCO2,
      aylikHedef,
      hedefGerceklesme,
      gunlukHedef,
      hedefUstuGunler,
      hedefAltiGunler,
      enYuksekUretim,
      enYuksekUretimTarihi,
      ortalamaKapasiteFaktoru,
      grafikVerileri,
      yillikGrafikVerileri,
      yillikToplamUretim,
      yillikHedefGerceklesme
    };
  };
  
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
            <h1 className="text-2xl font-bold text-gray-900">Üretim Verileri</h1>
            <p className="mt-1 text-sm text-gray-500">
              Santral üretim verileri
            </p>
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
              
              {canAdd && (
                <button
                  onClick={() => setImportModalAcik(true)}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Veri Ekle
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {yukleniyor ? (
        <div className="flex flex-col justify-center items-center min-h-[200px]">
          <LoadingSpinner size="lg" />
          <p className="text-gray-500 mt-4">Üretim verileri yükleniyor...</p>
          <p className="text-xs text-gray-400 mt-1">Uzun sürerse, sayfayı yenileyip tekrar giriş yapabilirsiniz</p>
        </div>
      ) : (
        <>
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

          {/* Yıllık Hedef Gerçekleşme Kartı */}
          {istatistikler && (
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-none">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="flex items-center mb-4 md:mb-0">
                  <div className="p-3 bg-green-100 rounded-full mr-4">
                    <Target className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <Title>Yıllık Hedef Gerçekleşme</Title>
                    <Text className="text-green-700">
                      {secilenYil} yılı için hedef gerçekleşme durumu
                    </Text>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="flex items-center">
                    <Text className="text-lg font-bold text-green-700 mr-2">
                      %{istatistikler.yillikHedefGerceklesme.toFixed(1)}
                    </Text>
                    <Badge color={istatistikler.yillikHedefGerceklesme >= 100 ? "green" : "yellow"}>
                      {istatistikler.yillikHedefGerceklesme >= 100 ? 'Hedef Aşıldı' : 'Devam Ediyor'}
                    </Badge>
                  </div>
                  <div className="mt-2 w-full max-w-xs">
                    <ProgressBar 
                      value={Math.min(istatistikler.yillikHedefGerceklesme, 100)} 
                      color={istatistikler.yillikHedefGerceklesme >= 100 ? "green" : "yellow"} 
                      className="h-2" 
                    />
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                      <span>{istatistikler.yillikToplamUretim.toLocaleString('tr-TR')} kWh</span>
                      <span>{santralDetay?.yillikHedefUretim.toLocaleString('tr-TR')} kWh</span>
                    </div>
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

          {/* Yıllık Üretim Grafiği */}
          {istatistikler && (
            <Card>
              <Title>Yıllık Üretim Performansı - {secilenYil}</Title>
              <Text>Aylık üretim ve hedef karşılaştırması</Text>
              {yillikVerilerYukleniyor ? (
                <div className="flex justify-center items-center h-80">
                  <LoadingSpinner size="lg" />
                </div>
              ) : (
                <AreaChart
                  className="mt-4 h-80"
                  data={istatistikler.yillikGrafikVerileri}
                  index="ay"
                  categories={["uretim", "hedef"]}
                  colors={["yellow", "blue"]}
                  valueFormatter={(value) => `${value.toLocaleString('tr-TR')} kWh`}
                  yAxisWidth={80}
                  showLegend={true}
                  showAnimation={true}
                  showGradient={true}
                />
              )}
            </Card>
          )}

          {/* Aylık Üretim Grafiği */}
          {istatistikler && istatistikler.grafikVerileri.length > 0 && (
            <Card>
              <Title>Günlük Üretim Detayı - {aySecenekleri[secilenAy].label} {secilenYil}</Title>
              <Text>Günlük üretim ve hedef karşılaştırması</Text>
              <AreaChart
                className="mt-4 h-80"
                data={istatistikler.grafikVerileri}
                index="date"
                categories={["uretim", "hedef"]}
                colors={["yellow", "blue"]}
                valueFormatter={(value) => `${value.toLocaleString('tr-TR')} kWh`}
                showLegend={true}
                showAnimation={true}
                showGradient={true}
                yAxisWidth={80}
                customTooltip={(props) => {
                  const { payload, active } = props;
                  if (!active || !payload) return null;
                  
                  const data = payload[0]?.payload;
                  const uretimDegeri = data?.uretim || 0;
                  const hedefDegeri = data?.hedef || 0;
                  const kapasiteFaktoru = data?.kapasiteFaktoru || 0;
                  const fark = uretimDegeri - hedefDegeri;
                  const farkYuzde = hedefDegeri > 0 ? (fark / hedefDegeri) * 100 : 0;
                  
                  return (
                    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                      <div className="text-sm font-medium text-gray-900 mb-2">{data?.date}</div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600 flex items-center">
                            <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                            Üretim:
                          </span>
                          <span className="text-xs font-medium">{uretimDegeri.toLocaleString('tr-TR')} kWh</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600 flex items-center">
                            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                            Hedef:
                          </span>
                          <span className="text-xs font-medium">{hedefDegeri.toLocaleString('tr-TR')} kWh</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                          <span className="text-xs text-gray-600">Fark:</span>
                          <span className={`text-xs font-medium ${fark >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {fark >= 0 ? '+' : ''}{fark.toLocaleString('tr-TR')} kWh ({fark >= 0 ? '+' : ''}{farkYuzde.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">Kapasite Faktörü:</span>
                          <span className="text-xs font-medium">%{kapasiteFaktoru.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            </Card>
          )}

          {/* Aylık Hedef Gerçekleşme Özeti */}
          {istatistikler && (
            <Card>
              <Title>Aylık Hedef Gerçekleşme Özeti</Title>
              <Text>Aylara göre hedef ve gerçekleşen üretim karşılaştırması</Text>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ay
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hedef (kWh)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gerçekleşen (kWh)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gerçekleşme Oranı
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Durum
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {istatistikler.yillikGrafikVerileri.map((veri, index) => {
                      const gerceklesmeOrani = veri.hedef > 0 ? (veri.uretim / veri.hedef) * 100 : 0;
                      return (
                        <tr key={index} className={`hover:bg-gray-50 ${secilenAy === index ? 'bg-yellow-50' : ''}`}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {veri.ay}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {veri.hedef.toLocaleString('tr-TR')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {veri.uretim.toLocaleString('tr-TR')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            %{gerceklesmeOrani.toFixed(1)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              gerceklesmeOrani >= 100 ? 'bg-green-100 text-green-800' :
                              gerceklesmeOrani >= 75 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {gerceklesmeOrani >= 100 ? (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Hedef Aşıldı
                                </>
                              ) : gerceklesmeOrani >= 75 ? (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  İyi Durumda
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Hedefin Altında
                                </>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Performans Özeti */}
          {istatistikler && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-2">
                <Title>Performans Özeti</Title>
                <Grid numItemsMd={2} numItemsLg={3} className="mt-6 gap-6">
                  <Col>
                    <Flex>
                      <div>
                        <Text>Hedef Üstü Günler</Text>
                        <Metric className="mt-1">{istatistikler.hedefUstuGunler}</Metric>
                      </div>
                      <BadgeDelta deltaType="increase">
                        {istatistikler.hedefUstuGunler > 0 ? 
                          `%${((istatistikler.hedefUstuGunler / uretimVerileri.length) * 100).toFixed(0)}` : 
                          '0%'}
                      </BadgeDelta>
                    </Flex>
                    <Text className="mt-2">Günlük hedefin üzerinde üretim</Text>
                  </Col>
                  <Col>
                    <Flex>
                      <div>
                        <Text>Hedef Altı Günler</Text>
                        <Metric className="mt-1">{istatistikler.hedefAltiGunler}</Metric>
                      </div>
                      <BadgeDelta deltaType="decrease">
                        {istatistikler.hedefAltiGunler > 0 ? 
                          `%${((istatistikler.hedefAltiGunler / uretimVerileri.length) * 100).toFixed(0)}` : 
                          '0%'}
                      </BadgeDelta>
                    </Flex>
                    <Text className="mt-2">Günlük hedefin altında üretim</Text>
                  </Col>
                  <Col>
                    <Flex>
                      <div>
                        <Text>En Yüksek Üretim</Text>
                        <Metric className="mt-1">{istatistikler.enYuksekUretim.toLocaleString('tr-TR')} kWh</Metric>
                      </div>
                      <BadgeDelta deltaType="increase">
                        {istatistikler.enYuksekUretimTarihi ? 
                          format(istatistikler.enYuksekUretimTarihi, 'dd MMM', { locale: tr }) : 
                          '-'}
                      </BadgeDelta>
                    </Flex>
                    <Text className="mt-2">Ayın en yüksek üretim değeri</Text>
                  </Col>
                </Grid>
              </Card>
              
              <Card>
                <Title>Hedef Gerçekleşme</Title>
                <div className="mt-6">
                  <Flex>
                    <Text>Aylık Hedef: {istatistikler.aylikHedef.toLocaleString('tr-TR')} kWh</Text>
                    <Text>%{istatistikler.hedefGerceklesme.toFixed(1)}</Text>
                  </Flex>
                  <ProgressBar 
                    value={Math.min(istatistikler.hedefGerceklesme, 100)} 
                    color={istatistikler.hedefGerceklesme >= 100 ? "green" : istatistikler.hedefGerceklesme >= 75 ? "yellow" : "orange"} 
                    className="mt-2" 
                  />
                  <Flex className="mt-4">
                    <Text>Gerçekleşen: {istatistikler.toplamUretim.toLocaleString('tr-TR')} kWh</Text>
                    <Badge color={istatistikler.hedefGerceklesme >= 100 ? "green" : "yellow"}>
                      {istatistikler.hedefGerceklesme >= 100 ? 'Hedef Aşıldı' : 'Devam Ediyor'}
                    </Badge>
                  </Flex>
                </div>
              </Card>
            </div>
          )}

          {/* Çevresel Etki */}
          {istatistikler && (
            <Card className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-none shadow-md">
              <div className="flex flex-col md:flex-row items-center justify-between">
                <div className="flex items-center mb-4 md:mb-0">
                  <div className="p-3 bg-emerald-100 rounded-full mr-4">
                    <Leaf className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div>
                    <Text className="text-sm text-emerald-700">Çevresel Etki</Text>
                    <div className="flex items-center">
                      <span className="text-xl font-bold text-emerald-800">
                        {istatistikler.toplamCO2.toLocaleString('tr-TR', {maximumFractionDigits: 0})} kg
                      </span>
                      <span className="ml-2 text-sm text-emerald-600">
                        CO₂ tasarrufu
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-emerald-700">
                  Bu, yaklaşık {Math.round(istatistikler.toplamCO2 / 21)} ağacın aylık CO₂ emilimine eşdeğerdir.
                </div>
              </div>
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
                      uretimVerileri.map((veri) => {
                        const tarih = veri.tarih.toDate();
                        const gunlukHedef = istatistikler ? istatistikler.gunlukHedef : 0;
                        const hedefUstu = veri.gunlukUretim >= gunlukHedef;
                        
                        return (
                          <tr key={veri.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {format(tarih, 'dd MMMM yyyy', { locale: tr })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className={`text-sm font-medium ${hedefUstu ? 'text-green-600' : 'text-red-600'}`}>
                                  {veri.gunlukUretim.toLocaleString('tr-TR')}
                                </span>
                                <span className="ml-2">
                                  {hedefUstu ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                  )}
                                </span>
                              </div>
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
                        );
                      })
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
        </>
      )}

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
    </div>
  );
};