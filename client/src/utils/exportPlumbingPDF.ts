/**
 * exportPlumbingPDF — Santexnika loyihasi PDF eksport
 *
 * Strategy:
 *  1. Har bir (view, floor) kombinatsiyasi uchun offscreen canvas render
 *  2. Canvas → PNG → jsPDF ga qo'yish
 *  3. A4 landscape, GOST shtamp sahifa raqamlari bilan
 */

import { jsPDF } from 'jspdf';
import type { PlumbingProject, ViewType } from '../engine/plumbing-types';

export interface PdfPage {
  view: ViewType;
  floor: number;
  label: string;
}

export interface PdfExportOptions {
  pages: PdfPage[];
  orientation: 'landscape' | 'portrait';
  quality: number; // 1-4, pixel density multiplier
  includeSpec?: boolean; // spetsifikatsiya sahifasi
}

// Canvas drawing engine import — lazy to avoid circular dep
// We use a dynamic approach: render to offscreen canvas using the same draw logic

const SCALE = 80; // px per metr — must match PlumbingCanvas2D.tsx SCALE constant

function m2px(v: number) { return v * SCALE; }

// ── Minimal draw engine (shared logic from PlumbingCanvas2D) ─────────────────

const C = {
  cold: '#0d5fa8', hot: '#b91c1c', circ: '#b45309', drain: '#78350f',
  wall: '#1e293b', wallFill: '#334155',
  fixFill: '#ffffff', fixStroke: '#1e293b',
  dimLine: '#64748b', dimText: '#334155',
  textPrim: '#0f172a', textSec: '#475569', textMuted: '#94a3b8',
  paper: '#ffffff', headerBg: '#1e3a5f', headerText: '#ffffff',
  border: '#cbd5e1',
};

const ROOM_COLORS: Record<string, string> = {
  bathroom: '#eff6ff', kitchen: '#fefce8', laundry: '#f0fdf4',
  toilet: '#faf5ff', utility: '#fafafa', other: '#f8fafc',
};

const PIPE_COLORS: Record<string, string> = {
  cold: C.cold, hot: C.hot, circ: C.circ, drain: C.drain,
};

