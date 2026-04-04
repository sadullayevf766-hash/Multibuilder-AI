import { Link } from 'react-router-dom';

function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
          FloorPlan Generator
        </h1>
        <p className="text-xl text-gray-700 mb-8">
          Sun'iy intellekt yordamida xona rejalarini yarating
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/generator"
            className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
          >
            Boshlash
          </Link>
          <Link
            to="/dashboard"
            className="px-8 py-4 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-lg font-semibold"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
