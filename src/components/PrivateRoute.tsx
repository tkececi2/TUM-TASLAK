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