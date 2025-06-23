import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, Timestamp, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { X, Calendar, Building, FileText, Upload, User, Clock, Edit3, Trash2, Plus, ImageOff } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { FileUploadZone } from './FileUploadZone';
import { uploadMultipleFiles, deleteFileByUrl } from '../utils/uploadHelpers';
import toast from 'react-hot-toast';
import type { IsRaporu } from '../types';

interface Props {
  onClose: () => void;
  sahalar: Array<{
    id: string;
    ad: string;
  }>;
  raporToEdit?: IsRaporu | null;
  mode: 'add' | 'edit';
  onSuccess: () => void;
}

export const YapilanIsForm: React.FC<Props> = ({ onClose, sahalar, raporToEdit, mode, onSuccess }) => {
  const { kullanici } = useAuth();
  const [yukleniyor, setYukleniyor] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [initialFotograflar, setInitialFotograflar] = useState<string[]>([]);
  const [fotograflarToRemove, setFotograflarToRemove] = useState<string[]>([]);

  const [form, setForm] = useState({
    baslik: '',
    aciklama: '',
    yapilanIsler: '',
    saha: '',
    tarih: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    baslangicSaati: format(new Date(), "HH:mm"),
    bitisSaati: format(new Date(), "HH:mm"),
    harcananSure: '',
    malzemeler: [''],
    fotograflar: [] as File[],
    mevcutFotograflar: [] as string[]
  });

  useEffect(() => {
    if (mode === 'edit' && raporToEdit) {
      setForm({
        baslik: raporToEdit.baslik || '',
        aciklama: raporToEdit.aciklama || '',
        yapilanIsler: raporToEdit.yapilanIsler || '',
        saha: raporToEdit.saha || '',
        tarih: raporToEdit.tarih ? format(raporToEdit.tarih.toDate(), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        baslangicSaati: raporToEdit.baslangicSaati || format(new Date(), "HH:mm"),
        bitisSaati: raporToEdit.bitisSaati || format(new Date(), "HH:mm"),
        harcananSure: '',
        malzemeler: raporToEdit.malzemeler && raporToEdit.malzemeler.length > 0 ? raporToEdit.malzemeler : [''],
        fotograflar: [],
        mevcutFotograflar: raporToEdit.fotograflar || []
      });
      setInitialFotograflar(raporToEdit.fotograflar || []);
    } else {
      setForm({
        baslik: '',
        aciklama: '',
        yapilanIsler: '',
        saha: '',
        tarih: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        baslangicSaati: format(new Date(), "HH:mm"),
        bitisSaati: format(new Date(), "HH:mm"),
        harcananSure: '',
        malzemeler: [''],
        fotograflar: [],
        mevcutFotograflar: []
      });
      setInitialFotograflar([]);
    }
    setFotograflarToRemove([]);
  }, [mode, raporToEdit]);

  const handleMevcutFotografSil = (url: string) => {
    setForm(prev => ({
      ...prev,
      mevcutFotograflar: prev.mevcutFotograflar.filter(fUrl => fUrl !== url)
    }));
    if (initialFotograflar.includes(url)) {
        setFotograflarToRemove(prev => [...prev, url]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kullanici?.companyId) {
      toast.error('Oturum bilgisi bulunamadı');
      return;
    }

    if (!form.baslik.trim() || !form.yapilanIsler.trim() || !form.saha) {
      toast.error('Lütfen Başlık, Yapılan İşler ve Saha alanlarını doldurun.');
      return;
    }

    setYukleniyor(true);
    setUploadProgress(0);

    try {
      for (const url of fotograflarToRemove) {
         await deleteFileByUrl(url); 
      }

      const yeniFotografURLleri = form.fotograflar.length > 0 
        ? await uploadMultipleFiles(form.fotograflar, 'isRaporlari', (progress) => setUploadProgress(progress))
        : [];

      const sonFotografListesi = [...form.mevcutFotograflar.filter(url => !fotograflarToRemove.includes(url)), ...yeniFotografURLleri];

      const raporData = {
        baslik: form.baslik,
        aciklama: form.aciklama,
        yapilanIsler: form.yapilanIsler,
        saha: form.saha,
        tarih: Timestamp.fromDate(parseISO(form.tarih)),
        baslangicSaati: form.baslangicSaati,
        bitisSaati: form.bitisSaati,
        malzemeler: form.malzemeler.filter(m => m && m.trim() !== ''),
        fotograflar: sonFotografListesi,
        companyId: kullanici.companyId,
      };

      if (mode === 'edit' && raporToEdit?.id) {
        const raporRef = doc(db, 'isRaporlari', raporToEdit.id);
        await updateDoc(raporRef, {
          ...raporData,
          guncellenmeTarihi: Timestamp.now()
        });
        toast.success('İş raporu başarıyla güncellendi');
      } else {
        await addDoc(collection(db, 'isRaporlari'), {
          ...raporData,
          olusturanKisi: {
            id: kullanici.id,
            ad: kullanici.ad || 'Bilinmiyor',
            rol: kullanici.rol || 'Bilinmiyor'
          },
          olusturmaTarihi: Timestamp.now()
        });
        toast.success('İş raporu başarıyla kaydedildi');
      }
      onSuccess(); 
      onClose();
    } catch (error: any) {
      console.error('İş raporu kaydetme/güncelleme hatası:', error);
      toast.error(error.message || 'İş raporu işlenirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
      setUploadProgress(0);
    }
  };
  
  const handleFileChange = (files: File[]) => {
    setForm(prev => ({ ...prev, fotograflar: files }));
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-[60] backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl w-full max-w-2xl h-[95vh] flex flex-col shadow-2xl border border-gray-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0 bg-slate-50 rounded-t-xl">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center">
            {mode === 'edit' ? <Edit3 className="h-5 w-5 mr-2 text-blue-600" /> : <FileText className="h-5 w-5 mr-2 text-blue-600" />}
            {mode === 'edit' ? 'İş Raporu Düzenle' : 'Yeni İş Raporu Oluştur'}
          </h3>
          <button
            onClick={onClose}
            disabled={yukleniyor}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                  <label htmlFor="baslik" className="block text-sm font-medium text-slate-700 mb-1">Başlık <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    id="baslik"
                    required
                    value={form.baslik}
                    onChange={e => setForm(prev => ({ ...prev, baslik: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
                    placeholder="Örn: Periyodik Bakım AC Panel Kontrolü"
                    disabled={yukleniyor}
                  />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="tarih" className="block text-sm font-medium text-slate-700 mb-1">Rapor Tarihi <span className="text-red-500">*</span></label>
                  <input
                    type="datetime-local"
                    id="tarih"
                    required
                    value={form.tarih}
                    onChange={e => setForm(prev => ({ ...prev, tarih: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
                    disabled={yukleniyor}
                  />
                </div>
                 <div>
                  <label htmlFor="saha" className="block text-sm font-medium text-slate-700 mb-1">Saha <span className="text-red-500">*</span></label>
                  <select
                    id="saha"
                    required
                    value={form.saha}
                    onChange={e => setForm(prev => ({ ...prev, saha: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
                    disabled={yukleniyor || (mode === 'edit' && !!raporToEdit?.saha) }
                  >
                    <option value="">Saha Seçiniz</option>
                    {sahalar.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.ad}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="baslangicSaati" className="block text-sm font-medium text-slate-700 mb-1">Başlangıç Saati</label>
                  <input
                    type="time"
                    id="baslangicSaati"
                    value={form.baslangicSaati}
                    onChange={e => setForm(prev => ({ ...prev, baslangicSaati: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
                    disabled={yukleniyor}
                  />
                </div>
                <div>
                  <label htmlFor="bitisSaati" className="block text-sm font-medium text-slate-700 mb-1">Bitiş Saati</label>
                  <input
                    type="time"
                    id="bitisSaati"
                    value={form.bitisSaati}
                    onChange={e => setForm(prev => ({ ...prev, bitisSaati: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
                    disabled={yukleniyor}
                  />
                </div>
              </div>

              <div>
                  <label htmlFor="yapilanIsler" className="block text-sm font-medium text-slate-700 mb-1">Yapılan İşler <span className="text-red-500">*</span></label>
                  <textarea
                    id="yapilanIsler"
                    required
                    value={form.yapilanIsler}
                    onChange={e => setForm(prev => ({ ...prev, yapilanIsler: e.target.value }))}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
                    placeholder="Gerçekleştirilen bakım, onarım veya kontrol işlemlerini detaylı olarak açıklayınız..."
                    disabled={yukleniyor}
                  />
              </div>

               <div>
                  <label htmlFor="aciklama" className="block text-sm font-medium text-slate-700 mb-1">Ek Notlar / Açıklamalar</label>
                  <textarea
                    id="aciklama"
                    value={form.aciklama}
                    onChange={e => setForm(prev => ({ ...prev, aciklama: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
                    placeholder="Varsa ek notlarınızı veya gözlemlerinizi buraya yazabilirsiniz.
Örn: Tespit edilen küçük bir gevşeklik giderildi, bir sonraki bakımda X parçası kontrol edilmeli."
                    disabled={yukleniyor}
                  />
              </div>

              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kullanılan Malzemeler</label>
                  {form.malzemeler.map((malzeme, index) => (
                    <div key={index} className="flex items-center space-x-2 mb-2">
                      <input
                        type="text"
                        value={malzeme}
                        onChange={e => {
                          const yeniMalzemeler = [...form.malzemeler];
                          yeniMalzemeler[index] = e.target.value;
                          setForm(prev => ({ ...prev, malzemeler: yeniMalzemeler }));
                        }}
                        className="flex-grow px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
                        placeholder={`Malzeme ${index + 1}`}
                        disabled={yukleniyor}
                      />
                      {index === form.malzemeler.length - 1 ? (
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, malzemeler: [...prev.malzemeler, ''] }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                          disabled={yukleniyor}
                        >
                          +
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const yeniMalzemeler = form.malzemeler.filter((_, i) => i !== index);
                            setForm(prev => ({ ...prev, malzemeler: yeniMalzemeler.length > 0 ? yeniMalzemeler : [''] }));
                          }}
                          className="px-3 py-2 border border-red-300 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium text-red-600 transition-colors"
                          disabled={yukleniyor}
                        >
                          <Trash2 size={16}/>
                        </button>
                      )}
                    </div>
                  ))}
                   {form.malzemeler.length === 0 && (
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, malzemeler: [''] }))}
                          className="mt-1 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors w-full"
                          disabled={yukleniyor}
                        >
                          Malzeme Ekle
                        </button>
                    )}
              </div>
              
              {mode === 'edit' && form.mevcutFotograflar.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Mevcut Fotoğraflar</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {form.mevcutFotograflar.map((url, index) => (
                      <div key={url + index} className="relative group aspect-square">
                        <img 
                            src={url} 
                            alt={`Mevcut fotoğraf ${index + 1}`} 
                            className="w-full h-full object-cover rounded-lg border border-gray-200 shadow-sm"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                        <button 
                          type="button"
                          onClick={() => handleMevcutFotografSil(url)}
                          className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-80 hover:opacity-100 transition-opacity disabled:opacity-50"
                          title="Bu fotoğrafı sil"
                          disabled={yukleniyor}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {mode === 'edit' ? 'Yeni Fotoğraf Ekle' : 'Fotoğraf Yükle'}
                </label>
                <FileUploadZone 
                    onFileSelect={handleFileChange}
                    uploadProgress={uploadProgress} 
                    disabled={yukleniyor}
                    maxFiles={5 - form.mevcutFotograflar.filter(url => !fotograflarToRemove.includes(url)).length}
                />
              </div>

            </form>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0 bg-slate-50 rounded-b-xl flex items-center justify-end space-x-3">
            {yukleniyor && uploadProgress > 0 && uploadProgress < 100 && (
                <div className="text-sm text-blue-600 flex items-center">
                    <LoadingSpinner size='sm' />
                    <span className="ml-2">Fotoğraflar Yükleniyor: {uploadProgress.toFixed(0)}%</span>
                </div>
            )}
             <button
                type="button"
                onClick={onClose}
                disabled={yukleniyor}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
              >
                İptal
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={yukleniyor}
                className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 flex items-center justify-center min-w-[150px]"
              >
                {yukleniyor ? (
                  <LoadingSpinner size='sm' />
                ) : (
                  mode === 'edit' ? <Edit3 size={16} className='mr-1.5'/> : <Plus size={16} className='mr-1.5'/>
                )}
                <span className="ml-1.5">
                 {mode === 'edit' ? 'Değişiklikleri Kaydet' : 'Raporu Oluştur'}
                </span>
              </button>
        </div>

      </div>
    </div>
  );
};