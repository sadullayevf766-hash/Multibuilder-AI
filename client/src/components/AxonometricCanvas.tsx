import { useRef, forwardRef, useImperativeHandle, useEffect, useState, useCallback } from 'react';
import Konva from 'konva';
import jsPDF from 'jspdf';
import type { PlumbingSchema, PlumbingPipe, PlumbingFixture } from '../../../shared/types';
import ZoomToolbar from './ZoomToolbar';
import { setupKonvaZoom, resetKonvaZoom, zoomInKonva, zoomOutKonva, MIN_ZOOM, MAX_ZOOM } from '../lib/konvaZoom';

export interface AxonometricCanvasHandle { exportToPdf: (filename?: string) => void; }

// ── Must match PlumbingEngine constants ────────────────────────────────────────
const FLOOR_H  = 240;   // px per floor
const PAD_L    = 130;   // left: floor labels + riser labels
const PAD_R    = 80;    // right: height marks
const PAD_T    = 62;    // top
const PAD_B    = 165;   // bottom: water symbols + legend + title block
const SLAB_H   = 8;     // floor slab visual thickness (px)

const C = {
  cold:  '#2563eb',
  hot:   '#dc2626',
  drain: '#64748b',
  slab:  '#374151',
  dim:   '#94a3b8',
  text:  '#1e293b',
};

const FIXTURE_LABELS: Record<string, string> = {
  sink:            'Lavabo',
  toilet:          'Unitaz',
  bathtub:         'Vanna',
  shower:          'Dush',
  washing_machine: 'Kir yuv.',
};

// ── Coordinate helpers ─────────────────────────────────────────────────────────
// Engine Y=0 at bottom → Canvas Y grows downward
function cX(engineX: number) { return engineX + PAD_L; }
function cY(engineY: number, baseY: number) { return baseY - engineY; }

// ── Draw helpers ───────────────────────────────────────────────────────────────
function line(layer: Konva.Layer, x1: number, y1: number, x2: number, y2: number,
              color: string, sw = 1, dash?: number[]) {
  layer.add(new Konva.Line({ points: [x1, y1, x2, y2], stroke: color, strokeWidth: sw, dash, lineCap: 'round' }));
}

function dot(layer: Konva.Layer, x: number, y: number, color: string, r = 3.5) {
  layer.add(new Konva.Circle({ x, y, radius: r, fill: color }));
}

function label(layer: Konva.Layer, x: number, y: number, text: string, color: string, size = 8, bold = false) {
  layer.add(new Konva.Text({ x, y, text, fontSize: size, fontFamily: 'Arial', fontStyle: bold ? 'bold' : 'normal', fill: color }));
}

// ── Draw pipe with label ───────────────────────────────────────────────────────
function drawPipe(layer: Konva.Layer, pipe: PlumbingPipe, baseY: number, isRiser = false) {
  if (pipe.path.length < 2) return;
  const color   = C[pipe.type as keyof typeof C] ?? '#888';
  const isDrain = pipe.type === 'drain';
  const sw      = isRiser ? 2.5 : isDrain ? 2 : 2;

  const pts = pipe.path.flatMap(p => [cX(p.x), cY(p.y, baseY)]);
  layer.add(new Konva.Line({ points: pts, stroke: color, strokeWidth: sw, dash: isDrain ? [7,5] : undefined, lineCap: 'round', lineJoin: 'round' }));

  // Label placement
  if (pipe.label) {
    const p0 = pipe.path[0], p1 = pipe.path[pipe.path.length - 1];
    const isH = Math.abs(p1.x - p0.x) > Math.abs(p1.y - p0.y);
    const branchLen = p1.x - p0.x;

    // Horizontal branches: stagger labels to land in fixture gaps.
    // cold → 45% (gap between fixture 1 and 2), hot → 70% (gap 3↔4), drain → 40%
    let fracAlong = 0.5;
    if (!isRiser && isH) {
      if (pipe.type === 'cold')       fracAlong = 0.45;
      else if (pipe.type === 'hot')   fracAlong = 0.62;
      else /* drain collector */      fracAlong = 0.40;
    }
    // For vertical pipes / risers: midpoint of longest segment
    let bestSeg = 0;
    if (isRiser || !isH) {
      let maxLen = 0;
      for (let i = 0; i < pipe.path.length - 1; i++) {
        const dx = pipe.path[i+1].x - pipe.path[i].x;
        const dy = pipe.path[i+1].y - pipe.path[i].y;
        const l  = Math.sqrt(dx*dx + dy*dy);
        if (l > maxLen) { maxLen = l; bestSeg = i; }
      }
    }
    const sp = pipe.path[bestSeg], ep = pipe.path[bestSeg + 1] ?? p1;
    const rawX = isH ? (p0.x + branchLen * fracAlong) : (sp.x + ep.x) / 2;
    const rawY = isH ? p0.y : (sp.y + ep.y) / 2;
    const mx = cX(rawX);
    const my = cY(rawY, baseY);

    let lx: number, ly: number;
    if (isRiser) {
      const stagger = pipe.type === 'cold' ? 0 : pipe.type === 'hot' ? 13 : 26;
      lx = mx - 40; ly = my - 6 - stagger;
    } else if (isH) {
      if (pipe.type === 'drain') { lx = mx - 14; ly = my + 4; }
      else { lx = mx - 14; ly = pipe.type === 'hot' ? my + 5 : my - 14; }
    } else {
      // vertical drop: place label to the right, offset toward upper half
      lx = mx + 5; ly = my - 5;
    }
    layer.add(new Konva.Text({ x: lx, y: ly, text: pipe.label, fontSize: 8, fontFamily: 'Arial', fill: color }));
  }
}

