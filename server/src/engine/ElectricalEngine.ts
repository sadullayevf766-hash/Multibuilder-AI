import type {
  RoomSpec, FloorPlan, Wall, DimensionLine, WallSide,
  ElectricalSymbol, ElectricalSymbolType, ElectricalCircuit,
  ElectricalPanel, ElectricalDrawingData, Point, DoorSpec,
} from '../../../shared/types';
import { FloorPlanEngine } from './FloorPlanEngine';

const U = 100;   // units per meter
const T = 15;    // wall thickness

let _uid = 0;
const uid = (pfx: string) => `${pfx}-${++_uid}`;

// ── Symbol placement helpers ──────────────────────────────────────────────────

function wallPoint(side: WallSide, along: number, W: number, L: number): Point {
  switch (side) {
    case 'north': return { x: along, y: T };
    case 'south': return { x: along, y: L - T };
    case 'west':  return { x: T,     y: along };
    case 'east':  return { x: W - T, y: along };
  }
}

function sym(
  type: ElectricalSymbolType,
  side: WallSide,
  along: number,
  W: number, L: number,
  circuit: string,
  label?: string,
): ElectricalSymbol {
  return { id: uid(type), type, position: wallPoint(side, along, W, L), wall: side, circuit, label };
}

function centerSym(type: ElectricalSymbolType, x: number, y: number, circuit: string): ElectricalSymbol {
  return { id: uid(type), type, position: { x, y }, circuit };
}

// Place switch near door opening (inside room, on hinge side)
function switchNearDoor(door: DoorSpec, W: number, L: number, circuit: string): ElectricalSymbol {
  const dw = (door.width ?? 0.9) * U;
  const offset = 15; // 15 units from door edge
  let along: number;
  switch (door.wall) {
    case 'north': along = W / 2 - dw / 2 - offset; break;
    case 'south': along = W / 2 - dw / 2 - offset; break;
    case 'west':  along = L / 2 - dw / 2 - offset; break;
    case 'east':  along = L / 2 - dw / 2 - offset; break;
  }
  return sym('switch', door.wall, Math.max(T + 8, along), W, L, circuit);
}

// ── Room-type symbol sets ─────────────────────────────────────────────────────

function bathroomSymbols(W: number, L: number): ElectricalSymbol[] {
  const s: ElectricalSymbol[] = [];
  s.push(centerSym('light_waterproof', W / 2, L / 2, 'c-lighting'));
  s.push(sym('socket_waterproof', 'east', L * 0.3, W, L, 'c-bathroom', 'IP44'));
  s.push(sym('fan_exhaust',       'north', W * 0.75,  W, L, 'c-lighting'));
  return s;
}

function kitchenSymbols(W: number, L: number): ElectricalSymbol[] {
  const s: ElectricalSymbol[] = [];
  s.push(centerSym('light_ceiling', W / 2, L / 2, 'c-lighting'));
  // 4 sockets above counter on north wall (at counter height)
  [0.20, 0.40, 0.60, 0.80].forEach(t =>
    s.push(sym('socket', 'north', W * t, W, L, 'c-kitchen')));
  // Double socket on east wall for appliances
  s.push(sym('socket_double', 'east', L * 0.3, W, L, 'c-kitchen'));
  return s;
}

function bedroomSymbols(W: number, L: number): ElectricalSymbol[] {
  const s: ElectricalSymbol[] = [];
  s.push(centerSym('light_ceiling', W / 2, L / 2, 'c-lighting'));
  // Sockets beside bed (east wall)
  s.push(sym('socket_double', 'east', L * 0.25, W, L, 'c-sockets'));
  s.push(sym('socket_double', 'east', L * 0.40, W, L, 'c-sockets'));
  // Socket on west wall
  s.push(sym('socket', 'west', L * 0.3, W, L, 'c-sockets'));
  // TV socket on south wall
  s.push(sym('socket_tv', 'south', W * 0.6, W, L, 'c-sockets'));
  return s;
}

