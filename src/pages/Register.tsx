import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sun, Mail, Lock, User, Building, Phone, ArrowRight } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import toast from 'react-hot-toast';

export const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    companyName: '',
    phone: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (form.password !== form.confirmPassword) {
      toast.error('Şifreler eşleşmiyor');
      return;
    }
    
    if (form.password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır');
      return;
    }
    
    if (!form.companyName.trim()) {
      toast.error('Şirket adı gereklidir');
      return;
    }

    setLoading(true);

    try {
      // Check if email already exists
      const signInMethods = await fetchSignInMethodsForEmail(auth, form.email);
      if (signInMethods.length > 0) {
        toast.error('Bu e-posta adresi zaten kullanımda. Lütfen giriş yapın veya farklı bir e-posta adresi kullanın.');
        navigate('/login', { state: { email: form.email } });
        return;
      }

      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        form.email, 
        form.password
      );
      
      const user = userCredential.user;
      
      try {
        // 2. Create company in Firestore
        const companyRef = await addDoc(collection(db, 'companies'), {
          name: form.companyName,
          createdAt: Timestamp.now(),
          createdBy: user.uid,
          email: form.email,
          phone: form.phone || null
        });
        
        // 3. Create user profile in Firestore
        await setDoc(doc(db, 'kullanicilar', user.uid), {
          ad: form.fullName,
          email: form.email,
          telefon: form.phone || '',
          rol: 'yonetici', // Company creator is automatically an admin
          fotoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(form.fullName)}&background=random`,
          olusturmaTarihi: Timestamp.now(),
          companyId: companyRef.id // Link user to company
        });
        
        // 4. Create default company settings
        await setDoc(doc(db, 'ayarlar', companyRef.id), {
          sirketAdi: form.companyName,
          slogan: 'Güneş Enerjisi Yönetimi',
          logoURL: '/solar-logo.png',
          guncellenmeTarihi: Timestamp.now(),
          guncelleyenKullanici: {
            id: user.uid,
            ad: form.fullName
          }
        });

        toast.success('Hesabınız başarıyla oluşturuldu! Giriş yapabilirsiniz.');
        navigate('/login');
      } catch (firestoreError) {
        // If Firestore operations fail, delete the auth user to maintain consistency
        await user.delete();
        throw firestoreError;
      }
    } catch (error: any) {
      console.error('Kayıt hatası:', error);
      let errorMessage = 'Kayıt sırasında bir hata oluştu';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Bu e-posta adresi zaten kullanımda';
        navigate('/login', { state: { email: form.email } });
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Geçersiz e-posta adresi';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Şifre çok zayıf';
      } else if (error.code === 'permission-denied') {
        errorMessage = 'İşlem için yeterli izniniz yok. Lütfen sistem yöneticisi ile iletişime geçin.';
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Arkaplan deseni */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
      
      <div className="relative flex min-h-screen">
        {/* Sol Bölüm - Tanıtım */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-50 to-primary-100 p-12 flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-primary-500/5 backdrop-blur-[1px]"></div>
          
          <div className="relative">
            <div className="flex items-center space-x-3">
              <Sun className="h-12 w-12 text-primary-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Solar Takip</h1>
                <p className="text-sm text-gray-600">Güneş Enerjisi Yönetimi</p>
              </div>
            </div>

            <div className="mt-12 space-y-8 animate-fade-in">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  Şirketinizi Oluşturun
                </h2>
                <p className="mt-4 text-lg text-gray-600">
                  Güneş enerjisi sistemlerinizi profesyonel bir şekilde yönetmek için 
                  hemen şirketinizi oluşturun ve ekibinizi davet edin.
                </p>
              </div>

              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-md">
                <h3 className="font-semibold text-gray-900 mb-2">Kayıt olarak elde edeceğiniz avantajlar:</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-center">
                    <ArrowRight className="h-4 w-4 text-primary-500 mr-2" />
                    Tüm arıza kayıtlarınızı tek bir yerden yönetin
                  </li>
                  <li className="flex items-center">
                    <ArrowRight className="h-4 w-4 text-primary-500 mr-2" />
                    Ekip üyelerinize farklı yetkiler atayın
                  </li>
                  <li className="flex items-center">
                    <ArrowRight className="h-4 w-4 text-primary-500 mr-2" />
                    Detaylı raporlar ve analizlerle performansı takip edin
                  </li>
                  <li className="flex items-center">
                    <ArrowRight className="h-4 w-4 text-primary-500 mr-2" />
                    Müşterilerinize özel erişim sağlayın
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="relative">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} Solar Takip. Tüm hakları saklıdır.
            </p>
          </div>
        </div>

        {/* Sağ Bölüm - Kayıt Formu */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-8 animate-scale">
            <div className="text-center">
              <div className="lg:hidden flex justify-center mb-6">
                <Sun className="h-12 w-12 text-primary-500" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900">
                Hesap Oluşturun
              </h2>
              <p className="mt-2 text-gray-600">
                Şirketiniz için yeni bir hesap oluşturun
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-xl ring-1 ring-gray-900/5">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Şirket Adı
                  </label>
                  <div className="mt-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      name="companyName"
                      required
                      value={form.companyName}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Şirketinizin adı"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Ad Soyad
                  </label>
                  <div className="mt-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      name="fullName"
                      required
                      value={form.fullName}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Adınız ve soyadınız"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    E-posta adresi
                  </label>
                  <div className="mt-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      name="email"
                      required
                      value={form.email}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="ornek@sirketiniz.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Telefon (Opsiyonel)
                  </label>
                  <div className="mt-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="(555) 123 4567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Şifre
                  </label>
                  <div className="mt-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="password"
                      name="password"
                      required
                      value={form.password}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="En az 6 karakter"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Şifre Tekrar
                  </label>
                  <div className="mt-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="password"
                      name="confirmPassword"
                      required
                      value={form.confirmPassword}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Şifrenizi tekrar girin"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <LoadingSpinner size="sm" />
                        <span className="ml-2">Hesap oluşturuluyor...</span>
                      </div>
                    ) : (
                      'Hesap Oluştur'
                    )}
                  </button>
                </div>

                <div className="text-center text-sm">
                  <p className="text-gray-600">
                    Zaten bir hesabınız var mı?{' '}
                    <Link to="/login" className="text-primary-600 hover:text-primary-800 font-medium">
                      Giriş yapın
                    </Link>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};