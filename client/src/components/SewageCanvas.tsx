/**
 * SewageCanvas — Kanalizatsiya 2D sxemasi (Konva)
 * К1 stoyaklar ø110 (qo'ng'ir), ø50 tarmoqlar (kulrang)
 * PDF (Xumson ОВиК) 10-12-sahifalar uslubida
 */

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Konva from 'konva';
import type { SewageSchema, SewageFloor } from '../../../server/src/engine/SewageEngine';

export interface SewageCanvasHandle {
  exportToPdf: (filename?: string) => void;
}

interface Props {
  schema: SewageSchema;
  activeFloor: number;
}

const RISER_COLOR   = '#92400e'; // ø110 — to'q jigarrang
const BRANCH_110    = '#b45309'; // ø110 tarmoq
const BRANCH_50     = '#6b7280'; // ø50 tarmoq
const WALL_COLOR    = '#94a3b8';
const TEXT_COLOR    = '#1e293b';
const BG_COLOR      = '#ffffff';
const REVISION_CLR  = '#1d4ed8';

const MARGIN = 80;

const SewageCanvas = forwardRef<SewageCanvasHandle, Props>(({ schema, activeFloor }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef     = useRef<Konva.Stage | null>(null);

  useImperativeHandle(ref, () => ({
    exportToPdf(filename = 'sewage.pdf') {
      if (!stageRef.current) return;
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
      import('jspdf').then(({ jsPDF }) => {
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a2' });
        pdf.addImage(dataUrl, 'PNG', 10, 10, 400, 270);
        pdf.save(filename);
      });
    },
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !schema) return;

    if (stageRef.current) { stageRef.current.destroy(); stageRef.current = null; }

    const floor = schema.floors.find(f => f.floorNumber === activeFloor) ?? schema.floors[0];
    if (!floor) return;

    const W = container.clientWidth  || 900;
    const H = container.clientHeight || 600;

    const stage = new Konva.Stage({ container, width: W, height: H, draggable: true });
    stageRef.current = stage;
    const layer = new Konva.Layer();
    stage.add(layer);

    layer.add(new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: BG_COLOR }));

    drawTitle(layer, schema, floor, W);
    drawFloor(layer, schema, floor, W, H);
    drawSpec(layer, schema, W, H);
    drawLegend(layer, W, H);

    layer.draw();

    // Zoom
    stage.on('wheel', e => {
      e.evt.preventDefault();
      const scaleBy = 1.08;
      const old = stage.scaleX();
      const ptr = stage.getPointerPosition()!;
      const next = Math.max(0.3, Math.min(5, e.evt.deltaY < 0 ? old * scaleBy : old / scaleBy));
      stage.scale({ x: next, y: next });
      stage.position({ x: ptr.x - (ptr.x - stage.x()) * (next / old), y: ptr.y - (ptr.y - stage.y()) * (next / old) });
    });

    return () => { stage.destroy(); stageRef.current = null; };
  }, [schema, activeFloor]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />;
});

SewageCanvas.displayName = 'SewageCanvas';
export default SewageCanvas;

// ── Helpers ───────────────────────────────────────────────────────────────────

function drawTitle(layer: Konva.Layer, schema: SewageSchema, floor: SewageFloor, W: number) {
  const title = `KANALIZATSIYA SXEMASI — ${floor.floorNumber}-QAVAT`;
  layer.add(new Konva.Text({ x: W / 2, y: 18, text: title, fontSize: 14, fontStyle: 'bold', fill: TEXT_COLOR, align: 'center' }));
  const sub = `${schema.totalFixtures} jihoz · ${schema.totalRisers} stoyak К1 ø110 · Qiya: ø50→3sm/m, ø110→2sm/m`;
  layer.add(new Konva.Text({ x: W / 2, y: 36, text: sub, fontSize: 9, fill: '#64748b', align: 'center' }));
}

