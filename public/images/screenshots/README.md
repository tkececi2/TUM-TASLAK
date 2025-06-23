# 📸 Program Ekran Görüntüleri Rehberi

Bu klasöre aşağıdaki program ekran görüntülerini ekleyin:

## 🎯 **İhtiyaç Duyulan Resimler:**

### **1. Ana Dashboard (Hero Section için)**
- **Dosya adı:** `dashboard-hero.png` veya `dashboard-hero.jpg`
- **Boyut:** 1200x800px (tavsiye edilen)
- **İçerik:** Ana dashboard sayfasının genel görünümü

### **2. Santral İzleme Ekranı**
- **Dosya adı:** `monitoring-dashboard.png`
- **Boyut:** 1000x600px
- **İçerik:** Santrallerin canlı izlendiği ekran

### **3. Arıza Yönetimi Ekranı**
- **Dosya adı:** `fault-management.png`
- **Boyut:** 1000x600px
- **İçerik:** Arıza listesi ve yönetim ekranı

### **4. Mobil Uygulama Ekranları**
- **Dosya adları:** 
  - `mobile-app-1.png` (Ana ekran)
  - `mobile-app-2.png` (Arıza bildirimi)
  - `mobile-app-3.png` (Raporlama)
- **Boyut:** 375x812px (iPhone boyutu)

### **5. Rapor ve Analiz Ekranları**
- **Dosya adı:** `reports-analytics.png`
- **Boyut:** 1200x700px
- **İçerik:** Grafik ve analiz raporları

### **6. Stok Yönetimi**
- **Dosya adı:** `inventory-management.png`
- **Boyut:** 1000x600px

### **7. Bakım Planlama**
- **Dosya adı:** `maintenance-planning.png`
- **Boyut:** 1000x600px

## 📝 **Resim Ekleme Adımları:**

1. Program ekranlarınızın kaliteli ekran görüntülerini alın
2. Gerekirse boyutları yukarıdaki önerilere göre düzenleyin
3. Bu klasöre (/public/images/screenshots/) yükleyin
4. Dosya adlarını yukarıdaki isimlendirmeye uygun yapın
5. Bana "resimler hazır" deyin, HomePage'yi güncelleyeceğim

## 🎨 **Resim Kalitesi İpuçları:**

- **Yüksek çözünürlük** kullanın (300 DPI)
- **Temiz ve düzenli** ekranlar seçin
- **Gerçek veriler** gösterin (test verisi değil)
- **Farklı bölümlerden** çeşitli ekranlar alın
- **Mobil uygulamadan** da ekranlar ekleyin

## 🚀 **Sonraki Adım:**

Resimleri bu klasöre yükledikten sonra, HomePage bileşenini güncelleyerek bu resimleri web sitesinde göstereceğim.

# Ekran Görüntüleri Klasörü

Bu klasör, HomePage'de gösterilecek gerçek program ekran görüntülerini içerir.

## 🎥 YouTube Video Entegrasyonu

HomePage'de "Sistemi Nasıl Kullanacağınızı Öğrenin" bölümüne YouTube videosu entegre etmek için:

### 1. Video Hazırlığı
Aşağıdaki konuları içeren bir eğitim videosu hazırlayın:
- ✅ İlk kurulum ve ayarlar
- ✅ Santral ekleme ve yönetimi  
- ✅ Arıza takibi ve çözümleri
- ✅ Raporlama ve analiz

### 2. YouTube'a Yükleme
- Video'yu YouTube'a yükleyin
- Video URL'sinden video ID'sini kopyalayın
- Örnek: `https://www.youtube.com/watch?v=ABC123DEF456` → Video ID: `ABC123DEF456`

### 3. Kod Entegrasyonu
`src/pages/HomePage.tsx` dosyasında şu satırı bulun:
```tsx
src="https://www.youtube.com/embed/YOUR_VIDEO_ID_HERE?rel=0&modestbranding=1&autohide=1&showinfo=0&controls=1"
```

`YOUR_VIDEO_ID_HERE` yerine gerçek video ID'sini yazın:
```tsx
src="https://www.youtube.com/embed/ABC123DEF456?rel=0&modestbranding=1&autohide=1&showinfo=0&controls=1"
```

### 4. Placeholder'ı Kaldırma
Video ekledikten sonra iframe'in `style={{ display: 'none' }}` özelliğini kaldırın veya `'block'` yapın.

## 📱 Gerekli Ekran Görüntüleri

Aşağıdaki dosyaları bu klasöre ekleyin:

### Ana Ekranlar
- `dashboard-hero.png` - Ana dashboard görünümü (1920x1080 px)
- `monitoring-dashboard.png` - İzleme dashboard'u (1920x1080 px) 

### Özellik Ekranları  
- `fault-management.png` - Arıza yönetimi ekranı (1200x800 px)
- `inventory-management.png` - Stok yönetimi ekranı (1200x800 px)
- `reports-analytics.png` - Raporlar ve analitik ekranı (1200x800 px)

### Not
- Tüm görüntüler yüksek kalitede olmalı
- PNG formatında kaydedin
- Gerçek veri içermeyen demo veriler kullanın
- Kullanıcı arayüzü net ve okunabilir olmalı 