function projectPt(
  pt: { x: number; y: number; z: number },
  view: ViewType,
  buildingW: number,
  buildingL: number,
  floorH: number,
  floors: number,
): { x: number; y: number } {
  const { x, y, z } = pt;
  const totalH = floors * floorH;
  switch (view) {
    case 'top':    return { x: m2px(x), y: m2px(y) };
    case 'front':  return { x: m2px(x), y: m2px(totalH) - m2px(z) };
    case 'back':   return { x: m2px(buildingW) - m2px(x), y: m2px(totalH) - m2px(z) };
    case 'left':   return { x: m2px(y), y: m2px(totalH) - m2px(z) };
    case 'right':  return { x: m2px(buildingL) - m2px(y), y: m2px(totalH) - m2px(z) };
    case 'bottom': return { x: m2px(x), y: m2px(buildingL) - m2px(y) };
    default:       return { x: m2px(x), y: m2px(y) };
  }
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  project: PlumbingProject,
  view: ViewType,
  floor: number,
  pageLabel: string,
) {
  const HEADER_H = 44;
  const STAMP_H  = 56;
  const MARGIN   = 40;
  const isTopView = view === 'top' || view === 'bottom';

  // White background
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // Header
  ctx.fillStyle = C.headerBg;
  ctx.fillRect(MARGIN, MARGIN, W - MARGIN * 2, HEADER_H);
  ctx.fillStyle = C.headerText;
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SANITARIYA SXEMASI — PLUMBING SCHEME', W / 2, MARGIN + 18);
  ctx.font = '12px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(`${pageLabel} | Miqyos 1:100 | ${floor}-qavat`, W / 2, MARGIN + 34);

  // Compute content bounds
  const floorRooms = project.rooms.filter(r =>
    isTopView ? r.floor === floor : true
  );
  const allRooms = project.rooms;
  const maxRoomX = allRooms.length > 0 ? Math.max(...allRooms.map(r => r.position.x + r.width)) : project.buildingWidth;
  const maxRoomY = allRooms.length > 0 ? Math.max(...allRooms.map(r => r.position.y + r.length)) : project.buildingLength;
  const totalBuildH = project.floorCount * project.floorHeight;

  let contentW: number, contentH: number;
  if (isTopView) {
    const fRooms = project.rooms.filter(r => r.floor === floor);
    if (fRooms.length > 0) {
      contentW = m2px(Math.max(...fRooms.map(r => r.position.x + r.width)));
      contentH = m2px(Math.max(...fRooms.map(r => r.position.y + r.length)));
    } else {
      contentW = m2px(maxRoomX); contentH = m2px(maxRoomY);
    }
  } else {
    contentW = m2px(maxRoomX);
    contentH = m2px(totalBuildH);
  }

  const usableW = W - MARGIN * 2 - 60;
  const usableH = H - HEADER_H - STAMP_H - MARGIN * 2 - 60;
  const s = Math.min(usableW / contentW, usableH / contentH, 3.0);
  const scaledW = contentW * s;
  const scaledH = contentH * s;
  const offX = MARGIN + 50 + Math.max(0, (usableW - scaledW) / 2);
  const offY = MARGIN + HEADER_H + 10 + Math.max(0, (usableH - scaledH) / 2);

  ctx.save();
  ctx.rect(MARGIN, MARGIN + HEADER_H, W - MARGIN * 2, H - STAMP_H - MARGIN * 2 - HEADER_H);
  ctx.clip();
  ctx.translate(offX, offY);
  ctx.scale(s, s);

  // Rooms — arxitektura uslubida qalin devorlar bilan
  const WT = 10; // devor qalinligi world px (PlumbingCanvas2D bilan mos)
  for (const room of floorRooms) {
    if (isTopView) {
      const p1 = projectPt({ x: room.position.x, y: room.position.y, z: 0 },
        view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
      const rw = m2px(room.width), rl = m2px(room.length);
      const color = ROOM_COLORS[room.type] ?? '#f8fafc';

      // Pol rangi (devor ichida)
      ctx.fillStyle = color;
      ctx.fillRect(p1.x + WT, p1.y + WT, rw - WT * 2, rl - WT * 2);

      // Qalin devorlar (to'ldirilgan)
      ctx.fillStyle = C.wall;
      ctx.fillRect(p1.x,           p1.y,           rw,  WT);  // shimol
      ctx.fillRect(p1.x,           p1.y + rl - WT, rw,  WT);  // janub
      ctx.fillRect(p1.x,           p1.y,           WT,  rl);   // g'arb
      ctx.fillRect(p1.x + rw - WT, p1.y,           WT,  rl);   // sharq

      // Devor hatching (diagonal)
      ctx.save();
      ctx.beginPath();
      ctx.rect(p1.x, p1.y, rw, WT);
      ctx.rect(p1.x, p1.y + rl - WT, rw, WT);
      ctx.rect(p1.x, p1.y, WT, rl);
      ctx.rect(p1.x + rw - WT, p1.y, WT, rl);
      ctx.clip();
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 0.6; ctx.setLineDash([2, 4]);
      for (let d = -rl; d < rw + rl; d += 8) {
        ctx.beginPath(); ctx.moveTo(p1.x + d, p1.y); ctx.lineTo(p1.x + d - rl, p1.y + rl); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.restore();

      // Tashqi kontur
      ctx.strokeStyle = C.wall; ctx.lineWidth = 0.5;
      ctx.strokeRect(p1.x, p1.y, rw, rl);

      // Room name
      // nom — overlay passda chiziladi (fixtures ustida)

      // Eshiklar
      if (project.openings) {
        for (const op of project.openings) {
          if (op.roomId !== room.id || op.type !== 'door') continue;
          const ow = m2px(op.width), off = m2px(op.offset);
          let x1 = 0, y1 = 0;
          switch (op.side) {
            case 'north': x1 = p1.x + off; y1 = p1.y; break;
            case 'south': x1 = p1.x + off; y1 = p1.y + rl; break;
            case 'west':  x1 = p1.x;        y1 = p1.y + off; break;
            case 'east':  x1 = p1.x + rw;   y1 = p1.y + off; break;
          }
          const isH = op.side === 'north' || op.side === 'south';
          // Devor teshigi
          ctx.fillStyle = color;
          if (isH) ctx.fillRect(x1, y1 - WT, ow, WT * 2);
          else     ctx.fillRect(x1 - WT, y1, WT * 2, ow);
          // Eshik taxtasi
          ctx.strokeStyle = C.wall; ctx.lineWidth = 1;
          if (isH) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + ow, y1); ctx.stroke(); }
          else { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1, y1 + ow); ctx.stroke(); }
          // Yoy
          ctx.strokeStyle = '#64748b'; ctx.lineWidth = 0.7; ctx.setLineDash([2, 2]);
          if (op.side === 'north') { ctx.beginPath(); ctx.arc(x1, y1, ow, 0, Math.PI/2); ctx.stroke(); }
          else if (op.side === 'south') { ctx.beginPath(); ctx.arc(x1, y1, ow, 0, -Math.PI/2, true); ctx.stroke(); }
          else if (op.side === 'west') { ctx.beginPath(); ctx.arc(x1, y1, ow, Math.PI/2, 0, true); ctx.stroke(); }
          else { ctx.beginPath(); ctx.arc(x1, y1, ow, Math.PI/2, Math.PI); ctx.stroke(); }
          ctx.setLineDash([]);
        }
      }
    } else {
      const baseZ = (room.floor - 1) * project.floorHeight;
      const p1 = projectPt({ x: room.position.x, y: room.position.y, z: baseZ },
        view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
      const pw = (view === 'front' || view === 'back') ? m2px(room.width) : m2px(room.length);
      const ph = m2px(room.height);
      ctx.fillStyle = ROOM_COLORS[room.type] ?? '#f8fafc';
      ctx.fillRect(p1.x, p1.y - ph, pw, ph);
      ctx.fillStyle = C.wall;
      ctx.fillRect(p1.x, p1.y - ph, pw, WT);
      ctx.fillRect(p1.x, p1.y - WT, pw, WT);
      ctx.fillRect(p1.x, p1.y - ph, WT, ph);
      ctx.fillRect(p1.x + pw - WT, p1.y - ph, WT, ph);
      ctx.strokeStyle = C.wall; ctx.lineWidth = 0.5;
      ctx.strokeRect(p1.x, p1.y - ph, pw, ph);
      ctx.fillStyle = C.textSec; ctx.font = '9px Arial'; ctx.textAlign = 'center';
      ctx.fillText(room.name, p1.x + pw / 2, p1.y - ph / 2);
    }
  }

  // Dimension lines (top view only)
  if (isTopView && floorRooms.length > 0) {
    ctx.strokeStyle = C.dimLine; ctx.lineWidth = 0.8;
    ctx.fillStyle = C.dimText;
    ctx.font = '10px Arial';
    const DIM_GAP = 22;
    const rows = [...new Set(floorRooms.map(r => r.position.y))];
    for (const ry of rows) {
      const rowRooms = floorRooms.filter(r => r.position.y === ry);
      const topY = m2px(ry) - DIM_GAP;
      let dimX = 0;
      for (const r of rowRooms.sort((a, b) => a.position.x - b.position.x)) {
        const rx1 = m2px(r.position.x), rw = m2px(r.width);
        ctx.beginPath();
        ctx.moveTo(rx1, topY); ctx.lineTo(rx1 + rw, topY);
        ctx.moveTo(rx1, topY - 4); ctx.lineTo(rx1, topY + 4);
        ctx.moveTo(rx1 + rw, topY - 4); ctx.lineTo(rx1 + rw, topY + 4);
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillText(`${r.width.toFixed(2)}`, rx1 + rw / 2, topY - 4);
        dimX = rx1 + rw;
      }
    }
  }

  // Pipes
  const visiblePipes = isTopView
    ? project.pipes.filter(p => p.floor === floor && !p.isRiser)
    : project.pipes.filter(p => p.isRiser || p.floor === floor);

  for (const pipe of visiblePipes) {
    const p1 = projectPt(pipe.from, view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
    const p2 = projectPt(pipe.to, view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
    const color = PIPE_COLORS[pipe.type] ?? '#888';
    const lw = pipe.isRiser ? 2.0 : (pipe.diamMm >= 50 ? 2.5 : 1.5);

    ctx.strokeStyle = color; ctx.lineWidth = lw;
    if (pipe.type === 'drain' && !pipe.isRiser) ctx.setLineDash([6, 3]);
    else ctx.setLineDash([]);

    if (isTopView && !pipe.isRiser && !pipe.isMain) {
      // Branch quvurlar — L-shakl (avval X bo'ylab, keyin Y bo'ylab)
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      if (Math.abs(dx) > 2 && Math.abs(dy) > 2) {
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
    } else {
      // Magistral va riserlar — to'g'ri chiziq
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Pipe label — faqat uzun quvurlarda (>40px), magistralda 2/3 joyda
    const pdx = p2.x - p1.x, pdy = p2.y - p1.y;
    const pLen = Math.sqrt(pdx*pdx + pdy*pdy);
    if (pLen > 40) {
      const t = pipe.isMain ? (pipe.type === 'cold' ? 0.65 : pipe.type === 'hot' ? 0.35 : 0.5) : 0.5;
      const mx = p1.x + pdx * t, my = p1.y + pdy * t;
      const lbl = `DN${pipe.diamMm}`;
      ctx.font = '9px Arial, Helvetica, sans-serif';
      const lw = ctx.measureText(lbl).width + 6;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(mx - lw/2, my - 8, lw, 10);
      ctx.fillStyle = color;
      ctx.fillText(lbl, mx, my + 1);
    }
  }

  // Fixtures (top view) — rotation hisobga olingan
  if (isTopView) {
    const fixes = project.fixtures.filter(f => f.floor === floor);
    for (const fix of fixes) {
      const p = projectPt(fix.position, view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
      const fw = m2px(fix.dimensions.w), fd = m2px(fix.dimensions.d);
      const boost = (fw < 20 || fd < 20) ? Math.max(20 / fw, 20 / fd) : 1;
      const bfw = fw * boost, bfd = fd * boost;
      const rot = (fix.rotation ?? 0) * Math.PI / 180;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(rot);

      // Bounding box (markazdan)
      ctx.fillStyle = C.fixFill; ctx.strokeStyle = C.fixStroke; ctx.lineWidth = 1.5;
      ctx.fillRect(-bfw/2, -bfd/2, bfw, bfd);
      ctx.strokeRect(-bfw/2, -bfd/2, bfw, bfd);

      // Symbol (barcha koordinatalar markazga nisbiy)
      if (fix.type === 'toilet') {
        ctx.beginPath();
        ctx.ellipse(0, bfd * 0.1, bfw * 0.38, bfd * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillRect(-bfw * 0.36, -bfd / 2 + 1, bfw * 0.72, bfd * 0.28);
        ctx.strokeRect(-bfw * 0.36, -bfd / 2 + 1, bfw * 0.72, bfd * 0.28);
      } else if (fix.type === 'sink' || fix.type === 'kitchen_sink' || fix.type === 'bidet') {
        ctx.beginPath();
        ctx.ellipse(0, 0, bfw * 0.32, bfd * 0.3, 0, 0, Math.PI * 2);
        ctx.strokeStyle = C.cold; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.strokeStyle = C.fixStroke; ctx.lineWidth = 1.5;
      } else if (fix.type === 'shower') {
        ctx.strokeStyle = '#64748b'; ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-bfw/2, -bfd/2);
        ctx.arcTo(bfw/2, -bfd/2, bfw/2, bfd/2, Math.min(bfw, bfd) * 0.9);
        ctx.stroke();
      } else if (fix.type === 'bathtub') {
        ctx.beginPath();
        ctx.ellipse(0, bfd * 0.1, bfw * 0.35, bfd * 0.38, 0, 0, Math.PI * 2);
        ctx.strokeStyle = C.cold; ctx.lineWidth = 0.8; ctx.stroke();
      } else if (fix.type === 'washing_machine' || fix.type === 'dishwasher') {
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(bfw, bfd) * 0.35, 0, Math.PI * 2);
        ctx.strokeStyle = C.cold; ctx.lineWidth = 0.8; ctx.stroke();
      }

      ctx.restore();
    }
  }

  // ── Label overlay — xona nomlari + fixture labellar, greedy + push ──
  if (isTopView) {
    const MIN_GAP = 5;
    const WT = 10;
    type Rect = { x: number; y: number; w: number; h: number };
    type LBox = { x: number; y: number; w: number; h: number; lines: string[]; fontSize: number; bold: boolean; roomPx?: Rect };

    const labels:   LBox[]  = [];
    const blockers: Rect[]  = [];

    const overlaps = (ax: number, ay: number, aw: number, ah: number,
                      bx: number, by: number, bw: number, bh: number, gap = 0) =>
      Math.abs(ax - bx) < (aw + bw) / 2 + gap && Math.abs(ay - by) < (ah + bh) / 2 + gap;

    const overrides = project.labelOverrides ?? {};

    // Xona nomlari — birinchi (fixture labellar ular atrofini chetlab o'tadi)
    for (const room of floorRooms) {
      const p1 = projectPt(
        { x: room.position.x, y: room.position.y, z: (room.floor - 1) * project.floorHeight },
        view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount,
      );
      const rw = m2px(room.width), rl = m2px(room.length);
      if (rw < 24 || rl < 18) continue;
      const rKey = `room:${room.id}`;
      const rOvr = overrides[rKey];
      if (rOvr?.hidden) continue;
      const baseFontSize = Math.max(10, Math.min(15, rw / 5));
      const fontSize = rOvr?.fontSize ?? baseFontSize;
      ctx.font = `bold ${fontSize}px Arial`;
      const lines = [room.name, `${(room.width * room.length).toFixed(1)} m²`];
      const lw2 = ctx.measureText(room.name).width + 8;
      const lh  = (fontSize + 3) * 2 + 2;
      labels.push({ x: p1.x + rw/2 + (rOvr?.dx ?? 0), y: p1.y + rl/2 + (rOvr?.dy ?? 0), w: lw2, h: lh, lines, fontSize, bold: true });
    }

    // Fixture blocker va labellar — y bo'yicha tepadan pastga tartib
    const sortedFixes = project.fixtures.filter(f => f.floor === floor).slice().sort((a, b) => a.position.y - b.position.y);
    for (const fix of sortedFixes) {
      const p = projectPt(fix.position, view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
      const fw = m2px(fix.dimensions.w), fd = m2px(fix.dimensions.d);
      const boost = (fw < 20 || fd < 20) ? Math.max(20 / fw, 20 / fd) : 1;
      const bfw = fw * boost, bfd = fd * boost;
      const rot = (fix.rotation ?? 0) * Math.PI / 180;
      const cosR = Math.cos(rot), sinR = Math.sin(rot);
      const halfW = (Math.abs(cosR) * bfw + Math.abs(sinR) * bfd) / 2;
      const halfH = (Math.abs(sinR) * bfw + Math.abs(cosR) * bfd) / 2;
      blockers.push({ x: p.x - halfW, y: p.y - halfH, w: halfW * 2, h: halfH * 2 });

      if (bfd < 6) continue;
      const fKey = `fixture:${fix.id}`;
      const fOvr = overrides[fKey];
      if (fOvr?.hidden) continue;
      const baseFontSize = Math.max(9, Math.min(11, bfd * 0.26));
      const fontSize = fOvr?.fontSize ?? baseFontSize;
      ctx.font = `${fontSize}px Arial`;
      const ltext = fix.label || fix.nameUz;
      const lw2 = ctx.measureText(ltext).width + 6;
      const lh  = fontSize + 5;
      const innerW = (Math.abs(cosR) * bfw + Math.abs(sinR) * bfd) * 0.82;

      const fixRoom = project.rooms.find(r => r.id === fix.roomId);
      const roomPx = fixRoom ? {
        x: m2px(fixRoom.position.x) + WT, y: m2px(fixRoom.position.y) + WT,
        w: m2px(fixRoom.width) - WT * 2,  h: m2px(fixRoom.length) - WT * 2,
      } : null;

      if (lw2 <= innerW) {
        const baseX = p.x + (fOvr?.dx ?? 0), baseY = p.y + halfH * 0.38 + (fOvr?.dy ?? 0);
        labels.push({ x: baseX, y: baseY, w: lw2, h: lh, lines: [ltext], fontSize, bold: false, roomPx: roomPx ?? undefined });
      } else {
        const mkC = (cx: number, cy: number) => !roomPx ? { x: cx, y: cy } : {
          x: Math.max(roomPx.x + lw2/2, Math.min(roomPx.x + roomPx.w - lw2/2, cx)),
          y: Math.max(roomPx.y + lh/2,  Math.min(roomPx.y + roomPx.h - lh/2,  cy)),
        };
        const candidates = [
          { x: p.x, y: p.y + halfH + lh/2 + MIN_GAP },
          { x: p.x, y: p.y - halfH - lh/2 - MIN_GAP },
          { x: p.x + halfW + lw2/2 + MIN_GAP, y: p.y },
          { x: p.x - halfW - lw2/2 - MIN_GAP, y: p.y },
          mkC(p.x, p.y + halfH + lh/2 + MIN_GAP),
          mkC(p.x, p.y - halfH - lh/2 - MIN_GAP),
          mkC(p.x + halfW + lw2/2 + MIN_GAP, p.y),
          mkC(p.x - halfW - lw2/2 - MIN_GAP, p.y),
          { x: p.x, y: p.y },
        ];
        let best = candidates[0]; let bestScore = Infinity;
        for (const cand of candidates) {
          let score = 0;
          const isInside = cand.x === p.x && cand.y === p.y && candidates.indexOf(cand) === candidates.length - 1;
          if (!isInside) {
            for (const bl of blockers)
              if (overlaps(cand.x, cand.y, lw2, lh, bl.x+bl.w/2, bl.y+bl.h/2, bl.w, bl.h, MIN_GAP)) score += 40;
          }
          for (const ex of labels)
            if (overlaps(cand.x, cand.y, lw2, lh, ex.x, ex.y, ex.w, ex.h, MIN_GAP)) score += 200;
          if (roomPx) {
            const oob = cand.x-lw2/2 < roomPx.x || cand.x+lw2/2 > roomPx.x+roomPx.w ||
                        cand.y-lh/2  < roomPx.y || cand.y+lh/2  > roomPx.y+roomPx.h;
            if (oob) score += 1000;
          }
          if (!isInside) score += Math.hypot(cand.x-p.x, cand.y-p.y) * 0.05; else score += 20;
          if (score < bestScore) { bestScore = score; best = cand; }
        }
        labels.push({ x: best.x + (fOvr?.dx ?? 0), y: best.y + (fOvr?.dy ?? 0), w: lw2, h: lh, lines: [ltext], fontSize, bold: false, roomPx: roomPx ?? undefined });
      }
    }

    // Xona nomlari yuqorida qo'shilgan

    // Tiebreaker
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i], b = labels[j];
        const ox = (a.w+b.w)/2+MIN_GAP - Math.abs(a.x-b.x);
        const oy = (a.h+b.h)/2+MIN_GAP - Math.abs(a.y-b.y);
        if (ox <= 0 || oy <= 0) continue;
        if (ox < oy) {
          const sh = ox/2+1;
          if (a.x <= b.x) { a.x -= sh; b.x += sh; } else { a.x += sh; b.x -= sh; }
        } else {
          const sh = oy/2+1;
          if (a.y <= b.y) { a.y -= sh; b.y += sh; } else { a.y += sh; b.y -= sh; }
        }
      }
    }

    // Push + clamp
    const bldW2 = m2px(project.buildingWidth), bldH2 = m2px(project.buildingLength);
    const clampL = (lbl: LBox) => {
      const b = lbl.roomPx ?? { x: WT, y: WT, w: bldW2-WT*2, h: bldH2-WT*2 };
      lbl.x = Math.max(b.x+lbl.w/2, Math.min(b.x+b.w-lbl.w/2, lbl.x));
      lbl.y = Math.max(b.y+lbl.h/2, Math.min(b.y+b.h-lbl.h/2, lbl.y));
    };
    for (let iter = 0; iter < 30; iter++) {
      let moved = false;
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i], b = labels[j];
          const ox = (a.w+b.w)/2+MIN_GAP - Math.abs(a.x-b.x);
          const oy = (a.h+b.h)/2+MIN_GAP - Math.abs(a.y-b.y);
          if (ox <= 0 || oy <= 0) continue;
          if (ox < oy) {
            const sh = ox/2; if (a.x < b.x) { a.x -= sh; b.x += sh; } else { a.x += sh; b.x -= sh; }
          } else {
            const sh = oy/2; if (a.y < b.y) { a.y -= sh; b.y += sh; } else { a.y += sh; b.y -= sh; }
          }
          moved = true;
        }
      }
      labels.forEach(clampL);
      if (!moved) break;
    }

    ctx.textAlign = 'center';
    for (const box of labels) {
      if (!box.lines.length) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(box.x-box.w/2, box.y-box.h/2, box.w, box.h);
      ctx.font = `${box.bold ? 'bold ' : ''}${box.fontSize}px Arial`;
      ctx.fillStyle = C.textPrim;
      ctx.fillText(box.lines[0], box.x, box.y + box.fontSize * 0.35);
      if (box.lines[1]) {
        ctx.font = `${Math.max(8, box.fontSize-2)}px Arial`;
        ctx.fillStyle = C.textSec;
        ctx.fillText(box.lines[1], box.x, box.y + box.fontSize + box.fontSize * 0.35);
      }
    }
  }

  // Elevation marks (front/back/left/right)
  if (!isTopView) {
    for (let f = 0; f <= project.floorCount; f++) {
      const z = f * project.floorHeight;
      const py = projectPt({ x: 0, y: 0, z }, view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount).y;
      ctx.strokeStyle = C.dimLine; ctx.lineWidth = 0.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(-30, py); ctx.lineTo(contentW + 10, py); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.dimText; ctx.font = '8px Arial'; ctx.textAlign = 'right';
      ctx.fillText(`+${z.toFixed(2)}`, -5, py + 3);
    }
  }

  ctx.restore();

  // Legend
  const legX = MARGIN + 8, legY = H - STAMP_H - 70;
  ctx.fillStyle = C.paper; ctx.strokeStyle = C.dimLine; ctx.lineWidth = 0.8;
  ctx.fillRect(legX, legY, 130, 60);
  ctx.strokeRect(legX, legY, 130, 60);
  ctx.fillStyle = C.textPrim; ctx.font = 'bold 8px Arial'; ctx.textAlign = 'left';
  ctx.fillText('SHARTLI BELGILAR', legX + 4, legY + 10);
  const legItems = [
    { color: C.cold,  label: 'V1 — Sovuq suv' },
    { color: C.hot,   label: 'T3 — Issiq suv' },
    { color: C.circ,  label: 'T4 — Sirkulyatsiya' },
    { color: C.drain, label: 'K1 — Kanalizatsiya' },
  ];
  ctx.font = '9px Arial, Helvetica, sans-serif';
  legItems.forEach((item, i) => {
    const ly = legY + 20 + i * 10;
    ctx.strokeStyle = item.color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(legX + 6, ly); ctx.lineTo(legX + 22, ly); ctx.stroke();
    ctx.fillStyle = C.textSec;
    ctx.fillText(item.label, legX + 26, ly + 3);
  });

  // Stamp
  const sx = MARGIN, sy = H - STAMP_H - 5;
  const sw = W - MARGIN * 2;
  ctx.fillStyle = C.paper; ctx.strokeStyle = C.wall; ctx.lineWidth = 1.5;
  ctx.fillRect(sx, sy, sw, STAMP_H);
  ctx.strokeRect(sx, sy, sw, STAMP_H);

  const col1 = sx + sw * 0.4, col2 = sx + sw * 0.58, col3 = sx + sw * 0.73, col4 = sx + sw * 0.87;
  [col1, col2, col3, col4].forEach(x => {
    ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, sy + STAMP_H); ctx.stroke();
  });
  const mid = sy + STAMP_H / 2;
  ctx.beginPath(); ctx.moveTo(sx, mid); ctx.lineTo(W - MARGIN, mid); ctx.stroke();

  ctx.fillStyle = C.textPrim; ctx.font = 'bold 8px Arial'; ctx.textAlign = 'left';
  ctx.fillText(project.name, sx + 4, sy + 14);
  ctx.font = '9px Arial, Helvetica, sans-serif'; ctx.fillStyle = C.textSec;
  ctx.fillText(`Santexnika — ${floor}-qavat sxemasi`, sx + 4, sy + 26);
  ctx.fillText(`Jihozlar: ${project.stats.totalFixtures} ta | Truba: ${project.stats.totalPipeM} m`, sx + 4, sy + 40);
  ctx.fillText(`GOST 21.601-2011`, sx + 4, sy + 52);

  const stampData = [
    { x: col1 + 4, y: sy + 12, label: 'Sana', val: new Date().toLocaleDateString('uz-UZ') },
    { x: col1 + 4, y: sy + 30, label: 'Miqyos', val: '1:100' },
    { x: col1 + 4, y: sy + 48, label: 'Standart', val: 'GOST 21.601' },
    { x: col2 + 4, y: sy + 12, label: 'V1 bosh', val: `DN${project.stats.mainColdDiamMm}` },
    { x: col2 + 4, y: sy + 30, label: 'T3 bosh', val: `DN${project.stats.mainHotDiamMm}` },
    { x: col2 + 4, y: sy + 48, label: 'Isitgich', val: project.stats.boilerVolL ? `${project.stats.boilerVolL}L` : '—' },
    { x: col3 + 4, y: sy + 12, label: 'Stoyaklar', val: `${project.stats.totalRisers}` },
    { x: col3 + 4, y: sy + 30, label: 'Qavatlar', val: `${project.floorCount}` },
    { x: col4 + 4, y: sy + 20, label: 'Varaq', val: `${floor}/${project.floorCount}` },
  ];
  stampData.forEach(item => {
    ctx.font = '9px Arial, Helvetica, sans-serif'; ctx.fillStyle = C.textMuted; ctx.textAlign = 'left';
    ctx.fillText(item.label, item.x, item.y - 1);
    ctx.font = 'bold 8px Arial'; ctx.fillStyle = C.textPrim;
    ctx.fillText(item.val, item.x, item.y + 9);
  });
}

