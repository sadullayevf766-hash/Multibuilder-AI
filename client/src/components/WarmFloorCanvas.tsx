/**
 * WarmFloorCanvas — Issiq pol isitish tizimi chizmasi
 * PDF (Xumson ОВиК, Lист 3-4) dagi chizmalar uslubida:
 * - Xona rejalari + snake konturlar
 * - Kontur nomi, uzunligi, qadam
 * - Kollektorlar
 * - Xonalar jadvali (ism, maydon, yuk)
 * - Title block (GOST)
 * Rendering: Konva.js
 */
import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import Konva from 'konva';
import jsPDF from 'jspdf';
import type { WarmFloorSchema, WarmFloorFloor, WarmFloorContour, WarmFloorRoom } from '../../../server/src/engine/WarmFloorEngine';
import ZoomToolbar from './ZoomToolbar';
import { setupKonvaZoom, resetKonvaZoom, zoomInKonva, zoomOutKonva, MIN_ZOOM, MAX_ZOOM } from '../lib/konvaZoom';

export interface WarmFloorCanvasHandle {
  exportToPdf: (filename?: string) => void;
}

interface Props {
  schema: WarmFloorSchema;
  floorNumber?: number;   // qaysi qavatni ko'rsatish (1-based)
  width?: number;
}

// ── Konstantalar ──────────────────────────────────────────────────────────────
const U   = 50;        // px per metr (1m = 50px)
const PAD = 80;        // canvas chet bo'shlig'i
const WALL_T  = 6;     // devor qalinligi (px)
const TABLE_W = 220;   // jadval kengligi (o'ng tomonda)

// Rang palitrasi — PDF dagi uslubda
const C = {
  wall:       '#1a1a1a',
  supply:     '#dc2626',    // qizil — issiq quvur
  return_:    '#2563eb',    // ko'k — qaytish quvuri
  contour:    '#e05e0a',    // to'q sariq — kontur yo'li
  contourAlt: '#b45309',    // toq sariq (alternativ)
  text:       '#111827',
  textLight:  '#6b7280',
  roomFill:   '#fef9f0',    // och sariq — issiq pol rangi
  roomBorder: '#d97706',
  collector:  '#7c3aed',
  grid:       '#e5e7eb',
  dim:        '#374151',
  table:      '#1e293b',
  tableHead:  '#0f172a',
  titleBg:    '#1e293b',
};

// Xona nomi → qisqa rus nomi (GOST shtampida)
const ROOM_NAMES_RU: Record<string, string> = {
  'Mehmon xonasi': 'Гостиная',
  'Oshxona':       'Кухня',
  'Zal':           'Зал',
  'Kir-chir':      'Прачечная',
  'Garderob':      'Гардероб',
  'Xol':           'Холл',
  'Master yotoq':  'Спальня (м.)',
  'Bolalar xona':  'Детская',
  'Koridor':       'Коридор',
  'Dam olish':     'Ком. отдыха',
  'Kirish':        'Прихожая',
};
const toRu = (name: string) => ROOM_NAMES_RU[name] ?? name;

// ── Helper: matn qo'shish ─────────────────────────────────────────────────────
function txt(
  layer: Konva.Layer,
  x: number, y: number,
  text: string,
  opts: { fontSize?: number; bold?: boolean; fill?: string; align?: string; width?: number } = {}
) {
  layer.add(new Konva.Text({
    x, y, text,
    fontSize:   opts.fontSize ?? 8,
    fontStyle:  opts.bold ? 'bold' : 'normal',
    fontFamily: 'Arial',
    fill:       opts.fill  ?? C.text,
    align:      opts.align ?? 'left',
    width:      opts.width,
  }));
}

