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
import type { PlumbingProject, PlumbingRoom, PlumbingOpening, WallSide, ViewType, FixtureType } from '../engine/plumbing-types';
import { FIXTURE_NAMES } from '../engine/plumbing-types';
import PlumbingCanvas2D from '../components/plumbing/PlumbingCanvas2D';
import PdfExportModal from '../components/plumbing/PdfExportModal';

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
  label, value, onChange, min = 0.05, max = 30,
}: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  const start = () => { setText(value.toFixed(2)); setEditing(true); };
  const commit = () => {
    const v = parseFloat(text.replace(',', '.'));
    if (!isNaN(v) && v >= min && v <= max) onChange(v);
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

const DIAMETERS: Record<string, number[]> = {
  cold:  [15, 20, 25, 32, 40, 50],
  hot:   [15, 20, 25, 32, 40, 50],
  circ:  [15, 20, 25, 32],
  drain: [50, 75, 100, 110, 160],
};
const MATERIALS: Record<string, string[]> = {
  cold:  ['ppr', 'copper', 'hdpe'],
  hot:   ['ppr', 'copper'],
  circ:  ['ppr', 'copper'],
  drain: ['pvc', 'hdpe', 'steel'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT MENU
// ═══════════════════════════════════════════════════════════════════════════════

export type ContextMenuInfo = {
  screenX: number; screenY: number;
  roomId?: string; fixtureId?: string; pipeId?: string;
  worldPos?: { x: number; y: number };
};

function ContextMenu({
  info,
  project,
  onClose,
  onRenameRoom,
  onChangeRoomType,
  onResizeRoom,
  onRemoveRoom,
  onAddRoom,
  onRemoveFixture,
  onRemovePipe,
  activeFloor,
}: {
  info: ContextMenuInfo;
  project: PlumbingProject;
  onClose: () => void;
  onRenameRoom: (id: string, name: string) => void;
  onChangeRoomType: (id: string, type: string) => void;
  onResizeRoom: (id: string, dims: { width?: number; length?: number; shape?: Array<{x:number;y:number}>; position?: { x: number; y: number } }) => void;
  onRemoveRoom: (id: string) => void;
  onAddRoom: (pos: { x: number; y: number }, floor: number) => void;
  onRemoveFixture: (id: string) => void;
  onRemovePipe: (id: string) => void;
  activeFloor: number;
}) {
  const [renamingText, setRenamingText] = useState('');
  const [showRename, setShowRename] = useState(false);
  const [showResize, setShowResize] = useState(false);
  const [showType, setShowType] = useState(false);

  const room    = info.roomId    ? project.rooms.find(r => r.id === info.roomId)       : null;
  const fixture = info.fixtureId ? project.fixtures.find(f => f.id === info.fixtureId) : null;
  const pipe    = info.pipeId    ? project.pipes.find(p => p.id === info.pipeId)       : null;

  // Screen chiqib ketmasligi uchun pozitsiya
  const menuW = 220;
  const left = Math.min(info.screenX, window.innerWidth - menuW - 8);
  const top  = Math.min(info.screenY, window.innerHeight - 400);

  // Tashqariga bosish — yopish
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-ctx-menu]')) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
    return () => document.removeEventListener('mousedown', close);
  }, [onClose]);

  const sep = <div className="h-px bg-white/8 my-1" />;

  const MenuItem = ({ icon, label, danger, onClick }: { icon: string; label: string; danger?: boolean; onClick: () => void }) => (
    <button
      onClick={() => { onClick(); onClose(); }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left rounded-md transition-colors ${
        danger ? 'hover:bg-red-500/15 text-red-400' : 'hover:bg-white/8 text-white/75'
      }`}>
      <span className="w-4 text-center opacity-60">{icon}</span>
      {label}
    </button>
  );

  return (
    <div
      data-ctx-menu
      className="fixed z-50 bg-[#111827] border border-white/10 rounded-xl shadow-2xl py-1.5 overflow-hidden"
      style={{ left, top, width: menuW }}
    >
      {/* ── XONA ─────────────────────────────── */}
      {room && (
        <>
          <div className="px-3 py-1.5 flex items-center gap-2">
            <div className="text-[9px] text-white/30 uppercase tracking-wider flex-1">Xona</div>
            <div className="text-xs font-medium text-white/60 truncate">{room.name}</div>
          </div>
          {sep}

          {/* Nom o'zgartirish */}
          {showRename ? (
            <div className="px-3 pb-2">
              <input
                autoFocus
                value={renamingText}
                onChange={e => setRenamingText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { onRenameRoom(room.id, renamingText.trim() || room.name); onClose(); }
                  if (e.key === 'Escape') setShowRename(false);
                }}
                className="w-full bg-white/5 border border-orange-500/40 rounded px-2 py-1.5 text-xs outline-none text-orange-200"
                placeholder={room.name}
              />
              <button onClick={() => { onRenameRoom(room.id, renamingText.trim() || room.name); onClose(); }}
                className="mt-1.5 w-full bg-orange-600/80 hover:bg-orange-500 rounded py-1 text-[11px] font-medium transition-colors">
                Saqlash
              </button>
            </div>
          ) : (
            <MenuItem icon="✏" label="Nomini o'zgartirish" onClick={() => { setRenamingText(room.name); setShowRename(true); }} />
          )}

          {/* Xona turi */}
          {showType ? (
            <div className="px-3 pb-2">
              <div className="text-[9px] text-white/30 uppercase mb-1.5">Tur tanlang</div>
              <div className="grid grid-cols-2 gap-1">
                {ROOM_TYPE_OPT.map(opt => (
                  <button key={opt.value}
                    onClick={() => { onChangeRoomType(room.id, opt.value); onClose(); }}
                    className={`px-1.5 py-1 rounded text-[10px] transition-colors ${
                      room.type === opt.value ? 'bg-orange-600 text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <MenuItem icon="◈" label={`Tur: ${ROOM_TYPE_OPT.find(o => o.value === room.type)?.label ?? room.type}`}
              onClick={() => setShowType(true)} />
          )}

          {/* O'lcham */}
          {showResize ? (
            <div className="px-3 pb-2">
              <div className="text-[9px] text-white/30 uppercase mb-1.5">O'lcham (metr)</div>
              <div className="grid grid-cols-2 gap-1.5">
                <RoomDimField label="Kenglik" value={room.width} min={0.5} max={30}
                  onCommit={v => onResizeRoom(room.id, { width: v })} />
                <RoomDimField label="Uzunlik" value={room.length} min={0.5} max={30}
                  onCommit={v => onResizeRoom(room.id, { length: v })} />
              </div>
            </div>
          ) : (
            <MenuItem icon="⇔" label={`O'lcham: ${room.width.toFixed(1)}×${room.length.toFixed(1)} m`}
              onClick={() => setShowResize(true)} />
          )}

          <MenuItem icon="↕" label={`Maydoni: ${(room.width * room.length).toFixed(1)} m²`} onClick={() => {}} />

          {sep}
          <MenuItem icon="✕" label="Xonani o'chirish" danger onClick={() => { onRemoveRoom(room.id); }} />
        </>
      )}

      {/* ── JIHOZ ─────────────────────────────── */}
      {fixture && !room && (
        <>
          <div className="px-3 py-1.5">
            <div className="text-[9px] text-white/30 uppercase tracking-wider">Jihoz</div>
            <div className="text-xs font-medium text-white/70 mt-0.5">{fixture.nameUz}</div>
          </div>
          {sep}
          <MenuItem icon="✕" label="Jihozni o'chirish" danger onClick={() => onRemoveFixture(fixture.id)} />
        </>
      )}

      {/* ── TRUBA ─────────────────────────────── */}
      {pipe && !room && !fixture && (
        <>
          <div className="px-3 py-1.5">
            <div className="text-[9px] text-white/30 uppercase tracking-wider">Truba</div>
            <div className="text-xs font-medium text-white/70 mt-0.5">{pipe.type} ø{pipe.diamMm}</div>
          </div>
          {sep}
          <MenuItem icon="✕" label="Trubani o'chirish" danger onClick={() => onRemovePipe(pipe.id)} />
        </>
      )}

      {/* ── BO'SH JOY ─────────────────────────── */}
      {!room && !fixture && !pipe && info.worldPos && (
        <>
          <div className="px-3 py-1.5">
            <div className="text-[9px] text-white/30 uppercase tracking-wider">Bo'sh joy</div>
          </div>
          {sep}
          <MenuItem icon="+" label="Bu yerga yangi xona" onClick={() => {
            onAddRoom(info.worldPos!, activeFloor);
          }} />
        </>
      )}
    </div>
  );
}

