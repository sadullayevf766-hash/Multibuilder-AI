/**
 * PlumbingCanvas2D — Professional arxitektura plani uslubida santexnika chizmasi
 *
 * Standart: GOST 21.601-2011 (Suv ta'minoti va kanalizatsiya)
 * Uslub: Rasmiy arxitektura chizmasi — devor qalinligi, o'lcham chiziqlari,
 *        professional fixture belgilari, legenda, shtamp, ko'rinish satri
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { PlumbingProject, PlumbingFixture, PlumbingPipeSegment, ViewType } from '../../engine/plumbing-types';

// ── Konstantlar ──────────────────────────────────────────────────────────────
const SCALE  = 80;   // px per metr (asosiy) — kattaroq = tafsiliylar ko'proq
const WALL_T = 8;    // devor qalinligi px
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
  title:  'bold 13px "Segoe UI", Arial, sans-serif',
  header: 'bold 10px "Segoe UI", Arial, sans-serif',
  label:  '9px "Segoe UI", Arial, sans-serif',
  dim:    '8px "Courier New", monospace',
  small:  '7px "Segoe UI", Arial, sans-serif',
  stamp:  'bold 8px "Segoe UI", Arial, sans-serif',
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
    { x: col2 + 4, y: sy + 12, label: 'В1 bosh', val: `ø${project.stats.mainColdDiamMm}` },
    { x: col2 + 4, y: sy + 30, label: 'Т3 bosh', val: `ø${project.stats.mainHotDiamMm}` },
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
    { color: C.cold,  dash: [],   label: 'В1 — Sovuq suv',       show: layers.cold  },
    { color: C.hot,   dash: [],   label: 'Т3 — Issiq suv',        show: layers.hot   },
    { color: C.circ,  dash: [],   label: 'Т4 — Sirkul',           show: layers.circ  },
    { color: C.drain, dash: [5,3],label: 'К1 — Kanalizatsiya',    show: layers.drain },
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

/** Devor va xona — faqat grafik, o'lchamlar alohida */
function drawRoom(
  ctx: CanvasRenderingContext2D,
  rx: number, ry: number,
  rw: number, rl: number,
  room: { name: string; type: string; width: number; length: number },
  scale: number,
) {
  ctx.fillStyle = ROOM_COLORS[room.type] ?? C.roomBg;
  ctx.fillRect(rx, ry, rw, rl);

  ctx.strokeStyle = C.wall;
  ctx.lineWidth   = LW.wall;
  ctx.strokeRect(rx, ry, rw, rl);

  // Devor qalinligi hatlama
  ctx.strokeStyle = C.wallFill;
  ctx.lineWidth   = 0.5;
  ctx.setLineDash([1, 3]);
  ctx.strokeRect(rx + WALL_T / 2, ry + WALL_T / 2, rw - WALL_T, rl - WALL_T);
  ctx.setLineDash([]);

  // Xona nomi va maydoni — markazda
  if (rw > 40 && rl > 30 && scale > 0.45) {
    ctx.fillStyle = C.textPrim;
    ctx.font      = FONT.header;
    ctx.textAlign = 'center';
    ctx.fillText(room.name, rx + rw / 2, ry + rl / 2 - 4);
    ctx.font      = FONT.small;
    ctx.fillStyle = C.textSec;
    ctx.fillText(`${(room.width * room.length).toFixed(1)} m²`, rx + rw / 2, ry + rl / 2 + 9);
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
  // Haqiqiy o'lcham — metrdan pikselga (scale allaqachon ctx da)
  // Minimum 20px gacha kattalashtir — kichik scale da ham ko'rinsin
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

  // Har bir fixture uchun haqiqiy o'lcham asosida chizish
  // cx, cy — fixture markazi; fw, fd — kengligi va chuqurligi px da
  const hw = fw / 2, hd = fd / 2; // yarim o'lchamlar

  switch (fix.type) {
    case 'toilet': {
      // Tank (devorga yaqin — yuqorida) + Bowl (oval — pastda)
      // North wall fixture: tank top = cy - hd + small_gap (devordan ichkarida)
      const tankGap = hd * 0.12; // devor chizig'idan ichkariga (proportsional)
      const tankTop = cy - hd + tankGap;
      const tankH   = hd * 0.32;
      const bowlTop = tankTop + tankH + hd * 0.04;
      const bowlH   = hd - tankGap - tankH - hd * 0.04;
      // Tank
      ctx.fillRect(cx - hw * 0.78, tankTop, hw * 1.56, tankH);
      ctx.strokeRect(cx - hw * 0.78, tankTop, hw * 1.56, tankH);
      // Bowl (oval, fixture qolgan qismini to'ldiradi)
      ctx.beginPath();
      ctx.ellipse(cx, bowlTop + bowlH * 0.5, hw * 0.82, bowlH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      break;
    }
    case 'sink': {
      // To'rtburchak + ichki oval
      ctx.fillRect(cx - hw, cy - hd, fw, fd);
      ctx.strokeRect(cx - hw, cy - hd, fw, fd);
      ctx.beginPath();
      ctx.ellipse(cx, cy, hw * 0.65, hd * 0.6, 0, 0, Math.PI * 2);
      ctx.strokeStyle = C.cold; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      // Kran
      ctx.fillStyle = C.textSec;
      ctx.beginPath(); ctx.arc(cx, cy - hd * 0.65, Math.max(2, hw * 0.15), 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'kitchen_sink': {
      ctx.fillRect(cx - hw, cy - hd, fw, fd);
      ctx.strokeRect(cx - hw, cy - hd, fw, fd);
      // Ikki hovuz
      const gap = 2;
      ctx.strokeStyle = C.cold; ctx.lineWidth = 0.8;
      ctx.strokeRect(cx - hw + gap, cy - hd + gap, fw / 2 - gap * 1.5, fd - gap * 2);
      ctx.strokeRect(cx + gap / 2,  cy - hd + gap, fw / 2 - gap * 1.5, fd - gap * 2);
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      break;
    }
    case 'bathtub': {
      ctx.fillRect(cx - hw, cy - hd, fw, fd);
      ctx.strokeRect(cx - hw, cy - hd, fw, fd);
      // Ichki oval (cho'milish joyi)
      ctx.beginPath();
      ctx.ellipse(cx, cy + hd * 0.1, hw * 0.7, hd * 0.4, 0, 0, Math.PI * 2);
      ctx.strokeStyle = C.cold; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      // Kran (yuqori tomonda)
      ctx.fillStyle = C.textSec;
      ctx.fillRect(cx - hw + 2, cy - hd + 2, fw - 4, fd * 0.12);
      break;
    }
    case 'shower': {
      ctx.fillRect(cx - hw, cy - hd, fw, fd);
      ctx.strokeRect(cx - hw, cy - hd, fw, fd);
      // Burchak radius (eshik)
      ctx.strokeStyle = C.dimLine; ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx - hw, cy - hd);
      ctx.arcTo(cx + hw, cy - hd, cx + hw, cy + hd, Math.min(fw, fd) * 0.9);
      ctx.stroke();
      // Dush boshi
      ctx.strokeStyle = C.cold; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(cx + hw * 0.35, cy - hd * 0.35, Math.max(3, r * 0.35), 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      break;
    }
    case 'bidet': {
      ctx.fillRect(cx - hw, cy - hd, fw, fd);
      ctx.strokeRect(cx - hw, cy - hd, fw, fd);
      ctx.beginPath();
      ctx.ellipse(cx, cy + hd * 0.1, hw * 0.6, hd * 0.45, 0, 0, Math.PI * 2);
      ctx.strokeStyle = C.circ; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      break;
    }
    case 'washing_machine':
    case 'dishwasher': {
      ctx.fillRect(cx - hw, cy - hd, fw, fd);
      ctx.strokeRect(cx - hw, cy - hd, fw, fd);
      const cr = Math.min(hw, hd) * 0.72;
      ctx.beginPath(); ctx.arc(cx, cy + hd * 0.08, cr, 0, Math.PI * 2);
      ctx.strokeStyle = C.cold; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy + hd * 0.08, cr * 0.45, -0.6, 2.0);
      ctx.stroke();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      break;
    }
    case 'towel_rail': {
      ctx.fillRect(cx - hw, cy - hd, fw, fd);
      ctx.strokeRect(cx - hw, cy - hd, fw, fd);
      ctx.strokeStyle = C.hot; ctx.lineWidth = 0.8;
      const bars = 3;
      for (let i = 1; i <= bars; i++) {
        const bx = cx - hw + (fw / (bars + 1)) * i;
        ctx.beginPath(); ctx.moveTo(bx, cy - hd + 1); ctx.lineTo(bx, cy + hd - 1); ctx.stroke();
      }
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      break;
    }
    case 'floor_drain': {
      const dr = Math.min(hw, hd);
      ctx.beginPath(); ctx.arc(cx, cy, dr, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = C.drain; ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx - dr * 0.6, cy); ctx.lineTo(cx + dr * 0.6, cy);
      ctx.moveTo(cx, cy - dr * 0.6); ctx.lineTo(cx, cy + dr * 0.6);
      ctx.stroke();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      break;
    }
    default: {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
  }

  // Belgi teglari (cold/hot/drain nuqtalar)
  if (scale > 0.8) {
    if (fix.coldIn)   { ctx.fillStyle = C.cold;  ctx.beginPath(); ctx.arc(cx - r * 0.8, cy - r * 0.8, 2.5, 0, Math.PI*2); ctx.fill(); }
    if (fix.hotIn)    { ctx.fillStyle = C.hot;   ctx.beginPath(); ctx.arc(cx + r * 0.8, cy - r * 0.8, 2.5, 0, Math.PI*2); ctx.fill(); }
    if (fix.drainOut) { ctx.fillStyle = C.drain; ctx.beginPath(); ctx.arc(cx, cy + r * 0.9, 2.5, 0, Math.PI*2); ctx.fill(); }
  }

  // IsSelected ko'rsatgich
  if (isSelected) {
    ctx.strokeStyle = C.fixSelect;
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(cx - r - 4, cy - r - 4, (r + 4) * 2, (r + 4) * 2);
    ctx.setLineDash([]);
  }

  // Ism yorlig'i
  if (scale > 0.7) {
    const label = fix.nameUz.length > 10 ? fix.nameUz.slice(0, 8) + '..' : fix.nameUz;
    ctx.fillStyle = C.paper;
    const tw3 = ctx.measureText(label).width + 4;
    ctx.fillRect(cx - tw3/2, cy + r + 3, tw3, 10);
    ctx.fillStyle = isSelected ? C.fixSelect : C.textSec;
    ctx.font = FONT.small;
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + r + 12);
  }
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

  // Diameter yorlig'i
  if (scale > 0.75 && pipe.label) {
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len > 30) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(mx - 14, my - 7, 28, 10);
      ctx.fillStyle = color;
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`ø${pipe.diamMm}`, mx, my + 2);
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

interface Props {
  project: PlumbingProject;
  view: ViewType;
  activeFloor: number;
  selectedId: string | null;
  onSelectFixture: (id: string | null) => void;
  // commit = faqat mouseUp da chaqiriladi (server save uchun)
  onMoveFixture?: (id: string, pos: { x: number; y: number; z: number }) => void;
  layers: Record<string, boolean>;
}

export default function PlumbingCanvas2D({
  project, view, activeFloor, selectedId, onSelectFixture, onMoveFixture, layers,
}: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [offset, setOffset] = useState({ x: 60, y: 70 });
  const [scale,  setScale]  = useState(1.0);
  const isPanning      = useRef(false);
  const lastMouse      = useRef({ x: 0, y: 0 });
  const draggingFix    = useRef<string | null>(null);

  // Local drag position — real-time, server ga faqat mouseUp da yuboriladi
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);

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
          drawRoom(ctx,
            m2px(room.position.x), m2px(room.position.y),
            m2px(room.width),      m2px(room.length),
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
            ctx.fillText(room.name, p1.x + pw / 2, p1.y - ph / 2);
          }
        }
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
        // Drag paytida local pozitsiyadan foydalanish (server javobini kutmasdan)
        const pos = (dragPos && dragPos.id === fix.id)
          ? { ...fix.position, x: dragPos.x, y: dragPos.y }
          : fix.position;
        const p = projectPt(pos, view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
        drawFixtureSymbol(ctx, fix, p.x, p.y, fix.id === selectedId, scale);
      }
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

  }, [project, view, activeFloor, selectedId, offset, scale, layers, dragPos]);

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

  // ── Interaction ─────────────────────────────────────────────────────────────
  function worldPt(sx: number, sy: number) {
    const drawY = 65;
    return { x: (sx - offset.x) / scale, y: (sy - offset.y - drawY) / scale };
  }

  function hitFixture(wx: number, wy: number): string | null {
    const fixes = project.fixtures.filter(f => f.floor === activeFloor);
    for (const fix of [...fixes].reverse()) {
      const p = projectPt(fix.position, view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
      const r = Math.max(10, m2px(Math.min(fix.dimensions.w, fix.dimensions.d)) / 2.2) + 6;
      if ((wx - p.x) ** 2 + (wy - p.y) ** 2 <= r * r) return fix.id;
    }
    return null;
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const { x: wx, y: wy } = worldPt(sx, sy);
    const hit = hitFixture(wx, wy);
    if (hit) {
      onSelectFixture(hit);
      if (onMoveFixture) draggingFix.current = hit;
    } else {
      onSelectFixture(null);
      isPanning.current = true;
    }
    lastMouse.current = { x: sx, y: sy };
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const dx = sx - lastMouse.current.x, dy = sy - lastMouse.current.y;

    if (isPanning.current) {
      setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
    } else if (draggingFix.current && view === 'top') {
      const { x: wx, y: wy } = worldPt(sx, sy);
      const snap = (v: number) => Math.round(v / 0.05) * 0.05;
      const newX = snap(wx / SCALE);
      const newY = snap(wy / SCALE);
      // Faqat local state yangilanadi — TEZKOR, server yo'q
      setDragPos({ id: draggingFix.current, x: newX, y: newY });
    }
    lastMouse.current = { x: sx, y: sy };
  }

  function onMouseUp() {
    isPanning.current = false;
    // MouseUp da server ga commit qilish
    if (draggingFix.current && dragPos && onMoveFixture) {
      const fix = project.fixtures.find(f => f.id === draggingFix.current);
      if (fix) {
        onMoveFixture(draggingFix.current, { ...fix.position, x: dragPos.x, y: dragPos.y });
      }
    }
    draggingFix.current = null;
    setDragPos(null);
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    // Cursor canvas ichidagi pozitsiyasi
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.12 : 0.9;

    setScale(prevScale => {
      const newScale = Math.max(0.15, Math.min(6, prevScale * factor));
      // Cursor atrofida zoom: cursor world koordinatasi o'zgarmasin
      // worldX = (mouseX - offsetX) / prevScale
      // newOffsetX = mouseX - worldX * newScale
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
        style={{ cursor: dragPos ? 'grabbing' : isPanning.current ? 'grab' : draggingFix.current ? 'grabbing' : 'default' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { onMouseUp(); setDragPos(null); draggingFix.current = null; }}
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
