import { useRef, forwardRef, useImperativeHandle, useEffect, useState, useCallback } from 'react';
import Konva from 'konva';
import jsPDF from 'jspdf';
import ZoomToolbar from './ZoomToolbar';
import type {
  DrawingData, Wall, PlacedFixture, Pipe, DimensionLine,
  DoorSpec, WindowSpec, StaircaseSpec, InterRoomDoor,
} from '../../../shared/types';
import { FIXTURE_DIMS, UNITS_PER_METER, WALL_THICKNESS as WALL_T } from '../../../shared/constants';

export interface Canvas2DHandle {
  exportToPdf: (filename?: string) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

interface Canvas2DProps {
  drawingData: DrawingData;
  width?: number;
  height?: number;
  scale?: number;
}

const FIXTURE_LABELS: Record<string, string> = {
  sink: 'Lavabo', toilet: 'Hojatxona', bathtub: 'Vanna', shower: 'Dush',
  stove: 'Plita', fridge: 'Muzlatgich', dishwasher: 'Idish yuv.',
  desk: 'Stol', bed: 'Karavot', wardrobe: 'Shkaf',
  sofa: 'Divan', tv_unit: 'TV', bookshelf: 'Kitob javon',
  armchair: 'Kreslo', coffee_table: 'Jurnal stol', dining_table: 'Ovqat stoli',
  chair: 'Stul', coat_rack: 'Kiyim ilgich',
};

const ROOM_COLORS: Record<string, string> = {
  kitchen:    '#fff9f0',
  oshxona:    '#fff9f0',
  bathroom:   '#f0f7ff',
  hammom:     '#f0f7ff',
  bedroom:    '#f5fff0',
  yotoqxona:  '#f5fff0',
  living:     '#fffff0',
  mehmonxona: '#fffff0',
  zal:        '#fffff0',
  office:     '#f9f5ff',
  ofis:       '#f9f5ff',
  hallway:    '#f5f5f5',
  koridor:    '#f5f5f5',
  default:    '#ffffff',
};

// Fixture type → room color (single-room heuristic)
function roomColorFromFixtures(fixtures: PlacedFixture[]): string {
  const types = new Set(fixtures.map(f => f.type));
  if (types.has('toilet') || types.has('bathtub') || types.has('shower')) return ROOM_COLORS.bathroom;
  if (types.has('stove') || types.has('fridge') || types.has('dishwasher'))  return ROOM_COLORS.kitchen;
  if (types.has('bed'))    return ROOM_COLORS.bedroom;
  if (types.has('sofa'))   return ROOM_COLORS.living;
  if (types.has('desk'))   return ROOM_COLORS.office;
  return ROOM_COLORS.default;
}

function roomColorFromName(name: string): string {
  const n = (name || '').toLowerCase();
  for (const [key, color] of Object.entries(ROOM_COLORS)) {
    if (key !== 'default' && n.includes(key)) return color;
  }
  return ROOM_COLORS.default;
}

const GRID_SIZE = 100;
const PAD = 130;
const DIM_OFFSET = 50;
const DIM_EXT = 12;
const TICK_SIZE = 10;

// ── Grid — aligned with room corners (offset = PAD % GRID_SIZE) ───────────────

function addGrid(layer: Konva.Layer, gridW: number, gridH: number) {
  const startOff = PAD % GRID_SIZE; // = 30, so dots at 30, 130, 230... → 130 = PAD ✓
  for (let i = startOff; i <= gridW; i += GRID_SIZE) {
    for (let j = startOff; j <= gridH; j += GRID_SIZE) {
      layer.add(new Konva.Circle({ x: i, y: j, radius: 0.8, fill: '#cccccc' }));
    }
  }
}

// ── Walls ─────────────────────────────────────────────────────────────────────

function addWall(layer: Konva.Layer, wall: Wall) {
  const offset = wall.thickness / 2;
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const nx = -dy / len;
  const ny =  dx / len;

  const sx = wall.start.x + PAD;
  const sy = wall.start.y + PAD;
  const ex = wall.end.x   + PAD;
  const ey = wall.end.y   + PAD;

  const ext = offset;
  const ux = dx / len;
  const uy = dy / len;
  const sxe = sx - ux * ext;
  const sye = sy - uy * ext;
  const exe = ex + ux * ext;
  const eye = ey + uy * ext;

  layer.add(new Konva.Line({
    points: [
      sxe + nx * offset, sye + ny * offset,
      exe + nx * offset, eye + ny * offset,
      exe - nx * offset, eye - ny * offset,
      sxe - nx * offset, sye - ny * offset,
    ],
    closed: true, fill: '#cccccc', stroke: '#cccccc', strokeWidth: 1,
  }));
  layer.add(new Konva.Line({
    points: [sx + nx * offset, sy + ny * offset, ex + nx * offset, ey + ny * offset],
    stroke: '#111111', strokeWidth: 2.5, lineCap: 'square',
  }));
  layer.add(new Konva.Line({
    points: [sx - nx * offset, sy - ny * offset, ex - nx * offset, ey - ny * offset],
    stroke: '#111111', strokeWidth: 1.5, lineCap: 'square',
  }));
}

// ── Pipes ─────────────────────────────────────────────────────────────────────

function addPipe(layer: Konva.Layer, pipe: Pipe) {
  const points = pipe.path.flatMap(p => [p.x + PAD, p.y + PAD]);
  const isDrain = pipe.type === 'drain';
  const isCold  = pipe.type === 'cold';
  const color   = isCold ? '#2563eb' : isDrain ? '#64748b' : '#dc2626';
  layer.add(new Konva.Line({
    points,
    stroke: color,
    strokeWidth: isDrain ? 1.5 : 2,
    dash: isDrain ? [6, 4] : undefined,
    opacity: isDrain ? 0.75 : 1,
  }));
  if (!isDrain && points.length >= 2) {
    layer.add(new Konva.Circle({
      x: points[points.length - 2],
      y: points[points.length - 1],
      radius: 4, fill: color, strokeWidth: 0,
    }));
  }
}

// ── Fixtures — professional CAD details, all fit within FIXTURE_DIMS bounds ───

function addFixture(layer: Konva.Layer, fixture: PlacedFixture) {
  const x = fixture.position.x + PAD;
  const y = fixture.position.y + PAD;
  const t = fixture.type;

  if (t === 'toilet') {
    // Bounding box: w=40, h=68 (from FIXTURE_DIMS)
    // Tank: y..y+18, gap 6, bowl center at y+38, radiusY=24 → max y+62 < 68 ✓
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 40, height: 18, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Ellipse({ x: x + 20, y: y + 44, radiusX: 17, radiusY: 22, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Ellipse({ x: x + 20, y: y + 44, radiusX: 13, radiusY: 17, fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 0.8 }));
    layer.add(g);
  } else if (t === 'sink') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 60, height: 50, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Rect({ x: x + 22, y: y + 2, width: 16, height: 8, fill: '#d0d0d0', stroke: '#1a1a1a', strokeWidth: 1 }));
    g.add(new Konva.Ellipse({ x: x + 30, y: y + 30, radiusX: 18, radiusY: 14, fill: 'white', stroke: '#1a1a1a', strokeWidth: 1 }));
    g.add(new Konva.Circle({ x: x + 30, y: y + 30, radius: 3, fill: '#1a1a1a' }));
    layer.add(g);
  } else if (t === 'bathtub') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 70, height: 170, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Rect({ x: x + 6, y: y + 6, width: 58, height: 158, fill: 'white', stroke: '#1a1a1a', strokeWidth: 1, cornerRadius: 8 }));
    g.add(new Konva.Circle({ x: x + 35, y: y + 148, radius: 6, fill: '#e0e0e0', stroke: '#1a1a1a', strokeWidth: 1 }));
    g.add(new Konva.Rect({ x: x + 23, y: y + 10, width: 24, height: 10, fill: '#d0d0d0', stroke: '#1a1a1a', strokeWidth: 1 }));
    layer.add(g);
  } else if (t === 'shower') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 90, height: 90, fill: '#f0f8ff', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Arc({ x, y: y + 90, innerRadius: 0, outerRadius: 90, angle: 90, rotation: 270, fill: 'rgba(59,130,246,0.1)', stroke: '#3b82f6', strokeWidth: 1 }));
    g.add(new Konva.Circle({ x: x + 45, y: y + 45, radius: 6, fill: '#3b82f6', opacity: 0.5 }));
    layer.add(g);
  } else if (t === 'stove') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 60, height: 60, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    [[x+15,y+15],[x+45,y+15],[x+15,y+45],[x+45,y+45]].forEach(([cx,cy]) =>
      g.add(new Konva.Circle({ x: cx, y: cy, radius: 8, stroke: '#1a1a1a', strokeWidth: 1 }))
    );
    layer.add(g);
  } else if (t === 'fridge') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 60, height: 65, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Line({ points: [x, y+20, x+60, y+20], stroke: '#1a1a1a', strokeWidth: 1 }));
    layer.add(g);
  } else if (t === 'dishwasher') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 60, height: 60, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    [15,30,45].forEach(dy => g.add(new Konva.Line({ points: [x+8, y+dy, x+52, y+dy], stroke: '#1a1a1a', strokeWidth: 1 })));
    g.add(new Konva.Circle({ x: x+30, y: y+8, radius: 3, fill: '#1a1a1a' }));
    layer.add(g);
  } else if (t === 'desk') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 120, height: 60, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Rect({ x: x + 35, y: y + 5, width: 50, height: 30, fill: '#d0d0d0', stroke: '#1a1a1a', strokeWidth: 1 }));
    g.add(new Konva.Rect({ x: x + 55, y: y + 35, width: 10, height: 8, fill: '#b0b0b0', stroke: '#1a1a1a', strokeWidth: 0.5 }));
    layer.add(g);
  } else if (t === 'bed') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 160, height: 200, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Rect({ x, y, width: 160, height: 30, fill: '#d0d0d0', stroke: '#1a1a1a', strokeWidth: 1 }));
    g.add(new Konva.Rect({ x: x+10, y: y+35, width: 60, height: 35, fill: '#e8e8e8', stroke: '#1a1a1a', strokeWidth: 1, cornerRadius: 4 }));
    g.add(new Konva.Rect({ x: x+90, y: y+35, width: 60, height: 35, fill: '#e8e8e8', stroke: '#1a1a1a', strokeWidth: 1, cornerRadius: 4 }));
    g.add(new Konva.Line({ points: [x+5, y+80, x+155, y+80], stroke: '#1a1a1a', strokeWidth: 1 }));
    layer.add(g);
  } else if (t === 'wardrobe') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 120, height: 60, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Line({ points: [x+40, y, x+40, y+60], stroke: '#1a1a1a', strokeWidth: 1 }));
    g.add(new Konva.Line({ points: [x+80, y, x+80, y+60], stroke: '#1a1a1a', strokeWidth: 1 }));
    g.add(new Konva.Line({ points: [x+18, y+28, x+22, y+32], stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Line({ points: [x+58, y+28, x+62, y+32], stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Line({ points: [x+98, y+28, x+102, y+32], stroke: '#1a1a1a', strokeWidth: 1.5 }));
    layer.add(g);
  } else if (t === 'sofa') {
    const sw = 200, sh = 90;
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: sw, height: 22, fill: '#c0c0c0', stroke: '#111111', strokeWidth: 1.5 }));
    g.add(new Konva.Rect({ x, y: y+22, width: 12, height: sh-22, fill: '#b0b0b0', stroke: '#888888', strokeWidth: 1 }));
    g.add(new Konva.Rect({ x: x+sw-12, y: y+22, width: 12, height: sh-22, fill: '#b0b0b0', stroke: '#888888', strokeWidth: 1 }));
    for (let i = 0; i < 3; i++) {
      g.add(new Konva.Rect({
        x: x+12+i*((sw-24)/3)+2, y: y+24,
        width: (sw-24)/3-4, height: sh-28,
        fill: '#d8d8d8', stroke: '#999999', strokeWidth: 1, cornerRadius: 3,
      }));
    }
    g.add(new Konva.Line({ points: [x+12+(sw-24)/3, y+24, x+12+(sw-24)/3, y+sh], stroke: '#aaaaaa', strokeWidth: 0.8 }));
    g.add(new Konva.Line({ points: [x+12+2*(sw-24)/3, y+24, x+12+2*(sw-24)/3, y+sh], stroke: '#aaaaaa', strokeWidth: 0.8 }));
    layer.add(g);
  } else if (t === 'tv_unit') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 150, height: 45, fill: '#e8e8e8', stroke: '#111111', strokeWidth: 1.5 }));
    g.add(new Konva.Rect({ x: x+8, y: y+5, width: 134, height: 28, fill: '#1a2035', stroke: '#444444', strokeWidth: 1 }));
    g.add(new Konva.Line({ points: [x+12, y+8, x+30, y+8], stroke: '#ffffff', strokeWidth: 1, opacity: 0.3 }));
    g.add(new Konva.Rect({ x: x+20, y: y+40, width: 12, height: 8, fill: '#aaaaaa', stroke: '#888888', strokeWidth: 0.5 }));
    g.add(new Konva.Rect({ x: x+118, y: y+40, width: 12, height: 8, fill: '#aaaaaa', stroke: '#888888', strokeWidth: 0.5 }));
    layer.add(g);
  } else if (t === 'bookshelf') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 80, height: 30, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    [20,40,60].forEach(dx => g.add(new Konva.Line({ points: [x+dx, y, x+dx, y+30], stroke: '#1a1a1a', strokeWidth: 0.5 })));
    layer.add(g);
  } else if (t === 'coat_rack') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 60, height: 30, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    [10,25,40,55].forEach(dx => g.add(new Konva.Line({ points: [x+dx, y, x+dx, y+15], stroke: '#1a1a1a', strokeWidth: 1.5 })));
    layer.add(g);
  } else if (t === 'chair') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 50, height: 50, fill: '#e8e8e8', stroke: '#1a1a1a', strokeWidth: 1.5, cornerRadius: 3 }));
    g.add(new Konva.Rect({ x, y, width: 50, height: 12, fill: '#d0d0d0', stroke: '#1a1a1a', strokeWidth: 1 }));
    layer.add(g);
  } else if (t === 'armchair') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 80, height: 80, fill: '#e8e8e8', stroke: '#1a1a1a', strokeWidth: 1.5, cornerRadius: 5 }));
    g.add(new Konva.Rect({ x, y, width: 80, height: 18, fill: '#d0d0d0', stroke: '#1a1a1a', strokeWidth: 1 }));
    g.add(new Konva.Rect({ x, y: y+18, width: 10, height: 62, fill: '#c0c0c0', stroke: '#1a1a1a', strokeWidth: 0.5 }));
    g.add(new Konva.Rect({ x: x+70, y: y+18, width: 10, height: 62, fill: '#c0c0c0', stroke: '#1a1a1a', strokeWidth: 0.5 }));
    layer.add(g);
  } else if (t === 'coffee_table') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 90, height: 50, fill: '#f5f0e8', stroke: '#111111', strokeWidth: 1.5, cornerRadius: 2 }));
    g.add(new Konva.Rect({ x: x+6, y: y+6, width: 78, height: 38, fill: '#fafaf5', stroke: '#cccccc', strokeWidth: 0.8, cornerRadius: 1 }));
    [[x+5,y+5],[x+83,y+5],[x+5,y+43],[x+83,y+43]].forEach(([lx,ly]) =>
      g.add(new Konva.Circle({ x: lx, y: ly, radius: 3, fill: '#aaaaaa', stroke: '#888888', strokeWidth: 0.5 }))
    );
    layer.add(g);
  } else if (t === 'dining_table') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 120, height: 80, fill: '#f5f0e8', stroke: '#1a1a1a', strokeWidth: 1.5, cornerRadius: 3 }));
    [[x+20,y-15],[x+70,y-15],[x+20,y+83],[x+70,y+83]].forEach(([cx,cy]) =>
      g.add(new Konva.Rect({ x: cx, y: cy, width: 30, height: 12, fill: '#e0e0e0', stroke: '#1a1a1a', strokeWidth: 0.5 }))
    );
    layer.add(g);
  } else {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 50, height: 50, fill: '#f0f0f0', stroke: '#1a1a1a', strokeWidth: 1 }));
    g.add(new Konva.Text({
      x: x+2, y: y+18, text: (FIXTURE_LABELS[t] || t.replace(/_/g,' ')).slice(0,10),
      fontSize: 8, fill: '#555', width: 46, align: 'center',
    }));
    layer.add(g);
  }
}

