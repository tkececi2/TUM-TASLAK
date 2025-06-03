
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
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
  Wrench,
  Settings,
  TrendingUp
} from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MekanikBakimForm } from '../components/MekanikBakimForm';
import { MekanikBakimKart } from '../components/MekanikBakimKart';
import { MekanikBakimListesi } from '../components/MekanikBakimListesi';
import { MekanikBakimDetay } from '../components/MekanikBakimDetay';
import { StatsCard } from '../components/StatsCard';
import { SearchInput } from '../components/SearchInput';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import type { MekanikBakim } from '../types';
import toast from 'react-hot-toast';

export const MekanikBakim: React.FC = () => {
  const { kullanici } = useAuth();
  const [bakimlar, setBakimlar] = useState<MekanikBakim[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [secilenSaha, setSecilenSaha] = useState<string>('');
  const [secilenAy, setSecilenAy] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [gorunumTipi, setGorunumTipi] = useState<'kart' | 'liste'>('kart');
  const [seciliBakim, setSeciliBakim] = useState<MekanikBakim | null>(null);
  const [silinecekBakim, setSilinecekBakim] = useState<string | null>(null);
  const [sahalar, setSahalar] = useState<Array<{id: string, ad: string}>>([]);
  const [aramaMetni, setAramaMetni] = useState('');

  const [istatistikler, setIstatistikler] = useState({
    toplamBakim: 0,
    sorunluBakim: 0,
    sorunsuzBakim: 0,
    kontrolOrani: 0
  });

  // Yetki kontrolleri
  const canAdd = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);
  const canDelete = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);

  useEffect(() => {
    const sahalariGetir = async () => {
      if (!kullanici) return;

      try {
        let sahaQuery;
        if (kullanici.rol === 'musteri' && kullanici.sahalar) {
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
          ad: doc.data().ad
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

      try {
        setYukleniyor(true);

        let bakimQuery;
        if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          if (secilenSaha) {
            if (!kullanici.sahalar.includes(secilenSaha)) {
              setBakimlar([]);
              setYukleniyor(false);
              return;
            }
            bakimQuery = query(
              collection(db, 'mekanikBakimlar'),
              where('sahaId', '==', secilenSaha),
              where('companyId', '==', kullanici.companyId)
            );
          } else {
            bakimQuery = query(
              collection(db, 'mekanikBakimlar'),
              where('sahaId', 'in', kullanici.sahalar),
              where('companyId', '==', kullanici.companyId)
            );
          }
        } else if (secilenSaha) {
          bakimQuery = query(
            collection(db, 'mekanikBakimlar'),
            where('sahaId', '==', secilenSaha),
            where('companyId', '==', kullanici.companyId)
          );
        } else {
          bakimQuery = query(
            collection(db, 'mekanikBakimlar'),
            where('companyId', '==', kullanici.companyId),
            orderBy('tarih', 'desc')
          );
        }

        const snapshot = await getDocs(bakimQuery);
        let bakimVerileri = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as MekanikBakim[];

        const ayBaslangic = startOfMonth(parseISO(secilenAy + '-01'));
        const ayBitis = endOfMonth(parseISO(secilenAy + '-01'));

        // Tarih filtresi uygula
        bakimVerileri = bakimVerileri.filter(bakim => {
          const bakimTarihi = bakim.tarih.toDate();
          return bakimTarihi >= ayBaslangic && bakimTarihi <= ayBitis;
        });
        
        setBakimlar(bakimVerileri);

        // İstatistikleri hesapla
        const sorunluBakimSayisi = bakimVerileri.filter(bakim => 
          Object.values(bakim.durumlar).some(kategori => 
            Object.values(kategori).some(durum => durum === false)
          )
        ).length;

        setIstatistikler({
          toplamBakim: bakimVerileri.length,
          sorunluBakim: sorunluBakimSayisi,
          sorunsuzBakim: bakimVerileri.length - sorunluBakimSayisi,
          kontrolOrani: bakimVerileri.length > 0 
            ? ((bakimVerileri.length - sorunluBakimSayisi) / bakimVerileri.length) * 100 
            : 0
        });

      } catch (error) {
        console.error('Bakımlar getirilemedi:', error);
        toast.error('Bakımlar yüklenirken bir hata oluştu');
      } finally {
        setYukleniyor(false);
      }
    };

    bakimlariGetir();
  }, [kullanici, secilenSaha, secilenAy]);

  const handleBakimSil = async (id: string) => {
    if (!kullanici) {
      toast.error('Oturum açmanız gerekiyor');
      return;
    }

    if (!canDelete) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }

    try {
      setYukleniyor(true);
      const bakimRef = doc(db, 'mekanikBakimlar', id);
      
      // Önce bakım kaydının var olduğunu kontrol et
      const bakimDoc = await getDoc(bakimRef);
      if (!bakimDoc.exists()) {
        toast.error('Bakım kaydı bulunamadı');
        return;
      }

      // Şirket kontrolü
      const bakimData = bakimDoc.data();
      if (bakimData.companyId !== kullanici.companyId) {
        toast.error('Bu bakım kaydını silmek için yetkiniz yok');
        return;
      }
      
      // Bakım kaydını sil
      await deleteDoc(bakimRef);
      
      toast.success('Bakım kaydı başarıyla silindi');
      setSilinecekBakim(null);
      setBakimlar(prev => prev.filter(bakim => bakim.id !== id));
    } catch (error) {
      console.error('Bakım silme hatası:', error);
      toast.error('Bakım silinirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  const filtrelenmisVeriler = bakimlar.filter(bakim => {
    if (!aramaMetni) return true;
    
    const aramaMetniKucuk = aramaMetni.toLowerCase();
    const sahaAdi = sahalar.find(s => s.id === bakim.sahaId)?.ad.toLowerCase() || '';
    const kontrolEdenAdi = bakim.kontrolEden.ad.toLowerCase();
    
    return (
      sahaAdi.includes(aramaMetniKucuk) ||
      kontrolEdenAdi.includes(aramaMetniKucuk) ||
      (bakim.genelNotlar && bakim.genelNotlar.toLowerCase().includes(aramaMetniKucuk))
    );
  });

  if (yukleniyor) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-yellow-600 to-yellow-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
                <Wrench className="h-10 w-10 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Mekanik Bakım Kontrolleri</h1>
                <p className="text-yellow-100 mt-2">
                  {kullanici?.rol === 'musteri' 
                    ? 'Size ait sahaların bakım kayıtları'
                    : `Toplam ${filtrelenmisVeriler.length} bakım kaydı`}
                </p>
              </div>
            </div>
            {canAdd && (
              <div className="mt-6 md:mt-0">
                <button
                  onClick={() => setFormAcik(true)}
                  className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-lg text-sm font-medium text-yellow-700 bg-white hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all duration-200 hover:scale-105"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Yeni Bakım Kaydı
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Toplam Bakım</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{istatistikler.toplamBakim}</p>
                <p className="text-xs text-gray-500 mt-1">Kayıtlı bakım sayısı</p>
              </div>
              <div className="bg-yellow-100 rounded-xl p-3">
                <Wrench className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sorunlu Bakım</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{istatistikler.sorunluBakim}</p>
                <p className="text-xs text-gray-500 mt-1">Müdahale gereken</p>
              </div>
              <div className="bg-red-100 rounded-xl p-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sorunsuz Bakım</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{istatistikler.sorunsuzBakim}</p>
                <p className="text-xs text-gray-500 mt-1">Başarılı kontrollar</p>
              </div>
              <div className="bg-green-100 rounded-xl p-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 hover:shadow-2xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Başarı Oranı</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">%{istatistikler.kontrolOrani.toFixed(1)}</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.min(istatistikler.kontrolOrani, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div className="bg-blue-100 rounded-xl p-3">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <SearchInput
                value={aramaMetni}
                onChange={setAramaMetni}
                placeholder="Bakım kaydı ara..."
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <select
                value={secilenSaha}
                onChange={(e) => setSecilenSaha(e.target.value)}
                className="rounded-xl border-gray-200 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 transition-all duration-200"
              >
                <option value="">Tüm Sahalar</option>
                {sahalar.map(saha => (
                  <option key={saha.id} value={saha.id}>{saha.ad}</option>
                ))}
              </select>

              <input
                type="month"
                value={secilenAy}
                onChange={(e) => setSecilenAy(e.target.value)}
                className="rounded-xl border-gray-200 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 transition-all duration-200"
              />

              <div className="flex rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setGorunumTipi('kart')}
                  className={`px-4 py-2 text-sm font-medium border transition-all duration-200 ${
                    gorunumTipi === 'kart'
                      ? 'bg-yellow-50 text-yellow-700 border-yellow-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <LayoutGrid className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setGorunumTipi('liste')}
                  className={`px-4 py-2 text-sm font-medium border-t border-b border-r transition-all duration-200 ${
                    gorunumTipi === 'liste'
                      ? 'bg-yellow-50 text-yellow-700 border-yellow-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <List className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {gorunumTipi === 'liste' ? (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <MekanikBakimListesi
              bakimlar={filtrelenmisVeriler}
              sahalar={sahalar}
              onBakimTikla={(bakim) => setSeciliBakim(bakim)}
              onBakimSil={canDelete ? (id) => setSilinecekBakim(id) : undefined}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtrelenmisVeriler.map((bakim) => (
              <div key={bakim.id} className="relative">
                <MekanikBakimKart
                  bakim={bakim}
                  sahaAdi={sahalar.find(s => s.id === bakim.sahaId)?.ad || 'Bilinmeyen Saha'}
                  onClick={() => setSeciliBakim(bakim)}
                />
                {canDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSilinecekBakim(bakim.id);
                    }}
                    className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-lg hover:bg-red-50 transition-colors duration-200 z-10"
                  >
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {filtrelenmisVeriler.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-12 text-center">
            <Wrench className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Bakım kaydı bulunamadı</h3>
            <p className="text-gray-500 mb-6">Seçilen kriterlere uygun bakım kaydı bulunmuyor.</p>
            {canAdd && (
              <button
                onClick={() => setFormAcik(true)}
                className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-lg text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 transition-all duration-200"
              >
                <Plus className="h-5 w-5 mr-2" />
                İlk Bakım Kaydını Oluştur
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {formAcik && (
        <MekanikBakimForm
          onClose={() => setFormAcik(false)}
          sahalar={sahalar}
        />
      )}

      {seciliBakim && (
        <MekanikBakimDetay
          bakim={seciliBakim}
          sahaAdi={sahalar.find(s => s.id === seciliBakim.sahaId)?.ad || 'Bilinmeyen Saha'}
          onClose={() => setSeciliBakim(null)}
        />
      )}

      {silinecekBakim && (
        <SilmeOnayModal
          onConfirm={() => handleBakimSil(silinecekBakim)}
          onCancel={() => setSilinecekBakim(null)}
          mesaj="Bu bakım kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        />
      )}
    </div>
  );
};
