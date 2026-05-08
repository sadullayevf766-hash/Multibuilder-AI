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
// FIXTURE PLACEMENT
// ═══════════════════════════════════════════════════════════════════════════════

let idCounter = 0;
function uid(prefix: string) { return `${prefix}-${++idCounter}`; }

// Professional joylashuv strategiyasi:
// - Hammom: unitaz shimoliy devorda, lavabo sharqiy devorda, vanna/dush g'arbiy devorda
// - Oshxona: lavabo/texnika shimoliy devorda
// - Kir yuvish: mashina g'arbiy devorda
type WallSide = 'north' | 'south' | 'east' | 'west';

interface PlacedFixture {
  type: FixtureType;
  wall: WallSide;
  wallOffset: number; // devordan bo'ylab ofset (m)
}

// Xona turiga qarab professional tartib
function getFixturePlacements(fixtures: FixtureType[], roomType: string): PlacedFixture[] {
  const plans: PlacedFixture[] = [];

  if (roomType === 'bathroom' || roomType === 'toilet') {
    // Standart hammom joylashuvi
    const wallOffsets: Record<WallSide, number> = { north: 0.15, south: 0.15, east: 0.15, west: 0.15 };
    for (const type of fixtures) {
      let wall: WallSide = 'north';
      if (type === 'toilet')   wall = 'north';
      else if (type === 'sink' || type === 'bidet') wall = 'east';
      else if (type === 'bathtub') wall = 'west';
      else if (type === 'shower') wall = 'east';
      else if (type === 'towel_rail') wall = 'south';
      else if (type === 'floor_drain') wall = 'west';

      plans.push({ type, wall, wallOffset: wallOffsets[wall] });
      wallOffsets[wall] += (FIXTURE_CATALOG[type]?.w ?? 0.5) + 0.08;
    }
  } else if (roomType === 'kitchen') {
    const wallOffsets: Record<WallSide, number> = { north: 0.15, south: 0.15, east: 0.15, west: 0.15 };
    for (const type of fixtures) {
      let wall: WallSide = 'north';
      if (type === 'kitchen_sink') wall = 'north';
      else if (type === 'dishwasher') wall = 'north';
      else wall = 'west';
      plans.push({ type, wall, wallOffset: wallOffsets[wall] });
      wallOffsets[wall] += (FIXTURE_CATALOG[type]?.w ?? 0.6) + 0.08;
    }
  } else if (roomType === 'laundry') {
    const wallOffsets: Record<WallSide, number> = { north: 0.15, south: 0.15, east: 0.15, west: 0.15 };
    for (const type of fixtures) {
      let wall: WallSide = 'west';
      if (type === 'sink') wall = 'north';
      plans.push({ type, wall, wallOffset: wallOffsets[wall] });
      wallOffsets[wall] += (FIXTURE_CATALOG[type]?.w ?? 0.6) + 0.08;
    }
  } else {
    // Fallback: hammasi shimoliy devorda
    let off = 0.15;
    for (const type of fixtures) {
      plans.push({ type, wall: 'north', wallOffset: off });
      off += (FIXTURE_CATALOG[type]?.w ?? 0.5) + 0.08;
    }
  }

  return plans;
}

// Devor bo'yicha koordinat hisoblash
function wallPosition(room: PlumbingRoom, wall: WallSide, wallOffset: number, meta: { w: number; d: number }): Vec3 {
  const { x: rx, y: ry } = room.position;
  // GAP: devordan ichkariga masofa — fixture d/2 dan katta bo'lishi shart
  // Aks holda fixture devordan chiqib ketadi
  const WALL_THICKNESS = 0.12; // 120mm devor qalinligi
  const CLEARANCE = 0.05;      // qo'shimcha bo'shliq

  switch (wall) {
    case 'north': { // Y pastida, fixture devor ichkarisida
      const gap = meta.d / 2 + WALL_THICKNESS + CLEARANCE;
      const fx = Math.min(rx + wallOffset + meta.w / 2, rx + room.width - meta.w / 2 - 0.05);
      const fy = ry + gap;
      return { x: fx, y: fy, z: 0 };
    }
    case 'south': { // Y yuqorida
      const gap = meta.d / 2 + WALL_THICKNESS + CLEARANCE;
      const fx = Math.min(rx + wallOffset + meta.w / 2, rx + room.width - meta.w / 2 - 0.05);
      return { x: fx, y: ry + room.length - gap, z: 0 };
    }
    case 'west': { // X chapida
      const gap = meta.d / 2 + WALL_THICKNESS + CLEARANCE;
      const fy = Math.min(ry + wallOffset + meta.w / 2, ry + room.length - meta.w / 2 - 0.05);
      return { x: rx + gap, y: fy, z: 0 };
    }
    case 'east': { // X o'ngida
      const gap = meta.d / 2 + WALL_THICKNESS + CLEARANCE;
      const fy = Math.min(ry + wallOffset + meta.w / 2, ry + room.length - meta.w / 2 - 0.05);
      return { x: rx + room.width - gap, y: fy, z: 0 };
    }
  }
}

