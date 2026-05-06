import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

const SUPER_TYPES = [
  {
    id: 'warm-floor', icon: '♨️', label: 'Issiq pol',
    desc: 'PEX konturlar, kollektorlar, isitish yuklari — GOST 21.601',
    color: 'from-orange-500/20 to-red-500/10', border: 'border-orange-500/20',
    glow: 'shadow-orange-500/10', accent: 'text-orange-400',
  },
  {
    id: 'water-supply', icon: '💧', label: "Suv ta'minoti",
    desc: 'В1/Т3/Т4 quvurlar, boyler, stoyaklar, spetsifikatsiya',
    color: 'from-blue-500/20 to-sky-500/10', border: 'border-blue-500/20',
    glow: 'shadow-blue-500/10', accent: 'text-blue-400',
  },
  {
    id: 'sewage', icon: '🚽', label: 'Kanalizatsiya',
    desc: 'К1 stoyaklar ø110, tarmoqlar ø50/ø110, reviziyalar',
    color: 'from-amber-500/20 to-yellow-500/10', border: 'border-amber-500/20',
    glow: 'shadow-amber-500/10', accent: 'text-amber-400',
  },
  {
    id: 'storm-drain', icon: '🌧️', label: "Yomg'ir suvi",
    desc: 'Tom traplari ø110/ø160, magistral i=1%, oqim hisobi',
    color: 'from-sky-500/20 to-cyan-500/10', border: 'border-sky-500/20',
    glow: 'shadow-sky-500/10', accent: 'text-sky-400',
  },
  {
    id: 'boiler-room', icon: '🔥', label: 'Qozonxona',
    desc: 'Issiqlik nasosi, ET 1000 boiler, CMBE nasos, filtrlar',
    color: 'from-red-500/20 to-rose-500/10', border: 'border-red-500/20',
    glow: 'shadow-red-500/10', accent: 'text-red-400',
  },
  {
    id: 'facade', icon: '🏛️', label: 'Fasad',
    desc: 'Villa, kottej, ko\'p qavatli — 2D elevatsiya + 3D exterior',
    color: 'from-violet-500/20 to-purple-500/10', border: 'border-violet-500/20',
    glow: 'shadow-violet-500/10', accent: 'text-violet-400',
    wide: true,
  },
];

const SIMPLE_TYPES = [
  { icon: '📐', label: 'Xona rejasi', desc: 'Floor plan — devorlar, eshiklar, jihozlar' },
  { icon: '🔧', label: 'Santexnika', desc: 'Suv ta\'minoti aksonometriyasi' },
  { icon: '⚡', label: 'Elektr', desc: 'Rozetkalar, kalitlar, щit' },
  { icon: '🏗️', label: 'Arxitektura', desc: 'Fasad va kesimlar' },
  { icon: '🛋️', label: 'Interer', desc: 'Mebel joylashuvi va ranglar' },
];

