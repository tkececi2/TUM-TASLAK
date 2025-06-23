import React, { useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useMenuNotifications } from '../contexts/MenuNotificationContext';
import { BildirimListesi } from './BildirimListesi';
import { useOnClickOutside } from '../hooks/useOnClickOutside';

export const BildirimMenusu: React.FC = () => {
  const [acik, setAcik] = useState(false);
  const { getTotalNotificationCount } = useMenuNotifications();
  const menuRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(menuRef, () => setAcik(false));

  const toplamBildirimSayisi = getTotalNotificationCount();

  const handleAc = () => {
    setAcik(!acik);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={handleAc}
        className="relative p-2 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
        aria-label={`Bildirimleri ${acik ? 'kapat' : 'aç'}`}
      >
        <Bell className="h-6 w-6" />
        {toplamBildirimSayisi > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-rose-500 text-xs font-medium text-white animate-pulse-slow">
            {toplamBildirimSayisi > 99 ? '99+' : toplamBildirimSayisi}
          </span>
        )}
      </button>

      {acik && (
        <div className="fixed sm:absolute right-1 sm:right-0 left-1 sm:left-auto top-16 sm:top-auto sm:mt-2 w-auto sm:w-96 bg-white rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 z-50 max-h-[calc(100vh-5rem)] sm:max-h-[80vh] flex flex-col transform origin-top transition-all duration-200 ease-out animate-fade-in">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Son Aktiviteler</h3>
              <span className="text-sm text-gray-500">
                {toplamBildirimSayisi > 0 ? `${toplamBildirimSayisi} yeni` : 'Güncel'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">🗑️ Tek sil = Kalıcı silme • 🗑️ Tümünü sil = Hepsini sil</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <BildirimListesi onClose={() => setAcik(false)} />
          </div>
        </div>
      )}
    </div>
  );
};