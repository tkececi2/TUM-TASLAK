import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';
import toast from 'react-hot-toast'; // Added import statement
import { AlertTriangle } from 'react-feather';
import { ErrorAlert } from './ErrorAlert';

export const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { kullanici, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!kullanici) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Abonelik süresi bitmiş kullanıcıları engelle (süper admin hariç)
  if (kullanici.rol !== 'superadmin' && kullanici.odemeDurumu === 'surebitti') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full animate-fade-in">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-error-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-error-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Abonelik Süresi Dolmuş</h2>
            <p className="text-gray-600">Sistemi kullanabilmek için aboneliğinizin yenilenmesi gerekiyor.</p>
          </div>
          <ErrorAlert message="Abonelik süreniz dolmuştur. Lütfen yöneticinizle iletişime geçin." />
          <div className="mt-6 flex justify-center">
            <button 
              onClick={() => window.location.href = '/login'} 
              className="modern-button-primary w-full"
            >
              Giriş Sayfasına Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if the user is accessing the admin page and is not a superadmin
  if (location.pathname === '/admin' && kullanici.rol !== 'superadmin') {
    return <Navigate to="/anasayfa" replace />;
  }

  // Check if the user is accessing company settings and is not an admin
  if (location.pathname === '/company-settings' && kullanici.rol !== 'yonetici' && kullanici.rol !== 'superadmin') {
    return <Navigate to="/anasayfa" replace />;
  }

  return <>{children}</>;
};