import React, { useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { X, Calendar, Building, Clock, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import type { ElektrikKesinti } from '../types';

interface Props {
  kesinti: ElektrikKesinti;
  sahaAdi: string;
  onClose: () => void;
}

export const ElektrikKesintisiDetay: React.FC<Props> = ({ kesinti, sahaAdi, onClose }) => {
  const { kullanici } = useAuth();
  const [yukleniyor, setYukleniyor] = useState(false);
  
  // Yönetici veya teknisyen kontrolü
  const canEdit = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);

  const formatSure = (dakika: number): string => {
    const saat = Math.floor(dakika / 60);
    const kalanDakika = dakika % 60;
    
    if (saat === 0) {
      return `${kalanDakika} dakika`;
    } else if (kalanDakika === 0) {
      return `${saat} saat`;
    } else {
      return `${saat} saat ${kalanDakika} dakika`;
    }
  };

  const handleKesintiyiTamamla = async () => {
    if (!canEdit) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }

    setYukleniyor(true);
    try {
      const bitisTarihi = new Date();
      const sure = Math.round((bitisTarihi.getTime() - kesinti.baslangicTarihi.toDate().getTime()) / (1000 * 60));

      await updateDoc(doc(db, 'elektrikKesintileri', kesinti.id), {
        bitisTarihi: Timestamp.fromDate(bitisTarihi),
        sure: sure,
        durum: 'tamamlandi',
        guncellenmeTarihi: Timestamp.now()
      });

      toast.success('Kesinti tamamlandı olarak işaretlendi');
      onClose();
    } catch (error) {
      console.error('Kesinti tamamlama hatası:', error);
      toast.error('Kesinti tamamlanırken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-slate-50 rounded-t-xl">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800">{sahaAdi}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={yukleniyor}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Status and Actions */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-xl ${
                kesinti.durum === 'devam-ediyor' 
                  ? 'bg-red-100' 
                  : 'bg-green-100'
              }`}>
                {kesinti.durum === 'devam-ediyor' ? (
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                )}
              </div>
              <div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  kesinti.durum === 'devam-ediyor' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {kesinti.durum === 'devam-ediyor' ? 'Kesinti Devam Ediyor' : 'Kesinti Tamamlandı'}
                </span>
                <p className="text-sm text-slate-600 mt-1">
                  {kesinti.durum === 'devam-ediyor' ? 'Aktif kesinti kaydı' : 'Tamamlanmış kesinti kaydı'}
                </p>
              </div>
            </div>

            {kesinti.durum === 'devam-ediyor' && canEdit && (
              <button
                onClick={handleKesintiyiTamamla}
                disabled={yukleniyor}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200 disabled:bg-green-300"
              >
                {yukleniyor ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Kesintiyi Tamamla
                  </>
                )}
              </button>
            )}
          </div>

          {/* Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                  Başlangıç Tarihi
                </h3>
                <p className="text-lg font-semibold text-slate-800">
                  {format(kesinti.baslangicTarihi.toDate(), 'dd MMMM yyyy', { locale: tr })}
                </p>
                <p className="text-sm text-slate-600">
                  {format(kesinti.baslangicTarihi.toDate(), 'HH:mm', { locale: tr })}
                </p>
              </div>

              {kesinti.durum === 'tamamlandi' && kesinti.bitisTarihi && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-green-600" />
                    Bitiş Tarihi
                  </h3>
                  <p className="text-lg font-semibold text-slate-800">
                    {format(kesinti.bitisTarihi.toDate(), 'dd MMMM yyyy', { locale: tr })}
                  </p>
                  <p className="text-sm text-slate-600">
                    {format(kesinti.bitisTarihi.toDate(), 'HH:mm', { locale: tr })}
                  </p>
                </div>
              )}

              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-orange-600" />
                  Kesinti Süresi
                </h3>
                <p className="text-lg font-semibold text-orange-600">
                  {formatSure(kesinti.sure)}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {kesinti.etkiAlani && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                    <Zap className="h-4 w-4 mr-2 text-blue-600" />
                    Etkilenen Alan
                  </h3>
                  <p className="text-base text-slate-800">{kesinti.etkiAlani}</p>
                </div>
              )}

              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Açıklama</h3>
                <p className="text-base text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {kesinti.aciklama}
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Kayıt Bilgileri</h3>
                <div className="space-y-1">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Oluşturan:</span> {kesinti.olusturanKisi.ad}
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Tarih:</span> {format(kesinti.olusturmaTarihi?.toDate() || new Date(), 'dd MMMM yyyy HH:mm', { locale: tr })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-slate-50 rounded-b-xl">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};