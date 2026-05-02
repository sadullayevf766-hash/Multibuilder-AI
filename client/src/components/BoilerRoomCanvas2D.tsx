/**
 * BoilerRoomCanvas2D — Qozonxona plani (Konva, yuqoridan ko'rinish)
 * PDF 18-sahifa uslubi: ПЛАН СИСТЕМЫ КОТЕЛЬНОЙ
 */
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Konva from 'konva';
import type { BoilerRoomSchema, BoilerEquipment } from '../../../server/src/engine/BoilerRoomEngine';

export interface BoilerRoom2DHandle { exportToPdf: (filename?: string) => void; }
interface Props { schema: BoilerRoomSchema; }

const BG       = '#ffffff';
const C_WALL   = '#374151';
const C_TEXT   = '#0f172a';
const C_GRID   = '#f1f5f9';
const C_SUPPLY = '#dc2626';
const C_RETURN = '#2563eb';
const C_COLD   = '#0ea5e9';
const C_HOT    = '#f97316';
const C_CIRC   = '#f59e0b';

const COLORS: Record<string, string> = {
  heat_pump_outdoor:      '#064e3b',
  heat_pump_indoor:       '#065f46',
  buffer_tank:            '#1e3a8a',
  boiler_indirect:        '#7c2d12',
  pump_cold:              '#1d4ed8',
  pump_circulation_hvs:   '#d97706',
  pump_circulation_floor: '#b45309',
  filter_mechanical:      '#4b5563',
  filter_softener:        '#6b7280',
  filter_clean:           '#9ca3af',
  expansion_tank_heating: '#b91c1c',
  expansion_tank_hvs:     '#1d4ed8',
  water_meter:            '#0369a1',
  electric_valve:         '#0c4a6e',
  mixing_valve_3way:      '#78350f',
  manifold_supply:        '#991b1b',
  manifold_return:        '#1e40af',
};

const W = 1200;
const H = 900;
const PAD = 60;
const SCALE = 110; // px per meter

const BoilerRoomCanvas2D = forwardRef<BoilerRoom2DHandle, Props>(({ schema }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef     = useRef<Konva.Stage | null>(null);

  useImperativeHandle(ref, () => ({
    exportToPdf(filename = 'qozonxona-plan.pdf') {
      if (!stageRef.current) return;
      const url = stageRef.current.toDataURL({ pixelRatio: 2 });
      import('jspdf').then(({ jsPDF }) => {
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a2' });
        pdf.addImage(url, 'PNG', 10, 10, 400, 270);
        pdf.save(filename);
      });
    },
  }));

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !schema) return;
    if (stageRef.current) { stageRef.current.destroy(); stageRef.current = null; }

    const stage = new Konva.Stage({ container: el, width: W, height: H, draggable: true });
    stageRef.current = stage;
    const layer = new Konva.Layer();
    stage.add(layer);

    // Fon
    layer.add(new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: BG }));

    // Sarlavha
    layer.add(new Konva.Text({
      x: W / 2, y: 14, text: 'QOZONXONA TIZIMI — PLAN (YUQORIDAN KO\'RINISH)',
      fontSize: 14, fontStyle: 'bold', fill: C_TEXT, align: 'center',
    }));
    layer.add(new Konva.Text({
      x: W / 2, y: 32,
      text: `Issiqlik yuki: ${schema.totalHeatKw} kW · ${schema.heatPumpCount}x issiqlik nasosi · ${schema.floors}-qavat bino`,
      fontSize: 9, fill: '#64748b', align: 'center',
    }));

    const originX = PAD + 20;
    const originY = PAD + 55;
    const rW = schema.roomWidthM  * SCALE;
    const rD = schema.roomDepthM  * SCALE;

    // Grid
    for (let gx = 0; gx <= rW; gx += SCALE) {
      layer.add(new Konva.Line({ points: [originX + gx, originY, originX + gx, originY + rD], stroke: C_GRID, strokeWidth: 0.8 }));
    }
    for (let gy = 0; gy <= rD; gy += SCALE) {
      layer.add(new Konva.Line({ points: [originX, originY + gy, originX + rW, originY + gy], stroke: C_GRID, strokeWidth: 0.8 }));
    }

    // Xona devori
    layer.add(new Konva.Rect({ x: originX, y: originY, width: rW, height: rD, fill: 'transparent', stroke: C_WALL, strokeWidth: 3 }));
    // Eshik
    layer.add(new Konva.Arc({ x: originX + 80, y: originY + rD, innerRadius: 0, outerRadius: 60, angle: 90, rotation: -90, fill: '#e2e8f0', stroke: C_WALL, strokeWidth: 1.5 }));
    layer.add(new Konva.Line({ points: [originX + 80, originY + rD, originX + 80, originY + rD - 60], stroke: C_WALL, strokeWidth: 1.5 }));

    // Asboblar
    schema.equipment.forEach(eq => drawEquipment(layer, eq, originX, originY, rW, rD));

    // Quvurlar
    drawPipes(layer, schema, originX, originY, rW, rD);

    // Hajmlar belgisi (o'lchov chiziqlari)
    drawDimensions(layer, originX, originY, rW, rD, schema.roomWidthM, schema.roomDepthM);

    // Legenda
    drawLegend(layer, W, H);

    // Spetsifikatsiya
    drawSpec(layer, schema, W, H);

    layer.draw();

    stage.on('wheel', e => {
      e.evt.preventDefault();
      const sb = 1.08, old = stage.scaleX();
      const ptr = stage.getPointerPosition()!;
      const next = Math.max(0.15, Math.min(5, e.evt.deltaY < 0 ? old * sb : old / sb));
      stage.scale({ x: next, y: next });
      stage.position({ x: ptr.x - (ptr.x - stage.x()) * (next / old), y: ptr.y - (ptr.y - stage.y()) * (next / old) });
    });

    return () => { stage.destroy(); stageRef.current = null; };
  }, [schema]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />;
});

