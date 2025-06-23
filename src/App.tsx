import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Anasayfa } from './pages/Anasayfa';
import { Arizalar } from './pages/Arizalar';
import { ArizaDetay } from './pages/ArizaDetay';
import { Ekip } from './pages/Ekip';
import { Sahalar } from './pages/Sahalar';
import { StokKontrol } from './pages/StokKontrol';


import { Ayarlar } from './pages/Ayarlar';
import { Musteriler } from './pages/Musteriler';
import { NobetKontrol } from './pages/NobetKontrol';
import { YapilanIsler } from './pages/YapilanIsler';
import { ElektrikKesintileri } from './pages/ElektrikKesintileri';
import { InvertorKontrol } from './pages/InvertorKontrol';
import { MekanikBakimPage } from './pages/MekanikBakim';
import { ElektrikBakimPage } from './pages/ElektrikBakimPage';
import { GesYonetimi } from './pages/GesYonetimi';
import { GesSahalari } from './pages/GesSahalari';
import { UretimVerileri } from './pages/UretimVerileri';
import { PrivateRoute } from './components/PrivateRoute';
import { LoadingSpinner } from './components/LoadingSpinner';
import { CompanySettings } from './pages/CompanySettings';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { InviteUser } from './pages/InviteUser';
import HomePage from './pages/HomePage';
import { VardiyaBildirimler } from './pages/VardiyaBildirimler';
import { RaporTemplate } from './pages/RaporTemplate';

function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/invite/:inviteId" element={<InviteUser />} />

      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/anasayfa" element={<Anasayfa />} />
        <Route path="/arizalar" element={<Arizalar />} />
        <Route path="/arizalar/:id" element={<ArizaDetay />} />
        <Route path="/sahalar" element={<Sahalar />} />
        <Route path="/stok-kontrol" element={<StokKontrol />} />
        <Route path="/ekip" element={<Ekip />} />



        <Route path="/rapor/:raporTuru" element={<RaporTemplate />} />
        <Route path="/ayarlar" element={<Ayarlar />} />
        <Route path="/musteriler" element={<Musteriler />} />
        <Route path="/nobet-kontrol" element={<NobetKontrol />} />
        <Route path="/yapilan-isler" element={<YapilanIsler />} />
        <Route path="/elektrik-kesintileri" element={<ElektrikKesintileri />} />
        <Route path="/invertor-kontrol" element={<InvertorKontrol />} />
        <Route path="/mekanik-bakim" element={<MekanikBakimPage />} />
        <Route path="/elektrik-bakim" element={<ElektrikBakimPage />} />
        <Route path="/ges-yonetimi" element={<GesYonetimi />} />
        <Route path="/ges-sahalari" element={<GesSahalari />} />
        <Route path="/uretim-verileri" element={<UretimVerileri />} />
        <Route path="/vardiya-bildirimleri" element={<VardiyaBildirimler />} />
        <Route path="/company-settings" element={<CompanySettings />} />
        <Route path="/admin" element={<SuperAdminDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;