// ── Corner fills ──────────────────────────────────────────────────────────────

function fillCorners(layer: Konva.Layer, walls: Wall[]) {
  const seen = new Set<string>();
  walls.forEach(wall => {
    [wall.start, wall.end].forEach(corner => {
      const key = `${corner.x},${corner.y}`;
      if (seen.has(key)) return;
      seen.add(key);
      layer.add(new Konva.Rect({
        x: corner.x + PAD - WALL_T / 2 - 1,
        y: corner.y + PAD - WALL_T / 2 - 1,
        width: WALL_T + 2, height: WALL_T + 2,
        fill: '#cccccc', strokeWidth: 0,
      }));
    });
  });
}

function addFixtureLabel(layer: Konva.Layer, fixture: PlacedFixture) {
  const d = FIXTURE_DIMS[fixture.type] || { w: 50, h: 50 };
  const cx = fixture.position.x + PAD + d.w / 2;
  const cy = fixture.position.y + PAD + d.h / 2 + 2;
  const fontSize = d.w < 60 ? 7 : 8;
  layer.add(new Konva.Text({
    x: cx - 20, y: cy - fontSize / 2,
    text: FIXTURE_LABELS[fixture.type] || fixture.type,
    fontSize, fill: '#444', width: 40, align: 'center',
  }));
}

