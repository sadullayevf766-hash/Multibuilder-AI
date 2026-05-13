/**
 * exportPlumbingDXF — AutoCAD DXF R12 ASCII format
 *
 * Layerlar:
 *   ROOMS      — xona devor chiziqlari (beyaz, continuous)
 *   ROOM_NAMES — xona nomlari (TEXT)
 *   COLD       — В1 sovuq suv (ko'k, 5)
 *   HOT        — Т3 issiq suv (qizil, 1)
 *   CIRC       — Т4 sirkul (sariq, 2)
 *   DRAIN      — К1 kanalizatsiya (jigarrang, 6)
 *   FIXTURES   — jihozlar (oq, 7)
 *   RISERS     — stoyaklar (yashil, 3)
 *   DIMS       — o'lcham chiziqlari (kulrang, 8)
 */

import type { PlumbingProject } from '../engine/plumbing-types';

// ── DXF renk kodlari (ACI) ──────────────────────────────────────────────────
const COLOR: Record<string, number> = {
  white:  7,
  red:    1,
  yellow: 2,
  green:  3,
  cyan:   4,
  blue:   5,
  magenta:6,
  gray:   8,
  brown:  30,
};

const LAYER_COLOR: Record<string, number> = {
  ROOMS:      COLOR.white,
  ROOM_NAMES: COLOR.gray,
  COLD:       COLOR.blue,
  HOT:        COLOR.red,
  CIRC:       COLOR.yellow,
  DRAIN:      COLOR.brown,
  FIXTURES:   COLOR.cyan,
  RISERS:     COLOR.green,
  DIMS:       COLOR.gray,
};

const PIPE_LAYER: Record<string, string> = {
  cold: 'COLD', hot: 'HOT', circ: 'CIRC', drain: 'DRAIN',
};

// DXF skayla: metr → mm (AutoCAD da mm ishlash uchun ×1000)
const SCALE = 1000;
function m(v: number) { return (v * SCALE).toFixed(4); }

// ── DXF entity builders ──────────────────────────────────────────────────────

function dxfGroup(code: number, value: string | number) {
  return `${code}\n${value}\n`;
}

function dxfLine(
  layer: string,
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  ltype = 'CONTINUOUS',
) {
  return (
    dxfGroup(0, 'LINE') +
    dxfGroup(8, layer) +
    dxfGroup(6, ltype) +
    dxfGroup(10, m(x1)) + dxfGroup(20, m(y1)) + dxfGroup(30, m(z1)) +
    dxfGroup(11, m(x2)) + dxfGroup(21, m(y2)) + dxfGroup(31, m(z2))
  );
}

function dxfRect(layer: string, x: number, y: number, w: number, h: number, z = 0) {
  return (
    dxfLine(layer, x,   y,   z, x+w, y,   z) +
    dxfLine(layer, x+w, y,   z, x+w, y+h, z) +
    dxfLine(layer, x+w, y+h, z, x,   y+h, z) +
    dxfLine(layer, x,   y+h, z, x,   y,   z)
  );
}

function dxfText(
  layer: string,
  text: string,
  x: number, y: number, z = 0,
  height = 0.25,
  justify = 'LEFT',
) {
  const justCode = justify === 'CENTER' ? '\n72\n1\n73\n2\n11\n' + m(x) + '\n21\n' + m(y) + '\n31\n' + m(z) : '';
  return (
    dxfGroup(0,  'TEXT') +
    dxfGroup(8,  layer) +
    dxfGroup(10, m(x)) + dxfGroup(20, m(y)) + dxfGroup(30, m(z)) +
    dxfGroup(40, (height * SCALE).toFixed(4)) +
    dxfGroup(1,  text) +
    (justify === 'CENTER' ? dxfGroup(72, 1) + dxfGroup(73, 2) + dxfGroup(11, m(x)) + dxfGroup(21, m(y)) + dxfGroup(31, m(z)) : '')
  );
}

function dxfCircle(layer: string, cx: number, cy: number, cz: number, r: number) {
  return (
    dxfGroup(0,  'CIRCLE') +
    dxfGroup(8,  layer) +
    dxfGroup(10, m(cx)) + dxfGroup(20, m(cy)) + dxfGroup(30, m(cz)) +
    dxfGroup(40, (r * SCALE).toFixed(4))
  );
}

