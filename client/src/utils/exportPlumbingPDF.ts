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
  ctx.fillText('SANTEXNIKA LOYIHASI — SANTEXNIKA SXEMASI', W / 2, MARGIN + 18);
  ctx.font = '11px Arial, sans-serif';
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

  // Rooms
  for (const room of floorRooms) {
    if (isTopView) {
      const p1 = projectPt({ x: room.position.x, y: room.position.y, z: 0 },
        view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
      const rw = m2px(room.width), rl = m2px(room.length);
      ctx.fillStyle = ROOM_COLORS[room.type] ?? '#f8fafc';
      ctx.fillRect(p1.x, p1.y, rw, rl);
      ctx.strokeStyle = C.wall; ctx.lineWidth = 2.5;
      ctx.strokeRect(p1.x, p1.y, rw, rl);
      // Room name
      ctx.fillStyle = C.textPrim;
      ctx.font = `bold ${Math.max(10, Math.min(16, m2px(Math.min(room.width, room.length)) / 4))}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(room.name, p1.x + rw / 2, p1.y + rl / 2);
      const area = (room.width * room.length).toFixed(1);
      ctx.font = '9px Arial'; ctx.fillStyle = C.textSec;
      ctx.fillText(`${area} m²`, p1.x + rw / 2, p1.y + rl / 2 + 14);
    } else {
      const baseZ = (room.floor - 1) * project.floorHeight;
      const p1 = projectPt({ x: room.position.x, y: room.position.y, z: baseZ },
        view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
      const pw = (view === 'front' || view === 'back') ? m2px(room.width) : m2px(room.length);
      const ph = m2px(room.height);
      ctx.fillStyle = ROOM_COLORS[room.type] ?? '#f8fafc';
      ctx.fillRect(p1.x, p1.y - ph, pw, ph);
      ctx.strokeStyle = C.wall; ctx.lineWidth = 1.5;
      ctx.strokeRect(p1.x, p1.y - ph, pw, ph);
      ctx.fillStyle = C.textSec; ctx.font = '9px Arial'; ctx.textAlign = 'center';
      ctx.fillText(room.name, p1.x + pw / 2, p1.y - ph / 2);
    }
  }

  // Dimension lines (top view only)
  if (isTopView && floorRooms.length > 0) {
    ctx.strokeStyle = C.dimLine; ctx.lineWidth = 0.8;
    ctx.fillStyle = C.dimText;
    ctx.font = '8px Arial';
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

    if (isTopView && !pipe.isRiser) {
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      if (Math.abs(dx) > 4 && Math.abs(dy) > 4) {
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
    } else {
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Pipe label
    if (pipe.label && s > 0.6) {
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.font = '7px Arial'; ctx.textAlign = 'center';
      ctx.strokeText(pipe.label, mx, my - 2);
      ctx.fillStyle = color; ctx.fillText(pipe.label, mx, my - 2);
    }
  }

  // Fixtures (top view)
  if (isTopView) {
    const fixes = project.fixtures.filter(f => f.floor === floor);
    for (const fix of fixes) {
      const p = projectPt(fix.position, view, project.buildingWidth, project.buildingLength, project.floorHeight, project.floorCount);
      const fw = m2px(fix.dimensions.w), fd = m2px(fix.dimensions.d);
      const boost = (fw < 20 || fd < 20) ? Math.max(20 / fw, 20 / fd) : 1;
      const bfw = fw * boost, bfd = fd * boost;

      ctx.fillStyle = C.fixFill; ctx.strokeStyle = C.fixStroke; ctx.lineWidth = 1.5;
      ctx.fillRect(p.x - bfw/2, p.y - bfd/2, bfw, bfd);
      ctx.strokeRect(p.x - bfw/2, p.y - bfd/2, bfw, bfd);

      // Simple symbol
      if (fix.type === 'toilet') {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + bfd * 0.1, bfw * 0.38, bfd * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillRect(p.x - bfw * 0.36, p.y - bfd / 2 + 1, bfw * 0.72, bfd * 0.28);
        ctx.strokeRect(p.x - bfw * 0.36, p.y - bfd / 2 + 1, bfw * 0.72, bfd * 0.28);
      } else if (fix.type === 'sink' || fix.type === 'kitchen_sink' || fix.type === 'bidet') {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, bfw * 0.32, bfd * 0.3, 0, 0, Math.PI * 2);
        ctx.strokeStyle = C.cold; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.strokeStyle = C.fixStroke; ctx.lineWidth = 1.5;
      } else if (fix.type === 'shower') {
        ctx.strokeStyle = C.dimLine; ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(p.x - bfw/2, p.y - bfd/2);
        ctx.arcTo(p.x + bfw/2, p.y - bfd/2, p.x + bfw/2, p.y + bfd/2, Math.min(bfw, bfd) * 0.9);
        ctx.stroke();
      } else if (fix.type === 'bathtub') {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + bfd * 0.1, bfw * 0.35, bfd * 0.38, 0, 0, Math.PI * 2);
        ctx.strokeStyle = C.cold; ctx.lineWidth = 0.8; ctx.stroke();
      }

      // Label
      if (s > 0.5) {
        ctx.fillStyle = C.textSec; ctx.font = '8px Arial'; ctx.textAlign = 'center';
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.strokeText(fix.nameUz, p.x, p.y + bfd / 2 + 11);
        ctx.fillText(fix.nameUz, p.x, p.y + bfd / 2 + 11);
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
    { color: C.cold,  label: 'В1 — Sovuq suv' },
    { color: C.hot,   label: 'Т3 — Issiq suv' },
    { color: C.circ,  label: 'Т4 — Sirkul' },
    { color: C.drain, label: 'К1 — Kanalizatsiya' },
  ];
  ctx.font = '7px Arial';
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
  ctx.font = '7px Arial'; ctx.fillStyle = C.textSec;
  ctx.fillText(`Santexnika — ${floor}-qavat sxemasi`, sx + 4, sy + 26);
  ctx.fillText(`Jihozlar: ${project.stats.totalFixtures} | Truba: ${project.stats.totalPipeM}m`, sx + 4, sy + 40);
  ctx.fillText(`GOST 21.601-2011`, sx + 4, sy + 52);

  const stampData = [
    { x: col1 + 4, y: sy + 12, label: 'Sana', val: new Date().toLocaleDateString('uz-UZ') },
    { x: col1 + 4, y: sy + 30, label: 'Miqyos', val: '1:100' },
    { x: col1 + 4, y: sy + 48, label: 'Standart', val: 'GOST 21.601' },
    { x: col2 + 4, y: sy + 12, label: 'В1 bosh', val: `ø${project.stats.mainColdDiamMm}` },
    { x: col2 + 4, y: sy + 30, label: 'Т3 bosh', val: `ø${project.stats.mainHotDiamMm}` },
    { x: col2 + 4, y: sy + 48, label: 'Isitgich', val: project.stats.boilerVolL ? `${project.stats.boilerVolL}L` : '—' },
    { x: col3 + 4, y: sy + 12, label: 'Stoyaklar', val: `${project.stats.totalRisers}` },
    { x: col3 + 4, y: sy + 30, label: 'Qavatlar', val: `${project.floorCount}` },
    { x: col4 + 4, y: sy + 20, label: 'Varaq', val: `${floor}/${project.floorCount}` },
  ];
  stampData.forEach(item => {
    ctx.font = '6px Arial'; ctx.fillStyle = C.textMuted; ctx.textAlign = 'left';
    ctx.fillText(item.label, item.x, item.y - 1);
    ctx.font = 'bold 8px Arial'; ctx.fillStyle = C.textPrim;
    ctx.fillText(item.val, item.x, item.y + 9);
  });
}

// ── Main export function ─────────────────────────────────────────────────────

export async function exportPlumbingPDF(
  project: PlumbingProject,
  options: PdfExportOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const { pages, orientation, quality } = options;
  if (pages.length === 0) return;

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

  // DPI: 96 base, quality multiplier
  const dpi = 96 * quality;
  const pxW = Math.round(A4.w / 25.4 * dpi);
  const pxH = Math.round(A4.h / 25.4 * dpi);

  const offscreen = document.createElement('canvas');
  offscreen.width  = pxW;
  offscreen.height = pxH;
  const ctx = offscreen.getContext('2d')!;

  // Scale for high DPI
  ctx.scale(quality, quality);
  const drawW = pxW / quality;
  const drawH = pxH / quality;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    onProgress?.(i, pages.length);

    // Clear
    ctx.clearRect(0, 0, drawW, drawH);

    drawScene(ctx, drawW, drawH, project, page.view, page.floor, page.label);

    const imgData = offscreen.toDataURL('image/jpeg', 0.92);

    if (i > 0) pdf.addPage([A4.w, A4.h], orientation);
    pdf.addImage(imgData, 'JPEG', 0, 0, A4.w, A4.h);

    // Let UI breathe
    await new Promise(r => setTimeout(r, 10));
  }

  onProgress?.(pages.length, pages.length);

  const fileName = `${project.name.replace(/[^a-zA-Z0-9а-яА-Я\s]/g, '').trim() || 'santexnika'}_${new Date().toISOString().slice(0,10)}.pdf`;
  pdf.save(fileName);
}
