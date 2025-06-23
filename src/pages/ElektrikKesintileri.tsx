import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, Timestamp } from 'firebase/firestore';
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
  Zap,
  Trash2,
  Clock,
  Filter,
  Edit3,
  BarChart3
} from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ElektrikKesintisiForm } from '../components/ElektrikKesintisiForm';
import { ElektrikKesintisiDetay } from '../components/ElektrikKesintisiDetay';
import { ElektrikKesintisiListesi } from '../components/ElektrikKesintisiListesi';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import type { ElektrikKesinti } from '../types';
import toast from 'react-hot-toast';

// Custom StatCard component to replace Tremor Card
const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'red' | 'green' | 'orange';
}> = ({ title, value, icon, color }) => {
  const colorClasses = {
    blue: 'border-blue-200 bg-blue-50 text-blue-600',
    red: 'border-red-200 bg-red-50 text-red-600',
    green: 'border-green-200 bg-green-50 text-green-600',
    orange: 'border-orange-200 bg-orange-50 text-orange-600'
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export const ElektrikKesintileri: React.FC = () => {
  const { kullanici } = useAuth();
  const { markPageAsSeen } = useMenuNotifications();
  const [kesintiler, setKesintiler] = useState<ElektrikKesinti[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [secilenSaha, setSecilenSaha] = useState<string>('');
  const [secilenAy, setSecilenAy] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [gorunumTipi, setGorunumTipi] = useState<'kart' | 'liste' | 'istatistikler'>('kart');
  const [seciliKesinti, setSeciliKesinti] = useState<ElektrikKesinti | null>(null);
  const [silinecekKesinti, setSilinecekKesinti] = useState<string | null>(null);
  const [sahalar, setSahalar] = useState<Array<{id: string, ad: string}>>([]);
  const [duzenlenecekKesinti, setDuzenlenecekKesinti] = useState<ElektrikKesinti | null>(null);

  const [istatistikler, setIstatistikler] = useState({
    toplamKesinti: 0,
    devamEden: 0,
    tamamlanan: 0,
    toplamSure: 0
  });

  const canAdd = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);
  const canDelete = kullanici?.rol === 'yonetici' || 
    (kullanici?.rol && ['tekniker', 'muhendis'].includes(kullanici.rol));

  useEffect(() => {
    const sahalariGetir = async () => {
      if (!kullanici) return;

      try {
        let sahaQuery;
        if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          const userSahalar = Array.isArray(kullanici.sahalar) ? kullanici.sahalar : Object.keys(kullanici.sahalar);
          sahaQuery = query(
            collection(db, 'sahalar'),
            where('__name__', 'in', userSahalar)
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
    const kesintileriGetir = async () => {
      if (!kullanici?.companyId) return;

      // Sayfa görüldü olarak işaretle
      markPageAsSeen('elektrikKesintileri');

      try {
        setYukleniyor(true);

        let kesintilerQuery;
        if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          if (secilenSaha) {
            const userSahalar = Array.isArray(kullanici.sahalar) ? kullanici.sahalar : Object.keys(kullanici.sahalar);
            if (!userSahalar.includes(secilenSaha)) {
              setKesintiler([]);
              setYukleniyor(false);
              return;
            }
            kesintilerQuery = query(
              collection(db, 'elektrikKesintileri'),
              where('sahaId', '==', secilenSaha),
              where('companyId', '==', kullanici.companyId)
            );
          } else {
            const userSahalar = Array.isArray(kullanici.sahalar) ? kullanici.sahalar : Object.keys(kullanici.sahalar);
            kesintilerQuery = query(
              collection(db, 'elektrikKesintileri'),
              where('sahaId', 'in', userSahalar),
              where('companyId', '==', kullanici.companyId)
            );
          }
        } else if (secilenSaha) {
          kesintilerQuery = query(
            collection(db, 'elektrikKesintileri'),
            where('sahaId', '==', secilenSaha),
            where('companyId', '==', kullanici.companyId)
          );
        } else {
          kesintilerQuery = query(
            collection(db, 'elektrikKesintileri'),
            where('companyId', '==', kullanici.companyId),
            orderBy('baslangicTarihi', 'desc')
          );
        }

        const snapshot = await getDocs(kesintilerQuery);
        let kesintilerVerisi = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ElektrikKesinti[];

        const ayBaslangic = startOfMonth(parseISO(secilenAy + '-01'));
        const ayBitis = endOfMonth(parseISO(secilenAy + '-01'));

        // Tarih filtresi uygula
        kesintilerVerisi = kesintilerVerisi.filter(kesinti => {
          const kesinitiTarihi = kesinti.baslangicTarihi.toDate();
          return kesinitiTarihi >= ayBaslangic && kesinitiTarihi <= ayBitis;
        });
        
        setKesintiler(kesintilerVerisi);

        // İstatistikleri hesapla
        const stats = {
          toplamKesinti: kesintilerVerisi.length,
          devamEden: kesintilerVerisi.filter(k => k.durum === 'devam-ediyor').length,
          tamamlanan: kesintilerVerisi.filter(k => k.durum === 'tamamlandi').length,
          toplamSure: kesintilerVerisi.reduce((acc, k) => acc + k.sure, 0)
        };
        setIstatistikler(stats);

      } catch (error) {
        console.error('Kesintiler getirilemedi:', error);
        toast.error('Kesintiler yüklenirken bir hata oluştu');
      } finally {
        setYukleniyor(false);
      }
    };

    kesintileriGetir();
  }, [kullanici, secilenSaha, secilenAy]);

  const handleKesintiyiSil = async (id: string) => {
    if (!canDelete) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }

    try {
      setYukleniyor(true);
      await deleteDoc(doc(db, 'elektrikKesintileri', id));
      toast.success('Kesinti kaydı başarıyla silindi');
      setSilinecekKesinti(null);
      setKesintiler(prev => prev.filter(kesinti => kesinti.id !== id));
    } catch (error) {
      console.error('Kesinti silme hatası:', error);
      toast.error('Kesinti silinirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  const formatSure = (dakika: number): string => {
    const saat = Math.floor(dakika / 60);
    const kalanDakika = dakika % 60;
    
    if (saat === 0) {
      return `${kalanDakika} dakika`;
    } else if (kalanDakika === 0) {
      return `${saat} saat`;
    } else {
      return `${saat} saat ${kalanDakika} dakika`;
    }
  };

  const refreshData = () => {
    // Trigger data refresh by changing a dependency
    setYukleniyor(true);
  };

  if (yukleniyor) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
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
                Elektrik Kesintileri
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {secilenSaha ? sahalar.find(s => s.id === secilenSaha)?.ad || 'Seçili Saha' : 'Tüm Sahalar'} ({format(parseISO(secilenAy + '-01'), 'MMMM yyyy', { locale: tr })})
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {canAdd && (
                <button
                  onClick={() => setFormAcik(true)}
                  className="flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Plus size={18} className="mr-2" />
                  Yeni Kesinti Kaydı
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
                id="ayFiltre"
                type="month"
                value={secilenAy}
                onChange={(e) => setSecilenAy(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Görünüm</label>
              <div className="flex items-center justify-end space-x-1 bg-gray-100 p-0.5 rounded-lg">
                {[
                  { view: 'liste', icon: List, label: 'Liste' },
                  { view: 'kart', icon: LayoutGrid, label: 'Kart' },
                  { view: 'istatistikler', icon: BarChart3, label: 'İstatistik' },
                ].map((item) => (
                  <button
                    key={item.view}
                    onClick={() => setGorunumTipi(item.view as 'kart' | 'liste' | 'istatistikler')}
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
        </div>

        {/* Statistics */}
        {gorunumTipi !== 'istatistikler' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <StatCard
              title="Toplam Kesinti"
              value={istatistikler.toplamKesinti}
              icon={<Zap className="h-6 w-6" />}
              color="blue"
            />
            <StatCard
              title="Devam Eden"
              value={istatistikler.devamEden}
              icon={<AlertTriangle className="h-6 w-6" />}
              color="red"
            />
            <StatCard
              title="Tamamlanan"
              value={istatistikler.tamamlanan}
              icon={<CheckCircle className="h-6 w-6" />}
              color="green"
            />
            <StatCard
              title="Toplam Süre"
              value={formatSure(istatistikler.toplamSure)}
              icon={<Clock className="h-6 w-6" />}
              color="orange"
            />
          </div>
        )}

        {/* Content */}
        {kesintiler.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-lg border border-gray-200 shadow-sm">
            <Zap size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Kesinti Kaydı Bulunamadı</h3>
            <p className="text-sm text-gray-500">Seçili filtrelere uygun elektrik kesintisi kaydı bulunamadı.</p>
            {canAdd && (
              <button
                onClick={() => setFormAcik(true)}
                className="mt-6 flex items-center mx-auto px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus size={18} className="mr-2" />
                İlk Kesinti Kaydını Ekle
              </button>
            )}
          </div>
        ) : gorunumTipi === 'istatistikler' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">İstatistikler</h3>
            <div className="space-y-6">
              {/* Simple statistics view */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="text-md font-medium text-slate-700 mb-3">Durum Dağılımı</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Devam Eden</span>
                      <span className="text-sm font-medium text-red-600">{istatistikler.devamEden}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Tamamlanan</span>
                      <span className="text-sm font-medium text-green-600">{istatistikler.tamamlanan}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="text-md font-medium text-slate-700 mb-3">Süre Analizi</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Toplam Süre</span>
                      <span className="text-sm font-medium text-orange-600">{formatSure(istatistikler.toplamSure)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Ortalama Süre</span>
                      <span className="text-sm font-medium text-blue-600">
                        {istatistikler.toplamKesinti > 0 ? formatSure(Math.round(istatistikler.toplamSure / istatistikler.toplamKesinti)) : '0 dakika'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Placeholder for chart */}
              <div className="bg-slate-50 rounded-lg p-8 text-center">
                <BarChart3 className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">Grafik görünümü yakında eklenecek</p>
              </div>
            </div>
          </div>
        ) : gorunumTipi === 'liste' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <ElektrikKesintisiListesi
              kesintiler={kesintiler}
              sahalar={sahalar}
              onKesintiyeTikla={(kesinti) => setSeciliKesinti(kesinti)}
              onKesintiyiSil={canDelete ? (id) => setSilinecekKesinti(id) : undefined}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {kesintiler.map((kesinti) => (
              <div
                key={kesinti.id}
                onClick={() => setSeciliKesinti(kesinti)}
                className="cursor-pointer bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 relative group p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <Building className="h-5 w-5 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">
                      {sahalar.find(s => s.id === kesinti.sahaId)?.ad}
                    </h3>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    kesinti.durum === 'devam-ediyor'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {kesinti.durum === 'devam-ediyor' ? (
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    ) : (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    )}
                    {kesinti.durum === 'devam-ediyor' ? 'Devam Ediyor' : 'Tamamlandı'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center text-sm text-slate-600">
                    <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                    {format(kesinti.baslangicTarihi.toDate(), 'dd MMMM yyyy HH:mm', { locale: tr })}
                  </div>

                  {kesinti.etkiAlani && (
                    <div className="text-sm text-slate-600">
                      <span className="font-medium text-blue-600">Etkilenen Alan:</span> {kesinti.etkiAlani}
                    </div>
                  )}

                  <div className="flex items-center text-sm text-slate-600">
                    <Clock className="h-4 w-4 mr-2 text-orange-500" />
                    <span className="font-medium text-blue-600">Süre:</span> {formatSure(kesinti.sure)}
                  </div>

                  <p className="text-sm text-slate-600 line-clamp-2 bg-slate-50 p-3 rounded-lg">
                    {kesinti.aciklama}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="absolute top-3 right-3 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {canAdd && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDuzenlenecekKesinti(kesinti);
                        setFormAcik(true);
                      }}
                      className="p-2 bg-white rounded-full shadow-lg hover:bg-blue-50 transition-colors duration-200"
                      title="Düzenle"
                    >
                      <Edit3 className="h-4 w-4 text-blue-600" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSilinecekKesinti(kesinti.id);
                      }}
                      className="p-2 bg-white rounded-full shadow-lg hover:bg-red-50 transition-colors duration-200"
                      title="Sil"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modals */}
        {formAcik && (
          <ElektrikKesintisiForm
            onClose={() => {
              setFormAcik(false);
              setDuzenlenecekKesinti(null);
            }}
            sahalar={sahalar}
            kesintiToEdit={duzenlenecekKesinti}
            mode={duzenlenecekKesinti ? 'edit' : 'add'}
            onSuccess={refreshData}
          />
        )}

        {seciliKesinti && (
          <ElektrikKesintisiDetay
            kesinti={seciliKesinti}
            sahaAdi={sahalar.find(s => s.id === seciliKesinti.sahaId)?.ad || 'Bilinmeyen Saha'}
            onClose={() => setSeciliKesinti(null)}
          />
        )}

        {silinecekKesinti && (
          <SilmeOnayModal
            onConfirm={() => handleKesintiyiSil(silinecekKesinti)}
            onCancel={() => setSilinecekKesinti(null)}
            mesaj="Bu kesinti kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
          />
        )}
      </div>
    </div>
  );
};
