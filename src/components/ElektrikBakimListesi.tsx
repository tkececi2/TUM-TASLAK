import React from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Building, Calendar, User, CheckCircle, AlertTriangle, Eye, Edit3, Trash2, ImageIcon } from 'lucide-react';
import type { ElektrikBakim as ElektrikBakimType } from '../types';

interface Props {
  bakimlar: ElektrikBakimType[];
  sahalar: Array<{id: string, ad: string}>;
  onViewDetailsClick: (bakim: ElektrikBakimType) => void;
  onEditClick: (bakim: ElektrikBakimType) => void;
  onDeleteClick: (id: string) => void;
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

export const ElektrikBakimListesi: React.FC<Props> = ({ 
  bakimlar, 
  sahalar,
  onViewDetailsClick,
  onEditClick,
  onDeleteClick,
  canEdit,
  canDelete
}) => {
  const getSahaAdi = (sahaId: string) => {
    return sahalar.find(s => s.id === sahaId)?.ad || 'Bilinmeyen Saha';
  };

  const calculateSorunVar = (bakim: ElektrikBakimType): boolean => {
    return Object.entries(bakim.durumlar).some(([key, value]) => {
      if (key.endsWith('Aciklamalar')) return false;
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(durum => durum === false);
      }
      return false;
    });
  };

  return (
    <div className="overflow-x-auto shadow rounded-lg border" style={{ borderColor: colors.border, backgroundColor: colors.cardBg }}>
      <table className="min-w-full divide-y" style={{ borderColor: colors.border }}>
        <thead style={{ backgroundColor: colors.background }}>
          <tr>
            <th scope="col" className="px-6 py-3.5 text-left text-xs font-semibold" style={{ color: colors.textSecondary }}>
              Saha Adı
            </th>
            <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold" style={{ color: colors.textSecondary }}>
              Bakım Tarihi
            </th>
            <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold" style={{ color: colors.textSecondary }}>
              Kontrol Eden
            </th>
            <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold" style={{ color: colors.textSecondary }}>
              Durum
            </th>
            <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold" style={{ color: colors.textSecondary }}>
              Fotoğraflar
            </th>
            <th scope="col" className="px-6 py-3.5 text-right text-xs font-semibold" style={{ color: colors.textSecondary }}>
              İşlemler
            </th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: colors.border, backgroundColor: colors.cardBg }}>
          {bakimlar.map((bakim) => {
            const sorunVar = calculateSorunVar(bakim);
            
            return (
              <tr 
                key={bakim.id}
                className="hover:bg-slate-50 transition-colors duration-150 ease-in-out"
              >
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium" style={{ color: colors.textPrimary }}>
                  <div className="flex items-center">
                    <Building size={16} className="mr-2 opacity-70" style={{ color: colors.textSecondary}} />
                    {getSahaAdi(bakim.sahaId)}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm" style={{ color: colors.textSecondary }}>
                  {format(bakim.tarih.toDate(), 'dd MMM yyyy, HH:mm', { locale: tr })}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm" style={{ color: colors.textSecondary }}>
                  {bakim.kontrolEden.ad} ({bakim.kontrolEden.rol})
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm">
                  <span 
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold`}
                    style={{
                      backgroundColor: sorunVar ? '#FEE2E2' /* red-100 */ : '#D1FAE5' /* green-100 */,
                      color: sorunVar ? colors.textDanger : colors.textSuccess
                    }}
                  >
                    {sorunVar ? 
                      <AlertTriangle size={14} className="mr-1.5" /> : 
                      <CheckCircle size={14} className="mr-1.5" />
                    }
                    {sorunVar ? 'Sorun Var' : 'Sorun Yok'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm" style={{ color: colors.textSecondary }}>
                  <div className="flex items-center">
                    <ImageIcon size={16} className="mr-1.5 opacity-70" />
                    {bakim.fotograflar?.length || 0} adet
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium space-x-2">
                  <button
                    onClick={() => onViewDetailsClick(bakim)}
                    className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                    title="Detayları Görüntüle"
                    style={{ color: colors.textSecondary }}
                  >
                    <Eye size={16} />
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => onEditClick(bakim)}
                      className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                      title="Düzenle"
                      style={{ color: colors.textSecondary }}
                    >
                      <Edit3 size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => onDeleteClick(bakim.id)}
                      className="p-1.5 rounded-md hover:bg-red-100 transition-colors"
                      title="Sil"
                      style={{ color: colors.textDanger }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {bakimlar.length === 0 && (
        <div className="text-center py-10 px-6" style={{ color: colors.textSecondary }}>
          <ImageIcon size={36} className="mx-auto mb-3 opacity-50" />
          <p className="font-medium" style={{color: colors.textPrimary}}>Veri Bulunamadı</p>
          <p className="text-xs">Filtre kriterlerinize uygun elektrik bakım kaydı bulunamadı.</p>
        </div>
      )}
    </div>
  );
};