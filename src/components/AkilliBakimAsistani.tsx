import React, { useState, useRef, useEffect } from 'react';
import { Card, Title, Text, Button, TextInput, Divider } from '@tremor/react';
import { Send, Bot, Zap, AlertTriangle, CheckCircle, Lightbulb, BarChart2, Calendar, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { getAsistanYaniti } from '../services/aiService';
import toast from 'react-hot-toast';

interface AkilliBakimAsistaniProps {
  santralId?: string;
  santralAdi?: string;
}

interface Mesaj {
  rol: 'kullanici' | 'asistan';
  icerik: string;
  zaman: Date;
}

export const AkilliBakimAsistani: React.FC<AkilliBakimAsistaniProps> = ({ santralId, santralAdi }) => {
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([
    {
      rol: 'asistan',
      icerik: 'Merhaba! Ben Akıllı Bakım Asistanınız. Size nasıl yardımcı olabilirim?',
      zaman: new Date()
    }
  ]);
  const [giris, setGiris] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [oneriler, setOneriler] = useState<string[]>([
    'Panellerin temizlik zamanı geldi mi?',
    'İnvertör performansını analiz et',
    'Bakım takvimi oluştur',
    'Üretim düşüşünün sebepleri neler olabilir?',
    'Bir sonraki bakım için öneriler'
  ]);
  const mesajlarSonuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mesajlarSonuRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mesajlar]);

  const handleMesajGonder = async () => {
    if (!giris.trim()) return;

    const yeniMesaj: Mesaj = {
      rol: 'kullanici',
      icerik: giris,
      zaman: new Date()
    };

    setMesajlar(prev => [...prev, yeniMesaj]);
    setGiris('');
    setYukleniyor(true);

    try {
      // API çağrısı yap
      const cevap = await getAsistanYaniti(
        santralId || 'demo', 
        santralAdi || 'Demo Santral', 
        giris
      );

      const asistanMesaji: Mesaj = {
        rol: 'asistan',
        icerik: cevap,
        zaman: new Date()
      };

      setMesajlar(prev => [...prev, asistanMesaji]);
    } catch (error) {
      console.error('Asistan yanıt hatası:', error);
      toast.error('Yanıt alınırken bir hata oluştu');
      
      // Hata durumunda fallback yanıt
      const fallbackMesaj: Mesaj = {
        rol: 'asistan',
        icerik: `Üzgünüm, şu anda yanıt oluşturamıyorum. Lütfen daha sonra tekrar deneyin.`,
        zaman: new Date()
      };
      
      setMesajlar(prev => [...prev, fallbackMesaj]);
    } finally {
      setYukleniyor(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleMesajGonder();
    }
  };

  const handleOneriTikla = (oneri: string) => {
    setGiris(oneri);
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="p-2 bg-primary-100 rounded-full mr-3">
            <Bot className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <Title>Akıllı Bakım Asistanı</Title>
            <Text>Yapay zeka destekli bakım ve analiz asistanı</Text>
          </div>
        </div>
        {santralAdi && (
          <div className="bg-yellow-100 px-3 py-1 rounded-full text-sm text-yellow-800 flex items-center">
            <Zap className="h-4 w-4 mr-1" />
            {santralAdi}
          </div>
        )}
      </div>

      <Divider />

      {/* Mesajlaşma Alanı */}
      <div className="h-96 overflow-y-auto mb-4 p-4 bg-gray-50 rounded-lg">
        {mesajlar.map((mesaj, index) => (
          <div
            key={index}
            className={`mb-4 flex ${mesaj.rol === 'kullanici' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                mesaj.rol === 'kullanici'
                  ? 'bg-primary-100 text-primary-900'
                  : 'bg-white border border-gray-200 text-gray-800'
              }`}
            >
              {mesaj.rol === 'asistan' && (
                <div className="flex items-center mb-1">
                  <Bot className="h-4 w-4 mr-1 text-primary-600" />
                  <span className="text-xs font-medium text-primary-600">Akıllı Asistan</span>
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap">{mesaj.icerik}</p>
              <div className="text-right mt-1">
                <span className="text-xs text-gray-500">
                  {mesaj.zaman.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}
        <div ref={mesajlarSonuRef} />
      </div>

      {/* Öneriler */}
      <div className="mb-4 flex flex-wrap gap-2">
        {oneriler.map((oneri, index) => (
          <button
            key={index}
            onClick={() => handleOneriTikla(oneri)}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-full transition-colors flex items-center"
          >
            <Lightbulb className="h-3 w-3 mr-1 text-yellow-500" />
            {oneri}
          </button>
        ))}
      </div>

      {/* Giriş Alanı */}
      <div className="flex items-end gap-2">
        <TextInput
          placeholder="Bakım asistanına bir soru sorun..."
          value={giris}
          onChange={(e) => setGiris(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button
          onClick={handleMesajGonder}
          disabled={!giris.trim() || yukleniyor}
          color="blue"
          className="flex-shrink-0"
        >
          {yukleniyor ? (
            <LoadingSpinner size="sm" />
          ) : (
            <>
              <Send className="h-4 w-4 mr-1" />
              Gönder
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};