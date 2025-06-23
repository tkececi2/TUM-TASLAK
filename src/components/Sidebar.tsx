import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSirketBilgileri } from './Layout'; // Ensure this path is correct
import { useMenuNotifications } from '../contexts/MenuNotificationContext';
import { 
  LayoutDashboard, AlertTriangle, Users, BarChart2, TrendingUp, FileText, 
  Settings, LogOut, Sun, Building, Shield, Wrench, Zap, Activity, 
  ClipboardList, Package, ChevronDown, ChevronRight, Home, Gauge, Bolt, Lightbulb, 
  PanelTop, FileBarChart, BrainCircuit, LucideIcon,
  Briefcase,
  ChevronLeft,
  UserPlus,
  Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Kullanici } from '../types';

interface NavItemStructure {
  name: string;
  href?: string;
  icon: LucideIcon;
  children?: NavItemStructure[];
  roles?: string[]; // Hangi rollerin görebileceği
}

const NavLink = ({ item, isExpanded, isActive, onClick, notificationCount }: { 
  item: NavItemStructure, 
  isExpanded: boolean, 
  isActive: boolean, 
  onClick?: () => void,
  notificationCount?: number
}) => (
  <Link
    to={item.href!}
    onClick={onClick}
    className={`flex items-center p-3 my-0.5 rounded-md transition-colors duration-150 ease-in-out relative ${
      isActive
        ? 'bg-sky-600 text-white shadow-sm'
        : 'text-sky-100 hover:bg-sky-700 hover:text-white'
    } ${isExpanded ? 'justify-start' : 'justify-center'}`}
    title={!isExpanded ? item.name : undefined}
  >
    <item.icon className={`h-5 w-5 flex-shrink-0 ${isExpanded ? 'mr-3' : ''}`} strokeWidth={1.5} />
    {isExpanded && (
      <motion.span
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        className="font-medium text-sm truncate flex-1"
      >
        {item.name}
      </motion.span>
    )}
    {notificationCount && notificationCount > 0 && (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={`${isExpanded ? 'ml-2' : 'absolute -top-1 -right-1'} bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1`}
      >
        {notificationCount > 99 ? '99+' : notificationCount}
      </motion.span>
    )}
  </Link>
);

