
import React, { useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useOnClickOutside } from '../hooks/useOnClickOutside';

export const BildirimMenusu: React.FC = () => {
  const [acik, setAcik] = useState(false);
  const { bildirimler, okunmamisBildirimSayisi, bildirimOku, tumBildirimleriOku } = useNotification();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  
  useOnClickOutside(menuRef, () => setAcik(false));
  
  const handleBildirimTiklama = async (bildirim: any) => {
    // Bildirimi okundu olarak işaretle
    await bildirimOku(bildirim.id);
    
    // Bildirim tipine göre yönlendirme yap
    if (bildirim.tip.includes('ariza') && bildirim.arizaId) {
      navigate(`/arizalar/${bildirim.arizaId}`);
    }
    
    setAcik(false);
  };
  
  const handleTumunuOku = async () => {
    await tumBildirimleriOku();
  };
  
  const getBildirimIcon = (tip: string) => {
    switch (tip) {
      case 'ariza_olusturuldu':
        return '🔴';
      case 'ariza_atandi':
        return '📋';
      case 'ariza_cozuldu':
        return '✅';
      default:
        return '📬';
    }
  };
  
  const formatTarih = (tarih: any) => {
    if (!tarih) return '';
    
    const date = tarih.toDate();
    const simdi = new Date();
    const fark = simdi.getTime() - date.getTime();
    
    // Son 24 saat içindeyse saat göster
    if (fark < 24 * 60 * 60 * 1000) {
      return format(date, 'HH:mm', { locale: tr });
    }
    
    // Son 7 gün içindeyse gün adı göster
    if (fark < 7 * 24 * 60 * 60 * 1000) {
      return format(date, 'EEEE', { locale: tr });
    }
    
    // Daha eskiyse tam tarih göster
    return format(date, 'dd MMM yyyy', { locale: tr });
  };
  
  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setAcik(!acik)} 
        className="relative p-1 text-gray-600 hover:text-gray-900 focus:outline-none"
      >
        <Bell className="h-6 w-6" />
        {okunmamisBildirimSayisi > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {okunmamisBildirimSayisi}
          </span>
        )}
      </button>
      
      {acik && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden z-10 border border-gray-200">
          <div className="py-2 px-4 bg-gray-100 flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-900">Bildirimler</h3>
            {okunmamisBildirimSayisi > 0 && (
              <button 
                onClick={handleTumunuOku}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Tümünü okundu işaretle
              </button>
            )}
          </div>
          
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-200">
            {bildirimler.length === 0 ? (
              <div className="py-4 px-4 text-sm text-gray-500 text-center">
                Bildirim bulunmuyor
              </div>
            ) : (
              bildirimler.map((bildirim) => (
                <div
                  key={bildirim.id}
                  onClick={() => handleBildirimTiklama(bildirim)}
                  className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                    !bildirim.okundu ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-3 mt-1">
                      <span className="text-lg">{getBildirimIcon(bildirim.tip)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${!bildirim.okundu ? 'text-gray-900' : 'text-gray-700'}`}>
                        {bildirim.baslik}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {bildirim.icerik}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTarih(bildirim.tarih)}
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
      )}
    </div>
  );
};
