import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, deleteDoc, updateDoc, where, Timestamp, addDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Building, Users, Calendar, Trash2, Edit2, Eye, Plus, Search, Filter, RefreshCw, X, Clock, CreditCard, 
  ChevronDown, CheckCircle, AlertTriangle, Mail, Phone, Settings, Activity, BarChart3, 
  TrendingUp, Shield, Package, Database, Globe
} from 'lucide-react';
import { Card, Title, Text, Metric, BarChart, DonutChart } from '@tremor/react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SearchInput } from '../components/SearchInput';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Company } from '../types';
import { Kullanici } from '../types';
import { getAuth } from "firebase/auth";

interface DashboardStats {
  totalCompanies: number;
  totalUsers: number;
  activeCompanies: number;
  newCompaniesThisMonth: number;
  trialUsers: number;
  paidUsers: number;
  expiredUsers: number;
  totalRevenue: number;
}

export const SuperAdminDashboard: React.FC = () => {
  const { kullanici } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<Kullanici[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedUser, setSelectedUser] = useState<Kullanici | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [customDays, setCustomDays] = useState<string>('');
  const [stats, setStats] = useState<DashboardStats>({
    totalCompanies: 0,
    totalUsers: 0,
    activeCompanies: 0,
    newCompaniesThisMonth: 0,
    trialUsers: 0,
    paidUsers: 0,
    expiredUsers: 0,
    totalRevenue: 0
  });
  const [activeTab, setActiveTab] = useState<'overview' | 'companies' | 'users' | 'analytics'>('overview');
  const [filterStatus, setFilterStatus] = useState<'all' | 'trial' | 'paid' | 'expired'>('all');
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const auth = getAuth();

  // Check if user is superadmin
  const isSuperAdmin = kullanici?.rol === 'superadmin';

  // Filtered companies based on search
  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (company.email && company.email.toLowerCase().includes(searchText.toLowerCase()))
  );

  // Filtered users based on search and filter
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.ad.toLowerCase().includes(searchText.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchText.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'trial') return matchesSearch && user.odemeDurumu === 'deneme';
    if (filterStatus === 'paid') return matchesSearch && user.odemeDurumu === 'odendi';
    if (filterStatus === 'expired') return matchesSearch && user.odemeDurumu === 'surebitti';
    
    return matchesSearch;
  });

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    
    fetchAllData();
  }, [isSuperAdmin]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchCompanies(),
        fetchUsers()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Veriler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const companiesQuery = query(
        collection(db, 'companies'),
        orderBy('createdAt', 'desc')
      );

      const companiesSnapshot = await getDocs(companiesQuery);
      const companiesList = companiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Company[];

      setCompanies(companiesList);
      return companiesList;
    } catch (error) {
      console.error('Error fetching companies:', error);
      throw error;
    }
  };

  const fetchUsers = async () => {
    try {
      const usersQuery = query(collection(db, 'kullanicilar'), orderBy('ad'));
      const usersSnapshot = await getDocs(usersQuery);

      const usersList: Kullanici[] = [];
      usersSnapshot.forEach((doc) => {
        usersList.push({ id: doc.id, ...doc.data() } as Kullanici);
      });

      setUsers(usersList);
      
      // Calculate comprehensive stats
      calculateStats(companies, usersList);
      
      return usersList;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  };

  const calculateStats = (companiesList: Company[], usersList: Kullanici[]) => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const newCompaniesThisMonth = companiesList.filter(
      company => company.createdAt && company.createdAt.toDate() >= firstDayOfMonth
    ).length;

    const trialUsers = usersList.filter(user => user.odemeDurumu === 'deneme').length;
    const paidUsers = usersList.filter(user => user.odemeDurumu === 'odendi').length;
    const expiredUsers = usersList.filter(user => user.odemeDurumu === 'surebitti').length;

    setStats({
      totalCompanies: companiesList.length,
      totalUsers: usersList.length,
      activeCompanies: companiesList.length,
      newCompaniesThisMonth,
      trialUsers,
      paidUsers,
      expiredUsers,
      totalRevenue: paidUsers * 1000 // Example calculation
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAllData();
  };

  const handleViewCompany = (company: Company) => {
    setSelectedCompany(company);
    setIsViewModalOpen(true);
  };

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company);
    setIsEditModalOpen(true);
  };

  const handleAccessCompanyData = (company: Company) => {
    sessionStorage.setItem('superadmin_viewing_company', company.id);
    sessionStorage.setItem('superadmin_viewing_company_name', company.name);
    window.location.href = '/anasayfa';
  };

  const handleDeleteCompany = async (companyId: string) => {
    try {
      setLoading(true);
      
      // Önce şirkete ait tüm kullanıcıları kontrol et
      const usersQuery = query(
        collection(db, 'kullanicilar'),
        where('companyId', '==', companyId)
      );
      const usersSnapshot = await getDocs(usersQuery);
      const userCount = usersSnapshot.size;
      
      if (userCount > 0) {
        const confirmDelete = window.confirm(
          `Bu şirkete bağlı ${userCount} kullanıcı var. Şirketi silmek tüm kullanıcıları ve verilerini de silecek. Devam etmek istediğinizden emin misiniz?`
        );
        
        if (!confirmDelete) {
          setLoading(false);
          return;
        }
      }
      
      console.log(`🔥 Şirket silme işlemi başlatılıyor: ${companyId}`);
      
      // Helper function to delete documents in batches
      const deleteInBatches = async (docs: any[], collectionName: string) => {
        const batchSize = 100; // Firebase batch limit is 500, using 100 for safety
        let deletedCount = 0;
        
        for (let i = 0; i < docs.length; i += batchSize) {
          const batch = writeBatch(db);
          const batchDocs = docs.slice(i, i + batchSize);
          
          batchDocs.forEach((doc) => {
            batch.delete(doc.ref);
          });
          
          await batch.commit();
          deletedCount += batchDocs.length;
          console.log(`📦 ${collectionName}: ${batchDocs.length} döküman silindi (Toplam: ${deletedCount}/${docs.length})`);
        }
        
        return deletedCount;
      };

      // 1. Şirkete ait kullanıcıları sil
      if (userCount > 0) {
        console.log(`👥 ${userCount} kullanıcı siliniyor...`);
        await deleteInBatches(usersSnapshot.docs, 'kullanicilar');
        console.log(`✅ Tüm kullanıcılar silindi`);
      }
      
      // 2. Şirkete ait diğer koleksiyonları sil
      const collectionsToDelete = [
        'sahalar',
        'santraller', 
        'arizalar',
        'uretimVerileri',
        'stoklar',
        'isRaporlari',
        'mekanikBakimlar',
        'elektrikBakimlar',
        'elektrikKesintileri',
        'invertorKontroller',
        'bildirimler',
        'invitations'
      ];
      
      console.log(`🗂️ ${collectionsToDelete.length} koleksiyon kontrol ediliyor...`);
      
      for (const collectionName of collectionsToDelete) {
        try {
          console.log(`🔍 ${collectionName} kontrol ediliyor...`);
          
          const collectionQuery = query(
            collection(db, collectionName),
            where('companyId', '==', companyId)
          );
          const collectionSnapshot = await getDocs(collectionQuery);
          
          if (collectionSnapshot.size > 0) {
            console.log(`📋 ${collectionName}: ${collectionSnapshot.size} döküman bulundu, siliniyor...`);
            await deleteInBatches(collectionSnapshot.docs, collectionName);
            console.log(`✅ ${collectionName}: Tüm dökümanlar silindi`);
          } else {
            console.log(`ℹ️ ${collectionName}: Silinecek döküman bulunamadı`);
          }
        } catch (error) {
          console.error(`❌ ${collectionName} silinirken hata:`, error);
          toast.error(`${collectionName} silinirken hata oluştu: ${error.message}`);
          // Bir koleksiyonda hata olsa bile devam et
        }
      }
      
      // 3. Şirket ayarlarını sil (ayarlar koleksiyonu companyId'yi key olarak kullanıyor)
      try {
        console.log(`⚙️ Şirket ayarları siliniyor...`);
        const settingsRef = doc(db, 'ayarlar', companyId);
        await deleteDoc(settingsRef);
        console.log(`✅ Şirket ayarları silindi`);
      } catch (error) {
        console.error(`❌ Şirket ayarları silinirken hata:`, error);
        // Ayarlar bulunamasa bile devam et
      }
      
      // 4. Son olarak şirket dokümanını sil
      console.log(`🏢 Şirket dokümanı siliniyor...`);
      await deleteDoc(doc(db, 'companies', companyId));
      console.log(`✅ Şirket dokümanı silindi`);
      
      toast.success('🎉 Şirket ve tüm ilgili verileri başarıyla silindi');
      setCompanyToDelete(null);
      
      // Hem şirket hem kullanıcı listesini yenile
      console.log(`🔄 Listeler yenileniyor...`);
      await Promise.all([fetchCompanies(), fetchUsers()]);
      console.log(`✅ Tüm işlemler tamamlandı`);
      
    } catch (error) {
      console.error('❌ Şirket silme hatası:', error);
      toast.error(`Şirket silinirken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExtendTrial = async (userId: string, days: number) => {
    try {
      setLoading(true);
      
      const currentDate = new Date();
      const newExpiryDate = new Date(currentDate.getTime() + (days * 24 * 60 * 60 * 1000));
      
      await updateDoc(doc(db, 'kullanicilar', userId), {
        denemeSuresiBitis: Timestamp.fromDate(newExpiryDate),
        odemeDurumu: 'deneme',
        updatedAt: Timestamp.now(),
        updatedBy: kullanici?.id
      });

      toast.success(`${days} gün süre eklendi`);
      await fetchUsers();
    } catch (error) {
      console.error('Error extending trial:', error);
      toast.error('Süre uzatılırken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePaymentStatus = async (userId: string, status: 'deneme' | 'odendi' | 'beklemede' | 'surebitti') => {
    try {
      setLoading(true);
      
      // Kullanıcı bilgilerini al
      const userDoc = await getDoc(doc(db, 'kullanicilar', userId));
      if (!userDoc.exists()) {
        toast.error('Kullanıcı bulunamadı');
        return;
      }
      
      const userData = userDoc.data();
      const userCompanyId = userData.companyId;
      
      // Kullanıcı ödeme durumunu güncelle
      await updateDoc(doc(db, 'kullanicilar', userId), {
        odemeDurumu: status,
        sonOdemeTarihi: status === 'odendi' ? Timestamp.now() : null,
        updatedAt: Timestamp.now(),
        updatedBy: kullanici?.id
      });

      // Eğer kullanıcı yönetici ise ve ödeme durumu değişiyorsa, şirket durumunu da güncelle
      if (userData.rol === 'yonetici' && userCompanyId) {
        try {
          let companyStatus: 'active' | 'expired' | 'cancelled' = 'active';
          let isActive = true;
          
          if (status === 'surebitti') {
            companyStatus = 'expired';
            isActive = false;
          } else if (status === 'odendi') {
            companyStatus = 'active';
            isActive = true;
          }
          
          await updateDoc(doc(db, 'companies', userCompanyId), {
            isActive: isActive,
            subscriptionStatus: companyStatus,
            lastPaymentDate: status === 'odendi' ? Timestamp.now() : null,
            updatedAt: Timestamp.now(),
            updatedBy: kullanici?.id
          });
          
          toast.success(`Yönetici ödeme durumu ve şirket aboneliği güncellendi (${isActive ? 'Aktif' : 'Pasif'})`);
        } catch (companyError) {
          console.error('Şirket durumu güncellenirken hata:', companyError);
          toast('Kullanıcı güncellendi ancak şirket durumu güncellenemedi', { icon: '⚠️' });
        }
      } else {
        toast.success('Ödeme durumu güncellendi');
      }
      
      await fetchUsers();
    } catch (error) {
      console.error('Error updating payment status:', error);
      toast.error('Ödeme durumu güncellenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Kullanıcı silme fonksiyonu
  const handleDeleteUser = async (userId: string) => {
    try {
      setLoading(true);
      
      // Kullanıcı bilgilerini al
      const userDoc = await getDoc(doc(db, 'kullanicilar', userId));
      if (!userDoc.exists()) {
        toast.error('Kullanıcı bulunamadı');
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      const userName = userData.ad || 'Bilinmeyen Kullanıcı';
      const userCompanyId = userData.companyId;

      // Ek onay al
      const confirmDelete = window.confirm(
        `${userName} adlı kullanıcıyı ve ona ait tüm verileri silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`
      );

      if (!confirmDelete) {
        setLoading(false);
        return;
      }

      console.log(`Kullanıcı silme işlemi başlatılıyor: ${userId} (${userName})`);

      // Kullanıcıya ait verileri sil
      const collectionsToClean = [
        { collection: 'arizalar', field: 'raporlayanId' },
        { collection: 'arizalar', field: 'olusturanKisi' },
        { collection: 'isRaporlari', field: 'raporlayanId' },
        { collection: 'isRaporlari', field: 'olusturanKisi' },
        { collection: 'mekanikBakimlar', field: 'yapanKisi' },
        { collection: 'elektrikBakimlar', field: 'yapanKisi' },
        { collection: 'elektrikKesintileri', field: 'raporlayanId' },
        { collection: 'invertorKontroller', field: 'kontolEdenKisi' },
        { collection: 'stoklar', field: 'olusturanKisi.id' },
        { collection: 'bildirimler', field: 'kullaniciId' }
      ];

      for (const { collection: collectionName, field } of collectionsToClean) {
        try {
          const collectionQuery = query(
            collection(db, collectionName),
            where(field, '==', userId),
            where('companyId', '==', userCompanyId)
          );
          const collectionSnapshot = await getDocs(collectionQuery);

          if (collectionSnapshot.size > 0) {
            const batch = writeBatch(db);
            collectionSnapshot.docs.forEach((doc) => {
              batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`${collectionName}: ${collectionSnapshot.size} döküman silindi`);
          }
        } catch (error) {
          console.error(`${collectionName} temizlenirken hata:`, error);
        }
      }

      // Eğer kullanıcı müşteri ise, saha ve santral atamalarını temizle
      if (userData.rol === 'musteri') {
        // Sahalar
        if (userData.sahalar && Array.isArray(userData.sahalar) && userData.sahalar.length > 0) {
          try {
            const sahaQuery = query(
              collection(db, 'sahalar'),
              where('__name__', 'in', userData.sahalar),
              where('companyId', '==', userCompanyId)
            );
            const sahaSnapshot = await getDocs(sahaQuery);

            if (sahaSnapshot.size > 0) {
              const batch = writeBatch(db);
              sahaSnapshot.docs.forEach((sahaDoc) => {
                batch.update(sahaDoc.ref, {
                  musteriId: null,
                  guncellemeTarihi: new Date()
                });
              });
              await batch.commit();
              console.log(`${sahaSnapshot.size} sahadan müşteri ataması kaldırıldı`);
            }
          } catch (error) {
            console.error('Saha atamalarını kaldırırken hata:', error);
          }
        }

        // Santraller
        try {
          const santralQuery = query(
            collection(db, 'santraller'),
            where('musteriId', '==', userId),
            where('companyId', '==', userCompanyId)
          );
          const santralSnapshot = await getDocs(santralQuery);

          if (santralSnapshot.size > 0) {
            const batch = writeBatch(db);
            santralSnapshot.docs.forEach((santralDoc) => {
              batch.update(santralDoc.ref, {
                musteriId: null,
                guncellemeTarihi: new Date()
              });
            });
            await batch.commit();
            console.log(`${santralSnapshot.size} santraldan müşteri ataması kaldırıldı`);
          }
        } catch (error) {
          console.error('Santral atamalarını kaldırırken hata:', error);
        }
      }

      // Son olarak kullanıcı dokümanını sil
      await deleteDoc(doc(db, 'kullanicilar', userId));
      console.log('Kullanıcı dokümanı silindi');

      toast.success(`${userName} ve ilgili tüm verileri başarıyla silindi`);
      setUserToDelete(null);
      
      // Kullanıcı listesini yenile
      await fetchUsers();
      
    } catch (error) {
      console.error('Kullanıcı silme hatası:', error);
      toast.error('Kullanıcı silinirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Erişim Engellendi</h1>
          <p className="text-gray-600">
            Bu sayfaya erişim için süper admin yetkisine sahip olmanız gerekiyor.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card decoration="top" decorationColor="blue">
          <div className="flex items-center justify-between">
            <div>
              <Text>Toplam Şirket</Text>
              <Metric className="text-blue-600">{stats.totalCompanies}</Metric>
            </div>
            <Building className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
        
        <Card decoration="top" decorationColor="green">
          <div className="flex items-center justify-between">
            <div>
              <Text>Toplam Kullanıcı</Text>
              <Metric className="text-green-600">{stats.totalUsers}</Metric>
            </div>
            <Users className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        
        <Card decoration="top" decorationColor="amber">
          <div className="flex items-center justify-between">
            <div>
              <Text>Bu Ay Yeni</Text>
              <Metric className="text-amber-600">{stats.newCompaniesThisMonth}</Metric>
            </div>
            <TrendingUp className="h-8 w-8 text-amber-500" />
          </div>
        </Card>
        
        <Card decoration="top" decorationColor="indigo">
          <div className="flex items-center justify-between">
            <div>
              <Text>Aylık Gelir</Text>
              <Metric className="text-indigo-600">₺{stats.totalRevenue.toLocaleString()}</Metric>
            </div>
            <BarChart3 className="h-8 w-8 text-indigo-500" />
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Title>Kullanıcı Abonelik Durumu</Title>
          <DonutChart
            className="mt-6"
            data={[
              { name: 'Deneme', value: stats.trialUsers },
              { name: 'Ödendi', value: stats.paidUsers },
              { name: 'Süresi Bitti', value: stats.expiredUsers }
            ]}
            category="value"
            index="name"
            colors={["blue", "green", "red"]}
            showTooltip={true}
          />
        </Card>

        <Card>
          <Title>Son 30 Gün Aktivite</Title>
          <BarChart
            className="mt-6"
            data={[
              { name: 'Yeni Kullanıcılar', value: stats.newCompaniesThisMonth },
              { name: 'Aktif Şirketler', value: stats.activeCompanies },
              { name: 'Ödemeler', value: stats.paidUsers }
            ]}
            index="name"
            categories={["value"]}
            colors={["blue"]}
            showTooltip={true}
          />
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <Title>Hızlı İşlemler</Title>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <button
            onClick={() => setActiveTab('companies')}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Building className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <p className="font-medium">Şirket Yönetimi</p>
            <p className="text-sm text-gray-500">Şirketleri görüntüle ve düzenle</p>
          </button>
          
          <button
            onClick={() => setActiveTab('users')}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Users className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="font-medium">Kullanıcı Yönetimi</p>
            <p className="text-sm text-gray-500">Kullanıcıları yönet ve abonelikleri kontrol et</p>
          </button>
          
          <button
            onClick={() => setActiveTab('analytics')}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <BarChart3 className="h-8 w-8 text-purple-500 mx-auto mb-2" />
            <p className="font-medium">Analitik</p>
            <p className="text-sm text-gray-500">Detaylı raporlar ve istatistikler</p>
          </button>
        </div>
      </Card>
    </div>
  );

  const renderCompanies = () => (
    <Card>
      <Title>Şirket Yönetimi</Title>
      <div className="mt-6 space-y-4">
        <SearchInput
          value={searchText}
          onChange={setSearchText}
          placeholder="Şirket ara..."
        />
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Şirket
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İletişim
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Oluşturulma
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCompanies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Building className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{company.name}</div>
                        <div className="text-xs text-gray-500">{company.slogan || 'Slogan yok'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{company.email}</div>
                    <div className="text-sm text-gray-500">{company.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {company.createdAt ? format(company.createdAt.toDate(), 'dd.MM.yyyy', { locale: tr }) : 'Bilinmiyor'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleViewCompany(company)}
                        className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded"
                        title="Görüntüle"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleAccessCompanyData(company)}
                        className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                        title="Şirket Verilerine Eriş"
                      >
                        <Database className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setCompanyToDelete(company.id)}
                        className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                        title="Sil"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <Title>Kullanıcı Yönetimi</Title>
          <div className="flex space-x-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">Tüm Kullanıcılar</option>
              <option value="trial">Deneme Süresi</option>
              <option value="paid">Ödendi</option>
              <option value="expired">Süresi Bitti</option>
            </select>
          </div>
        </div>
        
        <SearchInput
          value={searchText}
          onChange={setSearchText}
          placeholder="Kullanıcı ara..."
        />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((user) => (
          <Card key={user.id}>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{user.ad}</h3>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-1
                    ${user.rol === 'superadmin' ? 'bg-purple-100 text-purple-800' :
                      user.rol === 'yonetici' ? 'bg-blue-100 text-blue-800' :
                      user.rol === 'tekniker' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'}`}>
                    {user.rol === 'superadmin' ? 'Süper Admin' :
                     user.rol === 'yonetici' ? 'Yönetici' :
                     user.rol === 'tekniker' ? 'Tekniker' :
                     user.rol === 'muhendis' ? 'Mühendis' :
                     user.rol}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Abonelik</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full
                    ${user.odemeDurumu === 'deneme' ? 'bg-blue-100 text-blue-800' :
                      user.odemeDurumu === 'odendi' ? 'bg-green-100 text-green-800' :
                      user.odemeDurumu === 'surebitti' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'}`}>
                    {user.odemeDurumu === 'deneme' ? 'Deneme' :
                     user.odemeDurumu === 'odendi' ? 'Ödendi' :
                     user.odemeDurumu === 'surebitti' ? 'Süresi Bitti' : 'Belirtilmedi'}
                  </span>
                </div>

                {user.denemeSuresiBitis && (
                  <div className="text-xs text-gray-600 mb-3">
                    Bitiş: {format(user.denemeSuresiBitis.toDate(), 'dd.MM.yyyy', { locale: tr })}
                  </div>
                )}

                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setSelectedUser(user);
                      setIsUserEditModalOpen(true);
                    }}
                    className="flex-1 bg-blue-50 text-blue-700 px-3 py-2 rounded-md text-xs font-medium hover:bg-blue-100 transition-colors"
                  >
                    Abonelik Yönet
                  </button>
                  <button
                    onClick={() => handleUpdatePaymentStatus(user.id, user.odemeDurumu === 'odendi' ? 'deneme' : 'odendi')}
                    className="flex-1 bg-green-50 text-green-700 px-3 py-2 rounded-md text-xs font-medium hover:bg-green-100 transition-colors"
                  >
                    Ödeme Durumu
                  </button>
                </div>
                
                {/* Silme butonu */}
                <div className="mt-2">
                  <button
                    onClick={() => setUserToDelete(user.id)}
                    className="w-full bg-red-50 text-red-700 px-3 py-2 rounded-md text-xs font-medium hover:bg-red-100 transition-colors flex items-center justify-center"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Kullanıcıyı Sil
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Title>Aylık Yeni Kayıtlar</Title>
          <BarChart
            className="mt-6"
            data={[
              { month: 'Ocak', companies: 5, users: 23 },
              { month: 'Şubat', companies: 8, users: 35 },
              { month: 'Mart', companies: 12, users: 47 },
              { month: 'Nisan', companies: 6, users: 29 },
              { month: 'Mayıs', companies: 15, users: 62 },
              { month: 'Haziran', companies: 9, users: 38 }
            ]}
            index="month"
            categories={["companies", "users"]}
            colors={["blue", "green"]}
            showTooltip={true}
          />
        </Card>

        <Card>
          <Title>Gelir Analizi</Title>
          <div className="mt-6 space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg">
              <div className="text-lg font-bold text-green-800">₺{stats.totalRevenue.toLocaleString()}</div>
              <div className="text-sm text-green-600">Bu ay toplam gelir</div>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg">
              <div className="text-lg font-bold text-blue-800">{stats.paidUsers}</div>
              <div className="text-sm text-blue-600">Ödenen abonelik</div>
            </div>
            <div className="bg-gradient-to-r from-amber-50 to-amber-100 p-4 rounded-lg">
              <div className="text-lg font-bold text-amber-800">{stats.trialUsers}</div>
              <div className="text-sm text-amber-600">Deneme süresi</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Süper Admin Paneli</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tüm şirketleri ve kullanıcıları yönetin, sistem analitiklerini görüntüleyin
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {[
            { id: 'overview', name: 'Genel Bakış', icon: BarChart3 },
            { id: 'companies', name: 'Şirketler', icon: Building },
            { id: 'users', name: 'Kullanıcılar', icon: Users },
            { id: 'analytics', name: 'Analitik', icon: TrendingUp }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <tab.icon className={`mr-2 h-5 w-5
                ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}
              `} />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'companies' && renderCompanies()}
      {activeTab === 'users' && renderUsers()}
      {activeTab === 'analytics' && renderAnalytics()}

      {/* Modals */}
      {/* User Edit Modal */}
      {isUserEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white rounded-lg shadow-xl w-96 max-w-full max-h-screen overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-100 to-blue-50 rounded-t-lg p-4 border-b border-blue-200">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <Calendar className="h-6 w-6 text-blue-700 mr-2" />
                  <h3 className="text-lg font-semibold text-blue-800">Abonelik Yönetimi</h3>
                </div>
                <button 
                  onClick={() => setIsUserEditModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center mb-4">
                <h4 className="font-medium text-gray-900">{selectedUser.ad}</h4>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    handleExtendTrial(selectedUser.id, 7);
                    setIsUserEditModalOpen(false);
                  }}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg py-3 px-4 text-center transition-colors"
                >
                  <div className="font-bold text-lg">7</div>
                  <div className="text-xs">Gün</div>
                </button>
                <button
                  onClick={() => {
                    handleExtendTrial(selectedUser.id, 30);
                    setIsUserEditModalOpen(false);
                  }}
                  className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg py-3 px-4 text-center transition-colors"
                >
                  <div className="font-bold text-lg">30</div>
                  <div className="text-xs">Gün</div>
                </button>
                <button
                  onClick={() => {
                    handleExtendTrial(selectedUser.id, 90);
                    setIsUserEditModalOpen(false);
                  }}
                  className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg py-3 px-4 text-center transition-colors"
                >
                  <div className="font-bold text-lg">90</div>
                  <div className="text-xs">Gün</div>
                </button>
                <button
                  onClick={() => {
                    handleExtendTrial(selectedUser.id, 365);
                    setIsUserEditModalOpen(false);
                  }}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg py-3 px-4 text-center transition-colors"
                >
                  <div className="font-bold text-lg">365</div>
                  <div className="text-xs">Gün</div>
                </button>
              </div>

              <div className="flex space-x-2 mt-4">
                <input
                  type="number"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  placeholder="Özel gün sayısı"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={() => {
                    if (customDays && parseInt(customDays) > 0) {
                      handleExtendTrial(selectedUser.id, parseInt(customDays));
                      setCustomDays('');
                      setIsUserEditModalOpen(false);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Ekle
                </button>
              </div>

              <div className="border-t pt-4 space-y-2">
                <button
                  onClick={() => {
                    handleUpdatePaymentStatus(selectedUser.id, 'odendi');
                    setIsUserEditModalOpen(false);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg text-sm transition-colors"
                >
                  Ödendi Olarak İşaretle
                </button>
                <button
                  onClick={() => {
                    handleUpdatePaymentStatus(selectedUser.id, 'surebitti');
                    setIsUserEditModalOpen(false);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg text-sm transition-colors"
                >
                  Süresi Bitti Olarak İşaretle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

             {/* Company Delete Modal */}
       {companyToDelete && (
         <SilmeOnayModal
           onCancel={() => setCompanyToDelete(null)}
           onConfirm={() => handleDeleteCompany(companyToDelete)}
           baslik="Şirket Sil"
           mesaj="Bu şirketi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve santrala ait tüm üretim verileri de silinecektir."
         />
       )}

       {/* User Delete Modal */}
       {userToDelete && (
         <SilmeOnayModal
           onCancel={() => setUserToDelete(null)}
           onConfirm={() => handleDeleteUser(userToDelete)}
           baslik="Kullanıcı Sil"
           mesaj="Bu kullanıcıyı ve ona ait tüm verileri silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
         />
       )}
    </div>
  );
};