import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSirketBilgileri } from './Layout';
import { useMenuNotifications } from '../contexts/MenuNotificationContext';
import { 
  Home, AlertTriangle, Sun, FileBarChart, Building, Users, Package, 
  BarChart2, TrendingUp, Settings, LogOut, X, LucideIcon,
  LayoutDashboard, Shield, Wrench, Zap, Activity, ClipboardList, ChevronDown, 
  ChevronRight, Gauge, Bolt, Lightbulb, PanelTop, BrainCircuit, Briefcase, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Kullanici } from '../types';

interface NavItemStructure {
  name: string;
  href?: string;
  icon: LucideIcon;
  children?: NavItemStructure[];
  roles?: string[];
}

const MobileNavLink = ({ item, onClick, isActive, notificationCount }: { 
  item: NavItemStructure; 
  onClick: () => void; 
  isActive: boolean;
  notificationCount?: number;
}) => (
  <Link
    to={item.href!}
    onClick={onClick}
    className={`flex items-center p-3 my-0.5 rounded-md text-base transition-colors duration-150 ease-in-out relative ${
      isActive ? 'bg-sky-600 text-white shadow-sm' : 'text-sky-100 hover:bg-sky-700 hover:text-white'
    }`}
  >
    <item.icon className="h-5 w-5 mr-3 flex-shrink-0" strokeWidth={1.5} />
    <span className="font-medium truncate flex-1">{item.name}</span>
    {notificationCount && notificationCount > 0 && (
      <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
        {notificationCount > 99 ? '99+' : notificationCount}
      </span>
    )}
  </Link>
);

