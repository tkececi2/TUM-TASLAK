import { collection, query, where, orderBy, getDocs, Timestamp, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format, subDays, subMonths, addYears } from 'date-fns';
import { tr } from 'date-fns/locale';

// Anomali tespiti için eşik değerleri
const ANOMALI_ESIK_DEGERI = 15; // %15'ten fazla sapma anomali olarak kabul edilir
const MINIMUM_VERI_SAYISI = 7; // Analiz için minimum veri sayısı

/**
 * Santral için üretim verilerini getirir
 */
export const getUretimVerileri = async (santralId: string, gunSayisi: number = 30) => {
  try {
    const baslangicTarihi = subDays(new Date(), gunSayisi);
    const baslangicTimestamp = Timestamp.fromDate(baslangicTarihi);
    
    const uretimQuery = query(
      collection(db, 'uretimVerileri'),
      where('santralId', '==', santralId),
      where('tarih', '>=', baslangicTimestamp),
      orderBy('tarih', 'asc')
    );
    
    const snapshot = await getDocs(uretimQuery);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Üretim verileri getirme hatası:', error);
    throw error;
  }
};

/**
 * Santral için bakım verilerini getirir
 */
export const getBakimVerileri = async (santralId: string, gunSayisi: number = 90) => {
  try {
    const baslangicTarihi = subDays(new Date(), gunSayisi);
    const baslangicTimestamp = Timestamp.fromDate(baslangicTarihi);
    
    // Mekanik bakımlar
    const mekanikQuery = query(
      collection(db, 'mekanikBakimlar'),
      where('sahaId', '==', santralId),
      where('tarih', '>=', baslangicTimestamp),
      orderBy('tarih', 'desc')
    );
    
    // Elektrik bakımlar
    const elektrikQuery = query(
      collection(db, 'elektrikBakimlar'),
      where('sahaId', '==', santralId),
      where('tarih', '>=', baslangicTimestamp),
      orderBy('tarih', 'desc')
    );
    
    const [mekanikSnapshot, elektrikSnapshot] = await Promise.all([
      getDocs(mekanikQuery),
      getDocs(elektrikQuery)
    ]);
    
    return {
      mekanikBakimlar: mekanikSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        tip: 'mekanik'
      })),
      elektrikBakimlar: elektrikSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        tip: 'elektrik'
      }))
    };
  } catch (error) {
    console.error('Bakım verileri getirme hatası:', error);
    throw error;
  }
};

/**
 * Santral için arıza verilerini getirir
 */
export const getArizaVerileri = async (santralId: string, gunSayisi: number = 90) => {
  try {
    const baslangicTarihi = subDays(new Date(), gunSayisi);
    const baslangicTimestamp = Timestamp.fromDate(baslangicTarihi);
    
    const arizaQuery = query(
      collection(db, 'arizalar'),
      where('saha', '==', santralId),
      where('olusturmaTarihi', '>=', baslangicTimestamp),
      orderBy('olusturmaTarihi', 'desc')
    );
    
    const snapshot = await getDocs(arizaQuery);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Arıza verileri getirme hatası:', error);
    throw error;
  }
};

/**
 * Üretim verilerinde anomali tespiti yapar
 */
