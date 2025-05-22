
import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Giris } from './pages/Giris';
import { Register } from './pages/Register';
import { Anasayfa } from './pages/Anasayfa';
import { Arizalar } from './pages/Arizalar';
import { ArizaDetay } from './pages/ArizaDetay';
import { PrivateRoute } from './components/PrivateRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
import { BildirimProvider } from './contexts/BildirimContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Lazy loaded components
const Ekip = lazy(() => import('./pages/Ekip').then(module => ({ default: module.Ekip })));
const Musteriler = lazy(() => import('./pages/Musteriler').then(module => ({ default: module.Musteriler })));
const Ayarlar = lazy(() => import('./pages/Ayarlar').then(module => ({ default: module.Ayarlar })));
const ElektrikBakim = lazy(() => import('./pages/ElektrikBakim').then(module => ({ default: module.ElektrikBakim })));
const MekanikBakim = lazy(() => import('./pages/MekanikBakim').then(module => ({ default: module.MekanikBakim })));
const ElektrikKesintileri = lazy(() => import('./pages/ElektrikKesintileri').then(module => ({ default: module.ElektrikKesintileri })));
const InvertorKontrol = lazy(() => import('./pages/InvertorKontrol').then(module => ({ default: module.InvertorKontrol })));
const GesYonetimi = lazy(() => import('./pages/GesYonetimi').then(module => ({ default: module.GesYonetimi })));
const YapilanIsler = lazy(() => import('./pages/YapilanIsler').then(module => ({ default: module.YapilanIsler })));
const AkilliBakim = lazy(() => import('./pages/AkilliBakim').then(module => ({ default: module.AkilliBakim })));
const UretimVerileri = lazy(() => import('./pages/UretimVerileri').then(module => ({ default: module.UretimVerileri })));
const StokKontrol = lazy(() => import('./pages/StokKontrol').then(module => ({ default: module.StokKontrol })));
const FinansalAnaliz = lazy(() => import('./pages/FinansalAnaliz').then(module => ({ default: module.FinansalAnaliz })));
const AylikKapsamliRapor = lazy(() => import('./pages/AylikKapsamliRapor').then(module => ({ default: module.AylikKapsamliRapor })));
const CompanySettings = lazy(() => import('./pages/CompanySettings').then(module => ({ default: module.CompanySettings })));
const InviteUser = lazy(() => import('./pages/InviteUser').then(module => ({ default: module.InviteUser })));

function App() {
  return (
    <Router>
      <AuthProvider>
        <CompanyProvider>
          <BildirimProvider>
            <NotificationProvider>
              <Toaster position="top-right" />
              <AppRoutes />
            </NotificationProvider>
          </BildirimProvider>
        </CompanyProvider>
      </AuthProvider>
    </Router>
  );
}

function AppRoutes() {
  const { kullanici, yukleniyor } = useAuth();

  if (yukleniyor) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={kullanici ? <Navigate to="/" /> : <Giris />} />
      <Route path="/register" element={kullanici ? <Navigate to="/" /> : <Register />} />
      
      <Route path="/" element={
        <PrivateRoute>
          <Layout>
            <Anasayfa />
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/arizalar" element={
        <PrivateRoute>
          <Layout>
            <Arizalar />
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/arizalar/:id" element={
        <PrivateRoute>
          <Layout>
            <ArizaDetay />
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/ekip" element={
        <PrivateRoute roles={['yonetici', 'admin', 'superadmin']}>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <Ekip />
            </Suspense>
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/musteriler" element={
        <PrivateRoute roles={['yonetici', 'admin']}>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <Musteriler />
            </Suspense>
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/elektrik-bakim" element={
        <PrivateRoute>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <ElektrikBakim />
            </Suspense>
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/mekanik-bakim" element={
        <PrivateRoute>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <MekanikBakim />
            </Suspense>
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/elektrik-kesintileri" element={
        <PrivateRoute>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <ElektrikKesintileri />
            </Suspense>
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/invertor-kontrol" element={
        <PrivateRoute>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <InvertorKontrol />
            </Suspense>
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/ges-yonetimi" element={
        <PrivateRoute>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <GesYonetimi />
            </Suspense>
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/yapilan-isler" element={
        <PrivateRoute>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <YapilanIsler />
            </Suspense>
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/akilli-bakim" element={
        <PrivateRoute>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <AkilliBakim />
            </Suspense>
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/uretim-verileri" element={
        <PrivateRoute>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <UretimVerileri />
            </Suspense>
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/stok-kontrol" element={
        <PrivateRoute roles={['yonetici', 'admin', 'superadmin']}>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <StokKontrol />
            </Suspense>
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/finansal-analiz" element={
        <PrivateRoute>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <FinansalAnaliz />
            </Suspense>
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/aylik-kapsamli-rapor" element={
        <PrivateRoute>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <AylikKapsamliRapor />
            </Suspense>
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/ayarlar" element={
        <PrivateRoute roles={['admin', 'superadmin']}>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <Ayarlar />
            </Suspense>
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/company-settings" element={
        <PrivateRoute roles={['admin', 'superadmin']}>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <CompanySettings />
            </Suspense>
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="/invite-user" element={
        <PrivateRoute roles={['admin', 'superadmin']}>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <InviteUser />
            </Suspense>
          </Layout>
        </PrivateRoute>
      } />
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
