/**
 * PlumbingProjectEngine — Santexnika loyiha ma'lumot modeli va generatsiya
 *
 * Standartlar: SNiP 2.04.01-85, SP 30.13330.2020
 * В1 = sovuq suv, Т3 = issiq suv, Т4 = sirkul, К1 = kanalizatsiya
 *
 * Arxitektura:
 *   prompt → PlumbingAIParser → PlumbingProjectSpec → PlumbingProjectEngine → PlumbingProject
 *   PlumbingProject → Canvas2D (6 proeksiya) + Canvas3D
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CORE DATA MODEL
// ═══════════════════════════════════════════════════════════════════════════════

export type FixtureType =
  | 'toilet' | 'sink' | 'bathtub' | 'shower' | 'bidet'
  | 'washing_machine' | 'dishwasher' | 'kitchen_sink' | 'floor_drain'
  | 'towel_rail' | 'tap';

export type PipeType = 'cold' | 'hot' | 'circ' | 'drain';
export type PipeMaterial = 'ppr' | 'copper' | 'steel' | 'pvc' | 'hdpe';
export type ViewType = 'top' | 'front' | 'back' | 'left' | 'right' | 'bottom' | '3d' | 'axon';

export interface Vec3 { x: number; y: number; z: number; }
export interface Vec2 { x: number; y: number; }

export interface PlumbingFixture {
  id: string;
  type: FixtureType;
  nameUz: string;
  nameRu: string;
  // Metr birligida pozitsiya (0,0,0 = birinchi qavatning pastki-chap burchagi)
  position: Vec3;
  rotation: number;           // gradus (0, 90, 180, 270)
  dimensions: { w: number; d: number; h: number };  // metrda
  floor: number;
  roomId: string;
  // Suv ulash nuqtalari (fixture dan nisbiy)
  coldIn:  Vec3 | null;       // В1 ulanish
  hotIn:   Vec3 | null;       // Т3 ulanish
  drainOut: Vec3 | null;      // К1 ulanish
  drainDiamMm: 50 | 110;
  branchDiamMm: 20 | 25;
  // Qo'lda edit uchun
  isManual: boolean;
  label?: string;
}

export interface PlumbingPipeSegment {
  id: string;
  type: PipeType;
  material: PipeMaterial;
  diamMm: number;
  // 3D koordinatalar (metr)
  from: Vec3;
  to: Vec3;
  floor: number;
  isRiser: boolean;           // vertikal stoyak
  isMain: boolean;            // bosh magistral
  label?: string;
  slope?: number;             // kanalizatsiya uchun (%)
}

export interface PlumbingRoom {
  id: string;
  name: string;
  nameRu: string;
  type: 'bathroom' | 'kitchen' | 'laundry' | 'toilet' | 'utility' | 'other';
  floor: number;
  // Metrda (0,0 = binoning pastki-chap burchagi)
  position: Vec2;
  width: number;
  length: number;
  height: number;             // qavat balandligi (odatda 2.8m)
  fixtureIds: string[];
  /** Ixtiyoriy polygon shakl — position ga nisbiy nuqtalar (m). */
  shape?: Vec2[];
}

export interface PlumbingRiser {
  id: string;
  tag: string;                // 'В1-1', 'Т3-1', 'К1-1'
  type: PipeType;
  diamMm: number;
  // Bino koordinatasida X,Y pozitsiyasi (metr)
  x: number;
  y: number;
  fromFloor: number;
  toFloor: number;
  segments: Array<{
    fromFloor: number;
    toFloor: number;
    diamMm: number;
    label: string;
  }>;
}

export type WallSide = 'north' | 'south' | 'east' | 'west';

export interface PlumbingOpening {
  id: string;
  roomId: string;
  side: WallSide;
  offset: number;
  width: number;
  type: 'door' | 'window';
  swingIn?: boolean;
}

export interface PlumbingEquipment {
  id: string;
  type: 'boiler' | 'pump_cold' | 'pump_circ' | 'filter' | 'manifold_cold' | 'manifold_hot' | 'water_meter';
  nameUz: string;
  model: string;
  position: Vec3;
  floor: number;
  inputDiamMm: number;
  outputDiamMm: number;
}

export interface PlumbingLayer {
  id: 'cold' | 'hot' | 'circ' | 'drain' | 'fixtures' | 'rooms' | 'dimensions';
  visible: boolean;
  color: string;
}

export interface PlumbingProject {
  id: string;
  name: string;
  description: string;        // original user prompt
  createdAt: string;
  updatedAt: string;

  // Bino parametrlari
  floorCount: number;
  floorHeight: number;        // metr (odatda 2.8)
  buildingWidth: number;      // metr
  buildingLength: number;     // metr

  // Elementlar
  rooms: PlumbingRoom[];
  fixtures: PlumbingFixture[];
  pipes: PlumbingPipeSegment[];
  risers: PlumbingRiser[];
  equipment: PlumbingEquipment[];
  openings?: PlumbingOpening[];

  // Ko'rinish holati (client saqlaydi)
  activeView: ViewType;
  activeFloor: number;
  layers: PlumbingLayer[];

  // Statistika
  stats: {
    totalFixtures: number;
    totalPipeM: number;
    coldPipeM: number;
    hotPipeM: number;
    drainPipeM: number;
    totalRisers: number;
    boilerVolL: number;
    mainColdDiamMm: number;
    mainHotDiamMm: number;
  };

