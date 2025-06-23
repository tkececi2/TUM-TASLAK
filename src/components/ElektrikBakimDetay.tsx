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
  ImageOff,
  ZoomIn
} from 'lucide-react';
import type { ElektrikBakim as ElektrikBakimType } from '../types';

interface Props {
  bakim: ElektrikBakimType;
  sahaAdi: string;
  onClose: () => void;
}

const KONTROL_GRUPLARI_ELEKTRIK = {
  ogSistemleri: {
    baslik: '1. OG Sistemleri',
    kontroller: {
      betonKosk: { label: 'Beton köşklerde kir, nem kontrolü', key: 'betonKosk' },
      ogHucreleri: { label: 'OG hücrelerinde paslanma ve boya kusurları', key: 'ogHucreleri' },
      ayiricilar: { label: 'Ayırıcıların, kesicilerin ve rölelerin işlevselliği', key: 'ayiricilar' }
    }
  },
  trafolar: {
    baslik: '2. Trafolar',
    kontroller: {
      trafoTemizligi: { label: 'Trafo temizliği (kir, toz, yağ sızıntısı)', key: 'trafoTemizligi' },
      buchholzSinyalleri: { label: 'Buchholz sinyalleri ve buşing termal kontrolü', key: 'buchholzSinyalleri' }
    }
  },
  agDagitimPanosu: {
    baslik: '3. AG Dağıtım Panosu',
    kontroller: {
      kirNemKontrol: { label: 'Kir, nem, paslanma kontrolü', key: 'kirNemKontrol' },
      devreSigortaKontrol: { label: 'Devre kesiciler ve sigortaların çalışması', key: 'devreSigortaKontrol' },
      upsSistemKontrol: { label: 'UPS sisteminin kontrolü', key: 'upsSistemKontrol' }
    }
  },
  invertorler: {
    baslik: '4. İnvertörler',
    kontroller: {
      kirPaslanmaKontrol: { label: 'Kir, toz, paslanma ve termal inceleme', key: 'kirPaslanmaKontrol' },
      kabloDurumu: { label: 'AC/DC kablolarının durumu', key: 'kabloDurumu' },
      etiketIsaretler: { label: 'Etiketler ve işaret levhalarının kontrolü', key: 'etiketIsaretler' }
    }
  },
  toplamaKutulari: {
    baslik: '5. Toplama Kutuları',
    kontroller: {
      termalPaslanmaKontrol: { label: 'Termal kontrol ve paslanma incelemesi', key: 'termalPaslanmaKontrol' },
      pvDiziBaglanti: { label: 'PV dizilerinin ve bağlantılarının çalışması', key: 'pvDiziBaglanti' }
    }
  },
  pvModulleri: {
    baslik: '6. PV Modülleri',
    kontroller: {
      modulKutuKontrol: { label: 'Modül ve bağlantı kutularının görsel denetimi', key: 'modulKutuKontrol' },
      kabloBaglanti: { label: 'Kablolar ve konektörlerin kontrolü', key: 'kabloBaglanti' }
    }
  },
  kabloTasima: {
    baslik: '7. Kablolar ve Taşıma Sistemleri',
    kontroller: {
      kabloDurumu: { label: 'OG/AG kablolarının ve işaretleyicilerinin durumu', key: 'kabloDurumu' },
      tasimaSistemleri: { label: 'Kablo kanalları, askılar ve borular', key: 'tasimaSistemleri' }
    }
  },
  aydinlatmaGuvenlik: {
    baslik: '8. Aydınlatma ve Güvenlik',
    kontroller: {
      aydinlatmaKontrol: { label: 'Aydınlatma armatürlerinin çalışması ve görsel denetimi', key: 'aydinlatmaKontrol' },
      kameraKontrol: { label: 'CCTV ve izleme sistemlerinin çalışması', key: 'kameraKontrol' },
      elektrosokKontrol: { label: 'Elektroşok sisteminin işlevselliği', key: 'elektrosokKontrol' }
    }
  },
  topraklamaSistemleri: {
    baslik: '9. Topraklama Sistemleri',
    kontroller: {
      topraklamaBaglanti: { label: 'Topraklama bağlantılarının bütünlüğü', key: 'topraklamaBaglanti' },
      topraklamaOlcum: { label: 'Nötr ve koruma topraklama ölçümleri', key: 'topraklamaOlcum' }
    }
  }
};

type KontrolKategoriKey = keyof typeof KONTROL_GRUPLARI_ELEKTRIK;

type BakimDurumKategoriKey = keyof ElektrikBakimType['durumlar'];

const colors = {
  primaryBlue: '#1E40AF',
  lightBlue: '#3B82F6',
  background: '#F8FAFC',
  cardBg: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textDanger: '#DC2626',
  textSuccess: '#16A34A',
  overlayBg: 'rgba(30, 41, 59, 0.7)', // slate-800 with opacity
};

