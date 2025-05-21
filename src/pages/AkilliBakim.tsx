import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Bot, 
  Zap, 
  Battery, 
  AlertTriangle, 
  Sun, 
  ArrowLeft,
  Lightbulb,
  BrainCircuit,
  BarChart2,
  Gauge
} from 'lucide-react';
import { Card, Tab, TabGroup, TabList, TabPanel, TabPanels, Title, Text } from '@tremor/react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AkilliBakimAsistani } from '../components/AkilliBakimAsistani';
import { AkilliBakimTavsiyesi } from '../components/AkilliBakimTavsiyesi';
import { UretimAnomaliTespiti } from '../components/UretimAnomaliTespiti';
import { PanelOmurTahmini } from '../components/PanelOmurTahmini';
import toast from 'react-hot-toast';

export const AkilliBakim: React.FC = () => {
  const { santralId } = useParams<{ santralId: string }>();
  const { kullanici } = useAuth();
  const navigate = useNavigate();
  const [yukleniyor, setYukleniyor] = useState(true);
  const [santralAdi, setSantralAdi] = useState<string>('');
  const [kurulumTarihi, setKurulumTarihi] = useState<Date | undefined>(undefined);
  const [activeTab, setActiveTab] = useState(0);

  // Normalde useEffect içinde santral bilgilerini getireceğiz
  React.useEffect(() => {
    const santralBilgisiGetir = async () => {
      if (!santralId) {
        setYukleniyor(false);
        return;
      }

      try {
        const santralQuery = query(
          collection(db, 'santraller'),
          where('__name__', '==', santralId)
        );
        
        const snapshot = await getDocs(santralQuery);
        
        if (!snapshot.empty) {
          const santralData = snapshot.docs[0].data();
          setSantralAdi(santralData.ad);
          
          if (santralData.kurulumTarihi) {
            setKurulumTarihi(santralData.kurulumTarihi.toDate());
          }
        } else {
          toast.error('Santral bilgisi bulunamadı');
        }
      } catch (error) {
        console.error('Santral bilgisi getirme hatası:', error);
        toast.error('Santral bilgisi yüklenirken bir hata oluştu');
      } finally {
        setYukleniyor(false);
      }
    };

    santralBilgisiGetir();
    
    // Demo amaçlı - gerçek uygulamada kaldırılacak
    setTimeout(() => {
      if (!santralId) {
        setSantralAdi('Demo Santral');
        setKurulumTarihi(new Date(2020, 5, 15));
      }
      setYukleniyor(false);
    }, 1000);
  }, [santralId]);

  if (yukleniyor) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="mr-3 p-2 rounded-full hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5 text-gray-500" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <BrainCircuit className="h-6 w-6 mr-2 text-primary-500" />
                Akıllı Bakım ve Analiz
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {santralAdi ? `${santralAdi} için yapay zeka destekli bakım ve analiz` : 'Yapay zeka destekli bakım ve analiz sistemi'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bilgi Kartı */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-none">
        <div className="flex flex-col md:flex-row items-center md:justify-between">
          <div className="flex items-center mb-4 md:mb-0">
            <div className="p-3 bg-blue-100 rounded-full mr-4">
              <Lightbulb className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <Title className="text-blue-900">Akıllı Bakım Sistemi</Title>
              <Text className="text-blue-700">
                Yapay zeka destekli bakım ve analiz sistemi, santralınızın performansını optimize etmenize yardımcı olur.
              </Text>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm flex items-center">
              <Gauge className="h-5 w-5 text-green-500 mr-2" />
              <div>
                <p className="text-xs text-gray-500">Sistem Sağlığı</p>
                <p className="text-sm font-semibold">%92.4</p>
              </div>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm flex items-center">
              <BarChart2 className="h-5 w-5 text-blue-500 mr-2" />
              <div>
                <p className="text-xs text-gray-500">Performans</p>
                <p className="text-sm font-semibold">%96.8</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Sekme Grupları */}
      <TabGroup>
        <TabList className="mb-6">
          <Tab icon={Bot}>Akıllı Asistan</Tab>
          <Tab icon={Zap}>Bakım Tavsiyeleri</Tab>
          <Tab icon={AlertTriangle}>Anomali Tespiti</Tab>
          <Tab icon={Battery}>Panel Ömür Analizi</Tab>
        </TabList>
        
        <TabPanels>
          <TabPanel>
            <AkilliBakimAsistani santralId={santralId} santralAdi={santralAdi} />
          </TabPanel>
          
          <TabPanel>
            <AkilliBakimTavsiyesi 
              santralId={santralId} 
              santralAdi={santralAdi} 
              onTavsiyeDetay={() => setActiveTab(0)} // Asistana yönlendir
            />
          </TabPanel>
          
          <TabPanel>
            <UretimAnomaliTespiti 
              santralId={santralId} 
              santralAdi={santralAdi} 
              onDetayGoruntule={() => setActiveTab(0)} // Asistana yönlendir
            />
          </TabPanel>
          
          <TabPanel>
            <PanelOmurTahmini 
              santralId={santralId} 
              santralAdi={santralAdi} 
              kurulumTarihi={kurulumTarihi}
              onDetayGoruntule={() => setActiveTab(0)} // Asistana yönlendir
            />
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
};