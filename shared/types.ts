// Shared types for FloorPlan Generator

export type WallSide = 'north' | 'south' | 'east' | 'west';
export type FixtureType = 'door' | 'window' | 'sink' | 'toilet' | 'shower' | 'bathtub' | 'stove' | 'fridge' | 'dishwasher' | 'desk' | 'bed' | 'wardrobe' | 'sofa' | 'tv_unit' | 'bookshelf' | 'armchair' | 'coffee_table' | 'dining_table' | 'chair' | 'coat_rack';
export type PipeType = 'cold' | 'hot' | 'drain';

export interface Point {
  x: number;
  y: number;
}

export interface RoomSpec {
  id: string;
  name: string;
  width: number;  // meters
  length: number; // meters
  fixtures: FixtureSpec[];
  doors: DoorSpec[];
  windows: WindowSpec[];
}

export interface FixtureSpec {
  id: string;
  type: FixtureType;
  wall?: WallSide;
  offsetFromCorner?: number;  // meters from wall's left corner
  needsWater?: boolean;
  needsDrain?: boolean;
  clearanceNeeded?: number;   // meters of clear space in front
  priority?: 'essential' | 'recommended' | 'optional';
  count?: number;
}

export interface DoorSpec {
  id: string;
  wall: WallSide;
  wallId?: string;           // specific wall id for multi-room
  width?: number;            // meters, default 0.9
  offsetFromCorner?: number; // meters from wall's west/north corner; omit = centered
  hinge?: 'left' | 'right';  // hinge side as seen from inside room; default 'left'
}

export interface WindowSpec {
  id: string;
  wall: WallSide;
  wallId?: string;           // specific wall id for multi-room
  width?: number;            // meters
  offsetFromCorner?: number; // meters from wall's west/north corner; omit = auto-spaced
}

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
  side: WallSide;
}

export interface PlacedFixture {
  id: string;
  type: FixtureType;
  position: Point;
  wall: WallSide;
}

export interface Pipe {
  id: string;
  type: PipeType;
  path: Point[];
  color: string;
  fixtureId: string;
}

export interface DimensionLine {
  id: string;
  start: Point;
  end: Point;
  value: number; // meters
  label: string;
}

export type DrawingType = 'floor-plan' | 'plumbing-axonometric' | 'electrical-floor-plan';

// ── Electrical types ──────────────────────────────────────────────────────────

export type ElectricalSymbolType =
  | 'socket'           // standart rozетка
  | 'socket_double'    // juft rozетка
  | 'socket_waterproof'// suv o'tkazmaydigan
  | 'socket_tv'        // TV/antenna rozеtkasi
  | 'light_ceiling'    // shiftdagi chiroq
  | 'light_waterproof' // germetik chiroq (hammom)
  | 'switch'           // bitta kalit
  | 'switch_double'    // juft kalit
  | 'panel'            // elektrik щit
  | 'fan_exhaust';     // vентиляtsiya

export interface ElectricalSymbol {
  id: string;
  type: ElectricalSymbolType;
  position: Point;     // xona koordinatalarida (mm)
  wall?: WallSide;     // qaysi devorda (rozetka/kalit uchun)
  circuit: string;     // qaysi guruhga tegishli
  label?: string;
}

export interface ElectricalCircuit {
  id: string;
  name: string;                          // "Yoritish 1", "Rozetka 1"
  type: 'lighting' | 'socket' | 'specialized';
  breaker: number;                        // Amper: 6, 10, 16, 20, 25
  cable: string;                          // "3×1.5", "3×2.5", "3×4"
  power: number;                          // Vatt
  symbolIds: string[];
  hasRcd?: boolean;                       // УЗО kerakmi
}

export interface ElectricalPanel {
  position: Point;
  mainBreaker: number;                   // Umumiy avtomat (A)
  rcdAmps: number;                       // Umumiy УЗО (A)
  circuits: ElectricalCircuit[];
  totalLoad: number;                     // kVt
}

export interface ElectricalDrawingData {
  id: string;
  drawingType: 'electrical-floor-plan';
  walls: Wall[];
  doors: DoorSpec[];
  windows?: WindowSpec[];
  dimensions: DimensionLine[];
  symbols: ElectricalSymbol[];
  panel: ElectricalPanel;
  roomName?: string;
}

export type PlumbingFixtureType = 'sink' | 'toilet' | 'bathtub' | 'shower' | 'washing_machine';

export interface PlumbingFixture {
  id: string;
  type: PlumbingFixtureType;
  floor: number;
  position: Point;
}

export interface PlumbingPipe {
  id: string;
  type: PipeType;
  path: Point[];
  diameter: number;
  label: string;
}

export interface PlumbingSchema {
  id: string;
  floorCount: number;
  fixtures: PlumbingFixture[];
  pipes: PlumbingPipe[];
  risers: PlumbingPipe[];
}

export interface DrawingData {
  id: string;
  walls: Wall[];
  fixtures: PlacedFixture[];
  pipes: Pipe[];
  dimensions: DimensionLine[];
  doors: DoorSpec[];
  windows?: WindowSpec[];
  drawingType?: DrawingType;
  plumbingSchema?: PlumbingSchema;
  roomName?: string;    // single-room label uchun
  // Multi-floor metadata (Canvas2D da ko'rsatish uchun)
  floorNumber?: number;   // 1, 2, 3...
  floorLabel?: string;    // "1-qavat"
  elevation?: number;     // 0.0, 3.0, 6.0...
  staircaseSpec?: StaircaseSpec; // zinapoya (agar shu qavatda bo'lsa)
  interRoomDoors?: InterRoomDoor[]; // xonalararo ichki eshiklar
}

