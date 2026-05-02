import type {
  RoomSpec, FloorPlan, WallSide,
  ArchOpening, ElevationData, SectionData, SectionRoom, ArchDrawingData,
} from '../../../shared/types';

// ── Standard dimensions (meters) ──────────────────────────────────────────────
const FLOOR_H    = 2.7;
const DOOR_H     = 2.1;
const WIN_H      = 1.2;
const WIN_SILL   = 0.9;

let _uid = 0;
const uid = (p: string) => `${p}-${++_uid}`;

// ── Opening builders ──────────────────────────────────────────────────────────

function doorOpening(xOffset: number, width = 0.9): ArchOpening {
  return { id: uid('door'), type: 'door', xOffset, width, height: DOOR_H, sillHeight: 0 };
}

function windowOpening(xOffset: number, width = 1.2): ArchOpening {
  return { id: uid('win'), type: 'window', xOffset, width, height: WIN_H, sillHeight: WIN_SILL };
}

// ── Centre a single opening on a wall ─────────────────────────────────────────
function centered(wallWidth: number, openingWidth: number): number {
  return (wallWidth - openingWidth) / 2;
}

// ── Build elevations for a single room ────────────────────────────────────────

function buildElevations(spec: RoomSpec): ElevationData[] {
  const { width: W, length: L, doors, windows } = spec;
  const sides: WallSide[] = ['south', 'north', 'west', 'east'];

  return sides.map((side, idx) => {
    const wallWidth = (side === 'south' || side === 'north') ? W : L;
    const openings: ArchOpening[] = [];

    // Doors on this side
    doors.filter(d => d.wall === side).forEach(d => {
      const dw = d.width ?? 0.9;
      openings.push(doorOpening(centered(wallWidth, dw), dw));
    });

    // Windows on this side — place one window if none explicitly, spread evenly
    const wallWins = windows.filter(w => w.wall === side);
    if (wallWins.length > 0) {
      wallWins.forEach((w, wi) => {
        const ww = w.width ?? 1.2;
        // Multiple windows evenly spaced
        const spacing = wallWidth / (wallWins.length + 1);
        openings.push(windowOpening(spacing * (wi + 1) - ww / 2, ww));
      });
    } else if (!doors.some(d => d.wall === side)) {
      // Default: one window centred if no door on this wall (except very small walls)
      if (wallWidth >= 1.5) {
        openings.push(windowOpening(centered(wallWidth, 1.2)));
      }
    }

    const labels = ['1-fasad', '2-fasad', '3-fasad', '4-fasad'];
    return {
      id: uid('elev'),
      side,
      label: labels[idx],
      wallWidth,
      floorHeight: FLOOR_H,
      openings,
    };
  });
}

// ── Build section for a single room ───────────────────────────────────────────

function buildSection(spec: RoomSpec): SectionData {
  const room: SectionRoom = { id: uid('sr'), name: spec.name, xOffset: 0, width: spec.width };

  // Openings visible in this section cut (west/east walls for a W-cut)
  const openings: ArchOpening[] = [];
  spec.doors.filter(d => d.wall === 'west' || d.wall === 'east').forEach(d => {
    openings.push(doorOpening(centered(spec.length, d.width ?? 0.9), d.width ?? 0.9));
  });
  spec.windows.filter(w => w.wall === 'west' || w.wall === 'east').forEach(w => {
    openings.push(windowOpening(centered(spec.length, w.width ?? 1.2), w.width ?? 1.2));
  });
  // Default: show a window in section if no openings on this plane
  if (openings.length === 0 && spec.length >= 1.5) {
    openings.push(windowOpening(centered(spec.length, 1.2)));
  }

  return {
    id: uid('sec'),
    label: '1-1 kesim',
    totalWidth: spec.width,
    floorHeight: FLOOR_H,
    rooms: [room],
    openings,
  };
}

// ── Multi-room ────────────────────────────────────────────────────────────────

function buildFloorPlanElevations(fp: FloorPlan): ElevationData[] {
  const { width: bW, length: bL } = fp.buildingDimensions;

  // Collect openings on each building perimeter wall
  const sides: WallSide[] = ['south', 'north', 'west', 'east'];
  const labels = ['1-fasad', '2-fasad', '3-fasad', '4-fasad'];

  return sides.map((side, idx) => {
    const wallWidth = (side === 'south' || side === 'north') ? bW : bL;
    const openings: ArchOpening[] = [];

    for (const layout of fp.rooms) {
      const { roomSpec: rs, position: pos } = layout;
      const rDoors  = rs.doors.filter(d => d.wall === side);
      const rWins   = rs.windows.filter(w => w.wall === side);

      // Local offset of this room's wall segment on the perimeter
      const roomLocalOffset = (side === 'south' || side === 'north') ? pos.x : pos.y;
      const roomDim = (side === 'south' || side === 'north') ? rs.width : rs.length;

      rDoors.forEach(d => {
        const dw = d.width ?? 0.9;
        openings.push(doorOpening(roomLocalOffset + centered(roomDim, dw), dw));
      });
      rWins.forEach(w => {
        const ww = w.width ?? 1.2;
        openings.push(windowOpening(roomLocalOffset + centered(roomDim, ww), ww));
      });

      // Default window if no opening defined for this side
      if (rDoors.length === 0 && rWins.length === 0 && roomDim >= 1.5) {
        openings.push(windowOpening(roomLocalOffset + centered(roomDim, 1.2)));
      }
    }

    return { id: uid('elev'), side, label: labels[idx], wallWidth, floorHeight: FLOOR_H, openings };
  });
}

function buildFloorPlanSection(fp: FloorPlan): SectionData {
  const { width: bW } = fp.buildingDimensions;

  // Rooms sorted by x position
  const sorted = [...fp.rooms].sort((a, b) => a.position.x - b.position.x);
  const rooms: SectionRoom[] = sorted.map(l => ({
    id: uid('sr'), name: l.roomSpec.name,
    xOffset: l.position.x, width: l.roomSpec.width,
  }));

  return {
    id: uid('sec'), label: '1-1 kesim',
    totalWidth: bW, floorHeight: FLOOR_H,
    rooms,
    openings: [],
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export class ArchitectureEngine {
  generateFromRoom(spec: RoomSpec): ArchDrawingData {
    _uid = 0;
    return {
      id: `arch-${spec.id}`,
      drawingType: 'architecture',
      elevations: buildElevations(spec),
      section: buildSection(spec),
      roomName: spec.name,
    };
  }

  generateFromFloorPlan(fp: FloorPlan): ArchDrawingData {
    _uid = 0;
    return {
      id: `arch-${fp.id}`,
      drawingType: 'architecture',
      elevations: buildFloorPlanElevations(fp),
      section: buildFloorPlanSection(fp),
    };
  }
}
