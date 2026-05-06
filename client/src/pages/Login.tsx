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
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Barcha maydonlarni to'ldiring"); return; }
    try {
      setLoading(true);
      setError('');
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      if (data.session) navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kirish xatosi';
      setError(msg === 'Invalid login credentials' ? "Email yoki parol noto'g'ri" : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080810] text-white flex overflow-hidden">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">
        {/* Animated grid background */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,120,50,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,120,50,0.06) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-600/15 rounded-full blur-[100px]" />

        {/* Logo */}
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-xl shadow-lg shadow-orange-500/30">
              🏗️
            </div>
            <span className="text-xl font-semibold tracking-tight">Multibuild AI</span>
          </Link>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-light leading-snug text-white/90" style={{ letterSpacing: '-0.02em' }}>
              Professional muhandislik<br />chizmalari — AI bilan
            </h2>
            <p className="mt-3 text-sm text-white/40 leading-relaxed max-w-sm">
              Issiq pol, suv ta'minoti, elektr, fasad va boshqa 11 ta tizim. SNiP standartlarida, soniyalarda.
            </p>
          </div>

          {/* Module chips */}
          <div className="flex flex-wrap gap-2">
            {['♨️ Issiq pol','💧 Suv ta\'minoti','🚽 Kanalizatsiya','⚡ Elektr','🏛️ Fasad','🔥 Qozonxona'].map(m => (
              <span key={m} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom stat */}
        <div className="relative z-10 flex gap-8">
          {[{ n: '11', l: 'Muhandislik moduli' }, { n: '< 3s', l: 'Generatsiya' }, { n: 'SNiP', l: 'Standart' }].map(s => (
            <div key={s.l}>
              <div className="text-xl font-semibold text-white/80">{s.n}</div>
              <div className="text-xs text-white/30 mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
        {/* Subtle bg */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d0d1a] to-[#080810]" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/5 rounded-full blur-[100px]" />

        <div className="relative z-10 w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-lg">
              🏗️
            </div>
            <span className="text-lg font-semibold">Multibuild AI</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-white" style={{ letterSpacing: '-0.02em' }}>Tizimga kirish</h1>
            <p className="mt-1.5 text-sm text-white/40">Hisobingizga kiring va ishlashni davom eting</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">Email</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 text-sm">✉</span>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  autoComplete="email" disabled={loading}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-3
                             text-sm text-white placeholder-white/20
                             focus:outline-none focus:border-orange-500/60 focus:bg-white/[0.06]
                             transition-all duration-200 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">Parol</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 text-sm">🔒</span>
                <input
                  type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password" disabled={loading}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-10 py-3
                             text-sm text-white placeholder-white/20
                             focus:outline-none focus:border-orange-500/60 focus:bg-white/[0.06]
                             transition-all duration-200 disabled:opacity-50"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors text-xs">
                  {showPass ? 'yashir' : 'ko\'r'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <span className="text-red-400 text-base">⚠</span>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="relative w-full py-3 rounded-xl text-sm font-semibold overflow-hidden
                         bg-gradient-to-r from-orange-600 to-red-600
                         hover:from-orange-500 hover:to-red-500
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-200 shadow-lg shadow-orange-500/20
                         active:scale-[0.99] mt-2">
              <span className="relative z-10">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Kirish...
                  </span>
                ) : 'Kirish →'}
              </span>
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-xs text-white/25">yoki</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          <p className="text-center text-sm text-white/35">
            Hisobingiz yo'qmi?{' '}
            <Link to="/signup" className="text-orange-400 hover:text-orange-300 font-medium transition-colors">
              Ro'yxatdan o'ting
            </Link>
          </p>

          <div className="mt-4 text-center">
            <Link to="/" className="text-xs text-white/20 hover:text-white/50 transition-colors">
              ← Bosh sahifaga qaytish
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
