import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, addDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, auth, storage } from '../lib/firebase'; // Added auth import here
import { useAuth } from '../contexts/AuthContext'; // Auth context dosyanızın yolu
import { LoadingSpinner } from '../components/LoadingSpinner'; // Bileşen yolu
import { FileUploadZone } from '../components/FileUploadZone'; // Bileşen yolu
import { uploadMultipleFiles } from '../utils/uploadHelpers'; // Yardımcı fonksiyon yolu
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Plus, 
  Trash2, 
  Search, 
  Building, 
  Package, 
  X, 
  Upload, 
  Image as ImageIcon, 
  Edit2, 
  Filter, 
  AlertCircle, 
  Check, 
  BarChart 
} from 'lucide-react';
import { SearchInput } from '../components/SearchInput'; // Bileşen yolu
import toast from 'react-hot-toast';

interface StokItem {
  id: string;
  sahaId: string;
  urunAdi: string;
  miktar: number;
  birim: string;
  kritikSeviye: number;
  kategori?: string;
  aciklama?: string;
  fotograflar?: string[];
  sonGuncelleme: Timestamp;
  olusturanKisi: {
    id: string;
    ad: string;
  };
  companyId: string;
}

const stokKategorileri = [
  'Elektronik',
  'Mekanik',
  'İnşaat Malzemesi',
  'Güvenlik Ekipmanı',
  'Ofis Malzemesi',
  'Temizlik Malzemesi',
  'Diğer'
];

