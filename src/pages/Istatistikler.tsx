import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatsCard } from '../components/StatsCard';
import { AlertTriangle, Clock, CheckCircle, Building } from 'lucide-react';
import type { Ariza } from '../types';
import toast from 'react-hot-toast';

export const Istatistikler: React.FC = () => {
  const { kullanici } = useAuth();
  const [arizalar, setArizalar] = useState<Ariza[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secilenSaha, setSecilenSaha] = useState<string>('');
  const [sahalar, setSahalar] = useState<Record<string, string>>({});

  useEffect(() => {
    const veriGetir = async () => {
      if (!kullanici) return;

      try {
        // Sahaları getir - sadece kendi şirketine ait sahaları getir
        let sahaQuery;
        if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          sahaQuery = query(
            collection(db, 'sahalar'),
            where('__name__', 'in', kullanici.sahalar),
            where('companyId', '==', kullanici.companyId)
          );
        } else if (kullanici.rol === 'superadmin') {
          // Superadmin tüm sahaları görebilir
          sahaQuery = query(collection(db, 'sahalar'));
        } else {
          // Diğer roller sadece kendi şirketlerinin sahalarını görebilir
          sahaQuery = query(
            collection(db, 'sahalar'),
            where('companyId', '==', kullanici.companyId)
          );
        }
        
        const sahaSnapshot = await getDocs(sahaQuery);
        const sahaMap: Record<string, string> = {};
        const sahaIdList: string[] = [];
        
        sahaSnapshot.docs.forEach(doc => {
          sahaMap[doc.id] = doc.data().ad;
          sahaIdList.push(doc.id);
        });
        setSahalar(sahaMap);

        // Arızaları getir - şirket bazlı izolasyon ekle
        let arizaQuery;
        
        // Her durumda şirket filtresi uygulanmalı (superadmin hariç)
        const companyFilter = kullanici.rol !== 'superadmin' 
          ? where('companyId', '==', kullanici.companyId) 
          : null;
          
        // Şirket filtresi olmadan hiçbir sorgu çalıştırılmamalı (superadmin hariç)
        if (kullanici.rol !== 'superadmin' && !kullanici.companyId) {
          console.error("Kullanıcının şirket ID'si yok, veri getirilemez");
          setArizalar([]);
          setYukleniyor(false);
          return;
        }
        
        if (kullanici.rol === 'musteri' && kullanici.sahalar) {
          if (secilenSaha) {
            if (!kullanici.sahalar.includes(secilenSaha)) {
              setArizalar([]);
              return;
            }
            
            // Müşteri seçili sahaya göre filtreleme
            const filters = [where('saha', '==', secilenSaha)];
            // Şirket filtresi her zaman uygulanmalı
            if (companyFilter) filters.push(companyFilter);
            
            arizaQuery = query(
              collection(db, 'arizalar'),
              ...filters,
              orderBy('olusturmaTarihi', 'desc')
            );
          } else {
            // Müşteri tüm sahalarına göre filtreleme
            const filters = [where('saha', 'in', kullanici.sahalar)];
            // Şirket filtresi her zaman uygulanmalı
            if (companyFilter) filters.push(companyFilter);
            
            arizaQuery = query(
              collection(db, 'arizalar'),
              ...filters,
              orderBy('olusturmaTarihi', 'desc')
            );
          }
        } else if (secilenSaha) {
          // Seçili sahaya göre filtreleme
          const filters = [where('saha', '==', secilenSaha)];
          // Şirket filtresi her zaman uygulanmalı
          if (companyFilter) filters.push(companyFilter);
          
          arizaQuery = query(
            collection(db, 'arizalar'),
            ...filters,
            orderBy('olusturmaTarihi', 'desc')
          );
        } else if (sahaIdList.length > 0) {
          // Şirkete ait tüm sahalara göre filtreleme
          const filters = [];
          // Kullanıcı superadmin değilse saha filtresini ekle
          if (kullanici.rol !== 'superadmin' && sahaIdList.length <= 10) {
            filters.push(where('saha', 'in', sahaIdList));
          }
          
          // Şirket filtresi her zaman uygulanmalı
          if (companyFilter) filters.push(companyFilter);
          
          arizaQuery = query(
            collection(db, 'arizalar'),
            ...filters,
            orderBy('olusturmaTarihi', 'desc')
          );
        } else {
          // Şirket filtresi ile tüm arızaları getir
          const filters = [];
          // Şirket filtresi her zaman uygulanmalı
          if (companyFilter) filters.push(companyFilter);
          
          arizaQuery = query(
            collection(db, 'arizalar'),
            ...filters,
            orderBy('olusturmaTarihi', 'desc')
          );
        }

        console.log("Arıza sorgusu oluşturuldu. Kullanıcı:", {
          rol: kullanici.rol,
          companyId: kullanici.companyId,
          secilenSaha: secilenSaha,
          sahaIdList: sahaIdList.length
        });
        
        // Query içeriğini loglama
        const queryFilters = arizaQuery._query.filters 
          ? arizaQuery._query.filters.map(f => {
              return { field: f.field.segments.join('.'), op: f.op.name, value: f.value };
            }) 
          : [];
        console.log("Sorgu filtreleri:", queryFilters);
        
        const snapshot = await getDocs(arizaQuery);
        const arizaVerileri = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Ariza[];
        
        console.log(`${arizaVerileri.length} arıza verisi getirildi`);
        
        // Şirket ID'lerine göre veri doğrulama
        if (kullanici.rol !== 'superadmin') {
          const yabanciSirketVerileri = arizaVerileri.filter(ariza => 
            ariza.companyId !== kullanici.companyId
          );
          
          if (yabanciSirketVerileri.length > 0) {
            console.error("UYARI: Farklı şirketlere ait veriler tespit edildi:", 
              yabanciSirketVerileri.map(v => v.companyId));
            
            // Sadece kullanıcının kendi şirketine ait verileri kullan
            const filtrelenmisVeriler = arizaVerileri.filter(
              ariza => ariza.companyId === kullanici.companyId
            );
            
            setArizalar(filtrelenmisVeriler);
          } else {
            setArizalar(arizaVerileri);
          }
        } else {
          setArizalar(arizaVerileri);
        }
      } catch (error) {
        console.error('Veri getirme hatası:', error);
        toast.error('Veriler yüklenirken bir hata oluştu');
      } finally {
        setYukleniyor(false);
      }
    };

    veriGetir();
  }, [kullanici, secilenSaha]);

  if (yukleniyor) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const acikArizalar = arizalar.filter(a => a.durum === 'acik').length;
  const devamEdenArizalar = arizalar.filter(a => a.durum === 'devam-ediyor').length;
  const bekleyenArizalar = arizalar.filter(a => a.durum === 'beklemede').length;
  const cozulenArizalar = arizalar.filter(a => a.durum === 'cozuldu').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">İstatistikler</h1>
          <p className="mt-1 text-sm text-gray-500">
            {kullanici?.rol === 'musteri' 
              ? 'Sahalarınıza ait arıza istatistikleri'
              : 'Genel arıza istatistikleri'}
          </p>
        </div>

        {Object.keys(sahalar).length > 0 && (
          <select
            value={secilenSaha}
            onChange={(e) => setSecilenSaha(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500"
          >
            <option value="">Tüm Sahalar</option>
            {Object.entries(sahalar).map(([id, ad]) => (
              <option key={id} value={id}>{ad}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Açık Arızalar"
          value={acikArizalar}
          icon={AlertTriangle}
          color="red"
        />
        <StatsCard
          title="Devam Eden"
          value={devamEdenArizalar}
          icon={Clock}
          color="yellow"
        />
        <StatsCard
          title="Bekleyen"
          value={bekleyenArizalar}
          icon={Clock}
          color="blue"
        />
        <StatsCard
          title="Çözülen"
          value={cozulenArizalar}
          icon={CheckCircle}
          color="green"
        />
      </div>

      {/* Saha bazlı istatistikler */}
      {!secilenSaha && Object.keys(sahalar).length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Saha Bazlı İstatistikler</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(sahalar).map(([sahaId, sahaAdi]) => {
              const sahaArizalari = arizalar.filter(a => a.saha === sahaId);
              const acik = sahaArizalari.filter(a => a.durum === 'acik').length;
              const devamEden = sahaArizalari.filter(a => a.durum === 'devam-ediyor').length;
              const cozulen = sahaArizalari.filter(a => a.durum === 'cozuldu').length;

              return (
                <div key={sahaId} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center mb-4">
                    <Building className="h-5 w-5 text-yellow-500 mr-2" />
                    <h3 className="text-lg font-medium text-gray-900">{sahaAdi}</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Açık Arızalar:</span>
                      <span className="font-medium text-red-600">{acik}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Devam Eden:</span>
                      <span className="font-medium text-yellow-600">{devamEden}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Çözülen:</span>
                      <span className="font-medium text-green-600">{cozulen}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium pt-2 border-t">
                      <span className="text-gray-900">Toplam:</span>
                      <span className="text-gray-900">{sahaArizalari.length}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};