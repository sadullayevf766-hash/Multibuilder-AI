/**
 * WaterSupplyAxonCanvas — Suv ta'minoti aksonometrik sxemasi (Konva)
 * PDF (Xumson ОВиК) 17-sahifa uslubi:
 *  - Vertikal o'q: balandlik (m)
 *  - В1 (ko'k), Т3 (qizil), Т4 (sariq) stoyaklar — taper bilan
 *  - Har stoyak uchun qavat bo'yicha tarmoqlar
 *  - Koteln jihozlari (boyler, nasos, filtrlar) pastda
 *  - Elevatsiya belgilari (+0.000, +3.000...)
 */
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Konva from 'konva';
import type { WaterSupplySchema, RiserAxon } from '../../../server/src/engine/WaterSupplyEngine';

export interface WaterSupplyAxonCanvasHandle {
  exportToPdf: (filename?: string) => void;
}
interface Props { schema: WaterSupplySchema; }

// ── Ranglar ───────────────────────────────────────────────────────────────────
const C_COLD  = '#2563eb';   // В1 sovuq
const C_HOT   = '#dc2626';   // Т3 issiq
const C_CIRC  = '#d97706';   // Т4 sirkul
const C_EQUIP = '#374151';   // jihozlar
const C_ELEV  = '#64748b';   // elevatsiya
const C_TEXT  = '#0f172a';
const C_GRID  = '#e2e8f0';
const BG      = '#ffffff';

// ── O'lchamlar ────────────────────────────────────────────────────────────────
const LEFT_PAD   = 120;   // elevatsiya o'qi uchun
const RIGHT_PAD  = 60;
const TOP_PAD    = 60;
const BOT_PAD    = 180;  // koteln jihozlari uchun
const RISER_GAP  = 55;   // stoyaklar orasidagi mashofa px
const M_TO_PX    = 55;   // 1 metr = 55 px

function riserColor(type: 'cold'|'hot'|'circ') {
  return type === 'cold' ? C_COLD : type === 'hot' ? C_HOT : C_CIRC;
}

