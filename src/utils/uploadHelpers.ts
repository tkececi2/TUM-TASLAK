import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../lib/firebase'; // Firebase config dosyanızın yolu
import { userService } from '../services/userService';
import toast from 'react-hot-toast';

const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve) => { // Hata durumunda reject etmiyoruz, orijinal dosyayı döndürüyoruz.
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onerror = () => {
      console.warn(`Resim sıkıştırma sırasında '${file.name}' yüklenemedi, orijinal dosya kullanılıyor.`);
      resolve(file);
    };

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.warn('Canvas context alınamadı, orijinal dosya kullanılıyor.');
        resolve(file);
        return;
      }

      const MAX_WIDTH = 1920;
      const MAX_HEIGHT = 1080;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round(height * (MAX_WIDTH / width));
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round(width * (MAX_HEIGHT / height));
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;

      try {
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              console.warn('Blob oluşturulamadı, orijinal dosya kullanılıyor.');
              resolve(file);
              return;
            }
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg', // Sıkıştırılmış format jpeg
              lastModified: Date.now(),
            });
            // Sıkıştırma sonrası boyut kontrolü de eklenebilir.
            console.log(`Orijinal boyut: ${(file.size / 1024 / 1024).toFixed(2)}MB, Sıkıştırılmış boyut: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
            resolve(compressedFile);
          },
          'image/jpeg', // Çıktı formatı
          0.8 // Kalite (0.0 - 1.0)
        );
      } catch (error) {
        console.warn('Resim sıkıştırma hatası, orijinal dosya kullanılıyor:', error);
        resolve(file);
      }
    };
  });
};

const validateFileName = (fileName: string): string => {
  return fileName
    .toLowerCase()
    .replace(/\s+/g, '_') // Boşlukları _ ile değiştir
    .replace(/[^a-z0-9._-]/g, '') // İzin verilen karakterler dışındakileri sil
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
};

const validateFileType = (file: File): void => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`${file.name}: Sadece JPEG, PNG, GIF ve WEBP formatları desteklenmektedir.`);
  }
};

const validateFileSize = (file: File, maxSizeMB = 10): void => { // Varsayılan 10MB
  const MAX_FILE_SIZE_BYTES = maxSizeMB * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`${file.name}: Dosya boyutu ${maxSizeMB}MB'dan büyük olamaz.`);
  }
};

// Kullanıcıdan companyId alma
export const getCurrentCompanyId = async (): Promise<string> => {
  try {
    // Eğer auth token'dan direkt erişebiliyorsak
    const user = auth.currentUser;
    if (user) {
      const idTokenResult = await user.getIdTokenResult();
      if (idTokenResult.claims.companyId) {
        return idTokenResult.claims.companyId as string;
      }
    }

    // LocalStorage'dan kullanıcı bilgisini al
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userData = JSON.parse(userStr);
      return userData.companyId || '';
    }

    return '';
  } catch (error) {
    console.error('CompanyId alınırken hata:', error);
    return '';
  }
};

export const uploadFile = async (file: File, path: string, maxSizeMB = 10): Promise<string> => {
  try {
    validateFileType(file);
    validateFileSize(file, maxSizeMB); // Boyut kontrolünü de parametrik yapalım

    let fileToUpload = file;
    if (file.type.startsWith('image/')) { // Sadece resimleri sıkıştır
        fileToUpload = await compressImage(file);
        // Sıkıştırma sonrası dosya boyutunu da kontrol et, eğer sıkıştırma beklenenden az olduysa.
        validateFileSize(fileToUpload, maxSizeMB); 
    }

    const timestamp = Date.now();
    const safeName = validateFileName(fileToUpload.name);
    const fullPath = `${path}/${timestamp}_${safeName}`;

    // Force token refresh before uploading to ensure latest claims are used
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true);

      // Log token claims for debugging
      const idTokenResult = await auth.currentUser.getIdTokenResult();
      console.log('Token claims before upload:', idTokenResult.claims);
    }

    const storageRef = ref(storage, fullPath);
    const companyId = await getCurrentCompanyId(); // companyId'yi al

    try {
      const snapshot = await uploadBytes(storageRef, fileToUpload, {
        contentType: fileToUpload.type,
        customMetadata: {
          originalName: file.name, // Orijinal adı sakla
          timestamp: timestamp.toString(),
          companyId: companyId // companyId'yi metadata'ya ekle
        }
      });
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (uploadError: any) {
      console.error('Storage yükleme hatası:', uploadError, 'Path:', fullPath);
      if (uploadError.code === 'storage/unauthorized') {
        // Yetki hatası detayını göster
        console.log('Kullanıcının rol bilgisi:', auth.currentUser ? await auth.currentUser.getIdTokenResult().then(t => t.claims.rol || 'rol yok') : 'kullanıcı yok');
        throw new Error(`${file.name} adlı dosya için yükleme yetkiniz bulunmamaktadır. Lütfen yöneticinize başvurun. (Hata kodu: ${uploadError.code})`);
      }
      throw new Error(`${file.name}: Fotoğraf yüklenirken bir hata oluştu. Kod: ${uploadError.code}`);
    }
  } catch (error: any) { // validateFileType veya validateFileSize'dan gelen hatalar da buraya düşer
    console.error('Dosya hazırlama/yükleme genel hatası:', error);
    // Hata objesinde message özelliği olduğundan emin ol
    if (error instanceof Error) {
      throw error; // Zaten Error objesi ise doğrudan fırlat
    } else if (typeof error === 'object' && error !== null) {
      console.log('Hata detayları:', JSON.stringify(error));
      throw new Error(`Dosya yükleme hatası: ${error.code || 'Bilinmeyen hata'}`);
    } else {
      throw new Error('Bilinmeyen bir hata oluştu');
    }
  }
};

