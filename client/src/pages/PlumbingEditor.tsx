/**
 * PlumbingEditor — Santexnika loyiha muharriri
 *
 * 3 panel:
 *  Left:  ElementLibrary (Figma/gamma uslub drag & drop kutubxona)
 *  Center: Canvas (2D/3D, 6 proeksiya)
 *  Right: PropertiesPanel (tanlangan element xususiyatlari)
 *
 * Top toolbar: View switcher, Floor switcher, Layer toggle, AI Edit, Export
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { apiUrl } from '../lib/api';
import type { PlumbingProject, ViewType, FixtureType } from '../engine/plumbing-types';
import { FIXTURE_NAMES } from '../engine/plumbing-types';
import PlumbingCanvas2D from '../components/plumbing/PlumbingCanvas2D';

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const VIEWS: Array<{ id: ViewType; label: string; icon: string }> = [
  { id: 'top',    label: 'Yuqori',  icon: '⬜' },
  { id: 'front',  label: 'Old',     icon: '▭' },
  { id: 'back',   label: 'Orqa',    icon: '▭' },
  { id: 'left',   label: 'Chap',    icon: '▯' },
  { id: 'right',  label: 'O\'ng',   icon: '▯' },
  { id: 'bottom', label: 'Past',    icon: '⬜' },
  { id: '3d',     label: '3D',      icon: '◈' },
];

const LAYER_LABELS: Record<string, { label: string; color: string }> = {
  cold:       { label: 'В1 Sovuq',   color: '#1d6db5' },
  hot:        { label: 'Т3 Issiq',   color: '#c0392b' },
  circ:       { label: 'Т4 Sirkul',  color: '#d97706' },
  drain:      { label: 'К1 Kanalizatsiya', color: '#92400e' },
  fixtures:   { label: 'Jihozlar',   color: '#374151' },
  rooms:      { label: 'Xonalar',    color: '#475569' },
  dimensions: { label: 'O\'lchamlar', color: '#64748b' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ELEMENT LIBRARY PANEL
// ═══════════════════════════════════════════════════════════════════════════════

const LIBRARY_GROUPS: Array<{ title: string; items: FixtureType[] }> = [
  { title: 'Hammom',     items: ['toilet', 'sink', 'bathtub', 'shower', 'bidet', 'towel_rail'] },
  { title: 'Oshxona',    items: ['kitchen_sink', 'dishwasher', 'tap'] },
  { title: 'Yuvish xona', items: ['washing_machine', 'floor_drain'] },
];

function ElementLibrary({
  onStartDrag,
}: {
  onStartDrag: (type: FixtureType) => void;
}) {
  return (
    <div className="w-56 flex-shrink-0 border-r border-white/5 bg-[#0a0a16] flex flex-col">
      <div className="px-3 py-3 border-b border-white/5">
        <div className="text-xs font-semibold text-white/40 uppercase tracking-wider">Kutubxona</div>
      </div>
      <div className="flex-1 overflow-y-auto py-2 space-y-4 px-2">
        {LIBRARY_GROUPS.map(group => (
          <div key={group.title}>
            <div className="text-xs text-white/30 px-1 mb-1.5">{group.title}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {group.items.map(type => {
                const meta = FIXTURE_NAMES[type];
                return (
                  <button
                    key={type}
                    onMouseDown={e => { e.preventDefault(); onStartDrag(type); }}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/3 border border-white/5 hover:border-blue-500/40 hover:bg-blue-500/10 transition-all cursor-grab active:cursor-grabbing group select-none"
                  >
                    <span className="w-8 h-8 flex items-center justify-center text-white/60 group-hover:text-blue-400 pointer-events-none"
                      dangerouslySetInnerHTML={{ __html: meta.icon }} />
                    <span className="text-[10px] text-white/50 group-hover:text-blue-400 text-center leading-tight pointer-events-none">{meta.uz}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Trubalar */}
        <div>
          <div className="text-xs text-white/30 px-1 mb-1.5">Trubalar</div>
          <div className="space-y-1">
            {[
              { label: 'В1 Sovuq ø20', color: '#1d6db5' },
              { label: 'В1 Sovuq ø25', color: '#1d6db5' },
              { label: 'Т3 Issiq ø20',  color: '#c0392b' },
              { label: 'К1 Kanalizatsiya ø50',  color: '#92400e' },
              { label: 'К1 Kanalizatsiya ø110', color: '#92400e' },
            ].map(p => (
              <div key={p.label}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/3 border border-white/5 cursor-grab hover:border-white/15 transition-colors">
                <div className="w-8 h-1 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-[10px] text-white/40">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tip */}
      <div className="px-3 py-2 border-t border-white/5">
        <p className="text-[10px] text-white/20 leading-relaxed">
          Elementni bosing yoki canvasga torting
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPERTIES PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function DimInput({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  const start = () => { setText(value.toFixed(2)); setEditing(true); };
  const commit = () => {
    const v = parseFloat(text.replace(',', '.'));
    if (!isNaN(v) && v > 0.05 && v < 5) onChange(v);
    setEditing(false);
  };

  return (
    <div className="bg-white/5 hover:bg-white/10 rounded px-2 py-1.5 text-center cursor-text transition-colors"
      onClick={!editing ? start : undefined}>
      <div className="text-[9px] text-white/30 uppercase mb-0.5">{label}</div>
      {editing ? (
        <input
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className="w-full text-xs font-mono text-center bg-transparent outline-none text-orange-300 border-b border-orange-400/50"
        />
      ) : (
        <div className="text-xs font-mono text-white/70">{value.toFixed(2)}<span className="text-white/30 text-[9px]">m</span></div>
      )}
    </div>
  );
}

const PIPE_TYPE_LABELS: Record<string, { name: string; color: string }> = {
  cold:  { name: 'В1 Sovuq suv',        color: '#1d6db5' },
  hot:   { name: 'Т3 Issiq suv',         color: '#c0392b' },
  circ:  { name: 'Т4 Sirkul',            color: '#d97706' },
  drain: { name: 'К1 Kanalizatsiya',     color: '#92400e' },
};

function PropertiesPanel({
  project,
  selectedId,
  selectedPipeId,
  onRemove,
  onResize,
}: {
  project: PlumbingProject;
  selectedId: string | null;
  selectedPipeId: string | null;
  onRemove: (id: string) => void;
  onResize: (id: string, dims: { w?: number; d?: number; h?: number }) => void;
}) {
  const fix  = project.fixtures.find(f => f.id === selectedId);
  const pipe = project.pipes.find(p => p.id === selectedPipeId);

  // Pipe tanlangan holat
  if (!fix && pipe) {
    const ptype = PIPE_TYPE_LABELS[pipe.type] ?? { name: pipe.type, color: '#888' };
    const len = Math.sqrt(
      (pipe.to.x - pipe.from.x) ** 2 +
      (pipe.to.y - pipe.from.y) ** 2 +
      (pipe.to.z - pipe.from.z) ** 2
    );
    return (
      <div className="w-56 flex-shrink-0 border-l border-white/5 bg-[#0a0a16] flex flex-col">
        <div className="px-3 py-3 border-b border-white/5">
          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider">Truba</div>
        </div>
        <div className="flex-1 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: ptype.color }} />
            <span className="text-sm font-medium">{ptype.name}</span>
          </div>
          {pipe.label && <div className="text-xs text-white/40">{pipe.label}</div>}
          <div className="space-y-1.5">
            {[
              { label: 'Diametr',   val: `ø${pipe.diamMm} mm` },
              { label: 'Uzunlik',   val: `${len.toFixed(2)} m` },
              { label: 'Material',  val: pipe.material.toUpperCase() },
              { label: 'Qavat',     val: `${pipe.floor}-qavat` },
              { label: 'Stoyak',    val: pipe.isRiser ? 'Ha' : 'Yo\'q' },
            ].map(s => (
              <div key={s.label} className="flex justify-between text-xs">
                <span className="text-white/40">{s.label}</span>
                <span className="text-white/70 font-mono">{s.val}</span>
              </div>
            ))}
            {pipe.slope !== undefined && (
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Qiyalik</span>
                <span className="text-white/70 font-mono">{pipe.slope}‰</span>
              </div>
            )}
          </div>
          <div className="pt-1 text-[9px] text-white/20">
            ({pipe.from.x.toFixed(2)},{pipe.from.y.toFixed(2)},{pipe.from.z.toFixed(2)}) →<br/>
            ({pipe.to.x.toFixed(2)},{pipe.to.y.toFixed(2)},{pipe.to.z.toFixed(2)})
          </div>
        </div>
      </div>
    );
  }

  if (!fix) {
    return (
      <div className="w-56 flex-shrink-0 border-l border-white/5 bg-[#0a0a16] flex flex-col">
        <div className="px-3 py-3 border-b border-white/5">
          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider">Xususiyatlar</div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <div className="text-3xl mb-2 opacity-30">⊙</div>
            <p className="text-xs text-white/20">Element tanlang</p>
          </div>
        </div>

        {/* Stats */}
        <div className="p-3 border-t border-white/5 space-y-2">
          <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">Statistika</div>
          {[
            { label: 'Jihozlar',   val: project.stats.totalFixtures },
            { label: 'Sovuq truba', val: `${project.stats.coldPipeM}m` },
            { label: 'Issiq truba', val: `${project.stats.hotPipeM}m` },
            { label: 'Kanalizatsiya', val: `${project.stats.drainPipeM}m` },
            { label: 'Stoyaklar',  val: project.stats.totalRisers },
            { label: 'Isitgich',   val: project.stats.boilerVolL ? `${project.stats.boilerVolL}L` : '—' },
          ].map(s => (
            <div key={s.label} className="flex justify-between text-xs">
              <span className="text-white/40">{s.label}</span>
              <span className="text-white/70 font-medium">{s.val}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-56 flex-shrink-0 border-l border-white/5 bg-[#0a0a16] flex flex-col">
      <div className="px-3 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="text-xs font-semibold text-white/40 uppercase tracking-wider">Xususiyatlar</div>
        <button onClick={() => onRemove(fix.id)}
          className="text-red-400/60 hover:text-red-400 transition-colors text-xs">
          O'chir
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Fixture info */}
        <div>
          <div className="w-10 h-10 mx-auto mb-1 text-white/60 flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: FIXTURE_NAMES[fix.type]?.icon ?? '' }} />
          <div className="text-sm font-medium text-center">{fix.nameUz}</div>
          <div className="text-xs text-center text-white/40">{fix.nameRu}</div>
        </div>

        {/* Position */}
        <div className="space-y-2">
          <div className="text-xs text-white/30 uppercase tracking-wider">Pozitsiya</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['x','y','z'] as const).map(axis => (
              <div key={axis} className="bg-white/5 rounded px-2 py-1.5 text-center">
                <div className="text-[9px] text-white/30 uppercase">{axis}</div>
                <div className="text-xs font-mono text-white/70">{fix.position[axis].toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dimensions — editable */}
        <div className="space-y-1.5">
          <div className="text-xs text-white/30 uppercase tracking-wider flex items-center gap-1">
            O'lchamlar
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/>
            </svg>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <DimInput label="Kenglik" value={fix.dimensions.w}
              onChange={v => onResize(fix.id, { w: v })} />
            <DimInput label="Chuqurlik" value={fix.dimensions.d}
              onChange={v => onResize(fix.id, { d: v })} />
            <DimInput label="Balandlik" value={fix.dimensions.h}
              onChange={v => onResize(fix.id, { h: v })} />
          </div>
          <div className="text-[9px] text-white/20 px-0.5">Bosib o'zgartiring (0.05–5m)</div>
        </div>

        {/* Connections */}
        <div className="space-y-1.5">
          <div className="text-xs text-white/30 uppercase tracking-wider">Ulanishlar</div>
          {fix.coldIn && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-white/50">В1 sovuq — ø{fix.branchDiamMm}</span>
            </div>
          )}
          {fix.hotIn && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-white/50">Т3 issiq — ø{fix.branchDiamMm}</span>
            </div>
          )}
          {fix.drainOut && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-amber-700" />
              <span className="text-white/50">К1 kanalizatsiya — ø{fix.drainDiamMm}</span>
            </div>
          )}
        </div>

        {/* Floor */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Qavat</span>
          <span className="text-white/70 font-medium">{fix.floor}-qavat</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Qo'lda</span>
          <span className={fix.isManual ? 'text-orange-400' : 'text-green-400'}>
            {fix.isManual ? 'Ha' : 'AI'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI EDIT PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function AIEditPanel({
  projectId,
  onUpdate,
  onClose,
}: {
  projectId: string;
  onUpdate: (p: PlumbingProject) => void;
  onClose: () => void;
}) {
  const [msg, setMsg]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const EXAMPLES = [
    'Hammomga bitta bide qo\'sh',
    'Oshxonaga idish yuvish mashinasi qo\'sh',
    '2-qavatdagi vannaxonaga dush kabinasi qo\'sh',
    'Barcha hammomlarning vannasini dushga almashtir',
  ];

  async function handleEdit() {
    if (!msg.trim()) return;
    setLoading(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const res = await fetch(apiUrl(`/api/plumbing/${projectId}/ai-edit`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json() as { project?: PlumbingProject; error?: string };
      if (!res.ok || !data.project) throw new Error(data.error ?? 'Xatolik');
      onUpdate(data.project);
      setMsg('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-[520px] bg-[#111120] border border-white/10 rounded-2xl shadow-2xl z-30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="w-5 h-5 rounded bg-orange-500/20 flex items-center justify-center text-orange-400 text-xs">AI</span>
          AI bilan tahrirlash
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <input
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleEdit()}
            placeholder="Masalan: Hammomga bitta dush qo'sh..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-orange-500/50 placeholder-white/20"
          />
          <button onClick={handleEdit} disabled={loading || !msg.trim()}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors">
            {loading ? '...' : 'Jo\'nat'}
          </button>
        </div>

        {error && <div className="text-red-400 text-xs bg-red-500/10 rounded px-3 py-2">{error}</div>}

        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map(ex => (
            <button key={ex} onClick={() => setMsg(ex)}
              className="text-xs text-white/40 hover:text-orange-400 bg-white/3 hover:bg-orange-500/10 border border-white/5 rounded-full px-2.5 py-1 transition-all">
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function PlumbingEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  async function getToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? '';
  }

  const [project, setProjectState] = useState<PlumbingProject | null>(null);
  const projectRef = useRef<PlumbingProject | null>(null);
  const setProject = (p: PlumbingProject | null) => {
    projectRef.current = p;
    setProjectState(p);
  };
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [activeView, setActiveView]   = useState<ViewType>('top');
  const [activeFloor, setActiveFloor] = useState(1);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [selectedPipeId, setSelectedPipeId] = useState<string | null>(null);
  const [draggingLibType, setDraggingLibType] = useState<string | null>(null);
  const [showAIEdit, setShowAIEdit]   = useState(false);
  const [showLayers, setShowLayers]   = useState(false);
  const [showLibrary, setShowLibrary] = useState(true);
  const [showProps, setShowProps]     = useState(true);

  // Layer visibility (local)
  const [layerVis, setLayerVis] = useState<Record<string, boolean>>({
    cold: true, hot: true, circ: true, drain: true,
    fixtures: true, rooms: true, dimensions: true,
  });

  useEffect(() => {
    if (!id) return;
    fetchProject();
  }, [id]);

  async function fetchProject() {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(apiUrl(`/api/plumbing/${id}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json() as { project?: PlumbingProject; error?: string };
      if (!res.ok || !data.project) throw new Error(data.error ?? 'Loyiha topilmadi');
      setProject(data.project);
      setActiveView(data.project.activeView ?? 'top');
      setActiveFloor(data.project.activeFloor ?? 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const handleResizeFixture = useCallback(async (fixtureId: string, dims: { w?: number; d?: number; h?: number }) => {
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    const optimistic: PlumbingProject = {
      ...cur,
      fixtures: cur.fixtures.map(f =>
        f.id === fixtureId ? { ...f, dimensions: { ...f.dimensions, ...dims }, isManual: true } : f
      ),
    };
    setProject(optimistic);
    try {
      const token = await getToken();
      const fix = cur.fixtures.find(f => f.id === fixtureId);
      if (!fix) return;
      const newDims = { ...fix.dimensions, ...dims };
      const res = await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'resize_fixture', payload: { fixtureId, dimensions: newDims } }),
      });
      const data = await res.json() as { project?: PlumbingProject };
      if (data.project) setProject(data.project);
    } catch {}
  }, [id]);

  const handleRemoveFixture = useCallback(async (fixtureId: string) => {
    if (!id || !project) return;
    try {
      const token = await getToken();
      const res = await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'remove_fixture', payload: { fixtureId } }),
      });
      const data = await res.json() as { project?: PlumbingProject };
      if (data.project) { setProject(data.project); setSelectedId(null); }
    } catch {}
  }, [id, project]);

  const handleMoveFixture = useCallback(async (fixtureId: string, newPos: { x: number; y: number; z: number }) => {
    if (!id) return;
    // projectRef dan olish — stale closure yo'q
    const cur = projectRef.current;
    if (!cur) return;

    // 1. Optimistic update — server javobini kutmasdan local state ni yangilaymiz
    const optimistic: PlumbingProject = {
      ...cur,
      fixtures: cur.fixtures.map(f =>
        f.id === fixtureId ? { ...f, position: newPos, isManual: true } : f
      ),
    };
    setProject(optimistic);

    // 2. Server ga saqlash (background)
    try {
      const token = await getToken();
      const res = await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'move_fixture', payload: { fixtureId, position: newPos } }),
      });
      const data = await res.json() as { project?: PlumbingProject };
      // Server javobini qabul qilish — lekin faqat agar hali o'zgarmagan bo'lsa
      if (data.project) setProject(data.project);
    } catch {
      // Server xato bo'lsa optimistic state qoladi (user ko'rmaydi)
    }
  }, [id]);

  // Library element drop → canvas ga qo'yish (pozitsiya bilan)
  const handleDropFixture = useCallback(async (type: string, pos: { x: number; y: number; z: number }) => {
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    // Eng yaqin xonani topish
    const room = cur.rooms
      .filter(r => r.floor === activeFloor)
      .sort((a, b) => {
        const da = Math.hypot(a.position.x + a.width/2 - pos.x, a.position.y + a.length/2 - pos.y);
        const db = Math.hypot(b.position.x + b.width/2 - pos.x, b.position.y + b.length/2 - pos.y);
        return da - db;
      })[0];
    if (!room) return;
    setDraggingLibType(null);
    try {
      const token = await getToken();
      const res = await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'add_fixture', payload: { roomId: room.id, type, position: pos } }),
      });
      const data = await res.json() as { project?: PlumbingProject };
      if (data.project) setProject(data.project);
    } catch {}
  }, [id, activeFloor]);

  // Library element click (eski) — birinchi xonaga qo'yish
  const handleLibraryAdd = useCallback(async (type: FixtureType) => {
    if (!id || !project) return;
    const room = project.rooms.find(r => r.floor === activeFloor);
    if (!room) return;
    try {
      const token = await getToken();
      const res = await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'add_fixture', payload: { roomId: room.id, type } }),
      });
      const data = await res.json() as { project?: PlumbingProject };
      if (data.project) setProject(data.project);
    } catch {}
  }, [id, project, activeFloor]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-red-400 mb-4">{error || 'Loyiha topilmadi'}</div>
          <button onClick={() => navigate('/plumbing')} className="text-blue-400 hover:underline text-sm">
            ← Santexnika hubiga qaytish
          </button>
        </div>
      </div>
    );
  }

  const floors = Array.from({ length: project.floorCount }, (_, i) => i + 1);

  return (
    <div className="h-screen bg-[#080810] text-white flex flex-col overflow-hidden">
      {/* ── TOP TOOLBAR ─────────────────────────────────────────────────── */}
      <div className="h-12 border-b border-white/5 bg-[#0c0c18] flex items-center px-3 gap-2 flex-shrink-0">
        {/* Back */}
        <button onClick={() => navigate('/plumbing')}
          className="text-white/40 hover:text-white/70 transition-colors text-sm px-2">
          ←
        </button>
        <div className="w-px h-5 bg-white/10" />

        {/* Project name */}
        <span className="text-sm font-medium truncate max-w-[160px]">{project.name}</span>

        <div className="w-px h-5 bg-white/10" />

        {/* View switcher */}
        <div className="flex items-center gap-0.5 bg-black/30 border border-white/10 rounded-lg p-0.5">
          {VIEWS.filter(v => v.id !== '3d').map(v => (
            <button key={v.id} onClick={() => setActiveView(v.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${activeView === v.id ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white/70'}`}>
              {v.label}
            </button>
          ))}
          <button onClick={() => setActiveView('3d')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${activeView === '3d' ? 'bg-orange-600 text-white' : 'text-white/40 hover:text-white/70'}`}>
            3D
          </button>
        </div>

        <div className="w-px h-5 bg-white/10" />

        {/* Floor switcher */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-white/30">Qavat:</span>
          <div className="flex gap-0.5">
            {floors.map(f => (
              <button key={f} onClick={() => setActiveFloor(f)}
                className={`w-6 h-6 rounded text-xs font-medium transition-colors ${activeFloor === f ? 'bg-blue-600 text-white' : 'text-white/40 bg-white/5 hover:bg-white/10'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-5 bg-white/10" />

        {/* Panel toggles */}
        <button onClick={() => setShowLibrary(v => !v)}
          className={`px-2.5 py-1 rounded text-xs transition-colors ${showLibrary ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}>
          Kutubxona
        </button>
        <button onClick={() => setShowProps(v => !v)}
          className={`px-2.5 py-1 rounded text-xs transition-colors ${showProps ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}>
          Xususiyatlar
        </button>
        <button onClick={() => setShowLayers(v => !v)}
          className={`px-2.5 py-1 rounded text-xs transition-colors ${showLayers ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}>
          Qatlamlar
        </button>

        <div className="flex-1" />

        {/* AI Edit */}
        <button onClick={() => setShowAIEdit(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showAIEdit ? 'bg-orange-600 text-white' : 'bg-orange-600/20 text-orange-400 hover:bg-orange-600/40'}`}>
          <span>AI</span>
          <span>Tahrirlash</span>
        </button>

        {/* Export */}
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          PDF
        </button>
      </div>

      {/* ── MAIN AREA ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Layer panel (dropdown over canvas) */}
        {showLayers && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-[#111120] border border-white/10 rounded-xl shadow-2xl p-3">
            <div className="text-xs text-white/40 mb-2 font-semibold uppercase tracking-wider">Qatlamlar</div>
            <div className="grid grid-cols-4 gap-1.5">
              {Object.entries(LAYER_LABELS).map(([id, meta]) => (
                <button key={id}
                  onClick={() => setLayerVis(v => ({ ...v, [id]: !v[id] }))}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all border ${
                    layerVis[id]
                      ? 'bg-white/10 border-white/15 text-white'
                      : 'bg-white/3 border-white/5 text-white/30'
                  }`}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color, opacity: layerVis[id] ? 1 : 0.3 }} />
                  {meta.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Element Library */}
        {showLibrary && (
          <ElementLibrary onStartDrag={setDraggingLibType} />
        )}

        {/* Canvas */}
        <div className="flex-1 relative"
          onMouseUp={() => { if (draggingLibType) setDraggingLibType(null); }}
          onMouseLeave={() => { if (draggingLibType) setDraggingLibType(null); }}
        >
          {activeView !== '3d' ? (
            <PlumbingCanvas2D
              project={project}
              view={activeView}
              activeFloor={activeFloor}
              selectedId={selectedId}
              selectedPipeId={selectedPipeId}
              onSelectFixture={id => { setSelectedId(id); if (id) setSelectedPipeId(null); }}
              onSelectPipe={id => { setSelectedPipeId(id); if (id) setSelectedId(null); }}
              onMoveFixture={handleMoveFixture}
              onResizeFixture={handleResizeFixture}
              onRemoveFixture={handleRemoveFixture}
              onDropFixture={handleDropFixture}
              draggingLibType={draggingLibType}
              layers={layerVis}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30">
              <div className="text-center">
                <div className="text-5xl mb-4">🔷</div>
                <div className="text-sm">3D ko'rinish — tez orada</div>
                <div className="text-xs mt-1 text-white/20">Three.js integratsiyasi</div>
              </div>
            </div>
          )}

          {/* AI Edit panel */}
          {showAIEdit && (
            <AIEditPanel
              projectId={project.id}
              onUpdate={setProject}
              onClose={() => setShowAIEdit(false)}
            />
          )}

          {/* Bottom status bar */}
          <div className="absolute bottom-0 left-0 right-0 h-7 bg-black/60 border-t border-white/5 flex items-center px-3 gap-4 text-xs text-white/30">
            <span>{project.fixtures.length} jihoz</span>
            <span>{project.rooms.length} xona</span>
            <span>{project.pipes.length} truba segmenti</span>
            <span>{project.stats.totalPipeM}m jami truba</span>
            <div className="flex-1" />
            <span>В1/Т3 ø{project.stats.mainColdDiamMm}</span>
            <span>К1 ø110</span>
          </div>
        </div>

        {/* Properties Panel */}
        {showProps && (
          <PropertiesPanel
            project={project}
            selectedId={selectedId}
            selectedPipeId={selectedPipeId}
            onRemove={handleRemoveFixture}
            onResize={handleResizeFixture}
          />
        )}
      </div>
    </div>
  );
}
