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
  FloorPlan
} from '../../../shared/types';

const UNITS_PER_METER = 100;
const WALL_THICKNESS = 15;
const FIXTURE_GAP = 5; // 50mm = 5 units
const DEFAULT_DOOR_WIDTH = 0.9; // meters

export class FloorPlanEngine {
  generateDrawing(roomSpec: RoomSpec): DrawingData {
    console.log('[ENGINE] received:', roomSpec.width, roomSpec.length);

    const walls = this.generateWalls(roomSpec);
    const fixtures = this.placeFixtures(roomSpec, walls);
    const pipes = this.generatePipes(fixtures, walls, roomSpec);
    const dimensions = this.generateDimensions(walls, roomSpec);

    // For single room: doors/windows use wall.side directly (no wallId needed)
    return {
      id: `drawing-${roomSpec.id}`,
      walls,
      fixtures,
      pipes,
      dimensions,
      doors: roomSpec.doors,
      windows: roomSpec.windows
    };
  }

  generateFloorPlan(floorPlan: FloorPlan): DrawingData {
    const allWalls: Wall[] = [];
    const allFixtures: PlacedFixture[] = [];
    const allPipes: Pipe[] = [];
    const allDimensions: DimensionLine[] = [];
    const allDoors: import('../../../shared/types').DoorSpec[] = [];
    const allWindows: import('../../../shared/types').WindowSpec[] = [];

    // Auto-layout: smart 2-row grid layout
    // Row 1: living + kitchen (wide rooms), Row 2: bedrooms + bathroom + hallway
    const MAX_ROW_WIDTH = 12; // meters — wrap after this
    let currentX = 0;
    let currentY = 0;
    let rowMaxLength = 0;

    for (const room of floorPlan.rooms) {
      if (currentX > 0 && currentX + room.roomSpec.width > MAX_ROW_WIDTH) {
        currentY += rowMaxLength;
        currentX = 0;
        rowMaxLength = 0;
      }
      room.position = { x: currentX, y: currentY };
      currentX += room.roomSpec.width;
      rowMaxLength = Math.max(rowMaxLength, room.roomSpec.length);
      console.log(`[ENGINE] Room ${room.id} at (${room.position.x}, ${room.position.y})`);
    }

    // Recalculate actual building bounds after layout
    const actualBW = Math.max(...floorPlan.rooms.map(r => r.position.x + r.roomSpec.width));
    const actualBL = Math.max(...floorPlan.rooms.map(r => r.position.y + r.roomSpec.length));
    floorPlan.buildingDimensions = { width: actualBW, length: actualBL };

    for (const room of floorPlan.rooms) {
      const offsetX = room.position.x * UNITS_PER_METER;
      const offsetY = room.position.y * UNITS_PER_METER;

      const roomDrawing = this.generateDrawing(room.roomSpec);

      // Apply offset to walls
      roomDrawing.walls.forEach(wall => {
        allWalls.push({
          ...wall,
          id: `${room.id}-${wall.id}`,
          start: { x: wall.start.x + offsetX, y: wall.start.y + offsetY },
          end:   { x: wall.end.x + offsetX,   y: wall.end.y + offsetY }
        });
      });

      // Apply offset to fixtures
      roomDrawing.fixtures.forEach(f => {
        allFixtures.push({
          ...f,
          id: `${room.id}-${f.id}`,
          position: { x: f.position.x + offsetX, y: f.position.y + offsetY }
        });
      });

      // Apply offset to pipes
      roomDrawing.pipes.forEach(p => {
        allPipes.push({
          ...p,
          id: `${room.id}-${p.id}`,
          path: p.path.map(pt => ({ x: pt.x + offsetX, y: pt.y + offsetY }))
        });
      });

      // Apply offset to dimensions (skip per-room dims for floor plan)

      // Collect doors/windows with wallId for correct rendering
      room.roomSpec.doors.forEach((d) => {
        const actualWall = roomDrawing.walls.find(w => w.side === d.wall);
        const wallId = actualWall ? `${room.id}-${actualWall.id}` : undefined;
        // Also store roomOffset for fallback wall lookup
        allDoors.push({ ...d, id: `${room.id}-${d.id}`, wallId, _roomOffsetX: offsetX, _roomOffsetY: offsetY } as any);
      });
      (room.roomSpec.windows || []).forEach((w) => {
        const actualWall = roomDrawing.walls.find(wl => wl.side === w.wall);
        const wallId = actualWall ? `${room.id}-${actualWall.id}` : undefined;
        allWindows.push({ ...w, id: `${room.id}-${w.id}`, wallId, _roomOffsetX: offsetX, _roomOffsetY: offsetY } as any);
      });    }

    // Remove duplicate shared walls between adjacent rooms
    const dedupedWalls = this.removeDuplicateWalls(allWalls);

    // FIX 2: Overall building dimensions only
    const bW = floorPlan.buildingDimensions.width;
    const bL = floorPlan.buildingDimensions.length;
    const bWu = bW * UNITS_PER_METER;
    const bLu = bL * UNITS_PER_METER;

    const overallDimensions: DimensionLine[] = [
      { id: 'dim-top',    start: { x: 0,   y: -60 }, end: { x: bWu, y: -60 }, value: bW, label: `${bW.toFixed(2)}m` },
      { id: 'dim-bottom', start: { x: 0,   y: bLu + 60 }, end: { x: bWu, y: bLu + 60 }, value: bW, label: `${bW.toFixed(2)}m` },
      { id: 'dim-left',   start: { x: -60, y: 0 }, end: { x: -60, y: bLu }, value: bL, label: `${bL.toFixed(2)}m` },
      { id: 'dim-right',  start: { x: bWu + 60, y: 0 }, end: { x: bWu + 60, y: bLu }, value: bL, label: `${bL.toFixed(2)}m` }
    ];

    // Room name labels (stored as special dimension lines with label only)
    const roomLabels: DimensionLine[] = floorPlan.rooms.map(room => {
      const cx = (room.position.x + room.roomSpec.width / 2) * UNITS_PER_METER;
      const cy = (room.position.y + room.roomSpec.length / 2) * UNITS_PER_METER;
      const area = (room.roomSpec.width * room.roomSpec.length).toFixed(1);
      return {
        id: `label-${room.id}`,
        start: { x: cx, y: cy - 10 },
        end:   { x: cx, y: cy + 10 },
        value: 0,
        label: `${room.roomSpec.name} ${area}m²`
      };
    });

    return {
      id: `floorplan-${floorPlan.id}`,
      walls: dedupedWalls,
      fixtures: allFixtures,
      pipes: allPipes,
      dimensions: [...overallDimensions, ...roomLabels],
      doors: allDoors,
      windows: allWindows
    };
  }

