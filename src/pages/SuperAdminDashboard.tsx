import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, deleteDoc, updateDoc, where, Timestamp, addDoc, getDoc } from 'firebase/firestore';
import { db, auth, refreshSuperAdminToken } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Building, Users, Calendar, Trash2, Edit2, Eye, Plus, Search, Filter, RefreshCw, X, Clock, CreditCard, ChevronDown, CheckCircle, AlertTriangle, Mail, Phone } from 'lucide-react';
import { Card, Title, Text, Metric, BarChart } from '@tremor/react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SearchInput } from '../components/SearchInput';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Company } from '../types';
import { Kullanici } from '../types';
import { getAuth } from "firebase/auth";

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

  const auth = getAuth();


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

  // Abonelik süresini yönet
  const handleExtendTrial = async (userId: string, days: number) => {
    try {
      setLoading(true);

      // Token yenileme ve yetki kontrolü
      if (auth.currentUser) {
        try {
          await auth.currentUser.getIdToken(true);
          console.log('Token yenilendi, abonelik güncellemesi başlatılıyor');
        } catch (tokenError) {
          console.error('Token yenileme hatası:', tokenError);
          toast.error('Yetkilendirme hatası. Sayfayı yenileyip tekrar deneyin.');
          return;
        }
      }

      // Kullanıcı bilgilerini al
      const userRef = doc(db, 'kullanicilar', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        toast.error('Kullanıcı bulunamadı');
        return;
      }

      const userData = userDoc.data();
      let bitisTarihi;
      let oncekiBitisTarihi = null;
      let islemTipi = 'yeni';

      // Mevcut bitiş tarihi varsa, ona gün ekle
      if (userData.denemeSuresiBitis) {
        const mevcutBitisTarihi = userData.denemeSuresiBitis.toDate();
        oncekiBitisTarihi = mevcutBitisTarihi;

        // Süre bittiyse, şimdiden itibaren yeni süre ekle
        const simdikiZaman = new Date();
        if (mevcutBitisTarihi < simdikiZaman) {
          bitisTarihi = new Date(simdikiZaman.getTime() + days * 24 * 60 * 60 * 1000);
          islemTipi = 'yenileme';
        } else {
          bitisTarihi = new Date(mevcutBitisTarihi.getTime() + days * 24 * 60 * 60 * 1000);
          islemTipi = 'uzatma';
        }
      } else {
        // Yoksa şimdiki tarihe gün ekle
        bitisTarihi = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        islemTipi = 'yeni';
      }

      // Kullanıcı bilgilerini güncelle
      await updateDoc(userRef, {
        denemeSuresiBitis: Timestamp.fromDate(bitisTarihi),
        odemeDurumu: 'deneme',
        sonGuncelleme: Timestamp.now(),
        guncelleyenId: kullanici?.id || 'system'
      });

      // Abonelik geçmişi koleksiyonuna kayıt ekle
      const abonelikRef = collection(db, 'abonelikGecmisi');
      await addDoc(abonelikRef, {
        kullaniciId: userId,
        kullaniciEmail: userData.email,
        islemTipi: islemTipi,
        eklenenGun: days,
        oncekiBitisTarihi: oncekiBitisTarihi ? Timestamp.fromDate(oncekiBitisTarihi) : null,
        yeniBitisTarihi: Timestamp.fromDate(bitisTarihi),
        islemTarihi: Timestamp.now(),
        islemYapan: {
          id: kullanici?.id || 'system',
          email: kullanici?.email || 'system',
          rol: kullanici?.rol || 'system'
        }
      });

      // Kullanıcı bildirim koleksiyonuna bildirim ekle
      const bildirimRef = collection(db, 'bildirimler');
      await addDoc(bildirimRef, {
        aliciId: userId,
        baslik: 'Abonelik Süresi Güncellendi',
        icerik: `Abonelik süreniz ${days} gün uzatıldı. Yeni bitiş tarihiniz: ${format(bitisTarihi, 'dd MMMM yyyy', { locale: tr })}`,
        tarih: Timestamp.now(),
        okundu: false,
        tur: 'abonelik'
      });

      // Kullanıcıları yeniden getir
      fetchUsers();

      // İşlem tipine göre farklı mesaj göster
      if (islemTipi === 'yeni') {
        toast.success(`${days} günlük yeni abonelik oluşturuldu. Bitiş: ${format(bitisTarihi, 'dd MMMM yyyy', { locale: tr })}`);
      } else if (islemTipi === 'uzatma') {
        toast.success(`Abonelik süresi ${days} gün uzatıldı. Yeni bitiş: ${format(bitisTarihi, 'dd MMMM yyyy', { locale: tr })}`);
      } else {
        toast.success(`Süresi bitmiş abonelik ${days} gün ile yenilendi. Bitiş: ${format(bitisTarihi, 'dd MMMM yyyy', { locale: tr })}`);
      }
    } catch (error) {
      console.error('Abonelik süresi güncelleme hatası:', error);
      toast.error('Abonelik süresi güncellenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Kullanıcı ödeme durumunu güncelle
  const handleUpdatePaymentStatus = async (userId: string, status: 'deneme' | 'odendi' | 'beklemede' | 'surebitti') => {
    try {
      setLoading(true);

      // Token yenileme ve yetki kontrolü
      if (auth.currentUser) {
        try {
          await auth.currentUser.getIdToken(true);
          console.log('Token yenilendi, ödeme durumu güncellemesi başlatılıyor');
        } catch (tokenError) {
          console.error('Token yenileme hatası:', tokenError);
          toast.error('Yetkilendirme hatası. Sayfayı yenileyip tekrar deneyin.');
          return;
        }
      }

      // Kullanıcı bilgilerini al
      const userRef = doc(db, 'kullanicilar', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        toast.error('Kullanıcı bulunamadı');
        return;
      }

      const userData = userDoc.data();
      const oncekiDurum = userData.odemeDurumu || 'belirtilmemiş';

      // Durum güncellemesi için veri hazırla
      const updateData: any = {
        odemeDurumu: status,
        sonGuncelleme: Timestamp.now(),
        guncelleyenId: kullanici?.id || 'system'
      };

      // Durum tipine göre ek bilgiler ekle
      if (status === 'odendi') {
        // Ödeme tarihi ve süresi ekle
        updateData.sonOdemeTarihi = Timestamp.now();

        // Varsayılan olarak 1 yıllık abonelik süresi ekle (opsiyonel)
        const birYilSonra = new Date();
        birYilSonra.setFullYear(birYilSonra.getFullYear() + 1);
        updateData.abonelikBitisTarihi = Timestamp.fromDate(birYilSonra);
      } else if (status === 'surebitti') {
        // Süre bitti olarak işaretlendiğinde erişimi kısıtla
        updateData.erisimKisitlandi = true;
      } else if (status === 'beklemede') {
        // Beklemede ise 7 günlük geçici süre tanımla
        const yediGunSonra = new Date();
        yediGunSonra.setDate(yediGunSonra.getDate() + 7);
        updateData.odemeIstekTarihi = Timestamp.now();
        updateData.odemeDeadline = Timestamp.fromDate(yediGunSonra);
      }

      // Kullanıcı bilgilerini güncelle
      await updateDoc(userRef, updateData);

      // Ödeme geçmişi koleksiyonuna kayıt ekle
      const odemeGecmisiRef = collection(db, 'odemeGecmisi');
      await addDoc(odemeGecmisiRef, {
        kullaniciId: userId,
        kullaniciEmail: userData.email,
        oncekiDurum: oncekiDurum,
        yeniDurum: status,
        islemTarihi: Timestamp.now(),
        islemYapan: {
          id: kullanici?.id || 'system',
          email: kullanici?.email || 'system',
          rol: kullanici?.rol || 'system'
        },
        notlar: `Durumu ${oncekiDurum}'dan ${status}'a güncelledim.`
      });

      // Kullanıcı bildirim koleksiyonuna bildirim ekle
      const bildirimRef = collection(db, 'bildirimler');
      let bildirimBaslik = 'Ödeme Durumu Güncellendi';
      let bildirimIcerik = `Ödeme durumunuz "${status}" olarak güncellendi.`;

      if (status === 'odendi') {
        bildirimBaslik = 'Ödemeniz Alındı';
        bildirimIcerik = 'Ödemeniz başarıyla alındı. Teşekkür ederiz!';
      } else if (status === 'surebitti') {
        bildirimBaslik = 'Abonelik Süresi Sona Erdi';
        bildirimIcerik = 'Abonelik süreniz sona erdi. Hizmetlerimize devam etmek için lütfen ödeme yapın.';
      } else if (status === 'beklemede') {
        bildirimBaslik = 'Ödeme Bekleniyor';
        bildirimIcerik = 'Ödemenizi bekliyoruz. Lütfen 7 gün içinde ödemenizi tamamlayın.';
      }

      await addDoc(bildirimRef, {
        aliciId: userId,
        baslik: bildirimBaslik,
        icerik: bildirimIcerik,
        tarih: Timestamp.now(),
        okundu: false,
        tur: 'odeme'
      });

      // Kullanıcıları yeniden getir
      fetchUsers();

      // Durum tipine göre farklı mesaj göster
      const durumAdlari: Record<string, string> = {
        'deneme': 'Deneme',
        'odendi': 'Ödendi',
        'beklemede': 'Ödeme Bekliyor',
        'surebitti': 'Süre Bitti'
      };

      toast.success(`Kullanıcının ödeme durumu "${durumAdlari[status]}" olarak güncellendi`);
    } catch (error) {
      console.error('Ödeme durumu güncelleme hatası:', error);

      // Firebase hata koduna göre özel mesaj
      if (error.code === 'permission-denied') {
        toast.error('Bu işlem için yetkiniz bulunmuyor. SuperAdmin olarak tekrar giriş yapın.');
      } else {
        toast.error('Ödeme durumu güncellenirken bir hata oluştu');
      }
    } finally {
      setLoading(false);
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

  const handleCountSahaForCompany = async (companyId: string) => {
    try {
      const sahalarCollection = collection(db, 'sahalar');
      const q = query(sahalarCollection, where('companyId', '==', companyId));
      const snapshot = await getDocs(q);
      const sahaSayisi = snapshot.size;

      // Saha sayısını ilgili HTML elementine yazdır
      const sahaCountElement = document.getElementById(`saha-count-${companyId}`);
      if (sahaCountElement) {
        sahaCountElement.textContent = sahaSayisi.toString();
      }
    } catch (error) {
      console.error('Saha sayısı alınırken hata oluştu:', error);
      toast.error('Saha sayısı alınırken bir hata oluştu');
    }
  };

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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saha Sayısı
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Building className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900" id={`saha-count-${company.id}`}>
                            <button 
                              onClick={() => handleCountSahaForCompany(company.id)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Saha sayısını göster"
                            >
                              Yükle
                            </button>
                          </span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Filtreleme ve Sıralama Seçenekleri */}
              <div className="col-span-full mb-4 bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="text-sm font-medium text-gray-700 mr-2">Filtrele:</div>

                  <button className="px-3 py-1.5 text-xs font-medium rounded-full bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition-colors">
                    Tüm Kullanıcılar
                  </button>

                  <button className="px-3 py-1.5 text-xs font-medium rounded-full bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors">
                    Deneme Süresi Aktif
                  </button>

                  <button className="px-3 py-1.5 text-xs font-medium rounded-full bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors">
                    Süresi Bitenler
                  </button>

                  <button className="px-3 py-1.5 text-xs font-medium rounded-full bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors">
                    Yöneticiler
                  </button>

                  <div className="flex-grow"></div>

                  <div className="relative">
                    <select className="appearance-none bg-white border border-gray-200 rounded-lg py-1.5 pl-3 pr-8 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                      <option value="recent">Son Kayıt Olma</option>
                      <option value="name">İsim (A-Z)</option>
                      <option value="expire-soon">Yakında Bitecekler</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    </div>
                  </div>

                  <button 
                    onClick={() => handleRefresh()}
                    className="p-1.5 text-gray-500 hover:text-gray-700 bg-white rounded-full border border-gray-200 hover:bg-gray-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12 bg-white rounded-lg shadow-sm border border-gray-100">
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Kullanıcı Bulunamadı</h3>
                  <p className="text-sm text-gray-500">
                    {searchText ? 'Arama kriterlerine uygun kullanıcı bulunamadı.' : 'Henüz kullanıcı bulunmuyor.'}
                  </p>
                </div>
              ) : (
                <>
                  {filteredUsers.map((user) => (
                    <div key={user.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                      {/* Üst Bölüm: Kullanıcı Bilgileri */}
                      <div className="p-4">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            {user.fotoURL ? (
                              <img
                                className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-100"
                                src={user.fotoURL}
                                alt={user.ad}
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center ring-2 ring-gray-100">
                                <Users className="h-6 w-6 text-primary-600" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-gray-900 truncate">{user.ad}</h3>
                              <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full 
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
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5 flex items-center">
                              <Mail className="h-3 w-3 mr-1 inline flex-shrink-0" />
                              {user.email}
                            </p>
                            {user.telefon && (
                              <p className="text-xs text-gray-500 truncate mt-0.5 flex items-center">
                                <Phone className="h-3 w-3 mr-1 inline flex-shrink-0" />
                                {user.telefon}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Orta Bölüm: Abonelik Durumu */}
                      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-500">Abonelik Durumu</span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full
                              ${user.odemeDurumu === 'deneme' ? 'bg-blue-100 text-blue-800' :
                              user.odemeDurumu === 'odendi' ? 'bg-green-100 text-green-800' :
                              user.odemeDurumu === 'beklemede' ? 'bg-amber-100 text-amber-800' :
                              user.odemeDurumu === 'surebitti' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                              {user.odemeDurumu === 'deneme' ? 'Deneme' :
                                user.odemeDurumu === 'odendi' ? 'Ödendi' :
                                user.odemeDurumu === 'beklemede' ? 'Beklemede' :
                                user.odemeDurumu === 'surebitti' ? 'Süre Bitti' : 'Belirtilmedi'}
                            </span>
                          </div>

                          {user.denemeSuresiBitis ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center text-xs text-gray-600">
                                <Clock className="h-3 w-3 mr-1 text-gray-400" />
                                <span>
                                  {format(user.denemeSuresiBitis.toDate(), 'dd MMM yyyy', { locale: tr })}
                                </span>
                              </div>

                              {(() => {
                                // Kalan süreyi hesapla
                                const simdikiZaman = new Date().getTime();
                                const bitisTarihi = user.denemeSuresiBitis.toDate().getTime();
                                const kalanMilisaniye = bitisTarihi - simdikiZaman;
                                const kalanGun = Math.ceil(kalanMilisaniye / (1000 * 60 * 60 * 24));

                                if (kalanMilisaniye <= 0) {
                                  return (
                                    <span className="text-xs text-red-600 flex items-center font-medium">
                                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1"></span>
                                      Süresi doldu
                                    </span>
                                  );
                                } else if (kalanGun <= 3) {
                                  return (
                                    <span className="text-xs text-red-600 flex items-center font-medium">
                                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1"></span>
                                      {kalanGun} gün kaldı
                                    </span>
                                  );
                                } else if (kalanGun <= 7) {
                                  return (
                                    <span className="text-xs text-amber-600 flex items-center font-medium">
                                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1"></span>
                                      {kalanGun} gün kaldı
                                    </span>
                                  );
                                } else {
                                  return (
                                    <span className="text-xs text-green-600 flex items-center font-medium">
                                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span>
                                      {kalanGun} gün kaldı
                                    </span>
                                  );
                                }
                              })()}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">
                              Bitiş tarihi belirtilmemiş
                            </div>
                          )}

                          {/* İlerleme Çubuğu */}
                          {user.denemeSuresiBitis && (() => {
                            const simdikiZaman = new Date().getTime();
                            const bitisTarihi = user.denemeSuresiBitis.toDate().getTime();
                            const kalanMilisaniye = bitisTarihi - simdikiZaman;

                            // Varsayalım ki deneme süresi 30 gün
                            const toplamSure = 30 * 24 * 60 * 60 * 1000;
                            const gecenSure = toplamSure - kalanMilisaniye;
                            const yuzde = Math.max(0, Math.min(100, (gecenSure / toplamSure) * 100));

                            const bgColor = kalanMilisaniye <= 0 ? 'bg-red-500' : 
                                           kalanMilisaniye <= 7 * 24 * 60 * 60 * 1000 ? 'bg-amber-500' : 
                                           'bg-green-500';

                            return (
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                                <div className={`h-1.5 rounded-full ${bgColor}`} style={{ width: `${yuzde}%` }}></div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Alt Bölüm: İşlemler */}
                      <div className="px-4 py-3 bg-white border-t border-gray-100 flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                          {user.sonOdemeTarihi ? (
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              Son ödeme: {format(user.sonOdemeTarihi.toDate(), 'dd.MM.yyyy', { locale: tr })}
                            </span>
                          ) : user.denemeSuresiBitis ? (
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              Aktif abonelik
                            </span>
                          ) : (
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              Süre tanımlanmamış
                            </span>
                          )}
                        </div>

                        <div className="flex space-x-1">
                          {/* Abonelik düğmesi */}
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              document.getElementById(`abonelik-modal-${user.id}`)?.classList.remove('hidden');
                            }}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors"
                            title="Abonelik süresini yönet"
                          >
                            <Calendar className="h-4 w-4" />
                          </button>

                          {/* Ödeme durumu düğmesi */}
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              document.getElementById(`odeme-modal-${user.id}`)?.classList.remove('hidden');
                            }}
                            className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md transition-colors"
                            title="Ödeme durumunu değiştir"
                          >
                            <CreditCard className="h-4 w-4" />
                          </button>

                          {/* Detay düğmesi */}
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              // TODO: Kullanıcı detay modalı ekle
                            }}
                            className="p-1.5 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-md transition-colors"
                            title="Kullanıcı detayları"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Abonelik yönetimi modal - kodun geri kalanı aynı kalacak */}
                      <div id={`abonelik-modal-${user.id}`} className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 hidden flex justify-center items-center">
                        <div className="bg-white rounded-lg shadow-xl w-96 max-w-full transform transition-all">
                          <div className="bg-gradient-to-r from-amber-100 to-amber-50 rounded-t-lg p-4 border-b border-amber-200">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center">
                                <Calendar className="h-6 w-6 text-amber-700 mr-2" />
                                <h3 className="text-lg font-semibold text-amber-800">Abonelik Yönetimi</h3>
                              </div>
                              <button 
                                onClick={() => document.getElementById(`abonelik-modal-${user.id}`)?.classList.add('hidden')}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                          </div>

                          <div className="p-5">
                            {/* Kullanıcı bilgisi ve mevcut durum */}
                            <div className="mb-5 border-b pb-4">
                              <div className="flex items-center mb-2">
                                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center mr-3">
                                  <Users className="h-6 w-6 text-amber-700" />
                                </div>
                                <div>
                                  <div className="font-medium">{user.ad}</div>
                                  <div className="text-sm text-gray-500">{user.email}</div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between mt-3">
                                <div className="text-sm font-medium text-gray-600">Mevcut abonelik durumu:</div>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full 
                                  ${user.odemeDurumu === 'deneme' ? 'bg-blue-100 text-blue-800' :
                                  user.odemeDurumu === 'odendi' ? 'bg-green-100 text-green-800' :
                                  user.odemeDurumu === 'beklemede' ? 'bg-amber-100 text-amber-800' :
                                  user.odemeDurumu === 'surebitti' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                  {user.odemeDurumu === 'deneme' ? 'Deneme' :
                                  user.odemeDurumu === 'odendi' ? 'Ödendi' :
                                  user.odemeDurumu === 'beklemede' ? 'Beklemede' :
                                  user.odemeDurumu === 'surebitti' ? 'Süre Bitti' : 'Belirtilmedi'}
                                </span>
                              </div>

                              <div className="mt-2">
                                <div className="text-sm font-medium text-gray-600">Bitiş tarihi:</div>
                                <div className="flex items-center mt-1">
                                  <Clock className="h-4 w-4 mr-1 text-gray-500" />
                                  <span className="font-medium">
                                    {user.denemeSuresiBitis ? 
                                      format(user.denemeSuresiBitis.toDate(), 'dd MMMM yyyy', { locale: tr }) : 
                                      'Belirtilmemiş'}
                                  </span>

                                  {user.denemeSuresiBitis && (() => {
                                    // Kalan süreyi hesapla
                                    const simdikiZaman = new Date().getTime();
                                    const bitisTarihi = user.denemeSuresiBitis.toDate().getTime();
                                    const kalanMilisaniye = bitisTarihi - simdikiZaman;
                                    const kalanGun = Math.ceil(kalanMilisaniye / (1000 * 60 * 60 * 24));

                                    if (kalanMilisaniye <= 0) {
                                      return (
                                        <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                                          Süresi doldu
                                        </span>
                                      );
                                    } else if (kalanGun <= 7) {
                                      return (
                                        <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                                          {kalanGun} gün kaldı
                                        </span>
                                      );
                                    } else {
                                      return (
                                        <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                                          {kalanGun} gün kaldı
                                        </span>
                                      );
                                    }
                                  })()}
                                </div>
                              </div>
                            </div>

                            {/* Hızlı süre ekleme seçenekleri */}
                            <div className="mb-5">
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Hızlı Süre Ekle</h4>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => {
                                    handleExtendTrial(user.id, 7);
                                    setTimeout(() => {
                                      document.getElementById(`abonelik-modal-${user.id}`)?.classList.add('hidden');
                                    }, 1000);
                                  }}
                                  className="bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 text-blue-700 border border-blue-200 rounded-md py-2 px-3 flex flex-col items-center transition-all duration-200 transform hover:scale-105"
                                >
                                  <span className="text-xl font-bold">7</span>
                                  <span className="text-xs">Gün</span>
                                </button>
                                <button
                                  onClick={() => {
                                    handleExtendTrial(user.id, 14);
                                    setTimeout(() => {
                                      document.getElementById(`abonelik-modal-${user.id}`)?.classList.add('hidden');
                                    }, 1000);
                                  }}
                                  className="bg-gradient-to-r from-indigo-50 to-indigo-100 hover:from-indigo-100 hover:to-indigo-200 text-indigo-700 border border-indigo-200 rounded-md py-2 px-3 flex flex-col items-center transition-all duration-200 transform hover:scale-105"
                                >
                                  <span className="text-xl font-bold">14</span>
                                  <span className="text-xs">Gün</span>
                                </button>
                                <button
                                  onClick={() => {
                                    handleExtendTrial(user.id, 30);
                                    setTimeout(() => {
                                      document.getElementById(`abonelik-modal-${user.id}`)?.classList.add('hidden');
                                    }, 1000);
                                  }}
                                  className="bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 text-purple-700 border border-purple-200 rounded-md py-2 px-3 flex flex-col items-center transition-all duration-200 transform hover:scale-105"
                                >
                                  <span className="text-xl font-bold">30</span>
                                  <span className="text-xs">Gün</span>
                                </button>
                                <button
                                  onClick={() => {
                                    handleExtendTrial(user.id, 90);
                                    setTimeout(() => {
                                      document.getElementById(`abonelik-modal-${user.id}`)?.classList.add('hidden');
                                    }, 1000);
                                  }}
                                  className="bg-gradient-to-r from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 text-amber-700 border border-amber-200 rounded-md py-2 px-3 flex flex-col items-center transition-all duration-200 transform hover:scale-105"
                                >
                                  <span className="text-xl font-bold">90</span>
                                  <span className="text-xs">Gün</span>
                                </button>
                              </div>
                            </div>

                            {/* Özel süre ekleme */}
                            <div className="mb-5">
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Özel Süre</h4>
                              <div className="flex items-center space-x-2">
                                <div className="relative flex-1">
                                  <input 
                                    type="number" 
                                    min="1" 
                                    max="365"
                                    placeholder="Gün sayısı"
                                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                    id={`custom-days-input-${user.id}`}
                                  />
                                </div>
                                <button
                                  onClick={() => {
                                    const input = document.getElementById(`custom-days-input-${user.id}`) as HTMLInputElement;
                                    const days = parseInt(input.value);
                                    if (days > 0) {
                                      handleExtendTrial(user.id, days);
                                      input.value = '';
                                      setTimeout(() => {
                                        document.getElementById(`abonelik-modal-${user.id}`)?.classList.add('hidden');
                                      }, 1000);
                                    }
                                  }}
                                  className="bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-lg transition-all duration-200"
                                >
                                  Ekle
                                </button>
                              </div>
                            </div>

                            {/* Paket seçenekleri */}
                            <div className="mb-5">
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Paket Seçenekleri</h4>
                              <div className="space-y-2">
                                <button
                                  onClick={() => {
                                    handleExtendTrial(user.id, 365);
                                    handleUpdatePaymentStatus(user.id, 'odendi');
                                    setTimeout(() => {
                                      document.getElementById(`abonelik-modal-${user.id}`)?.classList.add('hidden');
                                    }, 1000);
                                  }}
                                  className="w-full border border-green-300 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-lg py-3 px-4 flex justify-between items-center"
                                >
                                  <div className="flex items-center">
                                    <div className="h-8 w-8 rounded-full bg-green-200 flex items-center justify-center mr-3">
                                      <CheckCircle className="h-5 w-5 text-green-700" />
                                    </div>
                                    <div className="text-left">
                                      <div className="font-medium text-green-800">Yıllık Paket</div>
                                      <div className="text-xs text-green-600">365 gün, ödendi olarak işaretler</div>
                                    </div>
                                  </div>
                                  <div className="text-green-700 font-bold">1 Yıl</div>
                                </button>

                                <button
                                  onClick={() => {
                                    handleExtendTrial(user.id, 180);
                                    handleUpdatePaymentStatus(user.id, 'odendi');
                                    setTimeout(() => {
                                      document.getElementById(`abonelik-modal-${user.id}`)?.classList.add('hidden');
                                    }, 1000);
                                  }}
                                  className="w-full border border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-lg py-3 px-4 flex justify-between items-center"
                                >
                                  <div className="flex items-center">
                                    <div className="h-8 w-8 rounded-full bg-blue-200 flex items-center justify-center mr-3">
                                      <CheckCircle className="h-5 w-5 text-blue-700" />
                                    </div>
                                    <div className="text-left">
                                      <div className="font-medium text-blue-800">6 Aylık Paket</div>
                                      <div className="text-xs text-blue-600">180 gün, ödendi olarak işaretler</div>
                                    </div>
                                  </div>
                                  <div className="text-blue-700 font-bold">6 Ay</div>
                                </button>
                              </div>
                            </div>

                            {/* Bilgilendirme */}
                            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                              <p>Süre uzatıldığında kullanıcıya otomatik bildirim gönderilir ve abonelik geçmişine kayıt eklenir.</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Ödeme durumu modal - kodun geri kalanı aynı kalacak */}
                      <div id={`odeme-modal-${user.id}`} className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 hidden flex justify-center items-center">
                        <div className="bg-white rounded-lg shadow-xl w-96 max-w-full transform transition-all">
                          <div className="bg-gradient-to-r from-green-100 to-green-50 rounded-t-lg p-4 border-b border-green-200">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center">
                                <CreditCard className="h-6 w-6 text-green-700 mr-2" />
                                <h3 className="text-lg font-semibold text-green-800">Ödeme Durumu</h3>
                              </div>
                              <button 
                                onClick={() => document.getElementById(`odeme-modal-${user.id}`)?.classList.add('hidden')}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                          </div>

                          <div className="p-5">
                            {/* Kullanıcı bilgisi ve mevcut durum */}
                            <div className="mb-5 border-b pb-4">
                              <div className="flex items-center mb-2">
                                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                                  <Users className="h-6 w-6 text-green-700" />
                                </div>
                                <div>
                                  <div className="font-medium">{user.ad}</div>
                                  <div className="text-sm text-gray-500">{user.email}</div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between mt-3">
                                <div className="text-sm font-medium text-gray-600">Mevcut ödeme durumu:</div>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full 
                                  ${user.odemeDurumu === 'deneme' ? 'bg-blue-100 text-blue-800' :
                                  user.odemeDurumu === 'odendi' ? 'bg-green-100 text-green-800' :
                                  user.odemeDurumu === 'beklemede' ? 'bg-amber-100 text-amber-800' :
                                  user.odemeDurumu === 'surebitti' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                  {user.odemeDurumu === 'deneme' ? 'Deneme' :
                                  user.odemeDurumu === 'odendi' ? 'Ödendi' :
                                  user.odemeDurumu === 'beklemede' ? 'Beklemede' :
                                  user.odemeDurumu === 'surebitti' ? 'Süre Bitti' : 'Belirtilmedi'}
                                </span>
                              </div>
                            </div>

                            {/* Ödeme durumu seçenekleri */}
                            <div className="space-y-3 mb-5">
                              <h4 className="text-sm font-semibold text-gray-700 mb-2">Ödeme Durumunu Güncelle</h4>
                              <button
                                onClick={() => {
                                  handleUpdatePaymentStatus(user.id, 'odendi');
                                  setTimeout(() => {
                                    document.getElementById(`odeme-modal-${user.id}`)?.classList.add('hidden');
                                  }, 1000);
                                }}
                                className="w-full border border-green-300 bg-white hover:bg-green-50 rounded-lg py-3 px-4 flex items-center transition-all duration-200"
                              >
                                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                                  <CheckCircle className="h-5 w-5 text-green-700" />
                                </div>
                                <div className="text-left">
                                  <div className="font-medium text-green-800">Ödendi</div>
                                  <div className="text-xs text-green-600">Abonelik ücreti tam olarak ödendi</div>
                                </div>
                              </button>

                              <button
                                onClick={() => {
                                  handleUpdatePaymentStatus(user.id, 'deneme');
                                  setTimeout(() => {
                                    document.getElementById(`odeme-modal-${user.id}`)?.classList.add('hidden');
                                  }, 1000);
                                }}
                                className="w-full border border-blue-300 bg-white hover:bg-blue-50 rounded-lg py-3 px-4 flex items-center transition-all duration-200"
                              >
                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                                  <Clock className="h-5 w-5 text-blue-700" />
                                </div>
                                <div className="text-left">
                                  <div className="font-medium text-blue-800">Deneme</div>
                                  <div className="text-xs text-blue-600">Ücretsiz deneme süresi kullanımda</div>
                                </div>
                              </button>

                              <button
                                onClick={() => {
                                  handleUpdatePaymentStatus(user.id, 'beklemede');
                                  setTimeout(() => {
                                    document.getElementById(`odeme-modal-${user.id}`)?.classList.add('hidden');
                                  }, 1000);
                                }}
                                className="w-full border border-amber-300 bg-white hover:bg-amber-50 rounded-lg py-3 px-4 flex items-center transition-all duration-200"
                              >
                                <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center mr-3">
                                  <Clock className="h-5 w-5 text-amber-700" />
                                </div>
                                <div className="text-left">
                                  <div className="font-medium text-amber-800">Beklemede</div>
                                  <div className="text-xs text-amber-600">Ödeme bekleniyor (7 gün geçici erişim)</div>
                                </div>
                              </button>

                              <button
                                onClick={() => {
                                  handleUpdatePaymentStatus(user.id, 'surebitti');
                                  setTimeout(() => {
                                    document.getElementById(`odeme-modal-${user.id}`)?.classList.add('hidden');
                                  }, 1000);
                                }}
                                className="w-full border border-red-300 bg-white hover:bg-red-50 rounded-lg py-3 px-4 flex items-center transition-all duration-200"
                              >
                                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center mr-3">
                                  <AlertTriangle className="h-5 w-5 text-red-700" />
                                </div>
                                <div className="text-left">
                                  <div className="font-medium text-red-800">Süre Bitti</div>
                                  <div className="text-xs text-red-600">Abonelik süresi doldu, erişim kısıtlanacak</div>
                                </div>
                              </button>
                            </div>

                            {/* Bilgilendirme */}
                            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                              <p>Ödeme durumu değiştirildiğinde kullanıcıya otomatik bildirim gönderilir ve ödeme geçmişine kayıt eklenir.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Sayfalar arası geçiş kontrolü */}
                  <div className="col-span-full mt-4 flex justify-center">
                    <nav className="flex items-center space-x-1 text-sm">
                      <button className="px-2 py-1 rounded text-gray-400 bg-white border border-gray-200 cursor-not-allowed">
                        Önceki
                      </button>
                      <button className="px-3 py-1 rounded text-white bg-primary-600 border border-primary-600">
                        1
                      </button>
                      <button className="px-3 py-1 rounded text-gray-700 bg-white border border-gray-200 hover:bg-gray-50">
                        2
                      </button>
                      <button className="px-3 py-1 rounded text-gray-700 bg-white border border-gray-200 hover:bg-gray-50">
                        ```text
3
                      </button>
                      <button className="px-2 py-1 rounded text-gray-700 bg-white border border-gray-200 hover:bg-gray-50">
                        Sonraki
                      </button>
                    </nav>
                  </div>
                </>
              )}
            </div>
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
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
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