
import React from 'react';
import { Toaster, ToastPosition } from 'react-hot-toast';

export const ToastContainer: React.FC = () => {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        // Başarı toastları için stil
        success: {
          duration: 5000,
          style: {
            background: '#E8F5E9',
            color: '#2E7D32',
            border: '1px solid #A5D6A7',
            padding: '16px',
            borderRadius: '12px',
          },
          iconTheme: {
            primary: '#2E7D32',
            secondary: '#E8F5E9',
          },
        },
        // Hata toastları için stil
        error: {
          duration: 6000,
          style: {
            background: '#FFEBEE',
            color: '#C62828',
            border: '1px solid #EF9A9A',
            padding: '16px',
            borderRadius: '12px',
          },
          iconTheme: {
            primary: '#C62828',
            secondary: '#FFEBEE',
          },
        },
        // Bilgi toastları için stil
        loading: {
          style: {
            background: '#E3F2FD',
            color: '#1565C0',
            border: '1px solid #90CAF9',
            padding: '16px',
            borderRadius: '12px',
          },
        },
      }}
    />
  );
};
