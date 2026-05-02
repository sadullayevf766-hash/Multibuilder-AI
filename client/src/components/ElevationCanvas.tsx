import { useEffect, useRef, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import ZoomToolbar from './ZoomToolbar';
import { setupKonvaZoom, resetKonvaZoom, zoomInKonva, zoomOutKonva, MIN_ZOOM, MAX_ZOOM } from '../lib/konvaZoom';
import Konva from 'konva';
import jsPDF from 'jspdf';
import type { ArchDrawingData, ElevationData, SectionData, SectionRoom, ArchOpening } from '../../../shared/types';

export interface ElevationCanvasHandle { exportToPdf: (f?: string) => void; }

// ── Layout constants ──────────────────────────────────────────────────────────
const U     = 100;   // px per meter at 1:50 scale
const PAD   = 80;    // outer padding for dimension lines
const DIM   = 40;    // space reserved for dimension text

// ── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg:       '#f8fafc',
  paper:    '#ffffff',
  wall:     '#2c2c2c',
  wallFill: '#e8e8e8',
  ground:   '#4a3728',
  groundFg: '#2c1a0e',
  sky:      '#f0f6ff',
  window:   '#bfdbfe',
  winFrame: '#1d4ed8',
  door:     '#fef3c7',
  doorFr:   '#92400e',
  dim:      '#555555',
  level:    '#1a1a1a',
  hatch:    '#9ca3af',
  grid:     '#e2e8f0',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function hatchRect(layer: Konva.Layer, x: number, y: number, w: number, h: number, spacing = 6) {
  const clip = { x, y, width: w, height: h };
  const group = new Konva.Group({ clip });
  for (let i = -h; i < w + h; i += spacing) {
    group.add(new Konva.Line({ points: [x + i, y, x + i + h, y + h], stroke: C.hatch, strokeWidth: 0.5 }));
  }
  layer.add(group);
}

function groundHatch(layer: Konva.Layer, x: number, y: number, w: number, h: number) {
  const clip = { x, y, width: w, height: h };
  const group = new Konva.Group({ clip });
  for (let i = 0; i < w + h; i += 8) {
    group.add(new Konva.Line({ points: [x + i, y, x + i - h, y + h], stroke: C.groundFg, strokeWidth: 0.8 }));
  }
  layer.add(group);
}

function dimLine(layer: Konva.Layer, x1: number, y: number, x2: number, label: string, above = true) {
  const yOff = above ? -DIM : DIM;
  const tick = 6;
  layer.add(new Konva.Line({ points: [x1, y + yOff - tick, x1, y + yOff + tick], stroke: C.dim, strokeWidth: 1 }));
  layer.add(new Konva.Line({ points: [x2, y + yOff - tick, x2, y + yOff + tick], stroke: C.dim, strokeWidth: 1 }));
  layer.add(new Konva.Line({ points: [x1, y + yOff, x2, y + yOff], stroke: C.dim, strokeWidth: 0.8 }));
  layer.add(new Konva.Text({ x: (x1 + x2) / 2 - 22, y: y + yOff + (above ? -16 : 2), width: 44, align: 'center', text: label, fontSize: 9, fill: C.dim }));
}

function vDimLine(layer: Konva.Layer, x: number, y1: number, y2: number, label: string, right = true) {
  const xOff = right ? DIM : -DIM;
  const tick = 6;
  layer.add(new Konva.Line({ points: [x + xOff - tick, y1, x + xOff + tick, y1], stroke: C.dim, strokeWidth: 1 }));
  layer.add(new Konva.Line({ points: [x + xOff - tick, y2, x + xOff + tick, y2], stroke: C.dim, strokeWidth: 1 }));
  layer.add(new Konva.Line({ points: [x + xOff, y1, x + xOff, y2], stroke: C.dim, strokeWidth: 0.8 }));
  const mid = (y1 + y2) / 2;
  layer.add(new Konva.Text({ x: x + xOff + (right ? 3 : -38), y: mid - 5, text: label, fontSize: 9, fill: C.dim }));
}

function levelMark(layer: Konva.Layer, x: number, y: number, value: string) {
  const w = 8;
  layer.add(new Konva.Line({ points: [x - w, y - w, x, y, x - w, y + w], stroke: C.level, strokeWidth: 1.2 }));
  layer.add(new Konva.Line({ points: [x, y, x + 40, y], stroke: C.level, strokeWidth: 0.6, dash: [4, 2] }));
  layer.add(new Konva.Text({ x: x + 2, y: y - 13, text: value, fontSize: 9, fontStyle: 'bold', fill: C.level }));
}

// ── Draw one elevation ────────────────────────────────────────────────────────

function drawElevation(layer: Konva.Layer, elev: ElevationData, offX: number, offY: number) {
  const { wallWidth, floorHeight, openings, label } = elev;
  const W = wallWidth * U;
  const H = floorHeight * U;
  const gH = 20; // ground depth below ±0.000

  // Sky
  layer.add(new Konva.Rect({ x: offX, y: offY, width: W, height: H, fill: C.sky }));

  // Wall fill (full face)
  layer.add(new Konva.Rect({ x: offX, y: offY, width: W, height: H, fill: C.wallFill }));

  // Wall hatch (diagonal lines)
  hatchRect(layer, offX, offY, W, H, 8);

  // ── Cut out openings ──
  openings.forEach(op => {
    const ox = offX + op.xOffset * U;
    const oy = offY + H - op.sillHeight * U - op.height * U;
    const ow = op.width * U;
    const oh = op.height * U;

    // White background (erase wall)
    layer.add(new Konva.Rect({ x: ox, y: oy, width: ow, height: oh, fill: C.paper }));

    if (op.type === 'door') {
      // Door fill + frame
      layer.add(new Konva.Rect({ x: ox + 2, y: oy + 2, width: ow - 4, height: oh - 2, fill: C.door }));
      layer.add(new Konva.Rect({ x: ox, y: oy, width: ow, height: oh, stroke: C.doorFr, strokeWidth: 1.5, fill: 'transparent' }));
      // Door panel lines
      layer.add(new Konva.Line({ points: [ox + ow / 2, oy + 4, ox + ow / 2, oy + oh - 4], stroke: C.doorFr, strokeWidth: 0.8 }));
      layer.add(new Konva.Line({ points: [ox + 4, oy + oh * 0.4, ox + ow - 4, oy + oh * 0.4], stroke: C.doorFr, strokeWidth: 0.6 }));
      layer.add(new Konva.Line({ points: [ox + 4, oy + oh * 0.75, ox + ow - 4, oy + oh * 0.75], stroke: C.doorFr, strokeWidth: 0.6 }));
      // Threshold line
      layer.add(new Konva.Line({ points: [ox, offY + H, ox + ow, offY + H], stroke: C.doorFr, strokeWidth: 2 }));
    } else {
      // Window: blue glass + frame + cross
      layer.add(new Konva.Rect({ x: ox + 2, y: oy + 2, width: ow - 4, height: oh - 4, fill: C.window }));
      layer.add(new Konva.Rect({ x: ox, y: oy, width: ow, height: oh, stroke: C.winFrame, strokeWidth: 1.5, fill: 'transparent' }));
      // Window muntins
      layer.add(new Konva.Line({ points: [ox + ow / 2, oy, ox + ow / 2, oy + oh], stroke: C.winFrame, strokeWidth: 0.8 }));
      layer.add(new Konva.Line({ points: [ox, oy + oh / 2, ox + ow, oy + oh / 2], stroke: C.winFrame, strokeWidth: 0.8 }));
    }
  });

  // Wall outline (over openings)
  layer.add(new Konva.Rect({ x: offX, y: offY, width: W, height: H, stroke: C.wall, strokeWidth: 2, fill: 'transparent' }));

  // Ground
  layer.add(new Konva.Rect({ x: offX, y: offY + H, width: W, height: gH, fill: C.ground }));
  groundHatch(layer, offX, offY + H, W, gH);
  layer.add(new Konva.Line({ points: [offX - 10, offY + H, offX + W + 10, offY + H], stroke: C.groundFg, strokeWidth: 2.5 }));

  // ── Dimension lines ──
  // Total width below ground
  dimLine(layer, offX, offY + H + gH, offX + W, `${wallWidth.toFixed(2)}m`, false);

  // Per-opening widths above roof
  openings.forEach(op => {
    const ox = offX + op.xOffset * U;
    dimLine(layer, ox, offY, ox + op.width * U, `${op.width.toFixed(2)}m`, true);
  });

  // Height dim on right
  vDimLine(layer, offX + W, offY, offY + H, `${floorHeight.toFixed(2)}m`, true);

  // ── Level marks ──
  levelMark(layer, offX - 5, offY + H, '±0.000');
  levelMark(layer, offX - 5, offY,     `+${floorHeight.toFixed(3)}`);

  // Label below
  layer.add(new Konva.Text({
    x: offX, y: offY + H + gH + 28, width: W, align: 'center',
    text: label.toUpperCase(), fontSize: 10, fontStyle: 'bold', fill: '#333',
  }));
}

// ── Draw section ──────────────────────────────────────────────────────────────

function drawSection(layer: Konva.Layer, sec: SectionData, offX: number, offY: number) {
  const { totalWidth, floorHeight, rooms, openings, label } = sec;
  const W  = totalWidth * U;
  const H  = floorHeight * U;
  const gH = 20;
  const wT = 15; // wall thickness px

  // Sky
  layer.add(new Konva.Rect({ x: offX, y: offY, width: W, height: H, fill: C.sky }));

  // Room backgrounds
  rooms.forEach((room: SectionRoom) => {
    const rx = offX + room.xOffset * U;
    const rw = room.width * U;
    layer.add(new Konva.Rect({ x: rx + wT, y: offY, width: rw - wT * 2, height: H, fill: C.paper }));
    // Room label inside
    layer.add(new Konva.Text({
      x: rx + wT + 2, y: offY + H / 2 - 8, width: rw - wT * 2 - 4, align: 'center',
      text: room.name, fontSize: 9, fill: '#666',
    }));
  });

  // Wall sections (between rooms and at edges)
  // Left wall
  layer.add(new Konva.Rect({ x: offX, y: offY, width: wT, height: H, fill: C.wallFill, stroke: C.wall, strokeWidth: 1 }));
  hatchRect(layer, offX, offY, wT, H, 6);
  // Right wall
  layer.add(new Konva.Rect({ x: offX + W - wT, y: offY, width: wT, height: H, fill: C.wallFill, stroke: C.wall, strokeWidth: 1 }));
  hatchRect(layer, offX + W - wT, offY, wT, H, 6);

  // Internal walls between rooms
  for (let i = 1; i < rooms.length; i++) {
    const ix = offX + rooms[i].xOffset * U - wT / 2;
    layer.add(new Konva.Rect({ x: ix, y: offY, width: wT, height: H, fill: C.wallFill, stroke: C.wall, strokeWidth: 1 }));
    hatchRect(layer, ix, offY, wT, H, 6);
  }

  // Ceiling slab
  layer.add(new Konva.Rect({ x: offX, y: offY - 12, width: W, height: 12, fill: C.wallFill, stroke: C.wall, strokeWidth: 1 }));
  hatchRect(layer, offX, offY - 12, W, 12, 6);

  // Floor slab
  layer.add(new Konva.Rect({ x: offX, y: offY + H, width: W, height: 12, fill: C.wallFill, stroke: C.wall, strokeWidth: 1 }));
  hatchRect(layer, offX, offY + H, W, 12, 6);

  // Openings visible in cut plane
  openings.forEach(op => {
    const ox = offX + op.xOffset * U;
    const oy = offY + H - op.sillHeight * U - op.height * U;
    const ow = op.width * U;
    const oh = op.height * U;
    layer.add(new Konva.Rect({ x: ox, y: oy, width: ow, height: oh, fill: op.type === 'window' ? C.window : C.door }));
    layer.add(new Konva.Rect({ x: ox, y: oy, width: ow, height: oh, stroke: op.type === 'window' ? C.winFrame : C.doorFr, strokeWidth: 1.2, fill: 'transparent' }));
  });

  // Ground
  layer.add(new Konva.Rect({ x: offX, y: offY + H + 12, width: W, height: gH }));
  groundHatch(layer, offX, offY + H + 12, W, gH);
  layer.add(new Konva.Line({ points: [offX - 10, offY + H + 12, offX + W + 10, offY + H + 12], stroke: C.groundFg, strokeWidth: 2.5 }));

  // Outline
  layer.add(new Konva.Rect({ x: offX, y: offY, width: W, height: H, stroke: C.wall, strokeWidth: 2, fill: 'transparent' }));

  // ── Dimension lines ──
  dimLine(layer, offX, offY + H + gH + 12, offX + W, `${totalWidth.toFixed(2)}m`, false);
  vDimLine(layer, offX + W, offY, offY + H, `${floorHeight.toFixed(2)}m`, true);

  levelMark(layer, offX - 5, offY + H + 12, '±0.000');
  levelMark(layer, offX - 5, offY,          `+${floorHeight.toFixed(3)}`);

  // Section marks (A-A arrows at top)
  const arrowH = 20;
  [offX, offX + W].forEach((ax, ai) => {
    const dir = ai === 0 ? 1 : -1;
    layer.add(new Konva.Line({ points: [ax, offY - 20, ax, offY - 20 - arrowH], stroke: C.level, strokeWidth: 2 }));
    layer.add(new Konva.Line({ points: [ax, offY - 20, ax + dir * 10, offY - 14], stroke: C.level, strokeWidth: 2 }));
    layer.add(new Konva.Circle({ x: ax, y: offY - 20 - arrowH - 10, radius: 10, stroke: C.level, strokeWidth: 1.5, fill: 'white' }));
    layer.add(new Konva.Text({ x: ax - 6, y: offY - 20 - arrowH - 16, text: '1', fontSize: 10, fontStyle: 'bold', fill: C.level }));
  });

  // Label below
  layer.add(new Konva.Text({
    x: offX, y: offY + H + gH + 36, width: W, align: 'center',
    text: label.toUpperCase(), fontSize: 10, fontStyle: 'bold', fill: '#333',
  }));
}

// ── Title block ───────────────────────────────────────────────────────────────

function drawTitleBlock(layer: Konva.Layer, x: number, y: number, title: string) {
  const bW = 220, bH = 80;
  const date = new Date().toLocaleDateString('uz-UZ');
  layer.add(new Konva.Rect({ x, y, width: bW, height: bH, stroke: '#1a1a1a', strokeWidth: 1.5, fill: 'white' }));
  layer.add(new Konva.Line({ points: [x + 100, y, x + 100, y + bH], stroke: '#1a1a1a', strokeWidth: 0.8 }));
  [20, 40, 60].forEach(dy => layer.add(new Konva.Line({ points: [x, y + dy, x + bW, y + dy], stroke: '#1a1a1a', strokeWidth: 0.8 })));
  const t = (tx: number, ty: number, text: string, bold = false, sz = 8) =>
    layer.add(new Konva.Text({ x: tx, y: ty, text, fontSize: sz, fontFamily: 'Arial', fontStyle: bold ? 'bold' : 'normal', fill: bold ? '#1a1a1a' : '#555' }));
  t(x + 4, y + 4,  'Loyiha nomi');
  t(x + 4, y + 22, title, true, 9);
  t(x + 4, y + 44, 'Masshtab');
  t(x + 4, y + 54, '1:50', true, 9);
  t(x + 4, y + 64, 'GOST 21.501-93');
  t(x + 104, y + 4,  'Sana');
  t(x + 104, y + 14, date, true, 8);
  t(x + 104, y + 44, 'Bosqich');
  t(x + 104, y + 54, 'РП', true, 9);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  data: ArchDrawingData;
  view: 'elevations' | 'section';
  elevationIdx?: number;
  width?: number;
}

const ElevationCanvas = forwardRef<ElevationCanvasHandle, Props>(
  function ElevationCanvas({ data, view, elevationIdx = 0, width = 900 }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef     = useRef<Konva.Stage | null>(null);
    const zoomRef      = useRef(1);
    const baseScRef    = useRef(1);
    const [zoom, setZoomState] = useState(1);

    const zoomIn    = useCallback(() => { const s = stageRef.current; if (s) zoomInKonva(s, baseScRef.current, zoomRef, setZoomState); }, []);
    const zoomOut   = useCallback(() => { const s = stageRef.current; if (s) zoomOutKonva(s, baseScRef.current, zoomRef, setZoomState); }, []);
    const resetZoom = useCallback(() => { const s = stageRef.current; if (s) resetKonvaZoom(s, baseScRef.current, zoomRef, setZoomState); }, []);

    useImperativeHandle(ref, () => ({
      exportToPdf(filename = 'arxitektura.pdf') {
        const s = stageRef.current; if (!s) return;
        const savedSc = { x: s.scaleX(), y: s.scaleY() }, savedPos = { x: s.x(), y: s.y() };
        const bs = baseScRef.current;
        s.scale({ x: bs, y: bs }); s.position({ x: 0, y: 0 }); s.batchDraw();
        const url = s.toDataURL({ pixelRatio: 3 });
        s.scale(savedSc); s.position(savedPos); s.batchDraw();
        const pdf = new jsPDF({ orientation: s.width() >= s.height() ? 'landscape' : 'portrait', unit: 'px', format: [s.width(), s.height()] });
        pdf.addImage(url, 'PNG', 0, 0, s.width(), s.height());
        pdf.save(filename);
      },
    }));

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      stageRef.current?.destroy();
      stageRef.current = null;
      zoomRef.current = 1; setZoomState(1);

      const SPACING = 80; // space between drawings
      let contentW: number, contentH: number;

      if (view === 'section') {
        const sec = data.section;
        const W = sec.totalWidth * U;
        const H = sec.floorHeight * U;
        contentW = W + PAD * 2 + DIM + 60;
        contentH = H + PAD * 2 + DIM + 100;
      } else {
        const elevs = view === 'elevations'
          ? (elevationIdx >= 0 ? [data.elevations[elevationIdx]] : data.elevations)
          : data.elevations;
        const elev = elevs[0];
        if (!elev) return;
        const W = elev.wallWidth * U;
        const H = elev.floorHeight * U;
        contentW = W + PAD * 2 + DIM + 60;
        contentH = H + PAD * 2 + DIM + 100;
      }

      const scale = width / contentW;
      const stageH = Math.ceil(contentH * scale);

      baseScRef.current = scale;
      const stage = new Konva.Stage({ container: el, width, height: stageH, scaleX: scale, scaleY: scale });
      stageRef.current = stage;
      const layer = new Konva.Layer();
      stage.add(layer);

      // Background
      layer.add(new Konva.Rect({ x: 0, y: 0, width: contentW, height: contentH, fill: C.bg }));

      const drawOffX = PAD + DIM;
      const drawOffY = PAD + 30;

      if (view === 'section') {
        const sec = data.section;
        drawSection(layer, sec, drawOffX, drawOffY);
        const secW = sec.totalWidth * U;
        const secH = sec.floorHeight * U + 20 + DIM + 50;
        drawTitleBlock(layer, drawOffX + secW - 220, drawOffY + secH - 10, `Arxitektura — ${data.roomName ?? 'Bino'}`);
      } else {
        const elev = data.elevations[elevationIdx] ?? data.elevations[0];
        if (!elev) { layer.draw(); return; }
        drawElevation(layer, elev, drawOffX, drawOffY);
        const eW = elev.wallWidth * U;
        const eH = elev.floorHeight * U + 20 + DIM + 50;
        drawTitleBlock(layer, drawOffX + eW - 220, drawOffY + eH - 10, `Arxitektura — ${data.roomName ?? 'Bino'}`);
      }

      // Grid dots
      for (let i = 0; i < contentW; i += 100)
        for (let j = 0; j < contentH; j += 100)
          layer.add(new Konva.Circle({ x: i, y: j, radius: 0.8, fill: C.grid }));

      layer.draw();
      const cleanup = setupKonvaZoom(stage, scale, zoomRef, setZoomState);
      return () => { cleanup(); stage.destroy(); };
    }, [data, view, elevationIdx, width]);

    return (
      <div className="flex flex-col border border-gray-300 rounded-lg overflow-hidden w-full">
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
          <span className="text-xs text-slate-400">Arxitektura chizmasi · Scroll = zoom · Drag = pan</span>
          <ZoomToolbar zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} />
        </div>
        <div ref={containerRef} className="bg-white w-full overflow-hidden cursor-grab active:cursor-grabbing" />
      </div>
    );
  }
);

export default ElevationCanvas;