function dxfPolyline(layer: string, pts: Array<[number, number, number]>, closed = false) {
  let s = dxfGroup(0, 'POLYLINE') + dxfGroup(8, layer) + dxfGroup(66, 1) + dxfGroup(70, closed ? 1 : 0);
  for (const [x, y, z] of pts) {
    s += dxfGroup(0, 'VERTEX') + dxfGroup(8, layer) +
         dxfGroup(10, m(x)) + dxfGroup(20, m(y)) + dxfGroup(30, m(z));
  }
  s += dxfGroup(0, 'SEQEND');
  return s;
}

// ── DXF Section builders ─────────────────────────────────────────────────────

function buildHeader(project: PlumbingProject): string {
  const maxX = project.buildingWidth  * SCALE + 1000;
  const maxY = project.buildingLength * SCALE + 1000;
  const maxZ = project.floorCount * project.floorHeight * SCALE + 1000;
  return [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1009',
    '9', '$INSBASE', '10', '0.0', '20', '0.0', '30', '0.0',
    '9', '$EXTMIN', '10', '0.0', '20', '0.0', '30', '0.0',
    '9', '$EXTMAX', '10', String(maxX), '20', String(maxY), '30', String(maxZ),
    '9', '$LIMMIN', '10', '0.0', '20', '0.0',
    '9', '$LIMMAX', '10', String(maxX), '20', String(maxY),
    '9', '$INSUNITS', '70', '4',  // millimeter
    '9', '$MEASUREMENT', '70', '1', // metric
    '0', 'ENDSEC',
  ].join('\n') + '\n';
}

function buildTables(): string {
  const layers = Object.entries(LAYER_COLOR).map(([name, color]) =>
    [
      '0', 'LAYER',
      '2', name,
      '70', '0',
      '62', String(color),
      '6', 'CONTINUOUS',
    ].join('\n')
  ).join('\n') + '\n';

  return [
    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', String(Object.keys(LAYER_COLOR).length),
    layers,
    '0', 'ENDTAB',
    '0', 'ENDSEC',
  ].join('\n') + '\n';
}

