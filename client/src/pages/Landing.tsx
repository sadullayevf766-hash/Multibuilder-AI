import { useState, useEffect } from "react";
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
        <span key={li} className="block">
          {line.split("").map((char, ci) => (
            <span key={ci} className="inline-block transition-all" style={{
              opacity: started ? 1 : 0,
              transform: started ? "translateX(0)" : "translateX(-18px)",
              transitionDuration: "500ms",
              transitionDelay: `${li * line.length * charDelay + ci * charDelay}ms`,
            }}>
              {char === " " ? "\u00A0" : char}
            </span>
          ))}
        </span>
      ))}
    </h1>
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
    { href: "#how", label: "Qanday ishlaydi" },
    { href: "#features", label: "Imkoniyatlar" },
    { href: "#workflow", label: "Jarayon" },
    { href: "#faq", label: "Savol-javob" },
  ];

  return (
    <div className="bg-white dark:bg-black text-gray-900 dark:text-white min-h-screen transition-colors duration-300">

      {/* NAVBAR */}
      <header className={`sticky top-0 z-50 px-4 md:px-8 lg:px-16 py-3 transition-all duration-300 ${scrolled ? "bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-black/10 dark:border-white/10" : ""}`}>
        <nav className="liquid-glass rounded-xl px-4 py-2.5 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight">FloorPlan AI</Link>
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
      <section className="relative min-h-[85vh] flex flex-col justify-center px-4 md:px-8 lg:px-16 py-12 md:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-mesh" />
        <div className="relative z-10 max-w-4xl">
          <FadeIn delay={0} duration={600}>
            <span className="inline-block text-xs font-medium tracking-widest text-blue-500 dark:text-blue-400 uppercase mb-5 border border-blue-400/30 px-3 py-1 rounded-full">
              AI-powered floor plan generator
            </span>
          </FadeIn>
          <AnimatedHeading
            text={"Sun'iy intellekt bilan\nprofessional xona\nrejalarini yarating."}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light mb-5 leading-tight"
            initialDelay={200} charDelay={20}
          />
          <FadeIn delay={1200} duration={800} className="mb-8">
            <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed">
              Xona tavsifini o'zbek tilida yozing — AI avtomatik ravishda devorlar, jihozlar, suv quvurlari va o'lchamlar bilan professional CAD chizmasini yaratadi.
            </p>
          </FadeIn>
          <FadeIn delay={1600} duration={800}>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/signup" className="bg-gray-900 dark:bg-white text-white dark:text-black px-7 py-3 rounded-xl font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors text-sm text-center">
                Bepul boshlash →
              </Link>
              <a href="#how" className="liquid-glass border border-black/20 dark:border-white/20 text-gray-900 dark:text-white px-7 py-3 rounded-xl font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-sm text-center">
                Qanday ishlashini ko'rish
              </a>
            </div>
          </FadeIn>
        </div>
        <FadeIn delay={2000} duration={800} className="relative z-10 mt-10 grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
          {[
            { n: "< 5s", label: "Chizma vaqti" },
            { n: "20+", label: "Jihoz turi" },
            { n: "DXF+PDF", label: "Export" },
            { n: "100%", label: "O'zbek tili" },
          ].map((s, i) => (
            <div key={i} className="liquid-glass border border-black/10 dark:border-white/10 rounded-xl px-4 py-3">
              <div className="text-lg font-semibold">{s.n}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </FadeIn>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-16 md:py-24 px-4 md:px-8 lg:px-16 bg-white dark:bg-black border-t border-black/5 dark:border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <p className="text-blue-500 dark:text-blue-400 text-xs tracking-widest uppercase mb-3">Jarayon</p>
            <h2 className="text-2xl md:text-4xl font-light" style={{ letterSpacing: "-0.02em" }}>3 qadamda tayyor chizma</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {[
              { n: "01", icon: "✍️", title: "Tavsif yozing", desc: "O'zbek tilida xona haqida yozing: o'lchami, xona turi, kerakli jihozlar.", example: '"4x5 metr oshxona, shimolda lavabo"' },
              { n: "02", icon: "🤖", title: "AI tahlil qiladi", desc: "Groq LLaMA va Gemini AI tavsifni tahlil qilib, jihozlar va quvurlarni aniqlaydi.", example: "Jihozlar → Devorlar → Quvurlar" },
              { n: "03", icon: "📐", title: "Chizma tayyor", desc: "Professional CAD chizmasi: devorlar, eshiklar, quvurlar, o'lchamlar.", example: "DXF yoki PDF yuklab oling" },
            ].map((s, i) => (
              <div key={i} className="liquid-glass border border-black/10 dark:border-white/10 rounded-2xl p-5 md:p-7">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-3xl">{s.icon}</span>
                  <span className="text-3xl font-light text-black/10 dark:text-white/15">{s.n}</span>
                </div>
                <h3 className="text-base font-medium mb-2">{s.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-3">{s.desc}</p>
                <div className="bg-black/5 dark:bg-white/5 rounded-lg px-3 py-2 text-xs text-gray-500 font-mono">{s.example}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-16 md:py-24 px-4 md:px-8 lg:px-16 bg-gray-50 dark:bg-black/95 border-t border-black/5 dark:border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <p className="text-blue-500 dark:text-blue-400 text-xs tracking-widest uppercase mb-3">Imkoniyatlar</p>
            <h2 className="text-2xl md:text-4xl font-light" style={{ letterSpacing: "-0.02em" }}>Nima uchun FloorPlan AI?</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {[
              { icon: "🗣️", title: "O'zbek tilida", desc: "Shimol, janub, sharq, g'arb yo'nalishlari va mahalliy atamalar to'liq qo'llab-quvvatlanadi." },
              { icon: "🏗️", title: "Ko'p xonali", desc: "Bir vaqtda bir nechta xona — AI ularni avtomatik joylashtirib, to'liq bino rejasini yaratadi." },
              { icon: "🔧", title: "20+ jihoz", desc: "Lavabo, unitaz, vanna, dush, karavot, divan, stol, shkaf va boshqalar — CAD standartida." },
              { icon: "💧", title: "Suv quvurlari", desc: "Sovuq (ko'k), issiq (qizil) va kanalizatsiya (kulrang) — SNiP 2.04.01-85 standartida." },
              { icon: "📏", title: "O'lchamlar", desc: "Har bir devor uchun avtomatik o'lcham chiziqlari. Masshtab 1:50." },
              { icon: "💾", title: "Loyihalar tarixi", desc: "Barcha chizmalar saqlanadi. Qayta ko'rish, yuklab olish yoki o'chirish mumkin." },
            ].map((f, i) => (
              <div key={i} className="liquid-glass border border-black/10 dark:border-white/10 rounded-2xl p-5 hover:border-black/20 dark:hover:border-white/20 transition-colors">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="text-sm font-medium mb-1.5">{f.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="workflow" className="py-16 md:py-24 px-4 md:px-8 lg:px-16 border-t border-black/5 dark:border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <p className="text-blue-500 dark:text-blue-400 text-xs tracking-widest uppercase mb-3">Texnologiya</p>
            <h2 className="text-2xl md:text-4xl font-light" style={{ letterSpacing: "-0.02em" }}>Ichida nima bo'ladi?</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-3 max-w-xl mx-auto text-sm">Tavsifingiz bir necha bosqichdan o'tib, professional chizmaga aylanadi</p>
          </div>
          <div className="space-y-3 max-w-3xl mx-auto">
            {[
              { step: "1", color: "bg-blue-500", title: "Matn tahlili (NLP)", desc: "Groq LLaMA 3.3-70b modeli tavsifni o'qib, xona turini, o'lchamlarni va jihozlar joylashuvini aniqlaydi." },
              { step: "2", color: "bg-violet-500", title: "Koordinata hisoblash", desc: "FloorPlanEngine barcha koordinatalarni hisoblaydi. AI hech qachon koordinata bermaydi." },
              { step: "3", color: "bg-emerald-500", title: "Quvur marshrutlash", desc: "Har bir suv talab qiladigan jihoz uchun sovuq, issiq suv va kanalizatsiya quvurlari chiziladi." },
              { step: "4", color: "bg-amber-500", title: "Canvas vizualizatsiya", desc: "Konva.js orqali brauzerda real vaqtda chizma ko'rsatiladi: devorlar, jihozlar, quvurlar, o'lchamlar." },
              { step: "5", color: "bg-rose-500", title: "Export", desc: "PDF: Canvas dan yuqori sifatli rasm. DXF: AutoCAD uchun vector format, barcha layer-lar bilan." },
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

      {/* EXAMPLES */}
      <section className="py-16 md:py-24 px-4 md:px-8 lg:px-16 bg-gray-50 dark:bg-black/95 border-t border-black/5 dark:border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <p className="text-blue-500 dark:text-blue-400 text-xs tracking-widest uppercase mb-3">Misollar</p>
            <h2 className="text-2xl md:text-4xl font-light" style={{ letterSpacing: "-0.02em" }}>Qanday yozish mumkin?</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 md:gap-4">
            {[
              { label: "Hammom", prompt: "3x4 metr hammom, shimolda lavabo va dush kabinasi, janubda eshik, sharqda deraza" },
              { label: "Oshxona", prompt: "5x4 metr oshxona, shimolda lavabo, plita va muzlatgich, janubda eshik" },
              { label: "Yotoqxona", prompt: "4x5 metr yotoqxona, sharqda karavot, g'arbda shkaf, shimolda deraza" },
              { label: "Ko'p xonali", prompt: "5x4 oshxona\n4x3 hammom\n4x5 yotoqxona\n3x4 mehmonxona" },
            ].map((ex, i) => (
              <div key={i} className="liquid-glass border border-black/10 dark:border-white/10 rounded-xl p-4 md:p-5">
                <span className="text-xs text-blue-500 dark:text-blue-400 font-medium tracking-wide uppercase mb-2 block">{ex.label}</span>
                <p className="text-gray-600 dark:text-gray-300 text-xs md:text-sm font-mono leading-relaxed whitespace-pre-line">{ex.prompt}</p>
              </div>
            ))}
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
              { q: "DXF fayl nima?", a: "DXF — AutoCAD va boshqa CAD dasturlari uchun standart vector format. Arxitektor yoki dizaynerga berishingiz mumkin." },
              { q: "Ko'p xonali reja qanday?", a: "Har bir xonani alohida qatorda yozing. AI ularni avtomatik joylashtirib, to'liq bino rejasini yaratadi." },
              { q: "Chizma aniq bo'ladimi?", a: "AI professional me'morchilik qoidalariga asoslanadi. Lekin yakuniy loyiha uchun mutaxassis tekshiruvi tavsiya etiladi." },
              { q: "Ma'lumotlarim saqlanadimi?", a: "Ha, barcha chizmalar hisobingizda saqlanadi. Istalgan vaqt qayta ko'rish yoki o'chirish mumkin." },
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
          <div className="liquid-glass border border-black/10 dark:border-white/10 rounded-2xl md:rounded-3xl p-8 md:p-12">
            <h2 className="text-2xl md:text-4xl font-light mb-3" style={{ letterSpacing: "-0.02em" }}>Bugun boshlab ko'ring</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">Ro'yxatdan o'ting va darhol birinchi chizmangizni yarating</p>
            <Link to="/signup" className="inline-block bg-gray-900 dark:bg-white text-white dark:text-black px-8 py-3.5 rounded-xl font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors text-sm">
              Bepul boshlash →
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-black/10 dark:border-white/10 py-6 md:py-8 px-4 md:px-8 lg:px-16">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">FloorPlan AI</span>
          <p className="text-gray-400 text-xs md:text-sm">© 2025 FloorPlan AI. Barcha huquqlar himoyalangan.</p>
          <div className="flex gap-5 text-sm text-gray-400">
            <Link to="/login" className="hover:text-gray-900 dark:hover:text-white transition-colors">Kirish</Link>
            <Link to="/signup" className="hover:text-gray-900 dark:hover:text-white transition-colors">Ro'yxat</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
