import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import toast from 'react-hot-toast';

const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    // Validate file type before compression
    if (!file.type.startsWith('image/')) {
      resolve(file); // Return original file if not an image
      return;
    }

    const img = new Image();
    img.src = URL.createObjectURL(file);
    
    // Add error handling for image loading
    img.onerror = () => {
      console.warn(`Image compression failed for ${file.name}, using original file`);
      resolve(file);
    };

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.warn('Canvas context not available, using original file');
        resolve(file);
        return;
      }

      // Maximum dimensions
      const MAX_WIDTH = 1920;
      const MAX_HEIGHT = 1080;

      let width = img.width;
      let height = img.height;

      // Maintain aspect ratio
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }
      if (height > MAX_HEIGHT) {
        width = Math.round((width * MAX_HEIGHT) / height);
        height = MAX_HEIGHT;
      }

      canvas.width = width;
      canvas.height = height;
      
      try {
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              console.warn('Blob creation failed, using original file');
              resolve(file);
              return;
            }
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          0.8
        );
      } catch (error) {
        console.warn('Image compression failed, using original file:', error);
        resolve(file);
      }
    };
  });
};

const validateFileName = (fileName: string): string => {
  // Remove any potential malicious characters and spaces
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
};

const validateFileType = (file: File): void => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`${file.name}: Sadece JPEG, PNG, GIF ve WEBP formatları desteklenmektedir`);
  }
};

const validateFileSize = (file: File): void => {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name}: Dosya boyutu 10MB'dan büyük olamaz`);
  }
};

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
    const fullPath = `${path}/${timestamp}_${safeName}`;
    
    // Create storage reference
    const storageRef = ref(storage, fullPath);

    try {
      // Upload file
      const snapshot = await uploadBytes(storageRef, compressedFile, {
        contentType: compressedFile.type,
        customMetadata: {
          originalName: file.name,
          timestamp: timestamp.toString()
        }
      });

      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (uploadError: any) {
      console.error('Storage upload error:', uploadError);
      if (uploadError.code === 'storage/unauthorized') {
        throw new Error(`${file.name}: Fotoğraf yükleme için yetkiniz bulunmamaktadır. Lütfen yöneticinize başvurun.`);
      }
      throw new Error(`${file.name}: Fotoğraf yüklenirken bir hata oluştu. Lütfen tekrar deneyin.`);
    }
  } catch (error: any) {
    console.error('Dosya yükleme hatası:', error);
    throw new Error(error.message);
  }
};

export const uploadMultipleFiles = async (
  files: File[],
  path: string,
  onProgress?: (progress: number) => void
): Promise<string[]> => {
  if (!files || files.length === 0) {
    return [];
  }

  const urls: string[] = [];
  let completed = 0;
  const totalFiles = files.length;
  const failedFiles: string[] = [];

  // Validate all files first
  for (const file of files) {
    try {
      validateFileType(file);
      validateFileSize(file);
    } catch (error: any) {
      failedFiles.push(file.name);
      toast.error(error.message);
    }
  }

  if (failedFiles.length === files.length) {
    throw new Error(`Hiçbir dosya yüklenemedi. Lütfen dosya türü ve boyutunu kontrol edin.`);
  }

  // Only process files that passed validation
  const validFiles = files.filter(file => !failedFiles.includes(file.name));

  for (const file of validFiles) {
    try {
      const url = await uploadFile(file, path);
      urls.push(url);
    } catch (error: any) {
      console.error(`Dosya yükleme hatası (${file.name}):`, error);
      failedFiles.push(file.name);
      
      // Show error message but continue with other files
      toast.error(error.message);
    } finally {
      completed++;
      if (onProgress && typeof onProgress === 'function') {
        onProgress((completed / totalFiles) * 100);
      }
    }
  }

  // If all files failed, throw an error
  if (urls.length === 0 && files.length > 0) {
    throw new Error(`Dosya yükleme başarısız: ${failedFiles.join(', ')}. Lütfen yetkinizi kontrol edin veya yöneticinize başvurun.`);
  }

  return urls;
}