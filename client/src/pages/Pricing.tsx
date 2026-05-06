import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCredits } from '../hooks/useCredits';
import { supabase } from '../lib/supabase';
import { apiUrl } from '../lib/api';

const PLANS = [
  {
    id: 'free',
    name: 'Bepul',
    price: { monthly: 0, yearly: 0 },
    credits: '30 credit/hafta',
    badge: null,
    color: 'border-white/10',
    btnClass: 'bg-white/10 hover:bg-white/15 text-white border border-white/15',
    btnText: 'Hozir bepul boshlash',
    btnLink: '/signup',
    features: [
      { text: 'Haftasiga 30 credit', ok: true },
      { text: 'Super Generator (5 credit/modul)', ok: true },
      { text: 'Mega Builder (15 credit/build)', ok: true },
      { text: 'PDF eksport (2 credit)', ok: true },
      { text: 'DXF eksport', ok: false },
      { text: 'Faqat 2 ta loyiha saqlash', ok: true },
      { text: 'Mega Builder: 3 modul', ok: true },
      { text: 'PDF da watermark', ok: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { monthly: 12.99, yearly: 9.99 },
    credits: '500 credit/oy',
    badge: 'Ommabop',
    color: 'border-orange-500/50',
    btnClass: 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white shadow-lg shadow-orange-500/25',
    btnText: 'Pro ga o\'tish →',
    btnLink: '/signup',
    features: [
      { text: 'Oyiga 500 credit (~33 ta generatsiya)', ok: true },
      { text: 'Super Generator — barcha modullar', ok: true },
      { text: 'Mega Builder — barcha 11 modul', ok: true },
      { text: 'PDF + DXF eksport', ok: true },
      { text: 'Cheksiz loyiha saqlash', ok: true },
      { text: 'Watermark yo\'q', ok: true },
      { text: 'Mega Builder: 11 modul', ok: true },
      { text: 'Prioritet generatsiya', ok: true },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: { monthly: 29.99, yearly: 23.99 },
    credits: '2000 credit/oy',
    badge: 'Jamoa uchun',
    color: 'border-violet-500/40',
    btnClass: 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/20',
    btnText: 'Business ga o\'tish →',
    btnLink: '/signup',
    features: [
      { text: 'Oyiga 2000 credit (~133 ta generatsiya)', ok: true },
      { text: 'Pro dagi hamma imkoniyatlar', ok: true },
      { text: 'API access (boshqa tizimlarga ulanish)', ok: true },
      { text: '5 ta jamoa a\'zosi', ok: true },
      { text: 'Dedicated support', ok: true },
      { text: 'Korporativ hisob', ok: true },
      { text: 'SLA kafolat', ok: true },
      { text: 'Credit roll-over', ok: true },
    ],
  },
];

const CREDIT_TABLE = [
  { action: 'Super Generator (1 modul)', free: '5 credit', pro: '5 credit', biz: '5 credit' },
  { action: 'Super Generator (edit/prompt)', free: '2 credit', pro: '2 credit', biz: '2 credit' },
  { action: 'Mega Builder (barcha tanlangan modullar)', free: '15 credit', pro: '15 credit', biz: '15 credit' },
  { action: 'Mega edit (1 ta modul)', free: '3 credit', pro: '3 credit', biz: '3 credit' },
  { action: 'PDF eksport', free: '2 credit', pro: '2 credit', biz: '2 credit' },
  { action: 'DXF eksport (AutoCAD)', free: '—', pro: '3 credit', biz: '3 credit' },
  { action: 'Oddiy floor plan', free: '2 credit', pro: '2 credit', biz: '2 credit' },
];

const FAQ = [
  { q: 'Credit nima?', a: 'Credit — bu loyiha generatsiya qilish uchun sarflanadigan virtual valyuta. Bepul planda haftasiga 30 ta, Pro da oyiga 500 ta, Business da oyiga 2000 ta credit beriladi.' },
  { q: 'Credit tugab qolsa nima bo\'ladi?', a: 'Credit tugasa yangi generatsiya qilib bo\'lmaydi. Bepul planda haftasiga (har dushanba) 30 credit to\'ldiriladi. Yoki Pro planga o\'tib 500 credit olishingiz mumkin.' },
  { q: 'DXF nima va nega kerak?', a: 'DXF — AutoCAD va boshqa professional CAD dasturlari uchun standart format. Chizmachilarga tayyorlangan chizmani to\'g\'ridan-to\'g\'ri AutoCAD da ochib, tuzatishlar kiritish imkonini beradi.' },
  { q: 'Oylik yoki yillik to\'lov?', a: 'Yillik to\'lovda har oyga nisbatan 23% chegirma beriladi. To\'lovni istalgan vaqt bekor qilish mumkin.' },
  { q: 'Nima uchun Mega Builder 15 credit?', a: 'Mega Builder parallel ravishda 11 ta muhandislik modulini (issiq pol, suv, kanalizatsiya, elektr va h.k.) bir vaqtda generatsiya qiladi. Bu juda ko\'p resurs talab qiladi.' },
  { q: 'To\'lov usullari qaysilar?', a: 'Hozirda Stripe orqali xalqaro kartalar (Visa, Mastercard) qabul qilinadi. Tez orada Payme va Click ham qo\'shiladi.' },
];

export default function Pricing() {
  const [yearly, setYearly]     = useState(false);
  const [paying, setPaying]     = useState<string | null>(null);
  const [payError, setPayError] = useState('');
  const { profile } = useCredits();

  const handleCheckout = async (planId: 'pro' | 'business') => {
    setPayError('');
    setPaying(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/signup'; return; }

      const res = await fetch(apiUrl('/api/payments/checkout'), {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: planId, billing: yearly ? 'yearly' : 'monthly' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Xatolik');
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setPaying(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#080810]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-base">🏗️</div>
            <span className="font-semibold text-sm">Multibuild AI</span>
          </Link>
          <div className="flex items-center gap-3">
            {profile ? (
              <Link to="/dashboard" className="text-sm text-white/50 hover:text-white transition-colors">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-white/50 hover:text-white transition-colors">Kirish</Link>
                <Link to="/signup" className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors">
                  Bepul boshlash
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-block px-3 py-1 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-medium uppercase tracking-wider mb-4">
            Narxlar
          </div>
          <h1 className="text-4xl md:text-5xl font-light mb-4" style={{ letterSpacing: '-0.02em' }}>
            Oddiy va shaffof narxlar
          </h1>
          <p className="text-white/40 max-w-xl mx-auto text-base leading-relaxed">
            Bepul boshlang. Professional chizmalar tezlashtirganda — Pro ga o'ting.
            Bir necha kun yoki haftaga ketadigan chizmalar — bir soatda.
          </p>

          {/* Yearly toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <span className={`text-sm ${!yearly ? 'text-white' : 'text-white/40'}`}>Oylik</span>
            <button
              onClick={() => setYearly(v => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors ${yearly ? 'bg-orange-600' : 'bg-white/20'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${yearly ? 'left-7' : 'left-1'}`} />
            </button>
            <span className={`text-sm ${yearly ? 'text-white' : 'text-white/40'}`}>
              Yillik
              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">-23%</span>
            </span>
          </div>
        </div>

        {/* Payment error */}
        {payError && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-3 flex items-center gap-3 max-w-lg mx-auto">
            <span className="text-red-400">⚠</span>
            <p className="text-red-400 text-sm">{payError}</p>
            <button onClick={() => setPayError('')} className="ml-auto text-red-400/50 hover:text-red-400">✕</button>
          </div>
        )}

        {/* Pro/Business foydalanuvchi uchun portal tugmasi */}
        {profile && profile.plan_id !== 'free' && (
          <div className="mb-8 text-center">
            <button
              onClick={async () => {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;
                const res = await fetch(apiUrl('/api/payments/portal'), {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${session.access_token}` },
                });
                const d = await res.json();
                if (d.url) window.location.href = d.url;
              }}
              className="px-5 py-2.5 rounded-xl border border-white/15 text-sm text-white/60 hover:text-white hover:border-white/30 transition-all">
              ⚙️ Obunani boshqarish / bekor qilish
            </button>
          </div>
        )}

        {/* Plans grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {PLANS.map(plan => {
            const price = yearly ? plan.price.yearly : plan.price.monthly;
            const isCurrent = profile?.plan_id === plan.id;

            return (
              <div key={plan.id}
                className={`relative rounded-2xl border p-6 flex flex-col gap-5 transition-all
                  ${plan.id === 'pro' ? 'bg-gradient-to-b from-orange-500/5 to-transparent' : 'bg-white/[0.02]'}
                  ${plan.color}`}>

                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                      ${plan.id === 'pro' ? 'bg-orange-500 text-white' : 'bg-violet-500 text-white'}`}>
                      {plan.badge}
                    </span>
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-3 right-4">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium">
                      Hozirgi plan
                    </span>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-light text-white">
                      {price === 0 ? 'Bepul' : `$${price}`}
                    </span>
                    {price > 0 && <span className="text-white/40 text-sm">/oy</span>}
                  </div>
                  {price > 0 && yearly && (
                    <div className="text-xs text-white/30 mt-0.5">
                      Yillik: ${(price * 12).toFixed(0)} ({plan.price.monthly - price > 0 ? `$${((plan.price.monthly - price) * 12).toFixed(0)} tejash` : ''})
                    </div>
                  )}
                  <div className="mt-2 text-xs font-medium text-orange-400/80 bg-orange-500/10 border border-orange-500/20 rounded-lg px-2.5 py-1 inline-block">
                    ⚡ {plan.credits}
                  </div>
                </div>

                <ul className="space-y-2 flex-1">
                  {plan.features.map(f => (
                    <li key={f.text} className="flex items-start gap-2.5 text-sm">
                      <span className={`flex-shrink-0 mt-0.5 ${f.ok ? 'text-emerald-400' : 'text-white/20'}`}>
                        {f.ok ? '✓' : '✗'}
                      </span>
                      <span className={f.ok ? 'text-white/70' : 'text-white/25 line-through'}>{f.text}</span>
                    </li>
                  ))}
                </ul>

                {plan.id === 'free' || isCurrent ? (
                  <Link to={isCurrent ? '/dashboard' : plan.btnLink}
                    className={`w-full py-3 rounded-xl text-sm font-semibold text-center transition-all block ${plan.btnClass}`}>
                    {isCurrent ? '✓ Hozirgi plan' : plan.btnText}
                  </Link>
                ) : (
                  <button
                    onClick={() => handleCheckout(plan.id as 'pro' | 'business')}
                    disabled={paying === plan.id}
                    className={`w-full py-3 rounded-xl text-sm font-semibold text-center transition-all ${plan.btnClass} disabled:opacity-60`}>
                    {paying === plan.id
                      ? <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Yo'naltirilmoqda...
                        </span>
                      : plan.btnText}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Credit cost table */}
        <div className="mb-16">
          <h2 className="text-2xl font-light text-center mb-8" style={{ letterSpacing: '-0.02em' }}>
            Credit narxlari
          </h2>
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/3">
                  <th className="text-left px-5 py-3 text-white/50 font-medium">Amal</th>
                  <th className="text-center px-4 py-3 text-white/50 font-medium">Bepul</th>
                  <th className="text-center px-4 py-3 text-orange-400 font-medium">Pro</th>
                  <th className="text-center px-4 py-3 text-violet-400 font-medium">Business</th>
                </tr>
              </thead>
              <tbody>
                {CREDIT_TABLE.map((row, i) => (
                  <tr key={i} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}`}>
                    <td className="px-5 py-3 text-white/70">{row.action}</td>
                    <td className="px-4 py-3 text-center text-white/50">{row.free}</td>
                    <td className="px-4 py-3 text-center text-white/80">{row.pro}</td>
                    <td className="px-4 py-3 text-center text-white/80">{row.biz}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Use case highlight */}
        <div className="mb-16 bg-gradient-to-r from-orange-500/10 to-red-500/5 border border-orange-500/20 rounded-2xl p-8">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="text-5xl">⏱️</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">Chizmachi uchun vaqt tejash</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                Bir necha kun yoki haftada bajariladigan muhandislik chizmalarini <strong className="text-white">bir soatda</strong> yarating.
                AI chizmani tayyorlaydi — siz faqat tuzatishlar kiritasiz va tayyor loyihani topshirasiz.
              </p>
            </div>
            <div className="flex-shrink-0">
              <div className="grid grid-cols-2 gap-3 text-center">
                {[
                  { before: '3-7 kun', after: '1-2 soat', label: 'Muhandislik chizma' },
                  { before: '2-3 kun', after: '30 daqiqa', label: 'Mega Builder' },
                ].map(s => (
                  <div key={s.label} className="bg-black/30 rounded-xl p-3">
                    <div className="text-sm text-white/30 line-through mb-0.5">{s.before}</div>
                    <div className="text-lg font-bold text-emerald-400">{s.after}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-light text-center mb-8" style={{ letterSpacing: '-0.02em' }}>
            Ko'p so'raladigan savollar
          </h2>
          <div className="space-y-2">
            {FAQ.map((faq, i) => (
              <details key={i} className="group rounded-xl border border-white/10 bg-white/[0.02]">
                <summary className="px-5 py-4 cursor-pointer text-sm font-medium flex justify-between items-center list-none">
                  <span className="text-white/80">{faq.q}</span>
                  <span className="text-white/30 group-open:rotate-180 transition-transform ml-4 flex-shrink-0 text-xs">↓</span>
                </summary>
                <p className="px-5 pb-4 text-sm text-white/50 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <div className="inline-block bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-2xl p-8">
            <h2 className="text-2xl font-light mb-2">Bugun bepul boshlang</h2>
            <p className="text-white/40 text-sm mb-6">Haftasiga 30 credit — kredit karta kerak emas</p>
            <Link to="/signup"
              className="inline-block px-8 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-semibold text-sm transition-all shadow-lg shadow-orange-500/20">
              Bepul ro'yxatdan o'tish →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
