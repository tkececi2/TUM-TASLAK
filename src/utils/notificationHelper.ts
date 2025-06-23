import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface BildirimData {
  baslik: string;
  mesaj: string;
  tip: 'ariza' | 'yorum' | 'durum' | 'sistem';
  link?: string;
  kullaniciId: string;
  companyId: string;
}

// Bildirim oluşturma fonksiyonu
export const createNotification = async (data: BildirimData) => {
  try {
    const bildirimRef = await addDoc(collection(db, 'bildirimler'), {
      ...data,
      tarih: Timestamp.now(),
      okundu: false
    });
    
    console.log('✅ Bildirim oluşturuldu:', bildirimRef.id);
    return bildirimRef.id;
  } catch (error) {
    console.error('❌ Bildirim oluşturma hatası:', error);
    throw error;
  }
};

// Toplu bildirim gönderme (bir şirketteki tüm yöneticilere)
export const createCompanyNotification = async (
  companyId: string,
  userIds: string[],
  bildirimData: Omit<BildirimData, 'kullaniciId' | 'companyId'>
) => {
  try {
    const promises = userIds.map(userId => 
      createNotification({
        ...bildirimData,
        kullaniciId: userId,
        companyId
      })
    );
    
    const results = await Promise.all(promises);
    console.log(`✅ ${results.length} bildirim gönderildi`);
    return results;
  } catch (error) {
    console.error('❌ Toplu bildirim hatası:', error);
    throw error;
  }
};

// Arıza bildirimi oluşturma
export const createArizaBildirimi = async (
  arizaData: any,
  companyId: string,
  yoneticiIds: string[]
) => {
  const bildirimData = {
    baslik: `🚨 Yeni Arıza: ${arizaData.baslik}`,
    mesaj: `${arizaData.konum} - ${arizaData.aciklama?.substring(0, 100)}...`,
    tip: 'ariza' as const,
    link: `/arizalar/${arizaData.id}`
  };
  
  return createCompanyNotification(companyId, yoneticiIds, bildirimData);
};

// Durum güncelleme bildirimi
export const createDurumBildirimi = async (
  arizaData: any,
  eskiDurum: string,
  yeniDurum: string,
  companyId: string,
  kullaniciIds: string[]
) => {
  const bildirimData = {
    baslik: `📋 Arıza Durumu Güncellendi`,
    mesaj: `${arizaData.baslik} - ${eskiDurum} → ${yeniDurum}`,
    tip: 'durum' as const,
    link: `/arizalar/${arizaData.id}`
  };
  
  return createCompanyNotification(companyId, kullaniciIds, bildirimData);
};

// Sistem bildirimi oluşturma
export const createSistemBildirimi = async (
  baslik: string,
  mesaj: string,
  companyId: string,
  kullaniciIds: string[],
  link?: string
) => {
  const bildirimData = {
    baslik,
    mesaj,
    tip: 'sistem' as const,
    link
  };
  
  return createCompanyNotification(companyId, kullaniciIds, bildirimData);
}; 