// ── Windows (GOST 21.205-93: 3 parallel lines) ───────────────────────────────

function addWindow(
  layer: Konva.Layer,
  win: WindowSpec & { _roomOffsetX?: number; _roomOffsetY?: number },
  walls: Wall[],
  allWallWindows: WindowSpec[], // only windows on same wall
) {
  const wall = resolveWall(win.wall, win.wallId, win._roomOffsetX, win._roomOffsetY, walls);
  if (!wall) return;

  const winWidth = (win.width || 1.2) * UNITS_PER_METER;
  const T = wall.thickness;
  const wallStartX = wall.start.x + PAD;
  const wallStartY = wall.start.y + PAD;
  const wallEndX   = wall.end.x   + PAD;
  const wallEndY   = wall.end.y   + PAD;

  const isHorizontal = win.wall === 'north' || win.wall === 'south';
  let centerX: number, centerY: number;

  if (win.offsetFromCorner !== undefined) {
    // Explicit position: offset from wall's west/north corner
    const off = win.offsetFromCorner * UNITS_PER_METER + winWidth / 2;
    if (isHorizontal) {
      centerX = wallStartX + off;
      centerY = (wallStartY + wallEndY) / 2;
    } else {
      centerX = (wallStartX + wallEndX) / 2;
      centerY = wallStartY + off;
    }
  } else {
    // Auto-space evenly
    const idx   = allWallWindows.findIndex(w => w.id === win.id);
    const count = allWallWindows.length;
    if (isHorizontal) {
      const seg = (wallEndX - wallStartX) / (count + 1);
      centerX = wallStartX + seg * (idx + 1);
      centerY = (wallStartY + wallEndY) / 2;
    } else {
      const seg = (wallEndY - wallStartY) / (count + 1);
      centerX = (wallStartX + wallEndX) / 2;
      centerY = wallStartY + seg * (idx + 1);
    }
  }

  const halfW = winWidth / 2;
  const ext = 3;
  let x1: number, y1: number, x2: number, y2: number;
  if (win.wall === 'north') {
    x1 = centerX - halfW; y1 = wallStartY - T / 2 - ext;
    x2 = centerX + halfW; y2 = wallStartY + T / 2 + ext;
  } else if (win.wall === 'south') {
    x1 = centerX - halfW; y1 = wallEndY - T / 2 - ext;
    x2 = centerX + halfW; y2 = wallEndY + T / 2 + ext;
  } else if (win.wall === 'east') {
    x1 = wallEndX - T / 2 - ext; y1 = centerY - halfW;
    x2 = wallEndX + T / 2 + ext; y2 = centerY + halfW;
  } else {
    x1 = wallStartX - T / 2 - ext; y1 = centerY - halfW;
    x2 = wallStartX + T / 2 + ext; y2 = centerY + halfW;
  }

  const g = new Konva.Group();
  g.add(new Konva.Rect({ x: x1, y: y1, width: x2 - x1, height: y2 - y1, fill: 'white' }));
  if (isHorizontal) {
    g.add(new Konva.Line({ points: [x1, y1, x2, y1], stroke: '#1a1a1a', strokeWidth: 1.2 }));
    g.add(new Konva.Line({ points: [x1, (y1+y2)/2, x2, (y1+y2)/2], stroke: '#1a1a1a', strokeWidth: 2 }));
    g.add(new Konva.Line({ points: [x1, y2, x2, y2], stroke: '#1a1a1a', strokeWidth: 1.2 }));
  } else {
    g.add(new Konva.Line({ points: [x1, y1, x1, y2], stroke: '#1a1a1a', strokeWidth: 1.2 }));
    g.add(new Konva.Line({ points: [(x1+x2)/2, y1, (x1+x2)/2, y2], stroke: '#1a1a1a', strokeWidth: 2 }));
    g.add(new Konva.Line({ points: [x2, y1, x2, y2], stroke: '#1a1a1a', strokeWidth: 1.2 }));
  }
  layer.add(g);
}