function drawFloor(layer: Konva.Layer, schema: SewageSchema, floor: SewageFloor, W: number, H: number) {
  const wetRooms = floor.rooms.filter(r => r.fixtures.length > 0);
  if (!wetRooms.length) return;

  const cols = Math.ceil(Math.sqrt(wetRooms.length));
  const cellW = (W - MARGIN * 2 - 200) / cols;   // reserve right 200px for spec
  const cellH = (H - 120) / Math.ceil(wetRooms.length / cols);

  // Draw risers as vertical lines behind rooms
  const floorRisers = schema.risers.filter(rs => rs.floors.includes(floor.floorNumber));
  floorRisers.forEach((rs, i) => {
    const rx = MARGIN + (i + 1) * (W - MARGIN * 2 - 200) / (floorRisers.length + 1);
    layer.add(new Konva.Line({ points: [rx, 60, rx, H - 40], stroke: RISER_COLOR, strokeWidth: 3 }));
    layer.add(new Konva.Text({ x: rx - 18, y: H - 36, text: `${rs.tag}\nø110`, fontSize: 8, fill: RISER_COLOR, fontStyle: 'bold', align: 'center' }));
    // Ventilation label
    layer.add(new Konva.Text({ x: rx - 25, y: 48, text: rs.ventTag, fontSize: 7, fill: '#94a3b8', rotation: -90 }));
  });

  wetRooms.forEach((room, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const rx = MARGIN + col * cellW + 10;
    const ry = 70 + row * cellH + 10;
    const rw = cellW - 20;
    const rh = cellH - 20;

    // Room box
    layer.add(new Konva.Rect({ x: rx, y: ry, width: rw, height: rh, fill: '#f8fafc', stroke: WALL_COLOR, strokeWidth: 1.5, cornerRadius: 4 }));
    layer.add(new Konva.Text({ x: rx + 6, y: ry + 6, text: room.name, fontSize: 9, fontStyle: 'bold', fill: TEXT_COLOR }));
    layer.add(new Konva.Text({ x: rx + 6, y: ry + 17, text: `${room.area} m²`, fontSize: 8, fill: '#64748b' }));

    // Fixtures
    room.fixtures.forEach((fix, fi) => {
      const fx = rx + 15 + fi * 30;
      const fy = ry + rh - 30;
      const color = fix.pipeDiam === 110 ? BRANCH_110 : BRANCH_50;
      const diam = `ø${fix.pipeDiam}`;

      // Fixture symbol
      layer.add(new Konva.Rect({ x: fx - 6, y: fy - 6, width: 12, height: 12, fill: color, opacity: 0.15, stroke: color, strokeWidth: 1, cornerRadius: 2 }));
      // Drain pipe going down with slope indicator
      layer.add(new Konva.Line({ points: [fx, fy + 6, fx, ry + rh + 5], stroke: color, strokeWidth: fix.pipeDiam === 110 ? 2.5 : 1.5 }));
      layer.add(new Konva.Text({ x: fx - 8, y: fy + 8, text: diam, fontSize: 7, fill: color }));
      // Slope label
      layer.add(new Konva.Text({ x: fx + 3, y: fy - 14, text: `${fix.slope}%`, fontSize: 7, fill: '#94a3b8' }));
    });

    // Revision luchok
    const rev = floor.revisions.find(r => room.fixtures[0]?.riserTag === r.riserTag);
    if (rev) {
      layer.add(new Konva.Rect({ x: rx + rw - 28, y: ry + 6, width: 22, height: 14, fill: 'transparent', stroke: REVISION_CLR, strokeWidth: 1, dash: [3, 2] }));
      layer.add(new Konva.Text({ x: rx + rw - 26, y: ry + 10, text: '400×400\nлюк', fontSize: 6, fill: REVISION_CLR }));
    }

    // Branch pipe to riser (horizontal)
    const branch = floor.branches.find(b => b.roomId === room.id);
    if (branch) {
      const riser = schema.risers.find(rs => rs.id === branch.riserId);
      if (riser) {
        const riserX = MARGIN + (schema.risers.indexOf(riser) + 1) * (W - MARGIN * 2 - 200) / (schema.risers.length + 1);
        const branchY = ry + rh - 10;
        const color = branch.diamMm === 110 ? BRANCH_110 : BRANCH_50;
        layer.add(new Konva.Line({ points: [rx + rw / 2, branchY, riserX, branchY], stroke: color, strokeWidth: branch.diamMm === 110 ? 2 : 1.5, dash: [5, 2] }));
        layer.add(new Konva.Text({ x: (rx + rw / 2 + riserX) / 2 - 10, y: branchY - 10, text: `ø${branch.diamMm}\ni=${branch.slope}%`, fontSize: 7, fill: color }));
      }
    }
  });

  // Main outlet
  layer.add(new Konva.Line({ points: [MARGIN, H - 40, W - 220, H - 40], stroke: RISER_COLOR, strokeWidth: 3 }));
  layer.add(new Konva.Text({ x: W / 3, y: H - 35, text: `${schema.pitTag} · ø110 · i=2%`, fontSize: 9, fill: RISER_COLOR }));
}

function drawSpec(layer: Konva.Layer, schema: SewageSchema, W: number, H: number) {
  const sx = W - 190;
  const sy = 60;
  layer.add(new Konva.Rect({ x: sx - 4, y: sy - 4, width: 190, height: Math.min(schema.specItems.length * 16 + 28, H - 80), fill: '#fafafa', stroke: '#e2e8f0', strokeWidth: 1, cornerRadius: 4 }));
  layer.add(new Konva.Text({ x: sx + 4, y: sy + 4, text: 'SPETSIFIKATSIYA', fontSize: 9, fontStyle: 'bold', fill: TEXT_COLOR }));
  schema.specItems.slice(0, 20).forEach((item, i) => {
    const iy = sy + 20 + i * 16;
    layer.add(new Konva.Text({ x: sx + 4, y: iy, text: `${item.pos}. ${item.nameRu.slice(0, 22)}`, fontSize: 7.5, fill: TEXT_COLOR }));
    layer.add(new Konva.Text({ x: sx + 155, y: iy, text: `${item.qty}${item.unit}`, fontSize: 7.5, fill: '#64748b', align: 'right' }));
  });
}

function drawLegend(layer: Konva.Layer, W: number, H: number) {
  const items = [
    { color: RISER_COLOR, label: 'К1 — Stoyak ø110' },
    { color: BRANCH_110,  label: 'Tarmoq ø110 (unitaz/vanna)', dash: true },
    { color: BRANCH_50,   label: 'Tarmoq ø50 (lavabo/dush)', dash: true },
    { color: REVISION_CLR,label: 'Reviziya 400×400mm' },
  ];
  const lx = 10;
  const ly = H - 80;
  layer.add(new Konva.Rect({ x: lx - 4, y: ly - 4, width: 220, height: items.length * 18 + 12, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, cornerRadius: 4 }));
  items.forEach((item, i) => {
    const opts: Konva.LineConfig = { points: [lx, ly + i * 18 + 6, lx + 24, ly + i * 18 + 6], stroke: item.color, strokeWidth: 2 };
    if (item.dash) opts.dash = [5, 3];
    layer.add(new Konva.Line(opts));
    layer.add(new Konva.Text({ x: lx + 30, y: ly + i * 18, text: item.label, fontSize: 9, fill: TEXT_COLOR }));
  });
}