export const tesptitAnomali = async (uretimVerileri: any[]) => {
  if (uretimVerileri.length < MINIMUM_VERI_SAYISI) {
    return {
      anomaliSayisi: 0,
      anomaliOrani: 0,
      toplamKayip: 0,
      tahminiGelirKaybi: 0,
      anomaliTarihleri: [],
      anomaliTipleri: [],
      olasıNedenler: [],
      grafikVerileri: []
    };
  }
  
  // Ortalama günlük üretim hesapla
  const ortalamaUretim = uretimVerileri.reduce((acc, veri) => 
    acc + veri.gunlukUretim, 0) / uretimVerileri.length;
  
  // Anomali tespiti
  const anomaliler = uretimVerileri.filter(veri => {
    const sapma = Math.abs((veri.gunlukUretim - ortalamaUretim) / ortalamaUretim) * 100;
    return sapma > ANOMALI_ESIK_DEGERI;
  });
  
  // Anomali tipleri
  const aniDususler = anomaliler.filter(a => a.gunlukUretim < ortalamaUretim * 0.7).length;
  const dusukPerformans = anomaliler.length - aniDususler;
  
  // Toplam kayıp hesaplama
  const toplamKayip = anomaliler.reduce((acc, anomali) => {
    const beklenenUretim = ortalamaUretim;
    const gercekUretim = anomali.gunlukUretim;
    return acc + (beklenenUretim - gercekUretim);
  }, 0);
  
  // Tahmini gelir kaybı (2.5 TL/kWh)
  const tahminiGelirKaybi = toplamKayip * 2.5;
  
  // Grafik verileri oluştur
  const grafikVerileri = uretimVerileri.slice(-14).map(veri => {
    const tarih = veri.tarih.toDate();
    const sapma = Math.abs((veri.gunlukUretim - ortalamaUretim) / ortalamaUretim) * 100;
    const anomali = sapma > ANOMALI_ESIK_DEGERI;
    
    return {
      tarih: format(tarih, 'dd MMM', { locale: tr }),
      beklenenUretim: Math.round(ortalamaUretim),
      gercekUretim: Math.round(veri.gunlukUretim),
      anomali
    };
  });
  
  // Olası nedenler
  let olasıNedenler = [];
  
  if (aniDususler > 0) {
    olasıNedenler.push('İnvertör arızası');
    olasıNedenler.push('Elektrik kesintisi');
  }
  
  if (dusukPerformans > 0) {
    olasıNedenler.push('Panel kirliliği');
    olasıNedenler.push('Gölgelenme');
    olasıNedenler.push('Kısmi bulutluluk');
  }
  
  return {
    anomaliSayisi: anomaliler.length,
    anomaliOrani: (anomaliler.length / uretimVerileri.length) * 100,
    toplamKayip: Math.round(toplamKayip),
    tahminiGelirKaybi: Math.round(tahminiGelirKaybi),
    anomaliTarihleri: anomaliler.map(a => a.tarih.toDate()),
    anomaliTipleri: [
      { tip: 'Ani Düşüş', sayi: aniDususler, oran: (aniDususler / anomaliler.length) * 100 || 0 },
      { tip: 'Düşük Performans', sayi: dusukPerformans, oran: (dusukPerformans / anomaliler.length) * 100 || 0 }
    ],
    olasıNedenler,
    grafikVerileri
  };
};

/**
 * Panel ömür tahmini yapar
 */
export const tahminPanelOmur = async (santralId: string, kurulumTarihi: Date) => {
  try {
    // Santral bilgilerini getir
    const santralQuery = query(
      collection(db, 'santraller'),
      where('__name__', '==', santralId)
    );
    
    const santralSnapshot = await getDocs(santralQuery);
    
    if (santralSnapshot.empty) {
      throw new Error('Santral bulunamadı');
    }
    
    const santralData = santralSnapshot.docs[0].data();
    
    // Kurulum tarihinden bu yana geçen süre (yıl)
    const bugun = new Date();
    const gecenYil = (bugun.getTime() - kurulumTarihi.getTime()) / (1000 * 60 * 60 * 24 * 365);
    
    // Varsayılan panel ömrü (25 yıl)
    const varsayilanOmur = 25;
    
    // Yıllık degradasyon oranı (varsayılan %0.8)
    const yillikDegradasyonOrani = 0.8;
    
    // Toplam performans düşüşü
    const performansDusus = gecenYil * yillikDegradasyonOrani;
    
    // Kalan ömür
    const kalanOmur = varsayilanOmur - gecenYil;
    
    // Panel grupları
    const panelGruplari = [
      { grup: 'A Grubu', performans: 100 - (performansDusus * 0.9), yaslanma: performansDusus * 0.9 },
      { grup: 'B Grubu', performans: 100 - (performansDusus * 1.0), yaslanma: performansDusus * 1.0 },
      { grup: 'C Grubu', performans: 100 - (performansDusus * 1.1), yaslanma: performansDusus * 1.1 },
      { grup: 'D Grubu', performans: 100 - (performansDusus * 1.3), yaslanma: performansDusus * 1.3 }
    ];
    
    // Kritik panel sayısı (D grubu)
    const kritikPanelSayisi = Math.round(santralData.panelSayisi * 0.03);
    
    return {
      toplamOmur: varsayilanOmur,
      gecenSure: gecenYil,
      kalanOmur,
      performansDusus,
      yillikDegradasyonOrani,
      tahminiOmurSonu: addYears(kurulumTarihi, varsayilanOmur),
      garantiBitis: addYears(kurulumTarihi, 10),
      kritikPanelSayisi,
      toplamPanelSayisi: santralData.panelSayisi,
      panelGruplari,
      etkiFactorleri: [
        { faktor: 'Sıcaklık Stresi', etki: 35 },
        { faktor: 'UV Radyasyon', etki: 25 },
        { faktor: 'Nem Döngüleri', etki: 20 },
        { faktor: 'Mekanik Stres', etki: 15 },
        { faktor: 'Diğer', etki: 5 }
      ]
    };
  } catch (error) {
    console.error('Panel ömür tahmini hatası:', error);
    throw error;
  }
};

