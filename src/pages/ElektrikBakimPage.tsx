import React, { useState, useEffect } from 'react';
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
  Calendar,
  CheckCircle,
  AlertTriangle,
  Search,
  Zap,
  Settings,
  TrendingUp,
  Activity,
  ChevronDown,
  Filter,
  FileText,
  Eye,
  Edit3,
  Trash2
} from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ElektrikBakimForm } from '../components/ElektrikBakimForm';
import { ElektrikBakimKart } from '../components/ElektrikBakimKart';
import { ElektrikBakimListesi } from '../components/ElektrikBakimListesi';
import { ElektrikBakimDetay } from '../components/ElektrikBakimDetay';
import { StatsCard } from '../components/StatsCard';
import { SearchInput } from '../components/SearchInput';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import type { ElektrikBakim as ElektrikBakimType } from '../types';
import toast from 'react-hot-toast';

export const ElektrikBakimPage: React.FC = () => {
  const { kullanici } = useAuth();
  const { markPageAsSeen } = useMenuNotifications();
  const [bakimlar, setBakimlar] = useState<ElektrikBakimType[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [secilenSaha, setSecilenSaha] = useState<string>('');
  const [secilenAy, setSecilenAy] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [gorunumTipi, setGorunumTipi] = useState<'kart' | 'liste'>('kart');
  const [detayModalAcik, setDetayModalAcik] = useState(false);
  const [seciliBakimDetay, setSeciliBakimDetay] = useState<ElektrikBakimType | null>(null);
  const [silinecekBakimId, setSilinecekBakimId] = useState<string | null>(null);
  const [bakimToEdit, setBakimToEdit] = useState<ElektrikBakimType | null>(null);
  const [sahalar, setSahalar] = useState<Array<{id: string, ad: string}>>([]);
  const [aramaMetni, setAramaMetni] = useState('');

  const [istatistikler, setIstatistikler] = useState({
    toplamBakim: 0,
    sorunluBakim: 0,
    sorunsuzBakim: 0,
    cozumOrani: 0
  });

  const canAdd = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis', 'superadmin'].includes(kullanici.rol);
  const canEdit = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis', 'superadmin'].includes(kullanici.rol);
  const canDelete = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis', 'superadmin'].includes(kullanici.rol);

  useEffect(() => {
    const sahalariGetir = async () => {
      if (!kullanici?.companyId) return;
      try {
        let sahaQueryConstraints = [
          where('companyId', '==', kullanici.companyId),
          orderBy('ad')
        ];
        if (kullanici.rol === 'musteri' && kullanici.sahalar && Array.isArray(kullanici.sahalar) && kullanici.sahalar.length > 0) {
           sahaQueryConstraints = [where('__name__', 'in', kullanici.sahalar), orderBy('ad')];
        } else if (kullanici.rol === 'musteri' && (!kullanici.sahalar || (Array.isArray(kullanici.sahalar) && kullanici.sahalar.length === 0))){
          setSahalar([]);
          return;
        }
        
        const sahaQuery = query(collection(db, 'sahalar'), ...sahaQueryConstraints);
        const sahaSnapshot = await getDocs(sahaQuery);
        const sahaListesi = sahaSnapshot.docs.map(doc => ({
          id: doc.id,
          ad: doc.data().ad as string
        }));
        setSahalar(sahaListesi);
      } catch (error) {
        console.error('Sahalar getirilemedi:', error);
        toast.error('Sahalar yüklenirken bir hata oluştu');
      }
    };
    sahalariGetir();
  }, [kullanici]);

  useEffect(() => {
    const bakimlariGetir = async () => {
      if (!kullanici?.companyId) return;
      
      // Sayfa görüldü olarak işaretle
      markPageAsSeen('elektrikBakim');
      
      setYukleniyor(true);
      try {
        const ayBaslangic = startOfMonth(parseISO(secilenAy + '-01'));
        const ayBitis = endOfMonth(parseISO(secilenAy + '-01'));

        let qConstraints: any[] = [
          where('companyId', '==', kullanici.companyId),
          where('tarih', '>=', Timestamp.fromDate(ayBaslangic)),
          where('tarih', '<=', Timestamp.fromDate(ayBitis)),
          orderBy('tarih', 'desc')
        ];

        if (kullanici.rol === 'musteri') {
          if (kullanici.sahalar && Array.isArray(kullanici.sahalar) && kullanici.sahalar.length > 0) {
            if (secilenSaha && kullanici.sahalar.includes(secilenSaha)) {
              qConstraints.push(where('sahaId', '==', secilenSaha));
            } else if (secilenSaha && !kullanici.sahalar.includes(secilenSaha)){
              setBakimlar([]);
              setIstatistikler({ toplamBakim: 0, sorunluBakim: 0, sorunsuzBakim: 0, cozumOrani: 0 });
              setYukleniyor(false);
              return;
            } else {
              qConstraints.push(where('sahaId', 'in', kullanici.sahalar));
            }
          } else {
             setBakimlar([]);
             setIstatistikler({ toplamBakim: 0, sorunluBakim: 0, sorunsuzBakim: 0, cozumOrani: 0 });
             setYukleniyor(false);
             return;
          }
        } else if (secilenSaha) {
          qConstraints.push(where('sahaId', '==', secilenSaha));
        }
        
        const bakimQuery = query(collection(db, 'elektrikBakimlar'), ...qConstraints.filter(c => c !== undefined));
        const snapshot = await getDocs(bakimQuery);
        const bakimVerileri = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ElektrikBakimType[];
        
        setBakimlar(bakimVerileri);

        const sorunluBakimSayisi = bakimVerileri.filter(bakim => 
          Object.entries(bakim.durumlar).some(([key, value]) => {
            if (key.endsWith('Aciklamalar')) return false;
            if (typeof value === 'object' && value !== null) {
                return Object.values(value).some(durum => durum === false);
            }
            return false;
          })
        ).length;

        setIstatistikler({
          toplamBakim: bakimVerileri.length,
          sorunluBakim: sorunluBakimSayisi,
          sorunsuzBakim: bakimVerileri.length - sorunluBakimSayisi,
          cozumOrani: bakimVerileri.length > 0 
            ? ((bakimVerileri.length - sorunluBakimSayisi) / bakimVerileri.length) * 100 
            : 0
        });

      } catch (error) {
        console.error('Elektrik Bakımlar getirilemedi:', error);
        toast.error('Bakım kayıtları yüklenirken bir hata oluştu.');
      } finally {
        setYukleniyor(false);
      }
    };

    bakimlariGetir();
  }, [kullanici, secilenSaha, secilenAy]);

  const handleFormOpen = (bakim?: ElektrikBakimType) => {
    setBakimToEdit(bakim || null);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setBakimToEdit(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    setSecilenAy(prev => prev);
  };

  const handleDetayModalOpen = (bakim: ElektrikBakimType) => {
    setSeciliBakimDetay(bakim);
    setDetayModalAcik(true);
  };

  const handleDetayModalClose = () => {
    setDetayModalAcik(false);
    setSeciliBakimDetay(null);
  };

  const handleSilModalOpen = (id: string) => {
    setSilinecekBakimId(id);
  };

  const handleSilModalClose = () => {
    setSilinecekBakimId(null);
  };

  const handleBakimSil = async () => {
    if (!silinecekBakimId || !kullanici?.companyId) {
      toast.error('Silinecek bakım bulunamadı veya yetkiniz yok.');
      return;
    }
    if (!canDelete) {
      toast.error('Bu işlem için yetkiniz yok.');
      handleSilModalClose();
      return;
    }

    const toastId = toast.loading('Bakım kaydı siliniyor...');
    try {
      const bakimRef = doc(db, 'elektrikBakimlar', silinecekBakimId);
      await deleteDoc(bakimRef);
      toast.success('Bakım kaydı başarıyla silindi.', { id: toastId });
      setBakimlar(prev => prev.filter(b => b.id !== silinecekBakimId));
      setIstatistikler(prev => ({
        ...prev,
        toplamBakim: prev.toplamBakim -1,
      }));
      handleSilModalClose();
    } catch (error) {
      console.error('Bakım silme hatası:', error);
      toast.error('Bakım silinirken bir hata oluştu.', { id: toastId });
    }
  };
  
  const filtrelenmisBakimlar = bakimlar.filter(bakim => {
    if (!aramaMetni) return true;
    const arama = aramaMetni.toLowerCase();
    const sahaAdi = sahalar.find(s => s.id === bakim.sahaId)?.ad.toLowerCase() || '';
    return (
      sahaAdi.includes(arama) ||
      (bakim.kontrolEden?.ad && bakim.kontrolEden.ad.toLowerCase().includes(arama)) ||
      (bakim.genelNotlar && bakim.genelNotlar.toLowerCase().includes(arama))
    );
  });

  const colors = {
    primaryBlue: '#1E40AF',
    lightBlue: '#3B82F6',
    background: '#F8FAFC',
    cardBg: '#FFFFFF',
    border: '#E2E8F0',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="w-full space-y-6">
        {/* Header */}
        <header className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="mb-4 md:mb-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                Elektrik Bakım Kontrolleri
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {secilenSaha ? sahalar.find(s => s.id === secilenSaha)?.ad || 'Seçili Saha' : 'Tüm Sahalar'} ({format(parseISO(secilenAy + '-01'), 'MMMM yyyy', { locale: tr })})
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {canAdd && (
                <button
                  onClick={() => handleFormOpen()}
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
              <label htmlFor="arama" className="block text-xs font-medium text-gray-700 mb-1">Ara (Saha, Personel, Not...)</label>
              <SearchInput
                value={aramaMetni}
                onChange={(value) => setAramaMetni(value)}
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
            icon={Activity}
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
            title="Çözüm Oranı"
            value={`${istatistikler.cozumOrani.toFixed(1)}%`}
            icon={TrendingUp}
            color="blue"
          />
        </div>
        
        {/* Content Area */}
        {yukleniyor ? (
          <div className="flex justify-center items-center min-h-[300px]">
            <LoadingSpinner size="lg" />
          </div>
        ) : filtrelenmisBakimlar.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-lg border border-gray-200 shadow-sm">
            <Zap size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Kayıt Bulunamadı</h3>
            <p className="text-sm text-gray-500">
              Seçili filtrelere uygun elektrik bakım kaydı bulunamadı.
              {canAdd && ' Yeni bir bakım kaydı ekleyebilirsiniz.'}
            </p>
            {canAdd && (
              <button
                onClick={() => handleFormOpen()}
                className="mt-6 flex items-center mx-auto px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus size={18} className="mr-2" />
                Yeni Bakım Ekle
              </button>
            )}
          </div>
        ) : gorunumTipi === 'kart' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtrelenmisBakimlar.map(bakim => (
              <ElektrikBakimKart 
                key={bakim.id} 
                bakim={bakim} 
                sahaAdi={sahalar.find(s => s.id === bakim.sahaId)?.ad || 'Bilinmeyen Saha'}
                onViewDetailsClick={() => handleDetayModalOpen(bakim)}
                onEditClick={() => handleFormOpen(bakim)}
                onDeleteClick={() => handleSilModalOpen(bakim.id)}
                canEdit={canEdit ?? false}
                canDelete={canDelete ?? false}
              />
            ))}
          </div>
        ) : (
          <ElektrikBakimListesi 
            bakimlar={filtrelenmisBakimlar}
            sahalar={sahalar}
            onViewDetailsClick={handleDetayModalOpen}
            onEditClick={handleFormOpen}
            onDeleteClick={handleSilModalOpen}
            canEdit={canEdit ?? false}
            canDelete={canDelete ?? false}
          />
        )}

        {isFormOpen && (
          <ElektrikBakimForm 
            onClose={handleFormClose}
            sahalar={sahalar}
            mode={bakimToEdit ? 'edit' : 'add'}
            bakimToEdit={bakimToEdit}
            onSuccess={handleFormSuccess}
          />
        )}
        {detayModalAcik && seciliBakimDetay && (
          <ElektrikBakimDetay 
            bakim={seciliBakimDetay}
            sahaAdi={sahalar.find(s => s.id === seciliBakimDetay.sahaId)?.ad || 'Bilinmeyen Saha'}
            onClose={handleDetayModalClose}
          />
        )}
        {silinecekBakimId && (
          <SilmeOnayModal 
            isOpen={!!silinecekBakimId}
            onClose={handleSilModalClose}
            onConfirm={handleBakimSil}
            title="Elektrik Bakım Kaydını Sil"
            message="Bu elektrik bakım kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
            confirmButtonText="Evet, Sil"
            cancelButtonText="İptal"
          />
        )}
      </div>
    </div>
  );
}; 