import DxfWriter from 'dxf-writer';
import type { DrawingData, PlacedFixture, Wall } from '../../../shared/types';

// 1 unit = 1cm in drawing space (100 units = 1 meter)
// DXF uses meters → multiply by 0.01
const S = 0.01;

// Fixture dimensions — MUST match Canvas2D exactly
const FIXTURE_DIMS: Record<string, [number, number]> = {
  sink:          [60,  50],
  toilet:        [40,  70],
  bathtub:       [80, 180],
  shower:        [90,  90],
  stove:         [60,  60],
  fridge:        [60,  65],
  dishwasher:    [60,  60],
  desk:          [120, 60],
  bed:           [160, 200],
  wardrobe:      [120, 60],
  sofa:          [200, 90],
  tv_unit:       [150, 45],
  bookshelf:     [80,  30],
  armchair:      [80,  80],
  coffee_table:  [90,  50],
  dining_table:  [120, 80],
  chair:         [50,  50],
  coat_rack:     [60,  30],
};

export function exportToDxf(drawing: DrawingData): string {
  const d = new DxfWriter();

  // AutoCAD color codes: 7=black, 4=cyan, 1=red, 8=gray, 2=yellow, 3=green
  d.addLayer('WALLS',          7, 'CONTINUOUS');
  d.addLayer('DOORS',          3, 'CONTINUOUS');
  d.addLayer('WINDOWS',        4, 'CONTINUOUS');
  d.addLayer('PLUMBING_COLD',  4, 'CONTINUOUS');
  d.addLayer('PLUMBING_HOT',   1, 'CONTINUOUS');
  d.addLayer('PLUMBING_DRAIN', 8, 'DASHED');
  d.addLayer('FIXTURES',       2, 'CONTINUOUS');
  d.addLayer('DIMENSIONS',     7, 'CONTINUOUS');
  d.addLayer('TEXT',           7, 'CONTINUOUS');

  drawWalls(d, drawing.walls);
  drawPipes(d, drawing);
  drawFixtures(d, drawing.fixtures);
  drawDoors(d, drawing);
  drawWindows(d, drawing);
  drawDimensions(d, drawing);

  return d.toDxfString();
}

// ─── WALLS ───────────────────────────────────────────────────────────────────
function drawWalls(d: InstanceType<typeof DxfWriter>, walls: Wall[]) {
  d.setActiveLayer('WALLS');

  walls.forEach(wall => {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    // Normal vector (perpendicular), scaled to half wall thickness
    const half = wall.thickness / 2;
    const nx = (-dy / len) * half * S;
    const ny = (dx / len) * half * S;

    const x1 = wall.start.x * S;
    const y1 = -(wall.start.y * S);
    const x2 = wall.end.x * S;
    const y2 = -(wall.end.y * S);

    // Outer line
    d.drawLine(x1 + nx, y1 - ny, x2 + nx, y2 - ny);
    // Inner line
    d.drawLine(x1 - nx, y1 + ny, x2 - nx, y2 + ny);
    // End caps
    d.drawLine(x1 + nx, y1 - ny, x1 - nx, y1 + ny);
    d.drawLine(x2 + nx, y2 - ny, x2 - nx, y2 + ny);
  });
}

// ─── PIPES ───────────────────────────────────────────────────────────────────
function drawPipes(d: InstanceType<typeof DxfWriter>, drawing: DrawingData) {
  (drawing.pipes ?? []).forEach(pipe => {
    const layer = pipe.type === 'cold' ? 'PLUMBING_COLD'
                : pipe.type === 'hot'  ? 'PLUMBING_HOT'
                : 'PLUMBING_DRAIN';
    d.setActiveLayer(layer);
    for (let i = 0; i < pipe.path.length - 1; i++) {
      d.drawLine(
        pipe.path[i].x   * S, -(pipe.path[i].y   * S),
        pipe.path[i+1].x * S, -(pipe.path[i+1].y * S)
      );
    }
  });
}