function livingSymbols(W: number, L: number): ElectricalSymbol[] {
  const s: ElectricalSymbol[] = [];
  // 2 ceiling lights
  s.push(centerSym('light_ceiling', W * 0.3, L / 2, 'c-lighting'));
  s.push(centerSym('light_ceiling', W * 0.7, L / 2, 'c-lighting'));
  // 6 sockets: 2 per side wall, 2 on south
  s.push(sym('socket_double', 'west', L * 0.3, W, L, 'c-sockets'));
  s.push(sym('socket_double', 'west', L * 0.7, W, L, 'c-sockets'));
  s.push(sym('socket_double', 'east', L * 0.3, W, L, 'c-sockets'));
  s.push(sym('socket_double', 'east', L * 0.7, W, L, 'c-sockets'));
  s.push(sym('socket',        'south', W * 0.3, W, L, 'c-sockets'));
  s.push(sym('socket_tv',     'south', W * 0.6, W, L, 'c-sockets'));
  return s;
}

function hallwaySymbols(W: number, L: number): ElectricalSymbol[] {
  const s: ElectricalSymbol[] = [];
  s.push(centerSym('light_ceiling', W / 2, L / 2, 'c-lighting'));
  s.push(sym('socket', 'east', L * 0.5, W, L, 'c-sockets'));
  return s;
}

function defaultSymbols(W: number, L: number): ElectricalSymbol[] {
  const s: ElectricalSymbol[] = [];
  s.push(centerSym('light_ceiling', W / 2, L / 2, 'c-lighting'));
  s.push(sym('socket', 'east', L * 0.3, W, L, 'c-sockets'));
  s.push(sym('socket', 'east', L * 0.7, W, L, 'c-sockets'));
  return s;
}

function symbolsForRoom(name: string, W: number, L: number): ElectricalSymbol[] {
  const n = name.toLowerCase();
  if (/hammom|bathroom|wc|tualet/.test(n)) return bathroomSymbols(W, L);
  if (/oshxona|kitchen/.test(n))            return kitchenSymbols(W, L);
  if (/yotoqxona|bedroom/.test(n))          return bedroomSymbols(W, L);
  if (/mehmonxona|living|zal/.test(n))      return livingSymbols(W, L);
  if (/koridor|hallway/.test(n))            return hallwaySymbols(W, L);
  return defaultSymbols(W, L);
}

// ── Circuit grouping ──────────────────────────────────────────────────────────

function buildCircuits(
  allSymbols: ElectricalSymbol[],
  roomNames: string[],
): ElectricalCircuit[] {
  const hasBathroom = roomNames.some(n => /hammom|bathroom/.test(n.toLowerCase()));
  const hasKitchen  = roomNames.some(n => /oshxona|kitchen/.test(n.toLowerCase()));

  const byKey: Record<string, ElectricalSymbol[]> = {};
  allSymbols.forEach(s => {
    (byKey[s.circuit] = byKey[s.circuit] ?? []).push(s);
  });

  const circuits: ElectricalCircuit[] = [];

  // Yoritish guruhi
  const lightIds = (byKey['c-lighting'] ?? []).map(s => s.id);
  if (lightIds.length) {
    circuits.push({
      id: 'c1', name: 'Yoritish 1', type: 'lighting',
      breaker: 10, cable: '3×1.5',
      power: (byKey['c-lighting'] ?? []).length * 80,
      symbolIds: lightIds,
    });
  }

  // Hammom guruhi (alohida УЗО)
  const bathIds = (byKey['c-bathroom'] ?? []).map(s => s.id);
  if (bathIds.length || hasBathroom) {
    circuits.push({
      id: 'c2', name: 'Hammom', type: 'socket',
      breaker: 16, cable: '3×2.5',
      power: 1500, symbolIds: bathIds, hasRcd: true,
    });
  }

  // Oshxona guruhi (kuchli)
  const kitchenIds = (byKey['c-kitchen'] ?? []).map(s => s.id);
  if (kitchenIds.length || hasKitchen) {
    circuits.push({
      id: 'c3', name: 'Oshxona', type: 'specialized',
      breaker: 20, cable: '3×4',
      power: 3500, symbolIds: kitchenIds,
    });
  }

  // Umumiy rozetkalar
  const socketIds = (byKey['c-sockets'] ?? []).map(s => s.id);
  if (socketIds.length) {
    // Split into groups of max 8 sockets per circuit
    const chunkSize = 8;
    for (let i = 0; i < socketIds.length; i += chunkSize) {
      const chunk = socketIds.slice(i, i + chunkSize);
      circuits.push({
        id: `c${circuits.length + 1}`,
        name: `Rozetka ${Math.floor(i / chunkSize) + 1}`,
        type: 'socket', breaker: 16, cable: '3×2.5',
        power: chunk.length * 300, symbolIds: chunk,
      });
    }
  }

  return circuits;
}

