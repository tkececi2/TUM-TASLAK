import React, { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { X, Mail, Users, Calendar, Copy, Check } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import toast from 'react-hot-toast';

interface UserInviteModalProps {
  onClose: () => void;
}

export const UserInviteModal: React.FC<UserInviteModalProps> = ({ onClose }) => {
  const { kullanici } = useAuth();
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    role: 'tekniker',
    expiresIn: 7 // days
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!kullanici || !currentCompany) {
      toast.error('Şirket bilgisi bulunamadı');
      return;
    }

    if (!form.email) {
      toast.error('E-posta adresi gereklidir');
      return;
    }

    setLoading(true);

    try {
      // Calculate expiration date
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (form.expiresIn * 24 * 60 * 60 * 1000));

      // Create invitation document
      const inviteRef = await addDoc(collection(db, 'invitations'), {
        email: form.email,
        role: form.role,
        companyId: currentCompany.id,
        companyName: currentCompany.name,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(expiresAt),
        createdBy: kullanici.id,
        used: false
      });

      // Generate invite link
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/invite/${inviteRef.id}`;

      setInviteLink(link);
      toast.success('Davet başarıyla oluşturuldu');

    } catch (error) {
      console.error('Error creating invitation:', error);
      toast.error('Davet oluşturulurken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!inviteLink) return;

    navigator.clipboard.writeText(inviteLink)
      .then(() => {
        setCopied(true);
        toast.success('Davet linki kopyalandı');
        setTimeout(() => setCopied(false), 3000);
      })
      .catch(() => {
        toast.error('Link kopyalanamadı');
      });
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">
            {inviteLink ? 'Davet Oluşturuldu' : 'Kullanıcı Davet Et'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {inviteLink ? (
            <div className="space-y-6">
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Check className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Davet Başarıyla Oluşturuldu</h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>
                        Aşağıdaki linki kullanıcıya gönderin. Bu link {form.expiresIn} gün boyunca geçerli olacaktır.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Davet Linki
                </label>
                <div className="flex">
                  <input
                    type="text"
                    readOnly
                    value={inviteLink}
                    className="flex-1 block w-full rounded-l-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    {copied ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <Copy className="h-5 w-5 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">Not:</span> Bu davet linki, kullanıcı tarafından kullanıldıktan sonra geçersiz olacaktır.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Kapat
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  E-posta Adresi
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
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    placeholder="ornek@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Kullanıcı Rolü
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  >
                    <option value="tekniker">Tekniker</option>
                    <option value="muhendis">Mühendis</option>
                    <option value="yonetici">Yönetici</option>
                    <option value="musteri">Müşteri</option>
                    <option value="bekci">Bekçi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Davet Geçerlilik Süresi
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    name="expiresIn"
                    value={form.expiresIn}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  >
                    <option value={1}>1 gün</option>
                    <option value={3}>3 gün</option>
                    <option value={7}>7 gün</option>
                    <option value={14}>14 gün</option>
                    <option value={30}>30 gün</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Oluşturuluyor...</span>
                    </>
                  ) : (
                    'Davet Oluştur'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};