// ── Wall resolver — shared by door and window ─────────────────────────────────

function resolveWall(
  side: string,
  wallId: string | undefined,
  offsetX: number | undefined,
  offsetY: number | undefined,
  walls: Wall[],
): Wall | undefined {
  if (wallId) {
    const found = walls.find(w => w.id === wallId);
    if (found) return found;
  }
  if (offsetX !== undefined && offsetY !== undefined) {
    // Find wall matching side that starts near the room offset
    const found = walls.find(w => {
      if (w.side !== side) return false;
      const minX = Math.min(w.start.x, w.end.x);
      const minY = Math.min(w.start.y, w.end.y);
      return Math.abs(minX - offsetX) < 20 && Math.abs(minY - offsetY) < 20;
    });
    if (found) return found;
  }
  // Fallback: first wall with matching side
  return walls.find(w => w.side === side);
}

// ── Doors (gap + leaf + bezier swing arc, GOST 21.205-93) ────────────────────

function addDoor(
  layer: Konva.Layer,
  door: DoorSpec & { _roomOffsetX?: number; _roomOffsetY?: number },
  walls: Wall[],
  allWallDoors: DoorSpec[], // only doors on same wall
) {
  const wall = resolveWall(door.wall, door.wallId, door._roomOffsetX, door._roomOffsetY, walls);
  if (!wall) return;

  const dw   = (door.width || 0.9) * UNITS_PER_METER;
  const T    = wall.thickness;
  const side = door.wall;

  const wallStartX = wall.start.x + PAD;
  const wallStartY = wall.start.y + PAD;
  const wallEndX   = wall.end.x   + PAD;
  const wallEndY   = wall.end.y   + PAD;

  // Door center position along wall
  let centerX: number, centerY: number;
  const isHorizontal = side === 'north' || side === 'south';

  if (door.offsetFromCorner !== undefined) {
    const off = door.offsetFromCorner * UNITS_PER_METER + dw / 2;
    if (isHorizontal) {
      centerX = wallStartX + off;
      centerY = (wallStartY + wallEndY) / 2;
    } else {
      centerX = (wallStartX + wallEndX) / 2;
      centerY = wallStartY + off;
    }
  } else {
    // Evenly space multiple doors
    const idx   = allWallDoors.findIndex(d => d.id === door.id);
    const count = allWallDoors.length;
    if (isHorizontal) {
      const seg = (wallEndX - wallStartX) / (count + 1);
      centerX = wallStartX + seg * (idx + 1);
      centerY = (wallStartY + wallEndY) / 2;
    } else {
      const seg = (wallEndY - wallStartY) / (count + 1);
      centerX = (wallStartX + wallEndX) / 2;
      centerY = wallStartY + seg * (idx + 1);
    }
  }

  // hinge: 'left' (default) = pivot at west/north end of opening
  //        'right'           = pivot at east/south end of opening
  const hinge = door.hinge ?? 'left';

  let gapX: number, gapY: number, gapW: number, gapH: number;
  let pivotX: number, pivotY: number;
  let leafX: number,  leafY: number;

  if (side === 'north') {
    gapX = centerX - dw / 2; gapY = centerY - T / 2; gapW = dw; gapH = T;
    if (hinge === 'left') {
      pivotX = gapX;        pivotY = centerY + T / 2; // inner face, west end
      leafX  = pivotX;      leafY  = pivotY + dw;     // swings down-right
    } else {
      pivotX = gapX + dw;   pivotY = centerY + T / 2; // inner face, east end
      leafX  = pivotX;      leafY  = pivotY + dw;     // swings down-left (mirrored below)
    }
  } else if (side === 'south') {
    gapX = centerX - dw / 2; gapY = centerY - T / 2; gapW = dw; gapH = T;
    if (hinge === 'right') {
      pivotX = gapX;        pivotY = centerY - T / 2;
      leafX  = pivotX;      leafY  = pivotY - dw;
    } else {
      pivotX = gapX + dw;   pivotY = centerY - T / 2;
      leafX  = pivotX;      leafY  = pivotY - dw;
    }
  } else if (side === 'east') {
    gapX = centerX - T / 2; gapY = centerY - dw / 2; gapW = T; gapH = dw;
    if (hinge === 'left') {
      pivotX = centerX - T / 2; pivotY = gapY;
      leafX  = pivotX - dw;     leafY  = pivotY;
    } else {
      pivotX = centerX - T / 2; pivotY = gapY + dw;
      leafX  = pivotX - dw;     leafY  = pivotY;
    }
  } else { // west
    gapX = centerX - T / 2; gapY = centerY - dw / 2; gapW = T; gapH = dw;
    if (hinge === 'left') {
      pivotX = centerX + T / 2; pivotY = gapY;
      leafX  = pivotX + dw;     leafY  = pivotY;
    } else {
      pivotX = centerX + T / 2; pivotY = gapY + dw;
      leafX  = pivotX + dw;     leafY  = pivotY;
    }
  }

  // Cubic bezier quarter-circle approximation (kappa = 0.5523)
  const kappa = 0.5523;
  let arcPoints: number[];

  if (side === 'north') {
    if (hinge === 'left') {
      arcPoints = [leafX, leafY, leafX + dw*kappa, leafY, pivotX+dw, pivotY+dw*(1-kappa), pivotX+dw, pivotY];
    } else {
      arcPoints = [leafX, leafY, leafX - dw*kappa, leafY, pivotX-dw, pivotY+dw*(1-kappa), pivotX-dw, pivotY];
    }
  } else if (side === 'south') {
    if (hinge === 'right') {
      arcPoints = [leafX, leafY, leafX + dw*kappa, leafY, pivotX+dw, pivotY-dw*(1-kappa), pivotX+dw, pivotY];
    } else {
      arcPoints = [leafX, leafY, leafX - dw*kappa, leafY, pivotX-dw, pivotY-dw*(1-kappa), pivotX-dw, pivotY];
    }
  } else if (side === 'east') {
    if (hinge === 'left') {
      arcPoints = [leafX, leafY, leafX, leafY+dw*kappa, pivotX-dw*(1-kappa), pivotY+dw, pivotX, pivotY+dw];
    } else {
      arcPoints = [leafX, leafY, leafX, leafY-dw*kappa, pivotX-dw*(1-kappa), pivotY-dw, pivotX, pivotY-dw];
    }
  } else { // west
    if (hinge === 'left') {
      arcPoints = [leafX, leafY, leafX, leafY+dw*kappa, pivotX+dw*(1-kappa), pivotY+dw, pivotX, pivotY+dw];
    } else {
      arcPoints = [leafX, leafY, leafX, leafY-dw*kappa, pivotX+dw*(1-kappa), pivotY-dw, pivotX, pivotY-dw];
    }
  }

  const g = new Konva.Group();
  g.add(new Konva.Rect({ x: gapX, y: gapY, width: gapW, height: gapH, fill: 'white' }));
  g.add(new Konva.Line({ points: arcPoints, bezier: true, stroke: '#555555', strokeWidth: 1, dash: [4, 3] }));
  g.add(new Konva.Line({ points: [pivotX, pivotY, leafX, leafY], stroke: '#000000', strokeWidth: 3 }));
  layer.add(g);
}

