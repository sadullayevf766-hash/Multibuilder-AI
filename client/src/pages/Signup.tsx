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
  const [showPass, setShowPass] = useState(false);

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

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColor = ['', 'bg-red-500', 'bg-yellow-500', 'bg-emerald-500'][strength];
  const strengthLabel = ['', 'Zaif', "O'rtacha", 'Kuchli'][strength];

  return (
    <div className="min-h-screen bg-[#080810] text-white flex overflow-hidden">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,120,50,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,120,50,0.06) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-orange-600/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-violet-600/10 rounded-full blur-[100px]" />

        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-xl shadow-lg shadow-orange-500/30">
              🏗️
            </div>
            <span className="text-xl font-semibold tracking-tight">Multibuild AI</span>
          </Link>
        </div>

        <div className="relative z-10">
          <div className="text-4xl mb-6">🚀</div>
          <h2 className="text-3xl font-light leading-snug text-white/90" style={{ letterSpacing: '-0.02em' }}>
            Loyihangizni bugun<br />boshlang
          </h2>
          <p className="mt-3 text-sm text-white/40 leading-relaxed max-w-sm">
            Bepul ro'yxatdan o'ting va darhol professional muhandislik chizmalarini yaratishni boshlang.
          </p>

          <div className="mt-8 space-y-3">
            {[
              { icon: '✓', text: 'Bepul hisob — kredit karta kerak emas' },
              { icon: '✓', text: '11 ta professional muhandislik moduli' },
              { icon: '✓', text: 'Chizmalarni saqlash va eksport qilish' },
              { icon: '✓', text: "O'zbek, Rus, Ingliz tillarida" },
            ].map(f => (
              <div key={f.text} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs flex-shrink-0">
                  {f.icon}
                </span>
                <span className="text-sm text-white/50">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-white/20">
          © 2025 Multibuild AI
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d0d1a] to-[#080810]" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-500/5 rounded-full blur-[100px]" />

        <div className="relative z-10 w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-lg">🏗️</div>
            <span className="text-lg font-semibold">Multibuild AI</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-white" style={{ letterSpacing: '-0.02em' }}>Hisob yaratish</h1>
            <p className="mt-1.5 text-sm text-white/40">Bepul ro'yxatdan o'ting va boshlang</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">Email</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 text-sm">✉</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com" autoComplete="email" disabled={loading}
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
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Kamida 6 ta belgi" autoComplete="new-password" disabled={loading}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-10 py-3
                             text-sm text-white placeholder-white/20
                             focus:outline-none focus:border-orange-500/60 focus:bg-white/[0.06]
                             transition-all duration-200 disabled:opacity-50"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors text-xs">
                  {showPass ? 'yashir' : "ko'r"}
                </button>
              </div>
              {/* Strength bar */}
              {password.length > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex gap-1 flex-1">
                    {[1,2,3].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= strength ? strengthColor : 'bg-white/10'}`} />
                    ))}
                  </div>
                  <span className={`text-[11px] font-medium transition-colors ${strength === 3 ? 'text-emerald-400' : strength === 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {strengthLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">Parolni tasdiqlang</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 text-sm">🔒</span>
                <input type={showPass ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="new-password" disabled={loading}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-3
                             text-sm text-white placeholder-white/20
                             focus:outline-none focus:border-orange-500/60 focus:bg-white/[0.06]
                             transition-all duration-200 disabled:opacity-50"
                />
                {confirmPassword && (
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm ${confirmPassword === password ? 'text-emerald-400' : 'text-red-400'}`}>
                    {confirmPassword === password ? '✓' : '✗'}
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <span className="text-red-400 text-base">⚠</span>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="relative w-full py-3 rounded-xl text-sm font-semibold overflow-hidden
                         bg-gradient-to-r from-orange-600 to-red-600
                         hover:from-orange-500 hover:to-red-500
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-200 shadow-lg shadow-orange-500/20
                         active:scale-[0.99] mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Yaratilmoqda...
                </span>
              ) : "Hisob yaratish →"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-xs text-white/25">yoki</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          <p className="text-center text-sm text-white/35">
            Hisobingiz bormi?{' '}
            <Link to="/login" className="text-orange-400 hover:text-orange-300 font-medium transition-colors">
              Kirish
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
