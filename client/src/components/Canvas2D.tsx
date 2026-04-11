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
const CANVAS_PADDING = 80;
const WALL_T = 15;

// ── Imperative render helpers ────────────────────────────────────────────────

function addGrid(layer: Konva.Layer, gridW: number, gridH: number) {
  for (let i = 0; i <= gridW; i += GRID_SIZE) {
    layer.add(new Konva.Line({ points: [i, 0, i, gridH], stroke: '#e0e0e0', strokeWidth: 0.5 }));
  }
  for (let i = 0; i <= gridH; i += GRID_SIZE) {
    layer.add(new Konva.Line({ points: [0, i, gridW, i], stroke: '#e0e0e0', strokeWidth: 0.5 }));
  }
}

function addWall(layer: Konva.Layer, wall: Wall) {
  const offset = wall.thickness / 2;
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const nx = -dy / len;
  const ny = dx / len;

  const sx = wall.start.x + CANVAS_PADDING;
  const sy = wall.start.y + CANVAS_PADDING;
  const ex = wall.end.x + CANVAS_PADDING;
  const ey = wall.end.y + CANVAS_PADDING;

  // Fill
  layer.add(new Konva.Line({
    points: [
      sx + nx * offset, sy + ny * offset,
      ex + nx * offset, ey + ny * offset,
      ex - nx * offset, ey - ny * offset,
      sx - nx * offset, sy - ny * offset,
    ],
    closed: true, fill: '#f5f5f5', stroke: undefined, strokeWidth: 0,
  }));
  // Outer line
  layer.add(new Konva.Line({
    points: [sx + nx * offset, sy + ny * offset, ex + nx * offset, ey + ny * offset],
    stroke: '#1a1a1a', strokeWidth: 2,
  }));
  // Inner line
  layer.add(new Konva.Line({
    points: [sx - nx * offset, sy - ny * offset, ex - nx * offset, ey - ny * offset],
    stroke: '#1a1a1a', strokeWidth: 2,
  }));
}

function addPipe(layer: Konva.Layer, pipe: Pipe) {
  const points = pipe.path.flatMap(p => [p.x + CANVAS_PADDING, p.y + CANVAS_PADDING]);
  const isDrain = pipe.type === 'drain';
  const isCold  = pipe.type === 'cold';
  layer.add(new Konva.Line({
    points,
    stroke: isCold ? '#3b82f6' : isDrain ? '#64748b' : '#ef4444',
    strokeWidth: isDrain ? 1.5 : 2,
    dash: isDrain ? [4, 4] : undefined,
    opacity: isDrain ? 0.7 : 0.9,
  }));
}