// ── Dimension lines ───────────────────────────────────────────────────────────

function addDimension(layer: Konva.Layer, dim: DimensionLine, totalW: number, totalH: number, minX = 0, minY = 0) {
  if (dim.value === 0) return; // room labels handled separately

  const startX = dim.start.x + PAD;
  const startY = dim.start.y + PAD;
  const endX   = dim.end.x   + PAD;
  const endY   = dim.end.y   + PAD;
  const midX   = (startX + endX) / 2;
  const midY   = (startY + endY) / 2;

  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;

  const ux = dx / len;
  const uy = dy / len;
  let nx = -uy;
  let ny =  ux;

  const roomCX = PAD + minX + totalW / 2;
  const roomCY = PAD + minY + totalH / 2;
  if (nx * (roomCX - midX) + ny * (roomCY - midY) > 0) { nx = -nx; ny = -ny; }

  const ax = startX + nx * DIM_OFFSET;
  const ay = Math.max(30, startY + ny * DIM_OFFSET);
  const bx = endX   + nx * DIM_OFFSET;
  const by = Math.max(30, endY   + ny * DIM_OFFSET);

  layer.add(new Konva.Line({ points: [ax, ay, bx, by], stroke: '#555555', strokeWidth: 0.8 }));
  layer.add(new Konva.Line({ points: [startX, startY, startX + nx*(DIM_OFFSET+DIM_EXT), startY + ny*(DIM_OFFSET+DIM_EXT)], stroke: '#555555', strokeWidth: 0.8 }));
  layer.add(new Konva.Line({ points: [endX,   endY,   endX   + nx*(DIM_OFFSET+DIM_EXT), endY   + ny*(DIM_OFFSET+DIM_EXT)], stroke: '#555555', strokeWidth: 0.8 }));

  const half = TICK_SIZE / 2;
  layer.add(new Konva.Line({ points: [ax - ux*half - nx*half, ay - uy*half - ny*half, ax + ux*half + nx*half, ay + uy*half + ny*half], stroke: '#333333', strokeWidth: 1.2 }));
  layer.add(new Konva.Line({ points: [bx - ux*half - nx*half, by - uy*half - ny*half, bx + ux*half + nx*half, by + uy*half + ny*half], stroke: '#333333', strokeWidth: 1.2 }));

  layer.add(new Konva.Text({
    x: midX + nx*(DIM_OFFSET+6) - 22,
    y: midY + ny*(DIM_OFFSET+6) - 6,
    text: dim.label,
    fontSize: 9.5, fontFamily: 'Arial', fill: '#111111', width: 44, align: 'center',
  }));
}

// ── Room backgrounds + labels ─────────────────────────────────────────────────

