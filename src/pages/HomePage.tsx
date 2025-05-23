
import React from 'react';
import { Link } from 'react-router-dom';
import { Sun, Shield, Zap, CheckCircle, ArrowRight } from 'lucide-react';

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <header className="bg-gradient-to-r from-primary-600 to-primary-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="md:w-1/2 text-white mb-10 md:mb-0">
              <div className="flex items-center mb-6">
                <Sun className="h-10 w-10 text-white mr-3" />
                <h1 className="text-3xl font-bold">EDEON ENERJİ</h1>
              </div>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
                Solar Panel Arıza Takip Sistemi
              </h2>
              <p className="text-xl text-white/80 mb-8 max-w-2xl">
                Güneş enerjisi santrallerinizi 7/24 izleyin, arıza durumlarında anında müdahale edin ve enerji üretiminizi maksimuma çıkarın.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/login"
                  className="px-6 py-3 bg-white text-primary-700 font-medium rounded-lg shadow-lg hover:bg-gray-100 transition-all duration-300 flex items-center"
                >
                  Giriş Yap
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  to="/register"
                  className="px-6 py-3 bg-transparent border-2 border-white text-white font-medium rounded-lg hover:bg-white/10 transition-all duration-300"
                >
                  Kayıt Ol
                </Link>
              </div>
            </div>
            <div className="md:w-1/2 flex justify-center">
              <img
                src="/solar-logo.png"
                alt="Solar Panel"
                className="w-80 h-auto object-contain drop-shadow-xl animate-float"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Öne Çıkan Özellikler</h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Solar Takip sistemi ile güneş enerjisi santrallerinizi daha verimli yönetin.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
              <div className="p-3 bg-primary-100 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Arıza Takibi</h3>
              <p className="text-gray-600">
                Arızaları anında tespit edin, müdahale sürecinizi hızlandırın ve üretim kayıplarını minimize edin.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
              <div className="p-3 bg-green-100 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <Sun className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Üretim Analizi</h3>
              <p className="text-gray-600">
                Detaylı üretim grafikleri ve raporlar ile santrallerinizin performansını güncel olarak takip edin.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
              <div className="p-3 bg-amber-100 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Bakım Yönetimi</h3>
              <p className="text-gray-600">
                Planlı bakım süreçlerinizi yönetin, mekanik ve elektrik bakımlarını zamanında gerçekleştirin.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Neden Biz</h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Solar enerji sistemlerinizi profesyonel olarak takip etmenin avantajları
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
              <div className="flex items-center mb-4">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <h3 className="font-bold text-gray-900">Kesintisiz İzleme</h3>
              </div>
              <p className="text-gray-600">
                7/24 kesintisiz izleme ile sistemlerinizi sürekli kontrol altında tutun.
              </p>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
              <div className="flex items-center mb-4">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <h3 className="font-bold text-gray-900">Hızlı Müdahale</h3>
              </div>
              <p className="text-gray-600">
                Arıza durumlarında anlık bildirimler alın ve hızla müdahale edin.
              </p>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
              <div className="flex items-center mb-4">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <h3 className="font-bold text-gray-900">Detaylı Raporlama</h3>
              </div>
              <p className="text-gray-600">
                Kapsamlı raporlar ile sistemlerinizin performansını detaylı olarak analiz edin.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-primary-500 to-primary-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Hemen Başlayın</h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Solar Panel Arıza Takip Sistemimiz ile güneş enerjisi yatırımlarınızı daha verimli hale getirin.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/login"
              className="px-8 py-3 bg-white text-primary-700 font-medium rounded-lg shadow-lg hover:bg-gray-100 transition-all duration-300"
            >
              Giriş Yap
            </Link>
            <Link
              to="/register"
              className="px-8 py-3 bg-transparent border-2 border-white text-white font-medium rounded-lg hover:bg-white/10 transition-all duration-300"
            >
              Kayıt Ol
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-6 md:mb-0">
              <Sun className="h-8 w-8 text-white mr-3" />
              <h3 className="text-xl font-bold">EDEON ENERJİ</h3>
            </div>
            <div className="text-gray-400 text-sm">
              © {new Date().getFullYear()} EDEON ENERJİ - Solar Panel Arıza Takip Sistemi. Tüm hakları saklıdır.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
