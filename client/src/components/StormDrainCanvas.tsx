/**
 * StormDrainCanvas — Ливнёвка 2D sxemasi (Konva)
 * PDF (Xumson ОВиК) 15-sahifa uslubi
 * - ø110 tarmoqlar (ko'k-yashil)
 * - ø160 magistral (to'q ko'k)
 * - Trap simvollari (tom, balkon, terras)
 * - Qiya ko'rsatkichlari i=1%, i=2%
 */
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Konva from 'konva';
import type { StormDrainSchema, StormFloor } from '../../../server/src/engine/StormDrainEngine';

export interface StormDrainCanvasHandle {
  exportToPdf: (filename?: string) => void;
}
interface Props { schema: StormDrainSchema; activeFloor: number; }

const C110      = '#0ea5e9';  // ø110 tarmoq
const C160      = '#1d4ed8';  // ø160 magistral
const TRAP_CLR  = '#0891b2';  // trap simvoli
const WALL_CLR  = '#94a3b8';
const TEXT_CLR  = '#0f172a';
const BG_CLR    = '#ffffff';
const MARGIN    = 70;

const StormDrainCanvas = forwardRef<StormDrainCanvasHandle, Props>(({ schema, activeFloor }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef     = useRef<Konva.Stage | null>(null);

  useImperativeHandle(ref, () => ({
    exportToPdf(filename = 'livnevka.pdf') {
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

    const floor = schema.floors.find(f => f.floorNumber === activeFloor) ?? schema.floors[0];
    if (!floor) return;

    const W = el.clientWidth  || 960;
    const H = el.clientHeight || 620;

    const stage = new Konva.Stage({ container: el, width: W, height: H, draggable: true });
    stageRef.current = stage;
    const layer = new Konva.Layer();
    stage.add(layer);

    // Fon
    layer.add(new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: BG_CLR }));

    // Sarlavha
    const title = `YOMG'IR SUVI TIZIMI (LIVNYOVKA) — ${floor.floorNumber}-QAVAT`;
    layer.add(new Konva.Text({ x: W / 2, y: 18, text: title, fontSize: 14, fontStyle: 'bold', fill: TEXT_CLR, align: 'center', offsetX: 0 }));
    const sub = `${schema.totalTraps} trap · q=${schema.totalFlowLps} л/с · Magistral ø${schema.mainDiamMm} i=${schema.mainSlopePct}% · ${schema.outletTag}`;
    layer.add(new Konva.Text({ x: W / 2, y: 36, text: sub, fontSize: 9, fill: '#475569', align: 'center' }));

    drawFloor(layer, schema, floor, W, H);
    drawLegend(layer, schema, W, H);
    drawNotes(layer, schema, W, H);

    layer.draw();

    // Zoom
    stage.on('wheel', e => {
      e.evt.preventDefault();
      const sb = 1.08, old = stage.scaleX();
      const ptr = stage.getPointerPosition()!;
      const next = Math.max(0.25, Math.min(6, e.evt.deltaY < 0 ? old * sb : old / sb));
      stage.scale({ x: next, y: next });
      stage.position({ x: ptr.x - (ptr.x - stage.x()) * (next / old), y: ptr.y - (ptr.y - stage.y()) * (next / old) });
    });

    return () => { stage.destroy(); stageRef.current = null; };
  }, [schema, activeFloor]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />;
});

StormDrainCanvas.displayName = 'StormDrainCanvas';
export default StormDrainCanvas;

// ── Trap simvoli ──────────────────────────────────────────────────────────────
function trapSymbol(type: string): string {
  const M: Record<string, string> = {
    roof: '⛆', balcony: '🏠', terrace: '◻', parking: '⊕', yard: '○',
  };
  return M[type] || '⛆';
}

function trapFill(type: string): string {
  const M: Record<string, string> = {
    roof: '#e0f2fe', balcony: '#dbeafe', terrace: '#ede9fe', parking: '#fef3c7', yard: '#dcfce7',
  };
  return M[type] || '#e0f2fe';
}

// ── Asosiy chizma ──────────────────────────────────────────────────────────────
function drawFloor(layer: Konva.Layer, schema: StormDrainSchema, floor: StormFloor, W: number, H: number) {
  const traps = floor.traps;
  if (!traps.length) return;

  const cols   = Math.max(2, Math.ceil(Math.sqrt(traps.length)));
  const cellW  = (W - MARGIN * 2 - 160) / cols;
  const cellH  = (H - 120) / Math.ceil(traps.length / cols);

  // Magistral quvur (pastki gorizontal chiziq)
  const magY = H - 48;
  layer.add(new Konva.Line({ points: [MARGIN, magY, W - 180, magY], stroke: C160, strokeWidth: 4 }));
  layer.add(new Konva.Text({ x: MARGIN + 4, y: magY - 13, text: `Magistral ø${schema.mainDiamMm} · i=${schema.mainSlopePct}% → ${schema.outletTag}`, fontSize: 9, fill: C160, fontStyle: 'bold' }));

  // Stoyaklar
  const floorRisers = schema.risers.filter(rs => rs.floors.includes(floor.floorNumber));
  const riserXBase = MARGIN;
  floorRisers.forEach((rs, ri) => {
    const rx = riserXBase + (ri + 1) * (W - MARGIN * 2 - 160) / (floorRisers.length + 1);
    // Vertikal stoyak
    layer.add(new Konva.Line({ points: [rx, 58, rx, magY], stroke: rs.diamMm === 160 ? C160 : C110, strokeWidth: rs.diamMm === 160 ? 3 : 2 }));
    layer.add(new Konva.Text({ x: rx + 3, y: (58 + magY) / 2, text: `${rs.tag}\nø${rs.diamMm}`, fontSize: 8, fill: rs.diamMm === 160 ? C160 : C110, fontStyle: 'bold' }));
    // Magistralga ulanish nuqtasi
    layer.add(new Konva.Circle({ x: rx, y: magY, radius: 5, fill: C160, stroke: 'white', strokeWidth: 1 }));
  });

  // Traplar
  traps.forEach((trap, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const tx = MARGIN + col * cellW + 12;
    const ty = 60 + row * cellH + 12;
    const tw = cellW - 24;
    const th = cellH - 24;

    // Trap kartasi
    layer.add(new Konva.Rect({ x: tx, y: ty, width: tw, height: th, fill: trapFill(trap.type), stroke: TRAP_CLR, strokeWidth: 1.5, cornerRadius: 6 }));

    // Trap raqami (PDF 15 pozitsiya: 3-12)
    layer.add(new Konva.Circle({ x: tx + 14, y: ty + 14, radius: 11, fill: TRAP_CLR }));
    layer.add(new Konva.Text({ x: tx + 7, y: ty + 8, text: String(trap.number), fontSize: 9, fontStyle: 'bold', fill: 'white' }));

    // Trap nomi
    layer.add(new Konva.Text({ x: tx + 28, y: ty + 7, text: trap.nameRu, fontSize: 8, fontStyle: 'bold', fill: TEXT_CLR }));
    layer.add(new Konva.Text({ x: tx + 28, y: ty + 17, text: `${trap.areaM2} m²`, fontSize: 8, fill: '#64748b' }));

    // Simvol
    layer.add(new Konva.Text({ x: tx + tw / 2 - 8, y: ty + th / 2 - 10, text: trapSymbol(trap.type), fontSize: 20, fill: TRAP_CLR }));

    // Oqim qiymati
    layer.add(new Konva.Text({ x: tx + 4, y: ty + th - 22, text: `q=${trap.flowLps} л/с`, fontSize: 8, fill: C110, fontStyle: 'bold' }));
    layer.add(new Konva.Text({ x: tx + 4, y: ty + th - 12, text: `ø${trap.branchDiam} i=2%`, fontSize: 8, fill: WALL_CLR }));

    // Stoyakka ulash chizig'i
    const riser = schema.risers.find(rs => rs.tag === trap.riserTag);
    if (riser) {
      const ri = schema.risers.indexOf(riser);
      const rx = riserXBase + (ri + 1) * (W - MARGIN * 2 - 160) / (floorRisers.length + 1);
      const brY = ty + th + 4;
      // Trap pastiga tushuvchi tarmoq
      layer.add(new Konva.Line({ points: [tx + tw / 2, ty + th, tx + tw / 2, brY, rx, brY], stroke: C110, strokeWidth: 1.5, dash: [5, 2] }));
      // Qiya belgisi
      layer.add(new Konva.Text({ x: (tx + tw / 2 + rx) / 2 - 12, y: brY - 10, text: 'i=2%', fontSize: 7, fill: '#64748b' }));
    }
  });
}

// ── Legenda ───────────────────────────────────────────────────────────────────
function drawLegend(layer: Konva.Layer, schema: StormDrainSchema, W: number, H: number) {
  const items = [
    { color: C110,     label: 'Tarmoq ø110 · i=2%',    dash: false },
    { color: C160,     label: `Magistral ø${schema.mainDiamMm} · i=${schema.mainSlopePct}%`, dash: false },
    { color: TRAP_CLR, label: 'Tom / balkon trapi',    dash: true  },
  ];
  const lx = W - 155, ly = H - 70;
  layer.add(new Konva.Rect({ x: lx - 6, y: ly - 6, width: 152, height: items.length * 18 + 14, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, cornerRadius: 4 }));
  items.forEach((item, i) => {
    const opts: Konva.LineConfig = { points: [lx, ly + i * 18 + 6, lx + 22, ly + i * 18 + 6], stroke: item.color, strokeWidth: 2 };
    if (item.dash) opts.dash = [4, 3];
    layer.add(new Konva.Line(opts));
    layer.add(new Konva.Text({ x: lx + 28, y: ly + i * 18, text: item.label, fontSize: 9, fill: TEXT_CLR }));
  });
}

// ── Eslatmalar ────────────────────────────────────────────────────────────────
function drawNotes(layer: Konva.Layer, schema: StormDrainSchema, W: number, _H: number) {
  const nx = W - 155, ny = 58;
  layer.add(new Konva.Rect({ x: nx - 6, y: ny - 4, width: 152, height: Math.min(schema.notes.length, 5) * 14 + 12, fill: '#f0f9ff', stroke: '#bae6fd', strokeWidth: 1, cornerRadius: 4 }));
  schema.notes.slice(0, 5).forEach((note, i) => {
    layer.add(new Konva.Text({ x: nx, y: ny + i * 14, text: note.slice(0, 26), fontSize: 7.5, fill: '#0369a1' }));
  });
}
