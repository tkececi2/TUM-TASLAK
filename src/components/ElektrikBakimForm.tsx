import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { X, Calendar, Building, Upload, Save, Trash2, ImageOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { FileUploadZone } from './FileUploadZone';
import { uploadMultipleFiles, deleteFileByUrl } from '../utils/uploadHelpers';
import toast from 'react-hot-toast';
import type { ElektrikBakim } from '../types';

interface Props {
  onClose: () => void;
  sahalar: Array<{
    id: string;
    ad: string;
  }>;
  mode: 'add' | 'edit';
  bakimToEdit?: ElektrikBakim | null;
  onSuccess: () => void;
}

const KONTROL_GRUPLARI_ELEKTRIK = {
  ogSistemleri: {
    baslik: '1. OG Sistemleri',
    kontroller: {
      betonKosk: { label: 'Beton köşklerde kir, nem kontrolü', key: 'betonKosk' },
      ogHucreleri: { label: 'OG hücrelerinde paslanma ve boya kusurları', key: 'ogHucreleri' },
      ayiricilar: { label: 'Ayırıcıların, kesicilerin ve rölelerin işlevselliği', key: 'ayiricilar' }
    }
  },
  trafolar: {
    baslik: '2. Trafolar',
    kontroller: {
      trafoTemizligi: { label: 'Trafo temizliği (kir, toz, yağ sızıntısı)', key: 'trafoTemizligi' },
      buchholzSinyalleri: { label: 'Buchholz sinyalleri ve buşing termal kontrolü', key: 'buchholzSinyalleri' }
    }
  },
  agDagitimPanosu: {
    baslik: '3. AG Dağıtım Panosu',
    kontroller: {
      kirNemKontrol: { label: 'Kir, nem, paslanma kontrolü', key: 'kirNemKontrol' },
      devreSigortaKontrol: { label: 'Devre kesiciler ve sigortaların çalışması', key: 'devreSigortaKontrol' },
      upsSistemKontrol: { label: 'UPS sisteminin kontrolü', key: 'upsSistemKontrol' }
    }
  },
  invertorler: {
    baslik: '4. İnvertörler',
    kontroller: {
      kirPaslanmaKontrol: { label: 'Kir, toz, paslanma ve termal inceleme', key: 'kirPaslanmaKontrol' },
      kabloDurumu: { label: 'AC/DC kablolarının durumu', key: 'kabloDurumu' },
      etiketIsaretler: { label: 'Etiketler ve işaret levhalarının kontrolü', key: 'etiketIsaretler' }
    }
  },
  toplamaKutulari: {
    baslik: '5. Toplama Kutuları',
    kontroller: {
      termalPaslanmaKontrol: { label: 'Termal kontrol ve paslanma incelemesi', key: 'termalPaslanmaKontrol' },
      pvDiziBaglanti: { label: 'PV dizilerinin ve bağlantılarının çalışması', key: 'pvDiziBaglanti' }
    }
  },
  pvModulleri: {
    baslik: '6. PV Modülleri',
    kontroller: {
      modulKutuKontrol: { label: 'Modül ve bağlantı kutularının görsel denetimi', key: 'modulKutuKontrol' },
      kabloBaglanti: { label: 'Kablolar ve konektörlerin kontrolü', key: 'kabloBaglanti' }
    }
  },
  kabloTasima: {
    baslik: '7. Kablolar ve Taşıma Sistemleri',
    kontroller: {
      kabloDurumu: { label: 'OG/AG kablolarının ve işaretleyicilerinin durumu', key: 'kabloDurumu' },
      tasimaSistemleri: { label: 'Kablo kanalları, askılar ve borular', key: 'tasimaSistemleri' }
    }
  },
  aydinlatmaGuvenlik: {
    baslik: '8. Aydınlatma ve Güvenlik',
    kontroller: {
      aydinlatmaKontrol: { label: 'Aydınlatma armatürlerinin çalışması ve görsel denetimi', key: 'aydinlatmaKontrol' },
      kameraKontrol: { label: 'CCTV ve izleme sistemlerinin çalışması', key: 'kameraKontrol' },
      elektrosokKontrol: { label: 'Elektroşok sisteminin işlevselliği', key: 'elektrosokKontrol' }
    }
  },
  topraklamaSistemleri: {
    baslik: '9. Topraklama Sistemleri',
    kontroller: {
      topraklamaBaglanti: { label: 'Topraklama bağlantılarının bütünlüğü', key: 'topraklamaBaglanti' },
      topraklamaOlcum: { label: 'Nötr ve koruma topraklama ölçümleri', key: 'topraklamaOlcum' }
    }
  }
};

const getDefaultFormState = () => ({
  sahaId: '',
  tarih: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  yeniFotograflar: [] as File[],
  mevcutFotograflar: [] as string[],
  silinecekFotograflar: [] as string[],
  durumlar: Object.fromEntries(
    Object.entries(KONTROL_GRUPLARI_ELEKTRIK).map(([kategoriKey, grup]) => [
      kategoriKey,
      Object.fromEntries(
        Object.entries(grup.kontroller).map(([kontrolKey]) => [
          kontrolKey,
          { durum: true, aciklama: '' }
        ])
      )
    ])
  ),
  genelNotlar: ''
});

export const ElektrikBakimForm: React.FC<Props> = ({ onClose, sahalar, mode, bakimToEdit, onSuccess }) => {
  const { kullanici } = useAuth();
  const [yukleniyor, setYukleniyor] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [form, setForm] = useState(getDefaultFormState());

  useEffect(() => {
    if (mode === 'edit' && bakimToEdit) {
      const initialFormStateForEdit = getDefaultFormState();
      const newDurumlar = { ...initialFormStateForEdit.durumlar };

      // Iterate over KONTROL_GRUPLARI_ELEKTRIK to ensure all form fields are considered
      (Object.keys(KONTROL_GRUPLARI_ELEKTRIK) as Array<keyof typeof KONTROL_GRUPLARI_ELEKTRIK>).forEach(kategoriKey => {
        const grup = KONTROL_GRUPLARI_ELEKTRIK[kategoriKey];
        // Ensure kategoriKey is also a key in newDurumlar, which it should be by construction
        const typedNewDurumlarKategoriKey = kategoriKey as keyof typeof newDurumlar;

        if (grup && newDurumlar[typedNewDurumlarKategoriKey]) {
          (Object.keys(grup.kontroller) as Array<keyof typeof grup.kontroller>).forEach(kontrolKey => {
            // Safely get data from bakimToEdit.durumlar
            const durumKategoriInBakim = bakimToEdit.durumlar[kategoriKey as keyof ElektrikBakim['durumlar']];
            const aciklamaKategoriInBakim = bakimToEdit.durumlar[`${kategoriKey}Aciklamalar` as keyof ElektrikBakim['durumlar']];
            
            const durumValue = durumKategoriInBakim?.[kontrolKey as string];
            const aciklamaValue = aciklamaKategoriInBakim?.[kontrolKey as string];

            if (typeof durumValue === 'boolean') {
              newDurumlar[typedNewDurumlarKategoriKey][kontrolKey].durum = durumValue;
            }
            if (typeof aciklamaValue === 'string') {
              newDurumlar[typedNewDurumlarKategoriKey][kontrolKey].aciklama = aciklamaValue;
            } else {
                newDurumlar[typedNewDurumlarKategoriKey][kontrolKey].aciklama = ''; // Ensure aciklama is always string
            }
          });
        }
      });
      
      setForm({
        sahaId: bakimToEdit.sahaId,
        tarih: bakimToEdit.tarih?.toDate ? format(bakimToEdit.tarih.toDate(), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        yeniFotograflar: [],
        mevcutFotograflar: bakimToEdit.fotograflar || [],
        silinecekFotograflar: [],
        durumlar: newDurumlar,
        genelNotlar: bakimToEdit.genelNotlar || ''
      });
    } else {
      setForm(getDefaultFormState());
    }
  }, [mode, bakimToEdit]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };
  
  const handleDurumChange = (
    kategori: string,
    alan: string,
    value: boolean | string,
    tip: 'durum' | 'aciklama'
  ) => {
    setForm(prev => ({
      ...prev,
      durumlar: {
        ...prev.durumlar,
        [kategori]: {
          ...prev.durumlar[kategori],
          [alan]: {
            ...(prev.durumlar[kategori]?.[alan] || { durum: true, aciklama: '' }),
            [tip]: value
          }
        }
      }
    }));
  };

  const handleFileSelect = (files: File[]) => {
    setForm(prev => ({ ...prev, yeniFotograflar: [...prev.yeniFotograflar, ...files] }));
  };

  const handleRemoveNewFile = (fileName: string) => {
    setForm(prev => ({
      ...prev,
      yeniFotograflar: prev.yeniFotograflar.filter(file => file.name !== fileName)
    }));
  };

  const handleToggleDeleteExistingFile = (fileUrl: string) => {
    setForm(prev => ({
      ...prev,
      silinecekFotograflar: prev.silinecekFotograflar.includes(fileUrl)
        ? prev.silinecekFotograflar.filter(url => url !== fileUrl)
        : [...prev.silinecekFotograflar, fileUrl]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kullanici) {
      toast.error('Oturum açmanız gerekiyor');
      return;
    }

    if (!form.sahaId || !form.tarih) {
      toast.error('Lütfen Saha ve Tarih alanlarını doldurun.');
      return;
    }

    const izinliRoller = ['yonetici', 'tekniker', 'muhendis', 'superadmin'];
    if (!izinliRoller.includes(kullanici.rol)) {
      toast.error('Bu işlem için yetkiniz bulunmuyor');
      return;
    }

    setYukleniyor(true);
    toast.loading(mode === 'add' ? 'Bakım kaydı oluşturuluyor...' : 'Bakım kaydı güncelleniyor...', { id: 'bakimSubmit' });

    try {
      for (const url of form.silinecekFotograflar) {
        try {
          await deleteFileByUrl(url);
        } catch (error) {
          console.error(`Fotoğraf silinemedi: ${url}`, error);
        }
      }
      
      let yeniFotografURLleri: string[] = [];
      if (form.yeniFotograflar.length > 0) {
        try {
          yeniFotografURLleri = await uploadMultipleFiles(
            form.yeniFotograflar,
            'elektrikBakimlar',
            (progress) => setUploadProgress(progress)
          );
        } catch (error) {
          console.error('Yeni fotoğraf yükleme hatası:', error);
          toast.error('Yeni fotoğraflar yüklenirken bir hata oluştu.');
        }
      }

      const kalanMevcutFotograflar = form.mevcutFotograflar.filter(url => !form.silinecekFotograflar.includes(url));
      const tumFotograflar = [...kalanMevcutFotograflar, ...yeniFotografURLleri];

      const firestoreDurumlar = Object.entries(form.durumlar).reduce((acc, [kategoriKey, kategoriValue]) => {
        acc[kategoriKey] = {};
        const aciklamalarKey = `${kategoriKey}Aciklamalar`;
        acc[aciklamalarKey] = {};

        Object.entries(kategoriValue).forEach(([kontrolKey, kontrolValueObj]) => {
          const deger = kontrolValueObj as { durum: boolean; aciklama: string };
          acc[kategoriKey][kontrolKey] = deger.durum;
          if (deger.aciklama && deger.aciklama.trim() !== '') {
            acc[aciklamalarKey][kontrolKey] = deger.aciklama;
          }
        });
        
        if (Object.keys(acc[aciklamalarKey]).length === 0) {
            delete acc[aciklamalarKey];
        }
        return acc;
      }, {} as any);

      const bakimData = {
        sahaId: form.sahaId,
        tarih: Timestamp.fromDate(new Date(form.tarih)),
        fotograflar: tumFotograflar,
        durumlar: firestoreDurumlar,
        genelNotlar: form.genelNotlar,
        kontrolEden: {
          id: kullanici.id,
          ad: kullanici.ad,
          rol: kullanici.rol
        },
        companyId: kullanici.companyId,
        olusturmaTarihi: mode === 'add' ? Timestamp.now() : bakimToEdit?.olusturmaTarihi,
        guncellenmeTarihi: Timestamp.now()
      };

      if (mode === 'add') {
        await addDoc(collection(db, 'elektrikBakimlar'), bakimData);
        toast.success('Elektrik bakım kaydı başarıyla oluşturuldu!', { id: 'bakimSubmit' });
      } else if (bakimToEdit?.id) {
        await updateDoc(doc(db, 'elektrikBakimlar', bakimToEdit.id), bakimData);
        toast.success('Elektrik bakım kaydı başarıyla güncellendi!', { id: 'bakimSubmit' });
      }
      
      onSuccess();
      onClose();

    } catch (error: any) {
      console.error('Bakım kaydı hatası:', error);
      toast.error(`Bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`, { id: 'bakimSubmit' });
    } finally {
      setYukleniyor(false);
      toast.dismiss('bakimSubmit');
    }
  };

  const renderKontrolGrubu = (
    baslik: string,
    kategoriKey: string,
    kontroller: { [key: string]: { label: string; key: string } } 
  ) => (
    <div key={kategoriKey} className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm">
      <h3 className="text-lg font-semibold text-blue-700 mb-4 pb-2 border-b border-slate-200">{baslik}</h3>
      {Object.entries(kontroller).map(([kontrolKey, { label }]) => (
        <div key={kontrolKey} className="mb-6 last:mb-0">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">
              {label}
            </label>
            <div className="flex items-center space-x-3">
              {[
                { label: 'Evet', value: true, color: 'text-green-600', icon: <CheckCircle size={20} /> },
                { label: 'Hayır', value: false, color: 'text-red-600', icon: <AlertTriangle size={20} /> }
              ].map(option => (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => handleDurumChange(kategoriKey, kontrolKey, option.value, 'durum')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors duration-150 ease-in-out
                    ${form.durumlar[kategoriKey]?.[kontrolKey]?.durum === option.value
                      ? (option.value ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'bg-red-100 text-red-700 ring-1 ring-red-300')
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  {option.icon}
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
          {form.durumlar[kategoriKey]?.[kontrolKey]?.durum === false && (
            <textarea
              name={`${kategoriKey}-${kontrolKey}-aciklama`}
              placeholder="Açıklama (gerekliyse)"
              value={form.durumlar[kategoriKey]?.[kontrolKey]?.aciklama || ''}
              onChange={(e) => handleDurumChange(kategoriKey, kontrolKey, e.target.value, 'aciklama')}
              className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white text-slate-700 placeholder-slate-400"
              rows={2}
            />
          )}
        </div>
      ))}
    </div>
  );
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-start p-4 overflow-y-auto z-50">
      <div className="bg-slate-50 rounded-xl shadow-2xl w-full max-w-3xl my-8 transform transition-all">
        <div className="flex justify-between items-center p-5 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800">
            {mode === 'add' ? 'Yeni Elektrik Bakım Kaydı' : 'Elektrik Bakım Kaydını Düzenle'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Kapat"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="sahaId" className="block text-sm font-medium text-slate-700 mb-1">
                <Building size={16} className="inline mr-1 mb-0.5" /> Saha
              </label>
              <select
                id="sahaId"
                name="sahaId"
                value={form.sahaId}
                onChange={handleInputChange}
                required
                className="w-full p-2.5 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-700 bg-white"
              >
                <option value="">Saha Seçiniz</option>
                {sahalar.map(saha => (
                  <option key={saha.id} value={saha.id}>{saha.ad}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tarih" className="block text-sm font-medium text-slate-700 mb-1">
                <Calendar size={16} className="inline mr-1 mb-0.5" /> Tarih ve Saat
              </label>
              <input
                type="datetime-local"
                id="tarih"
                name="tarih"
                value={form.tarih}
                onChange={handleInputChange}
                required
                className="w-full p-2.5 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-700 bg-white"
              />
            </div>
          </div>

          <div className="space-y-6">
            {Object.entries(KONTROL_GRUPLARI_ELEKTRIK).map(([key, grup]) =>
              renderKontrolGrubu(grup.baslik, key, grup.kontroller)
            )}
          </div>
          
          <div className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm">
            <h3 className="text-lg font-semibold text-blue-700 mb-3">Fotoğraflar</h3>
            <FileUploadZone
              onFileSelect={handleFileSelect}
            />
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-2 w-full bg-slate-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            )}
            {mode === 'edit' && form.mevcutFotograflar.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-slate-600 mb-2">Mevcut Fotoğraflar:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {form.mevcutFotograflar.map(url => (
                    <div key={url} className="relative group">
                      <img src={url} alt="Mevcut Bakım Fotoğrafı" className="w-full h-28 object-cover rounded-md border border-slate-200" />
                      <button
                        type="button"
                        onClick={() => handleToggleDeleteExistingFile(url)}
                        className={`absolute top-1 right-1 p-1 rounded-full transition-colors
                          ${form.silinecekFotograflar.includes(url) ? 'bg-red-500 text-white' : 'bg-white/70 text-slate-700 hover:bg-red-500 hover:text-white backdrop-blur-sm'}`}
                        aria-label="Fotoğrafı Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                      {form.silinecekFotograflar.includes(url) && (
                        <div className="absolute inset-0 bg-red-500 bg-opacity-50 flex items-center justify-center rounded-md">
                          <span className="text-white text-xs font-semibold">Silinecek</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {form.yeniFotograflar.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-slate-600 mb-2">Yeni Yüklenecekler:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {form.yeniFotograflar.map(file => (
                    <div key={file.name} className="relative group">
                       <img 
                          src={URL.createObjectURL(file)} 
                          alt={file.name} 
                          onLoad={e => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                          className="w-full h-28 object-cover rounded-md border border-slate-200" 
                        />
                      <button
                        type="button"
                        onClick={() => handleRemoveNewFile(file.name)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        aria-label="Yeni Fotoğrafı Kaldır"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(mode === 'edit' && form.mevcutFotograflar.length === 0 && form.yeniFotograflar.length === 0) || (mode === 'add' && form.yeniFotograflar.length === 0) ? (
              <div className="mt-3 text-center text-sm text-slate-500 flex items-center justify-center py-3">
                <ImageOff size={18} className="mr-2 text-slate-400" />
                Henüz fotoğraf eklenmemiş.
              </div>
            ) : null}
          </div>

          <div>
            <label htmlFor="genelNotlar" className="block text-sm font-medium text-slate-700 mb-1">
              Genel Notlar
            </label>
            <textarea
              id="genelNotlar"
              name="genelNotlar"
              value={form.genelNotlar}
              onChange={handleInputChange}
              rows={4}
              className="w-full p-2.5 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-slate-700 bg-white placeholder-slate-400"
              placeholder="Bakımla ilgili genel notlarınızı buraya yazabilirsiniz..."
            />
          </div>

          <div className="flex justify-end items-center space-x-3 pt-4 border-t border-slate-200 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={yukleniyor}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={yukleniyor}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 flex items-center"
            >
              {yukleniyor ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">
                    {mode === 'add' ? 'Kaydediliyor...' : 'Güncelleniyor...'}
                  </span>
                </>
              ) : (
                <>
                  <Save size={18} className="mr-2" />
                  {mode === 'add' ? 'Kaydet' : 'Güncelle'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};