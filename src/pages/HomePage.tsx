
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Shield, Zap, CheckCircle, ArrowRight, Users, BarChart2, Globe, Mail, Phone, Clock, ChevronDown, Database, FileText, PanelTop, Activity, Lightbulb, TrendingUp } from 'lucide-react';

const HomePage: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [showCTA, setShowCTA] = useState(false);

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
      setShowCTA(window.scrollY > 600);

      // Determine active section
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
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md py-2' : 'bg-transparent py-4'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <img src="/solarveyo-logo.png" alt="SolarVeyo Logo" className="h-10 w-10 mr-2" />
              <span className={`font-bold text-xl ${scrolled ? 'text-gray-900' : 'text-white'}`}>SolarVeyo</span>
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
                Referanslar
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
                Ücretsiz Dene
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Floating CTA Button (appears on scroll) */}
      {showCTA && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 animate-bounce-slow">
          <Link
            to="/register"
            className="flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300"
          >
            14 Gün Ücretsiz Deneyin
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      )}

      {/* Hero Section */}
      <header id="home" className="bg-gradient-to-r from-blue-600 to-blue-800 relative pt-24 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="md:w-1/2 text-white mb-10 md:mb-0 animate-fadeIn">
              <div className="inline-block px-4 py-1 bg-white/20 backdrop-blur-sm rounded-full mb-6 font-medium text-white text-sm">
                ✨ Solar Panel Arıza ve Yönetim Sistemi
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4 leading-tight">
                Güneş Enerjisi Santrallerinizi <span className="text-blue-300">Akıllı</span> Yönetin
              </h1>
              <p className="text-xl text-white/80 mb-8 max-w-2xl leading-relaxed">
                SolarVeyo ile güneş enerjisi santrallerinizi tek platformdan izleyin, arızaları anında tespit edin, bakımları planlayın ve verimliliği %25'e kadar artırın.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/register"
                  className="px-6 py-3 bg-white text-blue-700 font-medium rounded-lg shadow-lg hover:bg-gray-100 transition-all duration-300 flex items-center transform hover:scale-105"
                >
                  14 Gün Ücretsiz Deneyin
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <button
                  onClick={() => scrollToSection('features')}
                  className="px-6 py-3 bg-transparent border-2 border-white text-white font-medium rounded-lg hover:bg-white/10 transition-all duration-300 transform hover:scale-105"
                >
                  Neden SolarVeyo?
                </button>
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
                  <p className="text-white/70">250+ GES tarafından kullanılıyor</p>
                </div>
              </div>
            </div>
            <div className="md:w-1/2 flex justify-center">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full blur-3xl opacity-30 animate-pulse-slow"></div>
                <img
                  src="/solarveyo-logo.png"
                  alt="Solar Panel Dashboard"
                  className="w-96 h-auto object-contain drop-shadow-xl relative z-10 animate-float"
                />
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 flex justify-center">
            <button 
              onClick={() => scrollToSection('features')}
              className="bg-white rounded-full p-3 shadow-md mb-6 animate-bounce-slow"
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
              <div className="font-bold text-3xl text-blue-600 mb-1">%25</div>
              <div className="text-gray-600 text-sm">Verimlilik Artışı</div>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl shadow-sm text-center">
              <div className="font-bold text-3xl text-blue-600 mb-1">%68</div>
              <div className="text-gray-600 text-sm">Arıza Azalması</div>
            </div>
            <div className="bg-gray-50 p-6 rounded-xl shadow-sm text-center">
              <div className="font-bold text-3xl text-blue-600 mb-1">4 Saat</div>
              <div className="text-gray-600 text-sm">Ortalama Müdahale Süresi</div>
            </div>
          </div>
        </div>
      </div>

      {/* Problem Statement Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 bg-red-100 text-red-800 rounded-full font-medium text-sm mb-4">
              PROBLEM
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Güneş Enerjisi Yönetiminde Yaşanan Zorluklar
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Güneş enerjisi santrali (GES) yatırımcıları ve yöneticileri için en büyük sorunlar:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300">
              <div className="p-4 bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Activity className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Verim Kayıpları</h3>
              <p className="text-gray-600 mb-4">
                Güneş panellerinde fark edilmeyen sorunlar, kirlilik ve bakım eksiklikleri enerji üretiminde %30'a varan kayıplara neden oluyor.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start text-sm text-gray-500">
                  <span className="text-red-500 mr-2">✘</span>
                  <span>Zamanında tespit edilemeyen panel arızaları</span>
                </li>
                <li className="flex items-start text-sm text-gray-500">
                  <span className="text-red-500 mr-2">✘</span>
                  <span>Düzenli takip edilmeyen inverter performansı</span>
                </li>
                <li className="flex items-start text-sm text-gray-500">
                  <span className="text-red-500 mr-2">✘</span>
                  <span>Optimum olmayan panel açıları ve konumlandırma</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300">
              <div className="p-4 bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Clock className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Yavaş Müdahale</h3>
              <p className="text-gray-600 mb-4">
                Arızaların geç tespit edilmesi, raporlama zorluğu ve teknik ekiplerin koordinasyon sorunları nedeniyle uzun arıza süreleri yaşanıyor.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start text-sm text-gray-500">
                  <span className="text-red-500 mr-2">✘</span>
                  <span>Kağıt tabanlı manuel arıza kaydı süreçleri</span>
                </li>
                <li className="flex items-start text-sm text-gray-500">
                  <span className="text-red-500 mr-2">✘</span>
                  <span>Teknik ekiplerin geç bilgilendirilmesi</span>
                </li>
                <li className="flex items-start text-sm text-gray-500">
                  <span className="text-red-500 mr-2">✘</span>
                  <span>Arızaların önem derecesine göre sınıflandırılmaması</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300">
              <div className="p-4 bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <BarChart2 className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Veri Eksikliği</h3>
              <p className="text-gray-600 mb-4">
                Üretim verilerinin düzenli toplanmaması ve analiz edilmemesi, stratejik karar almayı zorlaştırıyor ve yatırım getirisini olumsuz etkiliyor.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start text-sm text-gray-500">
                  <span className="text-red-500 mr-2">✘</span>
                  <span>Dağınık ve tutarsız veri kaynakları</span>
                </li>
                <li className="flex items-start text-sm text-gray-500">
                  <span className="text-red-500 mr-2">✘</span>
                  <span>Karşılaştırmalı performans analizinin olmaması</span>
                </li>
                <li className="flex items-start text-sm text-gray-500">
                  <span className="text-red-500 mr-2">✘</span>
                  <span>Üretim tahminlerinin gerçekleşme oranı takibi yapılmaması</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full font-medium text-white text-sm mb-4">
              ÇÖZÜM
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              SolarVeyo ile Tüm Sorunlar Tek Platformda Çözülüyor
            </h2>
            <p className="mt-4 text-xl text-white/80 max-w-3xl mx-auto">
              GES yönetiminizi dijitalleştirin, verimliliği artırın, maliyetleri düşürün
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-start">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full mr-4 flex-shrink-0">
                  <Sun className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-3">Akıllı İzleme ve Erken Uyarı</h3>
                  <p className="text-white/80 mb-4">
                    Santralinizin performansını 7/24 izleyin, potansiyel sorunları daha oluşmadan tespit edin.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-300 mr-2 flex-shrink-0" />
                      <span>Gerçek zamanlı üretim takibi</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-300 mr-2 flex-shrink-0" />
                      <span>Anomali tespiti ve otomatik bildirimler</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-300 mr-2 flex-shrink-0" />
                      <span>Hedef/gerçekleşme karşılaştırmaları</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-start">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full mr-4 flex-shrink-0">
                  <Shield className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-3">Profesyonel Arıza Yönetimi</h3>
                  <p className="text-white/80 mb-4">
                    Arızaları hızlıca kaydedip önceliklendirin, teknik ekibi anında bilgilendirin.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-300 mr-2 flex-shrink-0" />
                      <span>Mobil uygulama ile sahadan anında arıza bildirimi</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-300 mr-2 flex-shrink-0" />
                      <span>Otomatik iş emri oluşturma ve atama</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-300 mr-2 flex-shrink-0" />
                      <span>Arıza geçmişi ve çözüm bilgi bankası</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-start">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full mr-4 flex-shrink-0">
                  <Database className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-3">Kapsamlı Analiz ve Raporlar</h3>
                  <p className="text-white/80 mb-4">
                    Üretim verilerini analiz edin, detaylı raporlar oluşturun, daha iyi kararlar alın.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-300 mr-2 flex-shrink-0" />
                      <span>Özelleştirilebilir yönetici gösterge panelleri</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-300 mr-2 flex-shrink-0" />
                      <span>PDF ve Excel olarak dışa aktarılabilir raporlar</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-300 mr-2 flex-shrink-0" />
                      <span>Santral performansını etkileyen faktörlerin analizi</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-start">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full mr-4 flex-shrink-0">
                  <FileText className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-3">Akıllı Bakım Planlama</h3>
                  <p className="text-white/80 mb-4">
                    Bakım programlarını optimize edin, maliyetleri düşürün, kesinti sürelerini azaltın.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-300 mr-2 flex-shrink-0" />
                      <span>Önleyici bakım planlaması ve hatırlatıcılar</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-300 mr-2 flex-shrink-0" />
                      <span>Ekipman ömür tahmini ve değişim planlaması</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-300 mr-2 flex-shrink-0" />
                      <span>Bakım maliyetlerinin optimizasyonu</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium text-sm mb-4">
              ÖZELLİKLER
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              SolarVeyo'nun Öne Çıkan Özellikleri
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Güneş enerjisi yönetiminin tüm ihtiyaçlarını karşılayan kapsamlı çözüm
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-gray-100">
              <div className="p-4 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Shield className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Akıllı Arıza Takibi</h3>
              <p className="text-gray-600 mb-4">
                Arızaları anında tespit edin, hızlıca kaydedin ve teknik ekipleri yönlendirin.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Fotoğraf ve konum bilgisi ile arıza kaydı</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Önceliklendirme ve atama sistemi</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Çözüm süreçlerinin takibi</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Arıza istatistikleri ve analizi</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-gray-100">
              <div className="p-4 bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <PanelTop className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Panel Performans İzleme</h3>
              <p className="text-gray-600 mb-4">
                Her bir panel grubunun performansını izleyin, sorunları hızlıca tespit edin.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Gerçek zamanlı üretim verileri</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Sıcaklık ve ışınım takibi</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Performans oranı hesaplamaları</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Verim düşüşü otomatik tespiti</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-gray-100">
              <div className="p-4 bg-yellow-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Zap className="h-8 w-8 text-yellow-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">İnvertör Kontrol Sistemi</h3>
              <p className="text-gray-600 mb-4">
                İnvertörlerin durumunu kontrol edin, hataları önleyici bakımlarla giderin.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>İnvertör verimlilik takibi</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Hata kodları kütüphanesi</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Önleyici bakım programları</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Garanti ve servis takibi</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-gray-100">
              <div className="p-4 bg-indigo-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <BarChart2 className="h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Detaylı Analiz ve Raporlama</h3>
              <p className="text-gray-600 mb-4">
                Özelleştirilebilir raporlar oluşturun, performansı karşılaştırın ve analiz edin.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Özelleştirilebilir gösterge panelleri</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Finansal performans raporları</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>PDF ve Excel formatında dışa aktarım</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Karşılaştırmalı saha performansı</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-gray-100">
              <div className="p-4 bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Users className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Ekip ve Müşteri Yönetimi</h3>
              <p className="text-gray-600 mb-4">
                Teknik ekibi koordine edin, müşterilere özel erişim imkanı sağlayın.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Rol tabanlı kullanıcı yetkilendirme</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Müşterilere sınırlı erişim sağlama</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Ekip görev ataması ve takibi</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Performans değerlendirme</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105 border border-gray-100">
              <div className="p-4 bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Lightbulb className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Yapay Zeka Entegrasyonu</h3>
              <p className="text-gray-600 mb-4">
                Yapay zeka destekli öngörüler, otomasyon ve optimizasyon araçları.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Üretim tahmini ve optimizasyonu</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Kestirimci bakım algoritmaları</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Anomali tespiti ve uyarı sistemi</span>
                </li>
                <li className="flex items-center text-sm text-gray-500">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                  <span>Öneriler ve optimizasyon ipuçları</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ROI / Benefits Section */}
      <section id="benefits" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium text-sm mb-4">
              KAZANÇLAR
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              SolarVeyo ile Elde Edeceğiniz Avantajlar
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Yatırımınızdan maksimum getiri sağlamanızı nasıl destekliyoruz?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-10">
              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Gelir Artışı</h3>
                  <p className="mt-2 text-gray-600">
                    SolarVeyo kullanıcıları, sistemdeki optimizasyonlar ve hızlı arıza müdahaleleri sayesinde yıllık gelirlerinde <span className="font-bold text-green-600">%8-15 artış</span> bildirmektedir. 1 MW'lık bir santral için bu, yıllık <span className="font-bold text-green-600">~40.000 TL ek gelir</span> anlamına gelir.
                  </p>
                </div>
              </div>

              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white">
                    <Clock className="h-6 w-6" />
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Zaman Tasarrufu</h3>
                  <p className="mt-2 text-gray-600">
                    Otomatik izleme ve raporlama sayesinde manuel işlemlerde <span className="font-bold text-green-600">%75'e varan zaman tasarrufu</span>. Ortalama 4 saatlik arıza tespit süresi <span className="font-bold text-green-600">20 dakikaya</span> düşüyor.
                  </p>
                </div>
              </div>

              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white">
                    <Leaf className="h-6 w-6" />
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Ekipman Ömrü</h3>
                  <p className="mt-2 text-gray-600">
                    Önleyici bakım stratejileri sayesinde ekipman ömrünün <span className="font-bold text-green-600">%15-20 uzatılması</span> ve değişim maliyetlerinin azaltılması. İnvertör arızalarında <span className="font-bold text-green-600">%30 azalma</span> sağlıyor.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-10">
              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white">
                    <Shield className="h-6 w-6" />
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Risk Azaltma</h3>
                  <p className="mt-2 text-gray-600">
                    Arıza süresinin kısalması sayesinde gelir kayıplarında <span className="font-bold text-green-600">%40 azalma</span>. Güvenlik sorunları ve acil durumların hızlı tespiti ile risklerin önlenmesi.
                  </p>
                </div>
              </div>

              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white">
                    <Users className="h-6 w-6" />
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Müşteri Memnuniyeti</h3>
                  <p className="mt-2 text-gray-600">
                    GES sahibi müşterilerinize şeffaf raporlama sağlayarak güven oluşturun. Mevcut müşterilerin <span className="font-bold text-green-600">%90'ı işletme anlaşmalarını yeniliyor</span>, müşteri referansları ile yeni iş fırsatları.
                  </p>
                </div>
              </div>

              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white">
                    <BarChart2 className="h-6 w-6" />
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Veri Odaklı Kararlar</h3>
                  <p className="mt-2 text-gray-600">
                    Detaylı analiz ve raporlar sayesinde daha iyi stratejik kararlar alın. Kullanıcılar gelecek santral yatırımlarında <span className="font-bold text-green-600">%22 daha isabetli bütçe planlaması</span> yapabildiğini belirtiyor.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 text-center">
            <div className="inline-block p-4 bg-white rounded-lg shadow-md">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Yatırım Geri Dönüşü</h3>
              <p className="text-gray-600">
                SolarVeyo'nun sunduğu avantajlar sayesinde, ortalama bir GES için
                <span className="font-bold text-green-600"> 4-8 ay içinde</span> yatırımınızı geri kazanırsınız.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium text-sm mb-4">
              MÜŞTERİ YORUMLARI
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Kullanıcılarımız Ne Diyor?
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Türkiye'nin önde gelen güneş enerjisi şirketleri SolarVeyo'yu tercih ediyor
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-100">
              <div className="flex items-center mb-6">
                <img src="https://randomuser.me/api/portraits/men/32.jpg" className="w-12 h-12 rounded-full mr-4" alt="Testimonial" />
                <div>
                  <h4 className="font-bold text-gray-900">Ahmet Yılmaz</h4>
                  <p className="text-sm text-gray-500">Teknik Direktör, ABC Enerji</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                "SolarVeyo'yu kullanmaya başladıktan sonra arıza tespit süremiz 4 saatten 20 dakikaya indi. Teknik ekibimizin verimliliği arttı ve santrallerimizin üretim performansında %12 artış sağladık."
              </p>
              <div className="flex text-yellow-400">
                <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-100">
              <div className="flex items-center mb-6">
                <img src="https://randomuser.me/api/portraits/women/44.jpg" className="w-12 h-12 rounded-full mr-4" alt="Testimonial" />
                <div>
                  <h4 className="font-bold text-gray-900">Zeynep Demir</h4>
                  <p className="text-sm text-gray-500">CEO, XYZ Solar</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                "12 farklı ildeki 35 santralimizi tek bir platformdan yönetebiliyoruz. Raporlama özelliği sayesinde yatırımcılarımıza detaylı performans analizleri sunabiliyoruz. Kullanıcı dostu arayüzü ile herkes kolayca adapte oldu."
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
                  <p className="text-sm text-gray-500">İşletme Müdürü, Kaya Enerji</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                "Bakım maliyetlerimiz %28 azaldı, çünkü artık sorunları erkenden tespit edip büyümeden müdahale edebiliyoruz. Stok yönetimi sayesinde gereksiz malzeme alımlarını önlüyoruz. İlk yılda yatırımımızı 5 kat geri kazandık."
              </p>
              <div className="flex text-yellow-400">
                <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
              </div>
            </div>
          </div>

          <div className="mt-16 flex justify-center">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12 items-center">
              <img src="/edeon-logo.png" alt="Edeon Logo" className="h-10 opacity-70 hover:opacity-100 transition-opacity" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/Logo_INDITEX.svg" alt="Client Logo" className="h-8 opacity-70 hover:opacity-100 transition-opacity" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" alt="Client Logo" className="h-8 opacity-70 hover:opacity-100 transition-opacity" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg" alt="Client Logo" className="h-8 opacity-70 hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium text-sm mb-4">
              FİYATLANDIRMA
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              İhtiyacınıza Uygun Paketler
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Her ölçekteki güneş enerjisi yatırımı için uygun çözümler
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-1">Başlangıç</h3>
                <p className="text-gray-500 mb-4">Küçük GES'ler için</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">₺1.990</span>
                  <span className="text-gray-500 ml-2">/ay</span>
                </div>
                <p className="text-sm text-gray-500 mb-6">5 MW'a kadar santral kapasitesi</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Temel arıza takibi</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Günlük üretim raporları</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">5 kullanıcı hesabı</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">E-posta desteği</span>
                </li>
              </ul>
              
              <div className="text-center">
                <Link
                  to="/register"
                  className="w-full inline-block px-4 py-3 border border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-all duration-300"
                >
                  14 Gün Ücretsiz Deneyin
                </Link>
              </div>
            </div>

            <div className="bg-gradient-to-b from-blue-50 to-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-blue-500 transform scale-105">
              <div className="absolute -top-4 left-0 right-0 flex justify-center">
                <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">En Popüler</span>
              </div>
              <div className="text-center mt-2">
                <h3 className="text-xl font-bold text-gray-900 mb-1">Profesyonel</h3>
                <p className="text-gray-500 mb-4">Orta ölçekli GES'ler için</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">₺4.990</span>
                  <span className="text-gray-500 ml-2">/ay</span>
                </div>
                <p className="text-sm text-gray-500 mb-6">20 MW'a kadar santral kapasitesi</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Gelişmiş arıza yönetimi</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Detaylı analiz ve raporlar</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">İnvertör kontrol modülü</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">20 kullanıcı hesabı</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">7/24 telefon ve e-posta desteği</span>
                </li>
              </ul>
              
              <div className="text-center">
                <Link
                  to="/register"
                  className="w-full inline-block px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all duration-300"
                >
                  14 Gün Ücretsiz Deneyin
                </Link>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-1">Kurumsal</h3>
                <p className="text-gray-500 mb-4">Büyük ölçekli GES'ler için</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">₺9.990</span>
                  <span className="text-gray-500 ml-2">/ay</span>
                </div>
                <p className="text-sm text-gray-500 mb-6">Sınırsız santral kapasitesi</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">AI destekli öngörü ve analiz</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Özel API entegrasyonları</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Sınırsız kullanıcı</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Özel eğitim ve danışmanlık</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Öncelikli 7/24 destek</span>
                </li>
              </ul>
              
              <div className="text-center">
                <Link
                  to="/register"
                  className="w-full inline-block px-4 py-3 border border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-all duration-300"
                >
                  Özel Teklif Alın
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-10 text-center">
            <p className="text-gray-500">
              Tüm paketlerde ilk 14 gün ücretsiz deneme. Kredi kartı gerekmez. İstediğiniz zaman iptal edebilirsiniz.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">GES Yönetiminizi Dijitalleştirmeye Hazır mısınız?</h2>
          <p className="text-xl text-white/90 mb-10 max-w-3xl mx-auto">
            SolarVeyo ile güneş enerjisi santrallerinizin verimliliğini artırın, arızaları azaltın ve gelirlerinizi maksimize edin.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/register"
              className="px-8 py-4 bg-white text-blue-700 font-medium rounded-lg shadow-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-105"
            >
              14 Gün Ücretsiz Deneyin
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 bg-transparent border-2 border-white text-white font-medium rounded-lg hover:bg-white/10 transition-all duration-300 transform hover:scale-105"
            >
              Demo İçin Giriş Yapın
            </Link>
          </div>
          <p className="mt-6 text-sm text-white/70">Kredi kartı bilgisi gerekmez. İstediğiniz zaman iptal edebilirsiniz.</p>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium text-sm mb-4">
              İLETİŞİM
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Sorularınız mı var?
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Ekibimiz size yardımcı olmak için hazır. İstediğiniz kanaldan bize ulaşabilirsiniz.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-center text-center">
              <div className="p-4 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Phone className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Bizi Arayın</h3>
              <p className="text-gray-600 mb-4">
                Satış ve teknik destek ekibimiz sorularınızı yanıtlamak için hazır.
              </p>
              <a href="tel:+902121234567" className="text-blue-600 font-bold hover:text-blue-800 transition-colors">
                +90 (212) 123 45 67
              </a>
            </div>

            <div className="bg-gray-50 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-center text-center">
              <div className="p-4 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">E-posta Gönderin</h3>
              <p className="text-gray-600 mb-4">
                E-posta ile iletişime geçin, en kısa sürede dönüş yapalım.
              </p>
              <a href="mailto:info@solarveyo.com" className="text-blue-600 font-bold hover:text-blue-800 transition-colors">
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
                <img src="/solarveyo-logo.png" alt="SolarVeyo Logo" className="h-8 w-8 mr-3" />
                <h3 className="text-xl font-bold">SolarVeyo</h3>
              </div>
              <p className="text-gray-400 mb-6">
                Güneş enerjisi santrallerinizi 7/24 izleyin, arıza durumlarında anında müdahale edin, veriminizi artırın.
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
                <li><button onClick={() => scrollToSection('testimonials')} className="text-gray-400 hover:text-white transition-colors">Referanslar</button></li>
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

      {/* Back to top button */}
      {scrolled && (
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
          className="fixed bottom-6 right-6 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 z-40"
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
