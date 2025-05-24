import { initializeApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, connectAuthEmulator, AuthError } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, enableIndexedDbPersistence, connectFirestoreEmulator, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
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

// Düzeltilmiş persistence konfigürasyonu
try {
  // Web içinde IndexedDB sorunlarını önlemek için bellek tabanlı cache kullanma
  // Bu, Replit WebView ile daha uyumlu çalışacaktır
  console.warn('Hafıza tabanlı önbellek kullanılacak.');

  // Persistence devre dışı, yalnızca bellek önbelleği aktif
} catch (error) {
  console.error('Persistence yapılandırma hatası:', error);
  console.warn('Hafıza tabanlı önbellek kullanılacak.');
}

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

// Bağlantı kontrolü - WebContainer ortamları için basitleştirilmiş
const checkConnection = async () => {
  // Önce tarayıcının çevrimiçi olup olmadığını kontrol et
  if (!navigator.onLine) {
    throw new Error('İnternet bağlantısı yok');
  }

  // WebContainer ortamlarında güvenilir harici fetch istekleri yapamayız
  // Bu yüzden sadece tarayıcının çevrimiçi durumuna güveniyoruz
  return true;
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
      case 'failed-precondition':
        toast.error(customMessage || 'Veritabanı erişim sorunu. Lütfen sayfayı yenileyip tekrar deneyin.');
        // failed-precondition hatası için ayrı bir işleme yukarıda yapıldığından burada break kullanmıyoruz
        return; // Özel işlemi yukarıda yaptığımız için fonksiyondan çıkıyoruz
      case 'unavailable':
        toast.error('Firebase hizmeti şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
        break;
      case 'resource-exhausted':
        toast.error('Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.');
        break;
      case 'permission-denied':
      case 'failed-precondition':
        // İzin hatası veya failed-precondition durumunda token'ı 3 kez yenilemeyi dene
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