import { useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

import WarmFloorCanvas,   { WarmFloorCanvasHandle }   from '../components/WarmFloorCanvas';
import WarmFloorAxonCanvas, { WarmFloorAxonCanvasHandle } from '../components/WarmFloorAxonCanvas';
import WaterSupplyCanvas,    { WaterSupplyCanvasHandle }    from '../components/WaterSupplyCanvas';
import WaterSupply3DCanvas,  { WaterSupply3DCanvasHandle }  from '../components/WaterSupply3DCanvas';
import WaterSupplyAxonCanvas,{ WaterSupplyAxonCanvasHandle }from '../components/WaterSupplyAxonCanvas';
import SewageCanvas,         { SewageCanvasHandle }         from '../components/SewageCanvas';
import Sewage3DCanvas,       { Sewage3DCanvasHandle }       from '../components/Sewage3DCanvas';
import SewageAxonCanvas,     { SewageAxonCanvasHandle }     from '../components/SewageAxonCanvas';
import StormDrainCanvas,   { StormDrainCanvasHandle }    from '../components/StormDrainCanvas';
import StormDrain3DCanvas, { StormDrain3DCanvasHandle }  from '../components/StormDrain3DCanvas';
import BoilerRoomCanvas2D, { BoilerRoom2DHandle }        from '../components/BoilerRoomCanvas2D';
import BoilerRoomCanvas3D                                from '../components/BoilerRoomCanvas3D';
import FacadeCanvas2D                                    from '../components/FacadeCanvas2D';
import FacadeCanvas3D                                    from '../components/FacadeCanvas3D';

import type { WarmFloorSchema, WarmFloorFloor } from '../../../server/src/engine/WarmFloorEngine';
import type { WaterSupplySchema }               from '../../../server/src/engine/WaterSupplyEngine';
import type { SewageSchema }                    from '../../../server/src/engine/SewageEngine';
import type { StormDrainSchema }                from '../../../server/src/engine/StormDrainEngine';
import type { BoilerRoomSchema }               from '../../../server/src/engine/BoilerRoomEngine';
import type { FacadeSchema }                    from '../../../server/src/engine/FacadeEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

type SuperType = 'warm-floor' | 'water-supply' | 'sewage' | 'storm-drain' | 'boiler-room' | 'facade';
type ViewMode  = '2d' | '3d' | 'axon';

interface TypeMeta {
  icon: string; label: string; placeholder: string;
  apiEndpoint: string; examplePrompts: string[];
  accentColor: string; has3D: boolean; hasAxon: boolean;
}

const TYPE_META: Record<SuperType, TypeMeta> = {
  'warm-floor': {
    icon:         '♨️',
    label:        'Issiq pol isitish tizimi',
    apiEndpoint:  '/api/generate-warm-floor',
    placeholder:  'Bino va xonalar haqida tasvirlab bering...',
    accentColor:  'orange',
    has3D:        true,
    hasAxon:      false,
    examplePrompts: [
      '2 qavatli uy: 1-qavat - mehmonxona 25m², oshxona 18m², hammom 8m², koridor 12m², 2-qavat - 2ta yotoqxona 20m², 15m², vannaxona 7m², koridor 8m²',
      '1 qavatli uy: katta mehmonxona 35m², oshxona 22m², 3 yotoqxona 18m², 15m², 14m², 2 hammom 7m², 5m²',
      'Xumson uyi 2 qavatli: 1-qavat - mehmonxona 22m², ovqatxona 20m², oshxona 16m², hammom 8m², texnik 6m², 2-qavat - master yotoq 24m², 2 bola xona 18m², 15m², vannaxona 9m², garderob 6m²',
    ],
  },
  'water-supply': {
    icon:         '💧',
    label:        'Suv ta\'minoti sxemasi',
    apiEndpoint:  '/api/generate-water-supply',
    placeholder:  'Xonalar va maydonlarini kiriting...',
    accentColor:  'blue',
    has3D:        true,
    hasAxon:      true,
    examplePrompts: [
      '2 qavatli uy: 1-qavat - mehmonxona 25m², oshxona 18m², hammom 8m², koridor 12m², 2-qavat - 2ta yotoqxona 20m², 15m², vannaxona 7m², koridor 8m²',
      '1 qavatli uy: katta mehmonxona 35m², oshxona 22m², 3 yotoqxona 18m², 15m², 14m², 2 hammom 7m², 5m²',
      'Xumson uyi: mehmonxona 22m², oshxona 16m², hammom 8m², 2 yotoqxona 18m², 15m², vannaxona 9m²',
    ],
  },
  'sewage': {
    icon:         '🚽',
    label:        'Kanalizatsiya sxemasi',
    apiEndpoint:  '/api/generate-sewage',
    placeholder:  'Bino xonalari va maydonlarini kiriting...',
    accentColor:  'amber',
    has3D:        true,
    hasAxon:      true,
    examplePrompts: [
      '2 qavatli uy: 1-qavat - mehmonxona 25m², oshxona 18m², hammom 8m², koridor 12m², 2-qavat - 2ta yotoqxona 20m², 15m², vannaxona 7m², koridor 8m²',
      '1 qavatli uy: oshxona 22m², 3 yotoqxona 18m², 15m², 14m², 2 hammom 7m², 5m²',
      'Xumson uyi: oshxona 16m², hammom 8m², master yotoq 24m², 2 bola xona 18m², 15m², vannaxona 9m²',
    ],
  },
  'storm-drain': {
    icon:         '🌧️',
    label:        'Yomg\'ir suvi sxemasi',
    apiEndpoint:  '/api/generate-storm-drain',
    placeholder:  'Tom va balkonlar maydonini kiriting (m²)...',
    accentColor:  'blue',
    has3D:        true,
    hasAxon:      false,
    examplePrompts: [
      'Tom 180m², 2 ta balkon 12m², terras 35m²',
      '2 qavatli: 1-qavat - terras 45m², hovli 80m², 2-qavat - tom 160m², 2 ta balkon 15m²',
      'Xumson uyi: tom 220m², 4 ta balkon 18m², 2 ta terras 30m², hovli 120m²',
    ],
  },
  'boiler-room': {
    icon:         '🔥',
    label:        'Qozonxona tizimi',
    apiEndpoint:  '/api/generate-boiler-room',
    placeholder:  'Bino qavatlar soni va umumiy maydonini kiriting...',
    accentColor:  'red',
    has3D:        true,
    hasAxon:      false,
    examplePrompts: [
      '3 qavatli uy, umumiy maydon 450m², issiq pol tizimi bilan',
      '2 qavatli uy: jami 280m², issiq pol va issiq devorlar bilan',
      'Xumson uyi: 4 qavat, 600m², issiqlik nasosi tizimi',
    ],
  },
  'facade': {
    icon:         '🏠',
    label:        'Fasad (tashqi ko\'rinish)',
    apiEndpoint:  '/api/generate-facade',
    placeholder:  'Uy uslubi va qavatlar soni haqida yozing...',
    accentColor:  'amber',
    has3D:        true,
    hasAxon:      false,
    examplePrompts: [
      'Zamonaviy 3 qavatli villa, qora fasad, katta panoramik oynalar, yassi tom',
      'Klassik 2 qavatli kottej, g\'isht, qiyshiq tom, balkon va veranda bilan',
      'Minimalist 4 qavatli ko\'p uy, oq rangli, oddiy derazalar, tekis tom',
      '5 qavatli ko\'p qavatli turar joy, kompozit panellar, grid derazalar',
      'Industrial uslub, 2 qavat, beton devorlar, katta ombor derazalari',
    ],
  },
};

// ── Stats panels ──────────────────────────────────────────────────────────────

function WarmStatsPanel({ schema, floor }: { schema: WarmFloorSchema; floor: WarmFloorFloor }) {
  const kw = (floor.totalHeatW / 1000).toFixed(2);
  const density = floor.totalAreaM2 > 0 ? Math.round(floor.totalHeatW / floor.totalAreaM2) : 0;
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2.5 bg-slate-900/60 border-b border-white/5">
      {[
        { label: 'Maydon',    value: `${floor.totalAreaM2.toFixed(1)} m²`, color: 'text-slate-300' },
        { label: 'Yuk',       value: `${kw} кВт`,                          color: 'text-orange-400' },
        { label: 'Zichlik',   value: `${density} Вт/м²`,                  color: 'text-amber-400'  },
        { label: 'Konturlar', value: `${floor.contours.length} ta`,        color: 'text-blue-400'   },
        { label: 'Kollektor', value: `${floor.collectors.length} ta`,      color: 'text-purple-400' },
        { label: 'Xonalar',   value: `${floor.rooms.length} ta`,           color: 'text-emerald-400'},
      ].map(s => (
        <div key={s.label} className="flex flex-col px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 min-w-[80px]">
          <span className="text-[9px] text-slate-500 uppercase tracking-wide">{s.label}</span>
          <span className={`text-xs font-semibold ${s.color}`}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

function WaterStatsPanel({ schema, floorNum }: { schema: WaterSupplySchema; floorNum: number }) {
  const floor = schema.floors.find(f => f.floorNumber === floorNum) ?? schema.floors[0];
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2.5 bg-slate-900/60 border-b border-white/5">
      {[
        { label: 'Jihoz',    value: `${floor?.totalFixtures ?? 0} ta`,  color: 'text-blue-400'    },
        { label: 'Stoyak',   value: `${schema.totalRisers} ta`,         color: 'text-sky-400'     },
        { label: 'Boyler',   value: `${schema.boilerVolL}L`,            color: 'text-amber-400'   },
        { label: 'D asosiy', value: `ø${schema.mainDiamMm}mm`,         color: 'text-slate-300'   },
        { label: 'Qavatlar', value: `${schema.floors.length} ta`,       color: 'text-emerald-400' },
      ].map(s => (
        <div key={s.label} className="flex flex-col px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 min-w-[80px]">
          <span className="text-[9px] text-slate-500 uppercase tracking-wide">{s.label}</span>
          <span className={`text-xs font-semibold ${s.color}`}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

function SewageStatsPanel({ schema, floorNum }: { schema: SewageSchema; floorNum: number }) {
  const floor = schema.floors.find(f => f.floorNumber === floorNum) ?? schema.floors[0];
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2.5 bg-slate-900/60 border-b border-white/5">
      {[
        { label: 'Jihoz',    value: `${floor?.totalFixtures ?? 0} ta`,  color: 'text-amber-400'   },
        { label: 'Stoyak',   value: `${schema.totalRisers} ta`,         color: 'text-orange-400'  },
        { label: 'Spec',     value: `${schema.specItems.length} pos`,   color: 'text-slate-300'   },
        { label: 'Chiqish',  value: `ø${schema.mainOutletDiam}mm`,      color: 'text-red-400'     },
        { label: 'Qavatlar', value: `${schema.floors.length} ta`,       color: 'text-emerald-400' },
      ].map(s => (
        <div key={s.label} className="flex flex-col px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 min-w-[80px]">
          <span className="text-[9px] text-slate-500 uppercase tracking-wide">{s.label}</span>
          <span className={`text-xs font-semibold ${s.color}`}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

function StormStatsPanel({ schema, floorNum }: { schema: StormDrainSchema; floorNum: number }) {
  const floor = schema.floors.find(f => f.floorNumber === floorNum) ?? schema.floors[0];
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2.5 bg-slate-900/60 border-b border-white/5">
      {[
        { label: 'Trap',     value: `${floor?.traps.length ?? 0} ta`,      color: 'text-sky-400'     },
        { label: 'Oqim',     value: `${floor?.totalFlowLps ?? 0} л/с`,     color: 'text-blue-400'    },
        { label: 'Magistral',value: `ø${schema.mainDiamMm}mm`,             color: 'text-indigo-400'  },
        { label: 'Qiya',     value: `i=${schema.mainSlopePct}%`,           color: 'text-slate-300'   },
        { label: 'Qavatlar', value: `${schema.floors.length} ta`,          color: 'text-emerald-400' },
        { label: 'Chiqish',  value: schema.outletType,                     color: 'text-cyan-400'    },
      ].map(s => (
        <div key={s.label} className="flex flex-col px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 min-w-[80px]">
          <span className="text-[9px] text-slate-500 uppercase tracking-wide">{s.label}</span>
          <span className={`text-xs font-semibold ${s.color}`}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

function BoilerStatsPanel({ schema }: { schema: BoilerRoomSchema }) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2.5 bg-slate-900/60 border-b border-white/5">
      {[
        { label: 'Issiqlik',  value: `${schema.totalHeatKw} kW`,            color: 'text-red-400'     },
        { label: 'Nasos',     value: `${schema.heatPumpCount}x EMHP-16`,    color: 'text-orange-400'  },
        { label: 'Jihoz',     value: `${schema.equipment.length} ta`,        color: 'text-slate-300'   },
        { label: 'Qavatlar',  value: `${schema.floors} ta`,                  color: 'text-emerald-400' },
        { label: 'Spec',      value: `${schema.specItems.length} pos`,       color: 'text-amber-400'   },
      ].map(s => (
        <div key={s.label} className="flex flex-col px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 min-w-[80px]">
          <span className="text-[9px] text-slate-500 uppercase tracking-wide">{s.label}</span>
          <span className={`text-xs font-semibold ${s.color}`}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

function FacadeStatsPanel({ schema }: { schema: FacadeSchema }) {
  return (
    <div className="flex flex-wrap gap-2 px-4 py-2.5 bg-slate-900/60 border-b border-white/5">
      {[
        { label: 'Uslub',    value: schema.style,           color: 'text-amber-400'   },
        { label: 'Qavatlar', value: `${schema.floorCount} ta`, color: 'text-emerald-400' },
        { label: 'Kenglik',  value: `${schema.totalWidth}m`,  color: 'text-slate-300'   },
        { label: 'Balandlik',value: `${schema.totalHeight}m`, color: 'text-orange-400'  },
        { label: 'Material', value: schema.material,         color: 'text-sky-400'     },
        { label: 'Miqyos',   value: schema.scale,            color: 'text-purple-400'  },
      ].map(s => (
        <div key={s.label} className="flex flex-col px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 min-w-[80px]">
          <span className="text-[9px] text-slate-500 uppercase tracking-wide">{s.label}</span>
          <span className={`text-xs font-semibold ${s.color}`}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Generic floor tabs ────────────────────────────────────────────────────────
function FloorTabs({ floors, active, onChange, accent }: {
  floors: Array<{ floorNumber: number; label: string }>;
  active: number; onChange: (n: number) => void; accent: string;
}) {
  if (floors.length <= 1) return null;
  const activeClass = accent === 'blue' ? 'bg-blue-500 text-white' :
                      accent === 'amber' ? 'bg-amber-500 text-white' : 'bg-orange-500 text-white';
  return (
    <div className="flex gap-1 px-4 py-2 border-b border-white/5 bg-black/30">
      {floors.map(f => (
        <button key={f.floorNumber} onClick={() => onChange(f.floorNumber)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
            ${active === f.floorNumber ? activeClass : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ── View tabs ─────────────────────────────────────────────────────────────────
function ViewTabs({ mode, onChange, type }: { mode: ViewMode; onChange: (m: ViewMode) => void; type?: string }) {
  const views = type === 'storm-drain' ? [
    { id: '2d'   as ViewMode, icon: '📐', label: '2D Reja — traplar + quvur sxemasi' },
    { id: '3d'   as ViewMode, icon: '🔧', label: '3D Aksonometrik' },
  ] : type === 'water-supply' ? [
    { id: '2d'   as ViewMode, icon: '📐', label: '2D Reja — qavat rejasi' },
    { id: 'axon' as ViewMode, icon: '📏', label: 'Aksonometrik sxema (PDF 17)' },
    { id: '3d'   as ViewMode, icon: '🔧', label: '3D Ko\'rinish' },
  ] : type === 'sewage' ? [
    { id: '2d'   as ViewMode, icon: '📐', label: '2D Reja — qavat rejasi' },
    { id: 'axon' as ViewMode, icon: '📏', label: 'Aksonometrik sxema (PDF 16)' },
    { id: '3d'   as ViewMode, icon: '🔧', label: '3D Ko\'rinish' },
  ] : type === 'boiler-room' ? [
    { id: '2d' as ViewMode, icon: '📐', label: "Plan (yuqoridan ko'rinish)" },
    { id: '3d' as ViewMode, icon: '🔧', label: "3D Ko'rinish" },
  ] : type === 'facade' ? [
    { id: '2d' as ViewMode, icon: '📐', label: "2D Elevatsiya — 4 tomonlama fasad" },
    { id: '3d' as ViewMode, icon: '🏠', label: "3D Exterior — realistik bino modeli" },
  ] : [
    { id: '2d' as ViewMode, icon: '📐', label: '2D Reja — xona rejalari + konturlar' },
    { id: '3d' as ViewMode, icon: '🔧', label: '3D Sxema — aksonometrik quvur sxemasi' },
  ];
  return (
    <div className="flex gap-1 px-4 py-2 border-b border-white/5 bg-slate-950/40">
      {views.map(v => (
        <button key={v.id} onClick={() => onChange(v.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
            ${mode === v.id
              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
              : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'}`}>
          <span>{v.icon}</span><span>{v.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ meta, type }: { meta: TypeMeta; type: SuperType }) {
  const features: Record<SuperType, Array<{ icon: string; label: string; desc: string }>> = {
    'warm-floor': [
      { icon: '📐', label: '2D Xona rejalari', desc: 'Snake konturlar + jadval' },
      { icon: '🔧', label: '3D Aksonometrik',  desc: 'Quvur sxemasi PDF 7-8 uslub' },
      { icon: '🔩', label: 'Kollektorlar',     desc: 'Расходомер + klapanlar' },
      { icon: '📊', label: 'Isitish yuklari',  desc: 'Вт/м² · qozon quvvati' },
    ],
    'water-supply': [
      { icon: '💧', label: 'В1 Sovuq suv',   desc: 'PPR PN20 quvurlar' },
      { icon: '🔴', label: 'Т3 Issiq suv',   desc: 'Boyler + tarqatish' },
      { icon: '🔁', label: 'Т4 Sirkul',      desc: 'Sirkul nasos + kollektorlar' },
      { icon: '📋', label: 'Spetsifikatsiya', desc: 'Jihoz ro\'yxati' },
    ],
    'storm-drain': [
      { icon: '⛆', label: 'Tom traplari',    desc: 'ø110 qabul nuqtalari' },
      { icon: '↘️', label: 'Tarmoqlar',       desc: 'ø110 i=2%' },
      { icon: '⬇️', label: 'Magistral',       desc: 'ø160 i=1%' },
      { icon: '📋', label: 'Oqim hisobi',    desc: 'q=A×i×ψ л/с' },
    ],
    'sewage': [
      { icon: '⬇️', label: 'К1 Stoyaklar',   desc: 'ø110 vertikal quvurlar' },
      { icon: '↔️', label: 'Tarmoqlar',       desc: 'ø50/ø110 qiya quvurlar' },
      { icon: '🔍', label: 'Reviziyalar',     desc: '400×400 lyuklar' },
      { icon: '📋', label: 'Spetsifikatsiya', desc: 'Sanitariya jihozlari' },
    ],
    'boiler-room': [
      { icon: '🌡️', label: 'Issiqlik nasosi',  desc: 'EMHP-16Y/N8 EEC + EHB-160' },
      { icon: '🔵', label: 'ET 1000 bufer',    desc: 'Teploak\'kumulyator 1000L' },
      { icon: '💧', label: 'AI 500 boiler',    desc: '500L issiq suv' },
      { icon: '📋', label: 'Filtrlar',         desc: 'BWT R1RSF · MULTI · AQA perla' },
    ],
    'facade': [
      { icon: '🏠', label: '2D Fasad chizma',   desc: '4 tomondan professional elevatsiya' },
      { icon: '🏗️', label: '3D Ko\'rinish',     desc: 'Three.js realistik bino modeli' },
      { icon: '🪟', label: 'Oynalar va eshik',  desc: 'Panoramik, arched, grid uslublar' },
      { icon: '🏚️', label: 'Tom va balkonlar', desc: 'Flat, gable, hip, mansard, shed' },
    ],
  };
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-8">
      <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-4xl">
        {meta.icon}
      </div>
      <div>
        <h2 className="text-xl font-light text-slate-300 mb-2">{meta.label}</h2>
        <p className="text-sm text-slate-500 max-w-md leading-relaxed">
          Chap tarafda binoning ta'rifini kiriting — AI avtomatik sxema hisoblaydi.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-xs w-full">
        {features[type].map(f => (
          <div key={f.label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-900/60 border border-white/5">
            <span className="text-2xl">{f.icon}</span>
            <span className="text-[11px] font-medium text-slate-300">{f.label}</span>
            <span className="text-[10px] text-slate-600">{f.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SuperGenerator() {
  const { type }  = useParams<{ type: string }>();
  const navigate  = useNavigate();
  const { user }  = useAuth();

  const superType = (type as SuperType) ?? 'warm-floor';
  const meta      = TYPE_META[superType] ?? TYPE_META['warm-floor'];

  const [description, setDescription] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [activeFloor, setActiveFloor] = useState(1);
  const [viewMode,    setViewMode]    = useState<ViewMode>('2d');
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);

  // Schema state — one per type
  const [warmSchema,   setWarmSchema]   = useState<WarmFloorSchema | null>(null);
  const [waterSchema,  setWaterSchema]  = useState<WaterSupplySchema | null>(null);
  const [sewageSchema, setSewageSchema] = useState<SewageSchema | null>(null);
  const [stormSchema,  setStormSchema]  = useState<StormDrainSchema | null>(null);
  const [boilerSchema, setBoilerSchema] = useState<BoilerRoomSchema | null>(null);
  const [facadeSchema, setFacadeSchema] = useState<FacadeSchema | null>(null);

  // Canvas refs
  const warmCanvas2dRef   = useRef<WarmFloorCanvasHandle>(null);
  const warmCanvas3dRef   = useRef<WarmFloorAxonCanvasHandle>(null);
  const waterCanvas2dRef  = useRef<WaterSupplyCanvasHandle>(null);
  const waterCanvas3dRef  = useRef<WaterSupply3DCanvasHandle>(null);
  const sewageCanvas2dRef = useRef<SewageCanvasHandle>(null);
  const sewageCanvas3dRef = useRef<Sewage3DCanvasHandle>(null);
  const stormCanvas2dRef    = useRef<StormDrainCanvasHandle>(null);
  const stormCanvas3dRef    = useRef<StormDrain3DCanvasHandle>(null);
  const waterAxonRef        = useRef<WaterSupplyAxonCanvasHandle>(null);
  const sewageAxonRef       = useRef<SewageAxonCanvasHandle>(null);
  const boilerCanvas2dRef   = useRef<BoilerRoom2DHandle>(null);

  const hasSchema = superType === 'warm-floor'   ? !!warmSchema   :
                    superType === 'water-supply'  ? !!waterSchema  :
                    superType === 'sewage'        ? !!sewageSchema :
                    superType === 'boiler-room'   ? !!boilerSchema :
                    superType === 'facade'        ? !!facadeSchema : !!stormSchema;

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session) h['Authorization'] = `Bearer ${session.access_token}`;
    return h;
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!description.trim()) return;
    setLoading(true); setError(''); setSaved(false);
    try {
      const headers = await getHeaders();
      const res = await fetch(meta.apiEndpoint, {
        method: 'POST', headers,
        body: JSON.stringify({ description: description.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Server xatosi ${res.status}`);
      }
      const body = await res.json();
      const data = body.schema ?? body;

      if (superType === 'warm-floor') {
        setWarmSchema(data as WarmFloorSchema);
      } else if (superType === 'water-supply') {
        setWaterSchema(data as WaterSupplySchema);
      } else if (superType === 'sewage') {
        setSewageSchema(data as SewageSchema);
      } else if (superType === 'boiler-room') {
        setBoilerSchema(data as BoilerRoomSchema);
      } else if (superType === 'facade') {
        setFacadeSchema(data as FacadeSchema);
      } else {
        setStormSchema(data as StormDrainSchema);
      }
      if (data.floors) setActiveFloor(data.floors[0]?.floorNumber ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  }, [description, meta.apiEndpoint, getHeaders, superType]);

  const handleSave = useCallback(async () => {
    if (!hasSchema || !user) return;
    setSaving(true);
    try {
      const headers = await getHeaders();
      const drawingData = superType === 'warm-floor'  ? warmSchema   :
                          superType === 'water-supply' ? waterSchema  :
                          superType === 'sewage'       ? sewageSchema :
                          superType === 'boiler-room'  ? boilerSchema :
                          superType === 'facade'       ? facadeSchema : stormSchema;
      const res = await fetch('/api/projects', {
        method: 'POST', headers,
        body: JSON.stringify({ userId: user.id, name: meta.label, type: superType, drawingData }),
      });
      if (!res.ok) throw new Error('Saqlash xatoligi');
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saqlash xatoligi');
    } finally { setSaving(false); }
  }, [hasSchema, user, getHeaders, superType, warmSchema, waterSchema, sewageSchema, meta.label]);

  const handleExportPdf = useCallback(() => {
    if (superType === 'warm-floor') {
      if (viewMode === '3d') warmCanvas3dRef.current?.exportToPdf('issiq-pol-axon.pdf');
      else warmCanvas2dRef.current?.exportToPdf('issiq-pol-2d.pdf');
    } else if (superType === 'water-supply') {
      if (viewMode === '3d')   waterCanvas3dRef.current?.exportToPdf('suv-taminoti-3d.pdf');
      else if (viewMode === 'axon') waterAxonRef.current?.exportToPdf('suv-taminoti-axon.pdf');
      else waterCanvas2dRef.current?.exportToPdf('suv-taminoti-2d.pdf');
    } else if (superType === 'sewage') {
      if (viewMode === '3d')   sewageCanvas3dRef.current?.exportToPdf('kanalizatsiya-3d.pdf');
      else if (viewMode === 'axon') sewageAxonRef.current?.exportToPdf('kanalizatsiya-axon.pdf');
      else sewageCanvas2dRef.current?.exportToPdf('kanalizatsiya-2d.pdf');
    } else if (superType === 'boiler-room') {
      boilerCanvas2dRef.current?.exportToPdf('qozonxona.pdf');
    } else if (superType === 'facade') {
      // FacadeCanvas2D has no ref handle yet — placeholder
    } else {
      if (viewMode === '3d') stormCanvas3dRef.current?.exportToPdf('livnevka-3d.pdf');
      else stormCanvas2dRef.current?.exportToPdf('livnevka-2d.pdf');
    }
  }, [superType, viewMode]);

  // Accent colors
  const btnGradient = meta.accentColor === 'blue'  ? 'from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500' :
                      meta.accentColor === 'amber' ? 'from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500' :
                      meta.accentColor === 'red'   ? 'from-red-700 to-rose-600 hover:from-red-600 hover:to-rose-500' :
                      'from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500';

  // Floor lists for tabs
  const floorList = superType === 'warm-floor'   ? (warmSchema?.floors   ?? []) :
                    superType === 'water-supply'  ? (waterSchema?.floors  ?? []) :
                    superType === 'sewage'        ? (sewageSchema?.floors ?? []) :
                    superType === 'boiler-room'   ? [] :
                    superType === 'facade'        ? [] :
                    (stormSchema?.floors ?? []);

  const warmFloor   = warmSchema?.floors.find(f => f.floorNumber === activeFloor) ?? warmSchema?.floors[0];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">

      {/* Header */}
      <header className="shrink-0 px-5 py-3 border-b border-white/10 flex items-center gap-3 bg-black/40">
        <button onClick={() => navigate('/select')}
          className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-1">
          ← Orqaga
        </button>
        <span className="text-white/20">|</span>
        <span className="text-base">{meta.icon}</span>
        <span className="text-sm font-semibold text-slate-200">{meta.label}</span>
        <div className="ml-auto flex items-center gap-2">
          {hasSchema && (
            <>
              <button onClick={handleExportPdf}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700
                           border border-white/10 text-slate-300 hover:text-white transition-colors">
                📄 PDF {superType === 'warm-floor' && viewMode === '3d' ? '(3D)' : '(2D)'}
              </button>
              <button onClick={handleSave} disabled={saving || saved}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                  ${saved ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-400'
                           : 'bg-slate-800 border-white/10 text-slate-300 hover:text-white hover:bg-slate-700'}`}>
                {saving ? '...' : saved ? '✓ Saqlandi' : '💾 Saqlash'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-72 shrink-0 flex flex-col border-r border-white/8 bg-black/20">
          <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 block">Bino ta'rifi</label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder={meta.placeholder} rows={8}
                className="w-full rounded-xl bg-slate-900 border border-white/10 text-sm text-slate-200
                           placeholder:text-slate-600 p-3 resize-none focus:outline-none
                           focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition"
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate(); }}
              />
              <p className="text-[10px] text-slate-600 mt-1 text-right">Ctrl+Enter — ishga tushirish</p>
            </div>

            <button onClick={handleGenerate} disabled={loading || !description.trim()}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r ${btnGradient}
                          disabled:opacity-40 disabled:cursor-not-allowed
                          transition-all flex items-center justify-center gap-2`}>
              {loading
                ? <><span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />Hisoblanmoqda...</>
                : <>{meta.icon} Chizma yaratish</>}
            </button>

            {error && (
              <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-3">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Misollar</p>
              <div className="flex flex-col gap-2">
                {meta.examplePrompts.map((ex, i) => (
                  <button key={i} onClick={() => setDescription(ex)}
                    className="text-left px-3 py-2 rounded-lg bg-slate-900/60 border border-white/5
                               text-xs text-slate-400 hover:text-slate-200 hover:border-white/15
                               transition-colors line-clamp-3">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Warm floor system params */}
          {superType === 'warm-floor' && warmSchema && (
            <div className="shrink-0 border-t border-white/5 p-4 bg-slate-950/50">
              <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-wide">Tizim parametrlari</div>
              <div className="text-xs text-slate-400 space-y-1">
                {[
                  ['Ta\'minot', `${warmSchema.systemParams.supplyTemp}°C`, 'text-orange-400'],
                  ['Qaytish',   `${warmSchema.systemParams.returnTemp}°C`,  'text-blue-400'],
                  ['Quvur',     warmSchema.systemParams.pipeType,           'text-slate-300'],
                  ['Qozon',     `${warmSchema.heatSourceKw.toFixed(1)} кВт`,'text-emerald-400'],
                ].map(([k, v, c]) => (
                  <div key={k as string} className="flex justify-between">
                    <span>{k}</span><span className={c as string}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Water supply notes */}
          {superType === 'water-supply' && waterSchema && (
            <div className="shrink-0 border-t border-white/5 p-4 bg-slate-950/50">
              <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-wide">Eslatmalar</div>
              <div className="flex flex-col gap-1">
                {waterSchema.notes.map((n, i) => (
                  <p key={i} className="text-[10px] text-slate-500 leading-relaxed">{n}</p>
                ))}
              </div>
            </div>
          )}

          {/* Storm drain notes */}
          {superType === 'storm-drain' && stormSchema && (
            <div className="shrink-0 border-t border-white/5 p-4 bg-slate-950/50">
              <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-wide">Eslatmalar</div>
              <div className="flex flex-col gap-1">
                {stormSchema.notes.map((n, i) => (
                  <p key={i} className="text-[10px] text-slate-500 leading-relaxed">{n}</p>
                ))}
              </div>
            </div>
          )}

          {/* Sewage notes */}
          {superType === 'sewage' && sewageSchema && (
            <div className="shrink-0 border-t border-white/5 p-4 bg-slate-950/50">
              <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-wide">Eslatmalar</div>
              <div className="flex flex-col gap-1">
                {sewageSchema.notes.map((n, i) => (
                  <p key={i} className="text-[10px] text-slate-500 leading-relaxed">{n}</p>
                ))}
              </div>
            </div>
          )}

          {/* Boiler room notes */}
          {superType === 'boiler-room' && boilerSchema && (
            <div className="shrink-0 border-t border-white/5 p-4 bg-slate-950/50">
              <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-wide">Eslatmalar</div>
              <div className="flex flex-col gap-1">
                {boilerSchema.notes.map((n, i) => (
                  <p key={i} className="text-[10px] text-slate-500 leading-relaxed">{n}</p>
                ))}
              </div>
            </div>
          )}

          {/* Facade notes */}
          {superType === 'facade' && facadeSchema && (
            <div className="shrink-0 border-t border-white/5 p-4 bg-slate-950/50">
              <div className="text-[10px] text-slate-500 mb-2 uppercase tracking-wide">Arxitektura ma'lumotlari</div>
              <div className="flex flex-col gap-1">
                {facadeSchema.notes.map((n, i) => (
                  <p key={i} className="text-[10px] text-slate-500 leading-relaxed">{n}</p>
                ))}
              </div>
              {/* Color palette */}
              <div className="mt-3">
                <div className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wide">Rang paleti</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(facadeSchema.colors).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-sm border border-white/20" style={{ background: v }} />
                      <span className="text-[9px] text-slate-600">{k}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Canvas area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {hasSchema ? (
            <>
              {/* Stats */}
              {superType === 'warm-floor' && warmSchema && warmFloor && (
                <WarmStatsPanel schema={warmSchema} floor={warmFloor} />
              )}
              {superType === 'water-supply' && waterSchema && (
                <WaterStatsPanel schema={waterSchema} floorNum={activeFloor} />
              )}
              {superType === 'sewage' && sewageSchema && (
                <SewageStatsPanel schema={sewageSchema} floorNum={activeFloor} />
              )}
              {superType === 'storm-drain' && stormSchema && (
                <StormStatsPanel schema={stormSchema} floorNum={activeFloor} />
              )}
              {superType === 'boiler-room' && boilerSchema && (
                <BoilerStatsPanel schema={boilerSchema} />
              )}
              {superType === 'facade' && facadeSchema && (
                <FacadeStatsPanel schema={facadeSchema} />
              )}

              {/* View tabs — all types have 3D */}
              {meta.has3D && <ViewTabs mode={viewMode} onChange={setViewMode} type={superType} />}

              {/* Floor tabs — only in 2D mode (not in axon/3D) */}
              {viewMode === '2d' && (
                <FloorTabs floors={floorList} active={activeFloor} onChange={setActiveFloor} accent={meta.accentColor} />
              )}

              {/* Canvas */}
              <div className="flex-1 overflow-auto" style={{ background: viewMode === '3d' ? '#f8fafc' : '#ffffff' }}>
                {superType === 'warm-floor' && warmSchema && (
                  viewMode === '2d' ? (
                    <WarmFloorCanvas ref={warmCanvas2dRef} schema={warmSchema} floorNumber={activeFloor} />
                  ) : (
                    <WarmFloorAxonCanvas ref={warmCanvas3dRef} schema={warmSchema} />
                  )
                )}
                {superType === 'water-supply' && waterSchema && (
                  viewMode === 'axon' ? (
                    <WaterSupplyAxonCanvas ref={waterAxonRef} schema={waterSchema} />
                  ) : viewMode === '3d' ? (
                    <WaterSupply3DCanvas ref={waterCanvas3dRef} schema={waterSchema} />
                  ) : (
                    <WaterSupplyCanvas ref={waterCanvas2dRef} schema={waterSchema} activeFloor={activeFloor} />
                  )
                )}
                {superType === 'sewage' && sewageSchema && (
                  viewMode === 'axon' ? (
                    <SewageAxonCanvas ref={sewageAxonRef} schema={sewageSchema} />
                  ) : viewMode === '3d' ? (
                    <Sewage3DCanvas ref={sewageCanvas3dRef} schema={sewageSchema} />
                  ) : (
                    <SewageCanvas ref={sewageCanvas2dRef} schema={sewageSchema} activeFloor={activeFloor} />
                  )
                )}
                {superType === 'storm-drain' && stormSchema && (
                  viewMode === '2d' ? (
                    <StormDrainCanvas ref={stormCanvas2dRef} schema={stormSchema} activeFloor={activeFloor} />
                  ) : (
                    <StormDrain3DCanvas ref={stormCanvas3dRef} schema={stormSchema} />
                  )
                )}
                {superType === 'boiler-room' && boilerSchema && (
                  viewMode === '3d' ? (
                    <BoilerRoomCanvas3D schema={boilerSchema} />
                  ) : (
                    <BoilerRoomCanvas2D ref={boilerCanvas2dRef} schema={boilerSchema} />
                  )
                )}
                {superType === 'facade' && facadeSchema && (
                  viewMode === '3d' ? (
                    <div style={{ width: '100%', height: '100%', minHeight: 500 }}>
                      <FacadeCanvas3D schema={facadeSchema} />
                    </div>
                  ) : (
                    <FacadeCanvas2D schema={facadeSchema} />
                  )
                )}
              </div>
            </>
          ) : (
            <EmptyState meta={meta} type={superType} />
          )}
        </main>
      </div>
    </div>
  );
}