// ── Xona chizish ──────────────────────────────────────────────────────────────
function drawRoom(
  layer: Konva.Layer,
  room: WarmFloorRoom,
  ox: number, oy: number,   // xona NW burchagi (px)
  contours: WarmFloorContour[],
) {
  const rw = room.width  * U;
  const rl = room.length * U;

  // Xona to'ldirish
  layer.add(new Konva.Rect({ x: ox, y: oy, width: rw, height: rl, fill: C.roomFill, stroke: C.wall, strokeWidth: WALL_T }));

  // Kontur yo'llarini chizish
  const roomContours = contours.filter(c => c.roomId === room.id);
  roomContours.forEach((cont, ci) => {
    const color = ci % 2 === 0 ? C.supply : C.contour;
    if (!cont.path || cont.path.length < 2) return;

    const pts = cont.path.flatMap(p => [ox + p.x * rw, oy + p.y * rl]);
    layer.add(new Konva.Line({
      points: pts, stroke: color, strokeWidth: 1.5,
      lineJoin: 'round', lineCap: 'round',
      dash: ci % 2 === 0 ? undefined : [4, 2],
      opacity: 0.75,
    }));

    // Kontur raqami — markazda
    if (cont.path.length > 0) {
      const mp = cont.path[Math.floor(cont.path.length / 2)];
      layer.add(new Konva.Circle({ x: ox + mp.x * rw, y: oy + mp.y * rl, radius: 7, fill: color, opacity: 0.9 }));
      txt(layer, ox + mp.x * rw - 5, oy + mp.y * rl - 4, String(cont.number), { fontSize: 7, fill: 'white', bold: true });
    }
  });

  // Xona raqami (yuqori chap)
  layer.add(new Konva.Rect({ x: ox + 3, y: oy + 3, width: 16, height: 12, fill: C.tableHead, cornerRadius: 2 }));
  txt(layer, ox + 4, oy + 4, String(room.number), { fontSize: 7, fill: 'white', bold: true });

  // Xona nomi va maydoni (markazda)
  txt(layer, ox + rw / 2 - 30, oy + rl / 2 - 8,  room.name,              { fontSize: 7.5, bold: true, fill: C.dim,   width: 60, align: 'center' });
  txt(layer, ox + rw / 2 - 25, oy + rl / 2 + 4,  `${room.area} m²`,      { fontSize: 7,             fill: C.textLight, width: 50, align: 'center' });
}

// ── Kollektor belgisi ──────────────────────────────────────────────────────────
function drawCollectorNode(
  layer: Konva.Layer,
  x: number, y: number,
  contourCount: number,
  pipeIn: string, pipeOut: string,
) {
  const W = 90, H = 28 + contourCount * 14;
  layer.add(new Konva.Rect({ x, y, width: W, height: H, fill: '#f0f4ff', stroke: C.collector, strokeWidth: 1.5, cornerRadius: 4 }));
  layer.add(new Konva.Rect({ x, y, width: W, height: 20, fill: C.collector, cornerRadius: [4, 4, 0, 0] }));
  txt(layer, x + 4, y + 4, `Колл. (${contourCount} конт.)`, { fontSize: 7.5, fill: 'white', bold: true });

  // Quvur o'lchami
  txt(layer, x + 4, y + 22, `ø${pipeIn} вход / ø${pipeOut} выход`, { fontSize: 6.5, fill: C.textLight });

  // Kontur chiziqlari
  for (let i = 0; i < Math.min(contourCount, 8); i++) {
    const cy = y + 34 + i * 13;
    layer.add(new Konva.Line({ points: [x + 6, cy, x + W - 6, cy], stroke: i % 2 === 0 ? C.supply : C.contour, strokeWidth: 2 }));
    layer.add(new Konva.Circle({ x: x + 8, y: cy, radius: 3.5, fill: i % 2 === 0 ? C.supply : C.contour }));
    txt(layer, x + 15, cy - 4, `К-${i + 1}`, { fontSize: 6, fill: C.dim });
  }
  if (contourCount > 8) txt(layer, x + 6, y + H - 14, `+${contourCount - 8} kontur...`, { fontSize: 6, fill: C.textLight });
}

