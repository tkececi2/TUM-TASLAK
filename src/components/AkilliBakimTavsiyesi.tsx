import React, { useState, useEffect } from 'react';
import { Card, Title, Text, Metric, ProgressBar, Flex, Badge, BadgeDelta, Button } from '@tremor/react';
import { AlertTriangle, CheckCircle, Calendar, Zap, Wrench, ArrowRight, Clock, Sun, Battery } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { olusturBakimTavsiyesi } from '../services/aiService';
import { LoadingSpinner } from './LoadingSpinner';

interface AkilliBakimTavsiyesiProps {
  santralId?: string;
  santralAdi?: string;
  onTavsiyeDetay?: () => void;
}

export const AkilliBakimTavsiyesi: React.FC<AkilliBakimTavsiyesiProps> = ({ 
  santralId, 
  santralAdi,
  onTavsiyeDetay 
}) => {
  const [yukleniyor, setYukleniyor] = useState(true);
  const [bakimDurumu, setBakimDurumu] = useState<any>({
    sonElektrikBakimTarihi: new Date(2024, 3, 5),
    sonMekanikBakimTarihi: new Date(2024, 3, 19),
    sonPanelTemizlikTarihi: new Date(2024, 2, 15),
    sonInvertorKontrolTarihi: new Date(2024, 3, 25),
    elektrikBakimSagligi: 85,
    mekanikBakimSagligi: 92,
    panelTemizlikSagligi: 68,
    invertorSagligi: 94,
    genelSaglik: 82,
    kritikUyarilar: [
      'Panel temizliği için 5 gün kaldı',
      'İnvertör 3\'te verim düşüklüğü tespit edildi',
      'A5 panel grubunda sıcak nokta tespit edildi'
    ],
    tavsiyeler: [
      'Panel temizliği planlanmalı',
      'İnvertör 3 detaylı incelenmeli',
      'A5 panel grubu termal kamera ile kontrol edilmeli',
      'Kablo bağlantıları kontrol edilmeli'
    ]
  });

  useEffect(() => {
    const bakimTavsiyesiGetir = async () => {
      if (!santralId) {
        setYukleniyor(false);
        return;
      }

      try {
        setYukleniyor(true);
        const tavsiye = await olusturBakimTavsiyesi(santralId);
        setBakimDurumu(tavsiye);
      } catch (error) {
        console.error('Bakım tavsiyesi getirme hatası:', error);
        // Hata durumunda varsayılan değerler kullanılır
      } finally {
        setYukleniyor(false);
      }
    };

    bakimTavsiyesiGetir();
  }, [santralId]);

  if (yukleniyor) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Bugünün tarihi
  const bugun = new Date();
  
  // Son bakımdan bu yana geçen gün sayısı
  const elektrikBakimGunFarki = Math.floor((bugun.getTime() - bakimDurumu.sonElektrikBakimTarihi.getTime()) / (1000 * 60 * 60 * 24));
  const mekanikBakimGunFarki = Math.floor((bugun.getTime() - bakimDurumu.sonMekanikBakimTarihi.getTime()) / (1000 * 60 * 60 * 24));
  const panelTemizlikGunFarki = Math.floor((bugun.getTime() - bakimDurumu.sonPanelTemizlikTarihi.getTime()) / (1000 * 60 * 60 * 24));
  const invertorKontrolGunFarki = Math.floor((bugun.getTime() - bakimDurumu.sonInvertorKontrolTarihi.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Card className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="p-2 bg-yellow-100 rounded-full mr-3">
            <Wrench className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <Title>Akıllı Bakım Tavsiyesi</Title>
            <Text>Yapay zeka destekli bakım önerileri</Text>
          </div>
        </div>
        {santralAdi && (
          <div className="bg-blue-100 px-3 py-1 rounded-full text-sm text-blue-800 flex items-center">
            <Sun className="h-4 w-4 mr-1" />
            {santralAdi}
          </div>
        )}
      </div>

      {/* Genel Sağlık Durumu */}
      <div className="mb-6">
        <Flex>
          <div>
            <Text>Genel Sistem Sağlığı</Text>
            <Metric>{bakimDurumu.genelSaglik}%</Metric>
          </div>
          <BadgeDelta deltaType={bakimDurumu.genelSaglik > 80 ? "increase" : "decrease"}>
            {bakimDurumu.genelSaglik > 90 ? 'Mükemmel' : 
             bakimDurumu.genelSaglik > 80 ? 'İyi' : 
             bakimDurumu.genelSaglik > 70 ? 'Orta' : 'Dikkat'}
          </BadgeDelta>
        </Flex>
        <ProgressBar 
          value={bakimDurumu.genelSaglik} 
          color={bakimDurumu.genelSaglik > 90 ? "emerald" : 
                bakimDurumu.genelSaglik > 80 ? "blue" : 
                bakimDurumu.genelSaglik > 70 ? "amber" : "rose"} 
          className="mt-2" 
        />
      </div>

      {/* Bakım Durumları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Zap className="h-4 w-4 mr-1 text-blue-600" />
              <Text className="font-medium">Elektrik Bakımı</Text>
            </div>
            <Badge color={elektrikBakimGunFarki > 45 ? "red" : "blue"}>
              {elektrikBakimGunFarki} gün önce
            </Badge>
          </div>
          <ProgressBar value={bakimDurumu.elektrikBakimSagligi} color="blue" className="mt-1" />
        </div>

        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Wrench className="h-4 w-4 mr-1 text-emerald-600" />
              <Text className="font-medium">Mekanik Bakım</Text>
            </div>
            <Badge color={mekanikBakimGunFarki > 45 ? "red" : "emerald"}>
              {mekanikBakimGunFarki} gün önce
            </Badge>
          </div>
          <ProgressBar value={bakimDurumu.mekanikBakimSagligi} color="emerald" className="mt-1" />
        </div>

        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Sun className="h-4 w-4 mr-1 text-amber-600" />
              <Text className="font-medium">Panel Temizliği</Text>
            </div>
            <Badge color={panelTemizlikGunFarki > 60 ? "red" : "amber"}>
              {panelTemizlikGunFarki} gün önce
            </Badge>
          </div>
          <ProgressBar value={bakimDurumu.panelTemizlikSagligi} color="amber" className="mt-1" />
        </div>

        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Battery className="h-4 w-4 mr-1 text-indigo-600" />
              <Text className="font-medium">İnvertör Kontrolü</Text>
            </div>
            <Badge color={invertorKontrolGunFarki > 30 ? "red" : "indigo"}>
              {invertorKontrolGunFarki} gün önce
            </Badge>
          </div>
          <ProgressBar value={bakimDurumu.invertorSagligi} color="indigo" className="mt-1" />
        </div>
      </div>

      {/* Kritik Uyarılar */}
      <div className="mb-6">
        <div className="flex items-center mb-2">
          <AlertTriangle className="h-4 w-4 mr-1 text-red-600" />
          <Text className="font-medium">Kritik Uyarılar</Text>
        </div>
        <div className="bg-red-50 p-3 rounded-lg">
          <ul className="space-y-2">
            {bakimDurumu.kritikUyarilar.map((uyari, index) => (
              <li key={index} className="flex items-start">
                <AlertTriangle className="h-4 w-4 mr-2 text-red-600 mt-0.5 flex-shrink-0" />
                <Text className="text-red-800">{uyari}</Text>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Tavsiyeler */}
      <div className="mb-6">
        <div className="flex items-center mb-2">
          <CheckCircle className="h-4 w-4 mr-1 text-emerald-600" />
          <Text className="font-medium">Bakım Tavsiyeleri</Text>
        </div>
        <div className="bg-emerald-50 p-3 rounded-lg">
          <ul className="space-y-2">
            {bakimDurumu.tavsiyeler.map((tavsiye, index) => (
              <li key={index} className="flex items-start">
                <CheckCircle className="h-4 w-4 mr-2 text-emerald-600 mt-0.5 flex-shrink-0" />
                <Text className="text-emerald-800">{tavsiye}</Text>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sonraki Bakım Planı */}
      <div className="bg-blue-50 p-4 rounded-lg mb-4">
        <div className="flex items-center mb-2">
          <Calendar className="h-5 w-5 mr-2 text-blue-600" />
          <Text className="font-medium text-blue-800">Sonraki Planlı Bakım</Text>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-1 text-blue-600" />
            <Text className="text-blue-800">12 Mayıs 2024</Text>
          </div>
          <Text className="text-blue-800">5 gün kaldı</Text>
        </div>
      </div>

      <Button 
        onClick={onTavsiyeDetay} 
        color="amber" 
        className="w-full"
      >
        <div className="flex items-center justify-center">
          <span>Detaylı Bakım Raporu Oluştur</span>
          <ArrowRight className="h-4 w-4 ml-2" />
        </div>
      </Button>
    </Card>
  );
};