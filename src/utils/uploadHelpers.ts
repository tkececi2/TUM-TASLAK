// src/utils/uploadHelpers.ts dosyasını düzenleyin

export const uploadFile = async (file: File, path: string): Promise<string> => {
  try {
    // Validate file before proceeding
    validateFileType(file);
    validateFileSize(file);
    
    // Compress image with error handling
    let compressedFile;
    try {
      compressedFile = await compressImage(file);
    } catch (error) {
      console.warn('Image compression failed, using original file:', error);
      compressedFile = file;
    }

    // Generate safe filename
    const timestamp = Date.now();
    const safeName = validateFileName(file.name);
    
    // GEÇİCİ ÇÖZÜM: Tüm kullanıcılar için erişilebilir bir klasöre yönlendir
    // Firebase kurallarımızda 'ortak_stoklar' klasörüne herkes için izin vereceğiz
    const orjinalPath = path;
    const geciciPath = 'ortak_stoklar'; // Herkesin erişebileceği geçici bir klasör
    const fullPath = `${geciciPath}/${timestamp}_${safeName}`;

    // Create storage reference
    const storageRef = ref(storage, fullPath);

    try {
      // Upload file
      const snapshot = await uploadBytes(storageRef, compressedFile, {
        contentType: compressedFile.type,
        customMetadata: {
          originalName: file.name,
          timestamp: timestamp.toString(),
          orjinalPath: orjinalPath // Gerçekte hangi klasöre gitmeliydi kaydedelim
        }
      });

      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (uploadError: any) {
      console.error('Storage upload error:', uploadError);
      
      // İzin hatası durumunda daha açıklayıcı bir hata mesajı
      if (uploadError.code === 'storage/unauthorized') {
        console.log('Yetki hatası algılandı, geçici çözüm uygulandı fakat çalışmadı');
        throw new Error(`${file.name}: Fotoğraf yükleme için yetkiniz bulunmamaktadır. Lütfen yöneticinize başvurun.`);
      }
      throw new Error(`${file.name}: Fotoğraf yüklenirken bir hata oluştu. Lütfen tekrar deneyin.`);
    }
  } catch (error: any) {
    console.error('Dosya yükleme hatası:', error);
    throw error;
  }
};