function addFixture(layer: Konva.Layer, fixture: PlacedFixture) {
  const x = fixture.position.x + CANVAS_PADDING;
  const y = fixture.position.y + CANVAS_PADDING;
  const t = fixture.type;

  if (t === 'toilet') {
    // Toilet: tank + bowl
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 40, height: 20, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Ellipse({ x: x + 20, y: y + 50, radiusX: 18, radiusY: 25, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    layer.add(g);
  } else if (t === 'sink') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 60, height: 50, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Ellipse({ x: x + 30, y: y + 28, radiusX: 18, radiusY: 14, fill: 'white', stroke: '#1a1a1a', strokeWidth: 1 }));
    g.add(new Konva.Circle({ x: x + 30, y: y + 28, radius: 3, fill: '#1a1a1a' }));
    layer.add(g);
  } else if (t === 'bathtub') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 80, height: 180, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Rect({ x: x + 8, y: y + 8, width: 64, height: 164, fill: 'white', stroke: '#1a1a1a', strokeWidth: 1, cornerRadius: 8 }));
    g.add(new Konva.Circle({ x: x + 40, y: y + 155, radius: 8, fill: '#e0e0e0', stroke: '#1a1a1a', strokeWidth: 1 }));
    layer.add(g);
  } else if (t === 'shower') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 90, height: 90, fill: '#f0f8ff', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Arc({ x: x, y: y + 90, innerRadius: 0, outerRadius: 90, angle: 90, rotation: 270, fill: 'rgba(59,130,246,0.1)', stroke: '#3b82f6', strokeWidth: 1 }));
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
    g.add(new Konva.Rect({ x: x+40, y, width: 40, height: 5, fill: '#1a1a1a' }));
    layer.add(g);
  } else if (t === 'bed') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 160, height: 200, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Rect({ x: x+10, y: y+5, width: 140, height: 40, fill: '#e0e0e0', stroke: '#1a1a1a', strokeWidth: 1 }));
    g.add(new Konva.Line({ points: [x, y+50, x+160, y+50], stroke: '#1a1a1a', strokeWidth: 1 }));
    layer.add(g);
  } else if (t === 'wardrobe') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 120, height: 60, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Line({ points: [x+60, y, x+60, y+60], stroke: '#1a1a1a', strokeWidth: 1 }));
    layer.add(g);
  } else if (t === 'sofa') {
    const sw = 200, sh = 90;
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: sw, height: sh*0.22, fill: '#d0d0d0', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    for (let i = 0; i < 3; i++) {
      g.add(new Konva.Rect({ x: x + i*(sw/3), y: y+sh*0.22, width: sw/3-2, height: sh*0.78, fill: '#e8e8e8', stroke: '#1a1a1a', strokeWidth: 1 }));
    }
    g.add(new Konva.Rect({ x, y: y+sh*0.22, width: 8, height: sh*0.78, fill: '#c0c0c0', stroke: '#1a1a1a', strokeWidth: 0.5 }));
    g.add(new Konva.Rect({ x: x+sw-8, y: y+sh*0.22, width: 8, height: sh*0.78, fill: '#c0c0c0', stroke: '#1a1a1a', strokeWidth: 0.5 }));
    layer.add(g);
  } else if (t === 'tv_unit') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 150, height: 45, fill: '#f5f5f5', stroke: '#1a1a1a', strokeWidth: 1.5 }));
    g.add(new Konva.Rect({ x: x+35, y: y-8, width: 80, height: 5, fill: '#1a1a1a' }));
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
    g.add(new Konva.Rect({ x, y, width: 90, height: 50, fill: '#f0ebe0', stroke: '#1a1a1a', strokeWidth: 1.5, cornerRadius: 3 }));
    g.add(new Konva.Rect({ x: x+5, y: y+5, width: 80, height: 40, fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 0.5, cornerRadius: 2 }));
    layer.add(g);
  } else if (t === 'dining_table') {
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 120, height: 80, fill: '#f5f0e8', stroke: '#1a1a1a', strokeWidth: 1.5, cornerRadius: 3 }));
    [[x+20,y-15],[x+70,y-15],[x+20,y+83],[x+70,y+83]].forEach(([cx,cy]) =>
      g.add(new Konva.Rect({ x: cx, y: cy, width: 30, height: 12, fill: '#e0e0e0', stroke: '#1a1a1a', strokeWidth: 0.5 }))
    );
    layer.add(g);
  } else {
    // default fallback
    const g = new Konva.Group();
    g.add(new Konva.Rect({ x, y, width: 50, height: 50, fill: '#f0f0f0', stroke: '#1a1a1a', strokeWidth: 1 }));
    g.add(new Konva.Text({ x: x+2, y: y+18, text: (FIXTURE_LABELS[t] || t.replace(/_/g,' ')).slice(0,10), fontSize: 8, fill: '#555', width: 46, align: 'center' }));
    layer.add(g);
  }
}

