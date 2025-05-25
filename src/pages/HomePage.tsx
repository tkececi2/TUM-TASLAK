
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Shield, Zap, CheckCircle, ArrowRight, Users, BarChart2, Globe, Mail, Phone, Clock, ChevronDown } from 'lucide-react';

const HomePage: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(sectionId);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);

      // Aktif bölümü belirle
      const sections = ['home', 'features', 'benefits', 'testimonials', 'contact'];
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigasyon */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md py-2' : 'bg-transparent py-4'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <img src="/solar-logo.png" alt="SolarVeyo Logo" className={`h-8 w-8 mr-2`} />
              <span className={`font-bold text-xl ${scrolled ? 'text-gray-900' : 'text-white'}`}>solarVeyo</span>
            </div>
            <div className="hidden md:flex space-x-6">
              <button 
                onClick={() => scrollToSection('home')} 
                className={`px-3 py-2 rounded-md text-sm font-medium ${activeSection === 'home' ? 'text-blue-600' : (scrolled ? 'text-gray-700 hover:text-blue-600' : 'text-white hover:text-blue-100')} transition-colors`}
              >
                Ana Sayfa
              </button>
              <button 
                onClick={() => scrollToSection('features')} 
                className={`px-3 py-2 rounded-md text-sm font-medium ${activeSection === 'features' ? 'text-blue-600' : (scrolled ? 'text-gray-700 hover:text-blue-600' : 'text-white hover:text-blue-100')} transition-colors`}
              >
                Özellikler
              </button>
              <button 
                onClick={() => scrollToSection('benefits')} 
                className={`px-3 py-2 rounded-md text-sm font-medium ${activeSection === 'benefits' ? 'text-blue-600' : (scrolled ? 'text-gray-700 hover:text-blue-600' : 'text-white hover:text-blue-100')} transition-colors`}
              >
                Avantajlar
              </button>
              <button 
                onClick={() => scrollToSection('testimonials')} 
                className={`px-3 py-2 rounded-md text-sm font-medium ${activeSection === 'testimonials' ? 'text-blue-600' : (scrolled ? 'text-gray-700 hover:text-blue-600' : 'text-white hover:text-blue-100')} transition-colors`}
              >
                Hakkımızda
              </button>
              <button 
                onClick={() => scrollToSection('contact')} 
                className={`px-3 py-2 rounded-md text-sm font-medium ${activeSection === 'contact' ? 'text-blue-600' : (scrolled ? 'text-gray-700 hover:text-blue-600' : 'text-white hover:text-blue-100')} transition-colors`}
              >
                İletişim
              </button>
            </div>
            <div className="flex space-x-3">
              <Link
                to="/login"
                className={`px-4 py-2 rounded-lg text-sm font-medium ${scrolled ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-blue-700 hover:bg-gray-100'} shadow-sm transition-all duration-300`}
              >
                Giriş Yap
              </Link>
              <Link
                to="/register"
                className={`px-4 py-2 rounded-lg text-sm font-medium ${scrolled ? 'border border-blue-600 text-blue-600 hover:bg-blue-50' : 'border border-white text-white hover:bg-white/10'} transition-all duration-300`}
              >
                Kayıt Ol
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header id="home" className="bg-gradient-to-r from-blue-600 to-blue-800 relative pt-24 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="md:w-1/2 text-white mb-10 md:mb-0 animate-fadeIn">
              <div className="inline-block px-4 py-1 bg-white/20 backdrop-blur-sm rounded-full mb-6 font-medium text-white text-sm">
                ✨ Yenilikçi Solar Teknolojisi
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4 leading-tight">
                  Solar Panel <span className="text-blue-300">Yönetim</span> Sistemi
                </h1>
                <p className="text-xl text-white/80 mb-8 max-w-2xl leading-relaxed">
                  Güneş enerjisi santrallerinizi tek platformdan izleyin, arızaları yönetin, bakım süreçlerini takip edin ve üretim analizleriyle performansı maksimuma çıkarın.
                </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/login"
                  className="px-6 py-3 bg-white text-blue-700 font-medium rounded-lg shadow-lg hover:bg-gray-100 transition-all duration-300 flex items-center transform hover:scale-105"
                >
                  Hemen Başlayın
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  to="/register"
                  className="px-6 py-3 bg-transparent border-2 border-white text-white font-medium rounded-lg hover:bg-white/10 transition-all duration-300 transform hover:scale-105"
                >
                  Daha Fazla Bilgi
                </Link>
              </div>

              <div className="flex items-center mt-10 text-sm">
                <div className="flex -space-x-2">
                  <img src="https://randomuser.me/api/portraits/men/32.jpg" className="w-10 h-10 rounded-full border-2 border-white" alt="User" />
                  <img src="https://randomuser.me/api/portraits/women/44.jpg" className="w-10 h-10 rounded-full border-2 border-white" alt="User" />
                  <img src="https://randomuser.me/api/portraits/men/46.jpg" className="w-10 h-10 rounded-full border-2 border-white" alt="User" />
                </div>
                <div className="ml-4">
                  <div className="flex items-center">
                    <span className="text-yellow-300">★★★★★</span>
                    <span className="ml-1 text-white">4.9/5</span>
                  </div>
                  <p className="text-white/70">Müşterilerimizin %98'i memnun</p>
                </div>
              </div>
            </div>
            <div className="md:w-1/2 flex justify-center">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full blur-3xl opacity-30 animate-pulse-slow"></div>
                <img
                  src="/solar-logo.png"
                  alt="Solar Panel"
                  className="w-96 h-auto object-contain drop-shadow-xl relative z-10 animate-float"
                />
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 flex justify-center">
            <button 
              onClick={() => scrollToSection('features')}
              className="bg-white rounded-full p-3 shadow-md mb-6 animate-bounceSoft"
            >
              <ChevronDown className="h-6 w-6 text-blue-600" />
            </button>
          </div>
        </div>
      </header>

      {/* İstatistik Bilgiler */}
      <div className="bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            <div className="bg-gray-50 p-6 rounded-xl shadow-sm text-center">
              <div className="font-bold text-3xl text-blue-600 mb-1">250+</div>
              <div className="text-gray-600 text-sm">Aktif GES</div>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl shadow-sm text-center">
              <div className="font-bold text-3xl text-blue-600 mb-1">98%</div>
              <div className="text-gray-600 text-sm">Müşteri Memnuniyeti</div>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl shadow-sm text-center">
              <div className="font-bold text-3xl text-blue-600 mb-1">15M+</div>
              <div className="text-gray-600 text-sm">kWh Üretim</div>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl shadow-sm text-center">
              <div className="font-bold text-3xl text-blue-600 mb-1">5.000+</div>
              <div className="text-gray-600 text-sm">Önlenen Arıza</div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium text-sm mb-4">
              ÖNE ÇIKAN ÖZELLİKLER
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Güneş Enerjisi Santrallerinizi Daha Verimli Yönetin
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Solar Takip sistemi ile güneş enerjisi santrallerinizi daha akıllı, daha verimli ve daha kolay yönetin.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105">
              <div className="p-4 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Shield className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Akıllı Arıza Takibi</h3>
              <p className="text-gray-600 mb-4">
                Günlük, aylık ve yıllık enerji kontrolleri, hedef gerçekleşme analizleri ile arıza takibinizi akıllı hale getirin.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Günlük enerji kontrolü</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Aylık enerji kontrolü</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                   <span>Yıllık enerji kontrolü</span>
                </li>
                  <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Hedef Gerçekleşme Analizleri</span>
                </li>
              </ul>
              <button 
                onClick={() => scrollToSection('contact')}
                className="text-blue-600 font-medium text-sm flex items-center hover:text-blue-800"
              >
                Daha Fazla Bilgi <ArrowRight className="h-4 w-4 ml-1" />
              </button>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105">
              <div className="p-4 bg-indigo-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <BarChart2 className="h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Arıza Takibi</h3>
              <p className="text-gray-600 mb-4">
               Arıza oluşturma, silme, düzenleme ve çözüm süresi takibi ile arıza süreçlerinizi kolaylaştırın.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Arıza Oluşturma</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Arıza Silme ve Düzenleme</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Çözüm Süresi Takibi</span>
                </li>
              </ul>
              <button 
                onClick={() => scrollToSection('contact')}
                className="text-indigo-600 font-medium text-sm flex items-center hover:text-indigo-800"
              >
                Daha Fazla Bilgi <ArrowRight className="h-4 w-4 ml-1" />
              </button>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105">
              <div className="p-4 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Zap className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Akıllı Bakım Yönetimi</h3>
              <p className="text-gray-600 mb-4">
                Aylık bakım kontrolleri, müşteri ekleme/silme ve müşterilere özel santral izleme ile bakım süreçlerinizi optimize edin.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Aylık Bakım Kontrolleri</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Müşteri Ekleme/Silme</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Müşteriye Özel Santral İzleme</span>
                </li>
              </ul>
              <button 
                onClick={() => scrollToSection('contact')}
                className="text-blue-600 font-medium text-sm flex items-center hover:text-blue-800"
              >
                Daha Fazla Bilgi <ArrowRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Nasıl Çalışır Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium text-sm mb-4">
              NASIL ÇALIŞIR
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Üç Basit Adımda Başlayın
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Solar Panel Arıza Takip Sistemimiz kullanımı kolay arayüzü ile saniyeler içinde kuruluma hazır.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-6">1</div>
                <div className="hidden md:block absolute top-8 left-full w-24 h-0.5 bg-gray-200"></div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Hesabınızı Oluşturun</h3>
              <p className="text-gray-600">
                Basit kayıt sürecini tamamlayın ve hemen kullanmaya başlayın. Telefon numarası ve e-posta ile doğrulama gerekir.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-6">2</div>
                <div className="hidden md:block absolute top-8 left-full w-24 h-0.5 bg-gray-200"></div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Santrallerinizi Ekleyin</h3>
              <p className="text-gray-600">
                GES santrallerinizin bilgilerini girin ve sistem otomatik olarak izlemeye başlasın. Ölçüm cihazlarınızı entegre edin.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mb-6">3</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Anlık Takibe Başlayın</h3>
              <p className="text-gray-600">
                Web veya mobil cihazlarınızdan santrallerinizi izleyin, arızaları kontrol edin ve bakım süreçlerinizi yönetin.
              </p>
            </div>
          </div>

          <div className="mt-16 text-center">
            <Link
              to="/register"
              className="px-8 py-4 bg-blue-600 text-white font-medium rounded-lg shadow-lg hover:bg-blue-700 transition-all duration-300 inline-flex items-center transform hover:scale-105"
            >
              Hemen Ücretsiz Deneyin
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <p className="mt-4 text-sm text-gray-500">Kredi kartı gerekmez. İlk 14 gün ücretsiz deneme.</p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="benefits" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium text-sm mb-4">
              NEDEN BİZ
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Solar Enerji Sistemlerinizi Profesyonelce Takip Edin
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              SolarVeyo ile güneş enerjisi yatırımlarınızdan maksimum verim alın.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300">
              <div className="p-4 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">7/24 Kesintisiz İzleme</h3>
              <p className="text-gray-600">
                Güneş enerjisi santralleriniz sürekli izleme altında. Gece veya gündüz, haftasonu veya tatil demeden her an kontrol altında.
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Gerçek zamanlı veri akışı</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Otomatik alarm sistemi</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Mobil uygulama desteği</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300">
              <div className="p-4 bg-indigo-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Zap className="h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Hızlı Müdahale Ekibi</h3>
              <p className="text-gray-600">
                Arıza durumlarında anlık bildirimler alın ve uzman ekibimiz tarafından hızla müdahale edilmesini sağlayın.
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>4 saat içinde müdahale garantisi</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Uzman tekniker ekibi</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Arıza sebebi analizi</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300">
              <div className="p-4 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <BarChart2 className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Kapsamlı Raporlama</h3>
              <p className="text-gray-600">
                Detaylı raporlar ve analizler ile santrallerinizin performansını ölçün, karşılaştırın ve optimizasyon yapın.
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Günlük, haftalık ve aylık raporlar</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>PDF ve Excel formatında dışa aktarım</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Performans karşılaştırma grafikleri</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Referanslar Section */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium text-sm mb-4">
              MÜŞTERİ YORUMLARI
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Müşterilerimiz Ne Diyor?
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Türkiye'nin önde gelen enerji şirketleri SolarVeyo'yu tercih ediyor.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-100">
              <div className="flex items-center mb-6">
                <img src="https://randomuser.me/api/portraits/men/32.jpg" className="w-12 h-12 rounded-full mr-4" alt="Testimonial" />
                <div>
                  <h4 className="font-bold text-gray-900">Ahmet Yılmaz</h4>
                  <p className="text-sm text-gray-500">Enerji Grup Müdürü, ABC Enerji</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                "SolarVeyo sayesinde santrallerimizin verimliliği %15 arttı. Arıza tespiti ve müdahale süreleri ciddi oranda kısaldı. Kesinlikle tavsiye ediyorum."
              </p>
              <div className="flex text-yellow-400">
                <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-100">
              <div className="flex items-center mb-6">
                <img src="https://randomuser.me/api/portraits/women/44.jpg" className="w-12 h-12 rounded-full mr-4" alt="Testimonial" />
                <div>
                  <h4 className="font-bold text-gray-900">Ayşe Demir</h4>
                  <p className="text-sm text-gray-500">Operasyon Direktörü, XYZ Solar</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                "Sistemin kullanımı çok kolay ve raporlama özellikleri mükemmel. Artık santrallerimizin durumunu istediğimiz an görebiliyoruz. Teknik destek ekibi de oldukça yardımcı."
              </p>
              <div className="flex text-yellow-400">
                <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-100">
              <div className="flex items-center mb-6">
                <img src="https://randomuser.me/api/portraits/men/46.jpg" className="w-12 h-12 rounded-full mr-4" alt="Testimonial" />
                <div>
                  <h4 className="font-bold text-gray-900">Mehmet Kaya</h4>
                  <p className="text-sm text-gray-500">CEO, Kaya Enerji</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                "6 farklı ilde bulunan santrallerimizi tek bir platformdan yönetebiliyoruz. Bakım süreçlerimiz artık çok daha düzenli ve verimli. SolarVeyo ekibine teşekkürler."
              </p>
              <div className="flex text-yellow-400">
                <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
              </div>
            </div>
          </div>

          <div className="mt-16 flex justify-center">
            <img src="/edeon-logo.png" alt="Edeon Logo" className="h-16" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Hemen Başlayın</h2>
          <p className="text-xl text-white/90 mb-10 max-w-3xl mx-auto">
            Solar Panel Arıza Takip Sistemimiz ile güneş enerjisi yatırımlarınızı daha verimli hale getirin. İlk 14 gün ücretsiz deneyin.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/login"
              className="px-8 py-4 bg-white text-blue-700 font-medium rounded-lg shadow-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-105"
            >
              Hemen Giriş Yap
            </Link>
            <Link
              to="/register"
              className="px-8 py-4 bg-transparent border-2 border-white text-white font-medium rounded-lg hover:bg-white/10 transition-all duration-300 transform hover:scale-105"
            >
              Ücretsiz Hesap Oluştur
            </Link>
          </div>
          <p className="mt-6 text-sm text-white/70">Kredi kartı bilgisi gerekmez. İstediğiniz zaman iptal edebilirsiniz.</p>
        </div>
      </section>

      {/* İletişim Section */}
      <section id="contact" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium text-sm mb-4">
              İLETİŞİM
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Bize Ulaşın
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Sorularınız mı var? Size yardımcı olmaktan memnuniyet duyarız.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-center text-center">
              <div className="p-4 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Phone className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Bizi Arayın</h3>
              <p className="text-gray-600 mb-4">
                Teknik destek ve satış ekibimiz size yardımcı olmak için hazır.
              </p>
              <a href="tel:+902121234567" className="text-blue-600 font-bold">
                +90 (212) 123 45 67
              </a>
            </div>

            <div className="bg-gray-50 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-center text-center">
              <div className="p-4 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">E-posta Gönderin</h3>
              <p className="text-gray-600 mb-4">
                Sorularınızı e-posta ile iletebilirsiniz, en kısa sürede dönüş yapacağız.
              </p>
              <a href="mailto:info@edeonenerji.com" className="text-blue-600 font-bold">
                info@solarveyo.com
              </a>
            </div>

            <div className="bg-gray-50 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-center text-center">
              <div className="p-4 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Globe className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Ofisimizi Ziyaret Edin</h3>
              <p className="text-gray-600 mb-4">
                İstanbul'daki merkez ofisimizde sizleri ağırlamaktan mutluluk duyarız.
              </p>
              <address className="text-blue-600 font-bold not-italic">
                Maslak, Büyükdere Cad. No:123, İstanbul
              </address>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-6">
                <img src="/solar-logo.png" alt="solarVeyo Logo" className="h-8 w-8 mr-3" />
                <h3 className="text-xl font-bold">solarVeyo</h3>
              </div>
              <p className="text-gray-400 mb-6">
                Güneş enerjisi santrallerinizi 7/24 izleyin, arıza durumlarında anında müdahale edin.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723 10.054 10.054 0 01-3.127 1.184 4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2 16h-2v-6h2v6zm-1-6.891c-.607 0-1.1-.496-1.1-1.109 0-.612.492-1.109 1.1-1.109s1.1.497 1.1 1.109c0 .613-.493 1.109-1.1 1.109zm8 6.891h-1.998v-2.861c0-1.881-2.002-1.722-2.002 0v2.861h-2v-6h2v1.093c.872-1.616 4-1.736 4 1.548v3.359z"/></svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-bold mb-4">Hızlı Erişim</h4>
              <ul className="space-y-2">
                <li><button onClick={() => scrollToSection('home')} className="text-gray-400 hover:text-white transition-colors">Ana Sayfa</button></li>
                <li><button onClick={() => scrollToSection('features')} className="text-gray-400 hover:text-white transition-colors">Özellikler</button></li>
                <li><button onClick={() => scrollToSection('benefits')} className="text-gray-400 hover:text-white transition-colors">Avantajlar</button></li>
                <li><button onClick={() => scrollToSection('testimonials')} className="text-gray-400 hover:text-white transition-colors">Müşteri Yorumları</button></li>
                <li><button onClick={() => scrollToSection('contact')} className="text-gray-400 hover:text-white transition-colors">İletişim</button></li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-bold mb-4">Hizmetlerimiz</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Arıza Takip Sistemi</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Bakım Yönetimi</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Performans Analizi</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Mobil Uygulama</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">API Entegrasyonu</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-bold mb-4">İletişim</h4>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <Phone className="h-5 w-5 text-blue-400 mr-2 mt-0.5" />
                  <span className="text-gray-400">+90 (212) 123 45 67</span>
                </li>
                <li className="flex items-start">
                  <Mail className="h-5 w-5 text-blue-400 mr-2 mt-0.5" />
                  <span className="text-gray-400">info@solarveyo.com</span>
                </li>
                <li className="flex items-start">
                  <Globe className="h-5 w-5 text-blue-400 mr-2 mt-0.5" />
                  <span className="text-gray-400">Maslak, Büyükdere Cad. No:123<br />İstanbul, Türkiye</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm mb-4 md:mb-0">
              © {new Date().getFullYear()} SolarVeyo - Solar Panel Arıza Takip Sistemi. Tüm hakları saklıdır.
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Gizlilik Politikası</a>
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Kullanım Şartları</a>
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">KVKK</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Sayfanın en üstüne çıkma butonu */}
      {scrolled && (
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
          className="fixed bottom-6 right-6 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 z-50"
          aria-label="Yukarı çık"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default HomePage;
