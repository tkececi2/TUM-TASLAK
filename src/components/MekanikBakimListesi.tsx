import React from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { 
  Building, 
  Calendar, 
  User, 
  CheckCircle, 
  AlertTriangle, 
  Image as ImageIcon,
  Eye,
  Edit2,
  Trash2
} from 'lucide-react';
import type { MekanikBakim, Saha } from '../types';

interface Props {
  bakimlar: MekanikBakim[];
  sahalar: Pick<Saha, 'id' | 'ad'>[];
  onViewDetailsClick: (bakim: MekanikBakim) => void;
  onEditClick: (bakim: MekanikBakim) => void;
  onDeleteClick: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const MekanikBakimListesi: React.FC<Props> = ({ 
  bakimlar, 
  sahalar,
  onViewDetailsClick,
  onEditClick,
  onDeleteClick,
  canEdit,
  canDelete
}) => {
  const getSahaAdi = (sahaId: string): string => {
    return sahalar.find(s => s.id === sahaId)?.ad || 'Bilinmeyen Saha';
  };

  const getSorunDurumu = (bakim: MekanikBakim): { sorunVar: boolean; metin: string; sayi: number } => {
    let sorunluAlanSayisi = 0;
    if (bakim.durumlar && typeof bakim.durumlar === 'object') {
      Object.keys(bakim.durumlar)
        .filter(kategoriKey => !kategoriKey.endsWith('Aciklamalar'))
        .forEach(kategoriKey => {
          const kategori = bakim.durumlar[kategoriKey as keyof MekanikBakim['durumlar']];
          if (typeof kategori === 'object' && kategori !== null) {
            Object.values(kategori).forEach(durum => {
              if (durum === false) {
                sorunluAlanSayisi++;
              }
            });
          }
        });
    }
    if (sorunluAlanSayisi > 0) {
      return { sorunVar: true, metin: `${sorunluAlanSayisi} Sorun`, sayi: sorunluAlanSayisi };
    }
    return { sorunVar: false, metin: 'Sorun Yok', sayi: 0 };
  };

  return (
    <div className="bg-white shadow-md rounded-xl border border-[#E2E8F0] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#E2E8F0]">
          <thead className="bg-[#F8FAFC]">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Saha
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Tarih
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Kontrol Eden
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Durum
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                Fotoğraflar
              </th>
              <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#E2E8F0]">
            {bakimlar.map((bakim) => {
              const durumBilgisi = getSorunDurumu(bakim);
              return (
                <tr key={bakim.id} className="hover:bg-[#F8FAFC] transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building size={16} className="mr-2 text-[#3B82F6] flex-shrink-0" />
                      <span className="text-sm font-medium text-[#1E293B] truncate" title={getSahaAdi(bakim.sahaId)}>
                        {getSahaAdi(bakim.sahaId)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-[#64748B]">
                      <Calendar size={15} className="mr-1.5 flex-shrink-0" />
                      {bakim.tarih?.toDate ? format(bakim.tarih.toDate(), 'dd MMM yyyy, HH:mm', { locale: tr }) : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-[#64748B]">
                      <User size={15} className="mr-1.5 flex-shrink-0" />
                      <span className="truncate">{bakim.kontrolEden?.ad || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span 
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${ 
                        durumBilgisi.sorunVar 
                          ? 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-600/20' 
                          : 'bg-green-100 text-green-700 ring-1 ring-inset ring-green-600/20'
                      }`}
                    >
                      {durumBilgisi.sorunVar ? 
                        <AlertTriangle size={13} className="mr-1" /> : 
                        <CheckCircle size={13} className="mr-1" />
                      }
                      {durumBilgisi.metin}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-[#64748B]">
                    <div className="flex items-center justify-center">
                      <ImageIcon size={16} className="mr-1 text-[#3B82F6]" />
                      {bakim.fotograflar?.length || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => onViewDetailsClick(bakim)}
                        title="Detayları Görüntüle"
                        className="p-1.5 text-[#3B82F6] hover:text-[#1E40AF] hover:bg-blue-100 rounded-md transition-colors"
                      >
                        <Eye size={18} />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => onEditClick(bakim)}
                          title="Düzenle"
                          className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-100 rounded-md transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => onDeleteClick(bakim.id)}
                          title="Sil"
                          className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-md transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {bakimlar.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <ImageIcon size={48} className="text-slate-300 mb-4" />
                    <p className="text-lg font-semibold text-[#1E293B]">Kayıt Bulunamadı</p>
                    <p className="text-sm text-[#64748B]">Filtre kriterlerinize uygun mekanik bakım kaydı bulunmamaktadır.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};