import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useMenuNotifications } from '../contexts/MenuNotificationContext';
import { Plus, Search, Filter, LayoutGrid, List, Edit, Trash2, Calendar, ChevronDown, ChevronUp, Image as ImageIcon, Clock, Timer, AlertTriangle, Building2, Users, TrendingUp, Eye, MoreHorizontal } from 'lucide-react';
import { ArizaForm } from '../components/ArizaForm';
import { ArizaKart } from '../components/ArizaKart';
import { ArizaListesi } from '../components/ArizaListesi';
import { ArizaDetayModal } from '../components/ArizaDetayModal';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import type { Ariza } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SearchInput } from '../components/SearchInput';
import { format, parseISO, isValid, parse, differenceInHours, differenceInDays, differenceInMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import toast from 'react-hot-toast';

export const Arizalar: React.FC = () => {
  const { kullanici } = useAuth();
  const { markPageAsSeen } = useMenuNotifications();
  const [arizalar, setArizalar] = useState<Ariza[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [aramaMetni, setAramaMetni] = useState('');
  const [secilenSaha, setSecilenSaha] = useState<string>('');
  const [secilenDurum, setSecilenDurum] = useState<string>('');
  const [gorunumTipi, setGorunumTipi] = useState<'kart' | 'liste' | 'aylik'>('kart');
  const [sahalar, setSahalar] = useState<Record<string, string>>({});
  const [kullanicilar, setKullanicilar] = useState<Record<string, any>>({});
  const [seciliAriza, setSeciliAriza] = useState<Ariza | null>(null);
  const [duzenlenecekAriza, setDuzenlenecekAriza] = useState<Ariza | null>(null);
  const [silinecekAriza, setSilinecekAriza] = useState<string | null>(null);
  const [aylikGruplar, setAylikGruplar] = useState<Record<string, Ariza[]>>({});
  const [acikAylar, setAcikAylar] = useState<Record<string, boolean>>({});

  // Yetki kontrolü
  const canEdit = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);
  const canDelete = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis'].includes(kullanici.rol);

  useEffect(() => {
    const veriGetir = async () => {
      if (!kullanici) return;

      // Sayfa görüldü olarak işaretle
      markPageAsSeen('arizalar');

      try {
        // Sahaları getir
        let sahaQuery;
        if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          sahaQuery = query(
            collection(db, 'sahalar'),
            where('__name__', 'in', kullanici.sahalar)
          );
        } else {
          // Şirket ID'sine göre filtrele
          sahaQuery = query(
            collection(db, 'sahalar'),
            where('companyId', '==', kullanici.companyId)
          );
        }
        
        const sahaSnapshot = await getDocs(sahaQuery);
        const sahaMap: Record<string, string> = {};
        sahaSnapshot.docs.forEach(doc => {
          sahaMap[doc.id] = doc.data().ad;
        });
        setSahalar(sahaMap);

        // Kullanıcıları getir
        const kullaniciQuery = query(
          collection(db, 'kullanicilar'),
          where('companyId', '==', kullanici.companyId)
        );
        const kullaniciSnapshot = await getDocs(kullaniciQuery);
        const kullaniciMap: Record<string, any> = {};
        kullaniciSnapshot.docs.forEach(doc => {
          kullaniciMap[doc.id] = doc.data();
        });
        setKullanicilar(kullaniciMap);

        // Arızaları getir
        let arizaQuery;
        if (kullanici.rol === 'musteri') {
          if (!kullanici.sahalar || kullanici.sahalar.length === 0) {
            setArizalar([]);
            return;
          }
          
          // First filter by companyId, then by saha
          arizaQuery = query(
            collection(db, 'arizalar'),
            where('companyId', '==', kullanici.companyId),
            where('saha', 'in', kullanici.sahalar),
            orderBy('olusturmaTarihi', 'desc')
          );
        } else if (secilenSaha) {
          // First filter by companyId, then by specific saha
          arizaQuery = query(
            collection(db, 'arizalar'),
            where('companyId', '==', kullanici.companyId),
            where('saha', '==', secilenSaha),
            orderBy('olusturmaTarihi', 'desc')
          );
        } else {
          // Only filter by companyId and order by date
          arizaQuery = query(
            collection(db, 'arizalar'),
            where('companyId', '==', kullanici.companyId),
            orderBy('olusturmaTarihi', 'desc')
          );
        }

        const snapshot = await getDocs(arizaQuery);
        const arizaVerileri = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Ariza[];
        
        setArizalar(arizaVerileri);
        
        // Aylık grupları oluştur
        const gruplar: Record<string, Ariza[]> = {};
        arizaVerileri.forEach(ariza => {
          const tarih = ariza.olusturmaTarihi.toDate();
          const ayYil = format(tarih, 'MMMM yyyy', { locale: tr });
          
          if (!gruplar[ayYil]) {
            gruplar[ayYil] = [];
          }
          
          gruplar[ayYil].push(ariza);
        });
        
        setAylikGruplar(gruplar);
        
        // İlk 3 ayı otomatik olarak aç
        const ilkAylar = Object.keys(gruplar).slice(0, 3);
        const acikAylarObj: Record<string, boolean> = {};
        ilkAylar.forEach(ay => {
          acikAylarObj[ay] = true;
        });
        setAcikAylar(acikAylarObj);
      } catch (error) {
        console.error('Veri getirme hatası:', error);
        toast.error('Veriler yüklenirken bir hata oluştu');
      } finally {
        setYukleniyor(false);
      }
    };

    veriGetir();
  }, [kullanici, secilenSaha]);

  const handleArizaSil = async (id: string) => {
    if (!canDelete) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }

    setYukleniyor(true);
    try {
      await deleteDoc(doc(db, 'arizalar', id));
      toast.success('Arıza başarıyla silindi');
      setSilinecekAriza(null);
      // Listeyi güncelle
      setArizalar(prev => prev.filter(ariza => ariza.id !== id));
      
      // Aylık grupları güncelle
      const yeniGruplar = { ...aylikGruplar };
      Object.keys(yeniGruplar).forEach(ayYil => {
        yeniGruplar[ayYil] = yeniGruplar[ayYil].filter(ariza => ariza.id !== id);
        if (yeniGruplar[ayYil].length === 0) {
          delete yeniGruplar[ayYil];
        }
      });
      setAylikGruplar(yeniGruplar);
    } catch (error) {
      console.error('Arıza silme hatası:', error);
      toast.error('Arıza silinirken bir hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  const handleArizaDuzenle = (ariza: Ariza) => {
    if (!canEdit) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }
    setDuzenlenecekAriza(ariza);
    setFormAcik(true);
  };
  
  const toggleAyAciklik = (ay: string) => {
    setAcikAylar(prev => ({
      ...prev,
      [ay]: !prev[ay]
    }));
  };

  const getCozumSuresi = (ariza: Ariza): string => {
    const baslangic = ariza.olusturmaTarihi.toDate();
    const bitis = ariza.cozum ? ariza.cozum.tamamlanmaTarihi.toDate() : new Date();
    
    const dakikaFarki = differenceInMinutes(bitis, baslangic);
    const saatFarki = differenceInHours(bitis, baslangic);
    const gunFarki = differenceInDays(bitis, baslangic);
    const kalanSaat = saatFarki % 24;

    if (ariza.cozum) {
      if (gunFarki === 0) {
        if (saatFarki === 0) {
          return `${dakikaFarki} dakikada çözüldü`;
        }
        return kalanSaat === 0 ? '1 saatte çözüldü' : `${kalanSaat} saatte çözüldü`;
      } else {
        return `${gunFarki} gün ${kalanSaat} saatte çözüldü`;
      }
    } else {
      if (gunFarki === 0) {
        if (saatFarki === 0) {
          return `${dakikaFarki} dakika`;
        }
        return kalanSaat === 0 ? '1 saat' : `${kalanSaat} saat`;
      } else {
        return `${gunFarki} gün ${kalanSaat} saat`;
      }
    }
  };

  const filtrelenmisArizalar = arizalar.filter(ariza => {
    const aramaUyumu = aramaMetni
      ? ariza.baslik.toLowerCase().includes(aramaMetni.toLowerCase()) ||
        ariza.aciklama.toLowerCase().includes(aramaMetni.toLowerCase())
      : true;

    const durumUyumu = secilenDurum ? ariza.durum === secilenDurum : true;

    return aramaUyumu && durumUyumu;
  });
  
  // Filtrelenmiş aylık grupları oluştur
  const filtrelenmisAylikGruplar: Record<string, Ariza[]> = {};
  Object.keys(aylikGruplar).forEach(ayYil => {
    const filtrelenmisArizalar = aylikGruplar[ayYil].filter(ariza => {
      const aramaUyumu = aramaMetni
        ? ariza.baslik.toLowerCase().includes(aramaMetni.toLowerCase()) ||
          ariza.aciklama.toLowerCase().includes(aramaMetni.toLowerCase())
        : true;

      const durumUyumu = secilenDurum ? ariza.durum === secilenDurum : true;

      return aramaUyumu && durumUyumu;
    });
    
    if (filtrelenmisArizalar.length > 0) {
      filtrelenmisAylikGruplar[ayYil] = filtrelenmisArizalar;
    }
  });

  // İstatistik verileri
  const istatistikler = {
    toplam: filtrelenmisArizalar.length,
    acik: filtrelenmisArizalar.filter(a => a.durum === 'acik').length,
    devamEden: filtrelenmisArizalar.filter(a => a.durum === 'devam-ediyor').length,
    cozulen: filtrelenmisArizalar.filter(a => a.durum === 'cozuldu').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Arıza Yönetimi</h1>
                <p className="text-gray-600 text-sm">
                  Sistem arızalarını takip edin ve yönetin
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {!kullanici?.rol?.includes('musteri') && (
                <button
                  onClick={() => {
                    setDuzenlenecekAriza(null);
                    setFormAcik(true);
                  }}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Arıza Kaydı
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Toplam Arıza</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{istatistikler.toplam}</p>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Açık Arızalar</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{istatistikler.acik}</p>
              </div>
              <div className="p-2 bg-red-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Devam Eden</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{istatistikler.devamEden}</p>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Çözülen</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{istatistikler.cozulen}</p>
              </div>
              <div className="p-2 bg-green-50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1">
              <SearchInput
                value={aramaMetni}
                onChange={setAramaMetni}
                placeholder="Arıza başlığı veya açıklamasında ara..."
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <select
                value={secilenSaha}
                onChange={(e) => setSecilenSaha(e.target.value)}
                className="rounded-lg border-gray-200 text-gray-700 focus:border-blue-500 focus:ring-blue-500 bg-white"
              >
                <option value="">Tüm Sahalar</option>
                {Object.entries(sahalar).map(([id, ad]) => (
                  <option key={id} value={id}>{ad}</option>
                ))}
              </select>
              
              <select
                value={secilenDurum}
                onChange={(e) => setSecilenDurum(e.target.value)}
                className="rounded-lg border-gray-200 text-gray-700 focus:border-blue-500 focus:ring-blue-500 bg-white"
              >
                <option value="">Tüm Durumlar</option>
                <option value="acik">Açık</option>
                <option value="devam-ediyor">Devam Ediyor</option>
                <option value="beklemede">Beklemede</option>
                <option value="cozuldu">Çözüldü</option>
              </select>
              
              <div className="flex border border-gray-200 rounded-lg bg-white">
                <button
                  onClick={() => setGorunumTipi('kart')}
                  className={`px-4 py-2 text-sm font-medium rounded-l-lg border-r border-gray-200 transition-colors ${
                    gorunumTipi === 'kart'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setGorunumTipi('liste')}
                  className={`px-4 py-2 text-sm font-medium border-r border-gray-200 transition-colors ${
                    gorunumTipi === 'liste'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setGorunumTipi('aylik')}
                  className={`px-4 py-2 text-sm font-medium rounded-r-lg transition-colors ${
                    gorunumTipi === 'aylik'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Calendar className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {yukleniyor ? (
          <div className="flex justify-center items-center py-12 bg-white rounded-lg border border-gray-200">
            <LoadingSpinner size="lg" />
          </div>
        ) : gorunumTipi === 'kart' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtrelenmisArizalar.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-white rounded-lg border border-gray-200">
                <div className="mx-auto h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Arıza bulunamadı</h3>
                <p className="text-gray-500">Filtrelere uygun arıza kaydı bulunamadı.</p>
              </div>
            ) : (
              filtrelenmisArizalar.map((ariza) => (
                <div 
                  key={ariza.id} 
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSeciliAriza(ariza)}
                >
                  <div className="aspect-[4/3] bg-gray-100 relative">
                    {ariza.fotograflar && ariza.fotograflar.length > 0 ? (
                      <img 
                        src={ariza.fotograflar[0]} 
                        alt="Arıza fotoğrafı" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder-image.png';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    
                    <div className="absolute top-2 left-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        ariza.durum === 'cozuldu' ? 'bg-green-100 text-green-800' :
                        ariza.durum === 'devam-ediyor' ? 'bg-orange-100 text-orange-800' :
                        ariza.durum === 'beklemede' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {ariza.durum === 'devam-ediyor' ? 'Devam' : 
                         ariza.durum === 'cozuldu' ? 'Çözüldü' :
                         ariza.durum === 'beklemede' ? 'Beklemede' : 'Açık'}
                      </span>
                    </div>

                    {(canEdit || canDelete) && (
                      <div className="absolute top-2 right-2 flex space-x-1">
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArizaDuzenle(ariza);
                            }}
                            className="p-1.5 bg-white rounded shadow hover:bg-blue-50 transition-colors"
                          >
                            <Edit className="h-3.5 w-3.5 text-blue-600" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSilinecekAriza(ariza.id);
                            }}
                            className="p-1.5 bg-white rounded shadow hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">{ariza.baslik}</h3>
                    
                    <div className="flex items-center text-xs text-gray-500 mb-2">
                      <Building2 className="h-3.5 w-3.5 mr-1.5" />
                      <span className="truncate">{sahalar[ariza.saha] || 'Bilinmeyen Saha'}</span>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div className="flex items-center text-xs text-gray-500">
                        <Calendar className="h-3.5 w-3.5 mr-1" />
                        {format(ariza.olusturmaTarihi.toDate(), 'dd MMM', { locale: tr })}
                      </div>
                      <div className={`flex items-center text-xs ${ariza.cozum ? 'text-green-600' : 'text-gray-500'}`}>
                        <Timer className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs">
                          {getCozumSuresi(ariza).includes('çözüldü') ? 
                            getCozumSuresi(ariza).replace(' çözüldü', '') : 
                            getCozumSuresi(ariza)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : gorunumTipi === 'aylik' ? (
          <div className="space-y-6">
            {Object.keys(filtrelenmisAylikGruplar).length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <div className="mx-auto h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Arıza bulunamadı</h3>
                <p className="text-gray-500">Filtrelere uygun arıza kaydı bulunamadı.</p>
              </div>
            ) : (
              Object.keys(filtrelenmisAylikGruplar).map(ayYil => (
                <div key={ayYil} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div 
                    className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => toggleAyAciklik(ayYil)}
                  >
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Calendar className="h-5 w-5 mr-3 text-blue-600" />
                      {ayYil} 
                      <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                        {filtrelenmisAylikGruplar[ayYil].length} arıza
                      </span>
                    </h2>
                    <button className="text-gray-400 hover:text-gray-600 transition-colors">
                      {acikAylar[ayYil] ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  </div>
                  
                  {acikAylar[ayYil] && (
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtrelenmisAylikGruplar[ayYil].map(ariza => (
                          <div 
                            key={ariza.id} 
                            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => setSeciliAriza(ariza)}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <h3 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">{ariza.baslik}</h3>
                              <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-md ${
                                ariza.durum === 'cozuldu' ? 'bg-green-100 text-green-800' :
                                ariza.durum === 'devam-ediyor' ? 'bg-orange-100 text-orange-800' :
                                ariza.durum === 'beklemede' ? 'bg-gray-100 text-gray-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {ariza.durum.charAt(0).toUpperCase() + ariza.durum.slice(1).replace('-', ' ')}
                              </span>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex items-center text-sm text-gray-500">
                                <Building2 className="h-4 w-4 mr-2" />
                                <span className="truncate">{sahalar[ariza.saha] || 'Bilinmeyen Saha'}</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center text-gray-500">
                                  <Calendar className="h-4 w-4 mr-1" />
                                  {format(ariza.olusturmaTarihi.toDate(), 'dd MMM', { locale: tr })}
                                </div>
                                <div className={`flex items-center ${ariza.cozum ? 'text-green-600' : 'text-gray-500'}`}>
                                  <Timer className="h-4 w-4 mr-1" />
                                  {getCozumSuresi(ariza)}
                                </div>
                              </div>
                            </div>

                            {(canEdit || canDelete) && (
                              <div className="flex justify-end space-x-2 mt-3 pt-3 border-t border-gray-100">
                                {canEdit && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleArizaDuzenle(ariza);
                                    }}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSilinecekAriza(ariza.id);
                                    }}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <ArizaListesi
              arizalar={filtrelenmisArizalar}
              yukleniyor={yukleniyor}
              isMusteri={kullanici?.rol === 'musteri'}
              onArizaClick={(ariza) => setSeciliAriza(ariza)}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={handleArizaDuzenle}
              onDelete={(id) => setSilinecekAriza(id)}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {formAcik && (
        <ArizaForm
          ariza={duzenlenecekAriza}
          onClose={() => {
            setFormAcik(false);
            setDuzenlenecekAriza(null);
          }}
        />
      )}

      {seciliAriza && (
        <ArizaDetayModal
          ariza={seciliAriza}
          sahaAdi={sahalar[seciliAriza.saha] || 'Bilinmeyen Saha'}
          onClose={() => setSeciliAriza(null)}
        />
      )}

      {silinecekAriza && (
        <SilmeOnayModal
          onConfirm={() => handleArizaSil(silinecekAriza)}
          onCancel={() => setSilinecekAriza(null)}
          mesaj="Bu arızayı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
        />
      )}
    </div>
  );
};
