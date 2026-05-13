/**
 * PlumbingCanvas2D — Professional arxitektura plani uslubida santexnika chizmasi
 *
 * Standart: GOST 21.601-2011 (Suv ta'minoti va kanalizatsiya)
 * Uslub: Rasmiy arxitektura chizmasi — devor qalinligi, o'lcham chiziqlari,
 *        professional fixture belgilari, legenda, shtamp, ko'rinish satri
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { PlumbingProject, PlumbingFixture, PlumbingPipeSegment, PlumbingOpening, ViewType } from '../../engine/plumbing-types';

// ── Konstantlar ──────────────────────────────────────────────────────────────
const SCALE  = 80;   // px per metr (asosiy) — kattaroq = tafsiliylar ko'proq
const WALL_T = 10;   // devor qalinligi px (0.125m @ SCALE=80)
const MARGIN = 60;   // chizma chegarasi

// Rang palitasi — professional
const C = {
  // Trubalar
  cold:      '#0d5fa8',
  hot:       '#b91c1c',
  circ:      '#b45309',
  drain:     '#78350f',
  // Tuzilma
  wall:      '#1e293b',
  wallFill:  '#334155',
  roomBg:    '#f8fafc',
  roomBg2:   '#f1f5f9',   // bathroom uchun
  roomBg3:   '#fefce8',   // kitchen uchun
  // Jihozlar
  fixFill:   '#ffffff',
  fixStroke: '#1e293b',
  fixSelect: '#ea580c',
  // O'lchamlar
  dimLine:   '#64748b',
  dimText:   '#334155',
  // Matn
  textPrim:  '#0f172a',
  textSec:   '#475569',
  textMuted: '#94a3b8',
  // UI
  grid:      'rgba(148,163,184,0.12)',
  border:    '#cbd5e1',
  bg:        '#f1f5f9',
  paper:     '#ffffff',
  headerBg:  '#1e3a5f',
  headerText:'#ffffff',
};

// Rang — xona turi bo'yicha
const ROOM_COLORS: Record<string, string> = {
  bathroom: '#eff6ff',
  kitchen:  '#fefce8',
  laundry:  '#f0fdf4',
  toilet:   '#faf5ff',
  utility:  '#fafafa',
  other:    '#f8fafc',
};

// Truba ranglari
const PIPE_COLORS: Record<string, string> = {
  cold: C.cold, hot: C.hot, circ: C.circ, drain: C.drain,
};

// Chiziq qalinliklari
const LW = {
  wall:     2.5,
  mainPipe: 2.5,
  riser:    2.0,
  branch:   1.5,
  dim:      1.0,
  grid:     0.3,
  fixture:  1.5,
};

// Shriftlar
const FONT = {
  title:  'bold 15px "Segoe UI", Arial, sans-serif',
  header: 'bold 12px "Segoe UI", Arial, sans-serif',
  label:  '11px "Segoe UI", Arial, sans-serif',
  dim:    '10px "Courier New", monospace',
  small:  '9px "Segoe UI", Arial, sans-serif',
  stamp:  'bold 10px "Segoe UI", Arial, sans-serif',
};

// ── Koordinat o'zgartirish ────────────────────────────────────────────────────
function m2px(val: number) { return val * SCALE; }

interface Point2D { x: number; y: number; }
interface Bounds  { x: number; y: number; w: number; h: number; }

// ── Professional chizish funksiyalari ────────────────────────────────────────

/** Gradyan fon */
function drawPaper(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  // Engil soya
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(2, 2, W - 4, H - 4);
}

/** Chizma ramkasi */
function drawFrame(ctx: CanvasRenderingContext2D, W: number, H: number, stampH: number) {
  const left = 20; const top = 20;
  const right = W - 20; const bottom = H - stampH - 10;
  ctx.strokeStyle = C.wall;
  ctx.lineWidth = 2;
  ctx.strokeRect(left, top, right - left, bottom - top);
  // Ichki ramka
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = C.dimLine;
  ctx.strokeRect(left + 5, top + 5, right - left - 10, bottom - top - 10);
}

/** Sahifa sarlavhasi */
function drawTitle(
  ctx: CanvasRenderingContext2D,
  W: number,
  title: string,
  subtitle: string,
) {
  // Sarlavha bloki
  ctx.fillStyle = C.headerBg;
  ctx.fillRect(25, 25, W - 50, 36);
  ctx.fillStyle = C.headerText;
  ctx.font = FONT.title;
  ctx.textAlign = 'center';
  ctx.fillText(title.toUpperCase(), W / 2, 40);
  ctx.font = FONT.label;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(subtitle, W / 2, 54);
}

/** GOST shtamp (pastki o'ng) */
function drawStamp(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  project: PlumbingProject,
  floor: number,
) {
  const stampW = W - 40;
  const stampH = 56;
  const sx = 20, sy = H - stampH - 10;

  ctx.fillStyle = C.paper;
  ctx.strokeStyle = C.wall;
  ctx.lineWidth = 1.5;
  ctx.fillRect(sx, sy, stampW, stampH);
  ctx.strokeRect(sx, sy, stampW, stampH);

  // Vertikal bo'limlar
  const col1 = sx + stampW * 0.4;
  const col2 = sx + stampW * 0.6;
  const col3 = sx + stampW * 0.75;
  const col4 = sx + stampW * 0.88;

  [col1, col2, col3, col4].forEach(x => {
    ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, sy + stampH); ctx.stroke();
  });

  // Gorizontal chiziq
  const mid = sy + stampH / 2;
  ctx.beginPath(); ctx.moveTo(sx, mid); ctx.lineTo(col1, mid); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(col1, mid); ctx.lineTo(W - 20, mid); ctx.stroke();

  // Matn
  ctx.fillStyle = C.textPrim;
  ctx.font = FONT.stamp;
  ctx.textAlign = 'left';

  const items = [
    { x: sx + 4, y: sy + 14, text: project.name },
    { x: sx + 4, y: sy + 28, text: `Santexnika — ${floor}-qavat sxemasi` },
    { x: sx + 4, y: sy + 44, text: `Jihozlar: ${project.stats.totalFixtures} | Truba: ${project.stats.totalPipeM}m` },
  ];
  items.forEach(i => ctx.fillText(i.text, i.x, i.y));

  // O'ng ustunlar
  const rightItems = [
    { x: col1 + 4, y: sy + 12, label: 'Sana', val: new Date().toLocaleDateString('uz-UZ') },
    { x: col1 + 4, y: sy + 30, label: 'Miqyos', val: '1:100' },
    { x: col1 + 4, y: sy + 48, label: 'Standart', val: 'GOST 21.601' },
    { x: col2 + 4, y: sy + 12, label: 'V1 bosh', val: `DN${project.stats.mainColdDiamMm}` },
    { x: col2 + 4, y: sy + 30, label: 'T3 bosh', val: `DN${project.stats.mainHotDiamMm}` },
    { x: col2 + 4, y: sy + 48, label: 'Isitgich', val: project.stats.boilerVolL ? `${project.stats.boilerVolL}L` : '—' },
    { x: col3 + 4, y: sy + 12, label: 'Stoyaklar', val: `${project.stats.totalRisers}` },
    { x: col3 + 4, y: sy + 30, label: 'Qavatlar', val: `${project.floorCount}` },
    { x: col3 + 4, y: sy + 48, label: 'Qavat balandligi', val: `${project.floorHeight}m` },
    { x: col4 + 4, y: sy + 20, label: 'Varaq', val: `${floor}/${project.floorCount}` },
    { x: col4 + 4, y: sy + 40, label: 'Loyiha', val: project.id.slice(-6) },
  ];
  ctx.font = FONT.small;
  rightItems.forEach(i => {
    ctx.fillStyle = C.textMuted; ctx.fillText(i.label, i.x, i.y - 1);
    ctx.fillStyle = C.textPrim;  ctx.font = FONT.stamp; ctx.fillText(i.val, i.x, i.y + 9);
    ctx.font = FONT.small;
  });
}

/** Legenda (chapdan pastda) */
function drawLegend(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  layers: Record<string, boolean>,
) {
  const items = [
    { color: C.cold,  dash: [],   label: 'V1 — Sovuq suv',          show: layers.cold  },
    { color: C.hot,   dash: [],   label: 'T3 — Issiq suv',          show: layers.hot   },
    { color: C.circ,  dash: [],   label: 'T4 — Sirkulyatsiya',      show: layers.circ  },
    { color: C.drain, dash: [5,3],label: 'K1 — Kanalizatsiya',      show: layers.drain },
  ].filter(i => i.show);

  if (items.length === 0) return;

  const bw = 160, bh = items.length * 16 + 22;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, bw, bh);
  ctx.strokeRect(x, y, bw, bh);

  ctx.fillStyle = C.headerBg;
  ctx.fillRect(x, y, bw, 18);
  ctx.fillStyle = C.headerText;
  ctx.font = FONT.stamp;
  ctx.textAlign = 'left';
  ctx.fillText('SHARTLI BELGILAR', x + 6, y + 12);

  items.forEach((item, i) => {
    const iy = y + 22 + i * 16;
    ctx.strokeStyle = item.color;
    ctx.lineWidth   = 2;
    ctx.setLineDash(item.dash);
    ctx.beginPath(); ctx.moveTo(x + 6, iy + 4); ctx.lineTo(x + 36, iy + 4); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = C.textPrim;
    ctx.font = FONT.small;
    ctx.fillText(item.label, x + 42, iy + 8);
  });
}

/** O'lcham chizig'i — tik qatorlar bilan */
function drawDimLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  label: string,
  offsetDir: 'up' | 'down' | 'left' | 'right' = 'up',
  offsetPx = 18,
) {
  const dx = x2 - x1, dy = y2 - y1;
  const isH = Math.abs(dx) > Math.abs(dy);

  let ox = 0, oy = 0;
  if (offsetDir === 'up')    oy = -offsetPx;
  if (offsetDir === 'down')  oy =  offsetPx;
  if (offsetDir === 'left')  ox = -offsetPx;
  if (offsetDir === 'right') ox =  offsetPx;

  ctx.strokeStyle = C.dimLine;
  ctx.lineWidth   = LW.dim;
  ctx.setLineDash([]);

  // Ko'makchi chiziqlar (extension lines)
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x1 + ox, y1 + oy);
  ctx.moveTo(x2, y2); ctx.lineTo(x2 + ox, y2 + oy);
  ctx.stroke();

  // Asosiy o'lcham chizig'i
  ctx.beginPath();
  ctx.moveTo(x1 + ox, y1 + oy);
  ctx.lineTo(x2 + ox, y2 + oy);
  ctx.stroke();

  // Uchlar (tik chiziqlar)
  const tickLen = 5;
  if (isH) {
    ctx.beginPath();
    ctx.moveTo(x1 + ox, y1 + oy - tickLen); ctx.lineTo(x1 + ox, y1 + oy + tickLen);
    ctx.moveTo(x2 + ox, y2 + oy - tickLen); ctx.lineTo(x2 + ox, y2 + oy + tickLen);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x1 + ox - tickLen, y1 + oy); ctx.lineTo(x1 + ox + tickLen, y1 + oy);
    ctx.moveTo(x2 + ox - tickLen, y2 + oy); ctx.lineTo(x2 + ox + tickLen, y2 + oy);
    ctx.stroke();
  }

  // Matn
  const mx = (x1 + x2) / 2 + ox;
  const my = (y1 + y2) / 2 + oy;
  ctx.fillStyle = C.paper;
  ctx.fillRect(mx - 14, my - 7, 28, 10);
  ctx.fillStyle = C.dimText;
  ctx.font = FONT.dim;
  ctx.textAlign = 'center';
  ctx.fillText(label, mx, my + 2);
}

