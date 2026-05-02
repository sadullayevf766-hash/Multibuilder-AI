import { useRef, useEffect, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import ZoomToolbar from './ZoomToolbar';
import { setupKonvaZoom, resetKonvaZoom, zoomInKonva, zoomOutKonva, MIN_ZOOM, MAX_ZOOM } from '../lib/konvaZoom';
import Konva from 'konva';
import jsPDF from 'jspdf';
import type { DecorSchema, DecorFurniture, DecorOpening, WallSide } from '../../../shared/types';

export interface DecorCanvas2DHandle { exportToPdf: (filename?: string) => void; }

const PAD_L = 80, PAD_R = 60, PAD_T = 72, PAD_B = 130;
const WALL_T = 9;   // wall thickness px

const STYLE_NAMES: Record<string, string> = {
  modern: 'Zamonaviy', classic: 'Klassik', minimalist: 'Minimalist',
  scandinavian: 'Skandinaviya', industrial: 'Industrial',
};

const FLOOR_NAMES: Record<string, string> = {
  parquet: 'Parket', tile: 'Kafel', carpet: 'Gilam', laminate: 'Laminat',
};

// Darken a hex color slightly for stroke
function darken(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - 48);
  const g = Math.max(0, ((n >> 8)  & 0xff) - 48);
  const b = Math.max(0, (n & 0xff)        - 48);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// Room coords → canvas coords (N=up on paper, canvas Y inverted)
function rx(engineX: number, S: number) { return PAD_L + WALL_T + engineX * S; }
function ry(engineY: number, L: number, S: number) { return PAD_T + WALL_T + (L - engineY) * S; }

// ── Wall opening helper: returns sorted gaps on a wall ───────────────────────
function openingsOnWall(openings: DecorOpening[], wall: WallSide) {
  return openings.filter(o => o.wall === wall).sort((a, b) => a.offset - b.offset);
}

// ── Draw one wall with openings carved out ────────────────────────────────────
function drawWall(
  layer: Konva.Layer,
  x1: number, y1: number, x2: number, y2: number,
  openings: Array<{ start: number; end: number }>,   // in px along wall
  wallLen: number,                                    // px total
  wallColor: string,
) {
  // Sort openings
  const sorted = [...openings].sort((a, b) => a.start - b.start);
  let cursor = 0;
  const dx = (x2 - x1) / wallLen, dy = (y2 - y1) / wallLen;

  const drawSegment = (from: number, to: number) => {
    if (to <= from) return;
    layer.add(new Konva.Line({
      points: [
        x1 + dx * from, y1 + dy * from,
        x1 + dx * to,   y1 + dy * to,
      ],
      stroke: wallColor, strokeWidth: WALL_T,
      lineCap: 'round',
    }));
  };

  for (const op of sorted) {
    drawSegment(cursor, op.start);
    cursor = op.end;
  }
  drawSegment(cursor, wallLen);
}

// ── Draw furniture item ───────────────────────────────────────────────────────
function drawFurniture(layer: Konva.Layer, f: DecorFurniture, L: number, S: number) {
  const cx = rx(f.position.x, S);
  const cy = ry(f.position.y + f.size.d, L, S);
  const fw = f.size.w * S;
  const fh = f.size.d * S;

  const isLight = parseInt(f.color.slice(1, 3), 16) > 180;
  const textCol = isLight ? '#334155' : '#F8FAFC';

  // Shadow
  layer.add(new Konva.Rect({ x: cx + 2, y: cy + 2, width: fw, height: fh, fill: 'rgba(0,0,0,0.10)', cornerRadius: 4 }));
  // Fill
  layer.add(new Konva.Rect({ x: cx, y: cy, width: fw, height: fh, fill: f.color, stroke: darken(f.color), strokeWidth: 1.2, cornerRadius: 4 }));

  // Furniture-specific inner detail
  const cx2 = cx + fw / 2, cy2 = cy + fh / 2;
  if (f.type === 'sofa' || f.type === 'armchair') {
    // backrest line at top
    layer.add(new Konva.Rect({ x: cx + 2, y: cy + 2, width: fw - 4, height: fh * 0.28, fill: darken(f.color), cornerRadius: 3 }));
    // seat cushion divisions
    const cushions = f.type === 'sofa' ? 3 : 1;
    for (let i = 1; i < cushions; i++) {
      const lx = cx + (fw / cushions) * i;
      layer.add(new Konva.Line({ points: [lx, cy + fh * 0.30, lx, cy + fh - 2], stroke: darken(f.color), strokeWidth: 1 }));
    }
  } else if (f.type === 'bed_double' || f.type === 'bed_single') {
    // headboard
    layer.add(new Konva.Rect({ x: cx + 2, y: cy + 2, width: fw - 4, height: fh * 0.18, fill: darken(darken(f.color)), cornerRadius: 3 }));
    // pillow(s)
    const pillowW = f.type === 'bed_double' ? fw / 2 - 8 : fw - 12;
    const count = f.type === 'bed_double' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      layer.add(new Konva.Rect({ x: cx + 6 + i * (pillowW + 4), y: cy + fh * 0.20 + 3, width: pillowW, height: fh * 0.18, fill: '#f0f0f0', stroke: '#ccc', strokeWidth: 0.8, cornerRadius: 3 }));
    }
  } else if (f.type === 'dining_table') {
    // Table top outline
    layer.add(new Konva.Rect({ x: cx + 4, y: cy + 4, width: fw - 8, height: fh - 8, stroke: darken(f.color), strokeWidth: 1, cornerRadius: 2 }));
  } else if (f.type === 'tv_stand') {
    // TV screen rectangle
    const tvW = fw * 0.75, tvH = fh * 0.55;
    layer.add(new Konva.Rect({ x: cx2 - tvW/2, y: cy2 - tvH/2, width: tvW, height: tvH, fill: '#1a1a2e', stroke: '#333', strokeWidth: 1, cornerRadius: 2 }));
  } else if (f.type === 'bookshelf' || f.type === 'bookcase') {
    // Shelf lines
    const shelves = Math.max(2, Math.floor(fh / 20));
    for (let i = 1; i < shelves; i++) {
      const sy = cy + (fh / shelves) * i;
      layer.add(new Konva.Line({ points: [cx + 2, sy, cx + fw - 2, sy], stroke: darken(f.color), strokeWidth: 1 }));
    }
  } else if (f.type === 'rug') {
    // Rug pattern (border + cross)
    layer.add(new Konva.Rect({ x: cx + 5, y: cy + 5, width: fw - 10, height: fh - 10, stroke: darken(f.color), strokeWidth: 1.5, cornerRadius: 2 }));
    layer.add(new Konva.Line({ points: [cx + 5, cy2, cx + fw - 5, cy2], stroke: darken(f.color), strokeWidth: 0.8 }));
    layer.add(new Konva.Line({ points: [cx2, cy + 5, cx2, cy + fh - 5], stroke: darken(f.color), strokeWidth: 0.8 }));
  }

  // Label (only if large enough)
  if (fw > 28 && fh > 14) {
    layer.add(new Konva.Text({
      x: cx + 2, y: cy2 - 7, width: fw - 4,
      text: f.label, fontSize: Math.min(10, fw / 5, fh / 2),
      fontFamily: 'Arial', fill: textCol, align: 'center',
    }));
  }
}

