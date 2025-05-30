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
  Percent
} from 'lucide-react';
import { Card, Title, Text } from '@tremor/react';
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

  const canAdd = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);
  const canDelete = kullanici?.rol === 'yonetici';
  const canUploadPhotos = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);

  const fetchSantraller = async () => {
    if (!kullanici) return;

    try {
      setYukleniyor(true);
      let santralQuery;

      if (kullanici.rol === 'musteri') {
        santralQuery = query(
          collection(db, 'santraller'),
          where('musteriId', '==', kullanici.id),
          orderBy('olusturmaTarihi', 'desc')
        );
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
      console.error('Veri getirme hatası:', error);
      toast.error('Veriler yüklenirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => {
    fetchSantraller();
  }, [kullanici]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!kullanici) {
      toast.error('Kullanıcı bilgisi bulunamadı');
      return;
    }

    // Formu devre dışı bırak
    const submitButton = (e.target as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement;
    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      setYukleniyor(true);
      
      // Form validasyonu
      if (!form.ad.trim()) {
        toast.error('Santral adı boş olamaz');
        return;
      }
      
      if (form.kapasite <= 0) {
        toast.error('Kapasite 0\'dan büyük olmalıdır');
        return;
      }

      let fotografURLleri: string[] = [];
      if (form.fotograflar.length > 0 && canUploadPhotos) {
        try {
          setUploadProgress(10);
          fotografURLleri = await uploadMultipleFiles(
            form.fotograflar, 
            'santraller',
            (progress) => {
              setUploadProgress(Math.min(90, 10 + progress * 0.8));
            }
          );
          setUploadProgress(90);
        } catch (error) {
          console.error('Fotoğraf yükleme hatası:', error);
          toast.error('Fotoğraf yükleme sırasında bir hata oluştu');
          return;
        }
      }

      const santralData = {
        ad: form.ad.trim(),
        kurulumTarihi: Timestamp.fromDate(new Date(form.kurulumTarihi)),
        konum: {
          lat: form.konum.lat,
          lng: form.konum.lng,
          adres: form.konum.adres.trim()
        },
        kapasite: Number(form.kapasite),
        panelSayisi: Number(form.panelSayisi),
        inverterSayisi: Number(form.inverterSayisi),
        yillikHedefUretim: Number(form.yillikHedefUretim),
        fotograflar: fotografURLleri.length > 0 ? fotografURLleri : (secilenSantral?.fotograflar || []),
        teknikOzellikler: {
          panelTipi: form.teknikOzellikler.panelTipi.trim(),
          inverterTipi: form.teknikOzellikler.inverterTipi.trim(),
          panelGucu: Number(form.teknikOzellikler.panelGucu),
          sistemVerimi: Number(form.teknikOzellikler.sistemVerimi)
        },
        aylikHedefler: {
          ocak: Number(form.aylikHedefler.ocak),
          subat: Number(form.aylikHedefler.subat),
          mart: Number(form.aylikHedefler.mart),
          nisan: Number(form.aylikHedefler.nisan),
          mayis: Number(form.aylikHedefler.mayis),
          haziran: Number(form.aylikHedefler.haziran),
          temmuz: Number(form.aylikHedefler.temmuz),
          agustos: Number(form.aylikHedefler.agustos),
          eylul: Number(form.aylikHedefler.eylul),
          ekim: Number(form.aylikHedefler.ekim),
          kasim: Number(form.aylikHedefler.kasim),
          aralik: Number(form.aylikHedefler.aralik)
        },
        companyId: kullanici.companyId,
        musteriId: secilenSantral?.musteriId || kullanici.id
      };

      // Düzenleme durumunda güncelleme tarihi ekle, yeni ekleme durumunda oluşturma tarihi ekle
      if (secilenSantral) {
        santralData.guncellemeTarihi = Timestamp.now();
        await updateDoc(doc(db, 'santraller', secilenSantral.id), santralData);
        toast.success('Santral başarıyla güncellendi');
      } else {
        santralData.olusturmaTarihi = Timestamp.now();
        const docRef = await addDoc(collection(db, 'santraller'), santralData);
        toast.success('Santral başarıyla eklendi');
        console.log('Yeni santral eklendi, ID:', docRef.id);
      }

      // Formu temizle ve kapat
      resetForm();
      setFormAcik(false);
      setSecilenSantral(null);
      
      // Santral listesini yenile
      await fetchSantraller();
      
    } catch (error) {
      console.error('Santral kaydetme hatası:', error);
      toast.error(secilenSantral ? 'Santral güncellenirken bir hata oluştu' : 'Santral eklenirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
      setUploadProgress(0);
      
      // Submit button'u tekrar aktif et
      if (submitButton) {
        submitButton.disabled = false;
      }
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
  };

  const handleFiyatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kullanici || !secilenFiyatSantral) return;

    try {
      setYukleniyor(true);

      const santralRef = doc(db, 'santraller', secilenFiyatSantral.id);
      
      const elektrikFiyatlari = secilenFiyatSantral.elektrikFiyatlari || {};
      
      elektrikFiyatlari[fiyatForm.yil.toString()] = fiyatForm.aylar;
      
      await updateDoc(santralRef, {
        elektrikFiyatlari
      });

      toast.success('Elektrik fiyatları başarıyla güncellendi');
      setFiyatFormAcik(false);
      setSecilenFiyatSantral(null);
      
      fetchSantraller();
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
      toast.error('Bu işlem için yetkiniz yok');
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
    };
    
    const aylar = { ...varsayilanAylar };
    
    Object.keys(yilFiyatlari).forEach(ay => {
      if (aylar[ay]) {
        aylar[ay] = yilFiyatlari[ay];
      }
    });
    
    setFiyatForm({
      yil,
      aylar
    });
    
    setFiyatFormAcik(true);
  };

  const handleFiyatYilDegisim = (yil: number) => {
    if (!secilenFiyatSantral) return;
    
    const elektrikFiyatlari = secilenFiyatSantral.elektrikFiyatlari || {};
    const yilFiyatlari = elektrikFiyatlari[yil.toString()] || {};
    
    const varsayilanAylar = {
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
    };
    
    const aylar = { ...varsayilanAylar };
    
    Object.keys(yilFiyatlari).forEach(ay => {
      if (aylar[ay]) {
        aylar[ay] = yilFiyatlari[ay];
      }
    });
    
    setFiyatForm({
      yil,
      aylar
    });
  };

  if (yukleniyor && santraller.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">GES Yönetimi</h1>
          <p className="mt-1 text-sm text-gray-500">
            {kullanici?.rol === 'musteri' 
              ? 'Size ait GES santrallerinin yönetimi'
              : 'Tüm GES santrallerinin yönetimi'}
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleYenile}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
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
                setUploadProgress(0);
                setFormAcik(true);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700"
            >
              <Plus className="h-5 w-5 mr-2" />
              Yeni Santral Ekle
            </button>
          )}
        </div>
      </div>

      {santraller.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12">
            <Sun className="h-16 w-16 text-yellow-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">Santral Bulunamadı</h3>
            <p className="text-gray-500 text-center max-w-md">
              Henüz hiç santral kaydı bulunmuyor. Üretim verilerini görmek için önce bir santral eklemelisiniz.
            </p>
            {canAdd && (
              <button
                onClick={() => {
                  setSecilenSantral(null);
                  setFormAcik(true);
                }}
                className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Yeni Santral Ekle
              </button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {santraller.map((santral) => (
            <Card key={santral.id} className="hover:shadow-lg transition-shadow duration-200">
              <div className="relative">
                {santral.fotograflar?.[0] && (
                  <img
                    src={santral.fotograflar[0]}
                    alt={santral.ad}
                    className="w-full h-48 object-cover rounded-t-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-image.png';
                    }}
                  />
                )}
                <div className="absolute top-2 right-2 flex space-x-2">
                  {canAdd && (
                    <button
                      onClick={() => {
                        setSecilenSantral(santral);
                        setForm({
                          ad: santral.ad || '',
                          kurulumTarihi: format(santral.kurulumTarihi.toDate(), "yyyy-MM-dd"),
                          konum: santral.konum || { lat: 0, lng: 0, adres: '' },
                          kapasite: santral.kapasite || 0,
                          panelSayisi: santral.panelSayisi || 0,
                          inverterSayisi: santral.inverterSayisi || 0,
                          yillikHedefUretim: santral.yillikHedefUretim || 0,
                          fotograflar: [],
                          teknikOzellikler: santral.teknikOzellikler || {
                            panelTipi: '',
                            inverterTipi: '',
                            panelGucu: 0,
                            sistemVerimi: 0
                          },
                          aylikHedefler: santral.aylikHedefler || {
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
                        setFormAcik(true);
                      }}
                      className="p-2 bg-yellow-500 text-white rounded-full hover:bg-yellow-600"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleSilmeOnayAc(santral.id)}
                      className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-900">{santral.ad}</h3>
                
                <div className="mt-4 space-y-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                    {santral.konum.adres}
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-600">
                    <Battery className="h-4 w-4 mr-2 text-gray-400" />
                    {santral.kapasite} kWp
                  </div>

                  <div className="flex items-center text-sm text-gray-600">
                    <Sun className="h-4 w-4 mr-2 text-gray-400" />
                    {santral.panelSayisi} Panel
                  </div>

                  <div className="flex items-center text-sm text-gray-600">
                    <Building className="h-4 w-4 mr-2 text-gray-400" />
                    {santral.inverterSayisi} İnvertör
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Kurulum Tarihi:</span>
                    <span className="font-medium">
                      {format(santral.kurulumTarihi.toDate(), 'dd MMMM yyyy', { locale: tr })}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between">
                    <button
                      onClick={() => navigate(`/uretim-verileri?santral=${santral.id}`)}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Sun className="h-3.5 w-3.5 mr-1.5" />
                      Üretim Verileri
                    </button>
                    
                    <button
                      onClick={() => handleFiyatDuzenle(santral)}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                      Fiyat Ayarları
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {formAcik && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-7xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                {secilenSantral ? 'Santral Düzenle' : 'Yeni Santral Ekle'}
              </h2>
              <button
                onClick={() => {
                  setFormAcik(false);
                  setSecilenSantral(null);
                  resetForm();
                  setUploadProgress(0);
                }}
                className="text-gray-400 hover:text-gray-500"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Temel Bilgiler</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Santral Adı
                        </label>
                        <input
                          type="text"
                          required
                          value={form.ad}
                          onChange={e => setForm(prev => ({ ...prev, ad: e.target.value }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          <Calendar className="h-4 w-4 inline mr-2" />
                          Kurulum Tarihi
                        </label>
                        <input
                          type="date"
                          required
                          value={form.kurulumTarihi}
                          onChange={e => setForm(prev => ({ ...prev, kurulumTarihi: e.target.value }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          <Battery className="h-4 w-4 inline mr-2" />
                          Kapasite (kWp)
                        </label>
                        <input
                          type="number"
                          required
                          value={form.kapasite}
                          onChange={e => setForm(prev => ({ ...prev, kapasite: parseFloat(e.target.value) }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Yıllık Hedef Üretim (kWh)
                        </label>
                        <input
                          type="number"
                          required
                          value={form.yillikHedefUretim}
                          onChange={e => setForm(prev => ({ ...prev, yillikHedefUretim: parseFloat(e.target.value) }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Konum Bilgileri</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          <MapPin className="h-4 w-4 inline mr-2" />
                          Adres
                        </label>
                        <textarea
                          required
                          value={form.konum.adres}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            konum: { ...prev.konum, adres: e.target.value }
                          }))}
                          rows={2}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Teknik Özellikler</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          <Sun className="h-4 w-4 inline mr-2" />
                          Panel Sayısı
                        </label>
                        <input
                          type="number"
                          required
                          value={form.panelSayisi}
                          onChange={e => setForm(prev => ({ ...prev, panelSayisi: parseInt(e.target.value) }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          <Building className="h-4 w-4 inline mr-2" />
                          İnvertör Sayısı
                        </label>
                        <input
                          type="number"
                          required
                          value={form.inverterSayisi}
                          onChange={e => setForm(prev => ({ ...prev, inverterSayisi: parseInt(e.target.value) }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Panel Tipi
                        </label>
                        <input
                          type="text"
                          required
                          value={form.teknikOzellikler.panelTipi}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            teknikOzellikler: { ...prev.teknikOzellikler, panelTipi: e.target.value }
                          }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          İnvertör Tipi
                        </label>
                        <input
                          type="text"
                          required
                          value={form.teknikOzellikler.inverterTipi}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            teknikOzellikler: { ...prev.teknikOzellikler, inverterTipi: e.target.value }
                          }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Panel Gücü (W)
                        </label>
                        <input
                          type="number"
                          required
                          value={form.teknikOzellikler.panelGucu}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            teknikOzellikler: { ...prev.teknikOzellikler, panelGucu: parseFloat(e.target.value) }
                          }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Sistem Verimi (%)
                        </label>
                        <input
                          type="number"
                          required
                          value={form.teknikOzellikler.sistemVerimi}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            teknikOzellikler: { ...prev.teknikOzellikler, sistemVerimi: parseFloat(e.target.value) }
                          }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Aylık Üretim Hedefleri (kWh)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Ocak
                        </label>
                        <input
                          type="number"
                          value={form.aylikHedefler.ocak}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            aylikHedefler: { ...prev.aylikHedefler, ocak: parseFloat(e.target.value) }
                          }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Şubat
                        </label>
                        <input
                          type="number"
                          value={form.aylikHedefler.subat}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            aylikHedefler: { ...prev.aylikHedefler, subat: parseFloat(e.target.value) }
                          }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Mart
                        </label>
                        <input
                          type="number"
                          value={form.aylikHedefler.mart}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            aylikHedefler: { ...prev.aylikHedefler, mart: parseFloat(e.target.value) }
                          }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Nisan
                        </label>
                        <input
                          type="number"
                          value={form.aylikHedefler.nisan}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            aylikHedefler: { ...prev.aylikHedefler, nisan: parseFloat(e.target.value) }
                          }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Mayıs
                        </label>
                        <input
                          type="number"
                          value={form.aylikHedefler.mayis}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            aylikHedefler: { ...prev.aylikHedefler, mayis: parseFloat(e.target.value) }
                          }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Haziran
                        </label>
                        <input
                          type="number"
                          value={form.aylikHedefler.haziran}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            aylikHedefler: { ...prev.aylikHedefler, haziran: parseFloat(e.target.value) }
                          }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Temmuz
                        </label>
                        <input
                          type="number"
                          value={form.aylikHedefler.temmuz}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            aylikHedefler: { ...prev.aylikHedefler, temmuz: parseFloat(e.target.value) }
                          }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Ağustos
                        </label>
                        <input
                          type="number"
                          value={form.aylikHedefler.agustos}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            aylikHedefler: { ...prev.aylikHedefler, agustos: parseFloat(e.target.value) }
                          }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Eylül
                        </label>
                        <input
                          type="number"
                          value={form.aylikHedefler.eylul}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            aylikHedefler: { ...prev.aylikHedefler, eylul: parseFloat(e.target.value) }
                          }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Ekim
                        </label>
                        <input
                          type="number"
                          value={form.aylikHedefler.ekim}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            aylikHedefler: { ...prev.aylikHedefler, ekim: parseFloat(e.target.value) }
                          }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Kasım
                        </label>
                        <input
                          type="number"
                          value={form.aylikHedefler.kasim}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            aylikHedefler: { ...prev.aylikHedefler, kasim: parseFloat(e.target.value) }
                          }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Aralık
                        </label>
                        <input
                          type="number"
                          value={form.aylikHedefler.aralik}
                          onChange={e => setForm(prev => ({ 
                            ...prev, 
                            aylikHedefler: { ...prev.aylikHedefler, aralik: parseFloat(e.target.value) }
                          }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Fotoğraflar</h3>
                    {!canUploadPhotos && (
                      <div className="mb-4 p-4 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          Fotoğraf yükleme için yönetici, tekniker veya mühendis yetkisi gereklidir.
                        </p>
                      </div>
                    )}
                    <FileUploadZone
                      onFileSelect={(files) => setForm(prev => ({ ...prev, fotograflar: files }))}
                      selectedFiles={form.fotograflar}
                      onFileRemove={(index) => {
                        setForm(prev => ({
                          ...prev,
                          fotograflar: prev.fotograflar.filter((_, i) => i !== index)
                        }));
                      }}
                      maxFiles={5}
                      uploadProgress={uploadProgress}
                      disabled={!canUploadPhotos}
                    />
                    {secilenSantral && secilenSantral.fotograflar && secilenSantral.fotograflar.length > 0 && (
                      <div className="mt-2 text-sm text-gray-500">
                        Not: Yeni fotoğraf yüklerseniz, mevcut fotoğraflar değiştirilecektir.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setFormAcik(false);
                      setSecilenSantral(null);
                      resetForm();
                      setUploadProgress(0);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={yukleniyor}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50"
                  >
                    {yukleniyor ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span className="ml-2">Kaydediliyor...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        {secilenSantral ? 'Güncelle' : 'Kaydet'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {fiyatFormAcik && secilenFiyatSantral && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-4xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                Elektrik Fiyatları - {secilenFiyatSantral.ad}
              </h2>
              <button
                onClick={() => setFiyatFormAcik(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">
              <form onSubmit={handleFiyatSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Yıl
                  </label>
                  <select
                    value={fiyatForm.yil}
                    onChange={(e) => handleFiyatYilDegisim(parseInt(e.target.value))}
                    className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  >
                    {Array.from({ length: 9 }, (_, i) => 2022 + i).map(yil => (
                      <option key={yil} value={yil}>{yil}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <h3 className="text-md font-medium text-gray-900 mb-4">Aylık Elektrik Fiyatları</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(fiyatForm.aylar).map(([ay, fiyatlar]) => (
                      <div key={ay} className="border border-gray-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-3 capitalize">{ay}</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700">
                              <DollarSign className="h-3.5 w-3.5 inline mr-1" />
                              Birim Fiyat (₺/kWh)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={fiyatlar.birimFiyat}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                setFiyatForm(prev => ({
                                  ...prev,
                                  aylar: {
                                    ...prev.aylar,
                                    [ay]: {
                                      ...prev.aylar[ay],
                                      birimFiyat: value
                                    }
                                  }
                                }));
                              }}
                              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700">
                              <Percent className="h-3.5 w-3.5 inline mr-1" />
                              Dağıtım Bedeli (₺/kWh)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={fiyatlar.dagitimBedeli}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                setFiyatForm(prev => ({
                                  ...prev,
                                  aylar: {
                                    ...prev.aylar,
                                    [ay]: {
                                      ...prev.aylar[ay],
                                      dagitimBedeli: value
                                    }
                                  }
                                }));
                              }}
                              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setFiyatFormAcik(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={yukleniyor}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50"
                  >
                    {yukleniyor ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span className="ml-2">Kaydediliyor...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Fiyatları Kaydet
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {silmeOnayModalAcik && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Santral Silme Onayı</h3>
            <p className="text-sm text-gray-500 mb-4">
              Bu santralı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve santrala ait tüm üretim verileri de silinecektir.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setSilmeOnayModalAcik(false);
                  setSilinecekSantralId(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleDelete}
                disabled={yukleniyor}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {yukleniyor ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Siliniyor...</span>
                  </>
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