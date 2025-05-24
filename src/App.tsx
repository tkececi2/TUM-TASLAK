import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { CompanyProvider } from './contexts/CompanyContext';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Register from './pages/Register';
import { PrivateRoute } from './components/PrivateRoute';
import { LoadingSpinner } from './components/LoadingSpinner';
import { OfflineIndicator } from './components/OfflineIndicator';

const App = () => {
  const [appLoaded, setAppLoaded] = useState(false);

  // Uygulama yükleme durumu
  useEffect(() => {
    // Uygulama ilk yüklendiğinde kritik kaynakları önceden yükle
    const preloadResources = async () => {
      try {
        // Burada önceden yüklenecek kaynaklar için işlemler yapılabilir
        // Örneğin, sık kullanılan görselleri önbelleğe alma
        const imagesToPreload = ['/solar-logo.png', '/edeon-logo.png'];

        await Promise.all(
          imagesToPreload.map((src) => {
            return new Promise((resolve, reject) => {
              const img = new Image();
              img.src = src;
              img.onload = resolve;
              img.onerror = reject;
            });
          })
        );

        // Sayfa 250ms içinde yüklendiyse, minimum 500ms göster (ani değişimi önlemek için)
        // Yavaş yüklendiyse, direkt geçiş yap
        const minLoadTime = 500;
        const startTime = performance.now();
        const elapsedTime = performance.now() - startTime;

        if (elapsedTime < minLoadTime) {
          setTimeout(() => setAppLoaded(true), minLoadTime - elapsedTime);
        } else {
          setAppLoaded(true);
        }
      } catch (error) {
        console.error('Kaynak önyükleme hatası:', error);
        setAppLoaded(true); // Hata olsa bile uygulamayı yükle
      }
    };

    preloadResources();
  }, []);

  if (!appLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
        <img src="/solar-logo.png" alt="EDEON Enerji" className="w-24 h-24 mb-8 animate-pulse" />
        <LoadingSpinner />
        <p className="mt-4 text-gray-600">Uygulama yükleniyor...</p>
      </div>
    );
  }

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#333',
          },
        }}
      />
      <OfflineIndicator />
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center">
            <LoadingSpinner />
            <p className="mt-4 text-gray-500">Sayfa yükleniyor...</p>
          </div>
        </div>
      }>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          {/* Diğer rotalar buraya gelecek */}
        </Routes>
      </Suspense>
    </>
  );
};

export default App;