// ── Xonalar jadvali ──────────────────────────────────────────────────────────
function drawRoomTable(
  layer: Konva.Layer,
  floorData: WarmFloorFloor,
  tx: number, ty: number,   // jadval joylashuvi
) {
  const ROW_H = 16;
  const COLS  = [24, 82, 48, 52]; // №, Xona, m², Vt
  const colX  = [tx, tx + COLS[0], tx + COLS[0] + COLS[1], tx + COLS[0] + COLS[1] + COLS[2]];
  const TW    = COLS.reduce((a, b) => a + b, 0);

  // Header
  layer.add(new Konva.Rect({ x: tx, y: ty, width: TW, height: ROW_H + 4, fill: C.tableHead }));
  txt(layer, colX[0] + 2, ty + 4, '№',      { fontSize: 7, fill: 'white', bold: true });
  txt(layer, colX[1] + 2, ty + 4, 'Xona',   { fontSize: 7, fill: 'white', bold: true });
  txt(layer, colX[2] + 2, ty + 4, 'm²',     { fontSize: 7, fill: 'white', bold: true });
  txt(layer, colX[3] + 2, ty + 4, 'Yuk (W)',{ fontSize: 7, fill: 'white', bold: true });

  // Rows
  floorData.rooms.forEach((room, i) => {
    const ry   = ty + ROW_H + 4 + i * ROW_H;
    const fill = i % 2 === 0 ? '#f8fafc' : '#f1f5f9';
    layer.add(new Konva.Rect({ x: tx, y: ry, width: TW, height: ROW_H, fill }));
    const heatW = floorData.contours
      .filter(c => c.roomId === room.id)
      .reduce((s, c) => s + c.heatW, 0);
    txt(layer, colX[0] + 2, ry + 4, String(room.number),             { fontSize: 7 });
    txt(layer, colX[1] + 2, ry + 4, room.name.slice(0, 14),          { fontSize: 7 });
    txt(layer, colX[2] + 2, ry + 4, room.area.toFixed(2),            { fontSize: 7 });
    txt(layer, colX[3] + 2, ry + 4, String(Math.round(heatW || 0)),  { fontSize: 7 });
  });

  // Jami
  const totY = ty + ROW_H + 4 + floorData.rooms.length * ROW_H;
  layer.add(new Konva.Rect({ x: tx, y: totY, width: TW, height: ROW_H, fill: C.tableHead }));
  txt(layer, colX[1] + 2, totY + 4, 'Jami:',                           { fontSize: 7, bold: true, fill: 'white' });
  txt(layer, colX[2] + 2, totY + 4, floorData.totalAreaM2.toFixed(1), { fontSize: 7, bold: true, fill: 'white' });
  txt(layer, colX[3] + 2, totY + 4, String(floorData.totalHeatW),     { fontSize: 7, bold: true, fill: 'white' });

  // Chegara chiziqlari
  layer.add(new Konva.Rect({ x: tx, y: ty, width: TW, height: totY - ty + ROW_H, stroke: C.tableHead, strokeWidth: 1 }));
  COLS.slice(0, -1).reduce((cx, cw) => {
    const nx = cx + cw;
    layer.add(new Konva.Line({ points: [nx, ty, nx, totY + ROW_H], stroke: '#cbd5e1', strokeWidth: 0.5 }));
    return nx;
  }, tx);
}

// ── Title block (GOST shtamp) ─────────────────────────────────────────────────
function drawTitleBlock(
  layer: Konva.Layer,
  x: number, y: number,
  floorData: WarmFloorFloor,
  systemParams: WarmFloorSchema['systemParams'],
  sheetNum: number,
  totalSheets: number,
) {
  const BW = 220, BH = 80;
  const date = new Date().toLocaleDateString('uz-UZ');

  layer.add(new Konva.Rect({ x, y, width: BW, height: BH, stroke: C.wall, strokeWidth: 1.5, fill: 'white' }));
  layer.add(new Konva.Line({ points: [x + 100, y, x + 100, y + BH], stroke: C.wall, strokeWidth: 0.8 }));
  [20, 40, 60].forEach(dy => layer.add(new Konva.Line({ points: [x, y + dy, x + BW, y + dy], stroke: C.wall, strokeWidth: 0.8 })));

  txt(layer, x + 4, y + 4,  'Chizma nomi',                     { fontSize: 7.5, fill: C.textLight });
  txt(layer, x + 4, y + 24, `Issiq pol — ${floorData.label}`,  { fontSize: 9.5, bold: true });
  txt(layer, x + 4, y + 44, 'Masshtab: 1:200',                 { fontSize: 7.5 });
  txt(layer, x + 4, y + 55, systemParams.pipeType,             { fontSize: 7.5 });
  txt(layer, x + 4, y + 65, 'SNiP 2.04.05 / KMK 2.04.05',    { fontSize: 7 });

  txt(layer, x + 104, y + 4,  'Sana:',                             { fontSize: 7.5, fill: C.textLight });
  txt(layer, x + 104, y + 14, date,                                { fontSize: 8 });
  txt(layer, x + 104, y + 34, `${floorData.totalHeatW} Vt / qavat`, { fontSize: 7.5, bold: true });
  txt(layer, x + 104, y + 44, 'Bosqich',                           { fontSize: 7.5, fill: C.textLight });
  txt(layer, x + 104, y + 54, 'РП',                                { fontSize: 9.5, bold: true });
  txt(layer, x + 104, y + 64, `${sheetNum} / ${totalSheets}`,      { fontSize: 8 });
}

