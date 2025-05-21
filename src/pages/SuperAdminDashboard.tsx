import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Building, Users, Calendar, Trash2, Edit2, Eye, Plus, Search, Filter, RefreshCw } from 'lucide-react';
import { Card, Title, Text, Metric, BarChart } from '@tremor/react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SearchInput } from '../components/SearchInput';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Company } from '../types';

export const SuperAdminDashboard: React.FC = () => {
  const { kullanici } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalCompanies: 0,
    totalUsers: 0,
    activeCompanies: 0,
    newCompaniesThisMonth: 0
  });

  // Check if user is superadmin
  const isSuperAdmin = kullanici?.rol === 'superadmin';

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }

    fetchCompanies();
  }, [isSuperAdmin]);

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

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCompanies();
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

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder="Şirket ara..."
          />
        </div>
      </div>

      {/* Companies List */}
      <Card>
        <Title>Şirketler</Title>
        <div className="mt-6 overflow-x-auto">
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
                          className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded"
                          title="Görüntüle"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        <button
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
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
    </div>
  );
};