const WaterSupplyAxonCanvas = forwardRef<WaterSupplyAxonCanvasHandle, Props>(({ schema }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef     = useRef<Konva.Stage | null>(null);

  useImperativeHandle(ref, () => ({
    exportToPdf(filename = 'suv-taminoti-axon.pdf') {
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

    const axons = schema.riserAxons ?? [];
    const totalH = schema.buildingHeight ?? (schema.floors.length * 3.0 + 0.5);

    const drawH = totalH * M_TO_PX;
    const drawW = axons.length * RISER_GAP + 40;
    const W = Math.max(el.clientWidth  || 960, LEFT_PAD + drawW + RIGHT_PAD + 200);
    const H = Math.max(el.clientHeight || 650, TOP_PAD + drawH + BOT_PAD);

    const stage = new Konva.Stage({ container: el, width: W, height: H, draggable: true });
    stageRef.current = stage;
    const layer = new Konva.Layer();
    stage.add(layer);

    // Fon
    layer.add(new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: BG }));

    // Sarlavha
    layer.add(new Konva.Text({
      x: W / 2, y: 14,
      text: "SUV TA'MINOTI AKSONOMETRIK SXEMASI",
      fontSize: 13, fontStyle: 'bold', fill: C_TEXT, align: 'center',
    }));
    layer.add(new Konva.Text({
      x: W / 2, y: 30,
      text: `Boyler: ${schema.boilerTag} ${schema.boilerVolL}L · Asosiy ø${schema.mainDiamMm}mm · ${schema.totalRisers} stoyak`,
      fontSize: 9, fill: C_ELEV, align: 'center',
    }));

    const axisX = LEFT_PAD;
    const baseY = TOP_PAD + drawH;   // pol = pastki chiziq

    // ── Vertikal balandlik o'qi ───────────────────────────────────────────────
    layer.add(new Konva.Line({ points: [axisX, TOP_PAD - 10, axisX, baseY + 10], stroke: C_ELEV, strokeWidth: 1.5 }));

    // Qavat chiziqlari va elevatsiya belgilari
    schema.floors.forEach(fl => {
      const y = baseY - fl.elevation * M_TO_PX;
      const elevStr = fl.elevation >= 0 ? `+${fl.elevation.toFixed(3)}` : fl.elevation.toFixed(3);
      // Gorizontal qavat chizig'i (yengil)
      layer.add(new Konva.Line({ points: [axisX - 5, y, W - RIGHT_PAD, y], stroke: C_GRID, strokeWidth: 0.8, dash: [6, 4] }));
      // Tick
      layer.add(new Konva.Line({ points: [axisX - 8, y, axisX, y], stroke: C_ELEV, strokeWidth: 1.5 }));
      // Elevatsiya matni
      layer.add(new Konva.Text({ x: 4, y: y - 6, text: elevStr, fontSize: 8, fill: C_ELEV }));
      // Qavat nomi
      layer.add(new Konva.Text({ x: 4, y: y + 4, text: fl.label, fontSize: 7, fill: '#94a3b8' }));
    });

    // Tom chizig'i
    const roofY = baseY - totalH * M_TO_PX;
    layer.add(new Konva.Line({ points: [axisX - 5, roofY, W - RIGHT_PAD, roofY], stroke: C_GRID, strokeWidth: 1, dash: [8, 3] }));
    layer.add(new Konva.Text({ x: 4, y: roofY - 10, text: `+${totalH.toFixed(3)} (tom)`, fontSize: 8, fill: C_ELEV }));

    // ── Stoyaklar ─────────────────────────────────────────────────────────────
    axons.forEach((axon, ai) => {
      const rx = axisX + 40 + ai * RISER_GAP;
      const color = riserColor(axon.type);
      const strokeW = axon.type === 'cold' ? 3 : axon.type === 'hot' ? 2.5 : 2;

      // Asosiy stoyak chizig'i
      const topY   = baseY - totalH * M_TO_PX;
      const btmY   = baseY + 20;
      layer.add(new Konva.Line({ points: [rx, topY, rx, btmY], stroke: color, strokeWidth: strokeW }));

      // Vent stoyak (ø50, tepasida davom etadi, yashil)
      layer.add(new Konva.Line({ points: [rx, topY, rx, topY - 25], stroke: '#16a34a', strokeWidth: 1.5, dash: [4, 3] }));
      layer.add(new Konva.Text({ x: rx + 2, y: topY - 22, text: 'ø50', fontSize: 7, fill: '#16a34a' }));

      // Taper segmentlar — diam belgisi
      drawRiserSegments(layer, axon, rx, baseY, color);

      // Stoyak tagi
      layer.add(new Konva.Text({
        x: rx - 14, y: btmY + 4,
        text: axon.tag,
        fontSize: 8, fontStyle: 'bold', fill: color, align: 'center',
      }));

      // Har qavat uchun tarmoq chizig'i
      schema.floors.forEach(fl => {
        const fy = baseY - fl.elevation * M_TO_PX - 0.55 * M_TO_PX; // jihoz balandligi ~550mm
        const branchLen = 60 + ai * 8;
        const dir = ai % 2 === 0 ? 1 : -1;
        // Gorizontal tarmoq
        layer.add(new Konva.Line({
          points: [rx, fy, rx + dir * branchLen, fy],
          stroke: color, strokeWidth: 1.5, dash: [5, 3],
        }));
        // Tarmoq uchi (jihoz ulanish nuqtasi)
        layer.add(new Konva.Circle({ x: rx + dir * branchLen, y: fy, radius: 3, fill: color }));

        // Qavat tarmoq diametri
        const brDiam = fl.rooms
          .flatMap(r => r.fixtures)
          .find(f => f.riserTag?.startsWith('В'))?.branchDiamMm ?? 20;
        layer.add(new Konva.Text({
          x: rx + dir * (branchLen / 2) - 10, y: fy - 9,
          text: `ø${brDiam}`, fontSize: 7, fill: color,
        }));

        // Elevatsiya belgisi
        const elStr = fl.elevation >= 0 ? `+${fl.elevation.toFixed(3)}` : fl.elevation.toFixed(3);
        layer.add(new Konva.Text({
          x: rx + dir * branchLen + (dir > 0 ? 4 : -20), y: fy - 6,
          text: elStr, fontSize: 6.5, fill: C_ELEV,
        }));
      });
    });

    // ── Koteln jihozlari (pastda) ─────────────────────────────────────────────
    drawEquipment(layer, schema, axisX, baseY, W);

    // ── Asosiy quvur (gorizontal, pastki) ────────────────────────────────────
    const mainY = baseY + 15;
    layer.add(new Konva.Line({
      points: [axisX, mainY, axisX + axons.length * RISER_GAP + 60, mainY],
      stroke: C_COLD, strokeWidth: 4,
    }));
    layer.add(new Konva.Text({ x: axisX + 4, y: mainY + 4, text: `В1 asosiy ø${schema.mainDiamMm}mm → boyler`, fontSize: 9, fill: C_COLD }));

    // ── Legenda ───────────────────────────────────────────────────────────────
    drawLegend(layer, schema, W, H);

    layer.draw();

    // Zoom
    stage.on('wheel', e => {
      e.evt.preventDefault();
      const sb = 1.08, old = stage.scaleX();
      const ptr = stage.getPointerPosition()!;
      const next = Math.max(0.2, Math.min(6, e.evt.deltaY < 0 ? old * sb : old / sb));
      stage.scale({ x: next, y: next });
      stage.position({ x: ptr.x - (ptr.x - stage.x()) * (next / old), y: ptr.y - (ptr.y - stage.y()) * (next / old) });
    });

    return () => { stage.destroy(); stageRef.current = null; };
  }, [schema]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />;
});

WaterSupplyAxonCanvas.displayName = 'WaterSupplyAxonCanvas';
export default WaterSupplyAxonCanvas;

// ── Helpers ───────────────────────────────────────────────────────────────────

function drawRiserSegments(layer: Konva.Layer, axon: RiserAxon, rx: number, baseY: number, color: string) {
  axon.segments.forEach((seg, si) => {
    const y1 = baseY - seg.toElevM   * M_TO_PX;
    const y2 = baseY - seg.fromElevM * M_TO_PX;
    const mid = (y1 + y2) / 2;
    // Diam belgisi
    layer.add(new Konva.Text({ x: rx + 3, y: mid - 5, text: `ø${seg.diamMm}`, fontSize: 7, fill: color }));
    // Segment chegarasi
    if (si > 0) {
      layer.add(new Konva.Line({ points: [rx - 5, y2, rx + 5, y2], stroke: color, strokeWidth: 1.5 }));
    }
  });
  // Agar segment yo'q bo'lsa — asosiy diam
  if (axon.segments.length === 0) {
    const totalH_px = baseY * 0.8;
    layer.add(new Konva.Text({ x: rx + 3, y: baseY - totalH_px / 2, text: `ø20`, fontSize: 7, fill: color }));
  }
}

function drawEquipment(layer: Konva.Layer, schema: WaterSupplySchema, axisX: number, baseY: number, W: number) {
  const eqY = baseY + 50;
  const eqItems = schema.equipment ?? [];
  const eqW = Math.min(160, (W - axisX - 60) / Math.max(1, eqItems.length));

  eqItems.forEach((eq, ei) => {
    const ex = axisX + 10 + ei * (eqW + 8);
    const ew = eqW, eh = 52;

    const bgColor = eq.type === 'boiler' ? '#fef3c7' :
                    eq.type.startsWith('filter') ? '#f0fdf4' :
                    eq.type.startsWith('pump') ? '#eff6ff' : '#f8fafc';
    const bColor  = eq.type === 'boiler' ? '#d97706' :
                    eq.type.startsWith('filter') ? '#16a34a' : '#2563eb';

    layer.add(new Konva.Rect({ x: ex, y: eqY, width: ew, height: eh, fill: bgColor, stroke: bColor, strokeWidth: 1.5, cornerRadius: 4 }));

    // Jihoz ikonkasi
    const icon = eq.type === 'boiler' ? '🔥' : eq.type === 'pump_cold' ? '💧' :
                 eq.type === 'filter_softener' ? '🔵' : eq.type === 'filter_clean' ? '🟢' : '⚙️';
    layer.add(new Konva.Text({ x: ex + 4, y: eqY + 3, text: icon, fontSize: 14 }));
    layer.add(new Konva.Text({ x: ex + 22, y: eqY + 4, text: eq.nameUz, fontSize: 7.5, fontStyle: 'bold', fill: C_TEXT, width: ew - 24, wrap: 'word' }));
    layer.add(new Konva.Text({ x: ex + 4, y: eqY + 28, text: eq.model, fontSize: 7, fill: C_ELEV, width: ew - 8, wrap: 'word' }));
    layer.add(new Konva.Text({ x: ex + 4, y: eqY + 40, text: `ø${eq.inputDiamMm}→ø${eq.outputDiamMm}mm`, fontSize: 7, fill: bColor }));

    // Ulanish chizig'i asosiy quvurga
    const connY = eqY;
    layer.add(new Konva.Line({ points: [ex + ew / 2, baseY + 15, ex + ew / 2, connY], stroke: bColor, strokeWidth: 1, dash: [4, 3] }));
  });

  if (eqItems.length > 0) {
    layer.add(new Konva.Text({ x: axisX + 4, y: eqY - 12, text: 'KOTELN JIHOZLARI (PDF 17-sahifa)', fontSize: 8, fontStyle: 'bold', fill: C_TEXT }));
  }
}

function drawLegend(layer: Konva.Layer, schema: WaterSupplySchema, W: number, H: number) {
  const items = [
    { color: C_COLD,    label: 'В1 — Sovuq suv',    solid: true  },
    { color: C_HOT,     label: 'Т3 — Issiq suv',    solid: true  },
    { color: C_CIRC,    label: 'Т4 — Sirkul',       solid: true  },
    { color: '#16a34a', label: 'ø50 Vent stoyak',   solid: false },
  ];
  const lx = W - 175, ly = 55;
  layer.add(new Konva.Rect({ x: lx - 6, y: ly - 6, width: 172, height: items.length * 18 + 20 + (schema.equipment?.length ? 18 : 0), fill: '#f8fafc', stroke: C_GRID, strokeWidth: 1, cornerRadius: 4 }));
  layer.add(new Konva.Text({ x: lx, y: ly, text: 'BELGILAR', fontSize: 8, fontStyle: 'bold', fill: C_TEXT }));
  items.forEach((item, i) => {
    const iy = ly + 14 + i * 18;
    const dash = item.solid ? [] : [4, 3];
    layer.add(new Konva.Line({ points: [lx, iy + 6, lx + 22, iy + 6], stroke: item.color, strokeWidth: 2, dash }));
    layer.add(new Konva.Text({ x: lx + 28, y: iy, text: item.label, fontSize: 9, fill: C_TEXT }));
  });
  // Jihozlar soni
  if (schema.equipment?.length) {
    layer.add(new Konva.Text({ x: lx, y: ly + 14 + items.length * 18 + 4, text: `Koteln: ${schema.equipment.length} jihoz`, fontSize: 8, fill: C_EQUIP }));
  }
}
