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
import { Building, Calendar, Clock, ImageIcon, Plus, Trash2, User, Wrench, Tag, FileText, ChevronRight, CheckCircle } from 'lucide-react';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import { Card, Text } from '@tremor/react';
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

  if (yukleniyor) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Yapılan İşler</h1>
          <p className="mt-1 text-sm text-gray-500">
            Toplam {filtrelenmisRaporlar.length} rapor
          </p>
        </div>
        {canAdd && (
          <button
            onClick={() => setFormAcik(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            Yeni İş Raporu
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchInput
            value={aramaMetni}
            onChange={setAramaMetni}
            placeholder="Rapor ara..."
          />
        </div>
        <div className="flex gap-4">
          <select
            value={secilenSaha}
            onChange={(e) => setSecilenSaha(e.target.value)}
            className="rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
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
            className="rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
            min={`${yilSecenekleri[yilSecenekleri.length - 1]}-01`}
            max={`${yilSecenekleri[0]}-12`}
          />
        </div>
      </div>

      {/* İş Raporu İstatistikleri */}
      {filtrelenmisRaporlar.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="p-3 bg-blue-100 rounded-full mr-4">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <Text className="text-sm text-blue-700">Aylık İş Raporu Özeti</Text>
                <div className="flex items-center">
                  <span className="text-xl font-bold text-blue-800">
                    {filtrelenmisRaporlar.length} İş Tamamlandı
                  </span>
                </div>
              </div>
            </div>
            <div className="text-sm text-blue-700">
              <div className="flex items-center">
                <span className="font-medium mr-2">Dönem:</span>
                <span>{format(parseISO(secilenAy + '-01'), 'MMMM yyyy', { locale: tr })}</span>
              </div>
              <div className="flex items-center mt-1">
                <span className="font-medium mr-2">Saha:</span>
                <span>{secilenSaha ? getSahaAdi(secilenSaha) : 'Tüm Sahalar'}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {filtrelenmisRaporlar.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">İş Raporu Bulunamadı</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Seçilen dönem ve filtreler için herhangi bir iş raporu bulunamadı. Lütfen farklı bir dönem seçin veya filtreleri değiştirin.
          </p>
          {canAdd && (
            <button
              onClick={() => setFormAcik(true)}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700"
            >
              <Plus className="h-5 w-5 mr-2" />
              Yeni İş Raporu Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtrelenmisRaporlar.map((rapor) => (
            <div
              key={rapor.id}
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-100 relative group h-64"
            >
              <div 
                className="flex flex-col h-full cursor-pointer"
                onClick={() => setSeciliRapor(rapor)}
              >
                {/* Üst Kısım - Fotoğraf ve Başlık */}
                <div className="relative h-24">
                  <div className="h-full w-full bg-gray-100">
                    {rapor.fotograflar?.[0] ? (
                      <img
                        src={rapor.fotograflar[0]}
                        alt={rapor.baslik}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder-image.png';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    
                    {/* Fotoğraf Sayısı */}
                    {rapor.fotograflar && rapor.fotograflar.length > 1 && (
                      <div className="absolute top-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1.5 py-0.5 rounded-full">
                        <div className="flex items-center">
                          <ImageIcon className="h-3 w-3 mr-0.5" />
                          {rapor.fotograflar.length}
                        </div>
                      </div>
                    )}
                    
                    {/* Başlık Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
                      <h3 className="text-sm font-medium text-white line-clamp-1">
                        {rapor.baslik}
                      </h3>
                    </div>
                  </div>
                </div>
                
                {/* Alt Kısım - Detaylar */}
                <div className="p-3 flex-1 flex flex-col">
                  <div className="space-y-1 mb-2">
                    <div className="flex items-center text-xs text-gray-600">
                      <Building className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{getSahaAdi(rapor.saha)}</span>
                    </div>
                    
                    <div className="flex items-center text-xs text-gray-600">
                      <Calendar className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
                      <span>{format(rapor.tarih.toDate(), 'dd MMM yyyy', { locale: tr })}</span>
                    </div>
                    
                    <div className="flex items-center text-xs text-gray-600">
                      <User className="h-3 w-3 mr-1 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{rapor.olusturanKisi.ad}</span>
                    </div>
                  </div>
                  
                  {/* Yapılan İşler Özeti */}
                  <div className="mt-auto">
                    <div className="flex items-center mb-1">
                      <Wrench className="h-3 w-3 mr-1 text-yellow-500" />
                      <h4 className="text-xs font-medium text-gray-900">Yapılan İşler</h4>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {rapor.yapilanIsler}
                    </p>
                  </div>
                  
                  {/* Detay Butonu */}
                  <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end">
                    <button className="text-xs text-yellow-600 hover:text-yellow-700 flex items-center">
                      Detaylar
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tamamlandı İşareti */}
              <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                <div className="flex items-center">
                  <CheckCircle className="h-3 w-3 mr-0.5" />
                  Tamamlandı
                </div>
              </div>

              {/* Silme Butonu */}
              {canDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSilinecekRapor(rapor.id);
                  }}
                  className="absolute top-1 right-1 p-1 bg-white rounded-full shadow-sm hover:bg-red-50 transition-colors duration-200 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3 text-red-600" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

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
  );
};