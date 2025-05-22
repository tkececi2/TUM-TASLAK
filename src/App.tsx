import { Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { BildirimProvider } from './contexts/BildirimContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Anasayfa from './pages/Anasayfa';
import Dashboard from './pages/Dashboard';
import Arizalar from './pages/Arizalar';
import ArizaDetay from './pages/ArizaDetay';
import ElektrikKesintileri from './pages/ElektrikKesintileri';
import InvertorKontrol from './pages/InvertorKontrol';
import Sahalar from './pages/Sahalar';
import YapilanIsler from './pages/YapilanIsler';
import Musteriler from './pages/Musteriler';
import MekanikBakim from './pages/MekanikBakim';
import ElektrikBakim from './pages/ElektrikBakim';
import Ekip from './pages/Ekip';
import StokKontrol from './pages/StokKontrol';
import Ayarlar from './pages/Ayarlar';
import Raporlar from './pages/Raporlar';
import PrivateRoute from './components/PrivateRoute';
import Istatistikler from './pages/Istatistikler';
import GesSahalari from './pages/GesSahalari';
import GesYonetimi from './pages/GesYonetimi';
import AylikKapsamliRapor from './pages/AylikKapsamliRapor';
import InviteUser from './pages/InviteUser';
import CompanySettings from './pages/CompanySettings';
import AkilliBakim from './pages/AkilliBakim';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import FinansalAnaliz from './pages/FinansalAnaliz';
import UretimVerileri from './pages/UretimVerileri';
import NobetKontrol from './pages/NobetKontrol';
import Layout from './components/Layout';

function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <NotificationProvider>
          <BildirimProvider>
            <Toaster position="top-right" />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              <Route path="/" element={<PrivateRoute><Layout><Anasayfa /></Layout></PrivateRoute>} />
              <Route path="/dashboard" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
              <Route path="/arizalar" element={<PrivateRoute><Layout><Arizalar /></Layout></PrivateRoute>} />
              <Route path="/ariza/:id" element={<PrivateRoute><Layout><ArizaDetay /></Layout></PrivateRoute>} />
              <Route path="/elektrik-kesintileri" element={<PrivateRoute><Layout><ElektrikKesintileri /></Layout></PrivateRoute>} />
              <Route path="/invertor-kontrol" element={<PrivateRoute><Layout><InvertorKontrol /></Layout></PrivateRoute>} />
              <Route path="/sahalar" element={<PrivateRoute><Layout><Sahalar /></Layout></PrivateRoute>} />
              <Route path="/yapilan-isler" element={<PrivateRoute><Layout><YapilanIsler /></Layout></PrivateRoute>} />
              <Route path="/musteriler" element={<PrivateRoute roles={['yonetici', 'superadmin']}><Layout><Musteriler /></Layout></PrivateRoute>} />
              <Route path="/mekanik-bakim" element={<PrivateRoute><Layout><MekanikBakim /></Layout></PrivateRoute>} />
              <Route path="/elektrik-bakim" element={<PrivateRoute><Layout><ElektrikBakim /></Layout></PrivateRoute>} />
              <Route path="/ekip" element={<PrivateRoute roles={['yonetici', 'superadmin']}><Layout><Ekip /></Layout></PrivateRoute>} />
              <Route path="/stok-kontrol" element={<PrivateRoute><Layout><StokKontrol /></Layout></PrivateRoute>} />
              <Route path="/ayarlar" element={<PrivateRoute><Layout><Ayarlar /></Layout></PrivateRoute>} />
              <Route path="/raporlar" element={<PrivateRoute><Layout><Raporlar /></Layout></PrivateRoute>} />
              <Route path="/istatistikler" element={<PrivateRoute><Layout><Istatistikler /></Layout></PrivateRoute>} />
              <Route path="/ges-sahalari" element={<PrivateRoute><Layout><GesSahalari /></Layout></PrivateRoute>} />
              <Route path="/ges-yonetimi/:id" element={<PrivateRoute><Layout><GesYonetimi /></Layout></PrivateRoute>} />
              <Route path="/aylik-kapsamli-rapor" element={<PrivateRoute><Layout><AylikKapsamliRapor /></Layout></PrivateRoute>} />
              <Route path="/invite-user" element={<PrivateRoute roles={['yonetici', 'superadmin']}><Layout><InviteUser /></Layout></PrivateRoute>} />
              <Route path="/company-settings" element={<PrivateRoute roles={['yonetici', 'superadmin']}><Layout><CompanySettings /></Layout></PrivateRoute>} />
              <Route path="/akilli-bakim" element={<PrivateRoute><Layout><AkilliBakim /></Layout></PrivateRoute>} />
              <Route path="/superadmin" element={<PrivateRoute roles={['superadmin']}><Layout><SuperAdminDashboard /></Layout></PrivateRoute>} />
              <Route path="/finansal-analiz" element={<PrivateRoute><Layout><FinansalAnaliz /></Layout></PrivateRoute>} />
              <Route path="/uretim-verileri" element={<PrivateRoute><Layout><UretimVerileri /></Layout></PrivateRoute>} />
              <Route path="/nobet-kontrol" element={<PrivateRoute><Layout><NobetKontrol /></Layout></PrivateRoute>} />
            </Routes>
          </BildirimProvider>
        </NotificationProvider>
      </CompanyProvider>
    </AuthProvider>
  );
}

export default App;