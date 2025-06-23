import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Bell, MessageSquare, AlertTriangle, CheckCircle, Info, Wrench, Bolt, Activity, PanelTop, Zap, Clock, Trash2, X } from 'lucide-react';
import { useMenuNotifications } from '../contexts/MenuNotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, deleteDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface ActivityItem {
  id: string;
  tip: 'arizalar' | 'yapilanIsler' | 'vardiyaBildirimleri' | 'elektrikBakim' | 'mekanikBakim' | 'invertorKontrol' | 'elektrikKesintileri';
  baslik: string;
  mesaj: string;
  tarih: Date;
  link: string;
  collectionName: string;
}

const activityIcons = {
  arizalar: AlertTriangle,
  yapilanIsler: Wrench,
  vardiyaBildirimleri: Clock,
  elektrikBakim: Zap,
  mekanikBakim: PanelTop,
  invertorKontrol: Activity,
  elektrikKesintileri: Bolt,
};

const activityColors = {
  arizalar: 'text-red-500',
  yapilanIsler: 'text-blue-500',
  vardiyaBildirimleri: 'text-purple-500',
  elektrikBakim: 'text-yellow-500',
  mekanikBakim: 'text-green-500',
  invertorKontrol: 'text-orange-500',
  elektrikKesintileri: 'text-red-600',
};

const activityNames = {
  arizalar: 'Yeni Arıza',
  yapilanIsler: 'Yeni İş Raporu',
  vardiyaBildirimleri: 'Yeni Vardiya Bildirimi',
  elektrikBakim: 'Yeni Elektrik Bakım',
  mekanikBakim: 'Yeni Mekanik Bakım',
  invertorKontrol: 'Yeni İnvertör Kontrol',
  elektrikKesintileri: 'Yeni Elektrik Kesintisi',
};

const activityLinks = {
  arizalar: '/arizalar',
  yapilanIsler: '/yapilan-isler',
  vardiyaBildirimleri: '/vardiya-bildirimleri',
  elektrikBakim: '/elektrik-bakim',
  mekanikBakim: '/mekanik-bakim',
  invertorKontrol: '/invertor-kontrol',
  elektrikKesintileri: '/elektrik-kesintileri',
};

interface Props {
  onClose?: () => void;
}

