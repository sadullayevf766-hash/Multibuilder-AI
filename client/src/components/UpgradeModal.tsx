import { Link } from 'react-router-dom';

interface Props {
  open:      boolean;
  onClose:   () => void;
  reason?:   string;       // 'INSUFFICIENT_CREDITS' | 'PLAN_LIMIT_DXF' | ...
  required?: number;
  available?: number;
}

const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    price: '$12.99',
    period: '/oy',
    credits: '500 credit/oy',
    color: 'from-orange-500 to-red-500',
    features: [
      'Oyiga 500 credit (~33 modul)',
      'Barcha 11 modul cheksiz',
      'DXF eksport (AutoCAD)',
      'Watermark yo\'q',
      'Cheksiz loyiha saqlash',
    ],
    cta: 'Pro ga o\'tish →',
    highlight: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '$29.99',
    period: '/oy',
    credits: '2000 credit/oy',
    color: 'from-violet-500 to-purple-600',
    features: [
      'Oyiga 2000 credit (~133 modul)',
      'API access',
      '5 ta jamoa a\'zosi',
      'Priority support',
      'Hamma Pro imkoniyatlar',
    ],
    cta: 'Business ga o\'tish →',
    highlight: false,
  },
];

export default function UpgradeModal({ open, onClose, reason, required, available }: Props) {
  if (!open) return null;

  const isDxfLimit = reason === 'PLAN_LIMIT_DXF';
  const isCredits  = reason === 'INSUFFICIENT_CREDITS' || !reason;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl bg-[#0d0d1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-white/8">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/5" />
          <button onClick={onClose}
            className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors text-xl">
            ✕
          </button>
          <div className="relative">
            <div className="text-2xl mb-2">
              {isDxfLimit ? '📐' : '⚡'}
            </div>
            <h2 className="text-xl font-semibold text-white">
              {isDxfLimit
                ? "DXF eksport — Pro plan kerak"
                : "Credit tugadi — loyihani davom ettiring"}
            </h2>
            <p className="text-sm text-white/50 mt-1">
              {isDxfLimit
                ? "DXF (AutoCAD) formatida eksport qilish uchun Pro yoki Business planga o'ting"
                : isCredits
                  ? `Sizda ${available ?? 0} ta credit qoldi, bu amal uchun ${required ?? '?'} ta kerak.`
                  : "Keyingi qadamda davom etish uchun planni yangilang"}
            </p>
          </div>
        </div>

        {/* Credit status */}
        {isCredits && available !== undefined && (
          <div className="px-6 py-3 bg-red-500/5 border-b border-white/8">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: `${Math.min(100, ((available ?? 0) / (required ?? 1)) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-red-400 font-medium whitespace-nowrap">
                {available} / {required} credit
              </span>
            </div>
          </div>
        )}

        {/* Plans */}
        <div className="p-6 grid sm:grid-cols-2 gap-4">
          {PLANS.map(plan => (
            <div key={plan.id}
              className={`relative rounded-xl border p-5 flex flex-col gap-4 transition-all
                ${plan.highlight
                  ? 'border-orange-500/40 bg-orange-500/5'
                  : 'border-white/10 bg-white/3'}`}>
              {plan.highlight && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold uppercase tracking-wider">
                    Tavsiya etiladi
                  </span>
                </div>
              )}

              <div>
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-gradient-to-r ${plan.color} mb-3`}>
                  <span className="text-white text-sm font-semibold">{plan.name}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-white">{plan.price}</span>
                  <span className="text-white/40 text-sm">{plan.period}</span>
                </div>
                <div className="text-xs text-white/40 mt-0.5">{plan.credits}</div>
              </div>

              <ul className="space-y-1.5 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-white/60">
                    <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link to="/pricing"
                onClick={onClose}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold text-center transition-all
                  ${plan.highlight
                    ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white shadow-lg shadow-orange-500/20'
                    : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'}`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Free reminder */}
        <div className="px-6 pb-6 text-center">
          <p className="text-xs text-white/25">
            Bepul planda haftasiga 30 credit — har dushanba yangilanadi.
            {' '}<button onClick={onClose} className="text-white/50 hover:text-white underline transition-colors">Davom ettirish</button>
          </p>
        </div>
      </div>
    </div>
  );
}
