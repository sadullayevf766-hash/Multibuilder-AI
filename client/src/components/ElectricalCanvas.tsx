import { useRef, useEffect, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import ZoomToolbar from './ZoomToolbar';
import { setupKonvaZoom, resetKonvaZoom, zoomInKonva, zoomOutKonva, MIN_ZOOM, MAX_ZOOM } from '../lib/konvaZoom';
import Konva from 'konva';
import jsPDF from 'jspdf';
import type {
  ElectricalDrawingData, ElectricalSymbol, ElectricalSymbolType,
  Wall, DoorSpec, WindowSpec, DimensionLine,
} from '../../../shared/types';

export interface ElectricalCanvasHandle { exportToPdf: (f?: string) => void; }

const PAD        = 130;
const WALL_T     = 15;
const DIM_OFFSET = 50;
const DIM_EXT    = 12;
const TICK       = 10;
const GRID       = 100;

// ── Renk / rang ──────────────────────────────────────────────────────────────
const C = {
  wall:    '#cccccc',
  wallFg:  '#111111',
  sym:     '#1e3a8a',   // elektrik belgilari - to'q ko'k
  symFill: '#dbeafe',
  panel:   '#7c2d12',
  dim:     '#555555',
  cable:   '#94a3b8',   // kabel yo'li - och kulrang
  grid:    '#cccccc',
};

// ── Guruh ranglari (legend uchun) ─────────────────────────────────────────────
const CIRCUIT_COLORS: Record<string, string> = {
  'c-lighting': '#f59e0b',
  'c-bathroom': '#06b6d4',
  'c-kitchen':  '#ef4444',
  'c-sockets':  '#8b5cf6',
  panel:        C.panel,
};
function circuitColor(cid: string) {
  if (cid === 'panel') return C.panel;
  // c1, c2, ... → coloring by index
  const idx = parseInt(cid.replace(/\D/g, '')) || 0;
  const palette = ['#f59e0b','#06b6d4','#ef4444','#8b5cf6','#10b981','#f97316','#ec4899'];
  return palette[(idx - 1) % palette.length] ?? C.sym;
}

// ── Devor chizish ─────────────────────────────────────────────────────────────
function drawWall(layer: Konva.Layer, wall: Wall) {
  const offset = wall.thickness / 2;
  const dx = wall.end.x - wall.start.x, dy = wall.end.y - wall.start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const nx = -dy / len, ny = dx / len;
  const ux = dx / len, uy = dy / len;
  const ext = offset;
  const sx = wall.start.x + PAD, sy = wall.start.y + PAD;
  const ex = wall.end.x + PAD,   ey = wall.end.y + PAD;
  const sxe = sx - ux * ext, sye = sy - uy * ext;
  const exe = ex + ux * ext, eye = ey + uy * ext;

  layer.add(new Konva.Line({
    points: [
      sxe + nx * offset, sye + ny * offset, exe + nx * offset, eye + ny * offset,
      exe - nx * offset, eye - ny * offset, sxe - nx * offset, sye - ny * offset,
    ],
    closed: true, fill: C.wall, stroke: C.wall, strokeWidth: 1,
  }));
  layer.add(new Konva.Line({
    points: [sx + nx * offset, sy + ny * offset, ex + nx * offset, ey + ny * offset],
    stroke: C.wallFg, strokeWidth: 2.5, lineCap: 'square',
  }));
  layer.add(new Konva.Line({
    points: [sx - nx * offset, sy - ny * offset, ex - nx * offset, ey - ny * offset],
    stroke: C.wallFg, strokeWidth: 1.5, lineCap: 'square',
  }));
}

function fillCorners(layer: Konva.Layer, walls: Wall[]) {
  const S = 17, seen = new Set<string>();
  walls.forEach(w => [w.start, w.end].forEach(p => {
    const k = `${p.x},${p.y}`;
    if (seen.has(k)) return;
    seen.add(k);
    layer.add(new Konva.Rect({ x: p.x + PAD - S / 2, y: p.y + PAD - S / 2, width: S, height: S, fill: C.wall, strokeWidth: 0 }));
  }));
}

// ── Eshik chizish ─────────────────────────────────────────────────────────────
function drawDoor(layer: Konva.Layer, door: DoorSpec & any, walls: Wall[]) {
  let wall = walls.find(w => w.id === door.wallId) ?? walls.find(w => w.side === door.wall);
  if (!wall) return;
  const dw = (door.width ?? 0.9) * 100;
  const T2 = wall.thickness;
  const sx = wall.start.x + PAD, sy = wall.start.y + PAD;
  const ex = wall.end.x + PAD,   ey = wall.end.y + PAD;
  const mx = (sx + ex) / 2,       my = (sy + ey) / 2;
  const wCY = (sy + ey) / 2,      wCX = (sx + ex) / 2;
  const side = door.wall;
  let gapX: number, gapY: number, gapW: number, gapH: number;
  let pivX: number, pivY: number, leafX: number, leafY: number;
  if (side === 'north') {
    gapX = mx - dw/2; gapY = wCY - T2/2; gapW = dw; gapH = T2;
    pivX = gapX; pivY = wCY + T2/2; leafX = pivX; leafY = pivY + dw;
  } else if (side === 'south') {
    gapX = mx - dw/2; gapY = wCY - T2/2; gapW = dw; gapH = T2;
    pivX = gapX + dw; pivY = wCY - T2/2; leafX = pivX; leafY = pivY - dw;
  } else if (side === 'east') {
    gapX = wCX - T2/2; gapY = my - dw/2; gapW = T2; gapH = dw;
    pivX = wCX - T2/2; pivY = gapY; leafX = pivX - dw; leafY = pivY;
  } else {
    gapX = wCX - T2/2; gapY = my - dw/2; gapW = T2; gapH = dw;
    pivX = wCX + T2/2; pivY = gapY; leafX = pivX + dw; leafY = pivY;
  }
  const k = 0.5523;
  let arc: number[];
  if (side === 'north')      arc = [leafX, leafY, leafX + dw*k, leafY, pivX+dw, pivY+dw*(1-k), pivX+dw, pivY];
  else if (side === 'south') arc = [leafX, leafY, leafX - dw*k, leafY, pivX-dw, pivY-dw*(1-k), pivX-dw, pivY];
  else if (side === 'east')  arc = [leafX, leafY, leafX, leafY+dw*k, pivX-dw*(1-k), pivY+dw, pivX, pivY+dw];
  else                       arc = [leafX, leafY, leafX, leafY+dw*k, pivX+dw*(1-k), pivY+dw, pivX, pivY+dw];

  const g = new Konva.Group();
  g.add(new Konva.Rect({ x: gapX, y: gapY, width: gapW, height: gapH, fill: 'white' }));
  g.add(new Konva.Line({ points: arc, bezier: true, stroke: '#888', strokeWidth: 1, dash: [4, 3] }));
  g.add(new Konva.Line({ points: [pivX, pivY, leafX, leafY], stroke: '#000', strokeWidth: 3 }));
  layer.add(g);
}

// ── Oyna chizish ──────────────────────────────────────────────────────────────
function drawWindow(layer: Konva.Layer, win: WindowSpec & any, walls: Wall[]) {
  let wall = walls.find(w => w.id === win.wallId) ?? walls.find(w => w.side === win.wall);
  if (!wall) return;
  const ww = (win.width ?? 1.2) * 100;
  const T2 = wall.thickness;
  const sx = wall.start.x + PAD, sy = wall.start.y + PAD;
  const ex = wall.end.x + PAD,   ey = wall.end.y + PAD;
  const cx = (sx + ex) / 2,      cy = (sy + ey) / 2;
  const hw = ww / 2, ext = 3;
  const isH = win.wall === 'north' || win.wall === 'south';
  let x1: number, y1: number, x2: number, y2: number;
  if (win.wall === 'north') { x1=cx-hw; y1=sy-T2/2-ext; x2=cx+hw; y2=sy+T2/2+ext; }
  else if (win.wall === 'south') { x1=cx-hw; y1=ey-T2/2-ext; x2=cx+hw; y2=ey+T2/2+ext; }
  else if (win.wall === 'east') { x1=ex-T2/2-ext; y1=cy-hw; x2=ex+T2/2+ext; y2=cy+hw; }
  else { x1=sx-T2/2-ext; y1=cy-hw; x2=sx+T2/2+ext; y2=cy+hw; }
  const g = new Konva.Group();
  g.add(new Konva.Rect({ x: x1, y: y1, width: x2-x1, height: y2-y1, fill: 'white' }));
  if (isH) {
    g.add(new Konva.Line({ points: [x1,y1,x2,y1], stroke: '#1a1a1a', strokeWidth: 1.2 }));
    g.add(new Konva.Line({ points: [x1,(y1+y2)/2,x2,(y1+y2)/2], stroke: '#1a1a1a', strokeWidth: 2 }));
    g.add(new Konva.Line({ points: [x1,y2,x2,y2], stroke: '#1a1a1a', strokeWidth: 1.2 }));
  } else {
    g.add(new Konva.Line({ points: [x1,y1,x1,y2], stroke: '#1a1a1a', strokeWidth: 1.2 }));
    g.add(new Konva.Line({ points: [(x1+x2)/2,y1,(x1+x2)/2,y2], stroke: '#1a1a1a', strokeWidth: 2 }));
    g.add(new Konva.Line({ points: [x2,y1,x2,y2], stroke: '#1a1a1a', strokeWidth: 1.2 }));
  }
  layer.add(g);
}

// ── O'lcham chiziqlari ────────────────────────────────────────────────────────
function drawDim(layer: Konva.Layer, dim: DimensionLine, tW: number, tH: number) {
  if (dim.value === 0) return;
  const sx = dim.start.x + PAD, sy = dim.start.y + PAD;
  const ex = dim.end.x + PAD,   ey = dim.end.y + PAD;
  const mx = (sx+ex)/2, my = (sy+ey)/2;
  const dx = ex-sx, dy = ey-sy;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx/len, uy = dy/len;
  let nx = -uy, ny = ux;
  const cX = PAD + tW/2, cY = PAD + tH/2;
  if (nx*(cX-mx) + ny*(cY-my) > 0) { nx=-nx; ny=-ny; }
  const ax = sx + nx*DIM_OFFSET, ay = Math.max(30, sy + ny*DIM_OFFSET);
  const bx = ex + nx*DIM_OFFSET, by = Math.max(30, ey + ny*DIM_OFFSET);
  layer.add(new Konva.Line({ points: [ax,ay,bx,by], stroke: C.dim, strokeWidth: 0.8 }));
  layer.add(new Konva.Line({ points: [sx,sy, sx+nx*(DIM_OFFSET+DIM_EXT), sy+ny*(DIM_OFFSET+DIM_EXT)], stroke: C.dim, strokeWidth: 0.8 }));
  layer.add(new Konva.Line({ points: [ex,ey, ex+nx*(DIM_OFFSET+DIM_EXT), ey+ny*(DIM_OFFSET+DIM_EXT)], stroke: C.dim, strokeWidth: 0.8 }));
  const h = TICK/2;
  [[ax,ay],[bx,by]].forEach(([tx,ty]) => {
    layer.add(new Konva.Line({ points: [tx-ux*h-nx*h, ty-uy*h-ny*h, tx+ux*h+nx*h, ty+uy*h+ny*h], stroke: '#333', strokeWidth: 1.2 }));
  });
  layer.add(new Konva.Text({ x: mx+nx*(DIM_OFFSET+6)-22, y: my+ny*(DIM_OFFSET+6)-6, text: dim.label, fontSize: 9.5, fontFamily: 'Arial', fill: '#111', width: 44, align: 'center' }));
}

// ── Elektrik belgilari (GOST 21.608) ──────────────────────────────────────────

const SYMBOL_LABELS: Partial<Record<ElectricalSymbolType, string>> = {
  socket: 'R',  socket_double: 'R2',  socket_waterproof: 'R*',  socket_tv: 'TV',
  light_ceiling: 'L',  light_waterproof: 'L*',
  switch: 'S',  switch_double: 'S2',
  fan_exhaust: 'F',  panel: 'ЩЭ',
};

function drawSymbol(layer: Konva.Layer, sym: ElectricalSymbol, circuitNum: string) {
  const { x, y } = { x: sym.position.x + PAD, y: sym.position.y + PAD };
  const t = sym.type;
  const color = circuitColor(sym.circuit);

  if (t === 'light_ceiling' || t === 'light_waterproof') {
    // Ceiling light: circle with cross (GOST)
    const r = 10;
    layer.add(new Konva.Circle({ x, y, radius: r, fill: 'white', stroke: color, strokeWidth: 1.8 }));
    layer.add(new Konva.Line({ points: [x-7,y, x+7,y], stroke: color, strokeWidth: 1.5 }));
    layer.add(new Konva.Line({ points: [x,y-7, x,y+7], stroke: color, strokeWidth: 1.5 }));
    if (t === 'light_waterproof') {
      // Extra circle for waterproof
      layer.add(new Konva.Circle({ x, y, radius: r+3, stroke: color, strokeWidth: 0.8, dash: [3,2] }));
    }
    layer.add(new Konva.Text({ x: x+12, y: y-6, text: circuitNum, fontSize: 7, fill: color, fontFamily: 'Arial' }));
    return;
  }

  if (t === 'fan_exhaust') {
    const r = 11;
    layer.add(new Konva.Circle({ x, y, radius: r, fill: 'white', stroke: color, strokeWidth: 1.5 }));
    // Fan blades — 3 radial lines
    for (let i = 0; i < 3; i++) {
      const angle = (i * 120 * Math.PI) / 180;
      const cx2 = x + Math.cos(angle) * 7, cy2 = y + Math.sin(angle) * 7;
      layer.add(new Konva.Line({ points: [x, y, cx2, cy2], stroke: color, strokeWidth: 1.5 }));
    }
    layer.add(new Konva.Text({ x: x + r + 2, y: y - 5, text: circuitNum, fontSize: 7, fill: color, fontFamily: 'Arial' }));
    return;
  }

  if (t === 'panel') {
    // Panel: filled rectangle with label
    const pw = 18, ph = 12;
    layer.add(new Konva.Rect({ x: x-pw/2, y: y-ph/2, width: pw, height: ph, fill: '#fef3c7', stroke: color, strokeWidth: 1.8 }));
    layer.add(new Konva.Text({ x: x-pw/2+1, y: y-5, text: 'ЩЭ', fontSize: 7, fill: color, fontFamily: 'Arial', fontStyle: 'bold', width: pw-2, align: 'center' }));
    return;
  }

  // Sockets and switches — wall-mounted, draw relative to wall direction
  const wall = sym.wall ?? 'north';
  const isH = wall === 'north' || wall === 'south';

  if (t === 'switch' || t === 'switch_double') {
    // Switch: circle + lever line
    layer.add(new Konva.Circle({ x, y, radius: 5, stroke: color, strokeWidth: 1.5, fill: 'white' }));
    // Lever (perpendicular into room)
    let lvX: number, lvY: number;
    if (wall === 'north')      { lvX = x;    lvY = y + 16; }
    else if (wall === 'south') { lvX = x;    lvY = y - 16; }
    else if (wall === 'west')  { lvX = x+16; lvY = y; }
    else                       { lvX = x-16; lvY = y; }
    layer.add(new Konva.Line({ points: [x, y, lvX, lvY], stroke: color, strokeWidth: 1.8 }));
    // Double switch: extra line
    if (t === 'switch_double') {
      const off = isH ? 5 : 0, offY = isH ? 0 : 5;
      layer.add(new Konva.Line({ points: [x+off, y+offY, lvX+off, lvY+offY], stroke: color, strokeWidth: 1.8 }));
    }
    layer.add(new Konva.Text({ x: x+(isH?6:0), y: y+(isH?0:6), text: circuitNum, fontSize: 7, fill: color, fontFamily: 'Arial' }));
    return;
  }

  // Socket (GOST 21.608): semicircle facing room + two prong marks
  const r = 10;
  // Determine inward direction
  let inX = 0, inY = 0;
  if (wall === 'north') inY = 1; else if (wall === 'south') inY = -1;
  else if (wall === 'west') inX = 1; else inX = -1;

  // Draw half-circle facing into room
  const startAngle = wall === 'north'  ? 0   :
                     wall === 'south'  ? 180 :
                     wall === 'west'   ? 270 :
                     /* east */          90;
  layer.add(new Konva.Arc({
    x, y, innerRadius: 0, outerRadius: r,
    angle: 180, rotation: startAngle,
    fill: 'white', stroke: color, strokeWidth: 1.8,
  }));
  // Wall line
  layer.add(new Konva.Line({
    points: isH
      ? [x-r, y, x+r, y]
      : [x, y-r, x, y+r],
    stroke: color, strokeWidth: 2.2,
  }));
  // Prong marks (inside the semicircle)
  const pLen = 6;
  if (isH) {
    layer.add(new Konva.Line({ points: [x-4, y, x-4, y+inY*pLen], stroke: color, strokeWidth: 1.3 }));
    layer.add(new Konva.Line({ points: [x+4, y, x+4, y+inY*pLen], stroke: color, strokeWidth: 1.3 }));
  } else {
    layer.add(new Konva.Line({ points: [x, y-4, x+inX*pLen, y-4], stroke: color, strokeWidth: 1.3 }));
    layer.add(new Konva.Line({ points: [x, y+4, x+inX*pLen, y+4], stroke: color, strokeWidth: 1.3 }));
  }
  // Waterproof ring
  if (t === 'socket_waterproof') {
    layer.add(new Konva.Circle({ x, y, radius: r+3, stroke: color, strokeWidth: 0.8, dash: [3,2] }));
  }
  // Double socket: extra bump
  if (t === 'socket_double') {
    const ox = isH ? r+2 : 0, oy = isH ? 0 : r+2;
    layer.add(new Konva.Arc({
      x: x+ox, y: y+oy, innerRadius: 0, outerRadius: r,
      angle: 180, rotation: startAngle,
      fill: 'white', stroke: color, strokeWidth: 1.2,
    }));
  }
  // TV socket: TV label instead of prongs
  if (t === 'socket_tv') {
    layer.add(new Konva.Text({ x: x-5, y: y+inY*2-3, text: 'TV', fontSize: 6, fill: color, fontFamily: 'Arial' }));
  }
  layer.add(new Konva.Text({ x: x+(isH?r+3:0), y: y+(isH?0:r+3)-4, text: circuitNum, fontSize: 7, fill: color, fontFamily: 'Arial' }));
}

// ── Legenda ───────────────────────────────────────────────────────────────────
function drawLegend(layer: Konva.Layer, data: ElectricalDrawingData, tH: number) {
  const lx = PAD, ly = tH + PAD + 115;
  const bW = 310, bH = 20 + data.panel.circuits.length * 18 + 10;
  layer.add(new Konva.Rect({ x: lx, y: ly, width: bW, height: bH, fill: 'white', stroke: '#bbb', strokeWidth: 0.8 }));
  layer.add(new Konva.Text({ x: lx+4, y: ly+4, text: 'Guruhlar (sxema)', fontSize: 8.5, fontFamily: 'Arial', fontStyle: 'bold', fill: '#333' }));

  data.panel.circuits.forEach((c, i) => {
    const ry = ly + 18 + i * 18;
    const col = circuitColor(c.id);
    layer.add(new Konva.Rect({ x: lx+4, y: ry+3, width: 18, height: 10, fill: col, cornerRadius: 2 }));
    layer.add(new Konva.Text({ x: lx+26, y: ry+3, text: `${c.id.toUpperCase()}: ${c.name} — ${c.breaker}A, ${c.cable}, ${(c.power/1000).toFixed(1)}кВт${c.hasRcd?' (УЗО)':''}`, fontSize: 8, fontFamily: 'Arial', fill: '#222' }));
  });
}

// ── Shtamp (title block) ──────────────────────────────────────────────────────
function drawTitleBlock(layer: Konva.Layer, tW: number, tH: number) {
  const bW = 220, bH = 80;
  const bx = Math.max(tW + PAD - bW - 5, PAD + 160);
  const by = tH + PAD + 115;
  const date = new Date().toLocaleDateString('uz-UZ');
  const g = new Konva.Group();
  g.add(new Konva.Rect({ x: bx, y: by, width: bW, height: bH, stroke: '#1a1a1a', strokeWidth: 1.5, fill: 'white' }));
  g.add(new Konva.Line({ points: [bx+100, by, bx+100, by+bH], stroke: '#1a1a1a', strokeWidth: 0.8 }));
  [20,40,60].forEach(dy => g.add(new Konva.Line({ points: [bx, by+dy, bx+bW, by+dy], stroke: '#1a1a1a', strokeWidth: 0.8 })));
  const t = (x:number,y:number,text:string,bold=false,size=8) =>
    g.add(new Konva.Text({x,y,text,fontSize:size,fontFamily:'Arial',fontStyle:bold?'bold':'normal',fill:bold?'#1a1a1a':'#555'}));
  t(bx+4, by+4,  'Loyiha nomi');
  t(bx+4, by+22, 'Elektr chizmasi', true, 9);
  t(bx+4, by+44, 'Masshtab');
  t(bx+4, by+54, '1:50', true, 9);
  t(bx+4, by+64, 'GOST 21.608-84');
  t(bx+104, by+4,  'Sana');
  t(bx+104, by+14, date, true, 8);
  t(bx+104, by+44, 'Bosqich');
  t(bx+104, by+54, 'РП', true, 9);
  layer.add(g);
}

// ── Component ─────────────────────────────────────────────────────────────────
const ElectricalCanvas = forwardRef<ElectricalCanvasHandle, { data: ElectricalDrawingData; width?: number }>(
  function ElectricalCanvas({ data, width = 900 }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef     = useRef<Konva.Stage | null>(null);
    const zoomRef      = useRef(1);
    const baseScRef    = useRef(1);
    const [zoom, setZoomState] = useState(1);

    const zoomIn    = useCallback(() => { const s = stageRef.current; if (s) zoomInKonva(s, baseScRef.current, zoomRef, setZoomState); }, []);
    const zoomOut   = useCallback(() => { const s = stageRef.current; if (s) zoomOutKonva(s, baseScRef.current, zoomRef, setZoomState); }, []);
    const resetZoom = useCallback(() => { const s = stageRef.current; if (s) resetKonvaZoom(s, baseScRef.current, zoomRef, setZoomState); }, []);

    useImperativeHandle(ref, () => ({
      exportToPdf(filename = 'electrical.pdf') {
        const stage = stageRef.current; if (!stage) return;
        const savedSc = { x: stage.scaleX(), y: stage.scaleY() }, savedPos = { x: stage.x(), y: stage.y() };
        const bs = baseScRef.current;
        stage.scale({ x: bs, y: bs }); stage.position({ x: 0, y: 0 }); stage.batchDraw();
        const url = stage.toDataURL({ pixelRatio: 3 });
        stage.scale(savedSc); stage.position(savedPos); stage.batchDraw();
        const [iW, iH] = [stage.width(), stage.height()];
        const pdf = new jsPDF({ orientation: iW >= iH ? 'landscape' : 'portrait', unit: 'px', format: [iW, iH] });
        pdf.addImage(url, 'PNG', 0, 0, iW, iH);
        pdf.save(filename);
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;
      stageRef.current?.destroy();
      stageRef.current = null;
      zoomRef.current = 1; setZoomState(1);

      const allX = data.walls.flatMap(w => [w.start.x, w.end.x]);
      const allY = data.walls.flatMap(w => [w.start.y, w.end.y]);
      const minX = allX.length ? Math.min(...allX) : 0;
      const minY = allY.length ? Math.min(...allY) : 0;
      const tW   = allX.length ? Math.max(...allX) - minX : 300;
      const tH   = allY.length ? Math.max(...allY) - minY : 400;

      const contentW = tW + PAD * 2;
      const contentH = tH + PAD * 2 + 210;
      const scale = width / contentW;
      const stageH = Math.ceil(contentH * scale);

      baseScRef.current = scale;
      const stage = new Konva.Stage({ container: containerRef.current, width, height: stageH, scaleX: scale, scaleY: scale });
      stageRef.current = stage;
      const layer = new Konva.Layer();
      stage.add(layer);

      // Background
      layer.add(new Konva.Rect({ x: 0, y: 0, width: contentW, height: contentH, fill: '#f8fafc' }));
      layer.add(new Konva.Rect({ x: PAD + minX, y: PAD + minY, width: tW, height: tH, fill: 'white' }));

      // Grid
      for (let i = 0; i <= contentW; i += GRID)
        for (let j = 0; j <= contentH; j += GRID)
          layer.add(new Konva.Circle({ x: i, y: j, radius: 0.8, fill: C.grid }));

      // Walls
      data.walls.forEach(w => drawWall(layer, w));
      fillCorners(layer, data.walls);

      // Doors + windows
      (data.doors ?? []).forEach(d => drawDoor(layer, d, data.walls));
      (data.windows ?? []).forEach(w => drawWindow(layer, w, data.walls));

      // Build circuit number map: circuitId → short number (C1, C2, ...)
      const circuitNums: Record<string, string> = {};
      data.panel.circuits.forEach((c, i) => { circuitNums[c.id] = `C${i+1}`; });
      circuitNums['panel'] = '';

      // Electrical symbols
      data.symbols.forEach(s => drawSymbol(layer, s, circuitNums[s.circuit] ?? ''));

      // Dimension lines
      data.dimensions.forEach(d => drawDim(layer, d, tW, tH));

      // Legend + title block
      drawLegend(layer, data, tH);
      drawTitleBlock(layer, tW, tH);

      layer.draw();
      const cleanup = setupKonvaZoom(stage, scale, zoomRef, setZoomState);
      return () => { cleanup(); stage.destroy(); stageRef.current = null; };
    }, [data, width]);

    return (
      <div className="flex flex-col border border-gray-300 rounded-lg overflow-hidden w-full">
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
          <span className="text-xs text-slate-400">Elektr chizma · Scroll = zoom · Drag = pan</span>
          <ZoomToolbar zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} />
        </div>
        <div ref={containerRef} className="bg-white w-full overflow-hidden cursor-grab active:cursor-grabbing" />
      </div>
    );
  }
);

export default ElectricalCanvas;
