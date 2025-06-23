import React, { useState, useEffect, ReactNode } from 'react';
import { collection, addDoc, updateDoc, Timestamp, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { X, Calendar, Building, Upload, Save, Trash2, ImageOff, PlusCircle, Edit3, AlertCircle, CheckCircle } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { FileUploadZone } from './FileUploadZone';
import { uploadMultipleFiles, deleteFileByUrl } from '../utils/uploadHelpers';
import toast from 'react-hot-toast';
import type { MekanikBakim, Saha } from '../types';

interface Props {
  onClose: () => void;
  sahalar: Pick<Saha, 'id' | 'ad'>[];
  bakimToEdit?: MekanikBakim | null;
  mode: 'add' | 'edit';
  onSuccess: () => void;
}

interface KontrolDurumu {
  durum: boolean;
  aciklama: string;
}

const KONTROL_GRUPLARI = {
  cevreselDurum: {
    baslik: '1. Çevresel Durum',
    kontroller: {
      karTozKum: { label: 'Kar, toz, kum birikimi', key: 'karTozKum' },
      kusKirliligi: { label: 'Kuş popülasyonuna bağlı kirlilik', key: 'kusKirliligi' },
      bitkiHayvan: { label: 'Bitki örtüsü ve yabani hayvan etkileri', key: 'bitkiHayvan' }
    }
  },
  araziDurumu: {
    baslik: '2. Arazi ve Toprak Koşulları',
    kontroller: {
      toprakErozyonu: { label: 'Toprak erozyonu', key: 'toprakErozyonu' },
      suBirikintileri: { label: 'Su birikintileri ve çatlaklar', key: 'suBirikintileri' },
      cokmeVeCukurlar: { label: 'Çökme, çukurlar, oyuklar', key: 'cokmeVeCukurlar' }
    }
  },
  tasiyiciYapilar: {
    baslik: '3. Taşıyıcı Yapılar',
    kontroller: {
      yapiButunlugu: { label: 'Modül taşıyıcı yapı bütünlüğü', key: 'yapiButunlugu' },
      paslanmaKorozyon: { label: 'Paslanma ve korozyon', key: 'paslanmaKorozyon' },
      gevsekBaglantilar: { label: 'Gevşek bağlantılar', key: 'gevsekBaglantilar' }
    }
  },
  kazikVeKirisler: {
    baslik: '4. Kazıklar ve Kirişler',
    kontroller: {
      boyutlar: { label: 'Kazık ve kiriş türleri/boyutları', key: 'boyutlar' },
      paslanmaKorozyon: { label: 'Paslanma ve korozyon', key: 'paslanmaKorozyon' },
      gevsekCivatalar: { label: 'Gevşek civatalar', key: 'gevsekCivatalar' }
    }
  },
  pvModulleri: {
    baslik: '5. PV Modülleri',
    kontroller: {
      kirilmaVeCatlaklar: { label: 'Kırılma, çatlama ve renk bozulmaları', key: 'kirilmaVeCatlaklar' },
      tozKirBirikimi: { label: 'Toz/kir birikimi ve sıcak noktalar', key: 'tozKirBirikimi' },
      gevsekKlempler: { label: 'Gevşek klempler', key: 'gevsekKlempler' }
    }
  },
  elektrikSistemleri: {
    baslik: '6. Elektrik Sistemleri',
    kontroller: {
      montajYapilari: { label: 'İnvertör ve DC/AC kutu montaj yapıları', key: 'montajYapilari' },
      paslanmaKorozyon: { label: 'Paslanma ve korozyon', key: 'paslanmaKorozyon' },
      gevsekBaglantilar: { label: 'Gevşek bağlantılar', key: 'gevsekBaglantilar' }
    }
  }
};

export const MekanikBakimForm: React.FC<Props> = ({ onClose, sahalar, bakimToEdit, mode, onSuccess }): ReactNode => {
  const { kullanici } = useAuth();
  const [yukleniyor, setYukleniyor] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  
  const [sahaId, setSahaId] = useState('');
  const [tarih, setTarih] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [yeniFotograflar, setYeniFotograflar] = useState<File[]>([]);
  const [mevcutFotograflar, setMevcutFotograflar] = useState<string[]>([]);
  const [silinecekFotograflar, setSilinecekFotograflar] = useState<string[]>([]);
  const [durumlarState, setDurumlarState] = useState(
    Object.fromEntries(
      Object.entries(KONTROL_GRUPLARI).map(([kategoriKey, kategoriData]) => [
        kategoriKey,
        Object.fromEntries(
          Object.entries(kategoriData.kontroller).map(([kontrolKey]) => [
            kontrolKey,
            { durum: true, aciklama: '' } as KontrolDurumu
          ])
        )
      ])
    )
  );
  const [genelNotlar, setGenelNotlar] = useState('');

  useEffect(() => {
    if (mode === 'edit' && bakimToEdit) {
      setSahaId(bakimToEdit.sahaId);
      setTarih(format(bakimToEdit.tarih.toDate(), "yyyy-MM-dd'T'HH:mm"));
      setMevcutFotograflar(bakimToEdit.fotograflar || []);
      setGenelNotlar(bakimToEdit.genelNotlar || '');

      const initialDurumlar = Object.fromEntries(
        Object.entries(KONTROL_GRUPLARI).map(([kategoriKey, kategoriData]) => {
          const kategoriDurumlari = bakimToEdit.durumlar[kategoriKey as keyof MekanikBakim['durumlar']] || {};
          const kategoriAciklamalari = bakimToEdit.durumlar[`${kategoriKey}Aciklamalar` as keyof MekanikBakim['durumlar']] || {};
          
          return [
            kategoriKey,
            Object.fromEntries(
              Object.entries(kategoriData.kontroller).map(([kontrolKey, kontrolDef]) => [
                kontrolKey,
                { 
                  durum: (kategoriDurumlari as Record<string, boolean>)[kontrolDef.key] !== undefined 
                         ? (kategoriDurumlari as Record<string, boolean>)[kontrolDef.key] 
                         : true,
                  aciklama: (kategoriAciklamalari as Record<string, string>)[kontrolDef.key] || ''
                } as KontrolDurumu
              ])
            )
          ];
        })
      );
      setDurumlarState(initialDurumlar);
      setYeniFotograflar([]);
      setSilinecekFotograflar([]);
    } else {
      // Reset for "add" mode or if no data to edit
      setSahaId('');
      setTarih(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setMevcutFotograflar([]);
      setGenelNotlar('');
      setDurumlarState(
        Object.fromEntries(
          Object.entries(KONTROL_GRUPLARI).map(([kategoriKey, kategoriData]) => [
            kategoriKey,
            Object.fromEntries(
              Object.entries(kategoriData.kontroller).map(([kontrolKey]) => [
                kontrolKey,
                { durum: true, aciklama: '' } as KontrolDurumu
              ])
            )
          ])
        )
      );
      setYeniFotograflar([]);
      setSilinecekFotograflar([]);
    }
  }, [mode, bakimToEdit]);

  const handleDurumChange = (
    kategori: string,
    alan: string,
    value: boolean | string,
    tip: 'durum' | 'aciklama'
  ) => {
    setDurumlarState(prev => ({
      ...prev,
      [kategori]: {
        ...prev[kategori],
        [alan]: {
          ...(prev[kategori][alan] as KontrolDurumu),
          [tip]: value
        }
      }
    }));
  };

  const handleYeniFotograflarSecildi = (files: File[]) => {
    setYeniFotograflar(prev => [...prev, ...files]);
  };

  const handleMevcutFotografSil = (url: string) => {
    setMevcutFotograflar(prev => prev.filter(photoUrl => photoUrl !== url));
    setSilinecekFotograflar(prev => [...prev, url]);
  };

  const handleYeniFotografSil = (fileName: string) => {
    setYeniFotograflar(prev => prev.filter(file => file.name !== fileName));
  };
  
  const validateForm = (): boolean => {
    if (!sahaId) {
      toast.error('Lütfen bir saha seçin.');
      return false;
    }
    if (!tarih) {
      toast.error('Lütfen tarih ve saat girin.');
      return false;
    }
    // Ekstra validasyonlar eklenebilir (örn: en az bir kontrol grubu için giriş vs.)
    return true;
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kullanici || !kullanici.companyId) {
      toast.error('Kullanıcı bilgileri bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }
    if (!validateForm()) return;

    const izinliRoller = ['yonetici', 'tekniker', 'muhendis', 'superadmin'];
    if (!izinliRoller.includes(kullanici.rol)) {
      toast.error('Bu işlem için yetkiniz bulunmuyor');
      return;
    }

    setYukleniyor(true);
    let sonFotografURLleri: string[] = [...mevcutFotograflar];

    try {
      // 1. Silinecek fotoğrafları Storage'dan sil
      if (silinecekFotograflar.length > 0) {
        toast.loading('Eski fotoğraflar siliniyor...', { id: 'deletePhotos' });
        for (const url of silinecekFotograflar) {
          try {
            await deleteFileByUrl(url);
          } catch (error) {
            console.warn(`Eski fotoğraf silinemedi: ${url}`, error);
          }
        }
        toast.success('Eski fotoğraflar silindi.', { id: 'deletePhotos' });
      }

      // 2. Yeni fotoğrafları yükle
      if (yeniFotograflar.length > 0) {
        toast.loading('Yeni fotoğraflar yükleniyor...', { id: 'uploadPhotos' });
        const yeniYuklenenURLler = await uploadMultipleFiles(
          yeniFotograflar,
          `mekanikBakimlar/${kullanici.companyId}`,
          (progress) => setUploadProgress(progress)
        );
        sonFotografURLleri = [...sonFotografURLleri, ...yeniYuklenenURLler];
        toast.success(`${yeniYuklenenURLler.length} yeni fotoğraf yüklendi.`, { id: 'uploadPhotos' });
      }
      
      // Durumları Firestore'a uygun formata getir
      const tempDurumlarStorage: { [key: string]: Record<string, boolean> | Record<string, string> } = {};
      for (const [kategoriKey, kategoriValue] of Object.entries(durumlarState)) {
          const durumlarMap: Record<string, boolean> = {};
          const aciklamalarMap: Record<string, string> = {};
          for (const [kontrolKey, kontrolValue] of Object.entries(kategoriValue as Record<string, KontrolDurumu>)) {
              durumlarMap[kontrolKey] = kontrolValue.durum;
              if (kontrolValue.aciklama && kontrolValue.aciklama.trim() !== '') {
                  aciklamalarMap[kontrolKey] = kontrolValue.aciklama.trim();
              }
          }
          tempDurumlarStorage[kategoriKey] = durumlarMap;
          if (Object.keys(aciklamalarMap).length > 0) {
              tempDurumlarStorage[`${kategoriKey}Aciklamalar`] = aciklamalarMap;
          }
      }
      const firestoreDurumlar = tempDurumlarStorage as MekanikBakim['durumlar'];

      const bakimData = {
        sahaId,
        tarih: Timestamp.fromDate(parseISO(tarih)),
        fotograflar: sonFotografURLleri,
        durumlar: firestoreDurumlar,
        genelNotlar: genelNotlar.trim(),
        companyId: kullanici.companyId,
      };

      if (mode === 'edit' && bakimToEdit?.id) {
        const bakimRef = doc(db, 'mekanikBakimlar', bakimToEdit.id);
        await updateDoc(bakimRef, {
          ...bakimData,
          // olusturanKisi ve olusturmaTarihi korunur, guncellenmeTarihi eklenir
          kontrolEden: bakimToEdit.kontrolEden, 
          olusturmaTarihi: bakimToEdit.olusturmaTarihi,
          guncellenmeTarihi: Timestamp.now(),
        });
        toast.success('Mekanik bakım kaydı başarıyla güncellendi!');
      } else {
        await addDoc(collection(db, 'mekanikBakimlar'), {
          ...bakimData,
          kontrolEden: {
            id: kullanici.id,
            ad: kullanici.ad || 'Bilinmeyen Kullanıcı',
            rol: kullanici.rol || 'Bilinmiyor',
          },
          olusturmaTarihi: Timestamp.now(),
        });
        toast.success('Mekanik bakım kaydı başarıyla oluşturuldu!');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error(`Mekanik bakım ${mode === 'edit' ? 'güncelleme' : 'oluşturma'} hatası:`, error);
      toast.error(error.message || `Kayıt ${mode === 'edit' ? 'güncellenirken' : 'oluşturulurken'} bir hata oluştu.`);
    } finally {
      setYukleniyor(false);
      toast.dismiss('deletePhotos');
      toast.dismiss('uploadPhotos');
      setUploadProgress(0);
    }
  };

  const renderKontrolGrubu = (
    kategoriKey: string,
    grupData: { baslik: string; kontroller: { [key: string]: { label: string; key: string } } }
  ) => (
    <div key={kategoriKey} className="mb-8 p-6 bg-white rounded-lg shadow border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-200">{grupData.baslik}</h3>
      {Object.entries(grupData.kontroller).map(([kontrolKey, { label }]) => (
        <div key={kontrolKey} className="mb-4 p-3 bg-slate-50 rounded-md border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700 flex-1">
              {label}
            </label>
            <div className="flex items-center">
               <input
                type="checkbox"
                checked={durumlarState[kategoriKey]?.[kontrolKey]?.durum ?? true}
                onChange={(e) => handleDurumChange(kategoriKey, kontrolKey, e.target.checked, 'durum')}
                disabled={yukleniyor}
                className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <span className="ml-2 text-sm text-slate-600">
                {durumlarState[kategoriKey]?.[kontrolKey]?.durum ? 'Uygun' : 'Sorunlu'}
              </span>
            </div>
          </div>
          <textarea
            value={durumlarState[kategoriKey]?.[kontrolKey]?.aciklama ?? ''}
            onChange={(e) => handleDurumChange(kategoriKey, kontrolKey, e.target.value, 'aciklama')}
            placeholder="Açıklama (gerekliyse)"
            rows={2}
            disabled={yukleniyor}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-[60] backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-50 rounded-xl w-full max-w-3xl max-h-[95vh] flex flex-col shadow-2xl border border-gray-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0 bg-white rounded-t-xl">
          <h2 className="text-xl font-semibold text-slate-800 flex items-center">
            {mode === 'edit' ? <Edit3 className="h-6 w-6 mr-2 text-blue-600" /> : <PlusCircle className="h-6 w-6 mr-2 text-blue-600" />}
            {mode === 'edit' ? 'Mekanik Bakım Kaydını Düzenle' : 'Yeni Mekanik Bakım Kaydı Ekle'}
          </h2>
          <button 
            onClick={onClose} 
            disabled={yukleniyor}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label htmlFor="sahaId" className="block text-sm font-medium text-slate-700 mb-1">
                <Building className="inline-block h-4 w-4 mr-1.5 text-blue-600 align-text-bottom"/>Saha <span className="text-red-500">*</span>
              </label>
              <select
                id="sahaId"
                value={sahaId}
                onChange={(e) => setSahaId(e.target.value)}
                disabled={yukleniyor}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700 disabled:bg-slate-100"
              >
                <option value="">Saha Seçiniz</option>
                {sahalar.map(s => (
                  <option key={s.id} value={s.id}>{s.ad}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tarih" className="block text-sm font-medium text-slate-700 mb-1">
                <Calendar className="inline-block h-4 w-4 mr-1.5 text-blue-600 align-text-bottom"/>Bakım Tarihi ve Saati <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                id="tarih"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                disabled={yukleniyor}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
              />
            </div>
          </div>

          {/* Kontrol Grupları */}
          <div>
            {Object.entries(KONTROL_GRUPLARI).map(([kategoriKey, grupData]) =>
              renderKontrolGrubu(kategoriKey, grupData)
            )}
          </div>
          
          {/* Fotoğraf Yükleme */}
          <div className="p-6 bg-white rounded-lg shadow border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Fotoğraflar</h3>
            {/* Mevcut Fotoğraflar */}
            {mode === 'edit' && mevcutFotograflar.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-slate-600 mb-2">Mevcut Fotoğraflar:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {mevcutFotograflar.map(url => (
                    <div key={url} className="relative group border border-slate-200 rounded-md overflow-hidden">
                      <img src={url} alt="Mevcut Bakım Fotoğrafı" className="h-32 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleMevcutFotografSil(url)}
                        disabled={yukleniyor}
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                        title="Fotoğrafı Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
             {/* Silinmek üzere işaretlenenler (isteğe bağlı gösterim) */}
             {silinecekFotograflar.length > 0 && (
                <p className="text-xs text-amber-600 mb-2 italic">
                    {silinecekFotograflar.length} fotoğraf silinmek üzere işaretlendi. Değişiklikler kaydedildiğinde silinecektir.
                </p>
            )}

            <FileUploadZone 
              onFileSelect={handleYeniFotograflarSecildi} 
              disabled={yukleniyor}
            />
            {yeniFotograflar.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-600 mb-2">Yüklenecek Yeni Fotoğraflar ({yeniFotograflar.length} adet):</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {yeniFotograflar.map(file => (
                    <div key={file.name} className="relative group border border-slate-200 rounded-md overflow-hidden">
                       <img 
                          src={URL.createObjectURL(file)} 
                          alt={file.name} 
                          onLoad={e => URL.revokeObjectURL((e.target as HTMLImageElement).src)} // Bellek sızıntısını önle
                          className="h-32 w-full object-cover" 
                        />
                      <button
                        type="button"
                        onClick={() => handleYeniFotografSil(file.name)}
                        disabled={yukleniyor}
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                        title="Yüklemeden Kaldır"
                      >
                        <X size={14} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                        {file.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-3 w-full bg-slate-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            )}
          </div>

          {/* Genel Notlar */}
          <div className="p-6 bg-white rounded-lg shadow border border-slate-200">
            <label htmlFor="genelNotlar" className="block text-lg font-semibold text-slate-800 mb-3">
              Genel Notlar ve Bulgular
            </label>
            <textarea
              id="genelNotlar"
              value={genelNotlar}
              onChange={(e) => setGenelNotlar(e.target.value)}
              rows={5}
              disabled={yukleniyor}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
              placeholder="Bakımla ilgili genel notlarınızı, gözlemlerinizi ve yapılan ek işlemleri buraya yazabilirsiniz..."
            />
          </div>
        </form>

        {/* Footer with Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-white rounded-b-xl flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={yukleniyor}
            className="px-5 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
          >
            İptal
          </button>
          <button
            type="submit" 
            onClick={handleSubmit} // Form dışı butondan submit tetikleme
            disabled={yukleniyor}
            className="px-5 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 flex items-center justify-center min-w-[180px]"
          >
            {yukleniyor ? (
              <LoadingSpinner size='sm' />
            ) : (mode === 'edit' ? <Save size={18} className='mr-2'/> : <CheckCircle size={18} className='mr-2'/>)}
            <span className="ml-1">
              {mode === 'edit' ? 'Değişiklikleri Kaydet' : 'Bakımı Kaydet'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};