  private removeDuplicateWalls(walls: Wall[]): Wall[] {
    const unique: Wall[] = [];

    for (const wall of walls) {
      const isDuplicate = unique.some(existing => {
        const sameForward = (
          Math.abs(existing.start.x - wall.start.x) < 8 &&
          Math.abs(existing.start.y - wall.start.y) < 8 &&
          Math.abs(existing.end.x - wall.end.x) < 8 &&
          Math.abs(existing.end.y - wall.end.y) < 8
        );
        const sameReverse = (
          Math.abs(existing.start.x - wall.end.x) < 8 &&
          Math.abs(existing.start.y - wall.end.y) < 8 &&
          Math.abs(existing.end.x - wall.start.x) < 8 &&
          Math.abs(existing.end.y - wall.start.y) < 8
        );
        return sameForward || sameReverse;
      });

      if (!isDuplicate) unique.push(wall);
    }

    return unique;
  }

  generateWalls(roomSpec: RoomSpec): Wall[] {
    const widthUnits = roomSpec.width * UNITS_PER_METER;
    const lengthUnits = roomSpec.length * UNITS_PER_METER;

    return [
      {
        id: `wall-north-${roomSpec.id}`,
        start: { x: 0, y: 0 },
        end: { x: widthUnits, y: 0 },
        thickness: WALL_THICKNESS,
        side: 'north'
      },
      {
        id: `wall-east-${roomSpec.id}`,
        start: { x: widthUnits, y: 0 },
        end: { x: widthUnits, y: lengthUnits },
        thickness: WALL_THICKNESS,
        side: 'east'
      },
      {
        id: `wall-south-${roomSpec.id}`,
        start: { x: widthUnits, y: lengthUnits },
        end: { x: 0, y: lengthUnits },
        thickness: WALL_THICKNESS,
        side: 'south'
      },
      {
        id: `wall-west-${roomSpec.id}`,
        start: { x: 0, y: lengthUnits },
        end: { x: 0, y: 0 },
        thickness: WALL_THICKNESS,
        side: 'west'
      }
    ];
  }