function RoomDimField({ label, value, min, max, onCommit }: {
  label: string; value: number; min: number; max: number; onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(value.toFixed(1));
  return (
    <div>
      <div className="text-[9px] text-white/30 mb-0.5">{label}</div>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => { const v = parseFloat(text); if (!isNaN(v) && v >= min && v <= max) onCommit(v); }}
        onKeyDown={e => { if (e.key === 'Enter') { const v = parseFloat(text); if (!isNaN(v) && v >= min && v <= max) onCommit(v); } }}
        className="w-full bg-white/5 border border-white/10 rounded px-1.5 py-1 text-xs outline-none focus:border-orange-500/50 text-white/80"
      />
    </div>
  );
}

const ROOM_TYPE_OPT: Array<{ value: PlumbingRoom['type']; label: string }> = [
  { value: 'bathroom',  label: 'Hammom' },
  { value: 'kitchen',   label: 'Oshxona' },
  { value: 'laundry',   label: 'Yuvish' },
  { value: 'toilet',    label: 'Hojatxona' },
  { value: 'utility',   label: 'Xizmat' },
  { value: 'other',     label: 'Boshqa' },
];

const ROOM_TYPE_OPTIONS: Array<{ value: PlumbingRoom['type']; label: string }> = [
  { value: 'bathroom',  label: 'Hammom' },
  { value: 'kitchen',   label: 'Oshxona' },
  { value: 'laundry',   label: 'Yuvish xona' },
  { value: 'toilet',    label: 'Hojatxona' },
  { value: 'utility',   label: 'Xizmat xona' },
  { value: 'other',     label: 'Boshqa' },
];