const NavParent = ({ item, isExpanded, toggleSubmenu, isSubmenuOpen, location, userRole, getNotificationCount }: 
  { item: NavItemStructure, isExpanded: boolean, toggleSubmenu: () => void, isSubmenuOpen: boolean, location: any, userRole: string | undefined, getNotificationCount?: (href: string) => number | undefined }
) => {
  const isActive = item.children?.some(child => 
    (!child.roles || child.roles.includes(userRole || '')) &&
    (location.pathname === child.href || location.pathname.startsWith(child.href + '/'))
  );

  const visibleChildren = item.children?.filter(child => !child.roles || child.roles.includes(userRole || ''));

  if (!visibleChildren || visibleChildren.length === 0) return null;

  return (
    <div className="my-0.5">
      <button
        onClick={toggleSubmenu}
        className={`flex items-center justify-between w-full p-3 rounded-md transition-colors duration-150 ease-in-out ${
          isActive
            ? 'bg-sky-600 text-white shadow-sm'
            : 'text-sky-100 hover:bg-sky-700 hover:text-white'
        } ${isExpanded ? 'justify-between' : 'justify-center'}`}
        title={!isExpanded ? item.name : undefined}
      >
        <div className="flex items-center">
          <item.icon className={`h-5 w-5 flex-shrink-0 ${isExpanded ? 'mr-3' : ''}`} strokeWidth={1.5} />
          {isExpanded && <span className="font-medium text-sm truncate">{item.name}</span>}
        </div>
        {isExpanded && (isSubmenuOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />)}
      </button>
      {isSubmenuOpen && isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className={`ml-3 mt-0.5 pl-3 border-l-2 ${isActive ? 'border-sky-400' : 'border-sky-600'}`}
        >
          {visibleChildren.map(child => (
            <NavLink 
              key={child.name} 
              item={child} 
              isExpanded={isExpanded} 
              isActive={location.pathname === child.href || location.pathname.startsWith(child.href + '/')}
              notificationCount={getNotificationCount && child.href ? getNotificationCount(child.href) : undefined}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
};

interface SidebarProps {
  isExpanded: boolean;
  toggleSidebar: () => void;
}

export const Sidebar = ({ isExpanded, toggleSidebar }: SidebarProps) => {
  const { kullanici, cikisYap } = useAuth();
  const sirketBilgileri = useSirketBilgileri();
  const { counts } = useMenuNotifications();
  const location = useLocation();
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  const user = kullanici as Kullanici | null;

  const toggleSubmenu = (itemName: string) => {
    setOpenSubmenus(prev => ({ ...prev, [itemName]: !prev[itemName] }));
  };

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
        return undefined; // Bu sayfalar için bildirim sistemi yok
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
        { name: 'Santral Yönetimi', href: '/ges-yonetimi', icon: Lightbulb, roles: ['yonetici', 'muhendis', 'tekniker', 'musteri'] },
        { name: 'Üretim Verileri', href: '/uretim-verileri', icon: Gauge, roles: ['yonetici', 'muhendis', 'tekniker', 'musteri'] },
      ]
    },
    {
      name: 'Bakım & Kontrol',
      icon: ClipboardList,
      roles: ['yonetici', 'muhendis', 'tekniker', 'musteri'],
      children: [
        { name: 'Yapılan İşler', href: '/yapilan-isler', icon: Wrench, roles: ['yonetici', 'muhendis', 'tekniker', 'musteri'] },
        { name: 'Elektrik Kesintileri', href: '/elektrik-kesintileri', icon: Bolt, roles: ['yonetici', 'muhendis', 'tekniker', 'musteri'] },
        { name: 'İnvertör Kontrolleri', href: '/invertor-kontrol', icon: Activity, roles: ['yonetici', 'muhendis', 'tekniker', 'musteri'] },
        { name: 'Mekanik Bakım', href: '/mekanik-bakim', icon: PanelTop, roles: ['yonetici', 'muhendis', 'tekniker', 'musteri'] },
        { name: 'Elektrik Bakım', href: '/elektrik-bakim', icon: Zap, roles: ['yonetici', 'muhendis', 'tekniker', 'musteri'] },
      ]
    },
    
    { name: 'Sahalar/Müşteriler', href: '/sahalar', icon: Building, roles: ['yonetici', 'muhendis', 'tekniker', 'musteri'] },
    { name: 'Müşteri Yönetimi', href: '/musteriler', icon: UserPlus, roles: ['yonetici'] },
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


  useEffect(() => {
    const currentPath = location.pathname;
    for (const item of visibleNavigation) {
      if (item.children) {
        const isActiveParent = item.children.some(child => currentPath === child.href || currentPath.startsWith(child.href + '/'));
        if (isActiveParent && !openSubmenus[item.name]) {
          setOpenSubmenus(prev => ({ ...prev, [item.name]: true }));
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, visibleNavigation]);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isExpanded ? 260 : 72 }}
      transition={{ duration: 0.25, ease: "circOut" }}
      className="hidden lg:flex flex-col h-screen bg-sky-800 text-white shadow-xl transition-all duration-250 ease-in-out group"
    >
      <div className={`flex items-center border-b border-sky-700 h-[65px] transition-all duration-250 ease-in-out ${isExpanded ? 'px-4 justify-between' : 'px-2.5 justify-center'}`}>
        <div className={`flex items-center overflow-hidden ${isExpanded ? 'opacity-100' : 'opacity-0 w-0'} transition-opacity duration-150`}>
          <div className="flex items-center">
            {/* Dinamik güneş enerjisi animasyonu */}
            <div className="relative mr-4 ml-2 flex items-center justify-center">
              {/* Ana güneş efekti */}
              <motion.div
                className="relative"
                animate={{
                  rotate: 360
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "linear"
                }}
              >
                <motion.div
                  className="w-4 h-4 rounded-full bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400"
                  animate={{
                    scale: [1, 1.4, 1],
                    boxShadow: [
                      "0 0 0 0 rgba(251, 191, 36, 0.7)",
                      "0 0 0 8px rgba(251, 191, 36, 0)",
                      "0 0 0 0 rgba(251, 191, 36, 0)"
                    ]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                {/* Işın efektleri */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, index) => (
                  <motion.div
                    key={angle}
                    className="absolute w-0.5 h-3 bg-gradient-to-t from-transparent to-yellow-300 origin-bottom"
                    style={{
                      top: '-8px',
                      left: '50%',
                      transformOrigin: '50% 16px',
                      transform: `translateX(-50%) rotate(${angle}deg)`
                    }}
                    animate={{
                      scaleY: [0.5, 1, 0.5],
                      opacity: [0.4, 1, 0.4]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: index * 0.1,
                      ease: "easeInOut"
                    }}
                  />
                ))}
              </motion.div>
              
              {/* Parlaklık parçacıkları */}
              <div className="absolute left-4">
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-yellow-300 rounded-full"
                    style={{
                      left: `${i * 4}px`,
                      top: `${Math.sin(i) * 2}px`
                    }}
                    animate={{
                      y: [0, -8, 0],
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0]
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      delay: i * 0.5,
                      ease: "easeInOut"
                    }}
                  />
                                 ))}
               </div>
            </div>
            <span className="font-semibold text-lg whitespace-nowrap">
              solarVeyo
            </span>
          </div>
        </div>
        <button 
          onClick={toggleSidebar} 
          className="p-1.5 rounded-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors duration-150"
          aria-label={isExpanded ? "Menüyü Daralt" : "Menüyü Genişlet"}
        >
           {isExpanded ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto scrollbar-thin scrollbar-thumb-sky-600 scrollbar-track-sky-700">
        {visibleNavigation.map((item) => 
          item.children && item.children.length > 0 ? (
            <NavParent 
              key={item.name} 
              item={item} 
              isExpanded={isExpanded} 
              toggleSubmenu={() => toggleSubmenu(item.name)} 
              isSubmenuOpen={!!openSubmenus[item.name]}
              location={location}
              userRole={user?.rol}
              getNotificationCount={getNotificationCount}
            />
          ) : (
            <NavLink 
              key={item.name} 
              item={item} 
              isExpanded={isExpanded} 
              isActive={location.pathname === item.href || (item.href ? location.pathname.startsWith(item.href + '/') : false)}
              notificationCount={item.href ? getNotificationCount(item.href) : undefined}
            />
          )
        )}
      </nav>

      <div className="p-3 border-t border-sky-700">
        <div className={`flex items-center transition-all duration-250 ease-in-out ${isExpanded ? 'justify-start' : 'justify-center'}`}>
          <img
            src={user?.fotoURL || `https://ui-avatars.com/api/?name=${user?.ad || user?.email}&background=E0F2FE&color=0C4A6E`}
            alt="Profil"
            className="w-9 h-9 rounded-full border-2 border-sky-400 flex-shrink-0"
          />
          {isExpanded && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="ml-2.5 overflow-hidden"
            >
              <p className="font-semibold text-sm text-sky-50 truncate">{user?.ad || 'Kullanıcı'}</p>
              <p className="text-xs text-sky-200 capitalize truncate">{user?.rol || 'Rol Belirtilmemiş'}</p>
            </motion.div>
          )}
        </div>
        {isExpanded && (
            <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.15 }}
                onClick={cikisYap}
                className={`w-full flex items-center mt-3 p-2.5 rounded-md transition-colors duration-150 text-rose-300 hover:bg-rose-500 hover:text-white justify-start`}
            >
                <LogOut className="h-5 w-5 mr-3 flex-shrink-0" />
                <span className="font-medium text-sm">Çıkış Yap</span>
            </motion.button>
        )}
        {!isExpanded && (
            <button 
                onClick={cikisYap}
                className="w-full flex items-center justify-center mt-3 p-2.5 rounded-md transition-colors duration-150 text-rose-300 hover:bg-rose-500 hover:text-white"
                title="Çıkış Yap"
            >
                <LogOut className="h-5 w-5" />
            </button>
        )}
      </div>
    </motion.aside>
  );
}; 