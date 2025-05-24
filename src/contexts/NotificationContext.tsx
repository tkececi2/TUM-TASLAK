import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from './AuthContext';

interface Bildirim {
  id: string;
  baslik: string;
  icerik: string;
  tarih: any;
  okundu: boolean;
  tip: string;
  arizaId?: string;
  alicilar: string[];
  companyId: string;
}

interface NotificationContextType {
  notification: any | null;
  bildirimler: Bildirim[];
  okunmamisBildirimSayisi: number;
  requestPermission: () => Promise<string | null>;
  bildirimOku: (bildirimId: string) => Promise<void>;
  tumBildirimleriOku: () => Promise<void>;
  showBrowserNotification: (title: string, options?: NotificationOptions) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notification: null,
  bildirimler: [],
  okunmamisBildirimSayisi: 0,
  requestPermission: async () => null,
  bildirimOku: async () => {},
  tumBildirimleriOku: async () => {},
  showBrowserNotification: () => {}
});

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<any>(null);
  const [bildirimler, setBildirimler] = useState<Bildirim[]>([]);
  const [okunmamisBildirimSayisi, setOkunmamisBildirimSayisi] = useState(0);
  const { kullanici } = useAuth();

  // Bildirimleri dinle
  useEffect(() => {
    if (!kullanici) {
      setBildirimler([]);
      setOkunmamisBildirimSayisi(0);
      return;
    }

    let isSubscribed = true; // Bileşenin unmount olup olmadığını izlemek için

    // Yeniden deneme parametreleri
    const maxRetries = 3;
    let retryCount = 0;
    const retryDelay = 2000; // ms

    const setupListener = () => {
      // Kullanıcıya ait bildirimleri getir
      const bildirimQuery = query(
        collection(db, 'bildirimler'),
        where('alicilar', 'array-contains', kullanici.id),
        orderBy('tarih', 'desc')
      );

      const unsubscribe = onSnapshot(bildirimQuery,
        (snapshot) => {
          const yeniBildirimler: Bildirim[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Bildirim[];

          if (isSubscribed) {
            setBildirimler(yeniBildirimler);

            // Okunmamış bildirim sayısını hesapla
            const okunmamisSayisi = yeniBildirimler.filter(b => !b.okundu).length;
            setOkunmamisBildirimSayisi(okunmamisSayisi);

            // Yeni bildirim geldiyse tarayıcı bildirimi göster
            const yeniBildirim = yeniBildirimler.find(b => !b.okundu && b.tarih?.toDate() > new Date(Date.now() - 10000));
            if (yeniBildirim && Notification.permission === 'granted') {
              showBrowserNotification(yeniBildirim.baslik, {
                body: yeniBildirim.icerik,
                icon: '/solar-logo.png'
              });
            }
          }
        },
        async (error) => {
          console.error('Bildirim dinleme hatası:', error);
          if (error && error.code === 'permission-denied') {
            // Token yenileme işlemini dene
            try {
              if (auth && auth.currentUser) {
                let success = false;
                let attempts = 0;
                const maxAttempts = 3;

                // Birkaç kez deneme yap
                while (!success && attempts < maxAttempts) {
                  attempts++;
                  try {
                    await auth.currentUser.getIdToken(true);
                    console.log(`Bildirim dinleme hatası sonrası token yenilendi (${attempts}. deneme)`);
                    success = true;

                    // Token başarıyla yenilendiyse, kullanıcı bilgilerini doğrula
                    try {
                      const userDoc = await getDoc(doc(db, 'kullanicilar', auth.currentUser.uid));
                      if (userDoc.exists()) {
                        console.log('Kullanıcı bilgileri doğrulandı');
                        
                        // Kullanıcı verilerini localStorage'a kaydet
                        const userData = userDoc.data();
                        localStorage.setItem('currentUser', JSON.stringify({
                          ...userData,
                          id: auth.currentUser.uid,
                          email: auth.currentUser.email
                        }));

                        // Kısa bir uyarı göster
                        toast.success('Oturum yenilendi');

                        // Firestore'u yeniden başlat
                        try {
                          await db.disableNetwork();
                          await new Promise(resolve => setTimeout(resolve, 500));
                          await db.enableNetwork();
                          console.log('Firestore ağı yeniden başlatıldı');
                        } catch (networkErr) {
                          console.warn('Firestore ağ yenileme hatası:', networkErr);
                        }
                        
                        break; // Başarılı olduk, döngüden çık
                      }
                    } catch (userDocErr) {
                      console.warn('Kullanıcı belgesi alınamadı:', userDocErr);
                    }
                  } catch (tokenErr) {
                    console.error(`Bildirim token yenileme hatası (${attempts}. deneme):`, tokenErr);

                    // Kısa bir bekleme süresi ekle
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                }

                if (!success) {
                  console.error('Token yenileme başarısız oldu');

                  // Tekrar dinlemeyi dene
                  if (retryCount < maxRetries && isSubscribed) {
                    retryCount++;
                    console.log(`Bildirim dinleyicisi yeniden başlatılıyor (${retryCount}/${maxRetries})...`);

                    toast.error(`Bağlantı sorunu. Yeniden bağlanılıyor (${retryCount}/${maxRetries})...`);

                    // Kısa bir gecikme ile tekrar dene
                    setTimeout(() => {
                      if (isSubscribed) {
                        setupListener();
                      }
                    }, retryDelay * retryCount); // Artan gecikme süresi

                    return;
                  } else {
                    // Maksimum yeniden deneme sayısına ulaşıldı
                    toast.error('Oturum yenilenemedi, lütfen tekrar giriş yapın');

                    // Birkaç saniye bekle ve login sayfasına yönlendir
                    setTimeout(() => {
                      if (window.location.pathname !== '/login') {
                        window.location.href = '/login';
                      }
                    }, 3000);
                  }
                }
              } else {
                console.warn('Kullanıcı oturumu bulunamadı, yönlendiriliyor...');
                toast.error('Oturum bulunamadı, lütfen giriş yapın.');
                if (window.location.pathname !== '/login') {
                  setTimeout(() => window.location.href = '/login', 1000);
                }
              }
            } catch (tokenError) {
              console.error('Token yenileme sırasında hata:', tokenError);
              toast.error('Oturum bilgilerinde sorun oluştu, lütfen tekrar giriş yapın.');
              setTimeout(() => {
                if (window.location.pathname !== '/login') {
                  window.location.href = '/login';
                }
              }, 2000);
            }
          }
        }
      );
      return () => {
        isSubscribed = false;
        unsubscribe();
      };
    };

    const cleanup = setupListener();

    return () => {
      isSubscribed = false;
      cleanup();
    };
  }, [kullanici]);

  const requestPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast.success('Bildirim izni alındı');
        return 'granted';
      }
      toast.error('Bildirim izni alınamadı');
      return null;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      toast.error('Bildirim izni alınamadı');
      return null;
    }
  };

  const bildirimOku = async (bildirimId: string) => {
    try {
      const bildirimRef = doc(db, 'bildirimler', bildirimId);
      await updateDoc(bildirimRef, {
        okundu: true
      });
    } catch (error) {
      console.error('Bildirim okundu işaretleme hatası:', error);
    }
  };

  const tumBildirimleriOku = async () => {
    try {
      const okunmamisBildirimler = bildirimler.filter(b => !b.okundu);

      // Her bir okunmamış bildirimi güncelle
      const islemler = okunmamisBildirimler.map(bildirim =>
        updateDoc(doc(db, 'bildirimler', bildirim.id), { okundu: true })
      );

      await Promise.all(islemler);
    } catch (error) {
      console.error('Tüm bildirimleri okundu işaretleme hatası:', error);
    }
  };

  const showBrowserNotification = (title: string, options: NotificationOptions = {}) => {
    if (!('Notification' in window)) {
      console.warn('Bu tarayıcı bildirim desteği sunmuyor');
      return;
    }

    if (Notification.permission === 'granted') {
      const defaultOptions = {
        icon: '/solar-logo.png',
        ...options
      };

      const notification = new Notification(title, defaultOptions);

      notification.onclick = function() {
        window.focus();
        notification.close();
      };
    }
  };

  return (
    <NotificationContext.Provider value={{
      notification,
      bildirimler,
      okunmamisBildirimSayisi,
      requestPermission,
      bildirimOku,
      tumBildirimleriOku,
      showBrowserNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
};