/** Devor va xona — arxitektura uslubida qalin devorlar bilan */
function drawRoom(
  ctx: CanvasRenderingContext2D,
  rx: number, ry: number,
  rw: number, rl: number,
  room: { name: string; type: string; width: number; length: number; shape?: Array<{x:number;y:number}> },
  scale: number,
) {
  const color  = ROOM_COLORS[room.type] ?? C.roomBg;
  const WT     = WALL_T; // devor qalinligi px (world units da)

  if (room.shape && room.shape.length >= 3) {
    // ── Polygon shakl ──
    const pts = room.shape.map(p => ({ x: rx + m2px(p.x), y: ry + m2px(p.y) }));

    // 1. Pol rangi (ichki)
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();

    // 2. Qalin devor — stroke sifatida (lineWidth = WT*2 chunki stroke markazda)
    ctx.strokeStyle = C.wall;
    ctx.lineWidth   = WT * 2;
    ctx.lineJoin    = 'miter';
    ctx.stroke();

    // 3. Devor to'ldirish (grix hatching)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = C.wallFill; ctx.lineWidth = 0.8; ctx.setLineDash([2, 4]);
    for (let d = -rl; d < rw + rl; d += 8) {
      ctx.beginPath(); ctx.moveTo(rx + d, ry); ctx.lineTo(rx + d - rl, ry + rl); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // nom chizish — overlay passda amalga oshiriladi (fixtures ustida)

  } else {
    // ── To'rtburchak (default) ──

    // 1. Pol rangi — devor ichki chegarasiga qadar
    ctx.fillStyle = color;
    ctx.fillRect(rx + WT, ry + WT, rw - WT * 2, rl - WT * 2);

    // 2. Qalin devor — to'rtta tomon alohida to'ldirilgan rect sifatida
    ctx.fillStyle = C.wall;
    ctx.fillRect(rx,           ry,           rw,  WT);        // shimol
    ctx.fillRect(rx,           ry + rl - WT, rw,  WT);        // janub
    ctx.fillRect(rx,           ry,           WT,  rl);         // g'arb
    ctx.fillRect(rx + rw - WT, ry,           WT,  rl);         // sharq

    // 3. Devor hatching (diagonal qiyshiq chiziqlar)
    ctx.save();
    ctx.beginPath();
    // Shimoliy devor
    ctx.rect(rx, ry, rw, WT);
    // Janubiy
    ctx.rect(rx, ry + rl - WT, rw, WT);
    // G'arbiy
    ctx.rect(rx, ry, WT, rl);
    // Sharqiy
    ctx.rect(rx + rw - WT, ry, WT, rl);
    ctx.clip();
    ctx.strokeStyle = C.wallFill; ctx.lineWidth = 0.8; ctx.setLineDash([2, 4]);
    for (let d = -rl; d < rw + rl; d += 8) {
      ctx.beginPath(); ctx.moveTo(rx + d, ry); ctx.lineTo(rx + d - rl, ry + rl); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // 4. Tashqi kontur
    ctx.strokeStyle = C.wall; ctx.lineWidth = 0.5;
    ctx.strokeRect(rx, ry, rw, rl);

    // 5. Nom — overlay passda chiziladi (fixtures ustida)
  }
}

/** Eshik va derazalarni chizish — top view da arxitektura belgilari */
function drawOpenings(
  ctx: CanvasRenderingContext2D,
  rooms: Array<{ id: string; type: string; position: { x: number; y: number }; width: number; length: number }>,
  openings: PlumbingOpening[],
) {
  const WT = WALL_T;

  for (const op of openings) {
    const room = rooms.find(r => r.id === op.roomId);
    if (!room) continue;

    const rx  = m2px(room.position.x), ry  = m2px(room.position.y);
    const rw  = m2px(room.width),      rl  = m2px(room.length);
    const ow  = m2px(op.width);
    const off = m2px(op.offset);

    // Opening boshlanish nuqtasi (devor bo'ylab)
    let x1 = 0, y1 = 0;
    switch (op.side) {
      case 'north': x1 = rx + off;       y1 = ry;           break;
      case 'south': x1 = rx + off;       y1 = ry + rl;      break;
      case 'west':  x1 = rx;             y1 = ry + off;     break;
      case 'east':  x1 = rx + rw;        y1 = ry + off;     break;
    }
    const isH = op.side === 'north' || op.side === 'south';

    if (op.type === 'door') {
      // 1. Devor kesimini xona rangi bilan to'ldirish (ochilma orqali "teshik")
      ctx.fillStyle = ROOM_COLORS[room.type as string] ?? C.roomBg;
      if (isH) ctx.fillRect(x1, y1 - WT, ow, WT * 2);
      else     ctx.fillRect(x1 - WT, y1, WT * 2, ow);

      // 2. Eshik qiyasi chiziqlar (ramka)
      ctx.strokeStyle = C.wall; ctx.lineWidth = 1.5;
      if (isH) {
        ctx.beginPath(); ctx.moveTo(x1, y1 - WT); ctx.lineTo(x1, y1 + WT); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1 + ow, y1 - WT); ctx.lineTo(x1 + ow, y1 + WT); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(x1 - WT, y1); ctx.lineTo(x1 + WT, y1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1 - WT, y1 + ow); ctx.lineTo(x1 + WT, y1 + ow); ctx.stroke();
      }

      // 3. Eshik taxtasi (yupqa chiziq — ochilish tomoni)
      ctx.strokeStyle = C.wall; ctx.lineWidth = 1;
      if (isH) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + ow, y1); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1, y1 + ow); ctx.stroke();
      }

      // 4. Aylana yoy (swing arc) — xona ichkariga tomon
      ctx.strokeStyle = C.dimLine; ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 2]);
      const pivot = { x: x1, y: y1 };
      if (op.side === 'north') {
        ctx.beginPath();
        ctx.arc(pivot.x, pivot.y, ow, 0, Math.PI / 2);
        ctx.stroke();
        // Eshik taxtasi (pivot dan ow masofada)
        ctx.setLineDash([]);
        ctx.strokeStyle = C.wall; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(pivot.x, pivot.y); ctx.lineTo(pivot.x + ow, pivot.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pivot.x + ow, pivot.y); ctx.lineTo(pivot.x + ow, pivot.y + ow); ctx.stroke();
      } else if (op.side === 'south') {
        ctx.beginPath();
        ctx.arc(pivot.x, pivot.y, ow, 0, -Math.PI / 2, true);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = C.wall; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(pivot.x, pivot.y); ctx.lineTo(pivot.x + ow, pivot.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pivot.x + ow, pivot.y); ctx.lineTo(pivot.x + ow, pivot.y - ow); ctx.stroke();
      } else if (op.side === 'west') {
        ctx.beginPath();
        ctx.arc(pivot.x, pivot.y, ow, Math.PI / 2, 0, true);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = C.wall; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(pivot.x, pivot.y); ctx.lineTo(pivot.x, pivot.y + ow); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pivot.x, pivot.y + ow); ctx.lineTo(pivot.x + ow, pivot.y + ow); ctx.stroke();
      } else { // east
        ctx.beginPath();
        ctx.arc(pivot.x, pivot.y, ow, Math.PI / 2, Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = C.wall; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(pivot.x, pivot.y); ctx.lineTo(pivot.x, pivot.y + ow); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pivot.x, pivot.y + ow); ctx.lineTo(pivot.x - ow, pivot.y + ow); ctx.stroke();
      }
      ctx.setLineDash([]);

    } else {
      // Deraza — ko'k shisha effekti
      ctx.fillStyle = '#bfdbfe';
      if (isH) ctx.fillRect(x1, y1 - WT, ow, WT * 2);
      else     ctx.fillRect(x1 - WT, y1, WT * 2, ow);

      ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1;
      if (isH) {
        ctx.beginPath(); ctx.moveTo(x1, y1 - WT/2); ctx.lineTo(x1 + ow, y1 - WT/2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1, y1);         ctx.lineTo(x1 + ow, y1);         ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1, y1 + WT/2); ctx.lineTo(x1 + ow, y1 + WT/2); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(x1 - WT/2, y1); ctx.lineTo(x1 - WT/2, y1 + ow); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1,         y1); ctx.lineTo(x1,         y1 + ow); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1 + WT/2, y1); ctx.lineTo(x1 + WT/2, y1 + ow); ctx.stroke();
      }
      ctx.strokeStyle = C.wall; ctx.lineWidth = 1.5;
      if (isH) {
        ctx.beginPath(); ctx.moveTo(x1, y1 - WT); ctx.lineTo(x1, y1 + WT); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1 + ow, y1 - WT); ctx.lineTo(x1 + ow, y1 + WT); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(x1 - WT, y1); ctx.lineTo(x1 + WT, y1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1 - WT, y1 + ow); ctx.lineTo(x1 + WT, y1 + ow); ctx.stroke();
      }
    }
  }
}

/** Top/bottom view uchun o'lcham chiziqlari — barcha xonalar CHIZILGANDAN KEYIN */
function drawTopDimensions(
  ctx: CanvasRenderingContext2D,
  rooms: Array<{ position: { x: number; y: number }; width: number; length: number; name: string }>,
  scale: number,
) {
  if (!rooms.length || scale < 0.45) return;

  // Har bir ustun: X bo'ylab guruhlash, tepada kengligi
  // Har bir qator: Y bo'ylab guruhlash, o'ngda uzunligi
  const DIM_GAP = 28; // xona chegarasidan qancha uzoqda (px)

  // Tepada: har xona kengligi (ry_min - DIM_GAP da)
  const minY = Math.min(...rooms.map(r => r.position.y));
  const topY  = m2px(minY) - DIM_GAP;

  rooms.forEach(room => {
    const rx = m2px(room.position.x);
    const rw = m2px(room.width);
    const ry = m2px(room.position.y);
    // Faqat top qatoridagi xonalar uchun yuqori o'lcham
    if (Math.abs(room.position.y - minY) < 0.1) {
      drawDimLine(ctx, rx, ry, rx + rw, ry, `${room.width.toFixed(2)}`, 'up', DIM_GAP);
    }
  });

  // O'ngda: har qator uzunligi
  const maxX = Math.max(...rooms.map(r => r.position.x + r.width));
  rooms.forEach(room => {
    const rx = m2px(room.position.x);
    const ry = m2px(room.position.y);
    const rl = m2px(room.length);
    // Faqat eng o'ng ustundagi xonalar uchun o'ng o'lcham
    if (Math.abs((room.position.x + room.width) - maxX) < 0.1) {
      drawDimLine(ctx, rx + m2px(room.width), ry, rx + m2px(room.width), ry + rl,
        `${room.length.toFixed(2)}`, 'right', DIM_GAP);
    }
  });
}

