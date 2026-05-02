import { useNavigate } from 'react-router-dom';


const SIMPLE_TYPES = [
  { icon: '📐', label: 'Xona rejasi',       desc: 'Bir yoki ko\'p xonali floor plan' },
  { icon: '🔧', label: 'Santexnika sxemasi', desc: 'Suv ta\'minoti aksonometriyasi' },
  { icon: '⚡', label: 'Elektr chizma',      desc: 'Rozetkalar, kalitlar, щit' },
  { icon: '🏛️', label: 'Arxitektura',        desc: 'Fasad va kesimlar' },
  { icon: '🛋️', label: 'Interer dizayn',     desc: 'Mebel joylashuvi va ranglar' },
];

const SUPER_TYPES = [
  {
    id:    'warm-floor',
    icon:  '♨️',
    label: 'Issiq pol isitish tizimi',
    desc:  'PEX quvurlar, konturlar, kollektorlar, isitish yuklari — GOST 21.601 bo\'yicha',
    badge: 'YANGI',
    color: 'from-orange-600 to-red-600',
  },
  {
    id:    'storm-drain',
    icon:  '🌧️',
    label: 'Yomg\'ir suvi sxemasi',
    desc:  'Tom traplari ø110/ø160, magistral i=1%, oqim hisobi',
    badge: 'YANGI',
    color: 'from-sky-500 to-blue-700',
    disabled: false,
  },
  {
    id:    'hvac',
    icon:  '🌡️',
    label: 'Ventilyatsiya (ОВиК)',
    desc:  'Havo almashish, kanallar, diffuzorlar',
    badge: 'TEZDA',
    color: 'from-blue-600 to-cyan-600',
    disabled: true,
  },
  {
    id:    'water-supply',
    icon:  '💧',
    label: 'Suv ta\'minoti sxemasi',
    desc:  'В1/Т3/Т4 quvurlar, boyler, stoyaklar, spetsifikatsiya',
    badge: 'YANGI',
    color: 'from-sky-600 to-blue-600',
    disabled: false,
  },
  {
    id:    'sewage',
    icon:  '🚽',
    label: 'Kanalizatsiya sxemasi',
    desc:  'К1 stoyaklar ø110, tarmoqlar ø50/ø110, reviziyalar',
    badge: 'YANGI',
    color: 'from-amber-600 to-orange-600',
    disabled: false,
  },
  {
    id:    'boiler-room',
    icon:  '🔥',
    label: 'Qozonxona tizimi',
    desc:  'Issiqlik nasosi, ET 1000, AI 500 boiler, CMBE nasos, filtrlar, ALPHA2',
    badge: 'YANGI',
    color: 'from-red-700 to-rose-600',
    disabled: false,
  },
  {
    id:    'facade',
    icon:  '🏛️',
    label: 'Fasad (tashqi ko\'rinish)',
    desc:  'Villa, kottej, ko\'p qavatli bino — professional 2D elevatsiya + 3D exterior model',
    badge: 'YANGI',
    color: 'from-violet-600 to-purple-700',
    disabled: false,
    fullWidth: true,
  },
];

