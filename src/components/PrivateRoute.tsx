import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';

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
    // Kullanıcıyı çıkış sayfasına yönlendir
    toast.error('Abonelik süreniz dolmuştur. Lütfen yöneticinizle iletişime geçin.', {
      duration: 5000,
      position: 'top-center',
    });
    return <Navigate to="/login" state={{ expired: true }} replace />;
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