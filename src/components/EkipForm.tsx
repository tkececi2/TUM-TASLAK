import React, { useState, useEffect } from 'react';
import { createUserWithProfile } from '../lib/firebase';
import { X, MapPin } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import toast from 'react-hot-toast';
import type { KullaniciRolu, Kullanici, Saha } from '../types';

interface Props {
  onClose: () => void;
  editUser?: Kullanici | null;
}

interface EkipFormu {
  ad: string;
  email: string;
  telefon: string;
  rol: KullaniciRolu;
  sifre: string;
  sifreTekrar: string;
  sahalar: { [key: string]: boolean };
}

export const EkipForm: React.FC<Props> = ({ onClose, editUser }) => {
  const { kullanici } = useAuth();
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sahalar, setSahalar] = useState<Saha[]>([]);
  const [form, setForm] = useState<EkipFormu>({
    ad: editUser?.ad || '',
    email: editUser?.email || '',
    telefon: editUser?.telefon || '',
    rol: editUser?.rol || 'tekniker',
    sifre: '',
    sifreTekrar: '',
    sahalar: typeof editUser?.sahalar === 'object' && !Array.isArray(editUser?.sahalar) 
      ? editUser.sahalar 
      : {}
  });

  // Sahaları getir
  useEffect(() => {
    const fetchSahalar = async () => {
      if (!kullanici?.companyId) return;
      
      try {
        const sahaQuery = query(
          collection(db, 'sahalar'),
          where('companyId', '==', kullanici.companyId)
        );
        const sahaSnapshot = await getDocs(sahaQuery);
        const sahaListesi = sahaSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Saha[];
        setSahalar(sahaListesi);
      } catch (error) {
        console.error('Sahalar getirilemedi:', error);
        toast.error('Sahalar yüklenirken bir hata oluştu');
      }
    };

    fetchSahalar();
  }, [kullanici?.companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editUser && form.sifre !== form.sifreTekrar) {
      toast.error('Şifreler eşleşmiyor');
      return;
    }

    if (!editUser && form.sifre.length < 6) {
      toast.error('Şifre en az 6 karakter olmalıdır');
      return;
    }

    if (!kullanici?.companyId) {
      toast.error('Şirket bilgisi bulunamadı');
      return;
    }

    setYukleniyor(true);

    try {
      if (editUser) {
        // Mevcut kullanıcıyı güncelle
        await updateDoc(doc(db, 'kullanicilar', editUser.id), {
          ad: form.ad,
          telefon: form.telefon || '',
          rol: form.rol,
          sahalar: form.sahalar,
          guncellenmeTarihi: new Date()
        });
        toast.success('Kullanıcı bilgileri güncellendi');
      } else {
        // Yeni kullanıcı oluştur
        const userData = {
          ad: form.ad,
          email: form.email,
          telefon: form.telefon || '',
          rol: form.rol,
          companyId: kullanici.companyId,
          sahalar: form.sahalar,
          fotoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(form.ad)}&background=random`
        };

        await createUserWithProfile(form.email, form.sifre, userData);
        toast.success('Ekip üyesi başarıyla eklendi');
      }
      onClose();
    } catch (error) {
      console.error('Ekip üyesi kaydetme hatası:', error);
    } finally {
      setYukleniyor(false);
    }
  };

  const handleSahaToggle = (sahaId: string) => {
    setForm(prev => ({
      ...prev,
      sahalar: {
        ...prev.sahalar,
        [sahaId]: !prev.sahalar[sahaId]
      }
    }));
  };

  // Sadece bekçi, müşteri ve teknikerler için saha ataması göster
  const showSahaAtaması = ['bekci', 'musteri', 'tekniker'].includes(form.rol);

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">
            {editUser ? 'Ekip Üyesi Düzenle' : 'Yeni Ekip Üyesi Ekle'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Ad Soyad
              </label>
              <input
                type="text"
                required
                value={form.ad}
                onChange={e => setForm(prev => ({ ...prev, ad: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                E-posta
              </label>
              <input
                type="email"
                required={!editUser}
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                disabled={!!editUser}
              />
            </div>

            {!editUser && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Şifre
                  </label>
                  <input
                    type="password"
                    required
                    value={form.sifre}
                    onChange={e => setForm(prev => ({ ...prev, sifre: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Şifre Tekrar
                  </label>
                  <input
                    type="password"
                    required
                    value={form.sifreTekrar}
                    onChange={e => setForm(prev => ({ ...prev, sifreTekrar: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
                  />
                </div>
              </>
            )}

            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700">
                Telefon
              </label>
              <input
                type="tel"
                value={form.telefon}
                onChange={e => setForm(prev => ({ ...prev, telefon: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Rol
              </label>
              <select
                required
                value={form.rol}
                onChange={e => setForm(prev => ({ ...prev, rol: e.target.value as KullaniciRolu }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
              >
                <option value="tekniker">Tekniker</option>
                <option value="muhendis">Mühendis</option>
                <option value="yonetici">Yönetici</option>
                <option value="bekci">Bekçi</option>
              </select>
            </div>
          </div>

          {showSahaAtaması && sahalar.length > 0 && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <MapPin className="h-4 w-4 inline mr-2" />
                Saha Atamaları
              </label>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                  {sahalar.map((saha) => (
                    <label key={saha.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={!!form.sahalar[saha.id]}
                        onChange={() => handleSahaToggle(saha.id)}
                        className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {saha.ad} - {saha.konum}
                      </span>
                    </label>
                  ))}
                </div>
                {sahalar.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    Henüz saha eklenmemiş
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={yukleniyor}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50"
            >
              {yukleniyor ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">{editUser ? 'Güncelleniyor...' : 'Ekleniyor...'}</span>
                </>
              ) : (
                editUser ? 'Güncelle' : 'Ekle'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};