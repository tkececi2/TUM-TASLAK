import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useMenuNotifications } from '../contexts/MenuNotificationContext';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Plus, 
  LayoutGrid, 
  List,
  Building,
  Calendar as CalendarIcon,
  CheckCircle,
  AlertTriangle,
  Search,
  Wrench,
  Settings,
  TrendingUp,
  Filter,
  Edit2,
  Eye
} from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MekanikBakimForm } from '../components/MekanikBakimForm';
import { MekanikBakimKart } from '../components/MekanikBakimKart';
import { MekanikBakimListesi } from '../components/MekanikBakimListesi';
import { MekanikBakimDetay } from '../components/MekanikBakimDetay';
import { StatsCard } from '../components/StatsCard';
import { SearchInput } from '../components/SearchInput';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import type { MekanikBakim, Saha } from '../types';
import toast from 'react-hot-toast';

export const MekanikBakimPage: React.FC = () => {
  const { kullanici } = useAuth();
  const { markPageAsSeen } = useMenuNotifications();
  const [bakimlar, setBakimlar] = useState<MekanikBakim[]>([]);
  const [originalBakimlar, setOriginalBakimlar] = useState<MekanikBakim[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [bakimToEdit, setBakimToEdit] = useState<MekanikBakim | null>(null);
  
  const [secilenSaha, setSecilenSaha] = useState<string>('');
  const [secilenAy, setSecilenAy] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [gorunumTipi, setGorunumTipi] = useState<'kart' | 'liste'>('kart');
  
  const [detayModalBakim, setDetayModalBakim] = useState<MekanikBakim | null>(null);
  const [silinecekBakimId, setSilinecekBakimId] = useState<string | null>(null);
  
  const [sahalar, setSahalar] = useState<Pick<Saha, 'id' | 'ad'>[]>([]);
  const [aramaMetni, setAramaMetni] = useState('');

  const [istatistikler, setIstatistikler] = useState({
    toplamBakim: 0,
    sorunluBakim: 0,
    sorunsuzBakim: 0,
    kontrolOrani: 0
  });

  const canAdd = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis', 'superadmin'].includes(kullanici.rol);
  const canDelete = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis', 'superadmin'].includes(kullanici.rol);
  const canEdit = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis', 'superadmin'].includes(kullanici.rol);

  const getSahalar = useCallback(async () => {
    if (!kullanici || !kullanici.companyId) return;
    try {
      let sahaQuery;
      if (kullanici.rol === 'musteri' && kullanici.sahalar && Array.isArray(kullanici.sahalar) && kullanici.sahalar.length > 0) {
        sahaQuery = query(
          collection(db, 'sahalar'),
          where('__name__', 'in', kullanici.sahalar)
        );
      } else {
        sahaQuery = query(
          collection(db, 'sahalar'),
          where('companyId', '==', kullanici.companyId),
          orderBy('ad')
        );
      }
      const sahaSnapshot = await getDocs(sahaQuery);
      const sahaListesi = sahaSnapshot.docs.map(doc => ({
        id: doc.id,
        ad: doc.data().ad as string
      }));
      setSahalar(sahaListesi);
    } catch (error) {
      console.error('Sahalar getirilemedi:', error);
      toast.error('Sahalar yüklenirken bir hata oluştu.');
    }
  }, [kullanici]);

  const getBakimlar = useCallback(async () => {
    if (!kullanici?.companyId) return;
    setYukleniyor(true);
    try {
      let q = query(collection(db, 'mekanikBakimlar'), where('companyId', '==', kullanici.companyId));

      if (kullanici.rol === 'musteri' && kullanici.sahalar && Array.isArray(kullanici.sahalar)) {
        if (kullanici.sahalar.length === 0) {
          setOriginalBakimlar([]);
          setBakimlar([]);
          setYukleniyor(false);
          return;
        }
        q = query(q, where('sahaId', 'in', kullanici.sahalar));
      }
      
      const snapshot = await getDocs(q);
      let veriler = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MekanikBakim[];
      
      setOriginalBakimlar(veriler); // Filtreleme için orijinal veriyi sakla
      // İstatistikleri ve filtrelemeyi burada uygula (aşağıdaki useEffect'ten taşınacak)

    } catch (error) {
      console.error('Bakımlar getirilemedi:', error);
      toast.error('Bakımlar yüklenirken bir hata oluştu.');
      setOriginalBakimlar([]);
      setBakimlar([]);
    } finally {
      setYukleniyor(false);
    }
  }, [kullanici]);

  useEffect(() => {
    // Sayfa görüldü olarak işaretle
    markPageAsSeen('mekanikBakim');
    
    getSahalar();
    getBakimlar();
  }, [getSahalar, getBakimlar]);
  
  useEffect(() => {
    // Bu useEffect orijinalBakimlar, secilenSaha, secilenAy, aramaMetni değiştiğinde çalışacak
    // ve bakimlar state'ini güncelleyecek.
    setYukleniyor(true);
    let filtrelenmis = [...originalBakimlar];

    // 1. Saha filtresi
    if (secilenSaha) {
      filtrelenmis = filtrelenmis.filter(bakim => bakim.sahaId === secilenSaha);
    }

    // 2. Ay/Yıl filtresi
    if (secilenAy) {
      const ayBaslangic = startOfMonth(parseISO(secilenAy + '-01'));
      const ayBitis = endOfMonth(parseISO(secilenAy + '-01'));
      filtrelenmis = filtrelenmis.filter(bakim => {
        if (bakim.tarih && bakim.tarih.toDate) { // Timestamp kontrolü
          const bakimTarihi = bakim.tarih.toDate();
          return bakimTarihi >= ayBaslangic && bakimTarihi <= ayBitis;
        }
        return false;
      });
    }
    
    // 3. Arama metni filtresi
    if (aramaMetni) {
      const aramaKucuk = aramaMetni.toLowerCase();
      filtrelenmis = filtrelenmis.filter(bakim => {
        const saha = sahalar.find(s => s.id === bakim.sahaId);
        return (
          (saha?.ad.toLowerCase().includes(aramaKucuk)) ||
          (bakim.kontrolEden.ad.toLowerCase().includes(aramaKucuk)) ||
          (bakim.genelNotlar && bakim.genelNotlar.toLowerCase().includes(aramaKucuk))
        );
      });
    }
    
    // Tarihe göre sırala (en yeni en üstte)
    filtrelenmis.sort((a, b) => {
        const dateA = a.tarih?.toDate ? a.tarih.toDate().getTime() : 0;
        const dateB = b.tarih?.toDate ? b.tarih.toDate().getTime() : 0;
        return dateB - dateA;
    });

    setBakimlar(filtrelenmis);

    // İstatistikleri hesapla
    const sorunluBakimSayisi = filtrelenmis.filter(bakim => 
      bakim.durumlar && typeof bakim.durumlar === 'object' &&
      Object.keys(bakim.durumlar)
        .filter(key => !key.endsWith('Aciklamalar')) // Sadece durumları içeren anahtarları al
        .some(kategoriKey => {
            const kategori = bakim.durumlar[kategoriKey as keyof MekanikBakim['durumlar']];
            return typeof kategori === 'object' && kategori !== null && Object.values(kategori).some(durum => durum === false);
        })
    ).length;
    
    const toplamFiltreli = filtrelenmis.length;
    const sorunsuzSayisi = toplamFiltreli - sorunluBakimSayisi;

    setIstatistikler({
      toplamBakim: toplamFiltreli,
      sorunluBakim: sorunluBakimSayisi,
      sorunsuzBakim: sorunsuzSayisi,
      kontrolOrani: toplamFiltreli > 0 ? (sorunsuzSayisi / toplamFiltreli) * 100 : 0
    });
    setYukleniyor(false);

  }, [originalBakimlar, secilenSaha, secilenAy, aramaMetni, sahalar]);


  const handleOpenAddForm = () => {
    setBakimToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (bakim: MekanikBakim) => {
    setBakimToEdit(bakim);
    setIsFormOpen(true);
  };

  const handleFormSuccess = () => {
    getBakimlar(); // Veriyi yeniden çek
    // Form zaten kendi içinde onClose ile kapanacak, burada ek bir şeye gerek yok.
    // Ancak, onSuccess'ten sonra modalın kapandığından emin olmak için
    setIsFormOpen(false);
    setBakimToEdit(null);
  };
  
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setBakimToEdit(null);
  }

  const handleBakimSil = async (id: string) => {
    if (!kullanici || !canDelete) {
      toast.error('Bu işlem için yetkiniz yok.');
      return;
    }
    setYukleniyor(true);
    try {
      const bakimRef = doc(db, 'mekanikBakimlar', id);
      const bakimDoc = await getDoc(bakimRef);

      if (!bakimDoc.exists() || bakimDoc.data()?.companyId !== kullanici.companyId) {
        toast.error('Bakım kaydı bulunamadı veya silme yetkiniz yok.');
        setSilinecekBakimId(null);
        setYukleniyor(false);
        return;
      }
      
      await deleteDoc(bakimRef);
      toast.success('Bakım kaydı başarıyla silindi.');
      setSilinecekBakimId(null);
      getBakimlar(); // Veriyi yeniden yükle
    } catch (error) {
      console.error('Bakım silme hatası:', error);
      toast.error('Bakım silinirken bir hata oluştu.');
    } finally {
      setYukleniyor(false);
    }
  };

  if (!kullanici) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <LoadingSpinner size="lg" />
        <p className="ml-4 text-slate-600">Kullanıcı bilgileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="w-full space-y-6">
        {/* Header */}
        <header className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="mb-4 md:mb-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                Mekanik Bakım Kayıtları
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {secilenSaha ? sahalar.find(s => s.id === secilenSaha)?.ad || 'Seçili Saha' : 'Tüm Sahalar'} ({format(parseISO(secilenAy + '-01'), 'MMMM yyyy', { locale: tr })})
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {canAdd && (
                <button
                  onClick={handleOpenAddForm}
                  className="flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Plus size={18} className="mr-2" />
                  Yeni Bakım Ekle
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label htmlFor="sahaFiltre" className="block text-xs font-medium text-gray-700 mb-1">Saha</label>
              <select
                id="sahaFiltre"
                value={secilenSaha}
                onChange={(e) => setSecilenSaha(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">Tüm Sahalar</option>
                {sahalar.map(saha => (
                  <option key={saha.id} value={saha.id}>{saha.ad}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ayFiltre" className="block text-xs font-medium text-gray-700 mb-1">Ay/Yıl</label>
              <input
                type="month"
                id="ayFiltre"
                value={secilenAy}
                onChange={(e) => setSecilenAy(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="arama" className="block text-xs font-medium text-gray-700 mb-1">Ara (Saha, Kontrol Eden, Not...)</label>
              <SearchInput
                value={aramaMetni}
                onChange={(value: string) => setAramaMetni(value)}
                placeholder="Bakımlarda ara..."
              />
            </div>
            
            <div className="flex items-center justify-end space-x-1 bg-gray-100 p-0.5 rounded-lg">
              {[
                { view: 'liste', icon: List, label: 'Liste' },
                { view: 'kart', icon: LayoutGrid, label: 'Kart' },
              ].map((item) => (
                <button
                  key={item.view}
                  onClick={() => setGorunumTipi(item.view as 'kart' | 'liste')}
                  title={item.label}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    gorunumTipi === item.view 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                  }`}
                >
                  <item.icon size={16} className="mx-auto"/>
                  <span className="sr-only">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard 
            title="Toplam Bakım" 
            value={istatistikler.toplamBakim.toString()} 
            icon={Wrench}
            color="blue"
          />
          <StatsCard 
            title="Sorunlu Bakım" 
            value={istatistikler.sorunluBakim.toString()} 
            icon={AlertTriangle}
            color="red"
          />
          <StatsCard 
            title="Sorunsuz Bakım" 
            value={istatistikler.sorunsuzBakim.toString()} 
            icon={CheckCircle}
            color="green"
          />
          <StatsCard 
            title="Genel Kontrol Oranı" 
            value={`${istatistikler.kontrolOrani.toFixed(1)}%`}
            icon={TrendingUp}
            color="blue"
          />
        </div>
        
        {/* Content Area */}
        {yukleniyor && bakimlar.length === 0 ? (
           <div className="flex justify-center items-center min-h-[300px]">
             <LoadingSpinner size="lg" />
             <p className="ml-3 text-slate-500">Bakım kayıtları yükleniyor...</p>
           </div>
        ) : !yukleniyor && bakimlar.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-lg border border-gray-200 shadow-sm">
            <Filter size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Kayıt Bulunamadı</h3>
            <p className="text-sm text-gray-500">Seçili filtrelere uygun mekanik bakım kaydı bulunamadı.</p>
            {canAdd && (
               <button
                  onClick={handleOpenAddForm}
                  className="mt-6 flex items-center mx-auto px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
              >
                  <Plus size={18} className="mr-2" />
                  İlk Bakım Kaydını Ekle
              </button>
            )}
          </div>
        ) : gorunumTipi === 'kart' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {bakimlar.map(bakim => (
              <MekanikBakimKart 
                key={bakim.id} 
                bakim={bakim} 
                sahaAdi={sahalar.find(s => s.id === bakim.sahaId)?.ad || 'Bilinmeyen Saha'}
                onDeleteClick={() => setSilinecekBakimId(bakim.id)}
                onEditClick={() => handleOpenEditForm(bakim)}
                onViewDetailsClick={() => setDetayModalBakim(bakim)}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ))}
          </div>
        ) : (
          <MekanikBakimListesi 
            bakimlar={bakimlar} 
            sahalar={sahalar}
            onDeleteClick={(id: string) => setSilinecekBakimId(id)}
            onEditClick={handleOpenEditForm}
            onViewDetailsClick={setDetayModalBakim}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        )}

        {/* Modals */}
        {isFormOpen && (
          <MekanikBakimForm
            onClose={handleCloseForm}
            sahalar={sahalar}
            bakimToEdit={bakimToEdit}
            mode={bakimToEdit ? 'edit' : 'add'}
            onSuccess={handleFormSuccess}
          />
        )}

        {silinecekBakimId && (
          <SilmeOnayModal
            baslik="Bakım Kaydını Sil"
            mesaj="Bu mekanik bakım kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
            onConfirm={() => handleBakimSil(silinecekBakimId)}
            onCancel={() => setSilinecekBakimId(null)}
          />
        )}

        {detayModalBakim && (
          <MekanikBakimDetay
            bakim={detayModalBakim}
            sahaAdi={sahalar.find(s => s.id === detayModalBakim.sahaId)?.ad || 'Bilinmeyen Saha'}
            onClose={() => setDetayModalBakim(null)}
          />
        )}
      </div>
    </div>
  );
};
