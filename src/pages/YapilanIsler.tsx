import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, doc, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useMenuNotifications } from '../contexts/MenuNotificationContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { YapilanIsForm } from '../components/YapilanIsForm';
import { IsRaporDetayModal } from '../components/IsRaporDetayModal';
import { SearchInput } from '../components/SearchInput';
import { format, parseISO, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Building, 
  Calendar, 
  Clock, 
  ImageIcon, 
  Plus, 
  Trash2, 
  User, 
  Wrench, 
  Tag, 
  FileText, 
  ChevronRight, 
  CheckCircle,
  Download,
  Filter,
  TrendingUp,
  Users,
  Activity,
  LayoutGrid,
  List,
  Settings2,
  ExternalLink,
  BarChart3
} from 'lucide-react';
import { SilmeOnayModal } from '../components/SilmeOnayModal';
import toast from 'react-hot-toast';
import type { IsRaporu } from '../types';

const cn = (...classes: string[]) => classes.filter(Boolean).join(' ');

export const YapilanIsler: React.FC = () => {
  const { kullanici } = useAuth();
  const { markPageAsSeen } = useMenuNotifications();
  const [raporlar, setRaporlar] = useState<IsRaporu[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [duzenlenecekRapor, setDuzenlenecekRapor] = useState<IsRaporu | null>(null);
  const [aramaMetni, setAramaMetni] = useState('');
  const [seciliRaporDetay, setSeciliRaporDetay] = useState<IsRaporu | null>(null);
  const [sahalar, setSahalar] = useState<Array<{id: string, ad: string}>>([]);
  const [secilenAy, setSecilenAy] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [secilenSaha, setSecilenSaha] = useState<string>('tumu');
  const [silinecekRaporId, setSilinecekRaporId] = useState<string | null>(null);
  const [aktifGorunum, setAktifGorunum] = useState<'liste' | 'kart' | 'istatistik'>('liste');

  const yilSecenekleri = Array.from({ length: 6 }, (_, i) => {
    const yil = new Date().getFullYear() + 1 - i;
    return format(new Date(yil, 0), 'yyyy');
  });

  const aySecenekleri = Array.from({length: 12}, (_, i) => ({
    value: format(new Date(2000, i, 1), 'MM'),
    label: format(new Date(2000, i, 1), 'MMMM', { locale: tr })
  }));

  const secilenYil = secilenAy.substring(0,4);
  const secilenAyNo = secilenAy.substring(5,7);
  
  const canAddOrEdit = kullanici?.rol && ['yonetici', 'tekniker', 'muhendis', 'superadmin'].includes(kullanici.rol);
  const canDelete = kullanici?.rol && ['yonetici', 'superadmin'].includes(kullanici.rol);
  const canViewStats = kullanici?.rol && ['yonetici', 'superadmin', 'muhendis'].includes(kullanici.rol);

  useEffect(() => {
    const sahalariGetir = async () => {
      if (!kullanici?.companyId) return;

      try {
        let sahaQuery;
        if (kullanici.rol === 'musteri' && kullanici.sahalar && Array.isArray(kullanici.sahalar) && kullanici.sahalar.length > 0) {
          sahaQuery = query(
            collection(db, 'sahalar'),
            where('__name__', 'in', kullanici.sahalar),
            where('companyId', '==', kullanici.companyId)
          );
        } else if (kullanici.rol !== 'musteri') {
          sahaQuery = query(
            collection(db, 'sahalar'),
            where('companyId', '==', kullanici.companyId),
            orderBy('ad')
          );
        } else {
          setSahalar([]);
          return;
        }
        
        const snapshot = await getDocs(sahaQuery);
        const sahaListesi = snapshot.docs.map(doc => ({
          id: doc.id,
          ad: doc.data().ad
        }));
        setSahalar(sahaListesi);
        if (kullanici.rol === 'musteri' && sahaListesi.length === 1) {
          setSecilenSaha(sahaListesi[0].id);
        }

      } catch (error) {
        console.error('Sahalar getirilemedi:', error);
        toast.error('Sahalar yüklenirken bir hata oluştu');
      }
    };

    sahalariGetir();
  }, [kullanici]);

  useEffect(() => {
    if (!kullanici?.companyId) return;
    
    // Sayfa görüldü olarak işaretle
    markPageAsSeen('yapilanIsler');
    
    const raporlariGetir = async () => {
      try {
        setYukleniyor(true);
        const ayBaslangic = startOfMonth(parseISO(secilenAy + '-01'));
        const ayBitis = endOfMonth(parseISO(secilenAy + '-01'));

        let raporQueryConstraints = [
          where('companyId', '==', kullanici.companyId),
          where('tarih', '>=', Timestamp.fromDate(ayBaslangic)),
          where('tarih', '<=', Timestamp.fromDate(ayBitis)),
        ];

        if (secilenSaha !== 'tumu') {
          raporQueryConstraints.push(where('saha', '==', secilenSaha));
        }

        if (kullanici.rol === 'musteri') {
          if (kullanici.sahalar && Array.isArray(kullanici.sahalar) && kullanici.sahalar.length > 0) {
            if (secilenSaha !== 'tumu' && !kullanici.sahalar.includes(secilenSaha)){
              setRaporlar([]);
              setYukleniyor(false);
              return; 
            }
            if (secilenSaha === 'tumu') {
                 raporQueryConstraints.push(where('saha', 'in', kullanici.sahalar.length > 0 ? kullanici.sahalar : ['null']));
            }
          } else {
             setRaporlar([]);
             setYukleniyor(false);
             return;
          }
        }
        
        const raporQuery = query(
          collection(db, 'isRaporlari'), 
          ...raporQueryConstraints,
          orderBy('tarih', 'desc')
        );

        const snapshot = await getDocs(raporQuery);
        const tumRaporlar = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as IsRaporu[];
        
        setRaporlar(tumRaporlar);
      } catch (error) {
        console.error('Veri getirme hatası:', error);
        toast.error('Veriler yüklenirken bir hata oluştu');
      } finally {
        setYukleniyor(false);
      }
    };

    raporlariGetir();
  }, [kullanici, secilenAy, secilenSaha]);

  const handleRaporSil = async (id: string) => {
    if (!canDelete) {
      toast.error('Bu işlem için yetkiniz yok');
      return;
    }
    try {
      await deleteDoc(doc(db, 'isRaporlari', id));
      toast.success('Rapor başarıyla silindi');
      setSilinecekRaporId(null);
      setRaporlar(prev => prev.filter(rapor => rapor.id !== id));
    } catch (error) {
      console.error('Rapor silme hatası:', error);
      toast.error('Rapor silinirken bir hata oluştu');
    } 
  };

  const handleFormAc = (rapor?: IsRaporu) => {
    if(rapor) {
        setDuzenlenecekRapor(rapor);
        setModalMode('edit');
    } else {
        setDuzenlenecekRapor(null);
        setModalMode('add');
    }
    setFormAcik(true);
  };

  const filtrelenmisRaporlar = raporlar.filter(rapor => {
    if (!aramaMetni) return true;
    const aramaMetniKucuk = aramaMetni.toLowerCase();
    return (
      rapor.baslik.toLowerCase().includes(aramaMetniKucuk) ||
      rapor.aciklama.toLowerCase().includes(aramaMetniKucuk) ||
      rapor.yapilanIsler.toLowerCase().includes(aramaMetniKucuk) ||
      getSahaAdi(rapor.saha).toLowerCase().includes(aramaMetniKucuk) ||
      rapor.olusturanKisi.ad.toLowerCase().includes(aramaMetniKucuk)
    );
  });

  const getSahaAdi = (sahaId: string) => {
    return sahalar.find(s => s.id === sahaId)?.ad || 'Bilinmeyen Saha';
  };
  
  const istatistikler = () => {
    if (aktifGorunum !== 'istatistik') return null;
    const toplamIs = filtrelenmisRaporlar.length;
    const tamamlananIsSayisi = filtrelenmisRaporlar.length;
    const farkliSahaSayisi = new Set(filtrelenmisRaporlar.map(r => r.saha)).size;
    const katilanTeknisyenSayisi = new Set(filtrelenmisRaporlar.map(r => r.olusturanKisi.id)).size;

    const gunlukIsSayilari = Array(7).fill(0).map((_, i) => {
      const gunTarihi = new Date();
      gunTarihi.setDate(gunTarihi.getDate() - (6 - i));
      const gunFormat = format(gunTarihi, 'yyyy-MM-dd');
      const sayi = filtrelenmisRaporlar.filter(r => format(r.tarih.toDate(), 'yyyy-MM-dd') === gunFormat).length;
      return { gun: format(gunTarihi, 'dd MMM', {locale: tr}), "İş Sayısı": sayi };
    });

    return {
      toplamIs,
      tamamlananIsSayisi,
      farkliSahaSayisi,
      katilanTeknisyenSayisi,
      gunlukIsSayilari
    };
  };

  const stats = istatistikler();

  const renderReportCard = (rapor: IsRaporu) => (
    <div key={rapor.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col">
      {/* Fotoğraf Ön İzleme Alanı */}
      {rapor.fotograflar && rapor.fotograflar.length > 0 ? (
        <div className="relative">
          <div className="h-40 bg-gray-100 rounded-t-lg overflow-hidden">
            <img 
              src={rapor.fotograflar[0]} 
              alt="İş raporu fotoğrafı"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                ((e.target as HTMLImageElement).nextSibling as HTMLDivElement).style.display = 'flex';
              }}
            />
            <div className="w-full h-full bg-gray-200 hidden items-center justify-center">
              <ImageIcon className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          {rapor.fotograflar.length > 1 && (
            <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded-full">
              +{rapor.fotograflar.length - 1}
            </div>
          )}
        </div>
      ) : (
        <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg flex items-center justify-center">
          <div className="text-center">
            <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
            <span className="text-xs text-gray-500">Fotoğraf Yok</span>
          </div>
        </div>
      )}
      
      <div className="p-4 flex-grow">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-blue-700 truncate" title={rapor.baslik}>{rapor.baslik}</h3>
          {rapor.fotograflar && rapor.fotograflar.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
              {rapor.fotograflar.length} Foto
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-1 flex items-center">
            <Building size={12} className="mr-1.5 text-gray-400" /> {getSahaAdi(rapor.saha)}
        </p>
        <p className="text-xs text-gray-500 mb-2 flex items-center">
            <Calendar size={12} className="mr-1.5 text-gray-400" /> {format(rapor.tarih.toDate(), 'dd MMMM yyyy', { locale: tr })}
        </p>
        <p className="text-sm text-gray-700 line-clamp-2 mb-3" title={rapor.yapilanIsler}>{rapor.yapilanIsler}</p>
      </div>
      
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between text-xs">
        <div className="flex items-center text-gray-600">
            <User size={12} className="mr-1 text-gray-400" /> {rapor.olusturanKisi.ad}
        </div>
        <div className="flex items-center space-x-2">
            <button 
                onClick={() => setSeciliRaporDetay(rapor)}
                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                title="Detayları Görüntüle"
            >
                <ExternalLink size={14} />
            </button>
            {canAddOrEdit && (
                <button 
                    onClick={() => handleFormAc(rapor)}
                    className="p-1 text-green-600 hover:text-green-800 hover:bg-green-100 rounded transition-colors"
                    title="Düzenle"
                >
                    <Wrench size={14} />
                </button>
            )}
            {canDelete && (
                <button 
                    onClick={() => setSilinecekRaporId(rapor.id)}
                    className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors"
                    title="Sil"
                >
                    <Trash2 size={14} />
                </button>
            )}
        </div>
      </div>
    </div>
  );

  const renderReportListItem = (rapor: IsRaporu) => (
    <tr key={rapor.id} className="hover:bg-gray-50 transition-colors duration-150">
      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-700">
        <button onClick={() => setSeciliRaporDetay(rapor)} className="hover:underline truncate block max-w-xs" title={rapor.baslik}>
          {rapor.baslik}
        </button>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{getSahaAdi(rapor.saha)}</td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 hidden md:table-cell">{format(rapor.tarih.toDate(), 'dd MMM yyyy', { locale: tr })}</td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 hidden lg:table-cell">{rapor.olusturanKisi.ad}</td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 hidden md:table-cell">
        <span className={cn(
          'px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full',
          rapor.fotograflar && rapor.fotograflar.length > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
        )}>
          {rapor.fotograflar && rapor.fotograflar.length > 0 ? `${rapor.fotograflar.length} Foto` : 'Foto Yok'}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-1">
        <button 
            onClick={() => setSeciliRaporDetay(rapor)}
            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors" 
            title="Detayları Görüntüle"
        >
            <ExternalLink size={16} />
        </button>
        {canAddOrEdit && (
            <button 
                onClick={() => handleFormAc(rapor)}
                className="p-1.5 text-green-600 hover:bg-green-100 rounded-md transition-colors" 
                title="Düzenle"
            >
                <Wrench size={16} />
            </button>
        )}
        {canDelete && (
            <button 
                onClick={() => setSilinecekRaporId(rapor.id)}
                className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors" 
                title="Sil"
            >
                <Trash2 size={16} />
            </button>
        )}
      </td>
    </tr>
  );

  const StatCard = ({ title, value, icon: Icon, color }: {title: string; value: string | number; icon: React.ElementType; color: string}) => (
    <div className={`bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex items-center space-x-4`}>
        <div className={`p-3 rounded-full bg-${color}-100 text-${color}-600`}>
            <Icon size={24} />
        </div>
        <div>
            <p className="text-sm text-gray-500 font-medium">{title}</p>
            <p className="text-2xl font-semibold text-gray-800">{value}</p>
        </div>
    </div>
  );

  if (yukleniyor && raporlar.length === 0) {
    return (
      <div className="fixed inset-0 bg-gray-100 bg-opacity-50 flex justify-center items-center z-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="w-full space-y-6">
        <header className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="mb-4 md:mb-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
              Yapılan İşler Yönetimi
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {secilenSaha !== 'tumu' ? getSahaAdi(secilenSaha) : 'Tüm Sahalar'} ({format(parseISO(secilenAy + '-01'), 'MMMM yyyy', { locale: tr })})
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {canAddOrEdit && (
                <button 
                    onClick={() => handleFormAc()}
                    className="flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <Plus size={18} className="mr-2"/> Yeni İş Raporu
                </button>
            )}
          </div>
        </div>
      </header>

      <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="lg:col-span-1">
                <label htmlFor="arama" className="block text-xs font-medium text-gray-700 mb-1">Ara (Başlık, Açıklama, Saha...)</label>
                <SearchInput 
                    value={aramaMetni} 
                    onChange={(value: string) => setAramaMetni(value)}
                    placeholder="Raporlarda ara..."
                />
            </div>

            <div>
                <label htmlFor="sahaFiltre" className="block text-xs font-medium text-gray-700 mb-1">Saha</label>
                <select 
                    id="sahaFiltre" 
                    value={secilenSaha} 
                    onChange={(e) => setSecilenSaha(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    disabled={kullanici?.rol === 'musteri' && sahalar.length <= 1}
                >
                    <option value="tumu">Tüm Sahalar</option>
                    {sahalar.map(s => <option key={s.id} value={s.id}>{s.ad}</option>)}
                </select>
            </div>

            <div className="flex space-x-2">
                <div>
                    <label htmlFor="ayFiltre" className="block text-xs font-medium text-gray-700 mb-1">Ay</label>
                    <select 
                        id="ayFiltre" 
                        value={secilenAyNo} 
                        onChange={(e) => setSecilenAy(`${secilenYil}-${e.target.value}`)}
                        className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                        {aySecenekleri.map(ay => <option key={ay.value} value={ay.value}>{ay.label}</option>)}
                    </select>
                </div>
                 <div>
                    <label htmlFor="yilFiltre" className="block text-xs font-medium text-gray-700 mb-1">Yıl</label>
                    <select 
                        id="yilFiltre" 
                        value={secilenYil} 
                        onChange={(e) => setSecilenAy(`${e.target.value}-${secilenAyNo}`)}
                        className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                        {yilSecenekleri.map(yil => <option key={yil} value={yil}>{yil}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex items-center justify-end space-x-1 bg-gray-100 p-0.5 rounded-lg">
                {[
                    { view: 'liste', icon: List, label: 'Liste' },
                    { view: 'kart', icon: LayoutGrid, label: 'Kart' },
                    canViewStats && { view: 'istatistik', icon: BarChart3, label: 'İstatistik' },
                ].filter(Boolean).map((item: any) => (
                    <button
                        key={item.view}
                        onClick={() => setAktifGorunum(item.view)}
                        title={item.label}
                        className={cn(
                            'flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                            aktifGorunum === item.view 
                                ? 'bg-white text-blue-600 shadow-sm' 
                                : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                        )}
                    >
                        <item.icon size={16} className="mx-auto"/>
                         <span className="sr-only">{item.label}</span>
                    </button>
                ))}
            </div>
        </div>
      </div>

      {yukleniyor && raporlar.length > 0 && (
         <div className="text-center py-4"><LoadingSpinner/> Raporlar güncelleniyor...</div>
      )}

      {!yukleniyor && filtrelenmisRaporlar.length === 0 && (
        <div className="text-center py-10 bg-white rounded-lg border border-gray-200 shadow-sm">
          <Wrench size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Rapor Bulunamadı</h3>
          <p className="text-sm text-gray-500">Seçili filtrelere uygun iş raporu bulunamadı.</p>
          {canAddOrEdit && (
             <button 
                onClick={() => handleFormAc()}
                className="mt-6 flex items-center mx-auto px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            >
                <Plus size={18} className="mr-2"/> İlk Raporu Ekle
            </button>
          )}
        </div>
      )}

      {filtrelenmisRaporlar.length > 0 && (
        <>
          {aktifGorunum === 'liste' && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Başlık</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saha</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Tarih</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Oluşturan</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Ekler</th>
                      <th scope="col" className="relative px-4 py-3"><span className="sr-only">İşlemler</span></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filtrelenmisRaporlar.map(renderReportListItem)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {aktifGorunum === 'kart' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtrelenmisRaporlar.map(renderReportCard)}
            </div>
          )}

          {aktifGorunum === 'istatistik' && stats && (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    <StatCard title="Toplam İş Raporu" value={stats.toplamIs} icon={FileText} color="blue" />
                    <StatCard title="Tamamlanan İşler" value={stats.tamamlananIsSayisi} icon={CheckCircle} color="green" />
                    <StatCard title="Farklı Saha Sayısı" value={stats.farkliSahaSayisi} icon={Building} color="purple" />
                    <StatCard title="Katılan Teknisyen" value={stats.katilanTeknisyenSayisi} icon={Users} color="yellow" />
                </div>
                <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">Haftalık İş Raporu Trendi</h3>
                    <p className="text-sm text-gray-500 mb-4">Son 7 günde oluşturulan iş raporu sayısı.</p>
                    {stats.gunlukIsSayilari.length > 0 ? (
                        <div className="h-72 sm:h-80">
                            <div className="flex items-end h-full space-x-2 sm:space-x-3 border-b border-gray-200 pb-2">
                                {stats.gunlukIsSayilari.map((item, idx) => (
                                    <div key={idx} className="flex-1 flex flex-col items-center justify-end">
                                        <div 
                                            className="w-full bg-blue-500 hover:bg-blue-600 transition-colors rounded-t-md"
                                            style={{ height: `${Math.max(5, (item["İş Sayısı"] / (Math.max(...stats.gunlukIsSayilari.map(d => d["İş Sayısı"]), 1)) * 100))}%` }}
                                            title={`${item["İş Sayısı"]} iş`}
                                        ></div>
                                        <span className="text-xs text-gray-500 mt-1.5">{item.gun}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-72 sm:h-80 flex items-center justify-center text-gray-500 bg-gray-50 rounded-md">
                            Grafik için veri bulunamadı.
                        </div>
                    )}
                </div>
            </div>
          )}
        </>
      )}

      {formAcik && (
        <YapilanIsForm 
            onClose={() => { setFormAcik(false); setDuzenlenecekRapor(null); }} 
            raporToEdit={duzenlenecekRapor}
            mode={modalMode}
            sahalar={sahalar} 
            onSuccess={() => {
                setFormAcik(false);
                setDuzenlenecekRapor(null);
                const currentSaha = secilenSaha;
                const currentAy = secilenAy;
                setSecilenSaha(currentSaha === 'tumu' ? 'temp_force_refresh' : 'tumu'); 
                setSecilenAy(format(new Date(), 'yyyy-MM') === currentAy ? format(addMonths(new Date(), -1), 'yyyy-MM') : format(new Date(), 'yyyy-MM'));
                
                setTimeout(() => { 
                    setSecilenSaha(currentSaha);
                    setSecilenAy(currentAy); 
                }, 50);
            }}
        />
      )}

      {seciliRaporDetay && (
        <IsRaporDetayModal 
            onClose={() => setSeciliRaporDetay(null)} 
            rapor={seciliRaporDetay} 
            sahaAdi={getSahaAdi(seciliRaporDetay.saha)}
        />
      )}

      {silinecekRaporId && (
        <SilmeOnayModal 
            baslik="İş Raporunu Sil"
            mesaj="Bu iş raporunu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz."
            onConfirm={() => handleRaporSil(silinecekRaporId)}
            onCancel={() => setSilinecekRaporId(null)}
        />
      )}
      </div>
    </div>
  );
};
