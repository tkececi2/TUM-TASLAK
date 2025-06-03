
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
  Filter,
  TrendingUp,
  Activity,
  Search
} from 'lucide-react';
import { Card, Title, Text, Metric, Flex, ProgressBar, Grid, Col, Badge } from '@tremor/react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { InvertorKontrolForm } from '../components/InvertorKontrolForm';
import { InvertorKontrolDetay } from '../components/InvertorKontrolDetay';
import { InvertorKontrolListesi } from '../components/InvertorKontrolListesi';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import type { InvertorKontrol } from '../types';
import toast from 'react-hot-toast';

export const InvertorKontrol: React.FC = () => {
  const { kullanici } = useAuth();
  const [kontroller, setKontroller] = useState<InvertorKontrol[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [secilenSaha, setSecilenSaha] = useState<string>('');
  const [secilenAy, setSecilenAy] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [gorunumTipi, setGorunumTipi] = useState<'kart' | 'liste'>('kart');
  const [seciliKontrol, setSeciliKontrol] = useState<InvertorKontrol | null>(null);
  const [silinecekKontrol, setSilinecekKontrol] = useState<string | null>(null);
  const [sahalar, setSahalar] = useState<Array<{id: string, ad: string}>>([]);
  const [aramaMetni, setAramaMetni] = useState('');

  const [istatistikler, setIstatistikler] = useState({
    toplamKontrol: 0,
    calisanDize: 0,
    arizaliDize: 0,
    kontrolOrani: 0
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
    const kontrolleriGetir = async () => {
      if (!kullanici?.companyId) return;

      try {
        setYukleniyor(true);

        let kontrolQuery;
        if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          if (secilenSaha) {
            if (!kullanici.sahalar.includes(secilenSaha)) {
              setKontroller([]);
              setYukleniyor(false);
              return;
            }
            kontrolQuery = query(
              collection(db, 'invertorKontroller'),
              where('sahaId', '==', secilenSaha),
              where('companyId', '==', kullanici.companyId)
            );
          } else {
            kontrolQuery = query(
              collection(db, 'invertorKontroller'),
              where('sahaId', 'in', kullanici.sahalar),
              where('companyId', '==', kullanici.companyId)
            );
          }
        } else if (secilenSaha) {
          kontrolQuery = query(
            collection(db, 'invertorKontroller'),
            where('sahaId', '==', secilenSaha),
            where('companyId', '==', kullanici.companyId)
          );
        } else {
          kontrolQuery = query(
            collection(db, 'invertorKontroller'),
            where('companyId', '==', kullanici.companyId),
            orderBy('tarih', 'desc')
          );
        }

        const snapshot = await getDocs(kontrolQuery);
        let kontrolVerileri = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as InvertorKontrol[];

        const ayBaslangic = startOfMonth(parseISO(secilenAy + '-01'));
        const ayBitis = endOfMonth(parseISO(secilenAy + '-01'));

        // Tarih filtresi uygula
        kontrolVerileri = kontrolVerileri.filter(kontrol => {
          const kontrolTarihi = kontrol.tarih.toDate();
          return kontrolTarihi >= ayBaslangic && kontrolTarihi <= ayBitis;
        });
        
        // Arama filtresi
        if (aramaMetni) {
          kontrolVerileri = kontrolVerileri.filter(kontrol => {
            const sahaAdi = sahalar.find(s => s.id === kontrol.sahaId)?.ad || '';
            return sahaAdi.toLowerCase().includes(aramaMetni.toLowerCase()) ||
                   kontrol.olusturanKisi.ad.toLowerCase().includes(aramaMetni.toLowerCase()) ||
                   kontrol.aciklama?.toLowerCase().includes(aramaMetni.toLowerCase());
          });
        }
        
        setKontroller(kontrolVerileri);

        // İstatistikleri hesapla
        const toplamDize = kontrolVerileri.reduce((acc, kontrol) => 
          acc + kontrol.invertorler.length, 0);
        
        const calisanDize = kontrolVerileri.reduce((acc, kontrol) => 
          acc + kontrol.invertorler.filter(inv => inv.dizeCalisiyor).length, 0);

        setIstatistikler({
          toplamKontrol: kontrolVerileri.length,
          calisanDize,
          arizaliDize: toplamDize - calisanDize,
          kontrolOrani: toplamDize > 0 ? (calisanDize / toplamDize) * 100 : 0
        });

      } catch (error) {
        console.error('Kontroller getirilemedi:', error);
        toast.error('Kontroller yüklenirken bir hata oluştu');
      } finally {
        setYukleniyor(false);
      }
    };

    kontrolleriGetir();
  }, [kullanici, secilenSaha, secilenAy, aramaMetni, sahalar]);

  const handleKontrolSil = async (id: string) => {
    if (!canDelete) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }

    try {
      setYukleniyor(true);
      await deleteDoc(doc(db, 'invertorKontroller', id));
      toast.success('Kontrol kaydı başarıyla silindi');
      setSilinecekKontrol(null);
      setKontroller(prev => prev.filter(kontrol => kontrol.id !== id));
    } catch (error) {
      console.error('Kontrol silme hatası:', error);
      toast.error('Kontrol silinirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">İnvertör Kontrolleri</h1>
              <p className="text-gray-600">
                Toplam {kontroller.length} kontrol kaydı görüntüleniyor
              </p>
            </div>
            {canAdd && (
              <button
                onClick={() => setFormAcik(true)}
                className="mt-4 sm:mt-0 inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
              >
                <Plus className="h-5 w-5 mr-2" />
                Yeni Kontrol Kaydı
              </button>
            )}
          </div>
        </div>

        {/* İstatistikler */}
        <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-6 mb-8">
          <Card decoration="left" decorationColor="blue">
            <Flex justifyContent="between" alignItems="center">
              <div>
                <Text>Toplam Kontrol</Text>
                <Metric className="text-blue-600">{istatistikler.toplamKontrol}</Metric>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-500" />
            </Flex>
          </Card>

          <Card decoration="left" decorationColor="green">
            <Flex justifyContent="between" alignItems="center">
              <div>
                <Text>Çalışan Dizeler</Text>
                <Metric className="text-green-600">{istatistikler.calisanDize}</Metric>
              </div>
              <Zap className="h-8 w-8 text-green-500" />
            </Flex>
          </Card>

          <Card decoration="left" decorationColor="red">
            <Flex justifyContent="between" alignItems="center">
              <div>
                <Text>Arızalı Dizeler</Text>
                <Metric className="text-red-600">{istatistikler.arizaliDize}</Metric>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </Flex>
          </Card>

          <Card decoration="left" decorationColor="yellow">
            <div>
              <Text>Çalışma Oranı</Text>
              <Metric className="text-yellow-600 mb-2">
                %{istatistikler.kontrolOrani.toFixed(1)}
              </Metric>
              <ProgressBar 
                value={istatistikler.kontrolOrani} 
                color="yellow"
                className="mt-2"
              />
            </div>
          </Card>
        </Grid>

        {/* Filtreler ve Arama */}
        <Card className="mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Arama */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Saha, kontrol eden kişi veya açıklama ara..."
                  value={aramaMetni}
                  onChange={(e) => setAramaMetni(e.target.value)}
                  className="pl-10 w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Saha Filtresi */}
            <div className="w-full lg:w-64">
              <select
                value={secilenSaha}
                onChange={(e) => setSecilenSaha(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Tüm Sahalar</option>
                {sahalar.map(saha => (
                  <option key={saha.id} value={saha.id}>{saha.ad}</option>
                ))}
              </select>
            </div>

            {/* Ay Filtresi */}
            <div className="w-full lg:w-48">
              <input
                type="month"
                value={secilenAy}
                onChange={(e) => setSecilenAy(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* Görünüm Değiştirici */}
            <div className="flex rounded-lg shadow-sm border border-gray-300 overflow-hidden">
              <button
                onClick={() => setGorunumTipi('kart')}
                className={`p-2 text-sm font-medium transition-colors ${
                  gorunumTipi === 'kart'
                    ? 'bg-blue-50 text-blue-700 border-blue-500'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <LayoutGrid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setGorunumTipi('liste')}
                className={`p-2 text-sm font-medium transition-colors border-l ${
                  gorunumTipi === 'liste'
                    ? 'bg-blue-50 text-blue-700 border-blue-500'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <List className="h-5 w-5" />
              </button>
            </div>
          </div>
        </Card>

        {/* Kontrol Listesi */}
        {kontroller.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Kontrol kaydı bulunamadı</h3>
              <p className="text-gray-500 mb-4">
                {aramaMetni || secilenSaha || secilenAy !== format(new Date(), 'yyyy-MM')
                  ? 'Arama kriterlerinize uygun kontrol kaydı bulunamadı.'
                  : 'Henüz hiç kontrol kaydı eklenmemiş.'}
              </p>
              {canAdd && (
                <button
                  onClick={() => setFormAcik(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  İlk Kontrol Kaydını Ekle
                </button>
              )}
            </div>
          </Card>
        ) : gorunumTipi === 'liste' ? (
          <Card>
            <InvertorKontrolListesi
              kontroller={kontroller}
              sahalar={sahalar}
              onKontrolTikla={(kontrol) => setSeciliKontrol(kontrol)}
              onKontrolSil={canDelete ? (id) => setSilinecekKontrol(id) : undefined}
            />
          </Card>
        ) : (
          <Grid numItems={1} numItemsSm={2} numItemsLg={3} className="gap-6">
            {kontroller.map((kontrol) => {
              const calisanDizeSayisi = kontrol.invertorler.filter(inv => inv.dizeCalisiyor).length;
              const toplamDizeSayisi = kontrol.invertorler.length;
              const calismaOrani = toplamDizeSayisi > 0 ? (calisanDizeSayisi / toplamDizeSayisi) * 100 : 0;

              return (
                <Card
                  key={kontrol.id}
                  className="cursor-pointer transition-all duration-200 hover:shadow-xl hover:scale-[1.02] relative"
                  onClick={() => setSeciliKontrol(kontrol)}
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-2">
                        <Building className="h-5 w-5 text-gray-400" />
                        <Title className="text-gray-900 truncate">
                          {sahalar.find(s => s.id === kontrol.sahaId)?.ad}
                        </Title>
                      </div>
                      <Badge
                        color={
                          calismaOrani >= 90 ? 'green' :
                          calismaOrani >= 70 ? 'yellow' : 'red'
                        }
                      >
                        %{calismaOrani.toFixed(1)} Çalışma
                      </Badge>
                    </div>

                    {/* Tarih ve Kontrol Eden */}
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="h-4 w-4 mr-2" />
                        {format(kontrol.tarih.toDate(), 'dd MMMM yyyy HH:mm', { locale: tr })}
                      </div>
                      <div className="text-sm text-gray-500">
                        <span className="font-medium">Kontrol Eden:</span> {kontrol.olusturanKisi.ad}
                      </div>
                    </div>

                    {/* İstatistikler */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">İnvertör Sayısı:</span>
                        <span className="font-medium">{kontrol.invertorler.length} adet</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Çalışan Dizeler:</span>
                        <span className="font-medium text-green-600">
                          {calisanDizeSayisi} / {toplamDizeSayisi}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <ProgressBar
                      value={calismaOrani}
                      color={
                        calismaOrani >= 90 ? 'green' :
                        calismaOrani >= 70 ? 'yellow' : 'red'
                      }
                      className="mt-3"
                    />

                    {/* Açıklama */}
                    {kontrol.aciklama && (
                      <Text className="text-gray-600 line-clamp-2">
                        {kontrol.aciklama}
                      </Text>
                    )}

                    {/* Silme Butonu */}
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSilinecekKontrol(kontrol.id);
                        }}
                        className="absolute top-3 right-3 p-1.5 bg-white rounded-full shadow-lg hover:bg-red-50 transition-colors duration-200 border border-gray-200"
                      >
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </Grid>
        )}

        {/* Modaller */}
        {formAcik && (
          <InvertorKontrolForm
            onClose={() => setFormAcik(false)}
            sahalar={sahalar}
          />
        )}

        {seciliKontrol && (
          <InvertorKontrolDetay
            kontrol={seciliKontrol}
            sahaAdi={sahalar.find(s => s.id === seciliKontrol.sahaId)?.ad || 'Bilinmeyen Saha'}
            onClose={() => setSeciliKontrol(null)}
          />
        )}

        {silinecekKontrol && (
          <SilmeOnayModal
            onConfirm={() => handleKontrolSil(silinecekKontrol)}
            onCancel={() => setSilinecekKontrol(null)}
            mesaj="Bu kontrol kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
          />
        )}
      </div>
    </div>
  );
};
