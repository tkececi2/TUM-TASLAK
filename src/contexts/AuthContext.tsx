import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, db, functions } from '../lib/firebase';
import { authService } from '../services/authService';
import { signInUser } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, query, collection, where, getDocs, updateDoc } from 'firebase/firestore';
import type { Kullanici } from '../types';
import toast from 'react-hot-toast';

interface AuthContextType {
  kullanici: Kullanici | null;
  loading: boolean;
  setKullanici: (kullanici: Kullanici | null) => void;
  cikisYap: () => Promise<void>;
  girisYap: (email: string, sifre: string) => Promise<boolean>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  kullanici: null,
  loading: true,
  setKullanici: () => {},
  cikisYap: async () => {},
  girisYap: async () => false,
  refreshToken: async () => {}
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

  // Kullanıcı profilini getir ve şirket durumunu kontrol et
  const fetchUserProfile = async (userId: string): Promise<Kullanici | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'kullanicilar', userId));
      if (!userDoc.exists()) return null;

      const userData = userDoc.data();
      const normalizedUser = normalizeUserData({ id: userId, ...userData });

      // Süper admin değilse şirket durumunu kontrol et
      if (normalizedUser.rol !== 'superadmin' && normalizedUser.companyId) {
        try {
          const companyDoc = await getDoc(doc(db, 'companies', normalizedUser.companyId));
          
          if (companyDoc.exists()) {
            const companyData = companyDoc.data();
            
            // Şirket aktif değilse veya abonelik durumu expired/cancelled ise erişimi engelle
            if (companyData.isActive === false || 
                companyData.subscriptionStatus === 'expired' || 
                companyData.subscriptionStatus === 'cancelled') {
              
              console.warn('Şirket aboneliği pasif/süresi dolmuş. Kullanıcı erişimi engelleniyor:', {
                companyId: normalizedUser.companyId,
                isActive: companyData.isActive,
                subscriptionStatus: companyData.subscriptionStatus
              });
              
              toast.error('Şirket aboneliği sona ermiş. Erişim için yöneticinizle iletişime geçin.');
              return null;
            }

            // Şirket durumu kontrolü: Yöneticinin ödeme durumunu kontrol et
            if (normalizedUser.rol !== 'yonetici') {
              // Şirketin yöneticisini bul
              const managersQuery = query(
                collection(db, 'kullanicilar'),
                where('companyId', '==', normalizedUser.companyId),
                where('rol', '==', 'yonetici')
              );
              
              const managersSnapshot = await getDocs(managersQuery);
              const managers = managersSnapshot.docs.map(doc => doc.data());
              
              // Herhangi bir yöneticinin aboneliği süresi bittiyse, tüm kullanıcıların erişimini engelle
              const hasExpiredManager = managers.some(manager => 
                manager.odemeDurumu === 'surebitti'
              );
              
              if (hasExpiredManager) {
                console.warn('Şirket yöneticisinin aboneliği süresi dolmuş. Kullanıcı erişimi engelleniyor:', {
                  userId: normalizedUser.id,
                  userRole: normalizedUser.rol,
                  companyId: normalizedUser.companyId
                });
                
                toast.error('Şirket aboneliği sona ermiş. Erişim için yöneticinizle iletişime geçin.');
                return null;
              }
            }
          }
        } catch (companyCheckError) {
          console.error('Şirket durumu kontrolü hatası:', companyCheckError);
          // Şirket kontrolü başarısız olsa bile kullanıcıyı geçir, ama uyar
          console.warn('Şirket durumu kontrol edilemedi, kullanıcı geçiriliyor');
        }
      }

      return normalizedUser;
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
            // Müşteri ve bekçi sahalarını ve santrallerini al
            if (userData.rol === 'musteri' || userData.rol === 'bekci') {
              console.log(`${userData.rol === 'musteri' ? 'Müşteri' : 'Bekçi'} verileri yükleniyor:`, {
                userId: userData.id,
                sahalar: userData.sahalar,
                santraller: userData.santraller
              });

              let sahaIds: string[] = [];
              let santralIds: string[] = [];

              // Tüm olası alanları kontrol et ve birleştir
              const possibleSahaFields = [
                userData.sahalar,
                userData.santraller
              ];

              for (const field of possibleSahaFields) {
                if (field) {
                  if (Array.isArray(field)) {
                    const validIds = field.filter(id => id && typeof id === 'string' && id.trim() !== '');
                    sahaIds = [...sahaIds, ...validIds];
                  } else if (typeof field === 'object' && field !== null) {
                    const validIds = Object.keys(field).filter(key => 
                      (field as any)[key] === true && key && key.trim() !== ''
                    );
                    sahaIds = [...sahaIds, ...validIds];
                  }
                }
              }

              // Müşteri ID'sine göre atanmış santralleri kontrol et (sadece müşteriler için)
              if (sahaIds.length === 0 && userData.rol === 'musteri') {
                console.log('Direkten atanmış sahalar bulunamadı, müşteri ID ile atanmış santralleri arıyoruz');
                try {
                  // Müşteriye özel atanmış santralleri bul
                  const musteriSantralleriQuery = query(
                    collection(db, 'santraller'),
                    where('companyId', '==', userData.companyId),
                    where('musteriId', '==', userData.id)
                  );
                  
                  const musteriSantralleriSnapshot = await getDocs(musteriSantralleriQuery);
                  const musteriSantralleri = musteriSantralleriSnapshot.docs.map(doc => doc.id);
                  
                  console.log('Müşteri ID ile bulunan santraller:', musteriSantralleri);
                  sahaIds = [...sahaIds, ...musteriSantralleri];
                } catch (error) {
                  console.error('Müşteri santrallerini arama hatası:', error);
                }
              }

              // Tekrarları kaldır
              sahaIds = [...new Set(sahaIds)];
              santralIds = [...new Set([...sahaIds])]; // Santraller ve sahalar aynı olacak

              console.log(`${userData.rol === 'musteri' ? 'Müşteri' : 'Bekçi'} final saha/santral IDs:`, sahaIds);

              // Array formatında sakla
              userData.sahalar = sahaIds;
              userData.santraller = santralIds;

              if (sahaIds.length === 0) {
                console.warn(`UYARI: ${userData.rol === 'musteri' ? 'Müşteriye' : 'Bekçiye'} hiçbir saha/santral atanmamış!`);
                if (userData.rol === 'musteri') {
                  console.warn('Lütfen müşteri yönetimi sayfasından bu müşteriye sahalar/santraller atayın.');
                  console.warn('Veya santralleri eklerken musteriId alanını bu müşterinin ID\'si ile güncelleyin.');
                } else {
                  console.warn('Lütfen ekip yönetimi sayfasından bu bekçiye sahalar atayın.');
                }
              } else {
                console.log(`${userData.rol === 'musteri' ? 'Müşteriye' : 'Bekçiye'} ${sahaIds.length} adet saha/santral atanmış.`);
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

      // Hata korumalı giriş işlemi - tek noktadan hata yönetimi
      const user = await signInUser(email, sifre);
      if (!user) {
        toast.error('Kullanıcı bilgileri alınamadı. Lütfen tekrar deneyin.');
        return false;
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
              sahaIds = Object.keys(userData.sahalar).filter(key => 
                userData.sahalar && (userData.sahalar as any)[key] === true
              );
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
            } else if (typeof userData.santraller === 'object' && userData.santraller !== null) {
              // Object formatında ise key'leri al
              santralIds = Object.keys(userData.santraller).filter(key => 
                userData.santraller && (userData.santraller as any)[key] === true
              );
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
              toast.success(`Deneme sürenizin bitmesine ${kalanGun} gün kaldı.`, {
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

      // Kullanıcı dostu tek hata mesajı göster
      if (error.code === 'auth/invalid-credential') {
        toast.error('E-posta adresi veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.');
      } else if (error.code === 'auth/user-not-found') {
        toast.error('Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı.');
      } else if (error.code === 'auth/wrong-password') {
        toast.error('Şifre hatalı. Lütfen kontrol edip tekrar deneyin.');
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Çok fazla başarısız giriş denemesi. Lütfen birkaç dakika bekleyip tekrar deneyin.');
      } else if (error.code === 'auth/network-request-failed') {
        toast.error('İnternet bağlantısı hatası. Lütfen bağlantınızı kontrol edip tekrar deneyin.');
      } else if (error.code === 'auth/user-disabled') {
        toast.error('Hesabınız devre dışı bırakılmış. Lütfen yöneticiyle iletişime geçin.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Geçersiz e-posta adresi formatı.');
      } else {
        // Bilinmeyen hatalar için genel mesaj
        toast.error('Giriş yapılırken bir sorun oluştu. Lütfen tekrar deneyin.');
      }

      return false;
    }
  };

  const refreshToken = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        console.log('[AuthContext] refreshToken: Current user found, attempting to update and refresh token.');
        // Call cloud function to update custom claims
        const updateUserClaimsCallable = httpsCallable(functions, 'updateUserClaims');
        try {
          console.log('[AuthContext] refreshToken: Calling updateUserClaims cloud function...');
          const result = await updateUserClaimsCallable();
          console.log('[AuthContext] refreshToken: updateUserClaims cloud function result:', result);
        } catch (error) {
          console.error('[AuthContext] refreshToken: Error calling updateUserClaims cloud function:', error);
          // Optionally, decide if you want to proceed if claims update fails
        }
        
        // Force token refresh to get the latest custom claims
        console.log('[AuthContext] refreshToken: Forcing ID token refresh...');
        await currentUser.getIdToken(true);
        const idTokenResult = await currentUser.getIdTokenResult();
        console.log('[AuthContext] refreshToken: ID Token Claims after refresh:', idTokenResult.claims);
        
        console.log('[AuthContext] Token başarıyla yenilendi ve claims loglandı.');
        toast.success('Yetkilendirme bilgileri güncellendi ve loglandı.');
      } else {
        console.log('[AuthContext] refreshToken: No current user found.');
        toast.error('Oturumunuz açık değil. Lütfen giriş yapın.');
      }
    } catch (error) {
      console.error('[AuthContext] Token yenileme genel hatası:', error);
      toast.error('Yetkilendirme bilgileri güncellenirken genel bir hata oluştu.');
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
        // Bildirim verilerini KORUYORUZ - kullanıcı tekrar giriş yaptığında aynı bildirim durumları kalacak
        // Sadece token ve oturum bilgilerini temizliyoruz
        const keysToKeep: string[] = [];
        
        // Tüm lastSeen verilerini koru (rol bazında ayrı oldukları için)
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('lastSeen_')) {
            keysToKeep.push(key);
          }
        }
        
        // Sadece lastSeen dışındaki verileri temizle
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
          if (!keysToKeep.includes(key)) {
            try {
              localStorage.removeItem(key);
            } catch (e) {
              console.warn('LocalStorage key silinemedi:', key, e);
            }
          }
        });
        
        console.log('✅ Bildirim durumları korundu, sadece oturum verileri temizlendi');

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
    <AuthContext.Provider value={{ kullanici, loading, setKullanici, cikisYap, girisYap, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
};