function addFixtureLabel(layer: Konva.Layer, fixture: PlacedFixture) {
  const dims: Record<string, { w: number; h: number }> = {
    sink:{w:60,h:50}, toilet:{w:40,h:70}, bathtub:{w:80,h:180},
    shower:{w:90,h:90}, stove:{w:60,h:60}, fridge:{w:60,h:65},
    dishwasher:{w:60,h:60}, desk:{w:120,h:60}, bed:{w:160,h:200},
    wardrobe:{w:120,h:60}, sofa:{w:200,h:90}, tv_unit:{w:150,h:45},
    bookshelf:{w:90,h:30},
  };
  const d = dims[fixture.type] || { w: 50, h: 50 };
  const cx = fixture.position.x + CANVAS_PADDING + d.w / 2;
  const cy = fixture.position.y + CANVAS_PADDING + d.h / 2 + 2;
  const fontSize = d.w < 60 ? 7 : 8;
  layer.add(new Konva.Text({
    x: cx - 20, y: cy - fontSize / 2,
    text: FIXTURE_LABELS[fixture.type] || fixture.type,
    fontSize, fill: '#444', width: 40, align: 'center',
  }));
}

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
  const P = CANVAS_PADDING;

  const wallStartX = wall.start.x + P;
  const wallStartY = wall.start.y + P;
  const wallEndX   = wall.end.x + P;
  const wallEndY   = wall.end.y + P;

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
  let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  if (win.wall === 'north')      { x1=centerX-halfW; y1=wallStartY;        x2=centerX+halfW; y2=wallStartY+WALL_T; }
  else if (win.wall === 'south') { x1=centerX-halfW; y1=wallEndY-WALL_T;   x2=centerX+halfW; y2=wallEndY; }
  else if (win.wall === 'east')  { x1=wallStartX-WALL_T; y1=centerY-halfW; x2=wallStartX;    y2=centerY+halfW; }
  else                           { x1=wallStartX;    y1=centerY-halfW;     x2=wallStartX+WALL_T; y2=centerY+halfW; }

  const g = new Konva.Group();
  g.add(new Konva.Rect({ x: x1, y: y1, width: x2-x1, height: y2-y1, fill: 'white' }));
  const mid1 = isHorizontal ? [x1,(y1+y2)/2-3,x2,(y1+y2)/2-3] : [(x1+x2)/2-3,y1,(x1+x2)/2-3,y2];
  const mid2 = isHorizontal ? [x1,(y1+y2)/2,  x2,(y1+y2)/2  ] : [(x1+x2)/2,  y1,(x1+x2)/2,  y2];
  const mid3 = isHorizontal ? [x1,(y1+y2)/2+3,x2,(y1+y2)/2+3] : [(x1+x2)/2+3,y1,(x1+x2)/2+3,y2];
  g.add(new Konva.Line({ points: mid1, stroke: '#3b82f6', strokeWidth: 1, opacity: 0.7 }));
  g.add(new Konva.Line({ points: mid2, stroke: '#3b82f6', strokeWidth: 1.5, opacity: 0.9 }));
  g.add(new Konva.Line({ points: mid3, stroke: '#3b82f6', strokeWidth: 1, opacity: 0.7 }));
  g.add(new Konva.Rect({ x: x1, y: y1, width: x2-x1, height: y2-y1, fill: '#3b82f6', opacity: 0.1 }));
  layer.add(g);
}

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

  const doorWidth = (door.width || 0.9) * 100;
  const P = CANVAS_PADDING;

  const wallStartX = wall.start.x + P;
  const wallStartY = wall.start.y + P;
  const wallEndX   = wall.end.x + P;
  const wallEndY   = wall.end.y + P;

  const midX = (wallStartX + wallEndX) / 2;
  const midY = (wallStartY + wallEndY) / 2;
  const halfDoor = doorWidth / 2;

  let op: number[] = [];
  let arcX = 0, arcY = 0, arcRotation = 0;
  const side = door.wall;

  if (side === 'north') {
    const dx = midX - halfDoor;
    op = [dx, wallStartY, dx + doorWidth, wallStartY + WALL_T];
    arcX = dx; arcY = wallStartY + WALL_T; arcRotation = 90;
  } else if (side === 'south') {
    const dx = midX - halfDoor;
    op = [dx, wallEndY - WALL_T, dx + doorWidth, wallEndY];
    arcX = dx; arcY = wallEndY - WALL_T; arcRotation = 270;
  } else if (side === 'east') {
    const dy = midY - halfDoor;
    op = [wallStartX - WALL_T, dy, wallStartX, dy + doorWidth];
    arcX = wallStartX - WALL_T; arcY = dy + doorWidth; arcRotation = 180;
  } else {
    const dy = midY - halfDoor;
    op = [wallStartX, dy, wallStartX + WALL_T, dy + doorWidth];
    arcX = wallStartX + WALL_T; arcY = dy; arcRotation = 90;
  }

  const g = new Konva.Group();
  // Opening (white out)
  g.add(new Konva.Rect({ x: op[0], y: op[1], width: op[2]-op[0], height: op[3]-op[1], fill: 'white' }));
  // Door leaf
  const leafPoints = (side === 'north' || side === 'south')
    ? [arcX, arcY, arcX + doorWidth, arcY]
    : side === 'east'
      ? [arcX, arcY, arcX, arcY - doorWidth]
      : [arcX, arcY, arcX, arcY + doorWidth];
  g.add(new Konva.Line({ points: leafPoints, stroke: '#1a1a1a', strokeWidth: 1.5 }));
  // Swing arc
  g.add(new Konva.Arc({
    x: arcX, y: arcY,
    innerRadius: 0, outerRadius: doorWidth * 0.85,
    angle: 90, rotation: arcRotation,
    stroke: '#1a1a1a', strokeWidth: 1,
  }));
  layer.add(g);
}

