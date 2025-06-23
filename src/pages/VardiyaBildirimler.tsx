import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, where, getDocs, Timestamp, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useMenuNotifications } from '../contexts/MenuNotificationContext';
import { 
  Clock, Camera, User, MapPin, Calendar, MessageSquare, Plus, Filter, RefreshCw, 
  Sun, Moon, Image as ImageIcon, ChevronDown, ChevronUp, AlertCircle, Eye,
  Shield, Search, X, FileText, Edit, Trash2, MoreVertical
} from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { VardiyaBildirimForm } from '../components/VardiyaBildirimForm';
import toast from 'react-hot-toast';
import { format, parseISO, isToday, isYesterday, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { tr } from 'date-fns/locale';
import type { VardiyaBildirimi, Saha } from '../types';

interface GroupedVardiyaBildirimi {
  [date: string]: {
    sabah: VardiyaBildirimi[];
    aksam: VardiyaBildirimi[];
  };
}

export const VardiyaBildirimler: React.FC = () => {
  const { kullanici, refreshToken } = useAuth();
  const { markPageAsSeen } = useMenuNotifications();
  const [bildirimler, setBildirimler] = useState<VardiyaBildirimi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [secilenSaha, setSecilenSaha] = useState<string>('');
  const [secilenTarih, setSecilenTarih] = useState<string>('');
  const [secilenDonem, setSecilenDonem] = useState<string>('son4gun'); // Varsayılan olarak son 4 gün
  const [sahalar, setSahalar] = useState<Record<string, string>>({});
  const [acikFotograflar, setAcikFotograflar] = useState<string | null>(null);
  const [filtreAcik, setFiltreAcik] = useState(false);

  const canCreate = ['bekci', 'yonetici', 'tekniker', 'muhendis'].includes(kullanici?.rol || '');
  const isCustomer = kullanici?.rol === 'musteri';
  const isGuard = kullanici?.rol === 'bekci';
  const hasLimitedAccess = isCustomer || isGuard;
  
  // Rol bazlı yetkiler
  const canEdit = ['yonetici', 'muhendis', 'bekci', 'tekniker'].includes(kullanici?.rol || '');
  const canDelete = ['yonetici', 'muhendis', 'bekci', 'tekniker'].includes(kullanici?.rol || '');

  useEffect(() => {
    if (!kullanici?.companyId) {
      setYukleniyor(false);
      return;
    }

    const fetchData = async () => {
      setYukleniyor(true);
      
      // Sayfa görüldü olarak işaretle
      markPageAsSeen('vardiyaBildirimleri');
      
      console.log('🔍 VardiyaBildirimler Debug:');
      console.log('📄 Kullanıcı:', kullanici);
      console.log('🏢 Company ID:', kullanici.companyId);
      console.log('👤 Kullanıcı Rolü:', kullanici.rol);
      console.log('🏠 Kullanıcı Sahaları:', kullanici.sahalar);
      
      try {
        let sahaIds: string[] = [];
        if (hasLimitedAccess && kullanici.sahalar) {
          if (Array.isArray(kullanici.sahalar)) {
            sahaIds = kullanici.sahalar.filter(id => id && typeof id === 'string');
          } else if (typeof kullanici.sahalar === 'object' && kullanici.sahalar !== null) {
            sahaIds = Object.keys(kullanici.sahalar).filter(key => (kullanici.sahalar as Record<string, boolean>)[key]);
          }
          if (sahaIds.length === 0 && hasLimitedAccess) {
            console.log('❌ Sınırlı erişimli kullanıcı ancak saha yok');
            toast.error('Size henüz saha atanmamış.');
            setSahalar({});
            setBildirimler([]);
            setYukleniyor(false);
            return;
          }
        }

        console.log('🔍 Saha IDs:', sahaIds);
        console.log('🔒 Has Limited Access:', hasLimitedAccess);

        const sahaQuery = sahaIds.length > 0 ? 
          query(collection(db, 'sahalar'), where('__name__', 'in', sahaIds)) :
          query(collection(db, 'sahalar'), where('companyId', '==', kullanici.companyId));
        
        const sahaSnapshot = await getDocs(sahaQuery);
        const sahaMap: Record<string, string> = {};
        sahaSnapshot.docs.forEach(doc => { sahaMap[doc.id] = doc.data().ad; });
        console.log('🏢 Sahalar Map:', sahaMap);
        setSahalar(sahaMap);

        let q = query(
          collection(db, 'vardiyaBildirimleri'),
          where('companyId', '==', kullanici.companyId),
          orderBy('olusturmaTarihi', 'desc')
        );

        console.log('📊 Firestore query başlatılıyor...');

        const unsubscribe = onSnapshot(q, (snapshot) => {
          console.log('📥 Firestore snapshot alındı, doc sayısı:', snapshot.docs.length);
          
          let bildirimListesi = snapshot.docs.map(doc => {
            const data = doc.data();
            console.log('📋 Bildirim data:', { id: doc.id, ...data });
            return {
              id: doc.id,
              ...data
            };
          }) as VardiyaBildirimi[];

          console.log('📊 İlk bildirim listesi:', bildirimListesi.length);

          if (sahaIds.length > 0) {
            bildirimListesi = bildirimListesi.filter(b => sahaIds.includes(b.sahaId));
            console.log('🔍 Saha filtresi sonrası:', bildirimListesi.length);
          }
          
          console.log('✅ Final bildirim listesi:', bildirimListesi);
          setBildirimler(bildirimListesi);
          setYukleniyor(false);
        }, (error) => {
          console.error('❌ Vardiya bildirimleri getirilemedi:', error);
          toast.error('Vardiya bildirimleri yüklenirken bir hata oluştu.');
          setYukleniyor(false);
        });
        return () => unsubscribe();
      } catch (error) {
        console.error('❌ Veri getirme hatası:', error);
        toast.error('Veriler yüklenirken bir hata oluştu.');
        setYukleniyor(false);
      }
    };
    fetchData();
  }, [kullanici, hasLimitedAccess]);

  const filtrelenmisVeGruplanmisBildirimler = useMemo(() => {
    const bugun = new Date();
    
    const filtrelenmis = bildirimler.filter(bildirim => {
      const sahaFiltresiGecerli = !secilenSaha || bildirim.sahaId === secilenSaha;
      
      let tarihFiltresiGecerli = true;
      const bildirimTarihi = bildirim.tarih?.toDate();
      
      if (!bildirimTarihi) {
        return false;
      }

      // Dönem filtresi
      if (secilenDonem === 'son4gun') {
        const dort_gun_once = subDays(bugun, 4);
        tarihFiltresiGecerli = bildirimTarihi >= dort_gun_once;
      } else if (secilenDonem === 'bu_hafta') {
        const haftaBaslangic = startOfWeek(bugun, { locale: tr });
        const haftaSon = endOfWeek(bugun, { locale: tr });
        tarihFiltresiGecerli = isWithinInterval(bildirimTarihi, { start: haftaBaslangic, end: haftaSon });
      } else if (secilenDonem === 'bu_ay') {
        const ayBaslangic = startOfMonth(bugun);
        const aySon = endOfMonth(bugun);
        tarihFiltresiGecerli = isWithinInterval(bildirimTarihi, { start: ayBaslangic, end: aySon });
      } else if (secilenTarih) {
        // Belirli tarih seçilmişse
        const formatlanmisBildirimTarihi = format(bildirimTarihi, 'yyyy-MM-dd');
        tarihFiltresiGecerli = formatlanmisBildirimTarihi === secilenTarih;
      }
      
      return sahaFiltresiGecerli && tarihFiltresiGecerli;
    });

    return filtrelenmis.reduce((acc, bildirim) => {
      const dateStr = format(bildirim.tarih.toDate(), 'yyyy-MM-dd');
      if (!acc[dateStr]) {
        acc[dateStr] = { sabah: [], aksam: [] };
      }
      if (bildirim.vardiyaTipi === 'sabah') {
        acc[dateStr].sabah.push(bildirim);
      } else {
        acc[dateStr].aksam.push(bildirim);
      }
      return acc;
    }, {} as GroupedVardiyaBildirimi);
  }, [bildirimler, secilenSaha, secilenTarih, secilenDonem]);
  
  const sortedDates = useMemo(() => {
    return Object.keys(filtrelenmisVeGruplanmisBildirimler).sort((a, b) => b.localeCompare(a));
  }, [filtrelenmisVeGruplanmisBildirimler]);

  // İstatistikler
  const istatistikler = useMemo(() => {
    const bugun = new Date();
    const bugunStr = format(bugun, 'yyyy-MM-dd');
    const bugunBildirimleri = filtrelenmisVeGruplanmisBildirimler[bugunStr] || { sabah: [], aksam: [] };
    
    return {
      toplamBildirim: bildirimler.length,
      bugunSabah: bugunBildirimleri.sabah.length,
      bugunAksam: bugunBildirimleri.aksam.length,
      toplamSaha: Object.keys(sahalar).length
    };
  }, [filtrelenmisVeGruplanmisBildirimler, bildirimler.length, sahalar]);

  const getDateDisplayText = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Bugün';
    if (isYesterday(date)) return 'Dün';
    return format(date, 'dd MMMM yyyy, EEEE', { locale: tr });
  };

  const handleDeleteBildirim = async (bildirimId: string) => {
    try {
      await deleteDoc(doc(db, 'vardiyaBildirimleri', bildirimId));
      toast.success('Vardiya bildirimi başarıyla silindi');
      setAcikFotograflar(null);
    } catch (error) {
      console.error('Silme hatası:', error);
      toast.error('Vardiya bildirimi silinirken bir hata oluştu');
    }
  };

  if (yukleniyor && !Object.keys(sahalar).length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Vardiya bildirimleri yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Kompakt Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Vardiya Takip</h1>
                <p className="text-sm text-gray-500">
                  {isCustomer ? 'Saha güvenlik raporları' : 
                   canCreate ? 'Vardiya bildirimleri' : 
                   'Tüm vardiya faaliyetleri'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* İstatistik Kartları - Kompakt */}
              <div className="hidden lg:flex items-center space-x-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-primary-600">{istatistikler.toplamBildirim}</div>
                  <div className="text-xs text-gray-500">Toplam</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-warning-600">{istatistikler.bugunSabah}</div>
                  <div className="text-xs text-gray-500">Bugün Sabah</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-primary-700">{istatistikler.bugunAksam}</div>
                  <div className="text-xs text-gray-500">Bugün Akşam</div>
                </div>
              </div>
              
              {/* Butonlar */}
              <div className="flex items-center space-x-2">
                {canCreate && (
                  <button
                    onClick={refreshToken}
                    className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="Yetkilendirme Bilgilerini Yenile"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
                {canCreate && (
                  <button
                    onClick={() => setFormAcik(true)}
                    className="inline-flex items-center px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Yeni Bildirim</span>
                    <span className="sm:hidden">Ekle</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Mobil İstatistikler */}
        <div className="lg:hidden mb-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-primary-600">{istatistikler.toplamBildirim}</div>
                <div className="text-xs text-gray-500">Toplam</div>
              </div>
              <div>
                <div className="text-lg font-bold text-warning-600">{istatistikler.bugunSabah}</div>
                <div className="text-xs text-gray-500">Sabah</div>
              </div>
              <div>
                <div className="text-lg font-bold text-primary-700">{istatistikler.bugunAksam}</div>
                <div className="text-xs text-gray-500">Akşam</div>
              </div>
              <div>
                <div className="text-lg font-bold text-success-600">{istatistikler.toplamSaha}</div>
                <div className="text-xs text-gray-500">Saha</div>
              </div>
            </div>
          </div>
        </div>

        {/* Kompakt Filtreleme */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-3">
              <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-3 md:space-y-0">
                <div className="flex items-center">
                  <Filter className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm font-medium text-gray-700">Filtreler</span>
                  {(secilenSaha || secilenTarih || secilenDonem !== 'son4gun') && (
                    <span className="ml-2 px-2 py-0.5 bg-primary-100 text-primary-800 text-xs rounded-full">
                      Aktif
                    </span>
                  )}
                </div>
                
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <select
                    value={secilenSaha}
                    onChange={e => setSecilenSaha(e.target.value)}
                    className="text-sm rounded-md border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                  >
                    <option value="">Tüm Sahalar</option>
                    {Object.entries(sahalar).map(([id, ad]) => (
                      <option key={id} value={id}>{ad}</option>
                    ))}
                  </select>
                  
                  <select
                    value={secilenDonem}
                    onChange={e => {
                      setSecilenDonem(e.target.value);
                      if (e.target.value !== 'ozel_tarih') {
                        setSecilenTarih(''); // Dönem seçilince özel tarihi temizle
                      }
                    }}
                    className="text-sm rounded-md border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                  >
                    <option value="son4gun">Son 4 Gün</option>
                    <option value="bu_hafta">Bu Hafta</option>
                    <option value="bu_ay">Bu Ay</option>
                    <option value="ozel_tarih">Özel Tarih</option>
                  </select>
                  
                  {secilenDonem === 'ozel_tarih' && (
                    <input
                      type="date"
                      value={secilenTarih}
                      onChange={e => setSecilenTarih(e.target.value)}
                      className="text-sm rounded-md border-gray-300 focus:border-primary-500 focus:ring-primary-500"
                      placeholder="Tarih seçin"
                    />
                  )}
                  
                  {(secilenSaha || secilenTarih || secilenDonem !== 'son4gun') && (
                    <button
                      onClick={() => { 
                        setSecilenSaha(''); 
                        setSecilenTarih(''); 
                        setSecilenDonem('son4gun'); 
                      }}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm transition-colors flex items-center justify-center"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Temizle
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {yukleniyor ? (
          <div className="flex justify-center items-center min-h-[300px]">
            <LoadingSpinner size="lg" />
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="text-center py-12">
            <div className="max-w-sm mx-auto">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Vardiya Bildirimi Bulunamadı</h3>
              <p className="text-gray-500 text-sm mb-4">
                {secilenSaha || secilenTarih || secilenDonem !== 'son4gun' ? 'Seçili filtrelere uygun bildirim yok.' : 
                 (canCreate ? 'İlk vardiya bildiriminizi oluşturun.' : 'Henüz bildirim yok.')}
              </p>
              {canCreate && !(secilenSaha || secilenTarih || secilenDonem !== 'son4gun') && (
                <button
                  onClick={() => setFormAcik(true)}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  İlk Bildirimi Ekle
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(dateStr => (
              <div key={dateStr} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Tarih Başlığı - Kompakt */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-primary-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          {getDateDisplayText(dateStr)}
                        </h2>
                        <p className="text-sm text-gray-500">
                          {format(parseISO(dateStr), 'dd MMMM yyyy', { locale: tr })}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {(filtrelenmisVeGruplanmisBildirimler[dateStr].sabah.length + 
                        filtrelenmisVeGruplanmisBildirimler[dateStr].aksam.length)} bildirim
                    </div>
                  </div>
                </div>
                
                {/* Vardiya Bölümleri */}
                <div className="p-4 space-y-4">
                  {['sabah', 'aksam'].map(vardiyaTipi => {
                    const vardiyadakiBildirimler = filtrelenmisVeGruplanmisBildirimler[dateStr][vardiyaTipi as 'sabah' | 'aksam'];
                    if (vardiyadakiBildirimler.length === 0) return null;

                    const isSabah = vardiyaTipi === 'sabah';
                    const vardiyaBaslik = isSabah ? "Sabah Vardiyası" : "Akşam Vardiyası";
                    const VardiyaIcon = isSabah ? Sun : Moon;
                    const bgColor = isSabah ? 'bg-warning-50' : 'bg-primary-50';
                    const iconColor = isSabah ? 'text-warning-600' : 'text-primary-600';
                    const textColor = isSabah ? 'text-warning-800' : 'text-primary-800';

                    return (
                      <div key={vardiyaTipi} className={`${bgColor} rounded-lg p-3`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <VardiyaIcon className={`h-5 w-5 ${iconColor}`} />
                            <h3 className={`font-medium ${textColor}`}>{vardiyaBaslik}</h3>
                          </div>
                          <span className="text-xs text-gray-500">{vardiyadakiBildirimler.length} bildirim</span>
                        </div>
                        
                        {/* Kompakt Kart Listesi */}
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                          {vardiyadakiBildirimler.map(bildirim => (
                            <div key={bildirim.id} className="bg-white rounded-md shadow-sm border border-gray-100 hover:shadow-md transition-shadow overflow-hidden">
                              {/* Fotoğraf Önizlemesi */}
                              {bildirim.fotograflar && bildirim.fotograflar.length > 0 && (
                                <div className="relative h-24 bg-gray-100">
                                  <img
                                    src={bildirim.fotograflar[0]}
                                    alt="Vardiya fotoğrafı"
                                    className="w-full h-full object-cover"
                                  />
                                  {bildirim.fotograflar.length > 1 && (
                                    <div className="absolute bottom-1 right-1 bg-black bg-opacity-75 text-white text-xs px-1.5 py-0.5 rounded">
                                      +{bildirim.fotograflar.length - 1}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              <div className="p-2.5">
                                {/* Başlık Satırı */}
                                <div className="flex items-start justify-between mb-1.5">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-xs font-medium text-gray-900 truncate">
                                      <MapPin className="h-3 w-3 inline mr-1 text-gray-400" />
                                      {sahalar[bildirim.sahaId] || 'Saha Yükleniyor...'}
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      <User className="h-2.5 w-2.5 inline mr-1" />
                                      {bildirim.bekciAdi}
                                    </p>
                                  </div>
                                  
                                  {/* Aksiyon Menüsü */}
                                  <div className="relative">
                                    <button
                                      onClick={() => setAcikFotograflar(acikFotograflar === `menu-${bildirim.id}` ? null : `menu-${bildirim.id}`)}
                                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                                    >
                                      <MoreVertical className="h-3 w-3" />
                                    </button>
                                    
                                    {acikFotograflar === `menu-${bildirim.id}` && (
                                      <div className="absolute right-0 top-6 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10 min-w-[120px]">
                                        <button
                                          onClick={() => {
                                            setAcikFotograflar(bildirim.id);
                                          }}
                                          className="w-full px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50 flex items-center"
                                        >
                                          <Eye className="h-3 w-3 mr-2" />
                                          Detayları Gör
                                        </button>
                                        {canEdit && (
                                          <button
                                            onClick={() => {
                                              setAcikFotograflar(null);
                                              // TODO: Düzenleme fonksiyonu
                                              toast('Düzenleme özelliği geliştirme aşamasında', { icon: 'ℹ️' });
                                            }}
                                            className="w-full px-3 py-1.5 text-xs text-left text-blue-600 hover:bg-blue-50 flex items-center"
                                          >
                                            <Edit className="h-3 w-3 mr-2" />
                                            Düzenle
                                          </button>
                                        )}
                                        {canDelete && (
                                          <button
                                            onClick={() => {
                                              setAcikFotograflar(null);
                                              if (window.confirm('Bu vardiya bildirimini silmek istediğinizden emin misiniz?')) {
                                                handleDeleteBildirim(bildirim.id);
                                              }
                                            }}
                                            className="w-full px-3 py-1.5 text-xs text-left text-red-600 hover:bg-red-50 flex items-center"
                                          >
                                            <Trash2 className="h-3 w-3 mr-2" />
                                            Sil
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Saat Badge */}
                                <div className="mb-1.5">
                                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                    <Clock className="h-2.5 w-2.5 inline mr-1" />
                                    {bildirim.vardiyaSaati}
                                  </span>
                                </div>

                                {/* Yorum - Kısaltılmış */}
                                {bildirim.yorum && (
                                  <div className="mb-1.5">
                                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                                      <MessageSquare className="h-2.5 w-2.5 inline mr-1 text-gray-400" />
                                      {bildirim.yorum.length > 60 ? 
                                        `${bildirim.yorum.substring(0, 60)}...` : 
                                        bildirim.yorum}
                                    </p>
                                  </div>
                                )}

                                {/* Fotoğraflar - Küçük Önizleme */}
                                {bildirim.fotograflar && bildirim.fotograflar.length > 0 && (
                                  <div className="mb-1.5">
                                    <button 
                                      onClick={() => setAcikFotograflar(acikFotograflar === bildirim.id ? null : bildirim.id)}
                                      className="flex items-center text-xs text-primary-600 hover:text-primary-800 font-medium"
                                    >
                                      <ImageIcon className="h-2.5 w-2.5 mr-1" />
                                      {bildirim.fotograflar.length} Foto
                                      {acikFotograflar === bildirim.id ? 
                                        <ChevronUp className="h-2.5 w-2.5 ml-1" /> : 
                                        <ChevronDown className="h-2.5 w-2.5 ml-1" />}
                                    </button>
                                    {acikFotograflar === bildirim.id && (
                                      <div className="mt-1.5 grid grid-cols-3 gap-1">
                                        {bildirim.fotograflar.slice(0, 6).map((foto, index) => (
                                          <a key={index} href={foto} target="_blank" rel="noopener noreferrer" className="block relative aspect-square group">
                                            <img
                                              src={foto}
                                              alt={`Foto ${index + 1}`}
                                              className="w-full h-full object-cover rounded border border-gray-200 transition-transform group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded transition-opacity flex items-center justify-center">
                                              <Eye className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Alt Bilgi */}
                                <div className="text-xs text-gray-400 pt-1.5 border-t border-gray-100">
                                  {format(bildirim.olusturmaTarihi.toDate(), 'dd MMM, HH:mm', { locale: tr })}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {formAcik && (
        <VardiyaBildirimForm
          onClose={() => setFormAcik(false)}
          onSuccess={() => {
            toast.success('Vardiya bildirimi başarıyla gönderildi!');
            setFormAcik(false);
          }}
          mevcutSahalar={sahalar}
        />
      )}
    </div>
  );
}; 