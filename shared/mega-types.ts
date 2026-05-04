// ── Mega Builder — shared types ───────────────────────────────────────────────

export type MegaDiscipline =
  | 'floor-plan'
  | 'architecture'
  | 'facade'
  | 'electrical'
  | 'plumbing'
  | 'warm-floor'
  | 'water-supply'
  | 'sewage'
  | 'storm-drain'
  | 'boiler-room'
  | 'decor';

export type MegaStage = 'plan' | 'build' | 'review';
export type GenerationStatus = 'idle' | 'generating' | 'building' | 'done' | 'error';
export type ViewMode = '2d' | '3d' | 'axon';

export interface MegaProjectSpec {
  floorCount:          number;
  totalAreaM2:         number;
  floorAreas:          number[];          // har qavat uchun m²
  buildingDescription: string;            // original user text
  disciplines:         MegaDiscipline[];  // faqat user so'raganlar
  // Gemini tomonidan har modul uchun yozilgan natural tavsif — parser uchun
  disciplinePrompts:   Partial<Record<MegaDiscipline, string>>;
  hasWarmFloor:        boolean;
  hasWarmWall:         boolean;
  hasHvs:              boolean;           // issiq suv ta'minoti
  roofAreaM2:          number;            // storm-drain uchun
  balconyAreaM2:       number;
  style:               string;            // decor uchun: 'modern' | 'classic' | ...
  language:            'uz' | 'ru' | 'en';
  notes:               string;            // qo'shimcha izohlar
}

export interface GenerationState {
  status:      GenerationStatus;
  schema:      unknown | null;
  error:       string | null;
  generatedAt: number | null;
}

export interface MegaChatMessage {
  role:      'user' | 'assistant';
  content:   string;
  timestamp: number;
}

export interface MegaEditResult {
  reply:      string;
  targets:    MegaDiscipline[];
  specPatch:  Partial<MegaProjectSpec>;
}

export interface MegaPlanResult {
  reply:      string;
  isComplete: boolean;
  spec:       MegaProjectSpec | null;
}

export type MegaGenerations = Record<MegaDiscipline, GenerationState>;

export interface MegaProject {
  id:           string;
  stage:        MegaStage;
  spec:         MegaProjectSpec | null;
  generations:  MegaGenerations;
  chatHistory:  MegaChatMessage[];
  editHistory:  MegaChatMessage[];
  activeTab:    MegaDiscipline | null;
  activeView:   ViewMode;
}

// ── Discipline metadata ────────────────────────────────────────────────────────

export interface DisciplineMeta {
  id:       MegaDiscipline;
  icon:     string;
  labelUz:  string;
  endpoint: string;
  has3D:    boolean;
  hasAxon:  boolean;
  color:    string;
}

export const DISCIPLINE_META: Record<MegaDiscipline, DisciplineMeta> = {
  'floor-plan': {
    id: 'floor-plan', icon: '📐', labelUz: "Xona rejasi",
    endpoint: '/api/generate', has3D: false, hasAxon: false,
    color: '#3b82f6',
  },
  'architecture': {
    id: 'architecture', icon: '🏛️', labelUz: "Arxitektura",
    endpoint: '/api/generate', has3D: false, hasAxon: false,
    color: '#6366f1',
  },
  'facade': {
    id: 'facade', icon: '🏠', labelUz: "Fasad (tashqi ko'rinish)",
    endpoint: '/api/generate-facade', has3D: true, hasAxon: false,
    color: '#f59e0b',
  },
  'electrical': {
    id: 'electrical', icon: '⚡', labelUz: "Elektr tizimi",
    endpoint: '/api/generate', has3D: false, hasAxon: false,
    color: '#eab308',
  },
  'plumbing': {
    id: 'plumbing', icon: '🔧', labelUz: "Santexnika",
    endpoint: '/api/generate', has3D: true, hasAxon: true,
    color: '#06b6d4',
  },
  'warm-floor': {
    id: 'warm-floor', icon: '♨️', labelUz: "Issiq pol",
    endpoint: '/api/generate-warm-floor', has3D: true, hasAxon: false,
    color: '#f97316',
  },
  'water-supply': {
    id: 'water-supply', icon: '💧', labelUz: "Suv ta'minoti",
    endpoint: '/api/generate-water-supply', has3D: true, hasAxon: true,
    color: '#0ea5e9',
  },
  'sewage': {
    id: 'sewage', icon: '🚽', labelUz: "Kanalizatsiya",
    endpoint: '/api/generate-sewage', has3D: true, hasAxon: true,
    color: '#d97706',
  },
  'storm-drain': {
    id: 'storm-drain', icon: '🌧️', labelUz: "Yomg'ir suvi",
    endpoint: '/api/generate-storm-drain', has3D: true, hasAxon: false,
    color: '#64748b',
  },
  'boiler-room': {
    id: 'boiler-room', icon: '🔥', labelUz: "Qozonxona",
    endpoint: '/api/generate-boiler-room', has3D: true, hasAxon: false,
    color: '#dc2626',
  },
  'decor': {
    id: 'decor', icon: '🛋️', labelUz: "Interer dizayn",
    endpoint: '/api/generate', has3D: false, hasAxon: false,
    color: '#a855f7',
  },
};

export const EMPTY_GENERATION: GenerationState = {
  status: 'idle', schema: null, error: null, generatedAt: null,
};

export function emptyGenerations(): MegaGenerations {
  return Object.fromEntries(
    Object.keys(DISCIPLINE_META).map(k => [k, { ...EMPTY_GENERATION }])
  ) as MegaGenerations;
}

export function defaultSpec(): MegaProjectSpec {
  return {
    floorCount: 1, totalAreaM2: 100, floorAreas: [100],
    buildingDescription: '', disciplines: [], disciplinePrompts: {},
    hasWarmFloor: false, hasWarmWall: false, hasHvs: true,
    roofAreaM2: 100, balconyAreaM2: 0,
    style: 'modern', language: 'uz', notes: '',
  };
}
