/**
 * SewageAxonCanvas — Kanalizatsiya aksonometrik sxemasi (Konva)
 * PDF (Xumson ОВиК) 16-sahifa uslubi:
 *  - Vertikal o'q: balandlik (m), elevatsiyalar bilan (+3.822, -0.666...)
 *  - К1 stoyaklar ø110 (jigarrang)
 *  - Vent stoyaklar ø50 (yashil, tepadan chiqadi)
 *  - Qavat bo'yicha tarmoqlar ø50/ø110 — qiya i=2%/3%
 *  - Reviziya lyuklari 400×400
 *  - Drenaj nasosi (UNILIFT) yerto'lada
 *  - Asosiy chiqish → kanalizatsiya chuquri
 */
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Konva from 'konva';
import type { SewageSchema } from '../../../server/src/engine/SewageEngine';

export interface SewageAxonCanvasHandle {
  exportToPdf: (filename?: string) => void;
}
interface Props { schema: SewageSchema; }

const C_RISER   = '#92400e';   // К1 ø110
const C_B110    = '#b45309';   // tarmoq ø110
const C_B50     = '#6b7280';   // tarmoq ø50
const C_VENT    = '#16a34a';   // vent ø50
const C_ELEV    = '#475569';   // elevatsiya
const C_REV     = '#1d4ed8';   // reviziya
const C_DRAIN   = '#1e3a8a';   // drenaj nasosi
const C_TEXT    = '#0f172a';
const C_GRID    = '#e2e8f0';
const BG        = '#ffffff';

const LEFT_PAD  = 115;
const TOP_PAD   = 60;
const BOT_PAD   = 140;
const RISER_GAP = 80;
const M_TO_PX   = 52;