export default function DrawingSelect() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[400px] bg-orange-600/6 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[300px] bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#080810]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center gap-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group">
            <span className="text-lg group-hover:-translate-x-0.5 transition-transform">←</span>
            <span className="text-sm">Dashboard</span>
          </Link>
          <span className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-xs">
              🏗️
            </div>
            <span className="text-sm font-medium text-white/70">Yangi loyiha</span>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-10 space-y-14">

        {/* ── MEGA BUILDER ─────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400/70 px-2 py-0.5 rounded-full border border-orange-500/20 bg-orange-500/10">
              Tavsiya etiladi
            </span>
          </div>

          <div
            onClick={() => navigate('/mega')}
            className="group cursor-pointer relative rounded-2xl border border-orange-500/25
                       bg-gradient-to-br from-orange-950/50 via-[#0d0a08] to-[#080810]
                       hover:border-orange-500/50 hover:from-orange-950/70
                       transition-all duration-300 p-7 overflow-hidden
                       shadow-xl shadow-orange-500/5 hover:shadow-orange-500/15">

            {/* Animated glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-orange-600/5 via-transparent to-red-600/5
                            opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,120,50,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,120,50,0.08) 1px, transparent 1px)',
                backgroundSize: '30px 30px',
              }} />

            <div className="relative z-10 flex items-start gap-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600
                              flex items-center justify-center text-3xl shadow-2xl shadow-orange-500/40
                              group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                🏗️
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold text-white">Mega Builder</h2>
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30
                                   text-orange-300 text-[10px] font-bold uppercase tracking-wider">
                    YANGI ✦
                  </span>
                </div>
                <p className="text-sm text-white/45 leading-relaxed mb-4 max-w-2xl">
                  AI bilan barcha muhandislik sohalarini birga rejalashtiring. Bir tavsifdan — barcha tizimlar parallel generatsiya qilinadi.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {['📐 Xona rejasi', '💧 Suv', '🚽 Kanalizatsiya', '♨️ Issiq pol', '🔥 Qozonxona', '⚡ Elektr', '🏛️ Fasad', '🌧️ Yomg\'ir'].map(t => (
                    <span key={t} className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08]
                                             text-white/40 text-[11px] hover:text-white/60 transition-colors">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 flex flex-col items-center gap-1.5 text-orange-400
                              group-hover:text-orange-300 transition-colors self-center">
                <div className="w-10 h-10 rounded-full border border-orange-500/30 bg-orange-500/10
                                flex items-center justify-center group-hover:border-orange-500/60
                                group-hover:bg-orange-500/20 transition-all">
                  <span className="text-lg group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
                <span className="text-xs font-medium">Boshlash</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── SUPER DRAWINGS ───────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20
                            border border-white/10 flex items-center justify-center text-sm">⚡</div>
            <div>
              <h2 className="text-base font-semibold text-white">Super Generatsiya</h2>
              <p className="text-xs text-white/30">Alohida professional muhandislik chizmalari</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SUPER_TYPES.map(type => (
              <div
                key={type.id}
                onClick={() => navigate(`/super/${type.id}`)}
                className={`group cursor-pointer relative rounded-2xl border ${type.border}
                            bg-gradient-to-br ${type.color}
                            hover:border-opacity-60 transition-all duration-300
                            p-5 flex flex-col gap-3
                            shadow-lg ${type.glow} hover:shadow-xl
                            hover:-translate-y-0.5
                            ${'wide' in type && type.wide ? 'sm:col-span-2 lg:col-span-3' : ''}
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="text-2xl">{type.icon}</div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${type.accent} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    Ochish →
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm mb-1">{type.label}</h3>
                  <p className="text-xs text-white/35 leading-relaxed">{type.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SIMPLE DRAWING ───────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-sm">📋</div>
            <div>
              <h2 className="text-base font-semibold text-white">Oddiy Generatsiya</h2>
              <p className="text-xs text-white/30">Matndan tez floor plan yaratish</p>
            </div>
          </div>

          <div
            onClick={() => navigate('/generator')}
            className="group cursor-pointer relative rounded-2xl border border-white/[0.08]
                       bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20
                       transition-all duration-300 p-5 overflow-hidden">

            <div className="flex items-center gap-4 flex-wrap">
              {SIMPLE_TYPES.map(t => (
                <div key={t.label}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]
                             hover:border-white/15 transition-colors">
                  <span className="text-xl">{t.icon}</span>
                  <div>
                    <div className="text-xs font-medium text-white/70">{t.label}</div>
                    <div className="text-[10px] text-white/25">{t.desc}</div>
                  </div>
                </div>
              ))}
              <div className="ml-auto flex items-center gap-2 text-white/30 group-hover:text-white/60 transition-colors">
                <span className="text-sm font-medium">Ochish</span>
                <span className="text-lg group-hover:translate-x-0.5 transition-transform">→</span>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