// ── Legendа ────────────────────────────────────────────────────────────────────
function drawLegend(layer: Konva.Layer, x: number, y: number) {
  const items = [
    { color: C.supply,  label: 'Issiq suv (ta\'minot)',   dash: false },
    { color: C.contour, label: 'Kontur (qaytish)',         dash: true  },
    { color: C.collector, label: 'Kollektor',              dash: false },
  ];
  layer.add(new Konva.Rect({ x, y, width: 190, height: 12 + items.length * 18, stroke: '#cbd5e1', strokeWidth: 0.8, fill: 'white', cornerRadius: 3 }));
  txt(layer, x + 6, y + 4, 'BELGILAR:', { fontSize: 7.5, bold: true });
  items.forEach((item, i) => {
    const iy = y + 16 + i * 18;
    layer.add(new Konva.Line({ points: [x + 8, iy, x + 38, iy], stroke: item.color, strokeWidth: 2, dash: item.dash ? [5, 3] : undefined }));
    txt(layer, x + 44, iy - 5, item.label, { fontSize: 7.5, fill: C.dim });
  });
}

// ── Asosiy komponent ──────────────────────────────────────────────────────────

const WarmFloorCanvas = forwardRef<WarmFloorCanvasHandle, Props>(
  function WarmFloorCanvas({ schema, floorNumber = 1, width = 1000 }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef     = useRef<Konva.Stage | null>(null);
    const zoomRef      = useRef(1);
    const baseScRef    = useRef(1);
    const [zoom, setZoomState] = useState(1);

    const zoomIn    = useCallback(() => { const s = stageRef.current; if (s) zoomInKonva(s, baseScRef.current, zoomRef, setZoomState); }, []);
    const zoomOut   = useCallback(() => { const s = stageRef.current; if (s) zoomOutKonva(s, baseScRef.current, zoomRef, setZoomState); }, []);
    const resetZoom = useCallback(() => { const s = stageRef.current; if (s) resetKonvaZoom(s, baseScRef.current, zoomRef, setZoomState); }, []);

    useImperativeHandle(ref, () => ({
      exportToPdf(filename = 'warm-floor.pdf') {
        const s = stageRef.current; if (!s) return;
        const sv = { x: s.scaleX(), y: s.scaleY() }, sp = { x: s.x(), y: s.y() };
        const bs = baseScRef.current;
        s.scale({ x: bs, y: bs }); s.position({ x: 0, y: 0 }); s.batchDraw();
        const url = s.toDataURL({ pixelRatio: 2 });
        s.scale(sv); s.position(sp); s.batchDraw();
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [s.width(), s.height()] });
        pdf.addImage(url, 'PNG', 0, 0, s.width(), s.height());
        pdf.save(filename);
      },
    }));

    useEffect(() => {
      if (!containerRef.current || !schema) return;
      stageRef.current?.destroy(); stageRef.current = null;
      zoomRef.current = 1; setZoomState(1);

      const floorData = schema.floors.find(f => f.floorNumber === floorNumber)
        ?? schema.floors[0];
      if (!floorData) return;

      const { rooms, contours, collectors, buildingWidth, buildingLength } = floorData;

      // ── Canvas o'lchamlari ─────────────────────────────────────────────────
      const planW  = buildingWidth  * U;
      const planH  = buildingLength * U;
      const totW   = PAD * 2 + planW + TABLE_W + 20;   // chap + reja + jadval + o'ng
      const totH   = PAD * 2 + planH + 200;             // yuqori + reja + pastki (jadval+shtamp)

      const autoScale = (width / totW);
      const stageH    = Math.ceil(totH * autoScale);
      baseScRef.current = autoScale;

      const stage = new Konva.Stage({ container: containerRef.current, width, height: stageH, scaleX: autoScale, scaleY: autoScale });
      stageRef.current = stage;
      const layer = new Konva.Layer();
      stage.add(layer);

      // ── Fon ──────────────────────────────────────────────────────────────────
      layer.add(new Konva.Rect({ x: 0, y: 0, width: totW, height: totH, fill: '#f8f9fa' }));

      // ── Grid nuqtalari ────────────────────────────────────────────────────────
      for (let i = 0; i <= totW; i += U)
        for (let j = 0; j <= totH; j += U)
          layer.add(new Konva.Circle({ x: i, y: j, radius: 0.7, fill: C.grid }));

      // ── Qavat sarlavhasi ──────────────────────────────────────────────────────
      const elevStr = floorData.elevation >= 0 ? `+${floorData.elevation.toFixed(3)}` : floorData.elevation.toFixed(3);
      txt(layer, PAD, PAD - 40, `ISSIQ POL ISITISH TIZIMI — ${floorData.label.toUpperCase()}`, { fontSize: 12, bold: true, fill: C.table });
      txt(layer, PAD, PAD - 24, `Qavat belgisi: ${elevStr} m  |  Maydon: ${floorData.totalAreaM2} m²  |  Yuk: ${floorData.totalHeatW} W`, { fontSize: 8, fill: C.textLight });

      // ── Xonalar rejasi ────────────────────────────────────────────────────────
      // Xonalarni to'g'ri tartibda joylashtirish (grid packing)
      const COLS_PER_ROW = Math.ceil(Math.sqrt(rooms.length)) || 1;
      let cx = 0, cy = 0, rowH = 0, colIdx = 0;

      rooms.forEach(room => {
        const rx = PAD + cx;
        const ry = PAD + cy;
        const rw = room.width  * U;
        const rl = room.length * U;
        drawRoom(layer, room, rx, ry, contours);
        // O'lchamlar
        layer.add(new Konva.Line({ points: [rx, ry - 18, rx + rw, ry - 18], stroke: C.dim, strokeWidth: 0.7 }));
        layer.add(new Konva.Line({ points: [rx, ry - 22, rx, ry - 14], stroke: C.dim, strokeWidth: 0.7 }));
        layer.add(new Konva.Line({ points: [rx + rw, ry - 22, rx + rw, ry - 14], stroke: C.dim, strokeWidth: 0.7 }));
        txt(layer, rx + rw / 2 - 15, ry - 26, `${room.width}m`, { fontSize: 7, fill: C.dim, align: 'center', width: 30 });
        layer.add(new Konva.Line({ points: [rx - 18, ry, rx - 18, ry + rl], stroke: C.dim, strokeWidth: 0.7 }));
        txt(layer, rx - 30, ry + rl / 2 - 5, `${room.length}m`, { fontSize: 7, fill: C.dim });

        rowH = Math.max(rowH, rl + 40);
        cx += rw + 15;
        colIdx++;
        if (colIdx >= COLS_PER_ROW) {
          cx = 0; cy += rowH; rowH = 0; colIdx = 0;
        }
      });

      // ── O'ng tomonda jadval ────────────────────────────────────────────────────
      const tableX = PAD + planW + 30;
      const tableY = PAD;
      txt(layer, tableX, tableY - 18, `${floorData.label.toUpperCase()} — Xonalar ro'yxati`, { fontSize: 9, bold: true, fill: C.table });
      drawRoomTable(layer, floorData, tableX, tableY);

      // ── Kollektorlar ──────────────────────────────────────────────────────────
      collectors.forEach((coll, ci) => {
        const cx2 = tableX;
        const cy2 = tableY + 60 + floorData.rooms.length * 16 + 30 + ci * 180;
        txt(layer, cx2, cy2 - 14, `Kollektor ${ci + 1}:`, { fontSize: 8, bold: true, fill: C.collector });
        drawCollectorNode(layer, cx2, cy2, coll.contours.length, coll.pipeInDiam, coll.pipeOutDiam);
      });

      // ── Legendа ────────────────────────────────────────────────────────────────
      drawLegend(layer, PAD, totH - 170);

      // ── Title block ───────────────────────────────────────────────────────────
      drawTitleBlock(
        layer,
        totW - 240,
        totH - 100,
        floorData,
        schema.systemParams,
        floorData.floorNumber * 2 - 1,
        schema.floors.length * 2,
      );

      // ── Umumiy ma'lumotlar (pastda) ────────────────────────────────────────────
      const infoX = PAD;
      const infoY = totH - 170;
      txt(layer, infoX + 200, infoY,      `Truba: ${schema.systemParams.pipeType}`, { fontSize: 8 });
      txt(layer, infoX + 200, infoY + 14, `Quvvat: ${schema.heatSourceKw} kW`,     { fontSize: 8, bold: true, fill: C.supply });
      txt(layer, infoX + 200, infoY + 28, `T° berilish/qaytish: ${schema.systemParams.supplyTemp}/${schema.systemParams.returnTemp}°C`, { fontSize: 8 });

      layer.draw();
      const cleanup = setupKonvaZoom(stage, autoScale, zoomRef, setZoomState);
      return () => { cleanup(); stage.destroy(); stageRef.current = null; };
    }, [schema, floorNumber, width]);

    return (
      <div className="flex flex-col border border-slate-700 rounded-xl overflow-hidden w-full">
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-700">
          <span className="text-xs text-slate-400">
            ♨️ Issiq pol isitish tizimi · Scroll = zoom · Drag = pan
          </span>
          <ZoomToolbar zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} />
        </div>
        <div ref={containerRef} className="bg-white w-full overflow-hidden cursor-grab active:cursor-grabbing" />
      </div>
    );
  }
);

export default WarmFloorCanvas;
