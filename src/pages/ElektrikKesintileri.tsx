
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, Timestamp } from 'firebase/firestore';
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
  Zap,
  Trash2,
  Clock,
  Filter
} from 'lucide-react';
import { Card, Title, Text, Metric, Grid, Col, Badge } from '@tremor/react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ElektrikKesintisiForm } from '../components/ElektrikKesintisiForm';
import { ElektrikKesintisiDetay } from '../components/ElektrikKesintisiDetay';
import { ElektrikKesintisiListesi } from '../components/ElektrikKesintisiListesi';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import type { ElektrikKesinti } from '../types';
import toast from 'react-hot-toast';

export const ElektrikKesintileri: React.FC = () => {
  const { kullanici } = useAuth();
  const [kesintiler, setKesintiler] = useState<ElektrikKesinti[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [secilenSaha, setSecilenSaha] = useState<string>('');
  const [secilenAy, setSecilenAy] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [gorunumTipi, setGorunumTipi] = useState<'kart' | 'liste'>('kart');
  const [seciliKesinti, setSeciliKesinti] = useState<ElektrikKesinti | null>(null);
  const [silinecekKesinti, setSilinecekKesinti] = useState<string | null>(null);
  const [sahalar, setSahalar] = useState<Array<{id: string, ad: string}>>([]);

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
    const kesintileriGetir = async () => {
      if (!kullanici?.companyId) return;

      try {
        setYukleniyor(true);

        let kesintilerQuery;
        if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          if (secilenSaha) {
            if (!kullanici.sahalar.includes(secilenSaha)) {
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
            kesintilerQuery = query(
              collection(db, 'elektrikKesintileri'),
              where('sahaId', 'in', kullanici.sahalar),
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

  if (yukleniyor) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                Elektrik Kesintileri
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Toplam {kesintiler.length} kesinti kaydı
              </p>
            </div>
          </div>
          {canAdd && (
            <button
              onClick={() => setFormAcik(true)}
              className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 hover:scale-105 hover:shadow-xl"
            >
              <Plus className="h-5 w-5 mr-2" />
              Yeni Kesinti Kaydı
            </button>
          )}
        </div>
      </div>

      {/* İstatistikler */}
      <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-6">
        <Card className="bg-white border border-blue-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-gray-600 font-medium">Toplam Kesinti</Text>
              <Metric className="text-blue-600 font-bold">{istatistikler.toplamKesinti}</Metric>
            </div>
            <div className="p-4 bg-blue-100 rounded-xl">
              <Zap className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </Card>
        
        <Card className="bg-white border border-red-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-gray-600 font-medium">Devam Eden</Text>
              <Metric className="text-red-600 font-bold">{istatistikler.devamEden}</Metric>
            </div>
            <div className="p-4 bg-red-100 rounded-xl">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </Card>
        
        <Card className="bg-white border border-green-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-gray-600 font-medium">Tamamlanan</Text>
              <Metric className="text-green-600 font-bold">{istatistikler.tamamlanan}</Metric>
            </div>
            <div className="p-4 bg-green-100 rounded-xl">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </Card>
        
        <Card className="bg-white border border-orange-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-gray-600 font-medium">Toplam Süre</Text>
              <Metric className="text-orange-600 font-bold">{formatSure(istatistikler.toplamSure)}</Metric>
            </div>
            <div className="p-4 bg-orange-100 rounded-xl">
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </Card>
      </Grid>

      {/* Filtreler */}
      <Card className="bg-white border border-blue-100 shadow-lg rounded-xl">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="h-5 w-5 text-blue-600" />
          <Text className="font-semibold text-gray-800">Filtreler</Text>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Saha</label>
            <select
              value={secilenSaha}
              onChange={(e) => setSecilenSaha(e.target.value)}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
            >
              <option value="">Tüm Sahalar</option>
              {sahalar.map(saha => (
                <option key={saha.id} value={saha.id}>{saha.ad}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ay</label>
            <input
              type="month"
              value={secilenAy}
              onChange={(e) => setSecilenAy(e.target.value)}
              className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Görünüm</label>
            <div className="flex rounded-lg shadow-sm border border-gray-300">
              <button
                onClick={() => setGorunumTipi('kart')}
                className={`p-3 text-sm font-medium rounded-l-lg transition-all duration-200 ${
                  gorunumTipi === 'kart'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-blue-50'
                }`}
                title="Kart Görünümü"
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setGorunumTipi('liste')}
                className={`p-3 text-sm font-medium rounded-r-lg border-l transition-all duration-200 ${
                  gorunumTipi === 'liste'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-blue-50'
                }`}
                title="Liste Görünümü"
              >
                <List className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Kesinti Listesi */}
      {kesintiler.length === 0 ? (
        <Card className="bg-white border border-blue-100 shadow-lg rounded-xl">
          <div className="text-center py-16">
            <div className="p-6 bg-blue-100 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <Zap className="h-12 w-12 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Henüz kesinti kaydı yok</h3>
            <p className="text-gray-500 mb-8">
              Seçili dönem için elektrik kesintisi kaydı bulunamadı.
            </p>
            {canAdd && (
              <button
                onClick={() => setFormAcik(true)}
                className="inline-flex items-center px-6 py-3 border border-transparent shadow-lg text-sm font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all duration-200 hover:scale-105"
              >
                <Plus className="h-5 w-5 mr-2" />
                Kesinti Kaydı Ekle
              </button>
            )}
          </div>
        </Card>
      ) : gorunumTipi === 'liste' ? (
        <Card className="bg-white border border-blue-100 shadow-lg rounded-xl">
          <ElektrikKesintisiListesi
            kesintiler={kesintiler}
            sahalar={sahalar}
            onKesintiyeTikla={(kesinti) => setSeciliKesinti(kesinti)}
            onKesintiyiSil={canDelete ? (id) => setSilinecekKesinti(id) : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {kesintiler.map((kesinti) => (
            <Card
              key={kesinti.id}
              onClick={() => setSeciliKesinti(kesinti)}
              className="cursor-pointer bg-white border border-blue-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 relative rounded-xl group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg mr-3">
                    <Building className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {sahalar.find(s => s.id === kesinti.sahaId)?.ad}
                  </h3>
                </div>
                <Badge 
                  color={kesinti.durum === 'devam-ediyor' ? 'red' : 'green'}
                  icon={kesinti.durum === 'devam-ediyor' ? AlertTriangle : CheckCircle}
                  className="font-medium"
                >
                  {kesinti.durum === 'devam-ediyor' ? 'Devam Ediyor' : 'Tamamlandı'}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                  {format(kesinti.baslangicTarihi.toDate(), 'dd MMMM yyyy HH:mm', { locale: tr })}
                </div>

                {kesinti.etkiAlani && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium text-blue-600">Etkilenen Alan:</span> {kesinti.etkiAlani}
                  </div>
                )}

                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="h-4 w-4 mr-2 text-orange-500" />
                  <span className="font-medium text-blue-600">Süre:</span> {formatSure(kesinti.sure)}
                </div>

                <p className="text-sm text-gray-600 line-clamp-2 bg-gray-50 p-3 rounded-lg">
                  {kesinti.aciklama}
                </p>
              </div>

              {/* Silme Butonu */}
              {canDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSilinecekKesinti(kesinti.id);
                  }}
                  className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-lg hover:bg-red-50 transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modaller */}
      {formAcik && (
        <ElektrikKesintisiForm
          onClose={() => setFormAcik(false)}
          sahalar={sahalar}
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
  );
};