function addRoomBackgrounds(layer: Konva.Layer, drawingData: DrawingData, totalW: number, totalH: number, minX: number, minY: number) {
  const isMultiRoom = drawingData.dimensions.some(d => d.id.startsWith('label-'));

  if (isMultiRoom) {
    // Multi-room: draw colored circles + 2-line labels from dimension data
    drawingData.dimensions
      .filter(d => d.id.startsWith('label-'))
      .forEach(d => {
        const cx = d.start.x + PAD;
        const cy = (d.start.y + d.end.y) / 2 + PAD;
        const color = roomColorFromName(d.label);
        layer.add(new Konva.Circle({ x: cx, y: cy, radius: 40, fill: color, opacity: 0.5 }));
        const parts = d.label.match(/^(.+?)\s+([\d.]+m²)$/);
        const roomName = parts ? parts[1] : d.label;
        const roomArea = parts ? parts[2] : '';
        layer.add(new Konva.Text({ x: cx-50, y: cy-12, text: roomName, fontSize: 10, fontStyle: 'bold', fontFamily: 'Arial', fill: '#111111', width: 100, align: 'center' }));
        if (roomArea) layer.add(new Konva.Text({ x: cx-50, y: cy+3, text: roomArea, fontSize: 9, fontFamily: 'Arial', fill: '#333333', width: 100, align: 'center' }));
      });
  } else {
    // Single room: color from roomName or fixtures
    const color = drawingData.roomName
      ? roomColorFromName(drawingData.roomName)
      : roomColorFromFixtures(drawingData.fixtures);

    const rx = PAD + minX;
    const ry = PAD + minY;

    // Tinted room fill (inside walls)
    layer.add(new Konva.Rect({
      x: rx + WALL_T, y: ry + WALL_T,
      width: totalW - WALL_T * 2, height: totalH - WALL_T * 2,
      fill: color, opacity: 0.6,
    }));

    // Room name label
    const name = drawingData.roomName ? drawingData.roomName.charAt(0).toUpperCase() + drawingData.roomName.slice(1) : 'Xona';
    const area = ((totalW / UNITS_PER_METER) * (totalH / UNITS_PER_METER)).toFixed(1);
    layer.add(new Konva.Text({ x: rx + totalW/2 - 50, y: ry + totalH/2 - 12, text: name, fontSize: 10, fontStyle: 'bold', fontFamily: 'Arial', fill: '#111111', width: 100, align: 'center' }));
    layer.add(new Konva.Text({ x: rx + totalW/2 - 50, y: ry + totalH/2 + 3,  text: `${area}m²`,  fontSize: 9,  fontFamily: 'Arial', fill: '#333333', width: 100, align: 'center' }));
  }
}

// ── Staircase (GOST hatching — diagonal lines in box) ────────────────────────

function addStaircase(layer: Konva.Layer, spec: StaircaseSpec) {
  const x  = spec.position.x * UNITS_PER_METER + PAD;
  const y  = spec.position.y * UNITS_PER_METER + PAD;
  const w  = spec.width  * UNITS_PER_METER;
  const h  = spec.length * UNITS_PER_METER;

  // Outer box
  layer.add(new Konva.Rect({ x, y, width: w, height: h, fill: '#f0f0f0', stroke: '#333', strokeWidth: 1.5 }));

  // Diagonal hatch lines (GOST staircase symbol)
  const step = 8;
  for (let i = -h; i < w + h; i += step) {
    const x1 = Math.max(x, x + i);
    const y1 = i < 0 ? y - i : y;
    const x2 = Math.min(x + w, x + i + h);
    const y2 = i < 0 ? y + h : y + h - i;
    if (x2 <= x || y2 <= y || x1 >= x + w || y1 >= y + h) continue;
    layer.add(new Konva.Line({ points: [x1, y1, x2, y2], stroke: '#888', strokeWidth: 0.6, opacity: 0.7 }));
  }

  // Arrow showing direction (going up)
  const arrowX = x + w / 2;
  layer.add(new Konva.Arrow({
    points: [arrowX, y + h - 6, arrowX, y + 6],
    stroke: '#333', fill: '#333', strokeWidth: 1.2, pointerLength: 5, pointerWidth: 4,
  }));

  // Label
  layer.add(new Konva.Text({
    x: x + 2, y: y + h / 2 - 8,
    text: 'Zinapoya', fontSize: 7, fontFamily: 'Arial',
    fill: '#333', width: w - 4, align: 'center', rotation: 0,
  }));
  layer.add(new Konva.Text({
    x: x + 2, y: y + h / 2 + 2,
    text: `${spec.flightCount}-qavat`, fontSize: 6, fontFamily: 'Arial',
    fill: '#666', width: w - 4, align: 'center',
  }));
}

// ── Inter-room door (shared wall opening, no swing arc — just gap + leaf) ────

function addInterRoomDoor(layer: Konva.Layer, ird: InterRoomDoor, walls: Wall[]) {
  const wall = walls.find(w => w.id === ird.wallId);
  if (!wall) return;

  const dw  = ird.width * UNITS_PER_METER;
  const T   = wall.thickness;
  const isH = wall.side === 'north' || wall.side === 'south';

  const wsx = wall.start.x + PAD, wsy = wall.start.y + PAD;
  const wex = wall.end.x   + PAD, wey = wall.end.y   + PAD;

  // Door center: offsetFromCorner from wall start
  const off = ird.offsetFromCorner * UNITS_PER_METER + dw / 2;
  let cx: number, cy: number;
  if (isH) {
    cx = wsx + off;
    cy = (wsy + wey) / 2;
  } else {
    cx = (wsx + wex) / 2;
    cy = wsy + off;
  }

  let gapX: number, gapY: number, gapW: number, gapH: number;
  if (isH) {
    gapX = cx - dw / 2; gapY = cy - T / 2; gapW = dw; gapH = T;
  } else {
    gapX = cx - T / 2; gapY = cy - dw / 2; gapW = T; gapH = dw;
  }

  const g = new Konva.Group();
  // White gap in wall
  g.add(new Konva.Rect({ x: gapX, y: gapY, width: gapW, height: gapH, fill: 'white' }));
  // Double line showing inter-room door threshold (no swing — passage only)
  const inset = 2;
  if (isH) {
    g.add(new Konva.Line({ points: [gapX + inset, gapY, gapX + inset, gapY + gapH], stroke: '#555', strokeWidth: 1 }));
    g.add(new Konva.Line({ points: [gapX + gapW - inset, gapY, gapX + gapW - inset, gapY + gapH], stroke: '#555', strokeWidth: 1 }));
  } else {
    g.add(new Konva.Line({ points: [gapX, gapY + inset, gapX + gapW, gapY + inset], stroke: '#555', strokeWidth: 1 }));
    g.add(new Konva.Line({ points: [gapX, gapY + gapH - inset, gapX + gapW, gapY + gapH - inset], stroke: '#555', strokeWidth: 1 }));
  }
  layer.add(g);
}

// ── Floor label (level mark ±0.000) ──────────────────────────────────────────

function addFloorLabel(layer: Konva.Layer, floorLabel: string, elevation: number, totalW: number) {
  const elevStr = elevation >= 0 ? `+${elevation.toFixed(3)}` : elevation.toFixed(3);
  const g = new Konva.Group();
  // Top-right corner badge
  const bx = PAD + totalW + 10;
  const by = PAD - 30;
  g.add(new Konva.Rect({ x: bx, y: by, width: 90, height: 26, fill: '#1e293b', cornerRadius: 4 }));
  g.add(new Konva.Text({ x: bx + 4, y: by + 3,  text: floorLabel, fontSize: 10, fontStyle: 'bold', fontFamily: 'Arial', fill: '#f8fafc' }));
  g.add(new Konva.Text({ x: bx + 4, y: by + 14, text: `ur. ${elevStr}`, fontSize: 8, fontFamily: 'Arial', fill: '#94a3b8' }));
  layer.add(g);
}

