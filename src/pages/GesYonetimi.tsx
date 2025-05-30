import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Sun, 
  Plus, 
  Search, 
  Trash2, 
  Eye, 
  MapPin, 
  Calendar, 
  Zap, 
  TrendingUp, 
  Battery,
  Power,
  Activity,
  BarChart3,
  Settings,
  AlertCircle,
  CheckCircle,
  Filter,
  Grid,
  List,
  RefreshCw
} from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface Santral {
  id: string;
  ad: string;
  konum: {
    il: string;
    ilce: string;
    adres: string;
  };
  kapasite: number;
  yillikHedefUretim: number;
  kurulumTarihi: any;
  modulTipi: string;
  invertorTipi: string;
  durum: 'aktif' | 'bakim' | 'devre_disi';
  companyId: string;
  olusturmaTarihi: any;
  olusturanKisi: {
    id: string;
    ad: string;
  };
}

interface SantralStats {
  toplamKapasite: number;
  aktifSantralSayisi: number;
  toplamHedefUretim: number;
  ortalamaSantralYasi: number;
}

export const GesYonetimi: React.FC = () => {
  const { kullanici } = useAuth();
  const [santraller, setSantraller] = useState<Santral[]>([]);
  const [filtreliSantraller, setFiltreliSantraller] = useState<Santral[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [aramaMetni, setAramaMetni] = useState('');
  const [durumFiltresi, setDurumFiltresi] = useState<string>('');
  const [goruntulemeModu, setGoruntulemeModu] = useState<'grid' | 'list'>('grid');
  const [silmeOnayModalAcik, setSilmeOnayModalAcik] = useState(false);
  const [silinecekSantralId, setSilinecekSantralId] = useState<string | null>(null);
  const [istatistikler, setIstatistikler] = useState<SantralStats>({
    toplamKapasite: 0,
    aktifSantralSayisi: 0,
    toplamHedefUretim: 0,
    ortalamaSantralYasi: 0
  });

  const navigate = useNavigate();

  const canAdd = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);
  const canDelete = kullanici?.rol === 'yonetici';

  useEffect(() => {
    santralleriGetir();
  }, [kullanici]);

  useEffect(() => {
    let filtered = santraller;

    // Arama filtresi
    if (aramaMetni) {
      filtered = filtered.filter(santral =>
        santral.ad.toLowerCase().includes(aramaMetni.toLowerCase()) ||
        santral.konum.il.toLowerCase().includes(aramaMetni.toLowerCase()) ||
        santral.konum.ilce.toLowerCase().includes(aramaMetni.toLowerCase())
      );
    }

    // Durum filtresi
    if (durumFiltresi) {
      filtered = filtered.filter(santral => santral.durum === durumFiltresi);
    }

    setFiltreliSantraller(filtered);
  }, [santraller, aramaMetni, durumFiltresi]);

  const santralleriGetir = async () => {
    if (!kullanici?.companyId) return;

    try {
      setYukleniyor(true);

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
      hesaplaIstatistikler(santralListesi);
    } catch (error) {
      console.error('Santraller getirilemedi:', error);
      toast.error('Santraller yüklenirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  const hesaplaIstatistikler = (santralListesi: Santral[]) => {
    const toplamKapasite = santralListesi.reduce((acc, santral) => acc + santral.kapasite, 0);
    const aktifSantralSayisi = santralListesi.filter(santral => santral.durum === 'aktif').length;
    const toplamHedefUretim = santralListesi.reduce((acc, santral) => acc + santral.yillikHedefUretim, 0);

    const ortalamaSantralYasi = santralListesi.length > 0 
      ? santralListesi.reduce((acc, santral) => {
          const kurulumTarihi = santral.kurulumTarihi?.toDate();
          if (kurulumTarihi) {
            const yas = new Date().getFullYear() - kurulumTarihi.getFullYear();
            return acc + yas;
          }
          return acc;
        }, 0) / santralListesi.length
      : 0;

    setIstatistikler({
      toplamKapasite,
      aktifSantralSayisi,
      toplamHedefUretim,
      ortalamaSantralYasi
    });
  };

  const handleSantralSil = async (id: string) => {
    if (!canDelete) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }

    try {
      await deleteDoc(doc(db, 'santraller', id));
      toast.success('Santral başarıyla silindi');
      setSantraller(prev => prev.filter(santral => santral.id !== id));
      setSilmeOnayModalAcik(false);
      setSilinecekSantralId(null);
    } catch (error) {
      console.error('Santral silme hatası:', error);
      toast.error('Santral silinirken bir hata oluştu');
    }
  };

  const handleYenile = async () => {
    setYenileniyor(true);
    await santralleriGetir();
    setYenileniyor(false);
    toast.success('Veriler yenilendi');
  };

  const getDurumRengi = (durum: string) => {
    switch (durum) {
      case 'aktif':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'bakim':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'devre_disi':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDurumIkonu = (durum: string) => {
    switch (durum) {
      case 'aktif':
        return <CheckCircle className="h-4 w-4" />;
      case 'bakim':
        return <Settings className="h-4 w-4" />;
      case 'devre_disi':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const formatKapasite = (kapasite: number) => {
    if (kapasite >= 1000) {
      return `${(kapasite / 1000).toFixed(1)} MW`;
    }
    return `${kapasite} kW`;
  };

  if (yukleniyor) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Üst Başlık ve İstatistikler */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl shadow-sm border border-blue-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Sun className="h-7 w-7 mr-2 text-yellow-500" />
              Santral Yönetimi
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Güneş enerji santrallarınızı yönetin ve performanslarını izleyin
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <Zap className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Toplam Kapasite</p>
                  <p className="text-lg font-semibold">{formatKapasite(istatistikler.toplamKapasite)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg mr-3">
                  <Activity className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Aktif Santral</p>
                  <p className="text-lg font-semibold">{istatistikler.aktifSantralSayisi}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg mr-3">
                  <TrendingUp className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Yıllık Hedef</p>
                  <p className="text-lg font-semibold">{(istatistikler.toplamHedefUretim / 1000000).toFixed(1)}M kWh</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg mr-3">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ort. Yaş</p>
                  <p className="text-lg font-semibold">{istatistikler.ortalamaSantralYasi.toFixed(1)} yıl</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtreler ve Kontroller */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Santral ara..."
                value={aramaMetni}
                onChange={(e) => setAramaMetni(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={durumFiltresi}
              onChange={(e) => setDurumFiltresi(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Tüm Durumlar</option>
              <option value="aktif">Aktif</option>
              <option value="bakim">Bakımda</option>
              <option value="devre_disi">Devre Dışı</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setGoruntulemeModu('grid')}
                className={`p-2 rounded-md transition-colors ${
                  goruntulemeModu === 'grid' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setGoruntulemeModu('list')}
                className={`p-2 rounded-md transition-colors ${
                  goruntulemeModu === 'list' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={handleYenile}
              disabled={yenileniyor}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${yenileniyor ? 'animate-spin' : ''}`} />
              Yenile
            </button>

            {canAdd && (
              <button
                onClick={() => navigate('/ges-yonetimi/ekle')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Yeni Santral
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Santral Listesi */}
      {filtreliSantraller.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-12">
          <div className="text-center">
            <Sun className="mx-auto h-16 w-16 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {santraller.length === 0 ? 'Henüz santral bulunmuyor' : 'Arama kriterlerine uygun santral bulunamadı'}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {santraller.length === 0 
                ? 'İlk santralınızı ekleyerek başlayın.' 
                : 'Farklı arama kriterleri deneyin.'}
            </p>
            {canAdd && santraller.length === 0 && (
              <button
                onClick={() => navigate('/ges-yonetimi/ekle')}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                İlk Santralı Ekle
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={goruntulemeModu === 'grid' 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
          : "space-y-4"
        }>
          {filtreliSantraller.map((santral) => (
            <div
              key={santral.id}
              className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200"
            >
              {goruntulemeModu === 'grid' ? (
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="p-3 bg-blue-100 rounded-lg mr-3">
                        <Sun className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{santral.ad}</h3>
                        <p className="text-sm text-gray-500 flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          {santral.konum.il}, {santral.konum.ilce}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getDurumRengi(santral.durum)}`}>
                      {getDurumIkonu(santral.durum)}
                      <span className="ml-1">
                        {santral.durum === 'aktif' ? 'Aktif' : 
                         santral.durum === 'bakim' ? 'Bakımda' : 'Devre Dışı'}
                      </span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Kapasite</p>
                      <p className="text-sm font-semibold flex items-center">
                        <Battery className="h-4 w-4 mr-1 text-green-500" />
                        {formatKapasite(santral.kapasite)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Yıllık Hedef</p>
                      <p className="text-sm font-semibold flex items-center">
                        <BarChart3 className="h-4 w-4 mr-1 text-blue-500" />
                        {(santral.yillikHedefUretim / 1000).toLocaleString('tr-TR')}k kWh
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs text-gray-500">Kurulum Tarihi</p>
                    <p className="text-sm font-medium flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-purple-500" />
                      {santral.kurulumTarihi ? 
                        format(santral.kurulumTarihi.toDate(), 'dd MMMM yyyy', { locale: tr }) : 
                        'Belirtilmemiş'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <button
                      onClick={() => window.location.href = `/ges-yonetimi/${santral.id}`}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Eye className="h-4 w-4 mr-1.5" />
                      Görüntüle
                    </button>

                    {canDelete && (
                      <button
                        onClick={() => {
                          setSilinecekSantralId(santral.id);
                          setSilmeOnayModalAcik(true);
                        }}
                        className="inline-flex items-center px-3 py-1.5 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Sil
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-lg mr-3">
                        <Sun className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{santral.ad}</h3>
                        <p className="text-sm text-gray-500">{santral.konum.il}, {santral.konum.ilce}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatKapasite(santral.kapasite)}</p>
                        <p className="text-xs text-gray-500">Kapasite</p>
                      </div>

                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getDurumRengi(santral.durum)}`}>
                        {getDurumIkonu(santral.durum)}
                        <span className="ml-1">
                          {santral.durum === 'aktif' ? 'Aktif' : 
                           santral.durum === 'bakim' ? 'Bakımda' : 'Devre Dışı'}
                        </span>
                      </span>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => navigate(`/ges-yonetimi/${santral.id}`)}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <Eye className="h-4 w-4 mr-1.5" />
                          Görüntüle
                        </button>

                        {canDelete && (
                          <button
                            onClick={() => {
                              setSilinecekSantralId(santral.id);
                              setSilmeOnayModalAcik(true);
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Silme Onay Modalı */}
      {silmeOnayModalAcik && (
        <SilmeOnayModal
          onConfirm={() => silinecekSantralId && handleSantralSil(silinecekSantralId)}
          onCancel={() => {
            setSilmeOnayModalAcik(false);
            setSilinecekSantralId(null);
          }}
          mesaj="Bu santralı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve santrale ait tüm veriler silinecektir."
        />
      )}
    </div>
  );
};

export default GesYonetimi;