// Xonalararo ichki eshik (shared wall da ochiladi)
export interface InterRoomDoor {
  id: string;
  wallId: string;           // shared wall id
  offsetFromCorner: number; // metr
  width: number;            // 0.9m
  fromRoomId: string;
  toRoomId: string;
}

// ── Architecture drawing types (GOST 21.501) ──────────────────────────────────

export interface ArchOpening {
  id: string;
  type: 'door' | 'window';
  xOffset: number;    // meters from left corner of this wall
  width: number;      // meters
  height: number;     // meters
  sillHeight: number; // meters from floor (0 for doors)
}

export interface ElevationData {
  id: string;
  side: WallSide;
  label: string;       // "1-fasad", "2-fasad"
  wallWidth: number;   // meters — horizontal span of this elevation
  floorHeight: number; // meters — ceiling height
  openings: ArchOpening[];
}

export interface SectionRoom {
  id: string;
  name: string;
  xOffset: number; // meters from left
  width: number;   // meters
}

export interface SectionData {
  id: string;
  label: string;       // "1-1 kesim"
  totalWidth: number;  // meters
  floorHeight: number; // meters
  rooms: SectionRoom[];
  openings: ArchOpening[]; // openings in cut plane
}

export interface ArchDrawingData {
  id: string;
  drawingType: 'architecture';
  elevations: ElevationData[];
  section: SectionData;
  roomName?: string;
}

// ── Room connection — ichki eshik (2 xona o'rtasida) ─────────────────────────

export interface RoomConnection {
  fromRoomId: string;
  toRoomId: string;
  wall: WallSide;          // from-room ning devori
  offsetFromCorner: number; // metr — eshik joyi
  width: number;            // eshik eni (0.9m)
  /** @deprecated use offsetFromCorner */ offset?: number;
}

export interface RoomLayout {
  id: string;
  roomSpec: RoomSpec;
  position: { x: number; y: number }; // metr, qavat NW burchagidan
  connections: RoomConnection[];
}

// ── Single-floor plan (legacy — still used for single-floor API) ──────────────

export interface FloorPlan {
  id: string;
  name: string;
  totalArea: number;
  rooms: RoomLayout[];
  buildingDimensions: { width: number; length: number };
}

// ── Multi-floor Building ───────────────────────────────────────────────────────

export interface StaircaseSpec {
  position: { x: number; y: number }; // metr, qavat NW burchagidan
  width: number;   // metr (default 1.2)
  length: number;  // metr (default 2.4)
  flightCount: number; // qavatlar soni
}

export interface BuildingFloor {
  floorNumber: number;       // 1-based (1, 2, 3...)
  label: string;             // "1-qavat", "Podval", "Cherdak"
  elevation: number;         // metr, yerdan balandligi (0, 3.0, 6.0...)
  rooms: RoomLayout[];
  drawingData?: DrawingData; // engine tomonidan to'ldiriladi
}

export interface Building {
  id: string;
  name: string;
  floors: BuildingFloor[];
  footprint: { width: number; length: number }; // metr, har qavatda bir xil
  staircaseSpec?: StaircaseSpec;
  totalArea?: number;
}

// ── Interior Design / Decor types ─────────────────────────────────────────────

export type FurnitureType =
  | 'sofa' | 'armchair' | 'coffee_table' | 'tv_stand' | 'bookshelf'
  | 'dining_table' | 'dining_chair' | 'kitchen_counter' | 'refrigerator' | 'stove' | 'sink_kitchen'
  | 'bed_single' | 'bed_double' | 'wardrobe' | 'nightstand' | 'dresser'
  | 'bathtub' | 'shower_cabin' | 'toilet' | 'vanity'
  | 'desk' | 'office_chair' | 'bookcase' | 'filing_cabinet'
  | 'rug' | 'plant' | 'lamp_floor';

export type DecorStyle = 'modern' | 'classic' | 'minimalist' | 'scandinavian' | 'industrial';
export type RoomCategory = 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'office';

export interface DecorFurniture {
  id: string;
  type: FurnitureType;
  label: string;
  position: { x: number; y: number }; // SW corner, meters from SW room corner (x=east, y=north)
  size: { w: number; d: number };      // width (E-W) × depth (N-S) in meters
  height: number;                       // meters
  color: string;                        // hex
  material: 'wood' | 'fabric' | 'metal' | 'ceramic' | 'glass' | 'leather';
}

export interface DecorMaterial {
  floorType: 'parquet' | 'tile' | 'carpet' | 'laminate';
  floorColor: string;
  wallColor: string;
  accentWall: WallSide | null;
  accentColor: string;
  ceilingColor: string;
}

export interface DecorOpening {
  id: string;
  type: 'door' | 'window';
  wall: WallSide;
  offset: number;      // meters from wall's west/south end
  width: number;       // meters
  height: number;      // meters
  sillHeight: number;  // meters from floor (0 for doors)
  swingIn: boolean;    // for doors: swing direction
}

export interface DecorSchema {
  id: string;
  drawingType: 'decor';
  roomName: string;
  roomCategory: RoomCategory;
  style: DecorStyle;
  roomWidth: number;   // meters E-W
  roomLength: number;  // meters N-S
  roomHeight: number;  // meters floor-ceiling
  furniture: DecorFurniture[];
  material: DecorMaterial;
  openings: DecorOpening[];
}
