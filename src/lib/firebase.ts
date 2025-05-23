
import { initializeApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, doc, setDoc, enableIndexedDbPersistence, connectFirestoreEmulator, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
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
  // Uygulamanın yenilenmesine veya diğer sekmelerde de çalışmasına izin veriyoruz
  enableIndexedDbPersistence(db, {
    synchronizeTabs: true  // Bu, çoklu sekme desteğini etkinleştirir
  }).catch((err) => {
    // Hata durumlarını daha iyi yönetiyoruz
    if (err.code === 'failed-precondition') {
      console.warn('IndexedDB persistence etkinleştirilemedi: Muhtemelen birden fazla sekme açık. Uygulama hafıza önbelleğini kullanacak.');
    } else if (err.code === 'unimplemented') {
      console.warn('Bu tarayıcı IndexedDB persistence desteklemiyor. Uygulama hafıza önbelleğini kullanacak.');
    } else {
      console.error('Persistence hatası:', err);
    }
    // Bu durumda Firebase otomatik olarak bellek önbelleğine düşecektir
  });
} catch (error) {
  console.error('Persistence yapılandırma hatası:', error);
  console.warn('Hafıza tabanlı önbellek kullanılacak.');
}

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
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
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
export const handleFirebaseError = (error: unknown, customMessage?: string) => {
  console.error('Firebase hatası:', error);
  
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'failed-precondition':
        toast.error(customMessage || 'Veri işleme sorunu. Lütfen sayfayı yenileyip tekrar deneyin.');
        break;
      case 'unavailable':
        toast.error('Firebase hizmeti şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
        break;
      case 'resource-exhausted':
        toast.error('Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.');
        break;
      case 'permission-denied':
        toast.error('Bu işlem için yetkiniz bulunmuyor.');
        break;
      case 'unauthenticated':
        toast.error('Oturum süreniz doldu. Lütfen tekrar giriş yapın.');
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
