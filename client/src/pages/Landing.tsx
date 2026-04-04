import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">FloorPlan AI</span>
            </div>
            <div className="flex gap-4">
              <Link
                to="/login"
                className="px-4 py-2 text-gray-700 hover:text-blue-600 transition-colors"
              >
                Kirish
              </Link>
              <Link
                to="/signup"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ro'yxatdan o'tish
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Sun'iy intellekt bilan
            <span className="text-blue-600"> xona rejalarini</span> yarating
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Oddiy tavsif yozing, AI sizga professional xona rejasini bir necha soniyada yaratib beradi. 
            DXF va PDF formatda yuklab oling.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
            >
              Bepul boshlash
            </Link>
            <Link
              to="/generator"
              className="px-8 py-4 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-lg font-semibold"
            >
              Demo ko'rish
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          Nima uchun FloorPlan AI?
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold mb-2">AI yordamida</h3>
            <p className="text-gray-600">
              Oddiy tavsif yozing, AI avtomatik ravishda professional reja yaratadi
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-semibold mb-2">Tez va oson</h3>
            <p className="text-gray-600">
              Bir necha soniyada tayyor chizma. Hech qanday maxsus bilim kerak emas
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-4xl mb-4">📥</div>
            <h3 className="text-xl font-semibold mb-2">Professional format</h3>
            <p className="text-gray-600">
              DXF va PDF formatda yuklab oling. AutoCAD bilan ishlashga tayyor
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Qanday ishlaydi?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Tavsif yozing</h3>
              <p className="text-gray-600">
                "3x4 metr hammom, shimolda lavabo, janubda eshik"
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">AI yaratadi</h3>
              <p className="text-gray-600">
                Sun'iy intellekt avtomatik ravishda chizma yaratadi
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Yuklab oling</h3>
              <p className="text-gray-600">
                DXF yoki PDF formatda yuklab oling va ishlating
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-blue-600 rounded-2xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">
            Bugun boshlab ko'ring
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Birinchi 3 ta reja bepul!
          </p>
          <Link
            to="/signup"
            className="inline-block px-8 py-4 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition-colors text-lg font-semibold"
          >
            Ro'yxatdan o'tish
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            © 2024 FloorPlan AI. Barcha huquqlar himoyalangan.
          </p>
        </div>
      </footer>
    </div>
  );
}