function buildPanel(circuits: ElectricalCircuit[], panelPos: Point): ElectricalPanel {
  const totalLoad = circuits.reduce((s, c) => s + c.power, 0);
  const totalAmps = Math.ceil(totalLoad / 220);
  const mainBreaker = [25, 32, 40, 50, 63].find(a => a >= totalAmps) ?? 63;

  return {
    position: panelPos,
    mainBreaker,
    rcdAmps: mainBreaker,
    circuits,
    totalLoad: Math.round(totalLoad / 100) / 10, // kW
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export class ElectricalEngine {
  private fpEngine = new FloorPlanEngine();

  generateFromRoom(roomSpec: RoomSpec): ElectricalDrawingData {
    _uid = 0;
    const W = roomSpec.width * U;
    const L = roomSpec.length * U;

    const baseDrawing = this.fpEngine.generateDrawing(roomSpec);

    const roomSymbols = symbolsForRoom(roomSpec.name, W, L);

    // Switch near first door
    if (roomSpec.doors[0]) {
      roomSymbols.push(switchNearDoor(roomSpec.doors[0], W, L, 'c-lighting'));
    }

    const circuits = buildCircuits(roomSymbols, [roomSpec.name]);

    // Panel on west wall near door
    const door = roomSpec.doors[0];
    const panelY = door?.wall === 'south' ? L - T - 30 : T + 30;
    const panel  = buildPanel(circuits, { x: T, y: panelY });
    roomSymbols.push({
      id: uid('panel'), type: 'panel',
      position: panel.position, circuit: 'panel',
    });

    return {
      id: `electrical-${roomSpec.id}`,
      drawingType: 'electrical-floor-plan',
      walls: baseDrawing.walls,
      doors: baseDrawing.doors ?? [],
      windows: baseDrawing.windows,
      dimensions: baseDrawing.dimensions,
      symbols: roomSymbols,
      panel,
      roomName: roomSpec.name,
    };
  }

  generateFromFloorPlan(floorPlan: FloorPlan): ElectricalDrawingData {
    _uid = 0;
    const baseDrawing = this.fpEngine.generateFloorPlan(floorPlan);

    const allSymbols: ElectricalSymbol[] = [];
    let panelPos: Point = { x: T, y: T + 30 };

    for (const room of floorPlan.rooms) {
      const offX = room.position.x * U;
      const offY = room.position.y * U;
      const W    = room.roomSpec.width * U;
      const L    = room.roomSpec.length * U;

      const rSymbols = symbolsForRoom(room.roomSpec.name, W, L);
      if (room.roomSpec.doors[0]) {
        rSymbols.push(switchNearDoor(room.roomSpec.doors[0], W, L, 'c-lighting'));
      }

      // Apply room offset
      rSymbols.forEach(s => {
        s.position = { x: s.position.x + offX, y: s.position.y + offY };
        allSymbols.push(s);
      });

      // Panel near first room's entrance
      if (room === floorPlan.rooms[0]) {
        panelPos = { x: offX + T, y: offY + T + 30 };
      }
    }

    const roomNames = floorPlan.rooms.map(r => r.roomSpec.name);
    const circuits  = buildCircuits(allSymbols, roomNames);
    const panel     = buildPanel(circuits, panelPos);

    allSymbols.push({
      id: uid('panel'), type: 'panel',
      position: panel.position, circuit: 'panel',
    });

    return {
      id: `electrical-${floorPlan.id}`,
      drawingType: 'electrical-floor-plan',
      walls: baseDrawing.walls,
      doors: baseDrawing.doors ?? [],
      windows: (baseDrawing as any).windows,
      dimensions: baseDrawing.dimensions,
      symbols: allSymbols,
      panel,
    };
  }
}
