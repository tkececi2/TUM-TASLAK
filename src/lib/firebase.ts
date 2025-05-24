import { initializeApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, connectAuthEmulator, AuthError } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, enableIndexedDbPersistence, connectFirestoreEmulator, CACHE_SIZE_UNLIMITED, collection, query, getDocs, limit } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { FirebaseError } from 'firebase/app';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';

const firebaseConfig = {
  apiKey: "AIzaSyAZdHmOkHazCMnRZuZ6STP17wjG4QMHaxk",
  authDomain: "yenisirket-2ec3b.firebaseapp.com",
  projectId: "yenisirket-2ec3b",
  storageBucket: "yenisirket-2ec3b.firebasestorage.app",
  messagingSenderId: "155422395281",
  appId: "1:155422395281:web:b496b7e93ae3d0a280a830"
};

let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  if (error instanceof Error && error.message.includes('already exists')) {
    app = getApp();
  } else {
    throw error;
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Comment out emulator connections to prevent "Running in emulator mode" warning
/*
if (process.env.NODE_ENV === 'development') {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099');
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectStorageEmulator(storage, 'localhost', 9199);
    console.log('Connected to Firebase emulators');
  } catch (error) {
    console.warn('Failed to connect to Firebase emulators:', error);
  }
}
*/

// Geliştirilmiş persistence konfigürasyonu
const initializeFirestore = async () => {
  try {
    console.log('Firestore yapılandırması başlatılıyor...');
    
    // Önce eski veritabanlarını temizle
    await cleanupFirestoreDBs();
    
    // Firestore önbellek yapılandırması
    try {
      // Ayarları uygula
      const firestoreDb = getFirestore(app);
      firestoreDb.settings({
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
        ignoreUndefinedProperties: true
      });
    } catch (settingsError) {
      console.error('Firestore settings error:', settingsError);
      // Temel ayarlar ile devam et
    }
    
    // Ağ bağlantısını etkinleştir
    try {
      await db.enableNetwork();
      console.log('Firestore ağ bağlantısı kuruldu');
      
      // Bağlantıyı test et
      const testQuery = query(collection(db, 'system_status'), limit(1));
      await getDocs(testQuery);
      console.log('Firestore bağlantı testi başarılı');
    } catch (networkErr: any) {
      console.warn('Firestore ağ bağlantısı sağlanamadı:', networkErr);
      
      // Ağ hatası durumunda çevrimdışı modu etkinleştir
      if (networkErr && networkErr.code === 'unavailable') {
        console.log('Çevrimdışı mod etkinleştiriliyor...');
        try {
          await db.disableNetwork();
          console.log('Çevrimdışı mod etkin');
        } catch (offlineErr) {
          console.error('Çevrimdışı mod etkinleştirilemedi:', offlineErr);
        }
      }
      
      // IndexedDB erişim hatası
      if (networkErr && networkErr.code === 'failed-precondition') {
        console.warn('IndexedDB erişim hatası algılandı, oturum yenileniyor...');
        await handleIndexedDBError();
      }
    }
    
    // Ağ durumu değişikliklerini dinle
    window.addEventListener('online', async () => {
      console.log('Ağ bağlantısı tespit edildi, Firestore ağını etkinleştirme deneniyor...');
      try {
        await db.enableNetwork();
        console.log('Firestore ağ bağlantısı yeniden kuruldu');
        // Kullanıcıya bilgi ver
        toast.success('İnternet bağlantısı kuruldu');
      } catch (err) {
        console.error('Ağ yeniden bağlantı hatası:', err);
      }
    });
    
    window.addEventListener('offline', async () => {
      console.log('Ağ bağlantısı kesildi, çevrimdışı moda geçiliyor...');
      try {
        await db.disableNetwork();
        console.log('Firestore çevrimdışı moda geçti');
        // Kullanıcıya bilgi ver
        toast.warning('İnternet bağlantısı kesildi, çevrimdışı moddasınız');
      } catch (err) {
        console.error('Çevrimdışı moda geçiş hatası:', err);
      }
    });
    
  } catch (error) {
    console.error('Firestore yapılandırma hatası:', error);
    console.warn('Temel yapılandırma kullanılacak');
    
    // Temel yapılandırma
    db.settings({
      ignoreUndefinedProperties: true
    });
  }
};

// IndexedDB veritabanlarını temizle
const cleanupFirestoreDBs = async () => {
  try {
    const databases = window.indexedDB.databases ? await window.indexedDB.databases() : [];
    let cleanedCount = 0;
    
    for (const database of databases) {
      if (database.name && database.name.includes('firestore')) {
        console.log('IndexedDB temizleniyor:', database.name);
        window.indexedDB.deleteDatabase(database.name);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`${cleanedCount} IndexedDB veritabanı temizlendi`);
    }
    
    return true;
  } catch (cleanupError) {
    console.warn('IndexedDB temizleme hatası:', cleanupError);
    return false;
  }
};

// IndexedDB hatası işleyicisi
const handleIndexedDBError = async () => {
  // Kullanıcı oturumunu yenilemeyi dene
  if (auth.currentUser) {
    try {
      await cleanupFirestoreDBs();
      await auth.currentUser.getIdToken(true);
      console.log('Token yenilendi, Firestore bağlantısı yeniden denenecek');
      
      // Yeniden bağlanmayı dene
      try {
        await db.enableNetwork();
        console.log('Firestore ağ bağlantısı yeniden kuruldu');
        toast.success('Bağlantı yenilendi');
      } catch (reconnectErr) {
        console.error('Yeniden bağlantı hatası:', reconnectErr);
        toast.error('Bağlantı sorunu devam ediyor, sayfayı yenilemeyi deneyin');
      }
    } catch (tokenErr) {
      console.error('Token yenileme hatası:', tokenErr);
      toast.error('Oturum yenilenemedi, lütfen tekrar giriş yapın');
    }
  }
};

// Firestore'u başlat
initializeFirestore();

// Firebase token yenileme işlevi - tüm uygulama için kullanılabilir
export const refreshAuthToken = async (): Promise<boolean> => {
  try {
    // Kullanıcı giriş yapmamışsa işlem yapma
    if (!auth.currentUser) {
      console.error('Token yenileme hatası: Kullanıcı oturum açmamış');
      return false;
    }

    console.log('Token yenileniyor...');

    // Token yenileme denemesi - hata durumunda daha fazla deneme yap
    let success = false;
    let attempts = 0;
    const maxAttempts = 5; // Deneme sayısını artır
    
    // Önce ağ bağlantısını kontrol et
    if (!navigator.onLine) {
      console.warn('İnternet bağlantısı yok, token yenileme atlanıyor');
      return false;
    }

    while (!success && attempts < maxAttempts) {
      try {
        // Her denemede temizlik işlemleri yap
        if (attempts > 0) {
          await cleanupTokenRenewalEnvironment(attempts);
        }
        
        // Mevcut token'ı geçersiz kıl ve yenisini al
        await auth.currentUser.getIdToken(true);
        success = true;
        console.log(`Token başarıyla yenilendi (${attempts + 1}. denemede)`);
      } catch (err) {
        attempts++;
        console.warn(`Token yenileme denemesi ${attempts}/${maxAttempts} başarısız:`, err);
        
        // Hata türüne göre özel işlem
        await handleTokenRenewalError(err, attempts);
        
        // Exponential backoff - artan bekleme süresi
        const waitTime = Math.min(1000 * Math.pow(1.5, attempts), 8000); // maksimum 8 saniye
        console.log(`${waitTime}ms bekleniyor...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    if (!success) {
      console.error(`Token ${maxAttempts} deneme sonrasında yenilenemedi`);
      toast.error('Oturum yenilenemedi. Lütfen tekrar giriş yapın.');
      return false;
    }
    
    // Başarılı token yenileme sonrası Firestore ağını yenile
    try {
      await db.disableNetwork();
      await new Promise(resolve => setTimeout(resolve, 500));
      await db.enableNetwork();
      console.log('Firestore ağ bağlantısı yenilendi');
    } catch (networkError) {
      console.warn('Firestore ağ yenileme hatası:', networkError);
    }

    try {
      const idTokenResult = await auth.currentUser.getIdTokenResult();
      console.log('Token yenilendi', idTokenResult.claims);

      // LocalStorage'dan mevcut kullanıcı bilgilerini al
      const currentUserStr = localStorage.getItem('currentUser');
      if (currentUserStr) {
        try {
          const currentUser = JSON.parse(currentUserStr);

          // Token claims'de rol yoksa, localStorage'dan al ve claims'e ekle
          if (!idTokenResult.claims.rol && currentUser.rol) {
            console.log('Rol bilgisi token claims\'de yok, localStorage\'dan alınıyor:', currentUser.rol);
            // Bu noktada rol bilgisini claims'e ekleyemeyiz, ancak uygulama rolü kullanacaktır
            // Cloud Functions ile rol senkronizasyonu yapılmalı
          }
        } catch (e) {
          console.error('localStorage kullanıcı bilgisi ayrıştırma hatası', e);
        }
      }
    } catch (tokenResultError) {
      console.error('Token sonucu alınırken hata:', tokenResultError);
      // Token sonucu alınamasa bile, yenileme başarılı kabul edilebilir
    }

    return true;
  } catch (error) {
    console.error('Token yenileme hatası:', error);
    return false;
  }
};

// Bağlantı kontrolü - WebContainer ortamları için geliştirilmiş
const checkConnection = async () => {
  // Önce tarayıcının çevrimiçi olup olmadığını kontrol et
  if (!navigator.onLine) {
    throw new Error('İnternet bağlantısı yok');
  }

  // Firestore bağlantısını test et
  try {
    // Ağ bağlantısını etkinleştirmeyi dene
    await db.enableNetwork();
    
    // Küçük bir test sorgusu yap
    const testQuery = query(collection(db, 'kullanicilar'), limit(1));
    await getDocs(testQuery);
    
    console.log('Firestore bağlantısı başarılı');
    return true;
  } catch (error) {
    console.error('Firestore bağlantı testi hatası:', error);
    
    if (error.code === 'failed-precondition') {
      // IndexedDB sorunlarını temizlemeyi dene
      try {
        const databases = window.indexedDB.databases ? await window.indexedDB.databases() : [];
        for (const database of databases) {
          if (database.name && database.name.includes('firestore')) {
            window.indexedDB.deleteDatabase(database.name);
          }
        }
        console.log('IndexedDB veritabanları temizlendi, yeniden bağlanmayı deneyin');
      } catch (dbError) {
        console.warn('IndexedDB temizleme hatası:', dbError);
      }
    }
    
    throw error;
  }
};

export const createUserWithProfile = async (email: string, password: string, userData: any) => {
  try {
    // Burada bağlantı kontrolü yapmanıza gerek yok, Firebase ağ hatalarını kendisi yönetecek
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userProfile = {
      ...userData,
      id: user.uid,
      email: user.email,
      olusturmaTarihi: new Date(),
      guncellenmeTarihi: new Date()
    };

    await setDoc(doc(db, 'kullanicilar', user.uid), userProfile);
    authService.setCurrentUser(userProfile);

    // Özel iddiaları almak için tokeni yenileyin
    await user.getIdToken(true);

    toast.success('Kullanıcı başarıyla oluşturuldu');
    return user;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const userProfile = {
          ...userData,
          id: user.uid,
          email: user.email,
          guncellenmeTarihi: new Date()
        };

        await setDoc(doc(db, 'kullanicilar', user.uid), userProfile, { merge: true });
        authService.setCurrentUser(userProfile);

        // Özel iddiaları almak için tokeni yenileyin
        await user.getIdToken(true);

        toast.success('Kullanıcı profili güncellendi');
        return user;
      } catch (signInError) {
        handleAuthError(signInError);
        throw signInError;
      }
    }
    handleAuthError(error);
    throw error;
  }
};

export const signInUser = async (email: string, password: string) => {
  try {
    // WebContainer ortamlarında bağlantı kontrolünü atlayın
    // Firebase ağ hatalarını uygun şekilde yönetecektir

    let userCredential;
    try {
      // İlk deneme - normal giriş
      userCredential = await signInWithEmailAndPassword(auth, email, password);
    } catch (initialError: any) {
      // Firebase hata mesajlarını detaylı olarak günlüğe kaydet
      console.error('Firebase giriş hatası:', {
        code: initialError.code,
        message: initialError.message,
        name: initialError.name,
        stack: initialError.stack
      });
      
      // Ağ hatası durumunda tekrar dene
      if (initialError.code === 'auth/network-request-failed') {
        // Kısa bir bekleme sonrası tekrar dene
        await new Promise(resolve => setTimeout(resolve, 1000));
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('Giriş yeniden deneme başarılı');
      } else {
        // Diğer hataları yukarı ilet
        handleAuthError(initialError);
        throw initialError;
      }
    }

    // En son özel iddiaları almak için token yenileme
    await userCredential.user.getIdToken(true);

    // Hata ayıklama için token ayrıntılarını günlüğe kaydedin
    const idTokenResult = await userCredential.user.getIdTokenResult();
    console.log('Giriş sonrası token iddiaları:', idTokenResult.claims);

    return userCredential.user;
  } catch (error) {
    handleAuthError(error);
    throw error;
  }
};

export const handleAuthError = (error: unknown) => {
  console.error('Kimlik doğrulama hatası:', error);

  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/network-request-failed':
        toast.error('İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin ve tekrar deneyin.');
        break;
      case 'auth/email-already-in-use':
        toast.error('Bu e-posta adresi zaten kullanımda');
        break;
      case 'auth/invalid-email':
        toast.error('Geçersiz e-posta adresi');
        break;
      case 'auth/operation-not-allowed':
        toast.error('E-posta/şifre girişi etkin değil');
        break;
      case 'auth/weak-password':
        toast.error('Şifre çok zayıf');
        break;
      case 'auth/user-disabled':
        toast.error('Bu hesap devre dışı bırakılmış');
        break;
      case 'auth/user-not-found':
        toast.error('Kullanıcı bulunamadı');
        break;
      case 'auth/wrong-password':
        toast.error('Hatalı şifre');
        break;
      case 'auth/too-many-requests':
        toast.error('Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin');
        break;
      case 'auth/permission-denied':
        toast.error('Bu işlem için yetkiniz bulunmuyor');
        break;
      case 'failed-precondition':
        toast.error('Veritabanı erişim sorunu. Lütfen sayfayı yenileyip tekrar deneyin.');
        break;
      default:
        toast.error('Bir hata oluştu: ' + error.message);
    }
  } else if (error instanceof Error) {
    toast.error(error.message);
  } else {
    toast.error('Beklenmeyen bir hata oluştu');
  }
};

// Kimlik doğrulama olmayan Firebase hataları için genel işleyici
export const handleFirebaseError = async (error: unknown, customMessage?: string) => {
  console.error('Firebase hatası:', error);

  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'permission-denied':
        toast.error(customMessage || 'Yetki hatası. Oturum yenileniyor...');
        
        // Token yenileme denemesi - 3 kez deneme yap
        if (auth.currentUser) {
          let success = false;
          let attempts = 0;
          
          while (!success && attempts < 3) {
            attempts++;
            try {
              // Token'ı yenilemeyi dene
              await auth.currentUser.getIdToken(true);
              console.log(`Token başarıyla yenilendi (${attempts}. deneme)`);
              success = true;
              
              // Kullanıcı bilgilerini Firestore'dan yeniden al
              const userSnapshot = await getDoc(doc(db, 'kullanicilar', auth.currentUser.uid));
              
              if (userSnapshot.exists()) {
                const userData = userSnapshot.data();
                console.log('Firestore rol bilgisi:', userData.rol);
                
                // Kullanıcı bilgilerini localStorage'a kaydet
                localStorage.setItem('currentUser', JSON.stringify({
                  ...userData,
                  id: auth.currentUser.uid,
                  email: auth.currentUser.email
                }));
                
                // Kullanıcı bilgilerini AuthContext üzerinden güncelle
                authService.setCurrentUser({
                  ...userData,
                  id: auth.currentUser.uid,
                  email: auth.currentUser.email
                });
                
                toast.success('Yetkilendirme yenilendi, lütfen işlemi tekrar deneyin');
                
                // 1.5 saniye bekleyip sayfayı yenile
                setTimeout(() => window.location.reload(), 1500);
                return;
              } else {
                console.error('Kullanıcı Firestore\'da bulunamadı');
                toast.error('Kullanıcı bilgileriniz bulunamadı. Lütfen tekrar giriş yapın.');
                setTimeout(() => {
                  if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                  }
                }, 2000);
                return;
              }
            } catch (tokenError) {
              console.error(`Token yenileme hatası (${attempts}. deneme):`, tokenError);
              // Hata durumunda 1 saniye bekle ve tekrar dene
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          if (!success) {
            console.error('Token yenileme başarısız oldu, oturumu yenilemeyi deneyin');
            toast.error('Oturum yenilenemedi. Lütfen sayfayı yenileyip tekrar deneyin.');
            setTimeout(() => {
              if (window.location.pathname !== '/login') {
                window.location.href = '/login';
              }
            }, 3000);
          }
        } else {
          toast.error('Oturum bulunamadı, lütfen tekrar giriş yapın');
          setTimeout(() => {
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
          }, 2000);
        }
        return; // Özel işlemi yukarıda yaptığımız için fonksiyondan çıkıyoruz
        
      case 'failed-precondition':
        toast.error(customMessage || 'Veritabanı erişim sorunu. Oturumunuz yenileniyor...');
        
        // IndexedDB veritabanlarını temizlemeyi dene
        try {
          const databases = window.indexedDB.databases ? await window.indexedDB.databases() : [];
          for (const database of databases) {
            if (database.name && database.name.includes('firestore')) {
              console.log('IndexedDB temizleniyor:', database.name);
              window.indexedDB.deleteDatabase(database.name);
            }
          }
        } catch (dbError) {
          console.warn('IndexedDB temizleme hatası:', dbError);
        }
        
        // Token yenileme denemesi
        if (auth.currentUser) {
          try {
            await auth.currentUser.getIdToken(true);
            console.log('Token başarıyla yenilendi, işlemi tekrar deneyin');
            toast.success('Oturum yenilendi, lütfen işlemi tekrar deneyin');
            return;
          } catch (tokenError) {
            console.error('Token yenileme hatası:', tokenError);
            // 5 saniye sonra sayfayı yenilemeyi dene
            setTimeout(() => window.location.reload(), 5000);
          }
        } else {
          toast.error('Oturum bulunamadı, lütfen tekrar giriş yapın');
          setTimeout(() => {
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
          }, 2000);
        }
        return; // Özel işlemi yukarıda yaptığımız için fonksiyondan çıkıyoruz
      case 'unavailable':
        toast.error('Firebase hizmeti şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
        break;
      case 'resource-exhausted':
        toast.error('Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.');
        break;
      case 'permission-denied':
        // İzin hatası durumunda token'ı 3 kez yenilemeyi dene
        if (auth.currentUser) {
          let tokenRenewed = false;
          let attempts = 0;

          while (!tokenRenewed && attempts < 3) {
            attempts++;
            try {
              await auth.currentUser.getIdToken(true);
              console.log(`Token yenileme başarılı (${attempts}. deneme)`);
              tokenRenewed = true;

              try {
                // Kullanıcı bilgilerini kontrol et
                const userSnapshot = await getDoc(doc(db, 'kullanicilar', auth.currentUser.uid));
                if (userSnapshot.exists()) {
                  const userData = userSnapshot.data();
                  console.log('Firestore kullanıcı rolü:', userData.rol);
                  console.log('Firestore şirket ID:', userData.companyId);

                  // LocalStorage'daki bilgileri güncelle
                  authService.setCurrentUser({
                    ...userData,
                    id: auth.currentUser.uid,
                    email: auth.currentUser.email
                  });

                  toast.success('Yetkilendirme yenilendi. İşlemi tekrar deneyin.');
                } else {
                  console.error('Kullanıcı Firestore\'da bulunamadı:', auth.currentUser.uid);
                  toast.error('Kullanıcı bilgileriniz bulunamadı. Lütfen çıkış yapıp tekrar giriş yapın.');
                }
              } catch (userFetchError) {
                console.error('Kullanıcı bilgileri getirme hatası:', userFetchError);
                toast.error('Kullanıcı bilgileri güncellenirken hata oluştu.');
              }

              // 1 saniye bekleyerek token güncellemesinin sistem genelinde yayılmasını sağla
              await new Promise(resolve => setTimeout(resolve, 1000));
              return; // Başarılı yenileme durumunda
            } catch (tokenError) {
              console.error(`Token yenileme hatası (${attempts}. deneme):`, tokenError);
            }
          }

          if (!tokenRenewed) {
            // Tüm yenileme denemeleri başarısız oldu
            await authService.clearUserData(); // Önce kullanıcı verilerini temizle
            toast.error('Yetki sorunu. Lütfen tekrar giriş yapmanız gerekiyor.');

            // IndexedDB temizliği
            try {
              const databases = await window.indexedDB.databases();
              for (const db of databases) {
                if (db.name) {
                  window.indexedDB.deleteDatabase(db.name);
                }
              }
            } catch (dbError) {
              console.error('IndexedDB temizleme hatası:', dbError);
            }

            // Kullanıcıyı login sayfasına yönlendir
            if (window.location.pathname !== '/login') {
              setTimeout(() => {
                window.location.href = '/login';
              }, 1500);
            }
          }
        } else {
          toast.error('Bu işlem için yetkiniz bulunmuyor. Lütfen giriş yapın.');
          // Kullanıcıyı login sayfasına yönlendir
          if (window.location.pathname !== '/login') {
            setTimeout(() => {
              window.location.href = '/login';
            }, 1500);
          }
        }
        break;
      case 'unauthenticated':
        toast.error('Oturum süreniz doldu. Lütfen tekrar giriş yapın.');
        // Kullanıcıyı login sayfasına yönlendir
        if (window.location.pathname !== '/login') {
          setTimeout(() => {
            window.location.href = '/login';
          }, 1500);
        }
        break;
      default:
        toast.error(customMessage || `Veritabanı hatası: ${error.code}`);
    }
  } else if (error instanceof Error) {
    toast.error(customMessage || error.message);
  } else {
    toast.error(customMessage || 'Beklenmeyen bir veritabanı hatası oluştu');
  }
};

export default app;

// Token yenileme ortamını temizleme
async function cleanupTokenRenewalEnvironment(attempt: number): Promise<void> {
  console.log(`Token yenileme ortamı temizleniyor (${attempt}. deneme)...`);
  
  try {
    // IndexedDB veritabanlarını temizle
    const databases = window.indexedDB.databases ? await window.indexedDB.databases() : [];
    for (const database of databases) {
      if (database.name && (database.name.includes('firestore') || database.name.includes('firebase'))) {
        console.log(`IndexedDB temizleniyor: ${database.name}`);
        window.indexedDB.deleteDatabase(database.name);
      }
    }
    
    // localStorage'dan token bilgilerini temizle
    const tokenKeys = ['firebase:authUser', 'firebase:token'];
    tokenKeys.forEach(key => {
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey && storageKey.includes(key)) {
          console.log(`LocalStorage anahtarı temizleniyor: ${storageKey}`);
          localStorage.removeItem(storageKey);
        }
      }
    });
    
    // Servis çalışanlarını yenile
    if ('serviceWorker' in navigator && attempt > 2) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        console.log('Servis çalışanı yenileniyor...');
        await registration.update();
      }
    }
    
    // Cache temizleme (son çare)
    if (attempt > 3 && 'caches' in window) {
      const cacheKeys = await caches.keys();
      for (const cacheKey of cacheKeys) {
        if (cacheKey.includes('firebase')) {
          console.log(`Cache temizleniyor: ${cacheKey}`);
          await caches.delete(cacheKey);
        }
      }
    }
  } catch (cleanupError) {
    console.warn('Ortam temizleme hatası:', cleanupError);
  }
}

// Token yenileme hatasını işle
async function handleTokenRenewalError(error: any, attempt: number): Promise<void> {
  // TypeError özel durumu
  if (error instanceof TypeError) {
    console.warn('TypeError algılandı, tarayıcı önbelleği temizleniyor...');
    
    try {
      // LocalStorage temizleme
      localStorage.removeItem('firebase:previous_websocket_failure');
      
      // Tüm IndexedDB veritabanlarını temizle
      const databases = window.indexedDB.databases ? await window.indexedDB.databases() : [];
      for (const database of databases) {
        if (database.name) {
          window.indexedDB.deleteDatabase(database.name);
        }
      }
    } catch (cleanError) {
      console.warn('Önbellek temizleme hatası:', cleanError);
    }
  }
  
  // Network hatası
  if (error.code === 'auth/network-request-failed') {
    console.warn('Ağ hatası algılandı, bağlantı kontrol ediliyor...');
    
    // Bağlantı kontrolü
    const isOnline = navigator.onLine;
    if (!isOnline) {
      toast.warning('İnternet bağlantınız yok. Bağlantı kurulduğunda otomatik yenilenecek.');
    } else {
      toast.warning('Sunucu bağlantı sorunu. Yeniden deneniyor...');
    }
  }
  
  // Ciddi hata durumlarında (3. denemeden sonra) kullanıcıya bilgi ver
  if (attempt >= 3) {
    toast.error('Oturum yenilenirken sorun oluştu. Tekrar deneniyor...');
  }
}
