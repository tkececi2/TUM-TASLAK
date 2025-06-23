import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, Timestamp, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { X, Calendar, Building, Clock, AlertTriangle, Edit3, Zap } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import toast from 'react-hot-toast';
import type { ElektrikKesinti } from '../types';

interface Props {
  onClose: () => void;
  sahalar: Array<{
    id: string;
    ad: string;
  }>;
  kesintiToEdit?: ElektrikKesinti | null;
  mode: 'add' | 'edit';
  onSuccess: () => void;
}

export const ElektrikKesintisiForm: React.FC<Props> = ({ onClose, sahalar, kesintiToEdit, mode, onSuccess }) => {
  const { kullanici } = useAuth();
  const [yukleniyor, setYukleniyor] = useState(false);
  const [form, setForm] = useState({
    sahaId: '',
    baslangicTarihi: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    bitisTarihi: '',
    aciklama: '',
    etkiAlani: '',
    durum: 'devam-ediyor' as 'devam-ediyor' | 'tamamlandi'
  });

  useEffect(() => {
    if (mode === 'edit' && kesintiToEdit) {
      setForm({
        sahaId: kesintiToEdit.sahaId || '',
        baslangicTarihi: kesintiToEdit.baslangicTarihi ? format(kesintiToEdit.baslangicTarihi.toDate(), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        bitisTarihi: kesintiToEdit.bitisTarihi ? format(kesintiToEdit.bitisTarihi.toDate(), "yyyy-MM-dd'T'HH:mm") : '',
        aciklama: kesintiToEdit.aciklama || '',
        etkiAlani: kesintiToEdit.etkiAlani || '',
        durum: kesintiToEdit.durum || 'devam-ediyor'
      });
    } else {
      // Reset for "add" mode
      setForm({
        sahaId: '',
        baslangicTarihi: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        bitisTarihi: '',
        aciklama: '',
        etkiAlani: '',
        durum: 'devam-ediyor'
      });
    }
  }, [mode, kesintiToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kullanici?.companyId) {
      toast.error('Oturum bilgisi bulunamadı.');
      return;
    }

    if (!form.sahaId || !form.baslangicTarihi || !form.aciklama) {
      toast.error('Lütfen Saha, Başlangıç Tarihi ve Açıklama alanlarını doldurun.');
      return;
    }

    setYukleniyor(true);
    try {
      const baslangic = parseISO(form.baslangicTarihi);
      const bitis = form.bitisTarihi ? parseISO(form.bitisTarihi) : null;
      
      if(bitis && bitis < baslangic){
        toast.error('Bitiş tarihi başlangıç tarihinden önce olamaz.');
        setYukleniyor(false);
        return;
      }

      let sure = 0;
      if (bitis) {
        sure = Math.max(0, Math.round((bitis.getTime() - baslangic.getTime()) / (1000 * 60))); // Ensure duration is not negative
      }

      const kesintiData = {
        sahaId: form.sahaId,
        baslangicTarihi: Timestamp.fromDate(baslangic),
        bitisTarihi: bitis ? Timestamp.fromDate(bitis) : null,
        sure: sure,
        aciklama: form.aciklama,
        etkiAlani: form.etkiAlani || '',
        durum: bitis ? 'tamamlandi' : 'devam-ediyor',
        companyId: kullanici.companyId,
      };

      if (mode === 'edit' && kesintiToEdit?.id) {
        const kesintiRef = doc(db, 'elektrikKesintileri', kesintiToEdit.id);
        await updateDoc(kesintiRef, {
            ...kesintiData,
            // Ensure olusturanKisi and olusturmaTarihi are not overwritten if they exist
            olusturanKisi: kesintiToEdit.olusturanKisi, 
            olusturmaTarihi: kesintiToEdit.olusturmaTarihi,
            guncellenmeTarihi: Timestamp.now()
        });
        toast.success('Kesinti kaydı başarıyla güncellendi');
      } else {
        await addDoc(collection(db, 'elektrikKesintileri'), {
          ...kesintiData,
          olusturanKisi: {
            id: kullanici.id,
            ad: kullanici.ad || 'Bilinmiyor'
          },
          olusturmaTarihi: Timestamp.now(),
        });
        toast.success('Kesinti kaydı başarıyla oluşturuldu');
      }
      onSuccess(); // Call the success callback
      onClose();
    } catch (error: any) {
      console.error('Kesinti kaydı işleme hatası:', error);
      toast.error(error.message || 'Kesinti kaydı işlenirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-[60] backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl w-full max-w-lg h-auto max-h-[90vh] flex flex-col shadow-2xl border border-gray-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0 bg-slate-50 rounded-t-xl">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center">
            {mode === 'edit' ? <Edit3 className="h-5 w-5 mr-2 text-blue-600" /> : <Zap className="h-5 w-5 mr-2 text-blue-600" />}
            {mode === 'edit' ? 'Elektrik Kesintisi Düzenle' : 'Yeni Elektrik Kesintisi Kaydı'}
          </h2>
          <button onClick={onClose} disabled={yukleniyor} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="sahaId" className="block text-sm font-medium text-slate-700 mb-1">Saha <span className="text-red-500">*</span></label>
              <select
                id="sahaId"
                required
                value={form.sahaId}
                onChange={e => setForm(prev => ({ ...prev, sahaId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700 disabled:bg-slate-50"
                disabled={yukleniyor}
              >
                <option value="">Saha Seçiniz</option>
                {sahalar.map(saha => (
                  <option key={saha.id} value={saha.id}>{saha.ad}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="baslangicTarihi" className="block text-sm font-medium text-slate-700 mb-1">Başlangıç Tarihi ve Saati <span className="text-red-500">*</span></label>
              <input
                type="datetime-local"
                id="baslangicTarihi"
                required
                value={form.baslangicTarihi}
                onChange={e => setForm(prev => ({ ...prev, baslangicTarihi: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
                disabled={yukleniyor}
              />
            </div>

            <div>
              <label htmlFor="bitisTarihi" className="block text-sm font-medium text-slate-700 mb-1">Bitiş Tarihi ve Saati (Opsiyonel)</label>
              <input
                type="datetime-local"
                id="bitisTarihi"
                value={form.bitisTarihi}
                onChange={e => setForm(prev => ({ ...prev, bitisTarihi: e.target.value, durum: e.target.value ? 'tamamlandi' : 'devam-ediyor' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
                disabled={yukleniyor}
              />
              <p className="mt-1 text-xs text-slate-500">
                Kesinti tamamlandıysa bitiş zamanını girin. Devam ediyorsa boş bırakın.
              </p>
            </div>
            
            <div>
              <label htmlFor="etkiAlani" className="block text-sm font-medium text-slate-700 mb-1">Etkilenen Alan/Bölge (Opsiyonel)</label>
              <input
                type="text"
                id="etkiAlani"
                value={form.etkiAlani}
                onChange={e => setForm(prev => ({ ...prev, etkiAlani: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
                placeholder="Örn: A Blok, 3. Inverter Grubu, Tüm Tesis"
                disabled={yukleniyor}
              />
            </div>

            <div>
              <label htmlFor="aciklama" className="block text-sm font-medium text-slate-700 mb-1">Açıklama / Sebep <span className="text-red-500">*</span></label>
              <textarea
                id="aciklama"
                required
                value={form.aciklama}
                onChange={e => setForm(prev => ({ ...prev, aciklama: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-slate-700"
                placeholder="Kesintinin sebebini ve diğer detayları açıklayınız..."
                disabled={yukleniyor}
              />
            </div>
          </form>
        </div>

        {/* Footer with Actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0 bg-slate-50 rounded-b-xl flex items-center justify-end space-x-3">
             <button
                type="button"
                onClick={onClose}
                disabled={yukleniyor}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
              >
                İptal
              </button>
              <button
                type="submit" // Triggers form onSubmit
                onClick={handleSubmit} // Can also call directly
                disabled={yukleniyor}
                className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 flex items-center justify-center min-w-[120px]"
              >
                {yukleniyor ? (
                  <LoadingSpinner size='sm' />
                ) : (mode === 'edit' ? <Edit3 size={16} className='mr-1.5'/> : <Zap size={16} className='mr-1.5'/>)}
                <span className="ml-1.5">
                 {mode === 'edit' ? 'Güncelle' : 'Kaydet'}
                </span>
              </button>
        </div>
      </div>
    </div>
  );
};