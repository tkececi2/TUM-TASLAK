
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
  Package, 
  X, 
  Edit2, 
  AlertTriangle, 
  CheckCircle, 
  BarChart3,
  Filter,
  Grid,
  List,
  TrendingUp,
  TrendingDown,
  Eye,
  Image as ImageIcon,
  Building2,
  Archive,
  ShoppingCart,
  Wrench,
  HardHat,
  Home,
  Shield,
  FileText,
  MoreHorizontal
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
  marka?: string;
  model?: string;
  seriNo?: string;
  tedarikci?: string;
  alisFiyati?: number;
  lokasyon?: string;
}

const stokKategorileri = [
  { id: 'invertor', ad: 'İnvertör', ikon: BarChart3, renk: 'blue' },
  { id: 'panel', ad: 'Güneş Paneli', ikon: Grid, renk: 'yellow' },
  { id: 'kablo', ad: 'Kablo ve Bağlantı', ikon: Archive, renk: 'green' },
  { id: 'mekanik', ad: 'Mekanik Ekipman', ikon: Wrench, renk: 'purple' },
  { id: 'guvenlik', ad: 'Güvenlik Ekipmanı', ikon: Shield, renk: 'red' },
  { id: 'ofis', ad: 'Ofis Malzemesi', ikon: FileText, renk: 'gray' },
  { id: 'diger', ad: 'Diğer', ikon: Package, renk: 'indigo' }
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
  const [gorunumModu, setGorunumModu] = useState<'grid' | 'list'>('grid');
  const [detayModalAcik, setDetayModalAcik] = useState(false);
  const [secilenDetay, setSecilenDetay] = useState<StokItem | null>(null);
  const [form, setForm] = useState({
    sahaId: '',
    urunAdi: '',
    miktar: 0,
    birim: 'adet',
    kritikSeviye: 0,
    kategori: '',
    aciklama: '',
    marka: '',
    model: '',
    seriNo: '',
    tedarikci: '',
    alisFiyati: 0,
    lokasyon: '',
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
          await auth.currentUser?.getIdToken(true);
          
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
          toast.error(error.message || 'Fotoğraf yüklenirken bir hata oluştu.', {
            id: uploadToast
          });
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
        marka: form.marka,
        model: form.model,
        seriNo: form.seriNo,
        tedarikci: form.tedarikci,
        alisFiyati: form.alisFiyati,
        lokasyon: form.lokasyon,
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
      resetForm();
      
      // Stok listesini yenile
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
      console.error('Stok işlemi hatası:', error);
      if (!(error.message && (error.message.includes('yetkiniz bulunmamaktadır') || error.message.includes('Dosya yükleme başarısız')))) {
        toast.error(duzenlemeModu ? 'Stok güncellenirken bir hata oluştu' : 'Stok eklenirken bir hata oluştu');
      }
    } finally {
      setYukleniyor(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    setForm({
      sahaId: '',
      urunAdi: '',
      miktar: 0,
      birim: 'adet',
      kritikSeviye: 0,
      kategori: '',
      aciklama: '',
      marka: '',
      model: '',
      seriNo: '',
      tedarikci: '',
      alisFiyati: 0,
      lokasyon: '',
      fotograflar: []
    });
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
      marka: stok.marka || '',
      model: stok.model || '',
      seriNo: stok.seriNo || '',
      tedarikci: stok.tedarikci || '',
      alisFiyati: stok.alisFiyati || 0,
      lokasyon: stok.lokasyon || '',
      fotograflar: []
    });
    setDuzenlemeModu(true);
    setFormAcik(true);
  };

  const filtrelenmisStoklar = stoklar.filter(stok => {
    const aramaFiltreleme = !aramaMetni || 
      stok.urunAdi.toLowerCase().includes(aramaMetni.toLowerCase()) ||
      (stok.aciklama && stok.aciklama.toLowerCase().includes(aramaMetni.toLowerCase())) ||
      (stok.marka && stok.marka.toLowerCase().includes(aramaMetni.toLowerCase())) ||
      (stok.model && stok.model.toLowerCase().includes(aramaMetni.toLowerCase()));
    
    const kategoriFiltreleme = !secilenKategori || stok.kategori === secilenKategori;
    
    return aramaFiltreleme && kategoriFiltreleme;
  });

  const kritikSeviyedeOlanlar = filtrelenmisStoklar.filter(stok => stok.miktar <= stok.kritikSeviye).length;
  const toplamStokAdedi = filtrelenmisStoklar.reduce((total, stok) => total + stok.miktar, 0);
  const toplamStokCesidi = filtrelenmisStoklar.length;
  const normalStokAdedi = filtrelenmisStoklar.filter(stok => stok.miktar > stok.kritikSeviye).length;
  const toplamDeger = filtrelenmisStoklar.reduce((total, stok) => total + (stok.alisFiyati || 0) * stok.miktar, 0);

  const getKategoriIkon = (kategoriId: string) => {
    const kategori = stokKategorileri.find(k => k.id === kategoriId);
    return kategori ? kategori.ikon : Package;
  };

  const getKategoriRenk = (kategoriId: string) => {
    const kategori = stokKategorileri.find(k => k.id === kategoriId);
    return kategori ? kategori.renk : 'gray';
  };

  if (yukleniyor && stoklar.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Stok Yönetimi</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Toplam <span className="font-semibold text-gray-700">{filtrelenmisStoklar.length}</span> ürün listeleniyor
                    {kritikSeviyedeOlanlar > 0 && (
                      <span className="ml-2 text-red-600 font-medium">
                        • {kritikSeviyedeOlanlar} ürün kritik seviyede!
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-4 lg:mt-0 flex items-center space-x-3">
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setGorunumModu('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    gorunumModu === 'grid' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setGorunumModu('list')}
                  className={`p-2 rounded-md transition-colors ${
                    gorunumModu === 'list' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
              
              {canAdd && (
                <button
                  onClick={() => {
                    setDuzenlemeModu(false);
                    setSecilenStok(null);
                    resetForm();
                    setForm(prev => ({
                      ...prev,
                      sahaId: secilenSaha || (sahalar.length > 0 ? sahalar[0].id : '')
                    }));
                    setFormAcik(true);
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Stok Ekle
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* İstatistik Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Toplam Çeşit</p>
                <p className="text-2xl font-bold text-gray-900">{toplamStokCesidi}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Archive className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Toplam Adet</p>
                <p className="text-2xl font-bold text-gray-900">{toplamStokAdedi}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Package className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Normal Seviye</p>
                <p className="text-2xl font-bold text-green-600">{normalStokAdedi}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Kritik Seviye</p>
                <p className="text-2xl font-bold text-red-600">{kritikSeviyedeOlanlar}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Toplam Değer</p>
                <p className="text-2xl font-bold text-purple-600">₺{toplamDeger.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filtreler */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={aramaMetni}
                onChange={setAramaMetni}
                placeholder="Ürün adı, marka, model veya açıklamada ara..."
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <select
                value={secilenSaha}
                onChange={(e) => setSecilenSaha(e.target.value)}
                className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
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
                className="rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              >
                <option value="">Tüm Kategoriler</option>
                {stokKategorileri.map(kategori => (
                  <option key={kategori.id} value={kategori.id}>{kategori.ad}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stok Listesi */}
        {yukleniyor && stoklar.length > 0 && (
          <div className="my-4 text-center">
            <LoadingSpinner text="Stoklar güncelleniyor..." />
          </div>
        )}

        {gorunumModu === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {!yukleniyor && filtrelenmisStoklar.length === 0 ? (
              <div className="col-span-full">
                <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
                  <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Stok bulunamadı</h3>
                  <p className="text-gray-500">
                    {stoklar.length === 0 ? 'Henüz hiç stok eklenmemiş.' : 'Filtrelerinize uygun stok bulunamadı.'}
                  </p>
                </div>
              </div>
            ) : (
              filtrelenmisStoklar.map((stok) => {
                const KategoriIkon = getKategoriIkon(stok.kategori || '');
                const kritikDurum = stok.miktar <= stok.kritikSeviye;
                
                return (
                  <div
                    key={stok.id}
                    className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-200 hover:shadow-md ${
                      kritikDurum ? 'border-red-200 bg-red-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="p-6">
                      {/* Üst Kısım */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          {stok.fotograflar && stok.fotograflar.length > 0 ? (
                            <img
                              className="w-12 h-12 rounded-lg object-cover border-2 border-gray-200"
                              src={stok.fotograflar[0]}
                              alt={stok.urunAdi}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-${getKategoriRenk(stok.kategori || '')}-100 ${
                            stok.fotograflar && stok.fotograflar.length > 0 ? 'hidden' : ''
                          }`}>
                            <KategoriIkon className={`h-6 w-6 text-${getKategoriRenk(stok.kategori || '')}-600`} />
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => { setSecilenDetay(stok); setDetayModalAcik(true); }}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Detayları Gör"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleEdit(stok)}
                              className="p-2 text-gray-400 hover:text-yellow-600 transition-colors"
                              title="Düzenle"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(stok.id)}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                              title="Sil"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Ürün Bilgileri */}
                      <div className="mb-4">
                        <h3 className="font-semibold text-gray-900 truncate mb-1">{stok.urunAdi}</h3>
                        {stok.marka && (
                          <p className="text-sm text-gray-600">{stok.marka} {stok.model && `- ${stok.model}`}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {sahalar.find(s => s.id === stok.sahaId)?.ad || 'Bilinmeyen Saha'}
                        </p>
                      </div>

                      {/* Miktar ve Durum */}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className={`text-lg font-bold ${kritikDurum ? 'text-red-600' : 'text-gray-900'}`}>
                            {stok.miktar} {stok.birim}
                          </div>
                          <div className="text-xs text-gray-500">
                            Kritik: {stok.kritikSeviye} {stok.birim}
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          kritikDurum 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {kritikDurum ? 'Kritik' : 'Normal'}
                        </div>
                      </div>

                      {/* Alt Bilgiler */}
                      {stok.alisFiyati && stok.alisFiyati > 0 && (
                        <div className="text-sm text-gray-600 mb-2">
                          Birim Fiyat: <span className="font-medium">₺{stok.alisFiyati.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        {stok.sonGuncelleme ? format(stok.sonGuncelleme.toDate(), 'dd MMM yyyy', { locale: tr }) : '-'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          // Liste Görünümü
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Ürün', 'Kategori', 'Marka/Model', 'Miktar', 'Kritik Seviye', 'Saha', 'Son Güncelleme', 'İşlemler'].map(header => (
                      <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {!yukleniyor && filtrelenmisStoklar.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500">
                        <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <p>
                          {stoklar.length === 0 ? 'Henüz hiç stok eklenmemiş.' : 'Filtrelerinize uygun stok bulunamadı.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtrelenmisStoklar.map((stok) => {
                      const kritikDurum = stok.miktar <= stok.kritikSeviye;
                      const KategoriIkon = getKategoriIkon(stok.kategori || '');
                      
                      return (
                        <tr 
                          key={stok.id} 
                          className={`transition-colors ${kritikDurum ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {stok.fotograflar && stok.fotograflar.length > 0 ? (
                                <img
                                  className="h-10 w-10 rounded-lg object-cover mr-3 border border-gray-200"
                                  src={stok.fotograflar[0]}
                                  alt={stok.urunAdi}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = 'https://via.placeholder.com/40?text=Hata';
                                  }}
                                />
                              ) : (
                                <div className={`flex-shrink-0 h-10 w-10 mr-3 bg-${getKategoriRenk(stok.kategori || '')}-100 rounded-lg flex items-center justify-center`}>
                                  <KategoriIkon className={`h-5 w-5 text-${getKategoriRenk(stok.kategori || '')}-600`} />
                                </div>
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900">{stok.urunAdi}</div>
                                {stok.aciklama && <div className="text-xs text-gray-500 truncate max-w-xs">{stok.aciklama}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-500">
                              {stokKategorileri.find(k => k.id === stok.kategori)?.ad || stok.kategori || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{stok.marka || '-'}</div>
                            {stok.model && <div className="text-xs text-gray-500">{stok.model}</div>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-semibold ${kritikDurum ? 'text-red-600' : 'text-gray-900'}`}>
                              {stok.miktar}
                            </span>
                            <span className="text-xs text-gray-500 ml-1">{stok.birim}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stok.kritikSeviye}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {sahalar.find(s => s.id === stok.sahaId)?.ad || 'Bilinmeyen Saha'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {stok.sonGuncelleme ? format(stok.sonGuncelleme.toDate(), 'dd MMM yyyy', { locale: tr }) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={() => { setSecilenDetay(stok); setDetayModalAcik(true); }}
                                className="text-blue-600 hover:text-blue-800 transition-colors p-1" 
                                title="Detayları Gör"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {canEdit && (
                                <button 
                                  onClick={() => handleEdit(stok)}
                                  className="text-yellow-600 hover:text-yellow-800 transition-colors p-1" 
                                  title="Düzenle"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                              )}
                              {canDelete && (
                                <button 
                                  onClick={() => handleDelete(stok.id)}
                                  className="text-red-600 hover:text-red-800 transition-colors p-1" 
                                  title="Sil"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Yeni Stok Ekleme / Düzenleme Formu (Modal) */}
        {formAcik && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white p-6 border-b border-gray-200 rounded-t-xl">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {duzenlemeModu ? 'Stok Düzenle' : 'Yeni Stok Ekle'}
                  </h2>
                  <button 
                    onClick={() => setFormAcik(false)} 
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Temel Bilgiler */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Saha *</label>
                    <select
                      value={form.sahaId}
                      onChange={(e) => setForm(prev => ({ ...prev, sahaId: e.target.value }))}
                      required
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="" disabled>Saha Seçin</option>
                      {sahalar.map(saha => (
                        <option key={saha.id} value={saha.id}>{saha.ad}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
                    <select
                      value={form.kategori}
                      onChange={(e) => setForm(prev => ({ ...prev, kategori: e.target.value }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Kategori Seçin</option>
                      {stokKategorileri.map(kategori => (
                        <option key={kategori.id} value={kategori.id}>{kategori.ad}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ürün Adı *</label>
                  <input
                    type="text"
                    value={form.urunAdi}
                    onChange={(e) => setForm(prev => ({ ...prev, urunAdi: e.target.value }))}
                    required
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Ürün adını giriniz"
                  />
                </div>

                {/* Marka ve Model */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Marka</label>
                    <input
                      type="text"
                      value={form.marka}
                      onChange={(e) => setForm(prev => ({ ...prev, marka: e.target.value }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Marka adı"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                    <input
                      type="text"
                      value={form.model}
                      onChange={(e) => setForm(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Model adı"
                    />
                  </div>
                </div>

                {/* Miktar Bilgileri */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Miktar *</label>
                    <input
                      type="number"
                      value={form.miktar}
                      onChange={(e) => setForm(prev => ({ ...prev, miktar: Math.max(0, parseInt(e.target.value) || 0) }))}
                      min="0"
                      required
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Birim</label>
                    <select
                      value={form.birim}
                      onChange={(e) => setForm(prev => ({ ...prev, birim: e.target.value }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="adet">Adet</option>
                      <option value="kg">Kilogram</option>
                      <option value="m">Metre</option>
                      <option value="m2">Metrekare</option>
                      <option value="lt">Litre</option>
                      <option value="paket">Paket</option>
                      <option value="kutu">Kutu</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Kritik Seviye</label>
                    <input
                      type="number"
                      value={form.kritikSeviye}
                      onChange={(e) => setForm(prev => ({ ...prev, kritikSeviye: Math.max(0, parseInt(e.target.value) || 0) }))}
                      min="0"
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Ek Bilgiler */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Seri No</label>
                    <input
                      type="text"
                      value={form.seriNo}
                      onChange={(e) => setForm(prev => ({ ...prev, seriNo: e.target.value }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Seri numarası"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tedarikçi</label>
                    <input
                      type="text"
                      value={form.tedarikci}
                      onChange={(e) => setForm(prev => ({ ...prev, tedarikci: e.target.value }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Tedarikçi firma"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Alış Fiyatı (₺)</label>
                    <input
                      type="number"
                      value={form.alisFiyati}
                      onChange={(e) => setForm(prev => ({ ...prev, alisFiyati: Math.max(0, parseFloat(e.target.value) || 0) }))}
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Lokasyon</label>
                    <input
                      type="text"
                      value={form.lokasyon}
                      onChange={(e) => setForm(prev => ({ ...prev, lokasyon: e.target.value }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Depo, raf, konum bilgisi"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                    <textarea
                      rows={3}
                      value={form.aciklama}
                      onChange={(e) => setForm(prev => ({ ...prev, aciklama: e.target.value }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Ek açıklamalar..."
                    />
                  </div>
                </div>

                {/* Fotoğraf Yükleme */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fotoğraflar</label>
                  <FileUploadZone
                    onFileSelect={(files) => setForm(prev => ({ ...prev, fotograflar: [...prev.fotograflar, ...files].slice(0,5) }))}
                    selectedFiles={form.fotograflar}
                    onFileRemove={(index) => setForm(prev => ({ ...prev, fotograflar: prev.fotograflar.filter((_, i) => i !== index) }))}
                    uploadProgress={uploadProgress}
                    maxFiles={5}
                  />
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-2">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-600 mt-1">Yükleniyor: {Math.round(uploadProgress)}%</p>
                    </div>
                  )}
                </div>

                {/* Form Butonları */}
                <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setFormAcik(false)}
                    className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={yukleniyor}
                    className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border border-transparent rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200"
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
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white p-6 border-b border-gray-200 rounded-t-xl">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">{secilenDetay.urunAdi} - Detayları</h3>
                  <button 
                    onClick={() => setDetayModalAcik(false)} 
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Temel Bilgiler */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Temel Bilgiler</h4>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Saha:</span> {sahalar.find(s => s.id === secilenDetay.sahaId)?.ad || 'Bilinmeyen'}</p>
                      <p><span className="font-medium">Kategori:</span> {stokKategorileri.find(k => k.id === secilenDetay.kategori)?.ad || secilenDetay.kategori || 'Belirtilmemiş'}</p>
                      <p><span className="font-medium">Miktar:</span> {secilenDetay.miktar} {secilenDetay.birim}</p>
                      <p><span className="font-medium">Kritik Seviye:</span> {secilenDetay.kritikSeviye} {secilenDetay.birim}</p>
                      {secilenDetay.lokasyon && <p><span className="font-medium">Lokasyon:</span> {secilenDetay.lokasyon}</p>}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Ürün Detayları</h4>
                    <div className="space-y-2 text-sm">
                      {secilenDetay.marka && <p><span className="font-medium">Marka:</span> {secilenDetay.marka}</p>}
                      {secilenDetay.model && <p><span className="font-medium">Model:</span> {secilenDetay.model}</p>}
                      {secilenDetay.seriNo && <p><span className="font-medium">Seri No:</span> {secilenDetay.seriNo}</p>}
                      {secilenDetay.tedarikci && <p><span className="font-medium">Tedarikçi:</span> {secilenDetay.tedarikci}</p>}
                      {secilenDetay.alisFiyati && secilenDetay.alisFiyati > 0 && (
                        <p><span className="font-medium">Alış Fiyatı:</span> ₺{secilenDetay.alisFiyati.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                </div>

                {secilenDetay.aciklama && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Açıklama</h4>
                    <p className="text-sm text-gray-600">{secilenDetay.aciklama}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Son Güncelleme</h4>
                    <p className="text-sm text-gray-600">
                      {secilenDetay.sonGuncelleme ? format(secilenDetay.sonGuncelleme.toDate(), 'dd MMMM yyyy, HH:mm', { locale: tr }) : '-'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Oluşturan</h4>
                    <p className="text-sm text-gray-600">{secilenDetay.olusturanKisi?.ad || 'Bilinmiyor'}</p>
                  </div>
                </div>

                {secilenDetay.fotograflar && secilenDetay.fotograflar.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Fotoğraflar</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {secilenDetay.fotograflar.map((url, index) => (
                        <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="group">
                          <img 
                            src={url} 
                            alt={`${secilenDetay.urunAdi} ${index+1}`} 
                            className="w-full h-24 object-cover rounded-lg border-2 border-gray-200 group-hover:border-blue-500 transition-colors"
                            onError={(e) => { 
                              const target = e.target as HTMLImageElement; 
                              target.src = 'https://via.placeholder.com/100?text=Hata'; 
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
        )}
      </div>
    </div>
  );
};
