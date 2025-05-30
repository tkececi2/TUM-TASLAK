
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Save, MapPin, Zap, Calendar, Settings, Building } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

interface SantralForm {
  ad: string;
  konum: {
    il: string;
    ilce: string;
    adres: string;
  };
  kapasite: number;
  yillikHedefUretim: number;
  kurulumTarihi: string;
  modulTipi: string;
  invertorTipi: string;
  durum: 'aktif' | 'bakim' | 'devre_disi';
  panelSayisi: number;
  invertorSayisi: number;
  aylikHedefler: Record<string, number>;
}

export const SantralEkle: React.FC = () => {
  const { kullanici } = useAuth();
  const navigate = useNavigate();
  const [yukleniyor, setYukleniyor] = useState(false);
  const [form, setForm] = useState<SantralForm>({
    ad: '',
    konum: {
      il: '',
      ilce: '',
      adres: ''
    },
    kapasite: 0,
    yillikHedefUretim: 0,
    kurulumTarihi: '',
    modulTipi: '',
    invertorTipi: '',
    durum: 'aktif',
    panelSayisi: 0,
    invertorSayisi: 0,
    aylikHedefler: {
      ocak: 0, subat: 0, mart: 0, nisan: 0, mayis: 0, haziran: 0,
      temmuz: 0, agustos: 0, eylul: 0, ekim: 0, kasim: 0, aralik: 0
    }
  });

  const turkiyeIlleri = [
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin',
    'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa',
    'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan',
    'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta',
    'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir',
    'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla',
    'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt',
    'Sinop', 'Sivas', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak',
    'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman',
    'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce'
  ];

  const aylar = [
    { key: 'ocak', label: 'Ocak' },
    { key: 'subat', label: 'Şubat' },
    { key: 'mart', label: 'Mart' },
    { key: 'nisan', label: 'Nisan' },
    { key: 'mayis', label: 'Mayıs' },
    { key: 'haziran', label: 'Haziran' },
    { key: 'temmuz', label: 'Temmuz' },
    { key: 'agustos', label: 'Ağustos' },
    { key: 'eylul', label: 'Eylül' },
    { key: 'ekim', label: 'Ekim' },
    { key: 'kasim', label: 'Kasım' },
    { key: 'aralik', label: 'Aralık' }
  ];

  const handleInputChange = (field: string, value: any) => {
    if (field.startsWith('konum.')) {
      const konumField = field.split('.')[1];
      setForm(prev => ({
        ...prev,
        konum: {
          ...prev.konum,
          [konumField]: value
        }
      }));
    } else if (field.startsWith('aylikHedefler.')) {
      const ay = field.split('.')[1];
      setForm(prev => ({
        ...prev,
        aylikHedefler: {
          ...prev.aylikHedefler,
          [ay]: Number(value) || 0
        }
      }));
    } else {
      setForm(prev => ({ ...prev, [field]: value }));
    }
  };

  const otomatikHesapla = () => {
    if (form.kapasite > 0) {
      // Yıllık hedef üretimi otomatik hesapla (kWp * 1400 kWh/kWp ortalama)
      const yillikHedef = form.kapasite * 1400;
      setForm(prev => ({ ...prev, yillikHedefUretim: yillikHedef }));

      // Aylık hedefleri güneş radyasyonuna göre dağıt
      const aylikOranlar = {
        ocak: 0.06, subat: 0.07, mart: 0.09, nisan: 0.10, mayis: 0.11, haziran: 0.12,
        temmuz: 0.12, agustos: 0.11, eylul: 0.09, ekim: 0.08, kasim: 0.06, aralik: 0.05
      };

      const yeniAylikHedefler = {} as Record<string, number>;
      Object.entries(aylikOranlar).forEach(([ay, oran]) => {
        yeniAylikHedefler[ay] = Math.round(yillikHedef * oran);
      });

      setForm(prev => ({ ...prev, aylikHedefler: yeniAylikHedefler }));

      // Panel ve invertör sayısını tahmin et
      const panelGucu = 550; // Ortalama 550W panel
      const panelSayisi = Math.ceil(form.kapasite * 1000 / panelGucu);
      const invertorSayisi = Math.ceil(panelSayisi / 25); // 25 panel per inverter

      setForm(prev => ({
        ...prev,
        panelSayisi,
        invertorSayisi
      }));

      toast.success('Otomatik hesaplamalar tamamlandı');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!kullanici?.companyId) {
      toast.error('Şirket bilgisi bulunamadı');
      return;
    }

    // Form validasyonu
    if (!form.ad.trim()) {
      toast.error('Santral adı gereklidir');
      return;
    }

    if (!form.konum.il || !form.konum.ilce) {
      toast.error('Konum bilgileri gereklidir');
      return;
    }

    if (form.kapasite <= 0) {
      toast.error('Geçerli bir kapasite değeri giriniz');
      return;
    }

    if (!form.kurulumTarihi) {
      toast.error('Kurulum tarihi gereklidir');
      return;
    }

    try {
      setYukleniyor(true);

      const santralData = {
        ad: form.ad.trim(),
        konum: {
          il: form.konum.il,
          ilce: form.konum.ilce,
          adres: form.konum.adres.trim()
        },
        kapasite: form.kapasite,
        yillikHedefUretim: form.yillikHedefUretim,
        kurulumTarihi: Timestamp.fromDate(new Date(form.kurulumTarihi)),
        modulTipi: form.modulTipi.trim(),
        invertorTipi: form.invertorTipi.trim(),
        durum: form.durum,
        panelSayisi: form.panelSayisi,
        invertorSayisi: form.invertorSayisi,
        aylikHedefler: form.aylikHedefler,
        companyId: kullanici.companyId,
        olusturanKisi: {
          id: kullanici.id,
          ad: kullanici.ad
        },
        olusturmaTarihi: Timestamp.now()
      };

      await addDoc(collection(db, 'santraller'), santralData);
      
      toast.success('Santral başarıyla eklendi');
      navigate('/ges-yonetimi');
    } catch (error) {
      console.error('Santral ekleme hatası:', error);
      toast.error('Santral eklenirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Üst Başlık */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/ges-yonetimi')}
              className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Building className="h-6 w-6 mr-2 text-blue-600" />
                Yeni Santral Ekle
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Güneş enerji santralı bilgilerini ekleyin
              </p>
            </div>
          </div>
          <button
            onClick={otomatikHesapla}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Settings className="h-4 w-4 mr-2" />
            Otomatik Hesapla
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Temel Bilgiler */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Building className="h-5 w-5 mr-2 text-blue-600" />
            Temel Bilgiler
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Santral Adı *
              </label>
              <input
                type="text"
                value={form.ad}
                onChange={(e) => handleInputChange('ad', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Örn: Merkez GES"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durum
              </label>
              <select
                value={form.durum}
                onChange={(e) => handleInputChange('durum', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="aktif">Aktif</option>
                <option value="bakim">Bakımda</option>
                <option value="devre_disi">Devre Dışı</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kurulum Tarihi *
              </label>
              <input
                type="date"
                value={form.kurulumTarihi}
                onChange={(e) => handleInputChange('kurulumTarihi', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kurulu Güç (kWp) *
              </label>
              <input
                type="number"
                value={form.kapasite || ''}
                onChange={(e) => handleInputChange('kapasite', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Örn: 1000"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>
        </div>

        {/* Konum Bilgileri */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <MapPin className="h-5 w-5 mr-2 text-green-600" />
            Konum Bilgileri
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İl *
              </label>
              <select
                value={form.konum.il}
                onChange={(e) => handleInputChange('konum.il', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">İl seçiniz</option>
                {turkiyeIlleri.map(il => (
                  <option key={il} value={il}>{il}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İlçe *
              </label>
              <input
                type="text"
                value={form.konum.ilce}
                onChange={(e) => handleInputChange('konum.ilce', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="İlçe adı"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adres
              </label>
              <textarea
                value={form.konum.adres}
                onChange={(e) => handleInputChange('konum.adres', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Detaylı adres bilgisi"
              />
            </div>
          </div>
        </div>

        {/* Teknik Bilgiler */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Zap className="h-5 w-5 mr-2 text-yellow-600" />
            Teknik Bilgiler
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Panel Sayısı
              </label>
              <input
                type="number"
                value={form.panelSayisi || ''}
                onChange={(e) => handleInputChange('panelSayisi', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Örn: 2000"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İnvertör Sayısı
              </label>
              <input
                type="number"
                value={form.invertorSayisi || ''}
                onChange={(e) => handleInputChange('invertorSayisi', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Örn: 80"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Panel Tipi
              </label>
              <input
                type="text"
                value={form.modulTipi}
                onChange={(e) => handleInputChange('modulTipi', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Örn: Monokristal 550W"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                İnvertör Tipi
              </label>
              <input
                type="text"
                value={form.invertorTipi}
                onChange={(e) => handleInputChange('invertorTipi', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Örn: String İnvertör 100kW"
              />
            </div>
          </div>
        </div>

        {/* Üretim Hedefleri */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-purple-600" />
            Üretim Hedefleri
          </h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Yıllık Hedef Üretim (kWh)
            </label>
            <input
              type="number"
              value={form.yillikHedefUretim || ''}
              onChange={(e) => handleInputChange('yillikHedefUretim', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Örn: 1400000"
              min="0"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {aylar.map(ay => (
              <div key={ay.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {ay.label} (kWh)
                </label>
                <input
                  type="number"
                  value={form.aylikHedefler[ay.key] || ''}
                  onChange={(e) => handleInputChange(`aylikHedefler.${ay.key}`, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Kaydet Butonu */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/ges-yonetimi')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={yukleniyor}
              className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {yukleniyor ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Santralı Kaydet
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SantralEkle;
