import type {
  RoomSpec,
  DrawingData,
  Wall,
  Point,
  PlacedFixture,
  Pipe,
  DimensionLine,
  WallSide,
  PipeType,
  FloorPlan,
  Building,
  BuildingFloor,
  RoomLayout,
  InterRoomDoor,
  StaircaseSpec,
} from '../../../shared/types';
import { FIXTURE_DIMS, UNITS_PER_METER, WALL_THICKNESS, FIXTURE_GAP } from '../../../shared/constants';
import { buildWallGraph, detectSharedWalls, placeInterRoomDoors } from './WallGraph';
import { layoutRooms, normalizeFootprints } from './RoomLayoutEngine';

const DEFAULT_DOOR_WIDTH = 0.9; // meters

// ── Uzbek room name map ────────────────────────────────────────────────────────
const ROOM_NAMES_UZ: Record<string, string> = {
  bathroom: 'Hammom',    hammom: 'Hammom',
  kitchen:  'Oshxona',   oshxona: 'Oshxona',
  bedroom:  'Yotoqxona', yotoqxona: 'Yotoqxona',
  living:   'Mehmonxona',mehmonxona: 'Mehmonxona',
  zal:      'Zal',
  office:   'Ofis',      ofis: 'Ofis',
  hallway:  'Koridor',   koridor: 'Koridor',
  children: 'Bolalar xonasi',
  toilet:   'Hojatxona', hojatxona: 'Hojatxona',
  dining:   'Ovqat xonasi',
  room:     'Xona',
};

