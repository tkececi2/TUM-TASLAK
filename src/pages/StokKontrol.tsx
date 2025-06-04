
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, addDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, auth, storage } from '../lib/firebase';
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
  BarChart,
  Eye,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Building2,
  Package2
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

  const canAdd = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);
  const canDelete = kullanici?.rol === 'yonetici';
  const canEdit = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);

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
            setSahalar([]);
            return;
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
        const baseQueryConstraints = [where('companyId', '==', kullanici.companyId)];

        if (kullanici.rol === 'musteri') {
          if (!kullanici.sahalar || kullanici.sahalar.length === 0) {
            setStoklar([]);
            setYukleniyor(false);
            return;
          }
          if (secilenSaha) {
            if (!kullanici.sahalar.includes(secilenSaha)) {
              setStoklar([]);
              setYukleniyor(false);
              return;
            }
            stokQuery = query(collection(db, 'stoklar'), ...baseQueryConstraints, where('sahaId', '==', secilenSaha));
          } else {
            stokQuery = query(collection(db, 'stoklar'), ...baseQueryConstraints, where('sahaId', 'in', kullanici.sahalar));
          }
        } else {
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
    if (!kullanici || !canAdd) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }

    if (!form.sahaId || !form.urunAdi || form.miktar < 0) {
      toast.error('Lütfen saha, ürün adı ve miktar gibi gerekli alanları doldurun');
      return;
    }

    setYukleniyor(true);
    let fotografURLleri: string[] = [];

    try {
      if (form.fotograflar.length > 0) {
        const uploadToast = toast.loading('Fotoğraflar yükleniyor...');
        try {
          if (auth.currentUser) {
            await auth.currentUser.getIdToken(true);
            const idTokenResult = await auth.currentUser.getIdTokenResult();
            console.log('Token yenilendi, mevcut rol:', idTokenResult.claims.rol || 'rol yok');
          } else {
            console.warn('Dosya yükleme için oturum açık değil');
            toast.error('Dosya yüklemek için oturum açık olmalıdır');
            toast.dismiss(uploadToast);
            return;
          }

          fotografURLleri = await uploadMultipleFiles(
            form.fotograflar,
            'stoklar',
            (progress) => setUploadProgress(progress)
          );
          toast.success(`${fotografURLleri.length} fotoğraf başarıyla yüklendi`, {
            id: uploadToast
          });
        } catch (error: any) {
          console.error('Fotoğraf yükleme hatası (handleSubmit içinde):', error);
          toast.error(error.message || 'Fotoğraf yüklenirken bilinmeyen bir hata oluştu.', {
            id: uploadToast
          });
          console.log('Fotoğraf yükleme hatası oluştu, fotoğrafsız devam ediliyor (veya kısmi fotoğrafla).');
        }
      }

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
            ad: kullanici.ad || kullanici.email || 'Bilinmeyen Kullanıcı'
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

      const stokQuery = secilenSaha 
        ? query(collection(db, 'stoklar'), where('companyId', '==', kullanici.companyId), where('sahaId', '==', secilenSaha))
        : query(collection(db, 'stoklar'), where('companyId', '==', kullanici.companyId));
      const snapshot = await getDocs(stokQuery);
      const stokVerileri = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StokItem[];
      setStoklar(stokVerileri);

    } catch (error: any) {
      console.error('Stok işlemi genel hatası:', error);
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
      fotograflar: []
    });
    setDuzenlemeModu(true);
    setFormAcik(true);
  };

  const filtrelenmisStoklar = stoklar.filter(stok => {
    const aramaFiltreleme = !aramaMetni || 
      stok.urunAdi.toLowerCase().includes(aramaMetni.toLowerCase()) ||
      (stok.aciklama && stok.aciklama.toLowerCase().includes(aramaMetni.toLowerCase()));

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Header Section */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Stok Yönetimi</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Envanter ve malzeme stokunu takip edin ve yönetin
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 lg:mt-0 lg:ml-6">
              {canAdd && (
                <button
                  onClick={() => {
                    setDuzenlemeModu(false);
                    setSecilenStok(null);
                    setForm({
                      sahaId: secilenSaha || (sahalar.length > 0 ? sahalar[0].id : ''),
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
                  className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Yeni Stok Kaydı
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Toplam Ürün Çeşidi</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{toplamStokCesidi}</p>
              </div>
              <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <Package2 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Toplam Stok Adedi</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{toplamStokAdedi}</p>
              </div>
              <div className="h-12 w-12 bg-indigo-50 rounded-lg flex items-center justify-center">
                <BarChart className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Normal Seviye</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{normalStokAdedi}</p>
              </div>
              <div className="h-12 w-12 bg-green-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Kritik Seviye</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{kritikSeviyedeOlanlar}</p>
              </div>
              <div className="h-12 w-12 bg-red-50 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1">
              <SearchInput
                value={aramaMetni}
                onChange={setAramaMetni}
                placeholder="Ürün adı, kategori veya açıklamada ara..."
                className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <select
                value={secilenSaha}
                onChange={(e) => setSecilenSaha(e.target.value)}
                className="rounded-lg border-gray-200 text-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
                disabled={kullanici?.rol === 'musteri' && sahalar.length <= 1 && !!secilenSaha}
              >
                <option value="">Tüm Sahalar</option>
                {sahalar.map(saha => (
                  <option key={saha.id} value={saha.id}>{saha.ad}</option>
                ))}
              </select>

              <select
                value={secilenKategori}
                onChange={(e) => setSecilenKategori(e.target.value)}
                className="rounded-lg border-gray-200 text-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white"
              >
                <option value="">Tüm Kategoriler</option>
                {stokKategorileri.map(kategori => (
                  <option key={kategori} value={kategori}>{kategori}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {yukleniyor && stoklar.length > 0 && (
          <div className="flex justify-center items-center py-12 bg-white rounded-xl shadow-sm">
            <LoadingSpinner text="Stoklar güncelleniyor..." />
          </div>
        )}

        {!yukleniyor && filtrelenmisStoklar.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <div className="mx-auto h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Package className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Stok bulunamadı</h3>
            <p className="text-gray-500">
              {stoklar.length === 0 ? 'Henüz hiç stok eklenmemiş.' : 'Filtrelere uygun stok bulunamadı.'}
            </p>
            {canAdd && stoklar.length === 0 && (
              <button
                onClick={() => setFormAcik(true)}
                className="mt-4 inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl"
              >
                <Plus className="h-5 w-5 mr-2" />
                İlk Stoğu Ekle
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtrelenmisStoklar.map((stok) => (
              <div 
                key={stok.id}
                className={`group relative bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] overflow-hidden cursor-pointer ${
                  stok.miktar <= stok.kritikSeviye 
                    ? 'border-red-200 bg-gradient-to-br from-red-50 to-orange-50' 
                    : 'hover:border-blue-300'
                }`}
                onClick={() => {
                  setSecilenDetay(stok);
                  setDetayModalAcik(true);
                }}
              >
                {/* Resim veya Placeholder */}
                <div className="aspect-video bg-gray-100 relative">
                  {stok.fotograflar && stok.fotograflar.length > 0 ? (
                    <img
                      src={stok.fotograflar[0]}
                      alt={stok.urunAdi}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://via.placeholder.com/300x200?text=Resim+Yok';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Durum Badge */}
                  <div className="absolute top-3 left-3">
                    {stok.miktar <= stok.kritikSeviye ? (
                      <span className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full shadow-sm">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Kritik
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full shadow-sm">
                        <Check className="h-3 w-3 mr-1" />
                        Normal
                      </span>
                    )}
                  </div>

                  {stok.fotograflar && stok.fotograflar.length > 1 && (
                    <div className="absolute top-3 right-3 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full">
                      +{stok.fotograflar.length - 1}
                    </div>
                  )}
                </div>

                {/* İçerik */}
                <div className="p-5">
                  <h3 className="text-lg font-medium text-gray-900 mb-2 line-clamp-2">{stok.urunAdi}</h3>
                  
                  <div className="flex items-center text-sm text-gray-600 mb-2">
                    <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="truncate">{sahalar.find(s => s.id === stok.sahaId)?.ad || 'Bilinmeyen Saha'}</span>
                  </div>
                  
                  {stok.kategori && (
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-lg mb-3">
                      {stok.kategori}
                    </span>
                  )}

                  {/* Miktar Bilgisi */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">Mevcut Stok</span>
                      <span className={`text-lg font-bold ${
                        stok.miktar <= stok.kritikSeviye ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {stok.miktar} {stok.birim}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Kritik Seviye</span>
                      <span className="text-sm font-medium text-gray-700">
                        {stok.kritikSeviye} {stok.birim}
                      </span>
                    </div>
                  </div>

                  {/* Açıklama */}
                  {stok.aciklama && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {stok.aciklama}
                    </p>
                  )}

                  {/* Son Güncelleme */}
                  <div className="text-xs text-gray-500 mb-3">
                    Son güncelleme: {stok.sonGuncelleme ? format(stok.sonGuncelleme.toDate(), 'dd MMM yyyy', { locale: tr }) : '-'}
                  </div>

                  {/* Aksiyon Butonları */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setSecilenDetay(stok); 
                        setDetayModalAcik(true); 
                      }}
                      className="inline-flex items-center px-3 py-2 text-blue-600 hover:text-blue-800 font-medium text-sm rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Detay
                    </button>
                    
                    <div className="flex items-center space-x-2">
                      {canEdit && (
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleEdit(stok); 
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Düzenle"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleDelete(stok.id); 
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 text-gray-600 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hover Aksiyon Butonları */}
                {(canEdit || canDelete) && (
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1">
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(stok);
                        }}
                        className="p-1.5 bg-white rounded-full shadow-lg hover:bg-blue-50 transition-colors duration-200"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(stok.id);
                        }}
                        className="p-1.5 bg-white rounded-full shadow-lg hover:bg-red-50 transition-colors duration-200"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {formAcik && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {duzenlemeModu ? 'Stok Düzenle' : 'Yeni Stok Ekle'}
                </h2>
                <button 
                  onClick={() => setFormAcik(false)} 
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Saha *
                    </label>
                    <select
                      value={form.sahaId}
                      onChange={(e) => setForm(prev => ({ ...prev, sahaId: e.target.value }))}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="" disabled>Saha Seçin</option>
                      {sahalar.map(saha => (
                        <option key={saha.id} value={saha.id}>{saha.ad}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Ürün Adı *
                    </label>
                    <input
                      type="text"
                      value={form.urunAdi}
                      onChange={(e) => setForm(prev => ({ ...prev, urunAdi: e.target.value }))}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ürün adını girin"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Miktar *
                    </label>
                    <input
                      type="number"
                      value={form.miktar}
                      onChange={(e) => setForm(prev => ({ ...prev, miktar: parseInt(e.target.value, 10) >= 0 ? parseInt(e.target.value, 10) : 0 }))}
                      min="0"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Birim
                    </label>
                    <input
                      type="text"
                      value={form.birim}
                      onChange={(e) => setForm(prev => ({ ...prev, birim: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="adet, kg, m, vb."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Kritik Seviye
                    </label>
                    <input
                      type="number"
                      value={form.kritikSeviye}
                      onChange={(e) => setForm(prev => ({ ...prev, kritikSeviye: parseInt(e.target.value, 10) >= 0 ? parseInt(e.target.value, 10) : 0 }))}
                      min="0"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Kategori
                    </label>
                    <select
                      value={form.kategori}
                      onChange={(e) => setForm(prev => ({ ...prev, kategori: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Kategori Seçin (Opsiyonel)</option>
                      {stokKategorileri.map(kat => (
                        <option key={kat} value={kat}>{kat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Açıklama
                    </label>
                    <textarea
                      rows={3}
                      value={form.aciklama}
                      onChange={(e) => setForm(prev => ({ ...prev, aciklama: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="İsteğe bağlı açıklama ekleyin"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Fotoğraflar
                    </label>
                    <FileUploadZone
                      onFileSelect={(files) => setForm(prev => ({ ...prev, fotograflar: [...prev.fotograflar, ...files].slice(0,5) }))}
                      selectedFiles={form.fotograflar}
                      onFileRemove={(index) => setForm(prev => ({ ...prev, fotograflar: prev.fotograflar.filter((_, i) => i !== index) }))}
                      uploadProgress={uploadProgress}
                      maxFiles={5}
                    />
                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="mt-2">
                        <div className="bg-blue-100 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p className="text-sm text-blue-600 mt-1">Yükleniyor: {Math.round(uploadProgress)}%</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setFormAcik(false)}
                    className="px-6 py-3 text-gray-700 font-semibold rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={yukleniyor}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 transition-all"
                  >
                    {yukleniyor ? (
                      <div className="flex items-center">
                        <LoadingSpinner size="sm" />
                        <span className="ml-2">{duzenlemeModu ? 'Güncelleniyor...' : 'Kaydediliyor...'}</span>
                      </div>
                    ) : (
                      duzenlemeModu ? 'Değişiklikleri Kaydet' : 'Stok Ekle'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Detay Modal */}
      {detayModalAcik && secilenDetay && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">{secilenDetay.urunAdi}</h3>
                <button 
                  onClick={() => setDetayModalAcik(false)} 
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Saha</label>
                    <p className="text-gray-900 font-medium">
                      {sahalar.find(s => s.id === secilenDetay.sahaId)?.ad || 'Bilinmeyen'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Kategori</label>
                    <p className="text-gray-900 font-medium">
                      {secilenDetay.kategori || 'Belirtilmemiş'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Miktar</label>
                    <p className="text-gray-900 font-medium">
                      {secilenDetay.miktar} {secilenDetay.birim}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Kritik Seviye</label>
                    <p className="text-gray-900 font-medium">{secilenDetay.kritikSeviye}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Son Güncelleme</label>
                    <p className="text-gray-900 font-medium">
                      {secilenDetay.sonGuncelleme ? format(secilenDetay.sonGuncelleme.toDate(), 'dd MMMM yyyy, HH:mm', { locale: tr }) : '-'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Oluşturan</label>
                    <p className="text-gray-900 font-medium">
                      {secilenDetay.olusturanKisi?.ad || 'Bilinmiyor'}
                    </p>
                  </div>
                </div>

                {secilenDetay.aciklama && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-semibold text-gray-700">Açıklama</label>
                    <p className="text-gray-900 mt-2 p-4 bg-gray-50 rounded-xl">
                      {secilenDetay.aciklama}
                    </p>
                  </div>
                )}

                {secilenDetay.fotograflar && secilenDetay.fotograflar.length > 0 && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-semibold text-gray-700 mb-3 block">Fotoğraflar</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {secilenDetay.fotograflar.map((url, index) => (
                        <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="group">
                          <img 
                            src={url} 
                            alt={`${secilenDetay.urunAdi} ${index+1}`} 
                            className="w-full h-24 object-cover rounded-xl border-2 border-gray-200 group-hover:border-blue-300 transition-colors"
                            onError={(e) => { 
                              const target = e.target as HTMLImageElement; 
                              target.src = 'https://via.placeholder.com/200?text=Hata'; 
                            }}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