// ── Draw fixture ───────────────────────────────────────────────────────────────
function drawFixture(layer: Konva.Layer, f: PlumbingFixture, baseY: number, hasCold: boolean, hasHot: boolean) {
  const fx = cX(f.position.x);
  const fy = cY(f.position.y, baseY);
  const w  = 65, h = 30;

  // Box
  layer.add(new Konva.Rect({ x: fx - w/2, y: fy - h, width: w, height: h, fill: '#f8fafc', stroke: '#334155', strokeWidth: 1.5, cornerRadius: 3 }));
  layer.add(new Konva.Text({ x: fx - w/2, y: fy - h/2 - 5, width: w, text: FIXTURE_LABELS[f.type] ?? f.type, fontSize: 8.5, fontFamily: 'Arial', fill: '#1e293b', align: 'center' }));

  // Cold water connection dot (at branch line)
  if (hasCold) dot(layer, fx, fy, C.cold);
  // Hot water connection dot (slightly below cold branch — COLD_Y_OFF vs HOT_Y_OFF diff = 16px)
  if (hasHot && f.type !== 'toilet') dot(layer, fx, fy + 16, C.hot, 3);
}

// ── Component ─────────────────────────────────────────────────────────────────
const AxonometricCanvas = forwardRef<AxonometricCanvasHandle, { schema: PlumbingSchema; width?: number }>(
  function AxonometricCanvas({ schema, width = 900 }, ref) {
    const mountRef   = useRef<HTMLDivElement>(null);
    const stageRef   = useRef<Konva.Stage | null>(null);
    const zoomRef    = useRef(1);
    const baseScRef  = useRef(1);
    const [zoom, setZoomState] = useState(1);

    const zoomIn  = useCallback(() => { const s = stageRef.current; if (s) zoomInKonva(s, baseScRef.current, zoomRef, setZoomState); }, []);
    const zoomOut = useCallback(() => { const s = stageRef.current; if (s) zoomOutKonva(s, baseScRef.current, zoomRef, setZoomState); }, []);
    const resetZoom = useCallback(() => { const s = stageRef.current; if (s) resetKonvaZoom(s, baseScRef.current, zoomRef, setZoomState); }, []);

    useImperativeHandle(ref, () => ({
      exportToPdf(filename = 'plumbing-schema.pdf') {
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
      if (!mountRef.current) return;
      stageRef.current?.destroy(); stageRef.current = null;

      zoomRef.current = 1; baseScRef.current = 1; setZoomState(1);

      if (!schema?.fixtures?.length) {
        const s = new Konva.Stage({ container: mountRef.current!, width, height: 200 });
        stageRef.current = s;
        const l = new Konva.Layer(); s.add(l);
        l.add(new Konva.Text({ x: width/2 - 60, y: 90, text: "Ma'lumot yo'q", fontSize: 14, fill: '#888' }));
        l.draw();
        return () => { s.destroy(); stageRef.current = null; };
      }

      const fc      = schema.floorCount;
      const totalEH = fc * FLOOR_H;
      const canvasH = PAD_T + totalEH + PAD_B;
      const baseY   = PAD_T + totalEH;   // engine Y=0 maps to this canvas Y

      const stage = new Konva.Stage({ container: mountRef.current!, width, height: canvasH });
      stageRef.current = stage;
      const layer = new Konva.Layer();
      stage.add(layer);

      // Background
      layer.add(new Konva.Rect({ x: 0, y: 0, width, height: canvasH, fill: '#ffffff' }));

      // Title
      layer.add(new Konva.Text({ x: 0, y: 16, width, text: "Suv ta'minoti sxemasi (Aksonometrik)", fontSize: 13, fontFamily: 'Arial', fontStyle: 'bold', fill: '#111', align: 'center' }));

      // ── Floor slabs + labels + height marks ──────────────────────────────────
      const drawAreaRight = width - PAD_R;

      for (let f = 0; f <= fc; f++) {
        const lineY = cY(f * FLOOR_H, baseY);

        // Solid floor slab (black rectangle)
        layer.add(new Konva.Rect({
          x: PAD_L - 10, y: lineY - SLAB_H / 2,
          width: drawAreaRight - PAD_L + 20, height: SLAB_H,
          fill: C.slab, opacity: f === 0 ? 0.85 : 0.7,
        }));

        // Height mark on right side: ±0.000 at floor 0, +3.000 at floor 1 etc.
        const heightM = f * 3.0;
        const markText = f === 0 ? '±0.000' : `+${heightM.toFixed(3)}`;
        layer.add(new Konva.Text({
          x: drawAreaRight + 4, y: lineY - 7,
          text: markText, fontSize: 9, fontFamily: 'Arial', fill: '#374151',
        }));

        // Floor label (centred in the floor band)
        if (f < fc) {
          const midY = cY(f * FLOOR_H + FLOOR_H / 2, baseY);
          label(layer, 4, midY - 7, `${f + 1}-qavat`, '#475569', 10, true);
        }
      }

      // Underground / subfloor dashed line
      const subY = cY(-FLOOR_H / 4, baseY);
      line(layer, PAD_L - 10, subY, drawAreaRight, subY, '#94a3b8', 1, [4, 3]);
      label(layer, 4, subY - 6, 'Zamin', '#94a3b8', 9);

      // ── Risers ─────────────────────────────────────────────────────────────────
      // Extend risers slightly below ground
      const riserTopY    = PAD_T - 12;
      const riserBottomY = cY(0, baseY) + 20;

      for (const riser of schema.risers) {
        const color = C[riser.type as keyof typeof C] ?? '#888';
        const rx    = cX(riser.path[0].x);

        // Riser line (full height)
        layer.add(new Konva.Line({
          points: [rx, riserTopY, rx, riserBottomY],
          stroke: color, strokeWidth: 2.5,
          dash: riser.type === 'drain' ? [8, 5] : undefined,
          lineCap: 'round',
        }));

        // Riser top label: Х / Г / К
        const name = riser.type === 'cold' ? 'Х' : riser.type === 'hot' ? 'Г' : 'К';
        layer.add(new Konva.Text({
          x: rx - 6, y: riserTopY - 20,
          text: name, fontSize: 13, fontFamily: 'Arial', fontStyle: 'bold', fill: color,
        }));

        // Riser diameter label (once, near top)
        const staggerY = riser.type === 'cold' ? 0 : riser.type === 'hot' ? 14 : 28;
        label(layer, rx - 42, riserTopY + 5 + staggerY, riser.label, color, 8);
      }

      // ── Branch pipes ─────────────────────────────────────────────────────────
      const drains = schema.pipes.filter(p => p.type === 'drain');
      const hots   = schema.pipes.filter(p => p.type === 'hot');
      const colds  = schema.pipes.filter(p => p.type === 'cold');

      for (const p of drains) drawPipe(layer, p, baseY, false);
      for (const p of hots)   drawPipe(layer, p, baseY, false);
      for (const p of colds)  drawPipe(layer, p, baseY, false);

      // ── Fixtures ───────────────────────────────────────────────────────────────
      const hasHotMap = new Map<number, boolean>();
      schema.pipes
        .filter(p => p.type === 'hot' && p.id.startsWith('hot-branch-'))
        .forEach(p => {
          const floor = parseInt(p.id.replace('hot-branch-', ''));
          hasHotMap.set(floor, true);
        });

      for (const f of schema.fixtures) {
        drawFixture(layer, f, baseY, true, hasHotMap.get(f.floor) ?? false);
      }

      // ── Legend (draw before symbols so white bg doesn't cover them) ───────────
      const lx = PAD_L;
      const ly = baseY + 68;
      layer.add(new Konva.Rect({ x: lx - 6, y: ly - 6, width: 195, height: 76, fill: 'white', stroke: '#e2e8f0', strokeWidth: 1, cornerRadius: 4 }));
      [
        { color: C.cold,  label: 'Sovuq suv (Х)',     dash: false },
        { color: C.hot,   label: 'Issiq suv (Г)',      dash: false },
        { color: C.drain, label: 'Kanalizatsiya (К)',  dash: true  },
      ].forEach(({ color, label: lbl, dash }, i) => {
        const y = ly + i * 22 + 6;
        layer.add(new Konva.Line({ points: [lx, y, lx + 28, y], stroke: color, strokeWidth: 2, dash: dash ? [7,5] : undefined }));
        layer.add(new Konva.Text({ x: lx + 34, y: y - 6, text: lbl, fontSize: 9, fontFamily: 'Arial', fill: '#334155' }));
      });

      // ── Water input symbols (drawn after legend so they appear on top) ────────
      const coldRx  = cX(0);
      const hotRx   = cX(50);
      const inputY  = riserBottomY + 2;

      // Cold water meter symbol (circle with crossbar)
      const meterR = 8;
      const mY = inputY + meterR + 6;
      layer.add(new Konva.Circle({ x: coldRx, y: mY, radius: meterR, stroke: C.cold, strokeWidth: 1.5, fill: 'white' }));
      layer.add(new Konva.Line({ points: [coldRx - meterR + 2, mY, coldRx + meterR - 2, mY], stroke: C.cold, strokeWidth: 1 }));
      layer.add(new Konva.Text({ x: coldRx - 22, y: mY + meterR + 3, text: 'Vodoschyot', fontSize: 7.5, fontFamily: 'Arial', fill: C.cold }));

      // Hot water boiler triangle
      const bY = inputY + 6;
      layer.add(new Konva.Line({ points: [hotRx, bY, hotRx - 9, bY + 16, hotRx + 9, bY + 16], closed: true, stroke: C.hot, strokeWidth: 1.5, fill: '#fff5f5' }));
      layer.add(new Konva.Text({ x: hotRx - 20, y: bY + 19, text: 'Suv isitgich', fontSize: 7.5, fontFamily: 'Arial', fill: C.hot }));

      // ── GOST title block ───────────────────────────────────────────────────────
      const bW = 225, bH = 82;
      const bx = width - bW - 20;
      const by = baseY + 68;
      const date = new Date().toLocaleDateString('uz-UZ');

      layer.add(new Konva.Rect({ x: bx, y: by, width: bW, height: bH, stroke: '#334155', strokeWidth: 1.5, fill: 'white' }));
      layer.add(new Konva.Line({ points: [bx+112, by, bx+112, by+bH], stroke: '#334155', strokeWidth: 0.8 }));
      [21, 42, 62].forEach(dy => layer.add(new Konva.Line({ points: [bx, by+dy, bx+bW, by+dy], stroke: '#334155', strokeWidth: 0.8 })));

      const t = (x: number, y: number, text: string, bold = false, sz = 8) =>
        layer.add(new Konva.Text({ x, y, text, fontSize: sz, fontFamily: 'Arial', fontStyle: bold ? 'bold' : 'normal', fill: bold ? '#111' : '#555' }));

      t(bx+4, by+4,   'Loyiha nomi');
      t(bx+4, by+23,  "Suv ta'minoti sxemasi", true, 9);
      t(bx+4, by+45,  'Masshtab');
      t(bx+4, by+55,  '1:50', true, 9);
      t(bx+4, by+65,  'SNiP 2.04.01-85', false, 7.5);
      t(bx+116, by+4,  'Sana');
      t(bx+116, by+15, date, true, 8);
      t(bx+116, by+45, 'Bosqich');
      t(bx+116, by+55, 'РП', true, 9);

      layer.draw();
      baseScRef.current = 1; // AxonometricCanvas doesn't pre-scale
      const cleanup = setupKonvaZoom(stage, 1, zoomRef, setZoomState);
      return () => { cleanup(); stageRef.current?.destroy(); stageRef.current = null; };
    }, [schema, width]);

    return (
      <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden w-full">
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
          <span className="text-xs text-slate-400">Santexnika sxemasi · Scroll = zoom · Drag = pan</span>
          <ZoomToolbar zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} />
        </div>
        <div ref={mountRef} className="bg-white w-full overflow-hidden cursor-grab active:cursor-grabbing" />
      </div>
    );
  }
);

export default AxonometricCanvas;