const SewageAxonCanvas = forwardRef<SewageAxonCanvasHandle, Props>(({ schema }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef     = useRef<Konva.Stage | null>(null);

  useImperativeHandle(ref, () => ({
    exportToPdf(filename = 'kanalizatsiya-axon.pdf') {
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

    const risers = schema.risers;
    const totalH = schema.buildingHeight ?? (schema.floors.length * 3.0 + 0.5);

    const W = Math.max(el.clientWidth  || 960, LEFT_PAD + risers.length * RISER_GAP + 200);
    const H = Math.max(el.clientHeight || 680, TOP_PAD + (totalH + 2) * M_TO_PX + BOT_PAD);

    const stage = new Konva.Stage({ container: el, width: W, height: H, draggable: true });
    stageRef.current = stage;
    const layer = new Konva.Layer();
    stage.add(layer);

    layer.add(new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: BG }));

    // Sarlavha
    layer.add(new Konva.Text({ x: W / 2, y: 14, text: 'KANALIZATSIYA AKSONOMETRIK SXEMASI', fontSize: 13, fontStyle: 'bold', fill: C_TEXT, align: 'center' }));
    layer.add(new Konva.Text({ x: W / 2, y: 30, text: `${schema.totalFixtures} jihoz · ${schema.totalRisers} stoyak К1 ø110 · Qiya: ø50→3sm/m, ø110→2sm/m`, fontSize: 9, fill: C_ELEV, align: 'center' }));

    const axisX = LEFT_PAD;
    const baseY = TOP_PAD + totalH * M_TO_PX;    // ±0.000 qatori

    // ── Vertikal o'q ─────────────────────────────────────────────────────────
    layer.add(new Konva.Line({ points: [axisX, TOP_PAD - 15, axisX, baseY + 60], stroke: C_ELEV, strokeWidth: 1.5 }));

    // Qavat gorizontal chiziqlari + elevatsiyalar
    schema.floors.forEach(fl => {
      const y = baseY - fl.elevation * M_TO_PX;
      layer.add(new Konva.Line({ points: [axisX - 5, y, W - 40, y], stroke: C_GRID, strokeWidth: 0.7, dash: [6, 4] }));
      layer.add(new Konva.Line({ points: [axisX - 8, y, axisX, y], stroke: C_ELEV, strokeWidth: 1.5 }));
      const ev = fl.elevation >= 0 ? `+${fl.elevation.toFixed(3)}` : fl.elevation.toFixed(3);
      layer.add(new Konva.Text({ x: 4, y: y - 7, text: ev, fontSize: 8, fill: C_ELEV }));
      layer.add(new Konva.Text({ x: 4, y: y + 3, text: fl.label, fontSize: 7, fill: '#94a3b8' }));
    });

    // ±0.000 chiziq (qalin)
    layer.add(new Konva.Line({ points: [axisX - 10, baseY, W - 40, baseY], stroke: C_ELEV, strokeWidth: 1.5 }));
    layer.add(new Konva.Text({ x: 4, y: baseY - 7, text: '±0.000', fontSize: 8, fontStyle: 'bold', fill: C_ELEV }));

    // Tom chizig'i
    const roofY = baseY - totalH * M_TO_PX;
    layer.add(new Konva.Line({ points: [axisX - 5, roofY, W - 40, roofY], stroke: C_GRID, strokeWidth: 1, dash: [8, 3] }));
    layer.add(new Konva.Text({ x: 4, y: roofY - 10, text: `+${totalH.toFixed(3)}`, fontSize: 8, fill: C_ELEV }));

    // Yerto'la/quduq chizig'i
    const basementY = baseY + 45;
    layer.add(new Konva.Line({ points: [axisX - 5, basementY, W - 40, basementY], stroke: C_GRID, strokeWidth: 0.7, dash: [4, 4] }));
    layer.add(new Konva.Text({ x: 4, y: basementY - 7, text: '-1.360', fontSize: 8, fill: '#94a3b8' }));

    // ── К1 Stoyaklar ─────────────────────────────────────────────────────────
    risers.forEach((rs, ri) => {
      const rx = axisX + 50 + ri * RISER_GAP;
      const topY = roofY;

      // К1 asosiy stoyak ø110
      layer.add(new Konva.Line({ points: [rx, basementY + 10, rx, topY], stroke: C_RISER, strokeWidth: 3 }));

      // Vent stoyak ø50 (tepasidan 0.5m chiqadi)
      layer.add(new Konva.Line({ points: [rx, topY, rx, topY - 28], stroke: C_VENT, strokeWidth: 1.5, dash: [5, 3] }));
      layer.add(new Konva.Text({ x: rx + 3, y: topY - 26, text: 'ø50\nVent', fontSize: 7, fill: C_VENT }));
      // Vent stoyak tegi (PDF 16: "50Ø Вент стояк")
      layer.add(new Konva.Text({ x: rx - 18, y: topY - 44, text: rs.ventTag ?? `Ст К1 ${ri+1}-ø110`, fontSize: 7.5, fill: C_VENT, rotation: -90 }));

      // Stoyak diametri belgisi
      layer.add(new Konva.Text({ x: rx + 4, y: baseY - totalH * M_TO_PX / 2, text: 'ø110', fontSize: 8, fill: C_RISER }));

      // Stoyak tegi pastda
      layer.add(new Konva.Text({ x: rx - 14, y: basementY + 14, text: rs.tag, fontSize: 8, fontStyle: 'bold', fill: C_RISER, align: 'center' }));

      // Har qavat uchun tarmoqlar
      schema.floors.forEach((fl, fi) => {
        const fy = baseY - fl.elevation * M_TO_PX - 0.5 * M_TO_PX;
        const dir = ri % 2 === 0 ? 1 : -1;
        const brLen = 55 + ri * 5;

        // Tarmoq — ø110 yoki ø50 (hammomda ø110 bo'lishi mumkin)
        const hasHeavy = fl.rooms.some(r => r.fixtures.some(f => f.pipeDiam === 110));
        const bDiam = hasHeavy ? 110 : 50;
        const bColor = hasHeavy ? C_B110 : C_B50;
        const bW = hasHeavy ? 2 : 1.5;

        // Qiya tarmoq
        layer.add(new Konva.Line({
          points: [rx, fy, rx + dir * brLen, fy + dir * 4],
          stroke: bColor, strokeWidth: bW, dash: [5, 2],
        }));

        // Jihoz ulanish nuqtasi
        layer.add(new Konva.Circle({ x: rx + dir * brLen, y: fy + dir * 4, radius: 4, fill: bColor, stroke: 'white', strokeWidth: 1 }));

        // Diam + qiya
        const slope = bDiam === 110 ? 'i=2%' : 'i=3%';
        layer.add(new Konva.Text({
          x: rx + dir * (brLen / 2) - 12, y: fy - 10,
          text: `ø${bDiam} ${slope}`, fontSize: 7, fill: bColor,
        }));

        // Elevatsiya belgisi (PDF 16: +3.822 kabi)
        const floorElev = fl.elevation + 0.5 * (fi * 0.01 + 0.022);
        const evStr = `+${floorElev.toFixed(3)}`;
        layer.add(new Konva.Text({
          x: rx + dir * brLen + (dir > 0 ? 5 : -22), y: fy - 4,
          text: evStr, fontSize: 6.5, fill: C_ELEV,
        }));

        // Reviziya lyuk (PDF 16: 400×400mm)
        const revX = rx + dir * (brLen * 0.6);
        const revY = fy + dir * 2;
        layer.add(new Konva.Rect({ x: revX - 7, y: revY - 7, width: 14, height: 14, fill: 'transparent', stroke: C_REV, strokeWidth: 1.5, dash: [3, 2] }));
        layer.add(new Konva.Text({ x: revX - 6, y: revY + 9, text: '400×400', fontSize: 6, fill: C_REV }));
      });
    });

    // ── Asosiy chiqish (gorizontal, i=2%) ────────────────────────────────────
    const outY = basementY + 8;
    layer.add(new Konva.Line({ points: [axisX, outY, axisX + risers.length * RISER_GAP + 80, outY], stroke: C_RISER, strokeWidth: 3.5 }));
    layer.add(new Konva.Text({ x: axisX + 4, y: outY + 5, text: `ø110 · i=2% → ${schema.pitTag}`, fontSize: 9, fill: C_RISER }));

    // ── Drenaj nasosi (PDF 16: UNILIFT KP 250-A1) ────────────────────────────
    const pumps = schema.drainPumps ?? [];
    pumps.forEach((pump, pi) => {
      const px = axisX + risers.length * RISER_GAP + 90 + pi * 120;
      const py = basementY + 15;
      layer.add(new Konva.Rect({ x: px, y: py, width: 112, height: 58, fill: '#eff6ff', stroke: C_DRAIN, strokeWidth: 1.5, cornerRadius: 4 }));
      layer.add(new Konva.Text({ x: px + 4, y: py + 3,  text: '⚡ ' + pump.nameUz,  fontSize: 8, fontStyle: 'bold', fill: C_DRAIN }));
      layer.add(new Konva.Text({ x: px + 4, y: py + 16, text: pump.model,            fontSize: 7.5, fill: C_ELEV }));
      layer.add(new Konva.Text({ x: px + 4, y: py + 28, text: `Elevatsiya: ${pump.elevation.toFixed(3)}м`, fontSize: 7, fill: C_ELEV }));
      layer.add(new Konva.Text({ x: px + 4, y: py + 39, text: `Chiqish: ø${pump.pipeDiam}`, fontSize: 7, fill: C_DRAIN }));
      layer.add(new Konva.Line({ points: [px + 56, py, px + 56, outY], stroke: C_DRAIN, strokeWidth: 1.5, dash: [4, 3] }));
    });

    // ── Legenda ───────────────────────────────────────────────────────────────
    const items = [
      { color: C_RISER, label: 'К1 — Stoyak ø110',          w: 2.5, dash: [] },
      { color: C_B110,  label: 'Tarmoq ø110 · i=2%',        w: 2,   dash: [5,2] },
      { color: C_B50,   label: 'Tarmoq ø50 · i=3%',         w: 1.5, dash: [5,2] },
      { color: C_VENT,  label: 'Vent stoyak ø50',           w: 1.5, dash: [5,3] },
      { color: C_REV,   label: 'Reviziya 400×400mm',         w: 1.5, dash: [3,2] },
      { color: C_DRAIN, label: 'Drenaj nasosi (UNILIFT)',    w: 1.5, dash: [] },
    ];
    const lx = W - 185, ly = 55;
    layer.add(new Konva.Rect({ x: lx - 6, y: ly - 6, width: 182, height: items.length * 18 + 20, fill: '#f8fafc', stroke: C_GRID, strokeWidth: 1, cornerRadius: 4 }));
    layer.add(new Konva.Text({ x: lx, y: ly, text: 'BELGILAR', fontSize: 8, fontStyle: 'bold', fill: C_TEXT }));
    items.forEach((item, i) => {
      const iy = ly + 14 + i * 18;
      layer.add(new Konva.Line({ points: [lx, iy + 6, lx + 22, iy + 6], stroke: item.color, strokeWidth: item.w, dash: item.dash }));
      layer.add(new Konva.Text({ x: lx + 28, y: iy, text: item.label, fontSize: 9, fill: C_TEXT }));
    });

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

SewageAxonCanvas.displayName = 'SewageAxonCanvas';
export default SewageAxonCanvas;
