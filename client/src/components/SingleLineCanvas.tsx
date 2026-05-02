import { useEffect, useRef, useState, useCallback } from 'react';
import Konva from 'konva';
import type { ElectricalPanel } from '../../../shared/types';
import ZoomToolbar from './ZoomToolbar';
import { setupKonvaZoom, resetKonvaZoom, zoomInKonva, zoomOutKonva, MIN_ZOOM, MAX_ZOOM } from '../lib/konvaZoom';

interface Props {
  panel: ElectricalPanel;
  width?: number;
}

const CIRCUIT_COLOR: Record<string, string> = {
  lighting:    '#92400e',
  socket:      '#5b21b6',
  specialized: '#991b1b',
  bathroom:    '#0e7490',
};

function circuitColor(type: string, hasRcd?: boolean) {
  if (hasRcd) return CIRCUIT_COLOR.bathroom;
  return CIRCUIT_COLOR[type] ?? '#333';
}

function vline(layer: Konva.Layer, x: number, y1: number, y2: number, color: string, w = 1.5) {
  layer.add(new Konva.Line({ points: [x, y1, x, y2], stroke: color, strokeWidth: w }));
}

function drawBreakerAt(layer: Konva.Layer, x: number, y: number, amps: number, color: string) {
  layer.add(new Konva.Rect({ x: x - 9, y, width: 18, height: 26, stroke: color, strokeWidth: 1.5, fill: '#fff' }));
  layer.add(new Konva.Line({ points: [x - 9, y + 26, x + 9, y], stroke: color, strokeWidth: 1.5 }));
  layer.add(new Konva.Text({ x: x - 14, y: y + 28, width: 28, text: `${amps}A`, fontSize: 9, align: 'center', fill: color }));
}

function drawRcdAt(layer: Konva.Layer, x: number, y: number) {
  const midY = y + 16;
  layer.add(new Konva.Rect({ x: x - 10, y, width: 20, height: 32, stroke: '#0e7490', strokeWidth: 1.5, fill: '#e0f2fe' }));
  layer.add(new Konva.Line({ points: [x - 10, midY, x + 10, midY], stroke: '#0e7490', strokeWidth: 0.8 }));
  layer.add(new Konva.Line({ points: [x - 10, midY, x + 10, y], stroke: '#0e7490', strokeWidth: 1.5 }));
  layer.add(new Konva.Text({ x: x - 10, y: midY + 2, width: 20, text: 'УЗО', fontSize: 7, align: 'center', fill: '#0e7490' }));
}

function drawLoadAt(layer: Konva.Layer, x: number, y: number, color: string) {
  layer.add(new Konva.Line({ points: [x, y, x - 7, y + 13, x + 7, y + 13], closed: true, stroke: color, strokeWidth: 1.5, fill: '#ffffff44' }));
}

