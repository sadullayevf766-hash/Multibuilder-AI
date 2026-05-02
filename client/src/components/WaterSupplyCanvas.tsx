/**
 * WaterSupplyCanvas — Suv ta'minoti 2D sxemasi (Konva)
 * В1 sovuq (ko'k), Т3 issiq (qizil), Т4 sirkul (sariq)
 * Professional quvur sxemasi: stoyaklar, tarmoqlar, jixozlar, o'lchamlar
 */
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Konva from 'konva';
import type { WaterSupplySchema, WaterFloor } from '../../../server/src/engine/WaterSupplyEngine';

export interface WaterSupplyCanvasHandle {
  exportToPdf: (filename?: string) => void;
}

interface Props {
  schema: WaterSupplySchema;
  activeFloor: number;
}

// ── Ranglar ───────────────────────────────────────────────────────────────────
const C_COLD    = '#1d6db5'; // В1 — sovuq, to'q ko'k
const C_HOT     = '#c0392b'; // Т3 — issiq, to'q qizil
const C_CIRC    = '#d97706'; // Т4 — sirkul, to'q sariq
const C_WALL    = '#475569'; // devor
const C_TEXT    = '#1e293b'; // asosiy matn
const C_DIM     = '#64748b'; // o'lcham matn
const C_BG      = '#ffffff';
const C_ROOM_BG = '#f8fafc';
const C_GRID    = '#e2e8f0';

// ── O'lchamlar ────────────────────────────────────────────────────────────────
const TITLE_H  = 56;   // yuqori sarlavha balandligi
const MARGIN_X = 60;
const MARGIN_Y = 70;
const STAMP_H  = 45;   // pastki shtamp
const ROOM_PAD = 12;   // xona ichidagi chegara
const FIX_R    = 10;   // jihoz doira radiusi
const PIPE_W_MAIN  = 3;
const PIPE_W_RISER = 2;
const PIPE_W_BRANCH = 1.5;

// Jihoz nomi va rangi
const FIX_LABELS: Record<string, string> = {
  toilet: 'WC', sink: 'Раковина', shower: 'Душ', bathtub: 'Ванна',
  towel_rail: 'Полотенц.', washing_machine: 'Стиралка', dishwasher: 'Посудом.',
  tap: 'Кран', floor_drain: 'Трап', bidet: 'Биде',
};
const FIX_SHORT: Record<string, string> = {
  toilet: 'WC', sink: 'Р', shower: 'Д', bathtub: 'В',
  towel_rail: 'П', washing_machine: 'СМ', dishwasher: 'ПМ',
  tap: 'К', floor_drain: 'Т', bidet: 'Б',
};