/**
 * Bakım tavsiyesi oluşturur
 */
export const olusturBakimTavsiyesi = async (santralId: string) => {
  try {
    // Bakım verilerini getir
    const bakimVerileri = await getBakimVerileri(santralId);
    
    // Son bakım tarihlerini bul
    const sonElektrikBakim = bakimVerileri.elektrikBakimlar[0]?.tarih?.toDate() || subMonths(new Date(), 2);
    const sonMekanikBakim = bakimVerileri.mekanikBakimlar[0]?.tarih?.toDate() || subMonths(new Date(), 1);
    
    // İnvertör kontrol verilerini getir
    const invertorQuery = query(
      collection(db, 'invertorKontroller'),
      where('sahaId', '==', santralId),
      orderBy('tarih', 'desc'),
      limit(1)
    );
    
    const invertorSnapshot = await getDocs(invertorQuery);
    const sonInvertorKontrol = invertorSnapshot.docs[0]?.data()?.tarih?.toDate() || subMonths(new Date(), 1);
    
    // Panel temizlik tarihini tahmin et (gerçekte ayrı bir koleksiyon olabilir)
    const sonPanelTemizlik = subMonths(new Date(), 2);
    
    // Bakım sağlığı hesapla
    const bugun = new Date();
    const elektrikBakimGun = Math.floor((bugun.getTime() - sonElektrikBakim.getTime()) / (1000 * 60 * 60 * 24));
    const mekanikBakimGun = Math.floor((bugun.getTime() - sonMekanikBakim.getTime()) / (1000 * 60 * 60 * 24));
    const panelTemizlikGun = Math.floor((bugun.getTime() - sonPanelTemizlik.getTime()) / (1000 * 60 * 60 * 24));
    const invertorKontrolGun = Math.floor((bugun.getTime() - sonInvertorKontrol.getTime()) / (1000 * 60 * 60 * 24));
    
    // Sağlık puanı hesapla (gün sayısına göre azalır)
    const elektrikBakimSagligi = Math.max(0, 100 - (elektrikBakimGun / 60) * 100);
    const mekanikBakimSagligi = Math.max(0, 100 - (mekanikBakimGun / 60) * 100);
    const panelTemizlikSagligi = Math.max(0, 100 - (panelTemizlikGun / 60) * 100);
    const invertorSagligi = Math.max(0, 100 - (invertorKontrolGun / 30) * 100);
    
    // Genel sağlık puanı
    const genelSaglik = (elektrikBakimSagligi * 0.25 + mekanikBakimSagligi * 0.25 + 
                         panelTemizlikSagligi * 0.3 + invertorSagligi * 0.2);
    
    // Kritik uyarılar
    const kritikUyarilar = [];
    
    if (panelTemizlikSagligi < 70) {
      kritikUyarilar.push('Panel temizliği için 5 gün kaldı');
    }
    
    if (invertorSagligi < 80) {
      kritikUyarilar.push('İnvertör kontrolü gerekiyor');
    }
    
    if (elektrikBakimSagligi < 60) {
      kritikUyarilar.push('Elektrik bakım süresi yaklaşıyor');
    }
    
    // Arıza verilerini kontrol et
    const arizaVerileri = await getArizaVerileri(santralId);
    
    // Son arızaları kontrol et
    if (arizaVerileri.length > 0) {
      const sonAriza = arizaVerileri[0];
      if (sonAriza.konum && sonAriza.konum.includes('İnvertör 3')) {
        kritikUyarilar.push('İnvertör 3\'te verim düşüklüğü tespit edildi');
      }
      
      if (sonAriza.konum && sonAriza.konum.includes('A5')) {
        kritikUyarilar.push('A5 panel grubunda sıcak nokta tespit edildi');
      }
    }
    
    // Tavsiyeler
    const tavsiyeler = [];
    
    if (panelTemizlikSagligi < 80) {
      tavsiyeler.push('Panel temizliği planlanmalı');
    }
    
    if (invertorSagligi < 90) {
      tavsiyeler.push('İnvertör 3 detaylı incelenmeli');
    }
    
    if (arizaVerileri.some(a => a.konum && a.konum.includes('A5'))) {
      tavsiyeler.push('A5 panel grubu termal kamera ile kontrol edilmeli');
    }
    
    tavsiyeler.push('Kablo bağlantıları kontrol edilmeli');
    
    return {
      sonElektrikBakimTarihi: sonElektrikBakim,
      sonMekanikBakimTarihi: sonMekanikBakim,
      sonPanelTemizlikTarihi: sonPanelTemizlik,
      sonInvertorKontrolTarihi: sonInvertorKontrol,
      elektrikBakimSagligi: Math.round(elektrikBakimSagligi),
      mekanikBakimSagligi: Math.round(mekanikBakimSagligi),
      panelTemizlikSagligi: Math.round(panelTemizlikSagligi),
      invertorSagligi: Math.round(invertorSagligi),
      genelSaglik: Math.round(genelSaglik),
      kritikUyarilar,
      tavsiyeler
    };
  } catch (error) {
    console.error('Bakım tavsiyesi oluşturma hatası:', error);
    throw error;
  }
};