  placeFixtures(roomSpec: RoomSpec, walls: Wall[]): PlacedFixture[] {
    const placed: PlacedFixture[] = [];
    const roomWidth = roomSpec.width;
    const roomLength = roomSpec.length;

    // Wall cursor tracker — sequential placement
    const wallCursors: Record<string, number> = {
      north: WALL_THICKNESS + 8,
      south: WALL_THICKNESS + 8,
      east:  WALL_THICKNESS + 8,
      west:  WALL_THICKNESS + 8
    };

    for (const fixture of roomSpec.fixtures) {
      if (!fixture.wall) {
        if (fixture.type === 'toilet') fixture.wall = 'south';
        else if (fixture.type === 'sink') fixture.wall = 'north';
        else if (fixture.type === 'coffee_table') {
          // Coffee table: center of room, in front of sofa
          const cx = (roomWidth * UNITS_PER_METER) / 2 - 45;
          const cy = (roomLength * UNITS_PER_METER) * 0.65;
          placed.push({ id: fixture.id, type: fixture.type, position: { x: cx, y: cy }, wall: 'south' });
          continue;
        } else if (fixture.type === 'dining_table') {
          // Dining table: center of room
          const cx = (roomWidth * UNITS_PER_METER) / 2 - 60;
          const cy = (roomLength * UNITS_PER_METER) / 2 - 40;
          placed.push({ id: fixture.id, type: fixture.type, position: { x: cx, y: cy }, wall: 'north' });
          continue;
        } else {
          continue;
        }
      }

      const wall = walls.find(w => w.side === fixture.wall);
      if (!wall) continue;

      // Override: toilet always south, bathtub always east or west (longest wall)
      if (fixture.type === 'toilet' && fixture.wall === 'north') {
        const southWall = walls.find(w => w.side === 'south');
        if (southWall) fixture.wall = 'south';
      }
      if (fixture.type === 'bathtub' && (fixture.wall === 'north' || fixture.wall === 'south')) {
        // Bathtub on longest wall
        const eastWall = walls.find(w => w.side === 'east');
        if (eastWall) fixture.wall = 'east';
      }

      const correctedWall = walls.find(w => w.side === fixture.wall) || wall;

      const fixtureDimsLocal: Record<string, { w: number; h: number }> = {
        sink: { w: 60, h: 50 }, toilet: { w: 40, h: 70 }, bathtub: { w: 70, h: 170 },
        shower: { w: 90, h: 90 }, stove: { w: 60, h: 60 }, fridge: { w: 60, h: 65 },
        dishwasher: { w: 60, h: 60 }, desk: { w: 120, h: 60 }, bed: { w: 160, h: 200 },
        wardrobe: { w: 120, h: 60 }, sofa: { w: 200, h: 90 }, tv_unit: { w: 150, h: 45 },
        bookshelf: { w: 80, h: 30 }, armchair: { w: 80, h: 80 },
        coffee_table: { w: 90, h: 50 }, dining_table: { w: 120, h: 80 },
        chair: { w: 50, h: 50 }, coat_rack: { w: 60, h: 30 }
      };
      const dims = fixtureDimsLocal[fixture.type] || { w: 50, h: 50 };

      let position: Point;

      // AI offsetFromCorner → absolut koordinata
      if (fixture.offsetFromCorner !== undefined) {
        position = this.placeAtOffset(correctedWall, fixture.offsetFromCorner, dims);
      } else if (fixture.type === 'sink' && fixture.wall === 'north') {
        position = this.placeAtOffset(correctedWall, 0.5, dims);
      } else if (fixture.type === 'shower' && (fixture.wall === 'east' || fixture.wall === 'west')) {
        // Shower: place at 1/3 from north corner on east/west wall
        const wallLength = correctedWall.side === 'east' || correctedWall.side === 'west'
          ? Math.abs(correctedWall.end.y - correctedWall.start.y) / UNITS_PER_METER
          : Math.abs(correctedWall.end.x - correctedWall.start.x) / UNITS_PER_METER;
        position = this.placeAtOffset(correctedWall, Math.max(0.3, wallLength * 0.3), dims);
      } else if (fixture.type === 'toilet' && fixture.wall === 'south') {
        // Toilet on south wall: place at 0.3m from west corner
        position = this.placeAtOffset(correctedWall, 0.3, dims);
      } else {
        position = this.placeSequential(correctedWall, wallCursors, dims);
      }

      // Boundary clamp — fixture MUST stay inside room
      const WALL_T = WALL_THICKNESS;
      const GAP = 5;
      const minX = WALL_T + GAP;
      const minY = WALL_T + GAP;
      const maxX = (roomWidth  * UNITS_PER_METER) - dims.w - WALL_T - GAP;
      const maxY = (roomLength * UNITS_PER_METER) - dims.h - WALL_T - GAP;

      position.x = Math.max(minX, Math.min(position.x, Math.max(minX, maxX)));
      position.y = Math.max(minY, Math.min(position.y, Math.max(minY, maxY)));

      // Overlap check — if position conflicts with already placed fixture, shift
      let attempts = 0;
      while (attempts < 5 && placed.some(p => {
        const dx = Math.abs(p.position.x - position.x);
        const dy = Math.abs(p.position.y - position.y);
        return dx < dims.w && dy < dims.h;
      })) {
        if (fixture.wall === 'north' || fixture.wall === 'south') {
          position.x = Math.min(position.x + dims.w + 10, maxX);
        } else {
          position.y = Math.min(position.y + dims.h + 10, maxY);
        }
        attempts++;
      }

      // Re-clamp after overlap resolution
      position.x = Math.max(minX, Math.min(position.x, Math.max(minX, maxX)));
      position.y = Math.max(minY, Math.min(position.y, Math.max(minY, maxY)));

      placed.push({
        id: fixture.id,
        type: fixture.type,
        position,
        wall: fixture.wall
      });
    }

    return placed;
  }

