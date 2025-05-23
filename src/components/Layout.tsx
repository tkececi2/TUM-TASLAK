import React, { useState, useEffect, useContext, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { BildirimMenusu } from './BildirimMenusu';
import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Users,
  BarChart2,
  TrendingUp,
  FileText,
  Settings,
  LogOut,
  Sun,
  Building,
  Menu,
  X,
  Shield,
  Wrench,
  Zap,
  Activity,
  ClipboardList,
  Package,
  ChevronDown,
  ChevronRight,
  Home,
  Gauge,
  Bolt,
  Lightbulb,
  PanelTop,
  ChevronLeft,
  FileBarChart,
  BrainCircuit
} from 'lucide-react';

// Şirket bilgileri için context
interface SirketBilgileri {
  sirketAdi: string;
  slogan: string;
  logoURL: string;
}

const SirketContext = React.createContext<SirketBilgileri>({
  sirketAdi: 'Solar Takip',
  slogan: 'Güneş Enerjisi Yönetimi',
  logoURL: '/solar-logo.png'
});

export const useSirketBilgileri = () => useContext(SirketContext);

export const SirketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { kullanici } = useAuth();
  const { currentCompany } = useCompany();
  const [sirketBilgileri, setSirketBilgileri] = useState<SirketBilgileri>({
    sirketAdi: 'Solar Takip',
    slogan: 'Güneş Enerjisi Yönetimi',
    logoURL: '/solar-logo.png'
  });
  const lastFetchTime = useRef<number>(0);

  useEffect(() => {
    const sirketBilgileriniGetir = async () => {
      // Only attempt to fetch if user is authenticated
      if (!kullanici) return;
      
      // Prevent fetching too frequently (at most once every 5 seconds)
      const now = Date.now();
      if (now - lastFetchTime.current < 5000) return;
      
      lastFetchTime.current = now;
      
      try {
        // If we have company data from context, use it
        if (currentCompany) {
          // Add a cache-busting parameter to the logo URL to prevent caching
          const logoURL = currentCompany.logo ? `${currentCompany.logo}?t=${now}` : '/solar-logo.png';
          
          setSirketBilgileri({
            sirketAdi: currentCompany.name || 'Solar Takip',
            slogan: currentCompany.slogan || 'Güneş Enerjisi Yönetimi',
            logoURL: logoURL
          });
          return;
        }
        
        // Fallback to ayarlar/sirket if needed
        const sirketDoc = await getDoc(doc(db, 'ayarlar', 'sirket'));
        if (sirketDoc.exists()) {
          const data = sirketDoc.data();
          // Add a cache-busting parameter to the logo URL to prevent caching
          const logoURL = data.logoURL ? `${data.logoURL}?t=${now}` : '/solar-logo.png';
          
          setSirketBilgileri({
            sirketAdi: data.sirketAdi || 'Solar Takip',
            slogan: data.slogan || 'Güneş Enerjisi Yönetimi',
            logoURL: logoURL
          });
        }
      } catch (error) {
        console.error('Şirket bilgileri getirilemedi:', error);
        // Keep default values on error
      }
    };

    sirketBilgileriniGetir();
    
    // Set up an interval to refresh company info every 30 seconds
    const intervalId = setInterval(sirketBilgileriniGetir, 30000);
    
    return () => clearInterval(intervalId);
  }, [kullanici, currentCompany]); // Add kullanici as dependency to re-fetch when auth state changes

  return (
    <SirketContext.Provider value={sirketBilgileri}>
      {children}
    </SirketContext.Provider>
  );
};