// ── Spetsifikatsiya (vedomost) sahifasi ──────────────────────────────────────

function drawSpecSheet(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  project: PlumbingProject,
) {
  const MARGIN = 40;
  const HEADER_H = 44;
  const STAMP_H  = 60;
  const ROW_H    = 18;
  const COL_GRAY = '#f1f5f9';
  const COL_HEAD = '#1e3a5f';

  // Fon
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.border; ctx.lineWidth = 1;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // Sarlavha
  ctx.fillStyle = COL_HEAD;
  ctx.fillRect(MARGIN, MARGIN, W - MARGIN * 2, HEADER_H);
  ctx.fillStyle = C.headerText;
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SPETSIFIKATSIYA — MATERIALLAR VA JIHOZLAR VEDOMOSTI', W / 2, MARGIN + 17);
  ctx.font = '10px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`${project.name}  |  GOST 21.601-2011  |  Sana: ${new Date().toLocaleDateString('uz-UZ')}`, W / 2, MARGIN + 33);

  let curY = MARGIN + HEADER_H + 16;
  const usableW = W - MARGIN * 2;

  // ── Yordamchi: jadval sarlavhasi ──
  function tableHeader(cols: Array<{ label: string; w: number }>, x: number, y: number) {
    let cx = x;
    for (const col of cols) {
      ctx.fillStyle = COL_HEAD;
      ctx.fillRect(cx, y, col.w, ROW_H + 2);
      ctx.strokeStyle = C.paper; ctx.lineWidth = 0.5;
      ctx.strokeRect(cx, y, col.w, ROW_H + 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9.5px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(col.label, cx + col.w / 2, y + ROW_H / 2 + 3);
      cx += col.w;
    }
    return y + ROW_H + 2;
  }

  // ── Yordamchi: jadval qatori ──
  function tableRow(
    cells: string[],
    cols: Array<{ w: number }>,
    x: number, y: number,
    shade: boolean,
  ) {
    let cx = x;
    for (let i = 0; i < cols.length; i++) {
      ctx.fillStyle = shade ? COL_GRAY : C.paper;
      ctx.fillRect(cx, y, cols[i].w, ROW_H);
      ctx.strokeStyle = C.border; ctx.lineWidth = 0.5;
      ctx.strokeRect(cx, y, cols[i].w, ROW_H);
      ctx.fillStyle = C.textPrim;
      ctx.font = i === 0 ? '9px Arial, Helvetica, sans-serif' : '9.5px Arial, Helvetica, sans-serif';
      ctx.textAlign = i === 0 ? 'center' : (i === cols.length - 1 ? 'center' : 'left');
      const text = cells[i] ?? '';
      const maxW = cols[i].w - 4;
      // Truncate if too long
      let t = text;
      ctx.font = '9.5px Arial, Helvetica, sans-serif';
      while (ctx.measureText(t).width > maxW && t.length > 1) t = t.slice(0, -1);
      if (t !== text) t = t.slice(0, -1) + '…';
      ctx.fillText(t, cx + (i === 0 ? cols[i].w / 2 : 3), y + ROW_H / 2 + 3);
      cx += cols[i].w;
    }
    return y + ROW_H;
  }

  // ── Sektsiya sarlavhasi ──
  function sectionTitle(title: string, y: number) {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(MARGIN, y, usableW, ROW_H + 2);
    ctx.strokeStyle = C.border; ctx.lineWidth = 0.5;
    ctx.strokeRect(MARGIN, y, usableW, ROW_H + 2);
    ctx.fillStyle = C.textPrim;
    ctx.font = 'bold 8.5px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(title, MARGIN + 6, y + ROW_H / 2 + 3);
    return y + ROW_H + 2;
  }

  // ══════════════════════════════════════════════════
  // 1. JIHOZLAR JADVALI
  // ══════════════════════════════════════════════════
  curY = sectionTitle('1. SANITARIYA JIHOZLARI', curY);

  const fixCols = [
    { label: '№',        w: usableW * 0.05 },
    { label: 'Nomi',     w: usableW * 0.22 },
    { label: 'Ruscha',   w: usableW * 0.18 },
    { label: 'Xona',     w: usableW * 0.15 },
    { label: 'Qavat',    w: usableW * 0.07 },
    { label: 'V1 DN mm', w: usableW * 0.08 },
    { label: 'T3 DN mm', w: usableW * 0.08 },
    { label: 'K1 DN mm', w: usableW * 0.08 },
    { label: 'Izoh',     w: usableW * 0.09 },
  ];
  curY = tableHeader(fixCols, MARGIN, curY);

  // Xona nomlarini id bo'yicha map
  const roomNameMap = Object.fromEntries(project.rooms.map(r => [r.id, r.name]));

  let rowIdx = 0;
  for (const fix of project.fixtures) {
    if (curY + ROW_H > H - STAMP_H - MARGIN) break; // sahifa to'lib qolsa to'xtat
    const cells = [
      String(rowIdx + 1),
      fix.nameUz,
      fix.nameRu,
      roomNameMap[fix.roomId] ?? '—',
      String(fix.floor),
      fix.coldIn  ? String(fix.branchDiamMm) : '—',
      fix.hotIn   ? String(fix.branchDiamMm) : '—',
      String(fix.drainDiamMm),
      fix.label ?? '',
    ];
    curY = tableRow(cells, fixCols, MARGIN, curY, rowIdx % 2 === 1);
    rowIdx++;
  }
  curY += 10;

  // ══════════════════════════════════════════════════
  // 2. QUVURLAR JADVALI
  // ══════════════════════════════════════════════════
  if (curY + ROW_H * 6 < H - STAMP_H - MARGIN) {
    curY = sectionTitle('2. QUVURLAR VA ARMATURA', curY);

    const pipeCols = [
      { label: '№',           w: usableW * 0.05 },
      { label: 'Tur',         w: usableW * 0.12 },
      { label: 'Diametr',     w: usableW * 0.09 },
      { label: 'Material',    w: usableW * 0.10 },
      { label: 'Uzunlik, m',  w: usableW * 0.10 },
      { label: 'Qavat',       w: usableW * 0.07 },
      { label: 'Stoyak',      w: usableW * 0.07 },
      { label: 'Belgi',       w: usableW * 0.40 },
    ];
    curY = tableHeader(pipeCols, MARGIN, curY);

    const TYPE_NAMES: Record<string, string> = {
      cold: 'V1 Sovuq', hot: 'T3 Issiq', circ: 'T4 Sirkulyatsiya', drain: 'K1 Kanalizatsiya',
    };

    rowIdx = 0;
    for (const pipe of project.pipes) {
      if (curY + ROW_H > H - STAMP_H - MARGIN) break;
      const len = Math.sqrt(
        (pipe.to.x - pipe.from.x) ** 2 +
        (pipe.to.y - pipe.from.y) ** 2 +
        (pipe.to.z - pipe.from.z) ** 2,
      );
      const cells = [
        String(rowIdx + 1),
        TYPE_NAMES[pipe.type] ?? pipe.type,
        `DN${pipe.diamMm}`,
        pipe.material.toUpperCase(),
        len.toFixed(2),
        String(pipe.floor),
        pipe.isRiser ? 'Ha' : "Yo'q",
        pipe.label ?? '',
      ];
      curY = tableRow(cells, pipeCols, MARGIN, curY, rowIdx % 2 === 1);
      rowIdx++;
    }
    curY += 10;
  }

  // ══════════════════════════════════════════════════
  // 3. STATISTIKA BLOKI
  // ══════════════════════════════════════════════════
  if (curY + 80 < H - STAMP_H - MARGIN) {
    curY = sectionTitle('3. LOYIHA STATISTIKASI', curY);
    const stats = project.stats;
    const statItems = [
      ['Jami jihozlar',       `${stats.totalFixtures} ta`],
      ['V1 sovuq suv trubasi', `${stats.coldPipeM} m`],
      ['T3 issiq suv trubasi', `${stats.hotPipeM} m`],
      ['K1 kanalizatsiya',     `${stats.drainPipeM} m`],
      ['Jami truba',          `${stats.totalPipeM} m`],
      ['Stoyaklar soni',      `${stats.totalRisers} ta`],
      ['Qavatlar soni',       `${project.floorCount} ta`],
      ['Qavat balandligi',    `${project.floorHeight} m`],
      ['Bino kengligi',       `${project.buildingWidth} m`],
      ['Bino uzunligi',       `${project.buildingLength} m`],
      ['Bosh V1 diametri',    `DN${stats.mainColdDiamMm} mm`],
      ['Bosh T3 diametri',    `DN${stats.mainHotDiamMm} mm`],
      ...(stats.boilerVolL ? [['Isitgich hajmi', `${stats.boilerVolL} L`]] : []),
    ];

    const colW = usableW / 3;
    const statCols = [
      { label: 'Ko\'rsatkich', w: colW * 0.6 },
      { label: 'Qiymat',       w: colW * 0.4 },
    ];

    // 3 ustunli statistika
    const perCol = Math.ceil(statItems.length / 3);
    for (let col = 0; col < 3; col++) {
      const chunk = statItems.slice(col * perCol, (col + 1) * perCol);
      let sy = curY;
      const ox = MARGIN + col * colW;
      // mini header
      ctx.fillStyle = COL_HEAD;
      ctx.fillRect(ox, sy, colW, ROW_H);
      ctx.strokeStyle = C.paper; ctx.lineWidth = 0.5;
      ctx.strokeRect(ox, sy, colW, ROW_H);
      for (const sc of statCols) {
        ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Arial, Helvetica, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(sc.label, ox + (statCols.indexOf(sc) === 0 ? colW * 0.3 : colW * 0.8), sy + ROW_H / 2 + 3);
      }
      sy += ROW_H;
      chunk.forEach(([label, val], ri) => {
        ctx.fillStyle = ri % 2 === 1 ? COL_GRAY : C.paper;
        ctx.fillRect(ox, sy, colW, ROW_H);
        ctx.strokeStyle = C.border; ctx.lineWidth = 0.5;
        ctx.strokeRect(ox, sy, colW, ROW_H);

        ctx.fillStyle = C.textSec; ctx.font = '9px Arial, Helvetica, sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(label, ox + 4, sy + ROW_H / 2 + 3);
        ctx.fillStyle = C.textPrim; ctx.font = 'bold 9.5px Arial, Helvetica, sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(val, ox + colW - 4, sy + ROW_H / 2 + 3);
        sy += ROW_H;
      });
    }
  }

  // ── Shtamp ──
  const sx = MARGIN, sy2 = H - STAMP_H - 5;
  const sw = W - MARGIN * 2;
  ctx.fillStyle = C.paper; ctx.strokeStyle = C.wall; ctx.lineWidth = 1.5;
  ctx.fillRect(sx, sy2, sw, STAMP_H);
  ctx.strokeRect(sx, sy2, sw, STAMP_H);

  const col1 = sx + sw * 0.45, col2 = sx + sw * 0.62, col3 = sx + sw * 0.82;
  [col1, col2, col3].forEach(x => {
    ctx.beginPath(); ctx.moveTo(x, sy2); ctx.lineTo(x, sy2 + STAMP_H); ctx.stroke();
  });
  ctx.beginPath(); ctx.moveTo(sx, sy2 + STAMP_H / 2); ctx.lineTo(W - MARGIN, sy2 + STAMP_H / 2); ctx.stroke();

  ctx.fillStyle = C.textPrim; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'left';
  ctx.fillText(project.name, sx + 4, sy2 + 14);
  ctx.font = '9.5px Arial, Helvetica, sans-serif'; ctx.fillStyle = C.textSec;
  ctx.fillText('Spetsifikatsiya — materiallar va jihozlar vedomosti', sx + 4, sy2 + 28);
  ctx.fillText(`Jihozlar: ${project.stats.totalFixtures} ta | Truba: ${project.stats.totalPipeM} m | GOST 21.601-2011`, sx + 4, sy2 + 44);

  ctx.fillStyle = C.textMuted; ctx.font = '9px Arial, Helvetica, sans-serif';
  ctx.fillText('Tuzuvchi', col1 + 4, sy2 + 12);
  ctx.fillStyle = C.textPrim; ctx.font = 'bold 8px Arial';
  ctx.fillText('_________________', col1 + 4, sy2 + 28);

  ctx.fillStyle = C.textMuted; ctx.font = '9px Arial, Helvetica, sans-serif';
  ctx.fillText('Sana', col2 + 4, sy2 + 12);
  ctx.fillStyle = C.textPrim; ctx.font = '8px Arial';
  ctx.fillText(new Date().toLocaleDateString('uz-UZ'), col2 + 4, sy2 + 26);

  ctx.fillStyle = C.textMuted; ctx.font = '9px Arial, Helvetica, sans-serif';
  ctx.fillText('Varaq', col3 + 4, sy2 + 12);
  ctx.fillStyle = C.textPrim; ctx.font = 'bold 8px Arial';
  ctx.fillText('Spetsifikatsiya', col3 + 4, sy2 + 26);
}

// ── Main export function ─────────────────────────────────────────────────────

export async function exportPlumbingPDF(
  project: PlumbingProject,
  options: PdfExportOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const { pages, orientation, quality, includeSpec = true } = options;
  if (pages.length === 0 && !includeSpec) return;

  // A4 dimensions in mm
  const A4 = orientation === 'landscape'
    ? { w: 297, h: 210 }
    : { w: 210, h: 297 };

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  // DPI: 96 base, quality multiplier (minimum 2x for crisp text)
  const effectiveQuality = Math.max(2, quality);
  const dpi = 96 * effectiveQuality;
  const pxW = Math.round(A4.w / 25.4 * dpi);
  const pxH = Math.round(A4.h / 25.4 * dpi);

  const offscreen = document.createElement('canvas');
  offscreen.width  = pxW;
  offscreen.height = pxH;
  const ctx = offscreen.getContext('2d')!;

  // Scale for high DPI
  ctx.scale(effectiveQuality, effectiveQuality);
  const drawW = pxW / effectiveQuality;
  const drawH = pxH / effectiveQuality;

  const totalPages = pages.length + (includeSpec ? 1 : 0);
  let pagesDone = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    onProgress?.(pagesDone, totalPages);

    ctx.clearRect(0, 0, drawW, drawH);
    drawScene(ctx, drawW, drawH, project, page.view, page.floor, page.label);

    const imgData = offscreen.toDataURL('image/jpeg', 0.92);

    if (pagesDone > 0) pdf.addPage('a4', orientation);
    pdf.addImage(imgData, 'JPEG', 0, 0, A4.w, A4.h);
    pagesDone++;

    await new Promise(r => setTimeout(r, 10));
  }

  // Spetsifikatsiya sahifasi
  if (includeSpec) {
    onProgress?.(pagesDone, totalPages);
    ctx.clearRect(0, 0, drawW, drawH);
    drawSpecSheet(ctx, drawW, drawH, project);
    const imgData = offscreen.toDataURL('image/jpeg', 0.92);
    if (pagesDone > 0) pdf.addPage('a4', orientation);
    pdf.addImage(imgData, 'JPEG', 0, 0, A4.w, A4.h);
    pagesDone++;
    await new Promise(r => setTimeout(r, 10));
  }

  onProgress?.(totalPages, totalPages);

  const fileName = `${project.name.replace(/[^a-zA-Z0-9а-яА-Я\s]/g, '').trim() || 'santexnika'}_${new Date().toISOString().slice(0,10)}.pdf`;
  pdf.save(fileName);
}