function buildEntities(project: PlumbingProject): string {
  let ents = '0\nSECTION\n2\nENTITIES\n';

  // ── Xonalar ──
  for (const room of project.rooms) {
    const z = (room.floor - 1) * project.floorHeight;
    // Devor chiziqlari
    ents += dxfRect('ROOMS', room.position.x, room.position.y, room.width, room.length, z);
    // Nom
    const cx = room.position.x + room.width  / 2;
    const cy = room.position.y + room.length / 2;
    ents += dxfText('ROOM_NAMES', room.name, cx, cy, z, 0.2, 'CENTER');
    // Maydon
    const area = (room.width * room.length).toFixed(1);
    ents += dxfText('ROOM_NAMES', `${area} m2`, cx, cy - 0.28, z, 0.15, 'CENTER');
  }

  // ── Quvurlar ──
  for (const pipe of project.pipes) {
    const layer = PIPE_LAYER[pipe.type] ?? 'COLD';
    const isRiser = pipe.isRiser;
    const ltype = pipe.type === 'drain' && !isRiser ? 'DASHED' : 'CONTINUOUS';

    if (isRiser) {
      // Stoyak — vertikal chiziq
      ents += dxfLine('RISERS',
        pipe.from.x, pipe.from.y, pipe.from.z,
        pipe.to.x,   pipe.to.y,   pipe.to.z,
      );
      // Stoyak belgisi — doira
      ents += dxfCircle('RISERS', pipe.from.x, pipe.from.y, pipe.from.z, pipe.diamMm / 2000);
      if (pipe.label) {
        ents += dxfText('RISERS', pipe.label, pipe.from.x + 0.08, pipe.from.y + 0.08, pipe.from.z, 0.12);
      }
    } else {
      // Gorizontal quvur — ortogoal routing (AutoCAD standart)
      const dx = Math.abs(pipe.to.x - pipe.from.x);
      const dy = Math.abs(pipe.to.y - pipe.from.y);
      if (dx > 0.001 && dy > 0.001) {
        // L-shakl routing
        ents += dxfLine(layer, pipe.from.x, pipe.from.y, pipe.from.z, pipe.to.x, pipe.from.y, pipe.from.z);
        ents += dxfLine(layer, pipe.to.x, pipe.from.y, pipe.from.z, pipe.to.x, pipe.to.y, pipe.to.z);
      } else {
        ents += dxfLine(layer, pipe.from.x, pipe.from.y, pipe.from.z, pipe.to.x, pipe.to.y, pipe.to.z);
      }
      // Diametr belgisi
      if (pipe.label || pipe.diamMm) {
        const mx = (pipe.from.x + pipe.to.x) / 2;
        const my = (pipe.from.y + pipe.to.y) / 2;
        const mz = (pipe.from.z + pipe.to.z) / 2;
        const label = pipe.label ?? `ø${pipe.diamMm}`;
        ents += dxfText(layer, label, mx + 0.05, my + 0.05, mz, 0.10);
      }
    }
  }

  // ── Jihozlar ──
  for (const fix of project.fixtures) {
    const z = fix.position.z;
    const x = fix.position.x, y = fix.position.y;
    const w = fix.dimensions.w, d = fix.dimensions.d;

    // Bounding box
    ents += dxfRect('FIXTURES', x - w/2, y - d/2, w, d, z);

    // Jihoz turi bo'yicha sodda belgi
    if (fix.type === 'toilet') {
      ents += dxfCircle('FIXTURES', x, y + d * 0.1, z, Math.min(w, d) * 0.28);
    } else if (fix.type === 'sink' || fix.type === 'kitchen_sink' || fix.type === 'bidet') {
      ents += dxfCircle('FIXTURES', x, y, z, Math.min(w, d) * 0.25);
    } else if (fix.type === 'bathtub') {
      ents += dxfCircle('FIXTURES', x, y + d * 0.1, z, Math.min(w, d) * 0.3);
    } else if (fix.type === 'shower') {
      // Diagonal chiziq
      ents += dxfLine('FIXTURES', x - w/2, y - d/2, z, x + w/2, y + d/2, z);
    }

    // Nom
    ents += dxfText('FIXTURES', fix.nameUz, x, y - d/2 - 0.18, z, 0.12);
  }

  // ── O'lcham chiziqlari (top view, 1-qavat) ──
  const floor1rooms = project.rooms.filter(r => r.floor === 1);
  const dimGap = 0.5; // metr
  for (const room of floor1rooms) {
    const { x, y } = room.position;
    const w = room.width, h = room.length;
    const z = 0;

    // Kenglik o'lchami (tepada)
    const ty = y - dimGap;
    ents += dxfLine('DIMS', x, y, z, x, ty - 0.1, z);
    ents += dxfLine('DIMS', x+w, y, z, x+w, ty - 0.1, z);
    ents += dxfLine('DIMS', x, ty, z, x+w, ty, z);
    // Tick lar
    ents += dxfLine('DIMS', x   - 0.05, ty, z, x   + 0.05, ty, z);
    ents += dxfLine('DIMS', x+w - 0.05, ty, z, x+w + 0.05, ty, z);
    ents += dxfText('DIMS', `${w.toFixed(2)}`, x + w/2, ty + 0.06, z, 0.14, 'CENTER');

    // Uzunlik o'lchami (chapda)
    const lx = x - dimGap;
    ents += dxfLine('DIMS', x, y, z, lx - 0.1, y, z);
    ents += dxfLine('DIMS', x, y+h, z, lx - 0.1, y+h, z);
    ents += dxfLine('DIMS', lx, y, z, lx, y+h, z);
    ents += dxfLine('DIMS', lx, y   - 0.05, z, lx, y   + 0.05, z);
    ents += dxfLine('DIMS', lx, y+h - 0.05, z, lx, y+h + 0.05, z);
    ents += dxfText('DIMS', `${h.toFixed(2)}`, lx - 0.18, y + h/2, z, 0.14, 'CENTER');
  }

  ents += '0\nENDSEC\n';
  return ents;
}

// ── Main export function ─────────────────────────────────────────────────────

export function exportPlumbingDXF(project: PlumbingProject): void {
  const dxf = [
    buildHeader(project),
    buildTables(),
    buildEntities(project),
    '0\nEOF\n',
  ].join('');

  const blob = new Blob([dxf], { type: 'application/dxf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${project.name.replace(/[^\w\s-]/g, '').trim() || 'santexnika'}_${new Date().toISOString().slice(0,10)}.dxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
