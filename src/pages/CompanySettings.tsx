import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { Building, Image as ImageIcon, Upload, Check, X, Mail, Phone, Globe, MapPin, Users } from 'lucide-react';
import { Card, Title, Text } from '@tremor/react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { UserInviteModal } from '../components/UserInviteModal';
import toast from 'react-hot-toast';

export const CompanySettings: React.FC = () => {
  const { kullanici } = useAuth();
  const { currentCompany, refreshCompany } = useCompany();
  const [yukleniyor, setYukleniyor] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [form, setForm] = useState({
    name: '',
    slogan: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    logo: null as File | null
  });

  useEffect(() => {
    if (currentCompany) {
      setForm({
        name: currentCompany.name || '',
        slogan: currentCompany.slogan || '',
        email: currentCompany.email || '',
        phone: currentCompany.phone || '',
        website: currentCompany.website || '',
        address: currentCompany.address || '',
        logo: null
      });
    }
  }, [currentCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kullanici || !currentCompany) return;

    // Validate user is admin
    if (kullanici.rol !== 'yonetici' && kullanici.rol !== 'superadmin') {
      toast.error('Bu işlem için yönetici yetkisi gerekiyor');
      return;
    }

    setYukleniyor(true);
    try {
      let logoURL = currentCompany.logo;

      if (form.logo) {
        // Dosya tipi kontrolü
        if (!form.logo.type.startsWith('image/')) {
          throw new Error('Sadece resim dosyaları yüklenebilir');
        }

        // Dosya boyutu kontrolü (2MB)
        if (form.logo.size > 2 * 1024 * 1024) {
          throw new Error('Logo dosyası 2MB\'dan küçük olmalıdır');
        }

        // Yeni bir timestamp ekleyerek önbelleği atla
        const timestamp = new Date().getTime();
        const storageRef = ref(storage, `companies/${currentCompany.id}/logo_${timestamp}`);
        
        try {
          const snapshot = await uploadBytes(storageRef, form.logo);
          logoURL = await getDownloadURL(snapshot.ref);
        } catch (uploadError: any) {
          if (uploadError.code === 'storage/unauthorized') {
            throw new Error('Logo yükleme yetkisi bulunmuyor. Yönetici olduğunuzdan emin olun.');
          }
          throw uploadError;
        }
      }

      // Update company document
      await updateDoc(doc(db, 'companies', currentCompany.id), {
        name: form.name,
        slogan: form.slogan,
        email: form.email,
        phone: form.phone,
        website: form.website,
        address: form.address,
        logo: logoURL,
        updatedAt: new Date(),
        updatedBy: kullanici.id
      });

      // Update company settings in ayarlar collection
      await setDoc(doc(db, 'ayarlar', 'sirket'), {
        sirketAdi: form.name,
        slogan: form.slogan,
        logoURL: logoURL,
        guncellenmeTarihi: new Date(),
        guncelleyenKullanici: {
          id: kullanici.id,
          ad: kullanici.ad
        }
      });

      toast.success('Şirket bilgileri başarıyla güncellendi');
      refreshCompany();
      
    } catch (error: any) {
      console.error('Şirket bilgileri güncelleme hatası:', error);
      toast.error(error.message || 'Şirket bilgileri güncellenirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  const handleLogoSecimi = () => {
    fileInputRef.current?.click();
  };

  const handleLogoYukleme = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Dosya boyutu kontrolü (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Logo dosyası 2MB\'dan küçük olmalıdır');
        return;
      }
      
      // Dosya tipi kontrolü
      if (!file.type.startsWith('image/')) {
        toast.error('Sadece resim dosyaları yüklenebilir');
        return;
      }
      
      setForm(prev => ({
        ...prev,
        logo: file
      }));
    }
  };

  if (!currentCompany) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-500">Şirket bilgileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Check if user has permission
  if (kullanici?.rol !== 'yonetici' && kullanici?.rol !== 'superadmin') {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <X className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Erişim Reddedildi</h2>
          <p className="text-gray-500">Bu sayfaya erişim için yönetici yetkisine sahip olmanız gerekiyor.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Şirket Ayarları</h1>
          <p className="mt-1 text-sm text-gray-500">
            Şirket bilgilerinizi ve görünüm ayarlarınızı yönetin
          </p>
        </div>
        <button
          onClick={() => setInviteModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
        >
          <Users className="h-5 w-5 mr-2" />
          Kullanıcı Davet Et
        </button>
      </div>

      <Card>
        <Title>Şirket Bilgileri</Title>
        <Text className="mt-2">
          Bu ayarlar, uygulamanın görünümünü ve markalamasını değiştirir. Değişiklikler tüm kullanıcılar için geçerli olacaktır.
        </Text>
        
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Logo Yükleme */}
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Şirket Logosu
              </label>
              <div className="flex flex-col items-center">
                <div className="relative w-40 h-40 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
                  {form.logo ? (
                    <img 
                      src={URL.createObjectURL(form.logo)} 
                      alt="Yeni Logo" 
                      className="w-full h-full object-contain"
                    />
                  ) : currentCompany.logo ? (
                    <img 
                      src={currentCompany.logo} 
                      alt="Mevcut Logo" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-12 w-12 text-gray-400" />
                  )}
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleLogoYukleme}
                  />
                  
                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 flex items-center justify-center transition-all duration-200">
                    <button
                      type="button"
                      onClick={handleLogoSecimi}
                      className="bg-white rounded-full p-2 shadow-lg opacity-0 hover:opacity-100 transition-opacity duration-200"
                    >
                      <Upload className="h-5 w-5 text-gray-600" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  PNG, JPG, GIF formatında, max 2MB
                </p>
                {form.logo && (
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, logo: null }))}
                    className="mt-2 text-xs text-red-600 hover:text-red-800 flex items-center"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Seçimi İptal Et
                  </button>
                )}
              </div>
            </div>
            
            {/* Şirket Bilgileri */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Şirket Adı
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  placeholder="Şirket adını girin"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Bu isim, uygulamanın sol üst köşesinde görünecektir.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Slogan
                </label>
                <input
                  type="text"
                  value={form.slogan}
                  onChange={(e) => setForm(prev => ({ ...prev, slogan: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  placeholder="Şirket sloganını girin"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Bu slogan, şirket adının altında görünecektir.
                </p>
              </div>
              
              <div className="pt-4">
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <Check className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">Önizleme</h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden mr-2">
                            {form.logo ? (
                              <img 
                                src={URL.createObjectURL(form.logo)} 
                                alt="Logo Önizleme" 
                                className="w-full h-full object-contain"
                              />
                            ) : currentCompany.logo ? (
                              <img 
                                src={currentCompany.logo} 
                                alt="Logo Önizleme" 
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <Building className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold">{form.name || currentCompany.name}</p>
                            <p className="text-xs">{form.slogan || currentCompany.slogan}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* İletişim Bilgileri */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">İletişim Bilgileri</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  <Mail className="h-4 w-4 inline mr-2" />
                  E-posta Adresi
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  placeholder="ornek@sirketiniz.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  <Phone className="h-4 w-4 inline mr-2" />
                  Telefon
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  placeholder="(555) 123 4567"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  <Globe className="h-4 w-4 inline mr-2" />
                  Web Sitesi
                </label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm(prev => ({ ...prev, website: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  placeholder="https://www.sirketiniz.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  <MapPin className="h-4 w-4 inline mr-2" />
                  Adres
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  placeholder="Şirket adresi"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={yukleniyor}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
            >
              {yukleniyor ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Kaydediliyor...</span>
                </>
              ) : (
                'Şirket Bilgilerini Güncelle'
              )}
            </button>
          </div>
        </form>
      </Card>

      {inviteModalOpen && (
        <UserInviteModal onClose={() => setInviteModalOpen(false)} />
      )}
    </div>
  );
};