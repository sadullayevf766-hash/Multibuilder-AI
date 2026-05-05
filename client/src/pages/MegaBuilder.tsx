/**
 * MegaBuilder — 3 bosqichli professional muhandislik chizma generatori
 * Bosqich 1: Plan  — AI bilan suhbat, loyiha rejalashtirish
 * Bosqich 2: Build — Barcha sohalar avtomatik generatsiya
 * Bosqich 3: Review/Edit — Chizmalarni ko'rish + AI bilan tahrirlash
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMegaBuilder } from '../hooks/useMegaBuilder';
import type { MegaDiscipline, ViewMode } from '../../../shared/mega-types';
import { DISCIPLINE_META } from '../../../shared/mega-types';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

// Canvas imports
import WarmFloorCanvas     from '../components/WarmFloorCanvas';
import WarmFloorAxonCanvas from '../components/WarmFloorAxonCanvas';
import WaterSupplyCanvas   from '../components/WaterSupplyCanvas';
import WaterSupplyAxonCanvas from '../components/WaterSupplyAxonCanvas';
import WaterSupply3DCanvas from '../components/WaterSupply3DCanvas';
import SewageCanvas        from '../components/SewageCanvas';
import SewageAxonCanvas    from '../components/SewageAxonCanvas';
import Sewage3DCanvas      from '../components/Sewage3DCanvas';
import StormDrainCanvas    from '../components/StormDrainCanvas';
import StormDrain3DCanvas  from '../components/StormDrain3DCanvas';
import BoilerRoomCanvas2D  from '../components/BoilerRoomCanvas2D';
import BoilerRoomCanvas3D  from '../components/BoilerRoomCanvas3D';
import FacadeCanvas2D      from '../components/FacadeCanvas2D';
import FacadeCanvas3D      from '../components/FacadeCanvas3D';
import Canvas2D            from '../components/Canvas2D';
import ElectricalCanvas    from '../components/ElectricalCanvas';
import ElevationCanvas     from '../components/ElevationCanvas';

// ── Quick types ───────────────────────────────────────────────────────────────
const STAGE_LABELS = { plan: 'Rejalashtirish', build: 'Generatsiya', review: 'Ko\'rish va Tahrirlash' };
const STAGE_ICONS  = { plan: '📋', build: '⚙️', review: '✏️' };

// ── Plan Stage ────────────────────────────────────────────────────────────────
function PlanStage({
  chatHistory, chatLoading, spec,
  sendMessage, goToBuild,
}: ReturnType<typeof useMegaBuilder> & { className?: string }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Boshlang'ich xabar
  const isFirst = chatHistory.length === 0;

  const handleSend = () => {
    if (!input.trim() || chatLoading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const QUICK = [
    { label: '🏠 Turar-joy uyi',    text: '3 qavatli turar-joy uyi, 450m², issiq pol, suv ta\'minoti, kanalizatsiya, elektr, fasad' },
    { label: '🏢 Ofis binosi',       text: '2 qavatli ofis binosi, 600m², suv ta\'minoti, kanalizatsiya, elektr, fasad' },
    { label: '🏡 Kottej (to\'liq)',  text: 'Xumson uyi: 4 qavat, 800m², qozonxona, issiq pol, suv, kanalizatsiya, yomg\'ir suvi, fasad' },
    { label: '🏪 Savdo markazi',     text: '3 qavatli savdo markazi, 1200m², suv ta\'minoti, kanalizatsiya, elektr, yomg\'ir suvi, fasad' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isFirst && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center py-12">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600
                            flex items-center justify-center text-4xl shadow-2xl">
              🏗️
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white mb-2">Mega Builder</h2>
              <p className="text-slate-400 max-w-md leading-relaxed mb-1">
                Binongiz haqida yozing — AI barcha muhandislik chizmalarini avtomatik tayyorlaydi.
              </p>
              <p className="text-slate-600 text-xs max-w-md">
                💡 Masalan: "3 qavatli uy, 450m², suv ta'minoti, kanalizatsiya, issiq pol va elektr kerak"
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-2xl">
              {QUICK.map((q, i) => (
                <button key={i} onClick={() => { sendMessage(q.text); }}
                  className="text-left px-4 py-3 rounded-xl bg-slate-800/60 border border-white/8
                             text-sm text-slate-300 hover:border-orange-500/40 hover:bg-slate-800
                             transition-all">
                  <div className="text-xs font-semibold text-slate-400 mb-1">{q.label}</div>
                  <div className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{q.text}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600
                              flex items-center justify-center text-sm shrink-0 mt-0.5">
                🏗️
              </div>
            )}
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
              ${msg.role === 'user'
                ? 'bg-orange-600 text-white rounded-br-sm'
                : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-white/8'}`}>
              {msg.content}
            </div>
          </div>
        ))}

        {chatLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600
                            flex items-center justify-center text-sm shrink-0">🏗️</div>
            <div className="px-4 py-3 rounded-2xl bg-slate-800 border border-white/8">
              <span className="flex gap-1">
                {[0,1,2].map(i => (
                  <span key={i} className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Spec preview panel */}
      {spec && (
        <div className="mx-4 mb-2 p-3 rounded-xl bg-emerald-900/20 border border-emerald-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
              ✅ Loyiha tayyor — {spec.floorCount} qavat · {spec.totalAreaM2}m²
            </span>
            <button onClick={goToBuild}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-orange-600 to-red-600
                         text-white text-xs font-semibold hover:from-orange-500 hover:to-red-500
                         transition-all flex items-center gap-1.5">
              ⚙️ Chizmalar yaratish →
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {spec.disciplines.map(d => (
              <span key={d} className="px-2 py-0.5 rounded-full bg-emerald-900/40
                                       border border-emerald-500/20 text-emerald-300 text-xs">
                {DISCIPLINE_META[d].icon} {DISCIPLINE_META[d].labelUz}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-white/8">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && input.trim() && handleSend()}
            placeholder="Loyihangiz haqida yozing... (masalan: 3 qavatli uy, 450m², suv ta'minoti, elektr)"
            disabled={chatLoading}
            className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5
                       text-sm text-slate-200 placeholder:text-slate-600
                       focus:outline-none focus:border-orange-500/50 transition disabled:opacity-50"
          />
          <button onClick={handleSend} disabled={chatLoading || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-red-600
                       text-white font-medium text-sm hover:from-orange-500 hover:to-red-500
                       disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Build Stage ───────────────────────────────────────────────────────────────
function BuildStage({
  spec, generations, buildLoading, buildProgress, buildAll,
}: ReturnType<typeof useMegaBuilder>) {
  const started = useRef(false);
  const buildAllRef = useRef(buildAll);
  buildAllRef.current = buildAll;

  useEffect(() => {
    if (!started.current && spec) {
      started.current = true;
      buildAllRef.current();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  if (!spec) return null;

  const total = spec.disciplines.length;
  const done  = spec.disciplines.filter(d => generations[d]?.status === 'done').length;
  const errs  = spec.disciplines.filter(d => generations[d]?.status === 'error').length;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-8">
      {/* Big animated icon */}
      <div className="relative">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600
                        flex items-center justify-center text-5xl shadow-2xl
                        animate-pulse">
          ⚙️
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500
                        flex items-center justify-center text-sm font-bold text-white">
          {done}
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-xl font-semibold text-white mb-1">
          {buildLoading ? 'Chizmalar yaratilmoqda...' : 'Generatsiya tugadi!'}
        </h2>
        <p className="text-slate-400 text-sm">
          {done}/{total} soha tayyor{errs > 0 ? ` · ${errs} xatolik` : ''}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-md" data-testid="build-progress">
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-500"
            style={{ width: `${buildProgress}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-slate-500">{buildProgress}%</span>
          <span className="text-xs text-slate-500">{done}/{total}</span>
        </div>
      </div>

      {/* Discipline cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-2xl">
        {spec.disciplines.map(d => {
          const meta  = DISCIPLINE_META[d];
          const state = generations[d];
          const st    = state?.status ?? 'idle';
          return (
            <div key={d} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
              ${st === 'done'     ? 'bg-emerald-900/20 border-emerald-500/30' :
                st === 'error'    ? 'bg-red-900/20 border-red-500/30' :
                st === 'building' ? 'bg-orange-900/20 border-orange-500/30 animate-pulse' :
                'bg-slate-800/40 border-white/8'}`}>
              <span className="text-lg">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white truncate">{meta.labelUz}</div>
                <div className={`text-[10px] ${
                  st === 'done'     ? 'text-emerald-400' :
                  st === 'error'    ? 'text-red-400' :
                  st === 'building' ? 'text-orange-400' : 'text-slate-500'}`}>
                  {st === 'done' ? '✓ Tayyor' :
                   st === 'error' ? '✗ Xatolik' :
                   st === 'building' ? '⟳ Yaratilmoqda' : '— Kutilmoqda'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Discipline Canvas Router ──────────────────────────────────────────────────
function DisciplineCanvas({
  discipline, schema, view, activeFloor,
}: {
  discipline: MegaDiscipline;
  schema:     unknown;
  view:       ViewMode;
  activeFloor: number;
}) {
  if (!schema) return (
    <div className="flex items-center justify-center h-full text-slate-500">
      Schema mavjud emas
    </div>
  );

  // unknown → any bypass for canvas prop types (server returns plain JSON)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = schema as any;

  switch (discipline) {
    case 'warm-floor':
      return view === '3d'
        ? <WarmFloorAxonCanvas schema={s} />
        : <WarmFloorCanvas schema={s} floorNumber={activeFloor} />;

    case 'water-supply':
      return view === 'axon'
        ? <WaterSupplyAxonCanvas schema={s} />
        : view === '3d'
        ? <WaterSupply3DCanvas schema={s} />
        : <WaterSupplyCanvas schema={s} activeFloor={activeFloor} />;

    case 'sewage':
      return view === 'axon'
        ? <SewageAxonCanvas schema={s} />
        : view === '3d'
        ? <Sewage3DCanvas schema={s} />
        : <SewageCanvas schema={s} activeFloor={activeFloor} />;

    case 'storm-drain':
      return view === '3d'
        ? <StormDrain3DCanvas schema={s} />
        : <StormDrainCanvas schema={s} activeFloor={activeFloor} />;

    case 'boiler-room':
      return view === '3d'
        ? <BoilerRoomCanvas3D schema={s} />
        : <BoilerRoomCanvas2D schema={s} />;

    case 'facade':
      return view === '3d'
        ? <div style={{ width: '100%', height: '100%', minHeight: 500 }}><FacadeCanvas3D schema={s} /></div>
        : <FacadeCanvas2D schema={s} />;

    case 'electrical':
      return <ElectricalCanvas data={s} />;

    case 'architecture':
      return <ElevationCanvas data={s} view="elevations" />;

    case 'floor-plan':
    case 'plumbing':
    case 'decor':
    default:
      return <Canvas2D drawingData={s} />;
  }
}

// ── Review Stage ──────────────────────────────────────────────────────────────
function ReviewStage(hook: ReturnType<typeof useMegaBuilder>) {
  const {
    spec, generations,
    activeDisc, setActiveDisc,
    activeView, setActiveView,
    editHistory, editLoading,
    sendEdit, rebuildDisc,
  } = hook;

  const [editInput, setEditInput] = useState('');
  const [activeFloor, setActiveFloor] = useState(1);
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const editBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    editBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [editHistory]);

  if (!spec) return null;

  const disc    = activeDisc ?? spec.disciplines[0];
  const meta    = DISCIPLINE_META[disc];
  const genState = generations[disc];
  const schema  = genState?.schema;
  const floors  = spec.floorCount ?? 1;

  const viewOptions: Array<{ id: ViewMode; label: string; icon: string }> = [
    { id: '2d',   label: '2D', icon: '📐' },
    ...(meta.hasAxon ? [{ id: 'axon' as ViewMode, label: 'Axon', icon: '📏' }] : []),
    ...(meta.has3D   ? [{ id: '3d'  as ViewMode, label: '3D',   icon: '🔧' }] : []),
  ];

  const handleSendEdit = () => {
    if (!editInput.trim() || editLoading) return;
    sendEdit(editInput.trim());
    setEditInput('');
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Discipline tabs */}
      <div className="w-52 shrink-0 flex flex-col border-r border-white/8 bg-black/20 overflow-y-auto">
        <div className="p-3 border-b border-white/8">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Sohalar</div>
        </div>
        {spec.disciplines.map(d => {
          const m  = DISCIPLINE_META[d];
          const gs = generations[d];
          const isDone = gs?.status === 'done';
          const isErr  = gs?.status === 'error';
          const isBld  = gs?.status === 'building';
          return (
            <button key={d} onClick={() => { setActiveDisc(d); setActiveView('2d'); setActiveFloor(1); }}
              className={`flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-white/5 transition-all
                ${d === disc
                  ? 'bg-orange-900/20 border-r-2 border-r-orange-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/4'}`}>
              <span className="text-base">{m.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{m.labelUz}</div>
                <div className={`text-[9px] ${isDone ? 'text-emerald-400' : isErr ? 'text-red-400' : isBld ? 'text-orange-400 animate-pulse' : 'text-slate-600'}`}>
                  {isDone ? '✓ Tayyor' : isErr ? '✗ Xatolik' : isBld ? '⟳ Jarayonda' : '—'}
                </div>
              </div>
              {(isErr || isBld) && !isBld && (
                <button onClick={e => { e.stopPropagation(); rebuildDisc(d); }}
                  className="text-[9px] text-orange-400 hover:text-orange-300 px-1">↺</button>
              )}
            </button>
          );
        })}

        {/* Tahrirlash tugmasi */}
        <div className="p-3 mt-auto border-t border-white/8">
          <button onClick={() => setEditPanelOpen(o => !o)}
            className={`w-full py-2 rounded-lg text-xs font-medium transition-all
              ${editPanelOpen
                ? 'bg-orange-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-white/10'}`}>
            {editPanelOpen ? '✕ Yopish' : '✏️ Tahrirlash'}
          </button>
        </div>
      </div>

      {/* Center: Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Canvas toolbar */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-white/8 bg-black/20">
          <span className="text-base">{meta.icon}</span>
          <span className="text-sm font-medium text-white">{meta.labelUz}</span>

          {/* View tabs */}
          <div className="flex gap-1 ml-3">
            {viewOptions.map(v => (
              <button key={v.id} onClick={() => setActiveView(v.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all
                  ${activeView === v.id
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                    : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>

          {/* Floor tabs */}
          {floors > 1 && activeView === '2d' && (
            <div className="flex gap-1 ml-2">
              {Array.from({ length: floors }, (_, i) => i + 1).map(f => (
                <button key={f} onClick={() => setActiveFloor(f)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all
                    ${activeFloor === f ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                  {f}-qavat
                </button>
              ))}
            </div>
          )}

          <div className="ml-auto">
            {genState?.status === 'error' && (
              <button onClick={() => rebuildDisc(disc)}
                className="px-3 py-1 rounded-lg text-xs bg-red-900/30 border border-red-500/30
                           text-red-400 hover:bg-red-900/50 transition">
                ↺ Qayta yaratish
              </button>
            )}
            {genState?.status === 'building' && (
              <span className="text-xs text-orange-400 animate-pulse">⟳ Yaratilmoqda...</span>
            )}
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-hidden relative"
          style={{ background: activeView === '3d' ? '#f0f4f8' : '#ffffff' }}>
          {genState?.status === 'done' && schema ? (
            <DisciplineCanvas
              discipline={disc}
              schema={schema}
              view={activeView}
              activeFloor={activeFloor}
            />
          ) : genState?.status === 'building' ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
              <div className="w-10 h-10 rounded-full border-2 border-orange-500/40 border-t-orange-500 animate-spin" />
              <span className="text-sm">Yaratilmoqda...</span>
            </div>
          ) : genState?.status === 'error' ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-red-400">
              <span className="text-4xl">⚠️</span>
              <span className="text-sm">{genState.error}</span>
              <button onClick={() => rebuildDisc(disc)}
                className="px-4 py-2 rounded-lg bg-red-900/30 border border-red-500/30 text-sm hover:bg-red-900/50">
                ↺ Qayta yaratish
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              Chizma mavjud emas
            </div>
          )}
        </div>
      </div>

      {/* Right: Edit panel */}
      {editPanelOpen && (
        <div className="w-72 shrink-0 flex flex-col border-l border-white/8 bg-black/20">
          <div className="p-3 border-b border-white/8">
            <div className="text-xs font-semibold text-white">✏️ AI bilan tahrirlash</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              O'zgartirish kerak bo'lgan narsani yozing
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {editHistory.length === 0 && (
              <div className="text-xs text-slate-600 leading-relaxed">
                Masalan:<br/>
                • "Issiq polni qayta ishlat"<br/>
                • "Kanalizatsiyada 4 ta stoyak bo'lsin"<br/>
                • "Barcha chizmalarni qayta yaratsin"
              </div>
            )}
            {editHistory.map((msg, i) => (
              <div key={i} className={`text-xs rounded-xl px-3 py-2 leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-orange-600 text-white ml-4'
                  : 'bg-slate-800 text-slate-300 mr-4 border border-white/8'}`}>
                {msg.content}
              </div>
            ))}
            {editLoading && (
              <div className="flex gap-1 px-3 py-2 bg-slate-800 rounded-xl border border-white/8 w-fit">
                {[0,1,2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            )}
            <div ref={editBottomRef} />
          </div>

          <div className="p-3 border-t border-white/8">
            <div className="flex gap-2">
              <input
                value={editInput}
                onChange={e => setEditInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendEdit()}
                placeholder="O'zgartirishni yozing..."
                disabled={editLoading}
                className="flex-1 bg-slate-800 border border-white/10 rounded-lg px-3 py-2
                           text-xs text-slate-200 placeholder:text-slate-600
                           focus:outline-none focus:border-orange-500/50 disabled:opacity-50"
              />
              <button onClick={handleSendEdit} disabled={editLoading || !editInput.trim()}
                className="px-3 py-2 rounded-lg bg-orange-600 text-white text-xs
                           hover:bg-orange-500 disabled:opacity-40 transition">
                →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main MegaBuilder Page ─────────────────────────────────────────────────────
export default function MegaBuilder() {
  const navigate  = useNavigate();
  const hook      = useMegaBuilder();
  const { stage, spec, goToPlan, savedProjectId, saveLoading, saveProject, updateProject } = hook;
  const { user }  = useAuth();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const userId = user?.id ?? session?.user?.id ?? '00000000-0000-0000-0000-000000000001';

    if (savedProjectId) {
      // Already saved — update
      await updateProject(token);
      setSaveMsg('Yangilandi ✓');
    } else {
      // First save
      const id = await saveProject(userId, token);
      if (id) {
        setSaveMsg('Saqlandi ✓');
        setTimeout(() => setSaveMsg(null), 3000);
      }
    }
    setTimeout(() => setSaveMsg(null), 3000);
  }, [user, savedProjectId, saveProject, updateProject]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <header className="shrink-0 px-5 py-3 border-b border-white/10 flex items-center gap-3 bg-black/40">
        <button onClick={() => navigate('/select')}
          className="text-slate-400 hover:text-white transition text-sm flex items-center gap-1">
          ← Orqaga
        </button>
        <span className="text-white/20">|</span>

        {/* Stage stepper */}
        <div className="flex items-center gap-1">
          {(['plan', 'build', 'review'] as const).map((s, i) => {
            const isActive  = stage === s;
            const isDone    = (s === 'plan' && stage !== 'plan') || (s === 'build' && stage === 'review');
            const isLocked  = !isActive && !isDone;
            return (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && (
                  <div className={`w-8 h-px mx-1 ${isDone || isActive ? 'bg-orange-500/40' : 'bg-white/10'}`} />
                )}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                    ${isActive ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : isDone  ? 'text-emerald-400 border border-emerald-500/20 cursor-pointer hover:bg-emerald-900/20'
                      : 'text-slate-600 border border-white/5'}`}
                  onClick={() => { if (s === 'plan') goToPlan(); }}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold
                    ${isActive ? 'bg-orange-500 text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
                    {isDone ? '✓' : i + 1}
                  </span>
                  <span>{STAGE_LABELS[s]}</span>
                  {isLocked && <span className="text-slate-600 text-[9px]">🔒</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {spec && (
            <span className="text-xs text-slate-500">
              {spec.floorCount}q · {spec.totalAreaM2}m² · {spec.disciplines.length} soha
            </span>
          )}
          {/* Save button — faqat review stage'da */}
          {stage === 'review' && spec && (
            <button
              onClick={handleSave}
              disabled={saveLoading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold
                         bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition">
              {saveLoading ? '⏳' : savedProjectId ? '🔄 Yangilash' : '💾 Saqlash'}
            </button>
          )}
          {saveMsg && (
            <span className="text-xs text-emerald-400 font-medium animate-pulse">{saveMsg}</span>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {stage === 'plan'  && <PlanStage  {...hook} />}
        {stage === 'build' && <BuildStage {...hook} />}
        {stage === 'review'&& <ReviewStage {...hook} />}
      </div>
    </div>
  );
}