  private placeAtOffset(wall: Wall, offsetMeters: number, dims: { w: number; h: number }): Point {
    const offsetUnits = Math.max(0, offsetMeters * UNITS_PER_METER);
    const T = WALL_THICKNESS;

    switch (wall.side) {
      case 'north':
        // North wall: y=0, fixtures go DOWN from wall
        return {
          x: wall.start.x + offsetUnits,
          y: wall.start.y + T
        };
      case 'south':
        // South wall: y=roomLength, fixtures go UP from wall
        return {
          x: wall.end.x + offsetUnits,   // end.x = 0 (west corner of south wall)
          y: wall.start.y - T - dims.h   // wall.start.y = roomLength
        };
      case 'west':
        // West wall: x=0, fixtures go RIGHT from wall
        return {
          x: wall.start.x + T,
          y: wall.end.y + offsetUnits    // end.y = 0 (north corner of west wall)
        };
      case 'east':
        // East wall: x=roomWidth, fixtures go LEFT from wall
        return {
          x: wall.start.x - T - dims.w,
          y: wall.start.y + offsetUnits  // start.y = 0 (north corner of east wall)
        };
    }
  }

  private placeSequential(wall: Wall, cursors: Record<string, number>, dims: { w: number; h: number }): Point {
    const cursor = cursors[wall.side] || (WALL_THICKNESS + 8);
    const T = WALL_THICKNESS;
    let position: Point;

    switch (wall.side) {
      case 'north':
        position = { x: wall.start.x + cursor, y: wall.start.y + T };
        cursors[wall.side] = cursor + dims.w + 10;
        break;
      case 'south':
        position = { x: wall.end.x + cursor, y: wall.start.y - T - dims.h };
        cursors[wall.side] = cursor + dims.w + 10;
        break;
      case 'west':
        position = { x: wall.start.x + T, y: wall.end.y + cursor };
        cursors[wall.side] = cursor + dims.h + 10;
        break;
      default: // east
        position = { x: wall.start.x - T - dims.w, y: wall.start.y + cursor };
        cursors[wall.side] = cursor + dims.h + 10;
    }

    return position;
  }