export default function SingleLineCanvas({ panel, width = 720 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef     = useRef<Konva.Stage | null>(null);
  const zoomRef      = useRef(1);
  const baseScRef    = useRef(1);
  const [zoom, setZoomState] = useState(1);

  const zoomIn    = useCallback(() => { const s = stageRef.current; if (s) zoomInKonva(s, baseScRef.current, zoomRef, setZoomState); }, []);
  const zoomOut   = useCallback(() => { const s = stageRef.current; if (s) zoomOutKonva(s, baseScRef.current, zoomRef, setZoomState); }, []);
  const resetZoom = useCallback(() => { const s = stageRef.current; if (s) resetKonvaZoom(s, baseScRef.current, zoomRef, setZoomState); }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    stageRef.current?.destroy(); stageRef.current = null;
    zoomRef.current = 1; setZoomState(1);

    const { circuits, mainBreaker, rcdAmps, totalLoad } = panel;
    const N = circuits.length;
    if (!N) return;

    const COL_W = Math.max(68, Math.min(96, (width - 80) / N));
    const totalBusW = N * COL_W;
    const cx = width / 2;
    const busStartX = cx - totalBusW / 2;
    const busEndX   = cx + totalBusW / 2;
    const colCenters = circuits.map((_, i) => busStartX + COL_W * i + COL_W / 2);

    const BUS_Y = 150;
    const hasAnyRcd = circuits.some(c => c.hasRcd);
    const circuitZoneH = hasAnyRcd ? 164 : 118;
    const height = BUS_Y + circuitZoneH + 28;

    baseScRef.current = 1;
    const stage = new Konva.Stage({ container: el, width, height });
    stageRef.current = stage;
    const layer = new Konva.Layer();
    stage.add(layer);

    layer.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: '#fafafa' }));
    layer.add(new Konva.Rect({ x: 1, y: 1, width: width - 2, height: height - 2, stroke: '#bbb', strokeWidth: 1, fill: 'transparent' }));

    layer.add(new Konva.Text({ x: 0, y: 10, width, align: 'center', text: 'Elektr щiti — Bir chiziqli sxema (GOST 21.613)', fontSize: 12, fontStyle: 'bold', fill: '#111' }));
    layer.add(new Konva.Text({ x: cx - 28, y: 30, text: '~220 V / 50 Hz', fontSize: 10, fill: '#555' }));
    layer.add(new Konva.Text({ x: cx - 18, y: 42, text: 'L  N  PE', fontSize: 9, fill: '#888' }));

    vline(layer, cx, 54, 68, '#222', 2);

    drawBreakerAt(layer, cx, 68, mainBreaker, '#222');
    layer.add(new Konva.Text({ x: cx + 12, y: 72, text: `QF\n${mainBreaker}A`, fontSize: 8, fill: '#333', lineHeight: 1.3 }));

    vline(layer, cx, 94, 106, '#222', 2);

    const rcdTop = 106;
    const rcdMid = rcdTop + 18;
    layer.add(new Konva.Rect({ x: cx - 12, y: rcdTop, width: 24, height: 36, stroke: '#0e7490', strokeWidth: 1.8, fill: '#e0f2fe' }));
    layer.add(new Konva.Line({ points: [cx - 12, rcdMid, cx + 12, rcdMid], stroke: '#0e7490', strokeWidth: 0.8 }));
    layer.add(new Konva.Line({ points: [cx - 12, rcdMid, cx + 12, rcdTop], stroke: '#0e7490', strokeWidth: 2 }));
    layer.add(new Konva.Text({ x: cx - 12, y: rcdMid + 2, width: 24, text: 'УЗО', fontSize: 8, align: 'center', fill: '#0e7490' }));
    layer.add(new Konva.Text({ x: cx + 14, y: rcdTop + 4, text: `QD\n${rcdAmps}A`, fontSize: 8, fill: '#0e7490', lineHeight: 1.3 }));

    vline(layer, cx, rcdTop + 36, BUS_Y, '#222', 2);

    layer.add(new Konva.Line({ points: [busStartX, BUS_Y, busEndX, BUS_Y], stroke: '#222', strokeWidth: 3.5 }));
    layer.add(new Konva.Text({ x: busStartX, y: BUS_Y + 5, text: 'Magistral shina', fontSize: 8, fill: '#888' }));

    circuits.forEach((circ, i) => {
      const colX = colCenters[i];
      const color = circuitColor(circ.type, circ.hasRcd);
      let curY = BUS_Y;

      layer.add(new Konva.Rect({ x: colX - 8, y: curY - 16, width: 16, height: 14, fill: color, cornerRadius: 2 }));
      layer.add(new Konva.Text({ x: colX - 8, y: curY - 15, width: 16, align: 'center', text: circ.id.toUpperCase(), fontSize: 7.5, fill: '#fff' }));

      vline(layer, colX, curY, curY + 14, color);
      curY += 14;

      if (circ.hasRcd) {
        drawRcdAt(layer, colX, curY);
        curY += 34;
        vline(layer, colX, curY, curY + 8, color);
        curY += 8;
      }

      drawBreakerAt(layer, colX, curY, circ.breaker, color);
      curY += 40;

      vline(layer, colX, curY, curY + 10, color);
      curY += 10;

      drawLoadAt(layer, colX, curY, color);
      curY += 16;

      const fw = COL_W - 4;
      const lx = colX - fw / 2;
      layer.add(new Konva.Text({ x: lx, y: curY,      width: fw, align: 'center', text: circ.name,         fontSize: 9, fontStyle: 'bold', fill: color }));
      layer.add(new Konva.Text({ x: lx, y: curY + 12, width: fw, align: 'center', text: circ.cable,        fontSize: 8, fill: '#555' }));
      layer.add(new Konva.Text({ x: lx, y: curY + 22, width: fw, align: 'center', text: `${circ.power} W`, fontSize: 8, fill: '#777' }));
    });

    layer.add(new Konva.Text({ x: 8, y: height - 18, text: `Jami yuk: ${totalLoad} kVt  |  Asosiy avtomat: ${mainBreaker}A`, fontSize: 9, fill: '#555' }));

    layer.draw();

    const cleanup = setupKonvaZoom(stage, 1, zoomRef, setZoomState);
    return () => { cleanup(); stage.destroy(); };
  }, [panel, width]);

  return (
    <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden w-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
        <span className="text-xs text-slate-400">Bir chiziqli sxema · Scroll = zoom · Drag = pan</span>
        <ZoomToolbar zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={resetZoom} minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} />
      </div>
      <div ref={containerRef} className="bg-white w-full overflow-hidden cursor-grab active:cursor-grabbing" />
    </div>
  );
}