export const Layout: React.FC = () => {
  const { kullanici, cikisYap } = useAuth();
  const { currentCompany } = useCompany();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuAcik, setMenuAcik] = useState(true);
  const [mobileMenuAcik, setMobileMenuAcik] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [pageTitle, setPageTitle] = useState('Ana Sayfa');
  const sirketBilgileri = useSirketBilgileri();

  useEffect(() => {
    // Check screen size and set menu state accordingly
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setMenuAcik(false);
      } else {
        setMenuAcik(true);
      }
    };

    // Initial check
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setMobileMenuAcik(false);
    setProfileMenuOpen(false);
    
    // Set page title based on current path
    const currentPath = location.pathname.split('/')[1];
    if (currentPath) {
      const navItem = navigation.find(item => 
        item.href === `/${currentPath}` || 
        (item.children && item.children.some(child => child.href === `/${currentPath}`))
      );
      
      if (navItem) {
        if (navItem.href) {
          setPageTitle(navItem.name);
        } else if (navItem.children) {
          const childItem = navItem.children.find(child => child.href === `/${currentPath}`);
          if (childItem) {
            setPageTitle(childItem.name);
          }
        }
      }
    } else {
      setPageTitle('Ana Sayfa');
    }
  }, [location.pathname]);

  useEffect(() => {
    if (mobileMenuAcik) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('menu-open');
    } else {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('menu-open');
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('menu-open');
    };
  }, [mobileMenuAcik]);

  const handleCikis = async () => {
    try {
      await cikisYap();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Çıkış yapılırken hata:', error);
    }
  };

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }));
  };

  const isMenuActive = (item: any) => {
    if (item.href) {
      return location.pathname === item.href;
    }
    if (item.children) {
      return item.children.some((child: any) => location.pathname === child.href);
    }
    return false;
  };

  // Define navigation items based on user role
  let navigation = [];
  
  // Basic navigation for all users
  const baseNavigation = [
    { name: 'Anasayfa', href: '/anasayfa', icon: Home },
  ];
  
  // Navigation for bekci role
  const bekciNavigation = [
    ...baseNavigation,
    { name: 'Nöbet Kontrol', href: '/nobet-kontrol', icon: Shield }
  ];
  
  // Navigation for regular users (tekniker, muhendis, yonetici, musteri)
  const regularNavigation = [
    ...baseNavigation,
    { name: 'Arızalar', href: '/arizalar', icon: AlertTriangle },
    { name: 'Stok Kontrol', href: '/stok-kontrol', icon: Package },
    {
      name: 'GES Yönetimi',
      icon: Sun,
      children: [
        { name: 'Santral Yönetimi', href: '/ges-yonetimi', icon: Lightbulb },
        { name: 'Üretim Verileri', href: '/uretim-verileri', icon: Gauge }
      ]
    },
    {
      name: 'Bakım & Kontrol',
      icon: ClipboardList,
      children: [
        { name: 'Yapılan İşler', href: '/yapilan-isler', icon: Wrench },
        { name: 'Elektrik Kesintileri', href: '/elektrik-kesintileri', icon: Bolt },
        { name: 'İnvertör Kontrolleri', href: '/invertor-kontrol', icon: Activity },
        { name: 'Mekanik Bakım', href: '/mekanik-bakim', icon: PanelTop },
        { name: 'Elektrik Bakım', href: '/elektrik-bakim', icon: Zap },
      ]
    },
    { name: 'Sahalar', href: '/sahalar', icon: Building },
    { name: 'İstatistikler', href: '/istatistikler', icon: BarChart2 },
  ];
  
  // Additional items for non-customer roles
  const nonCustomerItems = [
    { name: 'Performans', href: '/performans', icon: TrendingUp }
  ];
  
  // Additional items for managers and engineers
  const managerEngineerItems = [
    { name: 'Aylık Kapsamlı Rapor', href: '/aylik-kapsamli-rapor', icon: FileBarChart }
  ];
  
  // Additional items for managers
  const managerItems = [
    { name: 'Müşteriler', href: '/musteriler', icon: Users },
    { name: 'Ekip', href: '/ekip', icon: Users },
    { name: 'Şirket Ayarları', href: '/company-settings', icon: Building },
  ];
  
  // Additional items for superadmin
  const superadminItems = [
    { name: 'Admin Paneli', href: '/admin', icon: Shield },
  ];
  
  // Determine navigation based on role
  if (kullanici?.rol === 'bekci') {
    navigation = bekciNavigation;
  } else {
    navigation = [...regularNavigation];
    
    // Add role-specific items
    if (kullanici?.rol !== 'musteri') {
      navigation.push(...nonCustomerItems);
    }
    
    if (kullanici?.rol === 'yonetici' || kullanici?.rol === 'muhendis') {
      navigation.push(...managerEngineerItems);
    }
    
    if (kullanici?.rol === 'yonetici') {
      navigation.push(...managerItems);
    }
    
    if (kullanici?.rol === 'superadmin') {
      navigation.push(...superadminItems);
    }
  }
  
  // Add settings to all navigations
  navigation.push({ name: 'Ayarlar', href: '/ayarlar', icon: Settings });

  return (
    <SirketProvider>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar - Fixed Left */}
        <div 
          className={`fixed inset-y-0 left-0 z-50 bg-[#0a2351] transition-all duration-300 ease-in-out ${
            menuAcik ? 'w-64' : 'w-20'
          } lg:translate-x-0 lg:static`}
        >
          {/* Logo and Brand */}
          <div className="h-16 flex items-center px-4 bg-[#071a3e] text-white">
            <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center overflow-hidden mr-3 flex-shrink-0">
              <img 
                src={sirketBilgileri.logoURL} 
                alt="Logo" 
                className="h-full w-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/solar-logo.png';
                }}
              />
            </div>
            {menuAcik && (
              <div>
                <h1 className="text-lg font-bold">{sirketBilgileri.sirketAdi}</h1>
                <p className="text-xs text-gray-300">{sirketBilgileri.slogan}</p>
              </div>
            )}
          </div>

          {/* Toggle Button */}
          <button 
            onClick={() => setMenuAcik(!menuAcik)}
            className="absolute right-0 top-16 -mr-3 p-1.5 rounded-full bg-white shadow-md text-gray-500 hover:text-gray-700"
          >
            {menuAcik ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {/* Navigation Menu */}
          <div className="mt-2 px-3 py-2 h-[calc(100%-4rem-2rem)] overflow-y-auto">
            <div className="space-y-1">
              {navigation.map(item => {
                if (item.children) {
                  const isActive = item.children.some(child => child.href === location.pathname);
                  const isExpanded = expandedMenus[item.name] || isActive;
                  
                  return (
                    <div key={item.name} className="mb-1">
                      <button
                        onClick={() => toggleMenu(item.name)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md ${
                          isActive ? 'bg-[#1a3a6c] text-white' : 'text-gray-300 hover:bg-[#1a3a6c] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center">
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          {menuAcik && <span className="ml-3">{item.name}</span>}
                        </div>
                        {menuAcik && (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )
                        )}
                      </button>
                      
                      <div className={`mt-1 space-y-1 ${isExpanded ? 'block' : 'hidden'}`}>
                        {item.children.map(child => (
                          <Link
                            key={child.name}
                            to={child.href}
                            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                              location.pathname === child.href
                                ? 'bg-[#1a3a6c] text-white'
                                : 'text-gray-300 hover:bg-[#1a3a6c] hover:text-white'
                            } ${menuAcik ? 'pl-10' : 'justify-center'}`}
                          >
                            <child.icon className="h-4 w-4 flex-shrink-0" />
                            {menuAcik && <span className="ml-2">{child.name}</span>}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                }
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      location.pathname === item.href
                        ? 'bg-[#1a3a6c] text-white'
                        : 'text-gray-300 hover:bg-[#1a3a6c] hover:text-white'
                    } ${!menuAcik && 'justify-center'}`}
                    title={!menuAcik ? item.name : undefined}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {menuAcik && <span className="ml-3">{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Bottom Section */}
          <div className="absolute bottom-0 w-full p-4 bg-[#071a3e]">
            <button
              onClick={handleCikis}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-300 hover:bg-[#1a3a6c] hover:text-white ${!menuAcik && 'justify-center'}`}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {menuAcik && <span className="ml-3">Çıkış Yap</span>}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Navigation Bar */}
          <header className="bg-white shadow-sm h-16 flex items-center px-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuAcik(!mobileMenuAcik)}
              className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none"
            >
              <Menu className="h-6 w-6" />
            </button>
            
            <div className="flex-1 flex justify-between items-center">
              <div className="ml-4 lg:ml-0">
                <h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>
              </div>
              
              <div className="flex items-center space-x-4">
                <BildirimMenusu />
                
                {/* User Profile */}
                <div className="relative">
                  <button
                    onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                    className="flex items-center space-x-2 p-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <img
                      className="h-8 w-8 rounded-full object-cover border-2 border-primary-200"
                      src={kullanici?.fotoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(kullanici?.ad || '')}&background=random`}
                      alt={kullanici?.ad}
                    />
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-medium text-gray-700">{kullanici?.ad}</p>
                      <p className="text-xs text-gray-500 capitalize">{kullanici?.rol}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>
                  
                  {/* Dropdown Menu */}
                  {profileMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5 animate-fade-in">
                      <div className="px-4 py-2 border-b border-gray-100 md:hidden">
                        <p className="text-sm font-medium text-gray-900">{kullanici?.ad}</p>
                        <p className="text-xs text-gray-500 capitalize">{kullanici?.rol}</p>
                      </div>
                      {kullanici?.rol === 'yonetici' && (
                        <Link
                          to="/company-settings"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setProfileMenuOpen(false)}
                        >
                          <Building className="inline-block h-4 w-4 mr-2" />
                          Şirket Ayarları
                        </Link>
                      )}
                      <Link
                        to="/ayarlar"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        <Settings className="inline-block h-4 w-4 mr-2" />
                        Ayarlar
                      </Link>
                      <button
                        onClick={handleCikis}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <LogOut className="inline-block h-4 w-4 mr-2" />
                        Çıkış Yap
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className={`flex-1 overflow-auto bg-gray-50 p-6 transition-all duration-300`}>
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuAcik && (
          <>
            <div 
              className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 lg:hidden"
              onClick={() => setMobileMenuAcik(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-[85%] max-w-[300px] bg-[#0a2351] lg:hidden overflow-auto">
              <div className="h-16 flex items-center px-4 bg-[#071a3e] text-white">
                <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center overflow-hidden mr-3">
                  <img 
                    src={sirketBilgileri.logoURL} 
                    alt="Logo" 
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/solar-logo.png';
                    }}
                  />
                </div>
                <div>
                  <h1 className="text-lg font-bold">{sirketBilgileri.sirketAdi}</h1>
                  <p className="text-xs text-gray-300">{sirketBilgileri.slogan}</p>
                </div>
                <button
                  onClick={() => setMobileMenuAcik(false)}
                  className="ml-auto p-2 text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="mt-2 px-3 py-2 h-[calc(100vh-4rem)] overflow-y-auto pb-20">
                <div className="space-y-1">
                  {navigation.map(item => {
                    if (item.children) {
                      const isActive = item.children.some(child => child.href === location.pathname);
                      const isExpanded = expandedMenus[item.name] || isActive;
                      
                      return (
                        <div key={item.name} className="mb-1">
                          <button
                            onClick={() => toggleMenu(item.name)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md ${
                              isActive ? 'bg-[#1a3a6c] text-white' : 'text-gray-300 hover:bg-[#1a3a6c] hover:text-white'
                            }`}
                          >
                            <div className="flex items-center">
                              <item.icon className="h-5 w-5 mr-3" />
                              <span>{item.name}</span>
                            </div>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          
                          <div className={`mt-1 space-y-1 ${isExpanded ? 'block' : 'hidden'}`}>
                            {item.children.map(child => (
                              <Link
                                key={child.name}
                                to={child.href}
                                className={`pl-10 pr-3 py-2 text-sm font-medium rounded-md flex items-center ${
                                  location.pathname === child.href
                                    ? 'bg-[#1a3a6c] text-white'
                                    : 'text-gray-300 hover:bg-[#1a3a6c] hover:text-white'
                                }`}
                                onClick={() => setMobileMenuAcik(false)}
                              >
                                <child.icon className="h-4 w-4 mr-2" />
                                {child.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                          location.pathname === item.href
                            ? 'bg-[#1a3a6c] text-white'
                            : 'text-gray-300 hover:bg-[#1a3a6c] hover:text-white'
                        }`}
                        onClick={() => setMobileMenuAcik(false)}
                      >
                        <item.icon className="h-5 w-5 mr-3" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </SirketProvider>
  );
};