  snapToWall(wall: Wall, gap: number): Point {
    const midX = (wall.start.x + wall.end.x) / 2;
    const midY = (wall.start.y + wall.end.y) / 2;

    // Minimum gap from wall: 10 units
    const minGap = Math.max(gap, 10);

    if (wall.side === 'north') {
      return { x: midX, y: wall.start.y + minGap };
    } else if (wall.side === 'south') {
      return { x: midX, y: wall.start.y - minGap };
    } else if (wall.side === 'east') {
      return { x: wall.start.x - minGap, y: midY };
    } else {
      return { x: wall.start.x + minGap, y: midY };
    }
  }

  generatePipes(fixtures: PlacedFixture[], walls: Wall[], roomSpec?: RoomSpec): Pipe[] {
    const pipes: Pipe[] = [];

    for (const fixture of fixtures) {
      if (['sink', 'bathtub', 'shower'].includes(fixture.type)) {
        const cold = this.createPipe(fixture, 'cold', walls, roomSpec);
        const hot = this.createPipe(fixture, 'hot', walls, roomSpec);
        if (cold) pipes.push(cold);
        if (hot) pipes.push(hot);
      }

      if (['sink', 'bathtub', 'shower', 'toilet'].includes(fixture.type)) {
        const drain = this.createPipe(fixture, 'drain', walls, roomSpec);
        if (drain) pipes.push(drain);
      }
    }

    return pipes;
  }