export const uploadMultipleFiles = async (
  files: File[],
  path: string,
  onProgress?: (progress: number) => void,
  maxSizeMB = 10 // Her bir dosya için maksimum boyut
): Promise<string[]> => {
  if (!files || files.length === 0) {
    return [];
  }

  // Force token refresh before uploading to ensure latest claims are used
  if (auth.currentUser) {
    try {
      await auth.currentUser.getIdToken(true);

      // Log token claims for debugging
      const idTokenResult = await auth.currentUser.getIdTokenResult();
      console.log('Token claims before upload:', idTokenResult.claims);

      // LocalStorage'dan kullanıcı bilgilerini al
      const storageUserStr = localStorage.getItem('currentUser');
      let userHasPermission = false;
      
      if (storageUserStr) {
        try {
          const storageUser = JSON.parse(storageUserStr);
          console.log('StorageUser role:', storageUser.rol);
          
          // Rol bilgisi varsa ve izinli rollerdense yetki ver
          if (storageUser.rol && ['yonetici', 'tekniker', 'muhendis', 'superadmin'].includes(storageUser.rol)) {
            userHasPermission = true;
            console.log('User has upload permission based on localStorage role');
          }
        } catch (e) {
          console.error('Error parsing user from localStorage', e);
        }
      }
      
      // Token claim'de rol varsa kontrol et
      if (idTokenResult.claims && idTokenResult.claims.rol) {
        if (['yonetici', 'tekniker', 'muhendis', 'superadmin'].includes(idTokenResult.claims.rol as string)) {
          userHasPermission = true;
          console.log('User has upload permission based on token claims');
        }
      }
      
      // Hala yetki yoksa, Firestore'dan kullanıcı verilerini almayı dene
      if (!userHasPermission) {
        console.log('No permission found, checking Firestore');
        const userDoc = await userService.getUserById(auth.currentUser.uid);
        
        if (userDoc && userDoc.rol) {
          console.log('Using role from Firestore document:', userDoc.rol);
          if (['yonetici', 'tekniker', 'muhendis', 'superadmin'].includes(userDoc.rol)) {
            userHasPermission = true;
            console.log('User has upload permission based on Firestore role');
          }
        }
      }
      
      // Hala yetki yoksa, hatayı fırlat
      if (!userHasPermission) {
        toast.error('Dosya yükleme için gerekli yetkiniz bulunmamaktadır');
        throw new Error('Dosya yükleme için gerekli yetkiniz bulunmamaktadır');
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      if (error instanceof Error) {
        throw error;
      }
    }
  } else {
    console.warn('No authenticated user found when trying to upload files');
    toast.error('Dosya yüklemek için giriş yapmalısınız');
    throw new Error('Dosya yüklemek için giriş yapmalısınız');
  }

  const urls: string[] = [];
  let completed = 0;
  const totalFiles = files.length;
  const failedFiles: { name: string, reason: string }[] = [];
  const validFilesToUpload: File[] = [];

  // Tüm dosyaları önce doğrula
  for (const file of files) {
    try {
      validateFileType(file);
      validateFileSize(file, maxSizeMB);
      validFilesToUpload.push(file);
    } catch (error: any) {
      failedFiles.push({ name: file.name, reason: error.message });
      toast.error(error.message); // Her geçersiz dosya için ayrı toast
    }
  }

  if (validFilesToUpload.length === 0 && files.length > 0) {
    // Hiç geçerli dosya yoksa, genel bir hata fırlat (ama zaten her biri için toast gösterildi)
    throw new Error(`Yüklenecek geçerli dosya bulunamadı. Lütfen dosya türlerini ve boyutlarını kontrol edin.`);
  }

  for (const file of validFilesToUpload) {
    try {
      // uploadFile'a maxSizeMB parametresini de yolla
      const url = await uploadFile(file, path, maxSizeMB); 
      urls.push(url);
    } catch (error: any) { // uploadFile'dan gelen hatalar (yetki vs.)
      console.error(`Dosya yükleme hatası (${file.name}):`, error);
      failedFiles.push({ name: file.name, reason: error.message });
      // Bu hata mesajı zaten uploadFile'dan geliyor ve spesifik (örn: yetki hatası)
      // Tekrar toast.error(error.message) demeye gerek yok, uploadFile içinde veya burada loglandı.
      // Ancak StokKontrol'e fırlatılacak genel hata mesajı için bu bilgiyi saklayabiliriz.
    } finally {
      completed++;
      if (onProgress && typeof onProgress === 'function') {
        onProgress((completed / files.length) * 100); // Toplam dosya sayısına göre ilerleme
      }
    }
  }

  if (urls.length === 0 && validFilesToUpload.length > 0) { // Geçerli dosya vardı ama hiçbiri yüklenemedi (örn: hepsi yetki hatası aldı)
    const firstErrorMessage = failedFiles.length > 0 ? failedFiles[0].reason : "Bilinmeyen bir nedenle dosyalar yüklenemedi.";
    throw new Error(`Dosya yükleme başarısız oldu. İlk hata: ${firstErrorMessage}. Lütfen yetkinizi kontrol edin veya yöneticinize başvurun.`);
  }

  if (urls.length > 0 && urls.length < validFilesToUpload.length) { // Bazıları yüklendi, bazıları yüklenemedi
    toast.error(`${validFilesToUpload.length - urls.length} dosya yüklenemedi. Detaylar için konsolu kontrol edin.`);
  }

  return urls;
}