export default function DrawingSelect() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-white/10 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-1"
        >
          ← Orqaga
        </button>
        <span className="text-white/30">|</span>
        <span className="text-sm font-medium text-slate-300">Chizma turi tanlang</span>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-10 flex flex-col gap-12">

        {/* ── SIMPLE ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-base">📋</div>
            <div>
              <h2 className="text-lg font-semibold text-white">Simple Drawing</h2>
              <p className="text-xs text-slate-500">Tez generatsiya — AI matn → chizma</p>
            </div>
          </div>

          <div
            onClick={() => navigate('/generator')}
            className="group cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03]
                       hover:border-white/25 hover:bg-white/[0.06] transition-all duration-200 p-6
                       flex items-start gap-5"
          >
            <div className="flex gap-3 flex-wrap">
              {SIMPLE_TYPES.map(t => (
                <div key={t.label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700">
                  <span className="text-lg">{t.icon}</span>
                  <div>
                    <div className="text-xs font-medium text-white">{t.label}</div>
                    <div className="text-[10px] text-slate-500">{t.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="ml-auto shrink-0 flex items-center gap-2 text-slate-400 group-hover:text-white transition-colors">
              <span className="text-sm font-medium">Ochish</span>
              <span className="text-lg">→</span>
            </div>
          </div>
        </section>

        {/* ── MEGA BUILDER ────────────────────────────────────── */}
        <section>
          <div
            onClick={() => navigate('/mega')}
            className="group cursor-pointer rounded-2xl border border-orange-500/20 bg-gradient-to-br
                       from-orange-950/40 to-red-950/40 hover:border-orange-500/50
                       hover:from-orange-950/60 hover:to-red-950/60 transition-all duration-300 p-6
                       flex items-center gap-6 relative overflow-hidden"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-red-500/5
                            opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600
                            flex items-center justify-center text-3xl shadow-2xl shrink-0
                            group-hover:scale-110 transition-transform">
              🏗️
            </div>

            <div className="relative flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-white">Mega Builder</h2>
                <span className="px-2 py-0.5 rounded-full bg-orange-500/30 text-orange-300
                                 text-[10px] font-bold uppercase tracking-wide border border-orange-500/30">
                  YANGI ✨
                </span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-3">
                AI bilan barcha muhandislik sohalarini birga rejalashtiring va chizib oling.
                Arxitektura · Santexnika · Elektr · Qozonxona · va boshqalar — hammasini bir joyda.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['📐 Arxitektura', '💧 Suv ta\'min.', '🚽 Kanalizatsiya',
                  '♨️ Issiq pol', '🔥 Qozonxona', '⚡ Elektr', '🌧️ Yomg\'ir'].map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10
                                           text-slate-400 text-[10px]">{t}</span>
                ))}
              </div>
            </div>

            <div className="relative shrink-0 flex flex-col items-center gap-1
                            text-orange-400 group-hover:text-orange-300 transition-colors">
              <span className="text-2xl group-hover:translate-x-1 transition-transform">→</span>
              <span className="text-xs font-medium">Boshlash</span>
            </div>
          </div>
        </section>

        {/* ── SUPER ───────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-base">⚡</div>
            <div>
              <h2 className="text-lg font-semibold text-white">Super Drawing</h2>
              <p className="text-xs text-slate-500">Professional muhandislik chizmalari — AutoCAD sifatida</p>
            </div>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-wide">
              Professional
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SUPER_TYPES.map(type => (
              <div
                key={type.id}
                onClick={() => !type.disabled && navigate(`/super/${type.id}`)}
                className={`
                  relative rounded-2xl border p-6 flex flex-col gap-3 transition-all duration-200
                  ${'fullWidth' in type && type.fullWidth ? 'sm:col-span-2' : ''}
                  ${type.disabled
                    ? 'border-white/5 bg-white/[0.02] cursor-not-allowed opacity-50'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.06] cursor-pointer group'}
                `}
              >
                {/* Badge */}
                {type.badge && (
                  <span className={`absolute top-4 right-4 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide
                    ${type.disabled ? 'bg-slate-700 text-slate-400' : 'bg-orange-500/20 text-orange-400'}`}>
                    {type.badge}
                  </span>
                )}

                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center text-xl shadow-lg shrink-0`}>
                    {type.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-sm mb-1">{type.label}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{type.desc}</p>
                  </div>
                  {!type.disabled && 'fullWidth' in type && type.fullWidth && (
                    <div className="shrink-0 flex items-center gap-1 text-violet-400 text-xs font-medium self-center">
                      Ochish →
                    </div>
                  )}
                </div>

                {!type.disabled && !('fullWidth' in type && type.fullWidth) && (
                  <div className="mt-auto pt-2 flex items-center gap-1 text-orange-400 text-xs font-medium
                                  opacity-0 group-hover:opacity-100 transition-opacity">
                    Ochish →
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
