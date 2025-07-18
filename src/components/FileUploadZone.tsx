import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { getStorage, ref, uploadBytesResumable } from "firebase/storage";
import app from '../lib/firebase';

// Assume getCurrentCompanyId and cleanFileName are defined elsewhere and imported
async function getCurrentCompanyId(): Promise<string> {
  // Replace with your actual logic to fetch the company ID
  return 'defaultCompanyId';
}

function cleanFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9.]/g, '_');
}

interface FileUploadZoneProps {
  onFileSelect: (files: File[]) => void;
  maxFiles?: number;
  accept?: Record<string, string[]>;
  selectedFiles?: File[];
  onFileRemove?: (index: number) => void;
  uploadProgress?: number;
  disabled?: boolean;
  path?: string; // Added path prop
  onUploadComplete?: (url: string) => void; // Optional callback for when upload completes
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFileSelect,
  maxFiles = 5,
  accept = {
    'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
  },
  selectedFiles = [],
  onFileRemove,
  uploadProgress,
  disabled = false,
  path = 'uploads', // Default path
  onUploadComplete
}) => {
  const { kullanici, idTokenResult } = useAuth(); // Include idTokenResult

  const storage = getStorage(app);
  // Check if user has permission to upload files
  const hasUploadPermission = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis', 'superadmin'].includes(kullanici.rol);

  // Logged token info for debugging
  console.log('Mevcut kullanıcı rolü:', kullanici?.rol);
  console.log('Yükleme izni var mı:', hasUploadPermission);

  // If disabled prop is not explicitly set, determine based on user role
  const isDisabled = disabled || !hasUploadPermission;

  const uploadFile = async (file: File): Promise<string> => {
    try {
      // utils/uploadHelpers.ts içindeki uploadFile fonksiyonunu kullan
      const uploadResult = await import('../utils/uploadHelpers').then(module => {
        return module.uploadFile(file, path, 10); // 10MB max boyut
      });
      
      if (onUploadComplete) {
        onUploadComplete(uploadResult);
      }
      
      return uploadResult;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  };
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (isDisabled) {
      toast.error('Fotoğraf yükleme izniniz bulunmuyor');
      return;
    }

    // Check total files limit
    const totalFiles = selectedFiles.length + acceptedFiles.length;
    if (totalFiles > maxFiles) {
      toast.error(`En fazla ${maxFiles} dosya yükleyebilirsiniz`);
      return;
    }

    // Validate each file
    const validFiles = acceptedFiles.filter(file => {
      // Check file type
      const isValidType = file.type.startsWith('image/');
      if (!isValidType) {
        toast.error(`${file.name} bir resim dosyası değil`);
        return false;
      }

      // Check file size
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} dosyası 10MB'dan büyük olamaz`);
        return false;
      }

      return true;
    });

    if (validFiles.length > 0) {
      // Upload files and get URLs
      try {
        // utils/uploadHelpers.ts içindeki uploadMultipleFiles fonksiyonunu kullan
        const module = await import('../utils/uploadHelpers');
        const urls = await module.uploadMultipleFiles(
          validFiles,
          path,
          undefined, // progress callback'i buraya verilebilir
          10 // 10MB max boyut
        );
        
        onFileSelect(validFiles); // Notify parent component about selected (and uploaded) files
        console.log("Uploaded file URLs:", urls);
        
        // Eğer her bir dosya URL'si için callback varsa, burada işlenebilir
        if (onUploadComplete && urls.length > 0) {
          // Son URL'yi gönder veya tüm URL'lerin birleştirilmiş halini
          onUploadComplete(urls[0]);
        }
      } catch (error: any) {
        console.error("File upload failed", error);
        toast.error(error.message || "Dosya yüklenirken bir hata oluştu.");
      }
    }
  }, [onFileSelect, maxFiles, selectedFiles.length, isDisabled, path, kullanici, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: maxFiles - selectedFiles.length,
    accept,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isDisabled
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`upload-zone ${
          isDragActive ? 'border-primary-500 bg-primary-50' : ''
        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center">
          <Upload className="h-12 w-12 text-gray-400 mb-4" />
          {isDragActive ? (
            <p className="text-primary-600">Dosyaları buraya bırakın...</p>
          ) : (
            <>
              <p className="text-gray-600">
                {isDisabled 
                  ? 'Fotoğraf yükleme izniniz bulunmuyor'
                  : 'Dosyaları sürükleyip bırakın veya seçmek için tıklayın'
                }
              </p>
              {!isDisabled && (
                <p className="text-sm text-gray-500 mt-2">
                  (Maksimum {maxFiles} dosya, her biri en fazla 10MB)
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {selectedFiles.map((file, index) => (
            <div key={index} className="relative group">
              <img
                src={URL.createObjectURL(file)}
                alt={`Önizleme ${index + 1}`}
                className="h-24 w-full object-cover rounded-lg shadow-md group-hover:opacity-75 transition-opacity"
              />
              {onFileRemove && (
                <button
                  type="button"
                  onClick={() => onFileRemove(index)}
                  className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {typeof uploadProgress === 'number' && uploadProgress > 0 && (
        <div className="relative pt-1">
          <div className="flex mb-2 items-center justify-between">
            <div>
              <span className="text-xs font-semibold inline-block text-primary-600">
                Yükleniyor
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold inline-block text-primary-600">
                {Math.round(uploadProgress)}%
              </span>
            </div>
          </div>
          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-primary-200">
            <div
              style={{ width: `${uploadProgress}%` }}
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary-500 transition-all duration-300"
            />
          </div>
        </div>
      )}
    </div>
  );
};