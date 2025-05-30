
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Filter, LayoutGrid, List, Edit, Trash2, Calendar, ChevronDown, ChevronUp, Image as ImageIcon, Clock, Timer, TrendingUp, AlertTriangle, CheckCircle, BarChart3, Activity } from 'lucide-react';
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
import { motion } from 'framer-motion';

export const Arizalar: React.FC = () => {
  const { kullanici } = useAuth();
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
          
          arizaQuery = query(
            collection(db, 'arizalar'),
            where('companyId', '==', kullanici.companyId),
            where('saha', 'in', kullanici.sahalar),
            orderBy('olusturmaTarihi', 'desc')
          );
        } else if (secilenSaha) {
          arizaQuery = query(
            collection(db, 'arizalar'),
            where('companyId', '==', kullanici.companyId),
            where('saha', '==', secilenSaha),
            orderBy('olusturmaTarihi', 'desc')
          );
        } else {
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
  
  // İstatistikleri hesapla
  const istatistikler = {
    toplam: filtrelenmisArizalar.length,
    acik: filtrelenmisArizalar.filter(a => a.durum === 'acik').length,
    devamEdiyor: filtrelenmisArizalar.filter(a => a.durum === 'devam-ediyor').length,
    cozuldu: filtrelenmisArizalar.filter(a => a.durum === 'cozuldu').length,
    beklemede: filtrelenmisArizalar.filter(a => a.durum === 'beklemede').length,
    buAy: filtrelenmisArizalar.filter(a => {
      const tarih = a.olusturmaTarihi.toDate();
      const buAy = new Date();
      return tarih.getMonth() === buAy.getMonth() && tarih.getFullYear() === buAy.getFullYear();
    }).length
  };

  const cozumOrani = istatistikler.toplam > 0 ? ((istatistikler.cozuldu / istatistikler.toplam) * 100).toFixed(1) : '0';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-8 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Arıza Yönetim Merkezi</h1>
                <p className="text-blue-100 text-lg">
                  Sistemin kalbi burada atıyor - Her arıza bir öğrenme fırsatı
                </p>
              </div>
              {!kullanici?.rol?.includes('musteri') && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setDuzenlenecekAriza(null);
                    setFormAcik(true);
                  }}
                  className="bg-white text-blue-700 px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>Yeni Arıza</span>
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6 mb-8"
        >
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Toplam Arıza</p>
                <p className="text-2xl font-bold text-gray-900">{istatistikler.toplam}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Açık Arıza</p>
                <p className="text-2xl font-bold text-red-600">{istatistikler.acik}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Devam Ediyor</p>
                <p className="text-2xl font-bold text-yellow-600">{istatistikler.devamEdiyor}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Çözüldü</p>
                <p className="text-2xl font-bold text-green-600">{istatistikler.cozuldu}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Çözüm Oranı</p>
                <p className="text-2xl font-bold text-indigo-600">%{cozumOrani}</p>
              </div>
              <div className="bg-indigo-100 p-3 rounded-full">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Bu Ay</p>
                <p className="text-2xl font-bold text-purple-600">{istatistikler.buAy}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters and Controls */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 mb-8"
        >
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="flex-1 max-w-md">
                <SearchInput
                  value={aramaMetni}
                  onChange={setAramaMetni}
                  placeholder="Arıza ara..."
                  className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg"
                />
              </div>
              <select
                value={secilenSaha}
                onChange={(e) => setSecilenSaha(e.target.value)}
                className="rounded-lg border-gray-300 text-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2"
              >
                <option value="">Tüm Sahalar</option>
                {Object.entries(sahalar).map(([id, ad]) => (
                  <option key={id} value={id}>{ad}</option>
                ))}
              </select>
              <select
                value={secilenDurum}
                onChange={(e) => setSecilenDurum(e.target.value)}
                className="rounded-lg border-gray-300 text-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-2"
              >
                <option value="">Tüm Durumlar</option>
                <option value="acik">Açık</option>
                <option value="devam-ediyor">Devam Ediyor</option>
                <option value="beklemede">Beklemede</option>
                <option value="cozuldu">Çözüldü</option>
              </select>
            </div>
            
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setGorunumTipi('kart')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  gorunumTipi === 'kart'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <LayoutGrid className="h-4 w-4 mr-2 inline" />
                Kartlar
              </button>
              <button
                onClick={() => setGorunumTipi('liste')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  gorunumTipi === 'liste'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="h-4 w-4 mr-2 inline" />
                Liste
              </button>
              <button
                onClick={() => setGorunumTipi('aylik')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  gorunumTipi === 'aylik'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar className="h-4 w-4 mr-2 inline" />
                Aylık
              </button>
            </div>
          </div>
        </motion.div>

        {/* Content Area */}
        {yukleniyor ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center items-center py-20 bg-white rounded-xl shadow-lg"
          >
            <LoadingSpinner size="lg" />
          </motion.div>
        ) : gorunumTipi === 'kart' ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6"
          >
            {filtrelenmisArizalar.length === 0 ? (
              <div className="col-span-full bg-white rounded-xl p-12 text-center shadow-lg">
                <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ImageIcon className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Arıza kaydı bulunamadı</h3>
                <p className="text-gray-500">Filtrelere uygun arıza kaydı bulunmuyor.</p>
              </div>
            ) : filtrelenmisArizalar.map((ariza, index) => (
              <motion.div
                key={ariza.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="relative group"
              >
                <div 
                  className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                  onClick={() => setSeciliAriza(ariza)}
                >
                  <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                    {ariza.fotograflar && ariza.fotograflar.length > 0 ? (
                      <img 
                        src={ariza.fotograflar[0]} 
                        alt="Arıza fotoğrafı" 
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder-image.png';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-16 w-16 text-gray-400" />
                      </div>
                    )}
                    
                    <div className="absolute top-3 right-3">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                        ariza.durum === 'cozuldu' ? 'bg-green-500 text-white' :
                        ariza.durum === 'devam-ediyor' ? 'bg-yellow-500 text-white' :
                        ariza.durum === 'beklemede' ? 'bg-gray-500 text-white' :
                        'bg-red-500 text-white'
                      }`}>
                        {ariza.durum.charAt(0).toUpperCase() + ariza.durum.slice(1).replace('-', ' ')}
                      </span>
                    </div>

                    {ariza.fotograflar && ariza.fotograflar.length > 1 && (
                      <div className="absolute bottom-3 right-3 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full">
                        +{ariza.fotograflar.length - 1} foto
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{ariza.baslik}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4">{ariza.aciklama}</p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-500">
                        <span className="font-medium mr-2">Saha:</span> 
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-medium">
                          {sahalar[ariza.saha] || 'Bilinmeyen Saha'}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <span className="font-medium mr-2">Konum:</span> {ariza.konum}
                      </div>
                    </div>
                  </div>
                  
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center text-gray-500">
                        <Calendar className="h-4 w-4 mr-1.5 text-blue-500" />
                        {format(ariza.olusturmaTarihi.toDate(), 'dd MMM yyyy', { locale: tr })}
                      </div>
                      <div className={`flex items-center font-medium ${ariza.cozum ? 'text-green-600' : 'text-orange-600'}`}>
                        <Timer className="h-4 w-4 mr-1.5" />
                        {getCozumSuresi(ariza)}
                      </div>
                    </div>
                  </div>
                </div>
                
                {(canEdit || canDelete) && (
                  <div className="absolute top-3 left-3 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArizaDuzenle(ariza);
                        }}
                        className="p-2 bg-white rounded-full shadow-lg hover:bg-blue-50 transition-colors duration-200"
                      >
                        <Edit className="h-4 w-4 text-blue-600" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSilinecekAriza(ariza.id);
                        }}
                        className="p-2 bg-white rounded-full shadow-lg hover:bg-red-50 transition-colors duration-200"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        ) : gorunumTipi === 'liste' ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
          >
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
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            {Object.keys(filtrelenmisAylikGruplar).length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-lg">
                <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Aylık arıza kaydı bulunamadı</h3>
                <p className="text-gray-500">Filtrelere uygun aylık arıza kaydı bulunmuyor.</p>
              </div>
            ) : (
              Object.keys(filtrelenmisAylikGruplar).map(ayYil => (
                <div key={ayYil} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div 
                    className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100 flex justify-between items-center cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-all duration-200"
                    onClick={() => toggleAyAciklik(ayYil)}
                  >
                    <h2 className="text-lg font-semibold text-blue-800 flex items-center">
                      <Calendar className="h-5 w-5 mr-3 text-blue-600" />
                      {ayYil} 
                      <span className="ml-3 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                        {filtrelenmisAylikGruplar[ayYil].length} arıza
                      </span>
                    </h2>
                    <button className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-100 rounded-lg transition-all duration-200">
                      {acikAylar[ayYil] ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  </div>
                  
                  {acikAylar[ayYil] && (
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filtrelenmisAylikGruplar[ayYil].map(ariza => (
                          <div 
                            key={ariza.id} 
                            className="border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
                            onClick={() => setSeciliAriza(ariza)}
                          >
                            <div className="h-32 bg-gray-100 relative overflow-hidden">
                              {ariza.fotograflar && ariza.fotograflar.length > 0 ? (
                                <img 
                                  src={ariza.fotograflar[0]} 
                                  alt="Arıza fotoğrafı" 
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
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
                              
                              <div className="absolute top-2 right-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  ariza.durum === 'cozuldu' ? 'bg-green-500 text-white' :
                                  ariza.durum === 'devam-ediyor' ? 'bg-yellow-500 text-white' :
                                  ariza.durum === 'beklemede' ? 'bg-gray-500 text-white' :
                                  'bg-red-500 text-white'
                                }`}>
                                  {ariza.durum.charAt(0).toUpperCase() + ariza.durum.slice(1).replace('-', ' ')}
                                </span>
                              </div>
                            </div>
                            
                            <div className="p-4">
                              <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">{ariza.baslik}</h3>
                              <div className="text-xs text-gray-600 mb-2">
                                <span className="font-medium">Saha:</span> {sahalar[ariza.saha] || 'Bilinmeyen Saha'}
                              </div>
                              <div className="flex justify-between items-center text-xs text-gray-500">
                                <div className="flex items-center">
                                  <Calendar className="h-3 w-3 mr-1 text-blue-400" />
                                  {format(ariza.olusturmaTarihi.toDate(), 'dd MMM', { locale: tr })}
                                </div>
                                <div className={`flex items-center font-medium ${ariza.cozum ? 'text-green-600' : 'text-orange-600'}`}>
                                  <Timer className="h-3 w-3 mr-1" />
                                  {getCozumSuresi(ariza)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </motion.div>
        )}
      </div>

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

export { Arizalar };