export const ElektrikBakimDetay: React.FC<Props> = ({ bakim, sahaAdi, onClose }) => {
  const [seciliFoto, setSeciliFoto] = useState<string | null>(null);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.style.display = 'none'; 
    const parent = target.parentElement;
    if (parent && !parent.querySelector('.placeholder-icon-detail')) {
      const iconContainer = document.createElement('div');
      iconContainer.className = 'w-full h-full flex items-center justify-center bg-slate-100 placeholder-icon-detail';
      iconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${colors.textSecondary}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 21H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2z" /><line x1="2" y1="2" x2="22" y2="22" /><line x1="10" y1="9" x2="10.01" y2="9" /><path d="M17 12a3 3 0 0 0-3-3" /><path d="M14 15a3 3 0 0 0 3-3" /></svg>`;
      parent.appendChild(iconContainer);
    }
  };

  const renderKontrolGrubu = (kategoriKey: KontrolKategoriKey) => {
    const grup = KONTROL_GRUPLARI_ELEKTRIK[kategoriKey];
    
    const durumlarKategoriAnahtari = kategoriKey as BakimDurumKategoriKey;

    const durumlarData = bakim.durumlar[durumlarKategoriAnahtari] as Record<string, boolean> | undefined;
    const aciklamalarDataKey = `${kategoriKey}Aciklamalar` as BakimDurumKategoriKey;
    const aciklamalarData = bakim.durumlar[aciklamalarDataKey] as Record<string, string> | undefined;

    if (!grup) return null;

    return (
      <div key={kategoriKey} className="mb-6 pb-6 border-b last:border-b-0 last:pb-0 last:mb-0" style={{ borderColor: colors.border }}>
        <h4 className="text-lg font-semibold mb-3" style={{ color: colors.primaryBlue }}>
          {grup.baslik}
        </h4>
        <div className="space-y-3">
          {Object.entries(grup.kontroller).map(([kontrolKey, kontrolDefObj]) => {
            const label = kontrolDefObj.label;
            const durum = durumlarData?.[kontrolKey] ?? true;
            const aciklama = aciklamalarData?.[kontrolKey];

            return (
              <div key={kontrolKey} 
                   className={`p-3 rounded-md border flex flex-col sm:flex-row sm:items-start sm:justify-between ${!durum ? 'bg-red-50 border-red-200' : 'bg-white'}`}
                   style={{ borderColor: !durum ? '#FECACA' : colors.border }}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                    {label}
                  </p>
                  {aciklama && (
                    <p className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
                      {aciklama}
                    </p>
                  )}
                </div>
                <span className={`ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  durum ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {durum ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Sorun Yok
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Sorun Var
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50 backdrop-blur-sm" style={{ backgroundColor: colors.overlayBg }}>
      <div 
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl transform transition-all"
        style={{ backgroundColor: colors.cardBg }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: colors.border }}>
          <div className="flex items-center space-x-2">
            <FileText size={22} style={{ color: colors.primaryBlue }} />
            <h2 className="text-xl font-semibold" style={{ color: colors.textPrimary }}>
              Elektrik Bakım Detayları
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full transition-colors"
            style={{ 
              color: colors.textSecondary,
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = colors.textPrimary;
              e.currentTarget.style.backgroundColor = colors.background;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colors.textSecondary;
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Kapat"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Sol Kolon - Genel Bilgiler ve Fotoğraflar */}
            <div className="space-y-6">
              <div className="rounded-lg p-4 space-y-4" style={{ backgroundColor: colors.background }}>
                <div className="flex items-center text-sm" style={{ color: colors.textSecondary }}>
                  <Building className="h-5 w-5 mr-2" style={{ color: colors.textSecondary }} />
                  <span>{sahaAdi}</span>
                </div>
                <div className="flex items-center text-sm" style={{ color: colors.textSecondary }}>
                  <Calendar className="h-5 w-5 mr-2" style={{ color: colors.textSecondary }} />
                  <span>{format(bakim.tarih.toDate(), 'dd MMMM yyyy HH:mm', { locale: tr })}</span>
                </div>
                <div className="flex items-center text-sm" style={{ color: colors.textSecondary }}>
                  <User className="h-5 w-5 mr-2" style={{ color: colors.textSecondary }} />
                  <span>{bakim.kontrolEden.ad}</span>
                </div>
              </div>

              {/* Fotoğraflar */}
              <div>
                <h3 className="text-sm font-medium mb-4" style={{ color: colors.textPrimary }}>Fotoğraflar</h3>
                {bakim.fotograflar && bakim.fotograflar.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {bakim.fotograflar.map((foto, index) => (
                      <div
                        key={index}
                        className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group border"
                        style={{ backgroundColor: colors.background, borderColor: colors.border }}
                        onClick={() => setSeciliFoto(foto)}
                      >
                        <img
                          src={foto}
                          alt={`Fotoğraf ${index + 1}`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          onError={handleImageError}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 rounded-lg border" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-12 w-12" style={{ color: colors.textSecondary }} />
                      <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>Fotoğraf bulunmuyor</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Genel Notlar */}
              {bakim.genelNotlar && (
                <div>
                  <h3 className="text-sm font-medium mb-2" style={{ color: colors.textPrimary }}>Genel Notlar</h3>
                  <div className="rounded-lg p-4 border" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: colors.textPrimary }}>
                      {bakim.genelNotlar}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Sağ Kolon - Kontrol Detayları */}
            <div className="space-y-8">
              {Object.keys(KONTROL_GRUPLARI_ELEKTRIK).map((key) => 
                renderKontrolGrubu(key as KontrolKategoriKey)
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Büyük Fotoğraf Modalı */}
      {seciliFoto && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4 sm:p-8 transition-opacity duration-300 animate-fadeIn"
          onClick={() => setSeciliFoto(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setSeciliFoto(null); }}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/80 hover:text-white transition-colors z-[70] p-2 bg-black/30 rounded-full"
            aria-label="Kapat"
          >
            <X size={28} />
          </button>
          <div className="relative max-w-full max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={seciliFoto}
              alt="Seçili Bakım Fotoğrafı - Tam Ekran"
              className="block max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onError={handleImageError}
            />
          </div>
        </div>
      )}
    </div>
  );
};