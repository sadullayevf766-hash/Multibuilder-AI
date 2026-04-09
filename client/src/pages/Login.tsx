import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

export default function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Barcha maydonlarni to\'ldiring'); return; }

    try {
      setLoading(true);
      setError('');
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      if (data.session) navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kirish xatosi';
      setError(msg === 'Invalid login credentials' ? 'Email yoki parol noto\'g\'ri' : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4 overflow-hidden transition-colors duration-300">
      <div className="absolute inset-0 bg-mesh" />

      {/* Card */}
      <div className="relative z-10 glass-card rounded-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            FloorPlan AI
          </Link>
          <h2 className="text-xl font-light text-gray-900 dark:text-white mt-3" style={{ letterSpacing: '-0.02em' }}>
            Tizimga kirish
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Hisobingizga kiring va davom eting</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="glass-input w-full px-4 py-3 rounded-xl text-sm"
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Parol</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="glass-input w-full px-4 py-3 rounded-xl text-sm"
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black py-3 rounded-xl text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {loading ? 'Yuklanmoqda...' : 'Kirish'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Hisobingiz yo'qmi?{' '}
            <Link to="/signup" className="text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-200 font-medium transition-colors">
              Ro'yxatdan o'ting
            </Link>
          </p>
          <Link to="/" className="block text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs transition-colors">
            ← Bosh sahifaga qaytish
          </Link>
        </div>
      </div>
    </div>
  );
}
