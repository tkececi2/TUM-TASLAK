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
        if (kullanici.rol === 'musteri' && kullanici.sahalar && Array.isArray(kullanici.sahalar) && kullanici.sahalar.length > 0) {
          sahaQuery = query(
            collection(db, 'sahalar'),
            where('__name__', 'in', kullanici.sahalar)
          );
        } else if (kullanici.rol === 'musteri' && (!kullanici.sahalar || !Array.isArray(kullanici.sahalar) || kullanici.sahalar.length === 0)) {
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
          if (!kullanici.sahalar || !Array.isArray(kullanici.sahalar) || kullanici.sahalar.length === 0) {
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
      <div className="min-h-screen bg-gray-50">
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section - Matching ArizaYonetimi pattern */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Stok Yönetimi</h1>
                <p className="text-gray-600 text-sm">
                  Envanter ve malzeme stokunu takip edin ve yönetin
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
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
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Stok Kaydı
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section - Matching ArizaYonetimi pattern */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Package2 className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Toplam Çeşit</p>
                <p className="text-lg font-semibold text-gray-900">{toplamStokCesidi}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Toplam Adet</p>
                <p className="text-lg font-semibold text-gray-900">{toplamStokAdedi.toLocaleString('tr-TR')}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Normal Seviye</p>
                <p className="text-lg font-semibold text-green-600">{normalStokAdedi}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Kritik Seviye</p>
                <p className="text-lg font-semibold text-red-600">{kritikSeviyedeOlanlar}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section - Matching ArizaYonetimi pattern */}
      <div className="px-6 pb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row gap-4">
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

      {/* Content Area - Matching ArizaYonetimi pattern */}
      <div className="px-6">
        {yukleniyor && stoklar.length > 0 && (
          <div className="flex justify-center items-center py-12 bg-white rounded-lg border border-gray-200">
            <LoadingSpinner />
          </div>
        )}

        {!yukleniyor && filtrelenmisStoklar.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
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
                className="mt-4 inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                İlk Stoğu Ekle
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtrelenmisStoklar.map((stok) => (
              <div 
                key={stok.id}
                className={`bg-white border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${
                  stok.miktar <= stok.kritikSeviye 
                    ? 'ring-2 ring-red-200' 
                    : ''
                }`}
                onClick={() => {
                  setSecilenDetay(stok);
                  setDetayModalAcik(true);
                }}
              >
                {/* Image Section */}
                <div className="aspect-[4/3] bg-gray-100 relative">
                  {stok.fotograflar && stok.fotograflar.length > 0 ? (
                    <img
                      src={stok.fotograflar[0]}
                      alt={stok.urunAdi}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://via.placeholder.com/400x300?text=Resim+Yok';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className="absolute top-2 left-2">
                    {stok.miktar <= stok.kritikSeviye ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        Kritik
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Normal
                      </span>
                    )}
                  </div>

                  {stok.fotograflar && stok.fotograflar.length > 1 && (
                    <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                      +{stok.fotograflar.length - 1}
                    </div>
                  )}
                </div>

                {/* Content Section */}
                <div className="p-4 space-y-3">
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{stok.urunAdi}</h3>
                  
                  <div className="flex items-center text-xs text-gray-500">
                    <Building2 className="h-3 w-3 mr-1" />
                    <span className="truncate">{sahalar.find(s => s.id === stok.sahaId)?.ad || 'Bilinmeyen Saha'}</span>
                  </div>
                  
                  {stok.kategori && (
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                      {stok.kategori}
                    </span>
                  )}

                  {/* Stock Info */}
                  <div className="bg-gray-50 rounded p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Mevcut</span>
                      <span className={`font-medium ${
                        stok.miktar <= stok.kritikSeviye ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {stok.miktar.toLocaleString('tr-TR')} {stok.birim}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Kritik</span>
                      <span className="text-gray-700">
                        {stok.kritikSeviye.toLocaleString('tr-TR')} {stok.birim}
                      </span>
                    </div>
                  </div>

                  {/* Last Update */}
                  <div className="text-xs text-gray-500">
                    {stok.sonGuncelleme ? format(stok.sonGuncelleme.toDate(), 'dd MMM yyyy', { locale: tr }) : '-'}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setSecilenDetay(stok); 
                        setDetayModalAcik(true); 
                      }}
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                    >
                      Detay
                    </button>
                    
                    <div className="flex items-center space-x-1">
                      {canEdit && (
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleEdit(stok); 
                          }}
                          className="p-1 text-gray-600 hover:text-blue-600 rounded"
                          title="Düzenle"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleDelete(stok.id); 
                          }}
                          className="p-1 text-gray-600 hover:text-red-600 rounded"
                          title="Sil"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal - Consistent with ArizaYonetimi */}
      {formAcik && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-blue-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {duzenlemeModu ? 'Stok Düzenle' : 'Yeni Stok Ekle'}
                </h2>
                <button 
                  onClick={() => setFormAcik(false)} 
                  className="text-white hover:text-gray-200"
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
                    <label className="block text-sm font-medium text-gray-700">
                      Saha *
                    </label>
                    <select
                      value={form.sahaId}
                      onChange={(e) => setForm(prev => ({ ...prev, sahaId: e.target.value }))}
                      required
                      className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="" disabled>Saha Seçin</option>
                      {sahalar.map(saha => (
                        <option key={saha.id} value={saha.id}>{saha.ad}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Ürün Adı *
                    </label>
                    <input
                      type="text"
                      value={form.urunAdi}
                      onChange={(e) => setForm(prev => ({ ...prev, urunAdi: e.target.value }))}
                      required
                      className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Ürün adını girin"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Miktar *
                    </label>
                    <input
                      type="number"
                      value={form.miktar}
                      onChange={(e) => setForm(prev => ({ ...prev, miktar: parseInt(e.target.value, 10) >= 0 ? parseInt(e.target.value, 10) : 0 }))}
                      min="0"
                      required
                      className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Birim
                    </label>
                    <input
                      type="text"
                      value={form.birim}
                      onChange={(e) => setForm(prev => ({ ...prev, birim: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="adet, kg, m, vb."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Kritik Seviye
                    </label>
                    <input
                      type="number"
                      value={form.kritikSeviye}
                      onChange={(e) => setForm(prev => ({ ...prev, kritikSeviye: parseInt(e.target.value, 10) >= 0 ? parseInt(e.target.value, 10) : 0 }))}
                      min="0"
                      className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Kategori
                    </label>
                    <select
                      value={form.kategori}
                      onChange={(e) => setForm(prev => ({ ...prev, kategori: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Kategori Seçin (Opsiyonel)</option>
                      {stokKategorileri.map(kat => (
                        <option key={kat} value={kat}>{kat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Açıklama
                    </label>
                    <textarea
                      rows={3}
                      value={form.aciklama}
                      onChange={(e) => setForm(prev => ({ ...prev, aciklama: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="İsteğe bağlı açıklama ekleyin"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
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
                        <div className="bg-blue-200 rounded-full h-2">
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

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setFormAcik(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={yukleniyor}
                    className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {yukleniyor ? (
                      <div className="flex items-center">
                        <LoadingSpinner size="sm" />
                        <span className="ml-2">{duzenlemeModu ? 'Güncelleniyor...' : 'Kaydediliyor...'}</span>
                      </div>
                    ) : (
                      duzenlemeModu ? 'Güncelle' : 'Kaydet'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal - Consistent with ArizaYonetimi */}
      {detayModalAcik && secilenDetay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gray-800 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">{secilenDetay.urunAdi}</h3>
                <button 
                  onClick={() => setDetayModalAcik(false)} 
                  className="text-white hover:text-gray-200"
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
                    <label className="text-sm font-medium text-gray-500">Saha</label>
                    <p className="text-sm text-gray-900">
                      {sahalar.find(s => s.id === secilenDetay.sahaId)?.ad || 'Bilinmeyen'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Kategori</label>
                    <p className="text-sm text-gray-900">
                      {secilenDetay.kategori || 'Belirtilmemiş'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Miktar</label>
                    <p className="text-sm text-gray-900">
                      {secilenDetay.miktar.toLocaleString('tr-TR')} {secilenDetay.birim}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Kritik Seviye</label>
                    <p className="text-sm text-gray-900">{secilenDetay.kritikSeviye.toLocaleString('tr-TR')} {secilenDetay.birim}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Son Güncelleme</label>
                    <p className="text-sm text-gray-900">
                      {secilenDetay.sonGuncelleme ? format(secilenDetay.sonGuncelleme.toDate(), 'dd MMMM yyyy, HH:mm', { locale: tr }) : '-'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Oluşturan</label>
                    <p className="text-sm text-gray-900">
                      {secilenDetay.olusturanKisi?.ad || 'Bilinmiyor'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Durum</label>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      secilenDetay.miktar <= secilenDetay.kritikSeviye ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {secilenDetay.miktar <= secilenDetay.kritikSeviye ? 'Kritik Seviye' : 'Normal Seviye'}
                    </span>
                  </div>
                </div>

                {secilenDetay.aciklama && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500">Açıklama</label>
                    <p className="text-sm text-gray-900 mt-2 p-4 bg-gray-50 rounded-lg">
                      {secilenDetay.aciklama}
                    </p>
                  </div>
                )}

                {secilenDetay.fotograflar && secilenDetay.fotograflar.length > 0 && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-500 mb-3 block">Fotoğraflar</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {secilenDetay.fotograflar.map((url, index) => (
                        <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="group">
                          <img 
                            src={url} 
                            alt={`${secilenDetay.urunAdi} ${index+1}`} 
                            className="w-full h-24 object-cover rounded-lg border-2 border-gray-200 group-hover:border-blue-300 transition-colors"
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
