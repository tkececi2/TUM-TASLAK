import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, deleteDoc, updateDoc, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Building, Users, Calendar, Trash2, Edit2, Eye, Plus, Search, Filter, RefreshCw, X, Clock, CreditCard } from 'lucide-react';
import { Card, Title, Text, Metric, BarChart } from '@tremor/react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SearchInput } from '../components/SearchInput';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Company } from '../types';
import { Kullanici } from '../types';

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
  const [stats, setStats] = useState({
    totalCompanies: 0,
    totalUsers: 0,
    activeCompanies: 0,
    newCompaniesThisMonth: 0
  });
  const [activeTab, setActiveTab] = useState<'companies' | 'users'>('companies');
  const [newCompanyData, setNewCompanyData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });


  // Check if user is superadmin
  const isSuperAdmin = kullanici?.rol === 'superadmin';

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }

    if (activeTab === 'companies') {
      fetchCompanies();
    } else if (activeTab === 'users') {
      fetchUsers();
    }
  }, [isSuperAdmin, activeTab]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);

      // Fetch companies
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

      // Fetch users for stats
      const usersQuery = query(collection(db, 'kullanicilar'));
      const usersSnapshot = await getDocs(usersQuery);

      // Calculate stats
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const newCompaniesThisMonth = companiesList.filter(
        company => company.createdAt.toDate() >= firstDayOfMonth
      ).length;

      setStats({
        totalCompanies: companiesList.length,
        totalUsers: usersSnapshot.size,
        activeCompanies: companiesList.length, // Assuming all companies are active for now
        newCompaniesThisMonth
      });

    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Şirketler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Kullanıcıları getir
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'kullanicilar'), orderBy('ad'));
      const querySnapshot = await getDocs(q);

      const userList: Kullanici[] = [];
      querySnapshot.forEach((doc) => {
        userList.push({ id: doc.id, ...doc.data() } as Kullanici);
      });

      setUsers(userList);
    } catch (error) {
      console.error('Kullanıcıları getirme hatası:', error);
      toast.error('Kullanıcılar yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'companies') {
      fetchCompanies();
    } else {
      fetchUsers();
    }
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
    // Şirket ID'sini session storage'a kaydet
    sessionStorage.setItem('superadmin_viewing_company', company.id);
    sessionStorage.setItem('superadmin_viewing_company_name', company.name);

    // Anasayfaya yönlendir, buradan kullanıcı diğer sayfalara gidebilir
    window.location.href = '/anasayfa';
  };

  const handleUpdateCompany = async (companyData: Partial<Company>) => {
    if (!selectedCompany) return;

    try {
      setLoading(true);

      await updateDoc(doc(db, 'companies', selectedCompany.id), {
        ...companyData,
        updatedAt: new Date(),
        updatedBy: kullanici?.id
      });

      toast.success('Şirket bilgileri başarıyla güncellendi');

      // Refresh the list
      setIsEditModalOpen(false);
      fetchCompanies();

    } catch (error) {
      console.error('Error updating company:', error);
      toast.error('Şirket güncellenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Kullanıcı deneme süresini uzat
  const handleExtendTrial = async (userId: string, days: number) => {
    try {
      // Kullanıcı bilgilerini al
      const userDoc = await getDoc(doc(db, 'kullanicilar', userId));
      if (!userDoc.exists()) {
        toast.error('Kullanıcı bulunamadı');
        return;
      }

      const userData = userDoc.data();
      let bitisTarihi;

      // Mevcut bitiş tarihi varsa, ona gün ekle
      if (userData.denemeSuresiBitis) {
        const mevcutBitisTarihi = userData.denemeSuresiBitis.toDate();
        bitisTarihi = new Date(mevcutBitisTarihi.getTime() + days * 24 * 60 * 60 * 1000);
      } else {
        // Yoksa şimdiki tarihe gün ekle
        bitisTarihi = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }

      // Kullanıcı bilgilerini güncelle
      await updateDoc(doc(db, 'kullanicilar', userId), {
        denemeSuresiBitis: Timestamp.fromDate(bitisTarihi),
        odemeDurumu: 'deneme'
      });

      // Kullanıcıları yeniden getir
      fetchUsers();

      toast.success(`Deneme süresi ${days} gün uzatıldı`);
    } catch (error) {
      console.error('Deneme süresi uzatma hatası:', error);
      toast.error('Deneme süresi uzatılırken bir hata oluştu');
    }
  };

  // Kullanıcı ödeme durumunu güncelle
  const handleUpdatePaymentStatus = async (userId: string, status: 'deneme' | 'odendi' | 'beklemede' | 'surebitti') => {
    try {
      // Ödendi durumuna geçiş yapılıyorsa, son ödeme tarihi ekle
      const updateData: any = {
        odemeDurumu: status
      };

      if (status === 'odendi') {
        updateData.sonOdemeTarihi = Timestamp.now();
      }

      // Kullanıcı bilgilerini güncelle
      await updateDoc(doc(db, 'kullanicilar', userId), updateData);

      // Kullanıcıları yeniden getir
      fetchUsers();

      toast.success('Ödeme durumu güncellendi');
    } catch (error) {
      console.error('Ödeme durumu güncelleme hatası:', error);
      toast.error('Ödeme durumu güncellenirken bir hata oluştu');
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    try {
      setLoading(true);

      // 1. Get all users in this company
      const usersQuery = query(
        collection(db, 'kullanicilar'),
        where('companyId', '==', companyId)
      );

      const usersSnapshot = await getDocs(usersQuery);

      // 2. Update each user to remove company association
      const userUpdatePromises = usersSnapshot.docs.map(userDoc => 
        updateDoc(doc(db, 'kullanicilar', userDoc.id), {
          companyId: null,
          // Optionally set their role to something else
          rol: 'musteri' // or some other default role
        })
      );

      await Promise.all(userUpdatePromises);

      // 3. Delete the company
      await deleteDoc(doc(db, 'companies', companyId));

      toast.success('Şirket ve ilişkili veriler başarıyla silindi');

      // 4. Refresh the list
      setCompanyToDelete(null);
      fetchCompanies();

    } catch (error) {
      console.error('Error deleting company:', error);
      toast.error('Şirket silinirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = companies.filter(company => 
    company.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (company.email && company.email.toLowerCase().includes(searchText.toLowerCase()))
  );

    const filteredUsers = users.filter(user =>
    user.ad?.toLowerCase().includes(searchText.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchText.toLowerCase())
  );

  // Redirect if not superadmin
  if (!isSuperAdmin) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Erişim Reddedildi</h2>
          <p className="text-gray-600">Bu sayfaya erişim yetkiniz bulunmuyor.</p>
        </div>
      </div>
    );
  }

  if (loading && companies.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Süper Admin Paneli</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tüm şirketleri ve kullanıcıları yönetin
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Yenile
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card decoration="top" decorationColor="blue">
          <Text>Toplam Şirket</Text>
          <Metric>{stats.totalCompanies}</Metric>
        </Card>
        <Card decoration="top" decorationColor="green">
          <Text>Aktif Şirketler</Text>
          <Metric>{stats.activeCompanies}</Metric>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Text>Toplam Kullanıcı</Text>
          <Metric>{stats.totalUsers}</Metric>
        </Card>
        <Card decoration="top" decorationColor="indigo">
          <Text>Bu Ay Yeni Şirket</Text>
          <Metric>{stats.newCompaniesThisMonth}</Metric>
        </Card>
      </div>

      {/* Tab Seçicisi */}
      <div className="flex border-b mb-6">
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'companies'
            ? 'border-b-2 border-primary-500 text-primary-600'
            : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('companies')}
        >
          <Building className="h-5 w-5 inline mr-2" />
          Şirketler
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'users'
            ? 'border-b-2 border-primary-500 text-primary-600'
            : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('users')}
        >
          <Users className="h-5 w-5 inline mr-2" />
          Kullanıcılar
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder={activeTab === 'companies' ? "Şirket ara..." : "Kullanıcı ara..."}
          />
        </div>
      </div>

      {/* Companies List */}
      <Card>
        <Title>
          {activeTab === 'companies' ? 'Şirketler' : 'Kullanıcılar'}
        </Title>
        <div className="mt-6 overflow-x-auto">
          {activeTab === 'companies' ? (
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
                    Oluşturulma Tarihi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kullanıcı Sayısı
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      {searchText ? 'Arama kriterlerine uygun şirket bulunamadı' : 'Henüz şirket bulunmuyor'}
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map((company) => (
                    <tr key={company.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {company.logo ? (
                              <img
                                className="h-10 w-10 rounded-full object-cover"
                                src={company.logo}
                                alt={company.name}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = '/solar-logo.png';
                                }}
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <Building className="h-6 w-6 text-gray-500" />
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{company.name}</div>
                            <div className="text-xs text-gray-500">{company.slogan}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{company.email}</div>
                        <div className="text-sm text-gray-500">{company.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(company.createdAt.toDate(), 'dd MMMM yyyy', { locale: tr })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Users className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">12</span> {/* This would need to be calculated */}
                        </div>
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
                            onClick={() => handleEditCompany(company)}
                            className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                            title="Düzenle"
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => setCompanyToDelete(company.id)}
                            className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                            title="Sil"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleAccessCompanyData(company)}
                            className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                            title="Şirket Verilerine Eriş"
                          >
                            <Users className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kullanıcı
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deneme Durumu
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deneme Bitiş
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      {searchText ? 'Arama kriterlerine uygun kullanıcı bulunamadı' : 'Henüz kullanıcı bulunmuyor'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {user.fotoURL ? (
                              <img
                                className="h-10 w-10 rounded-full object-cover"
                                src={user.fotoURL}
                                alt={user.ad}
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <Users className="h-6 w-6 text-gray-500" />
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.ad}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${user.rol === 'superadmin' ? 'bg-purple-100 text-purple-800' :
                            user.rol === 'yonetici' ? 'bg-blue-100 text-blue-800' :
                              user.rol === 'tekniker' ? 'bg-green-100 text-green-800' :
                                user.rol === 'muhendis' ? 'bg-amber-100 text-amber-800' :
                                  'bg-gray-100 text-gray-800'}`}>
                          {user.rol === 'superadmin' ? 'Süper Admin' :
                            user.rol === 'yonetici' ? 'Yönetici' :
                              user.rol === 'tekniker' ? 'Tekniker' :
                                user.rol === 'muhendis' ? 'Mühendis' :
                                  user.rol === 'musteri' ? 'Müşteri' :
                                    user.rol === 'bekci' ? 'Bekçi' : user.rol}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${user.odemeDurumu === 'deneme' ? 'bg-blue-100 text-blue-800' :
                            user.odemeDurumu === 'odendi' ? 'bg-green-100 text-green-800' :
                              user.odemeDurumu === 'beklemede' ? 'bg-amber-100 text-amber-800' :
                                user.odemeDurumu === 'surebitti' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'}`}>
                          {user.odemeDurumu === 'deneme' ? 'Deneme' :
                            user.odemeDurumu === 'odendi' ? 'Ödendi' :
                              user.odemeDurumu === 'beklemede' ? 'Beklemede' :
                                user.odemeDurumu === 'surebitti' ? 'Süre Bitti' : 'Belirtilmedi'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.denemeSuresiBitis ? (
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1 text-gray-500" />
                            <span className="text-sm text-gray-900">
                              {format(user.denemeSuresiBitis.toDate(), 'dd MMM yyyy', { locale: tr })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Belirtilmedi</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {/* Deneme süresini uzat */}
                          <div className="relative group">
                            <button
                              className="text-amber-600 hover:text-amber-900 p-1 hover:bg-amber-50 rounded"
                              title="Deneme süresini uzat"
                            >
                              <Calendar className="h-5 w-5" />
                            </button>
                            <div className="dropdown-menu absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 hidden group-hover:block">
                              <div className="py-1">
                                <button
                                  onClick={() => handleExtendTrial(user.id, 5)}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  5 gün uzat
                                </button>
                                <button
                                  onClick={() => handleExtendTrial(user.id, 10)}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  10 gün uzat
                                </button>
                                <button
                                  onClick={() => handleExtendTrial(user.id, 30)}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  30 gün uzat
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Ödeme durumunu değiştir */}
                          <div className="relative group">
                            <button
                              className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                              title="Ödeme durumunu değiştir"
                            >
                              <CreditCard className="h-5 w-5" />
                            </button>
                            <div className="dropdown-menu absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 hidden group-hover:block">
                              <div className="py-1">
                                <button
                                  onClick={() => handleUpdatePaymentStatus(user.id, 'deneme')}
                                  className="block w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-blue-100"
                                >
                                  Deneme
                                </button>
                                <button
                                  onClick={() => handleUpdatePaymentStatus(user.id, 'odendi')}
                                  className="block w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-100"
                                >
                                  Ödendi
                                </button>
                                <button
                                  onClick={() => handleUpdatePaymentStatus(user.id, 'beklemede')}
                                  className="block w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-100"
                                >
                                  Beklemede
                                </button>
                                <button
                                  onClick={() => handleUpdatePaymentStatus(user.id, 'surebitti')}
                                  className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-100"
                                >
                                  Süre Bitti
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      {companyToDelete && (
        <SilmeOnayModal
          onConfirm={() => handleDeleteCompany(companyToDelete)}
          onCancel={() => setCompanyToDelete(null)}
          mesaj="Bu şirketi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve şirkete ait tüm veriler silinecektir."
          baslik="Şirket Silme Onayı"
        />
      )}

      {/* View Company Modal */}
      {isViewModalOpen && selectedCompany && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
          <div className="relative mx-auto p-5 border w-full max-w-2xl bg-white rounded-md shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Şirket Detayları</h3>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex justify-center mb-6">
                {selectedCompany.logo ? (
                  <img
                    src={selectedCompany.logo}
                    alt={selectedCompany.name}
                    className="h-20 w-20 rounded-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/solar-logo.png';
                    }}
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center">
                    <Building className="h-10 w-10 text-gray-500" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Şirket Adı</p>
                  <p className="text-base">{selectedCompany.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Slogan</p>
                  <p className="text-base">{selectedCompany.slogan || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">E-posta</p>
                  <p className="text-base">{selectedCompany.email || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Telefon</p>
                  <p className="text-base">{selectedCompany.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Web Sitesi</p>
                  <p className="text-base">{selectedCompany.website || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Adres</p>
                  <p className="text-base">{selectedCompany.address || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Oluşturulma Tarihi</p>
                  <p className="text-base">
                    {format(selectedCompany.createdAt.toDate(), 'dd MMMM yyyy, HH:mm', { locale: tr })}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700```text
 rounded-md hover:bg-gray-200"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Company Modal */}
      {isEditModalOpen && selectedCompany && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
          <div className="relative mx-auto p-5 border w-full max-w-2xl bg-white rounded-md shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Şirket Düzenle</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const companyData = {
                name: formData.get('name') as string,
                slogan: formData.get('slogan') as string,
                email: formData.get('email') as string,
                phone: formData.get('phone') as string,
                website: formData.get('website') as string,
                address: formData.get('address') as string,
              };
              handleUpdateCompany(companyData);
            }}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Şirket Adı *
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    defaultValue={selectedCompany.name}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="slogan" className="block text-sm font-medium text-gray-700">
                    Slogan
                  </label>
                  <input
                    type="text"
                    name="slogan"
                    id="slogan"
                    defaultValue={selectedCompany.slogan || ""}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    E-posta
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    defaultValue={selectedCompany.email || ""}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Telefon
                  </label>
                  <input
                    type="text"
                    name="phone"
                    id="phone"
                    defaultValue={selectedCompany.phone || ""}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                    Web Sitesi
                  </label>
                  <input
                    type="text"
                    name="website"
                    id="website"
                    defaultValue={selectedCompany.website || ""}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                    Adres
                  </label>
                  <textarea
                    name="address"
                    id="address"
                    rows={3}
                    defaultValue={selectedCompany.address || ""}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};