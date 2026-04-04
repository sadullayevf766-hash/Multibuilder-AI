import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !confirmPassword) {
      setError('Barcha maydonlarni to\'ldiring');
      return;
    }

    if (password !== confirmPassword) {
      setError('Parollar mos kelmaydi');
      return;
    }

    if (password.length < 6) {
      setError('Parol kamida 6 ta belgidan iborat bo\'lishi kerak');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ro\'yxatdan o\'tish xatosi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-bold text-blue-600">
            FloorPlan AI
          </Link>
          <h2 className="text-2xl font-semibold text-gray-900 mt-4">
            Ro'yxatdan o'tish
          </h2>
          <p className="text-gray-600 mt-2">
            Yangi hisob yarating va boshlang
          </p>
        </div>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-green-800 font-semibold mb-2">
              Muvaffaqiyatli ro'yxatdan o'tdingiz!
            </p>
            <p className="text-green-700 text-sm">
              Dashboard ga yo'naltirilmoqda...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSignup} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parol
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Kamida 6 ta belgi
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parolni tasdiqlang
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm">❌ {error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {loading ? 'Yuklanmoqda...' : 'Ro\'yxatdan o\'tish'}
            </button>
          </form>
        )}

        {!success && (
          <>
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Hisobingiz bormi?{' '}
                <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                  Kirish
                </Link>
              </p>
            </div>

            <div className="mt-4 text-center">
              <Link to="/" className="text-gray-500 hover:text-gray-700 text-sm">
                ← Bosh sahifaga qaytish
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
