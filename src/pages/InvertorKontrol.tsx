import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useMenuNotifications } from '../contexts/MenuNotificationContext';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  PlusCircle, LayoutGrid, List, SlidersHorizontal, Trash2, Edit3, Eye, AlertCircle, CheckCircle, Search, Power, Calendar
} from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { InvertorKontrolForm } from '../components/InvertorKontrolForm';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import { InvertorKontrolDetayModal } from '../components/InvertorKontrolDetayModal';
import type { InvertorKontrol as InvertorKontrolType, Saha } from '../types';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 9;

export const InvertorKontrol: React.FC = () => {
  const { kullanici } = useAuth();
  const { markPageAsSeen } = useMenuNotifications();
  const [kontroller, setKontroller] = useState<InvertorKontrolType[]>([]);
  const [originalKontroller, setOriginalKontroller] = useState<InvertorKontrolType[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenecekKontrol, setDuzenlenecekKontrol] = useState<InvertorKontrolType | null>(null);
  const [silinecekKontrolId, setSilinecekKontrolId] = useState<string | null>(null);
  const [seciliKontrolDetay, setSeciliKontrolDetay] = useState<InvertorKontrolType | null>(null);
  const [sahalar, setSahalar] = useState<Pick<Saha, 'id' | 'ad'>[]>([]);
  
  const [secilenSaha, setSecilenSaha] = useState<string>('');
  const [secilenAy, setSecilenAy] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [aramaMetni, setAramaMetni] = useState('');
  const [gorunumTipi, setGorunumTipi] = useState<'kart' | 'liste'>('kart'); // 'liste' görünümü daha sonra eklenebilir
  const [currentPage, setCurrentPage] = useState(1);

  const canAddOrEdit = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);
  const canDelete = kullanici?.rol === 'yonetici' || (kullanici?.rol && ['tekniker', 'muhendis'].includes(kullanici.rol));

  const getSahaAdi = useCallback((sahaId: string) => {
    return sahalar.find(s => s.id === sahaId)?.ad || 'Bilinmeyen Saha';
  }, [sahalar]);

  // Sahaları Getir
  useEffect(() => {
    const sahalariGetir = async () => {
      if (!kullanici?.companyId) return;
      try {
        let sahaQuery;
        if (kullanici.rol === 'musteri' && kullanici.sahalar && Array.isArray(kullanici.sahalar) && kullanici.sahalar.length > 0) {
          sahaQuery = query(collection(db, 'sahalar'), where('__name__', 'in', kullanici.sahalar), orderBy('ad'));
        } else {
          sahaQuery = query(collection(db, 'sahalar'), where('companyId', '==', kullanici.companyId), orderBy('ad'));
        }
        const sahaSnapshot = await getDocs(sahaQuery);
        const sahaListesi = sahaSnapshot.docs.map(doc => ({ id: doc.id, ad: doc.data().ad as string }));
        setSahalar(sahaListesi);
      } catch (error) {
        console.error('Sahalar getirilemedi:', error);
        toast.error('Sahalar yüklenirken bir hata oluştu.');
      }
    };
    sahalariGetir();
  }, [kullanici]);

  // İnvertör Kontrollerini Getir ve Filtrele
  useEffect(() => {
    const kontrolleriGetir = async () => {
      if (!kullanici?.companyId) return;
      
      // Sayfa görüldü olarak işaretle
      markPageAsSeen('invertorKontrol');
      
      setYukleniyor(true);
      try {
        let q = query(collection(db, 'invertorKontroller'), where('companyId', '==', kullanici.companyId));

        if (kullanici.rol === 'musteri' && kullanici.sahalar && Array.isArray(kullanici.sahalar) && kullanici.sahalar.length > 0) {
          q = query(q, where('sahaId', 'in', kullanici.sahalar));
        } else if (kullanici.rol === 'musteri') {
           // Müşterinin sahası yoksa veya tanımsızsa hiçbir şey gösterme
          setOriginalKontroller([]);
          setKontroller([]);
          setYukleniyor(false);
          return;
        }

        const snapshot = await getDocs(q);
        let veriler = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InvertorKontrolType));
        veriler.sort((a, b) => b.tarih.toDate().getTime() - a.tarih.toDate().getTime()); // En son eklenenler üste
        setOriginalKontroller(veriler);
        
      } catch (error) {
        console.error('İnvertör kontrolleri getirilemedi:', error);
        toast.error('İnvertör kontrol kayıtları yüklenirken bir hata oluştu.');
        setOriginalKontroller([]);
      } finally {
        setYukleniyor(false);
      }
    };

    if (kullanici?.companyId) {
        kontrolleriGetir();
    }
  }, [kullanici]);

  // Filtreleme Mantığı
  useEffect(() => {
    let filtrelenmis = [...originalKontroller];

    // Ay filtresi
    if (secilenAy) {
      const ayBaslangic = startOfMonth(parseISO(secilenAy + '-01'));
      const ayBitis = endOfMonth(parseISO(secilenAy + '-01'));
      filtrelenmis = filtrelenmis.filter(k => {
        const kontrolTarihi = k.tarih.toDate();
        return kontrolTarihi >= ayBaslangic && kontrolTarihi <= ayBitis;
      });
    }

    // Saha filtresi
    if (secilenSaha) {
      filtrelenmis = filtrelenmis.filter(k => k.sahaId === secilenSaha);
    }

    // Arama metni filtresi (Saha Adı, İnvertör Adları, Açıklama)
    if (aramaMetni) {
      const kucukAramaMetni = aramaMetni.toLowerCase();
      filtrelenmis = filtrelenmis.filter(k => 
        getSahaAdi(k.sahaId).toLowerCase().includes(kucukAramaMetni) ||
        (k.aciklama && k.aciklama.toLowerCase().includes(kucukAramaMetni)) ||
        k.invertorler.some(inv => inv.ad.toLowerCase().includes(kucukAramaMetni))
      );
    }
    setKontroller(filtrelenmis);
    setCurrentPage(1); // Filtre değiştiğinde ilk sayfaya dön
  }, [secilenAy, secilenSaha, aramaMetni, originalKontroller, getSahaAdi]);

  const handleKontrolSil = async (id: string) => {
    if (!canDelete) {
      toast.error('Bu işlem için yetkiniz yok.');
      return;
    }
    try {
      setYukleniyor(true);
      await deleteDoc(doc(db, 'invertorKontroller', id));
      toast.success('İnvertör kontrol kaydı başarıyla silindi.');
      setSilinecekKontrolId(null);
      // Veriyi yeniden çekmek yerine state'den kaldıralım
      setOriginalKontroller(prev => prev.filter(k => k.id !== id));
    } catch (error) {
      console.error('Silme hatası:', error);
      toast.error('Kayıt silinirken bir hata oluştu.');
    } finally {
      setYukleniyor(false);
    }
  };

  const refreshData = () => {
    // Veriyi yeniden çekmek için originalKontroller'i tetikle
    if (kullanici?.companyId) {
        setYukleniyor(true);
        const kontrolleriGetir = async () => {
            try {
                let q = query(collection(db, 'invertorKontroller'), where('companyId', '==', kullanici.companyId));
                if (kullanici.rol === 'musteri' && kullanici.sahalar && Array.isArray(kullanici.sahalar) && kullanici.sahalar.length > 0) {
                    q = query(q, where('sahaId', 'in', kullanici.sahalar));
                }
                const snapshot = await getDocs(q);
                let veriler = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InvertorKontrolType));
                veriler.sort((a, b) => b.tarih.toDate().getTime() - a.tarih.toDate().getTime());
                setOriginalKontroller(veriler);
            } catch (error) {
                console.error('İnvertör kontrolleri getirilemedi:', error);
                toast.error('Veriler yenilenirken bir hata oluştu.');
            } finally {
                setYukleniyor(false);
            }
        };
        kontrolleriGetir();
    }
  };

  const handleFormOpen = (kontrol?: InvertorKontrolType) => {
    setDuzenlenecekKontrol(kontrol || null);
    setFormAcik(true);
  };

  // Sayfalama için hesaplamalar
  const totalPages = Math.ceil(kontroller.length / ITEMS_PER_PAGE);
  const paginatedKontroller = kontroller.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (yukleniyor && !originalKontroller.length) { // Sadece ilk yüklemede tam ekran spinner
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="w-full space-y-6">
        {/* Header */}
        <header className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="mb-4 md:mb-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                İnvertör Kontrolleri
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {secilenSaha ? sahalar.find(s => s.id === secilenSaha)?.ad || 'Seçili Saha' : 'Tüm Sahalar'} ({format(parseISO(secilenAy + '-01'), 'MMMM yyyy', { locale: tr })})
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {canAddOrEdit && (
                <button
                  onClick={() => handleFormOpen()}
                  className="flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <PlusCircle size={18} className="mr-2" />
                  Yeni Kontrol Ekle
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label htmlFor="sahaFiltre" className="block text-xs font-medium text-gray-700 mb-1">Saha</label>
              <select
                id="sahaFiltre"
                value={secilenSaha}
                onChange={(e) => setSecilenSaha(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">Tüm Sahalar</option>
                {sahalar.map(s => (
                  <option key={s.id} value={s.id}>{s.ad}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="ayFiltre" className="block text-xs font-medium text-gray-700 mb-1">Ay/Yıl</label>
              <input
                type="month"
                id="ayFiltre"
                value={secilenAy}
                onChange={(e) => setSecilenAy(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            
            <div>
              <label htmlFor="aramaFiltre" className="block text-xs font-medium text-gray-700 mb-1">Ara (Saha, İnvertör, Açıklama...)</label>
              <div className="relative">
                <input
                  type="text"
                  id="aramaFiltre"
                  value={aramaMetni}
                  onChange={(e) => setAramaMetni(e.target.value)}
                  placeholder="Kontrollerde ara..."
                  className="w-full px-3 py-2 pl-10 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-1 bg-gray-100 p-0.5 rounded-lg">
              {[
                { view: 'kart', icon: LayoutGrid, label: 'Kart' },
                { view: 'liste', icon: List, label: 'Liste' },
              ].map((item) => (
                <button
                  key={item.view}
                  onClick={() => setGorunumTipi(item.view as 'kart' | 'liste')}
                  title={item.label}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    gorunumTipi === item.view 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                  }`}
                >
                  <item.icon size={16} className="mx-auto"/>
                  <span className="sr-only">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Area */}
        {yukleniyor && originalKontroller.length > 0 && (
          <div className="absolute inset-x-0 top-0 pt-20 flex justify-center z-50">
            <div className="p-2 bg-white rounded-full shadow-lg">
                <LoadingSpinner size="md" />
            </div>
          </div>
        )}

        {paginatedKontroller.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedKontroller.map(kontrol => {
              const sorunluDizeSayisi = kontrol.invertorler.filter(inv => !inv.dizeCalisiyor).length;
              return (
                <div 
                  key={kontrol.id} 
                  className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col"
                >
                  <div className="p-5 space-y-3 flex-grow">
                    <div className="flex justify-between items-start">
                      <h2 className="text-lg font-semibold text-slate-800 mb-1">
                        {getSahaAdi(kontrol.sahaId)}
                      </h2>
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${sorunluDizeSayisi > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {sorunluDizeSayisi > 0 ? `${sorunluDizeSayisi} Sorunlu Dize` : 'Tüm Dizeler Çalışıyor'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      <Calendar className="inline-block h-4 w-4 mr-1.5 align-text-bottom text-blue-500"/>
                      {format(kontrol.tarih.toDate(), 'dd MMMM yyyy, HH:mm', { locale: tr })}
                    </p>
                    <p className="text-sm text-slate-600">
                      <Power className="inline-block h-4 w-4 mr-1.5 align-text-bottom text-slate-500"/>
                      {kontrol.invertorler.length} invertör kontrol edildi.
                    </p>
                    {kontrol.aciklama && (
                      <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md line-clamp-2">
                        {kontrol.aciklama}
                      </p>
                    )}
                  </div>
                  <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-end space-x-2">
                    <button 
                        onClick={() => setSeciliKontrolDetay(kontrol)} 
                        className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-100 rounded-md transition-colors" title="Detayları Gör">
                        <Eye className="h-5 w-5"/>
                    </button> 
                    {canAddOrEdit && (
                      <button 
                        onClick={() => handleFormOpen(kontrol)} 
                        className="p-2 text-slate-600 hover:text-green-600 hover:bg-green-100 rounded-md transition-colors" title="Düzenle">
                        <Edit3 className="h-5 w-5"/>
                      </button>
                    )}
                    {canDelete && (
                      <button 
                        onClick={() => setSilinecekKontrolId(kontrol.id)} 
                        className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-100 rounded-md transition-colors" title="Sil">
                        <Trash2 className="h-5 w-5"/>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          !yukleniyor && (
            <div className="text-center py-10 bg-white rounded-lg border border-gray-200 shadow-sm">
              <AlertCircle size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Kayıt Bulunamadı</h3>
              <p className="text-sm text-gray-500 mb-4">
                Seçili kriterlere uygun invertör kontrol kaydı bulunamadı.
              </p>
              {canAddOrEdit && (
                <button
                  onClick={() => handleFormOpen()}
                  className="flex items-center mx-auto px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <PlusCircle size={18} className="mr-2" />
                  İlk Kontrolü Ekle
                </button>
              )}
            </div>
          )
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center items-center space-x-2 bg-white p-4 rounded-xl shadow-lg border border-slate-200">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Önceki
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNumber => (
              <button 
                key={pageNumber}
                onClick={() => setCurrentPage(pageNumber)}
                className={`px-4 py-2 border rounded-md text-sm font-medium transition-colors ${
                  currentPage === pageNumber 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Sonraki
            </button>
          </div>
        )}

        {/* Modals */}
        {formAcik && (
          <InvertorKontrolForm 
            onClose={() => {
              setFormAcik(false);
              setDuzenlenecekKontrol(null);
            }}
            sahalar={sahalar}
            kontrolToEdit={duzenlenecekKontrol}
            mode={duzenlenecekKontrol ? 'edit' : 'add'}
            onSuccess={() => {
              refreshData();
              // Optionally, if adding new and on first page, or editing, stay or go to relevant page
              // For simplicity, just refreshing data which re-triggers filters and pagination
            }}
          />
        )}

        {silinecekKontrolId && (
          <SilmeOnayModal 
            onConfirm={() => handleKontrolSil(silinecekKontrolId)}
            onCancel={() => setSilinecekKontrolId(null)}
            mesaj="Bu invertör kontrol kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
            baslik="Kontrol Kaydını Sil"
          />
        )}

        {seciliKontrolDetay && (
          <InvertorKontrolDetayModal 
            kontrol={seciliKontrolDetay} 
            sahaAdi={getSahaAdi(seciliKontrolDetay.sahaId)}
            onClose={() => setSeciliKontrolDetay(null)} 
          />
        )}
      </div>
    </div>
  );
};