const WaterSupplyCanvas = forwardRef<WaterSupplyCanvasHandle, Props>(
  ({ schema, activeFloor }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef     = useRef<Konva.Stage | null>(null);

    useImperativeHandle(ref, () => ({
      exportToPdf(filename = 'water-supply.pdf') {
        if (!stageRef.current) return;
        const dataUrl = stageRef.current.toDataURL({ pixelRatio: 3 });
        import('jspdf').then(({ jsPDF }) => {
          const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a1' });
          pdf.addImage(dataUrl, 'PNG', 10, 10, 830, 570);
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

      const W = Math.max(container.clientWidth || 900, 900);
      const H = Math.max(container.clientHeight || 650, 650);

      const stage = new Konva.Stage({ container, width: W, height: H, draggable: true });
      stageRef.current = stage;
      const layer = new Konva.Layer();
      stage.add(layer);

      // ── Background ──────────────────────────────────────────────────────────
      layer.add(new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: C_BG }));

      // ── Title ───────────────────────────────────────────────────────────────
      layer.add(new Konva.Rect({ x: 0, y: 0, width: W, height: TITLE_H, fill: '#f0f6ff', stroke: C_GRID, strokeWidth: 1 }));
      layer.add(new Konva.Text({
        x: W / 2, y: 10, offsetX: 0,
        text: `СУВ ТА'МИНОТИ СXЕМАСИ — ${floor.floorNumber}-QAVAT`,
        fontSize: 15, fontStyle: 'bold', fill: C_COLD, align: 'center',
      }));
      const subtitle = `В1/Т3/Т4 · Boyler: ${schema.boilerTag} ${schema.boilerVolL}L · Jami: ${schema.totalFixtures} jihoz · ${schema.totalRisers} stoyak · D asosiy: ø${schema.mainDiamMm}mm`;
      layer.add(new Konva.Text({ x: W / 2, y: 30, offsetX: 0, text: subtitle, fontSize: 9, fill: C_DIM, align: 'center' }));

      // ── Chizma maydoni ──────────────────────────────────────────────────────
      const drawX = MARGIN_X;
      const drawY = MARGIN_Y;
      const drawW = W - MARGIN_X * 2;
      const drawH = H - MARGIN_Y - STAMP_H - 10;

      // ── Xonalar layout hisob ─────────────────────────────────────────────────
      const wetRooms   = floor.rooms.filter(r => r.fixtures.length > 0);
      if (!wetRooms.length) {
        layer.add(new Konva.Rect({ x: drawX, y: drawY, width: drawW, height: drawH, stroke: C_WALL, strokeWidth: 1, fill: '#fafbfc' }));
        layer.add(new Konva.Text({ x: W / 2, y: H / 2, text: 'Suv ta\'minoti talab qilinadigan xonalar yo\'q', fontSize: 13, fill: C_DIM, align: 'center', offsetX: 0 }));
        layer.draw();
        return;
      }

      const cols       = Math.min(wetRooms.length, Math.ceil(Math.sqrt(wetRooms.length)));
      const rows       = Math.ceil(wetRooms.length / cols);
      const roomW      = drawW / cols;
      const roomH      = Math.min(260, Math.max(180, drawH / rows));
      const totalRoomH = rows * roomH;
      const mainPipeY  = drawY + totalRoomH + 24;
      const contentH   = totalRoomH + 60;

      // Fon to'rtburchak (xonalar + quvur hajmiga mos)
      layer.add(new Konva.Rect({ x: drawX, y: drawY, width: drawW, height: contentH, stroke: C_WALL, strokeWidth: 1, fill: '#fafbfc' }));
      layer.add(new Konva.Line({ points: [drawX, mainPipeY, drawX + drawW, mainPipeY], stroke: C_COLD, strokeWidth: PIPE_W_MAIN }));
      layer.add(new Konva.Line({ points: [drawX, mainPipeY + 5, drawX + drawW, mainPipeY + 5], stroke: C_HOT, strokeWidth: 2 }));
      layer.add(new Konva.Line({ points: [drawX, mainPipeY + 9, drawX + drawW, mainPipeY + 9], stroke: C_CIRC, strokeWidth: 1.5, dash: [8, 4] }));
      layer.add(new Konva.Text({ x: drawX + 4, y: mainPipeY - 13, text: `В1 ø${schema.mainDiamMm}mm`, fontSize: 8, fill: C_COLD }));

      wetRooms.forEach((room, ri) => {
        const col = ri % cols;
        const row = Math.floor(ri / cols);
        const rx  = drawX + col * roomW;
        const ry  = drawY + row * roomH;
        const rw  = roomW;
        const rh  = roomH;

        // Xona to'rtburchagi
        layer.add(new Konva.Rect({ x: rx, y: ry, width: rw, height: rh, stroke: C_WALL, strokeWidth: 1.5, fill: C_ROOM_BG }));

        // Xona nomi va maydoni
        layer.add(new Konva.Text({ x: rx + ROOM_PAD, y: ry + ROOM_PAD, text: room.name, fontSize: 11, fontStyle: 'bold', fill: C_TEXT }));
        layer.add(new Konva.Text({ x: rx + ROOM_PAD, y: ry + ROOM_PAD + 14, text: `${room.area} m²`, fontSize: 9, fill: C_DIM }));

        // Stoyak tagi (yuqori o'ng)
        const riserTag = room.fixtures[0]?.riserTag ?? '';
        if (riserTag) {
          layer.add(new Konva.Text({ x: rx + rw - 52, y: ry + ROOM_PAD, text: riserTag, fontSize: 9, fontStyle: 'bold', fill: C_COLD }));
        }

        // ── Layout ─────────────────────────────────────────────────────────────
        // Jixozlar: xonaning 55-60% balandligida (o'rta-pastda)
        // Gorizontal tarmoq: jixozlar ustida ~20px
        // Stoyak: chapdan, yuqoridan asosiy quvurgacha

        const nFix      = room.fixtures.length;
        const usableW   = rw - ROOM_PAD * 2 - 24;
        const fixSpacing = nFix > 1 ? Math.min(52, usableW / nFix) : 0;
        const startX    = rx + ROOM_PAD + 24;

        // Jixoz Y — xonaning 58%
        const fixY  = ry + Math.round(rh * 0.58);
        // Gorizontal taqsimlash quvuri — jixozlardan 26px yuqorida
        const distY = fixY - FIX_R - 22;

        // Gorizontal tarmoq quvuri
        layer.add(new Konva.Line({ points: [rx + ROOM_PAD, distY, rx + rw - ROOM_PAD, distY], stroke: C_COLD, strokeWidth: PIPE_W_BRANCH + 0.5 }));
        layer.add(new Konva.Line({ points: [rx + ROOM_PAD, distY + 7, rx + rw - ROOM_PAD, distY + 7], stroke: C_HOT, strokeWidth: PIPE_W_BRANCH + 0.5 }));
        // Tarmoq diametr labeli
        const branchMainDiam = (room.fixtures[0] as any)?.branchDiamMm ?? 25;
        layer.add(new Konva.Text({ x: rx + ROOM_PAD + 4, y: distY - 11, text: `ø${branchMainDiam}`, fontSize: 7, fill: C_COLD }));

        // Stoyak vertikal chiziq — xona yuqorisidan asosiy quvurgacha
        const riserX = rx + ROOM_PAD + 10;
        layer.add(new Konva.Line({ points: [riserX, ry + 42, riserX, mainPipeY], stroke: C_COLD, strokeWidth: PIPE_W_RISER }));
        layer.add(new Konva.Line({ points: [riserX + 5, ry + 42, riserX + 5, mainPipeY + 5], stroke: C_HOT, strokeWidth: PIPE_W_RISER }));
        // Stoyak diametr labeli
        const riserSchema = schema.risers.find(rs => rs.tag === riserTag);
        const rDiam = riserSchema?.diamMm ?? schema.mainDiamMm;
        const rLabelY = ry + 42 + (distY - ry - 42) * 0.4;
        layer.add(new Konva.Text({ x: riserX + 8, y: rLabelY, text: `ø${rDiam}`, fontSize: 7.5, fill: C_COLD, rotation: -90 }));

        room.fixtures.forEach((fix, fi) => {
          const fx = startX + fi * fixSpacing + (nFix === 1 ? usableW / 2 : 0);

          // Vertikal tarmoq quvuri
          const branchColor = fix.hotWater ? C_HOT : C_COLD;
          const branchDiam  = (fix as any).branchDiamMm ?? 20;

          // Sovuq vertikal tarmoq
          if (fix.coldWater) {
            layer.add(new Konva.Line({ points: [fx, distY, fx, fixY - FIX_R], stroke: C_COLD, strokeWidth: PIPE_W_BRANCH, dash: [5, 3] }));
          }
          // Issiq vertikal tarmoq
          if (fix.hotWater) {
            layer.add(new Konva.Line({ points: [fx + 3, distY + 6, fx + 3, fixY - FIX_R], stroke: C_HOT, strokeWidth: PIPE_W_BRANCH, dash: [5, 3] }));
          }

          // Jihoz doirasi
          const fillColor = fix.hotWater ? '#fff0f0' : fix.coldWater ? '#eff6ff' : '#f0fdf4';
          const strokeColor = fix.hotWater ? C_HOT : C_COLD;
          layer.add(new Konva.Circle({ x: fx, y: fixY, radius: FIX_R, fill: fillColor, stroke: strokeColor, strokeWidth: 1.5 }));

          // Jihoz belgisi
          const label = FIX_SHORT[fix.type] ?? '?';
          layer.add(new Konva.Text({ x: fx - (label.length > 1 ? 6 : 4), y: fixY - 6, text: label, fontSize: label.length > 1 ? 7 : 8, fill: C_TEXT, fontStyle: 'bold' }));

          // Jihoz nomi pastda
          const fullLabel = FIX_LABELS[fix.type] ?? fix.type;
          layer.add(new Konva.Text({ x: fx - 18, y: fixY + FIX_R + 3, text: fullLabel.slice(0, 9), fontSize: 6.5, fill: C_DIM, align: 'center', width: 36 }));

          // Balandlik yozuvi
          layer.add(new Konva.Text({ x: fx + FIX_R + 2, y: fixY - 4, text: `${fix.heightMm}мм`, fontSize: 6.5, fill: C_DIM }));

          // Tarmoq diametr labeli ustida
          layer.add(new Konva.Text({ x: fx + 5, y: distY + (fix.hotWater ? 8 : 2), text: `ø${branchDiam}`, fontSize: 7, fill: branchColor }));
        });

        // Stoyakni asosiy quvurga ulash — vertikal chiziq pastda
        layer.add(new Konva.Line({ points: [riserX, mainPipeY, riserX, mainPipeY], stroke: C_COLD, strokeWidth: 1 }));
        // Burchak marker
        layer.add(new Konva.Circle({ x: riserX, y: mainPipeY, radius: 3, fill: C_COLD }));
        layer.add(new Konva.Circle({ x: riserX + 5, y: mainPipeY + 5, radius: 2.5, fill: C_HOT }));
      });

      // ── Stoyak jadvali (o'ng taraf) ─────────────────────────────────────────
      drawRiserTable(layer, schema, floor, W, drawY, contentH);

      // ── Daraja belgilari (chapda) ────────────────────────────────────────────
      drawLevelMarks(layer, schema, floor, MARGIN_X - 10, drawY, contentH);

      // ── Legend — chizma pastida ───────────────────────────────────────────────
      const legendY = drawY + contentH + 8;
      drawLegend(layer, W, legendY);

      // ── Pastki shtamp ─────────────────────────────────────────────────────────
      const stampY = legendY + 52;
      drawStamp(layer, schema, floor, W, stampY);

      layer.draw();

      // Zoom
      stage.on('wheel', e => {
        e.evt.preventDefault();
        const s     = 1.10;
        const old   = stage.scaleX();
        const ptr   = stage.getPointerPosition()!;
        const nscl  = Math.max(0.25, Math.min(6, e.evt.deltaY < 0 ? old * s : old / s));
        stage.scale({ x: nscl, y: nscl });
        stage.position({
          x: ptr.x - (ptr.x - stage.x()) * (nscl / old),
          y: ptr.y - (ptr.y - stage.y()) * (nscl / old),
        });
      });

      return () => { stage.destroy(); stageRef.current = null; };
    }, [schema, activeFloor]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />;
  }
);

WaterSupplyCanvas.displayName = 'WaterSupplyCanvas';
export default WaterSupplyCanvas;

// ── Stoyak jadvali ─────────────────────────────────────────────────────────────
function drawRiserTable(
  layer: Konva.Layer,
  schema: WaterSupplySchema,
  floor: WaterFloor,
  W: number, drawY: number, drawH: number
) {
  const tableX = W - MARGIN_X + 4;
  const tableW = MARGIN_X - 8;
  // Stoyaklar ro'yxati
  const floorRisers = schema.risers.filter(rs => rs.floors.includes(floor.floorNumber));
  if (!floorRisers.length) return;

  const rowH = Math.min(22, drawH / (floorRisers.length + 1));
  const startY = drawY + 10;

  // Sarlavha
  layer.add(new Konva.Text({ x: tableX, y: startY - 2, text: 'STOYAK', fontSize: 7, fontStyle: 'bold', fill: C_TEXT, width: tableW, align: 'center' }));

  floorRisers.forEach((rs, i) => {
    const color = rs.type === 'cold' ? C_COLD : rs.type === 'hot' ? C_HOT : C_CIRC;
    const ty = startY + 12 + i * rowH;
    // Rangli chiziq
    layer.add(new Konva.Line({ points: [tableX, ty + 5, tableX + 16, ty + 5], stroke: color, strokeWidth: 2, dash: rs.type === 'circ' ? [4, 2] : [] }));
    // Tag va diam
    layer.add(new Konva.Text({ x: tableX + 18, y: ty, text: `${rs.tag}`, fontSize: 7.5, fontStyle: 'bold', fill: color }));
    layer.add(new Konva.Text({ x: tableX + 18, y: ty + 9, text: `ø${rs.diamMm}`, fontSize: 6.5, fill: C_DIM }));
  });
}

// ── Daraja belgilari ────────────────────────────────────────────────────────────
function drawLevelMarks(
  layer: Konva.Layer,
  _schema: WaterSupplySchema,
  floor: WaterFloor,
  x: number, drawY: number, drawH: number
) {
  const baseElev = floor.elevation ?? 0;
  const topElev  = baseElev + 3.0; // qavat balandligi

  const marks = [
    { label: `±${baseElev.toFixed(3)}`, y: drawY + drawH - 24, isZero: baseElev === 0 },
    { label: `+${topElev.toFixed(3)}`,  y: drawY + 4,           isZero: false },
    { label: `+${(baseElev + 2.0).toFixed(3)}`, y: drawY + drawH * 0.35, isZero: false },
  ];

  marks.forEach(m => {
    layer.add(new Konva.Line({ points: [x - 6, m.y, x + 4, m.y], stroke: '#475569', strokeWidth: 1 }));
    layer.add(new Konva.Text({ x: x - 52, y: m.y - 5, text: m.label, fontSize: 7.5, fill: m.isZero ? C_COLD : C_TEXT, fontStyle: m.isZero ? 'bold' : 'normal', align: 'right', width: 44 }));
    layer.add(new Konva.RegularPolygon({ x: x - 7, y: m.y, sides: 3, radius: 4, fill: m.isZero ? C_COLD : '#475569', rotation: 180 }));
  });
}

// ── Legend ─────────────────────────────────────────────────────────────────────
function drawLegend(layer: Konva.Layer, W: number, legendTopY: number) {
  const items = [
    { color: C_COLD,  label: 'В1 — Sovuq suv', dash: [] },
    { color: C_HOT,   label: 'Т3 — Issiq suv', dash: [] },
    { color: C_CIRC,  label: 'Т4 — Sirkul',    dash: [6, 3] },
  ];
  const lx = 70;
  const ly = legendTopY;

  layer.add(new Konva.Rect({ x: lx - 6, y: ly - 6, width: 180, height: items.length * 16 + 12, fill: '#f8fafc', stroke: C_GRID, strokeWidth: 1, cornerRadius: 3 }));
  items.forEach((it, i) => {
    const y = ly + i * 16 + 4;
    layer.add(new Konva.Line({ points: [lx, y, lx + 22, y], stroke: it.color, strokeWidth: 2, dash: it.dash }));
    layer.add(new Konva.Text({ x: lx + 28, y: y - 5, text: it.label, fontSize: 9, fill: C_TEXT }));
  });
}

// ── Shtamp ─────────────────────────────────────────────────────────────────────
function drawStamp(
  layer: Konva.Layer,
  schema: WaterSupplySchema,
  floor: WaterFloor,
  W: number, stampTopY: number
) {
  const sy = stampTopY;
  layer.add(new Konva.Rect({ x: 0, y: sy, width: W, height: STAMP_H, fill: '#f0f6ff', stroke: C_GRID, strokeWidth: 1 }));

  const today = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const cols = [
    { label: 'Loyiha nomi', value: `Suv ta\'minoti ${floor.floorNumber}-qavat`, w: W * 0.35 },
    { label: 'Standart', value: 'SNiP 2.04.01-85*', w: W * 0.18 },
    { label: 'Sana', value: today, w: W * 0.14 },
    { label: 'Masshtab', value: '1:50', w: W * 0.10 },
    { label: 'Bo\'lim', value: 'ВК', w: W * 0.10 },
    { label: 'Varaq', value: `ВК-${floor.floorNumber}`, w: W * 0.13 },
  ];

  let cx = 0;
  cols.forEach(col => {
    layer.add(new Konva.Rect({ x: cx, y: sy, width: col.w, height: STAMP_H, stroke: C_GRID, strokeWidth: 1 }));
    layer.add(new Konva.Text({ x: cx + 4, y: sy + 5, text: col.label, fontSize: 7, fill: C_DIM }));
    layer.add(new Konva.Text({ x: cx + 4, y: sy + 17, text: col.value, fontSize: 9, fontStyle: 'bold', fill: C_TEXT, width: col.w - 8, wrap: 'none', ellipsis: true }));
    cx += col.w;
  });
}