function addDimension(layer: Konva.Layer, dim: DimensionLine) {
  const startX = dim.start.x + CANVAS_PADDING;
  const startY = dim.start.y + CANVAS_PADDING;
  const endX   = dim.end.x + CANVAS_PADDING;
  const endY   = dim.end.y + CANVAS_PADDING;
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  if (dim.value === 0) {
    layer.add(new Konva.Text({
      x: midX - 50, y: midY - 8,
      text: dim.label, fontSize: 10, fontStyle: 'bold', fill: '#1a1a1a', width: 100, align: 'center',
    }));
    return;
  }

  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const nx = -dy / len;
  const ny = dx / len;
  const offset = -30;

  const ax = startX + nx * offset;
  const ay = startY + ny * offset;
  const bx = endX   + nx * offset;
  const by = endY   + ny * offset;

  layer.add(new Konva.Arrow({
    points: [ax, ay, bx, by],
    stroke: '#1a1a1a', strokeWidth: 1,
    pointerLength: 8, pointerWidth: 8, pointerAtBeginning: true,
  }));
  layer.add(new Konva.Text({
    x: midX + nx * offset - 20,
    y: midY + ny * offset - 15,
    text: dim.label, fontSize: 12, fill: '#1a1a1a',
  }));
}

function addRoomBackgrounds(layer: Konva.Layer, drawingData: DrawingData) {
  if (drawingData.walls.length <= 4) return;
  drawingData.dimensions
    .filter(d => d.id.startsWith('label-'))
    .forEach(d => {
      const cx = d.start.x;
      const cy = (d.start.y + d.end.y) / 2;
      const label = d.label.toLowerCase();
      let color = ROOM_COLORS.default;
      if (/oshxona|kitchen/.test(label))      color = ROOM_COLORS.kitchen;
      else if (/hammom|bathroom/.test(label)) color = ROOM_COLORS.bathroom;
      else if (/yotoqxona|bedroom/.test(label)) color = ROOM_COLORS.bedroom;
      else if (/zal|mehmonxona|living/.test(label)) color = ROOM_COLORS.living;
      else if (/ofis|office/.test(label))     color = ROOM_COLORS.office;
      else if (/koridor|hallway/.test(label)) color = ROOM_COLORS.hallway;
      layer.add(new Konva.Circle({
        x: cx + CANVAS_PADDING, y: cy + CANVAS_PADDING,
        radius: 40, fill: color, opacity: 0.5,
      }));
    });
}

function addTitleBlock(layer: Konva.Layer, totalWidth: number, totalHeight: number) {
  const blockW = 180, blockH = 70;
  const blockX = Math.max(totalWidth + CANVAS_PADDING - blockW - 5, CANVAS_PADDING + 160);
  const blockY = totalHeight + CANVAS_PADDING + 25;
  const date = new Date().toLocaleDateString('uz-UZ');

  const g = new Konva.Group();
  g.add(new Konva.Rect({ x: blockX, y: blockY, width: blockW, height: blockH, stroke: '#1a1a1a', strokeWidth: 1, fill: 'white' }));
  g.add(new Konva.Text({ x: blockX+8, y: blockY+8,  text: 'Floor Plan',      fontSize: 11, fontFamily: 'monospace', fontStyle: 'bold', fill: '#1a1a1a' }));
  g.add(new Konva.Text({ x: blockX+8, y: blockY+24, text: 'Masshtab: 1:50',  fontSize: 9,  fontFamily: 'monospace', fill: '#1a1a1a' }));
  g.add(new Konva.Text({ x: blockX+8, y: blockY+38, text: `Sana: ${date}`,   fontSize: 9,  fontFamily: 'monospace', fill: '#1a1a1a' }));
  g.add(new Konva.Text({ x: blockX+8, y: blockY+52, text: 'SNiP 2.04.01-85', fontSize: 9,  fontFamily: 'monospace', fill: '#555' }));
  layer.add(g);
}

