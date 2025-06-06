import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { authService } from '../services/authService';
import { signInUser } from '../lib/firebase';
import { doc, getDoc, query, collection, where, getDocs, updateDoc } from 'firebase/firestore';
import type { Kullanici } from '../types';
import toast from 'react-hot-toast';

interface AuthContextType {
  kullanici: Kullanici | null;
  loading: boolean;
  setKullanici: (kullanici: Kullanici | null) => void;
  cikisYap: () => Promise<void>;
  girisYap: (email: string, sifre: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  kullanici: null,
  loading: true,
  setKullanici: () => {},
  cikisYap: async () => {},
  girisYap: async () => false
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [kullanici, setKullanici] = useState<Kullanici | null>(null);
  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const authCheckCompleted = useRef(false);

  // Kullanıcı verilerini normalize et
  const normalizeUserData = (userData: any): Kullanici => {
    // Sahalar dizisini kontrol et
    let sahalar = userData.sahalar || userData.sahalar || userData.atananSahalar || [];
    let santraller = userData.santraller || userData.santraller || userData.atananSantraller || [];

    console.log('Raw userData for normalization:', {
      sahalar: userData.sahalar,
      santraller: userData.santraller,
      atananSahalar: userData.atananSahalar,
      atananSantraller: userData.atananSantraller,
      rol: userData.rol
    });

    // Eğer sahalar bir dizi değilse, dizi haline getir
    if (sahalar && !Array.isArray(sahalar)) {
      if (typeof sahalar === 'object') {
        sahalar = Object.keys(sahalar).filter(key => sahalar[key] === true);
      } else {
        sahalar = [];
      }
    }

    // Eğer santraller bir dizi değilse, dizi haline getir
    if (santraller && !Array.isArray(santraller)) {
      if (typeof santraller === 'object') {
        santraller = Object.keys(santraller).filter(key => santraller[key] === true);
      } else {
        santraller = [];
      }
    }

    // Ensure companyId exists (default to empty string if not present)
    const companyId = userData.companyId || '';

    console.log('Normalize - Final Sahalar:', sahalar);
    console.log('Normalize - Final Santraller:', santraller);

    return {
      ...userData,
      sahalar,
      santraller,
      companyId
    };
  };

  // Kullanıcı profilini getir
  const fetchUserProfile = async (userId: string): Promise<Kullanici | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'kullanicilar', userId));
      if (!userDoc.exists()) return null;

      const userData = userDoc.data();
      return normalizeUserData({ id: userId, ...userData });
    } catch (error) {
      console.error('Kullanıcı profili getirme hatası:', error);
      return null;
    }
  };

  useEffect(() => {
    // Önce localStorage'dan kullanıcı bilgisini al
    const storedUser = authService.getCurrentUser();
    if (storedUser) {
      setKullanici(normalizeUserData(storedUser));
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!authCheckCompleted.current) {
          authCheckCompleted.current = true;
        }

        if (user) {
          if (authService.isLoggedOut()) {
            setKullanici(null);
            setLoading(false);
            return;
          }

          // Force token refresh to get the latest custom claims
          await user.getIdToken(true);

          // Get the token result to check custom claims
          const idTokenResult = await user.getIdTokenResult();
          console.log('User token claims:', idTokenResult.claims);

          // Kullanıcı profili bilgilerini getir
          const userData = await fetchUserProfile(user.uid);

          if (userData) {
            // Müşteri sahalarını ve santrallerini al
            if (userData.rol === 'musteri') {
              console.log('Müşteri verileri yükleniyor:', {
                sahalar: userData.sahalar,
                santraller: userData.santraller,
                atananSahalar: userData.atananSahalar,
                atananSantraller: userData.atananSantraller
              });

              let sahaIds: string[] = [];
              let santralIds: string[] = [];

              // Sahalar alanını kontrol et - tüm olası alanları kontrol et
              const sahaFields = [userData.sahalar, userData.atananSahalar, userData.santraller, userData.atananSantraller];
              for (const field of sahaFields) {
                if (field && sahaIds.length === 0) {
                  if (Array.isArray(field)) {
                    sahaIds = field.filter(id => id && id.trim() !== '');
                  } else if (typeof field === 'object' && field !== null) {
                    sahaIds = Object.keys(field).filter(key => field[key] === true && key && key.trim() !== '');
                  }
                  if (sahaIds.length > 0) break;
                }
              }

              // Santraller alanını kontrol et - sahalarla aynı olabilir
              const santralFields = [userData.santraller, userData.atananSantraller, userData.sahalar, userData.atananSahalar];
              for (const field of santralFields) {
                if (field && santralIds.length === 0) {
                  if (Array.isArray(field)) {
                    santralIds = field.filter(id => id && id.trim() !== '');
                  } else if (typeof field === 'object' && field !== null) {
                    santralIds = Object.keys(field).filter(key => field[key] === true && key && key.trim() !== '');
                  }
                  if (santralIds.length > 0) break;
                }
              }

              // Eğer sahalar boşsa santralları saha olarak kullan
              if (sahaIds.length === 0 && santralIds.length > 0) {
                sahaIds = [...santralIds];
                console.log('Sahalar boş, santralları saha olarak kullanıyoruz:', sahaIds);
              }

              // Eğer santraller boşsa sahaları santral olarak kullan
              if (santralIds.length === 0 && sahaIds.length > 0) {
                santralIds = [...sahaIds];
                console.log('Santraller boş, sahaları santral olarak kullanıyoruz:', santralIds);
              }

              console.log('Müşteri saha IDs:', sahaIds);
              console.log('Müşteri santral IDs:', santralIds);

              // Array formatında sakla (daha kolay kullanım için)
              userData.sahalar = sahaIds;
              userData.santraller = santralIds;

              console.log('Müşteri final sahalar:', userData.sahalar);
              console.log('Müşteri final santraller:', userData.santraller);

              if (sahaIds.length === 0 && santralIds.length === 0) {
                console.warn('UYARI: Müşteriye hiçbir saha/santral atanmamış!');
                console.warn('Database\'te bu müşteri için sahalar veya santraller alanını kontrol edin.');
              }
            }

            // Add the role from custom claims if it exists
            if (idTokenResult.claims.rol) {
              userData.rol = idTokenResult.claims.rol as any;
              console.log('Role from custom claims:', userData.rol);
            } else {
              console.log('No role in custom claims, using role from Firestore:', userData.rol);
            }

            setKullanici(userData);
            authService.setCurrentUser(userData);

            console.log('User authenticated with role:', userData.rol);
          } else {
            await signOut(auth);
            authService.clearUserData();
            setKullanici(null);
            toast.error('Kullanıcı profili bulunamadı');
          }
        } else {
          authService.clearUserData();
          setKullanici(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        authService.clearUserData();
        setKullanici(null);
      } finally {
        setLoading(false);
      }
    });

    unsubscribeRef.current = unsubscribe;
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        authCheckCompleted.current = false;
      }
    };
  }, []);

  const girisYap = async (email: string, sifre: string): Promise<boolean> => {
    try {
      // Check if the browser is online
      if (!navigator.onLine) {
        toast.error('İnternet bağlantınız yok. Lütfen bağlantınızı kontrol edin ve tekrar deneyin.');
        return false;
      }

      // Daha önce önbelleğe alınmış verileri temizle
      try {
        // Clear IndexedDB (Firebase offline data)
        const databases = await window.indexedDB.databases();
        for (const db of databases) {
          if (db.name && db.name.includes('firestore')) {
            window.indexedDB.deleteDatabase(db.name);
          }
        }
      } catch (cleanupError) {
        console.warn('Önbellek temizleme hatası:', cleanupError);
      }

      // Hata korumalı giriş işlemi
      let user;
      try {
        user = await signInUser(email, sifre);
        if (!user) {
          toast.error('Kullanıcı bilgileri alınamadı. Lütfen tekrar deneyin.');
          return false;
        }
      } catch (signInError: any) {
        console.error('Firebase oturum açma hatası:', 
          typeof signInError === 'object' ? 
            JSON.stringify(signInError, Object.getOwnPropertyNames(signInError), 2) : 
            signInError);

        if (signInError instanceof TypeError) {
          throw new Error('Sunucu bağlantı hatası oluştu. Lütfen internet bağlantınızı kontrol edin.');
        }

        // Hata mesajını daha net görebilmek için
        if (signInError?.code) {
          throw new Error(`Giriş hatası: ${signInError.code}`);
        }

        throw signInError;
      }

      // Force token refresh to get the latest custom claims - 3 kez deneyelim
      let tokenRefreshed = false;
      let attempts = 0;
      while (!tokenRefreshed && attempts < 3) {
        try {
          await user.getIdToken(true);
          tokenRefreshed = true;
        } catch (error) {
          console.warn(`Token yenileme hatası (${attempts + 1}/3):`, error);
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle
        }
      }

      // Get the token result to check custom claims
      const idTokenResult = await user.getIdTokenResult();
      console.log('Login token claims:', idTokenResult.claims);

      // Kullanıcı profili bilgilerini getir
      const userData = await fetchUserProfile(user.uid);

      if (userData) {
        // Müşteri sahalarını al
        if (userData.rol === 'musteri') {
          let sahaIds: string[] = [];

          console.log('Login - Raw userData.sahalar:', userData.sahalar);

          // Sahalar var mı kontrol et
          if (userData.sahalar) {
            // Sahalar array mi object mi kontrol et
            if (Array.isArray(userData.sahalar)) {
              sahaIds = userData.sahalar;
            } else if (typeof userData.sahalar === 'object' && userData.sahalar !== null) {
              // Object formatında ise key'leri al
              sahaIds = Object.keys(userData.sahalar).filter(key => userData.sahalar[key] === true);
            }
          }

          console.log('Login - Müşteri saha IDs:', sahaIds);

          // Saha IDlerini userData'da object formatında sakla
          if (sahaIds.length > 0) {
            const sahaObject: { [key: string]: boolean } = {};
            sahaIds.forEach(id => {
              sahaObject[id] = true;
            });
            userData.sahalar = sahaObject;
            console.log('Login - Yüklenen sahalar (object format):', userData.sahalar);
          } else {
            userData.sahalar = {};
          }
        }

        // Müşteri santrallerini al
        if (userData.rol === 'musteri') {
          let santralIds: string[] = [];

          // Santraller var mı kontrol et
          if (userData.santraller) {
            // Santraller array mi object mi kontrol et
            if (Array.isArray(userData.santraller)) {
              santralIds = userData.santraller;
            } else if (typeof userData.santraller === 'object') {
              // Object formatında ise key'leri al
              santralIds = Object.keys(userData.santraller).filter(key => userData.santraller[key] === true);
            }
          }

          console.log('Login - Müşteri santral IDs:', santralIds);

          if (santralIds.length > 0) {
            try {
              const santralQuery = query(
                collection(db, 'santraller'),
                where('__name__', 'in', santralIds)
              );
              const santralSnapshot = await getDocs(santralQuery);
              const santralListesi = santralSnapshot.docs.map(doc => doc.id);
              userData.santraller = santralListesi;
              console.log('Login - Yüklenen santraller:', santralListesi);
            } catch (error) {
              console.error('Login - Santraller yüklenirken hata:', error);
              userData.santraller = [];
            }
          } else {
            userData.santraller = [];
          }
        }

        // Add the role from custom claims if it exists
        if (idTokenResult.claims.rol) {
          userData.rol = idTokenResult.claims.rol as any;
          console.log('Role from custom claims after login:', userData.rol);
        } else {
          console.log('No role in custom claims after login, using role from Firestore:', userData.rol);
        }

        // Süper admin ise deneme süresi kontrolü yapmadan devam et
        if (userData.rol === 'superadmin') {
          setKullanici(userData);
          authService.setCurrentUser(userData);
          console.log('Süper admin giriş yaptı, deneme süresi kontrolü atlandı');
          toast.success('Giriş başarılı');
          return true;
        }

        // Deneme süresi kontrolü
        try {
          console.log('Ödeme durumu kontrolü:', userData.odemeDurumu);

          // Ödeme durumu süre bitti olarak işaretlenmişse giriş engellenir
          if (userData.odemeDurumu === 'surebitti') {
            console.log('Ödeme durumu: süre bitti');
            toast.error('Abonelik süreniz dolmuştur. Lütfen ödeme yapın veya yöneticinizle iletişime geçin.');
            await signOut(auth);
            authService.clearUserData();
            setKullanici(null);
            return false;
          }

          // Deneme süresi kontrolü - süre dolmuş mu?
          if ((userData.odemeDurumu === 'deneme' || userData.odemeDurumu === 'beklemede') && userData.denemeSuresiBitis) {
            console.log('Deneme süresi bitiş tarihi:', userData.denemeSuresiBitis);

            const simdikiZaman = new Date().getTime();
            let bitisTarihi;

            // Firestore Timestamp ve diğer tarih tipleri için güvenli dönüşüm
            if (userData.denemeSuresiBitis.toDate) {
              // Firestore Timestamp
              bitisTarihi = userData.denemeSuresiBitis.toDate().getTime();
              console.log('Bitiş tarihi (Timestamp):', new Date(bitisTarihi));
            } else if (userData.denemeSuresiBitis.seconds) {
              // Firestore Timestamp (farklı format)
              bitisTarihi = new Date(userData.denemeSuresiBitis.seconds * 1000).getTime();
              console.log('Bitiş tarihi (seconds):', new Date(bitisTarihi));
            } else if (userData.denemeSuresiBitis instanceof Date) {
              // JavaScript Date nesnesi
              bitisTarihi = userData.denemeSuresiBitis.getTime();
              console.log('Bitiş tarihi (Date):', new Date(bitisTarihi));
            } else {
              // String veya number olabilir
              bitisTarihi = new Date(userData.denemeSuresiBitis).getTime();
              console.log('Bitiş tarihi (string/number):', new Date(bitisTarihi));
            }

            console.log('Şimdiki zaman:', new Date(simdikiZaman));
            console.log('Bitiş tarihi:', new Date(bitisTarihi));
            console.log('Süre doldu mu:', simdikiZaman > bitisTarihi);

            if (simdikiZaman > bitisTarihi) {
              // Deneme süresi bitmiş, kullanıcı bilgisini güncelle
              try {
                console.log('Deneme süresi bitti, kullanıcı durumu güncelleniyor');
                const userRef = doc(db, 'kullanicilar', userData.id);

                // Firestore'da kullanıcı durumunu güncelle
                await updateDoc(userRef, {
                  odemeDurumu: 'surebitti',
                  sureBitimTarihi: new Date() // Sürenin bittiği tarih kaydedilir
                });

                toast.error('Abonelik süreniz dolmuştur. Lütfen yöneticinizle iletişime geçin veya ödeme yapın.');

                // Kullanıcıyı çıkış yaptır
                await signOut(auth);
                authService.clearUserData();
                setKullanici(null);
                return false;
              } catch (error) {
                console.error('Kullanıcı durumu güncelleme hatası:', error);

                // Hata olsa bile giriş yapılmasını engelle
                toast.error('Abonelik süreniz dolmuştur. Sistem hatası nedeniyle durum güncellenemedi. Lütfen yöneticinizle iletişime geçin.');
                await signOut(auth);
                authService.clearUserData();
                setKullanici(null);
                return false;
              }
            } else {
              // Deneme süresi devam ediyor, kalan süreyi hesapla ve göster
              const kalanGun = Math.ceil((bitisTarihi - simdikiZaman) / (1000 * 60 * 60 * 24));
              console.log('Kalan gün sayısı:', kalanGun);
              toast.info(`Deneme sürenizin bitmesine ${kalanGun} gün kaldı.`, {
                duration: 5000,
              });
            }
          } else {
            console.log('Deneme süresi bilgisi eksik veya format uygun değil');
          }
        } catch (denemeSuresiHatasi) {
          console.error('Deneme süresi kontrolü hatası:', denemeSuresiHatasi);
          // Hata durumunda kullanıcıyı engellemiyoruz, sadece logluyoruz
        }

        setKullanici(userData);
        authService.setCurrentUser(userData);
        console.log('User logged in with role:', userData.rol);
        toast.success('Giriş başarılı');
        return true;
      }

      toast.error('Kullanıcı profili bulunamadı');
      await signOut(auth);
      authService.clearUserData();
      setKullanici(null);
      return false;
    } catch (error: any) {
      console.error('Giriş hatası:', error);

      // Hata mesajını belirle
      let errorMessage = 'Giriş yapılırken bir hata oluştu';
      if (error.code === 'auth/invalid-credential') {
        errorMessage = 'E-posta veya şifre hatalı';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'Kullanıcı bulunamadı';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Şifre hatalı';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin ve tekrar deneyin';
      }

      toast.error(errorMessage);
      return false;
    }
  };

  const cikisYap = async () => {
    try {
      // Önce dinleyiciyi kapat
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

      // Kullanıcı durumunu güncelle
      authService.clearUserData();
      setKullanici(null);

      // Önbellek verileri temizle
      try {
        // Clear localStorage (token ve oturum bilgilerini temizle)
        localStorage.clear();

        // Clear IndexedDB (Firebase offline data)
        const databases = await window.indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            window.indexedDB.deleteDatabase(db.name);
          }
        }

        // Clear Cache API
        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map(key => caches.delete(key)));
        }

        // Unregister service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(registration => registration.unregister()));
        }
      } catch (cleanupError) {
        console.error('Önbellek temizleme hatası:', cleanupError);
      }

      // Son olarak Firebase'den çıkış yap - bu işlemi en sona bırakıyoruz
      await signOut(auth);

      toast.success('Başarıyla çıkış yapıldı');

      // Sayfayı yeniden yükle (login sayfasına yönlendirilecek)
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);
    } catch (error) {
      console.error('Çıkış yapılırken hata:', error);
      toast.error('Çıkış yapılırken bir hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin.');

      // Hata durumunda da login sayfasına yönlendir
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ kullanici, loading, setKullanici, cikisYap, girisYap }}>
      {children}
    </AuthContext.Provider>
  );
};