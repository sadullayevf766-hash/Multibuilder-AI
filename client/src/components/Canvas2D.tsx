import { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import Konva from 'konva';
import jsPDF from 'jspdf';
import type { DrawingData, Wall, PlacedFixture, Pipe, DimensionLine, DoorSpec, WindowSpec } from '../../../shared/types';

export interface Canvas2DHandle {
  exportToPdf: (filename?: string) => void;
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
  chair: 'Stul', coat_rack: 'Kiyim ilgich'
};

const ROOM_COLORS: Record<string, string> = {
  kitchen: '#fff9f0', bathroom: '#f0f7ff', bedroom: '#f5fff0',
  living: '#fffff0', office: '#f9f5ff', hallway: '#f5f5f5', default: '#ffffff'
};

const GRID_SIZE = 100;
const PAD = 130;         // canvas padding — must be > DIM_OFFSET + DIM_EXT
const WALL_T = 15;
const DIM_OFFSET = 50;
const DIM_EXT = 12;
const TICK_SIZE = 10;

// ── Grid (dots at intersections — cleaner look) ───────────────────────────────

function addGrid(layer: Konva.Layer, gridW: number, gridH: number) {
  for (let i = 0; i <= gridW; i += GRID_SIZE) {
    for (let j = 0; j <= gridH; j += GRID_SIZE) {
      layer.add(new Konva.Circle({ x: i, y: j, radius: 0.8, fill: '#cccccc' }));
    }
  }
}

// ── Walls (closed polygon fill + face lines with square lineCap) ──────────────

function addWall(layer: Konva.Layer, wall: Wall) {
  const offset = wall.thickness / 2;
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const nx = -dy / len;
  const ny = dx / len;

  const sx = wall.start.x + PAD;
  const sy = wall.start.y + PAD;
  const ex = wall.end.x + PAD;
  const ey = wall.end.y + PAD;

  // Extend endpoints slightly to close corner gaps
  const ext = offset;
  const ux = dx / len;
  const uy = dy / len;

  const sxe = sx - ux * ext;
  const sye = sy - uy * ext;
  const exe = ex + ux * ext;
  const eye = ey + uy * ext;

  // Closed polygon fill (grey) — extended at both ends to fill corners
  layer.add(new Konva.Line({
    points: [
      sxe + nx * offset, sye + ny * offset,
      exe + nx * offset, eye + ny * offset,
      exe - nx * offset, eye - ny * offset,
      sxe - nx * offset, sye - ny * offset,
    ],
    closed: true, fill: '#cccccc', stroke: '#cccccc', strokeWidth: 1,
  }));
  // Outer face line (heavier — 0.7mm equivalent)
  layer.add(new Konva.Line({
    points: [sx + nx * offset, sy + ny * offset, ex + nx * offset, ey + ny * offset],
    stroke: '#111111', strokeWidth: 2.5, lineCap: 'square',
  }));
  // Inner face line (lighter — 0.5mm equivalent)
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
  // Directional arrow at endpoint for hot/cold only
  if (!isDrain && points.length >= 4) {
    const ex = points[points.length - 2];
    const ey = points[points.length - 1];
    const px = points[points.length - 4];
    const py = points[points.length - 3];
    layer.add(new Konva.Arrow({
      points: [px, py, ex, ey],
      stroke: color, fill: color,
      strokeWidth: 2,
      pointerLength: 6, pointerWidth: 5,
    }));
  }
}

// ── Fixtures (professional CAD details) ───────────────────────────────────────

function addFixture(layer: Konva.Layer, fixture: PlacedFixture) {
  const x = fixture.position.x + PAD;
  const y = fixture.position.y + PAD;
  const t = fixture.type;

  if (t === 'toilet') {
    const g = new Konva.Group();
    // Tank
    g.add(new Konva.Rect({ x, y, width: 40, height: 20, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    // Bowl ellipse
    g.add(new Konva.Ellipse({ x: x + 20, y: y + 50, radiusX: 18, radiusY: 25, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    // Inner seat line
    g.add(new Konva.Ellipse({ x: x + 20, y: y + 50, radiusX: 14, radiusY: 20, fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 0.8 }));
    layer.add(g);
  } else if (t === 'sink') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 60, height: 50, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    // Faucet rect at top
    g.add(new Konva.Rect({ x: x + 22, y: y + 2, width: 16, height: 8, fill: '#d0d0d0', stroke: '#1a1a1a', strokeWidth: 1 }));
    // Basin ellipse
    g.add(new Konva.Ellipse({ x: x + 30, y: y + 30, radiusX: 18, radiusY: 14, fill: 'white', stroke: '#1a1a1a', strokeWidth: 1 }));
    // Drain circle
    g.add(new Konva.Circle({ x: x + 30, y: y + 30, radius: 3, fill: '#1a1a1a' }));
    layer.add(g);
  } else if (t === 'bathtub') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 80, height: 180, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    // Inner rounded rect
    g.add(new Konva.Rect({ x: x + 8, y: y + 8, width: 64, height: 164, fill: 'white', stroke: '#1a1a1a', strokeWidth: 1, cornerRadius: 10 }));
    // Drain circle
    g.add(new Konva.Circle({ x: x + 40, y: y + 155, radius: 6, fill: '#e0e0e0', stroke: '#1a1a1a', strokeWidth: 1 }));
    // Faucet rect
    g.add(new Konva.Rect({ x: x + 28, y: y + 12, width: 24, height: 10, fill: '#d0d0d0', stroke: '#1a1a1a', strokeWidth: 1 }));
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
    // Monitor rectangle on top
    g.add(new Konva.Rect({ x: x + 35, y: y + 5, width: 50, height: 30, fill: '#d0d0d0', stroke: '#1a1a1a', strokeWidth: 1 }));
    g.add(new Konva.Rect({ x: x + 55, y: y + 35, width: 10, height: 8, fill: '#b0b0b0', stroke: '#1a1a1a', strokeWidth: 0.5 }));
    layer.add(g);
  } else if (t === 'bed') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 160, height: 200, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    // Headboard
    g.add(new Konva.Rect({ x, y, width: 160, height: 30, fill: '#d0d0d0', stroke: '#1a1a1a', strokeWidth: 1 }));
    // Two pillows
    g.add(new Konva.Rect({ x: x+10, y: y+35, width: 60, height: 35, fill: '#e8e8e8', stroke: '#1a1a1a', strokeWidth: 1, cornerRadius: 4 }));
    g.add(new Konva.Rect({ x: x+90, y: y+35, width: 60, height: 35, fill: '#e8e8e8', stroke: '#1a1a1a', strokeWidth: 1, cornerRadius: 4 }));
    // Blanket line
    g.add(new Konva.Line({ points: [x+5, y+80, x+155, y+80], stroke: '#1a1a1a', strokeWidth: 1 }));
    layer.add(g);
  } else if (t === 'wardrobe') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 120, height: 60, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    // 3-panel door lines
    g.add(new Konva.Line({ points: [x+40, y, x+40, y+60], stroke: '#1a1a1a', strokeWidth: 1 }));
    g.add(new Konva.Line({ points: [x+80, y, x+80, y+60], stroke: '#1a1a1a', strokeWidth: 1 }));
    // Handle lines
    g.add(new Konva.Line({ points: [x+18, y+28, x+22, y+32], stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Line({ points: [x+58, y+28, x+62, y+32], stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Line({ points: [x+98, y+28, x+102, y+32], stroke: '#1a1a1a', strokeWidth: 1.5 }));
    layer.add(g);
  } else if (t === 'sofa') {
    const sw = 200, sh = 90;
    const g = new Konva.Group();
    // Back panel
    g.add(new Konva.Rect({ x, y, width: sw, height: 22, fill: '#c0c0c0', stroke: '#111111', strokeWidth: 1.5 }));
    // Left armrest
    g.add(new Konva.Rect({ x, y: y+22, width: 12, height: sh-22, fill: '#b0b0b0', stroke: '#888888', strokeWidth: 1 }));
    // Right armrest
    g.add(new Konva.Rect({ x: x+sw-12, y: y+22, width: 12, height: sh-22, fill: '#b0b0b0', stroke: '#888888', strokeWidth: 1 }));
    // 3 seat cushions
    for (let i = 0; i < 3; i++) {
      g.add(new Konva.Rect({
        x: x+12+i*((sw-24)/3)+2, y: y+24,
        width: (sw-24)/3-4, height: sh-28,
        fill: '#d8d8d8', stroke: '#999999', strokeWidth: 1, cornerRadius: 3
      }));
    }
    // Cushion seam lines
    g.add(new Konva.Line({ points: [x+12+(sw-24)/3, y+24, x+12+(sw-24)/3, y+sh], stroke: '#aaaaaa', strokeWidth: 0.8 }));
    g.add(new Konva.Line({ points: [x+12+2*(sw-24)/3, y+24, x+12+2*(sw-24)/3, y+sh], stroke: '#aaaaaa', strokeWidth: 0.8 }));
    layer.add(g);
  } else if (t === 'tv_unit') {
    const g = new Konva.Group();
    // Cabinet base
    g.add(new Konva.Rect({ x, y, width: 150, height: 45, fill: '#e8e8e8', stroke: '#111111', strokeWidth: 1.5 }));
    // TV screen (dark inset)
    g.add(new Konva.Rect({ x: x+8, y: y+5, width: 134, height: 28, fill: '#1a2035', stroke: '#444444', strokeWidth: 1 }));
    // Screen glare line
    g.add(new Konva.Line({ points: [x+12, y+8, x+30, y+8], stroke: '#ffffff', strokeWidth: 1, opacity: 0.3 }));
    // Two cabinet legs
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
    // Outer frame
    g.add(new Konva.Rect({ x, y, width: 90, height: 50, fill: '#f5f0e8', stroke: '#111111', strokeWidth: 1.5, cornerRadius: 2 }));
    // Glass top inset
    g.add(new Konva.Rect({ x: x+6, y: y+6, width: 78, height: 38, fill: '#fafaf5', stroke: '#cccccc', strokeWidth: 0.8, cornerRadius: 1 }));
    // 4 corner leg dots
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
    g.add(new Konva.Text({ x: x+2, y: y+18, text: (FIXTURE_LABELS[t] || t.replace(/_/g,' ')).slice(0,10), fontSize: 8, fill: '#555', width: 46, align: 'center' }));
    layer.add(g);
  }
}

// ── Corner fill (covers wall junction gaps) ──────────────────────────────────

function fillCorners(layer: Konva.Layer, walls: Wall[], padding: number) {
  const T = 15;
  const corners: Array<{x: number; y: number}> = [];
  const north = walls.find(w => w.side === 'north');
  const south = walls.find(w => w.side === 'south');
  if (north) { corners.push(north.start); corners.push(north.end); }
  if (south) { corners.push(south.start); corners.push(south.end); }
  corners.forEach(corner => {
    layer.add(new Konva.Rect({
      x: corner.x + padding - T / 2 - 1,
      y: corner.y + padding - T / 2 - 1,
      width: T + 2, height: T + 2,
      fill: '#cccccc', strokeWidth: 0,
    }));
  });
}

function addFixtureLabel(layer: Konva.Layer, fixture: PlacedFixture) {
  const dims: Record<string, { w: number; h: number }> = {
    sink:{w:60,h:50}, toilet:{w:40,h:70}, bathtub:{w:80,h:180},
    shower:{w:90,h:90}, stove:{w:60,h:60}, fridge:{w:60,h:65},
    dishwasher:{w:60,h:60}, desk:{w:120,h:60}, bed:{w:160,h:200},
    wardrobe:{w:120,h:60}, sofa:{w:200,h:90}, tv_unit:{w:150,h:45},
    bookshelf:{w:80,h:30},
  };
  const d = dims[fixture.type] || { w: 50, h: 50 };
  const cx = fixture.position.x + PAD + d.w / 2;
  const cy = fixture.position.y + PAD + d.h / 2 + 2;
  const fontSize = d.w < 60 ? 7 : 8;
  layer.add(new Konva.Text({
    x: cx - 20, y: cy - fontSize / 2,
    text: FIXTURE_LABELS[fixture.type] || fixture.type,
    fontSize, fill: '#444', width: 40, align: 'center',
  }));
}

// ── Windows (GOST: 3 parallel lines spanning full wall thickness) ─────────────

function addWindow(
  layer: Konva.Layer,
  win: WindowSpec & { _roomOffsetX?: number; _roomOffsetY?: number },
  walls: Wall[],
  allWindows: WindowSpec[],
) {
  const wallId = win.wallId;
  const roomOffsetX = win._roomOffsetX;
  const roomOffsetY = win._roomOffsetY;

  let wall: Wall | undefined;
  if (wallId) wall = walls.find(w => w.id === wallId);
  if (!wall && roomOffsetX !== undefined && roomOffsetY !== undefined) {
    wall = walls.find(w => {
      if (w.side !== win.wall) return false;
      const minX = Math.min(w.start.x, w.end.x);
      const minY = Math.min(w.start.y, w.end.y);
      const maxX = Math.max(w.start.x, w.end.x);
      const maxY = Math.max(w.start.y, w.end.y);
      return minX >= roomOffsetX - 10 && minY >= roomOffsetY - 10 &&
             maxX <= roomOffsetX + 1500 && maxY <= roomOffsetY + 1500;
    });
  }
  if (!wall) wall = walls.find(w => w.side === win.wall);
  if (!wall) return;

  const winWidth = (win.width || 1.2) * 100;
  const T = wall.thickness;
  const wallStartX = wall.start.x + PAD;
  const wallStartY = wall.start.y + PAD;
  const wallEndX   = wall.end.x + PAD;
  const wallEndY   = wall.end.y + PAD;

  const sameWall = allWindows.filter(w =>
    w.wall === win.wall && (!(w as typeof win).wallId || (w as typeof win).wallId === win.wallId)
  );
  const winIndex = sameWall.findIndex(w => w.id === win.id);
  const winCount = sameWall.length;

  const isHorizontal = win.wall === 'north' || win.wall === 'south';
  let centerX: number, centerY: number;
  if (isHorizontal) {
    const seg = (wallEndX - wallStartX) / (winCount + 1);
    centerX = wallStartX + seg * (winIndex + 1);
    centerY = (wallStartY + wallEndY) / 2;
  } else {
    const seg = (wallEndY - wallStartY) / (winCount + 1);
    centerX = (wallStartX + wallEndX) / 2;
    centerY = wallStartY + seg * (winIndex + 1);
  }

  const halfW = winWidth / 2;
  // Wall outer/inner face coords for the window opening
  // Extend slightly beyond wall faces for visibility
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
  // White out wall opening
  g.add(new Konva.Rect({ x: x1, y: y1, width: x2 - x1, height: y2 - y1, fill: 'white' }));

  // GOST 21.205-93: 3 parallel black lines at outer face, center, inner face
  if (isHorizontal) {
    // Lines span window width, at y1 (outer), mid, y2 (inner)
    g.add(new Konva.Line({ points: [x1, y1, x2, y1], stroke: '#1a1a1a', strokeWidth: 1.2 }));
    g.add(new Konva.Line({ points: [x1, (y1+y2)/2, x2, (y1+y2)/2], stroke: '#1a1a1a', strokeWidth: 2 }));
    g.add(new Konva.Line({ points: [x1, y2, x2, y2], stroke: '#1a1a1a', strokeWidth: 1.2 }));
  } else {
    // Lines span window height, at x1 (outer), mid, x2 (inner)
    g.add(new Konva.Line({ points: [x1, y1, x1, y2], stroke: '#1a1a1a', strokeWidth: 1.2 }));
    g.add(new Konva.Line({ points: [(x1+x2)/2, y1, (x1+x2)/2, y2], stroke: '#1a1a1a', strokeWidth: 2 }));
    g.add(new Konva.Line({ points: [x2, y1, x2, y2], stroke: '#1a1a1a', strokeWidth: 1.2 }));
  }
  layer.add(g);
}

// ── Doors (gap + leaf perpendicular to wall + dashed arc) ────────────────────

function addDoor(layer: Konva.Layer, door: DoorSpec & { _roomOffsetX?: number; _roomOffsetY?: number }, walls: Wall[]) {
  const wallId = door.wallId;
  const roomOffsetX = door._roomOffsetX;
  const roomOffsetY = door._roomOffsetY;

  let wall: Wall | undefined;
  if (wallId) wall = walls.find(w => w.id === wallId);
  if (!wall && roomOffsetX !== undefined && roomOffsetY !== undefined) {
    wall = walls.find(w => {
      if (w.side !== door.wall) return false;
      const minX = Math.min(w.start.x, w.end.x);
      const minY = Math.min(w.start.y, w.end.y);
      const maxX = Math.max(w.start.x, w.end.x);
      const maxY = Math.max(w.start.y, w.end.y);
      return minX >= roomOffsetX - 10 && minY >= roomOffsetY - 10 &&
             maxX <= roomOffsetX + 1500 && maxY <= roomOffsetY + 1500;
    });
  }
  if (!wall) wall = walls.find(w => w.side === door.wall);
  if (!wall) return;

  const dw = (door.width || 0.9) * 100;
  const T  = wall.thickness;
  const wallStartX = wall.start.x + PAD;
  const wallStartY = wall.start.y + PAD;
  const wallEndX   = wall.end.x + PAD;
  const wallEndY   = wall.end.y + PAD;
  const midX = (wallStartX + wallEndX) / 2;
  const midY = (wallStartY + wallEndY) / 2;
  const side = door.wall;

  // Wall center line Y or X
  const wallCY = (wallStartY + wallEndY) / 2;
  const wallCX = (wallStartX + wallEndX) / 2;

  // Opening: centered on wall midpoint, spans door width along wall
  // Gap rect covers full wall thickness
  let gapX: number, gapY: number, gapW: number, gapH: number;
  let pivotX: number, pivotY: number;
  let leafX: number, leafY: number;

  if (side === 'north') {
    gapX = midX - dw / 2; gapY = wallCY - T / 2; gapW = dw; gapH = T;
    // Pivot: inner face (bottom), left. Leaf: perpendicular INTO room (down), length=dw
    pivotX = gapX;        pivotY = wallCY + T / 2;
    leafX  = pivotX;      leafY  = pivotY + dw;
  } else if (side === 'south') {
    gapX = midX - dw / 2; gapY = wallCY - T / 2; gapW = dw; gapH = T;
    // Pivot: inner face (top), right. Leaf: perpendicular INTO room (up), length=dw
    pivotX = gapX + dw;   pivotY = wallCY - T / 2;
    leafX  = pivotX;      leafY  = pivotY - dw;
  } else if (side === 'east') {
    gapX = wallCX - T / 2; gapY = midY - dw / 2; gapW = T; gapH = dw;
    // Pivot: inner face (left), top. Leaf: perpendicular INTO room (left), length=dw
    pivotX = wallCX - T / 2; pivotY = gapY;
    leafX  = pivotX - dw;    leafY  = pivotY;
  } else {
    gapX = wallCX - T / 2; gapY = midY - dw / 2; gapW = T; gapH = dw;
    // Pivot: inner face (right), top. Leaf: perpendicular INTO room (right), length=dw
    pivotX = wallCX + T / 2; pivotY = gapY;
    leafX  = pivotX + dw;    leafY  = pivotY;
  }

  const g = new Konva.Group();
  g.add(new Konva.Rect({ x: gapX, y: gapY, width: gapW, height: gapH, fill: 'white' }));
  // Swing arc first (behind leaf)
  const kappa = 0.5523;
  let arcPoints: number[];
  if (side === 'north') {
    // Pivot bottom-left, leaf goes DOWN. Arc from leaf tip to wall face (right of pivot)
    arcPoints = [leafX, leafY, leafX + dw * kappa, leafY, pivotX + dw, pivotY + dw * (1 - kappa), pivotX + dw, pivotY];
  } else if (side === 'south') {
    // Pivot top-right, leaf goes UP. Arc from leaf tip to wall face (left of pivot)
    arcPoints = [leafX, leafY, leafX - dw * kappa, leafY, pivotX - dw, pivotY - dw * (1 - kappa), pivotX - dw, pivotY];
  } else if (side === 'east') {
    // Pivot top-left, leaf goes LEFT. Arc from leaf tip to wall face (below pivot)
    arcPoints = [leafX, leafY, leafX, leafY + dw * kappa, pivotX - dw * (1 - kappa), pivotY + dw, pivotX, pivotY + dw];
  } else {
    // Pivot top-right, leaf goes RIGHT. Arc from leaf tip to wall face (below pivot)
    arcPoints = [leafX, leafY, leafX, leafY + dw * kappa, pivotX + dw * (1 - kappa), pivotY + dw, pivotX, pivotY + dw];
  }
  g.add(new Konva.Line({ points: arcPoints, bezier: true, stroke: '#555555', strokeWidth: 1, dash: [4, 3] }));
  // Door leaf on top (drawn last = highest z-order)
  g.add(new Konva.Line({ points: [pivotX, pivotY, leafX, leafY], stroke: '#000000', strokeWidth: 3 }));
  layer.add(g);
}

// ── Dimension lines (tick-mark style, offset outside) ────────────────────────

function addDimension(layer: Konva.Layer, dim: DimensionLine, totalW: number, totalH: number, minX = 0, minY = 0) {
  const startX = dim.start.x + PAD;
  const startY = dim.start.y + PAD;
  const endX   = dim.end.x + PAD;
  const endY   = dim.end.y + PAD;
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  // Room label (value === 0) — rendered by addRoomBackgrounds, skip here
  if (dim.value === 0) return;

  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;

  const ux = dx / len;
  const uy = dy / len;

  // Determine outward normal based on wall position relative to room center
  const roomCX = PAD + minX + totalW / 2;
  const roomCY = PAD + minY + totalH / 2;

  // Raw perpendicular (left of direction)
  let nx = -uy;
  let ny = ux;

  // Vector from wall midpoint to room center
  const toCenterX = roomCX - midX;
  const toCenterY = roomCY - midY;

  // If normal points toward center, flip it (we want outward)
  if (nx * toCenterX + ny * toCenterY > 0) {
    nx = -nx;
    ny = -ny;
  }

  // Offset dimension line points (outside the wall)
  // Clamp to ensure dim line stays within canvas (min y=30 for north, etc.)
  const ax = startX + nx * DIM_OFFSET;
  const ay = Math.max(30, startY + ny * DIM_OFFSET);
  const bx = endX   + nx * DIM_OFFSET;
  const by = Math.max(30, endY   + ny * DIM_OFFSET);

  // Main dimension line
  layer.add(new Konva.Line({ points: [ax, ay, bx, by], stroke: '#555555', strokeWidth: 0.8 }));

  // Extension lines from wall face to 10u past dim line
  layer.add(new Konva.Line({
    points: [startX, startY, startX + nx * (DIM_OFFSET + DIM_EXT), startY + ny * (DIM_OFFSET + DIM_EXT)],
    stroke: '#555555', strokeWidth: 0.8,
  }));
  layer.add(new Konva.Line({
    points: [endX, endY, endX + nx * (DIM_OFFSET + DIM_EXT), endY + ny * (DIM_OFFSET + DIM_EXT)],
    stroke: '#555555', strokeWidth: 0.8,
  }));

  // 45° tick marks at each end of dimension line
  const half = TICK_SIZE / 2;
  layer.add(new Konva.Line({
    points: [ax - ux * half - nx * half, ay - uy * half - ny * half,
             ax + ux * half + nx * half, ay + uy * half + ny * half],
    stroke: '#333333', strokeWidth: 1.2,
  }));
  layer.add(new Konva.Line({
    points: [bx - ux * half - nx * half, by - uy * half - ny * half,
             bx + ux * half + nx * half, by + uy * half + ny * half],
    stroke: '#333333', strokeWidth: 1.2,
  }));

  // Text centered outside dim line
  layer.add(new Konva.Text({
    x: midX + nx * (DIM_OFFSET + 6) - 22,
    y: midY + ny * (DIM_OFFSET + 6) - 6,
    text: dim.label,
    fontSize: 9.5, fontFamily: 'Arial', fill: '#111111', width: 44, align: 'center',
  }));
}

// ── Room backgrounds + labels ─────────────────────────────────────────────────

function addRoomBackgrounds(layer: Konva.Layer, drawingData: DrawingData) {
  if (drawingData.walls.length <= 4) return;
  drawingData.dimensions
    .filter(d => d.id.startsWith('label-'))
    .forEach(d => {
      const cx = d.start.x + PAD;
      const cy = (d.start.y + d.end.y) / 2 + PAD;
      const label = d.label.toLowerCase();
      let color = ROOM_COLORS.default;
      if (/oshxona|kitchen/.test(label))        color = ROOM_COLORS.kitchen;
      else if (/hammom|bathroom/.test(label))   color = ROOM_COLORS.bathroom;
      else if (/yotoqxona|bedroom/.test(label)) color = ROOM_COLORS.bedroom;
      else if (/zal|mehmonxona|living/.test(label)) color = ROOM_COLORS.living;
      else if (/ofis|office/.test(label))       color = ROOM_COLORS.office;
      else if (/koridor|hallway/.test(label))   color = ROOM_COLORS.hallway;
      layer.add(new Konva.Circle({ x: cx, y: cy, radius: 40, fill: color, opacity: 0.5 }));

      // Professional 2-line room label: name (bold) + area
      // label format: "Hammom 12.0m²"
      const parts = d.label.match(/^(.+?)\s+([\d.]+m²)$/);
      const roomName = parts ? parts[1] : d.label;
      const roomArea = parts ? parts[2] : '';
      layer.add(new Konva.Text({
        x: cx - 50, y: cy - 12,
        text: roomName,
        fontSize: 10, fontStyle: 'bold', fontFamily: 'Arial',
        fill: '#111111', width: 100, align: 'center',
      }));
      if (roomArea) {
        layer.add(new Konva.Text({
          x: cx - 50, y: cy + 3,
          text: roomArea,
          fontSize: 9, fontFamily: 'Arial',
          fill: '#333333', width: 100, align: 'center',
        }));
      }
    });
}

// ── Title block (GOST shtamp 220x80) ─────────────────────────────────────────

function addTitleBlock(layer: Konva.Layer, totalWidth: number, totalHeight: number) {
  const blockW = 220, blockH = 80;
  const blockX = Math.max(totalWidth + PAD - blockW - 5, PAD + 160);
  const blockY = totalHeight + PAD + 110;
  const date = new Date().toLocaleDateString('uz-UZ');

  const g = new Konva.Group();
  // Outer border
  g.add(new Konva.Rect({ x: blockX, y: blockY, width: blockW, height: blockH, stroke: '#1a1a1a', strokeWidth: 1.5, fill: 'white' }));
  // Vertical divider at x+100
  g.add(new Konva.Line({ points: [blockX+100, blockY, blockX+100, blockY+blockH], stroke: '#1a1a1a', strokeWidth: 0.8 }));

  // Row dividers (inner)
  const rows = [20, 40, 60];
  rows.forEach(dy => {
    g.add(new Konva.Line({ points: [blockX, blockY+dy, blockX+blockW, blockY+dy], stroke: '#1a1a1a', strokeWidth: 0.8 }));
  });

  // Left column content
  g.add(new Konva.Text({ x: blockX+4, y: blockY+4,  text: 'Loyiha nomi',    fontSize: 8, fontFamily: 'Arial', fill: '#555' }));
  g.add(new Konva.Text({ x: blockX+4, y: blockY+24, text: 'Floor Plan',     fontSize: 10, fontFamily: 'Arial', fontStyle: 'bold', fill: '#1a1a1a' }));
  g.add(new Konva.Text({ x: blockX+4, y: blockY+44, text: 'Masshtab',       fontSize: 8, fontFamily: 'Arial', fill: '#555' }));
  g.add(new Konva.Text({ x: blockX+4, y: blockY+54, text: '1:50',           fontSize: 10, fontFamily: 'Arial', fontStyle: 'bold', fill: '#1a1a1a' }));
  g.add(new Konva.Text({ x: blockX+4, y: blockY+64, text: 'SNiP 2.04.01-85', fontSize: 8, fontFamily: 'Arial', fill: '#555' }));

  // Right column content
  g.add(new Konva.Text({ x: blockX+104, y: blockY+4,  text: 'Sana',         fontSize: 8, fontFamily: 'Arial', fill: '#555' }));
  g.add(new Konva.Text({ x: blockX+104, y: blockY+14, text: date,           fontSize: 9, fontFamily: 'Arial', fill: '#1a1a1a' }));
  g.add(new Konva.Text({ x: blockX+104, y: blockY+44, text: 'Bosqich',      fontSize: 8, fontFamily: 'Arial', fill: '#555' }));
  g.add(new Konva.Text({ x: blockX+104, y: blockY+54, text: 'РП',           fontSize: 10, fontFamily: 'Arial', fontStyle: 'bold', fill: '#1a1a1a' }));

  layer.add(g);
}

// ── Legend (bordered box) ─────────────────────────────────────────────────────

function addLegend(layer: Konva.Layer, totalHeight: number) {
  const lx = PAD;
  const ly = totalHeight + PAD + 110;
  const boxW = 165, boxH = 55;

  const g = new Konva.Group();
  // Border box
  g.add(new Konva.Rect({ x: lx, y: ly, width: boxW, height: boxH, fill: 'white', stroke: '#bbbbbb', strokeWidth: 0.8 }));
  // Cold water
  g.add(new Konva.Line({ points: [lx+8, ly+13, lx+33, ly+13], stroke: '#2563eb', strokeWidth: 2 }));
  g.add(new Konva.Text({ x: lx+38, y: ly+7,  text: 'Sovuq suv (H)',    fontSize: 9, fontFamily: 'Arial', fill: '#111111' }));
  // Hot water
  g.add(new Konva.Line({ points: [lx+8, ly+29, lx+33, ly+29], stroke: '#dc2626', strokeWidth: 2 }));
  g.add(new Konva.Text({ x: lx+38, y: ly+23, text: 'Issiq suv (I)',     fontSize: 9, fontFamily: 'Arial', fill: '#111111' }));
  // Drain
  g.add(new Konva.Line({ points: [lx+8, ly+45, lx+33, ly+45], stroke: '#64748b', strokeWidth: 1.5, dash: [6,4], opacity: 0.75 }));
  g.add(new Konva.Text({ x: lx+38, y: ly+39, text: 'Kanalizatsiya (K)', fontSize: 9, fontFamily: 'Arial', fill: '#111111' }));
  layer.add(g);
}

// ── Component ─────────────────────────────────────────────────────────────────

const Canvas2D = forwardRef<Canvas2DHandle, Canvas2DProps>(
  function Canvas2D({ drawingData, width = 800, scale = 1 }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage | null>(null);

    useImperativeHandle(ref, () => ({
      exportToPdf(filename = 'floorplan.pdf') {
        const stage = stageRef.current;
        if (!stage) return;
        const dataUrl = stage.toDataURL({ pixelRatio: 3 });
        const imgW = stage.width();
        const imgH = stage.height();
        const orientation = imgW >= imgH ? 'landscape' : 'portrait';
        const pdf = new jsPDF({ orientation, unit: 'px', format: [imgW, imgH] });
        pdf.addImage(dataUrl, 'PNG', 0, 0, imgW, imgH);
        pdf.save(filename);
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      if (stageRef.current) {
        stageRef.current.destroy();
        stageRef.current = null;
      }

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

      const stage = new Konva.Stage({
        container: containerRef.current,
        width,
        height: renderedHeight,
        scaleX: autoScale,
        scaleY: autoScale,
      });
      stageRef.current = stage;

      const layer = new Konva.Layer();
      stage.add(layer);

      // 1. White room fill
      layer.add(new Konva.Rect({
        x: PAD + minX, y: PAD + minY,
        width: totalWidth, height: totalHeight,
        fill: 'white',
      }));

      // 2. Room color backgrounds + labels
      addRoomBackgrounds(layer, drawingData);

      // Single-room label (no label- dims)
      if (!drawingData.dimensions.some(d => d.id.startsWith('label-'))) {
        layer.add(new Konva.Text({
          x: PAD + minX + totalWidth / 2 - 50,
          y: PAD + minY + totalHeight / 2 - 10,
          text: 'Xona',
          fontSize: 10, fontStyle: 'bold', fontFamily: 'Arial',
          fill: '#111111', width: 100, align: 'center',
        }));
      }

      // 3. Grid
      addGrid(layer, width / autoScale, contentHeight);

      // 4. Pipes (with directional arrow for hot/cold)
      (drawingData.pipes ?? []).forEach(p => addPipe(layer, p));

      // 5. Walls
      drawingData.walls.forEach(w => addWall(layer, w));
      // Fill corners to close wall junction gaps
      fillCorners(layer, drawingData.walls, PAD);

      // 6. Doors
      (drawingData.doors ?? []).forEach(d =>
        addDoor(layer, d as DoorSpec & { _roomOffsetX?: number; _roomOffsetY?: number }, drawingData.walls)
      );

      // 7. Windows
      const windows = (drawingData as DrawingData & { windows?: WindowSpec[] }).windows ?? [];
      windows.forEach(win =>
        addWindow(
          layer,
          win as WindowSpec & { _roomOffsetX?: number; _roomOffsetY?: number },
          drawingData.walls,
          windows,
        )
      );

      // 8. Fixtures + labels
      drawingData.fixtures.forEach(f => addFixture(layer, f));
      drawingData.fixtures.forEach(f => addFixtureLabel(layer, f));

      // 9. Dimension lines
      drawingData.dimensions.forEach(d => addDimension(layer, d, totalWidth, totalHeight, minX, minY));

      // 10. Title block + Legend
      addTitleBlock(layer, totalWidth, totalHeight);
      addLegend(layer, totalHeight);

      layer.draw();

      return () => {
        stage.destroy();
        stageRef.current = null;
      };
    }, [drawingData, width, scale]);

    return (
      <div className="border border-gray-300 rounded-lg overflow-hidden w-full">
        <div ref={containerRef} className="bg-white w-full" />
      </div>
    );
  }
);

export default Canvas2D;