// ── Draw door arc ─────────────────────────────────────────────────────────────
function drawDoor(layer: Konva.Layer, o: DecorOpening, roomW: number, roomL: number, S: number) {
  const dW = o.width * S;
  switch (o.wall) {
    case 'south': {
      const hx = rx(o.offset, S), hy = ry(0, roomL, S) + WALL_T;
      layer.add(new Konva.Line({ points: [hx, hy, hx + dW, hy], stroke: '#374151', strokeWidth: 0.8, dash: [2, 2] }));
      layer.add(new Konva.Arc({ x: hx, y: hy, innerRadius: 0, outerRadius: dW, angle: 90, rotation: -90, stroke: '#374151', strokeWidth: 0.8, fill: 'rgba(200,220,255,0.18)' }));
      break;
    }
    case 'north': {
      const hx = rx(o.offset, S), hy = ry(roomL, roomL, S) - WALL_T;
      layer.add(new Konva.Line({ points: [hx, hy, hx + dW, hy], stroke: '#374151', strokeWidth: 0.8, dash: [2, 2] }));
      layer.add(new Konva.Arc({ x: hx, y: hy, innerRadius: 0, outerRadius: dW, angle: 90, rotation: 0, stroke: '#374151', strokeWidth: 0.8, fill: 'rgba(200,220,255,0.18)' }));
      break;
    }
    case 'west': {
      const hx = rx(0, S) - WALL_T, hy = ry(o.offset + o.width, roomL, S);
      layer.add(new Konva.Line({ points: [hx, hy, hx, hy + dW], stroke: '#374151', strokeWidth: 0.8, dash: [2, 2] }));
      layer.add(new Konva.Arc({ x: hx, y: hy, innerRadius: 0, outerRadius: dW, angle: 90, rotation: 90, stroke: '#374151', strokeWidth: 0.8, fill: 'rgba(200,220,255,0.18)' }));
      break;
    }
    case 'east': {
      const hx = rx(roomW, S) + WALL_T, hy = ry(o.offset + o.width, roomL, S);
      layer.add(new Konva.Line({ points: [hx, hy, hx, hy + dW], stroke: '#374151', strokeWidth: 0.8, dash: [2, 2] }));
      layer.add(new Konva.Arc({ x: hx, y: hy, innerRadius: 0, outerRadius: dW, angle: 90, rotation: -180, stroke: '#374151', strokeWidth: 0.8, fill: 'rgba(200,220,255,0.18)' }));
      break;
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
const DecorCanvas2D = forwardRef<DecorCanvas2DHandle, { schema: DecorSchema; width?: number }>(
  function DecorCanvas2D({ schema, width = 900 }, ref) {
    const mountRef  = useRef<HTMLDivElement>(null);
    const stageRef  = useRef<Konva.Stage | null>(null);
    const zoomRef   = useRef(1);
    const baseScRef = useRef(1);
    const [zoom, setZoomState] = useState(1);

    const zoomIn    = useCallback(() => { const s = stageRef.current; if (s) zoomInKonva(s, baseScRef.current, zoomRef, setZoomState); }, []);
    const zoomOut   = useCallback(() => { const s = stageRef.current; if (s) zoomOutKonva(s, baseScRef.current, zoomRef, setZoomState); }, []);
    const resetZoom = useCallback(() => { const s = stageRef.current; if (s) resetKonvaZoom(s, baseScRef.current, zoomRef, setZoomState); }, []);

    useImperativeHandle(ref, () => ({
      exportToPdf(filename = 'decor-plan.pdf') {
        const s = stageRef.current; if (!s) return;
        const savedSc = { x: s.scaleX(), y: s.scaleY() }, savedPos = { x: s.x(), y: s.y() };
        const bs = baseScRef.current;
        s.scale({ x: bs, y: bs }); s.position({ x: 0, y: 0 }); s.batchDraw();
        const url = s.toDataURL({ pixelRatio: 3 });
        s.scale(savedSc); s.position(savedPos); s.batchDraw();
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [s.width(), s.height()] });
        pdf.addImage(url, 'PNG', 0, 0, s.width(), s.height());
        pdf.save(filename);
      },
    }));

    useEffect(() => {
      if (!mountRef.current) return;
      stageRef.current?.destroy(); stageRef.current = null;
      zoomRef.current = 1; setZoomState(1);

      const { roomWidth: W, roomLength: L, furniture, openings, material } = schema;

      // Auto-scale to fit canvas width
      const drawW = width - PAD_L - PAD_R - WALL_T * 2;
      const drawH = (drawW / W) * L;
      const S = drawW / W;          // px per meter
      const canvasH = PAD_T + drawH + WALL_T * 2 + PAD_B;

      baseScRef.current = 1;
      const stage = new Konva.Stage({ container: mountRef.current!, width, height: canvasH });
      stageRef.current = stage;
      const layer = new Konva.Layer();
      stage.add(layer);

      // Background
      layer.add(new Konva.Rect({ x: 0, y: 0, width, height: canvasH, fill: '#F0F0ED' }));

      // Title
      layer.add(new Konva.Text({
        x: 0, y: 14, width, text: `${schema.roomName} — Dizayn Loyihasi   (${STYLE_NAMES[schema.style] ?? schema.style} uslub)`,
        fontSize: 14, fontFamily: 'Arial', fontStyle: 'bold', fill: '#1e293b', align: 'center',
      }));
      layer.add(new Konva.Text({
        x: 0, y: 32, width, text: `${W.toFixed(1)} × ${L.toFixed(1)} m   |   Pol: ${FLOOR_NAMES[material.floorType]}`,
        fontSize: 10, fontFamily: 'Arial', fill: '#64748b', align: 'center',
      }));

      // Room floor fill
      layer.add(new Konva.Rect({
        x: rx(0, S), y: ry(L, L, S),
        width: W * S, height: L * S,
        fill: material.floorColor, opacity: 0.22,
      }));

      // Accent wall (north) — full height band inside
      if (material.accentWall === 'north') {
        layer.add(new Konva.Rect({
          x: rx(0, S), y: ry(L, L, S), width: W * S, height: L * S * 0.04,
          fill: material.accentColor, opacity: 0.45,
        }));
      }

      // Compute door/window gaps in wall pixels
      const getWallGaps = (wall: WallSide, wallLen: number) =>
        openingsOnWall(openings, wall).map(o => ({
          start: o.offset * S,
          end: (o.offset + o.width) * S,
        }));

      // Draw walls with openings
      const roomTop   = ry(L, L, S);
      const roomBot   = ry(0, L, S);
      const roomLeft  = rx(0, S);
      const roomRight = rx(W, S);
      const wallCol   = '#2D3748';

      drawWall(layer, roomLeft, roomBot,  roomRight, roomBot,  getWallGaps('south', W*S), W*S, wallCol); // south
      drawWall(layer, roomLeft, roomTop,  roomRight, roomTop,  getWallGaps('north', W*S), W*S, wallCol); // north
      drawWall(layer, roomLeft, roomTop,  roomLeft,  roomBot,  getWallGaps('west',  L*S), L*S, wallCol); // west
      drawWall(layer, roomRight, roomTop, roomRight, roomBot,  getWallGaps('east',  L*S), L*S, wallCol); // east

      // Window markers (triple line on wall)
      for (const o of openings.filter(op => op.type === 'window')) {
        const oS = o.offset * S, oE = (o.offset + o.width) * S;
        const winCol = '#4A90D9';
        const drawWinMark = (x1: number, y1: number, x2: number, y2: number) => {
          for (let i = -1; i <= 1; i++) {
            const off = i * 2.5;
            layer.add(new Konva.Line({ points: [x1 + off, y1 + off, x2 + off, y2 + off], stroke: winCol, strokeWidth: 1.5 }));
          }
        };
        switch (o.wall) {
          case 'north': drawWinMark(roomLeft + oS, roomTop, roomLeft + oE, roomTop); break;
          case 'south': drawWinMark(roomLeft + oS, roomBot, roomLeft + oE, roomBot); break;
          case 'west':  drawWinMark(roomLeft, roomBot - oS, roomLeft, roomBot - oE); break;
          case 'east':  drawWinMark(roomRight, roomBot - oS, roomRight, roomBot - oE); break;
        }
      }

      // Doors
      for (const o of openings.filter(op => op.type === 'door')) {
        drawDoor(layer, o, W, L, S);
      }

      // Rug first (drawn under other furniture)
      for (const f of furniture.filter(f => f.type === 'rug')) drawFurniture(layer, f, L, S);
      // Then regular furniture
      for (const f of furniture.filter(f => f.type !== 'rug')) drawFurniture(layer, f, L, S);

      // ── Dimension lines (outside room) ─────────────────────────────────────
      const dimCol = '#64748b';
      const dimOff = WALL_T + 18;

      // Width dimension (top)
      const dimY = roomTop - dimOff;
      layer.add(new Konva.Line({ points: [roomLeft, dimY, roomRight, dimY], stroke: dimCol, strokeWidth: 1 }));
      [roomLeft, roomRight].forEach(x => layer.add(new Konva.Line({ points: [x, dimY - 5, x, dimY + 5], stroke: dimCol, strokeWidth: 1 })));
      layer.add(new Konva.Text({ x: roomLeft, y: dimY - 16, width: W * S, text: `${W.toFixed(1)} m`, fontSize: 10, fontFamily: 'Arial', fill: dimCol, align: 'center' }));

      // Length dimension (left)
      const dimX = roomLeft - dimOff;
      layer.add(new Konva.Line({ points: [dimX, roomTop, dimX, roomBot], stroke: dimCol, strokeWidth: 1 }));
      [roomTop, roomBot].forEach(y => layer.add(new Konva.Line({ points: [dimX - 5, y, dimX + 5, y], stroke: dimCol, strokeWidth: 1 })));
      layer.add(new Konva.Text({ x: dimX - 32, y: roomTop, height: L * S, text: `${L.toFixed(1)} m`, fontSize: 10, fontFamily: 'Arial', fill: dimCol, align: 'center', verticalAlign: 'middle', rotation: -90 }));

      // North arrow (top-right)
      const nax = width - PAD_R - 20, nay = PAD_T + 10;
      layer.add(new Konva.Arrow({ points: [nax, nay + 22, nax, nay + 4], stroke: '#334155', strokeWidth: 2, fill: '#334155', pointerLength: 8, pointerWidth: 7 }));
      layer.add(new Konva.Text({ x: nax - 4, y: nay - 4, text: 'N', fontSize: 13, fontFamily: 'Arial', fontStyle: 'bold', fill: '#334155' }));

      // ── Materials palette (bottom-left) ─────────────────────────────────────
      const bly = canvasH - PAD_B + 14;
      layer.add(new Konva.Rect({ x: PAD_L - 6, y: bly - 6, width: 230, height: 78, fill: 'white', stroke: '#e2e8f0', strokeWidth: 1, cornerRadius: 4 }));
      layer.add(new Konva.Text({ x: PAD_L, y: bly, text: 'Materiallar va ranglar:', fontSize: 10, fontFamily: 'Arial', fontStyle: 'bold', fill: '#334155' }));

      const swatches = [
        { label: `Devor: ${material.wallColor}`,  color: material.wallColor  },
        { label: `Pol: ${FLOOR_NAMES[material.floorType]}`, color: material.floorColor },
        { label: `Aksent: ${material.accentColor}`, color: material.accentColor },
      ];
      swatches.forEach(({ label, color }, i) => {
        const sy = bly + 18 + i * 20;
        layer.add(new Konva.Rect({ x: PAD_L, y: sy, width: 18, height: 14, fill: color, stroke: '#ccc', strokeWidth: 1, cornerRadius: 2 }));
        layer.add(new Konva.Text({ x: PAD_L + 24, y: sy + 1, text: label, fontSize: 9, fontFamily: 'Arial', fill: '#475569' }));
      });

      // ── GOST title block ─────────────────────────────────────────────────────
      const tbW = 240, tbH = 82;
      const tbx = width - tbW - 20, tby = canvasH - PAD_B + 14;
      layer.add(new Konva.Rect({ x: tbx, y: tby, width: tbW, height: tbH, stroke: '#334155', strokeWidth: 1.5, fill: 'white' }));
      layer.add(new Konva.Line({ points: [tbx + 118, tby, tbx + 118, tby + tbH], stroke: '#334155', strokeWidth: 0.8 }));
      [22, 44, 64].forEach(dy => layer.add(new Konva.Line({ points: [tbx, tby + dy, tbx + tbW, tby + dy], stroke: '#334155', strokeWidth: 0.8 })));

      const t = (x: number, y: number, text: string, bold = false, sz = 8) =>
        layer.add(new Konva.Text({ x, y, text, fontSize: sz, fontFamily: 'Arial', fontStyle: bold ? 'bold' : 'normal', fill: bold ? '#111' : '#555' }));
      t(tbx + 4, tby + 4, 'Xona nomi');
      t(tbx + 4, tby + 24, schema.roomName, true, 9);
      t(tbx + 4, tby + 47, 'Uslub');
      t(tbx + 4, tby + 57, STYLE_NAMES[schema.style] ?? schema.style, true, 9);
      t(tbx + 4, tby + 67, 'Masshtab: 1:50', false, 8);
      t(tbx + 122, tby + 4, 'Sana');
      t(tbx + 122, tby + 15, new Date().toLocaleDateString('uz-UZ'), true, 8);
      t(tbx + 122, tby + 44, 'Maydon');
      t(tbx + 122, tby + 55, `${(W * L).toFixed(1)} m²`, true, 9);

      layer.draw();
      const cleanup = setupKonvaZoom(stage, 1, zoomRef, setZoomState);
      return () => { cleanup(); stageRef.current?.destroy(); stageRef.current = null; };
    }, [schema, width]);

    return (
      <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden w-full">
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
          <span className="text-xs text-slate-400">Interer dizayn · Scroll = zoom · Drag = pan</span>
          <ZoomToolbar zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} />
        </div>
        <div ref={mountRef} className="bg-white w-full overflow-hidden cursor-grab active:cursor-grabbing" />
      </div>
    );
  },
);

export default DecorCanvas2D;
