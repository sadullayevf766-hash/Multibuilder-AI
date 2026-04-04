import DxfWriter from 'dxf-writer';
import type { DrawingData, PlacedFixture } from '../../../shared/types';

const S = 0.01; // scale: 100 units = 1 meter

export function exportToDxf(drawing: DrawingData): string {
  const d = new DxfWriter();

  // Layers (7 = black in AutoCAD)
  d.addLayer('WALLS',          7, 'CONTINUOUS');
  d.addLayer('PLUMBING_COLD',  4, 'CONTINUOUS'); // cyan
  d.addLayer('PLUMBING_HOT',   1, 'CONTINUOUS'); // red
  d.addLayer('PLUMBING_DRAIN', 8, 'DASHED');     // gray
  d.addLayer('FIXTURES',       7, 'CONTINUOUS');
  d.addLayer('DIMENSIONS',     7, 'CONTINUOUS');

  // FIX 1: Walls as double line (0.15m apart)
  d.setActiveLayer('WALLS');
  drawing.walls.forEach(wall => {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const nx = (-dy / len) * 0.15;
    const ny = (dx / len) * 0.15;

    // Outer line
    d.drawLine(
      wall.start.x * S + nx, -(wall.start.y * S + ny),
      wall.end.x   * S + nx, -(wall.end.y   * S + ny)
    );
    // Inner line
    d.drawLine(
      wall.start.x * S - nx, -(wall.start.y * S - ny),
      wall.end.x   * S - nx, -(wall.end.y   * S - ny)
    );
  });

  // Pipes
  drawing.pipes.forEach(pipe => {
    const layer = pipe.type === 'cold' ? 'PLUMBING_COLD'
                : pipe.type === 'hot'  ? 'PLUMBING_HOT'
                : 'PLUMBING_DRAIN';
    d.setActiveLayer(layer);
    for (let i = 0; i < pipe.path.length - 1; i++) {
      d.drawLine(
        pipe.path[i].x   * S, -pipe.path[i].y   * S,
        pipe.path[i+1].x * S, -pipe.path[i+1].y * S
      );
    }
  });

  // FIX 2: Fixture CAD symbols
  d.setActiveLayer('FIXTURES');
  drawing.fixtures.forEach(f => drawFixture(d, f));

  // FIX 3: Dimensions (black)
  d.setActiveLayer('DIMENSIONS');
  drawing.dimensions.forEach(dim => {
    d.drawLine(
      dim.start.x * S, -dim.start.y * S,
      dim.end.x   * S, -dim.end.y   * S
    );
    const midX = (dim.start.x + dim.end.x) / 2 * S;
    const midY = -(dim.start.y + dim.end.y) / 2 * S;
    d.drawText(midX, midY, 0.15, 0, dim.label);
  });

  return d.toDxfString();
}

function drawFixture(d: InstanceType<typeof DxfWriter>, f: PlacedFixture): void {
  const x = f.position.x;
  const y = f.position.y;

  if (f.type === 'toilet') {
    const cx = (x + 20) * S;
    const cy = -(y + 35) * S;
    d.drawCircle(cx, cy, 0.15);
    d.drawRect(x * S, -(y * S), (x + 40) * S, -((y + 16) * S));
  } else if (f.type === 'sink') {
    d.drawRect(x * S, -(y * S), (x + 60) * S, -((y + 50) * S));
    d.drawRect((x + 8) * S, -((y + 8) * S), (x + 52) * S, -((y + 42) * S));
    d.drawCircle((x + 30) * S, -((y + 25) * S), 0.03);
  } else if (f.type === 'bathtub') {
    d.drawRect(x * S, -(y * S), (x + 70) * S, -((y + 170) * S));
    d.drawRect((x + 5) * S, -((y + 5) * S), (x + 65) * S, -((y + 165) * S));
  } else if (f.type === 'shower') {
    d.drawRect(x * S, -(y * S), (x + 90) * S, -((y + 90) * S));
    d.drawCircle((x + 45) * S, -((y + 45) * S), 0.05);
  } else {
    // Generic bounding box
    d.drawRect(x * S, -(y * S), (x + 50) * S, -((y + 50) * S));
    d.drawText((x + 25) * S, -((y + 25) * S), 0.1, 0, f.type);
  }
}