// ── Jihoz chizish ─────────────────────────────────────────────────────────────
function drawEquipment(layer: Konva.Layer, eq: BoilerEquipment, ox: number, oy: number, rW: number, rD: number) {
  const ex = ox + eq.x * rW;
  const ey = oy + eq.y * rD;
  const ew = Math.max(eq.width * SCALE, 28);
  const eh = Math.max(eq.depth * SCALE, 20);
  const color = COLORS[eq.type] ?? '#6b7280';

  // Asos
  layer.add(new Konva.Rect({
    x: ex, y: ey, width: ew, height: eh,
    fill: color + '22', stroke: color, strokeWidth: 1.5, cornerRadius: 3,
  }));

  // Maxsus belgilar
  if (eq.type === 'buffer_tank' || eq.type === 'boiler_indirect') {
    layer.add(new Konva.Circle({ x: ex + ew / 2, y: ey + eh / 2, radius: Math.min(ew, eh) / 2 - 3, fill: color + '33', stroke: color, strokeWidth: 1.5 }));
  }
  if (eq.type.includes('pump')) {
    layer.add(new Konva.Circle({ x: ex + ew / 2, y: ey + eh / 2, radius: Math.min(ew, eh) / 2 - 2, fill: color + '44', stroke: color, strokeWidth: 1.2 }));
    layer.add(new Konva.Line({ points: [ex + ew / 2 - 5, ey + eh / 2, ex + ew / 2 + 5, ey + eh / 2], stroke: color, strokeWidth: 2 }));
    layer.add(new Konva.Line({ points: [ex + ew / 2, ey + eh / 2 - 5, ex + ew / 2, ey + eh / 2 + 5], stroke: color, strokeWidth: 2 }));
  }
  if (eq.type === 'expansion_tank_heating') {
    layer.add(new Konva.Ellipse({ x: ex + ew / 2, y: ey + eh / 2, radiusX: ew / 2 - 3, radiusY: eh / 2 - 3, fill: '#fecaca', stroke: '#dc2626', strokeWidth: 1.5 }));
  }
  if (eq.type === 'expansion_tank_hvs') {
    layer.add(new Konva.Ellipse({ x: ex + ew / 2, y: ey + eh / 2, radiusX: ew / 2 - 3, radiusY: eh / 2 - 3, fill: '#bfdbfe', stroke: '#2563eb', strokeWidth: 1.5 }));
  }

  // Nomi (qisqa)
  const shortName = eq.nameUz.split(' ').slice(0, 3).join('\n');
  layer.add(new Konva.Text({
    x: ex + 2, y: ey + eh + 2, width: ew + 30,
    text: shortName, fontSize: 6, fill: color,
  }));
  // Model
  layer.add(new Konva.Text({
    x: ex + 2, y: ey + 3, width: ew - 4,
    text: eq.model, fontSize: 6, fontStyle: 'bold', fill: color, wrap: 'word',
  }));
}

// ── Quvurlar ──────────────────────────────────────────────────────────────────
function drawPipes(layer: Konva.Layer, schema: BoilerRoomSchema, ox: number, oy: number, rW: number, rD: number) {
  const eqMap = new Map(schema.equipment.map(e => [e.id, e]));

  schema.pipes.forEach(pipe => {
    const from = eqMap.get(pipe.from);
    const to   = eqMap.get(pipe.to);
    if (!from || !to) return;

    const x1 = ox + from.x * rW + from.width * SCALE / 2;
    const y1 = oy + from.y * rD + from.depth * SCALE / 2;
    const x2 = ox + to.x   * rW + to.width   * SCALE / 2;
    const y2 = oy + to.y   * rD + to.depth   * SCALE / 2;

    const colorMap: Record<string, string> = {
      supply: C_SUPPLY, return: C_RETURN, cold: C_COLD, hot: C_HOT, circ: C_CIRC, drain: '#6b7280',
    };
    const c = colorMap[pipe.type] ?? '#94a3b8';

    layer.add(new Konva.Line({
      points: [x1, y1, x1, y2, x2, y2],
      stroke: c, strokeWidth: pipe.diamMm >= 32 ? 2.5 : 1.8, lineCap: 'round', lineJoin: 'round',
    }));
    layer.add(new Konva.Text({
      x: (x1 + x2) / 2 - 10, y: (y1 + y2) / 2 - 8,
      text: `ø${pipe.diamMm}`, fontSize: 6.5, fill: c,
    }));
  });
}