  createPipe(fixture: PlacedFixture, type: PipeType, walls: Wall[], roomSpec?: RoomSpec): Pipe | null {
    const color = type === 'cold' ? 'blue' : type === 'hot' ? 'red' : 'gray';

    // Real fixture dimensions (units, 1m=100)
    const fixtureDims: Record<string, { w: number; h: number }> = {
      sink:       { w: 60,  h: 50  },
      toilet:     { w: 40,  h: 70  },
      bathtub:    { w: 70,  h: 170 },
      shower:     { w: 90,  h: 90  },
      stove:      { w: 60,  h: 60  },
      fridge:     { w: 60,  h: 65  },
      dishwasher: { w: 60,  h: 60  },
      desk:       { w: 120, h: 60  },
      bed:        { w: 160, h: 200 },
      wardrobe:   { w: 120, h: 60  },
      sofa:       { w: 200, h: 90  },
      tv_unit:    { w: 150, h: 45  },
      bookshelf:  { w: 80,  h: 30  },
      armchair:   { w: 80,  h: 80  },
      coffee_table: { w: 90, h: 50 },
      dining_table: { w: 120, h: 80 },
      chair:      { w: 50,  h: 50  },
      coat_rack:  { w: 60,  h: 30  }
    };
    const dims = fixtureDims[fixture.type] || { w: 50, h: 50 };
    const fixtureCenter: Point = {
      x: fixture.position.x + dims.w / 2,
      y: fixture.position.y + dims.h / 2
    };

    // FIX 1: Pipe goes to the same wall as fixture
    const targetWall = walls.find(w => w.side === fixture.wall);
    if (!targetWall) return null;

    let endpoint: Point;
    if (fixture.wall === 'north') {
      endpoint = { x: fixtureCenter.x, y: 0 };
    } else if (fixture.wall === 'south') {
      endpoint = { x: fixtureCenter.x, y: targetWall.start.y };
    } else if (fixture.wall === 'west') {
      endpoint = { x: 0, y: fixtureCenter.y };
    } else { // east
      endpoint = { x: targetWall.start.x, y: fixtureCenter.y };
    }

    // Drain: go to nearest OTHER wall (not own wall)
    if (type === 'drain') {
      // Drain start: fixture bottom for north wall, fixture top for south wall
      let drainStart: Point;
      if (fixture.wall === 'north') {
        drainStart = { x: fixtureCenter.x, y: fixture.position.y + dims.h };
      } else if (fixture.wall === 'south') {
        drainStart = { x: fixtureCenter.x, y: fixture.position.y }; // TOP of fixture
      } else {
        drainStart = fixtureCenter;
      }

      // Special case: toilet drain goes straight DOWN to own wall (floor drain)
      if (fixture.type === 'toilet') {
        const ownWall = walls.find(w => w.side === fixture.wall);
        const drainEnd = { x: drainStart.x, y: ownWall?.start.y ?? drainStart.y + 50 };
        const path = [drainStart, drainEnd];
        console.log('[PIPE FINAL] drain path:', JSON.stringify(path));
        return { id: `pipe-drain-${fixture.id}`, type: 'drain', path, color: 'gray', fixtureId: fixture.id };
      } else {
        endpoint = this.findNearestWallPoint(drainStart, walls, fixture.wall);
        const path = [drainStart, endpoint];
        console.log('[PIPE FINAL] drain path:', JSON.stringify(path));
        return { id: `pipe-drain-${fixture.id}`, type: 'drain', path, color: 'gray', fixtureId: fixture.id };
      }
    }

    // North wall: L-shaped pipes running along north wall (visible inside room)
    if (fixture.wall === 'north') {
      const roomW = (roomSpec?.width ?? 3) * UNITS_PER_METER;

      if (type === 'cold') {
        const path = [
          { x: fixtureCenter.x, y: fixtureCenter.y },
          { x: fixtureCenter.x, y: WALL_THICKNESS + 10 },
          { x: roomW - WALL_THICKNESS - 10, y: WALL_THICKNESS + 10 }
        ];
        console.log('[PIPE FINAL] cold path:', JSON.stringify(path));
        return { id: `pipe-cold-${fixture.id}`, type: 'cold', path, color: 'blue', fixtureId: fixture.id };
      }

      if (type === 'hot') {
        const path = [
          { x: fixtureCenter.x, y: fixtureCenter.y },
          { x: fixtureCenter.x, y: WALL_THICKNESS + 18 },
          { x: roomW - WALL_THICKNESS - 10, y: WALL_THICKNESS + 18 }
        ];
        console.log('[PIPE FINAL] hot path:', JSON.stringify(path));
        return { id: `pipe-hot-${fixture.id}`, type: 'hot', path, color: 'red', fixtureId: fixture.id };
      }
    }

    // South wall: L-shaped pipes running along south wall
    if (fixture.wall === 'south') {
      const roomW = (roomSpec?.width ?? 3) * UNITS_PER_METER;
      const southWall = walls.find(w => w.side === 'south');
      const yBase = (southWall?.start.y ?? fixtureCenter.y + 50) - WALL_THICKNESS;

      if (type === 'cold') {
        const path = [
          { x: fixtureCenter.x, y: fixtureCenter.y },
          { x: fixtureCenter.x, y: yBase - 10 },
          { x: roomW - WALL_THICKNESS - 10, y: yBase - 10 }
        ];
        console.log('[PIPE FINAL] cold path:', JSON.stringify(path));
        return { id: `pipe-cold-${fixture.id}`, type: 'cold', path, color: 'blue', fixtureId: fixture.id };
      }

      if (type === 'hot') {
        const path = [
          { x: fixtureCenter.x, y: fixtureCenter.y },
          { x: fixtureCenter.x, y: yBase - 18 },
          { x: roomW - WALL_THICKNESS - 10, y: yBase - 18 }
        ];
        console.log('[PIPE FINAL] hot path:', JSON.stringify(path));
        return { id: `pipe-hot-${fixture.id}`, type: 'hot', path, color: 'red', fixtureId: fixture.id };
      }
    }

    console.log('[PIPE]', fixture.type, 'wall:', fixture.wall, 'center:', fixtureCenter, 'endpoint:', endpoint);

    // L-shape routing direction
    const goingHorizontal = Math.abs(endpoint.x - fixtureCenter.x) > 
                            Math.abs(endpoint.y - fixtureCenter.y);
    const intermediatePoint: Point = goingHorizontal
      ? { x: endpoint.x, y: fixtureCenter.y }
      : { x: fixtureCenter.x, y: endpoint.y };

    // Build path: skip intermediate if it equals endpoint (straight line)
    const isIntermediateSameAsEndpoint = 
      intermediatePoint.x === endpoint.x && intermediatePoint.y === endpoint.y;
    
    const rawPath = isIntermediateSameAsEndpoint
      ? [fixtureCenter, endpoint]
      : [fixtureCenter, intermediatePoint, endpoint];

    const path = rawPath.filter(
      point => !(point.x === 0 && point.y === 0)
    );

    console.log('[PIPE FINAL]', type, 'start:', fixtureCenter, 'end:', endpoint, 'path:', JSON.stringify(path));

    return {
      id: `pipe-${type}-${fixture.id}`,
      type,
      path: path.length >= 2 ? path : [fixtureCenter, endpoint],
      color,
      fixtureId: fixture.id
    };
  }