  notes: string[];
  labelOverrides?: Record<string, { dx: number; dy: number; fontSize?: number; hidden?: boolean }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI PARSER INPUT (prompt → bu struktura)
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlumbingProjectSpec {
  floorCount: number;
  floorHeight: number;
  buildingWidth: number;
  buildingLength: number;
  rooms: Array<{
    name: string;
    type: PlumbingRoom['type'];
    floor: number;
    width: number;
    length: number;
    fixtures: FixtureType[];
    positionHint?: 'north' | 'south' | 'east' | 'west' | 'center';
  }>;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIXTURE CATALOG
// ═══════════════════════════════════════════════════════════════════════════════

interface FixtureMeta {
  nameUz: string;
  nameRu: string;
  w: number; d: number; h: number;  // metr
  coldWater: boolean;
  hotWater: boolean;
  drainDiamMm: 50 | 110;
  branchDiamMm: 20 | 25;
  coldOffset: Vec3 | null;    // fixture markazidan nisbiy
  hotOffset: Vec3 | null;
  drainOffset: Vec3 | null;
}

const FIXTURE_CATALOG: Record<FixtureType, FixtureMeta> = {
  toilet: {
    nameUz: 'Unitaz', nameRu: 'Унитаз',
    w: 0.37, d: 0.66, h: 0.40,
    coldWater: true, hotWater: false,
    drainDiamMm: 110, branchDiamMm: 20,
    coldOffset: { x: 0, y: -0.15, z: 0.23 },
    hotOffset: null,
    drainOffset: { x: 0, y: 0.25, z: 0 },
  },
  sink: {
    nameUz: 'Lavabo', nameRu: 'Умывальник',
    w: 0.50, d: 0.42, h: 0.85,
    coldWater: true, hotWater: true,
    drainDiamMm: 50, branchDiamMm: 20,
    coldOffset: { x: -0.07, y: 0, z: 0.70 },
    hotOffset:  { x:  0.07, y: 0, z: 0.70 },
    drainOffset: { x: 0, y: 0, z: 0.55 },
  },
  kitchen_sink: {
    nameUz: 'Oshxona lavabosi', nameRu: 'Мойка кухонная',
    w: 0.60, d: 0.50, h: 0.90,
    coldWater: true, hotWater: true,
    drainDiamMm: 50, branchDiamMm: 20,
    coldOffset: { x: -0.07, y: 0, z: 0.75 },
    hotOffset:  { x:  0.07, y: 0, z: 0.75 },
    drainOffset: { x: 0, y: 0, z: 0.55 },
  },
  bathtub: {
    nameUz: 'Vanna', nameRu: 'Ванна',
    w: 0.70, d: 1.70, h: 0.60,
    coldWater: true, hotWater: true,
    drainDiamMm: 50, branchDiamMm: 20,
    coldOffset: { x: -0.10, y: 0.75, z: 0.55 },
    hotOffset:  { x:  0.10, y: 0.75, z: 0.55 },
    drainOffset: { x: 0, y: -0.70, z: 0 },
  },
  shower: {
    nameUz: 'Dush kabinasi', nameRu: 'Душевая кабина',
    w: 0.90, d: 0.90, h: 2.00,
    coldWater: true, hotWater: true,
    drainDiamMm: 50, branchDiamMm: 20,
    coldOffset: { x: -0.10, y: 0, z: 1.20 },
    hotOffset:  { x:  0.10, y: 0, z: 1.20 },
    drainOffset: { x: 0, y: 0, z: 0 },
  },
  bidet: {
    nameUz: 'Bide', nameRu: 'Биде',
    w: 0.37, d: 0.55, h: 0.40,
    coldWater: true, hotWater: true,
    drainDiamMm: 50, branchDiamMm: 20,
    coldOffset: { x: -0.07, y: -0.10, z: 0.25 },
    hotOffset:  { x:  0.07, y: -0.10, z: 0.25 },
    drainOffset: { x: 0, y: 0.20, z: 0 },
  },
  washing_machine: {
    nameUz: 'Kir yuvish mashinasi', nameRu: 'Стиральная машина',
    w: 0.60, d: 0.55, h: 0.85,
    coldWater: true, hotWater: false,
    drainDiamMm: 50, branchDiamMm: 20,
    coldOffset: { x: 0, y: -0.10, z: 0.80 },
    hotOffset: null,
    drainOffset: { x: 0, y: 0.10, z: 0.65 },
  },
  dishwasher: {
    nameUz: 'Idish yuvish mashinasi', nameRu: 'Посудомоечная машина',
    w: 0.60, d: 0.55, h: 0.85,
    coldWater: true, hotWater: false,
    drainDiamMm: 50, branchDiamMm: 20,
    coldOffset: { x: 0, y: -0.10, z: 0.80 },
    hotOffset: null,
    drainOffset: { x: 0, y: 0.10, z: 0.65 },
  },
  floor_drain: {
    nameUz: 'Pol drenaji', nameRu: 'Трап',
    w: 0.15, d: 0.15, h: 0.05,
    coldWater: false, hotWater: false,
    drainDiamMm: 50, branchDiamMm: 20,
    coldOffset: null, hotOffset: null,
    drainOffset: { x: 0, y: 0, z: 0 },
  },
  towel_rail: {
    nameUz: 'Sochiq isitgich', nameRu: 'Полотенцесушитель',
    w: 0.50, d: 0.10, h: 0.80,
    coldWater: false, hotWater: true,
    drainDiamMm: 50, branchDiamMm: 20,
    coldOffset: null,
    hotOffset: { x: 0, y: 0, z: 0.40 },
    drainOffset: null,
  },
  tap: {
    nameUz: 'Kran', nameRu: 'Кран',
    w: 0.10, d: 0.10, h: 0.10,
    coldWater: true, hotWater: false,
    drainDiamMm: 50, branchDiamMm: 20,
    coldOffset: { x: 0, y: 0, z: 0.08 },
    hotOffset: null,
    drainOffset: null,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROOM AUTO-LAYOUT (rooms bino ichida joylashtirish)
// ═══════════════════════════════════════════════════════════════════════════════

function layoutRooms(spec: PlumbingProjectSpec): PlumbingRoom[] {
  const rooms: PlumbingRoom[] = [];
  const floorHeight = spec.floorHeight || 2.8;

  // Har bir qavat uchun alohida grid layout
  for (let floor = 1; floor <= spec.floorCount; floor++) {
    const floorRooms = spec.rooms.filter(r => r.floor === floor);
    let curX = 0;
    let curY = 0;
    let rowMaxLength = 0;
    const maxWidth = spec.buildingWidth || 12;

    for (const r of floorRooms) {
      if (curX > 0 && curX + r.width > maxWidth) {
        curY += rowMaxLength;
        curX = 0;
        rowMaxLength = 0;
      }

      rooms.push({
        id: `room-${floor}-${rooms.length}`,
        name: r.name,
        nameRu: r.name,
        type: r.type,
        floor,
        position: { x: curX, y: curY },
        width: r.width,
        length: r.length,
        height: floorHeight,
        fixtureIds: [],
      });

      curX += r.width;
      rowMaxLength = Math.max(rowMaxLength, r.length);
    }
  }

  return rooms;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIXTURE PLACEMENT — overlap-free, rotation-aware
// ═══════════════════════════════════════════════════════════════════════════════

let idCounter = 0;
function uid(prefix: string) { return `${prefix}-${++idCounter}`; }

// Devorga joylashtirilganda fixture o'lchamlari:
// north/south → along=w (kengligi), into=d (chuqurligi)
// east/west   → along=d, into=w  (90° burilgan)
function getAlongInto(w: number, d: number, wall: WallSide) {
  return (wall === 'east' || wall === 'west')
    ? { along: d, into: w }
    : { along: w, into: d };
}

// Xona turiga qarab afzal devor
function preferredWall(type: FixtureType, roomType: string): WallSide {
  if (roomType === 'bathroom' || roomType === 'toilet') {
    if (type === 'toilet')      return 'north';
    if (type === 'sink')        return 'east';
    if (type === 'bathtub')     return 'west';
    if (type === 'shower')      return 'east';
    if (type === 'bidet')       return 'north';
    if (type === 'towel_rail')  return 'south';
    if (type === 'floor_drain') return 'west';
  }
  if (roomType === 'kitchen') {
    if (type === 'kitchen_sink' || type === 'dishwasher') return 'north';
    return 'west';
  }
  if (roomType === 'laundry') {
    if (type === 'sink') return 'north';
    return 'west';
  }
  return 'north';
}

// BoundingBox — overlap tekshiruvi uchun
interface BBox { x1: number; y1: number; x2: number; y2: number; }

function fixtureBBox(cx: number, cy: number, w: number, d: number, wall: WallSide): BBox {
  const { along, into } = getAlongInto(w, d, wall);
  // north/south → along=x, into=y; east/west → along=y, into=x
  if (wall === 'north' || wall === 'south') {
    return { x1: cx - along/2, y1: cy - into/2, x2: cx + along/2, y2: cy + into/2 };
  } else {
    return { x1: cx - into/2, y1: cy - along/2, x2: cx + into/2, y2: cy + along/2 };
  }
}

function bboxOverlaps(a: BBox, b: BBox, gap = 0.04): boolean {
  return a.x1 < b.x2 + gap && a.x2 > b.x1 - gap &&
         a.y1 < b.y2 + gap && a.y2 > b.y1 - gap;
}

function bboxInsideRoom(bb: BBox, room: PlumbingRoom, margin = 0.02): boolean {
  return bb.x1 >= room.position.x - margin &&
         bb.x2 <= room.position.x + room.width  + margin &&
         bb.y1 >= room.position.y - margin &&
         bb.y2 <= room.position.y + room.length + margin;
}

// Bitta devorda fixture uchun joy topish — scanning yondashuv
function tryPlaceOnWall(
  room: PlumbingRoom,
  w: number, d: number,
  wall: WallSide,
  cursors: Record<WallSide, number>,
  placed: BBox[],
): { pos: { x: number; y: number }; wall: WallSide } | null {
  const { along, into } = getAlongInto(w, d, wall);
  const WALL_T = 0.17; // devor qalinligi + bo'shliq
  const GAP    = 0.05; // fixture'lar orasidagi minimal bo'shliq
  const MARGIN = 0.04; // xona chegarasidan minimal masofa

  const roomAlong = (wall === 'north' || wall === 'south') ? room.width : room.length;
  const intoCenter = into / 2 + WALL_T;

  const rx = room.position.x, ry = room.position.y;

  // Fixture markazining devor bo'ylab pozitsiyasi
  // Cursor = keyingi bo'sh joy boshi (devor boshidan)
  let alongCenter = cursors[wall] + along / 2;

  // Xona ichiga sig'adimi?
  if (alongCenter + along / 2 + MARGIN > roomAlong) return null;

  // Global markaz
  let cx!: number, cy!: number;
  const computeCenter = (ac: number) => {
    switch (wall) {
      case 'north': return { x: rx + ac, y: ry + intoCenter };
      case 'south': return { x: rx + ac, y: ry + room.length - intoCenter };
      case 'west':  return { x: rx + intoCenter, y: ry + ac };
      case 'east':  return { x: rx + room.width - intoCenter, y: ry + ac };
    }
  };

  // Overlap bo'lmagan joy topguncha scan
  const MAX_TRIES = 20;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    if (alongCenter + along / 2 + MARGIN > roomAlong) return null;

    const center = computeCenter(alongCenter);
    cx = center.x; cy = center.y;
    const bb = fixtureBBox(cx, cy, w, d, wall);

    if (!bboxInsideRoom(bb, room, MARGIN)) return null;

    let hasOverlap = false;
    let maxConflictEnd = alongCenter; // eng kech tugaydigan conflict
    for (const other of placed) {
      if (bboxOverlaps(bb, other, 0.01)) {
        hasOverlap = true;
        // Conflict tugash nuqtasini topish (devor bo'ylab)
        const conflictEnd = (wall === 'north' || wall === 'south')
          ? (other.x2 - rx)   // along = x
          : (other.y2 - ry);  // along = y
        maxConflictEnd = Math.max(maxConflictEnd, conflictEnd + GAP);
      }
    }

    if (!hasOverlap) {
      // Joy topildi
      cursors[wall] = alongCenter + along / 2 + GAP;
      placed.push(bb);
      return { pos: { x: cx, y: cy }, wall };
    }

    // Conflict dan keyin davom etish
    alongCenter = maxConflictEnd + along / 2;
  }

  return null; // joy topilmadi
}

function placeFixtures(rooms: PlumbingRoom[], spec: PlumbingProjectSpec, floorHeight: number): PlumbingFixture[] {
  const fixtures: PlumbingFixture[] = [];

  for (const room of rooms) {
    const specRoom = spec.rooms.find(r => r.floor === room.floor && r.name === room.name);
    if (!specRoom) continue;

    const baseZ = (room.floor - 1) * floorHeight;

    // Har devor uchun cursor: 0.04 clearance dan boshlanadi
    const cursors: Record<WallSide, number> = { north: 0.04, south: 0.04, east: 0.04, west: 0.04 };
    // Bu xonada joylashtirilgan fixture BBoxlari
    const placed: BBox[] = [];

    for (const type of specRoom.fixtures) {
      const meta = FIXTURE_CATALOG[type];
      if (!meta) continue;

      const pref = preferredWall(type, room.type);
      // Afzal devordan boshlab, keyin qolganlarini sinab ko'r
      const wallOrder: WallSide[] = [pref, ...(['north','south','east','west'] as WallSide[]).filter(w => w !== pref)];

      let result: { pos: { x: number; y: number }; wall: WallSide } | null = null;

      for (const wall of wallOrder) {
        result = tryPlaceOnWall(room, meta.w, meta.d, wall, cursors, placed);
        if (result) break;
      }

      let cx: number, cy: number, usedWall: WallSide;

      if (result) {
        cx = result.pos.x;
        cy = result.pos.y;
        usedWall = result.wall;
      } else {
        // Xona juda kichik — majburan markazga
        cx = room.position.x + room.width / 2;
        cy = room.position.y + room.length / 2;
        usedWall = pref;
        placed.push(fixtureBBox(cx, cy, meta.w, meta.d, usedWall));
      }

      const rotation = (usedWall === 'east' || usedWall === 'west') ? 90 : 0;
      const pos: Vec3 = { x: cx, y: cy, z: baseZ };

      const fx: PlumbingFixture = {
        id: uid('fix'),
        type,
        nameUz: meta.nameUz,
        nameRu: meta.nameRu,
        position: pos,
        rotation,
        dimensions: { w: meta.w, d: meta.d, h: meta.h },
        floor: room.floor,
        roomId: room.id,
        coldIn:   meta.coldOffset  ? addVec3Rotated(pos, meta.coldOffset,  rotation) : null,
        hotIn:    meta.hotOffset   ? addVec3Rotated(pos, meta.hotOffset,   rotation) : null,
        drainOut: meta.drainOffset ? addVec3Rotated(pos, meta.drainOffset, rotation) : null,
        drainDiamMm: meta.drainDiamMm,
        branchDiamMm: meta.branchDiamMm,
        isManual: false,
      };

      fixtures.push(fx);
      room.fixtureIds.push(fx.id);
    }
  }

  return fixtures;
}

function addVec3(base: Vec3, offset: Vec3): Vec3 {
  return { x: base.x + offset.x, y: base.y + offset.y, z: base.z + offset.z };
}

// Offset vektorini rotation gradusga moslashtirish (faqat x/y, z o'zgarmaydi)
function rotateOffset(offset: Vec3, rotationDeg: number): Vec3 {
  switch (((rotationDeg % 360) + 360) % 360) {
    case 90:  return { x: -offset.y, y:  offset.x, z: offset.z };
    case 180: return { x: -offset.x, y: -offset.y, z: offset.z };
    case 270: return { x:  offset.y, y: -offset.x, z: offset.z };
    default:  return offset;
  }
}

export function addVec3Rotated(base: Vec3, offset: Vec3, rotationDeg: number): Vec3 {
  return addVec3(base, rotateOffset(offset, rotationDeg));
}

// ═══════════════════════════════════════════════════════════════════════════════
// RISER GENERATION (stoyaklar)
// ═══════════════════════════════════════════════════════════════════════════════

function generateRisers(rooms: PlumbingRoom[], fixtures: PlumbingFixture[], spec: PlumbingProjectSpec): PlumbingRiser[] {
  const risers: PlumbingRiser[] = [];
  const floorHeight = spec.floorHeight || 2.8;

  // Har bir "namliq guruhi" (bir ustun bo'ylab xonalar) uchun 3 stoyak: В1, Т3, К1
  // Guruhlash: X koordinatasi bo'yicha yaqin xonalar
  const wetRooms = rooms.filter(r => r.fixtureIds.length > 0);

  // Har qavat uchun xonalar — stoyak markazini topish
  const groups = clusterByX(wetRooms, spec.buildingWidth || 12);

  let riserIdx = 1;
  for (const group of groups) {
    const centerX = group.reduce((s, r) => s + r.position.x + r.width / 2, 0) / group.length;
    const centerY = 0.15; // devorga yaqin

    const allFloors = [...new Set(group.map(r => r.floor))].sort();
    const minFloor = Math.min(...allFloors);
    const maxFloor = Math.max(...allFloors);

    // Diameter hisoblash (qavat soniga qarab)
    const totalFixInGroup = group.reduce((s, r) => s + r.fixtureIds.length, 0);
    const mainDiam = totalFixInGroup <= 4 ? 25 : 32;

    // В1 — sovuq
    risers.push({
      id: uid('riser'),
      tag: `V1-${riserIdx}`,
      type: 'cold',
      diamMm: mainDiam,
      x: centerX - 0.12,
      y: centerY,
      fromFloor: 0,
      toFloor: spec.floorCount,
      segments: Array.from({ length: spec.floorCount }, (_, i) => ({
        fromFloor: i, toFloor: i + 1,
        diamMm: i < spec.floorCount - 2 ? mainDiam : 20,
        label: `V1-${riserIdx}`,
      })),
    });

    // Т3 — issiq
    risers.push({
      id: uid('riser'),
      tag: `T3-${riserIdx}`,
      type: 'hot',
      diamMm: mainDiam,
      x: centerX,
      y: centerY,
      fromFloor: 0,
      toFloor: spec.floorCount,
      segments: Array.from({ length: spec.floorCount }, (_, i) => ({
        fromFloor: i, toFloor: i + 1,
        diamMm: i < spec.floorCount - 2 ? mainDiam : 20,
        label: `T3-${riserIdx}`,
      })),
    });

    // К1 — kanalizatsiya
    risers.push({
      id: uid('riser'),
      tag: `K1-${riserIdx}`,
      type: 'drain',
      diamMm: 110,
      x: centerX + 0.12,
      y: centerY,
      fromFloor: 0,
      toFloor: spec.floorCount,
      segments: Array.from({ length: spec.floorCount }, (_, i) => ({
        fromFloor: i, toFloor: i + 1,
        diamMm: 110,
        label: `K1-${riserIdx}`,
      })),
    });

    riserIdx++;
  }

  return risers;
}

function clusterByX(rooms: PlumbingRoom[], buildingWidth: number): PlumbingRoom[][] {
  if (rooms.length === 0) return [];
  const threshold = buildingWidth / 3;
  const sorted = [...rooms].sort((a, b) => a.position.x - b.position.x);
  const groups: PlumbingRoom[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = groups[groups.length - 1];
    const lastX = last[last.length - 1].position.x;
    if (sorted[i].position.x - lastX < threshold) {
      last.push(sorted[i]);
    } else {
      groups.push([sorted[i]]);
    }
  }
  return groups;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIPE SEGMENT GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

function generatePipes(
  rooms: PlumbingRoom[],
  fixtures: PlumbingFixture[],
  risers: PlumbingRiser[],
  spec: PlumbingProjectSpec,
): PlumbingPipeSegment[] {
  const pipes: PlumbingPipeSegment[] = [];
  const floorH   = spec.floorHeight || 2.8;
  const WALL_M   = 0.125;  // devor qalinligi m
  const MAIN_Y   = WALL_M / 2; // shimoliy devorning o'rtasi (0.0625m)
  const C_OFF    = -0.025; // cold pipe X offset (parallel ajratish)
  const H_OFF    =  0.025; // hot  pipe X offset

  // ── Qavatlar bo'yicha qayta ishlash ────────────────────────────────────────
  const floors = [...new Set(fixtures.map(f => f.floor))].sort();

  for (const floor of floors) {
    const baseZ   = (floor - 1) * floorH;
    const mainZ   = baseZ + 0.30;   // magistral balandligi (poldan 30sm)
    const drainZ  = baseZ + 0.02;   // kanalizatsiya (poldan 2sm)

    const floorFix  = fixtures.filter(f => f.floor === floor);
    const floorRooms = rooms.filter(r => r.floor === floor);

    // Eng yaqin stoyaklarni topish (bu qavatga xizmat qiluvchi)
    const coldRiser  = risers.find(r => r.type === 'cold');
    const hotRiser   = risers.find(r => r.type === 'hot');
    const drainRiser = risers.find(r => r.type === 'drain');

    const allColdRisers  = risers.filter(r => r.type === 'cold');
    const allHotRisers   = risers.filter(r => r.type === 'hot');
    const allDrainRisers = risers.filter(r => r.type === 'drain');

    if (!allColdRisers.length && !allHotRisers.length && !allDrainRisers.length) continue;

    // Eng yaqin stoyakni topish (masofa bo'yicha)
    function nearestRiser<T extends { x: number; y: number }>(arr: T[], fx: number, fy: number): T | null {
      if (!arr.length) return null;
      return arr.reduce((best, r) => {
        const d = Math.hypot(r.x - fx, r.y - fy);
        const bd = Math.hypot(best.x - fx, best.y - fy);
        return d < bd ? r : best;
      });
    }

    // Har fixture uchun stoyak aniqlab shox chizish
    // Magistral: har stoyak uchun bitta — stoyak ga ulangan xonalar bo'ylab
    // Stoyak guruhlash: fixture → yaqin stoyak → shu stoyak xonalari

    // 1. Stoyak → fixture guruhi xaritalash
    const coldStoyakFixes = new Map<string, typeof floorFix>();
    const hotStoyakFixes  = new Map<string, typeof floorFix>();
    const drainStoyakFixes = new Map<string, typeof floorFix>();

    for (const fix of floorFix) {
      if (fix.coldIn) {
        const r = nearestRiser(allColdRisers, fix.position.x, fix.position.y);
        if (r) { if (!coldStoyakFixes.has(r.id)) coldStoyakFixes.set(r.id, []); coldStoyakFixes.get(r.id)!.push(fix); }
      }
      if (fix.hotIn) {
        const r = nearestRiser(allHotRisers, fix.position.x, fix.position.y);
        if (r) { if (!hotStoyakFixes.has(r.id)) hotStoyakFixes.set(r.id, []); hotStoyakFixes.get(r.id)!.push(fix); }
      }
      if (fix.drainOut) {
        const r = nearestRiser(allDrainRisers, fix.position.x, fix.position.y);
        if (r) { if (!drainStoyakFixes.has(r.id)) drainStoyakFixes.set(r.id, []); drainStoyakFixes.get(r.id)!.push(fix); }
      }
    }

    // 2. Har stoyak uchun magistral + shoxlar
    for (const [riserId, coldFixes] of coldStoyakFixes) {
      const cr = allColdRisers.find(r => r.id === riserId)!;
      // Bu stoyak xonalari
      const stoyakRooms = floorRooms.filter(room =>
        coldFixes.some(f => f.roomId === room.id));
      if (!stoyakRooms.length) continue;
      const minY = Math.min(...stoyakRooms.map(r => r.position.y));
      const maxX = Math.max(...stoyakRooms.map(r => r.position.x + r.width));
      const mainY = minY + MAIN_Y;

      if (Math.abs(cr.y - mainY) > 0.02) {
        pipes.push({ id: uid('pipe'), type: 'cold', material: 'ppr',
          diamMm: cr.diamMm,
          from: { x: cr.x + C_OFF, y: cr.y,    z: mainZ },
          to:   { x: cr.x + C_OFF, y: mainY,   z: mainZ },
          floor, isRiser: false, isMain: true });
      }
      const mX1 = cr.x + C_OFF, mX2 = maxX - WALL_M + C_OFF;
      if (mX2 > mX1 + 0.05) {
        pipes.push({ id: uid('pipe'), type: 'cold', material: 'ppr',
          diamMm: cr.diamMm,
          from: { x: mX1, y: mainY, z: mainZ },
          to:   { x: mX2, y: mainY, z: mainZ },
          floor, isRiser: false, isMain: true,
          label: `DN${cr.diamMm}` });
      }
      for (const fix of coldFixes) {
        if (!fix.coldIn) continue;
        const tx = fix.coldIn.x, ty = fix.coldIn.y;
        if (Math.abs(mainY - ty) > 0.02) {
          pipes.push({ id: uid('pipe'), type: 'cold', material: 'ppr',
            diamMm: fix.branchDiamMm,
            from: { x: tx, y: mainY, z: mainZ },
            to:   { x: tx, y: ty,    z: mainZ },
            floor, isRiser: false, isMain: false,
            label: `DN${fix.branchDiamMm}` });
        }
        if (Math.abs(fix.coldIn.z - mainZ) > 0.05) {
          pipes.push({ id: uid('pipe'), type: 'cold', material: 'ppr',
            diamMm: fix.branchDiamMm,
            from: { x: tx, y: ty, z: mainZ }, to: fix.coldIn,
            floor, isRiser: false, isMain: false });
        }
      }
    }

    for (const [riserId, hotFixes] of hotStoyakFixes) {
      const hr = allHotRisers.find(r => r.id === riserId)!;
      const stoyakRooms = floorRooms.filter(room =>
        hotFixes.some(f => f.roomId === room.id));
      if (!stoyakRooms.length) continue;
      const minY = Math.min(...stoyakRooms.map(r => r.position.y));
      const maxX = Math.max(...stoyakRooms.map(r => r.position.x + r.width));
      const mainY = minY + MAIN_Y;

      if (Math.abs(hr.y - mainY) > 0.02) {
        pipes.push({ id: uid('pipe'), type: 'hot', material: 'ppr',
          diamMm: hr.diamMm,
          from: { x: hr.x + H_OFF, y: hr.y,   z: mainZ },
          to:   { x: hr.x + H_OFF, y: mainY,  z: mainZ },
          floor, isRiser: false, isMain: true });
      }
      const mX1 = hr.x + H_OFF, mX2 = maxX - WALL_M + H_OFF;
      if (mX2 > mX1 + 0.05) {
        pipes.push({ id: uid('pipe'), type: 'hot', material: 'ppr',
          diamMm: hr.diamMm,
          from: { x: mX1, y: mainY, z: mainZ },
          to:   { x: mX2, y: mainY, z: mainZ },
          floor, isRiser: false, isMain: true,
          label: `DN${hr.diamMm}` });
      }
      for (const fix of hotFixes) {
        if (!fix.hotIn) continue;
        const tx = fix.hotIn.x, ty = fix.hotIn.y;
        if (Math.abs(mainY - ty) > 0.02) {
          pipes.push({ id: uid('pipe'), type: 'hot', material: 'ppr',
            diamMm: fix.branchDiamMm,
            from: { x: tx, y: mainY, z: mainZ },
            to:   { x: tx, y: ty,    z: mainZ },
            floor, isRiser: false, isMain: false,
            label: `DN${fix.branchDiamMm}` });
        }
        if (Math.abs(fix.hotIn.z - mainZ) > 0.05) {
          pipes.push({ id: uid('pipe'), type: 'hot', material: 'ppr',
            diamMm: fix.branchDiamMm,
            from: { x: tx, y: ty, z: mainZ }, to: fix.hotIn,
            floor, isRiser: false, isMain: false });
        }
      }
    }

    for (const [riserId, drainFixes] of drainStoyakFixes) {
      const dr = allDrainRisers.find(r => r.id === riserId)!;
      const stoyakRooms = floorRooms.filter(room =>
        drainFixes.some(f => f.roomId === room.id));
      if (!stoyakRooms.length) continue;
      const maxY = Math.max(...stoyakRooms.map(r => r.position.y + r.length));
      const drainY = maxY - MAIN_Y;
      const allDX = drainFixes.map(f => f.drainOut!.x);
      const dX1 = Math.min(...allDX, dr.x), dX2 = Math.max(...allDX, dr.x);
      if (dX2 > dX1 + 0.05) {
        pipes.push({ id: uid('pipe'), type: 'drain', material: 'pvc',
          diamMm: 110,
          from: { x: dX1, y: drainY, z: drainZ },
          to:   { x: dX2, y: drainY, z: drainZ },
          floor, isRiser: false, isMain: true,
          label: 'DN110', slope: 2 });
      }
      if (Math.abs(dr.y - drainY) > 0.02) {
        pipes.push({ id: uid('pipe'), type: 'drain', material: 'pvc',
          diamMm: 110,
          from: { x: dr.x, y: drainY,  z: drainZ },
          to:   { x: dr.x, y: dr.y,    z: drainZ },
          floor, isRiser: false, isMain: true, slope: 2 });
      }
      for (const fix of drainFixes) {
        if (!fix.drainOut) continue;
        const tx = fix.drainOut.x, ty = fix.drainOut.y;
        if (Math.abs(ty - drainY) > 0.02) {
          pipes.push({ id: uid('pipe'), type: 'drain', material: 'pvc',
            diamMm: fix.drainDiamMm,
            from: { x: tx, y: ty,     z: drainZ },
            to:   { x: tx, y: drainY, z: drainZ },
            floor, isRiser: false, isMain: false,
            label: `DN${fix.drainDiamMm}`, slope: 3 });
        }
      }
    }
  }

  // ── Stoyaklarni vertikal segment sifatida qo'shish ─────────────────────────
  for (const riser of risers) {
    for (const seg of riser.segments) {
      const fromZ = seg.fromFloor * (spec.floorHeight || 2.8);
      const toZ   = seg.toFloor   * (spec.floorHeight || 2.8);
      pipes.push({
        id: uid('pipe'),
        type: riser.type, material: riser.type === 'drain' ? 'pvc' : 'ppr',
        diamMm: seg.diamMm,
        from: { x: riser.x, y: riser.y, z: fromZ },
        to:   { x: riser.x, y: riser.y, z: toZ },
        floor: seg.fromFloor + 1, isRiser: true, isMain: false,
        label: seg.label,
      });
    }
  }

  return pipes;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPENING GENERATION (eshiklar va derazalar)
// ═══════════════════════════════════════════════════════════════════════════════

function generateOpenings(rooms: PlumbingRoom[]): PlumbingOpening[] {
  const openings: PlumbingOpening[] = [];
  // Qaysi devorda qo'shni xona bor? — eshiklar qo'shni xonalar orasida
  // Tashqi devorda ham bitta eshik bo'lishi kerak

  // Har xona uchun minimal bitta eshik
  for (const room of rooms) {
    const roomOpenings = openings.filter(o => o.roomId === room.id);
    if (roomOpenings.length > 0) continue; // allaqachon eshigi bor

    // Afzal devor: shimoliy yoki g'arbiy (xona kirishiga mos)
    // Qo'shni xona bor devoriga eshik qo'yish
    const neighborSide = findNeighborSide(room, rooms);
    const doorSide = neighborSide ?? 'north';

    const wallLen = (doorSide === 'north' || doorSide === 'south') ? room.width : room.length;
    const doorW = Math.min(0.90, wallLen * 0.35); // 90sm yoki devor 35%
    const doorOffset = Math.max(0.15, (wallLen - doorW) / 2); // markazga yaqin

    openings.push({
      id: uid('op'),
      roomId: room.id,
      side: doorSide,
      offset: doorOffset,
      width: doorW,
      type: 'door',
      swingIn: true,
    });
  }

  return openings;
}

// Qo'shni xona bor devoini topish
function findNeighborSide(room: PlumbingRoom, allRooms: PlumbingRoom[]): WallSide | null {
  const rx1 = room.position.x, ry1 = room.position.y;
  const rx2 = rx1 + room.width,  ry2 = ry1 + room.length;
  const TOL = 0.15; // tolerans (m)

  for (const other of allRooms) {
    if (other.id === room.id || other.floor !== room.floor) continue;
    const ox1 = other.position.x, oy1 = other.position.y;
    const ox2 = ox1 + other.width, oy2 = oy1 + other.length;

    // Shimoliy devor — other xona janubida ulashgan
    if (Math.abs(ry1 - oy2) < TOL && ox1 < rx2 - TOL && ox2 > rx1 + TOL) return 'north';
    // Janubiy devor — other xona shimolida
    if (Math.abs(ry2 - oy1) < TOL && ox1 < rx2 - TOL && ox2 > rx1 + TOL) return 'south';
    // G'arbiy devor — other xona sharqida
    if (Math.abs(rx1 - ox2) < TOL && oy1 < ry2 - TOL && oy2 > ry1 + TOL) return 'west';
    // Sharqiy devor — other xona g'arbida
    if (Math.abs(rx2 - ox1) < TOL && oy1 < ry2 - TOL && oy2 > ry1 + TOL) return 'east';
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EQUIPMENT GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

function generateEquipment(spec: PlumbingProjectSpec, fixtures: PlumbingFixture[]): PlumbingEquipment[] {
  const eq: PlumbingEquipment[] = [];
  const totalHotFix = fixtures.filter(f => f.hotIn !== null).length;

  // Suv o'lchagich (kirish)
  eq.push({
    id: uid('eq'),
    type: 'water_meter',
    nameUz: 'Suv o\'lchagich',
    model: 'ВСГд-20',
    position: { x: 0.50, y: 0.20, z: 0.50 },
    floor: 1,
    inputDiamMm: 25,
    outputDiamMm: 25,
  });

  // Bosim filtri
  eq.push({
    id: uid('eq'),
    type: 'filter',
    nameUz: 'Bosim filtri',
    model: 'F-20',
    position: { x: 0.80, y: 0.20, z: 0.50 },
    floor: 1,
    inputDiamMm: 25,
    outputDiamMm: 25,
  });

  // Issiq suv isitgich (agar issiq suv kerak bo'lsa)
  if (totalHotFix > 0) {
    const volL = totalHotFix <= 4 ? 80 : totalHotFix <= 8 ? 150 : totalHotFix <= 14 ? 300 : 500;
    eq.push({
      id: uid('eq'),
      type: 'boiler',
      nameUz: `Suv isitgich ${volL}L`,
      model: `Ariston PRO1 R ${volL} V`,
      position: { x: 1.20, y: 0.20, z: 0.30 },
      floor: 1,
      inputDiamMm: 20,
      outputDiamMm: 20,
    });
  }

  // Sirkul nasos (agar ko'p qavatli)
  if (spec.floorCount >= 3) {
    eq.push({
      id: uid('eq'),
      type: 'pump_circ',
      nameUz: 'Sirkul nasos',
      model: 'Grundfos UP 20-14',
      position: { x: 1.60, y: 0.20, z: 0.50 },
      floor: 1,
      inputDiamMm: 20,
      outputDiamMm: 20,
    });
  }

  return eq;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

function calcStats(fixtures: PlumbingFixture[], pipes: PlumbingPipeSegment[], risers: PlumbingRiser[], equipment: PlumbingEquipment[]): PlumbingProject['stats'] {
  const pipeLength = (p: PlumbingPipeSegment) => {
    const dx = p.to.x - p.from.x;
    const dy = p.to.y - p.from.y;
    const dz = p.to.z - p.from.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  const coldM  = pipes.filter(p => p.type === 'cold').reduce((s, p) => s + pipeLength(p), 0);
  const hotM   = pipes.filter(p => p.type === 'hot').reduce((s, p) => s + pipeLength(p), 0);
  const drainM = pipes.filter(p => p.type === 'drain').reduce((s, p) => s + pipeLength(p), 0);

  const boiler = equipment.find(e => e.type === 'boiler');
  const boilerVolL = boiler ? parseInt(boiler.nameUz.match(/\d+/)?.[0] ?? '80') : 0;

  const hotRisers  = risers.filter(r => r.type === 'hot');
  const coldRisers = risers.filter(r => r.type === 'cold');

  return {
    totalFixtures: fixtures.length,
    totalPipeM: Math.round((coldM + hotM + drainM) * 10) / 10,
    coldPipeM:  Math.round(coldM  * 10) / 10,
    hotPipeM:   Math.round(hotM   * 10) / 10,
    drainPipeM: Math.round(drainM * 10) / 10,
    totalRisers: risers.filter(r => r.type !== 'circ').length,
    boilerVolL,
    mainColdDiamMm: coldRisers[0]?.diamMm ?? 25,
    mainHotDiamMm:  hotRisers[0]?.diamMm  ?? 25,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class PlumbingProjectEngine {
  generate(spec: PlumbingProjectSpec, existingId?: string): PlumbingProject {
    idCounter = 0; // reset counter har generate uchun

    const floorHeight = spec.floorHeight || 2.8;
    const buildingW   = spec.buildingWidth  || 10;
    const buildingL   = spec.buildingLength || 12;

    const rooms     = layoutRooms(spec);
    const fixtures  = placeFixtures(rooms, spec, floorHeight);
    const risers    = generateRisers(rooms, fixtures, spec);
    const pipes     = generatePipes(rooms, fixtures, risers, spec);
    const equipment = generateEquipment(spec, fixtures);
    const openings  = generateOpenings(rooms);
    const stats     = calcStats(fixtures, pipes, risers, equipment);

    const now = new Date().toISOString();

    return {
      id: existingId || `plumbing-${Date.now()}`,
      name: `Santexnika loyihasi`,
      description: '',
      createdAt: now,
      updatedAt: now,
      floorCount: spec.floorCount,
      floorHeight,
      buildingWidth: buildingW,
      buildingLength: buildingL,
      rooms,
      fixtures,
      pipes,
      risers,
      equipment,
      openings,
      activeView: 'top',
      activeFloor: 1,
      layers: [
        { id: 'cold',       visible: true, color: '#1d6db5' },
        { id: 'hot',        visible: true, color: '#c0392b' },
        { id: 'circ',       visible: true, color: '#d97706' },
        { id: 'drain',      visible: true, color: '#92400e' },
        { id: 'fixtures',   visible: true, color: '#374151' },
        { id: 'rooms',      visible: true, color: '#6b7280' },
        { id: 'dimensions', visible: true, color: '#1e293b' },
      ],
      stats,
      notes: spec.notes ? [spec.notes] : [],
    };
  }

  // Qo'lda element qo'shish
  addFixture(project: PlumbingProject, roomId: string, type: FixtureType, position?: Vec3): PlumbingProject {
    const room = project.rooms.find(r => r.id === roomId);
    if (!room) return project;

    const meta = FIXTURE_CATALOG[type];
    const baseZ = (room.floor - 1) * project.floorHeight;
    const pos = position ?? {
      x: room.position.x + 0.30,
      y: room.position.y + meta.d / 2 + 0.05,
      z: baseZ,
    };

    const fix: PlumbingFixture = {
      id: uid('fix'),
      type, nameUz: meta.nameUz, nameRu: meta.nameRu,
      position: pos,
      rotation: 0,
      dimensions: { w: meta.w, d: meta.d, h: meta.h },
      floor: room.floor,
      roomId,
      coldIn:   meta.coldOffset  ? addVec3Rotated(pos, meta.coldOffset,  0) : null,
      hotIn:    meta.hotOffset   ? addVec3Rotated(pos, meta.hotOffset,   0) : null,
      drainOut: meta.drainOffset ? addVec3Rotated(pos, meta.drainOffset, 0) : null,
      drainDiamMm: meta.drainDiamMm,
      branchDiamMm: meta.branchDiamMm,
      isManual: true,
    };

    room.fixtureIds.push(fix.id);

    const updatedFixtures = [...project.fixtures, fix];
    const updatedPipes = generatePipes(project.rooms, updatedFixtures, project.risers, {
      floorCount: project.floorCount,
      floorHeight: project.floorHeight,
      buildingWidth: project.buildingWidth,
      buildingLength: project.buildingLength,
      rooms: [],
    });

    return {
      ...project,
      fixtures: updatedFixtures,
      pipes: updatedPipes,
      stats: calcStats(updatedFixtures, updatedPipes, project.risers, project.equipment),
      updatedAt: new Date().toISOString(),
    };
  }

  // Element o'chirish
  removeFixture(project: PlumbingProject, fixtureId: string): PlumbingProject {
    const updatedFixtures = project.fixtures.filter(f => f.id !== fixtureId);
    for (const room of project.rooms) {
      room.fixtureIds = room.fixtureIds.filter(id => id !== fixtureId);
    }
    const updatedPipes = project.pipes.filter(p => {
      // Bu fixture ga tegishli pipe'larni olib tashlash (soda yondashuv)
      return !p.id.includes(fixtureId);
    });
    return {
      ...project,
      fixtures: updatedFixtures,
      pipes: updatedPipes,
      stats: calcStats(updatedFixtures, updatedPipes, project.risers, project.equipment),
      updatedAt: new Date().toISOString(),
    };
  }

  // Element ko'chirish
  moveFixture(project: PlumbingProject, fixtureId: string, newPosition: Vec3): PlumbingProject {
    const updatedFixtures = project.fixtures.map(f => {
      if (f.id !== fixtureId) return f;
      const meta = FIXTURE_CATALOG[f.type];
      return {
        ...f,
        position: newPosition,
        coldIn:   meta.coldOffset  ? addVec3Rotated(newPosition, meta.coldOffset,  f.rotation) : null,
        hotIn:    meta.hotOffset   ? addVec3Rotated(newPosition, meta.hotOffset,   f.rotation) : null,
        drainOut: meta.drainOffset ? addVec3Rotated(newPosition, meta.drainOffset, f.rotation) : null,
        isManual: true,
      };
    });

    const updatedPipes = generatePipes(project.rooms, updatedFixtures, project.risers, {
      floorCount: project.floorCount,
      floorHeight: project.floorHeight,
      buildingWidth: project.buildingWidth,
      buildingLength: project.buildingLength,
      rooms: [],
    });

    return {
      ...project,
      fixtures: updatedFixtures,
      pipes: updatedPipes,
      stats: calcStats(updatedFixtures, updatedPipes, project.risers, project.equipment),
      updatedAt: new Date().toISOString(),
    };
  }
}

export { FIXTURE_CATALOG };