// ─── FIXTURES ────────────────────────────────────────────────────────────────
function drawFixtures(d: InstanceType<typeof DxfWriter>, fixtures: PlacedFixture[]) {
  d.setActiveLayer('FIXTURES');

  fixtures.forEach(f => {
    const x = f.position.x * S;
    const y = -(f.position.y * S);
    const [fw, fh] = (FIXTURE_DIMS[f.type] ?? [50, 50]).map(v => v * S);

    switch (f.type) {
      case 'toilet':
        // Tank (top rectangle) + bowl (circle)
        d.drawRect(x, y - fh * 0.25, x + fw, y);
        d.drawCircle(x + fw / 2, y - fh * 0.65, fw * 0.4);
        break;

      case 'sink':
        d.drawRect(x, y - fh, x + fw, y);
        d.drawRect(x + fw * 0.1, y - fh * 0.9, x + fw * 0.9, y - fh * 0.1);
        d.drawCircle(x + fw / 2, y - fh / 2, fw * 0.08);
        break;

      case 'bathtub':
        d.drawRect(x, y - fh, x + fw, y);
        d.drawRect(x + fw * 0.05, y - fh * 0.97, x + fw * 0.95, y - fh * 0.03);
        break;

      case 'shower':
        d.drawRect(x, y - fh, x + fw, y);
        d.drawCircle(x + fw / 2, y - fh / 2, fw * 0.3);
        // Shower head cross
        d.drawLine(x + fw * 0.4, y - fh / 2, x + fw * 0.6, y - fh / 2);
        d.drawLine(x + fw / 2, y - fh * 0.4, x + fw / 2, y - fh * 0.6);
        break;

      case 'stove':
        d.drawRect(x, y - fh, x + fw, y);
        // 4 burners
        [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].forEach(([cx, cy]) => {
          d.drawCircle(x + fw * cx, y - fh * cy, fw * 0.15);
        });
        break;

      case 'fridge':
        d.drawRect(x, y - fh, x + fw, y);
        d.drawLine(x, y - fh * 0.3, x + fw, y - fh * 0.3);
        break;

      case 'dishwasher':
        d.drawRect(x, y - fh, x + fw, y);
        d.drawLine(x + fw * 0.1, y - fh * 0.25, x + fw * 0.9, y - fh * 0.25);
        d.drawLine(x + fw * 0.1, y - fh * 0.5,  x + fw * 0.9, y - fh * 0.5);
        d.drawLine(x + fw * 0.1, y - fh * 0.75, x + fw * 0.9, y - fh * 0.75);
        break;

      case 'desk':
        d.drawRect(x, y - fh, x + fw, y);
        d.drawRect(x + fw * 0.33, y - fh * 0.08, x + fw * 0.67, y);
        break;

      case 'bed':
        d.drawRect(x, y - fh, x + fw, y);
        // Pillow area
        d.drawRect(x + fw * 0.05, y - fh * 0.22, x + fw * 0.95, y - fh * 0.02);
        // Divider line
        d.drawLine(x, y - fh * 0.25, x + fw, y - fh * 0.25);
        break;

      case 'wardrobe':
        d.drawRect(x, y - fh, x + fw, y);
        d.drawLine(x + fw / 2, y - fh, x + fw / 2, y);
        // Door handles
        d.drawLine(x + fw * 0.4, y - fh / 2, x + fw * 0.45, y - fh / 2);
        d.drawLine(x + fw * 0.55, y - fh / 2, x + fw * 0.6, y - fh / 2);
        break;

      case 'sofa': {
        // Back rest
        d.drawRect(x, y - fh * 0.22, x + fw, y);
        // 3 cushions
        for (let i = 0; i < 3; i++) {
          d.drawRect(x + i * (fw / 3), y - fh, x + (i + 1) * (fw / 3) - fw * 0.005, y - fh * 0.22);
        }
        // Armrests
        d.drawRect(x, y - fh, x + fw * 0.04, y - fh * 0.22);
        d.drawRect(x + fw * 0.96, y - fh, x + fw, y - fh * 0.22);
        break;
      }

      case 'tv_unit':
        d.drawRect(x, y - fh, x + fw, y);
        // TV screen above
        d.drawRect(x + fw * 0.23, y - fh * 0.18, x + fw * 0.77, y - fh * 0.02);
        break;

      case 'bookshelf':
        d.drawRect(x, y - fh, x + fw, y);
        // Shelf dividers
        d.drawLine(x + fw * 0.25, y - fh, x + fw * 0.25, y);
        d.drawLine(x + fw * 0.5,  y - fh, x + fw * 0.5,  y);
        d.drawLine(x + fw * 0.75, y - fh, x + fw * 0.75, y);
        break;

      case 'armchair':
        d.drawRect(x, y - fh, x + fw, y);
        d.drawRect(x, y - fh * 0.22, x + fw, y);
        d.drawRect(x, y - fh, x + fw * 0.12, y - fh * 0.22);
        d.drawRect(x + fw * 0.88, y - fh, x + fw, y - fh * 0.22);
        break;

      case 'coffee_table':
        d.drawRect(x, y - fh, x + fw, y);
        d.drawRect(x + fw * 0.05, y - fh * 0.9, x + fw * 0.95, y - fh * 0.1);
        break;

      case 'dining_table':
        d.drawRect(x, y - fh, x + fw, y);
        // Chairs
        d.drawRect(x + fw * 0.15, y + fh * 0.15, x + fw * 0.4,  y + fh * 0.3);
        d.drawRect(x + fw * 0.6,  y + fh * 0.15, x + fw * 0.85, y + fh * 0.3);
        d.drawRect(x + fw * 0.15, y - fh * 1.3,  x + fw * 0.4,  y - fh * 1.15);
        d.drawRect(x + fw * 0.6,  y - fh * 1.3,  x + fw * 0.85, y - fh * 1.15);
        break;

      case 'chair':
        d.drawRect(x, y - fh, x + fw, y);
        d.drawRect(x, y - fh * 0.24, x + fw, y);
        break;

      case 'coat_rack':
        d.drawRect(x, y - fh, x + fw, y);
        [0.15, 0.38, 0.62, 0.85].forEach(cx => {
          d.drawLine(x + fw * cx, y - fh, x + fw * cx, y - fh * 0.5);
        });
        break;

      default: {
        d.drawRect(x, y - fh, x + fw, y);
        d.setActiveLayer('TEXT');
        d.drawText(x + fw / 2, y - fh / 2, 0.08, 0, f.type.replace(/_/g, ' ').slice(0, 10));
        d.setActiveLayer('FIXTURES');
        break;
      }
    }

    // Fixture label
    d.setActiveLayer('TEXT');
    const label = f.type.replace(/_/g, ' ');
    d.drawText(x + fw / 2, y - fh / 2, 0.07, 0, label);
    d.setActiveLayer('FIXTURES');
  });
}

