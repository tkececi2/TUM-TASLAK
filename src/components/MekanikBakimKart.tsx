import React from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Building, 
  Calendar, 
  User, 
  Image as ImageIcon, 
  CheckCircle, 
  AlertTriangle,
  Eye,
  Edit2,
  Trash2,
  MoreVertical
} from 'lucide-react';
import type { MekanikBakim } from '../types';

interface Props {
  bakim: MekanikBakim;
  sahaAdi: string;
  onViewDetailsClick: () => void;
  onEditClick: () => void;
  onDeleteClick: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const MekanikBakimKart: React.FC<Props> = ({ 
  bakim, 
  sahaAdi, 
  onViewDetailsClick,
  onEditClick,
  onDeleteClick,
  canEdit,
  canDelete 
}) => {
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    // target.src = '/placeholder-image.png'; // Projenizde uygun bir placeholder yolu belirtin
    target.style.display = 'none'; // Alternatif olarak resmi gizle
    const parent = target.parentElement;
    if (parent) {
      const placeholder = document.createElement('div');
      placeholder.className = 'w-full h-full flex items-center justify-center bg-slate-100';
      const icon = document.createElement('div'); // ImageIcon'u doğrudan DOM'a ekleyemeyiz, bu kısım basitleştirildi
      icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image text-slate-400"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
      placeholder.appendChild(icon);
      parent.appendChild(placeholder);
    }
  };

  const sorunDetaylari = () => {
    const sorunlar: string[] = [];
    if (bakim.durumlar && typeof bakim.durumlar === 'object') {
      Object.keys(bakim.durumlar)
        .filter(kategoriKey => !kategoriKey.endsWith('Aciklamalar'))
        .forEach(kategoriKey => {
          const kategori = bakim.durumlar[kategoriKey as keyof MekanikBakim['durumlar']];
          if (typeof kategori === 'object' && kategori !== null) {
            Object.entries(kategori).forEach(([kontrol, durum]) => {
              if (durum === false) {
                // KONTROL_GRUPLARI'ndan label'ı almak ideal olurdu, ama bu component'te yok.
                // Şimdilik sadece anahtar adını kullanalım.
                const kategoriAdi = kategoriKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                sorunlar.push(`${kategoriAdi} - ${kontrol}`);
              }
            });
          }
        });
    }
    return sorunlar;
  };

  const sorunluAlanlarListesi = sorunDetaylari();
  const sorunVar = sorunluAlanlarListesi.length > 0;

  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-[#E2E8F0] overflow-hidden flex flex-col hover:shadow-xl transition-shadow duration-300">
      {/* Image Section */}
      <div className="aspect-[16/10] relative bg-slate-100">
        {bakim.fotograflar?.[0] ? (
          <img
            src={bakim.fotograflar[0]}
            alt={`${sahaAdi} - Bakım Fotoğrafı`}
            className="w-full h-full object-cover"
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={48} className="text-slate-400" />
          </div>
        )}
        {bakim.fotograflar && bakim.fotograflar.length > 1 && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full font-medium">
            +{bakim.fotograflar.length - 1}
          </div>
        )}
         <span 
            title={sorunVar ? "Bu bakımda sorunlu alanlar mevcut" : "Bu bakımda sorun bulunmuyor"}
            className={`absolute top-2 left-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
              sorunVar 
                ? 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-600/20' 
                : 'bg-green-100 text-green-700 ring-1 ring-inset ring-green-600/20'
            }`}
          >
            {sorunVar ? (
              <AlertTriangle size={14} className="mr-1.5" />
            ) : (
              <CheckCircle size={14} className="mr-1.5" />
            )}
            {sorunVar ? 'Sorunlu' : 'Sorunsuz'}
          </span>
      </div>

      {/* Content Section */}
      <div className="p-5 flex-grow">
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-[#1E293B] truncate" title={sahaAdi}>
            {sahaAdi}
          </h3>
        </div>

        <div className="space-y-2.5 text-sm text-[#64748B]">
          <div className="flex items-center">
            <Calendar size={15} className="mr-2 text-[#3B82F6] flex-shrink-0" />
            <span>{bakim.tarih?.toDate ? format(bakim.tarih.toDate(), 'dd MMMM yyyy, HH:mm', { locale: tr }) : 'Tarih Yok'}</span>
          </div>
          <div className="flex items-center">
            <User size={15} className="mr-2 text-[#3B82F6] flex-shrink-0" />
            <span className="truncate">{bakim.kontrolEden?.ad || 'Belirtilmemiş'}</span>
          </div>
        </div>

        {sorunVar && sorunluAlanlarListesi.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[#E2E8F0]">
            <p className="text-xs font-medium text-red-600 mb-1.5">Tespit Edilen Sorunlar ({sorunluAlanlarListesi.length}):</p>
            <ul className="text-xs text-[#64748B] space-y-1 max-h-20 overflow-y-auto custom-scrollbar pr-1">
              {sorunluAlanlarListesi.slice(0, 5).map((sorun, index) => ( // Show up to 5
                <li key={index} className="truncate" title={sorun}>• {sorun}</li>
              ))}
              {sorunluAlanlarListesi.length > 5 && (
                <li className="text-xs text-slate-500 italic">+ {sorunluAlanlarListesi.length - 5} sorun daha...</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-[#E2E8F0] bg-slate-50 flex items-center justify-between gap-2">
        <button
          onClick={onViewDetailsClick}
          title="Detayları Görüntüle"
          className="flex items-center justify-center p-2 rounded-md text-[#3B82F6] hover:bg-blue-100 hover:text-[#1E40AF] transition-colors"
        >
          <Eye size={18} />
          <span className="ml-2 text-xs font-medium sm:hidden md:inline-block">Detaylar</span>
        </button>
        
        <div className="relative">
          {(canEdit || canDelete) && (
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              onBlur={() => setTimeout(() => setIsMenuOpen(false), 150)} // allow click on menu items
              title="Diğer İşlemler"
              className="flex items-center justify-center p-2 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            >
              <MoreVertical size={18} />
            </button>
          )}

          {isMenuOpen && (canEdit || canDelete) && (
            <div className="absolute bottom-full right-0 mb-2 w-40 bg-white rounded-md shadow-lg border border-[#E2E8F0] z-10 py-1">
              {canEdit && (
                <button
                  onClick={() => { onEditClick(); setIsMenuOpen(false); }}
                  className="w-full flex items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-[#1E40AF] transition-colors"
                >
                  <Edit2 size={16} className="mr-2" />
                  Düzenle
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => { onDeleteClick(); setIsMenuOpen(false); }}
                  className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                >
                  <Trash2 size={16} className="mr-2" />
                  Sil
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Basit bir custom-scrollbar için CSS (Global CSS'e eklenebilir veya Tailwind plugini ile)
// Eğer global CSS yoksa, bu stilin bir şekilde eklenmesi gerekir.
// <style>
// .custom-scrollbar::-webkit-scrollbar {
//   width: 6px;
// }
// .custom-scrollbar::-webkit-scrollbar-track {
//   background: #f1f1f1; 
//   border-radius: 3px;
// }
// .custom-scrollbar::-webkit-scrollbar-thumb {
//   background: #ccc; 
//   border-radius: 3px;
// }
// .custom-scrollbar::-webkit-scrollbar-thumb:hover {
//   background: #aaa; 
// }
// </style>