// ── O'lchov chiziqlari ────────────────────────────────────────────────────────
function drawDimensions(layer: Konva.Layer, ox: number, oy: number, rW: number, rD: number, wm: number, dm: number) {
  const dimY = oy + rD + 28;
  layer.add(new Konva.Line({ points: [ox, dimY, ox + rW, dimY], stroke: '#94a3b8', strokeWidth: 1 }));
  layer.add(new Konva.Line({ points: [ox, dimY - 5, ox, dimY + 5], stroke: '#94a3b8', strokeWidth: 1 }));
  layer.add(new Konva.Line({ points: [ox + rW, dimY - 5, ox + rW, dimY + 5], stroke: '#94a3b8', strokeWidth: 1 }));
  layer.add(new Konva.Text({ x: ox + rW / 2 - 20, y: dimY + 4, text: `${wm.toFixed(1)} m`, fontSize: 9, fill: '#64748b' }));

  const dimX = ox - 30;
  layer.add(new Konva.Line({ points: [dimX, oy, dimX, oy + rD], stroke: '#94a3b8', strokeWidth: 1 }));
  layer.add(new Konva.Line({ points: [dimX - 5, oy, dimX + 5, oy], stroke: '#94a3b8', strokeWidth: 1 }));
  layer.add(new Konva.Line({ points: [dimX - 5, oy + rD, dimX + 5, oy + rD], stroke: '#94a3b8', strokeWidth: 1 }));
  layer.add(new Konva.Text({ x: dimX - 22, y: oy + rD / 2 - 8, text: `${dm.toFixed(1)} m`, fontSize: 9, fill: '#64748b', rotation: -90 }));
}

// ── Legenda ───────────────────────────────────────────────────────────────────
function drawLegend(layer: Konva.Layer, W: number, _H: number) {
  const items = [
    { color: C_SUPPLY, label: 'Berilish (issiq)', dash: [] },
    { color: C_RETURN, label: 'Qaytish (sovuq)', dash: [] },
    { color: C_COLD,   label: 'Sovuq suv В1',     dash: [] },
    { color: C_HOT,    label: 'Issiq suv Т3',      dash: [5,2] },
    { color: C_CIRC,   label: 'Sirkul Т4',          dash: [5,2] },
  ];
  const lx = W - 175, ly = 55;
  layer.add(new Konva.Rect({ x: lx - 6, y: ly - 6, width: 172, height: items.length * 18 + 20, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, cornerRadius: 4 }));
  layer.add(new Konva.Text({ x: lx, y: ly, text: 'BELGILAR', fontSize: 8, fontStyle: 'bold', fill: '#0f172a' }));
  items.forEach((item, i) => {
    const iy = ly + 14 + i * 18;
    layer.add(new Konva.Line({ points: [lx, iy + 6, lx + 22, iy + 6], stroke: item.color, strokeWidth: 2, dash: item.dash }));
    layer.add(new Konva.Text({ x: lx + 28, y: iy, text: item.label, fontSize: 9, fill: '#0f172a' }));
  });
}

// ── Spetsifikatsiya ───────────────────────────────────────────────────────────
function drawSpec(layer: Konva.Layer, schema: BoilerRoomSchema, W: number, H: number) {
  const sx = W - 380, sy = H - 200;
  layer.add(new Konva.Rect({ x: sx - 4, y: sy - 4, width: 376, height: 195, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, cornerRadius: 3 }));
  layer.add(new Konva.Text({ x: sx, y: sy, text: 'SPETSIFIKATSIYA', fontSize: 9, fontStyle: 'bold', fill: '#0f172a' }));

  const topItems = schema.specItems.slice(0, 14);
  topItems.forEach((item, i) => {
    const col = i < 7 ? 0 : 1;
    const row = i % 7;
    layer.add(new Konva.Text({
      x: sx + col * 190, y: sy + 14 + row * 24,
      text: `${item.pos}. ${item.nameUz}\n   ${item.model} — ${item.qty} ${item.unit}`,
      fontSize: 7, fill: '#334155', width: 185,
    }));
  });
}

BoilerRoomCanvas2D.displayName = 'BoilerRoomCanvas2D';
export default BoilerRoomCanvas2D;
