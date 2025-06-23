import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';

interface MenuNotificationCounts {
  arizalar: number;
  yapilanIsler: number;
  vardiyaBildirimleri: number;
  elektrikBakim: number;
  mekanikBakim: number;
  invertorKontrol: number;
  elektrikKesintileri: number;
}

interface MenuNotificationContextType {
  counts: MenuNotificationCounts;
  isLoading: boolean;
  refreshCounts: () => void;
  markPageAsSeen: (pageName: string) => void;
  getTotalNotificationCount: () => number;
}

const MenuNotificationContext = createContext<MenuNotificationContextType>({
  counts: {
    arizalar: 0,
    yapilanIsler: 0,
    vardiyaBildirimleri: 0,
    elektrikBakim: 0,
    mekanikBakim: 0,
    invertorKontrol: 0,
    elektrikKesintileri: 0,
  },
  isLoading: false,
  refreshCounts: () => {},
  markPageAsSeen: () => {},
  getTotalNotificationCount: () => 0,
});

export const useMenuNotifications = () => useContext(MenuNotificationContext);

export const MenuNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { kullanici } = useAuth();
  const [counts, setCounts] = useState<MenuNotificationCounts>({
    arizalar: 0,
    yapilanIsler: 0,
    vardiyaBildirimleri: 0,
    elektrikBakim: 0,
    mekanikBakim: 0,
    invertorKontrol: 0,
    elektrikKesintileri: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [unsubscribeAll, setUnsubscribeAll] = useState<(() => void) | null>(null);

  // localStorage key'leri için helper - rol bazında ayrı tutmak için
  const getStorageKey = (pageName: string) => {
    return `lastSeen_${kullanici?.id}_${kullanici?.rol}_${pageName}`;
  };

  // Son görülme zamanını al
  const getLastSeenTime = (pageName: string): Timestamp => {
    const storageKey = getStorageKey(pageName);
    const lastSeenStr = localStorage.getItem(storageKey);
    
    if (lastSeenStr) {
      const lastSeenMs = parseInt(lastSeenStr);
      return Timestamp.fromMillis(lastSeenMs);
    } else {
      // Eğer hiç görülmemişse 1 saat öncesi (o rol için yeni bildirimleri göster ama çok eskilerini değil)
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      return Timestamp.fromDate(oneHourAgo);
    }
  };

  // Sayfa görülme zamanını localStorage'a kaydet
  const markPageAsSeen = (pageName: string) => {
    if (!kullanici?.id) return;
    
    console.log('🔔 markPageAsSeen çağrıldı:', pageName, 'kullanıcı:', kullanici.id);
    
    try {
      const now = new Date().getTime();
      const storageKey = getStorageKey(pageName);
      localStorage.setItem(storageKey, now.toString());
      
      console.log('✅ Sayfa görüldü olarak işaretlendi:', pageName);
      
      // Sayaçları yenile (gerçek veri ile)
      refreshCounts();
    } catch (error) {
      console.error('❌ Sayfa görüldü olarak işaretlenirken hata:', error);
    }
  };

  // Gerçek Firestore verilerinden sayaçları hesapla
  const refreshCounts = () => {
    if (!kullanici?.id || !kullanici?.companyId) return;
    
    setIsLoading(true);
    console.log('🔄 Gerçek verilerden sayaçlar hesaplanıyor...');
    
    const newCounts: MenuNotificationCounts = {
      arizalar: 0,
      yapilanIsler: 0,
      vardiyaBildirimleri: 0,
      elektrikBakim: 0,
      mekanikBakim: 0,
      invertorKontrol: 0,
      elektrikKesintileri: 0,
    };

    try {
      // Arızalar sayacı
      const arizalarLastSeen = getLastSeenTime('arizalar');
      const arizalarQuery = query(
        collection(db, 'arizalar'),
        where('companyId', '==', kullanici.companyId),
        where('olusturmaTarihi', '>=', arizalarLastSeen),
        orderBy('olusturmaTarihi', 'desc')
      );
      
      const unsubscribeArizalar = onSnapshot(arizalarQuery, (snapshot) => {
        if (!kullanici?.id) return; // Kullanıcı çıkış yaptıysa işlemi durdur
        newCounts.arizalar = snapshot.size;
        setCounts(prev => ({ ...prev, arizalar: snapshot.size }));
        console.log('📊 Arızalar sayacı güncellendi:', snapshot.size);
      }, (error) => {
        // Hata durumunda sadece loglama yap, toast gösterme
        console.warn('📊 Arızalar dinleme hatası:', error.code);
      });

      // Yapılan İşler sayacı 
      const yapilanIslerLastSeen = getLastSeenTime('yapilanIsler');
      const yapilanIslerQuery = query(
        collection(db, 'isRaporlari'),
        where('companyId', '==', kullanici.companyId),
        where('tarih', '>=', yapilanIslerLastSeen),
        orderBy('tarih', 'desc')
      );
      
      const unsubscribeYapilanIsler = onSnapshot(yapilanIslerQuery, (snapshot) => {
        if (!kullanici?.id) return; // Kullanıcı çıkış yaptıysa işlemi durdur
        newCounts.yapilanIsler = snapshot.size;
        setCounts(prev => ({ ...prev, yapilanIsler: snapshot.size }));
        console.log('📊 Yapılan İşler sayacı güncellendi:', snapshot.size);
      }, (error) => {
        console.warn('📊 Yapılan İşler dinleme hatası:', error.code);
      });

      // Vardiya Bildirimleri sayacı
      const vardiyaLastSeen = getLastSeenTime('vardiyaBildirimleri');
      const vardiyaQuery = query(
        collection(db, 'vardiyaBildirimleri'),
        where('companyId', '==', kullanici.companyId),
        where('olusturmaTarihi', '>=', vardiyaLastSeen),
        orderBy('olusturmaTarihi', 'desc')
      );
      
      const unsubscribeVardiya = onSnapshot(vardiyaQuery, (snapshot) => {
        if (!kullanici?.id) return; // Kullanıcı çıkış yaptıysa işlemi durdur
        newCounts.vardiyaBildirimleri = snapshot.size;
        setCounts(prev => ({ ...prev, vardiyaBildirimleri: snapshot.size }));
        console.log('📊 Vardiya Bildirimleri sayacı güncellendi:', snapshot.size);
      }, (error) => {
        // Hata durumunda sadece loglama yap, toast gösterme
        console.warn('📊 Vardiya Bildirimleri dinleme hatası:', error.code);
      });

      // Elektrik Bakım sayacı
      const elektrikBakimLastSeen = getLastSeenTime('elektrikBakim');
      const elektrikBakimQuery = query(
        collection(db, 'elektrikBakimlar'),
        where('companyId', '==', kullanici.companyId),
        where('tarih', '>=', elektrikBakimLastSeen),
        orderBy('tarih', 'desc')
      );
      
      const unsubscribeElektrikBakim = onSnapshot(elektrikBakimQuery, (snapshot) => {
        if (!kullanici?.id) return; // Kullanıcı çıkış yaptıysa işlemi durdur
        newCounts.elektrikBakim = snapshot.size;
        setCounts(prev => ({ ...prev, elektrikBakim: snapshot.size }));
        console.log('📊 Elektrik Bakım sayacı güncellendi:', snapshot.size);
      }, (error) => {
        console.warn('📊 Elektrik Bakım dinleme hatası:', error.code);
      });

      // Mekanik Bakım sayacı
      const mekanikBakimLastSeen = getLastSeenTime('mekanikBakim');
      const mekanikBakimQuery = query(
        collection(db, 'mekanikBakimlar'),
        where('companyId', '==', kullanici.companyId),
        where('tarih', '>=', mekanikBakimLastSeen),
        orderBy('tarih', 'desc')
      );
      
      const unsubscribeMekanikBakim = onSnapshot(mekanikBakimQuery, (snapshot) => {
        if (!kullanici?.id) return; // Kullanıcı çıkış yaptıysa işlemi durdur
        newCounts.mekanikBakim = snapshot.size;
        setCounts(prev => ({ ...prev, mekanikBakim: snapshot.size }));
        console.log('📊 Mekanik Bakım sayacı güncellendi:', snapshot.size);
      }, (error) => {
        console.warn('📊 Mekanik Bakım dinleme hatası:', error.code);
      });

      // İnvertör Kontrol sayacı
      const invertorLastSeen = getLastSeenTime('invertorKontrol');
      const invertorQuery = query(
        collection(db, 'invertorKontroller'),
        where('companyId', '==', kullanici.companyId),
        where('tarih', '>=', invertorLastSeen),
        orderBy('tarih', 'desc')
      );
      
      const unsubscribeInvertor = onSnapshot(invertorQuery, (snapshot) => {
        if (!kullanici?.id) return; // Kullanıcı çıkış yaptıysa işlemi durdur
        newCounts.invertorKontrol = snapshot.size;
        setCounts(prev => ({ ...prev, invertorKontrol: snapshot.size }));
        console.log('📊 İnvertör Kontrol sayacı güncellendi:', snapshot.size);
      }, (error) => {
        console.warn('📊 İnvertör Kontrol dinleme hatası:', error.code);
      });

      // Elektrik Kesintileri sayacı
      const kesintilerLastSeen = getLastSeenTime('elektrikKesintileri');
      const kesintilerQuery = query(
        collection(db, 'elektrikKesintileri'),
        where('companyId', '==', kullanici.companyId),
        where('tarih', '>=', kesintilerLastSeen),
        orderBy('tarih', 'desc')
      );
      
      const unsubscribeKesintiler = onSnapshot(kesintilerQuery, (snapshot) => {
        if (!kullanici?.id) return; // Kullanıcı çıkış yaptıysa işlemi durdur
        newCounts.elektrikKesintileri = snapshot.size;
        setCounts(prev => ({ ...prev, elektrikKesintileri: snapshot.size }));
        console.log('📊 Elektrik Kesintileri sayacı güncellendi:', snapshot.size);
      }, (error) => {
        console.warn('📊 Elektrik Kesintileri dinleme hatası:', error.code);
      });

      setIsLoading(false);
      
      // Cleanup function
      return () => {
        unsubscribeArizalar();
        unsubscribeYapilanIsler();
        unsubscribeVardiya();
        unsubscribeElektrikBakim();
        unsubscribeMekanikBakim();
        unsubscribeInvertor();
        unsubscribeKesintiler();
      };
      
    } catch (error) {
      console.error('❌ Sayaçlar hesaplanırken hata:', error);
      setIsLoading(false);
    }
  };

  // Toplam bildirim sayısını hesapla
  const getTotalNotificationCount = (): number => {
    return Object.values(counts).reduce((total, count) => total + count, 0);
  };

  // Kullanıcı değişikliklerini izle ve state'i resetle
  useEffect(() => {
    // Önceki listener'ları temizle
    if (unsubscribeAll) {
      unsubscribeAll();
      setUnsubscribeAll(null);
    }

    if (!kullanici?.id) {
      // Kullanıcı çıkış yaptıysa tüm sayaçları sıfırla
      setCounts({
        arizalar: 0,
        yapilanIsler: 0,
        vardiyaBildirimleri: 0,
        elektrikBakim: 0,
        mekanikBakim: 0,
        invertorKontrol: 0,
        elektrikKesintileri: 0,
      });
      setIsLoading(false);
      return;
    }

    if (kullanici?.id && kullanici?.companyId) {
      const cleanup = refreshCounts();
      if (cleanup) {
        setUnsubscribeAll(() => cleanup);
      }
      return cleanup;
    }
  }, [kullanici?.id, kullanici?.companyId]);

  // Component unmount olduğunda cleanup
  useEffect(() => {
    return () => {
      if (unsubscribeAll) {
        unsubscribeAll();
      }
    };
  }, [unsubscribeAll]);

  return (
    <MenuNotificationContext.Provider value={{ counts, isLoading, refreshCounts, markPageAsSeen, getTotalNotificationCount }}>
      {children}
    </MenuNotificationContext.Provider>
  );
}; 