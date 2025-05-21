import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, addDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { FileUploadZone } from '../components/FileUploadZone';
import { uploadMultipleFiles } from '../utils/uploadHelpers';
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
import { SearchInput } from '../components/SearchInput';
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

  // Yetki kontrolleri - Rol bazlı erişim (Müşteri rolü eklendi)
  const canAdd = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis', 'musteri'].includes(kullanici.rol);
  const canDelete = kullanici?.rol === 'yonetici';
  const canEdit = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis', 'musteri'].includes(kullanici.rol);
  const canUploadPhotos = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis', 'musteri'].includes(kullanici.rol);
  
  // Debug için: Kullanıcı rolünü konsola yazdır
  useEffect(() => {
    if (kullanici) {
      console.log("Kullanıcı rolü:", kullanici.rol);
      console.log("Yükleme izni var mı:", canUploadPhotos);
    }
  }, [kullanici, canUploadPhotos]);

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
    const stoklariGetir = async () => {
      if (!kullanici) return;
      try {
        setYukleniyor(true);
        let stokQuery;

        if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          if (secilenSaha) {
            if (!kullanici.sahalar.includes(secilenSaha)) {
              setStoklar([]);
              return;
            }
            stokQuery = query(
              collection(db, 'stoklar'),
              where('sahaId', '==', secilenSaha),
              where('companyId', '==', kullanici.companyId)
            );
          } else {
            stokQuery = query(
              collection(db, 'stoklar'),
              where('sahaId', 'in', kullanici.sahalar),
              where('companyId', '==', kullanici.companyId)
            );
          }
        } else if (secilenSaha) {
          stokQuery = query(
            collection(db, 'stoklar'),
            where('sahaId', '==', secilenSaha),
            where('companyId', '==', kullanici.companyId)
          );
        } else {
          stokQuery = query(
            collection(db, 'stoklar'),
            where('companyId', '==', kullanici.companyId)
          );
        }

        const snapshot = await getDocs(stokQuery);
        const stokVerileri = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StokItem[];

        setStoklar(stokVerileri);
      } catch (error) {
        console.error('Stoklar getirilemedi:', error);
        toast.error('Stoklar yüklenirken bir hata oluştu');
      } finally {
        setYukleniyor(false);
      }
    };

    stoklariGetir();
  }, [kullanici, secilenSaha]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kullanici || !canAdd) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }
    if (!form.sahaId || !form.urunAdi || form.miktar < 0) {
      toast.error('Lütfen gerekli alanları doldurun');
      return;
    }

    // Fotoğraf yükleme yetkisini kontrol et
    if (form.fotograflar.length > 0 && !canUploadPhotos) {
      toast.error('Fotoğraf yükleme yetkiniz bulunmuyor');
      return;
    }

    try {
      setYukleniyor(true);
      let fotografURLleri: string[] = [];
      
      if (form.fotograflar.length > 0) {
        try {
          // Kullanıcının yükleme izni olup olmadığını bir daha kontrol et
          if (!canUploadPhotos) {
            toast.error('Fotoğraf yükleme yetkiniz bulunmuyor');
            setYukleniyor(false);
            return; // Yetki yoksa işlemi sonlandır
          }
          
          const uploadToast = toast.loading('Fotoğraflar yükleniyor...');
          fotografURLleri = await uploadMultipleFiles(
            form.fotograflar,
            'stoklar',
            (progress) => setUploadProgress(progress)
          );
          toast.success(`${fotografURLleri.length} fotoğraf başarıyla yüklendi`, {
            id: uploadToast
          });
        } catch (error: any) {
          console.error('Fotoğraf yükleme hatası:', error);
          // Eğer hata izinlerden kaynaklanıyorsa özel mesaj göster
          if (error.code === 'storage/unauthorized' || error.message.includes('yetkiniz bulunmamaktadır')) {
            toast.error('Fotoğraf yükleme için yetkiniz bulunmamaktadır. Lütfen yöneticinize başvurun.');
            setYukleniyor(false);
            return; // Hata durumunda işlemi sonlandır
          } else {
            toast.error(`Fotoğraf yükleme hatası: ${error.message}`);
            // Fotoğraf olmadan devam et
            console.log('Fotoğraf yükleme hatası oluştu, fotoğrafsız devam ediliyor');
          }
        }
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
        ...(fotografURLleri.length > 0 && { fotograflar: fotografURLleri })
      };

      if (duzenlemeModu && secilenStok) {
        await updateDoc(doc(db, 'stoklar', secilenStok.id), stokData);
        toast.success('Stok başarıyla güncellendi');
      } else {
        await addDoc(collection(db, 'stoklar'), {
          ...stokData,
          olusturanKisi: {
            id: kullanici.id,
            ad: kullanici.ad
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
      
      // Stok listesini yenile
      const stokQuery = query(
        collection(db, 'stoklar'),
        where('companyId', '==', kullanici.companyId)
      );
      const snapshot = await getDocs(stokQuery);
      const stokVerileri = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StokItem[];
      setStoklar(stokVerileri);
      
    } catch (error: any) {
      console.error('Stok işlemi hatası:', error);
      toast.error(duzenlemeModu ? 'Stok güncellenirken bir hata oluştu' : 'Stok eklenirken bir hata oluştu');
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
      fotograflar: []
    });
    setDuzenlemeModu(true);
    setFormAcik(true);
  };

  const filtrelenmisStoklar = stoklar.filter(stok => {
    const aramaFiltreleme = !aramaMetni ||
      stok.urunAdi.toLowerCase().includes(aramaMetni.toLowerCase()) ||
      stok.aciklama?.toLowerCase().includes(aramaMetni.toLowerCase());
    const kategoriFiltreleme = !secilenKategori || stok.kategori === secilenKategori;

    return aramaFiltreleme && kategoriFiltreleme;
  });

  const kritikSeviyedeOlanlar = filtrelenmisStoklar.filter(stok => stok.miktar <= stok.kritikSeviye).length;
  const toplamStokAdedi = filtrelenmisStoklar.reduce((total, stok) => total + stok.miktar, 0);
  const toplamStokCesidi = filtrelenmisStoklar.length;
  const normalStokAdedi = filtrelenmisStoklar.filter(stok => stok.miktar > stok.kritikSeviye).length;
  const [detayModalAcik, setDetayModalAcik] = useState(false);
  const [secilenDetay, setSecilenDetay] = useState<StokItem | null>(null);

  if (yukleniyor && stoklar.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">Stok Kontrol</h1>
          <p className="mt-1 text-sm text-gray-500">
            Toplam {filtrelenmisStoklar.length} ürün
            {kritikSeviyedeOlanlar > 0 && (
              <span className="ml-2 text-red-600">
                ({kritikSeviyedeOlanlar} ürün kritik seviyede)
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
                sahaId: '',
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
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            Yeni Stok Ekle
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Toplam Stok Çeşidi</p>
              <h3 className="text-xl font-bold text-gray-900">{toplamStokCesidi}</h3>
            </div>
            <div className="rounded-full p-3 bg-blue-100">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Toplam Ürün Adedi</p>
              <h3 className="text-xl font-bold text-gray-900">{toplamStokAdedi}</h3>
            </div>
            <div className="rounded-full p-3 bg-green-100">
              <Package className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Normal Seviyede</p>
              <h3 className="text-xl font-bold text-green-600">{normalStokAdedi}</h3>
            </div>
            <div className="rounded-full p-3 bg-green-100">
              <Package className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Kritik Seviyede</p>
              <h3 className="text-xl font-bold text-red-600">{kritikSeviyedeOlanlar}</h3>
            </div>
            <div className="rounded-full p-3 bg-red-100">
              <Package className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchInput
            value={aramaMetni}
            onChange={setAramaMetni}
            placeholder="Stok ara..."
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
          <select
            value={secilenKategori}
            onChange={(e) => setSecilenKategori(e.target.value)}
            className="rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
          >
            <option value="">Tüm Kategoriler</option>
            {stokKategorileri.map(kategori => (
              <option key={kategori} value={kategori}>{kategori}</option>
            ))}
          </select>
        </div>
      </div>

      {formAcik && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {duzenlemeModu ? 'Stok Güncelle' : 'Yeni Stok Ekle'}
                </h2>
                <button
                  onClick={() => setFormAcik(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="sahaId" className="block text-sm font-medium text-gray-700">
                      Saha
                    </label>
                    <select
                      id="sahaId"
                      value={form.sahaId}
                      onChange={(e) => setForm({ ...form, sahaId: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                      required
                    >
                      <option value="">Saha Seçin</option>
                      {sahalar.map(saha => (
                        <option key={saha.id} value={saha.id}>{saha.ad}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="kategori" className="block text-sm font-medium text-gray-700">
                      Kategori
                    </label>
                    <select
                      id="kategori"
                      value={form.kategori}
                      onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                    >
                      <option value="">Kategori Seçin</option>
                      {stokKategorileri.map(kategori => (
                        <option key={kategori} value={kategori}>{kategori}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="urunAdi" className="block text-sm font-medium text-gray-700">
                      Ürün Adı
                    </label>
                    <input
                      type="text"
                      id="urunAdi"
                      value={form.urunAdi}
                      onChange={(e) => setForm({ ...form, urunAdi: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="miktar" className="block text-sm font-medium text-gray-700">
                      Miktar
                    </label>
                    <input
                      type="number"
                      id="miktar"
                      min="0"
                      value={form.miktar}
                      onChange={(e) => setForm({ ...form, miktar: parseInt(e.target.value) || 0 })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="birim" className="block text-sm font-medium text-gray-700">
                      Birim
                    </label>
                    <input
                      type="text"
                      id="birim"
                      value={form.birim}
                      onChange={(e) => setForm({ ...form, birim: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                      placeholder="Adet, kg, m, vb."
                    />
                  </div>
                  <div>
                    <label htmlFor="kritikSeviye" className="block text-sm font-medium text-gray-700">
                      Kritik Seviye
                    </label>
                    <input
                      type="number"
                      id="kritikSeviye"
                      min="0"
                      value={form.kritikSeviye}
                      onChange={(e) => setForm({ ...form, kritikSeviye: parseInt(e.target.value) || 0 })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="aciklama" className="block text-sm font-medium text-gray-700">
                    Açıklama
                  </label>
                  <textarea
                    id="aciklama"
                    value={form.aciklama}
                    onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  />
                  </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fotoğraflar
                  </label>
                  <FileUploadZone
                    onFileSelect={(files) => setForm({ ...form, fotograflar: [...form.fotograflar, ...files] })}
                    selectedFiles={form.fotograflar}
                    onFileRemove={(index) => {
                      const newFiles = [...form.fotograflar];
                      newFiles.splice(index, 1);
                      setForm({ ...form, fotograflar: newFiles });
                    }}
                    uploadProgress={uploadProgress}
                    disabled={!canUploadPhotos} // Fotoğraf yükleme yetkisi kontrolü
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setFormAcik(false)}
                    className="mr-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700"
                  >
                    {duzenlemeModu ? 'Güncelle' : 'Kaydet'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ürün
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kategori
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Miktar
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kritik Seviye
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Saha
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Son Güncelleme
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtrelenmisStoklar.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                  Stok bulunamadı
                </td>
              </tr>
            ) : (
              filtrelenmisStoklar.map((stok) => (
                <tr 
                  key={stok.id} 
                  className={`${stok.miktar <= stok.kritikSeviye ? "bg-red-50" : ""} cursor-pointer hover:bg-gray-50`}
                  onClick={() => {
                    setSecilenDetay(stok);
                    setDetayModalAcik(true);
                  }}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {stok.fotograflar && stok.fotograflar.length > 0 ? (
                        <div className="flex-shrink-0 h-10 w-10 mr-3">
                          <img
                            className="h-10 w-10 rounded-md object-cover"
                            src={stok.fotograflar[0]}
                            alt={stok.urunAdi}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/placeholder-image.png';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex-shrink-0 h-10 w-10 mr-3 bg-gray-200 rounded-md flex items-center justify-center">
                          <Package className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{stok.urunAdi}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stok.kategori || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {stok.miktar} {stok.birim}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {stok.kritikSeviye} {stok.birim}
                    </div>
                    {stok.miktar <= stok.kritikSeviye && (
                      <div className="mt-1 flex items-center text-xs text-red-600">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Kritik seviyede
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {sahalar.find(s => s.id === stok.sahaId)?.ad || stok.sahaId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stok.sonGuncelleme ? format(stok.sonGuncelleme.toDate(), 'dd MMMM yyyy, HH:mm', { locale: tr }) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex items-center justify-center space-x-3" onClick={(e) => e.stopPropagation()}>
                      {canEdit && (
                        <button onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(stok);
                        }} className="text-indigo-600 hover:text-indigo-900">
                          <Edit2 className="h-5 w-5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(stok.id);
                        }} className="text-red-600 hover:text-red-900">
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

      {detayModalAcik && secilenDetay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Stok Detayları
                </h2>
                <button
                  onClick={() => {
                    setDetayModalAcik(false);
                    setSecilenDetay(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">Ürün Adı</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{secilenDetay.urunAdi}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Kategori</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{secilenDetay.kategori || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Miktar</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {secilenDetay.miktar} {secilenDetay.birim}
                    {secilenDetay.miktar <= secilenDetay.kritikSeviye && (
                      <span className="ml-2 text-sm text-red-600 font-normal inline-flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        Kritik seviyede
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Kritik Seviye</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{secilenDetay.kritikSeviye} {secilenDetay.birim}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Saha</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {sahalar.find(s => s.id === secilenDetay.sahaId)?.ad || secilenDetay.sahaId}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Son Güncelleme</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {secilenDetay.sonGuncelleme ? format(secilenDetay.sonGuncelleme.toDate(), 'dd MMMM yyyy, HH:mm', { locale: tr }) : '-'}
                  </p>
                </div>
              </div>
              {secilenDetay.aciklama && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Açıklama</p>
                  <p className="mt-1 text-gray-900 whitespace-pre-line">{secilenDetay.aciklama}</p>
                </div>
              )}
              {secilenDetay.fotograflar && secilenDetay.fotograflar.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Fotoğraflar</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {secilenDetay.fotograflar.map((url, index) => (
                      <div key={index} className="relative">
                        <img
                          src={url}
                          alt={`${secilenDetay.urunAdi} ${index + 1}`}
                          className="h-40 w-full object-cover rounded-lg"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/placeholder-image.png';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                {canEdit && (
                  <button
                    onClick={() => {
                      handleEdit(secilenDetay);
                      setDetayModalAcik(false);
                    }}
                    className="mr-3 inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Düzenle
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => {
                      handleDelete(secilenDetay.id);
                      setDetayModalAcik(false);
                    }}
                    className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Sil
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};