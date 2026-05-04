/**
 * FacadeCanvas2D — Professional arxitektura fasad chizish (Konva)
 *
 * Chiziladi:
 *  - Barcha 4 ta fasad (asosiy, orqa, chap, o'ng)
 *  - Tom turlari: flat, gable, hip, shed, mansard, parapet
 *  - Devor materiallari: plaster, brick, stone, concrete, wood, metal
 *  - Balkonlar, deraza nalichniklari, eshik soybonlari
 *  - Arxitektura bezaklari: cornice, belt, pilaster, quoin
 *  - O'lchov chiziqlari (dimensiya), aks belgilari, masshtab
 *  - Standart chizma shtampi
 *
 * SNiP 2.08.01-89 (turar-joy binolari arxitekturasi) ga mos
 */
import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import Konva from 'konva';
import type {
  FacadeSchema, FacadeElevation, FacadeFloor, FacadeDoor,
  FacadeWindow, FacadeDecoration, FacadeRoof,
} from '../../../server/src/engine/FacadeEngine';

export interface FacadeCanvas2DHandle {
  exportToPdf: (filename?: string) => void;
  exportToPng: (filename?: string) => void;
}
interface Props { schema: FacadeSchema; }

// ── Ranglar ───────────────────────────────────────────────────────────────────
const C_DIM    = '#444444';
const C_AXIS   = '#888888';
const C_GROUND = '#5a4a3a';
const C_SKY    = '#e8f4fc';
const C_GRID   = '#e8edf2';
const C_TEXT   = '#1a1a2e';

// ── O'lchamlar ────────────────────────────────────────────────────────────────
const PAD      = 90;    // chet boʻshliq px
const DIM_H    = 50;    // o'lchov chiziqlari uchun joy px
const STAMP_H  = 80;    // pastki shtamp balandligi
const GAP      = 40;    // fasadlar orasidagi bo'shliq
const TITLE_H  = 36;    // har bir fasad ustidagi sarlavha

