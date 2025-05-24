import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Sun, Mail, Lock, ArrowRight, CheckCircle } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import toast from 'react-hot-toast';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { girisYap, kullanici } = useAuth();

  useEffect(() => {
    const isLoggedOut = sessionStorage.getItem('isLoggedOut') === 'true' || 
                       localStorage.getItem('isLoggedOut') === 'true';
    
    if (isLoggedOut) {
      return;
    }

    if (kullanici) {
      const from = (location.state as any)?.from?.pathname || '/anasayfa';
      navigate(from, { replace: true });
    }
  }, [kullanici, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if the browser is online
    if (!navigator.onLine) {
      toast.error('İnternet bağlantınız yok. Lütfen bağlantınızı kontrol edin ve tekrar deneyin.');
      return;
    }
    
    // Form validasyonu
    if (!email || !password) {
      toast.error('Lütfen e-posta ve şifre alanlarını doldurun');
      return;
    }
    
    setLoading(true);

    try {
      const success = await girisYap(email, password);
      if (success) {
        const from = (location.state as any)?.from?.pathname || '/anasayfa';
        navigate(from, { replace: true });
      }
    } catch (error) {
      console.error('Login error:', error);
      // Özel hata mesajı göster
      if (error instanceof TypeError) {
        toast.error('Giriş işlemi sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
      }
      // Diğer hatalar AuthContext içindeki girisYap fonksiyonunda ele alınıyor
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      toast.error('Lütfen e-posta adresinizi girin');
      return;
    }

    // Check if the browser is online
    if (!navigator.onLine) {
      toast.error('İnternet bağlantınız yok. Lütfen bağlantınızı kontrol edin ve tekrar deneyin.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
      toast.success('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi');
    } catch (error: any) {
      console.error('Password reset error:', error);
      let errorMessage = 'Şifre sıfırlama bağlantısı gönderilemedi';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Bu e-posta adresiyle kayıtlı bir kullanıcı bulunamadı';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Geçersiz e-posta adresi';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin';
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: <Sun className="h-6 w-6 text-primary-500" />,
      title: "Solar Panel İzleme",
      description: "Güneş enerjisi sistemlerinizi 7/24 uzaktan izleme ve kontrol"
    },
    {
      icon: <ArrowRight className="h-6 w-6 text-primary-500" />,
      title: "Hızlı Müdahale",
      description: "Arıza durumlarında anında bildirim ve hızlı teknik destek"
    },
    {
      icon: <CheckCircle className="h-6 w-6 text-primary-500" />,
      title: "Verimlilik Analizi",
      description: "Detaylı raporlama ve performans analizi ile maksimum verim"
    }
  ];

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

            <div className="mt-12 space-y-12 animate-fade-in">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  Solar Panel Arıza Takip Sistemi
                </h2>
                <p className="mt-4 text-gray-600">Güneş enerjisi sistemlerinizi 7/24 izleyin ve yönetin. Arıza durumlarında anında müdahale edin.</p>
              </div>

              <div className="space-y-8">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    {feature.icon}
                    <div>
                      <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                      <p className="text-gray-600">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative">
            <p className="text-sm text-gray-600">
              © 2024 Solar Takip. Tüm hakları saklıdır.
            </p>
          </div>
        </div>

        {/* Sağ Bölüm - Giriş Formu */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-8">
            {!forgotPassword ? (
              <>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    Hoş Geldiniz
                  </h2>
                  <p className="mt-2 text-gray-600">
                    Hesabınıza giriş yapın
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      E-posta
                    </label>
                    <div className="mt-1 relative">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        placeholder="ornek@email.com"
                      />
                      <Mail className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                      Şifre
                    </label>
                    <div className="mt-1 relative">
                      <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        placeholder="••••••••"
                      />
                      <Lock className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <button
                        type="button"
                        onClick={() => setForgotPassword(true)}
                        className="font-medium text-primary-600 hover:text-primary-500"
                      >
                        Şifremi unuttum
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <LoadingSpinner /> : 'Giriş Yap'}
                  </button>
                </form>

                <div className="text-center text-sm">
                  <p className="text-gray-600">
                    Hesabınız yok mu?{' '}
                    <Link to="/register" className="font-medium text-primary-600 hover:text-primary-500">
                      Hesap Oluşturun
                    </Link>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    Şifre Sıfırlama
                  </h2>
                  <p className="mt-2 text-gray-600">
                    E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim
                  </p>
                </div>

                {resetSent ? (
                  <div className="text-center">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Şifre sıfırlama bağlantısı gönderildi</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Lütfen e-posta kutunuzu kontrol edin
                    </p>
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotPassword(false);
                          setResetSent(false);
                        }}
                        className="text-sm font-medium text-primary-600 hover:text-primary-500"
                      >
                        Giriş sayfasına dön
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handlePasswordReset} className="space-y-6">
                    <div>
                      <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700">
                        E-posta
                      </label>
                      <div className="mt-1 relative">
                        <input
                          id="reset-email"
                          name="email"
                          type="email"
                          required
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                          placeholder="ornek@email.com"
                        />
                        <Mail className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setForgotPassword(false)}
                        className="text-sm font-medium text-primary-600 hover:text-primary-500"
                      >
                        Giriş sayfasına dön
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? <LoadingSpinner /> : 'Şifre sıfırlama bağlantısı gönder'}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;