export const StokKontrol: React.FC = () => {
  const { kullanici } = useAuth();
  const [stoklar, setStoklar] = useState<StokItem[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [secilenSaha, setSecilenSaha] = useState<string>('');
  const [secilenKategori, setSecilenKategori] = useState<string>('');
  const [sahalar, setSahalar] = useState<Array<{id: string, ad: string}>>([]);
  const [aramaMetni, setAramaMetni] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [duzenlemeModu, setDuzenlemeModu] = useState(false);
  const [secilenStok, setSecilenStok] = useState<StokItem | null>(null);
  const [form, setForm] = useState({
    sahaId: '',
    urunAdi: '',
    miktar: 0,
    birim: '',
    kritikSeviye: 0,
    kategori: '',
    aciklama: '',
    fotograflar: [] as File[]
  });

  const canAdd = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);
  const canDelete = kullanici?.rol === 'yonetici';
  const canEdit = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);
  // canUploadPhotos artık doğrudan kullanılmıyor, uploadMultipleFiles içindeki kurallar ve Firebase kuralları belirleyici.
  // const canUploadPhotos = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);

  useEffect(() => {
    const sahalariGetir = async () => {
      if (!kullanici) return;

      try {
        let sahaQuery;
        if (kullanici.rol === 'musteri' && kullanici.sahalar && kullanici.sahalar.length > 0) {
          sahaQuery = query(
            collection(db, 'sahalar'),
            where('__name__', 'in', kullanici.sahalar)
          );
        } else if (kullanici.rol === 'musteri' && (!kullanici.sahalar || kullanici.sahalar.length === 0)) {
            setSahalar([]); // Müşterinin sahası yoksa boş liste
            return;
        }
         else {
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
    const stoklariGetir = async () => {
      if (!kullanici) return;

      try {
        setYukleniyor(true);
        let stokQuery;
        const baseQueryConstraints = [where('companyId', '==', kullanici.companyId)];

        if (kullanici.rol === 'musteri') {
          if (!kullanici.sahalar || kullanici.sahalar.length === 0) {
            setStoklar([]); // Müşterinin yetkili olduğu saha yoksa stokları boşalt
            setYukleniyor(false);
            return;
          }
          if (secilenSaha) {
            if (!kullanici.sahalar.includes(secilenSaha)) {
              setStoklar([]); // Seçilen saha müşterinin yetkili olduğu sahalardan değilse boşalt
              setYukleniyor(false);
              return;
            }
            stokQuery = query(collection(db, 'stoklar'), ...baseQueryConstraints, where('sahaId', '==', secilenSaha));
          } else {
            stokQuery = query(collection(db, 'stoklar'), ...baseQueryConstraints, where('sahaId', 'in', kullanici.sahalar));
          }
        } else { // Yonetici, tekniker, muhendis vs.
          if (secilenSaha) {
            stokQuery = query(collection(db, 'stoklar'), ...baseQueryConstraints, where('sahaId', '==', secilenSaha));
          } else {
            stokQuery = query(collection(db, 'stoklar'), ...baseQueryConstraints);
          }
        }

        const snapshot = await getDocs(stokQuery);
        const stokVerileri = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StokItem[];

        setStoklar(stokVerileri);
      } catch (error: any) {
        console.error('Stoklar getirilemedi:', error);
        // Firestore 'IN' sorgusu boş dizi ile hata verir, bunu önceden kontrol ettik.
        if (error.code === 'invalid-argument' && error.message.includes("value for 'in' array must not be empty")) {
            toast.error('Filtreleme için geçerli saha bulunamadı.');
            setStoklar([]);
        } else {
            toast.error('Stoklar yüklenirken bir hata oluştu');
        }
      } finally {
        setYukleniyor(false);
      }
    };

    stoklariGetir();
  }, [kullanici, secilenSaha]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kullanici || !canAdd) { // canAdd zaten rol kontrolü yapıyor
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }

    if (!form.sahaId || !form.urunAdi || form.miktar < 0) {
      toast.error('Lütfen saha, ürün adı ve miktar gibi gerekli alanları doldurun');
      return;
    }

    // Log user role for debugging
    console.log('Current user role:', kullanici.rol);
    console.log('Can add:', canAdd);
    console.log('Can edit:', canEdit);
    console.log('Can delete:', canDelete);

    setYukleniyor(true); // Yükleme başlıyor
    let fotografURLleri: string[] = [];
    
    try {
      if (form.fotograflar.length > 0) {
        const uploadToast = toast.loading('Fotoğraflar yükleniyor...');
        try {
          // Force token refresh before uploading to ensure latest claims are used
          await auth.currentUser?.getIdToken(true);
          
          fotografURLleri = await uploadMultipleFiles(
            form.fotograflar,
            'stoklar', // Firebase Storage'da kaydedilecek klasör yolu
            (progress) => setUploadProgress(progress)
          );
          toast.success(`${fotografURLleri.length} fotoğraf başarıyla yüklendi`, {
            id: uploadToast
          });
        } catch (error: any) { // uploadMultipleFiles'dan gelen Error objesi
          console.error('Fotoğraf yükleme hatası (handleSubmit içinde):', error);
          // uploadHelpers.ts'den gelen hata mesajını doğrudan göster
          toast.error(error.message || 'Fotoğraf yüklenirken bilinmeyen bir hata oluştu.', {
            id: uploadToast // Mevcut toast'ı güncelle
          });
          // Yetki hatasıysa veya kritik bir hataysa işlemi durdurabilirsin,
          // ya da fotoğrafsız devam etmesini sağlayabilirsin. Mevcut mantık fotoğrafsız devam ediyor.
          console.log('Fotoğraf yükleme hatası oluştu, fotoğrafsız devam ediliyor (veya kısmi fotoğrafla).');
          // fotografURLleri dizisi bu noktada boş veya kısmen dolu olabilir.
        }
      }

      // fotografURLleri'nin her zaman bir dizi olduğundan emin olalım
      if (!Array.isArray(fotografURLleri)) {
          fotografURLleri = [];
      }

      const stokData = {
        sahaId: form.sahaId,
        urunAdi: form.urunAdi,
        miktar: form.miktar,
        birim: form.birim,
        kritikSeviye: form.kritikSeviye,
        kategori: form.kategori,
        aciklama: form.aciklama,
        sonGuncelleme: Timestamp.now(),
        companyId: kullanici.companyId,
        // Sadece fotografURLleri'nde eleman varsa 'fotograflar' alanını ekle
        ...(fotografURLleri.length > 0 && { fotograflar: fotografURLleri })
      };

      if (duzenlemeModu && secilenStok) {
        await updateDoc(doc(db, 'stoklar', secilenStok.id), stokData);
        toast.success('Stok başarıyla güncellendi');
      } else {
        await addDoc(collection(db, 'stoklar'), {
          ...stokData,
          olusturanKisi: { // Yeni stok eklenirken oluşturan kişi bilgisi
            id: kullanici.id,
            ad: kullanici.ad || kullanici.email || 'Bilinmeyen Kullanıcı' // Kullanıcı adını alabiliyorsan kullan
          }
        });
        toast.success('Stok başarıyla eklendi');
      }

      setFormAcik(false);
      setDuzenlemeModu(false);
      setSecilenStok(null);
      setForm({
        sahaId: '',
        urunAdi: '',
        miktar: 0,
        birim: '',
        kritikSeviye: 0,
        kategori: '',
        aciklama: '',
        fotograflar: []
      });
      
      // Stok listesini yenilemek için secilenSaha'yı değiştirmeye gerek yok,
      // genel bir getirme fonksiyonu çağrılabilir veya useEffect'in bağımlılıkları tetiklenebilir.
      // Şimdilik basit olması için, en son seçili sahaya göre listeyi yenileyecek.
      // Eğer yeni eklenen/güncellenen stok farklı bir sahadaysa, filtre değişmeden görünmeyebilir.
      // Daha iyi bir çözüm: Stok listesini yeniden çekmek.
      const stokQuery = secilenSaha 
        ? query(collection(db, 'stoklar'), where('companyId', '==', kullanici.companyId), where('sahaId', '==', secilenSaha))
        : query(collection(db, 'stoklar'), where('companyId', '==', kullanici.companyId));
      const snapshot = await getDocs(stokQuery);
      const stokVerileri = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StokItem[];
      setStoklar(stokVerileri);
      
    } catch (error: any) { // Bu dıştaki catch, addDoc/updateDoc veya diğer genel hatalar için
      console.error('Stok işlemi genel hatası:', error);
      // Eğer hata mesajı zaten fotoğraf yüklemeden geliyorsa tekrar gösterme
      if (!(error.message && (error.message.includes('yetkiniz bulunmamaktadır') || error.message.includes('Dosya yükleme başarısız')))) {
         toast.error(duzenlemeModu ? 'Stok güncellenirken bir hata oluştu' : 'Stok eklenirken bir hata oluştu');
      }
    } finally {
      setYukleniyor(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }

    if (!window.confirm('Bu stok kaydını silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      setYukleniyor(true);
      await deleteDoc(doc(db, 'stoklar', id));
      toast.success('Stok başarıyla silindi');
      setStoklar(prev => prev.filter(stok => stok.id !== id));
    } catch (error) {
      console.error('Stok silme hatası:', error);
      toast.error('Stok silinirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  const handleEdit = (stok: StokItem) => {
    if (!canEdit) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }

    setSecilenStok(stok);
    setForm({
      sahaId: stok.sahaId,
      urunAdi: stok.urunAdi,
      miktar: stok.miktar,
      birim: stok.birim,
      kritikSeviye: stok.kritikSeviye,
      kategori: stok.kategori || '',
      aciklama: stok.aciklama || '',
      fotograflar: [] // Düzenleme modunda mevcut fotoğrafları göstermiyoruz, yenilerini ekleyebilir.
                     // Eğer mevcutları koruyup ekleme/çıkarma yapmak istersen burası değişmeli.
    });
    setDuzenlemeModu(true);
    setFormAcik(true);
  };

  const filtrelenmisStoklar = stoklar.filter(stok => {
    const aramaFiltreleme = !aramaMetni || 
      stok.urunAdi.toLowerCase().includes(aramaMetni.toLowerCase()) ||
      (stok.aciklama && stok.aciklama.toLowerCase().includes(aramaMetni.toLowerCase())); // Açıklama null olabilir
    
    const kategoriFiltreleme = !secilenKategori || stok.kategori === secilenKategori;
    
    return aramaFiltreleme && kategoriFiltreleme;
  });

  const kritikSeviyedeOlanlar = filtrelenmisStoklar.filter(stok => stok.miktar <= stok.kritikSeviye).length;
  const toplamStokAdedi = filtrelenmisStoklar.reduce((total, stok) => total + stok.miktar, 0);
  const toplamStokCesidi = filtrelenmisStoklar.length;
  const normalStokAdedi = filtrelenmisStoklar.filter(stok => stok.miktar > stok.kritikSeviye).length;
  
  const [detayModalAcik, setDetayModalAcik] = useState(false);
  const [secilenDetay, setSecilenDetay] = useState<StokItem | null>(null);

  if (yukleniyor && stoklar.length === 0) { // İlk yüklemede ve stoklar boşken göster
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Geri kalan JSX kodunuz aynı kalabilir...
  // Sadece JSX içinde fotograflar için placeholder veya hata durumunu yöneten kısım:
  // <img ... onError={(e) => { const target = e.target as HTMLImageElement; target.src = '/placeholder-image.png'; }} />
  // kısmının doğru çalıştığından emin olun.

  return (
    <div className="space-y-6 p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Stok Kontrol Paneli</h1>
          <p className="mt-1 text-sm text-gray-600">
            Toplam <span className="font-semibold">{filtrelenmisStoklar.length}</span> ürün listeleniyor.
            {kritikSeviyedeOlanlar > 0 && (
              <span className="ml-2 text-red-600 font-medium">
                ({kritikSeviyedeOlanlar} ürün kritik seviyede!)
              </span>
            )}
          </p>
        </div>
        {canAdd && (
          <button
            onClick={() => {
              setDuzenlemeModu(false);
              setSecilenStok(null);
              setForm({
                sahaId: secilenSaha || (sahalar.length > 0 ? sahalar[0].id : ''), // Aktif sahayı veya ilk sahayı varsayılan yap
                urunAdi: '',
                miktar: 0,
                birim: '',
                kritikSeviye: 0,
                kategori: '',
                aciklama: '',
                fotograflar: []
              });
              setFormAcik(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Yeni Stok Ekle
          </button>
        )}
      </div>
      
      {/* Özet Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Toplam Stok Çeşidi', value: toplamStokCesidi, icon: Package, color: 'blue' },
          { title: 'Toplam Ürün Adedi', value: toplamStokAdedi, icon: BarChart, color: 'indigo' },
          { title: 'Normal Seviyede Ürün', value: normalStokAdedi, icon: Check, color: 'green' },
          { title: 'Kritik Seviyede Ürün', value: kritikSeviyedeOlanlar, icon: AlertCircle, color: 'red' },
        ].map(card => (
          <div key={card.title} className={`bg-white rounded-xl border border-gray-200 shadow-lg p-5 transition-all hover:shadow-xl`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium text-gray-500`}>{card.title}</p>
                <h3 className={`text-2xl font-bold text-${card.color}-600`}>{card.value}</h3>
              </div>
              <div className={`rounded-full p-3 bg-${card.color}-100`}>
                <card.icon className={`h-6 w-6 text-${card.color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtreler */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex-1 w-full sm:w-auto">
            <SearchInput
              value={aramaMetni}
              onChange={setAramaMetni}
              placeholder="Ürün adı veya açıklamada ara..."
            />
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <select
              value={secilenSaha}
              onChange={(e) => setSecilenSaha(e.target.value)}
              className="w-full sm:w-auto rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
              disabled={kullanici?.rol === 'musteri' && sahalar.length <= 1 && !!secilenSaha} // Müşterinin tek sahası varsa ve seçiliyse disable
            >
              <option value="">Tüm Sahalar</option>
              {sahalar.map(saha => (
                <option key={saha.id} value={saha.id}>{saha.ad}</option>
              ))}
            </select>
            <select
              value={secilenKategori}
              onChange={(e) => setSecilenKategori(e.target.value)}
              className="w-full sm:w-auto rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors"
            >
              <option value="">Tüm Kategoriler</option>
              {stokKategorileri.map(kategori => (
                <option key={kategori} value={kategori}>{kategori}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Stok Tablosu */}
      {yukleniyor && stoklar.length > 0 && ( // Sadece veri yenilenirken ve zaten veri varsa göster
            <div className="my-4 text-center">
                <LoadingSpinner text="Stoklar güncelleniyor..." />
            </div>
        )}
      <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {['Ürün', 'Kategori', 'Miktar', 'Kritik Seviye', 'Saha', 'Son Güncelleme', 'İşlemler'].map(header => (
                <th key={header} scope="col" className={`px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${header === 'İşlemler' ? 'text-center' : ''}`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {!yukleniyor && filtrelenmisStoklar.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-500">
                  <Package className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                  Filtrelerinize uygun stok bulunamadı.
                  {stoklar.length === 0 && aramaMetni === '' && secilenKategori === '' && secilenSaha === '' && (
                     <p className="mt-1">Henüz hiç stok eklenmemiş.</p>
                  )}
                </td>
              </tr>
            ) : (
              filtrelenmisStoklar.map((stok) => (
                <tr 
                  key={stok.id} 
                  className={`transition-colors ${stok.miktar <= stok.kritikSeviye ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {stok.fotograflar && stok.fotograflar.length > 0 ? (
                        <img
                          className="h-10 w-10 rounded-md object-cover mr-3 border border-gray-200"
                          src={stok.fotograflar[0]}
                          alt={stok.urunAdi}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'https://via.placeholder.com/40?text=Hata'; // Hata durumunda gösterilecek placeholder
                            target.alt = "Resim yüklenemedi";
                          }}
                        />
                      ) : (
                        <div className="flex-shrink-0 h-10 w-10 mr-3 bg-gray-200 rounded-md flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{stok.urunAdi}</div>
                        {stok.aciklama && <div className="text-xs text-gray-500 truncate max-w-xs">{stok.aciklama}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stok.kategori || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-semibold ${stok.miktar <= stok.kritikSeviye ? 'text-red-600' : 'text-gray-900'}`}>
                      {stok.miktar}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">{stok.birim}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stok.kritikSeviye}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {sahalar.find(s => s.id === stok.sahaId)?.ad || 'Bilinmeyen Saha'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stok.sonGuncelleme ? format(stok.sonGuncelleme.toDate(), 'dd MMM yyyy, HH:mm', { locale: tr }) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex items-center justify-center space-x-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSecilenDetay(stok); setDetayModalAcik(true); }}
                        className="text-blue-600 hover:text-blue-800 transition-colors p-1" title="Detayları Gör">
                        <Search className="h-5 w-5" />
                      </button>
                      {canEdit && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEdit(stok); }}
                          className="text-yellow-600 hover:text-yellow-800 transition-colors p-1" title="Düzenle">
                          <Edit2 className="h-5 w-5" />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(stok.id); }}
                          className="text-red-600 hover:text-red-800 transition-colors p-1" title="Sil">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Yeni Stok Ekleme / Düzenleme Formu (Modal) */}
      {formAcik && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">
                {duzenlemeModu ? 'Stok Düzenle' : 'Yeni Stok Ekle'}
              </h2>
              <button onClick={() => setFormAcik(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="sahaId" className="block text-sm font-medium text-gray-700">Saha</label>
                <select
                  id="sahaId"
                  name="sahaId"
                  value={form.sahaId}
                  onChange={(e) => setForm(prev => ({ ...prev, sahaId: e.target.value }))}
                  required
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm rounded-md shadow-sm"
                >
                  <option value="" disabled>Saha Seçin</option>
                  {sahalar.map(saha => (
                    <option key={saha.id} value={saha.id}>{saha.ad}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="urunAdi" className="block text-sm font-medium text-gray-700">Ürün Adı</label>
                <input
                  type="text"
                  id="urunAdi"
                  name="urunAdi"
                  value={form.urunAdi}
                  onChange={(e) => setForm(prev => ({ ...prev, urunAdi: e.target.value }))}
                  required
                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="miktar" className="block text-sm font-medium text-gray-700">Miktar</label>
                  <input
                    type="number"
                    id="miktar"
                    name="miktar"
                    value={form.miktar}
                    onChange={(e) => setForm(prev => ({ ...prev, miktar: parseInt(e.target.value, 10) >= 0 ? parseInt(e.target.value, 10) : 0 }))}
                    min="0"
                    required
                    className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
                <div>
                  <label htmlFor="birim" className="block text-sm font-medium text-gray-700">Birim (örn: adet, kg, m)</label>
                  <input
                    type="text"
                    id="birim"
                    name="birim"
                    value={form.birim}
                    onChange={(e) => setForm(prev => ({ ...prev, birim: e.target.value }))}
                    className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
                <div>
                  <label htmlFor="kritikSeviye" className="block text-sm font-medium text-gray-700">Kritik Seviye</label>
                  <input
                    type="number"
                    id="kritikSeviye"
                    name="kritikSeviye"
                    value={form.kritikSeviye}
                    onChange={(e) => setForm(prev => ({ ...prev, kritikSeviye: parseInt(e.target.value, 10) >= 0 ? parseInt(e.target.value, 10) : 0 }))}
                    min="0"
                    className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="kategori" className="block text-sm font-medium text-gray-700">Kategori</label>
                <select
                  id="kategori"
                  name="kategori"
                  value={form.kategori}
                  onChange={(e) => setForm(prev => ({ ...prev, kategori: e.target.value }))}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 sm:text-sm rounded-md shadow-sm"
                >
                  <option value="">Kategori Seçin (Opsiyonel)</option>
                  {stokKategorileri.map(kat => (
                    <option key={kat} value={kat}>{kat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="aciklama" className="block text-sm font-medium text-gray-700">Açıklama (Opsiyonel)</label>
                <textarea
                  id="aciklama"
                  name="aciklama"
                  rows={3}
                  value={form.aciklama}
                  onChange={(e) => setForm(prev => ({ ...prev, aciklama: e.target.value }))}
                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Fotoğraflar (Opsiyonel)</label>
                 <FileUploadZone
                    onFileSelect={(files) => setForm(prev => ({ ...prev, fotograflar: [...prev.fotograflar, ...files].slice(0,5) }))} // En fazla 5 dosya
                    selectedFiles={form.fotograflar}
                    onFileRemove={(index) => setForm(prev => ({ ...prev, fotograflar: prev.fotograflar.filter((_, i) => i !== index) }))}
                    uploadProgress={uploadProgress}
                    maxFiles={5} // FileUploadZone'a da maxFiles bilgisini geç
                    // disabled={!canUploadPhotos} // Bu kontrolü FileUploadZone kendi içinde veya uploadHelpers yapıyor
                />
                {uploadProgress > 0 && uploadProgress < 100 && (
                    <p className="text-sm text-yellow-600 mt-1">Yükleniyor: {Math.round(uploadProgress)}%</p>
                )}
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setFormAcik(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={yukleniyor}
                  className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 transition-colors"
                >
                  {yukleniyor ? (
                    <LoadingSpinner size="sm" text={duzenlemeModu ? 'Güncelleniyor...' : 'Kaydediliyor...'} />
                  ) : (
                    duzenlemeModu ? 'Değişiklikleri Kaydet' : 'Stok Ekle'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stok Detay Modalı */}
      {detayModalAcik && secilenDetay && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{secilenDetay.urunAdi} - Detayları</h3>
              <button onClick={() => setDetayModalAcik(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <p><strong>Saha:</strong> {sahalar.find(s => s.id === secilenDetay.sahaId)?.ad || 'Bilinmeyen'}</p>
              <p><strong>Kategori:</strong> {secilenDetay.kategori || 'Belirtilmemiş'}</p>
              <p><strong>Miktar:</strong> {secilenDetay.miktar} {secilenDetay.birim}</p>
              <p><strong>Kritik Seviye:</strong> {secilenDetay.kritikSeviye}</p>
              <p><strong>Açıklama:</strong> {secilenDetay.aciklama || 'Yok'}</p>
              <p><strong>Son Güncelleme:</strong> {secilenDetay.sonGuncelleme ? format(secilenDetay.sonGuncelleme.toDate(), 'dd MMMM yyyy, HH:mm', { locale: tr }) : '-'}</p>
              <p><strong>Oluşturan:</strong> {secilenDetay.olusturanKisi?.ad || 'Bilinmiyor'}</p>
              {secilenDetay.fotograflar && secilenDetay.fotograflar.length > 0 && (
                <div>
                  <strong>Fotoğraflar:</strong>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {secilenDetay.fotograflar.map((url, index) => (
                      <a key={index} href={url} target="_blank" rel="noopener noreferrer">
                        <img 
                            src={url} 
                            alt={`${secilenDetay.urunAdi} ${index+1}`} 
                            className="h-24 w-full object-cover rounded-md border hover:opacity-80 transition-opacity"
                            onError={(e) => { const target = e.target as HTMLImageElement; target.src = 'https://via.placeholder.com/100?text=Hata'; }}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};