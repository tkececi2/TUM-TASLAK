
import React from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Bell, Clock } from 'lucide-react';

export const BildirimListesi: React.FC = () => {
  const { bildirimler, bildirimOku, tumBildirimleriOku } = useNotification();
  const navigate = useNavigate();
  
  const handleBildirimTiklama = async (bildirim: any) => {
    // Bildirimi okundu olarak işaretle
    await bildirimOku(bildirim.id);
    
    // Bildirim tipine göre yönlendirme yap
    if (bildirim.tip.includes('ariza') && bildirim.arizaId) {
      navigate(`/arizalar/${bildirim.arizaId}`);
    }
  };
  
  const getBildirimIcon = (tip: string) => {
    switch (tip) {
      case 'ariza_olusturuldu':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'ariza_atandi':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'ariza_cozuldu':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };
  
  const formatTarih = (tarih: any) => {
    if (!tarih) return '';
    
    const date = tarih.toDate();
    return format(date, 'dd MMMM yyyy HH:mm', { locale: tr });
  };
  
  const okunmamisVarMi = bildirimler.some(b => !b.okundu);
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h2 className="text-lg font-medium text-gray-900">Bildirimler</h2>
        {okunmamisVarMi && (
          <button
            onClick={tumBildirimleriOku}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Tümünü okundu işaretle
          </button>
        )}
      </div>
      
      <div className="divide-y divide-gray-200 max-h-[70vh] overflow-y-auto">
        {bildirimler.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-sm font-medium text-gray-900">Bildirim bulunmuyor</h3>
            <p className="text-sm text-gray-500 mt-1">
              Yeni bildirimler burada görünecek
            </p>
          </div>
        ) : (
          bildirimler.map((bildirim) => (
            <div
              key={bildirim.id}
              onClick={() => handleBildirimTiklama(bildirim)}
              className={`px-6 py-4 hover:bg-gray-50 cursor-pointer transition duration-150 ${
                !bildirim.okundu ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1 mr-4">
                  {getBildirimIcon(bildirim.tip)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between">
                    <p className={`text-sm font-medium ${!bildirim.okundu ? 'text-gray-900' : 'text-gray-700'}`}>
                      {bildirim.baslik}
                    </p>
                    <p className="text-xs text-gray-500 ml-2">
                      {formatTarih(bildirim.tarih)}
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {bildirim.icerik}
                  </p>
                </div>
                {!bildirim.okundu && (
                  <div className="ml-2 flex-shrink-0">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-600"></span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
