import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { Sun, Mail, Lock, User, Building, Check, X } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

interface Invitation {
  email: string;
  companyId: string;
  companyName: string;
  role: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  createdBy: string;
  used: boolean;
}

export const InviteUser: React.FC = () => {
  const { inviteId } = useParams<{ inviteId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [expired, setExpired] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const fetchInvitation = async () => {
      if (!inviteId) {
        navigate('/login');
        return;
      }

      try {
        setLoading(true);
        const inviteDoc = await getDoc(doc(db, 'invitations', inviteId));
        
        if (!inviteDoc.exists()) {
          toast.error('Davet bulunamadı veya geçersiz');
          navigate('/login');
          return;
        }
        
        const inviteData = inviteDoc.data() as Invitation;
        
        // Check if invitation is already used
        if (inviteData.used) {
          toast.error('Bu davet daha önce kullanılmış');
          navigate('/login');
          return;
        }
        
        // Check if invitation is expired
        const now = new Date();
        if (inviteData.expiresAt.toDate() < now) {
          setExpired(true);
          setInvitation(inviteData);
          return;
        }
        
        setInvitation(inviteData);
      } catch (error) {
        console.error('Error fetching invitation:', error);
        toast.error('Davet bilgileri yüklenirken bir hata oluştu');
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [inviteId, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invitation) return;
    
    // Validate form
    if (form.password !== form.confirmPassword) {
      toast.error('Şifreler eşleşmiyor');
      return;
    }
    
    if (form.password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır');
      return;
    }
    
    if (!form.fullName.trim()) {
      toast.error('Ad Soyad gereklidir');
      return;
    }

    setLoading(true);

    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        invitation.email, 
        form.password
      );
      
      const user = userCredential.user;
      
      // 2. Create user profile in Firestore
      await setDoc(doc(db, 'kullanicilar', user.uid), {
        ad: form.fullName,
        email: invitation.email,
        rol: invitation.role,
        companyId: invitation.companyId,
        fotoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(form.fullName)}&background=random`,
        olusturmaTarihi: Timestamp.now()
      });
      
      // 3. Mark invitation as used
      await updateDoc(doc(db, 'invitations', inviteId!), {
        used: true,
        usedAt: Timestamp.now(),
        userId: user.uid
      });

      toast.success('Hesabınız başarıyla oluşturuldu! Giriş yapabilirsiniz.');
      navigate('/login');
    } catch (error: any) {
      console.error('Kayıt hatası:', error);
      let errorMessage = 'Kayıt sırasında bir hata oluştu';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Bu e-posta adresi zaten kullanımda. Lütfen giriş yapın.';
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <X className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Davet Süresi Dolmuş</h2>
            <p className="text-gray-600 mb-6">
              Bu davet linki artık geçerli değil. Lütfen yöneticinizden yeni bir davet göndermesini isteyin.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              Giriş Sayfasına Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <X className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Geçersiz Davet</h2>
            <p className="text-gray-600 mb-6">
              Bu davet linki geçersiz veya daha önce kullanılmış. Lütfen yöneticinizle iletişime geçin.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              Giriş Sayfasına Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center mb-6">
          <Sun className="h-12 w-12 text-primary-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Davetinizi Kabul Edin</h2>
          <p className="text-gray-600 mt-2">
            <span className="font-medium">{invitation.companyName}</span> şirketine katılmak için hesabınızı oluşturun
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              E-posta
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                value={invitation.email}
                disabled
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Davet edilen e-posta adresi değiştirilemez
            </p>
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
              Şirket
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={invitation.companyName}
                disabled
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
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
                'Hesabı Oluştur ve Katıl'
              )}
            </button>
          </div>

          <div className="text-center text-sm">
            <p className="text-gray-600">
              Zaten bir hesabınız var mı?{' '}
              <button 
                type="button"
                onClick={() => navigate('/login')}
                className="text-primary-600 hover:text-primary-800 font-medium"
              >
                Giriş yapın
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};