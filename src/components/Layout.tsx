import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BildirimMenusu } from './BildirimMenusu';
import { Menu, X, Settings, Home, AlertTriangle, FileText, Users, Box, BarChart2, Sun, Activity, PieChart, DollarSign, HardDrive, Calendar, Zap, Shield, ChevronDown, LogOut, ChevronUp } from 'lucide-react';
import { OfflineIndicator } from './OfflineIndicator';

export const Layout = ({ children }) => {
  const { kullanici, cikisYap } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [gesMenuOpen, setGesMenuOpen] = useState(false);
  const [bakimMenuOpen, setBakimMenuOpen] = useState(false);
  const [raporMenuOpen, setRaporMenuOpen] = useState(false);
  const [yonetimMenuOpen, setYonetimMenuOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (!kullanici) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="container mx-auto py-8 px-4">
          {children}
        </div>
      </div>
    );
  }

  // Menü öğelerini rol bazlı filtrele
  const menuItemsForRole = () => {
    const baseItems = [
      { to: '/', icon: <Home size={20} />, text: 'Anasayfa' },
      { to: '/arizalar', icon: <AlertTriangle size={20} />, text: 'Arızalar' },
    ];

    // GES alt menü öğeleri
    const gesSubMenu = [
      { to: '/ges-yonetimi', icon: <Sun size={20} />, text: 'Saha Yönetimi' },
      { to: '/uretim-verileri', icon: <Activity size={20} />, text: 'Üretim Verileri' },
      { to: '/akilli-bakim', icon: <Shield size={20} />, text: 'Akıllı Bakım Asistanı' },
      { to: '/finansal-analiz', icon: <DollarSign size={20} />, text: 'Finansal Analiz' },
    ];

    // Bakım alt menü öğeleri
    const bakimSubMenu = [
      { to: '/mekanik-bakim', icon: <HardDrive size={20} />, text: 'Mekanik Bakım' },
      { to: '/elektrik-bakim', icon: <Zap size={20} />, text: 'Elektrik Bakım' },
      { to: '/invertor-kontrol', icon: <Activity size={20} />, text: 'İnvertör Kontrol' },
      { to: '/elektrik-kesintileri', icon: <Zap size={20} />, text: 'Elektrik Kesintileri' },
    ];

    // Rapor alt menü öğeleri
    const raporSubMenu = [
      { to: '/yapilan-isler', icon: <FileText size={20} />, text: 'Yapılan İşler' },
      { to: '/aylik-kapsamli-rapor', icon: <PieChart size={20} />, text: 'Aylık Kapsamlı Rapor' },
    ];

    // Yönetim alt menü öğeleri
    const yonetimSubMenu = [];

    if (kullanici.rol === 'yonetici' || kullanici.rol === 'admin' || kullanici.rol === 'superadmin') {
      yonetimSubMenu.push({ to: '/ekip', icon: <Users size={20} />, text: 'Ekip Yönetimi' });
      yonetimSubMenu.push({ to: '/stok-kontrol', icon: <Box size={20} />, text: 'Stok Kontrol' });
    }

    if (kullanici.rol === 'yonetici' || kullanici.rol === 'admin') {
      yonetimSubMenu.push({ to: '/musteriler', icon: <Users size={20} />, text: 'Müşteriler' });
    }

    if (kullanici.rol === 'admin' || kullanici.rol === 'superadmin') {
      yonetimSubMenu.push({ to: '/ayarlar', icon: <Settings size={20} />, text: 'Ayarlar' });
    }

    // Menü öğelerini rol bazlı oluştur
    let items = [...baseItems];

    // Tüm roller GES ve Bakım menülerini görebilir
    items.push({
      type: 'submenu',
      icon: <Sun size={20} />,
      text: 'GES Yönetimi',
      isOpen: gesMenuOpen,
      toggle: () => setGesMenuOpen(!gesMenuOpen),
      items: gesSubMenu
    });

    items.push({
      type: 'submenu',
      icon: <Calendar size={20} />,
      text: 'Bakım Takibi',
      isOpen: bakimMenuOpen,
      toggle: () => setBakimMenuOpen(!bakimMenuOpen),
      items: bakimSubMenu
    });

    // Raporlar alt menüsü
    items.push({
      type: 'submenu',
      icon: <BarChart2 size={20} />,
      text: 'Raporlar',
      isOpen: raporMenuOpen,
      toggle: () => setRaporMenuOpen(!raporMenuOpen),
      items: raporSubMenu
    });

    // Yönetim menüsünü sadece yönetici, admin ve superadmin görebilir
    if (yonetimSubMenu.length > 0) {
      items.push({
        type: 'submenu',
        icon: <Settings size={20} />,
        text: 'Yönetim',
        isOpen: yonetimMenuOpen,
        toggle: () => setYonetimMenuOpen(!yonetimMenuOpen),
        items: yonetimSubMenu
      });
    }

    return items;
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Üst menü */}
      <header className="bg-white shadow-sm z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-md text-gray-500 lg:hidden"
              >
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <div className="flex-shrink-0 flex items-center">
                <img
                  className="h-8 w-auto"
                  src="/solar-logo.png"
                  alt="Logo"
                />
                <span className="ml-2 text-lg font-semibold text-gray-900">Solar PV</span>
              </div>
            </div>
            <div className="flex items-center">
              <OfflineIndicator />
              <BildirimMenusu />
              <div className="ml-3 relative">
                <div className="flex items-center">
                  <span className="hidden md:block mr-3 text-sm font-medium text-gray-700">{kullanici.ad}</span>
                  <button
                    onClick={() => {
                      cikisYap();
                      navigate('/login');
                    }}
                    className="p-2 text-gray-500 hover:text-gray-700"
                    title="Çıkış Yap"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Kenar çubuğu */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed inset-0 lg:relative lg:translate-x-0 z-10 w-64 bg-white shadow-md transition-transform duration-300 ease-in-out lg:flex`}
        >
          <div className="h-full overflow-y-auto pt-5 pb-4">
            <nav className="mt-5 px-2 space-y-1">
              {menuItemsForRole().map((item, index) => {
                if (item.type === 'submenu') {
                  return (
                    <div key={index} className="mb-2">
                      <button
                        onClick={item.toggle}
                        className="w-full flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md"
                      >
                        <span className="mr-3">{item.icon}</span>
                        {item.text}
                        <span className="ml-auto">
                          {item.isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </span>
                      </button>
                      {item.isOpen && (
                        <div className="mt-1 pl-10 space-y-1">
                          {item.items.map((subItem, subIndex) => (
                            <NavLink
                              key={subIndex}
                              to={subItem.to}
                              className={({ isActive }) =>
                                `flex items-center px-4 py-2 text-sm font-medium ${
                                  isActive
                                    ? 'text-primary-600 bg-primary-50'
                                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                } rounded-md`
                              }
                            >
                              <span className="mr-3">{subItem.icon}</span>
                              {subItem.text}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                } else {
                  return (
                    <NavLink
                      key={index}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center px-4 py-2 text-sm font-medium ${
                          isActive
                            ? 'text-primary-600 bg-primary-50'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        } rounded-md`
                      }
                    >
                      <span className="mr-3">{item.icon}</span>
                      {item.text}
                    </NavLink>
                  );
                }
              })}
            </nav>
          </div>
        </aside>

        {/* Ana içerik */}
        <main className="flex-1 overflow-y-auto">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};