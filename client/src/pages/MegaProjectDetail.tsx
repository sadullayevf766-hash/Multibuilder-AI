/**
 * MegaProjectDetail — saqlangan Mega loyihani ko'rish va tahrirlash
 *
 * /mega/:id → DB dan yuklaydi → tabs (har disiplina) → AI editor
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { MegaSavedData, MegaDiscipline, MegaGenerations, MegaProjectSpec, MegaChatMessage, ViewMode } from '../../../shared/mega-types';
import { DISCIPLINE_META } from '../../../shared/mega-types';

// Canvas imports
import WarmFloorCanvas      from '../components/WarmFloorCanvas';
import WarmFloorAxonCanvas  from '../components/WarmFloorAxonCanvas';
import WaterSupplyCanvas    from '../components/WaterSupplyCanvas';
import WaterSupplyAxonCanvas from '../components/WaterSupplyAxonCanvas';
import WaterSupply3DCanvas  from '../components/WaterSupply3DCanvas';
import SewageCanvas         from '../components/SewageCanvas';
import SewageAxonCanvas     from '../components/SewageAxonCanvas';
import Sewage3DCanvas       from '../components/Sewage3DCanvas';
import StormDrainCanvas     from '../components/StormDrainCanvas';
import StormDrain3DCanvas   from '../components/StormDrain3DCanvas';
import BoilerRoomCanvas2D   from '../components/BoilerRoomCanvas2D';
import BoilerRoomCanvas3D   from '../components/BoilerRoomCanvas3D';
import FacadeCanvas2D       from '../components/FacadeCanvas2D';
import FacadeCanvas3D       from '../components/FacadeCanvas3D';
import Canvas2D             from '../components/Canvas2D';
import ElectricalCanvas     from '../components/ElectricalCanvas';
import ElevationCanvas      from '../components/ElevationCanvas';

// ── Canvas per discipline ─────────────────────────────────────────────────────
function DisciplineCanvas({ discipline, schema, view, activeFloor }: {
  discipline: MegaDiscipline; schema: unknown; view: ViewMode; activeFloor: number;
}) {
  if (!schema) return (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">
      Schema mavjud emas
    </div>
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = schema as any;
  switch (discipline) {
    case 'warm-floor':
      return view === '3d' ? <WarmFloorAxonCanvas schema={s} /> : <WarmFloorCanvas schema={s} floorNumber={activeFloor} />;
    case 'water-supply':
      return view === 'axon' ? <WaterSupplyAxonCanvas schema={s} />
           : view === '3d'   ? <WaterSupply3DCanvas schema={s} />
           : <WaterSupplyCanvas schema={s} activeFloor={activeFloor} />;
    case 'sewage':
      return view === 'axon' ? <SewageAxonCanvas schema={s} />
           : view === '3d'   ? <Sewage3DCanvas schema={s} />
           : <SewageCanvas schema={s} activeFloor={activeFloor} />;
    case 'storm-drain':
      return view === '3d' ? <StormDrain3DCanvas schema={s} /> : <StormDrainCanvas schema={s} activeFloor={activeFloor} />;
    case 'boiler-room':
      return view === '3d' ? <BoilerRoomCanvas3D schema={s} /> : <BoilerRoomCanvas2D schema={s} />;
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

// ── Per-discipline AI Editor ──────────────────────────────────────────────────
function DisciplineEditor({
  discipline, spec, schema, onSchemaUpdate,
}: {
  discipline: MegaDiscipline;
  spec: MegaProjectSpec;
  schema: unknown;
  onSchemaUpdate: (disc: MegaDiscipline, newSchema: unknown, updatedSpec: MegaProjectSpec) => void;
}) {
  const [messages, setMessages] = useState<MegaChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const meta = DISCIPLINE_META[discipline];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendEdit = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg: MegaChatMessage = { role: 'user', content: input, timestamp: Date.now() };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/mega/discipline-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discipline,
          message: input,
          spec,
          editHistory: messages,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      const data = await res.json();

      const aiMsg: MegaChatMessage = { role: 'assistant', content: data.reply, timestamp: Date.now() };
      setMessages(m => [...m, aiMsg]);

      if (data.schema) {
        onSchemaUpdate(discipline, data.schema, data.updatedSpec ?? spec);
      }
    } catch (err) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: `❌ ${(err as Error).message}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, discipline, spec, messages, onSchemaUpdate]);

  // Quick edit suggestions per discipline
  const suggestions: Record<MegaDiscipline, string[]> = {
    'warm-floor':   ['Issiq pol maydonini 20% oshir', 'Kollektorni chapga siljit', 'Kontur zichligini kamayt'],
    'water-supply': ["Stoyak diametrini ø32 ga o'zgartir", 'Qozonxona sig\'imini oshir', 'Suv bosimini hisob'],
    'sewage':       ['Quvur qiyaligini 3% ga o\'zgartir', 'Reviziya qo\'sh', 'Stoyak pozitsiyasini siljit'],
    'storm-drain':  ['Tom traplarini ko\'payt', 'Magistral diametrini oshir', 'Oqimni qayta hisob'],
    'boiler-room':  ['Qozon quvvatini oshir', 'Nasosni almashtir', 'GVS tizimi qo\'sh'],
    'facade':       ['Derazalarni kattalashtir', 'Tom turini gable ga o\'zgartir', 'Material: g\'isht'],
    'floor-plan':   ['Mehmonxonani kattalashtir', 'Oshxona va zalni birlashtir', 'Hammom pozitsiyasini o\'zgartir'],
    'architecture': ['Balandlikni 3.2m ga o\'zgartir', 'Balkon qo\'sh', 'Kesim chizmasini yangilab ber'],
    'electrical':   ['Rozetkalar soni oshir', 'Yoritish sxemasini yangilab ber', 'Panel quvvatini katt'],
    'plumbing':     ['Quvurlarni qayta hisob', 'Isitish tizimini qo\'sh'],
    'decor':        ['Zamonaviy uslubga o\'tkazib ber', 'Ranglar sxemasini yangilab ber'],
  };

  return (
    <div className="flex flex-col h-full bg-black/30 border-l border-white/10">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <span>{meta.icon}</span>
        <span className="text-sm font-semibold text-white">{meta.labelUz} — AI Muharrir</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-xs text-slate-500 text-center py-4">
            {meta.labelUz} uchun o'zgartirishlarni yozing
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap
              ${m.role === 'user'
                ? 'bg-orange-600/20 text-orange-100 border border-orange-500/20'
                : 'bg-slate-800 text-slate-200 border border-white/10'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-white/10 px-3 py-2 rounded-xl">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick suggestions */}
      <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
        {(suggestions[discipline] || []).slice(0, 3).map((s, i) => (
          <button key={i} onClick={() => setInput(s)}
            className="text-[10px] px-2 py-1 rounded-full bg-white/5 text-slate-400
                       border border-white/10 hover:bg-white/10 hover:text-white transition">
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendEdit(); } }}
          disabled={loading}
          placeholder={`${meta.labelUz}ni o'zgartirish...`}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2
                     text-xs text-white placeholder-slate-500 outline-none
                     focus:border-orange-500/40 focus:bg-white/8 transition disabled:opacity-50"
        />
        <button onClick={sendEdit} disabled={loading || !input.trim()}
          className="px-3 py-2 rounded-lg bg-orange-600 text-white text-xs
                     hover:bg-orange-500 disabled:opacity-40 transition">
          →
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MegaProjectDetail() {
  const { id }      = useParams<{ id: string }>();
  const navigate    = useNavigate();
  const { user }    = useAuth();

  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [name,     setName]     = useState('');
  const [megaData, setMegaData] = useState<MegaSavedData | null>(null);
  const [spec,     setSpec]     = useState<MegaProjectSpec | null>(null);
  const [gens,     setGens]     = useState<MegaGenerations | null>(null);

  const [activeDisc,  setActiveDisc]  = useState<MegaDiscipline | null>(null);
  const [activeView,  setActiveView]  = useState<ViewMode>('2d');
  const [activeFloor, setActiveFloor] = useState(1);
  const [editorOpen,  setEditorOpen]  = useState(false);

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg,     setSaveMsg]     = useState('');

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session) h['Authorization'] = `Bearer ${session.access_token}`;
    return h;
  }, []);

  // Load project
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const headers = await getHeaders();
        const res = await fetch(`/api/project/${id}`, { headers });
        if (!res.ok) throw new Error((await res.json()).message);
        const project = await res.json();
        const data = project.drawing_data as MegaSavedData;
        if (data?.project_type !== 'mega') {
          // Regular project — redirect
          navigate(`/project/${id}`, { replace: true });
          return;
        }
        setName(project.name);
        setMegaData(data);
        setSpec(data.spec);
        setGens(data.generations);
        // Set first done discipline as active
        const firstDone = data.spec.disciplines.find(
          d => data.generations[d]?.status === 'done'
        );
        setActiveDisc(firstDone ?? data.spec.disciplines[0] ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Xatolik');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, getHeaders, navigate]);

  // Save updated project back to DB
  const handleSave = useCallback(async () => {
    if (!id || !spec || !gens || !megaData) return;
    setSaveLoading(true);
    try {
      const headers = await getHeaders();
      const updated: MegaSavedData = {
        ...megaData,
        spec, generations: gens,
        savedAt: new Date().toISOString(),
      };
      const res = await fetch(`/api/mega/project/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ spec, generations: gens, chatHistory: megaData.chatHistory, editHistory: megaData.editHistory }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setMegaData(updated);
      setSaveMsg('Saqlandi ✓');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg('Xatolik: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setSaveLoading(false);
    }
  }, [id, spec, gens, megaData, getHeaders]);

  // Called when DisciplineEditor rebuilds a module
  const handleSchemaUpdate = useCallback((disc: MegaDiscipline, newSchema: unknown, updatedSpec: MegaProjectSpec) => {
    setGens(prev => prev ? {
      ...prev,
      [disc]: { status: 'done', schema: newSchema, error: null, generatedAt: Date.now() },
    } : prev);
    setSpec(updatedSpec);
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-red-400">
      <div className="text-center">
        <p className="text-lg mb-4">❌ {error}</p>
        <Link to="/dashboard" className="text-sm text-slate-400 underline">← Dashboard</Link>
      </div>
    </div>
  );

  if (!spec || !gens) return null;

  const disciplines = spec.disciplines as MegaDiscipline[];
  const disc        = activeDisc ?? disciplines[0];
  const meta        = disc ? DISCIPLINE_META[disc] : null;
  const genState    = disc ? gens[disc] : null;
  const schema      = genState?.schema;
  const floors      = spec.floorCount ?? 1;

  const viewOptions: Array<{ id: ViewMode; label: string }> = [
    { id: '2d', label: '2D' },
    ...(meta?.hasAxon ? [{ id: 'axon' as ViewMode, label: 'Axon' }] : []),
    ...(meta?.has3D   ? [{ id: '3d'  as ViewMode, label: '3D'   }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <header className="shrink-0 px-5 py-3 border-b border-white/10 flex items-center gap-3 bg-black/40">
        <Link to="/dashboard" className="text-slate-400 hover:text-white transition text-sm">
          ← Dashboard
        </Link>
        <span className="text-white/20">|</span>
        <span className="text-sm font-semibold text-white line-clamp-1 max-w-xs">{name}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
          🏗️ MEGA
        </span>
        <span className="text-xs text-slate-500">
          {spec.floorCount}q · {spec.totalAreaM2}m² · {disciplines.length} soha
        </span>

        <div className="ml-auto flex items-center gap-3">
          {saveMsg && <span className="text-xs text-emerald-400">{saveMsg}</span>}
          <button onClick={handleSave} disabled={saveLoading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold
                       bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition">
            {saveLoading ? '⏳' : '💾 Saqlash'}
          </button>
          <button onClick={() => setEditorOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition
              ${editorOpen ? 'bg-orange-600/20 text-orange-300 border border-orange-500/30'
                           : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'}`}>
            ✏️ {editorOpen ? 'Muharrir yopish' : 'AI Muharrir'}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left sidebar — disciplines */}
        <aside className="w-48 shrink-0 border-r border-white/10 bg-black/20 flex flex-col py-2 overflow-y-auto">
          <p className="text-[10px] text-slate-600 uppercase px-4 py-2 font-semibold tracking-widest">
            Sohalar
          </p>
          {disciplines.map(d => {
            const m  = DISCIPLINE_META[d];
            const gs = gens[d];
            return (
              <button key={d} onClick={() => setActiveDisc(d)}
                className={`flex items-center gap-2 px-4 py-2.5 text-left text-xs transition
                  ${d === disc
                    ? 'bg-white/8 text-white border-r-2 border-orange-500'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <span>{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{m.labelUz}</div>
                  <div className={`text-[9px] ${gs?.status === 'done' ? 'text-emerald-400' : gs?.status === 'error' ? 'text-red-400' : 'text-slate-600'}`}>
                    {gs?.status === 'done' ? '✓ Tayyor' : gs?.status === 'error' ? '✗ Xato' : '○ Mavjud emas'}
                  </div>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Main canvas area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          {disc && (
            <div className="shrink-0 px-4 py-2 border-b border-white/10 bg-black/30 flex items-center gap-3">
              <span className="text-sm font-medium text-white flex items-center gap-1.5">
                {meta?.icon} {meta?.labelUz}
              </span>

              {/* View toggle */}
              {viewOptions.length > 1 && (
                <div className="flex gap-1 ml-2">
                  {viewOptions.map(v => (
                    <button key={v.id} onClick={() => setActiveView(v.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition
                        ${activeView === v.id
                          ? 'bg-orange-600/20 text-orange-300 border border-orange-500/30'
                          : 'text-slate-400 hover:text-white bg-white/5 border border-white/10'}`}>
                      {v.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Floor selector */}
              {floors > 1 && activeView === '2d' && (
                <div className="flex gap-1">
                  {Array.from({ length: floors }, (_, i) => i + 1).map(f => (
                    <button key={f} onClick={() => setActiveFloor(f)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition
                        ${activeFloor === f
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'text-slate-400 hover:text-white bg-white/5 border border-white/10'}`}>
                      {f}-qavat
                    </button>
                  ))}
                </div>
              )}

              <span className="ml-auto text-xs text-slate-600">
                {genState?.generatedAt
                  ? `Yaratilgan: ${new Date(genState.generatedAt).toLocaleString('uz-UZ')}`
                  : ''}
              </span>
            </div>
          )}

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-[#f8fafc] relative">
            {disc && schema ? (
              <DisciplineCanvas
                discipline={disc}
                schema={schema}
                view={activeView}
                activeFloor={activeFloor}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <div className="text-4xl mb-3">📐</div>
                  <p className="text-sm">Bu soha uchun chizma mavjud emas</p>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right panel — AI Editor */}
        {editorOpen && disc && (
          <div className="w-80 shrink-0 flex flex-col overflow-hidden border-l border-white/10">
            <DisciplineEditor
              discipline={disc}
              spec={spec}
              schema={schema}
              onSchemaUpdate={handleSchemaUpdate}
            />
          </div>
        )}
      </div>
    </div>
  );
}