  findNearestWallPoint(position: Point, walls: Wall[], excludeWall?: string): Point {
    const WALL_T = 15;

    // Special case: toilet drain goes straight to own wall (floor drain)
    // This is handled in createPipe before calling this function

    // For north/south fixtures: drain goes to nearest horizontal wall (not own)
    if (excludeWall === 'north' || excludeWall === 'south') {
      const southWall = walls.find(w => w.side === 'south');
      const northWall = walls.find(w => w.side === 'north');
      if (!southWall || !northWall) return { x: position.x, y: position.y + 50 };

      const toSouth = Math.abs(position.y - southWall.start.y);
      const toNorth = Math.abs(position.y - northWall.start.y);

      if (excludeWall === 'north') {
        // Sink on north wall → drain goes DOWN to south wall
        return { x: position.x, y: southWall.start.y - WALL_T };
      } else {
        // Fixture on south wall → drain goes UP to north wall
        return { x: position.x, y: northWall.start.y + WALL_T };
      }
    }

    // For east/west fixtures: drain goes to nearest vertical wall (not own)
    if (excludeWall === 'east' || excludeWall === 'west') {
      const eastWall = walls.find(w => w.side === 'east');
      const westWall = walls.find(w => w.side === 'west');
      if (!eastWall || !westWall) return { x: position.x + 50, y: position.y };

      if (excludeWall === 'east') {
        return { x: westWall.start.x + WALL_T, y: position.y };
      } else {
        return { x: eastWall.start.x - WALL_T, y: position.y };
      }
    }

    // Fallback: nearest wall midpoint
    let nearestPoint: Point = { x: position.x, y: position.y + 50 };
    let minDist = Infinity;

    for (const wall of walls) {
      if (excludeWall && wall.side === excludeWall) continue;
      const midPoint = {
        x: (wall.start.x + wall.end.x) / 2,
        y: (wall.start.y + wall.end.y) / 2
      };
      const dist = this.distance(position, midPoint);
      if (dist < minDist) {
        minDist = dist;
        nearestPoint = midPoint;
      }
    }

    return nearestPoint;
  }

  findNearestCorner(position: Point, walls: Wall[]): Point {
    const corners = [
      walls[0].start,
      walls[1].start,
      walls[2].start,
      walls[3].start
    ];

    let nearest = corners[0];
    let minDist = this.distance(position, nearest);

    for (const corner of corners) {
      const dist = this.distance(position, corner);
      if (dist < minDist) {
        minDist = dist;
        nearest = corner;
      }
    }

    return nearest;
  }

  distance(p1: Point, p2: Point): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  generateDimensions(walls: Wall[], roomSpec: RoomSpec): DimensionLine[] {
    return walls.map(wall => ({
      id: `dim-${wall.side}-${roomSpec.id}`,
      start: wall.start,
      end: wall.end,
      value: this.calculateWallLength(wall) / UNITS_PER_METER,
      label: `${(this.calculateWallLength(wall) / UNITS_PER_METER).toFixed(2)}m`
    }));
  }

  calculateWallLength(wall: Wall): number {
    return this.distance(wall.start, wall.end);
  }
}
