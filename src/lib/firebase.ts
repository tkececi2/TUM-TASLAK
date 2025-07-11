import { initializeApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, connectAuthEmulator, AuthError, sendEmailVerification } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, enableIndexedDbPersistence, connectFirestoreEmulator, CACHE_SIZE_UNLIMITED, query, collection, limit, getDocs } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
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
export const functions = getFunctions(app);

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

// Basitleştirilmiş persistence konfigürasyonu
try {
  // Web içinde IndexedDB sorunlarını önlemek için basit yapılandırma kullanıyoruz
  console.info('Hafıza tabanlı önbellek kullanılacak.');
  
  // Firestore önbellek yapılandırması - sadece temel ayarlar
  const firestoreSettings = {
    ignoreUndefinedProperties: true
  };
  
  db.settings(firestoreSettings);
  
  // Ağ bağlantısını etkinleştir
  db.enableNetwork().catch(err => {
    console.warn('Firestore ağ bağlantısı sağlanamadı:', err);
    
    // Özel bir "failed-precondition" hata işleyicisi
    if (err && err.code === 'failed-precondition') {
      console.warn('IndexedDB erişim hatası algılandı, oturum yenileniyor...');
      // Kullanıcı oturumunu yenilemeyi dene
      if (auth.currentUser) {
        auth.currentUser.getIdToken(true)
          .then(() => console.log('Token yenilendi, sayfayı yenileyin'))
          .catch(e => console.error('Token yenileme hatası:', e));
      }
    }
  });
  
} catch (error) {
  console.info('Persistence yapılandırma hatası:', error);
  console.info('Basit yapılandırma kullanılacak.');
}

// SuperAdmin için özel token yenileme işlevi
export const refreshSuperAdminToken = async (): Promise<boolean> => {
  try {
    if (!auth.currentUser) {
      console.error('SuperAdmin token yenileme hatası: Kullanıcı oturum açmamış');
      return false;
    }

    console.log('SuperAdmin token yenileniyor...');

    // Firestore'dan kullanıcı rolünü kontrol et
    const userDoc = await getDoc(doc(db, 'kullanicilar', auth.currentUser.uid));
    if (!userDoc.exists()) {
      console.error('SuperAdmin kullanıcı belgesi bulunamadı');
      return false;
    }

    const userData = userDoc.data();
    if (userData.rol !== 'superadmin') {
      console.error('Kullanıcı SuperAdmin değil:', userData.rol);
      return false;
    }

    // Token'ı force refresh et
    await auth.currentUser.getIdToken(true);
    console.log('SuperAdmin token başarıyla yenilendi');

    return true;
  } catch (error) {
    console.error('SuperAdmin token yenileme hatası:', error);
    return false;
  }
};

// Firebase token yenileme işlevi - tüm uygulama için kullanılabilir
export const refreshAuthToken = async (): Promise<boolean> => {
  try {
    // Kullanıcı giriş yapmamışsa işlem yapma
    if (!auth.currentUser) {
      console.error('Token yenileme hatası: Kullanıcı oturum açmamış');
      return false;
    }

    console.log('Token yenileniyor...');

    // Token yenileme denemesi - hata durumunda 3 kez deneyin
    let success = false;
    let attempts = 0;

    while (!success && attempts < 3) {
      try {
        await auth.currentUser.getIdToken(true);
        success = true;
      } catch (err) {
        attempts++;
        console.warn(`Token yenileme denemesi ${attempts}/3 başarısız:`, err);
        // Kısa bir bekleme süresi ekleyin
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!success) {
      console.error('Token 3 deneme sonrasında yenilenemedi');
      return false;
    }

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
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // E-posta doğrulama gönder
    await sendEmailVerification(user);
    
    const userProfile = {
      ...userData,
      id: user.uid,
      email: user.email,
      emailVerified: false, // Başlangıçta doğrulanmamış
      olusturmaTarihi: new Date(),
      guncellenmeTarihi: new Date()
    };

    await setDoc(doc(db, 'kullanicilar', user.uid), userProfile);
    
    // Kullanıcıyı hemen login etme - doğrulama bekle
    toast.success('Hesap oluşturuldu! E-postanızı kontrol ederek hesabınızı doğrulayın.');
    toast('E-posta doğrulama linkine tıkladıktan sonra tekrar giriş yapın.', { icon: 'ℹ️' });
    
    // Kullanıcıyı logout et
    await auth.signOut();
    
    return user;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // E-posta doğrulanmış mı kontrol et
        if (!user.emailVerified) {
          await sendEmailVerification(user);
          await auth.signOut();
          toast.error('E-posta adresiniz doğrulanmamış. Yeni doğrulama e-postası gönderildi.');
          throw new Error('Email not verified');
        }

        const userProfile = {
          ...userData,
          id: user.uid,
          email: user.email,
          emailVerified: true,
          guncellenmeTarihi: new Date()
        };

        await setDoc(doc(db, 'kullanicilar', user.uid), userProfile, { merge: true });
        authService.setCurrentUser(userProfile);

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
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, password);
    } catch (initialError: any) {
      console.error('Firebase giriş hatası:', {
        code: initialError.code,
        message: initialError.message,
        name: initialError.name,
        stack: initialError.stack
      });
      
      if (initialError.code === 'auth/network-request-failed') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('Giriş yeniden deneme başarılı');
      } else {
        throw initialError;
      }
    }

    const user = userCredential.user;
    
    // E-posta doğrulama kontrolü
    if (!user.emailVerified) {
      await sendEmailVerification(user);
      await auth.signOut();
      toast.error('E-posta adresiniz doğrulanmamış! Yeni doğrulama e-postası gönderildi.');
      toast('E-postanızdaki doğrulama linkine tıklayın ve tekrar giriş yapın.', { icon: 'ℹ️' });
      throw new Error('Email not verified');
    }

    // E-posta doğrulandıysa, kullanıcı verisini güncelle
    const userDocRef = doc(db, 'kullanicilar', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      // E-posta doğrulama durumunu güncelle
      if (!userData.emailVerified) {
        await setDoc(userDocRef, { emailVerified: true }, { merge: true });
      }
    }

    await user.getIdToken(true);
    const idTokenResult = await user.getIdTokenResult();
    console.log('Giriş sonrası token iddiaları:', idTokenResult.claims);

    return user;
  } catch (error) {
    console.error('signInUser hatası:', error);
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