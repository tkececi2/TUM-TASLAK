import React, { useState, useEffect } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { X, Camera, Clock, MapPin, MessageSquare, Upload, Calendar } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { uploadMultipleFiles } from '../utils/uploadHelpers';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import type { VardiyaTipi } from '../types';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  mevcutSahalar: Record<string, string>;
}

export const VardiyaBildirimForm: React.FC<Props> = ({ onClose, onSuccess, mevcutSahalar }) => {
  const { kullanici } = useAuth();
  const [yukleniyor, setYukleniyor] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [form, setForm] = useState({
    sahaId: '',
    vardiyaTipi: 'sabah' as VardiyaTipi,
    vardiyaSaati: '',
    vardiyaTarihi: format(new Date(), 'yyyy-MM-dd'),
    yorum: '',
    fotograflar: [] as File[]
  });

  useEffect(() => {
    const sahaIdleri = Object.keys(mevcutSahalar);
    if (sahaIdleri.length === 1) {
      setForm(prev => ({ ...prev, sahaId: sahaIdleri[0] }));
    }
  }, [mevcutSahalar]);

  useEffect(() => {
    if (form.vardiyaTipi === 'sabah') {
      setForm(prev => ({ ...prev, vardiyaSaati: '08:00' }));
    } else {
      setForm(prev => ({ ...prev, vardiyaSaati: '20:00' }));
    }
  }, [form.vardiyaTipi]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 4) {
      toast.error('Maksimum 4 fotoğraf seçebilirsiniz');
      return;
    }
    setForm(prev => ({ ...prev, fotograflar: files }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.sahaId) {
      toast.error('Lütfen saha seçin');
      return;
    }
    
    if (!form.yorum.trim()) {
      toast.error('Lütfen vardiya yorumu yazın');
      return;
    }

    if (form.fotograflar.length === 0) {
      toast.error('Lütfen en az 1 fotoğraf ekleyin');
      return;
    }

    setYukleniyor(true);

    try {
      let fotografURLleri: string[] = [];
      if (form.fotograflar.length > 0) {
        fotografURLleri = await uploadMultipleFiles(
          form.fotograflar,
          'vardiya-bildirimleri',
          (progress) => setUploadProgress(progress)
        );
      }

      const sahaAdi = mevcutSahalar[form.sahaId] || 'Bilinmeyen Saha';
      
      // Seçilen tarihi Timestamp'e çevir
      const secilenTarih = new Date(form.vardiyaTarihi);
      // Saat bilgisini de ekle (vardiya saatini kullan)
      const [saat, dakika] = form.vardiyaSaati.split(':');
      secilenTarih.setHours(parseInt(saat), parseInt(dakika), 0, 0);
      
      await addDoc(collection(db, 'vardiyaBildirimleri'), {
        sahaId: form.sahaId,
        sahaAdi: sahaAdi,
        tarih: Timestamp.fromDate(secilenTarih),
        vardiyaTipi: form.vardiyaTipi,
        vardiyaSaati: form.vardiyaSaati,
        fotograflar: fotografURLleri,
        yorum: form.yorum.trim(),
        bekciId: kullanici!.id,
        bekciAdi: kullanici!.ad,
        olusturmaTarihi: Timestamp.now(),
        companyId: kullanici!.companyId
      });

      toast.success('Vardiya bildirimi başarıyla gönderildi');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Vardiya bildirimi gönderilirken hata:', error);
      toast.error('Vardiya bildirimi gönderilirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-800">
            Yeni Vardiya Bildirimi
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-grow">
          <div>
            <label htmlFor="saha-secimi" className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="h-4 w-4 inline mr-1.5 text-gray-500" />
              {kullanici?.rol === 'bekci' ? 'Görev Yaptığınız Saha' : 'Vardiya Bildirimi Yapılacak Saha'}
            </label>
            <select
              id="saha-secimi"
              required
              value={form.sahaId}
              onChange={e => setForm(prev => ({ ...prev, sahaId: e.target.value }))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={Object.keys(mevcutSahalar).length === 0}
            >
              <option value="">{Object.keys(mevcutSahalar).length === 0 ? 'Atanmış sahanız bulunmuyor' : 'Saha Seçiniz...'}</option>
              {Object.entries(mevcutSahalar).map(([id, ad]) => (
                <option key={id} value={id}>
                  {ad}
                </option>
              ))}
            </select>
            {Object.keys(mevcutSahalar).length === 0 && ['bekci', 'yonetici', 'tekniker', 'muhendis'].includes(kullanici?.rol || '') && (
                 <p className="mt-2 text-xs text-red-600">
                   {kullanici?.rol === 'bekci' ? 
                     'Lütfen önce yöneticinizden size saha atamasını isteyin.' : 
                     'Size atanmış saha bulunmuyor. Lütfen sistem yöneticisi ile iletişime geçin.'}
                 </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label htmlFor="vardiya-tipi" className="block text-sm font-medium text-gray-700 mb-1">
                <Clock className="h-4 w-4 inline mr-1.5 text-gray-500" />
                Vardiya Tipi
              </label>
              <select
                id="vardiya-tipi"
                required
                value={form.vardiyaTipi}
                onChange={e => setForm(prev => ({ ...prev, vardiyaTipi: e.target.value as VardiyaTipi }))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="sabah">Sabah Vardiyası (örn: 08:00 - 20:00)</option>
                <option value="aksam">Akşam Vardiyası (örn: 20:00 - 08:00)</option>
              </select>
            </div>

            <div>
              <label htmlFor="vardiya-saati" className="block text-sm font-medium text-gray-700 mb-1">
                Gerçekleşen Vardiya Başlangıç Saati
              </label>
              <input
                id="vardiya-saati"
                type="time"
                required
                value={form.vardiyaSaati}
                onChange={e => setForm(prev => ({ ...prev, vardiyaSaati: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="vardiya-tarihi" className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="h-4 w-4 inline mr-1.5 text-gray-500" />
                Vardiya Tarihi
            </label>
            <input 
                id="vardiya-tarihi"
                type="date"
                required
                value={form.vardiyaTarihi}
                onChange={e => setForm(prev => ({ ...prev, vardiyaTarihi: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
             <p className="mt-1 text-xs text-gray-500">Bu vardiya hangi güne ait?</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Camera className="h-4 w-4 inline mr-1.5 text-gray-500" />
              Vardiya Fotoğrafları (En az 1, en fazla 4 adet)
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-blue-500 transition-colors">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-10 w-10 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 px-1">
                    <span>Dosya seçin</span>
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                  <p className="pl-1">veya sürükleyip bırakın</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, GIF (Maks. 5MB her biri)</p>
              </div>
            </div>
            {form.fotograflar.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700 mb-1">Seçilen Fotoğraflar:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {form.fotograflar.map((file, index) => (
                    <div key={index} className="relative aspect-square">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Önizleme ${index}`}
                        className="w-full h-full object-cover rounded-md shadow"
                      />
                       <button
                        type="button"
                        onClick={() => setForm(prev => ({...prev, fotograflar: prev.fotograflar.filter((_, i) => i !== index)}))}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:bg-red-600 transition-colors"
                        aria-label="Fotoğrafı kaldır"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                </div>
                <p className="text-xs text-center text-gray-500 mt-1">{Math.round(uploadProgress)}% yüklendi</p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="vardiya-yorumu" className="block text-sm font-medium text-gray-700 mb-1">
              <MessageSquare className="h-4 w-4 inline mr-1.5 text-gray-500" />
              Vardiya Yorumu / Raporu (Detaylı açıklama)
            </label>
            <textarea
              id="vardiya-yorumu"
              rows={4}
              required
              value={form.yorum}
              onChange={e => setForm(prev => ({ ...prev, yorum: e.target.value }))}
              placeholder="Vardiya sırasında gözlemlediğiniz önemli olayları, kontrolleri ve durumları detaylı bir şekilde buraya yazın..."
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>

          <div className="pt-5 sticky bottom-0 bg-white z-10">
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                disabled={yukleniyor}
              >
                İptal
              </button>
              <button
                type="submit"
                className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
                disabled={yukleniyor || Object.keys(mevcutSahalar).length === 0}
              >
                {yukleniyor ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Gönderiliyor...
                  </>
                ) : (
                  'Vardiya Bildirimini Gönder'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}; 