const MobileNavParent = ({ item, onClick, userRole, getNotificationCount }: 
  { item: NavItemStructure; onClick: () => void; userRole: string | undefined; getNotificationCount?: (href: string) => number | undefined }
) => {
  const location = useLocation();
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);

  const isActiveParent = item.children?.some(child => 
    (!child.roles || child.roles.includes(userRole || '')) &&
    (location.pathname === child.href || location.pathname.startsWith(child.href + '/'))
  );

  const visibleChildren = item.children?.filter(child => !child.roles || child.roles.includes(userRole || ''));

  if (!visibleChildren || visibleChildren.length === 0) return null;

  // Eğer aktif bir çocuk varsa, başlangıçta alt menüyü açık yap
  useEffect(() => {
    if (isActiveParent) {
      setIsSubmenuOpen(true);
    }
  }, [isActiveParent]);

  return (
    <div className="my-0.5">
      <button
        onClick={() => setIsSubmenuOpen(!isSubmenuOpen)}
        className={`flex items-center justify-between w-full p-3 rounded-md text-base transition-colors duration-150 ease-in-out ${
          isActiveParent ? 'bg-sky-600 text-white shadow-sm' : 'text-sky-100 hover:bg-sky-700 hover:text-white'
        }`}
      >
        <div className="flex items-center">
          <item.icon className="h-5 w-5 mr-3 flex-shrink-0" strokeWidth={1.5} />
          <span className="font-medium truncate">{item.name}</span>
        </div>
        {isSubmenuOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
      </button>
      <AnimatePresence>
        {isSubmenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="ml-4 mt-0.5 pl-3 border-l-2 border-sky-500"
          >
            {visibleChildren.map(child => (
              <MobileNavLink 
                key={child.name} 
                item={child} 
                onClick={onClick} // Close main menu on child click
                isActive={location.pathname === child.href || location.pathname.startsWith(child.href + '/')}
                notificationCount={getNotificationCount && child.href ? getNotificationCount(child.href) : undefined}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface MobileSidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const MobileSidebar = ({ isOpen, setIsOpen }: MobileSidebarProps) => {
  const { kullanici, cikisYap } = useAuth();
  const sirketBilgileri = useSirketBilgileri();
  const { counts } = useMenuNotifications();
  const user = kullanici as Kullanici | null;
  const location = useLocation();
  const navigate = useNavigate();

  const getNotificationCount = (href: string): number | undefined => {
    switch (href) {
      case '/arizalar':
        const arizalar = counts.arizalar || 0;
        return arizalar > 0 ? arizalar : undefined;
      case '/yapilan-isler':
        const yapilanIsler = counts.yapilanIsler || 0;
        return yapilanIsler > 0 ? yapilanIsler : undefined;
      case '/vardiya-bildirimleri':
        const vardiyaBildirimleri = counts.vardiyaBildirimleri || 0;
        return vardiyaBildirimleri > 0 ? vardiyaBildirimleri : undefined;
      case '/elektrik-bakim':
        const elektrikBakim = counts.elektrikBakim || 0;
        return elektrikBakim > 0 ? elektrikBakim : undefined;
      case '/mekanik-bakim':
        const mekanikBakim = counts.mekanikBakim || 0;
        return mekanikBakim > 0 ? mekanikBakim : undefined;
      case '/invertor-kontrol':
        const invertorKontrol = counts.invertorKontrol || 0;
        return invertorKontrol > 0 ? invertorKontrol : undefined;
      case '/elektrik-kesintileri':
        const elektrikKesintileri = counts.elektrikKesintileri || 0;
        return elektrikKesintileri > 0 ? elektrikKesintileri : undefined;
      default:
        return undefined;
    }
  };
  
  const allNavigationItems: NavItemStructure[] = [
    { name: 'Ana Sayfa', href: '/anasayfa', icon: Home },
    { name: 'Arızalar', href: '/arizalar', icon: AlertTriangle, roles: ['yonetici', 'muhendis', 'tekniker', 'musteri'] },
    {
      name: 'GES Yönetimi',
      icon: Sun,
      roles: ['yonetici', 'muhendis', 'tekniker', 'musteri'],
      children: [
        { name: 'Santral Yönetimi', href: '/ges-yonetimi', icon: Lightbulb, roles: ['yonetici', 'muhendis', 'tekniker'] },
        { name: 'Üretim Verileri', href: '/uretim-verileri', icon: Gauge, roles: ['yonetici', 'muhendis', 'tekniker', 'musteri'] },
      ]
    },
    {
      name: 'Bakım & Kontrol',
      icon: ClipboardList,
      roles: ['yonetici', 'muhendis', 'tekniker'],
      children: [
        { name: 'Yapılan İşler', href: '/yapilan-isler', icon: Wrench },
        { name: 'Elektrik Kesintileri', href: '/elektrik-kesintileri', icon: Bolt },
        { name: 'İnvertör Kontrolleri', href: '/invertor-kontrol', icon: Activity },
        { name: 'Mekanik Bakım', href: '/mekanik-bakim', icon: PanelTop },
        { name: 'Elektrik Bakım', href: '/elektrik-bakim', icon: Zap },
      ]
    },

    { name: 'Sahalar/Müşteriler', href: '/sahalar', icon: Building, roles: ['yonetici', 'muhendis', 'tekniker', 'musteri'] },
    { name: 'Ekip Yönetimi', href: '/ekip', icon: Users, roles: ['yonetici'] },
    { name: 'Stok Kontrol', href: '/stok-kontrol', icon: Package, roles: ['yonetici', 'muhendis', 'tekniker'] },


    { name: 'Vardiya Bildirimleri', href: '/vardiya-bildirimleri', icon: Clock, roles: ['yonetici', 'muhendis', 'tekniker', 'musteri', 'bekci'] },
    { name: 'Nöbet Kontrol', href: '/nobet-kontrol', icon: Shield, roles: ['bekci'] },
    { name: 'Şirket Ayarları', href: '/company-settings', icon: Briefcase, roles: ['yonetici'] },
    { name: 'Admin Paneli', href: '/admin', icon: BrainCircuit, roles: ['superadmin'] },
    { name: 'Kullanıcı Ayarları', href: '/ayarlar', icon: Settings },
  ];

  const visibleNavigation = allNavigationItems.filter(item => 
    !item.roles || item.roles.includes(user?.rol || '')
  ).map(item => {
    if (item.children) {
      return {
        ...item,
        children: item.children.filter(child => !child.roles || child.roles.includes(user?.rol || ''))
      };
    }
    return item;
  }).filter(item => !item.children || item.children.length > 0);

  const handleCloseMenu = () => setIsOpen(false);

  const handleLogoutAndClose = async () => {
    await cikisYap();
    handleCloseMenu();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }} // More opaque backdrop
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={handleCloseMenu}
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 35, mass: 0.8 }}
            className="fixed top-0 left-0 h-full w-[calc(100%-3rem)] max-w-sm bg-sky-800 text-white z-50 flex flex-col shadow-2xl lg:hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-sky-700 h-[65px]">
              <div className="flex items-center min-w-0 flex-1">
                <img 
                  src={sirketBilgileri.logoURL} 
                  alt="SolarVeyo Logo" 
                  className="h-8 w-8 object-contain mr-2.5 flex-shrink-0 rounded" 
                  onError={(e) => {
                    e.currentTarget.src = '/solarveyo-logo.png';
                  }}
                />
                <span className="font-semibold text-lg truncate">SolarVeyo</span>
              </div>
              <button onClick={handleCloseMenu} className="p-1.5 rounded-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500">
                <X size={22} className="text-sky-200 hover:text-white"/>
              </button>
            </div>
            
            <nav className="flex-1 p-2.5 overflow-y-auto scrollbar-thin scrollbar-thumb-sky-600 scrollbar-track-sky-700">
              {visibleNavigation.map(item => 
                 item.children && item.children.length > 0 ? (
                    <MobileNavParent 
                        key={item.name} 
                        item={item} 
                        onClick={handleCloseMenu} 
                        userRole={user?.rol}
                        getNotificationCount={getNotificationCount}
                    />
                 ) : (
                    <MobileNavLink 
                        key={item.name} 
                        item={item} 
                        onClick={handleCloseMenu} 
                        isActive={location.pathname === item.href || (item.href ? location.pathname.startsWith(item.href + '/') : false)}
                        notificationCount={item.href ? getNotificationCount(item.href) : undefined}
                    />
                 )
              )}
            </nav>

            <div className="p-3 border-t border-sky-700">
               <div className="flex items-center mb-3 p-2 rounded-md bg-sky-700/50">
                  <img
                    src={user?.fotoURL || `https://ui-avatars.com/api/?name=${user?.ad || user?.email}&background=E0F2FE&color=0C4A6E`}
                    alt="Profil"
                    className="w-10 h-10 rounded-full border-2 border-sky-400 flex-shrink-0"
                  />
                  <div className="ml-2.5 overflow-hidden">
                    <p className="font-semibold text-sm text-sky-50 truncate">{user?.ad || 'Kullanıcı'}</p>
                    <p className="text-xs text-sky-200 capitalize truncate">{user?.rol || 'Rol Belirtilmemiş'}</p>
                  </div>
                </div>
              <button
                onClick={handleLogoutAndClose}
                className="w-full flex items-center p-3 rounded-md transition-colors duration-150 text-rose-300 bg-rose-500/20 hover:bg-rose-500 hover:text-white justify-center"
              >
                <LogOut className="h-5 w-5 mr-2.5" />
                <span className="font-medium text-sm">Çıkış Yap</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}; 