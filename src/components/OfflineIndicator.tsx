import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [firestoreConnected, setFirestoreConnected] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  // Ağ bağlantısını izle
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Firestore bağlantısını periyodik olarak kontrol et
  useEffect(() => {
    let checkInterval: NodeJS.Timeout;
    let unmounted = false;

    const checkFirestoreConnection = async () => {
      if (!isOnline) {
        setFirestoreConnected(false);
        return;
      }

      try {
        // Hafif bir sorgu ile bağlantıyı test et
        const testQuery = query(collection(db, 'system_status'), limit(1));
        await getDocs(testQuery);

        if (!unmounted) {
          setFirestoreConnected(true);
        }
      } catch (error) {
        console.warn('Firestore bağlantı kontrolü hatası:', error);
        if (!unmounted) {
          setFirestoreConnected(false);
        }
      }
    };

    // İlk kontrol
    checkFirestoreConnection();

    // 30 saniyede bir kontrol et
    checkInterval = setInterval(checkFirestoreConnection, 30000);

    return () => {
      unmounted = true;
      clearInterval(checkInterval);
    };
  }, [isOnline]);

  // Görünürlük kontrolü
  useEffect(() => {
    if (!isOnline || !firestoreConnected) {
      setIsVisible(true);
    } else {
      // Bağlantı geri geldiğinde, 3 saniye göster sonra gizle
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOnline, firestoreConnected]);

  if (!isVisible) return null;

  return (
    <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-full shadow-lg flex items-center space-x-2 z-50 transition-all duration-300 ${
      !isOnline 
        ? 'bg-red-600 text-white' 
        : !firestoreConnected 
          ? 'bg-orange-500 text-white'
          : 'bg-green-600 text-white'
    }`}>
      {!isOnline ? (
        <>
          <WifiOff size={18} />
          <span>Çevrimdışı Mod</span>
        </>
      ) : !firestoreConnected ? (
        <>
          <CloudOff size={18} />
          <span>Sunucu Bağlantısı Yok</span>
        </>
      ) : (
        <>
          <Wifi size={18} />
          <span>Çevrimiçi</span>
        </>
      )}
    </div>
  );
};