export const BildirimListesi: React.FC<Props> = ({ onClose }) => {
  const { markPageAsSeen } = useMenuNotifications();
  const { kullanici } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // LocalStorage'dan son görülme zamanlarını al - rol bazında ayrı
  const getLastSeenTime = (pageName: string): Timestamp => {
    const storageKey = `lastSeen_${kullanici?.id}_${kullanici?.rol}_${pageName}`;
    const lastSeenStr = localStorage.getItem(storageKey);
    
    if (lastSeenStr) {
      const lastSeenMs = parseInt(lastSeenStr);
      return Timestamp.fromMillis(lastSeenMs);
    } else {
      // Eğer hiç görülmemişse 1 saat öncesi (o rol için yeni bildirimleri göster ama çok eskilerini değil)
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      return Timestamp.fromDate(oneHourAgo);
    }
  };

  useEffect(() => {
    if (!kullanici?.id || !kullanici?.companyId) return;

    setIsLoading(true);
    const allActivities: ActivityItem[] = [];

    try {
      // Arızalar
      const arizalarLastSeen = getLastSeenTime('arizalar');
      const arizalarQuery = query(
        collection(db, 'arizalar'),
        where('companyId', '==', kullanici.companyId),
        where('olusturmaTarihi', '>=', arizalarLastSeen),
        orderBy('olusturmaTarihi', 'desc')
      );

      const unsubscribeArizalar = onSnapshot(arizalarQuery, (snapshot) => {
        if (!kullanici?.id) return; // Kullanıcı çıkış yaptıysa işlemi durdur
        
        const arizalarData = snapshot.docs.map(doc => ({
          id: doc.id,
          tip: 'arizalar' as const,
          baslik: activityNames.arizalar,
          mesaj: `${doc.data().baslik || 'Yeni arıza bildirimi'}`,
          tarih: doc.data().olusturmaTarihi?.toDate() || new Date(),
          link: activityLinks.arizalar,
          collectionName: 'arizalar'
        }));

        // Mevcut aktivitelerden arızaları kaldır ve yenilerini ekle
        const filteredActivities = allActivities.filter(a => a.tip !== 'arizalar');
        allActivities.length = 0;
        allActivities.push(...filteredActivities, ...arizalarData);
        updateActivities();
      }, (error) => {
        console.warn('📊 BildirimListesi - Arızalar dinleme hatası:', error.code);
      });

      // Vardiya Bildirimleri
      const vardiyaLastSeen = getLastSeenTime('vardiyaBildirimleri');
      const vardiyaQuery = query(
        collection(db, 'vardiyaBildirimleri'),
        where('companyId', '==', kullanici.companyId),
        where('olusturmaTarihi', '>=', vardiyaLastSeen),
        orderBy('olusturmaTarihi', 'desc')
      );

      const unsubscribeVardiya = onSnapshot(vardiyaQuery, (snapshot) => {
        if (!kullanici?.id) return; // Kullanıcı çıkış yaptıysa işlemi durdur
        
        const vardiyaData = snapshot.docs.map(doc => ({
          id: doc.id,
          tip: 'vardiyaBildirimleri' as const,
          baslik: activityNames.vardiyaBildirimleri,
          mesaj: `${doc.data().kullaniciAdi || 'Bekçi'} tarafından bildirim`,
          tarih: doc.data().olusturmaTarihi?.toDate() || new Date(),
          link: activityLinks.vardiyaBildirimleri,
          collectionName: 'vardiyaBildirimleri'
        }));

        const filteredActivities = allActivities.filter(a => a.tip !== 'vardiyaBildirimleri');
        allActivities.length = 0;
        allActivities.push(...filteredActivities, ...vardiyaData);
        updateActivities();
      }, (error) => {
        console.warn('📊 BildirimListesi - Vardiya bildirimleri dinleme hatası:', error.code);
      });

      // Yapılan İşler
      const yapilanIslerLastSeen = getLastSeenTime('yapilanIsler');
      const yapilanIslerQuery = query(
        collection(db, 'isRaporlari'),
        where('companyId', '==', kullanici.companyId),
        where('tarih', '>=', yapilanIslerLastSeen),
        orderBy('tarih', 'desc')
      );

      const unsubscribeYapilanIsler = onSnapshot(yapilanIslerQuery, (snapshot) => {
        const yapilanIslerData = snapshot.docs.map(doc => ({
          id: doc.id,
          tip: 'yapilanIsler' as const,
          baslik: activityNames.yapilanIsler,
          mesaj: `${doc.data().yapildigi_is || 'Yeni iş raporu'}`,
          tarih: doc.data().tarih?.toDate() || new Date(),
          link: activityLinks.yapilanIsler,
          collectionName: 'isRaporlari'
        }));

        const filteredActivities = allActivities.filter(a => a.tip !== 'yapilanIsler');
        allActivities.length = 0;
        allActivities.push(...filteredActivities, ...yapilanIslerData);
        updateActivities();
      });

      // Elektrik Bakım
      const elektrikBakimLastSeen = getLastSeenTime('elektrikBakim');
      const elektrikBakimQuery = query(
        collection(db, 'elektrikBakimlar'),
        where('companyId', '==', kullanici.companyId),
        where('tarih', '>=', elektrikBakimLastSeen),
        orderBy('tarih', 'desc')
      );

      const unsubscribeElektrikBakim = onSnapshot(elektrikBakimQuery, (snapshot) => {
        const elektrikBakimData = snapshot.docs.map(doc => ({
          id: doc.id,
          tip: 'elektrikBakim' as const,
          baslik: activityNames.elektrikBakim,
          mesaj: `${doc.data().aciklama || 'Yeni elektrik bakım'}`,
          tarih: doc.data().tarih?.toDate() || new Date(),
          link: activityLinks.elektrikBakim,
          collectionName: 'elektrikBakimlar'
        }));

        const filteredActivities = allActivities.filter(a => a.tip !== 'elektrikBakim');
        allActivities.length = 0;
        allActivities.push(...filteredActivities, ...elektrikBakimData);
        updateActivities();
      });

      // Mekanik Bakım
      const mekanikBakimLastSeen = getLastSeenTime('mekanikBakim');
      const mekanikBakimQuery = query(
        collection(db, 'mekanikBakimlar'),
        where('companyId', '==', kullanici.companyId),
        where('tarih', '>=', mekanikBakimLastSeen),
        orderBy('tarih', 'desc')
      );

      const unsubscribeMekanikBakim = onSnapshot(mekanikBakimQuery, (snapshot) => {
        const mekanikBakimData = snapshot.docs.map(doc => ({
          id: doc.id,
          tip: 'mekanikBakim' as const,
          baslik: activityNames.mekanikBakim,
          mesaj: `${doc.data().aciklama || 'Yeni mekanik bakım'}`,
          tarih: doc.data().tarih?.toDate() || new Date(),
          link: activityLinks.mekanikBakim,
          collectionName: 'mekanikBakimlar'
        }));

        const filteredActivities = allActivities.filter(a => a.tip !== 'mekanikBakim');
        allActivities.length = 0;
        allActivities.push(...filteredActivities, ...mekanikBakimData);
        updateActivities();
      });

      // İnvertör Kontrol
      const invertorLastSeen = getLastSeenTime('invertorKontrol');
      const invertorQuery = query(
        collection(db, 'invertorKontroller'),
        where('companyId', '==', kullanici.companyId),
        where('tarih', '>=', invertorLastSeen),
        orderBy('tarih', 'desc')
      );

      const unsubscribeInvertor = onSnapshot(invertorQuery, (snapshot) => {
        const invertorData = snapshot.docs.map(doc => ({
          id: doc.id,
          tip: 'invertorKontrol' as const,
          baslik: activityNames.invertorKontrol,
          mesaj: `${doc.data().aciklama || 'Yeni invertör kontrol'}`,
          tarih: doc.data().tarih?.toDate() || new Date(),
          link: activityLinks.invertorKontrol,
          collectionName: 'invertorKontroller'
        }));

        const filteredActivities = allActivities.filter(a => a.tip !== 'invertorKontrol');
        allActivities.length = 0;
        allActivities.push(...filteredActivities, ...invertorData);
        updateActivities();
      });

      // Elektrik Kesintileri
      const kesintilerLastSeen = getLastSeenTime('elektrikKesintileri');
      const kesintilerQuery = query(
        collection(db, 'elektrikKesintileri'),
        where('companyId', '==', kullanici.companyId),
        where('tarih', '>=', kesintilerLastSeen),
        orderBy('tarih', 'desc')
      );

      const unsubscribeKesintiler = onSnapshot(kesintilerQuery, (snapshot) => {
        const kesintilerData = snapshot.docs.map(doc => ({
          id: doc.id,
          tip: 'elektrikKesintileri' as const,
          baslik: activityNames.elektrikKesintileri,
          mesaj: `${doc.data().aciklama || 'Yeni elektrik kesintisi'}`,
          tarih: doc.data().tarih?.toDate() || new Date(),
          link: activityLinks.elektrikKesintileri,
          collectionName: 'elektrikKesintileri'
        }));

        const filteredActivities = allActivities.filter(a => a.tip !== 'elektrikKesintileri');
        allActivities.length = 0;
        allActivities.push(...filteredActivities, ...kesintilerData);
        updateActivities();
      });

      const updateActivities = () => {
        // Gizlenen bildirimleri filtrele
        const visibleActivities = allActivities.filter(activity => {
          const hiddenKey = `hidden_notification_${kullanici?.id}_${activity.id}`;
          return !localStorage.getItem(hiddenKey);
        });

        // Tarihe göre sırala ve en son 20'yi al
        const sortedActivities = visibleActivities
          .sort((a, b) => b.tarih.getTime() - a.tarih.getTime())
          .slice(0, 20);
        
        setActivities([...sortedActivities]);
        setIsLoading(false);
      };

      return () => {
        unsubscribeArizalar();
        unsubscribeVardiya();
        unsubscribeYapilanIsler();
        unsubscribeElektrikBakim();
        unsubscribeMekanikBakim();
        unsubscribeInvertor();
        unsubscribeKesintiler();
      };

    } catch (error) {
      console.error('❌ Aktivite verileri yüklenirken hata:', error);
      setIsLoading(false);
    }
  }, [kullanici?.id, kullanici?.companyId]);

  const handleActivityClick = (activity: ActivityItem) => {
    markPageAsSeen(activity.tip);
    onClose?.();
  };

  const handleDeleteActivity = async (activity: ActivityItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm('Bu bildirimi listeden kaldırmak istediğinizden emin misiniz?')) {
      return;
    }

    try {
      // Sadece bildirim listesinden gizle (localStorage'a kaydet)
      const hiddenKey = `hidden_notification_${kullanici?.id}_${activity.id}`;
      localStorage.setItem(hiddenKey, 'true');
      toast.success('Bildirim listeden kaldırıldı');
    } catch (error: any) {
      console.error('Bildirim gizleme hatası:', error);
      toast.error('Bildirim gizlenirken hata oluştu');
    }
  };

  const handleClearAll = async () => {
    if (activities.length === 0) {
      toast('Kaldırılacak bildirim bulunamadı');
      return;
    }

    if (!window.confirm(`TÜM bildirimleri (${activities.length} adet) listeden kaldırmak istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      // Tüm aktiviteleri localStorage'da gizle
      activities.forEach(activity => {
        const hiddenKey = `hidden_notification_${kullanici?.id}_${activity.id}`;
        localStorage.setItem(hiddenKey, 'true');
      });
      
      toast.success(`${activities.length} bildirim listeden kaldırıldı`);
      onClose?.();
    } catch (error: any) {
      console.error('Toplu gizleme hatası:', error);
      toast.error('Bildirimleri gizlerken hata oluştu');
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-2">Bildirimler yükleniyor...</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <Bell className="h-12 w-12 mx-auto mb-2 text-gray-300" />
        <p>Henüz yeni aktivite bulunmuyor.</p>
        <p className="text-xs mt-1">Son 7 gün içindeki aktiviteler gösterilir.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {/* Tümünü kaldır butonu */}
      <div className="p-3 bg-blue-50 border-b border-blue-200">
        <button
          onClick={handleClearAll}
          className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-2"
        >
          <X className="h-4 w-4" />
          Tümünü Listeden Kaldır
        </button>
        <p className="text-xs text-blue-500 mt-1 text-center">Sadece bildirim listesinden kaldırılır</p>
      </div>

      {activities.map((activity) => {
        const Ikon = activityIcons[activity.tip];
        return (
          <div
            key={`${activity.tip}-${activity.id}`}
            className="p-4 hover:bg-gray-50 transition-colors duration-200 group"
          >
            <Link
              to={activity.link}
              onClick={() => handleActivityClick(activity)}
              className="flex items-start space-x-3"
            >
              <Ikon className={`h-5 w-5 mt-1 ${activityColors[activity.tip]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{activity.baslik}</p>
                <p className="text-sm text-gray-500 truncate">{activity.mesaj}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {format(activity.tarih, 'dd MMM yyyy HH:mm', { locale: tr })}
                </p>
              </div>
              <button
                onClick={(e) => handleDeleteActivity(activity, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 rounded text-blue-500 hover:text-blue-700 transition-all duration-200"
                title="Listeden Kaldır"
              >
                <X className="h-4 w-4" />
              </button>
            </Link>
          </div>
        );
      })}
    </div>
  );
};