/** Fixture belgisi — professional arxitektura uslubi */
function drawFixtureSymbol(
  ctx: CanvasRenderingContext2D,
  fix: PlumbingFixture,
  cx: number, cy: number,
  isSelected: boolean,
  scale: number,
) {
  const stroke = isSelected ? C.fixSelect : C.fixStroke;
  const fill   = isSelected ? '#fff7ed' : C.fixFill;
  const lw     = isSelected ? 2.0 : LW.fixture;

  // Rotation qo'llash — ctx ga save/translate/rotate/restore
  const rotRad = (fix.rotation ?? 0) * Math.PI / 180;
  ctx.save();
  ctx.translate(cx, cy);
  if (rotRad !== 0) ctx.rotate(rotRad);

  // Haqiqiy o'lcham — metrdan pikselga (rotation OLDIDAN, asl w/d)
  const rawW = m2px(fix.dimensions.w);
  const rawD = m2px(fix.dimensions.d);
  const minPx = 20;
  const boost = rawW < minPx || rawD < minPx ? Math.max(minPx / rawW, minPx / rawD) : 1;
  const fw = rawW * boost;
  const fd = rawD * boost;
  const r  = Math.max(8, Math.min(fw, fd) / 2.4);

  ctx.strokeStyle = stroke;
  ctx.fillStyle   = fill;
  ctx.lineWidth   = lw;
  ctx.setLineDash([]);

  // Chizish markazlashtirilgan (0,0) da — translate qilindi
  // cx, cy endi 0,0; hw, hd — yarim o'lchamlar
  const hw = fw / 2, hd = fd / 2;

  // Barcha chizish (0,0) markazida — ctx.translate(cx,cy) qilingan
  switch (fix.type) {
    case 'toilet': {
      // Tank yuqorida (-hd), bowl pastda oval
      const tankGap = hd * 0.10;
      const tankTop = -hd + tankGap;
      const tankH   = hd * 0.30;
      const bowlTop = tankTop + tankH + hd * 0.04;
      const bowlH   = hd - tankGap - tankH - hd * 0.04;
      ctx.fillRect(-hw * 0.78, tankTop, hw * 1.56, tankH);
      ctx.strokeRect(-hw * 0.78, tankTop, hw * 1.56, tankH);
      ctx.beginPath();
      ctx.ellipse(0, bowlTop + bowlH * 0.5, hw * 0.82, bowlH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      break;
    }
    case 'sink': {
      ctx.fillRect(-hw, -hd, fw, fd);
      ctx.strokeRect(-hw, -hd, fw, fd);
      ctx.beginPath();
      ctx.ellipse(0, 0, hw * 0.65, hd * 0.6, 0, 0, Math.PI * 2);
      ctx.strokeStyle = C.cold; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      ctx.fillStyle = C.textSec;
      ctx.beginPath(); ctx.arc(0, -hd * 0.65, Math.max(2, hw * 0.15), 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'kitchen_sink': {
      ctx.fillRect(-hw, -hd, fw, fd);
      ctx.strokeRect(-hw, -hd, fw, fd);
      const gap = 2;
      ctx.strokeStyle = C.cold; ctx.lineWidth = 0.8;
      ctx.strokeRect(-hw + gap, -hd + gap, fw / 2 - gap * 1.5, fd - gap * 2);
      ctx.strokeRect(gap / 2,   -hd + gap, fw / 2 - gap * 1.5, fd - gap * 2);
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      break;
    }
    case 'bathtub': {
      ctx.fillRect(-hw, -hd, fw, fd);
      ctx.strokeRect(-hw, -hd, fw, fd);
      ctx.beginPath();
      ctx.ellipse(0, hd * 0.1, hw * 0.7, hd * 0.4, 0, 0, Math.PI * 2);
      ctx.strokeStyle = C.cold; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      ctx.fillStyle = C.textSec;
      ctx.fillRect(-hw + 2, -hd + 2, fw - 4, fd * 0.12);
      break;
    }
    case 'shower': {
      ctx.fillRect(-hw, -hd, fw, fd);
      ctx.strokeRect(-hw, -hd, fw, fd);
      ctx.strokeStyle = C.dimLine; ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-hw, -hd);
      ctx.arcTo(hw, -hd, hw, hd, Math.min(fw, fd) * 0.9);
      ctx.stroke();
      ctx.strokeStyle = C.cold; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(hw * 0.35, -hd * 0.35, Math.max(3, r * 0.35), 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      break;
    }
    case 'bidet': {
      ctx.fillRect(-hw, -hd, fw, fd);
      ctx.strokeRect(-hw, -hd, fw, fd);
      ctx.beginPath();
      ctx.ellipse(0, hd * 0.1, hw * 0.6, hd * 0.45, 0, 0, Math.PI * 2);
      ctx.strokeStyle = C.circ; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      break;
    }
    case 'washing_machine':
    case 'dishwasher': {
      ctx.fillRect(-hw, -hd, fw, fd);
      ctx.strokeRect(-hw, -hd, fw, fd);
      const cr = Math.min(hw, hd) * 0.72;
      ctx.beginPath(); ctx.arc(0, hd * 0.08, cr, 0, Math.PI * 2);
      ctx.strokeStyle = C.cold; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, hd * 0.08, cr * 0.45, -0.6, 2.0); ctx.stroke();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      break;
    }
    case 'towel_rail': {
      ctx.fillRect(-hw, -hd, fw, fd);
      ctx.strokeRect(-hw, -hd, fw, fd);
      ctx.strokeStyle = C.hot; ctx.lineWidth = 0.8;
      for (let i = 1; i <= 3; i++) {
        const bx = -hw + (fw / 4) * i;
        ctx.beginPath(); ctx.moveTo(bx, -hd + 1); ctx.lineTo(bx, hd - 1); ctx.stroke();
      }
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      break;
    }
    case 'floor_drain': {
      const dr = Math.min(hw, hd);
      ctx.beginPath(); ctx.arc(0, 0, dr, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = C.drain; ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-dr * 0.6, 0); ctx.lineTo(dr * 0.6, 0);
      ctx.moveTo(0, -dr * 0.6); ctx.lineTo(0, dr * 0.6);
      ctx.stroke();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      break;
    }
    case 'tap': {
      // Kran — vertikal chiziq + gorizontal chiziq (T shakl)
      ctx.fillRect(-hw, -hd, fw, fd);
      ctx.strokeRect(-hw, -hd, fw, fd);
      ctx.strokeStyle = C.cold; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -hd); ctx.lineTo(0, hd);
      ctx.moveTo(-hw * 0.6, 0); ctx.lineTo(hw * 0.6, 0);
      ctx.stroke();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      break;
    }
    default: {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
  }

  // Belgi teglari (cold/hot/drain nuqtalar) — rotatsiyadan MUSTAQIL
  if (scale > 0.8) {
    if (fix.coldIn)   { ctx.fillStyle = C.cold;  ctx.beginPath(); ctx.arc(-r * 0.8, -r * 0.8, 2.5, 0, Math.PI*2); ctx.fill(); }
    if (fix.hotIn)    { ctx.fillStyle = C.hot;   ctx.beginPath(); ctx.arc( r * 0.8, -r * 0.8, 2.5, 0, Math.PI*2); ctx.fill(); }
    if (fix.drainOut) { ctx.fillStyle = C.drain; ctx.beginPath(); ctx.arc(0, r * 0.9, 2.5, 0, Math.PI*2); ctx.fill(); }
  }

  // IsSelected ko'rsatgich
  if (isSelected) {
    ctx.strokeStyle = C.fixSelect;
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(-hw - 4, -hd - 4, fw + 8, fd + 8);
    ctx.setLineDash([]);
  }

  ctx.restore();
  // Label — alohida overlay passda chiziladi (collision-push uchun)
}

/** Truba segmenti — top/bottom view da ortogonal (L-shakl) */
function drawPipe(
  ctx: CanvasRenderingContext2D,
  p1: Point2D, p2: Point2D,
  pipe: PlumbingPipeSegment,
  scale: number,
  isTopView = false,
) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

  const color = PIPE_COLORS[pipe.type] ?? '#666';
  const lw = pipe.isRiser ? LW.riser : pipe.isMain ? LW.mainPipe : LW.branch;

  ctx.strokeStyle = color;
  ctx.lineWidth   = lw;

  if (pipe.type === 'drain' && !pipe.isRiser) {
    ctx.setLineDash([8, 4]);
  } else {
    ctx.setLineDash([]);
  }

  // Top/bottom view da branch trubalar ortogonal (L-shakl: avval X, keyin Y)
  if (isTopView && !pipe.isRiser && !pipe.isMain &&
      Math.abs(dx) > 4 && Math.abs(dy) > 4) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p1.y); // gorizontal
    ctx.lineTo(p2.x, p2.y); // vertikal
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Riser markeri (doira)
  if (pipe.isRiser) {
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    ctx.fillStyle = color + '30';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    if (scale > 0.8 && pipe.label) {
      ctx.fillStyle = color;
      ctx.font = '6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(pipe.label.slice(0, 6), mx, my + 2);
    }
    return;
  }

  // Diameter yorlig'i — magistral da 2/3 joyda (stoyakdan uzoqroq)
  if (scale > 0.65) {
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len > 40) {
      // Magistral cold=0.65, hot=0.35, branch=0.5 (parallel pipe lar ajralib tursin)
      const t = pipe.isMain ? (pipe.type === 'cold' ? 0.65 : pipe.type === 'hot' ? 0.35 : 0.5) : 0.5;
      const mx = p1.x + dx * t;
      const my = p1.y + dy * t;
      const lbl = `DN${pipe.diamMm}`;
      ctx.font = '8px "Segoe UI",Arial';
      const lw = ctx.measureText(lbl).width + 6;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(mx - lw/2, my - 8, lw, 10);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(lbl, mx, my + 1);
    }
  }

  // Qo'shilish nuqtasi
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(p1.x, p1.y, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(p2.x, p2.y, 2.5, 0, Math.PI * 2); ctx.fill();
}

/** Shimol strelkasi */
function drawNorthArrow(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  // Doira
  ctx.strokeStyle = C.textPrim;
  ctx.fillStyle   = C.paper;
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // Strelka
  ctx.fillStyle = C.headerBg;
  ctx.beginPath();
  ctx.moveTo(0, -12); ctx.lineTo(5, 4); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.border;
  ctx.beginPath();
  ctx.moveTo(0, -12); ctx.lineTo(-5, 4); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  // N harfi
  ctx.fillStyle = C.textPrim;
  ctx.font = 'bold 8px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('N', 0, 24);
  ctx.restore();
}

/** Ko'rinish chizig'i (sahifaning pastida) */
function drawViewBar(
  ctx: CanvasRenderingContext2D,
  W: number,
  view: ViewType,
  floor: number,
  floorCount: number,
  stampY: number,
) {
  const VIEW_LABELS: Record<ViewType, string> = {
    top:    `REJA — ${floor}-QAVAT`,
    front:  'FASAD — OLD KO\'RINISH',
    back:   'FASAD — ORQA KO\'RINISH',
    left:   'FASAD — CHAP KO\'RINISH',
    right:  'FASAD — O\'NG KO\'RINISH',
    bottom: 'POL QATLAMI',
    '3d':   '3D KO\'RINISH',
    axon:   'AKSONOMETRIK SXEMA',
  };
  const y = stampY - 18;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(25, y, W - 50, 16);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 8px "Segoe UI", Arial';
  ctx.textAlign = 'left';
  ctx.fillText(VIEW_LABELS[view] ?? view.toUpperCase(), 30, y + 11);
  ctx.textAlign = 'right';
  ctx.fillText(`Jami ${floorCount} qavat`, W - 30, y + 11);
}

