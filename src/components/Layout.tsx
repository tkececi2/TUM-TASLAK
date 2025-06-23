import React, { useState, useEffect, useContext } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { BildirimMenusu } from './BildirimMenusu';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { MobileSidebar } from './MobileSidebar';
import { motion } from 'framer-motion';
import { Kullanici } from '../types';

interface SirketBilgileri {
  sirketAdi: string;
  slogan: string;
  logoURL: string;
}

const SirketContext = React.createContext<SirketBilgileri>({
  sirketAdi: 'SolarVeyo',
  slogan: 'Güneş Enerjisi Yönetimi',
  logoURL: '/solarveyo-logo.png'
});

export const useSirketBilgileri = () => useContext(SirketContext);

export const SirketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { kullanici } = useAuth();
  const { currentCompany } = useCompany();
  const [sirketBilgileri, setSirketBilgileri] = useState<SirketBilgileri>({
    sirketAdi: 'SolarVeyo',
    slogan: 'Güneş Enerjisi Yönetimi',
    logoURL: '/solarveyo-logo-blue.png'
  });

  useEffect(() => {
    const sirketBilgileriniGetir = async () => {
      if (!kullanici || !currentCompany) return;
      
      const logoURL = currentCompany.logo 
        ? `${currentCompany.logo}?t=${new Date().getTime()}` 
        : '/solarveyo-logo.png';

      setSirketBilgileri({
        sirketAdi: currentCompany.name || 'SolarVeyo',
        slogan: currentCompany.slogan || 'Güneş Enerjisi Yönetimi',
        logoURL: logoURL,
      });
    };

    sirketBilgileriniGetir();
  }, [kullanici, currentCompany]);

  return (
    <SirketContext.Provider value={sirketBilgileri}>
      {children}
    </SirketContext.Provider>
  );
};

const Header = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { kullanici } = useAuth();
  const user = kullanici as Kullanici | null;
  
  return (
    <header className="flex items-center justify-between h-16 px-3 bg-white border-b border-gray-200 shadow-sm">
      {/* Left: Menu Button */}
      <div className="flex-shrink-0">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-md lg:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Menüyü aç"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Center: Title */} 
      <div className="flex-1 flex items-center justify-center px-1">
        <span className="text-lg font-semibold text-gray-900 lg:hidden truncate">SolarVeyo</span>
      </div>

      {/* Right: Icons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <BildirimMenusu />
        <div className="flex items-center gap-2">
            <img
                src={user?.fotoURL || `https://ui-avatars.com/api/?name=${user?.ad || user?.email}&background=0D8ABC&color=fff`}
                alt="Profil"
                className="w-8 h-8 rounded-full border border-gray-200"
            />
            <span className="hidden text-sm font-medium text-gray-700 sm:block truncate max-w-20">{user?.ad}</span>
        </div>
      </div>
    </header>
  );
};

export const Layout: React.FC = () => {
  const [isSidebarExpanded, setSidebarExpanded] = useState(true);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarExpanded(false);
      } else {
        setSidebarExpanded(true);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <SirketProvider>
      <div className="flex h-screen bg-gray-50 w-full max-w-full overflow-hidden">
        <Sidebar 
          isExpanded={isSidebarExpanded} 
          toggleSidebar={() => setSidebarExpanded(p => !p)} 
        />
        <MobileSidebar 
          isOpen={isMobileMenuOpen} 
          setIsOpen={setMobileMenuOpen} 
        />
        
        <div className="flex flex-col flex-1 min-h-0 w-full max-w-full">
          <Header onMenuClick={() => setMobileMenuOpen(true)} />
          <main className="flex-1 p-3 lg:p-6 overflow-y-auto overflow-x-hidden w-full max-w-full">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Outlet />
            </motion.div>
          </main>
        </div>
      </div>
    </SirketProvider>
  );
};