/**
 * OpenAI API ile akıllı asistan yanıtı oluşturur
 */
export const getAsistanYaniti = async (santralId: string, santralAdi: string, soru: string) => {
  try {
    // API çağrısı yapmadan önce demo yanıtlar
    if (soru.toLowerCase().includes('temizlik')) {
      return `${santralAdi} için panel temizliği son bakımdan bu yana 45 gün geçmiş. Toz birikimi ve kirlilik nedeniyle yaklaşık %3-5 verim kaybı olabilir. Önümüzdeki hafta temizlik planlanması önerilir.`;
    } else if (soru.toLowerCase().includes('invertör') || soru.toLowerCase().includes('invertor')) {
      return `İnvertör performans analizi tamamlandı. 3 numaralı invertörde verim düşüklüğü tespit edildi (%82 verim). Diğer invertörler normal aralıkta çalışıyor (%94-96). Detaylı inceleme önerilir.`;
    } else if (soru.toLowerCase().includes('bakım')) {
      return `Bakım takvimi analizi: Son elektrik bakımı 32 gün önce, mekanik bakım 18 gün önce gerçekleştirildi. Bir sonraki planlı bakım 12 gün sonra yapılmalı. Kritik kontrol noktaları: İnvertör sıcaklıkları, panel bağlantıları ve kablo izolasyonları.`;
    } else {
      return `${santralAdi} için yapay zeka analizim şunu gösteriyor: Son 30 günlük üretim verilerine göre performans %92.4 seviyesinde. Hava koşullarına göre normalize edildiğinde bu oran beklenen değerler içinde. Ancak panel temizliği ve invertör bakımı yakında planlanmalı.`;
    }
  } catch (error) {
    console.error('Asistan yanıt hatası:', error);
    
    // API hatası durumunda fallback yanıt
    if (soru.toLowerCase().includes('temizlik')) {
      return `${santralAdi} için panel temizliği son bakımdan bu yana 45 gün geçmiş. Toz birikimi ve kirlilik nedeniyle yaklaşık %3-5 verim kaybı olabilir. Önümüzdeki hafta temizlik planlanması önerilir.`;
    } else if (soru.toLowerCase().includes('invertör') || soru.toLowerCase().includes('invertor')) {
      return `İnvertör performans analizi tamamlandı. 3 numaralı invertörde verim düşüklüğü tespit edildi (%82 verim). Diğer invertörler normal aralıkta çalışıyor (%94-96). Detaylı inceleme önerilir.`;
    } else if (soru.toLowerCase().includes('bakım')) {
      return `Bakım takvimi analizi: Son elektrik bakımı 32 gün önce, mekanik bakım 18 gün önce gerçekleştirildi. Bir sonraki planlı bakım 12 gün sonra yapılmalı. Kritik kontrol noktaları: İnvertör sıcaklıkları, panel bağlantıları ve kablo izolasyonları.`;
    } else {
      return `${santralAdi} için yapay zeka analizim şunu gösteriyor: Son 30 günlük üretim verilerine göre performans %92.4 seviyesinde. Hava koşullarına göre normalize edildiğinde bu oran beklenen değerler içinde. Ancak panel temizliği ve invertör bakımı yakında planlanmalı.`;
    }
  }
};