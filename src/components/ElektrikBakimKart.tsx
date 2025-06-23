import React from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Building,
  Calendar,
  User,
  ImageIcon as DefaultImageIcon,
  CheckCircle,
  AlertTriangle,
  Zap,
  Eye,
  Edit3,
  Trash2,
  ImageOff
} from 'lucide-react';
import type { ElektrikBakim as ElektrikBakimType } from '../types';

interface Props {
  bakim: ElektrikBakimType;
  sahaAdi: string;
  onViewDetailsClick: () => void;
  onEditClick: () => void;
  onDeleteClick: () => void;
  canEdit: boolean;
  canDelete: boolean;
}

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
};

export const ElektrikBakimKart: React.FC<Props> = ({ 
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
    target.style.display = 'none';
    const parent = target.parentElement;
    if (parent && !parent.querySelector('.placeholder-icon')) {
      const iconContainer = document.createElement('div');
      iconContainer.className = 'w-full h-full flex items-center justify-center bg-slate-100 placeholder-icon';
      iconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${colors.textSecondary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>`;
      parent.appendChild(iconContainer);
    }
  };

  const sorunVar = Object.entries(bakim.durumlar).some(([key, value]) => {
    if (key.endsWith('Aciklamalar')) return false;
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(durum => durum === false);
    }
    return false;
  });

  return (
    <div 
      className="rounded-lg shadow-lg overflow-hidden flex flex-col transition-all duration-300 ease-in-out hover:shadow-xl border"
      style={{ backgroundColor: colors.cardBg, borderColor: colors.border }}
    >
      <div className="aspect-[16/9] relative bg-slate-100">
        {bakim.fotograflar && bakim.fotograflar.length > 0 && bakim.fotograflar[0] ? (
          <img
            src={bakim.fotograflar[0]}
            alt={`${sahaAdi} Elektrik Bakım Fotoğrafı`}
            className="w-full h-full object-cover"
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff size={28} style={{ color: colors.textSecondary }} />
          </div>
        )}
        {bakim.fotograflar && bakim.fotograflar.length > 1 && (
          <div 
            className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-xs font-medium shadow"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white' }}
          >
            +{bakim.fotograflar.length - 1}
          </div>
        )}
        <div 
          className={`absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-xs font-medium flex items-center shadow`}
          style={{
            backgroundColor: sorunVar ? colors.textDanger : colors.textSuccess,
            color: 'white'
          }}
        >
          {sorunVar ? (
            <AlertTriangle size={12} className="mr-1" />
          ) : (
            <CheckCircle size={12} className="mr-1" />
          )}
          {sorunVar ? 'Sorun' : 'Tamam'}
        </div>
      </div>

      <div className="p-3 flex-grow flex flex-col justify-between">
        <div>
          <p className="text-xs font-medium mb-0.5" style={{ color: colors.lightBlue }}>
            {sahaAdi}
          </p>
          <h3 
            className="text-sm font-semibold cursor-pointer hover:underline mb-1 line-clamp-1"
            style={{ color: colors.textPrimary }}
            onClick={onViewDetailsClick}
            title={format(bakim.tarih.toDate(), 'dd MMMM yyyy, HH:mm', { locale: tr }) + ' bakım kaydı detayları'}
          >
             {format(bakim.tarih.toDate(), 'dd MMM yyyy', { locale: tr })} Bakımı
          </h3>
          
          <div className="flex items-center text-xs mb-1.5" style={{ color: colors.textSecondary }}>
            <Calendar size={12} className="mr-1 flex-shrink-0" />
            <span>{format(bakim.tarih.toDate(), 'dd MMM, HH:mm', { locale: tr })}</span>
          </div>

          <div className="flex items-center text-xs" style={{ color: colors.textSecondary }}>
            <User size={12} className="mr-1 flex-shrink-0" />
            <span className="truncate">{bakim.kontrolEden.ad}</span>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t flex items-center justify-end space-x-1" style={{ borderColor: colors.border }}>
          <button
            onClick={onViewDetailsClick}
            className="p-1 rounded-md hover:bg-slate-100 transition-colors"
            title="Detayları Gör"
            style={{ color: colors.textSecondary }}
          >
            <Eye size={14} />
          </button>
          {canEdit && (
            <button
              onClick={onEditClick}
              className="p-1 rounded-md hover:bg-slate-100 transition-colors"
              title="Düzenle"
              style={{ color: colors.textSecondary }}
            >
              <Edit3 size={14} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={onDeleteClick}
              className="p-1 rounded-md hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Sil"
              style={{ color: colors.textSecondary }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};