// ─── DOORS ───────────────────────────────────────────────────────────────────
function drawDoors(d: InstanceType<typeof DxfWriter>, drawing: DrawingData) {
  d.setActiveLayer('DOORS');

  (drawing.doors ?? []).forEach(door => {
    const wall = drawing.walls.find(w => w.side === door.wall);
    if (!wall) return;

    const doorW = (door.width ?? 0.9) * 100; // units
    const WALL_T = wall.thickness;

    const midX = (wall.start.x + wall.end.x) / 2;
    const midY = (wall.start.y + wall.end.y) / 2;
    const half = doorW / 2;

    // Door opening (white gap) — draw as two short lines marking the gap edges
    // Door leaf line + swing arc
    if (door.wall === 'north' || door.wall === 'south') {
      const wallY = door.wall === 'north' ? wall.start.y : wall.end.y;
      const x1 = (midX - half) * S;
      const x2 = (midX + half) * S;
      const wy = -(wallY * S);

      // Door leaf
      d.drawLine(x1, wy, x1, wy - doorW * S);
      // Swing arc (approximated as 3 lines)
      drawArcApprox(d, x1, wy, doorW * S, 270, 360);
    } else {
      const wallX = door.wall === 'east' ? wall.start.x : wall.start.x;
      const y1 = (midY - half) * S;
      const y2 = (midY + half) * S;
      const wx = wallX * S;

      d.drawLine(wx, -y1, wx + doorW * S, -y1);
      drawArcApprox(d, wx, -y1, doorW * S, 180, 270);
    }
  });
}

