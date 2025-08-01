import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, deleteDoc, updateDoc, where, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Pencil, Trash2, X, Building, Users, Mail, Phone, MapPin, Search, Filter } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MusteriForm } from '../components/MusteriForm';
import { MusteriKart } from '../components/MusteriKart';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import { SearchInput } from '../components/SearchInput';
import toast from 'react-hot-toast';
import type { Kullanici } from '../types';

export const Musteriler: React.FC = () => {
  const { kullanici } = useAuth();
  const [musteriler, setMusteriler] = useState<Kullanici[]>([]);
  const [sahalar, setSahalar] = useState<Array<{id: string, ad: string}>>([]);
  const [santraller, setSantraller] = useState<Array<{id: string, ad: string}>>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenecekMusteri, setDuzenlenecekMusteri] = useState<Kullanici | null>(null);
  const [silinecekMusteri, setSilinecekMusteri] = useState<string | null>(null);
  const [aramaMetni, setAramaMetni] = useState('');

  // Yönetici kontrolü
  const isYonetici = kullanici?.rol === 'yonetici' || kullanici?.rol === 'superadmin';

  useEffect(() => {
    const veriGetir = async () => {
      if (!isYonetici || !kullanici?.companyId) {
        setYukleniyor(false);
        return;
      }

      try {
        setYukleniyor(true);
        
        // Sahaları getir
        const sahaQuery = query(
          collection(db, 'sahalar'),
          where('companyId', '==', kullanici.companyId),
          orderBy('ad')
        );
        const sahaSnapshot = await getDocs(sahaQuery);
        const sahaListesi = sahaSnapshot.docs.map(doc => ({
          id: doc.id,
          ad: doc.data().ad
        }));
        setSahalar(sahaListesi);
        
        // Santralleri getir
        const santralQuery = query(
          collection(db, 'santraller'),
          where('companyId', '==', kullanici.companyId),
          orderBy('ad')
        );
        const santralSnapshot = await getDocs(santralQuery);
        const santralListesi = santralSnapshot.docs.map(doc => ({
          id: doc.id,
          ad: doc.data().ad
        }));
        setSantraller(santralListesi);

        // Müşterileri getir
        const musteriQuery = query(
          collection(db, 'kullanicilar'),
          where('rol', '==', 'musteri'),
          where('companyId', '==', kullanici.companyId)
        );
        const musteriSnapshot = await getDocs(musteriQuery);
        const musteriListesi = musteriSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Kullanici[];
        
        setMusteriler(musteriListesi);
      } catch (error) {
        console.error('Veri getirme hatası:', error);
        toast.error('Veriler yüklenirken bir hata oluştu. Lütfen yetkinizi kontrol edin.');
      } finally {
        setYukleniyor(false);
      }
    };

    veriGetir();
  }, [isYonetici, kullanici]);

  const handleMusteriSil = async (id: string) => {
    if (!isYonetici) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }

    setYukleniyor(true);
    try {
      // Müşteri bilgilerini al
      const userDoc = await getDoc(doc(db, 'kullanicilar', id));
      if (!userDoc.exists()) {
        toast.error('Müşteri bulunamadı');
        setYukleniyor(false);
        return;
      }

      const userData = userDoc.data();
      const customerName = userData.ad || 'Bilinmeyen Müşteri';

      // Ek onay al
      const confirmDelete = window.confirm(
        `${customerName} adlı müşteriyi ve ona ait tüm verileri (sahalar, raporlar, bildirimler) silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`
      );

      if (!confirmDelete) {
        setYukleniyor(false);
        return;
      }

      console.log(`Müşteri silme işlemi başlatılıyor: ${id} (${customerName})`);

      // Müşteriye atanmış sahalar varsa, musteriId'sini temizle
      if (userData.sahalar && Array.isArray(userData.sahalar) && userData.sahalar.length > 0) {
        try {
          const sahaQuery = query(
            collection(db, 'sahalar'),
            where('__name__', 'in', userData.sahalar),
            where('companyId', '==', kullanici?.companyId)
          );
          const sahaSnapshot = await getDocs(sahaQuery);

          if (sahaSnapshot.size > 0) {
            const batch = writeBatch(db);
            sahaSnapshot.docs.forEach((sahaDoc) => {
              batch.update(sahaDoc.ref, {
                musteriId: null,
                guncellemeTarihi: new Date()
              });
            });
            await batch.commit();
            console.log(`${sahaSnapshot.size} sahadan müşteri ataması kaldırıldı`);
          }
        } catch (error) {
          console.error('Saha atamalarını kaldırırken hata:', error);
        }
      }

      // Müşteriye atanmış santraller varsa, musteriId'sini temizle
      try {
        const santralQuery = query(
          collection(db, 'santraller'),
          where('musteriId', '==', id),
          where('companyId', '==', kullanici?.companyId)
        );
        const santralSnapshot = await getDocs(santralQuery);

        if (santralSnapshot.size > 0) {
          const batch = writeBatch(db);
          santralSnapshot.docs.forEach((santralDoc) => {
            batch.update(santralDoc.ref, {
              musteriId: null,
              guncellemeTarihi: new Date()
            });
          });
          await batch.commit();
          console.log(`${santralSnapshot.size} santraldan müşteri ataması kaldırıldı`);
        }
      } catch (error) {
        console.error('Santral atamalarını kaldırırken hata:', error);
      }

      // Müşteriye ait verileri sil
      const collectionsToClean = [
        { collection: 'arizalar', field: 'raporlayanId' },
        { collection: 'bildirimler', field: 'kullaniciId' }
      ];

      for (const { collection: collectionName, field } of collectionsToClean) {
        try {
          const collectionQuery = query(
            collection(db, collectionName),
            where(field, '==', id),
            where('companyId', '==', kullanici?.companyId)
          );
          const collectionSnapshot = await getDocs(collectionQuery);

          if (collectionSnapshot.size > 0) {
            const batch = writeBatch(db);
            collectionSnapshot.docs.forEach((doc) => {
              batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`${collectionName}: ${collectionSnapshot.size} döküman silindi`);
          }
        } catch (error) {
          console.error(`${collectionName} temizlenirken hata:`, error);
        }
      }

      // Son olarak müşteri dokümanını sil
      await deleteDoc(doc(db, 'kullanicilar', id));
      console.log('Müşteri dokümanı silindi');

      toast.success(`${customerName} ve ilgili tüm verileri başarıyla silindi`);
      setSilinecekMusteri(null);
      setMusteriler(prev => prev.filter(m => m.id !== id));
    } catch (error) {
      console.error('Müşteri silme hatası:', error);
      toast.error('Müşteri silinirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  const handleMusteriDuzenle = (musteri: Kullanici) => {
    setDuzenlenecekMusteri(musteri);
    setFormAcik(true);
  };

  const filtrelenmisMusteri = musteriler.filter(musteri => {
    if (!aramaMetni) return true;
    
    const aramaMetniKucuk = aramaMetni.toLowerCase();
    return (
      musteri.ad.toLowerCase().includes(aramaMetniKucuk) ||
      musteri.email.toLowerCase().includes(aramaMetniKucuk) ||
      (musteri.sirket && musteri.sirket.toLowerCase().includes(aramaMetniKucuk)) ||
      (musteri.telefon && musteri.telefon.toLowerCase().includes(aramaMetniKucuk))
    );
  });

  if (!isYonetici) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <p className="text-neutral-500">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }

  if (yukleniyor && musteriler.length === 0) {
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
          <h1 className="text-2xl font-bold text-neutral-900">Müşteri Yönetimi</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Toplam {musteriler.length} müşteri
          </p>
        </div>
        <button
          onClick={() => {
            setDuzenlenecekMusteri(null);
            setFormAcik(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 transition-colors"
        >
          <UserPlus className="h-5 w-5 mr-2" />
          Yeni Müşteri Ekle
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchInput
            value={aramaMetni}
            onChange={setAramaMetni}
            placeholder="Müşteri ara..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtrelenmisMusteri.length > 0 ? (
          filtrelenmisMusteri.map((musteri) => (
            <MusteriKart
              key={musteri.id}
              musteri={musteri}
              sahalar={sahalar}
              santraller={santraller}
              onDuzenle={() => handleMusteriDuzenle(musteri)}
              onSil={() => setSilinecekMusteri(musteri.id)}
            />
          ))
        ) : (
          <div className="col-span-full flex justify-center items-center py-12">
            <div className="text-center">
              <Users className="mx-auto h-12 w-12 text-neutral-300" />
              <h3 className="mt-2 text-sm font-medium text-neutral-900">Müşteri bulunamadı</h3>
              <p className="mt-1 text-sm text-neutral-500">
                {aramaMetni ? 'Arama kriterlerinize uygun müşteri bulunamadı.' : 'Henüz müşteri eklenmemiş.'}
              </p>
              <div className="mt-6">
                <button
                  onClick={() => {
                    setDuzenlenecekMusteri(null);
                    setFormAcik(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  Yeni Müşteri Ekle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {formAcik && (
        <MusteriForm
          sahalar={sahalar}
          santraller={santraller}
          musteri={duzenlenecekMusteri}
          onClose={() => {
            setFormAcik(false);
            setDuzenlenecekMusteri(null);
            // Müşteri listesini yenile
            const veriGetir = async () => {
              try {
                const musteriQuery = query(
                  collection(db, 'kullanicilar'),
                  where('rol', '==', 'musteri'),
                  where('companyId', '==', kullanici?.companyId)
                );
                const musteriSnapshot = await getDocs(musteriQuery);
                const musteriListesi = musteriSnapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data()
                })) as Kullanici[];
                
                setMusteriler(musteriListesi);
              } catch (error) {
                console.error('Müşteri yenileme hatası:', error);
              }
            };
            veriGetir();
          }}
        />
      )}

      {silinecekMusteri && (
        <SilmeOnayModal
          onConfirm={() => handleMusteriSil(silinecekMusteri)}
          onCancel={() => setSilinecekMusteri(null)}
          mesaj="Bu müşteriyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        />
      )}
    </div>
  );
};