// ── Title block ───────────────────────────────────────────────────────────────

function addTitleBlock(layer: Konva.Layer, totalWidth: number, totalHeight: number) {
  const blockW = 220, blockH = 80;
  const blockX = Math.max(totalWidth + PAD - blockW - 5, PAD + 160);
  const blockY = totalHeight + PAD + 110;
  const date = new Date().toLocaleDateString('uz-UZ');

  const g = new Konva.Group();
  g.add(new Konva.Rect({ x: blockX, y: blockY, width: blockW, height: blockH, stroke: '#1a1a1a', strokeWidth: 1.5, fill: 'white' }));
  g.add(new Konva.Line({ points: [blockX+100, blockY, blockX+100, blockY+blockH], stroke: '#1a1a1a', strokeWidth: 0.8 }));
  [20, 40, 60].forEach(dy => g.add(new Konva.Line({ points: [blockX, blockY+dy, blockX+blockW, blockY+dy], stroke: '#1a1a1a', strokeWidth: 0.8 })));

  g.add(new Konva.Text({ x: blockX+4, y: blockY+4,  text: 'Loyiha nomi',     fontSize: 8,  fontFamily: 'Arial', fill: '#555' }));
  g.add(new Konva.Text({ x: blockX+4, y: blockY+24, text: 'Floor Plan',      fontSize: 10, fontFamily: 'Arial', fontStyle: 'bold', fill: '#1a1a1a' }));
  g.add(new Konva.Text({ x: blockX+4, y: blockY+44, text: 'Masshtab',        fontSize: 8,  fontFamily: 'Arial', fill: '#555' }));
  g.add(new Konva.Text({ x: blockX+4, y: blockY+54, text: '1:50',            fontSize: 10, fontFamily: 'Arial', fontStyle: 'bold', fill: '#1a1a1a' }));
  g.add(new Konva.Text({ x: blockX+4, y: blockY+64, text: 'SNiP 2.04.01-85', fontSize: 8,  fontFamily: 'Arial', fill: '#555' }));
  g.add(new Konva.Text({ x: blockX+104, y: blockY+4,  text: 'Sana',   fontSize: 8,  fontFamily: 'Arial', fill: '#555' }));
  g.add(new Konva.Text({ x: blockX+104, y: blockY+14, text: date,     fontSize: 9,  fontFamily: 'Arial', fill: '#1a1a1a' }));
  g.add(new Konva.Text({ x: blockX+104, y: blockY+44, text: 'Bosqich', fontSize: 8,  fontFamily: 'Arial', fill: '#555' }));
  g.add(new Konva.Text({ x: blockX+104, y: blockY+54, text: 'РП',      fontSize: 10, fontFamily: 'Arial', fontStyle: 'bold', fill: '#1a1a1a' }));
  layer.add(g);
}

// ── Legend ────────────────────────────────────────────────────────────────────

function addLegend(layer: Konva.Layer, totalHeight: number) {
  const lx = PAD;
  const ly = totalHeight + PAD + 110;
  const g = new Konva.Group();
  g.add(new Konva.Rect({ x: lx, y: ly, width: 165, height: 55, fill: 'white', stroke: '#bbbbbb', strokeWidth: 0.8 }));
  g.add(new Konva.Line({ points: [lx+8, ly+13, lx+33, ly+13], stroke: '#2563eb', strokeWidth: 2 }));
  g.add(new Konva.Text({ x: lx+38, y: ly+7,  text: 'Sovuq suv (H)',    fontSize: 9, fontFamily: 'Arial', fill: '#111111' }));
  g.add(new Konva.Line({ points: [lx+8, ly+29, lx+33, ly+29], stroke: '#dc2626', strokeWidth: 2 }));
  g.add(new Konva.Text({ x: lx+38, y: ly+23, text: 'Issiq suv (I)',     fontSize: 9, fontFamily: 'Arial', fill: '#111111' }));
  g.add(new Konva.Line({ points: [lx+8, ly+45, lx+33, ly+45], stroke: '#64748b', strokeWidth: 1.5, dash: [6,4], opacity: 0.75 }));
  g.add(new Konva.Text({ x: lx+38, y: ly+39, text: 'Kanalizatsiya (K)', fontSize: 9, fontFamily: 'Arial', fill: '#111111' }));
  layer.add(g);
}

// ── Component ─────────────────────────────────────────────────────────────────

const ZOOM_STEP = 1.18;
const MIN_ZOOM  = 0.15;
const MAX_ZOOM  = 10;

