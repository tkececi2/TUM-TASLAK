import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, Timestamp, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { X, Building, Calendar, PlusCircle, Trash2, Edit3, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import toast from 'react-hot-toast';
import type { InvertorKontrol, Saha } from '../types';

interface InvertorFormState {
  ad: string;
  dizeCalisiyor: boolean;
}

interface Props {
  onClose: () => void;
  sahalar: Pick<Saha, 'id' | 'ad'>[];
  kontrolToEdit?: InvertorKontrol | null;
  mode: 'add' | 'edit';
  onSuccess: () => void;
}

export const InvertorKontrolForm: React.FC<Props> = ({ 
  onClose, 
  sahalar, 
  kontrolToEdit, 
  mode, 
  onSuccess 
}) => {
  const { kullanici } = useAuth();
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sahaId, setSahaId] = useState('');
  const [tarih, setTarih] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [aciklama, setAciklama] = useState('');
  const [invertorlerListesi, setInvertorlerListesi] = useState<InvertorFormState[]>([{ ad: '', dizeCalisiyor: true }]);

  useEffect(() => {
    if (mode === 'edit' && kontrolToEdit) {
      setSahaId(kontrolToEdit.sahaId);
      setTarih(format(kontrolToEdit.tarih.toDate(), "yyyy-MM-dd'T'HH:mm"));
      setAciklama(kontrolToEdit.aciklama || '');
      setInvertorlerListesi(kontrolToEdit.invertorler.map(inv => ({ ad: inv.ad, dizeCalisiyor: inv.dizeCalisiyor })));
    } else {
      // Reset for "add" mode or if no data to edit
      setSahaId('');
      setTarih(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setAciklama('');
      setInvertorlerListesi([{ ad: '', dizeCalisiyor: true }]);
    }
  }, [mode, kontrolToEdit]);

  const handleInvertorChange = (index: number, field: keyof InvertorFormState, value: string | boolean) => {
    const newList = [...invertorlerListesi];
    if (field === 'dizeCalisiyor' && typeof value === 'boolean') {
      newList[index][field] = value;
    } else if (field === 'ad' && typeof value === 'string') {
      newList[index][field] = value;
    }
    setInvertorlerListesi(newList);
  };

  const handleAddInvertor = () => {
    setInvertorlerListesi([...invertorlerListesi, { ad: '', dizeCalisiyor: true }]);
  };

  const handleRemoveInvertor = (index: number) => {
    if (invertorlerListesi.length <= 1) {
      toast.error('En az bir invertör bulunmalıdır.');
      return;
    }
    const newList = invertorlerListesi.filter((_, i) => i !== index);
    setInvertorlerListesi(newList);
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
    if (invertorlerListesi.some(inv => !inv.ad.trim())) {
      toast.error('Lütfen tüm invertör adlarını girin.');
      return false;
    }
    if (invertorlerListesi.length === 0) {
      toast.error('Lütfen en az bir invertör ekleyin.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kullanici || !kullanici.companyId) {
      toast.error('Kullanıcı bilgileri bulunamadı. Lütfen tekrar giriş yapın.');
      return;
    }
    if (!validateForm()) return;

    setYukleniyor(true);
    try {
      const kontrolData = {
        sahaId,
        tarih: Timestamp.fromDate(parseISO(tarih)),
        aciklama: aciklama.trim(),
        invertorler: invertorlerListesi.map(inv => ({ ad: inv.ad.trim(), dizeCalisiyor: inv.dizeCalisiyor })),
        companyId: kullanici.companyId,
      };

      if (mode === 'edit' && kontrolToEdit?.id) {
        const kontrolRef = doc(db, 'invertorKontroller', kontrolToEdit.id);
        await updateDoc(kontrolRef, {
          ...kontrolData,
          olusturanKisi: kontrolToEdit.olusturanKisi, // Keep original creator
          olusturmaTarihi: kontrolToEdit.olusturmaTarihi, // Keep original creation date
          guncellenmeTarihi: Timestamp.now(),
        });
        toast.success('İnvertör kontrol kaydı başarıyla güncellendi!');
      } else {
        await addDoc(collection(db, 'invertorKontroller'), {
          ...kontrolData,
          olusturanKisi: {
            id: kullanici.id,
            ad: kullanici.ad || 'Bilinmeyen Kullanıcı',
            rol: kullanici.rol || 'Bilinmiyor',
          },
          olusturmaTarihi: Timestamp.now(),
        });
        toast.success('İnvertör kontrol kaydı başarıyla oluşturuldu!');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('İnvertör kontrol kaydı işleme hatası:', error);
      toast.error(error.message || 'Kayıt işlenirken bir hata oluştu.');
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-[60] backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0 bg-slate-50 rounded-t-xl">
          <h2 className="text-xl font-semibold text-slate-800 flex items-center">
            {mode === 'edit' ? <Edit3 className="h-6 w-6 mr-2 text-blue-600" /> : <PlusCircle className="h-6 w-6 mr-2 text-blue-600" />}
            {mode === 'edit' ? 'İnvertör Kontrolünü Düzenle' : 'Yeni İnvertör Kontrolü Ekle'}
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="sahaId" className="block text-sm font-medium text-slate-700 mb-1">
                <Building className="inline-block h-4 w-4 mr-1.5 text-blue-600 align-text-bottom"/>Saha <span className="text-red-500">*</span>
              </label>
              <select
                id="sahaId"
                value={sahaId}
                onChange={(e) => setSahaId(e.target.value)}
                disabled={yukleniyor}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700 disabled:bg-slate-50"
              >
                <option value="">Saha Seçiniz</option>
                {sahalar.map(s => (
                  <option key={s.id} value={s.id}>{s.ad}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tarih" className="block text-sm font-medium text-slate-700 mb-1">
                <Calendar className="inline-block h-4 w-4 mr-1.5 text-blue-600 align-text-bottom"/>Kontrol Tarihi ve Saati <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                id="tarih"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                disabled={yukleniyor}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
              />
            </div>
          </div>
          
          <div>
            <h3 className="text-md font-semibold text-slate-800 mb-3 border-b pb-2">İnvertörler</h3>
            {invertorlerListesi.map((invertor, index) => (
              <div key={index} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <input
                  type="text"
                  placeholder={`İnvertör ${index + 1} Adı`}
                  value={invertor.ad}
                  onChange={(e) => handleInvertorChange(index, 'ad', e.target.value)}
                  disabled={yukleniyor}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex items-center">
                  <input 
                    type="checkbox"
                    id={`dizeCalisiyor-${index}`}
                    checked={invertor.dizeCalisiyor}
                    onChange={(e) => handleInvertorChange(index, 'dizeCalisiyor', e.target.checked)}
                    disabled={yukleniyor}
                    className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor={`dizeCalisiyor-${index}`} className="ml-2 text-sm text-slate-700 cursor-pointer">
                    Dize Çalışıyor
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveInvertor(index)}
                  disabled={yukleniyor || invertorlerListesi.length <= 1}
                  className="p-2 text-red-500 hover:text-red-700 disabled:text-gray-300 rounded-md hover:bg-red-50 transition-colors"
                  title="İnvertörü Sil"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddInvertor}
              disabled={yukleniyor}
              className="mt-2 inline-flex items-center px-4 py-2 border border-dashed border-blue-400 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <PlusCircle className="h-5 w-5 mr-2" />
              Yeni İnvertör Ekle
            </button>
          </div>

          <div>
            <label htmlFor="aciklama" className="block text-sm font-medium text-slate-700 mb-1">
              Açıklama / Notlar (Opsiyonel)
            </label>
            <textarea
              id="aciklama"
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              rows={4}
              disabled={yukleniyor}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
              placeholder="Kontrol ile ilgili genel notlar, bulgular vb."
            />
          </div>
        </form>

        {/* Footer with Actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0 bg-slate-50 rounded-b-xl flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={yukleniyor}
            className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
          >
            İptal
          </button>
          <button
            type="submit"
            onClick={handleSubmit} 
            disabled={yukleniyor}
            className="px-5 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 flex items-center justify-center min-w-[140px]"
          >
            {yukleniyor ? (
              <LoadingSpinner size='sm' />
            ) : (mode === 'edit' ? <Save size={18} className='mr-2'/> : <CheckCircle size={18} className='mr-2'/>)}
            <span className="ml-1">
              {mode === 'edit' ? 'Değişiklikleri Kaydet' : 'Kontrolü Kaydet'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};