function RoomPanel({
  room,
  openings,
  onRename,
  onChangeType,
  onResize,
  onRemove,
  onAddOpening,
  onRemoveOpening,
}: {
  room: PlumbingRoom;
  openings: PlumbingOpening[];
  onRename: (name: string) => void;
  onChangeType: (type: string) => void;
  onResize: (dims: { width?: number; length?: number; shape?: Array<{x:number;y:number}> }) => void;
  onRemove: () => void;
  onAddOpening: (o: PlumbingOpening) => void;
  onRemoveOpening: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  const startEdit = () => { setText(room.name); setEditing(true); };
  const commit = () => {
    const v = text.trim();
    if (v && v !== room.name) onRename(v);
    setEditing(false);
  };

  return (
    <div className="w-56 flex-shrink-0 border-l border-white/5 bg-[#0a0a16] flex flex-col">
      <div className="px-3 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="text-xs font-semibold text-white/40 uppercase tracking-wider">Xona</div>
        <button onClick={onRemove} className="text-red-400/60 hover:text-red-400 transition-colors text-xs">
          O'chir
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Nom */}
        <div className="space-y-1.5">
          <div className="text-xs text-white/30 uppercase tracking-wider">Nomi</div>
          {editing ? (
            <input
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              onBlur={commit}
              onKeyDown={e => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-full bg-white/5 border border-orange-500/50 rounded px-2 py-1.5 text-sm outline-none text-orange-300"
            />
          ) : (
            <div
              onClick={startEdit}
              className="flex items-center justify-between bg-white/5 hover:bg-white/10 rounded px-2 py-1.5 cursor-text transition-colors group"
            >
              <span className="text-sm text-white/80">{room.name}</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="text-white/20 group-hover:text-orange-400 flex-shrink-0">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/>
              </svg>
            </div>
          )}
        </div>

        {/* Tur */}
        <div className="space-y-1.5">
          <div className="text-xs text-white/30 uppercase tracking-wider">Xona turi</div>
          <div className="grid grid-cols-2 gap-1">
            {ROOM_TYPE_OPTIONS.map(opt => (
              <button key={opt.value}
                onClick={() => onChangeType(opt.value)}
                className={`px-1.5 py-1 rounded text-[10px] transition-colors ${
                  room.type === opt.value
                    ? 'bg-orange-600 text-white'
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* O'lchamlar */}
        <div className="space-y-1.5">
          <div className="text-xs text-white/30 uppercase tracking-wider">O'lchamlar</div>
          <div className="grid grid-cols-2 gap-1.5">
            <DimInput label="Kenglik" value={room.width} min={0.5} max={30}
              onChange={v => onResize({ width: v })} />
            <DimInput label="Uzunlik" value={room.length} min={0.5} max={30}
              onChange={v => onResize({ length: v })} />
          </div>
          <div className="text-[9px] text-white/20 px-0.5">Bosib o'zgartiring yoki corner ni torting</div>
        </div>

        {/* Info */}
        <div className="space-y-1.5">
          {[
            { label: 'Maydoni',    val: `${(room.width * room.length).toFixed(2)} m²` },
            { label: 'Balandlik',  val: `${room.height.toFixed(2)} m` },
            { label: 'Qavat',      val: `${room.floor}-qavat` },
            { label: 'Jihozlar',   val: `${room.fixtureIds.length} ta` },
          ].map(s => (
            <div key={s.label} className="flex justify-between text-xs">
              <span className="text-white/40">{s.label}</span>
              <span className="text-white/70 font-mono">{s.val}</span>
            </div>
          ))}
        </div>

        {/* Shakl */}
        <div className="space-y-1.5">
          <div className="text-xs text-white/30 uppercase tracking-wider">Shakl</div>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => onResize({ shape: undefined })}
              className={`px-1.5 py-1.5 rounded text-[10px] transition-colors ${
                !room.shape ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'
              }`}>
              ▭ To'rtburchak
            </button>
            <button
              onClick={() => {
                const w = room.width, l = room.length;
                // L-shakl: to'rtburchak + pastki-o'ng burchak kesib olingan
                onResize({ shape: [
                  {x:0,   y:0  }, {x:w,   y:0  }, {x:w,   y:l*0.5},
                  {x:w*0.5,y:l*0.5},{x:w*0.5,y:l},{x:0,   y:l  },
                ]});
              }}
              className={`px-1.5 py-1.5 rounded text-[10px] transition-colors ${
                room.shape ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'
              }`}>
              ⌐ L-shakl
            </button>
          </div>
          {room.shape && (
            <div className="text-[9px] text-white/20">
              {room.shape.length} ta nuqta — drag qiling
            </div>
          )}
        </div>

        {/* Eshik / Deraza */}
        <div className="space-y-1.5">
          <div className="text-xs text-white/30 uppercase tracking-wider flex items-center justify-between">
            <span>Eshik / Deraza</span>
            <div className="flex gap-1">
              {(['north','south','east','west'] as WallSide[]).map(side => (
                <button key={side}
                  title={`${side} devoriga eshik qo'sh`}
                  onClick={() => onAddOpening({
                    id: `op-${Date.now()}`,
                    roomId: room.id,
                    side,
                    offset: 0.3,
                    width: 0.9,
                    type: 'door',
                    swingIn: true,
                  })}
                  className="text-[9px] px-1 py-0.5 bg-white/5 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-white/70">
                  +🚪{side[0].toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {openings.length > 0 ? (
            <div className="space-y-1">
              {openings.map(op => (
                <div key={op.id} className="flex items-center justify-between bg-white/5 rounded px-2 py-1">
                  <span className="text-[10px] text-white/60">
                    {op.type === 'door' ? '🚪' : '🪟'} {op.side} {op.width}m
                  </span>
                  <button onClick={() => onRemoveOpening(op.id)}
                    className="text-red-400/50 hover:text-red-400 text-[10px] transition-colors">✕</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[9px] text-white/20">Eshik/deraza yo'q — + tugmasini bosing</div>
          )}
        </div>

        <div className="text-[9px] text-white/20 pt-1">
          Backspace — o'chirish | 2x bosish — yangi xona
        </div>
      </div>
    </div>
  );
}

function PropertiesPanel({
  project,
  selectedId,
  selectedPipeId,
  selectedRoomId,
  onRemove,
  onResize,
  onUpdatePipe,
  onRemovePipe,
  onRenameRoom,
  onChangeRoomType,
  onResizeRoom,
  onRemoveRoom,
  onAddOpening,
  onRemoveOpening,
}: {
  project: PlumbingProject;
  selectedId: string | null;
  selectedPipeId: string | null;
  selectedRoomId: string | null;
  onRemove: (id: string) => void;
  onResize: (id: string, dims: { w?: number; d?: number; h?: number }) => void;
  onUpdatePipe: (id: string, patch: Record<string, unknown>) => void;
  onRemovePipe: (id: string) => void;
  onRenameRoom: (id: string, name: string) => void;
  onChangeRoomType: (id: string, type: string) => void;
  onResizeRoom: (id: string, dims: { width?: number; length?: number; shape?: Array<{x:number;y:number}>; position?: { x: number; y: number } }) => void;
  onRemoveRoom: (id: string) => void;
  onAddOpening: (o: PlumbingOpening) => void;
  onRemoveOpening: (id: string) => void;
}) {
  const fix  = project.fixtures.find(f => f.id === selectedId);
  const pipe = project.pipes.find(p => p.id === selectedPipeId);
  const room = project.rooms.find(r => r.id === selectedRoomId);

  // Xona tanlangan holat
  if (!fix && !pipe && room) {
    return (
      <RoomPanel
        room={room}
        openings={(project.openings ?? []).filter(o => o.roomId === room.id)}
        onRename={name => onRenameRoom(room.id, name)}
        onChangeType={type => onChangeRoomType(room.id, type)}
        onResize={dims => onResizeRoom(room.id, dims)}
        onRemove={() => onRemoveRoom(room.id)}
        onAddOpening={onAddOpening}
        onRemoveOpening={onRemoveOpening}
      />
    );
  }

  // Pipe tanlangan holat
  if (!fix && pipe) {
    const ptype = PIPE_TYPE_LABELS[pipe.type] ?? { name: pipe.type, color: '#888' };
    const len = Math.sqrt(
      (pipe.to.x - pipe.from.x) ** 2 +
      (pipe.to.y - pipe.from.y) ** 2 +
      (pipe.to.z - pipe.from.z) ** 2
    );
    const diams = DIAMETERS[pipe.type] ?? [20, 25, 32, 50, 110];
    const mats  = MATERIALS[pipe.type] ?? ['ppr', 'pvc'];

    return (
      <div className="w-56 flex-shrink-0 border-l border-white/5 bg-[#0a0a16] flex flex-col">
        <div className="px-3 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider">Truba</div>
          <button onClick={() => onRemovePipe(pipe.id)}
            className="text-red-400/60 hover:text-red-400 transition-colors text-xs">
            O'chir
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Tip */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ptype.color }} />
            <span className="text-sm font-medium">{ptype.name}</span>
          </div>
          {pipe.label && <div className="text-xs text-white/30 font-mono">{pipe.label}</div>}

          {/* Diametr */}
          <div className="space-y-1.5">
            <div className="text-xs text-white/30 uppercase tracking-wider">Diametr</div>
            <div className="flex flex-wrap gap-1">
              {diams.map(d => (
                <button key={d}
                  onClick={() => onUpdatePipe(pipe.id, { diamMm: d })}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                    pipe.diamMm === d
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}>
                  ø{d}
                </button>
              ))}
            </div>
          </div>

          {/* Material */}
          <div className="space-y-1.5">
            <div className="text-xs text-white/30 uppercase tracking-wider">Material</div>
            <div className="flex flex-wrap gap-1">
              {mats.map(m => (
                <button key={m}
                  onClick={() => onUpdatePipe(pipe.id, { material: m })}
                  className={`px-2 py-0.5 rounded text-xs uppercase transition-colors ${
                    pipe.material === m
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="space-y-1.5">
            {[
              { label: 'Uzunlik', val: `${len.toFixed(2)} m` },
              { label: 'Qavat',   val: `${pipe.floor}-qavat` },
              { label: 'Stoyak',  val: pipe.isRiser ? 'Ha' : "Yo'q" },
              ...(pipe.slope !== undefined ? [{ label: 'Qiyalik', val: `${pipe.slope}‰` }] : []),
            ].map(s => (
              <div key={s.label} className="flex justify-between text-xs">
                <span className="text-white/40">{s.label}</span>
                <span className="text-white/70 font-mono">{s.val}</span>
              </div>
            ))}
          </div>

          <div className="text-[9px] text-white/20 font-mono leading-relaxed">
            ({pipe.from.x.toFixed(2)},{pipe.from.y.toFixed(2)},{pipe.from.z.toFixed(2)})→<br/>
            ({pipe.to.x.toFixed(2)},{pipe.to.y.toFixed(2)},{pipe.to.z.toFixed(2)})
          </div>

          <div className="text-[9px] text-white/20 pt-1">
            Backspace — o'chirish
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
  const projectRef  = useRef<PlumbingProject | null>(null);
  const undoStack   = useRef<PlumbingProject[]>([]);
  const [undoCount, setUndoCount] = useState(0); // for toolbar indicator

  // setProject — har chaqiruvda avvalgi holatni undo stack ga qo'shadi
  const setProject = (p: PlumbingProject | null, pushUndo = true) => {
    if (pushUndo && projectRef.current && p) {
      undoStack.current = [...undoStack.current.slice(-49), projectRef.current];
      setUndoCount(undoStack.current.length);
    }
    projectRef.current = p;
    setProjectState(p);
  };

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [activeView, setActiveView]   = useState<ViewType>('top');
  const [activeFloor, setActiveFloor] = useState(1);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [selectedPipeId, setSelectedPipeId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [draggingLibType, setDraggingLibType] = useState<string | null>(null);
  const [drawPipeMode, setDrawPipeMode] = useState<{ type: string; material: string; diamMm: number } | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showAIEdit, setShowAIEdit]   = useState(false);
  const [snipCalcResult, setSnipCalcResult] = useState<{ notes: string[]; pipes: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuInfo | null>(null);
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
      setProject(data.project, false); // initial load — undo stack ga qo'shmaslik
      setActiveView(data.project.activeView ?? 'top');
      setActiveFloor(data.project.activeFloor ?? 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const handleUndo = useCallback(async () => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current[undoStack.current.length - 1];
    undoStack.current = undoStack.current.slice(0, -1);
    setUndoCount(undoStack.current.length);
    // pushUndo=false — undo o'zini stackga qo'shmasin
    setProject(prev, false);
    // Server ga to'liq holatni saqlash
    try {
      const token = await getToken();
      await fetch(apiUrl(`/api/plumbing/${id}/restore`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project: prev }),
      });
    } catch {}
  }, [id]);

  // Ctrl+Z global listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo]);

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
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    // Optimistic: darhol o'chirib ko'rsatish
    const optimistic: PlumbingProject = {
      ...cur,
      rooms: cur.rooms.map(r => ({ ...r, fixtureIds: r.fixtureIds.filter(fid => fid !== fixtureId) })),
      fixtures: cur.fixtures.filter(f => f.id !== fixtureId),
    };
    setProject(optimistic);
    setSelectedId(null);
    try {
      const token = await getToken();
      const res = await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'remove_fixture', payload: { fixtureId } }),
      });
      const data = await res.json() as { project?: PlumbingProject };
      if (data.project) setProject(data.project);
    } catch {}
  }, [id]);

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

  const handleUpdateLabel = useCallback(async (key: string, override: { dx: number; dy: number; fontSize?: number } | null) => {
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    const overrides = { ...(cur.labelOverrides ?? {}) };
    if (override === null) { delete overrides[key]; }
    else { overrides[key] = override; }
    setProject({ ...cur, labelOverrides: overrides }, false); // undo ga qo'shmaslik (drag paytida)
    try {
      const token = await getToken();
      await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'update_label', payload: { key, override } }),
      });
    } catch (err) { console.error('label update error', err); }
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

  // Pipe update (diametr, material)
  const handleUpdatePipe = useCallback(async (pipeId: string, patch: Record<string, unknown>) => {
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    const optimistic: PlumbingProject = {
      ...cur,
      pipes: cur.pipes.map(p => p.id === pipeId ? { ...p, ...patch } : p),
    };
    setProject(optimistic);
    try {
      const token = await getToken();
      await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'update_pipe', payload: { pipeId, patch } }),
      });
    } catch {}
  }, [id]);

  // Pipe o'chirish
  const handleRemovePipe = useCallback(async (pipeId: string) => {
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    const optimistic: PlumbingProject = {
      ...cur,
      pipes: cur.pipes.filter(p => p.id !== pipeId),
    };
    setProject(optimistic);
    setSelectedPipeId(null);
    try {
      const token = await getToken();
      await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'remove_pipe', payload: { pipeId } }),
      });
    } catch {}
  }, [id]);

  // Pipe endpoint drag commit
  const handleMovePipeEndpoint = useCallback(async (
    pipeId: string,
    end: 'from' | 'to',
    pos: { x: number; y: number; z: number }
  ) => {
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    const optimistic: PlumbingProject = {
      ...cur,
      pipes: cur.pipes.map(p => p.id === pipeId ? { ...p, [end]: pos } : p),
    };
    setProject(optimistic);
    try {
      const token = await getToken();
      const pipe = cur.pipes.find(p => p.id === pipeId);
      if (!pipe) return;
      const patch = { [end]: pos };
      await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'update_pipe', payload: { pipeId, patch } }),
      });
    } catch {}
  }, [id]);

  // Yangi quvur qo'shish
  const handleAddPipe = useCallback(async (pipe: {
    type: string; material: string; diamMm: number;
    from: { x: number; y: number; z: number };
    to:   { x: number; y: number; z: number };
    floor: number;
  }) => {
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    const newPipe = {
      id: `pipe-manual-${Date.now()}`,
      isRiser: false, isMain: false,
      ...pipe,
      type: pipe.type as import('../engine/plumbing-types').PipeType,
      material: pipe.material as import('../engine/plumbing-types').PipeMaterial,
    };
    const optimistic: PlumbingProject = { ...cur, pipes: [...cur.pipes, newPipe] };
    setProject(optimistic);
    try {
      const token = await getToken();
      await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'add_pipe', payload: { pipe: newPipe } }),
      });
    } catch {}
  }, [id]);

  // Xona nomini o'zgartirish
  const handleRenameRoom = useCallback(async (roomId: string, name: string) => {
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    const optimistic: PlumbingProject = {
      ...cur,
      rooms: cur.rooms.map(r => r.id === roomId ? { ...r, name } : r),
    };
    setProject(optimistic);
    try {
      const token = await getToken();
      await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'rename_room', payload: { roomId, name } }),
      });
    } catch {}
  }, [id]);

  const handleAddOpening = useCallback(async (opening: import('../engine/plumbing-types').PlumbingOpening) => {
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    const optimistic: PlumbingProject = {
      ...cur,
      openings: [...(cur.openings ?? []), opening],
    };
    setProject(optimistic);
    try {
      const token = await getToken();
      await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'add_opening', payload: { opening } }),
      });
    } catch {}
  }, [id]);

  const handleRemoveOpening = useCallback(async (openingId: string) => {
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    const optimistic: PlumbingProject = {
      ...cur,
      openings: (cur.openings ?? []).filter(o => o.id !== openingId),
    };
    setProject(optimistic);
    try {
      const token = await getToken();
      await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'remove_opening', payload: { openingId } }),
      });
    } catch {}
  }, [id]);

  const handleCalcDiameters = useCallback(async () => {
    if (!id) return;
    try {
      const token = await getToken();
      const res = await fetch(apiUrl(`/api/plumbing/${id}/calc-diameters`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { project?: PlumbingProject; result?: { notes: string[]; pipes: Array<unknown> } };
      if (data.project) setProject(data.project);
      if (data.result) setSnipCalcResult({ notes: data.result.notes, pipes: data.result.pipes.length });
      setTimeout(() => setSnipCalcResult(null), 6000);
    } catch {}
  }, [id]);

  const handleMoveRiser = useCallback(async (riserId: string, pos: { x: number; y: number }) => {
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    const optimistic: PlumbingProject = {
      ...cur,
      risers: cur.risers.map(r => r.id === riserId ? { ...r, x: pos.x, y: pos.y } : r),
    };
    setProject(optimistic);
    try {
      const token = await getToken();
      await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'move_riser', payload: { riserId, position: pos } }),
      });
    } catch {}
  }, [id]);

  const handleMoveRoom = useCallback(async (roomId: string, pos: { x: number; y: number }) => {
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    const optimistic: PlumbingProject = {
      ...cur,
      rooms: cur.rooms.map(r => r.id === roomId ? { ...r, position: pos } : r),
    };
    setProject(optimistic);
    try {
      const token = await getToken();
      await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'move_room', payload: { roomId, position: pos } }),
      });
    } catch {}
  }, [id]);

  const handleResizeRoom = useCallback(async (roomId: string, dims: { width?: number; length?: number; shape?: Array<{x:number;y:number}>; position?: { x: number; y: number } }) => {
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    const { position, ...rest } = dims;
    const optimistic: PlumbingProject = {
      ...cur,
      rooms: cur.rooms.map(r => r.id === roomId
        ? { ...r, ...rest, ...(position ? { position } : {}) }
        : r
      ),
    };
    setProject(optimistic);
    try {
      const token = await getToken();
      await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'resize_room', payload: { roomId, dims } }),
      });
    } catch {}
  }, [id]);

  const handleRemoveRoom = useCallback(async (roomId: string) => {
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    const removedFixIds = cur.rooms.find(r => r.id === roomId)?.fixtureIds ?? [];
    const optimistic: PlumbingProject = {
      ...cur,
      rooms: cur.rooms.filter(r => r.id !== roomId),
      fixtures: cur.fixtures.filter(f => !removedFixIds.includes(f.id)),
      pipes: cur.pipes.filter(p => !removedFixIds.some(fid => p.id.includes(fid))),
    };
    setProject(optimistic);
    setSelectedRoomId(null);
    try {
      const token = await getToken();
      await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'remove_room', payload: { roomId } }),
      });
    } catch {}
  }, [id]);

  const handleAddRoom = useCallback(async (pos: { x: number; y: number }, floor: number) => {
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    const newRoom = {
      id: `room-manual-${Date.now()}`,
      name: 'Yangi xona',
      nameRu: 'Новое помещение',
      type: 'other' as const,
      floor,
      position: pos,
      width: 3,
      length: 3,
      height: cur.floorHeight,
      fixtureIds: [],
    };
    const optimistic: PlumbingProject = { ...cur, rooms: [...cur.rooms, newRoom] };
    setProject(optimistic);
    setSelectedRoomId(newRoom.id);
    try {
      const token = await getToken();
      await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'add_room', payload: { room: newRoom } }),
      });
    } catch {}
  }, [id]);

  const handleChangeRoomType = useCallback(async (roomId: string, type: string) => {
    if (!id) return;
    const cur = projectRef.current;
    if (!cur) return;
    const optimistic: PlumbingProject = {
      ...cur,
      rooms: cur.rooms.map(r => r.id === roomId ? { ...r, type: type as PlumbingRoom['type'] } : r),
    };
    setProject(optimistic);
    try {
      const token = await getToken();
      await fetch(apiUrl(`/api/plumbing/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'change_room_type', payload: { roomId, type } }),
      });
    } catch {}
  }, [id]);

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

        {/* Quvur chizish mode */}
        {activeView === 'top' && (
          <div className="flex items-center gap-0.5 bg-black/30 border border-white/10 rounded-lg p-0.5">
            <button onClick={() => setDrawPipeMode(m => m ? null : { type: 'cold', material: 'ppr', diamMm: 20 })}
              title="Quvur chizish (Top view da 2 nuqta bosing)"
              className={`px-2 py-1 rounded text-xs transition-colors ${drawPipeMode ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white/60'}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-1">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="15,8 19,12 15,16"/>
              </svg>
              Truba
            </button>
            {drawPipeMode && (
              <>
                {(['cold','hot','drain'] as const).map(t => (
                  <button key={t} onClick={() => setDrawPipeMode(m => m ? { ...m, type: t } : null)}
                    className={`px-1.5 py-1 rounded text-[10px] transition-colors ${drawPipeMode.type === t ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/60'}`}>
                    {t === 'cold' ? 'В1' : t === 'hot' ? 'Т3' : 'К1'}
                  </button>
                ))}
                <button onClick={() => { setDrawPipeMode(null); }}
                  className="px-1.5 py-1 rounded text-[10px] text-red-400 hover:bg-red-500/10 transition-colors">
                  ✕
                </button>
              </>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Undo */}
        <button
          onClick={handleUndo}
          disabled={undoCount === 0}
          title="Ctrl+Z — Bekor qilish"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 rounded-lg text-xs transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9,14 4,9 9,4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/>
          </svg>
          {undoCount > 0 && <span className="text-white/40">{undoCount}</span>}
        </button>

        {/* SNiP hisob */}
        <button onClick={handleCalcDiameters}
          title="SNiP 2.04.01-85 bo'yicha quvur diametrlarini qayta hisoblash"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
          </svg>
          SNiP
        </button>

        {/* AI Edit */}
        <button onClick={() => setShowAIEdit(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showAIEdit ? 'bg-orange-600 text-white' : 'bg-orange-600/20 text-orange-400 hover:bg-orange-600/40'}`}>
          <span>AI</span>
          <span>Tahrirlash</span>
        </button>

        {/* Export */}
        <button onClick={() => setShowPdfModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          PDF
        </button>
        <button onClick={() => { import('../utils/exportPlumbingDXF').then(m => m.exportPlumbingDXF(project)); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs transition-colors"
          title="AutoCAD DXF formatida eksport">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          DXF
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
              selectedRoomId={selectedRoomId}
              onSelectFixture={fid => { setSelectedId(fid); if (fid) { setSelectedPipeId(null); setSelectedRoomId(null); } }}
              onSelectPipe={pid => { setSelectedPipeId(pid); if (pid) { setSelectedId(null); setSelectedRoomId(null); } }}
              onSelectRoom={rid => { setSelectedRoomId(rid); if (rid) { setSelectedId(null); setSelectedPipeId(null); } }}
              onMoveRiser={handleMoveRiser}
              onMoveFixture={handleMoveFixture}
              onResizeFixture={handleResizeFixture}
              onRemoveFixture={handleRemoveFixture}
              onRemovePipe={handleRemovePipe}
              onMoveRoom={handleMoveRoom}
              onResizeRoom={handleResizeRoom}
              onRemoveRoom={handleRemoveRoom}
              onAddRoom={handleAddRoom}
              onMovePipeEndpoint={handleMovePipeEndpoint}
              onAddPipe={handleAddPipe}
              onDropFixture={handleDropFixture}
              draggingLibType={draggingLibType}
              drawPipeMode={drawPipeMode}
              layers={layerVis}
              onShowContextMenu={setContextMenu}
              onUpdateLabel={handleUpdateLabel}
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

          {/* SNiP natija toast */}
          {snipCalcResult && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-emerald-900/95 border border-emerald-500/40 rounded-xl shadow-2xl px-4 py-3 max-w-md">
              <div className="flex items-start gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
                <div>
                  <div className="text-sm font-medium text-emerald-300">SNiP hisob yakunlandi</div>
                  <div className="text-xs text-emerald-400/70 mt-0.5">{snipCalcResult.pipes} ta quvur diametri yangilandi</div>
                  {snipCalcResult.notes.slice(0, 3).map((n, i) => (
                    <div key={i} className="text-[10px] text-emerald-400/50 mt-0.5">{n}</div>
                  ))}
                </div>
                <button onClick={() => setSnipCalcResult(null)} className="text-emerald-400/50 hover:text-emerald-300 ml-1">×</button>
              </div>
            </div>
          )}

          {/* Context Menu */}
          {contextMenu && (
            <ContextMenu
              info={contextMenu}
              project={project}
              onClose={() => setContextMenu(null)}
              onRenameRoom={handleRenameRoom}
              onChangeRoomType={handleChangeRoomType}
              onResizeRoom={handleResizeRoom}
              onRemoveRoom={handleRemoveRoom}
              onAddRoom={handleAddRoom}
              onRemoveFixture={handleRemoveFixture}
              onRemovePipe={handleRemovePipe}
              activeFloor={activeFloor}
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
            selectedRoomId={selectedRoomId}
            onRemove={handleRemoveFixture}
            onResize={handleResizeFixture}
            onUpdatePipe={handleUpdatePipe}
            onRemovePipe={handleRemovePipe}
            onRenameRoom={handleRenameRoom}
            onChangeRoomType={handleChangeRoomType}
            onResizeRoom={handleResizeRoom}
            onRemoveRoom={handleRemoveRoom}
            onAddOpening={handleAddOpening}
            onRemoveOpening={handleRemoveOpening}
          />
        )}
      </div>

      {/* PDF Export Modal */}
      {showPdfModal && (
        <PdfExportModal
          project={project}
          onClose={() => setShowPdfModal(false)}
        />
      )}
    </div>
  );
}
