import React from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { X, Building, Calendar, CheckCircle, AlertTriangle, User, Clock, FileText, Power } from 'lucide-react';
import type { InvertorKontrol as InvertorKontrolType } from '../types';

interface Props {
  kontrol: InvertorKontrolType;
  sahaAdi: string;
  onClose: () => void;
}

export const InvertorKontrolDetayModal: React.FC<Props> = ({ kontrol, sahaAdi, onClose }) => {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-[70] backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0 bg-slate-50 rounded-t-xl">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800">{sahaAdi} - Kontrol Detayları</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Genel Bilgiler */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <label className="text-xs font-medium text-slate-500 flex items-center">
                <Calendar className="h-4 w-4 mr-1.5 text-blue-500" />
                Kontrol Tarihi ve Saati
              </label>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                {format(kontrol.tarih.toDate(), 'dd MMMM yyyy, HH:mm', { locale: tr })}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 flex items-center">
                <User className="h-4 w-4 mr-1.5 text-blue-500" />
                Kontrol Eden
              </label>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                {kontrol.olusturanKisi.ad} ({kontrol.olusturanKisi.rol})
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 flex items-center">
                <Clock className="h-4 w-4 mr-1.5 text-blue-500" />
                Kayıt Tarihi
              </label>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                {format(kontrol.olusturmaTarihi.toDate(), 'dd MMMM yyyy, HH:mm', { locale: tr })}
              </p>
            </div>
             {kontrol.guncellenmeTarihi && (
              <div>
                <label className="text-xs font-medium text-slate-500 flex items-center">
                  <Clock className="h-4 w-4 mr-1.5 text-green-500" />
                  Son Güncelleme
                </label>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">
                  {format(kontrol.guncellenmeTarihi.toDate(), 'dd MMMM yyyy, HH:mm', { locale: tr })}
                </p>
              </div>
            )}
          </div>

          {/* İnvertör Listesi */}
          <div>
            <h3 className="text-md font-semibold text-slate-800 mb-3 border-b pb-2 flex items-center">
              <Power className="h-5 w-5 mr-2 text-blue-600" />
              Kontrol Edilen İnvertörler ({kontrol.invertorler.length})
            </h3>
            {kontrol.invertorler.length > 0 ? (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {kontrol.invertorler.map((inv, index) => (
                  <div 
                    key={index} 
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      inv.dizeCalisiyor 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <span className={`font-medium ${inv.dizeCalisiyor ? 'text-green-700' : 'text-red-700'}`}>
                      {inv.ad}
                    </span>
                    <div className="flex items-center">
                      {inv.dizeCalisiyor ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mr-1.5" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-600 mr-1.5" />
                      )}
                      <span className={`text-sm font-medium ${inv.dizeCalisiyor ? 'text-green-700' : 'text-red-700'}`}>
                        {inv.dizeCalisiyor ? 'Dize Çalışıyor' : 'Dize Arızalı/Kapalı'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">Bu kontrol için invertör bilgisi girilmemiş.</p>
            )}
          </div>

          {/* Açıklama */}
          {kontrol.aciklama && (
            <div>
              <h3 className="text-md font-semibold text-slate-800 mb-2 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-600" />
                Açıklama / Notlar
              </h3>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {kontrol.aciklama}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-slate-50 rounded-b-xl flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}; 