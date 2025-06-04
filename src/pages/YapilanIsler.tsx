
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { YapilanIsForm } from '../components/YapilanIsForm';
import { IsRaporDetayModal } from '../components/IsRaporDetayModal';
import { SearchInput } from '../components/SearchInput';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Building, 
  Calendar, 
  Clock, 
  ImageIcon, 
  Plus, 
  Trash2, 
  User, 
  Wrench, 
  Tag, 
  FileText, 
  ChevronRight, 
  CheckCircle,
  Download,
  Filter,
  TrendingUp,
  Users,
  Activity
} from 'lucide-react';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import { Card, Text, Title, Metric, Flex, ProgressBar, Grid, Col, Badge, AreaChart } from '@tremor/react';
import toast from 'react-hot-toast';
import type { IsRaporu } from '../types';

export const YapilanIsler: React.FC = () => {
  const { kullanici } = useAuth();
  const [raporlar, setRaporlar] = useState<IsRaporu[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [aramaMetni, setAramaMetni] = useState('');
  const [seciliRapor, setSeciliRapor] = useState<IsRaporu | null>(null);
  const [sahalar, setSahalar] = useState<Array<{id: string, ad: string}>>([]);
  const [secilenAy, setSecilenAy] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [secilenSaha, setSecilenSaha] = useState<string>('');
  const [silinecekRapor, setSilinecekRapor] = useState<string | null>(null);
  const [grafikGorünümü, setGrafikGorünümü] = useState<'liste' | 'istatistik'>('liste');

  // Yıl seçeneklerini oluştur (son 5 yıl)
  const yilSecenekleri = Array.from({ length: 5 }, (_, i) => {
    const yil = new Date().getFullYear() - i;
    return format(new Date(yil, 0), 'yyyy');
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
        
        const snapshot = await getDocs(sahaQuery);
        const sahaListesi = snapshot.docs.map(doc => ({
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
    const raporlariGetir = async () => {
      if (!kullanici) return;

      try {
        setYukleniyor(true);

        let raporQuery;
        if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          if (secilenSaha) {
            if (!kullanici.sahalar.includes(secilenSaha)) {
              setRaporlar([]);
              setYukleniyor(false);
              return;
            }
            raporQuery = query(
              collection(db, 'isRaporlari'),
              where('saha', '==', secilenSaha),
              where('companyId', '==', kullanici.companyId),
              orderBy('tarih', 'desc')
            );
          } else {
            raporQuery = query(
              collection(db, 'isRaporlari'),
              where('saha', 'in', kullanici.sahalar),
              where('companyId', '==', kullanici.companyId),
              orderBy('tarih', 'desc')
            );
          }
        } else if (secilenSaha) {
          raporQuery = query(
            collection(db, 'isRaporlari'),
            where('saha', '==', secilenSaha),
            where('companyId', '==', kullanici.companyId),
            orderBy('tarih', 'desc')
          );
        } else {
          raporQuery = query(
            collection(db, 'isRaporlari'),
            where('companyId', '==', kullanici.companyId),
            orderBy('tarih', 'desc')
          );
        }

        const snapshot = await getDocs(raporQuery);
        const tumRaporlar = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as IsRaporu[];

        const ayBaslangic = startOfMonth(parseISO(secilenAy + '-01'));
        const ayBitis = endOfMonth(parseISO(secilenAy + '-01'));

        let filtrelenmisRaporlar = tumRaporlar.filter(rapor => {
          const raporTarihi = rapor.tarih.toDate();
          return raporTarihi >= ayBaslangic && raporTarihi <= ayBitis;
        });

        setRaporlar(filtrelenmisRaporlar);
      } catch (error) {
        console.error('Veri getirme hatası:', error);
        toast.error('Veriler yüklenirken bir hata oluştu');
      } finally {
        setYukleniyor(false);
      }
    };

    raporlariGetir();
  }, [kullanici, secilenAy, secilenSaha]);

  const handleRaporSil = async (id: string) => {
    if (!canDelete) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }

    try {
      setYukleniyor(true);
      await deleteDoc(doc(db, 'isRaporlari', id));
      toast.success('Rapor başarıyla silindi');
      setSilinecekRapor(null);
      setRaporlar(prev => prev.filter(rapor => rapor.id !== id));
    } catch (error) {
      console.error('Rapor silme hatası:', error);
      toast.error('Rapor silinirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  const filtrelenmisRaporlar = raporlar.filter(rapor => {
    if (!aramaMetni) return true;
    const aramaMetniKucuk = aramaMetni.toLowerCase();
    return (
      rapor.baslik.toLowerCase().includes(aramaMetniKucuk) ||
      rapor.yapilanIsler.toLowerCase().includes(aramaMetniKucuk)
    );
  });

  const getSahaAdi = (sahaId: string) => {
    return sahalar.find(s => s.id === sahaId)?.ad || 'Bilinmeyen Saha';
  };

  // İstatistik hesaplamaları
  const getIstatistikler = () => {
    const toplamIs = filtrelenmisRaporlar.length;
    const benzersizSahalar = new Set(filtrelenmisRaporlar.map(r => r.saha)).size;
    const benzersizKullanicilar = new Set(filtrelenmisRaporlar.map(r => r.olusturanKisi.ad)).size;
    
    // Son 7 günün verileri
    const son7Gun = Array.from({ length: 7 }, (_, i) => {
      const tarih = new Date();
      tarih.setDate(tarih.getDate() - i);
      const gunStr = format(tarih, 'dd/MM');
      const gunIsler = filtrelenmisRaporlar.filter(r => 
        format(r.tarih.toDate(), 'dd/MM') === gunStr
      ).length;
      
      return {
        gun: gunStr,
        isler: gunIsler
      };
    }).reverse();

    return {
      toplamIs,
      benzersizSahalar,
      benzersizKullanicilar,
      son7Gun
    };
  };

  const istatistikler = getIstatistikler();

  if (yukleniyor) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Yapılan İşler
                </h1>
                <p className="text-gray-600 mt-1">
                  {secilenSaha ? getSahaAdi(secilenSaha) : 'Tüm Sahalar'} - {format(parseISO(secilenAy + '-01'), 'MMMM yyyy', { locale: tr })}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4 mt-6 lg:mt-0">
              <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg">
                <Activity className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">İş Takibi Aktif</span>
              </div>

              {/* Görünüm Değiştirme */}
              <div className="flex rounded-lg shadow-sm border border-gray-300 overflow-hidden bg-white">
                <button
                  onClick={() => setGrafikGorünümü('liste')}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    grafikGorünümü === 'liste'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Liste
                </button>
                <button
                  onClick={() => setGrafikGorünümü('istatistik')}
                  className={`px-3 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                    grafikGorünümü === 'istatistik'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  İstatistik
                </button>
              </div>

              {canAdd && (
                <button
                  onClick={() => setFormAcik(true)}
                  className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Yeni İş Raporu
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Filtreler */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={aramaMetni}
                onChange={setAramaMetni}
                placeholder="İş raporu ara..."
              />
            </div>
            <div className="flex gap-3">
              <select
                value={secilenSaha}
                onChange={(e) => setSecilenSaha(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
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
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
                min={`${yilSecenekleri[yilSecenekleri.length - 1]}-01`}
                max={`${yilSecenekleri[0]}-12`}
              />
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: 'Toplam İş',
              value: istatistikler.toplamIs,
              change: '+8%',
              changeType: 'positive',
              icon: FileText,
              color: 'blue'
            },
            {
              title: 'Aktif Sahalar',
              value: istatistikler.benzersizSahalar,
              change: '+2%',
              changeType: 'positive',
              icon: Building,
              color: 'green'
            },
            {
              title: 'Çalışan Sayısı',
              value: istatistikler.benzersizKullanicilar,
              change: '+5%',
              changeType: 'positive',
              icon: Users,
              color: 'purple'
            },
            {
              title: 'Günlük Ortalama',
              value: istatistikler.toplamIs > 0 
                ? Math.round(istatistikler.toplamIs / new Date(new Date(secilenAy).getFullYear(), new Date(secilenAy).getMonth() + 1, 0).getDate())
                : 0,
              change: '+3%',
              changeType: 'neutral',
              icon: TrendingUp,
              color: 'orange'
            }
          ].map((kpi, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    kpi.color === 'blue' ? 'bg-blue-100' :
                    kpi.color === 'green' ? 'bg-green-100' :
                    kpi.color === 'purple' ? 'bg-purple-100' : 'bg-orange-100'
                  }`}>
                    <kpi.icon className={`w-5 h-5 ${
                      kpi.color === 'blue' ? 'text-blue-600' :
                      kpi.color === 'green' ? 'text-green-600' :
                      kpi.color === 'purple' ? 'text-purple-600' : 'text-orange-600'
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">{kpi.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                  </div>
                </div>
                <div className={`text-sm font-medium ${
                  kpi.changeType === 'positive' ? 'text-green-600' :
                  kpi.changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {kpi.change}
                </div>
              </div>
            </div>
          ))}
        </div>

      {/* İçerik Alanı */}
      {grafikGorünümü === 'istatistik' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Günlük İş Dağılımı */}
          <Card>
            <Title>Son 7 Gün İş Dağılımı</Title>
            <AreaChart
              className="h-72 mt-4"
              data={istatistikler.son7Gun}
              index="gun"
              categories={["isler"]}
              colors={["blue"]}
              valueFormatter={(value) => `${value} iş`}
              showLegend={false}
              showGradient={true}
              curveType="natural"
            />
          </Card>

          {/* Saha Bazlı Dağılım */}
          <Card>
            <Title>Saha Bazlı İş Dağılımı</Title>
            <div className="mt-6 space-y-4">
              {Array.from(new Set(filtrelenmisRaporlar.map(r => r.saha)))
                .map(sahaId => {
                  const sahaIsleri = filtrelenmisRaporlar.filter(r => r.saha === sahaId).length;
                  const yuzde = (sahaIsleri / filtrelenmisRaporlar.length) * 100;
                  
                  return (
                    <div key={sahaId}>
                      <Flex className="mb-2">
                        <Text>{getSahaAdi(sahaId)}</Text>
                        <Text>{sahaIsleri} iş</Text>
                      </Flex>
                      <ProgressBar value={yuzde} color="blue" className="mt-1" />
                    </div>
                  );
                })
              }
            </div>
          </Card>
        </div>
      ) : (
        <>
          {/* Liste Görünümü */}
          {filtrelenmisRaporlar.length === 0 ? (
            <Card className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <Title>İş Raporu Bulunamadı</Title>
              <Text className="mt-2 max-w-md mx-auto">
                Seçilen dönem ve filtreler için herhangi bir iş raporu bulunamadı. 
                Lütfen farklı bir dönem seçin veya filtreleri değiştirin.
              </Text>
              {canAdd && (
                <button
                  onClick={() => setFormAcik(true)}
                  className="mt-6 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Yeni İş Raporu Ekle
                </button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtrelenmisRaporlar.map((rapor) => (
                <Card
                  key={rapor.id}
                  className="group hover:shadow-lg transition-all duration-300 cursor-pointer relative overflow-hidden"
                  onClick={() => setSeciliRapor(rapor)}
                >
                  {/* Durum Badge */}
                  <div className="absolute top-3 left-3 z-10">
                    <Badge color="green" size="sm">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Tamamlandı
                    </Badge>
                  </div>

                  {/* Silme Butonu */}
                  {canDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSilinecekRapor(rapor.id);
                      }}
                      className="absolute top-3 right-3 z-10 p-1.5 bg-white rounded-full shadow-sm hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  )}

                  {/* Fotoğraf Alanı */}
                  <div className="h-32 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg mb-4 relative overflow-hidden">
                    {rapor.fotograflar?.[0] ? (
                      <img
                        src={rapor.fotograflar[0]}
                        alt={rapor.baslik}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-blue-300" />
                      </div>
                    )}
                    
                    {rapor.fotograflar && rapor.fotograflar.length > 1 && (
                      <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full">
                        +{rapor.fotograflar.length - 1}
                      </div>
                    )}
                  </div>

                  {/* İçerik */}
                  <div className="space-y-3">
                    <div>
                      <Title className="text-base line-clamp-1">{rapor.baslik}</Title>
                      <Text className="text-sm mt-1 line-clamp-2">{rapor.yapilanIsler}</Text>
                    </div>

                    <div className="space-y-2">
                      <Flex className="text-sm">
                        <div className="flex items-center text-gray-500">
                          <Building className="h-4 w-4 mr-1" />
                          <span className="truncate">{getSahaAdi(rapor.saha)}</span>
                        </div>
                      </Flex>
                      
                      <Flex className="text-sm">
                        <div className="flex items-center text-gray-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          <span>{format(rapor.tarih.toDate(), 'dd MMM yyyy', { locale: tr })}</span>
                        </div>
                      </Flex>
                      
                      <Flex className="text-sm">
                        <div className="flex items-center text-gray-500">
                          <User className="h-4 w-4 mr-1" />
                          <span className="truncate">{rapor.olusturanKisi.ad}</span>
                        </div>
                      </Flex>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex justify-end">
                      <button className="text-sm text-blue-600 hover:text-blue-700 flex items-center font-medium">
                        Detayları Gör
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modaller */}
      {formAcik && (
        <YapilanIsForm
          onClose={() => setFormAcik(false)}
          sahalar={sahalar}
        />
      )}

      {seciliRapor && (
        <IsRaporDetayModal
          rapor={seciliRapor}
          sahaAdi={getSahaAdi(seciliRapor.saha)}
          onClose={() => setSeciliRapor(null)}
        />
      )}

      {silinecekRapor && (
        <SilmeOnayModal
          onConfirm={() => handleRaporSil(silinecekRapor)}
          onCancel={() => setSilinecekRapor(null)}
          mesaj="Bu raporu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        />
      )}
      </div>
    </div>
  );
};
