/**
 * Client-side plumbing types — server/src/engine/PlumbingProjectEngine.ts dan mirror
 * (shared types alohida package bo'lmaganida shu yondashuv ishlatiladi)
 */

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
  position: Vec3;
  rotation: number;
  dimensions: { w: number; d: number; h: number };
  floor: number;
  roomId: string;
  coldIn:   Vec3 | null;
  hotIn:    Vec3 | null;
  drainOut: Vec3 | null;
  drainDiamMm: 50 | 110;
  branchDiamMm: 20 | 25;
  isManual: boolean;
  label?: string;
}

export interface PlumbingPipeSegment {
  id: string;
  type: PipeType;
  material: PipeMaterial;
  diamMm: number;
  from: Vec3;
  to: Vec3;
  floor: number;
  isRiser: boolean;
  isMain: boolean;
  label?: string;
  slope?: number;
}

export interface PlumbingRoom {
  id: string;
  name: string;
  nameRu: string;
  type: 'bathroom' | 'kitchen' | 'laundry' | 'toilet' | 'utility' | 'other';
  floor: number;
  position: Vec2;
  width: number;
  length: number;
  height: number;
  fixtureIds: string[];
  /** Ixtiyoriy polygon shakl — position ga nisbiy nuqtalar (m).
   *  Yo'q bo'lsa oddiy to'rtburchak (0,0)→(width,length) */
  shape?: Vec2[];
}

export interface PlumbingRiser {
  id: string;
  tag: string;
  type: PipeType;
  diamMm: number;
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
  side: WallSide;       // qaysi devorda
  offset: number;       // devor boshidan (m)
  width: number;        // ochilma kengligi (m)
  type: 'door' | 'window';
  swingIn?: boolean;    // eshik ichkariga ochilishmi (faqat door)
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

export interface LabelOverride {
  dx: number;        // foydalanuvchi surgan offset (px, scale=1 da)
  dy: number;
  fontSize?: number; // override font o'lchami
  hidden?: boolean;
}

export interface PlumbingProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  floorCount: number;
  floorHeight: number;
  buildingWidth: number;
  buildingLength: number;
  rooms: PlumbingRoom[];
  fixtures: PlumbingFixture[];
  pipes: PlumbingPipeSegment[];
  risers: PlumbingRiser[];
  equipment: PlumbingEquipment[];
  openings?: PlumbingOpening[];
  activeView: ViewType;
  activeFloor: number;
  layers: PlumbingLayer[];
  /** Label override lar: key = "fixture:{id}" | "room:{id}" */
  labelOverrides?: Record<string, LabelOverride>;
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

// SVG icon paths (24x24 viewBox, stroke-based)
export const FIXTURE_ICONS: Record<FixtureType, string> = {
  toilet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="8" y="3" width="8" height="5" rx="1"/><ellipse cx="12" cy="14" rx="6" ry="7"/><line x1="9" y1="8" x2="9" y2="9"/><line x1="15" y1="8" x2="15" y2="9"/></svg>`,
  sink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="4" y="6" width="16" height="12" rx="2"/><ellipse cx="12" cy="12" rx="4" ry="3"/><line x1="12" y1="4" x2="12" y2="6"/><line x1="10" y1="4" x2="14" y2="4"/></svg>`,
  kitchen_sink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="6" width="20" height="13" rx="2"/><rect x="3" y="7" width="8" height="11" rx="1"/><rect x="13" y="7" width="8" height="11" rx="1"/><line x1="12" y1="4" x2="12" y2="6"/></svg>`,
  bathtub: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 20h16"/><path d="M4 12h16v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6z"/><path d="M6 12V6a2 2 0 012-2h1"/><circle cx="9" cy="10" r="1" fill="currentColor"/></svg>`,
  shower: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 20 L4 6 Q4 4 6 4 L20 4"/><path d="M8 4 Q8 8 12 8 Q16 8 16 4"/><circle cx="17" cy="7" r="1.5" fill="currentColor"/><line x1="15" y1="12" x2="15" y2="20"/><line x1="10" y1="15" x2="10" y2="20"/></svg>`,
  bidet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="7" y="5" width="10" height="6" rx="1"/><ellipse cx="12" cy="15" rx="5" ry="5"/><line x1="12" y1="3" x2="12" y2="5"/></svg>`,
  washing_machine: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2.5"/><circle cx="7" cy="6" r="1" fill="currentColor"/><circle cx="10" cy="6" r="1" fill="currentColor"/></svg>`,
  dishwasher: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="17" y2="13"/><line x1="7" y1="17" x2="17" y2="17"/><circle cx="7" cy="6" r="1" fill="currentColor"/></svg>`,
  floor_drain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="4" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="20"/><line x1="4" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="20" y2="12"/></svg>`,
  towel_rail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="13" x2="20" y2="13"/><line x1="4" y1="18" x2="20" y2="18"/></svg>`,
  tap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 12 L5 8 Q5 6 7 6 L14 6 Q16 6 16 8 L16 12"/><path d="M2 12 L19 12"/><path d="M16 9 L19 9 L19 15 Q19 17 17 17 L14 17"/><path d="M10 17 L10 20"/><path d="M8 20 L12 20"/></svg>`,
};

// Fixture catalog (client-side meta for UI)
export const FIXTURE_NAMES: Record<FixtureType, { uz: string; icon: string }> = {
  toilet:          { uz: 'Unitaz',                  icon: FIXTURE_ICONS.toilet },
  sink:            { uz: 'Lavabo',                  icon: FIXTURE_ICONS.sink },
  kitchen_sink:    { uz: 'Oshxona lavabosi',        icon: FIXTURE_ICONS.kitchen_sink },
  bathtub:         { uz: 'Vanna',                   icon: FIXTURE_ICONS.bathtub },
  shower:          { uz: 'Dush kabinasi',           icon: FIXTURE_ICONS.shower },
  bidet:           { uz: 'Bide',                    icon: FIXTURE_ICONS.bidet },
  washing_machine: { uz: 'Kir yuvish mashinasi',   icon: FIXTURE_ICONS.washing_machine },
  dishwasher:      { uz: 'Idish yuvish mashinasi', icon: FIXTURE_ICONS.dishwasher },
  floor_drain:     { uz: 'Pol drenaji',             icon: FIXTURE_ICONS.floor_drain },
  towel_rail:      { uz: 'Sochiq isitgich',         icon: FIXTURE_ICONS.towel_rail },
  tap:             { uz: 'Kran',                    icon: FIXTURE_ICONS.tap },
};
