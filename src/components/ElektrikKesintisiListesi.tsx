import React from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { AlertTriangle, CheckCircle, Building, Calendar, Clock, Trash2 } from 'lucide-react';
import type { ElektrikKesinti } from '../types';

interface Props {
  kesintiler: ElektrikKesinti[];
  sahalar: Array<{id: string, ad: string}>;
  onKesintiyeTikla: (kesinti: ElektrikKesinti) => void;
  onKesintiyiSil?: (id: string) => void;
}

export const ElektrikKesintisiListesi: React.FC<Props> = ({ 
  kesintiler, 
  sahalar,
  onKesintiyeTikla,
  onKesintiyiSil
}) => {
  const getSahaAdi = (sahaId: string) => {
    return sahalar.find(s => s.id === sahaId)?.ad || 'Bilinmeyen Saha';
  };

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

  if (kesintiler.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
        <p className="text-slate-500">Gösterilecek kesinti kaydı bulunamadı</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Saha
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Başlangıç
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Bitiş
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Süre
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Etkilenen Alan
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Durum
            </th>
            {onKesintiyiSil && (
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                İşlemler
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {kesintiler.map((kesinti) => (
            <tr
              key={kesinti.id}
              onClick={() => onKesintiyeTikla(kesinti)}
              className="hover:bg-blue-50 cursor-pointer transition-colors duration-200 group"
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg mr-3 group-hover:bg-blue-200 transition-colors duration-200">
                    <Building className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-800">{getSahaAdi(kesinti.sahaId)}</span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center text-sm text-slate-600">
                  <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                  <div>
                    <div className="font-medium text-slate-800">
                      {format(kesinti.baslangicTarihi.toDate(), 'dd MMM yyyy', { locale: tr })}
                    </div>
                    <div className="text-xs text-slate-500">
                      {format(kesinti.baslangicTarihi.toDate(), 'HH:mm', { locale: tr })}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {kesinti.bitisTarihi ? (
                  <div className="flex items-center text-sm text-slate-600">
                    <Calendar className="h-4 w-4 mr-2 text-green-500" />
                    <div>
                      <div className="font-medium text-slate-800">
                        {format(kesinti.bitisTarihi.toDate(), 'dd MMM yyyy', { locale: tr })}
                      </div>
                      <div className="text-xs text-slate-500">
                        {format(kesinti.bitisTarihi.toDate(), 'HH:mm', { locale: tr })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-slate-400 italic">Devam ediyor</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center text-sm">
                  <Clock className="h-4 w-4 mr-2 text-orange-500" />
                  <span className="font-medium text-orange-600">{formatSure(kesinti.sure)}</span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="text-sm text-slate-600">
                  {kesinti.etkiAlani || (
                    <span className="italic text-slate-400">Belirtilmemiş</span>
                  )}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  kesinti.durum === 'devam-ediyor' 
                    ? 'bg-red-100 text-red-700 border border-red-200' 
                    : 'bg-green-100 text-green-700 border border-green-200'
                }`}>
                  {kesinti.durum === 'devam-ediyor' ? (
                    <AlertTriangle className="h-3 w-3 mr-1" />
                  ) : (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  )}
                  {kesinti.durum === 'devam-ediyor' ? 'Devam Ediyor' : 'Tamamlandı'}
                </span>
              </td>
              {onKesintiyiSil && (
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onKesintiyiSil(kesinti.id);
                    }}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full transition-colors duration-200"
                    title="Kesinti kaydını sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};