# 🌞 SolarVeyo - Güneş Enerjisi Yönetim Sistemi

Modern güneş enerjisi santrallerinin yönetimi için geliştirilmiş kapsamlı web uygulaması. Arıza takibi, bakım yönetimi, üretim verileri analizi ve müşteri portalı özellikleri ile güneş enerjisi işletmeciliğinin tüm ihtiyaçlarını karşılar.

## ✨ Özellikler

### 🚨 Arıza Yönetimi
- Gerçek zamanlı arıza bildirimi ve takibi
- Öncelik bazlı sıralama (Düşük, Orta, Yüksek, Acil)
- Durum takibi (Açık, Devam Ediyor, Beklemede, Çözüldü)
- Fotoğraflı arıza kayıtları
- Müşterilere otomatik e-posta bildirimi

### 🔧 Bakım Yönetimi
- **Elektrik Bakım:** Panel temizliği, kablo kontrolü, junction box bakımı
- **Mekanik Bakım:** Yapısal kontrol, torque kontrolü, grounding sistemi
- **İnvertör Kontrolü:** Performans analizi, error kod takibi
- Planlı bakım takvimleri ve hatırlatmalar

### 📊 Üretim Verisi Takibi
- Günlük/aylık/yıllık üretim raporları
- GES performans analizi ve karşılaştırmaları
- Excel ile toplu veri aktarımı
- Grafik ve görsel analiz araçları

### 👥 Kullanıcı Yönetimi
- Rol bazlı erişim kontrolü (Yönetici, Tekniker, Mühendis, Müşteri, Bekçi)
- Şirket bazlı veri izolasyonu
- Güvenli kullanıcı davetiye sistemi

### 📦 Stok Takibi
- Yedek parça envanteri
- Kritik stok seviyeleri ve uyarılar
- Stok hareketleri kayıtları

### 🏗️ Saha ve Santral Yönetimi
- Çoklu saha/santral yönetimi
- GPS koordinat sistemi
- Şirket bazlı logo ve branding

### 📱 Mobil Uyumlu
- Responsive tasarım
- Touch-friendly interface
- Tüm cihazlarda çalışır

## 🛠️ Teknolojiler

- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** Firebase (Firestore, Auth, Functions, Storage)
- **State Management:** React Context API
- **Routing:** React Router v6
- **UI Components:** Lucide React Icons
- **Charts:** Recharts
- **Date Handling:** date-fns
- **Notifications:** React Hot Toast
- **Animation:** Framer Motion

## 🚀 Kurulum

### 1. Projeyi Klonlayın
```bash
git clone https://github.com/yourusername/solarveyo.git
cd solarveyo
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
cd functions
npm install
cd ..
```

### 3. Environment Dosyası Oluşturun
```bash
cp env.example .env
```

`.env` dosyasını Firebase bilgilerinizle doldurun:
```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
VITE_FIREBASE_PROJECT_ID=your_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here
```

### 4. Firebase Functions Konfigürasyonu
`functions/src/index.ts` dosyasında e-posta ayarlarını yapılandırın:
```typescript
const EMAIL_CONFIG = {
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
};
```

### 5. Firebase Rules Ayarlayın
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

### 6. Functions'ı Deploy Edin
```bash
cd functions
firebase deploy --only functions
cd ..
```

### 7. Uygulamayı Başlatın
```bash
npm run dev
```

## 📋 Firestore Database Yapısı

### Collections:
- `users` - Kullanıcı bilgileri
- `companies` - Şirket bilgileri
- `arizalar` - Arıza kayıtları
- `elektrikBakim` - Elektrik bakım kayıtları
- `mekanikBakim` - Mekanik bakım kayıtları
- `invertorKontrol` - İnvertör kontrol kayıtları
- `uretimVerileri` - Üretim veri kayıtları
- `sahalar` - Saha bilgileri
- `santraller` - Santral bilgileri
- `stokKontrol` - Stok takip verileri
- `bildirimler` - Sistem bildirimleri

## 🔒 Güvenlik

### Rol Bazlı Erişim:
- **Süper Admin:** Sistem geneli yönetim
- **Yönetici:** Şirket düzeyinde tam erişim
- **Mühendis:** Teknik veriler ve analizler
- **Tekniker:** Arıza ve bakım işlemleri
- **Müşteri:** Sadece atanan sahalar
- **Bekçi:** Vardiya raporları ve temel görüntüleme

### Firebase Security Rules:
- Şirket bazlı veri izolasyonu
- Rol bazlı okuma/yazma yetkileri
- Güvenli dosya upload sınırları

## 📧 E-posta Bildirimleri

Sistem otomatik olarak şu durumlarda e-posta gönderir:
- Yeni arıza bildirimi (müşterilere)
- Arıza durum güncellemesi (müşterilere)
- Yeni kullanıcı kaydı (admin'e)
- Kritik stok seviyeleri

## 🎨 UI/UX Özellikleri

- Modern ve sezgisel arayüz
- Dark/Light mode desteği
- Responsive tasarım
- Gerçek zamanlı güncellemeler
- Offline çalışma desteği
- Progressive Web App (PWA) özellikler

## 📱 Mobil Uygulama Desteği

- Touch-optimized interface
- Mobile-first tasarım yaklaşımı
- Swipe gestures
- Mobile navigation
- Camera integration (fotoğraf upload)

## 🚀 Deployment

### Netlify ile Deploy:
```bash
npm run build
# Build klasörünü Netlify'a upload edin
```

### Vercel ile Deploy:
```bash
npm run build
vercel --prod
```

### Firebase Hosting ile Deploy:
```bash
npm run build
firebase deploy --only hosting
```

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add some AmazingFeature'`)
4. Branch'inizi push edin (`git push origin feature/AmazingFeature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 👨‍💻 Geliştirici

**SolarVeyo Development Team**
- Website: [solarveyo.com](https://solarveyo.com)
- Email: info@solarveyo.com

## 🙏 Teşekkürler

Bu projeyi mümkün kılan açık kaynak topluluğuna ve kullandığımız kütüphanelerin geliştiricilerine teşekkürler:

- React Team
- Firebase Team
- Tailwind CSS Team
- Lucide Icons
- Ve diğer tüm katkıda bulunanlar

---

**SolarVeyo** - Güneş enerjisinin geleceğini yönetiyoruz ☀️