// ─── WINDOWS ─────────────────────────────────────────────────────────────────
function drawWindows(d: InstanceType<typeof DxfWriter>, drawing: DrawingData) {
  d.setActiveLayer('WINDOWS');

  const windows = (drawing as unknown as { windows?: Array<{ id: string; wall: string; width?: number }> }).windows ?? [];

  windows.forEach(win => {
    const wall = drawing.walls.find(w => w.side === win.wall);
    if (!wall) return;

    const winW = (win.width ?? 1.2) * 100;
    const WALL_T = wall.thickness;

    const midX = (wall.start.x + wall.end.x) / 2;
    const midY = (wall.start.y + wall.end.y) / 2;
    const half = winW / 2;

    if (win.wall === 'north' || win.wall === 'south') {
      const wallY = win.wall === 'north' ? wall.start.y : wall.end.y;
      const x1 = (midX - half) * S;
      const x2 = (midX + half) * S;
      const wy = -(wallY * S);
      const wt = WALL_T * S;

      // 3 parallel lines (window symbol)
      d.drawLine(x1, wy,          x2, wy);
      d.drawLine(x1, wy - wt / 2, x2, wy - wt / 2);
      d.drawLine(x1, wy - wt,     x2, wy - wt);
    } else {
      const wallX = wall.start.x;
      const y1 = (midY - half) * S;
      const y2 = (midY + half) * S;
      const wx = wallX * S;
      const wt = WALL_T * S;

      d.drawLine(wx,          -y1, wx,          -y2);
      d.drawLine(wx + wt / 2, -y1, wx + wt / 2, -y2);
      d.drawLine(wx + wt,     -y1, wx + wt,     -y2);
    }
  });
}

// ─── DIMENSIONS ──────────────────────────────────────────────────────────────
function drawDimensions(d: InstanceType<typeof DxfWriter>, drawing: DrawingData) {
  d.setActiveLayer('DIMENSIONS');

  drawing.dimensions.forEach(dim => {
    if (dim.value === 0) return; // room labels, skip

    const offset = 0.3; // 30cm outside wall
    const dx = dim.end.x - dim.start.x;
    const dy = dim.end.y - dim.start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    const nx = (-dy / len) * offset;
    const ny = (dx / len) * offset;

    const x1 = dim.start.x * S + nx;
    const y1 = -(dim.start.y * S) + ny;
    const x2 = dim.end.x * S + nx;
    const y2 = -(dim.end.y * S) + ny;

    // Dimension line
    d.drawLine(x1, y1, x2, y2);
    // Extension lines
    d.drawLine(dim.start.x * S, -(dim.start.y * S), x1, y1);
    d.drawLine(dim.end.x * S,   -(dim.end.y * S),   x2, y2);

    // Label
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    d.setActiveLayer('TEXT');
    d.drawText(mx, my + 0.05, 0.12, 0, dim.label);
    d.setActiveLayer('DIMENSIONS');
  });
}

// ─── ARC APPROXIMATION (dxf-writer has drawArc but needs testing) ─────────────
function drawArcApprox(
  d: InstanceType<typeof DxfWriter>,
  cx: number, cy: number,
  radius: number,
  startDeg: number, endDeg: number,
  segments = 8
) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (startDeg + (endDeg - startDeg) * (i / segments)) * Math.PI / 180;
    pts.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    d.drawLine(pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]);
  }
}
