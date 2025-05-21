import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Sun, 
  Battery,
  Thermometer,
  CloudSun,
  DollarSign,
  Leaf,
  TrendingUp,
  BarChart2,
  Clock,
  Zap,
  Calendar,
  Download
} from 'lucide-react';
import { Card, Title, AreaChart, Flex, Text, Grid, Col, ProgressBar, Metric, BadgeDelta } from '@tremor/react';
import { LoadingSpinner } from './LoadingSpinner';
import toast from 'react-hot-toast';
import type { GesVerisi, GesDetay } from '../types';

interface GesDashboardProps {
  santralId: string;
  dateRange: 'week' | 'month' | 'year';
  secilenAy?: string;
}

export const GesDashboard: React.FC<GesDashboardProps> = ({ 
  santralId, 
  dateRange, 
  secilenAy = format(new Date(), 'yyyy-MM')
}) => {
  const { kullanici } = useAuth();
  const [uretimVerileri, setUretimVerileri] = useState<GesVerisi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [santralDetay, setSantralDetay] = useState<GesDetay | null>(null);

  // İstatistikler
  const [istatistikler, setIstatistikler] = useState({
    toplamUretim: 0,
    ortalamaGunlukUretim: 0,
    toplamGelir: 0,
    toplamCO2Tasarrufu: 0,
    kapasiteFaktoru: 0,
    hedefGerceklesme: 0,
    aylikHedef: 0,
    karsilastirmaVerileri: [] as {date: string, gercekUretim: number, hedefUretim: number}[]
  });

  useEffect(() => {
    const verileriGetir = async () => {
      if (!santralId) return;

      try {
        setYukleniyor(true);
        
        // Santral detaylarını getir
        const santralDoc = await getDocs(query(
          collection(db, 'santraller'),
          where('__name__', '==', santralId)
        ));
        
        if (!santralDoc.empty) {
          setSantralDetay({
            id: santralDoc.docs[0].id,
            ...santralDoc.docs[0].data()
          } as GesDetay);
        }
        
        // Üretim verilerini getir - Changed to match the index structure
        const verilerQuery = query(
          collection(db, 'uretimVerileri'),
          where('santralId', '==', santralId),
          orderBy('tarih', 'desc')
        );

        const snapshot = await getDocs(verilerQuery);
        const veriler = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as GesVerisi[];

        // Tarih filtreleme
        let filtrelenmisVeriler = veriler;
        
        if (dateRange === 'month') {
          const ayBaslangic = startOfMonth(parseISO(secilenAy + '-01'));
          const ayBitis = endOfMonth(parseISO(secilenAy + '-01'));
          
          filtrelenmisVeriler = veriler.filter(veri => {
            const veriTarihi = veri.tarih.toDate();
            return veriTarihi >= ayBaslangic && veriTarihi <= ayBitis;
          });
        } else if (dateRange === 'week') {
          const birHaftaOnce = subDays(new Date(), 7);
          filtrelenmisVeriler = veriler.filter(veri => {
            return veri.tarih.toDate() >= birHaftaOnce;
          });
        }

        setUretimVerileri(filtrelenmisVeriler);
        
        // İstatistikleri hesapla
        if (filtrelenmisVeriler.length > 0 && santralDoc.docs[0]) {
          const santral = santralDoc.docs[0].data() as GesDetay;
          
          const toplamUretim = filtrelenmisVeriler.reduce((acc, veri) => acc + veri.gunlukUretim, 0);
          const toplamGelir = filtrelenmisVeriler.reduce((acc, veri) => acc + (veri.gelir || 0), 0);
          const toplamCO2 = filtrelenmisVeriler.reduce((acc, veri) => acc + (veri.tasarrufEdilenCO2 || 0), 0);
          
          // Aylık hedef üretim hesaplama
          let aylikHedef = 0;
          const ay = parseInt(secilenAy.split('-')[1]) - 1; // 0-11 arası
          const aylar = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik'];
          
          if (santral.aylikHedefler && santral.aylikHedefler[aylar[ay]]) {
            aylikHedef = santral.aylikHedefler[aylar[ay]];
          } else {
            // Aylık hedef yoksa yıllık hedefin 1/12'si
            aylikHedef = (santral.yillikHedefUretim || 0) / 12;
          }
          
          // Hedef gerçekleşme oranı
          const hedefGerceklesme = aylikHedef > 0 ? (toplamUretim / aylikHedef) * 100 : 0;
          
          // Kapasite faktörü hesaplama (24 saat üzerinden)
          const gunSayisi = filtrelenmisVeriler.length;
          const teorikUretim = santral.kapasite * 24 * gunSayisi; // 24 saat/gün tam kapasite
          const kapasiteFaktoru = teorikUretim > 0 ? (toplamUretim / teorikUretim) * 100 : 0;
          
          // Günlük hedef hesaplama
          const gunlukHedef = aylikHedef / 30; // Ortalama 30 gün varsayımı
          
          // Karşılaştırma grafiği için verileri hazırla
          const karsilastirmaVerileri = filtrelenmisVeriler
            .slice(0, 14)
            .sort((a, b) => a.tarih.toDate().getTime() - b.tarih.toDate().getTime())
            .map(veri => ({
              date: format(veri.tarih.toDate(), 'dd MMM', { locale: tr }),
              gercekUretim: veri.gunlukUretim,
              hedefUretim: gunlukHedef
            }));
          
          setIstatistikler({
            toplamUretim,
            ortalamaGunlukUretim: gunSayisi > 0 ? toplamUretim / gunSayisi : 0,
            toplamGelir,
            toplamCO2Tasarrufu: toplamCO2,
            kapasiteFaktoru,
            hedefGerceklesme,
            aylikHedef,
            karsilastirmaVerileri
          });
        }
      } catch (error) {
        console.error('Üretim verileri getirilemedi:', error);
        toast.error('Veriler yüklenirken bir hata oluştu');
        
        // Hata durumunda örnek veriler oluştur
        const demoVeriler = Array.from({ length: 14 }, (_, i) => {
          const tarih = subDays(new Date(), 13 - i);
          return {
            date: format(tarih, 'dd MMM', { locale: tr }),
            uretim: Math.floor(Math.random() * 1000) + 500
          };
        });
        
        setIstatistikler(prev => ({
          ...prev,
          karsilastirmaVerileri: demoVeriler.map(d => ({
            date: d.date,
            gercekUretim: d.uretim,
            hedefUretim: d.uretim * 1.1
          }))
        }));
      } finally {
        setYukleniyor(false);
      }
    };

    verileriGetir();
  }, [santralId, dateRange, secilenAy]);

  const handleRaporIndir = () => {
    try {
      const headers = ['Tarih', 'Günlük Üretim (kWh)', 'Gelir (₺)', 'CO2 Tasarrufu (kg)', 'Kapasite Faktörü (%)'];
      const rows = uretimVerileri.map(veri => [
        format(veri.tarih.toDate(), 'dd.MM.yyyy'),
        veri.gunlukUretim.toString(),
        (veri.gelir || 0).toFixed(2),
        (veri.tasarrufEdilenCO2 || 0).toFixed(1),
        (veri.performansOrani || 0).toFixed(1)
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `uretim-raporu-${santralId}-${secilenAy}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success('Rapor başarıyla indirildi');
    } catch (error) {
      console.error('Rapor indirme hatası:', error);
      toast.error('Rapor indirilirken bir hata oluştu');
    }
  };

  if (yukleniyor) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Veri yoksa örnek veri oluştur
  const chartData = istatistikler.karsilastirmaVerileri.length > 0 
    ? istatistikler.karsilastirmaVerileri 
    : Array.from({ length: 14 }, (_, i) => {
        const tarih = subDays(new Date(), 13 - i);
        const uretim = Math.floor(Math.random() * 1000) + 500;
        return {
          date: format(tarih, 'dd MMM', { locale: tr }),
          gercekUretim: uretim,
          hedefUretim: uretim * 1.1
        };
      });

  return (
    <div className="space-y-6">
      {/* Santral Bilgileri */}
      {santralDetay && (
        <Card className="bg-gradient-to-r from-yellow-50 to-orange-50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="p-3 bg-yellow-100 rounded-full mr-4">
                <Sun className="h-8 w-8 text-yellow-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{santralDetay.ad}</h2>
                <p className="text-sm text-gray-600">{santralDetay.konum.adres}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-500">Kurulu Güç</p>
                <p className="text-lg font-semibold text-gray-900">{santralDetay.kapasite} kWp</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Panel Sayısı</p>
                <p className="text-lg font-semibold text-gray-900">{santralDetay.panelSayisi.toLocaleString('tr-TR')}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">İnvertör Sayısı</p>
                <p className="text-lg font-semibold text-gray-900">{santralDetay.inverterSayisi.toLocaleString('tr-TR')}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Sistem Verimi</p>
                <p className="text-lg font-semibold text-gray-900">%{santralDetay.teknikOzellikler.sistemVerimi.toLocaleString('tr-TR')}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Ana İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card decoration="top" decorationColor="yellow">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm">Toplam Üretim</Text>
              <Metric>{istatistikler.toplamUretim.toLocaleString('tr-TR', {maximumFractionDigits: 1})} kWh</Metric>
              <Text className="text-xs text-gray-500 mt-1">
                Ortalama: {istatistikler.ortalamaGunlukUretim.toLocaleString('tr-TR', {maximumFractionDigits: 1})} kWh/gün
              </Text>
            </div>
            <div className="rounded-full p-3 bg-green-100">
              <Battery className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>
        
        <Card decoration="top" decorationColor="green">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm">Toplam Gelir</Text>
              <Metric>{istatistikler.toplamGelir.toLocaleString('tr-TR', {maximumFractionDigits: 2})} ₺</Metric>
              <Text className="text-xs text-gray-500 mt-1">
                Birim Fiyat: 2,5 ₺/kWh
              </Text>
            </div>
            <div className="rounded-full p-3 bg-yellow-100">
              <DollarSign className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </Card>
        
        <Card decoration="top" decorationColor="blue">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm">CO2 Tasarrufu</Text>
              <Metric>{istatistikler.toplamCO2Tasarrufu.toLocaleString('tr-TR', {maximumFractionDigits: 1})} kg</Metric>
              <Text className="text-xs text-gray-500 mt-1">
                {(istatistikler.toplamCO2Tasarrufu / 1000).toLocaleString('tr-TR', {maximumFractionDigits: 2})} ton CO2
              </Text>
            </div>
            <div className="rounded-full p-3 bg-green-100">
              <Leaf className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>
        
        <Card decoration="top" decorationColor="orange">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm">Kapasite Faktörü</Text>
              <Metric>%{istatistikler.kapasiteFaktoru.toLocaleString('tr-TR', {maximumFractionDigits: 1})}</Metric>
              <Text className="text-xs text-gray-500 mt-1">
                Hedef Gerçekleşme: %{istatistikler.hedefGerceklesme.toLocaleString('tr-TR', {maximumFractionDigits: 1})}
              </Text>
            </div>
            <div className="rounded-full p-3 bg-blue-100">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Üretim ve Hedef Karşılaştırması - Alan grafiği */}
      <Card>
        <Title>Üretim ve Hedef Karşılaştırması</Title>
        <Text>Günlük üretim ve hedef değerleri</Text>
        <div className="mt-4 h-96">
          <AreaChart
            className="h-96"
            data={chartData}
            index="date"
            categories={["gercekUretim", "hedefUretim"]}
            colors={["yellow", "blue"]}
            valueFormatter={(value) => `${value.toLocaleString('tr-TR', {maximumFractionDigits: 1})} kWh`}
            yAxisWidth={80}
            showLegend={true}
            showAnimation={true}
            showGradient={true}
            curveType="natural"
            customTooltip={(props) => {
              const { payload, active } = props;
              if (!active || !payload) return null;
              
              return (
                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                  <div className="text-sm font-medium text-gray-900">{payload[0]?.payload.date}</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                      <span className="text-xs text-gray-600">Gerçekleşen:</span>
                      <span className="ml-1 text-xs font-medium">
                        {payload[0]?.value?.toLocaleString('tr-TR', {maximumFractionDigits: 1})} kWh
                      </span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                      <span className="text-xs text-gray-600">Hedef:</span>
                      <span className="ml-1 text-xs font-medium">
                        {payload[1]?.value?.toLocaleString('tr-TR', {maximumFractionDigits: 1})} kWh
                      </span>
                    </div>
                  </div>
                </div>
              );
            }}
          />
        </div>
      </Card>

      {/* Hedef Gerçekleşme */}
      <Card>
        <Title>Hedef Gerçekleşme Durumu</Title>
        <Text>Aylık hedef: {istatistikler.aylikHedef.toLocaleString('tr-TR', {maximumFractionDigits: 1})} kWh</Text>
        <div className="mt-4">
          <Flex>
            <Text>Gerçekleşen: {istatistikler.toplamUretim.toLocaleString('tr-TR', {maximumFractionDigits: 1})} kWh</Text>
            <Text>%{istatistikler.hedefGerceklesme.toLocaleString('tr-TR', {maximumFractionDigits: 1})}</Text>
          </Flex>
          <ProgressBar 
            value={Math.min(istatistikler.hedefGerceklesme, 100)} 
            color={istatistikler.hedefGerceklesme >= 100 ? "green" : istatistikler.hedefGerceklesme >= 75 ? "yellow" : "orange"} 
            className="mt-2" 
          />
        </div>
      </Card>

      {/* Performans Göstergeleri */}
      <Card>
        <Title>Performans Göstergeleri</Title>
        <Grid numItemsMd={2} numItemsLg={3} className="mt-6 gap-6">
          <Col>
            <Text>Hedef Gerçekleşme</Text>
            <div className="mt-2">
              <Flex>
                <Text>%{istatistikler.hedefGerceklesme.toLocaleString('tr-TR', {maximumFractionDigits: 1})}</Text>
                <Text>{dateRange === 'month' ? 'Aylık' : dateRange === 'week' ? 'Haftalık' : 'Yıllık'} Hedef</Text>
              </Flex>
              <ProgressBar value={Math.min(istatistikler.hedefGerceklesme, 100)} color="yellow" className="mt-2" />
            </div>
          </Col>
          <Col>
            <Text>Kapasite Faktörü</Text>
            <div className="mt-2">
              <Flex>
                <Text>%{istatistikler.kapasiteFaktoru.toLocaleString('tr-TR', {maximumFractionDigits: 1})}</Text>
                <Text>Teorik Maksimuma Göre</Text>
              </Flex>
              <ProgressBar value={Math.min(istatistikler.kapasiteFaktoru, 100)} color="blue" className="mt-2" />
            </div>
          </Col>
          <Col>
            <Text>Çevresel Etki</Text>
            <div className="mt-2">
              <Flex>
                <Text>{istatistikler.toplamCO2Tasarrufu.toLocaleString('tr-TR', {maximumFractionDigits: 1})} kg</Text>
                <Text>CO2 Tasarrufu</Text>
              </Flex>
              <ProgressBar value={100} color="green" className="mt-2" />
            </div>
          </Col>
        </Grid>
      </Card>
    </div>
  );
};