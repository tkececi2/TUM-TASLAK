import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, addDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { FileUploadZone } from '../components/FileUploadZone';
import { uploadMultipleFiles } from '../utils/uploadHelpers';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Sun, 
  Plus, 
  Trash2, 
  Edit2, 
  Building,
  MapPin,
  X,
  Save,
  Battery,
  Calendar,
  RefreshCw,
  DollarSign,
  Percent,
  Zap,
  TrendingUp,
  BarChart3,
  Settings,
  Briefcase
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { GesDetay } from '../types';

export const GesYonetimi: React.FC = () => {
  const { kullanici } = useAuth();
  const navigate = useNavigate();
  const [santraller, setSantraller] = useState<GesDetay[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [secilenSantral, setSecilenSantral] = useState<GesDetay | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [silmeOnayModalAcik, setSilmeOnayModalAcik] = useState(false);
  const [silinecekSantralId, setSilinecekSantralId] = useState<string | null>(null);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [fiyatFormAcik, setFiyatFormAcik] = useState(false);
  const [secilenFiyatSantral, setSecilenFiyatSantral] = useState<GesDetay | null>(null);

  const [form, setForm] = useState({
    ad: '',
    kurulumTarihi: format(new Date(), "yyyy-MM-dd"),
    konum: {
      lat: 0,
      lng: 0,
      adres: ''
    },
    kapasite: 0,
    panelSayisi: 0,
    inverterSayisi: 0,
    yillikHedefUretim: 0,
    fotograflar: [] as File[],
    teknikOzellikler: {
      panelTipi: '',
      inverterTipi: '',
      panelGucu: 0,
      sistemVerimi: 0
    },
    aylikHedefler: {
      ocak: 0,
      subat: 0,
      mart: 0,
      nisan: 0,
      mayis: 0,
      haziran: 0,
      temmuz: 0,
      agustos: 0,
      eylul: 0,
      ekim: 0,
      kasim: 0,
      aralik: 0
    }
  });

  const [fiyatForm, setFiyatForm] = useState({
    yil: new Date().getFullYear(),
    aylar: {
      ocak: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
      subat: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
      mart: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
      nisan: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
      mayis: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
      haziran: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
      temmuz: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
      agustos: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
      eylul: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
      ekim: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
      kasim: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
      aralik: { birimFiyat: 5.0, dagitimBedeli: 0.5 }
    }
  });

  const canAdd = kullanici?.rol && ['superadmin', 'yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);
  const canDelete = kullanici?.rol === 'yonetici' || kullanici?.rol === 'superadmin';
  const canUploadPhotos = kullanici?.rol && ['superadmin', 'yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);

  const fetchSantraller = async () => {
    if (!kullanici?.companyId) {
      console.warn('CompanyId bulunamadı');
      setYukleniyor(false);
      return;
    }

    try {
      setYukleniyor(true);
      let santralQuery;

      if (kullanici.rol === 'musteri') {
        let musteriSantralIds: string[] = [];
        if (kullanici.santraller && Array.isArray(kullanici.santraller) && kullanici.santraller.length > 0) {
          musteriSantralIds = kullanici.santraller;
        } else if (kullanici.sahalar && Array.isArray(kullanici.sahalar) && kullanici.sahalar.length > 0) {
          musteriSantralIds = kullanici.sahalar;
        }

        if (musteriSantralIds.length === 0) {
          try {
            const musteriSantralleriQuery = query(
              collection(db, 'santraller'),
              where('companyId', '==', kullanici.companyId),
              where('musteriId', '==', kullanici.id),
              orderBy('olusturmaTarihi', 'desc')
            );
            const musteriSantralleriSnapshot = await getDocs(musteriSantralleriQuery);
            musteriSantralIds = musteriSantralleriSnapshot.docs.map(doc => doc.id);
          } catch (error) {
            console.error('GesYonetimi - Müşteri santral arama hatası:', error);
          }
        }

        if (musteriSantralIds.length > 0) {
          const limitedIds = musteriSantralIds.slice(0, 10);
          santralQuery = query(
            collection(db, 'santraller'),
            where('__name__', 'in', limitedIds),
            orderBy('olusturmaTarihi', 'desc')
          );
        } else {
          setSantraller([]);
          setYukleniyor(false);
          return;
        }
      } else {
        santralQuery = query(
          collection(db, 'santraller'),
          where('companyId', '==', kullanici.companyId),
          orderBy('olusturmaTarihi', 'desc')
        );
      }

      const snapshot = await getDocs(santralQuery);
      const santralVerileri = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GesDetay[];

      setSantraller(santralVerileri);
    } catch (error) {
      console.error('Santral veri getirme hatası:', error);
      toast.error('Santral verileri yüklenirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    fetchSantraller();
  }, [kullanici]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kullanici?.companyId) {
      toast.error('Şirket bilgisi bulunamadı');
      return;
    }

    try {
      setYukleniyor(true);

      let fotografURLleri: string[] = [];
      if (form.fotograflar.length > 0 && canUploadPhotos) {
        try {
          fotografURLleri = await uploadMultipleFiles(
            form.fotograflar, 
            'santraller',
            (progress) => {
              setUploadProgress(progress);
            }
          );
        } catch (error) {
          console.error('Fotoğraf yükleme hatası:', error);
          toast.error('Fotoğraf yükleme sırasında bir hata oluştu');
        }
      }

      const santralData = {
        ...form,
        fotograflar: fotografURLleri.length > 0 ? fotografURLleri : (secilenSantral?.fotograflar || []),
        musteriId: secilenSantral?.musteriId || kullanici.id,
        olusturmaTarihi: secilenSantral ? secilenSantral.olusturmaTarihi : Timestamp.now(),
        kurulumTarihi: Timestamp.fromDate(new Date(form.kurulumTarihi)),
        companyId: kullanici.companyId
      };

      if (secilenSantral) {
        await updateDoc(doc(db, 'santraller', secilenSantral.id), santralData);
        toast.success('Santral başarıyla güncellendi');
      } else {
        await addDoc(collection(db, 'santraller'), santralData);
        toast.success('Santral başarıyla eklendi');
      }

      setFormAcik(false);
      setSecilenSantral(null);
      resetForm();
      await fetchSantraller();
    } catch (error) {
      console.error('Santral kaydetme hatası:', error);
      toast.error(secilenSantral ? 'Santral güncellenirken bir hata oluştu' : 'Santral eklenirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    setForm({
      ad: '',
      kurulumTarihi: format(new Date(), "yyyy-MM-dd"),
      konum: { lat: 0, lng: 0, adres: '' },
      kapasite: 0,
      panelSayisi: 0,
      inverterSayisi: 0,
      yillikHedefUretim: 0,
      fotograflar: [],
      teknikOzellikler: {
        panelTipi: '',
        inverterTipi: '',
        panelGucu: 0,
        sistemVerimi: 0
      },
      aylikHedefler: {
        ocak: 0, subat: 0, mart: 0, nisan: 0, mayis: 0, haziran: 0,
        temmuz: 0, agustos: 0, eylul: 0, ekim: 0, kasim: 0, aralik: 0
      }
    });
  };

  const handleFiyatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kullanici || !secilenFiyatSantral) return;

    try {
      setYukleniyor(true);

      const santralRef = doc(db, 'santraller', secilenFiyatSantral.id);

      const elektrikFiyatlari = secilenFiyatSantral.elektrikFiyatlari || {};
      elektrikFiyatlari[fiyatForm.yil.toString()] = fiyatForm.aylar;

      await updateDoc(santralRef, { elektrikFiyatlari });

      toast.success('Elektrik fiyatları başarıyla güncellendi');
      setFiyatFormAcik(false);
      setSecilenFiyatSantral(null);
      await fetchSantraller();
    } catch (error) {
      console.error('Fiyat güncelleme hatası:', error);
      toast.error('Elektrik fiyatları güncellenirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  const handleSilmeOnayAc = (id: string) => {
    if (!canDelete) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }
    setSilinecekSantralId(id);
    setSilmeOnayModalAcik(true);
  };

  const handleDelete = async () => {
    if (!canDelete || !silinecekSantralId) {
      return;
    }

    try {
      setYukleniyor(true);

      const uretimVerileriQuery = query(
        collection(db, 'uretimVerileri'),
        where('santralId', '==', silinecekSantralId)
      );

      const uretimVerileriSnapshot = await getDocs(uretimVerileriQuery);
      const batch = writeBatch(db);

      batch.delete(doc(db, 'santraller', silinecekSantralId));

      uretimVerileriSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      setSantraller(prev => prev.filter(santral => santral.id !== silinecekSantralId));
      toast.success(`Santral ve ${uretimVerileriSnapshot.size} üretim verisi başarıyla silindi`);

      setSilmeOnayModalAcik(false);
      setSilinecekSantralId(null);
    } catch (error) {
      console.error('Santral silme hatası:', error);
      toast.error('Santral silinirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  const handleYenile = async () => {
    setYenileniyor(true);
    await fetchSantraller();
    setYenileniyor(false);
    toast.success('Veriler yenilendi');
  };

  const handleFiyatDuzenle = (santral: GesDetay) => {
    setSecilenFiyatSantral(santral);

    const yil = fiyatForm.yil;
    const elektrikFiyatlari = santral.elektrikFiyatlari || {};
    const yilFiyatlari = elektrikFiyatlari[yil.toString()] || {};

    const varsayilanAylar = {
      ocak: { birimFiyat: 5.0, dagitimBedeli: 0.5 }, subat: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
      mart: { birimFiyat: 5.0, dagitimBedeli: 0.5 }, nisan: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
      mayis: { birimFiyat: 5.0, dagitimBedeli: 0.5 }, haziran: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
      temmuz: { birimFiyat: 5.0, dagitimBedeli: 0.5 }, agustos: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
      eylul: { birimFiyat: 5.0, dagitimBedeli: 0.5 }, ekim: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
      kasim: { birimFiyat: 5.0, dagitimBedeli: 0.5 }, aralik: { birimFiyat: 5.0, dagitimBedeli: 0.5 }
    };

    const aylar = { ...varsayilanAylar };

    Object.keys(yilFiyatlari).forEach(ayKey => {
      const ay = ayKey as keyof typeof varsayilanAylar;
      if (aylar[ay] && yilFiyatlari[ay]) {
        aylar[ay] = { ...aylar[ay], ...yilFiyatlari[ay] };
      }
    });
    
    setFiyatForm({ yil, aylar });
    setFiyatFormAcik(true);
  };

  useEffect(() => {
    if (secilenFiyatSantral && fiyatFormAcik) {
      const elektrikFiyatlari = secilenFiyatSantral.elektrikFiyatlari || {};
      const yilFiyatlari = elektrikFiyatlari[fiyatForm.yil.toString()] || {};
      const varsayilanAylar = {
        ocak: { birimFiyat: 5.0, dagitimBedeli: 0.5 }, subat: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
        mart: { birimFiyat: 5.0, dagitimBedeli: 0.5 }, nisan: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
        mayis: { birimFiyat: 5.0, dagitimBedeli: 0.5 }, haziran: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
        temmuz: { birimFiyat: 5.0, dagitimBedeli: 0.5 }, agustos: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
        eylul: { birimFiyat: 5.0, dagitimBedeli: 0.5 }, ekim: { birimFiyat: 5.0, dagitimBedeli: 0.5 },
        kasim: { birimFiyat: 5.0, dagitimBedeli: 0.5 }, aralik: { birimFiyat: 5.0, dagitimBedeli: 0.5 }
      };
      const aylar = { ...varsayilanAylar };
      Object.keys(yilFiyatlari).forEach(ayKey => {
        const ay = ayKey as keyof typeof varsayilanAylar;
        if (aylar[ay] && yilFiyatlari[ay]) {
          aylar[ay] = { ...aylar[ay], ...yilFiyatlari[ay] };
        }
      });
      setFiyatForm(prev => ({ ...prev, aylar }));
    }
  }, [fiyatForm.yil, secilenFiyatSantral, fiyatFormAcik]);

  if (yukleniyor && santraller.length === 0 && !formAcik && !fiyatFormAcik && !silmeOnayModalAcik) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)] bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Üst Başlık */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center">
            <div className="p-3 bg-blue-600 rounded-lg mr-4">
              <Briefcase className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Santral Yönetimi</h1>
              <p className="text-gray-600 text-sm mt-1">
                {kullanici?.rol === 'musteri' 
                  ? 'Size ait santrallerin yönetimi'
                  : 'Tüm santrallerin yönetimi ve yapılandırması'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleYenile}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 transition-colors"
              disabled={yenileniyor}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${yenileniyor ? 'animate-spin' : ''}`} />
              Yenile
            </button>

            {canAdd && (
              <button
                onClick={() => {
                  setSecilenSantral(null);
                  resetForm();
                  setFormAcik(true);
                }}
                className="flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                Yeni Santral Ekle
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Santral Kartları */}
      { !yukleniyor && santraller.length === 0 ? (
         <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <div className="flex flex-col items-center">
            <div className="p-4 bg-blue-50 rounded-full mb-4">
              <Sun className="h-16 w-16 text-blue-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Santral Bulunamadı</h3>
            <p className="text-gray-500 max-w-md mb-6">
              {kullanici?.rol === 'musteri'
                ? 'Size atanmış bir santral bulunmuyor.'
                : 'Henüz hiç santral kaydı bulunmuyor. Başlamak için yeni bir santral ekleyebilirsiniz.'}
            </p>
            {canAdd && kullanici?.rol !== 'musteri' && (
              <button
                onClick={() => {
                  setSecilenSantral(null);
                  resetForm();
                  setFormAcik(true);
                }}
                className="flex items-center px-6 py-3 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                İlk Santralınızı Ekleyin
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {santraller.map((santral) => (
            <div key={santral.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
              {/* Santral Fotoğrafı */}
              <div className="relative h-48">
                {santral.fotograflar?.[0] ? (
                  <img
                    src={santral.fotograflar[0]}
                    alt={santral.ad}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-image.png';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <Sun className="h-16 w-16 text-gray-400" />
                  </div>
                )}

                <div className="absolute top-3 right-3 flex space-x-2">
                  {canAdd && (
                    <button
                      onClick={() => {
                        setSecilenSantral(santral);
                        setForm({
                          ...santral,
                          kurulumTarihi: format(santral.kurulumTarihi.toDate(), "yyyy-MM-dd"),
                          fotograflar: [],
                          teknikOzellikler: santral.teknikOzellikler || { panelTipi: '', inverterTipi: '', panelGucu: 0, sistemVerimi: 0 },
                          aylikHedefler: santral.aylikHedefler || { ocak: 0, subat: 0, mart: 0, nisan: 0, mayis: 0, haziran: 0, temmuz: 0, agustos: 0, eylul: 0, ekim: 0, kasim: 0, aralik: 0 }
                        });
                        setFormAcik(true);
                      }}
                      className="p-2 bg-white bg-opacity-90 text-blue-600 rounded-md hover:bg-opacity-100 hover:bg-blue-50 transition-all shadow-sm"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleSilmeOnayAc(santral.id)}
                      className="p-2 bg-white bg-opacity-90 text-red-600 rounded-md hover:bg-opacity-100 hover:bg-red-50 transition-all shadow-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="absolute bottom-3 left-3">
                  <span className="px-2 py-1 bg-white bg-opacity-90 text-gray-900 text-xs font-semibold rounded-md shadow-sm">
                    {santral.kapasite} kWp
                  </span>
                </div>
              </div>

              {/* Santral Bilgileri */}
              <div className="p-4">
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate" title={santral.ad}>{santral.ad}</h3>
                  <div className="flex items-center text-sm text-gray-500">
                    <MapPin className="h-4 w-4 mr-1.5 flex-shrink-0" />
                    <span className="truncate" title={santral.konum.adres}>{santral.konum.adres}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                  <div className="bg-gray-50 rounded-md p-2">
                    <div className="flex items-center text-xs text-gray-500 mb-0.5">
                      <Battery className="h-3.5 w-3.5 text-green-600 mr-1" />
                      <span>Panel</span>
                    </div>
                    <p className="font-medium text-gray-800">{santral.panelSayisi}</p>
                  </div>
                  <div className="bg-gray-50 rounded-md p-2">
                    <div className="flex items-center text-xs text-gray-500 mb-0.5">
                      <Building className="h-3.5 w-3.5 text-blue-600 mr-1" />
                      <span>İnvertör</span>
                    </div>
                    <p className="font-medium text-gray-800">{santral.inverterSayisi}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                  <span>Kurulum:</span>
                  <span className="font-medium text-gray-700">
                    {format(santral.kurulumTarihi.toDate(), 'dd MMM yyyy', { locale: tr })}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate(`/uretim-verileri?santralId=${santral.id}&santralAdi=${encodeURIComponent(santral.ad)}`)}
                    className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 transition-colors"
                  >
                    <BarChart3 className="h-4 w-4 mr-1.5" />
                    Üretim
                  </button>

                  <button
                    onClick={() => handleFiyatDuzenle(santral)}
                    className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 transition-colors"
                     disabled={kullanici?.rol === 'musteri'}
                  >
                    <DollarSign className="h-4 w-4 mr-1.5" />
                    Fiyatlar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      { yukleniyor && (santraller.length > 0 || formAcik || fiyatFormAcik || silmeOnayModalAcik) && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-[100]">
            <LoadingSpinner size="lg" />
        </div>
      )}


      {/* Santral Ekleme/Düzenleme Modalı */}
      {formAcik && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[95vh] flex flex-col">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between rounded-t-lg">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Sun className="h-6 w-6 mr-2 text-blue-600" />
                {secilenSantral ? 'Santral Düzenle' : 'Yeni Santral Ekle'}
              </h2>
              <button
                onClick={() => setFormAcik(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-grow">
              <form onSubmit={handleSubmit}>
                {/* Temel Bilgiler */}
                <section className="mb-6">
                  <h3 className="text-lg font-medium text-gray-800 mb-3 border-b pb-2">Temel Bilgiler</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Santral Adı *</label>
                      <input type="text" required value={form.ad} onChange={e => setForm(prev => ({ ...prev, ad: e.target.value }))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" placeholder="Örn: Merkez GES"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kurulum Tarihi *</label>
                      <input type="date" required value={form.kurulumTarihi} onChange={e => setForm(prev => ({ ...prev, kurulumTarihi: e.target.value }))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kapasite (kWp) *</label>
                      <input type="number" required step="0.01" min="0" value={form.kapasite} onChange={e => setForm(prev => ({ ...prev, kapasite: parseFloat(e.target.value) || 0 }))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" placeholder="0"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Yıllık Hedef (kWh) *</label>
                      <input type="number" required min="0" value={form.yillikHedefUretim} onChange={e => setForm(prev => ({ ...prev, yillikHedefUretim: parseFloat(e.target.value) || 0 }))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" placeholder="0"/>
                    </div>
                  </div>
                </section>

                {/* Konum Bilgileri */}
                <section className="mb-6">
                  <h3 className="text-lg font-medium text-gray-800 mb-3 border-b pb-2">Konum Bilgileri</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adres *</label>
                    <textarea required value={form.konum.adres} onChange={e => setForm(prev => ({ ...prev, konum: { ...prev.konum, adres: e.target.value }}))}
                      rows={2} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" placeholder="Santralın tam adresi"/>
                  </div>
                </section>

                {/* Teknik Özellikler */}
                <section className="mb-6">
                  <h3 className="text-lg font-medium text-gray-800 mb-3 border-b pb-2">Teknik Özellikler</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Panel Sayısı *</label>
                      <input type="number" required min="0" value={form.panelSayisi} onChange={e => setForm(prev => ({ ...prev, panelSayisi: parseInt(e.target.value) || 0 }))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">İnvertör Sayısı *</label>
                      <input type="number" required min="0" value={form.inverterSayisi} onChange={e => setForm(prev => ({ ...prev, inverterSayisi: parseInt(e.target.value) || 0 }))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Panel Tipi *</label>
                      <input type="text" required value={form.teknikOzellikler.panelTipi} onChange={e => setForm(prev => ({ ...prev, teknikOzellikler: { ...prev.teknikOzellikler, panelTipi: e.target.value }}))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" placeholder="Örn: Monokristalin"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">İnvertör Tipi *</label>
                      <input type="text" required value={form.teknikOzellikler.inverterTipi} onChange={e => setForm(prev => ({ ...prev, teknikOzellikler: { ...prev.teknikOzellikler, inverterTipi: e.target.value }}))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" placeholder="Örn: String İnvertör"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Panel Gücü (W) *</label>
                      <input type="number" required min="0" value={form.teknikOzellikler.panelGucu} onChange={e => setForm(prev => ({ ...prev, teknikOzellikler: { ...prev.teknikOzellikler, panelGucu: parseFloat(e.target.value) || 0 }}))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sistem Verimi (%) *</label>
                      <input type="number" required min="0" max="100" step="0.1" value={form.teknikOzellikler.sistemVerimi} onChange={e => setForm(prev => ({ ...prev, teknikOzellikler: { ...prev.teknikOzellikler, sistemVerimi: parseFloat(e.target.value) || 0 }}))}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"/>
                    </div>
                  </div>
                </section>

                {/* Aylık Hedefler */}
                <section className="mb-6">
                  <h3 className="text-lg font-medium text-gray-800 mb-3 border-b pb-2">Aylık Üretim Hedefleri (kWh)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Object.entries(form.aylikHedefler).map(([ay, deger]) => (
                      <div key={ay}>
                        <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">{ay}</label>
                        <input type="number" min="0" value={deger} onChange={e => setForm(prev => ({ ...prev, aylikHedefler: { ...prev.aylikHedefler, [ay]: parseFloat(e.target.value) || 0 }}))}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"/>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Fotoğraflar */}
                <section>
                  <h3 className="text-lg font-medium text-gray-800 mb-3 border-b pb-2">Fotoğraflar</h3>
                  {!canUploadPhotos && (
                    <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-700">
                        Fotoğraf yükleme için yönetici, tekniker veya mühendis yetkisi gereklidir.
                      </p>
                    </div>
                  )}
                  <FileUploadZone
                    onFileSelect={(files) => setForm(prev => ({ ...prev, fotograflar: files }))}
                    selectedFiles={form.fotograflar}
                    onFileRemove={(index) => {
                      setForm(prev => ({ ...prev, fotograflar: prev.fotograflar.filter((_, i) => i !== index)}));
                    }}
                    maxFiles={5}
                    uploadProgress={uploadProgress}
                    disabled={!canUploadPhotos}
                  />
                </section>
                
                {/* Form Butonları */}
                <div className="sticky bottom-0 bg-white mt-8 pt-4 pb-6 px-6 border-t border-gray-200 flex justify-end space-x-3 rounded-b-lg -mx-6 -mb-6">
                  <button type="button" onClick={() => setFormAcik(false)}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                    İptal
                  </button>
                  <button type="submit" disabled={yukleniyor}
                    className="flex items-center px-6 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-70 transition-colors">
                    {yukleniyor ? (
                      <><LoadingSpinner size="sm" /><span className="ml-2">Kaydediliyor...</span></>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" />{secilenSantral ? 'Güncelle' : 'Kaydet'}</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Fiyat Ayarları Modalı */}
      {fiyatFormAcik && secilenFiyatSantral && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[95vh] flex flex-col">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between rounded-t-lg">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <DollarSign className="h-6 w-6 mr-2 text-blue-600" />
                Elektrik Fiyatları - {secilenFiyatSantral.ad}
              </h2>
              <button onClick={() => setFiyatFormAcik(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-grow">
              <form onSubmit={handleFiyatSubmit}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Yıl Seçimi</label>
                  <select value={fiyatForm.yil} onChange={(e) => setFiyatForm(prev => ({ ...prev, yil: parseInt(e.target.value) }))}
                    className="w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm">
                    {Array.from({ length: 9 }, (_, i) => new Date().getFullYear() - 4 + i).map(yil => (
                      <option key={yil} value={yil}>{yil}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-3 border-b pb-2">Aylık Elektrik Fiyatları</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(fiyatForm.aylar).map(([ay, fiyatlar]) => (
                      <div key={ay} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <h4 className="text-sm font-medium text-gray-800 mb-2 capitalize">{ay}</h4>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Birim Fiyat (₺/kWh)</label>
                            <input type="number" step="0.01" min="0" value={fiyatlar.birimFiyat}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                const ayKey = ay as keyof typeof fiyatForm.aylar;
                                setFiyatForm(prev => ({ ...prev, aylar: { ...prev.aylar, [ayKey]: { ...prev.aylar[ayKey], birimFiyat: value }}}));
                              }}
                              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"/>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Dağıtım Bedeli (₺/kWh)</label>
                            <input type="number" step="0.01" min="0" value={fiyatlar.dagitimBedeli}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                const ayKey = ay as keyof typeof fiyatForm.aylar;
                                setFiyatForm(prev => ({ ...prev, aylar: { ...prev.aylar, [ayKey]: { ...prev.aylar[ayKey], dagitimBedeli: value }}}));
                              }}
                              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"/>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="sticky bottom-0 bg-white mt-8 pt-4 pb-6 px-6 border-t border-gray-200 flex justify-end space-x-3 rounded-b-lg -mx-6 -mb-6">
                  <button type="button" onClick={() => setFiyatFormAcik(false)}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                    İptal
                  </button>
                  <button type="submit" disabled={yukleniyor}
                    className="flex items-center px-6 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-70 transition-colors">
                    {yukleniyor ? (
                      <><LoadingSpinner size="sm" /><span className="ml-2">Kaydediliyor...</span></>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" />Fiyatları Kaydet</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Silme Onay Modalı */}
      {silmeOnayModalAcik && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Santral Silme Onayı</h3>
            <p className="text-sm text-gray-600 mb-6">
              Bu santralı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve santrala ait tüm üretim verileri de silinecektir.
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => { setSilmeOnayModalAcik(false); setSilinecekSantralId(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                İptal
              </button>
              <button onClick={handleDelete} disabled={yukleniyor}
                className="flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-70 transition-colors">
                {yukleniyor ? (
                  <><LoadingSpinner size="sm" /><span className="ml-2">Siliniyor...</span></>
                ) : (
                  'Evet, Sil'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};