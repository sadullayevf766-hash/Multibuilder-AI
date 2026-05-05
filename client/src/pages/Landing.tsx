import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

function FadeIn({ children, delay = 0, duration = 800, className = "" }: {
  children: React.ReactNode; delay?: number; duration?: number; className?: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t); }, [delay]);
  return (
    <div className={`transition-opacity ${className}`} style={{ opacity: visible ? 1 : 0, transitionDuration: `${duration}ms` }}>
      {children}
    </div>
  );
}

function AnimatedHeading({ text, className = "", initialDelay = 200, charDelay = 25 }: {
  text: string; className?: string; initialDelay?: number; charDelay?: number;
}) {
  const [started, setStarted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setStarted(true), initialDelay); return () => clearTimeout(t); }, [initialDelay]);
  return (
    <h1 className={className}>
      {text.split("\n").map((line, li) => (
        <span key={li} className="block overflow-hidden">
          {line.split(" ").map((word, wi) => (
            <span key={wi} className="inline-block whitespace-nowrap mr-[0.28em]">
              {word.split("").map((char, ci) => (
                <span key={ci} className="inline-block transition-all" style={{
                  opacity: started ? 1 : 0,
                  transform: started ? "translateY(0)" : "translateY(32px)",
                  transitionDuration: "480ms",
                  transitionDelay: `${(li * 12 + wi * 6 + ci) * charDelay}ms`,
                }}>
                  {char}
                </span>
              ))}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}

const MODULES = [
  { icon: "♨️", label: "Issiq pol" },
  { icon: "💧", label: "Suv ta'minoti" },
  { icon: "🚽", label: "Kanalizatsiya" },
  { icon: "🌧️", label: "Yomg'ir suvi" },
  { icon: "🔥", label: "Qozonxona" },
  { icon: "🏛️", label: "Fasad" },
  { icon: "⚡", label: "Elektr" },
  { icon: "📐", label: "Xona rejasi" },
  { icon: "🏗️", label: "Arxitektura" },
  { icon: "🔧", label: "Santexnika" },
  { icon: "🛋️", label: "Interer" },
];

const DEMO_PROMPT = "3 qavatli turar-joy uyi, 450m², issiq pol, suv ta'minoti, kanalizatsiya, fasad, elektr";

// Hero o'ng tomonidagi animatsiyali demo
function HeroDemoWidget() {
  const [phase, setPhase] = useState<'typing' | 'building' | 'done'>('typing');
  const [typedLen, setTypedLen] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const demoModules = MODULES.slice(0, 7);

  useEffect(() => {
    // 1. Typing
    if (phase === 'typing') {
      if (typedLen < DEMO_PROMPT.length) {
        timerRef.current = setTimeout(() => setTypedLen(n => n + 1), 38);
      } else {
        timerRef.current = setTimeout(() => setPhase('building'), 600);
      }
    }
    // 2. Building — modullar birin-ketin done bo'ladi
    if (phase === 'building') {
      if (doneCount < demoModules.length) {
        timerRef.current = setTimeout(() => setDoneCount(n => n + 1), 320);
      } else {
        timerRef.current = setTimeout(() => setPhase('done'), 500);
      }
    }
    // 3. Done — 3s kutib qayta boshlash
    if (phase === 'done') {
      timerRef.current = setTimeout(() => {
        setPhase('typing');
        setTypedLen(0);
        setDoneCount(0);
      }, 3500);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, typedLen, doneCount, demoModules.length]);

  const allDone = phase === 'done';
  const totalMs = allDone ? (demoModules.length * 320 / 1000).toFixed(1) : null;

  return (
    <div className="relative w-full max-w-sm mx-auto select-none" style={{ minHeight: 420 }}>
      {/* Glow */}
      <div className="absolute -inset-4 bg-orange-500/10 rounded-3xl blur-2xl pointer-events-none" />

      <div className="relative rounded-2xl border border-white/10 bg-[#111]/90 backdrop-blur-sm overflow-hidden shadow-2xl">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/8 bg-white/3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          <span className="ml-2 text-[11px] text-gray-500 font-mono">Mega Builder</span>
          {phase === 'building' && (
            <span className="ml-auto text-[10px] text-orange-400 animate-pulse">● Generatsiya...</span>
          )}
          {allDone && (
            <span className="ml-auto text-[10px] text-emerald-400">● Tayyor</span>
          )}
        </div>

        {/* Chat input area */}
        <div className="px-4 pt-3 pb-2">
          <div className="text-[10px] text-gray-600 mb-1 font-mono uppercase tracking-wider">Loyiha tavsifi</div>
          <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 min-h-[44px] font-mono text-xs text-gray-200 leading-relaxed relative">
            {DEMO_PROMPT.slice(0, typedLen)}
            {phase === 'typing' && (
              <span className="inline-block w-0.5 h-3.5 bg-orange-400 ml-0.5 align-middle animate-pulse" />
            )}
          </div>
        </div>

        {/* Slide-down section: status + divider + modules + banner */}
        <div
          className="overflow-hidden transition-all duration-500"
          style={{ maxHeight: phase !== 'typing' ? 320 : 0 }}
        >
          <div className="px-4 pt-1.5 pb-1 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-emerald-400">Loyiha ma'lumotlari tayyor</span>
          </div>
        <div className="mx-4 border-t border-white/8 mb-1" />

        {/* Modules list */}
        <div className="px-4 pb-2 space-y-1 mt-1">
          {demoModules.map((m, i) => {
            const isDone = i < doneCount;
            const isBuilding = i === doneCount && phase === 'building';
            return (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span className="text-xs w-4 text-center">{m.icon}</span>
                <span className={`text-[11px] flex-1 transition-colors duration-300 ${isDone ? 'text-gray-200' : 'text-gray-500'}`}>
                  {m.label}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="w-12 h-[3px] rounded-full bg-white/8 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: isDone ? '100%' : isBuilding ? '55%' : '0%',
                        backgroundColor: isDone ? '#10b981' : '#f97316',
                      }}
                    />
                  </div>
                  {isDone
                    ? <span className="text-[9px] text-emerald-400 w-3">✓</span>
                    : isBuilding
                      ? <span className="text-[9px] text-orange-400 w-3 animate-spin inline-block">◌</span>
                      : <span className="w-3" />
                  }
                </div>
              </div>
            );
          })}
        </div>

        {/* Done banner */}
        <div
          className="mx-4 mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-2 transition-opacity duration-500"
          style={{ opacity: allDone ? 1 : 0 }}
        >
          <span className="text-emerald-400 text-sm">⚡</span>
          <span className="text-xs text-emerald-300 font-medium">
            {demoModules.length} modul tayyor — {totalMs ?? '2.2'}s
          </span>
        </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const navLinks = [
    { href: "#modules", label: "Modullar" },
    { href: "#how", label: "Qanday ishlaydi" },
    { href: "#mega", label: "Mega Builder" },
    { href: "#faq", label: "Savol-javob" },
  ];

  return (
    <div className="bg-white dark:bg-black text-gray-900 dark:text-white min-h-screen transition-colors duration-300">

      {/* NAVBAR */}
      <header className={`sticky top-0 z-50 px-4 md:px-8 lg:px-16 py-3 transition-all duration-300 ${scrolled ? "bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-black/10 dark:border-white/10" : ""}`}>
        <nav className="liquid-glass rounded-xl px-4 py-2.5 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight">Multibuild AI</Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-500 dark:text-gray-300">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} className="hover:text-gray-900 dark:hover:text-white transition-colors">{l.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="text-sm text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors hidden md:block px-2">Kirish</Link>
            <Link to="/signup" className="bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors">
              Boshlash
            </Link>
            <button onClick={() => setMobileMenu(m => !m)}
              className="md:hidden ml-1 p-1.5 text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
              {mobileMenu ? "✕" : "☰"}
            </button>
          </div>
        </nav>
        {mobileMenu && (
          <div className="md:hidden mt-2 liquid-glass rounded-xl px-4 py-3 space-y-1">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMobileMenu(false)}
                className="block py-2.5 text-sm text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors border-b border-black/5 dark:border-white/5 last:border-0">
                {l.label}
              </a>
            ))}
            <Link to="/login" onClick={() => setMobileMenu(false)}
              className="block py-2.5 text-sm text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
              Kirish
            </Link>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative min-h-[88vh] flex flex-col justify-center px-4 md:px-8 lg:px-16 py-12 md:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-mesh" />

        {/* 2-ustunli layout */}
        <div className="relative z-10 w-full max-w-7xl mx-auto grid md:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* Chap — matn */}
          <div>
            <FadeIn delay={0} duration={600}>
              <span className="inline-block text-xs font-medium tracking-widest text-orange-500 dark:text-orange-400 uppercase mb-5 border border-orange-400/30 px-3 py-1 rounded-full">
                Professional muhandislik chizmalari — AI bilan
              </span>
            </FadeIn>
            <AnimatedHeading
              text={"Barcha muhandislik\ntizimlarini AI bilan\nyarating."}
              className="text-3xl sm:text-4xl md:text-4xl lg:text-5xl xl:text-6xl font-light mb-5 leading-tight"
              initialDelay={200} charDelay={18}
            />
            <FadeIn delay={1100} duration={800} className="mb-8">
              <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 max-w-xl leading-relaxed">
                Issiq pol, suv ta'minoti, kanalizatsiya, elektr, fasad va boshqa
                11 ta muhandislik moduli — SNiP standartlarida, bir necha soniyada.
              </p>
            </FadeIn>
            <FadeIn delay={1500} duration={800} className="mb-10">
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/mega" className="bg-orange-600 hover:bg-orange-500 text-white px-7 py-3 rounded-xl font-medium transition-colors text-sm text-center">
                  🏗️ Mega Builder →
                </Link>
                <Link to="/signup" className="liquid-glass border border-black/20 dark:border-white/20 text-gray-900 dark:text-white px-7 py-3 rounded-xl font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-sm text-center">
                  Bepul boshlash
                </Link>
              </div>
            </FadeIn>

            {/* Stats */}
            <FadeIn delay={1900} duration={800} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { n: "11", label: "Modul" },
                { n: "< 3s", label: "Generatsiya" },
                { n: "DXF+PDF", label: "Eksport" },
                { n: "3 til", label: "O'zbek·Rus·En" },
              ].map((s, i) => (
                <div key={i} className="liquid-glass border border-black/10 dark:border-white/10 rounded-xl px-3 py-2.5">
                  <div className="text-base font-semibold">{s.n}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </FadeIn>
          </div>

          {/* O'ng — animatsiyali demo */}
          <FadeIn delay={800} duration={1000} className="hidden md:flex md:items-start md:pt-10">
            <HeroDemoWidget />
          </FadeIn>

        </div>
      </section>

      {/* MODULES */}
      <section id="modules" className="py-16 md:py-24 px-4 md:px-8 lg:px-16 bg-white dark:bg-black border-t border-black/5 dark:border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <p className="text-orange-500 dark:text-orange-400 text-xs tracking-widest uppercase mb-3">Modullar</p>
            <h2 className="text-2xl md:text-4xl font-light" style={{ letterSpacing: "-0.02em" }}>11 ta muhandislik moduli</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-3 max-w-xl mx-auto text-sm">
              Har bir modul mustaqil ishlaydi. Yoki Mega Builder bilan barchasini bir vaqtda yarating.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
            {[
              { icon: "♨️", title: "Issiq pol", desc: "Snake konturlar, kollektorlar, isitish yuklari hisoblash. SNiP bo'yicha.", color: "orange" },
              { icon: "💧", title: "Suv ta'minoti", desc: "Sovuq/issiq suv, stoyaklar, quvur diametr hisoblash. 2D + 3D + Axon.", color: "blue" },
              { icon: "🚽", title: "Kanalizatsiya", desc: "Oqava suv tizimi, reviziyalar, qiyalik hisoblash. 3 xil ko'rinish.", color: "gray" },
              { icon: "🌧️", title: "Yomg'ir suvi", desc: "Tom traplar, magistral quvurlar, oqim hisoblash.", color: "cyan" },
              { icon: "🔥", title: "Qozonxona", desc: "Qozon, nasoslar, kengaytirish baki, isitish sxemasi.", color: "red" },
              { icon: "🏛️", title: "Fasad", desc: "6 uslub, 4 tomonlama ko'rinish, tom turlari, 3D render.", color: "amber" },
              { icon: "⚡", title: "Elektr tizimi", desc: "Rozetkalar, chiroqlar, panel, kabel yo'laklari.", color: "yellow" },
              { icon: "📐", title: "Xona rejasi", desc: "Devorlar, eshiklar, jihozlar, o'lchamlar. DXF eksport.", color: "green" },
              { icon: "🏗️", title: "Arxitektura", desc: "Kesim va ko'rinish chizmalari, balandliklar.", color: "violet" },
              { icon: "🔧", title: "Santexnika", desc: "Aksonometrik santexnika sxemasi.", color: "slate" },
              { icon: "🛋️", title: "Interer dizayn", desc: "Xona bezash sxemasi, mebel joylashuvi.", color: "pink" },
            ].map((m, i) => (
              <div key={i} className="liquid-glass border border-black/10 dark:border-white/10 rounded-2xl p-4 hover:border-black/20 dark:hover:border-white/20 transition-colors">
                <div className="text-2xl mb-2">{m.icon}</div>
                <h3 className="text-sm font-medium mb-1">{m.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{m.desc}</p>
              </div>
            ))}
            {/* Mega Builder karta */}
            <div className="liquid-glass border border-orange-500/30 bg-orange-500/5 rounded-2xl p-4 col-span-2 sm:col-span-1 flex flex-col justify-between">
              <div>
                <div className="text-2xl mb-2">🏗️</div>
                <h3 className="text-sm font-semibold mb-1 text-orange-500">Mega Builder</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">Barcha 11 modulni bir loyiha sifatida parallel yarating.</p>
              </div>
              <Link to="/mega" className="mt-3 text-xs text-orange-400 hover:text-orange-300 transition-colors">
                Ochish →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* MEGA BUILDER */}
      <section id="mega" className="py-16 md:py-24 px-4 md:px-8 lg:px-16 bg-gray-50 dark:bg-[#0a0a0a] border-t border-black/5 dark:border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <p className="text-orange-500 dark:text-orange-400 text-xs tracking-widest uppercase mb-3">Yangi</p>
              <h2 className="text-2xl md:text-4xl font-light mb-4" style={{ letterSpacing: "-0.02em" }}>
                Mega Builder —<br />barcha tizimlar birda
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
                Binongiz haqida bir marta yozing. AI barcha muhandislik tizimlarini
                parallel ravishda, 3 soniyadan kam vaqtda yaratadi. Har bir modul
                uchun alohida AI muharrir bilan o'zgartirishlar kiriting.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  { icon: "💬", text: "AI bilan suhbat — loyiha ma'lumotlarini to'plash" },
                  { icon: "⚡", text: "Barcha modullar parallel generatsiya — < 3 soniya" },
                  { icon: "✏️", text: "Har bir modul uchun alohida AI muharrir" },
                  { icon: "💾", text: "Saqlash → Dashboard → Qayta ochish va tahrirlash" },
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">{s.icon}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">{s.text}</span>
                  </div>
                ))}
              </div>
              <Link to="/mega" className="inline-block bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-xl font-medium transition-colors text-sm">
                Mega Builder ni ochish →
              </Link>
            </div>

            {/* Mini preview */}
            <div className="liquid-glass border border-white/10 rounded-2xl p-4 bg-[#111] text-white overflow-hidden">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
                <span className="text-xs text-orange-400 font-semibold">🏗️ Mega Builder</span>
                <span className="ml-auto text-[10px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/30">Generatsiya bosqichi</span>
              </div>
              <div className="space-y-2 mb-4">
                {MODULES.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm">{m.icon}</span>
                    <span className="text-xs text-gray-400">{m.label}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${60 + i * 4}%` }} />
                      </div>
                      <span className="text-[10px] text-emerald-400">✓</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2 text-xs text-orange-300 text-center">
                ⚡ Barcha 11 modul tayyor — 2.4 soniyada
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-16 md:py-24 px-4 md:px-8 lg:px-16 border-t border-black/5 dark:border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <p className="text-blue-500 dark:text-blue-400 text-xs tracking-widest uppercase mb-3">Texnologiya</p>
            <h2 className="text-2xl md:text-4xl font-light" style={{ letterSpacing: "-0.02em" }}>Qanday ishlaydi?</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-3 max-w-xl mx-auto text-sm">
              Tavsifingiz bir necha bosqichdan o'tib, professional chizmaga aylanadi
            </p>
          </div>
          <div className="space-y-3 max-w-3xl mx-auto">
            {[
              { step: "1", color: "bg-blue-500",    title: "Matn tahlili (NLP)", desc: "Gemini AI tavsifni o'qib, loyiha parametrlarini — qavatlar, maydon, tizimlar — aniqlaydi. O'zbek, Rus, Ingliz tillarida." },
              { step: "2", color: "bg-violet-500",  title: "Parser → deterministik hisoblash", desc: "Har modul uchun alohida Parser → Engine zanjiri. AI hech qachon koordinata bermaydi — formulalar hisoblaydi." },
              { step: "3", color: "bg-orange-500",  title: "Parallel generatsiya", desc: "Barcha tanlangan modullar bir vaqtda, parallel ravishda ishga tushiriladi. 11 modul uchun umumiy vaqt 3 soniyadan kam." },
              { step: "4", color: "bg-emerald-500", title: "Schema → Canvas vizualizatsiya", desc: "Konva.js (2D) va Three.js (3D) bilan brauzerda real vaqtda chizma: devorlar, quvurlar, jihozlar, o'lchamlar." },
              { step: "5", color: "bg-amber-500",   title: "AI muharrir", desc: "Har bir modul uchun alohida AI chat. 'Stoyakni chapga siljit' — AI qayta hisoblaydi va chizma yangilanadi." },
              { step: "6", color: "bg-rose-500",    title: "Eksport", desc: "PDF: yuqori sifatli rasm. DXF: AutoCAD uchun vector format, barcha layer-lar bilan." },
            ].map((w, i) => (
              <div key={i} className="flex gap-3 md:gap-4 liquid-glass border border-black/10 dark:border-white/10 rounded-xl p-4 md:p-5">
                <div className={`${w.color} text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  {w.step}
                </div>
                <div>
                  <h3 className="font-medium text-sm mb-1">{w.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm leading-relaxed">{w.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="py-16 md:py-24 px-4 md:px-8 lg:px-16 bg-gray-50 dark:bg-black/95 border-t border-black/5 dark:border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 md:mb-14">
            <p className="text-blue-500 dark:text-blue-400 text-xs tracking-widest uppercase mb-3">Farq</p>
            <h2 className="text-2xl md:text-4xl font-light" style={{ letterSpacing: "-0.02em" }}>Nima uchun Multibuild AI?</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="liquid-glass border border-black/10 dark:border-white/10 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wide">Boshqa vositalar</h3>
              <div className="space-y-3">
                {[
                  "Faqat xona rejasi (floor plan)",
                  "Muhandislik tizimlari yo'q",
                  "Qo'lda hisoblash talab qiladi",
                  "Ingliz tilida faqat",
                  "Formulalar yo'q — AI taxmin qiladi",
                ].map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="text-red-400">✕</span> {t}
                  </div>
                ))}
              </div>
            </div>
            <div className="liquid-glass border border-orange-500/30 bg-orange-500/5 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-orange-400 mb-4 uppercase tracking-wide">Multibuild AI</h3>
              <div className="space-y-3">
                {[
                  "11 ta muhandislik moduli birda",
                  "Issiq pol, suv, elektr, fasad...",
                  "SNiP standartlari bo'yicha hisoblash",
                  "O'zbek · Rus · Ingliz tillarida",
                  "Deterministik formulalar — aniq natija",
                ].map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <span className="text-emerald-400">✓</span> {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 md:py-24 px-4 md:px-8 lg:px-16 border-t border-black/5 dark:border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <p className="text-blue-500 dark:text-blue-400 text-xs tracking-widest uppercase mb-3">Savol-javob</p>
            <h2 className="text-2xl md:text-4xl font-light" style={{ letterSpacing: "-0.02em" }}>Ko'p so'raladigan savollar</h2>
          </div>
          <div className="space-y-2">
            {[
              { q: "Bepulmi?", a: "Ha, ro'yxatdan o'tish va chizma yaratish bepul. Hech qanday kredit karta kerak emas." },
              { q: "Mega Builder nima?", a: "Mega Builder — bir loyiha doirasida barcha 11 muhandislik tizimini (issiq pol, suv, kanalizatsiya, elektr, fasad va h.k.) parallel yaratadigan vosita. Siz binongiz haqida yozasiz, AI qolgan hamma narsani qiladi." },
              { q: "Chizmalar qanchalik aniq?", a: "Har bir modul alohida Parser → Engine zanjirida ishlaydi: AI matnni tahlil qiladi, formulalar esa hisoblaydi. SNiP 2.04.01-85, 2.08.01-89 standartlariga mos. Yakuniy loyiha uchun mutaxassis tekshiruvi tavsiya etiladi." },
              { q: "DXF fayl nima?", a: "DXF — AutoCAD va boshqa CAD dasturlari uchun standart vector format. Arxitektor yoki muhandisga to'g'ridan-to'g'ri berishingiz mumkin." },
              { q: "Qaysi tillar qo'llab-quvvatlanadi?", a: "O'zbek, Rus va Ingliz tillarida yozilgan tavsiflar qabul qilinadi. Modullar ham shu tillarda javob beradi." },
              { q: "Ma'lumotlarim saqlanadimi?", a: "Ha, barcha chizmalar hisobingizda saqlanadi. Dashboard orqali istalgan vaqt qayta ko'rish, tahrirlash yoki o'chirish mumkin." },
            ].map((faq, i) => (
              <details key={i} className="liquid-glass border border-black/10 dark:border-white/10 rounded-xl group">
                <summary className="px-4 md:px-6 py-3.5 cursor-pointer text-sm font-medium flex justify-between items-center list-none">
                  <span>{faq.q}</span>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform ml-4 flex-shrink-0">↓</span>
                </summary>
                <p className="px-4 md:px-6 pb-4 text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 px-4 md:px-8 lg:px-16 border-t border-black/5 dark:border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <div className="liquid-glass border border-orange-500/20 bg-orange-500/5 rounded-2xl md:rounded-3xl p-8 md:p-12">
            <h2 className="text-2xl md:text-4xl font-light mb-3" style={{ letterSpacing: "-0.02em" }}>Bugun boshlab ko'ring</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
              Mega Builder bilan binongizning barcha muhandislik tizimlarini bir vaqtda yarating
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/mega" className="inline-block bg-orange-600 hover:bg-orange-500 text-white px-8 py-3.5 rounded-xl font-medium transition-colors text-sm">
                🏗️ Mega Builder →
              </Link>
              <Link to="/signup" className="inline-block liquid-glass border border-black/20 dark:border-white/20 text-gray-900 dark:text-white px-8 py-3.5 rounded-xl font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-sm">
                Bepul ro'yxatdan o'tish
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-black/10 dark:border-white/10 py-6 md:py-8 px-4 md:px-8 lg:px-16">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">Multibuild AI</span>
          <p className="text-gray-400 text-xs md:text-sm">© 2025 Multibuild AI. Barcha huquqlar himoyalangan.</p>
          <div className="flex gap-5 text-sm text-gray-400">
            <Link to="/login" className="hover:text-gray-900 dark:hover:text-white transition-colors">Kirish</Link>
            <Link to="/signup" className="hover:text-gray-900 dark:hover:text-white transition-colors">Ro'yxat</Link>
            <Link to="/mega" className="hover:text-orange-500 transition-colors">Mega Builder</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