// ── FacadeCanvas2D ────────────────────────────────────────────────────────────
const FacadeCanvas2D = forwardRef<FacadeCanvas2DHandle, Props>(({ schema }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef     = useRef<Konva.Stage | null>(null);
  const [activeIdx,  setActiveIdx] = useState(0);

  useImperativeHandle(ref, () => ({
    exportToPdf(filename = 'fasad-chizma.pdf') {
      if (!stageRef.current) return;
      const url = stageRef.current.toDataURL({ pixelRatio: 2.5 });
      import('jspdf').then(({ jsPDF }) => {
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a1' });
        pdf.addImage(url, 'PNG', 10, 10, 820, 570);
        pdf.save(filename);
      });
    },
    exportToPng(filename = 'fasad.png') {
      if (!stageRef.current) return;
      const url = stageRef.current.toDataURL({ pixelRatio: 3 });
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
    },
  }));

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !schema) return;
    if (stageRef.current) { stageRef.current.destroy(); stageRef.current = null; }

    const elev = schema.elevations[activeIdx];
    if (!elev) return;

    // Masshtab hisoblash — chizma container ga sig'ishi kerak
    const availW = Math.max(400, (el.clientWidth  || 1100) - PAD * 2 - DIM_H * 2);
    const SCALE  = Math.min(80, availW / elev.totalWidth);   // px/m
    const availH = Math.max(300, (el.clientHeight || 700)  - PAD * 2 - DIM_H - STAMP_H - TITLE_H);
    const scaleH = availH / elev.totalHeight;
    const U      = Math.max(1, Math.min(SCALE, scaleH, 85));

    const drawW  = elev.totalWidth  * U;
    const drawH  = elev.totalHeight * U;
    const W      = drawW + PAD * 2 + DIM_H * 2;
    const H      = drawH + PAD * 2 + DIM_H + STAMP_H + TITLE_H + 30;

    const stage = new Konva.Stage({ container: el, width: W, height: H, draggable: true });
    stageRef.current = stage;
    const layer = new Konva.Layer();
    stage.add(layer);

    // Fon
    layer.add(new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: '#f8fafc' }));

    // Chizma sahifasi (oq qog'oz)
    layer.add(new Konva.Rect({
      x: PAD - 4, y: PAD + TITLE_H - 4,
      width:  drawW + DIM_H * 2 + 8,
      height: drawH + DIM_H + STAMP_H + 8,
      fill: '#ffffff', stroke: '#c8d0da', strokeWidth: 1,
      shadowColor: '#00000015', shadowBlur: 8, shadowOffset: { x: 2, y: 2 },
    }));

    // Sarlavha
    layer.add(new Konva.Text({
      x: PAD + DIM_H, y: PAD,
      width: drawW,
      text: elev.label.toUpperCase(),
      fontSize: 14, fontStyle: 'bold', fill: C_TEXT, align: 'center',
    }));

    const OX = PAD + DIM_H;               // chiziq chap X
    const OY = PAD + TITLE_H + DIM_H;     // ±0.000 chizig'i Y
    const baseY = OY + drawH;             // zamin Y (pastki)

    // ── Osmon ──────────────────────────────────────────────────────────────
    layer.add(new Konva.Rect({
      x: OX, y: OY,
      width: drawW, height: drawH,
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint:   { x: 0, y: drawH },
      fillLinearGradientColorStops: [0, C_SKY, 1, '#f0f8ff'],
    }));

    // ── Devor materiali (fon tekstura) ─────────────────────────────────────
    drawWallMaterial(layer, elev, OX, OY, drawW, drawH, U);

    // ── Tom chizish ────────────────────────────────────────────────────────
    drawRoof(layer, elev.roof, elev, OX, OY, drawW, U, elev.colors);

    // ── Qavat chiziqlari (ichki) ───────────────────────────────────────────
    let floorY = baseY;
    for (let f = 0; f < schema.floorCount; f++) {
      const fh = elev.floors[f]?.height ?? schema.floorHeight;
      const fy = baseY - (f + 1) * fh * U;
      // Qavat ajratuv chizig'i
      if (f > 0) {
        layer.add(new Konva.Line({
          points: [OX, fy, OX + drawW, fy],
          stroke: '#00000018', strokeWidth: 0.8, dash: [8, 4],
        }));
      }
      floorY = fy;
    }
    void floorY;

    // ── Oynalar ───────────────────────────────────────────────────────────
    for (const floor of elev.floors) {
      const fh   = floor.height ?? schema.floorHeight;
      const fy0  = baseY - (floor.index + 1) * fh * U;  // qavat pastki Y
      for (const win of floor.windows) {
        drawWindow(layer, win, OX + win.x * U, fy0 + (fh - win.sill - win.height) * U,
          win.width * U, win.height * U, elev.colors, win.style);

        // Balkon
        if (win.hasBalcony && floor.hasBalcony) {
          drawBalcony(layer,
            OX + win.x * U - 0.15 * U,
            fy0 + (fh - win.sill) * U,
            (win.width + 0.3) * U,
            (floor.balconyDepth ?? 1.2) * U * 0.4,
            elev.colors.accent,
          );
        }
      }
    }

    // ── Eshiklar ──────────────────────────────────────────────────────────
    for (const door of elev.doors) {
      const dx = OX + door.x * U;
      const dy = baseY - door.height * U;
      drawDoor(layer, door, dx, dy, door.width * U, door.height * U, elev.colors);
      if (door.hasCanopy) {
        drawCanopy(layer, dx - 0.2 * U, dy - 0.08 * U,
          (door.width + 0.4) * U, (door.canopyDepth ?? 1.0) * U * 0.3,
          elev.colors.trim);
      }
    }

    // ── Arxitektura bezaklari ──────────────────────────────────────────────
    for (const dec of elev.decorations) {
      drawDecoration(layer, dec, OX, OY, drawW, drawH, U, elev.colors);
    }

    // ── Devor konturi (asosiy) ─────────────────────────────────────────────
    layer.add(new Konva.Rect({
      x: OX, y: OY,
      width: drawW, height: drawH,
      stroke: '#1a1a2e', strokeWidth: 2.5, fill: 'transparent',
    }));

    // ── Zamin ─────────────────────────────────────────────────────────────
    drawGround(layer, OX, baseY, drawW, U);

    // ── O'lchov chiziqlari ─────────────────────────────────────────────────
    drawDimensions(layer, elev, OX, OY, baseY, drawW, drawH, U, schema);

    // ── Elevatsiya belgilari (±0.000) ──────────────────────────────────────
    drawLevelMarks(layer, elev, OX, OY, baseY, drawW, U, schema);

    // ── Masshtab satri ─────────────────────────────────────────────────────
    drawScaleBar(layer, OX, baseY + DIM_H + 10, U, schema.scale);

    // ── Shtamp ─────────────────────────────────────────────────────────────
    drawStamp(layer, OX, baseY + DIM_H + 28, drawW, schema);

    layer.draw();

    // Zoom
    stage.on('wheel', e => {
      e.evt.preventDefault();
      const sb = 1.1, old = stage.scaleX();
      const ptr = stage.getPointerPosition()!;
      const next = Math.max(0.1, Math.min(8, e.evt.deltaY < 0 ? old * sb : old / sb));
      stage.scale({ x: next, y: next });
      stage.position({
        x: ptr.x - (ptr.x - stage.x()) * next / old,
        y: ptr.y - (ptr.y - stage.y()) * next / old,
      });
    });

    return () => { stage.destroy(); stageRef.current = null; };
  }, [schema, activeIdx]);

  return (
    <div className="flex flex-col h-full">
      {/* Fasad tanlash tablari */}
      {schema.elevations.length > 1 && (
        <div className="flex gap-1 px-4 py-2 border-b border-white/10 bg-black/20 shrink-0">
          {schema.elevations.map((elev, i) => (
            <button key={elev.id} onClick={() => setActiveIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${i === activeIdx
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
              {elev.label.split('(')[0].trim()}
            </button>
          ))}
        </div>
      )}
      <div ref={containerRef} className="flex-1" style={{ cursor: 'grab', background: '#f8fafc' }} />
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── Chizish funksiyalari ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ── Devor materiali ───────────────────────────────────────────────────────────
function drawWallMaterial(
  layer: Konva.Layer, elev: FacadeElevation,
  ox: number, oy: number, dw: number, dh: number, U: number,
) {
  const col  = elev.colors.wall;
  const mat  = elev.material;

  // Asosiy to'ldirish
  layer.add(new Konva.Rect({ x: ox, y: oy, width: dw, height: dh, fill: col }));

  if (mat === 'brick') {
    // G'isht naqshi — gorizontal qatorlar
    const bW = U * 0.25, bH = U * 0.08;
    for (let row = 0; row * bH < dh; row++) {
      const offset = (row % 2) * bW * 0.5;
      for (let col2 = -bW; col2 < dw + bW; col2 += bW) {
        layer.add(new Konva.Rect({
          x: ox + col2 + offset, y: oy + row * bH,
          width: bW - 1, height: bH - 0.8,
          fill: col, stroke: '#00000025', strokeWidth: 0.5,
        }));
      }
    }
  } else if (mat === 'stone') {
    // Tosh — notekis to'rtburchaklar
    const sx = U * 0.35, sy = U * 0.2;
    for (let row = 0; row * sy < dh; row += 1) {
      let x = 0;
      while (x < dw) {
        const sw = sx * (0.7 + Math.random() * 0.7);
        layer.add(new Konva.Rect({
          x: ox + x, y: oy + row * sy,
          width: Math.min(sw, dw - x), height: sy - 1,
          fill: col, stroke: '#00000020', strokeWidth: 0.8, cornerRadius: 1,
        }));
        x += sw;
      }
    }
  } else if (mat === 'concrete') {
    // Beton — silliq, ingichka gorizontal chiziqlar
    for (let y = 0; y < dh; y += U * 0.6) {
      layer.add(new Konva.Line({
        points: [ox, oy + y, ox + dw, oy + y],
        stroke: '#00000010', strokeWidth: 0.5,
      }));
    }
  } else if (mat === 'wood') {
    // Yog'och — vertikal panellar
    const pw = U * 0.2;
    for (let x = 0; x < dw; x += pw) {
      layer.add(new Konva.Rect({
        x: ox + x, y: oy, width: pw - 1, height: dh,
        fill: col, stroke: '#00000018', strokeWidth: 0.6,
      }));
    }
  } else if (mat === 'composite') {
    // Kompozit — tekis panellar
    const ph = U * 0.9;
    for (let y = 0; y < dh; y += ph) {
      layer.add(new Konva.Rect({
        x: ox, y: oy + y, width: dw, height: ph - 1,
        fill: col, stroke: '#00000012', strokeWidth: 0.5,
      }));
    }
  } else if (mat === 'metal') {
    // Metal — diagonal chiziqlar
    for (let x = -dh; x < dw + dh; x += U * 0.3) {
      layer.add(new Konva.Line({
        points: [ox + x, oy, ox + x + dh, oy + dh],
        stroke: '#00000008', strokeWidth: 0.4,
      }));
    }
  }
  // plaster — silliq, hech narsa qo'shilmaydi
}

// ── Tom ───────────────────────────────────────────────────────────────────────
function drawRoof(
  layer: Konva.Layer, roof: FacadeRoof, elev: FacadeElevation,
  ox: number, oy: number, dw: number, U: number,
  colors: FacadeElevation['colors'],
) {
  const col  = roof.color ?? colors.roof;
  const over = (roof.overhang ?? 0) * U;
  const ph   = (roof.parapetH ?? 0) * U;

  if (roof.type === 'flat' || roof.type === 'parapet') {
    // Tekis tom — parapet bilan
    if (ph > 0) {
      layer.add(new Konva.Rect({
        x: ox - over, y: oy - ph,
        width: dw + over * 2, height: ph,
        fill: col, stroke: '#00000040', strokeWidth: 1.5,
      }));
    }
    // Tom qatlami
    layer.add(new Konva.Rect({
      x: ox - over - 2, y: oy - ph - U * 0.12,
      width: dw + over * 2 + 4, height: U * 0.12,
      fill: '#888890', stroke: '#555560', strokeWidth: 0.8,
    }));
    return;
  }

  if (roof.type === 'gable') {
    const ridgeH = (roof.ridgeH ?? dw * 0.28) * U / dw * dw;
    // Uchburchak tom
    const pts = [
      ox - over, oy,
      ox + dw / 2, oy - ridgeH,
      ox + dw + over, oy,
    ];
    layer.add(new Konva.Line({
      points: pts, closed: true,
      fill: col, stroke: '#1a1a2e', strokeWidth: 1.8,
    }));
    // Tizma
    layer.add(new Konva.Line({
      points: [ox - over, oy, ox - over - 4, oy + 6],
      stroke: '#1a1a2e', strokeWidth: 1.2,
    }));
    layer.add(new Konva.Line({
      points: [ox + dw + over, oy, ox + dw + over + 4, oy + 6],
      stroke: '#1a1a2e', strokeWidth: 1.2,
    }));
    // Oluq (gutter)
    if (roof.hasGutters && over >= 0) {
      layer.add(new Konva.Arc({
        x: ox - over, y: oy + 4,
        innerRadius: 4, outerRadius: 8,
        angle: 180, rotation: 0,
        fill: '#a0a8b0', stroke: '#707880', strokeWidth: 0.8,
      }));
      layer.add(new Konva.Arc({
        x: ox + dw + over, y: oy + 4,
        innerRadius: 4, outerRadius: 8,
        angle: 180, rotation: 0,
        fill: '#a0a8b0', stroke: '#707880', strokeWidth: 0.8,
      }));
    }
    return;
  }

  if (roof.type === 'shed') {
    // Bir qiyalik — chapdan o'ngga tushadi
    const ridgeH = (roof.ridgeH ?? dw * 0.1) * U / dw * dw;
    const pts = [
      ox - over, oy - ridgeH,
      ox + dw + over, oy,
      ox + dw + over, oy + U * 0.12,
      ox - over, oy - ridgeH + U * 0.12,
    ];
    layer.add(new Konva.Line({
      points: pts, closed: true,
      fill: col, stroke: '#1a1a2e', strokeWidth: 1.6,
    }));
    return;
  }

  if (roof.type === 'mansard') {
    // Mansard — 2 qismli
    const ridgeH = (roof.ridgeH ?? dw * 0.25) * U / dw * dw;
    const midW = dw * 0.55;
    const midX = ox + (dw - midW) / 2;
    // Yuqori tekis qism
    layer.add(new Konva.Rect({
      x: midX, y: oy - ridgeH,
      width: midW, height: ridgeH * 0.4,
      fill: col, stroke: '#1a1a2e', strokeWidth: 1.4,
    }));
    // Qiyalik qismlar
    layer.add(new Konva.Line({
      points: [ox - over, oy, midX, oy - ridgeH * 0.6],
      stroke: col, strokeWidth: U * 0.18,
    }));
    layer.add(new Konva.Line({
      points: [ox + dw + over, oy, midX + midW, oy - ridgeH * 0.6],
      stroke: col, strokeWidth: U * 0.18,
    }));
    // Kontur
    layer.add(new Konva.Line({
      points: [
        ox - over, oy,
        midX, oy - ridgeH * 0.6,
        midX, oy - ridgeH,
        midX + midW, oy - ridgeH,
        midX + midW, oy - ridgeH * 0.6,
        ox + dw + over, oy,
      ],
      stroke: '#1a1a2e', strokeWidth: 1.6,
    }));
    return;
  }

  if (roof.type === 'hip') {
    // 4 qiyalik — uchburchakka o'xshash lekin tizma kichik
    const ridgeH = (roof.ridgeH ?? dw * 0.22) * U / dw * dw;
    const ridgeW = dw * 0.4;
    const ridgeX = ox + (dw - ridgeW) / 2;
    layer.add(new Konva.Line({
      points: [
        ox - over,         oy,
        ridgeX,            oy - ridgeH,
        ridgeX + ridgeW,   oy - ridgeH,
        ox + dw + over,    oy,
      ],
      closed: false,
      stroke: col, strokeWidth: U * 0.18,
    }));
    layer.add(new Konva.Line({
      points: [
        ox - over, oy,
        ridgeX, oy - ridgeH,
        ridgeX + ridgeW, oy - ridgeH,
        ox + dw + over, oy,
      ],
      closed: true, fill: col + 'cc',
      stroke: '#1a1a2e', strokeWidth: 1.6,
    }));
    return;
  }
}

// ── Oyna ──────────────────────────────────────────────────────────────────────
function drawWindow(
  layer: Konva.Layer,
  win:   FacadeWindow,
  x: number, y: number, w: number, h: number,
  colors: FacadeElevation['colors'],
  style: FacadeWindow['style'],
) {
  const frame   = 3;
  const glass   = colors.window;
  const frameC  = '#1e3050';

  // Nalichnik (devor orqasidagi ram)
  layer.add(new Konva.Rect({
    x: x - 5, y: y - 5, width: w + 10, height: h + 10,
    fill: colors.trim, stroke: frameC, strokeWidth: 0.5, cornerRadius: 1,
  }));

  // Asosiy oyna rami
  layer.add(new Konva.Rect({
    x, y, width: w, height: h,
    fill: glass, stroke: frameC, strokeWidth: frame,
    ...(style === 'arched' ? {} : {}),
  }));

  // Oyna ichidagi shisha tasviri (yaltiroq chiziq)
  layer.add(new Konva.Line({
    points: [x + w * 0.18, y + h * 0.12, x + w * 0.38, y + h * 0.35],
    stroke: '#ffffff80', strokeWidth: 2, lineCap: 'round',
  }));

  if (style === 'arched') {
    // Yumaloq yuqori qism
    const arcR = Math.max(1, w / 2);
    layer.add(new Konva.Arc({
      x: x + w / 2, y: y,
      innerRadius: 0, outerRadius: arcR,
      angle: 180, rotation: 0,
      fill: glass, stroke: frameC, strokeWidth: frame,
    }));
  }

  if (style === 'panoramic' || style === 'floor_to_ceiling') {
    // Vertikal bo'linma — 2 qism
    layer.add(new Konva.Line({
      points: [x + w / 2, y, x + w / 2, y + h],
      stroke: frameC, strokeWidth: frame - 0.5,
    }));
  } else if (style === 'grid') {
    // Grid — to'rga bo'lingan
    const cols = Math.max(2, Math.round(w / (h * 0.7)));
    const rows = Math.max(2, Math.round(h / (w / cols * 1.2)));
    for (let c = 1; c < cols; c++) {
      layer.add(new Konva.Line({
        points: [x + c * w / cols, y, x + c * w / cols, y + h],
        stroke: frameC, strokeWidth: 1.5,
      }));
    }
    for (let r = 1; r < rows; r++) {
      layer.add(new Konva.Line({
        points: [x, y + r * h / rows, x + w, y + r * h / rows],
        stroke: frameC, strokeWidth: 1.5,
      }));
    }
  } else if (style === 'horizontal') {
    // Gorizontal — yon tomonlarga cho'zilgan
    layer.add(new Konva.Line({
      points: [x, y + h / 2, x + w, y + h / 2],
      stroke: frameC, strokeWidth: frame - 0.5,
    }));
  } else {
    // Standard — gorizontal + vertikal bo'linma
    layer.add(new Konva.Line({
      points: [x, y + h / 2, x + w, y + h / 2],
      stroke: frameC, strokeWidth: 1.8,
    }));
    layer.add(new Konva.Line({
      points: [x + w / 2, y, x + w / 2, y + h],
      stroke: frameC, strokeWidth: 1.8,
    }));
  }

  // Panjura (shutter) — chap va o'ngda
  if (win.hasShutter) {
    const sw = Math.min(w * 0.25, 18);
    [x - sw - 3, x + w + 3].forEach(sx => {
      layer.add(new Konva.Rect({
        x: sx, y, width: sw, height: h,
        fill: colors.accent + '99', stroke: colors.trim,
        strokeWidth: 0.8, cornerRadius: 1,
      }));
      // Shutter chiziqlari
      for (let s = 0; s < h; s += 8) {
        layer.add(new Konva.Line({
          points: [sx + 1, y + s, sx + sw - 1, y + s],
          stroke: colors.trim + '80', strokeWidth: 0.6,
        }));
      }
    });
  }
}

// ── Eshik ─────────────────────────────────────────────────────────────────────
function drawDoor(
  layer: Konva.Layer, door: FacadeDoor,
  x: number, y: number, w: number, h: number,
  colors: FacadeElevation['colors'],
) {
  const frameC = '#3a2010';

  // Eshik rami
  layer.add(new Konva.Rect({
    x: x - 5, y: y - 5, width: w + 10, height: h + 10,
    fill: colors.trim, stroke: frameC, strokeWidth: 0.8,
  }));

  // Eshik yuzasi
  layer.add(new Konva.Rect({
    x, y, width: w, height: h,
    fill: colors.door, stroke: frameC, strokeWidth: 3,
  }));

  if (door.style === 'double' || door.style === 'sliding') {
    // Ikki qanotli eshik
    layer.add(new Konva.Line({
      points: [x + w / 2, y, x + w / 2, y + h],
      stroke: frameC, strokeWidth: 2.5,
    }));
    // Panel chiziqlari
    [0.25, 0.6].forEach(ratio => {
      layer.add(new Konva.Rect({
        x: x + 6, y: y + h * ratio - 12,
        width: w / 2 - 12, height: 24,
        fill: 'transparent', stroke: frameC + '60', strokeWidth: 1,
      }));
      layer.add(new Konva.Rect({
        x: x + w / 2 + 6, y: y + h * ratio - 12,
        width: w / 2 - 12, height: 24,
        fill: 'transparent', stroke: frameC + '60', strokeWidth: 1,
      }));
    });
    // Qo'l tutgich
    layer.add(new Konva.Rect({
      x: x + w / 2 - 6, y: y + h * 0.45,
      width: 4, height: 18,
      fill: '#c0a868', stroke: '#808050', strokeWidth: 0.8, cornerRadius: 2,
    }));
    layer.add(new Konva.Rect({
      x: x + w / 2 + 2, y: y + h * 0.45,
      width: 4, height: 18,
      fill: '#c0a868', stroke: '#808050', strokeWidth: 0.8, cornerRadius: 2,
    }));
  } else if (door.style === 'arched') {
    // Yumaloq ustki qism
    const doorArcR = Math.max(1, w / 2);
    layer.add(new Konva.Arc({
      x: x + w / 2, y,
      innerRadius: 0, outerRadius: doorArcR,
      angle: 180, rotation: 0,
      fill: colors.door, stroke: frameC, strokeWidth: 2.5,
    }));
    // Panel
    layer.add(new Konva.Rect({
      x: x + 8, y: y + h * 0.15,
      width: w - 16, height: h * 0.5,
      fill: 'transparent', stroke: frameC + '50', strokeWidth: 1,
    }));
    // Qo'l tutgich
    layer.add(new Konva.Circle({
      x: x + w - 14, y: y + h * 0.55,
      radius: 5, fill: '#c0a868', stroke: '#808050', strokeWidth: 0.8,
    }));
  } else {
    // Oddiy eshik — panel bilan
    [0.2, 0.55].forEach(ratio => {
      layer.add(new Konva.Rect({
        x: x + 8, y: y + h * ratio,
        width: w - 16, height: h * 0.22,
        fill: 'transparent', stroke: frameC + '50', strokeWidth: 1.2,
      }));
    });
    // Qo'l tutgich
    layer.add(new Konva.Rect({
      x: x + w - 14, y: y + h * 0.48,
      width: 4, height: 18,
      fill: '#c0a868', stroke: '#808050', strokeWidth: 0.8, cornerRadius: 2,
    }));
    // Qo'ng'iroq
    layer.add(new Konva.Circle({
      x: x - 20, y: y + h * 0.35,
      radius: 4, fill: '#f0c040', stroke: '#a08020', strokeWidth: 0.8,
    }));
  }

  // Eshik ostidagi bosqich
  layer.add(new Konva.Rect({
    x: x - 15, y: y + h,
    width: w + 30, height: 8,
    fill: '#c0b0a0', stroke: '#908070', strokeWidth: 0.8,
  }));
  layer.add(new Konva.Rect({
    x: x - 20, y: y + h + 8,
    width: w + 40, height: 6,
    fill: '#b0a090', stroke: '#807060', strokeWidth: 0.6,
  }));
}

// ── Balkon ────────────────────────────────────────────────────────────────────
function drawBalcony(
  layer: Konva.Layer,
  x: number, y: number, w: number, h: number,
  color: string,
) {
  // Plita
  layer.add(new Konva.Rect({
    x, y, width: w, height: 10,
    fill: '#d0c8b8', stroke: '#808070', strokeWidth: 1.2,
  }));
  // Panjara (balustrада)
  const step = w / Math.max(4, Math.round(w / 12));
  for (let bx = 0; bx < w; bx += step) {
    layer.add(new Konva.Line({
      points: [x + bx + step / 2, y + 10, x + bx + step / 2, y + h],
      stroke: color, strokeWidth: 1.8,
    }));
  }
  // Tepa qo'lliq
  layer.add(new Konva.Line({
    points: [x, y + 10, x + w, y + 10],
    stroke: color, strokeWidth: 2.5,
  }));
  layer.add(new Konva.Line({
    points: [x, y + h, x + w, y + h],
    stroke: color, strokeWidth: 1.5,
  }));
}

// ── Soyabon (canopy) ──────────────────────────────────────────────────────────
function drawCanopy(
  layer: Konva.Layer,
  x: number, y: number, w: number, h: number,
  color: string,
) {
  layer.add(new Konva.Line({
    points: [x, y, x + w, y, x + w - h, y + h, x + h, y + h],
    closed: true,
    fill: color + 'cc', stroke: color, strokeWidth: 1.5,
  }));
}

// ── Bezaklar ──────────────────────────────────────────────────────────────────
function drawDecoration(
  layer: Konva.Layer, dec: FacadeDecoration,
  ox: number, oy: number, dw: number, dh: number, U: number,
  colors: FacadeElevation['colors'],
) {
  const col  = dec.color ?? colors.trim;
  const h    = (dec.height ?? 0.2) * U;
  const y    = dec.y !== undefined ? oy + dec.y * U : oy;

  if (dec.type === 'cornice') {
    // Kornis — devor ustidagi bezak
    layer.add(new Konva.Rect({
      x: ox - 6, y: oy - h,
      width: dw + 12, height: h,
      fill: col, stroke: col + 'aa', strokeWidth: 0.8,
    }));
    // Profil
    layer.add(new Konva.Line({
      points: [ox - 6, oy, ox - 6, oy - h, ox + dw + 6, oy - h, ox + dw + 6, oy],
      stroke: '#00000025', strokeWidth: 0.6,
    }));
  } else if (dec.type === 'belt') {
    // Kamar chizig'i — fasad bo'ylab gorizontal chiziq
    const by = dec.y !== undefined ? oy + dec.y * U : oy + dh * 0.33;
    layer.add(new Konva.Rect({
      x: ox, y: by,
      width: dw, height: h,
      fill: col, stroke: col + 'aa', strokeWidth: 0.5,
    }));
  } else if (dec.type === 'pilaster') {
    // Pilaster — vertikal ustun
    const sp = (dec.spacing ?? 3.5) * U;
    for (let px = 0; px < dw; px += sp) {
      layer.add(new Konva.Rect({
        x: ox + px - 8, y: oy,
        width: 16, height: dh,
        fill: col + '40', stroke: col, strokeWidth: 0.8,
      }));
    }
  } else if (dec.type === 'quoin') {
    // Burchak toshi — burchaklarda bezak
    const qw = 20, qh = 30;
    [ox - 4, ox + dw - qw + 4].forEach(qx => {
      for (let qy = oy; qy < oy + dh; qy += qh * 1.5) {
        layer.add(new Konva.Rect({
          x: qx, y: qy,
          width: qw, height: qh,
          fill: col, stroke: col + 'aa', strokeWidth: 0.8,
        }));
      }
    });
  } else if (dec.type === 'panel') {
    // Panel — tekis qoplama chiziq
    layer.add(new Konva.Line({
      points: [ox, oy + dh - h, ox + dw, oy + dh - h],
      stroke: col, strokeWidth: h,
    }));
  } else if (dec.type === 'fins') {
    // Vertikal qanot (sun shading fins)
    const sp = (dec.spacing ?? 1.2) * U;
    for (let fx = 0; fx < dw; fx += sp) {
      layer.add(new Konva.Line({
        points: [ox + fx, oy, ox + fx - (dec.height ?? 0.1) * U, oy + dh],
        stroke: col, strokeWidth: 3,
      }));
    }
  } else if (dec.type === 'rustication') {
    // Rustik — pastki qismda yirik tosh ko'rinishi
    const rh = (dec.height ?? 1.0) * U;
    layer.add(new Konva.Rect({
      x: ox, y: oy + dh - rh,
      width: dw, height: rh,
      fill: col + '80', stroke: col, strokeWidth: 0.6,
    }));
    // Tosh chiziqlari
    for (let ry = oy + dh - rh; ry < oy + dh; ry += rh / 3) {
      layer.add(new Konva.Line({
        points: [ox, ry, ox + dw, ry],
        stroke: col, strokeWidth: 0.8,
      }));
    }
  }
}

// ── Zamin ─────────────────────────────────────────────────────────────────────
function drawGround(layer: Konva.Layer, ox: number, baseY: number, dw: number, U: number) {
  // Zamin asosiy chiziq
  layer.add(new Konva.Line({
    points: [ox - 30, baseY, ox + dw + 30, baseY],
    stroke: C_GROUND, strokeWidth: 3,
  }));
  // Zamin to'ldirish
  layer.add(new Konva.Rect({
    x: ox - 30, y: baseY,
    width: dw + 60, height: U * 0.5,
    fillLinearGradientStartPoint: { x: 0, y: 0 },
    fillLinearGradientEndPoint:   { x: 0, y: U * 0.5 },
    fillLinearGradientColorStops: [0, '#6a5040', 1, '#4a3428'],
  }));
  // O't
  for (let gx = ox - 20; gx < ox + dw + 20; gx += 18) {
    layer.add(new Konva.Line({
      points: [gx, baseY, gx - 3, baseY - 8, gx + 1, baseY - 12],
      stroke: '#3a7a30', strokeWidth: 1.5, lineCap: 'round',
    }));
    layer.add(new Konva.Line({
      points: [gx + 9, baseY, gx + 12, baseY - 9],
      stroke: '#4a8a3a', strokeWidth: 1.2, lineCap: 'round',
    }));
  }
}

// ── O'lchov chiziqlari ────────────────────────────────────────────────────────
function drawDimensions(
  layer: Konva.Layer, elev: FacadeElevation,
  ox: number, oy: number, baseY: number,
  dw: number, dh: number, U: number, schema: FacadeSchema,
) {
  const dimY = baseY + 28;
  const dimX = ox - 38;

  // Umumiy kenglik
  drawDimLine(layer, ox, dimY, ox + dw, dimY, `${elev.totalWidth.toFixed(2)} m`, 'h');

  // Har qavat balandligi (o'ngda)
  let curY = baseY;
  for (let f = 0; f < schema.floorCount; f++) {
    const fh = (elev.floors[f]?.height ?? schema.floorHeight) * U;
    drawDimLine(layer, ox + dw + 20, curY - fh, ox + dw + 20, curY,
      `${(elev.floors[f]?.height ?? schema.floorHeight).toFixed(1)}m`, 'v');
    curY -= fh;
  }

  // Tom balandligi
  const roofH = dh - schema.floorCount * schema.floorHeight * U;
  if (roofH > 0) {
    drawDimLine(layer, ox + dw + 20, oy, ox + dw + 20, oy + roofH,
      `${(roofH / U).toFixed(1)}m`, 'v');
  }

  // Umumiy balandlik (eng o'ngda)
  drawDimLine(layer, ox + dw + 48, oy, ox + dw + 48, baseY,
    `${elev.totalHeight.toFixed(2)} m`, 'v');

  void dimX;
}

function drawDimLine(
  layer: Konva.Layer,
  x1: number, y1: number, x2: number, y2: number,
  text: string, dir: 'h' | 'v',
) {
  const isH = dir === 'h';
  const offset = isH ? 0 : 0;

  // Asosiy chiziq
  layer.add(new Konva.Line({
    points: isH ? [x1, y1, x2, y2] : [x1, y1, x2, y2],
    stroke: C_DIM, strokeWidth: 1,
  }));
  // Qirra belgilari
  const d = 5;
  if (isH) {
    [[x1, y1], [x2, y2]].forEach(([x, y]) => {
      layer.add(new Konva.Line({ points: [x!, y! - d, x!, y! + d], stroke: C_DIM, strokeWidth: 1 }));
    });
    layer.add(new Konva.Text({
      x: (x1 + x2) / 2 - 30, y: y1 + 6,
      text, fontSize: 9, fill: C_DIM, align: 'center', width: 60,
    }));
  } else {
    [[x1, y1], [x2, y2]].forEach(([x, y]) => {
      layer.add(new Konva.Line({ points: [x! - d, y!, x! + d, y!], stroke: C_DIM, strokeWidth: 1 }));
    });
    layer.add(new Konva.Text({
      x: x1 + 4 + offset, y: (y1 + y2) / 2 - 8,
      text, fontSize: 8.5, fill: C_DIM, rotation: 0,
    }));
  }
}

// ── Elevatsiya belgilari ───────────────────────────────────────────────────────
function drawLevelMarks(
  layer: Konva.Layer, elev: FacadeElevation,
  ox: number, oy: number, baseY: number,
  dw: number, U: number, schema: FacadeSchema,
) {
  let cumH = 0;
  const markX = ox - 55;

  // ±0.000
  drawLevelMark(layer, markX, baseY, '±0.000', dw + 60, ox);

  for (let f = 0; f < schema.floorCount; f++) {
    cumH += (elev.floors[f]?.height ?? schema.floorHeight);
    const lv = cumH.toFixed(3);
    const ly = baseY - cumH * U;
    drawLevelMark(layer, markX, ly, `+${lv}`, dw + 60, ox);
  }
  void oy;
}

function drawLevelMark(
  layer: Konva.Layer,
  x: number, y: number, label: string, len: number, lineX: number,
) {
  // Uzun gorizontal chiziq
  layer.add(new Konva.Line({
    points: [lineX - 10, y, lineX + len, y],
    stroke: C_AXIS, strokeWidth: 0.8, dash: [8, 4],
  }));
  // Uchburchak belgi
  layer.add(new Konva.Line({
    points: [x, y - 5, x + 12, y, x, y + 5],
    closed: true, fill: C_AXIS, stroke: C_AXIS, strokeWidth: 0.5,
  }));
  // Matn
  layer.add(new Konva.Text({
    x: x + 14, y: y - 8,
    text: label, fontSize: 8.5, fill: C_DIM,
  }));
}

// ── Masshtab satri ────────────────────────────────────────────────────────────
function drawScaleBar(
  layer: Konva.Layer,
  ox: number, y: number, U: number, scale: string,
) {
  // 5m ni masshtabda ko'rsatish
  const barLen = 5 * U;
  layer.add(new Konva.Rect({ x: ox, y, width: barLen, height: 6, fill: '#1a1a2e' }));
  layer.add(new Konva.Rect({ x: ox + barLen / 5, y, width: barLen / 5, height: 6, fill: '#ffffff' }));
  layer.add(new Konva.Rect({ x: ox + barLen * 3 / 5, y, width: barLen / 5, height: 6, fill: '#ffffff' }));
  ['0', '1', '2', '3', '4', '5 m'].forEach((t, i) => {
    layer.add(new Konva.Text({
      x: ox + i * barLen / 5 - 5, y: y + 10,
      text: t, fontSize: 8, fill: C_DIM,
    }));
  });
  layer.add(new Konva.Text({
    x: ox + barLen + 10, y: y - 1,
    text: `Masshtab: ${scale}`, fontSize: 9, fill: C_DIM, fontStyle: 'bold',
  }));
}

// ── Shtamp (title block) ───────────────────────────────────────────────────────
function drawStamp(
  layer: Konva.Layer,
  ox: number, y: number, dw: number,
  schema: FacadeSchema,
) {
  const sw = dw;
  const sh = 52;
  // Shtamp fon
  layer.add(new Konva.Rect({
    x: ox, y, width: sw, height: sh,
    fill: '#ffffff', stroke: '#1a1a2e', strokeWidth: 1.5,
  }));
  // Bo'linmalar
  const cols = [sw * 0.55, sw * 0.15, sw * 0.15, sw * 0.15];
  let cx = ox;
  cols.forEach(cw => {
    layer.add(new Konva.Line({ points: [cx + cw, y, cx + cw, y + sh], stroke: '#1a1a2e', strokeWidth: 0.8 }));
    cx += cw;
  });
  // Gorizontal bo'linma
  layer.add(new Konva.Line({ points: [ox, y + sh * 0.48, ox + sw, y + sh * 0.48], stroke: '#1a1a2e', strokeWidth: 0.6 }));

  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2,'0')}.${(now.getMonth()+1).toString().padStart(2,'0')}.${now.getFullYear()}`;

  // Loyiha nomi
  layer.add(new Konva.Text({
    x: ox + 6, y: y + 4,
    text: schema.name.toUpperCase(),
    fontSize: 10, fontStyle: 'bold', fill: C_TEXT,
    width: sw * 0.55 - 12,
  }));
  layer.add(new Konva.Text({
    x: ox + 6, y: y + sh * 0.5 + 4,
    text: `${schema.floorCount}-qavatli bino · ${schema.style} uslubi`,
    fontSize: 8, fill: C_DIM,
  }));

  // O'ng bloklar
  const labels = ['SNiP 2.08.01-89', `${dateStr}`, schema.scale, 'AR'];
  labels.forEach((l, i) => {
    layer.add(new Konva.Text({
      x: ox + sw * 0.55 + i * sw * 0.15 + 4, y: y + 4,
      text: ['Standart', 'Sana', 'Masshtab', 'Bo\'lim'][i],
      fontSize: 7, fill: '#888888', width: sw * 0.15 - 8,
    }));
    layer.add(new Konva.Text({
      x: ox + sw * 0.55 + i * sw * 0.15 + 4, y: y + sh * 0.5 + 4,
      text: l, fontSize: 8.5, fontStyle: 'bold', fill: C_TEXT,
      width: sw * 0.15 - 8,
    }));
  });
  void C_GRID;
}

FacadeCanvas2D.displayName = 'FacadeCanvas2D';
export default FacadeCanvas2D;