function displayName(name: string): string {
  const n = name.toLowerCase();
  for (const [key, uz] of Object.entries(ROOM_NAMES_UZ)) {
    if (n === key || n.includes(key)) return uz;
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═════════════════════════════════════════════════════════════════════════════

export class FloorPlanEngine {

  // ── Single room ─────────────────────────────────────────────────────────────

  generateDrawing(roomSpec: RoomSpec): DrawingData {
    console.log('[ENGINE] single room:', roomSpec.name, roomSpec.width, 'x', roomSpec.length);
    const walls      = this.generateWalls(roomSpec);
    const fixtures   = this.placeFixtures(roomSpec, walls);
    const pipes      = this.generatePipes(fixtures, walls, roomSpec);
    const dimensions = this.generateDimensions(walls, roomSpec);
    return {
      id: `drawing-${roomSpec.id}`,
      walls, fixtures, pipes, dimensions,
      doors:    roomSpec.doors,
      windows:  roomSpec.windows,
      roomName: roomSpec.name,
    };
  }

  // ── Legacy multi-room (single floor, no inter-room doors) ──────────────────

  generateFloorPlan(floorPlan: FloorPlan): DrawingData {
    // Run layout engine to assign positions
    const layoutResult = layoutRooms(floorPlan.rooms, 1);
    floorPlan.rooms = layoutResult.rooms;
    floorPlan.buildingDimensions = layoutResult.footprint;

    return this._generateFloorDrawing(
      floorPlan.rooms,
      layoutResult.footprint,
      layoutResult.staircaseSpec,
      { floorNumber: 1, label: '1-qavat', elevation: 0 },
    );
  }

  // ── Multi-floor Building ────────────────────────────────────────────────────

  generateBuilding(building: Building): DrawingData[] {
    console.log(`[ENGINE] Building: ${building.floors.length} qavat`);

    // 1. Layout each floor independently
    const layoutResults = building.floors.map(floor =>
      layoutRooms(floor.rooms, floor.floorNumber),
    );

    // 2. Normalize footprints — all floors same size
    const footprint = normalizeFootprints(layoutResults);
    building.footprint = footprint;

    // 3. Apply layout results back to floors
    building.floors.forEach((floor, i) => {
      floor.rooms = layoutResults[i].rooms;
      if (!building.staircaseSpec) building.staircaseSpec = layoutResults[i].staircaseSpec;
    });

    // 4. Generate DrawingData per floor
    const drawings: DrawingData[] = building.floors.map((floor, i) => {
      const dd = this._generateFloorDrawing(
        floor.rooms,
        footprint,
        building.staircaseSpec,
        { floorNumber: floor.floorNumber, label: floor.label, elevation: floor.elevation },
      );
      floor.drawingData = dd;
      return dd;
    });

    return drawings;
  }

  // ── Core floor drawing ──────────────────────────────────────────────────────

  private _generateFloorDrawing(
    rooms: RoomLayout[],
    footprint: { width: number; length: number },
    staircaseSpec: StaircaseSpec | undefined,
    floorMeta: { floorNumber: number; label: string; elevation: number },
  ): DrawingData {
    const allWallsRaw:    Array<Wall & { roomId: string }> = [];
    const allFixtures:    PlacedFixture[]  = [];
    const allPipes:       Pipe[]           = [];
    const allExteriorDoors: any[]          = [];
    const allWindows:     any[]            = [];
    const roomLabels:     DimensionLine[]  = [];

    // 1. Generate each room's geometry
    for (const room of rooms) {
      const ox = room.position.x * UNITS_PER_METER;
      const oy = room.position.y * UNITS_PER_METER;

      const roomWalls    = this.generateWalls(room.roomSpec);
      const roomFixtures = this.placeFixtures(room.roomSpec, roomWalls);
      const roomPipes    = this.generatePipes(roomFixtures, roomWalls, room.roomSpec);

      // Offset and tag with roomId
      roomWalls.forEach(w => {
        allWallsRaw.push({
          ...w,
          id:     `${room.id}-${w.id}`,
          start:  { x: w.start.x + ox, y: w.start.y + oy },
          end:    { x: w.end.x   + ox, y: w.end.y   + oy },
          roomId: room.id,
        });
      });

      roomFixtures.forEach(f => allFixtures.push({
        ...f,
        id:       `${room.id}-${f.id}`,
        position: { x: f.position.x + ox, y: f.position.y + oy },
      }));

      roomPipes.forEach(p => allPipes.push({
        ...p,
        id:   `${room.id}-${p.id}`,
        path: p.path.map(pt => ({ x: pt.x + ox, y: pt.y + oy })),
      }));

      // Exterior doors/windows (with room offset for lookup)
      room.roomSpec.doors.forEach(d => allExteriorDoors.push({
        ...d,
        id:          `${room.id}-${d.id}`,
        wallId:      `${room.id}-wall-${d.wall}-${room.roomSpec.id}`,
        _roomOffsetX: ox,
        _roomOffsetY: oy,
      }));
      (room.roomSpec.windows || []).forEach(w => allWindows.push({
        ...w,
        id:          `${room.id}-${w.id}`,
        wallId:      `${room.id}-wall-${w.wall}-${room.roomSpec.id}`,
        _roomOffsetX: ox,
        _roomOffsetY: oy,
      }));

      // Room label (center of room)
      const cx = ox + (room.roomSpec.width  * UNITS_PER_METER) / 2;
      const cy = oy + (room.roomSpec.length * UNITS_PER_METER) / 2;
      const area = (room.roomSpec.width * room.roomSpec.length).toFixed(1);
      roomLabels.push({
        id:    `label-${room.id}`,
        start: { x: cx, y: cy - 10 },
        end:   { x: cx, y: cy + 10 },
        value: 0,
        label: `${displayName(room.roomSpec.name)} ${area}m²`,
      });
    }

    // 2. Build wall graph — merge shared/overlapping walls
    const { walls: mergedWalls, faces } = buildWallGraph(allWallsRaw);

    // 3. Inter-room doors — detect shared boundaries
    const sharedConnections = detectSharedWalls(
      rooms.map(r => ({ ...r, roomId: r.id })),
    );
    const interRoomDoors = placeInterRoomDoors(sharedConnections, faces);

    // 4. Overall building dimension lines
    const bWu = footprint.width  * UNITS_PER_METER;
    const bLu = footprint.length * UNITS_PER_METER;
    const overallDims: DimensionLine[] = [
      { id: 'dim-top',    start: { x: 0,   y: -60  }, end: { x: bWu, y: -60  }, value: footprint.width,  label: `${footprint.width.toFixed(2)}m`  },
      { id: 'dim-bottom', start: { x: 0,   y: bLu+60 }, end: { x: bWu, y: bLu+60 }, value: footprint.width,  label: `${footprint.width.toFixed(2)}m`  },
      { id: 'dim-left',   start: { x: -60, y: 0    }, end: { x: -60, y: bLu  }, value: footprint.length, label: `${footprint.length.toFixed(2)}m` },
      { id: 'dim-right',  start: { x: bWu+60, y: 0 }, end: { x: bWu+60, y: bLu  }, value: footprint.length, label: `${footprint.length.toFixed(2)}m` },
    ];

    return {
      id:             `floor-${floorMeta.floorNumber}-${Date.now()}`,
      walls:          mergedWalls,
      fixtures:       allFixtures,
      pipes:          allPipes,
      dimensions:     [...overallDims, ...roomLabels],
      doors:          allExteriorDoors,
      windows:        allWindows,
      interRoomDoors,
      staircaseSpec,
      floorNumber:    floorMeta.floorNumber,
      floorLabel:     floorMeta.label,
      elevation:      floorMeta.elevation,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROOM GEOMETRY (unchanged from single-room system)
  // ═══════════════════════════════════════════════════════════════════════════

  generateWalls(roomSpec: RoomSpec): Wall[] {
    const W = roomSpec.width  * UNITS_PER_METER;
    const L = roomSpec.length * UNITS_PER_METER;
    return [
      { id: `wall-north-${roomSpec.id}`, start: { x: 0, y: 0 }, end: { x: W, y: 0 }, thickness: WALL_THICKNESS, side: 'north' },
      { id: `wall-east-${roomSpec.id}`,  start: { x: W, y: 0 }, end: { x: W, y: L }, thickness: WALL_THICKNESS, side: 'east'  },
      { id: `wall-south-${roomSpec.id}`, start: { x: W, y: L }, end: { x: 0, y: L }, thickness: WALL_THICKNESS, side: 'south' },
      { id: `wall-west-${roomSpec.id}`,  start: { x: 0, y: L }, end: { x: 0, y: 0 }, thickness: WALL_THICKNESS, side: 'west'  },
    ];
  }

  placeFixtures(roomSpec: RoomSpec, walls: Wall[]): PlacedFixture[] {
    const placed: PlacedFixture[] = [];
    const W = roomSpec.width;
    const L = roomSpec.length;

    const wallCursors: Record<string, number> = {
      north: WALL_THICKNESS + FIXTURE_GAP + 3,
      south: WALL_THICKNESS + FIXTURE_GAP + 3,
      east:  WALL_THICKNESS + FIXTURE_GAP + 3,
      west:  WALL_THICKNESS + FIXTURE_GAP + 3,
    };

    for (const fixture of roomSpec.fixtures) {
      // Assign default wall if missing
      if (!fixture.wall) {
        if      (fixture.type === 'toilet')       fixture.wall = 'south';
        else if (fixture.type === 'sink')         fixture.wall = 'north';
        else if (fixture.type === 'coffee_table') {
          placed.push(this._placeCoffeeTable(W, L));
          continue;
        } else if (fixture.type === 'dining_table') {
          placed.push(this._placeDiningTable(W, L, fixture.id));
          continue;
        } else continue;
      }

      // Overrides
      if (fixture.type === 'toilet')
        fixture.wall = 'south';
      if (fixture.type === 'bathtub' && (fixture.wall === 'north' || fixture.wall === 'south')) {
        fixture.wall = W >= L ? 'north' : 'east';
      }

      const wall = walls.find(w => w.side === fixture.wall);
      if (!wall) continue;

      const dims = FIXTURE_DIMS[fixture.type] || { w: 50, h: 50 };
      let position: Point;

      if (fixture.offsetFromCorner !== undefined) {
        position = this._placeAtOffset(wall, fixture.offsetFromCorner, dims);
      } else if (fixture.type === 'sink' && fixture.wall === 'north') {
        position = this._placeAtOffset(wall, 0.3, dims);
      } else if (fixture.type === 'shower') {
        const wLen = Math.abs(wall.end.y - wall.start.y || wall.end.x - wall.start.x) / UNITS_PER_METER;
        position = this._placeAtOffset(wall, Math.max(0.3, wLen * 0.25), dims);
      } else if (fixture.type === 'toilet' && fixture.wall === 'south') {
        position = this._placeAtOffset(wall, 0.3, dims);
      } else {
        position = this._placeSequential(wall, wallCursors, dims);
      }

      // Boundary clamp
      const T = WALL_THICKNESS, G = FIXTURE_GAP;
      const minX = T + G, minY = T + G;
      const maxX = Math.max(minX, W * UNITS_PER_METER - dims.w - T - G);
      const maxY = Math.max(minY, L * UNITS_PER_METER - dims.h - T - G);
      position.x = Math.max(minX, Math.min(position.x, maxX));
      position.y = Math.max(minY, Math.min(position.y, maxY));

      // Overlap resolution (5 attempts)
      let attempts = 0;
      while (attempts < 5 && placed.some(p => {
        const d = FIXTURE_DIMS[p.type] || { w: 50, h: 50 };
        return Math.abs(p.position.x - position.x) < dims.w + G &&
               Math.abs(p.position.y - position.y) < dims.h + G;
      })) {
        if (fixture.wall === 'north' || fixture.wall === 'south')
          position.x = Math.min(position.x + dims.w + 10, maxX);
        else
          position.y = Math.min(position.y + dims.h + 10, maxY);
        position.x = Math.max(minX, Math.min(position.x, maxX));
        position.y = Math.max(minY, Math.min(position.y, maxY));
        attempts++;
      }

      placed.push({ id: fixture.id, type: fixture.type, position, wall: fixture.wall });
    }

    return placed;
  }

  private _placeCoffeeTable(W: number, L: number): PlacedFixture {
    const dims = FIXTURE_DIMS.coffee_table;
    const sofaH = FIXTURE_DIMS.sofa.h;
    const gap = 40;
    const cx = (W * UNITS_PER_METER) / 2 - dims.w / 2;
    const cy = (L * UNITS_PER_METER) - WALL_THICKNESS - sofaH - gap - dims.h;
    return {
      id: 'coffee_table-auto', type: 'coffee_table',
      position: { x: Math.max(WALL_THICKNESS + 10, cx), y: Math.max(WALL_THICKNESS + 10, cy) },
      wall: 'south',
    };
  }

  private _placeDiningTable(W: number, L: number, id: string): PlacedFixture {
    const dims = FIXTURE_DIMS.dining_table;
    return {
      id, type: 'dining_table',
      position: {
        x: (W * UNITS_PER_METER) / 2 - dims.w / 2,
        y: (L * UNITS_PER_METER) / 2 - dims.h / 2,
      },
      wall: 'north',
    };
  }

  private _placeAtOffset(wall: Wall, offsetMeters: number, dims: { w: number; h: number }): Point {
    const off = Math.max(0, offsetMeters * UNITS_PER_METER);
    const T = WALL_THICKNESS;
    switch (wall.side) {
      case 'north': return { x: wall.start.x + off, y: wall.start.y + T };
      case 'south': return { x: wall.end.x   + off, y: wall.start.y - T - dims.h };
      case 'west':  return { x: wall.start.x + T,   y: wall.end.y   + off };
      case 'east':  return { x: wall.start.x - T - dims.w, y: wall.start.y + off };
    }
  }

  private _placeSequential(wall: Wall, cursors: Record<string, number>, dims: { w: number; h: number }): Point {
    const cur = cursors[wall.side] ?? (WALL_THICKNESS + FIXTURE_GAP);
    const T   = WALL_THICKNESS;
    let position: Point;
    switch (wall.side) {
      case 'north': position = { x: wall.start.x + cur, y: wall.start.y + T };             cursors[wall.side] = cur + dims.w + 10; break;
      case 'south': position = { x: wall.end.x   + cur, y: wall.start.y - T - dims.h };    cursors[wall.side] = cur + dims.w + 10; break;
      case 'west':  position = { x: wall.start.x + T,   y: wall.end.y   + cur };           cursors[wall.side] = cur + dims.h + 10; break;
      default:      position = { x: wall.start.x - T - dims.w, y: wall.start.y + cur };    cursors[wall.side] = cur + dims.h + 10;
    }
    return position;
  }

  // ── Pipes ────────────────────────────────────────────────────────────────────

  generatePipes(fixtures: PlacedFixture[], walls: Wall[], roomSpec?: RoomSpec): Pipe[] {
    const pipes: Pipe[] = [];
    for (const f of fixtures) {
      if (['sink', 'bathtub', 'shower'].includes(f.type)) {
        const cold = this._createPipe(f, 'cold', walls);
        const hot  = this._createPipe(f, 'hot',  walls);
        if (cold) pipes.push(cold);
        if (hot)  pipes.push(hot);
      }
      if (['sink', 'bathtub', 'shower', 'toilet'].includes(f.type)) {
        const drain = this._createPipe(f, 'drain', walls);
        if (drain) pipes.push(drain);
      }
    }
    return pipes;
  }

  private _createPipe(fixture: PlacedFixture, type: PipeType, walls: Wall[]): Pipe | null {
    const dims = FIXTURE_DIMS[fixture.type] || { w: 50, h: 50 };
    const center: Point = { x: fixture.position.x + dims.w / 2, y: fixture.position.y + dims.h / 2 };
    const targetWall = walls.find(w => w.side === fixture.wall);
    if (!targetWall) return null;

    let endpoint: Point;
    switch (fixture.wall) {
      case 'north': endpoint = { x: center.x, y: 0 }; break;
      case 'south': endpoint = { x: center.x, y: targetWall.start.y }; break;
      case 'west':  endpoint = { x: 0, y: center.y }; break;
      default:      endpoint = { x: targetWall.start.x, y: center.y };
    }

    if (type === 'drain') {
      let drainStart: Point;
      if (fixture.wall === 'north')      drainStart = { x: center.x, y: fixture.position.y + dims.h };
      else if (fixture.wall === 'south') drainStart = { x: center.x, y: fixture.position.y };
      else                               drainStart = center;

      if (fixture.type === 'toilet') {
        const ownWall = walls.find(w => w.side === fixture.wall);
        return { id: `pipe-drain-${fixture.id}`, type: 'drain', color: 'gray', fixtureId: fixture.id,
          path: [drainStart, { x: drainStart.x, y: ownWall?.start.y ?? drainStart.y + 50 }] };
      } else {
        const nearestPt = this._nearestWallPoint(drainStart, walls, fixture.wall);
        return { id: `pipe-drain-${fixture.id}`, type: 'drain', color: 'gray', fixtureId: fixture.id,
          path: [drainStart, nearestPt] };
      }
    }

    // cold/hot: short stub to own wall
    const xOff = type === 'cold' ? -3 : 3;
    if (fixture.wall === 'north') {
      return { id: `pipe-${type}-${fixture.id}`, type, color: type === 'cold' ? 'blue' : 'red', fixtureId: fixture.id,
        path: [{ x: center.x + xOff, y: center.y }, { x: center.x + xOff, y: WALL_THICKNESS }] };
    }
    if (fixture.wall === 'south') {
      const southY = targetWall.start.y;
      return { id: `pipe-${type}-${fixture.id}`, type, color: type === 'cold' ? 'blue' : 'red', fixtureId: fixture.id,
        path: [{ x: center.x + xOff, y: center.y }, { x: center.x + xOff, y: southY - WALL_THICKNESS }] };
    }

    // east/west: L-shape
    const mid: Point = Math.abs(endpoint.x - center.x) > Math.abs(endpoint.y - center.y)
      ? { x: endpoint.x, y: center.y }
      : { x: center.x,   y: endpoint.y };
    const raw = [center, mid, endpoint];
    const path = raw.filter(p => !(p.x === 0 && p.y === 0));
    return { id: `pipe-${type}-${fixture.id}`, type, color: type === 'cold' ? 'blue' : 'red', fixtureId: fixture.id,
      path: path.length >= 2 ? path : [center, endpoint] };
  }

  private _nearestWallPoint(pos: Point, walls: Wall[], exclude?: string): Point {
    const T = WALL_THICKNESS;
    if (exclude === 'north') return { x: pos.x, y: (walls.find(w => w.side === 'south')?.start.y ?? pos.y + 50) - T };
    if (exclude === 'south') return { x: pos.x, y: (walls.find(w => w.side === 'north')?.start.y ?? 0) + T };
    if (exclude === 'east')  return { x: (walls.find(w => w.side === 'west')?.start.x ?? 0) + T, y: pos.y };
    if (exclude === 'west')  return { x: (walls.find(w => w.side === 'east')?.start.x ?? pos.x + 50) - T, y: pos.y };
    return { x: pos.x, y: pos.y + 50 };
  }

  // ── Dimensions ───────────────────────────────────────────────────────────────

  generateDimensions(walls: Wall[], roomSpec: RoomSpec): DimensionLine[] {
    return walls.map(wall => ({
      id:    `dim-${wall.side}-${roomSpec.id}`,
      start: wall.start,
      end:   wall.end,
      value: this._wallLength(wall) / UNITS_PER_METER,
      label: `${(this._wallLength(wall) / UNITS_PER_METER).toFixed(2)}m`,
    }));
  }

  private _wallLength(wall: Wall): number {
    const dx = wall.end.x - wall.start.x, dy = wall.end.y - wall.start.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ── Kept for backwards compat ─────────────────────────────────────────────

  snapToWall(wall: Wall, gap: number): Point {
    const midX = (wall.start.x + wall.end.x) / 2;
    const midY = (wall.start.y + wall.end.y) / 2;
    const g = Math.max(gap, 10);
    if (wall.side === 'north') return { x: midX, y: wall.start.y + g };
    if (wall.side === 'south') return { x: midX, y: wall.start.y - g };
    if (wall.side === 'east')  return { x: wall.start.x - g, y: midY };
    return { x: wall.start.x + g, y: midY };
  }

  // These are kept as public for any external callers
  createPipe  = this._createPipe.bind(this);
  findNearestWallPoint = this._nearestWallPoint.bind(this);
  distance(p1: Point, p2: Point) {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }
}