// ── Proeksiya koordinatlari ───────────────────────────────────────────────────
// contentMaxY = barcha xonalar max Y koordinatasi (haqiqiy bino chuqurligi)
function projectPt(
  pt: { x: number; y: number; z: number },
  view: ViewType,
  buildingW: number,
  buildingL: number,
  floorH: number,
  floors: number,
): Point2D {
  const { x, y, z } = pt;
  const totalH = floors * floorH;
  switch (view) {
    case 'top':    return { x: m2px(x), y: m2px(y) };
    case 'front':  return { x: m2px(x), y: m2px(totalH) - m2px(z) };
    case 'back':   return { x: m2px(buildingW) - m2px(x), y: m2px(totalH) - m2px(z) };
    // Left view: Y axis ishlatiladi (bino chuqurligi bo'ylab), fliplanadi
    case 'left':   return { x: m2px(y), y: m2px(totalH) - m2px(z) };
    case 'right':  return { x: m2px(buildingL) - m2px(y), y: m2px(totalH) - m2px(z) };
    case 'bottom': return { x: m2px(x), y: m2px(buildingL) - m2px(y) };
    default:       return { x: m2px(x), y: m2px(y) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASOSIY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

// 8 ta resize handle uchun direction
type HandleDir = 'n'|'s'|'e'|'w'|'nw'|'ne'|'sw'|'se';
const HANDLE_DIRS: HandleDir[] = ['n','s','e','w','nw','ne','sw','se'];
const HANDLE_R = 5; // px

interface Props {
  project: PlumbingProject;
  view: ViewType;
  activeFloor: number;
  selectedId: string | null;
  selectedPipeId: string | null;
  selectedRoomId: string | null;
  onSelectFixture: (id: string | null) => void;
  onSelectPipe: (id: string | null) => void;
  onSelectRoom: (id: string | null) => void;
  onMoveFixture?: (id: string, pos: { x: number; y: number; z: number }) => void;
  onResizeFixture?: (id: string, dims: { w?: number; d?: number }) => void;
  onRemoveFixture?: (id: string) => void;
  onRemovePipe?: (id: string) => void;
  onMoveRiser?: (id: string, pos: { x: number; y: number }) => void;
  onMoveRoom?: (id: string, pos: { x: number; y: number }) => void;
  onResizeRoom?: (id: string, dims: { width?: number; length?: number; shape?: Array<{x:number;y:number}>; position?: { x: number; y: number } }) => void;
  onRemoveRoom?: (id: string) => void;
  onAddRoom?: (pos: { x: number; y: number }, floor: number) => void;
  onMovePipeEndpoint?: (id: string, end: 'from'|'to', pos: { x:number; y:number; z:number }) => void;
  onAddPipe?: (pipe: { type: string; material: string; diamMm: number; from: {x:number;y:number;z:number}; to: {x:number;y:number;z:number}; floor: number }) => void;
  onDropFixture?: (type: string, pos: { x: number; y: number; z: number }) => void;
  draggingLibType?: string | null;
  drawPipeMode?: { type: string; material: string; diamMm: number } | null;
  layers: Record<string, boolean>;
  onShowContextMenu?: (info: {
    screenX: number; screenY: number;
    roomId?: string; fixtureId?: string; pipeId?: string;
    worldPos?: { x: number; y: number };
  }) => void;
  onUpdateLabel?: (key: string, override: { dx: number; dy: number; fontSize?: number } | null) => void;
}

export default function PlumbingCanvas2D({
  project, view, activeFloor,
  selectedId, selectedPipeId, selectedRoomId,
  onSelectFixture, onSelectPipe, onSelectRoom,
  onMoveFixture, onResizeFixture, onRemoveFixture, onRemovePipe,
  onMoveRiser,
  onMoveRoom, onResizeRoom, onRemoveRoom, onAddRoom,
  onMovePipeEndpoint, onAddPipe,
  onDropFixture, draggingLibType, drawPipeMode, layers,
  onShowContextMenu, onUpdateLabel,
}: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [offset, setOffset] = useState({ x: 60, y: 70 });
  const [scale,  setScale]  = useState(1.0);
  const isPanning       = useRef(false);
  const lastMouse       = useRef({ x: 0, y: 0 });
  const draggingFix     = useRef<string | null>(null);
  const resizingFix     = useRef<{ id: string; dir: HandleDir; origDims: { w: number; d: number }; origPos: { x: number; y: number }; startWx: number; startWy: number } | null>(null);
  const [dragPos,    setDragPos]    = useState<{ id: string; x: number; y: number } | null>(null);
  const [resizeDims, setResizeDims] = useState<{ id: string; w: number; d: number; dx: number; dy: number } | null>(null);
  const [libGhostPos, setLibGhostPos] = useState<{ x: number; y: number } | null>(null);

  // Riser drag
  const draggingRiser   = useRef<{ id: string; origPos: { x: number; y: number } } | null>(null);
  const [riserDragPos, setRiserDragPos] = useState<{ id: string; x: number; y: number } | null>(null);

  // Polygon vertex drag
  const draggingVertex  = useRef<{ roomId: string; idx: number; origPts: Array<{x:number;y:number}> } | null>(null);
  const [vertexDragPts, setVertexDragPts] = useState<{ roomId: string; pts: Array<{x:number;y:number}> } | null>(null);

  // Room drag
  const draggingRoom    = useRef<{ id: string; origPos: { x: number; y: number }; startWx: number; startWy: number } | null>(null);
  const [roomDragPos, setRoomDragPos] = useState<{ id: string; x: number; y: number } | null>(null);

  // Label drag
  const draggingLabel = useRef<{ key: string; origDx: number; origDy: number; startSx: number; startSy: number } | null>(null);
  const [labelDragKey, setLabelDragKey] = useState<string | null>(null);

  // Room resize (4 corner: nw, ne, sw, se)
  type RoomCorner = 'nw'|'ne'|'sw'|'se';
  const resizingRoom = useRef<{ id: string; corner: RoomCorner; origPos: { x: number; y: number }; origDims: { width: number; length: number }; startWx: number; startWy: number } | null>(null);
  const [roomResizeDims, setRoomResizeDims] = useState<{ id: string; x: number; y: number; width: number; length: number } | null>(null);

  // Rendered labels — hit detection uchun (har frame yangilanadi)
  const renderedLabels = useRef<Array<{ key: string; sx: number; sy: number; sw: number; sh: number; fontSize: number }>>([]);

  // Pipe endpoint drag
  const draggingEndpoint = useRef<{ pipeId: string; end: 'from'|'to'; origPos: {x:number;y:number;z:number} } | null>(null);
  const [endpointDragPos, setEndpointDragPos] = useState<{ pipeId: string; end: 'from'|'to'; x:number; y:number } | null>(null);

  // Pipe draw mode: birinchi nuqta bosilganidan keyin rubber-band
  const pipeDrawStart = useRef<{ x:number; y:number; z:number } | null>(null);
  const [pipeDrawCursor, setPipeDrawCursor] = useState<{ wx:number; wy:number } | null>(null);

  const getSize = () => {
    const c = containerRef.current;
    return c ? { W: c.clientWidth, H: c.clientHeight } : { W: 1000, H: 700 };
  };

  // ── ASOSiy DRAW ─────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { W, H } = getSize();
    canvas.width  = W;
    canvas.height = H;

    const STAMP_H = 70;
    const VIEWBAR_H = 18;

    // 1. Oq qog'oz fon
    drawPaper(ctx, W, H);

    // 2. Sarlavha
    const floorLabel = view === 'top' || view === 'bottom'
      ? `${activeFloor}-qavat`
      : 'Fasad ko\'rinish';
    drawTitle(ctx, W,
      `${project.name} — Santexnika sxemasi`,
      `${view === 'top' ? 'Reja (tepadan ko\'rinish)' : view.toUpperCase()} | Miqyos 1:100 | ${floorLabel}`
    );

    // 3. Ramka
    drawFrame(ctx, W, H, STAMP_H + VIEWBAR_H);

    // 4. Pan+Zoom qatlamida chizish
    const drawY = 65; // sarlavhadan keyin
    const drawH = H - STAMP_H - VIEWBAR_H - drawY - 10;

    ctx.save();
    // Clip region: o'lcham chiziqlari (DIM_GAP=28) ham ko'rinsin uchun tepada joy
    const clipTop = drawY - 50;
    ctx.beginPath();
    ctx.rect(25, clipTop, W - 50, drawH + 50);
    ctx.clip();

    // offset.y is relative to the drawing area top (drawY)
    ctx.translate(offset.x, offset.y + drawY);
    ctx.scale(scale, scale);

    // Grid
    if (layers.rooms) drawGrid(ctx, W, H, scale);

    // ── 1. Xonalar (fon + devorlar + nom) ──────────────────────────
    if (layers.rooms) {
      const floorRooms = view === 'top' || view === 'bottom'
        ? project.rooms.filter(r => r.floor === activeFloor)
        : project.rooms;

      for (const room of floorRooms) {
        if (view === 'top' || view === 'bottom') {
          const rd = roomResizeDims?.id === room.id ? roomResizeDims : null;
          const rp = roomDragPos?.id    === room.id ? roomDragPos   : null;
          const drawX = rd?.x ?? rp?.x ?? room.position.x;
          const drawY = rd?.y ?? rp?.y ?? room.position.y;
          const drawW = rd?.width  ?? room.width;
          const drawL = rd?.length ?? room.length;
          drawRoom(ctx,
            m2px(drawX), m2px(drawY),
            m2px(drawW), m2px(drawL),
            room, scale);
        } else {
          const baseZ = (room.floor - 1) * project.floorHeight;
          const p1 = projectPt({ x: room.position.x, y: room.position.y, z: baseZ },
            view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
          const pw = (view === 'front' || view === 'back') ? m2px(room.width) : m2px(room.length);
          const ph = m2px(room.height);
          ctx.fillStyle   = ROOM_COLORS[room.type] ?? C.roomBg;
          ctx.strokeStyle = C.wall;
          ctx.lineWidth   = LW.wall;
          ctx.fillRect(p1.x, p1.y - ph, pw, ph);
          ctx.strokeRect(p1.x, p1.y - ph, pw, ph);
          if (scale > 0.5) {
            ctx.fillStyle = C.textSec; ctx.font = FONT.small; ctx.textAlign = 'center';
            let rname = room.name;
            while (ctx.measureText(rname).width > pw - 6 && rname.length > 3)
              rname = rname.slice(0, -1);
            if (rname !== room.name) rname = rname.slice(0, -2) + '..';
            ctx.fillText(rname, p1.x + pw / 2, p1.y - ph / 2);
          }
        }
      }

      // Tanlangan xona: polygon vertex handles (agar shape bo'lsa)
      if (selectedRoomId && (view === 'top' || view === 'bottom')) {
        const selRoom = floorRooms.find(r => r.id === selectedRoomId);
        if (selRoom?.shape && selRoom.shape.length >= 3) {
          const vd = vertexDragPts?.roomId === selRoom.id ? vertexDragPts.pts : selRoom.shape;
          const rp = roomDragPos?.id === selRoom.id ? roomDragPos : null;
          const ox = m2px(rp?.x ?? selRoom.position.x);
          const oy = m2px(rp?.y ?? selRoom.position.y);
          ctx.save();
          // Polygon outline
          ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2 / scale; ctx.setLineDash([6/scale, 3/scale]);
          ctx.beginPath();
          ctx.moveTo(ox + m2px(vd[0].x), oy + m2px(vd[0].y));
          for (let i = 1; i < vd.length; i++) ctx.lineTo(ox + m2px(vd[i].x), oy + m2px(vd[i].y));
          ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
          // Vertex handles
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1.5 / scale;
          for (const pt of vd) {
            ctx.beginPath();
            ctx.arc(ox + m2px(pt.x), oy + m2px(pt.y), (HANDLE_R + 1) / scale, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
          }
          ctx.restore();
        }
      }

      // Tanlangan xona: dashed orange border + corner resize handles
      if (selectedRoomId && (view === 'top' || view === 'bottom')) {
        const selRoom = floorRooms.find(r => r.id === selectedRoomId);
        if (selRoom) {
          // Drag yoki resize paytida local preview
          const rd = roomResizeDims?.id === selRoom.id ? roomResizeDims : null;
          const rp = roomDragPos?.id   === selRoom.id ? roomDragPos   : null;
          const rx = m2px(rd?.x      ?? rp?.x      ?? selRoom.position.x);
          const ry = m2px(rd?.y      ?? rp?.y      ?? selRoom.position.y);
          const rw = m2px(rd?.width  ?? selRoom.width);
          const rh = m2px(rd?.length ?? selRoom.length);
          const PAD = 4;

          ctx.save();
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 2 / scale;
          ctx.setLineDash([6 / scale, 3 / scale]);
          ctx.strokeRect(rx - PAD, ry - PAD, rw + PAD*2, rh + PAD*2);
          ctx.setLineDash([]);

          // 4 ta corner resize handle
          const corners: Array<[number, number]> = [
            [rx - PAD, ry - PAD],
            [rx + rw + PAD, ry - PAD],
            [rx - PAD, ry + rh + PAD],
            [rx + rw + PAD, ry + rh + PAD],
          ];
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1.5 / scale;
          for (const [cx, cy] of corners) {
            ctx.beginPath();
            ctx.arc(cx, cy, (HANDLE_R + 1) / scale, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
          }
          ctx.restore();
        }
      }

      // Eshik va derazalar
      if (layers.rooms && (view === 'top' || view === 'bottom') && project.openings?.length) {
        drawOpenings(ctx, floorRooms, project.openings.filter(o =>
          floorRooms.some(r => r.id === o.roomId)
        ));
      }

      // ── 2. O'lcham chiziqlari — xonalar ICHIDAN TASHQARIGA, jihozlar ostida ──
      if (layers.dimensions && (view === 'top' || view === 'bottom')) {
        drawTopDimensions(ctx, floorRooms, scale);
      }
    }

    // ── 3. Trubalar
    const isTopView = view === 'top' || view === 'bottom';
    const filteredPipes = filterPipesByView(project.pipes, view, activeFloor);
    for (const pipe of filteredPipes) {
      if (!layers[pipe.type]) continue;
      const p1 = projectPt(pipe.from, view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
      const p2 = projectPt(pipe.to,   view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
      drawPipe(ctx, p1, p2, pipe, scale, isTopView);
    }

    // Jihozlar
    if (layers.fixtures) {
      const fixes = project.fixtures.filter(f => {
        if (view === 'top' || view === 'bottom') return f.floor === activeFloor;
        if (view === 'front' || view === 'back') return true; // barcha qavatlar elevation da
        if (view === 'left'  || view === 'right') return true;
        return true;
      });
      for (const fix of fixes) {
        // Drag yoki resize preview paytida local pozitsiyadan foydalanish
        let pos = fix.position;
        if (dragPos && dragPos.id === fix.id) {
          pos = { ...fix.position, x: dragPos.x, y: dragPos.y };
        } else if (resizeDims && resizeDims.id === fix.id && (resizeDims.dx || resizeDims.dy)) {
          pos = { ...fix.position, x: fix.position.x + resizeDims.dx, y: fix.position.y + resizeDims.dy };
        }
        const p = projectPt(pos, view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
        drawFixtureSymbol(ctx, fix, p.x, p.y, fix.id === selectedId, scale);

        // Resize handles — faqat top view da, tanlangan fixture uchun
        if (fix.id === selectedId && (view === 'top' || view === 'bottom') && scale > 0.4) {
          const rd = resizeDims && resizeDims.id === fix.id ? resizeDims : null;
          const fw = m2px(rd ? rd.w : fix.dimensions.w);
          const fd = m2px(rd ? rd.d : fix.dimensions.d);
          const hx = p.x, hy = p.y; // p allaqachon resize offset bilan yangilangan
          ctx.save();
          ctx.strokeStyle = '#ea580c'; ctx.fillStyle = '#fff';
          ctx.lineWidth = 1.5;
          // Dashed bounding box
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(hx - fw/2 - 3, hy - fd/2 - 3, fw + 6, fd + 6);
          ctx.setLineDash([]);
          // 8 ta tutqich
          const handles: Record<HandleDir, [number, number]> = {
            nw: [hx - fw/2 - 3, hy - fd/2 - 3],
            n:  [hx,             hy - fd/2 - 3],
            ne: [hx + fw/2 + 3,  hy - fd/2 - 3],
            w:  [hx - fw/2 - 3,  hy           ],
            e:  [hx + fw/2 + 3,  hy           ],
            sw: [hx - fw/2 - 3,  hy + fd/2 + 3],
            s:  [hx,              hy + fd/2 + 3],
            se: [hx + fw/2 + 3,  hy + fd/2 + 3],
          };
          for (const [, [hpx, hpy]] of Object.entries(handles)) {
            ctx.beginPath();
            ctx.arc(hpx, hpy, HANDLE_R, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
          }
          ctx.restore();
        }
      }
    }

    // ── Stoyaklar (top view da doira + tag) ──────────────────────────────────
    if (layers.fixtures && (view === 'top' || view === 'bottom') && project.risers?.length) {
      const RISER_COLORS: Record<string, string> = {
        cold: C.cold, hot: C.hot, circ: C.circ, drain: C.drain,
      };
      for (const riser of project.risers) {
        const rd = riserDragPos?.id === riser.id ? riserDragPos : null;
        const rx = m2px(rd?.x ?? riser.x);
        const ry = m2px(rd?.y ?? riser.y);
        const color = RISER_COLORS[riser.type] ?? '#888';
        const R = Math.max(8, m2px(riser.diamMm / 1000) * 3);

        ctx.save();
        // Tashqi doira
        ctx.strokeStyle = color; ctx.lineWidth = 2 / scale;
        ctx.fillStyle   = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(rx, ry, R / scale, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Ichki kichik doira
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(rx, ry, R * 0.4 / scale, 0, Math.PI * 2);
        ctx.fill();
        // Tag matni — oq fon bilan
        const tagFontSize = Math.max(9, 11 / scale);
        ctx.font = `bold ${tagFontSize}px "Segoe UI",Arial`;
        ctx.textAlign = 'center';
        const tagY = ry - R / scale - 4 / scale;
        const tagW = ctx.measureText(riser.tag).width + 6;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(rx - tagW/2, tagY - tagFontSize, tagW, tagFontSize + 2);
        ctx.fillStyle = color;
        ctx.fillText(riser.tag, rx, tagY);
        ctx.restore();
      }
    }

    // ── Label overlay — xona nomlari + fixture labellar, birgalikda collision-push ──
    if ((view === 'top' || view === 'bottom') && scale > 0.3) {
      const MIN_GAP = 5;
      type Rect = { x: number; y: number; w: number; h: number };
      type LBox  = { key: string; x: number; y: number; w: number; h: number; lines: string[]; fontSize: number; bold: boolean; roomPx?: Rect };
      const overrides = project.labelOverrides ?? {};

      const labels:   LBox[]  = [];
      const blockers: Rect[]  = []; // fixture bbox lar — o'zgarmaydi

      // Overlap tekshiruvi (axis-aligned)
      const overlaps = (ax: number, ay: number, aw: number, ah: number,
                        bx: number, by: number, bw: number, bh: number, gap = 0) =>
        Math.abs(ax - bx) < (aw + bw) / 2 + gap &&
        Math.abs(ay - by) < (ah + bh) / 2 + gap;

      // 1a. Xona nomlari — birinchi joylashadi (fixture labellar ular atrofini chetlab o'tadi)
      if (layers.rooms) {
        const overlayRooms = project.rooms.filter(r => r.floor === activeFloor);
        for (const room of overlayRooms) {
          const rd = roomResizeDims?.id === room.id ? roomResizeDims : null;
          const rp = roomDragPos?.id   === room.id ? roomDragPos   : null;
          const rx = m2px(rd?.x ?? rp?.x ?? room.position.x);
          const ry = m2px(rd?.y ?? rp?.y ?? room.position.y);
          const rw = m2px(rd?.width  ?? room.width);
          const rl = m2px(rd?.length ?? room.length);
          if (rw < 24 || rl < 18) continue;
          const fontSize = Math.max(10, Math.min(16, rw / 5));
          ctx.font = `bold ${fontSize}px "Segoe UI",Arial,sans-serif`;
          const lines = scale > 0.45 && rw > 40 && rl > 32
            ? [room.name, `${(room.width * room.length).toFixed(1)} m²`]
            : [room.name];
          const lw2 = ctx.measureText(room.name).width + 8;
          const lh  = lines.length * (fontSize + 3) + 2;
          const rKey = `room:${room.id}`;
          const rOvr = overrides[rKey];
          const rFontSize = rOvr?.fontSize ?? fontSize;
          labels.push({ key: rKey, x: rx + rw / 2 + (rOvr?.dx ?? 0), y: ry + rl / 2 + (rOvr?.dy ?? 0), w: lw2, h: lh, lines, fontSize: rFontSize, bold: true });
        }
      }

      // 1b. Fixture blocker va labellar — y bo'yicha tepadan pastga tartib (greedy placement uchun)
      if (layers.fixtures) {
        const fixes = project.fixtures
          .filter(f => f.floor === activeFloor)
          .slice()
          .sort((a, b) => a.position.y - b.position.y);
        for (const fix of fixes) {
          let pos = fix.position;
          if (dragPos?.id === fix.id) pos = { ...fix.position, x: dragPos.x, y: dragPos.y };
          else if (resizeDims?.id === fix.id && (resizeDims.dx || resizeDims.dy))
            pos = { ...fix.position, x: fix.position.x + resizeDims.dx, y: fix.position.y + resizeDims.dy };
          const p = projectPt(pos, view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
          const rawW = m2px(fix.dimensions.w), rawD = m2px(fix.dimensions.d);
          const boost = rawW < 20 || rawD < 20 ? Math.max(20 / rawW, 20 / rawD) : 1;
          const fw = rawW * boost, fd = rawD * boost;
          const rot = (fix.rotation ?? 0) * Math.PI / 180;
          const cosR = Math.cos(rot), sinR = Math.sin(rot);
          const halfW = (Math.abs(cosR) * fw + Math.abs(sinR) * fd) / 2;
          const halfH = (Math.abs(sinR) * fw + Math.abs(cosR) * fd) / 2;
          blockers.push({ x: p.x - halfW, y: p.y - halfH, w: halfW * 2, h: halfH * 2 });

          if (fd < 6) continue;
          const fKey = `fixture:${fix.id}`;
          const fOvr = overrides[fKey];
          const baseFontSize = Math.max(9, Math.min(11, fd * 0.26));
          const fontSize = fOvr?.fontSize ?? baseFontSize;
          ctx.font = `${fontSize}px "Segoe UI",Arial,sans-serif`;
          const ltext = fix.nameUz;
          const lw2 = ctx.measureText(ltext).width + 6;
          const lh  = fontSize + 5;
          const innerW = (Math.abs(cosR) * fw + Math.abs(sinR) * fd) * 0.82;

          // Fixture ning xonasi pixel chegarasi
          const fixRoom = project.rooms.find(r => r.id === fix.roomId);
          const PAD = WALL_T;
          const roomPx = fixRoom ? {
            x: m2px(fixRoom.position.x) + PAD,
            y: m2px(fixRoom.position.y) + PAD,
            w: m2px(fixRoom.width)  - PAD * 2,
            h: m2px(fixRoom.length) - PAD * 2,
          } : null;

          if (lw2 <= innerW) {
            // Ichida — markazdan pastroq, gorizontal
            const baseX = p.x, baseY = p.y + halfH * 0.38;
            labels.push({ key: fKey, x: baseX + (fOvr?.dx ?? 0), y: baseY + (fOvr?.dy ?? 0), w: lw2, h: lh, lines: [ltext], fontSize, bold: false, roomPx: roomPx ?? undefined });
          } else {
            // Tashqarida — 4 ta kandidat + clamped + fixture ichida (fallback)
            // Har bir clamped variant: ideal pozitsiyani roomPx ichiga clamp qilgan holda
            const mkClamped = (cx: number, cy: number) => {
              if (!roomPx) return { x: cx, y: cy };
              return {
                x: Math.max(roomPx.x + lw2/2, Math.min(roomPx.x + roomPx.w - lw2/2, cx)),
                y: Math.max(roomPx.y + lh/2,  Math.min(roomPx.y + roomPx.h - lh/2,  cy)),
              };
            };
            const candidates = [
              { x: p.x,                              y: p.y + halfH + lh / 2 + MIN_GAP }, // past
              { x: p.x,                              y: p.y - halfH - lh / 2 - MIN_GAP }, // yuqori
              { x: p.x + halfW + lw2 / 2 + MIN_GAP, y: p.y },                             // o'ng
              { x: p.x - halfW - lw2 / 2 - MIN_GAP, y: p.y },                             // chap
              mkClamped(p.x, p.y + halfH + lh / 2 + MIN_GAP),                             // past (clamped)
              mkClamped(p.x, p.y - halfH - lh / 2 - MIN_GAP),                             // yuqori (clamped)
              mkClamped(p.x + halfW + lw2 / 2 + MIN_GAP, p.y),                            // o'ng (clamped)
              mkClamped(p.x - halfW - lw2 / 2 - MIN_GAP, p.y),                            // chap (clamped)
              { x: p.x,                              y: p.y },                             // fixture ichida (fallback)
            ];
            let best = candidates[0];
            let bestScore = Infinity;
            for (const cand of candidates) {
              let score = 0;
              const isInside = cand.x === p.x && cand.y === p.y && candidates.indexOf(cand) === candidates.length - 1;
              if (!isInside) {
                for (const bl of blockers) {
                  if (overlaps(cand.x, cand.y, lw2, lh, bl.x + bl.w/2, bl.y + bl.h/2, bl.w, bl.h, MIN_GAP))
                    score += 40; // blocker ustida tursa kamroq penalty — label ko'rinadi
                }
              }
              // Mavjud labellar bilan to'qnashuv — eng yuqori penalty (o'qilmaydi)
              for (const ex of labels) {
                if (overlaps(cand.x, cand.y, lw2, lh, ex.x, ex.y, ex.w, ex.h, MIN_GAP))
                  score += 200;
              }
              // Xona ichki chegarasidan chiqsa katta penalty
              if (roomPx) {
                const oob =
                  cand.x - lw2/2 < roomPx.x ||
                  cand.x + lw2/2 > roomPx.x + roomPx.w ||
                  cand.y - lh/2  < roomPx.y ||
                  cand.y + lh/2  > roomPx.y + roomPx.h;
                if (oob) score += 1000;
              }
              // Fixture ichida bo'lsa uzoqlik penaltysiz
              if (!isInside) score += Math.hypot(cand.x - p.x, cand.y - p.y) * 0.05;
              else score += 20; // fallback — faqat boshqa barcha yo'llar oob bo'lsa
              if (score < bestScore) { bestScore = score; best = cand; }
            }
            const finalX = best.x + (fOvr?.dx ?? 0);
            const finalY = best.y + (fOvr?.dy ?? 0);
            labels.push({ key: fKey, x: finalX, y: finalY, w: lw2, h: lh, lines: [ltext], fontSize, bold: false, roomPx: roomPx ?? undefined });
          }
        }
      }

      // Xona nomlari yuqorida (1a) qo'shilgan

      // 3. Label–label push + har iteratsiyada clamp
      const bldW = m2px(project.buildingWidth), bldH = m2px(project.buildingLength);
      const clampLabel = (lbl: LBox) => {
        const b = lbl.roomPx ?? { x: WALL_T, y: WALL_T, w: bldW - WALL_T * 2, h: bldH - WALL_T * 2 };
        lbl.x = Math.max(b.x + lbl.w / 2, Math.min(b.x + b.w - lbl.w / 2, lbl.x));
        lbl.y = Math.max(b.y + lbl.h / 2, Math.min(b.y + b.h - lbl.h / 2, lbl.y));
      };

      // Tiebreaker: to'qnashayotgan juftlarni push boshlanishidan oldin to'liq ajratish
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i], b = labels[j];
          const ox = (a.w + b.w) / 2 + MIN_GAP - Math.abs(a.x - b.x);
          const oy = (a.h + b.h) / 2 + MIN_GAP - Math.abs(a.y - b.y);
          if (ox <= 0 || oy <= 0) continue;
          // Eng kichik overlap yo'nalishida to'liq ajratish (clamp YO'Q — push o'zi hal qilsin)
          if (ox < oy) {
            const shift = ox / 2 + 1;
            if (a.x <= b.x) { a.x -= shift; b.x += shift; }
            else             { a.x += shift; b.x -= shift; }
          } else {
            const shift = oy / 2 + 1;
            if (a.y <= b.y) { a.y -= shift; b.y += shift; }
            else             { a.y += shift; b.y -= shift; }
          }
        }
      }

      for (let iter = 0; iter < 30; iter++) {
        let moved = false;
        for (let i = 0; i < labels.length; i++) {
          for (let j = i + 1; j < labels.length; j++) {
            const a = labels[i], b = labels[j];
            const ox = (a.w + b.w) / 2 + MIN_GAP - Math.abs(a.x - b.x);
            const oy = (a.h + b.h) / 2 + MIN_GAP - Math.abs(a.y - b.y);
            if (ox <= 0 || oy <= 0) continue;
            // Eng kichik overlap yo'nalishida itarish — faqat itariluvchi tomonga
            if (ox < oy) {
              const sh = ox / 2;
              if (a.x < b.x) { a.x -= sh; b.x += sh; } else { a.x += sh; b.x -= sh; }
            } else {
              const sh = oy / 2;
              if (a.y < b.y) { a.y -= sh; b.y += sh; } else { a.y += sh; b.y -= sh; }
            }
            moved = true;
          }
        }
        // Har iteratsiya oxirida clamp — push natijasini yo'qotmasdan chegarada ushlab turadi
        labels.forEach(clampLabel);
        if (!moved) break;
      }

      // 5. Chizish + renderedLabels to'ldirish
      renderedLabels.current = [];
      ctx.textAlign = 'center';
      for (const box of labels) {
        if (!box.lines.length) continue;
        const isDragging = labelDragKey === box.key;
        const isHovered = false; // hover canvas da cursor orqali aniqlanadi
        ctx.fillStyle = isDragging ? 'rgba(234,88,12,0.15)' : 'rgba(255,255,255,0.92)';
        ctx.fillRect(box.x - box.w / 2, box.y - box.h / 2, box.w, box.h);
        if (isDragging) {
          ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 1.5;
          ctx.strokeRect(box.x - box.w / 2, box.y - box.h / 2, box.w, box.h);
        }
        ctx.font = `${box.bold ? 'bold ' : ''}${box.fontSize}px "Segoe UI",Arial,sans-serif`;
        ctx.fillStyle = isDragging ? '#ea580c' : C.textPrim;
        ctx.fillText(box.lines[0], box.x, box.y + box.fontSize * 0.35);
        if (box.lines[1]) {
          ctx.font = `${Math.max(8, box.fontSize - 2)}px "Segoe UI",Arial,sans-serif`;
          ctx.fillStyle = isDragging ? '#ea580c' : C.textSec;
          ctx.fillText(box.lines[1], box.x, box.y + box.fontSize + box.fontSize * 0.35);
        }
        // Screen koordinatalarini saqlash (hit detection uchun)
        renderedLabels.current.push({
          key: box.key, fontSize: box.fontSize,
          sx: box.x - box.w / 2, sy: box.y - box.h / 2, sw: box.w, sh: box.h,
        });
      }
    }

    // Pipe selection highlight + endpoint handles
    if (selectedPipeId) {
      const pipe = project.pipes.find(p => p.id === selectedPipeId);
      if (pipe) {
        // Endpoint drag preview
        const fromPt = endpointDragPos?.pipeId === pipe.id && endpointDragPos.end === 'from'
          ? { x: endpointDragPos.x, y: endpointDragPos.y }
          : projectPt(pipe.from, view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
        const toPt = endpointDragPos?.pipeId === pipe.id && endpointDragPos.end === 'to'
          ? { x: endpointDragPos.x, y: endpointDragPos.y }
          : projectPt(pipe.to, view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);

        ctx.save();
        ctx.strokeStyle = '#f97316'; ctx.lineWidth = 3; ctx.setLineDash([5,3]);
        ctx.beginPath(); ctx.moveTo(fromPt.x, fromPt.y); ctx.lineTo(toPt.x, toPt.y); ctx.stroke();
        ctx.setLineDash([]);

        // Endpoint handles (2 ta katta doira)
        [fromPt, toPt].forEach(pt => {
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 6, 0, Math.PI*2);
          ctx.fill(); ctx.stroke();
        });
        ctx.restore();
      }
    }

    // Pipe draw rubber-band (drawPipeMode aktiv bo'lganda)
    if (drawPipeMode && pipeDrawStart.current && pipeDrawCursor) {
      const p1 = projectPt(pipeDrawStart.current, view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
      ctx.save();
      ctx.strokeStyle = PIPE_COLORS[drawPipeMode.type] ?? '#888';
      ctx.lineWidth = 2; ctx.setLineDash([6,3]);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(pipeDrawCursor.wx, pipeDrawCursor.wy); ctx.stroke();
      ctx.setLineDash([]);
      // Start nuqta belgisi
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.arc(p1.x, p1.y, 5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Library ghost — drag qilinayotgan element preview
    if (libGhostPos && draggingLibType) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#3b82f6'; ctx.fillStyle = '#dbeafe'; ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      const gw = m2px(0.5), gh = m2px(0.5);
      ctx.fillRect(libGhostPos.x - gw/2, libGhostPos.y - gh/2, gw, gh);
      ctx.strokeRect(libGhostPos.x - gw/2, libGhostPos.y - gh/2, gw, gh);
      ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.restore();
    }

    // Elevation chiziqlari (front/back/left/right uchun)
    if (view !== 'top' && view !== 'bottom' && view !== '3d' && layers.dimensions) {
      drawElevationMarks(ctx, project, view);
    }

    ctx.restore();

    // 5. Legenda (pan/zoom dan tashqarida)
    const legendX = 30;
    const legendY = H - STAMP_H - VIEWBAR_H - 80;
    drawLegend(ctx, legendX, legendY, layers);

    // 6. Shimol strelkasi (faqat top view)
    if (view === 'top') {
      drawNorthArrow(ctx, W - 55, H - STAMP_H - VIEWBAR_H - 30);
    }

    // 7. Ko'rinish satri
    drawViewBar(ctx, W, view, activeFloor, project.floorCount, H - STAMP_H - VIEWBAR_H + 2);

    // 8. Shtamp
    drawStamp(ctx, W, H, project, activeFloor);

  }, [project, view, activeFloor, selectedId, selectedPipeId, selectedRoomId, offset, scale, layers, dragPos, resizeDims, roomDragPos, roomResizeDims, riserDragPos, vertexDragPts, libGhostPos, draggingLibType, endpointDragPos, pipeDrawCursor, drawPipeMode]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => draw());
    obs.observe(el);
    return () => obs.disconnect();
  }, [draw]);

  // ── Grid ─────────────────────────────────────────────────────────────────────
  function drawGrid(ctx: CanvasRenderingContext2D, W: number, H: number, sc: number) {
    ctx.strokeStyle = C.grid;
    ctx.lineWidth   = LW.grid;
    const step = SCALE; // 1m grid
    for (let x = -W; x < W * 2; x += step) {
      ctx.beginPath(); ctx.moveTo(x, -H); ctx.lineTo(x, H * 2); ctx.stroke();
    }
    for (let y = -H; y < H * 2; y += step) {
      ctx.beginPath(); ctx.moveTo(-W, y); ctx.lineTo(W * 2, y); ctx.stroke();
    }
  }

  // ── Elevation marks ────────────────────────────────────────────────────────
  function drawElevationMarks(ctx: CanvasRenderingContext2D, proj: PlumbingProject, v: ViewType) {
    for (let f = 0; f <= proj.floorCount; f++) {
      const elev = f * proj.floorHeight;
      const z    = m2px(proj.floorCount * proj.floorHeight) - m2px(elev);
      ctx.strokeStyle = C.dimLine;
      ctx.lineWidth   = 0.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(-20, z); ctx.lineTo(m2px(proj.buildingWidth) + 20, z); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.dimText;
      ctx.font = FONT.dim;
      ctx.textAlign = 'right';
      ctx.fillText(`${f === 0 ? '±' : '+'}${elev.toFixed(2)}`, -24, z + 4);
    }
  }

  // ── Pipe filter ─────────────────────────────────────────────────────────────
  function filterPipesByView(pipes: PlumbingPipeSegment[], v: ViewType, floor: number) {
    if (v === 'top' || v === 'bottom') {
      // Horizontal pipes + drain pipes (floor level) for current floor
      return pipes.filter(p => p.floor === floor && !p.isRiser);
    }
    // Elevation views: risers + all floor branches
    return pipes.filter(p => p.isRiser || p.floor === floor);
  }

  // ── Interaction helpers ─────────────────────────────────────────────────────
  const DRAW_Y = 65;

  function worldPt(sx: number, sy: number) {
    return { x: (sx - offset.x) / scale, y: (sy - offset.y - DRAW_Y) / scale };
  }

  // World koordinatadan metr koordinataga (SCALE bo'lib)
  function w2m(v: number) { return v / SCALE; }

  function fixturePx(fix: typeof project.fixtures[0]) {
    let pos = fix.position;
    if (dragPos?.id === fix.id) {
      pos = { ...fix.position, x: dragPos.x, y: dragPos.y };
    } else if (resizeDims?.id === fix.id && (resizeDims.dx || resizeDims.dy)) {
      pos = { ...fix.position, x: fix.position.x + resizeDims.dx, y: fix.position.y + resizeDims.dy };
    }
    return projectPt(pos, view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
  }

  // Resize handle pozitsiyalarini qaytaradi (canvas SCALE space da)
  function getHandles(fix: typeof project.fixtures[0]): Record<HandleDir, [number, number]> {
    const p = fixturePx(fix);
    const rd = resizeDims?.id === fix.id ? resizeDims : null;
    const fw = m2px(rd ? rd.w : fix.dimensions.w);
    const fd = m2px(rd ? rd.d : fix.dimensions.d);
    const hx = p.x, hy = p.y;
    const ex = fw/2 + 3, ey = fd/2 + 3;
    return {
      nw: [hx - ex, hy - ey], n:  [hx,      hy - ey], ne: [hx + ex, hy - ey],
      w:  [hx - ex, hy      ],                          e:  [hx + ex, hy      ],
      sw: [hx - ex, hy + ey], s:  [hx,      hy + ey], se: [hx + ex, hy + ey],
    };
  }

  // Handle hit test — returns {fixId, dir} or null
  function hitHandle(wx: number, wy: number): { fixId: string; dir: HandleDir } | null {
    if (!selectedId || !(view === 'top' || view === 'bottom') || scale < 0.4) return null;
    const fix = project.fixtures.find(f => f.id === selectedId);
    if (!fix) return null;
    const handles = getHandles(fix);
    for (const dir of HANDLE_DIRS) {
      const [hx, hy] = handles[dir];
      const r = (HANDLE_R + 4) / scale; // screen pixels → world
      if (Math.abs(wx - hx) <= r && Math.abs(wy - hy) <= r) {
        return { fixId: fix.id, dir: dir as HandleDir };
      }
    }
    return null;
  }

  function hitFixture(wx: number, wy: number): string | null {
    const fixes = (view === 'top' || view === 'bottom')
      ? project.fixtures.filter(f => f.floor === activeFloor)
      : project.fixtures;
    for (const fix of [...fixes].reverse()) {
      const p = fixturePx(fix);
      const hw = Math.max(12, m2px(fix.dimensions.w) / 2) + 5;
      const hd = Math.max(12, m2px(fix.dimensions.d) / 2) + 5;
      if (Math.abs(wx - p.x) <= hw && Math.abs(wy - p.y) <= hd) return fix.id;
    }
    return null;
  }

  // Tanlangan pipe endpoint hit test
  function hitPipeEndpoint(wx: number, wy: number): { pipeId: string; end: 'from'|'to' } | null {
    if (!selectedPipeId) return null;
    const pipe = project.pipes.find(p => p.id === selectedPipeId);
    if (!pipe) return null;
    const r = 10 / scale; // world units
    for (const end of ['from', 'to'] as const) {
      const pt = projectPt(pipe[end], view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
      if (Math.hypot(wx - pt.x, wy - pt.y) <= r) return { pipeId: pipe.id, end };
    }
    return null;
  }

  function hitPipe(wx: number, wy: number): string | null {
    const pipes = filterPipesByView(project.pipes, view, activeFloor);
    for (const pipe of [...pipes].reverse()) {
      const p1 = projectPt(pipe.from, view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
      const p2 = projectPt(pipe.to,   view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
      // Nuqtaning chiziqqacha masofasi
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const len2 = dx*dx + dy*dy;
      if (len2 < 1) continue;
      const t = Math.max(0, Math.min(1, ((wx-p1.x)*dx + (wy-p1.y)*dy) / len2));
      const nearX = p1.x + t*dx, nearY = p1.y + t*dy;
      const dist = Math.sqrt((wx-nearX)**2 + (wy-nearY)**2);
      if (dist < Math.max(8, 5/scale)) return pipe.id;
    }
    return null;
  }

  function hitPolygonVertex(wx: number, wy: number): { roomId: string; idx: number } | null {
    if (!selectedRoomId || (view !== 'top' && view !== 'bottom')) return null;
    const room = project.rooms.find(r => r.id === selectedRoomId);
    if (!room?.shape || room.shape.length < 3) return null;
    const vd = vertexDragPts?.roomId === room.id ? vertexDragPts.pts : room.shape;
    const rp = roomDragPos?.id === room.id ? roomDragPos : null;
    const ox = m2px(rp?.x ?? room.position.x);
    const oy = m2px(rp?.y ?? room.position.y);
    const r = (HANDLE_R + 5) / scale;
    for (let i = 0; i < vd.length; i++) {
      const px = ox + m2px(vd[i].x), py = oy + m2px(vd[i].y);
      if (Math.hypot(wx - px, wy - py) <= r) return { roomId: room.id, idx: i };
    }
    return null;
  }

  function hitRiser(wx: number, wy: number): string | null {
    if (view !== 'top' && view !== 'bottom') return null;
    if (!project.risers?.length) return null;
    for (const riser of [...project.risers].reverse()) {
      const rd = riserDragPos?.id === riser.id ? riserDragPos : null;
      const rx = m2px(rd?.x ?? riser.x), ry = m2px(rd?.y ?? riser.y);
      const R = Math.max(8, m2px(riser.diamMm / 1000) * 3) / scale + 4 / scale;
      if (Math.hypot(wx - rx, wy - ry) <= R) return riser.id;
    }
    return null;
  }

  function hitRoom(wx: number, wy: number): string | null {
    if (view !== 'top' && view !== 'bottom') return null;
    const floorRooms = project.rooms.filter(r => r.floor === activeFloor);
    for (const room of [...floorRooms].reverse()) {
      const rd = roomResizeDims?.id === room.id ? roomResizeDims : null;
      const rp = roomDragPos?.id    === room.id ? roomDragPos   : null;
      const rx = m2px(rd?.x ?? rp?.x ?? room.position.x);
      const ry = m2px(rd?.y ?? rp?.y ?? room.position.y);
      const rw = m2px(rd?.width  ?? room.width);
      const rh = m2px(rd?.length ?? room.length);
      if (wx >= rx && wx <= rx + rw && wy >= ry && wy <= ry + rh) return room.id;
    }
    return null;
  }

  function hitRoomCorner(wx: number, wy: number): { roomId: string; corner: RoomCorner } | null {
    if (!selectedRoomId || (view !== 'top' && view !== 'bottom')) return null;
    const room = project.rooms.find(r => r.id === selectedRoomId);
    if (!room) return null;
    const rd = roomResizeDims?.id === room.id ? roomResizeDims : null;
    const rp = roomDragPos?.id    === room.id ? roomDragPos   : null;
    const rx = m2px(rd?.x ?? rp?.x ?? room.position.x);
    const ry = m2px(rd?.y ?? rp?.y ?? room.position.y);
    const rw = m2px(rd?.width  ?? room.width);
    const rh = m2px(rd?.length ?? room.length);
    const PAD = 4;
    const r = (HANDLE_R + 5) / scale;
    const corners: Array<[RoomCorner, number, number]> = [
      ['nw', rx - PAD,       ry - PAD      ],
      ['ne', rx + rw + PAD,  ry - PAD      ],
      ['sw', rx - PAD,       ry + rh + PAD ],
      ['se', rx + rw + PAD,  ry + rh + PAD ],
    ];
    for (const [corner, cx, cy] of corners) {
      if (Math.hypot(wx - cx, wy - cy) <= r) return { roomId: room.id, corner };
    }
    return null;
  }

  // Resize cursor style uchun
  const RESIZE_CURSORS: Record<HandleDir, string> = {
    n:'ns-resize', s:'ns-resize', e:'ew-resize', w:'ew-resize',
    nw:'nwse-resize', se:'nwse-resize', ne:'nesw-resize', sw:'nesw-resize',
  };
  const [cursorStyle, setCursorStyle] = useState('default');

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button === 1) return; // middle — pan
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const { x: wx, y: wy } = worldPt(sx, sy);

    // 0a. Label drag — label ustiga bosilganini tekshirish
    if (e.button === 0 && (view === 'top' || view === 'bottom')) {
      const hit = renderedLabels.current.find(l =>
        sx >= l.sx && sx <= l.sx + l.sw && sy >= l.sy && sy <= l.sy + l.sh
      );
      if (hit) {
        const curOvr = (project.labelOverrides ?? {})[hit.key];
        draggingLabel.current = {
          key: hit.key,
          origDx: curOvr?.dx ?? 0,
          origDy: curOvr?.dy ?? 0,
          startSx: sx, startSy: sy,
        };
        setLabelDragKey(hit.key);
        lastMouse.current = { x: sx, y: sy };
        e.stopPropagation();
        return;
      }
    }

    // 0. Pipe draw mode — 2 nuqta bosib truba chizish
    if (drawPipeMode && view === 'top') {
      const mx = w2m(wx), my = w2m(wy);
      const z = (activeFloor - 1) * project.floorHeight + 0.3;
      if (!pipeDrawStart.current) {
        pipeDrawStart.current = { x: mx, y: my, z };
        setCursorStyle('crosshair');
      } else {
        const from = pipeDrawStart.current;
        const to = { x: mx, y: my, z };
        onAddPipe?.({ ...drawPipeMode, from, to, floor: activeFloor });
        pipeDrawStart.current = null;
        setPipeDrawCursor(null);
        setCursorStyle('crosshair');
      }
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // 1. Library drag drop
    if (draggingLibType && view === 'top') {
      const mx = w2m(wx), my = w2m(wy);
      const floor = activeFloor;
      onDropFixture?.(draggingLibType, { x: mx, y: my, z: (floor-1)*project.floorHeight });
      setLibGhostPos(null);
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // 1b. Pipe endpoint drag
    const epHit = hitPipeEndpoint(wx, wy);
    if (epHit) {
      const pipe = project.pipes.find(p => p.id === epHit.pipeId)!;
      draggingEndpoint.current = { pipeId: epHit.pipeId, end: epHit.end, origPos: pipe[epHit.end] };
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // 2. Resize handle
    const handle = hitHandle(wx, wy);
    if (handle) {
      const fix = project.fixtures.find(f => f.id === handle.fixId)!;
      resizingFix.current = {
        id: handle.fixId, dir: handle.dir,
        origDims: { w: fix.dimensions.w, d: fix.dimensions.d },
        origPos: { x: fix.position.x, y: fix.position.y },
        startWx: wx, startWy: wy,
      };
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // 2b. Riser hit — drag start
    const hitR2 = hitRiser(wx, wy);
    if (hitR2) {
      const riser = project.risers.find(r => r.id === hitR2)!;
      draggingRiser.current = { id: hitR2, origPos: { x: riser.x, y: riser.y } };
      onSelectFixture(null); onSelectPipe(null); onSelectRoom(null);
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // 3. Fixture hit
    const hitFix = hitFixture(wx, wy);
    if (hitFix) {
      onSelectFixture(hitFix);
      onSelectPipe(null);
      onSelectRoom(null);
      draggingFix.current = hitFix;
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // 4. Pipe hit
    const hitP = hitPipe(wx, wy);
    if (hitP) {
      onSelectPipe(hitP);
      onSelectFixture(null);
      onSelectRoom(null);
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // 4b. Polygon vertex drag
    const vertexHit = hitPolygonVertex(wx, wy);
    if (vertexHit) {
      const room = project.rooms.find(r => r.id === vertexHit.roomId)!;
      draggingVertex.current = { roomId: vertexHit.roomId, idx: vertexHit.idx, origPts: room.shape! };
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // 5. Room corner resize
    const cornerHit = hitRoomCorner(wx, wy);
    if (cornerHit) {
      const room = project.rooms.find(r => r.id === cornerHit.roomId)!;
      resizingRoom.current = {
        id: cornerHit.roomId,
        corner: cornerHit.corner,
        origPos:  { x: room.position.x, y: room.position.y },
        origDims: { width: room.width, length: room.length },
        startWx: wx, startWy: wy,
      };
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // 6. Room hit (top view only)
    const hitR = hitRoom(wx, wy);
    if (hitR) {
      if (hitR !== selectedRoomId) {
        onSelectRoom(hitR);
        onSelectFixture(null);
        onSelectPipe(null);
      } else {
        // already selected — start drag
        const room = project.rooms.find(r => r.id === hitR)!;
        draggingRoom.current = { id: hitR, origPos: { x: room.position.x, y: room.position.y }, startWx: wx, startWy: wy };
      }
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // 7. Pan
    onSelectFixture(null);
    onSelectPipe(null);
    onSelectRoom(null);
    isPanning.current = true;
    lastMouse.current = { x: sx, y: sy };
  }

  function openContextMenu(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (drawPipeMode || draggingLibType) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const { x: wx, y: wy } = worldPt(sx, sy);
    const mx = w2m(wx), my = w2m(wy);

    const roomId    = hitRoom(wx, wy) ?? undefined;
    const fixtureId = hitFixture(wx, wy) ?? undefined;
    const pipeId    = hitPipe(wx, wy) ?? undefined;

    // Tanlash ham amalga oshirsin
    if (roomId)    { onSelectRoom(roomId); onSelectFixture(null); onSelectPipe(null); }
    if (fixtureId) { onSelectFixture(fixtureId); onSelectRoom(null); onSelectPipe(null); }
    if (pipeId)    { onSelectPipe(pipeId); onSelectFixture(null); onSelectRoom(null); }

    onShowContextMenu?.({
      screenX: e.clientX,
      screenY: e.clientY,
      roomId,
      fixtureId,
      pipeId,
      worldPos: { x: mx, y: my },
    });
  }

  function onDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (drawPipeMode || draggingLibType) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const { x: wx, y: wy } = worldPt(sx, sy);
    // Xona, jihoz, yoki truba ustida — context menu
    const roomId    = hitRoom(wx, wy);
    const fixtureId = hitFixture(wx, wy);
    const pipeId    = hitPipe(wx, wy);
    if (roomId || fixtureId || pipeId) {
      openContextMenu(e);
      return;
    }
    // Bo'sh joy — yangi xona (faqat top view)
    if (view === 'top' || view === 'bottom') {
      const mx = w2m(wx), my = w2m(wy);
      onAddRoom?.({ x: mx, y: my }, activeFloor);
    }
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const dx = sx - lastMouse.current.x, dy = sy - lastMouse.current.y;
    const { x: wx, y: wy } = worldPt(sx, sy);

    // Label drag
    if (draggingLabel.current) {
      const { key, origDx, origDy, startSx, startSy } = draggingLabel.current;
      const ddx = (sx - startSx) / scale;
      const ddy = (sy - startSy) / scale;
      const curOvr = (project.labelOverrides ?? {})[key];
      // Preview: faqat offset ni update qilamiz (server call yo'q, faqat re-render)
      onUpdateLabel?.(key, { dx: origDx + ddx, dy: origDy + ddy, fontSize: curOvr?.fontSize });
      setCursorStyle('grabbing');
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // Cursor: label ustida
    const hitLabel = renderedLabels.current.find(l =>
      sx >= l.sx && sx <= l.sx + l.sw && sy >= l.sy && sy <= l.sy + l.sh
    );
    if (hitLabel && !isPanning.current && !draggingFix.current) {
      setCursorStyle('grab');
    }

    // Pipe draw mode cursor
    if (drawPipeMode) {
      if (pipeDrawStart.current) setPipeDrawCursor({ wx, wy });
      setCursorStyle('crosshair');
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // Pipe endpoint drag
    if (draggingEndpoint.current) {
      setEndpointDragPos({ pipeId: draggingEndpoint.current.pipeId, end: draggingEndpoint.current.end, x: wx, y: wy });
      setCursorStyle('crosshair');
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // Library ghost
    if (draggingLibType && view === 'top') {
      setLibGhostPos({ x: wx, y: wy });
      setCursorStyle('copy');
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // Polygon vertex drag
    if (draggingVertex.current && view === 'top') {
      const { roomId, idx, origPts } = draggingVertex.current;
      const room = project.rooms.find(r => r.id === roomId)!;
      const rp = roomDragPos?.id === roomId ? roomDragPos : null;
      const ox = rp?.x ?? room.position.x;
      const oy = rp?.y ?? room.position.y;
      const snap = (v: number) => Math.round(v / 0.05) * 0.05;
      const newPts = origPts.map((p, i) => i === idx
        ? { x: snap(w2m(wx) - ox), y: snap(w2m(wy) - oy) }
        : p
      );
      setVertexDragPts({ roomId, pts: newPts });
      setCursorStyle('crosshair');
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // Riser drag
    if (draggingRiser.current && view === 'top') {
      const snap = (v: number) => Math.round(v / 0.1) * 0.1;
      setRiserDragPos({ id: draggingRiser.current.id, x: snap(w2m(wx)), y: snap(w2m(wy)) });
      setCursorStyle('grabbing');
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // Room resize drag
    if (resizingRoom.current) {
      const { id, corner, origPos, origDims, startWx, startWy } = resizingRoom.current;
      const dxM = w2m(wx - startWx), dyM = w2m(wy - startWy);
      const snap = (v: number) => Math.round(v / 0.05) * 0.05;
      let x = origPos.x, y = origPos.y;
      let width = origDims.width, length = origDims.length;

      if (corner === 'nw') { x = snap(origPos.x + dxM); y = snap(origPos.y + dyM); width = snap(Math.max(0.5, origDims.width - dxM)); length = snap(Math.max(0.5, origDims.length - dyM)); }
      if (corner === 'ne') { y = snap(origPos.y + dyM); width = snap(Math.max(0.5, origDims.width + dxM)); length = snap(Math.max(0.5, origDims.length - dyM)); }
      if (corner === 'sw') { x = snap(origPos.x + dxM); width = snap(Math.max(0.5, origDims.width - dxM)); length = snap(Math.max(0.5, origDims.length + dyM)); }
      if (corner === 'se') { width = snap(Math.max(0.5, origDims.width + dxM)); length = snap(Math.max(0.5, origDims.length + dyM)); }

      setRoomResizeDims({ id, x, y, width, length });
      setCursorStyle('nwse-resize');
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // Room drag
    if (draggingRoom.current && view === 'top') {
      const { id, origPos, startWx, startWy } = draggingRoom.current;
      const snap = (v: number) => Math.round(v / 0.1) * 0.1;
      const dxM = w2m(wx - startWx), dyM = w2m(wy - startWy);
      setRoomDragPos({ id, x: snap(origPos.x + dxM), y: snap(origPos.y + dyM) });
      setCursorStyle('grabbing');
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // Resize drag
    if (resizingFix.current) {
      const { id, dir, origDims, startWx, startWy } = resizingFix.current;
      const snap5 = (v: number) => Math.round(v / 0.05) * 0.05;

      const dxM = w2m(wx - startWx);
      const dyM = w2m(wy - startWy);

      let newW = origDims.w, newD = origDims.d;
      if (dir.includes('e')) newW = Math.max(0.1, origDims.w + dxM);
      if (dir.includes('w')) newW = Math.max(0.1, origDims.w - dxM);
      if (dir.includes('s')) newD = Math.max(0.1, origDims.d + dyM);
      if (dir.includes('n')) newD = Math.max(0.1, origDims.d - dyM);
      newW = snap5(newW); newD = snap5(newD);

      // w/n handle da markaz ham siljaydi — preview uchun offset
      const dW = newW - origDims.w;
      const dD = newD - origDims.d;
      const pdx = dir.includes('w') ? -dW / 2 : dir.includes('e') ? dW / 2 : 0;
      const pdy = dir.includes('n') ? -dD / 2 : dir.includes('s') ? dD / 2 : 0;

      setResizeDims({ id, w: newW, d: newD, dx: pdx, dy: pdy });
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // Move drag
    if (draggingFix.current && view === 'top') {
      const snap = (v: number) => Math.round(v / 0.05) * 0.05;
      setDragPos({ id: draggingFix.current, x: snap(w2m(wx)), y: snap(w2m(wy)) });
      setCursorStyle('grabbing');
      lastMouse.current = { x: sx, y: sy };
      return;
    }

    // Pan
    if (isPanning.current) {
      setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
      setCursorStyle('grab');
    } else {
      // Hover cursor
      const handle = hitHandle(wx, wy);
      const roomCorner = hitRoomCorner(wx, wy);
      if (handle) {
        setCursorStyle(RESIZE_CURSORS[handle.dir]);
      } else if (roomCorner) {
        const c = roomCorner.corner;
        setCursorStyle(c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize');
      } else if (hitFixture(wx, wy)) {
        setCursorStyle('grab');
      } else if (selectedRoomId && hitRoom(wx, wy) === selectedRoomId) {
        setCursorStyle('grab');
      } else if (draggingLibType) {
        setCursorStyle('copy');
      } else {
        setCursorStyle('default');
      }
    }

    lastMouse.current = { x: sx, y: sy };
  }

  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    // Label drag commit
    if (draggingLabel.current) {
      const { key, origDx, origDy, startSx, startSy } = draggingLabel.current;
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const ddx = (sx - startSx) / scale;
      const ddy = (sy - startSy) / scale;
      const curOvr = (project.labelOverrides ?? {})[key];
      onUpdateLabel?.(key, { dx: origDx + ddx, dy: origDy + ddy, fontSize: curOvr?.fontSize });
      draggingLabel.current = null;
      setLabelDragKey(null);
      setCursorStyle('default');
      return;
    }

    // Endpoint drag commit
    if (draggingEndpoint.current && endpointDragPos) {
      const { pipeId, end, origPos } = draggingEndpoint.current;
      const pipe = project.pipes.find(p => p.id === pipeId);
      if (pipe) {
        const mx = w2m(endpointDragPos.x), my = w2m(endpointDragPos.y);
        onMovePipeEndpoint?.(pipeId, end, { ...origPos, x: mx, y: my });
      }
      draggingEndpoint.current = null;
      setEndpointDragPos(null);
      setCursorStyle(drawPipeMode ? 'crosshair' : 'default');
      return;
    }

    // Polygon vertex commit
    if (draggingVertex.current && vertexDragPts) {
      onResizeRoom?.(vertexDragPts.roomId, { shape: vertexDragPts.pts } as Parameters<typeof onResizeRoom>[1]);
      draggingVertex.current = null;
      setVertexDragPts(null);
    }

    // Riser drag commit
    if (draggingRiser.current && riserDragPos) {
      onMoveRiser?.(riserDragPos.id, { x: riserDragPos.x, y: riserDragPos.y });
      draggingRiser.current = null;
      setRiserDragPos(null);
    }

    // Room resize commit — bitta atomik call (position + dims birga)
    if (resizingRoom.current && roomResizeDims) {
      const { id, x, y, width, length } = roomResizeDims;
      onResizeRoom?.(id, { width, length, position: { x, y } });
      resizingRoom.current = null;
      setRoomResizeDims(null);
    }

    // Room drag commit
    if (draggingRoom.current && roomDragPos) {
      onMoveRoom?.(roomDragPos.id, { x: roomDragPos.x, y: roomDragPos.y });
      draggingRoom.current = null;
      setRoomDragPos(null);
    }

    // Resize commit
    if (resizingFix.current && resizeDims) {
      const { origPos } = resizingFix.current;
      const snap5 = (v: number) => Math.round(v / 0.05) * 0.05;
      const newX = snap5(origPos.x + resizeDims.dx);
      const newY = snap5(origPos.y + resizeDims.dy);
      onResizeFixture?.(resizeDims.id, { w: resizeDims.w, d: resizeDims.d });
      if ((resizeDims.dx !== 0 || resizeDims.dy !== 0) && onMoveFixture) {
        const fix = project.fixtures.find(f => f.id === resizeDims.id);
        if (fix) onMoveFixture(resizeDims.id, { ...fix.position, x: newX, y: newY });
      }
      resizingFix.current = null;
      setResizeDims(null);
    }

    // Move commit
    if (draggingFix.current && dragPos && onMoveFixture) {
      const fix = project.fixtures.find(f => f.id === draggingFix.current);
      if (fix) onMoveFixture(draggingFix.current, { ...fix.position, x: dragPos.x, y: dragPos.y });
    }

    isPanning.current = false;
    draggingFix.current = null;
    setDragPos(null);
    setCursorStyle(drawPipeMode ? 'crosshair' : 'default');
  }

  function onMouseLeave() {
    // Label drag commit on leave
    if (draggingLabel.current) {
      draggingLabel.current = null;
      setLabelDragKey(null);
    }
    // Commit any in-progress drags so work isn't lost when cursor leaves canvas
    if (draggingFix.current && dragPos && onMoveFixture) {
      const fix = project.fixtures.find(f => f.id === draggingFix.current);
      if (fix) onMoveFixture(draggingFix.current, { ...fix.position, x: dragPos.x, y: dragPos.y });
    }
    if (resizingFix.current && resizeDims) {
      const snap5 = (v: number) => Math.round(v / 0.05) * 0.05;
      onResizeFixture?.(resizeDims.id, { w: resizeDims.w, d: resizeDims.d });
      if ((resizeDims.dx !== 0 || resizeDims.dy !== 0) && onMoveFixture) {
        const fix = project.fixtures.find(f => f.id === resizeDims.id);
        if (fix) onMoveFixture(resizeDims.id, { ...fix.position, x: snap5(resizeDims.dx + fix.position.x), y: snap5(resizeDims.dy + fix.position.y) });
      }
    }
    if (draggingRoom.current && roomDragPos) {
      onMoveRoom?.(roomDragPos.id, { x: roomDragPos.x, y: roomDragPos.y });
    }
    if (resizingRoom.current && roomResizeDims) {
      onResizeRoom?.(roomResizeDims.id, {
        width: roomResizeDims.width, length: roomResizeDims.length,
        position: { x: roomResizeDims.x, y: roomResizeDims.y },
      });
    }
    if (draggingRiser.current && riserDragPos) {
      onMoveRiser?.(riserDragPos.id, { x: riserDragPos.x, y: riserDragPos.y });
    }
    if (draggingVertex.current && vertexDragPts) {
      onResizeRoom?.(vertexDragPts.roomId, { shape: vertexDragPts.pts });
    }

    isPanning.current = false;
    draggingFix.current = null;
    resizingFix.current = null;
    draggingRoom.current = null;
    resizingRoom.current = null;
    draggingRiser.current = null;
    draggingVertex.current = null;
    draggingEndpoint.current = null;
    setDragPos(null);
    setResizeDims(null);
    setRoomDragPos(null);
    setRoomResizeDims(null);
    setRiserDragPos(null);
    setVertexDragPts(null);
    setLibGhostPos(null);
    setEndpointDragPos(null);
    if (!drawPipeMode) setCursorStyle('default');
  }

  // Backspace / Delete → fixture yoki pipe o'chirish; Escape → pipe draw bekor
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedId) { onRemoveFixture?.(selectedId); onSelectFixture(null); }
        else if (selectedPipeId) { onRemovePipe?.(selectedPipeId); onSelectPipe(null); }
        else if (selectedRoomId) { onRemoveRoom?.(selectedRoomId); onSelectRoom(null); }
      }
      if (e.key === 'Escape') {
        pipeDrawStart.current = null;
        setPipeDrawCursor(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, selectedPipeId, selectedRoomId, onRemoveFixture, onRemovePipe, onRemoveRoom, onSelectFixture, onSelectPipe, onSelectRoom]);

  // Library drag: mouse canvas dan ketganda ghost yo'qolsin
  useEffect(() => {
    if (!draggingLibType) setLibGhostPos(null);
  }, [draggingLibType]);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;

    // Label ustida scroll — font o'lchamini o'zgartirish
    const hitL = renderedLabels.current.find(l =>
      sx >= l.sx && sx <= l.sx + l.sw && sy >= l.sy && sy <= l.sy + l.sh
    );
    if (hitL) {
      const delta = e.deltaY < 0 ? 1 : -1;
      const curOvr = (project.labelOverrides ?? {})[hitL.key];
      const curFs = curOvr?.fontSize ?? hitL.fontSize;
      const newFs = Math.max(7, Math.min(20, curFs + delta));
      onUpdateLabel?.(hitL.key, { dx: curOvr?.dx ?? 0, dy: curOvr?.dy ?? 0, fontSize: newFs });
      return;
    }

    const mouseX = sx;
    // World origin Y is at offset.y + DRAW_Y in screen space, so subtract DRAW_Y
    const mouseY = sy - DRAW_Y;
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    setScale(prevScale => {
      const newScale = Math.max(0.15, Math.min(6, prevScale * factor));
      setOffset(prevOffset => ({
        x: mouseX - (mouseX - prevOffset.x) * (newScale / prevScale),
        y: mouseY - (mouseY - prevOffset.y) * (newScale / prevScale),
      }));
      return newScale;
    });
  }

  function fitToScreen() {
    const { W, H } = getSize();
    // Sarlavha (60px) + shtamp (70px) + viewbar (18px) + margins
    const usableW = W - 80;
    const usableH = H - 60 - 70 - 18 - 40;

    // Barcha xonalar real bbox (haqiqiy content o'lchami)
    const allRooms = project.rooms;
    const maxRoomX = allRooms.length > 0 ? Math.max(...allRooms.map(r => r.position.x + r.width))  : project.buildingWidth;
    const maxRoomY = allRooms.length > 0 ? Math.max(...allRooms.map(r => r.position.y + r.length)) : project.buildingLength;
    const totalBuildH = project.floorCount * project.floorHeight;

    let contentW: number, contentH: number;
    if (view === 'top' || view === 'bottom') {
      const rooms = project.rooms.filter(r => r.floor === activeFloor);
      if (rooms.length > 0) {
        contentW = m2px(Math.max(...rooms.map(r => r.position.x + r.width)));
        contentH = m2px(Math.max(...rooms.map(r => r.position.y + r.length)));
      } else {
        contentW = m2px(maxRoomX); contentH = m2px(maxRoomY);
      }
    } else if (view === 'front' || view === 'back') {
      contentW = m2px(maxRoomX);
      contentH = m2px(totalBuildH);
    } else if (view === 'left' || view === 'right') {
      // Left/right: Y axis bo'ylab, to'g'ri chuqurlik
      contentW = m2px(maxRoomY);
      contentH = m2px(totalBuildH);
    } else {
      contentW = m2px(maxRoomX);
      contentH = m2px(totalBuildH);
    }

    const scaleX = usableW / contentW;
    const scaleY = usableH / contentH;
    const s = Math.min(scaleX, scaleY, 3.0);

    // Markazga joylashtirish
    const scaledW = contentW * s;
    const scaledH = contentH * s;
    setScale(s);
    // Top margin: space for dimension lines (DIM_GAP=28px scaled) + padding
    const topPad = 44;
    const leftPad = 44; // space for right-side dimension lines
    setOffset({
      x: leftPad + Math.max(0, (usableW - scaledW - leftPad) / 2),
      y: topPad + Math.max(0, (usableH - scaledH - topPad) / 2),
    });
  }

  // Auto-fit on project/view change (not floor — user may have zoomed)
  useEffect(() => {
    // Small delay to let canvas size settle
    const t = setTimeout(fitToScreen, 50);
    return () => clearTimeout(t);
  }, [project.id, view]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#dde2e8]">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ cursor: cursorStyle }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onDoubleClick={onDoubleClick}
        onContextMenu={openContextMenu}
        onWheel={onWheel}
      />

      {/* Zoom tugmalari */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
        {[
          { label: '+', action: () => setScale(s => Math.min(6, s * 1.2)) },
          { label: '−', action: () => setScale(s => Math.max(0.15, s * 0.85)) },
          { label: '⊡', action: fitToScreen },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action}
            className="w-8 h-8 bg-white/90 border border-gray-300 rounded shadow text-gray-700 text-sm font-bold flex items-center justify-center hover:bg-gray-50 transition-colors">
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