function addLegend(layer: Konva.Layer, totalHeight: number) {
  const lx = CANVAS_PADDING;
  const ly = totalHeight + CANVAS_PADDING + 25;

  const g = new Konva.Group();
  g.add(new Konva.Line({ points: [lx, ly+8,  lx+25, ly+8],  stroke: '#3b82f6', strokeWidth: 2, opacity: 0.8 }));
  g.add(new Konva.Text({ x: lx+30, y: ly+2,  text: 'Sovuq suv (H)',      fontSize: 9, fontFamily: 'monospace', fill: '#1a1a1a' }));
  g.add(new Konva.Line({ points: [lx, ly+22, lx+25, ly+22], stroke: '#ef4444', strokeWidth: 2, opacity: 0.8 }));
  g.add(new Konva.Text({ x: lx+30, y: ly+16, text: 'Issiq suv (I)',       fontSize: 9, fontFamily: 'monospace', fill: '#1a1a1a' }));
  g.add(new Konva.Line({ points: [lx, ly+36, lx+25, ly+36], stroke: '#64748b', strokeWidth: 1.5, dash: [4,4], opacity: 0.6 }));
  g.add(new Konva.Text({ x: lx+30, y: ly+30, text: 'Kanalizatsiya (K)',   fontSize: 9, fontFamily: 'monospace', fill: '#1a1a1a' }));
  layer.add(g);
}

// ── Component ────────────────────────────────────────────────────────────────

const Canvas2D = forwardRef<Canvas2DHandle, Canvas2DProps>(
  function Canvas2D({ drawingData, width = 800, scale = 1 }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage | null>(null);

    useImperativeHandle(ref, () => ({
      exportToPdf(filename = 'floorplan.pdf') {
        const stage = stageRef.current;
        if (!stage) return;
        const dataUrl = stage.toDataURL({ pixelRatio: 2 });
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

      // Destroy previous stage
      if (stageRef.current) {
        stageRef.current.destroy();
        stageRef.current = null;
      }

      const allX = drawingData.walls.flatMap(w => [w.start.x, w.end.x]);
      const allY = drawingData.walls.flatMap(w => [w.start.y, w.end.y]);
      const totalWidth  = allX.length > 0 ? Math.max(...allX) - Math.min(...allX) : 300;
      const totalHeight = allY.length > 0 ? Math.max(...allY) - Math.min(...allY) : 400;

      const contentWidth  = totalWidth  + CANVAS_PADDING * 2;
      const contentHeight = totalHeight + CANVAS_PADDING * 2 + 120;
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

      // 1. White room background
      layer.add(new Konva.Rect({
        x: CANVAS_PADDING, y: CANVAS_PADDING,
        width: totalWidth, height: totalHeight,
        fill: 'white',
      }));

      // 1b. Multi-room colored backgrounds
      addRoomBackgrounds(layer, drawingData);

      // 2. Grid
      addGrid(layer, width / autoScale, contentHeight);

      // 3. Pipes (before walls so wall covers pipe ends)
      (drawingData.pipes ?? []).forEach(p => addPipe(layer, p));

      // 4. Walls
      drawingData.walls.forEach(w => addWall(layer, w));

      // 5. Doors
      (drawingData.doors ?? []).forEach(d =>
        addDoor(layer, d as DoorSpec & { _roomOffsetX?: number; _roomOffsetY?: number }, drawingData.walls)
      );

      // 5b. Windows
      const windows = (drawingData as DrawingData & { windows?: WindowSpec[] }).windows ?? [];
      windows.forEach(win =>
        addWindow(
          layer,
          win as WindowSpec & { _roomOffsetX?: number; _roomOffsetY?: number },
          drawingData.walls,
          windows,
        )
      );

      // 6. Fixtures
      drawingData.fixtures.forEach(f => addFixture(layer, f));

      // 6b. Fixture labels
      drawingData.fixtures.forEach(f => addFixtureLabel(layer, f));

      // 7. Dimensions
      drawingData.dimensions.forEach(d => addDimension(layer, d));

      // 8. Title block + Legend
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
