import { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import Konva from 'konva';
import jsPDF from 'jspdf';
import type { PlumbingSchema, PlumbingPipe, PlumbingFixture } from '../../../shared/types';

export interface AxonometricCanvasHandle {
  exportToPdf: (filename?: string) => void;
}

interface AxonometricCanvasProps {
  schema: PlumbingSchema;
  width?: number;
}

// ── Constants (must match PlumbingEngine) ─────────────────────────────────────
const FLOOR_H  = 220;   // pixels per floor — same as PlumbingEngine FLOOR_HEIGHT
const PAD_L    = 110;   // left padding (floor labels + riser labels)
const PAD_T    = 55;    // top padding
const PAD_B    = 130;   // bottom padding (legend + title block)

// Pipe colors
const COLORS: Record<string, string> = {
  cold:  '#3b82f6',  // blue
  hot:   '#ef4444',  // red
  drain: '#94a3b8',  // slate
};

const FIXTURE_LABELS: Record<string, string> = {
  sink:            'Lavabo',
  toilet:          'Unitaz',
  bathtub:         'Vanna',
  shower:          'Dush',
  washing_machine: 'Kir yuv.',
};

// ── Coordinate conversion ─────────────────────────────────────────────────────
// Engine: Y=0 at bottom, increases upward
// Canvas: Y=0 at top, increases downward
// canvasY = baseY - engineY   (baseY = PAD_T + floorCount * FLOOR_H)
function cx(engineX: number, offX: number) { return engineX + offX; }
function cy(engineY: number, baseY: number) { return baseY - engineY; }

// ── Draw pipe ─────────────────────────────────────────────────────────────────
function drawPipe(
  layer: Konva.Layer,
  pipe: PlumbingPipe,
  offX: number,
  baseY: number,
  isRiser = false,
) {
  if (pipe.path.length < 2) return;
  const color   = COLORS[pipe.type] ?? '#888';
  const isDrain = pipe.type === 'drain';
  const sw      = isDrain ? 2.5 : 2;

  const pts = pipe.path.flatMap(p => [cx(p.x, offX), cy(p.y, baseY)]);

  layer.add(new Konva.Line({
    points: pts,
    stroke: color,
    strokeWidth: sw,
    dash: isDrain ? [8, 5] : undefined,
    lineCap: 'round',
    lineJoin: 'round',
  }));

  // Diameter label placement:
  // - Risers: label to the LEFT of the riser line
  // - Horizontal branches: label ABOVE the line
  // - Vertical drain drops: label to the RIGHT
  if (pipe.label && pipe.path.length >= 2) {
    const n   = pipe.path.length;
    const mid = Math.floor(n / 2);
    const p0  = pipe.path[mid - 1] ?? pipe.path[0];
    const p1  = pipe.path[mid];
    const mx  = cx((p0.x + p1.x) / 2, offX);
    const my  = cy((p0.y + p1.y) / 2, baseY);
    const isH = Math.abs(p1.x - p0.x) > Math.abs(p1.y - p0.y);

    let lx: number, ly: number;
    if (isRiser) {
      // Riser: label to the left, staggered by pipe type to avoid overlap
      const stagger = pipe.type === 'cold' ? 0 : pipe.type === 'hot' ? 12 : 24;
      lx = mx - 36;
      ly = my - 6 - stagger;
    } else if (isH) {
      // Horizontal branch: cold above line, hot below line
      const isHot = pipe.type === 'hot';
      lx = mx - 14;
      ly = isHot ? my + 4 : my - 13;
    } else {
      // Vertical drain drop: label to the right
      lx = mx + 4;
      ly = my - 6;
    }

    layer.add(new Konva.Text({
      x: lx, y: ly,
      text: pipe.label,
      fontSize: 8,
      fontFamily: 'Arial',
      fill: color,
    }));
  }
}

// ── Draw fixture box ──────────────────────────────────────────────────────────
function drawFixture(
  layer: Konva.Layer,
  fixture: PlumbingFixture,
  offX: number,
  baseY: number,
) {
  const fx = cx(fixture.position.x, offX);
  const fy = cy(fixture.position.y, baseY);
  const w = 52, h = 28;

  layer.add(new Konva.Rect({
    x: fx - w / 2, y: fy - h,
    width: w, height: h,
    fill: '#f8fafc', stroke: '#334155', strokeWidth: 1.5, cornerRadius: 3,
  }));
  layer.add(new Konva.Text({
    x: fx - w / 2, y: fy - h + 8,
    width: w,
    text: FIXTURE_LABELS[fixture.type] ?? fixture.type,
    fontSize: 8, fontFamily: 'Arial', fill: '#1e293b', align: 'center',
  }));
  // Connection dot
  layer.add(new Konva.Circle({ x: fx, y: fy, radius: 3, fill: COLORS.cold }));
}

// ── Component ─────────────────────────────────────────────────────────────────
const AxonometricCanvas = forwardRef<AxonometricCanvasHandle, AxonometricCanvasProps>(
  function AxonometricCanvas({ schema, width = 900 }, ref) {
    const mountRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage | null>(null);

    useImperativeHandle(ref, () => ({
      exportToPdf(filename = 'plumbing-schema.pdf') {
        const stage = stageRef.current;
        if (!stage) return;
        const dataUrl = stage.toDataURL({ pixelRatio: 3 });
        const iW = stage.width(), iH = stage.height();
        const pdf = new jsPDF({ orientation: iW >= iH ? 'landscape' : 'portrait', unit: 'px', format: [iW, iH] });
        pdf.addImage(dataUrl, 'PNG', 0, 0, iW, iH);
        pdf.save(filename);
      },
    }));

    useEffect(() => {
      if (!mountRef.current) return;
      if (stageRef.current) { stageRef.current.destroy(); stageRef.current = null; }

      if (!schema?.fixtures?.length) {
        const stage = new Konva.Stage({ container: mountRef.current, width, height: 200 });
        stageRef.current = stage;
        const layer = new Konva.Layer();
        stage.add(layer);
        layer.add(new Konva.Text({ x: width / 2 - 60, y: 90, text: "Ma'lumot yo'q", fontSize: 14, fill: '#888' }));
        layer.draw();
        return () => { stage.destroy(); stageRef.current = null; };
      }

      const fc      = schema.floorCount;
      const totalEH = fc * FLOOR_H;                    // total engine height
      const canvasH = PAD_T + totalEH + PAD_B;

      // offX: engine X=0 → canvas X=PAD_L
      const offX  = PAD_L;
      // baseY: engine Y=0 → canvas Y = PAD_T + totalEH
      const baseY = PAD_T + totalEH;

      const stage = new Konva.Stage({ container: mountRef.current, width, height: canvasH });
      stageRef.current = stage;
      const layer = new Konva.Layer();
      stage.add(layer);

      // Background
      layer.add(new Konva.Rect({ x: 0, y: 0, width, height: canvasH, fill: 'white' }));

      // Title
      layer.add(new Konva.Text({
        x: 0, y: 14, width,
        text: "Suv ta'minoti sxemasi",
        fontSize: 13, fontFamily: 'Arial', fontStyle: 'bold', fill: '#111', align: 'center',
      }));

      // Floor lines + labels
      for (let f = 0; f <= fc; f++) {
        const lineY = cy(f * FLOOR_H, baseY);
        layer.add(new Konva.Line({
          points: [PAD_L - 8, lineY, width - 30, lineY],
          stroke: '#cbd5e1', strokeWidth: 0.8, dash: [6, 4],
        }));
        if (f < fc) {
          const midY = cy(f * FLOOR_H + FLOOR_H / 2, baseY);
          layer.add(new Konva.Text({
            x: 4, y: midY - 7,
            text: `${f + 1}-qavat`,
            fontSize: 10, fontFamily: 'Arial', fill: '#475569',
          }));
        }
      }

      // Risers (draw first — behind branches)
      for (const riser of schema.risers) {
        drawPipe(layer, riser, offX, baseY, true);
      }

      // Branch pipes: drain first (behind), then hot, then cold (on top)
      const drains = schema.pipes.filter(p => p.type === 'drain');
      const hots   = schema.pipes.filter(p => p.type === 'hot');
      const colds  = schema.pipes.filter(p => p.type === 'cold');

      for (const p of drains) drawPipe(layer, p, offX, baseY, false);
      for (const p of hots)   drawPipe(layer, p, offX, baseY, false);
      for (const p of colds)  drawPipe(layer, p, offX, baseY, false);

      // Fixtures (on top of pipes)
      for (const f of schema.fixtures) drawFixture(layer, f, offX, baseY);

      // Riser top labels (Х / Г / К)
      for (const riser of schema.risers) {
        const rx    = cx(riser.path[0].x, offX);
        const color = COLORS[riser.type] ?? '#888';
        const name  = riser.type === 'cold' ? 'Х' : riser.type === 'hot' ? 'Г' : 'К';
        layer.add(new Konva.Text({
          x: rx - 6, y: PAD_T - 18,
          text: name, fontSize: 12, fontFamily: 'Arial', fontStyle: 'bold', fill: color,
        }));
      }

      // Legend
      const lx = PAD_L;
      const ly = baseY + 18;
      const legendItems = [
        { color: COLORS.cold,  label: 'Sovuq suv (Х)',    dashed: false },
        { color: COLORS.hot,   label: 'Issiq suv (Г)',     dashed: false },
        { color: COLORS.drain, label: 'Kanalizatsiya (К)', dashed: true  },
      ];
      layer.add(new Konva.Rect({
        x: lx - 8, y: ly - 8, width: 200, height: 72,
        fill: 'white', stroke: '#e2e8f0', strokeWidth: 1, cornerRadius: 4,
      }));
      legendItems.forEach(({ color, label, dashed }, i) => {
        const y = ly + i * 20 + 6;
        layer.add(new Konva.Line({ points: [lx, y, lx + 28, y], stroke: color, strokeWidth: 2, dash: dashed ? [8, 5] : undefined }));
        layer.add(new Konva.Text({ x: lx + 34, y: y - 6, text: label, fontSize: 9, fontFamily: 'Arial', fill: '#334155' }));
      });

      // GOST title block
      const bW = 220, bH = 80;
      const bx = width - bW - 30;
      const by = baseY + 18;
      const date = new Date().toLocaleDateString('uz-UZ');

      layer.add(new Konva.Rect({ x: bx, y: by, width: bW, height: bH, stroke: '#334155', strokeWidth: 1.5, fill: 'white' }));
      layer.add(new Konva.Line({ points: [bx + 110, by, bx + 110, by + bH], stroke: '#334155', strokeWidth: 0.8 }));
      [20, 40, 60].forEach(dy =>
        layer.add(new Konva.Line({ points: [bx, by + dy, bx + bW, by + dy], stroke: '#334155', strokeWidth: 0.8 }))
      );

      const t = (x: number, y: number, text: string, bold = false, size = 8) =>
        layer.add(new Konva.Text({ x, y, text, fontSize: size, fontFamily: 'Arial', fontStyle: bold ? 'bold' : 'normal', fill: bold ? '#111' : '#555' }));

      t(bx + 4, by + 4,  'Loyiha nomi');
      t(bx + 4, by + 22, "Suv ta'minoti sxemasi", true, 9);
      t(bx + 4, by + 44, 'Masshtab');
      t(bx + 4, by + 54, '1:50', true, 9);
      t(bx + 4, by + 64, 'SNiP 2.04.01-85');
      t(bx + 114, by + 4,  'Sana');
      t(bx + 114, by + 14, date, true, 8);
      t(bx + 114, by + 44, 'Bosqich');
      t(bx + 114, by + 54, 'РП', true, 9);

      layer.draw();
      return () => { stage.destroy(); stageRef.current = null; };
    }, [schema, width]);

    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden w-full">
        <div ref={mountRef} className="bg-white w-full" />
      </div>
    );
  }
);

export default AxonometricCanvas;
