import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { Company } from '../types';
import toast from 'react-hot-toast';

interface CompanyContextType {
  currentCompany: Company | null;
  loading: boolean;
  error: string | null;
  refreshCompany: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType>({
  currentCompany: null,
  loading: true,
  error: null,
  refreshCompany: async () => {}
});

export const useCompany = () => useContext(CompanyContext);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { kullanici } = useAuth();
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompany = async () => {
    if (!kullanici) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // If user has a companyId, fetch that company
      if (kullanici.companyId) {
        const companyDoc = await getDoc(doc(db, 'companies', kullanici.companyId));
        
        if (companyDoc.exists()) {
          setCurrentCompany({
            id: companyDoc.id,
            ...companyDoc.data()
          } as Company);
        } else {
          setError('Şirket bulunamadı');
          toast.error('Bağlı olduğunuz şirket bulunamadı. Lütfen yöneticinizle iletişime geçin.');
        }
      } 
      // Süper admin işlemleri
      else if (kullanici.rol === 'superadmin') {
        // Eğer süper admin bir şirketin verilerine göz atıyorsa
        const viewingCompanyId = sessionStorage.getItem('superadmin_viewing_company');
        
        if (viewingCompanyId) {
          // Süper admin başka bir şirketin verilerine erişiyor
          const companyDoc = await getDoc(doc(db, 'companies', viewingCompanyId));
          
          if (companyDoc.exists()) {
            setCurrentCompany({
              id: companyDoc.id,
              ...companyDoc.data()
            } as Company);
            
            // Bilgilendirme mesajı göster
            const companyName = sessionStorage.getItem('superadmin_viewing_company_name') || 'Şirket';
            toast.success(`${companyName} verilerine erişim sağlandı (Süper Admin modunda)`, {
              duration: 4000,
              position: 'top-right'
            });
          } else {
            setCurrentCompany(null);
            sessionStorage.removeItem('superadmin_viewing_company');
            sessionStorage.removeItem('superadmin_viewing_company_name');
          }
        } else {
          // Normal süper admin durumu - şirket yok
          setCurrentCompany(null);
        }
      } 
      // If no companyId but not superadmin, something is wrong
      else {
        setError('Kullanıcı bir şirkete bağlı değil');
        toast.error('Hesabınız bir şirkete bağlı değil. Lütfen yöneticinizle iletişime geçin.');
      }
    } catch (err) {
      console.error('Şirket bilgileri getirilemedi:', err);
      setError('Şirket bilgileri yüklenirken bir hata oluştu');
      toast.error('Şirket bilgileri yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompany();
  }, [kullanici]);

  const refreshCompany = async () => {
    await fetchCompany();
  };

  return (
    <CompanyContext.Provider value={{ currentCompany, loading, error, refreshCompany }}>
      {children}
    </CompanyContext.Provider>
  );
};