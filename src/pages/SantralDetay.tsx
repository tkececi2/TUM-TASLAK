
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Edit, 
  Sun, 
  MapPin, 
  Calendar, 
  Zap, 
  Battery,
  Settings,
  BarChart3,
  TrendingUp,
  Activity
} from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

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
  panelSayisi?: number;
  invertorSayisi?: number;
  aylikHedefler?: Record<string, number>;
  companyId: string;
  olusturmaTarihi: any;
  olusturanKisi: {
    id: string;
    ad: string;
  };
}

export const SantralDetay: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { kullanici } = useAuth();
  const navigate = useNavigate();
  const [santral, setSantral] = useState<Santral | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const canEdit = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);

  useEffect(() => {
    if (!id) {
      navigate('/ges-yonetimi');
      return;
    }

    const santralGetir = async () => {
      try {
        setYukleniyor(true);
        const santralDoc = await getDoc(doc(db, 'santraller', id));
        
        if (!santralDoc.exists()) {
          toast.error('Santral bulunamadı');
          navigate('/ges-yonetimi');
          return;
        }

        const santralData = {
          id: santralDoc.id,
          ...santralDoc.data()
        } as Santral;

        setSantral(santralData);
      } catch (error) {
        console.error('Santral getirme hatası:', error);
        toast.error('Santral bilgileri yüklenirken bir hata oluştu');
        navigate('/ges-yonetimi');
      } finally {
        setYukleniyor(false);
      }
    };

    santralGetir();
  }, [id, navigate]);

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

  if (!santral) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Santral bulunamadı</h3>
        <button
          onClick={() => navigate('/ges-yonetimi')}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri Dön
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Üst Başlık */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/ges-yonetimi')}
              className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg mr-4">
                <Sun className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{santral.ad}</h1>
                <p className="text-sm text-gray-600 flex items-center mt-1">
                  <MapPin className="h-4 w-4 mr-1" />
                  {santral.konum.il}, {santral.konum.ilce}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${getDurumRengi(santral.durum)}`}>
              {santral.durum === 'aktif' ? 'Aktif' : 
               santral.durum === 'bakim' ? 'Bakımda' : 'Devre Dışı'}
            </span>

            {canEdit && (
              <button
                onClick={() => navigate(`/ges-yonetimi/${santral.id}/duzenle`)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Edit className="h-4 w-4 mr-2" />
                Düzenle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Santral Bilgileri Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Temel Bilgiler */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Zap className="h-5 w-5 mr-2 text-yellow-600" />
            Temel Bilgiler
          </h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Kurulu Güç</p>
              <p className="text-lg font-semibold text-gray-900">{formatKapasite(santral.kapasite)}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Kurulum Tarihi</p>
              <p className="text-lg font-semibold text-gray-900">
                {santral.kurulumTarihi ? 
                  format(santral.kurulumTarihi.toDate(), 'dd MMMM yyyy', { locale: tr }) : 
                  'Belirtilmemiş'}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Yıllık Hedef Üretim</p>
              <p className="text-lg font-semibold text-gray-900">
                {(santral.yillikHedefUretim / 1000).toLocaleString('tr-TR')}k kWh
              </p>
            </div>
          </div>
        </div>

        {/* Konum Bilgileri */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <MapPin className="h-5 w-5 mr-2 text-green-600" />
            Konum Bilgileri
          </h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">İl / İlçe</p>
              <p className="text-lg font-semibold text-gray-900">{santral.konum.il} / {santral.konum.ilce}</p>
            </div>
            
            {santral.konum.adres && (
              <div>
                <p className="text-sm text-gray-500">Adres</p>
                <p className="text-sm text-gray-900">{santral.konum.adres}</p>
              </div>
            )}
          </div>
        </div>

        {/* Teknik Bilgiler */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Settings className="h-5 w-5 mr-2 text-purple-600" />
            Teknik Bilgiler
          </h3>
          
          <div className="space-y-4">
            {santral.panelSayisi && (
              <div>
                <p className="text-sm text-gray-500">Panel Sayısı</p>
                <p className="text-lg font-semibold text-gray-900">{santral.panelSayisi.toLocaleString('tr-TR')}</p>
              </div>
            )}
            
            {santral.invertorSayisi && (
              <div>
                <p className="text-sm text-gray-500">İnvertör Sayısı</p>
                <p className="text-lg font-semibold text-gray-900">{santral.invertorSayisi}</p>
              </div>
            )}

            {santral.modulTipi && (
              <div>
                <p className="text-sm text-gray-500">Panel Tipi</p>
                <p className="text-sm text-gray-900">{santral.modulTipi}</p>
              </div>
            )}

            {santral.invertorTipi && (
              <div>
                <p className="text-sm text-gray-500">İnvertör Tipi</p>
                <p className="text-sm text-gray-900">{santral.invertorTipi}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hızlı Erişim Butonları */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Hızlı Erişim</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/uretim-verileri')}
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="p-2 bg-yellow-100 rounded-lg mr-3">
              <BarChart3 className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Üretim Verileri</p>
              <p className="text-sm text-gray-500">Günlük üretim takibi</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/performans')}
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="p-2 bg-blue-100 rounded-lg mr-3">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Performans</p>
              <p className="text-sm text-gray-500">Verimlilik analizi</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/arizalar')}
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="p-2 bg-red-100 rounded-lg mr-3">
              <Activity className="h-5 w-5 text-red-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Arızalar</p>
              <p className="text-sm text-gray-500">Arıza takibi</p>
            </div>
          </button>
        </div>
      </div>

      {/* Sistem Bilgileri */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sistem Bilgileri</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-500">Oluşturan Kişi</p>
            <p className="text-sm text-gray-900">{santral.olusturanKisi?.ad || 'Belirtilmemiş'}</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-500">Oluşturulma Tarihi</p>
            <p className="text-sm text-gray-900">
              {santral.olusturmaTarihi ? 
                format(santral.olusturmaTarihi.toDate(), 'dd MMMM yyyy HH:mm', { locale: tr }) : 
                'Belirtilmemiş'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SantralDetay;
