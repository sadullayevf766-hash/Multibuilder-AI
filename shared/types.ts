// Shared types for FloorPlan Generator

export type WallSide = 'north' | 'south' | 'east' | 'west';
export type FixtureType = 'door' | 'window' | 'sink' | 'toilet' | 'shower' | 'bathtub' | 'stove' | 'fridge' | 'dishwasher' | 'desk' | 'bed' | 'wardrobe' | 'sofa' | 'tv_unit' | 'bookshelf' | 'armchair' | 'coffee_table' | 'dining_table';
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
  width?: number; // meters, default 0.9
}

export interface WindowSpec {
  id: string;
  wall: WallSide;
  width?: number; // meters
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

export interface DrawingData {
  id: string;
  walls: Wall[];
  fixtures: PlacedFixture[];
  pipes: Pipe[];
  dimensions: DimensionLine[];
  doors: DoorSpec[];
}

export interface RoomConnection {
  fromRoomId: string;
  toRoomId: string;
  wall: WallSide;
  offset: number;
}

export interface RoomLayout {
  id: string;
  roomSpec: RoomSpec;
  position: { x: number; y: number };
  connections: RoomConnection[];
}

export interface FloorPlan {
  id: string;
  name: string;
  totalArea: number;
  rooms: RoomLayout[];
  buildingDimensions: { width: number; length: number };
}
