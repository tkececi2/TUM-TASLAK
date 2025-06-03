
import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  Building, 
  TrendingUp, 
  BarChart3,
  Target,
  Activity
} from 'lucide-react';
import { Card, Title, Text, Metric, Flex, ProgressBar, Grid, Col, Badge } from '@tremor/react';
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
  const toplamArizalar = arizalar.length;

  // Başarı oranı hesapla
  const basariOrani = toplamArizalar > 0 ? (cozulenArizalar / toplamArizalar) * 100 : 0;

  return (
    <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              İstatistikler ve Analiz
            </h1>
            <p className="text-blue-100 text-lg">
              {kullanici?.rol === 'musteri' 
                ? 'Sahalarınıza ait detaylı arıza istatistikleri'
                : 'Genel sistem performansı ve arıza analizi'}
            </p>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{toplamArizalar}</div>
              <div className="text-sm text-blue-200">Toplam Arıza</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">%{basariOrani.toFixed(1)}</div>
              <div className="text-sm text-blue-200">Başarı Oranı</div>
            </div>
          </div>
        </div>

        {/* Filtre */}
        {Object.keys(sahalar).length > 0 && (
          <div className="mt-6">
            <select
              value={secilenSaha}
              onChange={(e) => setSecilenSaha(e.target.value)}
              className="bg-white/10 border border-white/20 text-white placeholder-white/70 rounded-xl px-4 py-3 focus:ring-2 focus:ring-white/30 focus:border-transparent backdrop-blur-sm"
            >
              <option value="" className="text-gray-900">Tüm Sahalar</option>
              {Object.entries(sahalar).map(([id, ad]) => (
                <option key={id} value={id} className="text-gray-900">{ad}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Ana İstatistik Kartları */}
      <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-6">
        <Card className="bg-white border border-red-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-gray-600 font-medium">Acil Arızalar</Text>
              <Metric className="text-red-600 font-bold">{acikArizalar}</Metric>
              <div className="mt-2">
                <Badge color="red" size="sm">
                  Öncelikli
                </Badge>
              </div>
            </div>
            <div className="p-4 bg-red-100 rounded-xl">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </Card>
        
        <Card className="bg-white border border-yellow-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-gray-600 font-medium">Devam Eden</Text>
              <Metric className="text-yellow-600 font-bold">{devamEdenArizalar}</Metric>
              <div className="mt-2">
                <ProgressBar 
                  value={toplamArizalar > 0 ? (devamEdenArizalar / toplamArizalar) * 100 : 0} 
                  color="yellow" 
                  className="w-20" 
                />
              </div>
            </div>
            <div className="p-4 bg-yellow-100 rounded-xl">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </Card>
        
        <Card className="bg-white border border-blue-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-gray-600 font-medium">Bekleyende</Text>
              <Metric className="text-blue-600 font-bold">{bekleyenArizalar}</Metric>
              <div className="mt-2">
                <Badge color="blue" size="sm">
                  Sırada
                </Badge>
              </div>
            </div>
            <div className="p-4 bg-blue-100 rounded-xl">
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </Card>
        
        <Card className="bg-white border border-green-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-gray-600 font-medium">Çözülen</Text>
              <Metric className="text-green-600 font-bold">{cozulenArizalar}</Metric>
              <div className="mt-2">
                <Badge color="green" size="sm">
                  Tamamlandı
                </Badge>
              </div>
            </div>
            <div className="p-4 bg-green-100 rounded-xl">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </Card>
      </Grid>

      {/* Performans Kartları */}
      <Grid numItems={1} numItemsSm={2} numItemsLg={3} className="gap-6">
        <Card className="bg-white shadow-lg rounded-xl border border-gray-100">
          <Title className="text-gray-800 mb-4">Genel Performans</Title>
          <div className="space-y-4">
            <div>
              <Flex>
                <Text>Başarı Oranı</Text>
                <Text className="font-semibold">%{basariOrani.toFixed(1)}</Text>
              </Flex>
              <ProgressBar 
                value={basariOrani} 
                color={basariOrani >= 80 ? "green" : basariOrani >= 60 ? "yellow" : "red"} 
                className="mt-2" 
              />
            </div>
            
            <div>
              <Flex>
                <Text>Aktif Arızalar</Text>
                <Text className="font-semibold">{acikArizalar + devamEdenArizalar}</Text>
              </Flex>
              <ProgressBar 
                value={toplamArizalar > 0 ? ((acikArizalar + devamEdenArizalar) / toplamArizalar) * 100 : 0} 
                color="red" 
                className="mt-2" 
              />
            </div>
          </div>
        </Card>

        <Card className="bg-white shadow-lg rounded-xl border border-gray-100">
          <Title className="text-gray-800 mb-4">Sistem Durumu</Title>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-600">Toplam Saha</span>
              <Badge color="gray" size="lg">{Object.keys(sahalar).length}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-gray-600">Toplam Arıza</span>
              <Badge color="blue" size="lg">{toplamArizalar}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-gray-600">Çözüm Oranı</span>
              <Badge color="green" size="lg">%{basariOrani.toFixed(0)}</Badge>
            </div>
          </div>
        </Card>

        <Card className="bg-white shadow-lg rounded-xl border border-gray-100">
          <Title className="text-gray-800 mb-4">Hızlı Erişim</Title>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors cursor-pointer">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="text-gray-700">Acil Müdahale</span>
              </div>
              <Badge color="red">{acikArizalar}</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors cursor-pointer">
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-yellow-600" />
                <span className="text-gray-700">Takip Gereken</span>
              </div>
              <Badge color="yellow">{devamEdenArizalar}</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors cursor-pointer">
              <div className="flex items-center space-x-3">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-gray-700">Başarılı Çözüm</span>
              </div>
              <Badge color="green">{cozulenArizalar}</Badge>
            </div>
          </div>
        </Card>
      </Grid>

      {/* Saha Bazlı İstatistikler */}
      {!secilenSaha && Object.keys(sahalar).length > 0 && (
        <Card className="bg-white shadow-lg rounded-xl border border-gray-100">
          <Title className="text-gray-800 mb-6">Saha Bazlı Detaylı Analiz</Title>
          <Grid numItems={1} numItemsSm={2} numItemsLg={3} className="gap-6">
            {Object.entries(sahalar).map(([sahaId, sahaAdi]) => {
              const sahaArizalari = arizalar.filter(a => a.saha === sahaId);
              const acik = sahaArizalari.filter(a => a.durum === 'acik').length;
              const devamEden = sahaArizalari.filter(a => a.durum === 'devam-ediyor').length;
              const cozulen = sahaArizalari.filter(a => a.durum === 'cozuldu').length;
              const sahaBasariOrani = sahaArizalari.length > 0 ? (cozulen / sahaArizalari.length) * 100 : 0;

              return (
                <Card key={sahaId} className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center mb-4">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <Building className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{sahaAdi}</h3>
                      <p className="text-sm text-gray-500">Saha Performansı</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Başarı Oranı</span>
                      <Badge color={sahaBasariOrani >= 80 ? "green" : sahaBasariOrani >= 60 ? "yellow" : "red"}>
                        %{sahaBasariOrani.toFixed(0)}
                      </Badge>
                    </div>
                    
                    <ProgressBar 
                      value={sahaBasariOrani} 
                      color={sahaBasariOrani >= 80 ? "green" : sahaBasariOrani >= 60 ? "yellow" : "red"} 
                      className="mb-4" 
                    />
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="text-center p-2 bg-red-50 rounded-lg">
                        <div className="font-semibold text-red-600">{acik}</div>
                        <div className="text-gray-500">Acil</div>
                      </div>
                      <div className="text-center p-2 bg-yellow-50 rounded-lg">
                        <div className="font-semibold text-yellow-600">{devamEden}</div>
                        <div className="text-gray-500">Devam Eden</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <span className="text-sm font-medium text-gray-700">Toplam Arıza</span>
                      <Badge color="gray" size="lg">{sahaArizalari.length}</Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
          </Grid>
        </Card>
      )}
    </div>
  );
};
