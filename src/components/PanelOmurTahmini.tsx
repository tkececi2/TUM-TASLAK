import React, { useState, useEffect } from 'react';
import { Card, Title, Text, BarChart, DonutChart, Flex, Metric, Badge, BadgeDelta, Button, ProgressBar } from '@tremor/react';
import { Calendar, Clock, Sun, Battery, TrendingDown, AlertTriangle, ArrowRight, Zap, Thermometer } from 'lucide-react';
import { format, addYears } from 'date-fns';
import { tr } from 'date-fns/locale';
import { tahminPanelOmur } from '../services/aiService';
import { LoadingSpinner } from './LoadingSpinner';

interface PanelOmurTahminiProps {
  santralId?: string;
  santralAdi?: string;
  kurulumTarihi?: Date;
  onDetayGoruntule?: () => void;
}

export const PanelOmurTahmini: React.FC<PanelOmurTahminiProps> = ({ 
  santralId, 
  santralAdi,
  kurulumTarihi = new Date(2020, 5, 15), // Varsayılan: 15 Haziran 2020
  onDetayGoruntule 
}) => {
  const [yukleniyor, setYukleniyor] = useState(true);
  const [omurVerileri, setOmurVerileri] = useState<any>({
    toplamOmur: 25, // yıl
    gecenSure: 3.9, // yıl
    kalanOmur: 21.1, // yıl
    performansDusus: 3.2, // %
    yillikDegradasyonOrani: 0.8, // %
    tahminiOmurSonu: addYears(kurulumTarihi, 25),
    garantiBitis: addYears(kurulumTarihi, 10),
    kritikPanelSayisi: 12,
    toplamPanelSayisi: 450,
    panelGruplari: [
      { grup: 'A Grubu', performans: 97, yaslanma: 2.8 },
      { grup: 'B Grubu', performans: 96, yaslanma: 3.1 },
      { grup: 'C Grubu', performans: 95, yaslanma: 3.5 },
      { grup: 'D Grubu', performans: 92, yaslanma: 4.2 }
    ],
    etkiFactorleri: [
      { faktor: 'Sıcaklık Stresi', etki: 35 },
      { faktor: 'UV Radyasyon', etki: 25 },
      { faktor: 'Nem Döngüleri', etki: 20 },
      { faktor: 'Mekanik Stres', etki: 15 },
      { faktor: 'Diğer', etki: 5 }
    ]
  });

  useEffect(() => {
    const panelOmurTahminiGetir = async () => {
      if (!santralId || !kurulumTarihi) {
        setYukleniyor(false);
        return;
      }

      try {
        setYukleniyor(true);
        const tahmin = await tahminPanelOmur(santralId, kurulumTarihi);
        setOmurVerileri(tahmin);
      } catch (error) {
        console.error('Panel ömür tahmini hatası:', error);
        // Hata durumunda varsayılan değerler kullanılır
      } finally {
        setYukleniyor(false);
      }
    };

    panelOmurTahminiGetir();
  }, [santralId, kurulumTarihi]);

  if (yukleniyor) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Kalan ömür yüzdesi
  const kalanOmurYuzdesi = (omurVerileri.kalanOmur / omurVerileri.toplamOmur) * 100;

  return (
    <Card className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="p-2 bg-green-100 rounded-full mr-3">
            <Battery className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <Title>Panel Ömür Tahmini</Title>
            <Text>Yapay zeka destekli panel ömür ve performans analizi</Text>
          </div>
        </div>
        {santralAdi && (
          <div className="bg-yellow-100 px-3 py-1 rounded-full text-sm text-yellow-800 flex items-center">
            <Sun className="h-4 w-4 mr-1" />
            {santralAdi}
          </div>
        )}
      </div>

      {/* Özet Metrikler */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card decoration="top" decorationColor="green">
          <Flex>
            <div>
              <Text>Kalan Tahmini Ömür</Text>
              <Metric>{omurVerileri.kalanOmur.toFixed(1)} yıl</Metric>
            </div>
            <BadgeDelta deltaType="moderateIncrease">
              %{kalanOmurYuzdesi.toFixed(1)}
            </BadgeDelta>
          </Flex>
          <ProgressBar value={kalanOmurYuzdesi} color="green" className="mt-2" />
        </Card>
        
        <Card decoration="top" decorationColor="amber">
          <Flex>
            <div>
              <Text>Performans Düşüşü</Text>
              <Metric>%{omurVerileri.performansDusus.toFixed(1)}</Metric>
            </div>
            <TrendingDown className="h-6 w-6 text-amber-500" />
          </Flex>
          <Text className="mt-2">Yıllık degradasyon: %{omurVerileri.yillikDegradasyonOrani}</Text>
        </Card>
        
        <Card decoration="top" decorationColor="red">
          <Flex>
            <div>
              <Text>Kritik Paneller</Text>
              <Metric>{omurVerileri.kritikPanelSayisi} / {omurVerileri.toplamPanelSayisi}</Metric>
            </div>
            <BadgeDelta deltaType="moderateDecrease">
              %{((omurVerileri.kritikPanelSayisi / omurVerileri.toplamPanelSayisi) * 100).toFixed(1)}
            </BadgeDelta>
          </Flex>
          <Text className="mt-2">Erken değişim gerekebilir</Text>
        </Card>
      </div>

      {/* Önemli Tarihler */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <Calendar className="h-5 w-5 mr-2 text-blue-600" />
            <Text className="font-medium text-blue-800">Önemli Tarihler</Text>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1 text-blue-600" />
                <Text className="text-blue-800">Kurulum Tarihi</Text>
              </div>
              <Text className="text-blue-800">{format(kurulumTarihi, 'dd MMMM yyyy', { locale: tr })}</Text>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1 text-amber-600" />
                <Text className="text-amber-800">Garanti Bitiş</Text>
              </div>
              <Text className="text-amber-800">{format(omurVerileri.garantiBitis, 'dd MMMM yyyy', { locale: tr })}</Text>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1 text-red-600" />
                <Text className="text-red-800">Tahmini Ömür Sonu</Text>
              </div>
              <Text className="text-red-800">{format(omurVerileri.tahminiOmurSonu, 'dd MMMM yyyy', { locale: tr })}</Text>
            </div>
          </div>
        </div>

        {/* Ömür Etkileyen Faktörler */}
        <div>
          <Text className="font-medium mb-2">Ömür Etkileyen Faktörler</Text>
          <DonutChart
            data={omurVerileri.etkiFactorleri}
            category="etki"
            index="faktor"
            valueFormatter={(value) => `%${value}`}
            colors={["red", "amber", "blue", "green", "gray"]}
            className="h-40"
          />
        </div>
      </div>

      {/* Panel Grup Performansları */}
      <div className="mb-6">
        <Text className="font-medium mb-2">Panel Grup Performansları</Text>
        <div className="space-y-3">
          {omurVerileri.panelGruplari.map((grup, index) => (
            <div key={index}>
              <Flex>
                <Text>{grup.grup}</Text>
                <div className="flex items-center space-x-2">
                  <Badge color={grup.performans > 95 ? "green" : grup.performans > 90 ? "amber" : "red"}>
                    %{grup.performans} Performans
                  </Badge>
                  <Badge color={grup.yaslanma < 3 ? "green" : grup.yaslanma < 4 ? "amber" : "red"}>
                    %{grup.yaslanma} Yaşlanma
                  </Badge>
                </div>
              </Flex>
              <ProgressBar 
                value={grup.performans} 
                color={grup.performans > 95 ? "green" : grup.performans > 90 ? "amber" : "red"} 
                className="mt-1" 
              />
            </div>
          ))}
        </div>
      </div>

      {/* Uyarılar */}
      <div className="bg-amber-50 p-4 rounded-lg mb-6">
        <div className="flex items-center mb-2">
          <AlertTriangle className="h-5 w-5 mr-2 text-amber-600" />
          <Text className="font-medium text-amber-800">Ömür Uzatma Tavsiyeleri</Text>
        </div>
        <ul className="space-y-2">
          <li className="flex items-start">
            <Thermometer className="h-4 w-4 mr-2 text-amber-600 mt-0.5 flex-shrink-0" />
            <Text className="text-amber-800">Panel sıcaklıklarını düşürmek için düzenli temizlik yapın</Text>
          </li>
          <li className="flex items-start">
            <Zap className="h-4 w-4 mr-2 text-amber-600 mt-0.5 flex-shrink-0" />
            <Text className="text-amber-800">D Grubu panellerde sıcak nokta kontrolü yapılmalı</Text>
          </li>
          <li className="flex items-start">
            <Sun className="h-4 w-4 mr-2 text-amber-600 mt-0.5 flex-shrink-0" />
            <Text className="text-amber-800">Gölgelenme durumunu kontrol edin ve minimize edin</Text>
          </li>
        </ul>
      </div>

      {/* Aksiyon Butonu */}
      <Button 
        onClick={onDetayGoruntule} 
        color="green" 
        className="w-full"
      >
        <div className="flex items-center justify-center">
          <span>Detaylı Panel Ömür Analizi</span>
          <ArrowRight className="h-4 w-4 ml-2" />
        </div>
      </Button>
    </Card>
  );
};