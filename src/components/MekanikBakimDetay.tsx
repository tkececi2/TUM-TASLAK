import React, { useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  X,
  Calendar,
  Building,
  User,
  Image as ImageIcon,
  CheckCircle,
  AlertTriangle,
  FileText,
  ZoomIn
} from 'lucide-react';
import type { MekanikBakim } from '../types';

interface Props {
  bakim: MekanikBakim;
  sahaAdi: string;
  onClose: () => void;
}

export const MekanikBakimDetay: React.FC<Props> = ({ bakim, sahaAdi, onClose }) => {
  const [seciliFoto, setSeciliFoto] = useState<string | null>(null);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.style.display = 'none'; // Hide broken image
    const parent = target.parentElement;
    if (parent) {
      // Create a placeholder if image fails to load
      const placeholder = document.createElement('div');
      placeholder.className = 'w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 text-xs';
      placeholder.textContent = 'Görsel Yüklenemedi';
      parent.appendChild(placeholder);
    }
  };
  
  // KONTROL_GRUPLARI'ndan alınan etiketlerle uyumlu hale getirilmiş ve eksikleri tamamlanmış etiketler.
  const kontrolEtiketleri: Record<string, string> = {
    // Çevresel Durum
    karTozKum: 'Kar, toz, kum birikimi',
    kusKirliligi: 'Kuş popülasyonuna bağlı kirlilik',
    bitkiHayvan: 'Bitki örtüsü ve yabani hayvan etkileri',
    // Arazi ve Toprak Koşulları
    toprakErozyonu: 'Toprak erozyonu',
    suBirikintileri: 'Su birikintileri ve çatlaklar',
    cokmeVeCukurlar: 'Çökme, çukurlar, oyuklar',
    // Taşıyıcı Yapılar
    yapiButunlugu: 'Modül taşıyıcı yapı bütünlüğü',
    paslanmaKorozyon: 'Paslanma ve korozyon', // Bu anahtar birden fazla grupta olabilir, etiket genel.
    gevsekBaglantilar: 'Gevşek bağlantılar', // Bu anahtar birden fazla grupta olabilir
    // Kazıklar ve Kirişler
    boyutlar: 'Kazık ve kiriş türleri/boyutları',
    gevsekCivatalar: 'Gevşek civatalar', // Formdan eklendi
    // PV Modülleri
    kirilmaVeCatlaklar: 'Kırılma, çatlama ve renk bozulmaları',
    tozKirBirikimi: 'Toz/kir birikimi ve sıcak noktalar',
    gevsekKlempler: 'Gevşek klempler',
    // Elektrik Sistemleri
    montajYapilari: 'İnvertör ve DC/AC kutu montaj yapıları',
  };

  const renderKontrolGrubu = (baslik: string, durumlarKat: Record<string, boolean> | undefined, aciklamalarKat?: Record<string, string> | undefined) => {
    if (!durumlarKat || Object.keys(durumlarKat).length === 0) {
      return (
        <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-[#E2E8F0]">
          <h3 className="text-md font-semibold text-[#1E293B] mb-2 py-2 border-b border-[#E2E8F0]">{baslik}</h3>
          <p className="text-sm text-[#64748B]">Bu kategori için veri bulunmamaktadır.</p>
        </div>
      );
    }

    return (
      <div className="mb-6 p-5 bg-white rounded-xl shadow-lg border border-[#E2E8F0]">
        <h3 className="text-lg font-semibold text-[#1E293B] mb-4 pb-3 border-b border-[#E2E8F0]">{baslik}</h3>
        <div className="space-y-4">
          {Object.entries(durumlarKat).map(([key, durumValue]) => (
            <div key={key} className="p-3 bg-slate-50 rounded-md border border-[#E2E8F0]">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-[#1E293B] flex-1 mr-2">
                  {kontrolEtiketleri[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </p>
                <span 
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${ 
                    durumValue 
                      ? 'bg-green-100 text-green-700 ring-1 ring-inset ring-green-600/20' 
                      : 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-600/20'
                  }`}
                >
                  {durumValue ? 
                    <CheckCircle size={14} className="mr-1.5" /> : 
                    <AlertTriangle size={14} className="mr-1.5" />
                  }
                  {durumValue ? 'Uygun' : 'Sorunlu'}
                </span>
              </div>
              {aciklamalarKat?.[key] && (
                <p className="mt-2 text-sm text-[#64748B] bg-white p-2 rounded border border-slate-200">{aciklamalarKat[key]}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  const kontrolKategorileri = [
    { id: 'cevreselDurum', baslik: '1. Çevresel Durum' },
    { id: 'araziDurumu', baslik: '2. Arazi ve Toprak Koşulları' },
    { id: 'tasiyiciYapilar', baslik: '3. Taşıyıcı Yapılar' },
    { id: 'kazikVeKirisler', baslik: '4. Kazıklar ve Kirişler' },
    { id: 'pvModulleri', baslik: '5. PV Modülleri' },
    { id: 'elektrikSistemleri', baslik: '6. Elektrik Sistemleri' },
  ];

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-2 sm:p-4 z-[70] backdrop-blur-sm animate-fade-in">
      <div className="bg-[#F8FAFC] rounded-xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl border border-slate-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] flex-shrink-0 bg-white rounded-t-xl">
          <div className="flex items-center space-x-3">
            <FileText className="h-6 w-6 text-[#1E40AF]" />
            <h2 className="text-xl font-semibold text-[#1E293B]">
              Mekanik Bakım Detayları
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
            title="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400 scrollbar-track-transparent">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sol Kolon - Genel Bilgiler ve Fotoğraflar */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white rounded-xl p-5 shadow-lg border border-[#E2E8F0]">
                <h3 className="text-lg font-semibold text-[#1E293B] mb-4 pb-2 border-b border-[#E2E8F0]">Genel Bilgiler</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start">
                    <Building size={16} className="mr-3 mt-0.5 text-[#3B82F6] flex-shrink-0" />
                    <div>
                        <p className="text-xs text-[#64748B]">Saha Adı</p>
                        <p className="font-medium text-[#1E293B]">{sahaAdi}</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Calendar size={16} className="mr-3 mt-0.5 text-[#3B82F6] flex-shrink-0" />
                    <div>
                        <p className="text-xs text-[#64748B]">Bakım Tarihi</p>
                        <p className="font-medium text-[#1E293B]">{bakim.tarih?.toDate ? format(bakim.tarih.toDate(), 'dd MMMM yyyy, HH:mm', { locale: tr }) : 'Belirtilmemiş'}</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <User size={16} className="mr-3 mt-0.5 text-[#3B82F6] flex-shrink-0" />
                    <div>
                        <p className="text-xs text-[#64748B]">Kontrol Eden</p>
                        <p className="font-medium text-[#1E293B]">{bakim.kontrolEden?.ad || 'Belirtilmemiş'}</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                     <FileText size={16} className="mr-3 mt-0.5 text-[#3B82F6] flex-shrink-0" />
                    <div>
                        <p className="text-xs text-[#64748B]">Oluşturma Tarihi</p>
                        <p className="font-medium text-[#1E293B]">{bakim.olusturmaTarihi?.toDate ? format(bakim.olusturmaTarihi.toDate(), 'dd MMM yyyy, HH:mm', { locale: tr }) : '-'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fotoğraflar */}
              {bakim.fotograflar && bakim.fotograflar.length > 0 && (
                <div className="bg-white rounded-xl p-5 shadow-lg border border-[#E2E8F0]">
                    <h3 className="text-lg font-semibold text-[#1E293B] mb-4 pb-2 border-b border-[#E2E8F0]">Fotoğraflar ({bakim.fotograflar.length})</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {bakim.fotograflar.map((foto, index) => (
                        <div
                            key={index}
                            className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden cursor-pointer group border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                            onClick={() => setSeciliFoto(foto)}
                        >
                            <img
                            src={foto}
                            alt={`Bakım Fotoğrafı ${index + 1}`}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={handleImageError}
                            loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center transition-opacity duration-300">
                                <ZoomIn size={32} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                        ))}
                    </div>
                </div>
              )}

              {/* Genel Notlar */}
              {bakim.genelNotlar && bakim.genelNotlar.trim() !== '' && (
                 <div className="bg-white rounded-xl p-5 shadow-lg border border-[#E2E8F0]">
                    <h3 className="text-lg font-semibold text-[#1E293B] mb-3 pb-2 border-b border-[#E2E8F0]">Genel Notlar</h3>
                    <div className="text-sm text-[#1E293B] whitespace-pre-wrap bg-slate-50 p-3 rounded-md border border-slate-200">
                        {bakim.genelNotlar}
                    </div>
                </div>
              )}
            </div>

            {/* Sağ Kolon - Kontrol Detayları */}
            <div className="lg:col-span-2 space-y-0">
              {kontrolKategorileri.map(kategori => 
                renderKontrolGrubu(
                    kategori.baslik,
                    bakim.durumlar[kategori.id as keyof typeof bakim.durumlar] as Record<string, boolean> | undefined,
                    bakim.durumlar[`${kategori.id}Aciklamalar` as keyof typeof bakim.durumlar] as Record<string, string> | undefined
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Büyük Fotoğraf Modalı */}
      {seciliFoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-[80] p-4 animate-fade-in"
          onClick={() => setSeciliFoto(null)}
        >
          <div className="relative">
            <button
                onClick={() => setSeciliFoto(null)}
                className="absolute -top-4 -right-4 sm:top-2 sm:right-2 text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-full shadow-lg transition-colors"
                title="Kapat"
            >
                <X className="h-5 w-5" />
            </button>
            <img
                src={seciliFoto}
                alt="Büyük fotoğraf görünümü"
                className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl border-2 border-slate-400"
                onClick={(e) => e.stopPropagation()} // Click on image should not close modal
                onError={handleImageError} // Re-use error handler
            />
          </div>
        </div>
      )}
    </div>
  );
};