import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

// Helper functions
const validateFileType = (file: File) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`${file.name}: Desteklenmeyen dosya türü. Lütfen JPEG, PNG, GIF veya WEBP formatında bir resim yükleyin.`);
  }
};

const validateFileSize = (file: File) => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    throw new Error(`${file.name}: Dosya boyutu çok büyük. Maksimum dosya boyutu 10MB olmalıdır.`);
  }
};

const validateFileName = (fileName: string): string => {
  // Remove special characters and spaces, convert to lowercase
  return fileName.toLowerCase()
    .replace(/[^a-z0-9.]/g, '_')
    .replace(/_{2,}/g, '_');
};

const compressImage = async (file: File): Promise<File> => {
  // For now, return the original file
  // TODO: Implement image compression
  return file;
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
    throw error;
  }
};

export const uploadMultipleFiles = async (
  files: File[],
  path: string,
  onProgress?: (progress: number) => void
): Promise<string[]> => {
  const urls: string[] = [];
  let completedUploads = 0;

  try {
    for (const file of files) {
      const url = await uploadFile(file, path);
      urls.push(url);
      completedUploads++;
      
      if (onProgress) {
        onProgress((completedUploads / files.length) * 100);
      }
    }
    return urls;
  } catch (error) {
    console.error('Multiple file upload error:', error);
    throw error;
  }
};