function placeFixtures(rooms: PlumbingRoom[], spec: PlumbingProjectSpec, floorHeight: number): PlumbingFixture[] {
  const fixtures: PlumbingFixture[] = [];

  for (const room of rooms) {
    const specRoom = spec.rooms.find(r => r.floor === room.floor && r.name === room.name);
    if (!specRoom) continue;

    const baseZ = (room.floor - 1) * floorHeight;
    const placements = getFixturePlacements(specRoom.fixtures, room.type);

    for (const placement of placements) {
      const meta = FIXTURE_CATALOG[placement.type];
      if (!meta) continue;

      // Devor bo'yicha pozitsiya
      let pos = wallPosition(room, placement.wall, placement.wallOffset, meta);
      pos = { ...pos, z: baseZ };

      // Xona chegarasidan chiqmasligi tekshiruvi
      pos.x = Math.max(room.position.x + 0.08, Math.min(room.position.x + room.width - 0.08, pos.x));
      pos.y = Math.max(room.position.y + 0.08, Math.min(room.position.y + room.length - 0.08, pos.y));

      const fx: PlumbingFixture = {
        id: uid('fix'),
        type: placement.type,
        nameUz: meta.nameUz,
        nameRu: meta.nameRu,
        position: pos,
        rotation: placement.wall === 'west' || placement.wall === 'east' ? 90 : 0,
        dimensions: { w: meta.w, d: meta.d, h: meta.h },
        floor: room.floor,
        roomId: room.id,
        coldIn:   meta.coldOffset  ? addVec3(pos, meta.coldOffset)  : null,
        hotIn:    meta.hotOffset   ? addVec3(pos, meta.hotOffset)   : null,
        drainOut: meta.drainOffset ? addVec3(pos, meta.drainOffset) : null,
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
      tag: `В1-${riserIdx}`,
      type: 'cold',
      diamMm: mainDiam,
      x: centerX - 0.12,
      y: centerY,
      fromFloor: 0,
      toFloor: spec.floorCount,
      segments: Array.from({ length: spec.floorCount }, (_, i) => ({
        fromFloor: i, toFloor: i + 1,
        diamMm: i < spec.floorCount - 2 ? mainDiam : 20,
        label: `В1-${riserIdx}-ø${i < spec.floorCount - 2 ? mainDiam : 20}`,
      })),
    });

    // Т3 — issiq
    risers.push({
      id: uid('riser'),
      tag: `Т3-${riserIdx}`,
      type: 'hot',
      diamMm: mainDiam,
      x: centerX,
      y: centerY,
      fromFloor: 0,
      toFloor: spec.floorCount,
      segments: Array.from({ length: spec.floorCount }, (_, i) => ({
        fromFloor: i, toFloor: i + 1,
        diamMm: i < spec.floorCount - 2 ? mainDiam : 20,
        label: `Т3-${riserIdx}-ø${i < spec.floorCount - 2 ? mainDiam : 20}`,
      })),
    });

    // К1 — kanalizatsiya
    risers.push({
      id: uid('riser'),
      tag: `К1-${riserIdx}`,
      type: 'drain',
      diamMm: 110,
      x: centerX + 0.12,
      y: centerY,
      fromFloor: 0,
      toFloor: spec.floorCount,
      segments: Array.from({ length: spec.floorCount }, (_, i) => ({
        fromFloor: i, toFloor: i + 1,
        diamMm: 110,
        label: `К1-${riserIdx}-ø110`,
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
  const floorH = spec.floorHeight || 2.8;

  // Har bir fixture uchun stoyakka ulash
  for (const fix of fixtures) {
    const riserGroup = risers.filter(r => {
      // Eng yaqin stoyakni topish
      const dx = r.x - fix.position.x;
      const dy = r.y - fix.position.y;
      return Math.sqrt(dx * dx + dy * dy) < (spec.buildingWidth || 12);
    });

    const coldRiser = riserGroup.find(r => r.type === 'cold');
    const hotRiser  = riserGroup.find(r => r.type === 'hot');
    const drainRiser = riserGroup.find(r => r.type === 'drain');

    const baseZ = (fix.floor - 1) * floorH;
    const branchZ = baseZ + 0.30; // poldan 30cm yukori branch

    // Sovuq suv branch
    if (fix.coldIn && coldRiser) {
      // Vertikal pastga (stoyakdan)
      pipes.push({
        id: uid('pipe'),
        type: 'cold', material: 'ppr',
        diamMm: fix.branchDiamMm,
        from: { x: coldRiser.x, y: coldRiser.y, z: branchZ },
        to:   { x: fix.coldIn.x, y: fix.coldIn.y, z: branchZ },
        floor: fix.floor, isRiser: false, isMain: false,
        label: `В1 ø${fix.branchDiamMm}`,
      });
      // Vertikal ko'tarilish fixturegacha
      if (Math.abs(fix.coldIn.z - branchZ) > 0.05) {
        pipes.push({
          id: uid('pipe'),
          type: 'cold', material: 'ppr',
          diamMm: fix.branchDiamMm,
          from: { x: fix.coldIn.x, y: fix.coldIn.y, z: branchZ },
          to:   fix.coldIn,
          floor: fix.floor, isRiser: false, isMain: false,
        });
      }
    }

    // Issiq suv branch
    if (fix.hotIn && hotRiser) {
      pipes.push({
        id: uid('pipe'),
        type: 'hot', material: 'ppr',
        diamMm: fix.branchDiamMm,
        from: { x: hotRiser.x, y: hotRiser.y, z: branchZ },
        to:   { x: fix.hotIn.x, y: fix.hotIn.y, z: branchZ },
        floor: fix.floor, isRiser: false, isMain: false,
        label: `Т3 ø${fix.branchDiamMm}`,
      });
      if (Math.abs(fix.hotIn.z - branchZ) > 0.05) {
        pipes.push({
          id: uid('pipe'),
          type: 'hot', material: 'ppr',
          diamMm: fix.branchDiamMm,
          from: { x: fix.hotIn.x, y: fix.hotIn.y, z: branchZ },
          to:   fix.hotIn,
          floor: fix.floor, isRiser: false, isMain: false,
        });
      }
    }

    // Kanalizatsiya branch
    if (fix.drainOut && drainRiser) {
      const drainZ = baseZ + 0.02; // poldan 2cm — kanalizatsiya pol darajasida
      pipes.push({
        id: uid('pipe'),
        type: 'drain', material: 'pvc',
        diamMm: fix.drainDiamMm,
        from: fix.drainOut,
        to:   { x: drainRiser.x, y: drainRiser.y, z: drainZ },
        floor: fix.floor, isRiser: false, isMain: false,
        label: `К1 ø${fix.drainDiamMm}`,
        slope: fix.drainDiamMm === 110 ? 2 : 3,
      });
    }
  }

  // Stoyaklarni vertikal segment sifatida qo'shish
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
      coldIn:   meta.coldOffset  ? addVec3(pos, meta.coldOffset)  : null,
      hotIn:    meta.hotOffset   ? addVec3(pos, meta.hotOffset)   : null,
      drainOut: meta.drainOffset ? addVec3(pos, meta.drainOffset) : null,
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
        coldIn:   meta.coldOffset  ? addVec3(newPosition, meta.coldOffset)  : null,
        hotIn:    meta.hotOffset   ? addVec3(newPosition, meta.hotOffset)   : null,
        drainOut: meta.drainOffset ? addVec3(newPosition, meta.drainOffset) : null,
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