const Canvas2D = forwardRef<Canvas2DHandle, Canvas2DProps>(
  function Canvas2D({ drawingData, width = 800, scale = 1 }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef     = useRef<Konva.Stage | null>(null);
    const zoomRef      = useRef(1);                   // mirror of zoom state for event handlers
    const baseScaleRef = useRef(1);                   // initial fit-to-width scale
    const [zoom, setZoomState] = useState(1);         // display only — NOT in useEffect deps

    // Zoom helpers (stable refs — no re-render issues)
    const applyZoom = useCallback((newZoom: number, pivotX?: number, pivotY?: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      const bs = baseScaleRef.current;
      const finalScale = bs * clamped;
      if (pivotX !== undefined && pivotY !== undefined) {
        const oldScale = stage.scaleX();
        const ptX = (pivotX - stage.x()) / oldScale;
        const ptY = (pivotY - stage.y()) / oldScale;
        stage.scale({ x: finalScale, y: finalScale });
        stage.position({ x: pivotX - ptX * finalScale, y: pivotY - ptY * finalScale });
      } else {
        stage.scale({ x: finalScale, y: finalScale });
      }
      stage.batchDraw();
      zoomRef.current = clamped;
      setZoomState(clamped);
    }, []);

    const zoomIn  = useCallback(() => applyZoom(zoomRef.current * ZOOM_STEP), [applyZoom]);
    const zoomOut = useCallback(() => applyZoom(zoomRef.current / ZOOM_STEP), [applyZoom]);
    const resetZoom = useCallback(() => {
      const stage = stageRef.current;
      if (!stage) return;
      const bs = baseScaleRef.current;
      stage.scale({ x: bs, y: bs });
      stage.position({ x: 0, y: 0 });
      stage.batchDraw();
      zoomRef.current = 1;
      setZoomState(1);
    }, []);

    useImperativeHandle(ref, () => ({
      exportToPdf(filename = 'floorplan.pdf') {
        const stage = stageRef.current;
        if (!stage) return;
        // Export at base scale (full resolution, not zoomed)
        const savedScale = { x: stage.scaleX(), y: stage.scaleY() };
        const savedPos   = { x: stage.x(),      y: stage.y()      };
        const bs = baseScaleRef.current;
        stage.scale({ x: bs, y: bs });
        stage.position({ x: 0, y: 0 });
        stage.batchDraw();
        const dataUrl = stage.toDataURL({ pixelRatio: 3 });
        const imgW = stage.width();
        const imgH = stage.height();
        stage.scale(savedScale);
        stage.position(savedPos);
        stage.batchDraw();
        const orientation = imgW >= imgH ? 'landscape' : 'portrait';
        const pdf = new jsPDF({ orientation, unit: 'px', format: [imgW, imgH] });
        pdf.addImage(dataUrl, 'PNG', 0, 0, imgW, imgH);
        pdf.save(filename);
      },
      zoomIn, zoomOut, resetZoom,
    }), [zoomIn, zoomOut, resetZoom]);

    useEffect(() => {
      if (!containerRef.current) return;
      if (stageRef.current) { stageRef.current.destroy(); stageRef.current = null; }

      const allX = drawingData.walls.flatMap(w => [w.start.x, w.end.x]);
      const allY = drawingData.walls.flatMap(w => [w.start.y, w.end.y]);
      const minX = allX.length > 0 ? Math.min(...allX) : 0;
      const minY = allY.length > 0 ? Math.min(...allY) : 0;
      const totalWidth  = allX.length > 0 ? Math.max(...allX) - minX : 300;
      const totalHeight = allY.length > 0 ? Math.max(...allY) - minY : 400;

      const contentWidth  = totalWidth  + PAD * 2;
      const contentHeight = totalHeight + PAD * 2 + 180;
      const autoScale = (width / contentWidth) * scale;
      const renderedHeight = Math.ceil(contentHeight * autoScale);

      // Reset zoom on new drawing
      zoomRef.current = 1;
      baseScaleRef.current = autoScale;
      setZoomState(1);

      const stage = new Konva.Stage({
        container: containerRef.current, width, height: renderedHeight,
        scaleX: autoScale, scaleY: autoScale,
        draggable: true,   // pan when zoomed
      });
      stageRef.current = stage;

      // ── Wheel zoom (cursor-centered) ────────────────────────────────────────
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current * factor));
        const ptr = stage.getPointerPosition() ?? { x: width / 2, y: renderedHeight / 2 };
        const bs = baseScaleRef.current;
        const oldScale = stage.scaleX();
        const ptX = (ptr.x - stage.x()) / oldScale;
        const ptY = (ptr.y - stage.y()) / oldScale;
        const fs = bs * newZoom;
        stage.scale({ x: fs, y: fs });
        stage.position({ x: ptr.x - ptX * fs, y: ptr.y - ptY * fs });
        stage.batchDraw();
        zoomRef.current = newZoom;
        setZoomState(newZoom);
      };
      stage.container().addEventListener('wheel', handleWheel, { passive: false });

      const layer = new Konva.Layer();
      stage.add(layer);

      // 1. White base
      layer.add(new Konva.Rect({ x: PAD + minX, y: PAD + minY, width: totalWidth, height: totalHeight, fill: 'white' }));

      // 2. Room color backgrounds + labels
      addRoomBackgrounds(layer, drawingData, totalWidth, totalHeight, minX, minY);

      // 3. Grid (aligned with room corners)
      addGrid(layer, width / autoScale, contentHeight);

      // 4. Pipes
      (drawingData.pipes ?? []).forEach(p => addPipe(layer, p));

      // 5. Walls + corner fills
      drawingData.walls.forEach(w => addWall(layer, w));
      fillCorners(layer, drawingData.walls);

      // 6. Doors — group by wall for even spacing
      const doors = (drawingData.doors ?? []) as (DoorSpec & { _roomOffsetX?: number; _roomOffsetY?: number })[];
      doors.forEach(door => {
        const sameWall = doors.filter(d => d.wall === door.wall && (d as any).wallId === (door as any).wallId);
        addDoor(layer, door, drawingData.walls, sameWall);
      });

      // 7. Windows — group by wall for even spacing
      const windows = (drawingData.windows ?? []) as (WindowSpec & { _roomOffsetX?: number; _roomOffsetY?: number })[];
      windows.forEach(win => {
        const sameWall = windows.filter(w => w.wall === win.wall && (w as any).wallId === (win as any).wallId);
        addWindow(layer, win, drawingData.walls, sameWall);
      });

      // 7b. Inter-room doors (shared wall openings)
      (drawingData.interRoomDoors ?? []).forEach(ird =>
        addInterRoomDoor(layer, ird, drawingData.walls)
      );

      // 8. Fixtures + labels
      drawingData.fixtures.forEach(f => addFixture(layer, f));
      drawingData.fixtures.forEach(f => addFixtureLabel(layer, f));

      // 8b. Staircase
      if (drawingData.staircaseSpec) {
        addStaircase(layer, drawingData.staircaseSpec);
      }

      // 9. Dimension lines
      drawingData.dimensions.forEach(d => addDimension(layer, d, totalWidth, totalHeight, minX, minY));

      // 9b. Floor label (multi-floor mode)
      if (drawingData.floorLabel && drawingData.elevation !== undefined) {
        addFloorLabel(layer, drawingData.floorLabel, drawingData.elevation, totalWidth);
      }

      // 10. Title block + Legend
      addTitleBlock(layer, totalWidth, totalHeight);
      addLegend(layer, totalHeight);

      layer.draw();

      return () => {
        stage.container().removeEventListener('wheel', handleWheel as EventListener);
        stage.destroy();
        stageRef.current = null;
      };
    }, [drawingData, width, scale]); // zoom NOT in deps → stage stays alive on zoom

    return (
      <div className="flex flex-col border border-gray-300 rounded-lg overflow-hidden w-full">
        {/* Zoom toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
          <span className="text-xs text-slate-400">Floor Plan · Scroll = zoom · Drag = pan</span>
          <ZoomToolbar
            zoom={zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={resetZoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
          />
        </div>
        <div ref={containerRef} className="bg-white w-full overflow-hidden cursor-grab active:cursor-grabbing" />
      </div>
    );
  }
);

export default Canvas2D;
