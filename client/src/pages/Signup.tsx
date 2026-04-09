import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

export default function Signup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) { setError("Barcha maydonlarni to'ldiring"); return; }
    if (password !== confirmPassword) { setError("Parollar mos kelmaydi"); return; }
    if (password.length < 6) { setError("Parol kamida 6 ta belgidan iborat bo'lishi kerak"); return; }
    try {
      setLoading(true);
      setError('');
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      if (data.session) {
        navigate('/dashboard', { replace: true });
      } else if (data.user) {
        alert('Email manzilingizga tasdiqlash xati yuborildi.');
        navigate('/login');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ro'yxatdan o'tish xatosi";
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError("Bu email allaqachon ro'yxatdan o'tgan.");
      } else if (msg.includes('Password should be')) {
        setError("Parol kamida 6 ta belgi bo'lishi kerak");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4 overflow-hidden transition-colors duration-300">
      <div className="absolute inset-0 bg-mesh" />

      <div className="relative z-10 glass-card rounded-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">FloorPlan AI</Link>
          <h2 className="text-xl font-light text-gray-900 dark:text-white mt-3" style={{ letterSpacing: '-0.02em' }}>
            Ro'yxatdan o'tish
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Yangi hisob yarating va boshlang</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com" className="glass-input w-full px-4 py-3 rounded-xl text-sm"
              disabled={loading} autoComplete="email" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1.5">Parol</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" className="glass-input w-full px-4 py-3 rounded-xl text-sm"
              disabled={loading} autoComplete="new-password" />
            <p className="text-xs text-gray-400 mt-1">Kamida 6 ta belgi</p>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1.5">Parolni tasdiqlang</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="••••••••" className="glass-input w-full px-4 py-3 rounded-xl text-sm"
              disabled={loading} autoComplete="new-password" />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-gray-900 dark:bg-white text-white dark:text-black py-3 rounded-xl text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2">
            {loading ? 'Yuklanmoqda...' : "Ro'yxatdan o'tish"}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Hisobingiz bormi?{' '}
            <Link to="/login" className="text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-200 font-medium transition-colors">Kirish</Link>
          </p>
          <Link to="/" className="block text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs transition-colors">
            ← Bosh sahifaga qaytish
          </Link>
        </div>
      </div>
    </div>
  );
}
