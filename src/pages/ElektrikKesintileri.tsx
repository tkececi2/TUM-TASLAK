
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
  Clock
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Elektrik Kesintileri</h1>
          <p className="mt-1 text-sm text-gray-500">
            Toplam {kesintiler.length} kesinti kaydı
          </p>
        </div>
        {canAdd && (
          <button
            onClick={() => setFormAcik(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            Yeni Kesinti Kaydı
          </button>
        )}
      </div>

      {/* İstatistikler */}
      <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <Text>Toplam Kesinti</Text>
              <Metric>{istatistikler.toplamKesinti}</Metric>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Zap className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <Text>Devam Eden</Text>
              <Metric>{istatistikler.devamEden}</Metric>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <Text>Tamamlanan</Text>
              <Metric>{istatistikler.tamamlanan}</Metric>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <Text>Toplam Süre</Text>
              <Metric>{formatSure(istatistikler.toplamSure)}</Metric>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </Card>
      </Grid>

      {/* Filtreler */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Saha</label>
            <select
              value={secilenSaha}
              onChange={(e) => setSecilenSaha(e.target.value)}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
            >
              <option value="">Tüm Sahalar</option>
              {sahalar.map(saha => (
                <option key={saha.id} value={saha.id}>{saha.ad}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ay</label>
            <input
              type="month"
              value={secilenAy}
              onChange={(e) => setSecilenAy(e.target.value)}
              className="rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Görünüm</label>
            <div className="flex rounded-lg shadow-sm">
              <button
                onClick={() => setGorunumTipi('kart')}
                className={`p-2 text-sm font-medium rounded-l-lg border ${
                  gorunumTipi === 'kart'
                    ? 'bg-yellow-50 text-yellow-700 border-yellow-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title="Kart Görünümü"
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setGorunumTipi('liste')}
                className={`p-2 text-sm font-medium rounded-r-lg border-t border-b border-r ${
                  gorunumTipi === 'liste'
                    ? 'bg-yellow-50 text-yellow-700 border-yellow-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
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
        <Card>
          <div className="text-center py-12">
            <Zap className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Henüz kesinti kaydı yok</h3>
            <p className="mt-1 text-sm text-gray-500">
              Seçili dönem için elektrik kesintisi kaydı bulunamadı.
            </p>
            {canAdd && (
              <div className="mt-6">
                <button
                  onClick={() => setFormAcik(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Kesinti Kaydı Ekle
                </button>
              </div>
            )}
          </div>
        </Card>
      ) : gorunumTipi === 'liste' ? (
        <Card>
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
              className="cursor-pointer hover:shadow-lg transition-shadow duration-200 relative"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                  <Building className="h-5 w-5 text-gray-400 mr-2" />
                  <h3 className="text-lg font-medium text-gray-900">
                    {sahalar.find(s => s.id === kesinti.sahaId)?.ad}
                  </h3>
                </div>
                <Badge 
                  color={kesinti.durum === 'devam-ediyor' ? 'red' : 'green'}
                  icon={kesinti.durum === 'devam-ediyor' ? AlertTriangle : CheckCircle}
                >
                  {kesinti.durum === 'devam-ediyor' ? 'Devam Ediyor' : 'Tamamlandı'}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  {format(kesinti.baslangicTarihi.toDate(), 'dd MMMM yyyy HH:mm', { locale: tr })}
                </div>

                {kesinti.etkiAlani && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Etkilenen Alan:</span> {kesinti.etkiAlani}
                  </div>
                )}

                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="h-4 w-4 mr-2" />
                  <span className="font-medium">Süre:</span> {formatSure(kesinti.sure)}
                </div>

                <p className="text-sm text-gray-600 line-clamp-2">{kesinti.aciklama}</p>
              </div>

              {/* Silme Butonu */}
              {canDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSilinecekKesinti(kesinti.id);
                  }}
                  className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-lg hover:bg-red-50 transition-colors duration-200"
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
