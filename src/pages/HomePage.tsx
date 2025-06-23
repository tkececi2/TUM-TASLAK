import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Zap,
  Shield,
  BarChart3,
  Users,
  Wrench,
  Package,
  MapPin,
  Clock,
  TrendingUp,
  CheckCircle,
  Star,
  ArrowRight,
  Play,
  Monitor,
  AlertTriangle,
  Settings,
  PieChart,
  Database,
  Building,
  Target,
  Award,
  Phone,
  Mail
} from 'lucide-react';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-white">
      
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary-400/20 rounded-full"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="text-white"
            >
              <div className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium mb-6">
                <Zap className="w-4 h-4 mr-2" />
                Türkiye'nin #1 Solar Enerji Yönetim Sistemi
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight mb-6">
                Güneş Enerjisi
                <br />
                <span className="text-primary-200">Artık Daha Akıllı</span>
              </h1>
              
              <p className="text-xl text-primary-100 mb-8 leading-relaxed">
                Solar santrallerinizi tek platformdan yönetin. Arızaları anlık takip edin, 
                bakım süreçlerini otomatikleştirin ve verimliliğinizi %40'a kadar artırın.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link 
                  to="/register" 
                  className="inline-flex items-center justify-center px-8 py-4 bg-white text-primary-700 font-semibold rounded-xl hover:bg-primary-50 transition-all duration-300 shadow-lg hover:shadow-xl group"
                >
                  Ücretsiz Deneyin
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
                
                <Link 
                  to="/login" 
                  className="inline-flex items-center justify-center px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-all duration-300 backdrop-blur-sm group"
                >
                  Giriş Yap
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
                
                <a 
                  href="https://www.youtube.com/watch?v=YOUR_VIDEO_ID" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-8 py-4 border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 transition-all duration-300 backdrop-blur-sm group"
                >
                  <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Demo İzle
                </a>
              </div>
              
              <div className="flex items-center space-x-6 text-sm text-primary-200">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-400" />
                  30 gün ücretsiz
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-400" />
                  Kurulum desteği
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-400" />
                  7/24 teknik destek
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              {/* Program Ekran Görüntüsü - Gerçek resim eklenecek */}
              <div className="relative bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20">
                <div className="bg-white rounded-2xl p-6 shadow-2xl">
                  {/* Gerçek program resmi buraya gelecek */}
                  <div className="mb-6">
                    <img 
                      src="/images/screenshots/dashboard-hero.png" 
                      alt="Solar Enerji Yönetim Sistemi - Ana Dashboard"
                      className="w-full h-auto rounded-xl shadow-lg"
                      onError={(e) => {
                        // Resim yüklenemezse placeholder göster
                        e.currentTarget.style.display = 'none';
                        const nextElement = e.currentTarget.nextElementSibling;
                        if (nextElement && 'style' in nextElement) {
                          (nextElement as HTMLElement).style.display = 'block';
                        }
                      }}
                    />
                    {/* Placeholder - resim yoksa gösterilir */}
                    <div style={{ display: 'none' }} className="bg-gray-100 rounded-xl p-6 text-center">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">Anlık Performans</h3>
                    <div className="flex items-center text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
                      Canlı
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-blue-50 rounded-xl p-4">
                      <div className="flex items-center mb-2">
                        <Zap className="w-5 h-5 text-blue-600 mr-2" />
                        <span className="text-sm text-gray-600">Güç Üretimi</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-600">2.4 MW</div>
                      <div className="text-xs text-green-600">↗ %12.5</div>
                    </div>
                    
                    <div className="bg-green-50 rounded-xl p-4">
                      <div className="flex items-center mb-2">
                        <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
                        <span className="text-sm text-gray-600">Verimlilik</span>
                      </div>
                      <div className="text-2xl font-bold text-green-600">94.2%</div>
                      <div className="text-xs text-green-600">↗ %3.1</div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-sm font-medium">Ankara GES-1</span>
                      </div>
                      <span className="text-sm text-gray-600">Normal</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                        <span className="text-sm font-medium">İzmir GES-2</span>
                      </div>
                      <span className="text-sm text-yellow-600">Bakım</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-sm font-medium">Antalya GES-3</span>
                      </div>
                      <span className="text-sm text-gray-600">Normal</span>
                    </div>
                  </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Screenshots Gallery Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-4xl font-bold text-gray-900 mb-4"
            >
              Sistemi Yakından İnceleyin
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="text-xl text-gray-600 max-w-3xl mx-auto"
            >
              Gerçek kullanıcı arayüzlerinden görüntüler - Kendi verilerinizle nasıl görüneceğini keşfedin
            </motion.p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Ana Dashboard */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300"
            >
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2 text-gray-900">Ana Dashboard</h3>
                <p className="text-gray-600 text-sm mb-4">Tüm santrallerinizi tek bakışta görün</p>
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <img 
                    src="/images/screenshots/dashboard-hero.png" 
                    alt="Ana Dashboard - Solar Enerji Yönetim Sistemi"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200"><div class="text-center"><div class="w-16 h-16 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L13.09 8.26L22 9L14.5 14.74L17.18 22L12 18.25L6.82 22L9.5 14.74L2 9L10.91 8.26L12 2Z"/></svg></div><p class="text-blue-700 font-medium">Dashboard Önizleme</p><p class="text-blue-600 text-sm">Gerçek resim yüklendiğinde burada görünecek</p></div></div>';
                      }
                    }}
                  />
                </div>
              </div>
            </motion.div>

            {/* İzleme Dashboard */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300"
            >
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2 text-gray-900">Hedef Gerçekleşen Üretim İzleme</h3>
                <p className="text-gray-600 text-sm mb-4">Üretim hedeflerinizi takip edin ve gerçekleşme oranlarını izleyin</p>
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <img 
                    src="/images/screenshots/monitoring-dashboard.png" 
                    alt="Hedef Gerçekleşen Üretim İzleme Dashboard"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-100 to-green-200"><div class="text-center"><div class="w-16 h-16 bg-green-500 rounded-xl flex items-center justify-center mx-auto mb-4"><svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg></div><p class="text-green-700 font-medium">İzleme Önizleme</p><p class="text-green-600 text-sm">Gerçek resim yüklendiğinde burada görünecek</p></div></div>';
                      }
                    }}
                  />
                </div>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Arıza Yönetimi */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300"
            >
              <div className="p-4">
                <h4 className="text-lg font-semibold mb-2 text-gray-900">Arıza Yönetimi</h4>
                <p className="text-gray-600 text-xs mb-3">Arızaları takip edin ve çözün</p>
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <img 
                    src="/images/screenshots/fault-management.png" 
                    alt="Arıza Yönetimi Ekranı"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-100 to-red-200"><div class="text-center p-2"><div class="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center mx-auto mb-2"><svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div><p class="text-red-700 text-sm font-medium">Arıza Yönetimi</p></div></div>';
                      }
                    }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Stok Yönetimi */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300"
            >
              <div className="p-4">
                <h4 className="text-lg font-semibold mb-2 text-gray-900">Stok Yönetimi</h4>
                <p className="text-gray-600 text-xs mb-3">Yedek parça envanterinizi yönetin</p>
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <img 
                    src="/images/screenshots/inventory-management.png" 
                    alt="Stok Yönetimi Ekranı"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-purple-200"><div class="text-center p-2"><div class="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-2"><svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></div><p class="text-purple-700 text-sm font-medium">Stok Yönetimi</p></div></div>';
                      }
                    }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Raporlar */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              viewport={{ once: true }}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300"
            >
              <div className="p-4">
                <h4 className="text-lg font-semibold mb-2 text-gray-900">Detaylı Raporlar</h4>
                <p className="text-gray-600 text-xs mb-3">Analiz ve performans raporları</p>
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <img 
                    src="/images/screenshots/reports-analytics.png" 
                    alt="Raporlar ve Analitik Ekranı"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-indigo-200"><div class="text-center p-2"><div class="w-12 h-12 bg-indigo-500 rounded-lg flex items-center justify-center mx-auto mb-2"><svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v4h8V3h-8z"/></svg></div><p class="text-indigo-700 text-sm font-medium">Raporlar</p></div></div>';
                      }
                    }}
                  />
                </div>
              </div>
            </motion.div>
          </div>


        </div>
      </section>

      {/* YouTube Video Tutorial Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-4xl font-bold text-gray-900 mb-4"
            >
              Sistemi Nasıl Kullanacağınızı Öğrenin
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="text-xl text-gray-600 max-w-3xl mx-auto"
            >
              Detaylı video eğitimimizle sistemi adım adım öğrenin ve tüm özelliklerden maksimum fayda sağlayın
            </motion.p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="order-2 lg:order-1"
            >
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold">1</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">İlk Kurulum ve Ayarlar</h4>
                    <p className="text-gray-600 text-sm">Sistemi nasıl kuracağınızı ve ilk ayarlarınızı nasıl yapacağınızı öğrenin</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold">2</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Santral Ekleme ve Yönetimi</h4>
                    <p className="text-gray-600 text-sm">Santrallerinizi sisteme nasıl ekleyeceğinizi ve yöneteceğinizi keşfedin</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold">3</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Arıza Takibi ve Çözümleri</h4>
                    <p className="text-gray-600 text-sm">Arızaları nasıl takip edeceğinizi ve çözüm süreçlerini nasıl yöneteceğinizi öğrenin</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold">4</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Raporlama ve Analiz</h4>
                    <p className="text-gray-600 text-sm">Detaylı raporlar oluşturmayı ve veri analizi yapmayı öğrenin</p>
                  </div>
                </div>

                <div className="pt-4">
                  <div className="inline-flex items-center px-6 py-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-200">
                    <Play className="w-5 h-5 mr-2" />
                    <span className="font-medium">Video süresi: 15 dakika</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="order-1 lg:order-2"
            >
              <div className="relative bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
                {/* YouTube Video Placeholder - Bu alanı YouTube embed kodu ile değiştirebilirsiniz */}
                <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative group cursor-pointer">
                  {/* YouTube Embed - Gerçek YouTube video ID'sini buraya ekleyin */}
                  <iframe
                    className="w-full h-full"
                    src="https://www.youtube.com/embed/YOUR_VIDEO_ID_HERE?rel=0&modestbranding=1&autohide=1&showinfo=0&controls=1"
                    title="Solar Enerji Yönetim Sistemi - Kullanım Kılavuzu"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ display: 'none' }} // Gerçek video ID eklenene kadar gizli
                  ></iframe>
                  
                  {/* Placeholder - YouTube video eklenene kadar gösterilir */}
                  <a 
                    href="https://www.youtube.com/watch?v=YOUR_VIDEO_ID" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block text-center"
                  >
                    <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-red-700 transition-colors">
                      <Play className="w-8 h-8 text-white ml-1" />
                    </div>
                    <h3 className="text-white text-xl font-semibold mb-2">Video Eğitim</h3>
                    <p className="text-gray-300 text-sm mb-4">Solar Enerji Yönetim Sistemi<br />Kullanım Kılavuzu</p>
                    <div className="inline-flex items-center px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white text-sm">
                      <Clock className="w-4 h-4 mr-2" />
                      15 dakika
                    </div>
                  </a>
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                
                {/* Video Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                  <div className="text-white">
                    <h4 className="font-semibold mb-1">Sistem Kullanım Kılavuzu</h4>
                    <p className="text-sm text-gray-300">Adım adım detaylı eğitim videosu</p>
                  </div>
                </div>
              </div>
              
              {/* Video Stats */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className="text-2xl font-bold text-gray-900">15</div>
                  <div className="text-sm text-gray-600">Dakika</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className="text-2xl font-bold text-gray-900">4</div>
                  <div className="text-sm text-gray-600">Bölüm</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className="text-2xl font-bold text-gray-900">HD</div>
                  <div className="text-sm text-gray-600">Kalite</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="space-y-2"
            >
              <div className="text-4xl font-bold text-primary-600">850+</div>
              <div className="text-gray-600">Aktif Solar Santral</div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="space-y-2"
            >
              <div className="text-4xl font-bold text-primary-600">1.2B+</div>
              <div className="text-gray-600">kWh Takip Edilen</div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="space-y-2"
            >
              <div className="text-4xl font-bold text-primary-600">%40</div>
              <div className="text-gray-600">Verimlilik Artışı</div>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
              className="space-y-2"
            >
              <div className="text-4xl font-bold text-primary-600">24/7</div>
              <div className="text-gray-600">Kesintisiz İzleme</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Who We Serve Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-4xl font-bold text-gray-900 mb-4"
            >
              Kimler İçin Tasarlandı?
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="text-xl text-gray-600 max-w-3xl mx-auto"
            >
              Solar enerji sektöründeki tüm paydaşlar için kapsamlı çözümler sunuyoruz
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-green-50 to-green-100 p-8 rounded-2xl hover:shadow-lg transition-all duration-300"
            >
              <div className="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center mb-6">
                <Wrench className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-gray-900">EPC FİRMALARI</h3>
              <p className="text-gray-600 mb-4">
                BİRÇOK ŞİRKETE HİZMET VEREN EPC FİRMALARI için kapsamlı yönetim ve takip sistemi.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />Otomatik görevlendirme</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />Mobil çalışma</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />Müşteri raporlama</li>
              </ul>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-purple-50 to-purple-100 p-8 rounded-2xl hover:shadow-lg transition-all duration-300"
            >
              <div className="w-14 h-14 bg-purple-600 rounded-xl flex items-center justify-center mb-6">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-gray-900">Teknik Ekipler</h3>
              <p className="text-gray-600 mb-4">
                Arıza tespitinden çözüme kadar tüm süreçleri mobil uygulamayla yönetin.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />Mobil arıza bildirimi</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />Fotoğraflı raporlama</li>
                <li className="flex items-center"><CheckCircle className="w-4 h-4 text-green-500 mr-2" />GPS konum takibi</li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-4xl font-bold text-gray-900 mb-4"
            >
              Neden Bu Sistemi Tercih Etmelisiniz?
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="text-xl text-gray-600 max-w-3xl mx-auto"
            >
              MÜŞTERİLERE DAHA ÇOK BİLGİ VERMEK İÇİN TASARLANDIR. YAPTIĞINIZ İŞLER HAVADA MÜŞTERİLERİNİZE DAHA İYİ AKTARIN VE ARIZALARINIZ KONTROL ALTINDA TUTUN
            </motion.p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="space-y-8">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">ÜRETİM VERİLERİ İZLEME</h3>
                    <p className="text-gray-600">Hedef ve gerçekleşen üretim verilerini takip edin. Performans analizi yapın.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">ARIZA TAKİBİ</h3>
                    <p className="text-gray-600">Arızaları anında tespit edin, kategorize edin ve çözüm süreçlerini takip edin.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Settings className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">ARIZALARIN ÇÖZÜM SÜRECİ</h3>
                    <p className="text-gray-600">Arıza çözüm süreçlerini otomatikleştirin ve takip edin. Ekip performansını izleyin.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Wrench className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">AYLIK YILLIK BAKIM</h3>
                    <p className="text-gray-600">Preventif bakım programları oluşturun ve bakım çizelgelerini yönetin.</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="relative"
            >
              {/* İzleme Dashboard Resmi */}
              <div className="bg-white rounded-2xl p-8 shadow-2xl">
                <img 
                  src="/images/screenshots/monitoring-dashboard.png" 
                  alt="Gerçek Zamanlı Santral İzleme Dashboard"
                  className="w-full h-auto rounded-xl shadow-lg mb-6"
                  onError={(e) => {
                    // Resim yüklenemezse placeholder göster
                    e.currentTarget.style.display = 'none';
                    const nextElement = e.currentTarget.nextElementSibling;
                    if (nextElement && 'style' in nextElement) {
                      (nextElement as HTMLElement).style.display = 'block';
                    }
                  }}
                />
                {/* Placeholder - resim yoksa gösterilir */}
                <div style={{ display: 'none' }}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Sistem Özeti</h3>
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">156</div>
                    <div className="text-sm text-gray-600">Aktif Santral</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">%98.2</div>
                    <div className="text-sm text-gray-600">Çalışma Oranı</div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Bugün Üretilen Enerji</span>
                      <span className="text-sm text-green-600">12.4 MWh</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Aktif Arızalar</span>
                      <span className="text-sm text-red-600">3</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Planlı Bakımlar</span>
                      <span className="text-sm text-yellow-600">8</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Secondary Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Akıllı Stok Yönetimi</h3>
              <p className="text-gray-600 text-sm">
                Yedek parça envanterinizi otomatik yönetin. Kritik stok seviyelerinde uyarı alın.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              viewport={{ once: true }}
              className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <PieChart className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Detaylı Raporlama</h3>
              <p className="text-gray-600 text-sm">
                Performans, gelir ve maliyet analizleri ile stratejik kararlar alın.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <Database className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Çoklu Entegrasyon</h3>
              <p className="text-gray-600 text-sm">
                Mevcut sistemlerinizle kolayca entegre olun. API desteği mevcuttur.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-white"
            >
              <h2 className="text-4xl font-bold mb-6">Sonuçları Gördüğünüz İlk Aydan İtibaren</h2>
              <p className="text-xl text-primary-100 mb-8">
                Binlerce kullanıcımızın deneyimlediği kanıtlanmış faydalar
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <span>%40'a kadar verimlilik artışı</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <span>%60 daha hızlı arıza çözümü</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <span>%30 bakım maliyeti tasarrufu</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <span>24/7 kesintisiz izleme</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <span>Mobil uygulamalarla her yerden erişim</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <span>Ücretsiz kurulum ve eğitim</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-white rounded-2xl p-8">
                <h3 className="text-xl font-semibold mb-6 text-gray-900">Müşteri Başarı Hikayesi</h3>
                
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                    <span className="font-bold text-primary-600">AE</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Ahmet Erdem</div>
                    <div className="text-sm text-gray-500">GES Sahibi - EkoEnerji Ltd.</div>
                  </div>
                </div>
                
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                
                <blockquote className="text-gray-600 italic mb-6">
                  "6 farklı bölgedeki GES'lerimizi tek platformdan yönetebilmek inanılmaz. 
                  İlk 3 ayda %35 verimlilik artışı elde ettik ve bakım maliyetlerimiz yarı yarıya düştü."
                </blockquote>
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary-600">6</div>
                    <div className="text-xs text-gray-500">GES</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">%35</div>
                    <div className="text-xs text-gray-500">Verimlilik</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">%50</div>
                    <div className="text-xs text-gray-500">Maliyet Düşüşü</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-white mb-6">
              Solar Enerjinizi Bir Sonraki Seviyeye Taşıyın
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              30 gün ücretsiz deneyin. Kredi kartı gerekmez. Anında başlayın.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link 
                to="/register" 
                className="inline-flex items-center justify-center px-8 py-4 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-all duration-300 shadow-lg hover:shadow-xl group"
              >
                Ücretsiz Hesap Oluşturun
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <Link 
                to="/contact" 
                className="inline-flex items-center justify-center px-8 py-4 border-2 border-gray-600 text-gray-300 font-semibold rounded-xl hover:bg-gray-800 transition-all duration-300"
              >
                <Phone className="w-5 h-5 mr-2" />
                Demo Talep Edin
              </Link>
            </div>
            
            <div className="flex items-center justify-center space-x-6 text-sm text-gray-400">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                Ücretsiz kurulum
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                24/7 destek
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                Para iade garantisi
              </div>
            </div>
          </motion.div>
        </div>
      </section>

    </div>
  );
};

export default HomePage;