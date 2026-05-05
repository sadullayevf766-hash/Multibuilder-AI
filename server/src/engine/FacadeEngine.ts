/**
 * FacadeEngine — Professional arxitektura fasad generatori
 *
 * Qo'llab-quvvatlanadigan uslublar:
 *  - modern       : Zamonaviy, tekis tom, katta oynalar, minimal bezak
 *  - classic      : Klassik, qiyshiq tom, ustunlar, veranda
 *  - minimalist   : Minimalist, oq rangli, kichik oynalar
 *  - highrise     : Ko'p qavatli turar-joy, muntazam oynalar
 *  - cottage      : Kottej, tik tom, chiroyli fasad
 *  - industrial   : Industrial, ochiq beton, katta derazalar
 *
 * SNiP 31-02-2001 (turar joy binolari) asosida o'lchamlar
 */

// ── Tiplar ────────────────────────────────────────────────────────────────────

export type FacadeStyle =
  | 'modern'
  | 'classic'
  | 'minimalist'
  | 'highrise'
  | 'cottage'
  | 'industrial';

export type RoofType =
  | 'flat'          // Tekis tom
  | 'gable'         // Uchburchak tom (2 qiyalik)
  | 'hip'           // 4 qiyalik tom
  | 'shed'          // Bir qiyalik
  | 'mansard'       // Mansard (2 bosqichli qiyalik)
  | 'butterfly'     // Kapalak (ichiga qiyalik)
  | 'parapet';      // Parapet bilan tekis

export type WallMaterial =
  | 'plaster'       // Suvash (rang bilan)
  | 'brick'         // G'isht
  | 'stone'         // Tosh
  | 'concrete'      // Beton
  | 'wood'          // Yog'och panellar
  | 'metal'         // Metal fasad
  | 'glass_curtain' // Shisha fasad
  | 'composite';    // Kompozit panellar

export type WindowStyle =
  | 'standard'      // Oddiy to'rtburchak
  | 'panoramic'     // Panoramik (katta)
  | 'arched'        // Yumaloq tepali
  | 'floor_to_ceiling' // Poldan shipga
  | 'horizontal'    // Gorizontal tasma
  | 'grid';         // Grid oynalar (highrise)

export interface FacadeColor {
  wall:        string;  // Asosiy devor rangi
  trim:        string;  // Qirralar, nalichniklar
  roof:        string;  // Tom rangi
  window:      string;  // Oyna rangi
  door:        string;  // Eshik rangi
  accent:      string;  // Aktsent rangi (balkon, detallar)
}

export interface FacadeFloor {
  index:       number;  // 0 = 1-qavat
  height:      number;  // m
  windows:     FacadeWindow[];
  hasBalcony:  boolean;
  balconyDepth?: number; // m
  hasTerrace?: boolean;
}

export interface FacadeWindow {
  x:           number;  // chapdan m
  width:       number;  // m
  height:      number;  // m
  sill:        number;  // poldan m
  style:       WindowStyle;
  hasShutter?: boolean;
  hasBalcony?: boolean;
}

export interface FacadeDoor {
  x:           number;
  width:       number;
  height:      number;
  style:       'single' | 'double' | 'sliding' | 'arched';
  hasCanopy?:  boolean;  // Soyabon
  canopyDepth?: number;
}

export interface FacadeDecoration {
  type:        'cornice' | 'belt' | 'pilaster' | 'quoin' | 'rustication' | 'panel' | 'louver' | 'fins';
  y?:          number;   // vertikal pozitsiya m
  height?:     number;
  color?:      string;
  spacing?:    number;
}

export interface FacadeRoof {
  type:        RoofType;
  pitch?:      number;   // degrees (gable/hip uchun)
  overhang?:   number;   // m, tomning devordan chiqishi
  material?:   string;
  color?:      string;
  hasGutters?: boolean;
  parapetH?:   number;   // parapet balandligi m
  ridgeH?:     number;   // tizma balandligi m (gable uchun)
}

export interface FacadeElevation {
  id:          string;
  side:        'south' | 'north' | 'east' | 'west' | 'main' | 'rear' | 'left' | 'right';
  label:       string;   // "Asosiy fasad", "1-fasad" ...
  totalWidth:  number;   // m
  floors:      FacadeFloor[];
  doors:       FacadeDoor[];
  roof:        FacadeRoof;
  decorations: FacadeDecoration[];
  material:    WallMaterial;
  colors:      FacadeColor;
  totalHeight: number;   // tom tepsigacha m
}

export interface FacadeSchema {
  id:          string;
  name:        string;
  style:       FacadeStyle;
  buildingType: 'residential' | 'commercial' | 'industrial' | 'mixed';
  floorCount:  number;
  floorHeight: number;   // m
  totalWidth:  number;   // m asosiy fasad
  totalDepth:  number;   // m yon tomondan
  totalHeight: number;   // m
  elevations:  FacadeElevation[];
  material:    WallMaterial;
  colors:      FacadeColor;
  roof:        FacadeRoof;
  notes:       string[];
  scale:       string;   // "1:100", "1:200"
}

// ── Input ─────────────────────────────────────────────────────────────────────

export interface FacadeInput {
  style:        FacadeStyle;
  floorCount:   number;
  floorHeight?: number;   // default: stilga qarab
  width?:       number;   // m asosiy fasad, default: stilga qarab
  depth?:       number;   // m, default: width*0.6
  hasBalcony?:  boolean;
  hasGarage?:   boolean;
  hasVeranda?:  boolean;
  roofType?:    RoofType; // override
  material?:    WallMaterial;
  colorScheme?: 'dark' | 'light' | 'natural' | 'colorful';
  windowStyle?: WindowStyle;
}

// ── Style presets ─────────────────────────────────────────────────────────────

const STYLE_DEFAULTS: Record<FacadeStyle, {
  floorH:     number;
  width:      number;
  roof:       RoofType;
  material:   WallMaterial;
  windowStyle: WindowStyle;
  colors:     FacadeColor;
  winW:       number;    // oyna kengligi m
  winH:       number;    // oyna balandligi m
  winSill:    number;    // oyna sill m
  winsPerFloor: number;  // 1-qavatdagi oynalar soni
  hasDoorCanopy: boolean;
  decorations: FacadeDecoration[];
}> = {
  modern: {
    floorH: 3.0,
    width:  12.0,
    roof: 'flat',
    material: 'plaster',
    windowStyle: 'panoramic',
    colors: {
      wall: '#e8eaf0',   // och kulrang-oq (arxitektura chizmasiga mos)
      trim: '#9ca3af',
      roof: '#6b7280',
      window: '#bae6fd',
      door: '#4b5563',
      accent: '#c8a96e',
    },
    winW: 1.8, winH: 1.8, winSill: 0.8,
    winsPerFloor: 3,
    hasDoorCanopy: false,
    decorations: [
      { type: 'panel', color: '#d1d5db', height: 0.15 },
    ],
  },

  classic: {
    floorH: 3.2,
    width:  10.0,
    roof: 'gable',
    material: 'plaster',
    windowStyle: 'arched',
    colors: {
      wall: '#e8e0d0',   // krem
      trim: '#8b7355',   // jigarrang
      roof: '#6b4226',   // to'q jigarrang
      window: '#cce5ff',
      door: '#5c3d2e',
      accent: '#8b7355',
    },
    winW: 1.0, winH: 1.4, winSill: 0.9,
    winsPerFloor: 3,
    hasDoorCanopy: true,
    decorations: [
      { type: 'cornice', color: '#d4c4a0', height: 0.3 },
      { type: 'belt',    color: '#c8b89a', height: 0.15 },
      { type: 'pilaster', color: '#d4c4a0', spacing: 3.5 },
    ],
  },

  minimalist: {
    floorH: 2.8,
    width:  9.0,
    roof: 'flat',
    material: 'plaster',
    windowStyle: 'standard',
    colors: {
      wall: '#f5f5f0',   // oq/krem
      trim: '#e0e0da',
      roof: '#e8e8e0',
      window: '#b8d4e8',
      door: '#4a4a4a',
      accent: '#c0a882',
    },
    winW: 1.2, winH: 1.2, winSill: 0.9,
    winsPerFloor: 2,
    hasDoorCanopy: false,
    decorations: [],
  },

  highrise: {
    floorH: 2.85,
    width:  24.0,
    roof: 'flat',
    material: 'composite',
    windowStyle: 'grid',
    colors: {
      wall: '#c8b89e',   // och jigarrang
      trim: '#8a7a6a',
      roof: '#6a5a4a',
      window: '#9cc8e0',
      door: '#5a4a3a',
      accent: '#e8d8c4',
    },
    winW: 1.5, winH: 1.4, winSill: 0.75,
    winsPerFloor: 8,
    hasDoorCanopy: true,
    decorations: [
      { type: 'belt', color: '#b0a090', height: 0.12, y: 0 },
      { type: 'panel', color: '#d4c4b0', height: 0.08 },
    ],
  },

  cottage: {
    floorH: 3.0,
    width:  8.0,
    roof: 'gable',
    material: 'wood',
    windowStyle: 'arched',
    colors: {
      wall: '#f0e8d8',   // sariq-krem
      trim: '#7a5c3c',   // jigarrang
      roof: '#4a3020',   // to'q jigarrang
      window: '#d0e8f0',
      door: '#6b3a2a',
      accent: '#a07850',
    },
    winW: 0.9, winH: 1.2, winSill: 0.9,
    winsPerFloor: 2,
    hasDoorCanopy: true,
    decorations: [
      { type: 'quoin',  color: '#d8c8a8', spacing: 0 },
      { type: 'cornice', color: '#c8b898', height: 0.25 },
    ],
  },

  industrial: {
    floorH: 3.5,
    width:  14.0,
    roof: 'shed',
    material: 'concrete',
    windowStyle: 'horizontal',
    colors: {
      wall: '#d4d6d8',   // och beton kul (chizma uchun)
      trim: '#9ca3a8',
      roof: '#6b7280',
      window: '#bae6fd',
      door: '#4b5563',
      accent: '#d04a2a',
    },
    winW: 2.4, winH: 0.8, winSill: 1.5,
    winsPerFloor: 4,
    hasDoorCanopy: false,
    decorations: [
      { type: 'fins',   color: '#6a6860', spacing: 1.2, height: 0.08 },
      { type: 'rustication', color: '#7a7870', height: 0.6 },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

let _id = Date.now();
const genId = (p: string) => `${p}-${_id++}`;

function colorSchemeAdjust(base: FacadeColor, scheme?: string): FacadeColor {
  if (!scheme || scheme === 'light') return base;
  if (scheme === 'dark') {
    return {
      ...base,
      wall: darken(base.wall, 0.3),
      trim: darken(base.trim, 0.2),
    };
  }
  if (scheme === 'natural') {
    return {
      ...base,
      wall: '#d4c4a8',
      trim: '#8b6e4a',
      roof: '#5c3d20',
    };
  }
  if (scheme === 'colorful') {
    return { ...base, accent: '#e85d3a', trim: '#2a6cbf' };
  }
  return base;
}

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - Math.round(255 * amount));
  const g = Math.max(0, ((num >> 8) & 255) - Math.round(255 * amount));
  const b = Math.max(0, (num & 255) - Math.round(255 * amount));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ── Floor layout builder ──────────────────────────────────────────────────────

function buildFloors(
  input:   FacadeInput,
  preset:  typeof STYLE_DEFAULTS[FacadeStyle],
  totalW:  number,
): FacadeFloor[] {
  const floors: FacadeFloor[] = [];
  const floorH = input.floorHeight ?? preset.floorH;
  const winW   = preset.winW;
  const winH   = preset.winH;
  const winSill = preset.winSill;
  const wCount = input.style === 'highrise'
    ? Math.max(4, Math.round(totalW / 3.0))
    : preset.winsPerFloor;
  const wStyle = input.windowStyle ?? preset.windowStyle;

  for (let f = 0; f < input.floorCount; f++) {
    const isGround  = f === 0;
    const isTop     = f === input.floorCount - 1;
    const hasBalc   = input.hasBalcony === true && f > 0 && !isTop;

    // Ground floor: bitta kichik oyna kamroq (eshik bor)
    const floorWinCount = isGround ? Math.max(1, wCount - 1) : wCount;

    // Oynalarni teng taqsimlash
    const doorSpace    = isGround ? 1.2 : 0;   // eshik uchun joy
    const usableW      = totalW - doorSpace - 0.8; // chetdagi bo'sh joy
    const spacing      = usableW / (floorWinCount + 1);
    const xStart       = doorSpace + 0.4;

    const windows: FacadeWindow[] = [];
    for (let wi = 0; wi < floorWinCount; wi++) {
      const x = xStart + spacing * (wi + 1) - winW / 2;
      windows.push({
        x:      Math.max(0.3, x),
        width:  winW,
        height: winH,
        sill:   winSill,
        style:  wStyle,
        hasBalcony: hasBalc && wi === Math.floor(floorWinCount / 2),
        hasShutter: preset.material === 'plaster' || input.style === 'classic',
      });
    }

    floors.push({
      index:      f,
      height:     floorH,
      windows,
      hasBalcony: hasBalc,
      balconyDepth: hasBalc ? 1.2 : undefined,
    });
  }
  return floors;
}

// ── Roof builder ──────────────────────────────────────────────────────────────

function buildRoof(
  input:   FacadeInput,
  preset:  typeof STYLE_DEFAULTS[FacadeStyle],
  totalW:  number,
): FacadeRoof {
  const type = input.roofType ?? preset.roof;
  const color = preset.colors.roof;

  const base: FacadeRoof = {
    type,
    color,
    hasGutters: type !== 'flat' && type !== 'parapet',
    overhang: type === 'gable' ? 0.5 : type === 'hip' ? 0.45 : type === 'flat' ? 0 : 0.3,
    pitch: type === 'gable' ? 35 : type === 'hip' ? 30 : type === 'mansard' ? 60 : type === 'shed' ? 15 : 0,
    parapetH: (type === 'flat' || type === 'parapet') ? 0.5 : 0,
    ridgeH: type === 'gable' ? totalW * 0.28 : type === 'hip' ? totalW * 0.22 : 0,
  };

  // Stil-ga qarab to'g'irlash
  if (input.style === 'modern' || input.style === 'minimalist') {
    return { ...base, type: 'flat', parapetH: 0.5, pitch: 0, ridgeH: 0, overhang: 0 };
  }
  if (input.style === 'highrise') {
    return { ...base, type: 'flat', parapetH: 1.2, pitch: 0, ridgeH: 0, overhang: 0 };
  }
  if (input.style === 'industrial') {
    return { ...base, type: 'shed', pitch: 10, ridgeH: totalW * 0.09, overhang: 0.4 };
  }
  return base;
}

// ── Elevation builder ─────────────────────────────────────────────────────────

function buildElevation(
  input:     FacadeInput,
  preset:    typeof STYLE_DEFAULTS[FacadeStyle],
  side:      FacadeElevation['side'],
  label:     string,
  w:         number,
  isMain:    boolean,
): FacadeElevation {
  const floorH = input.floorHeight ?? preset.floorH;
  const colors = colorSchemeAdjust(preset.colors, input.colorScheme);
  const material = input.material ?? preset.material;

  const floors = isMain
    ? buildFloors(input, preset, w)
    : buildFloors(
        { ...input, style: input.style },
        { ...preset, winsPerFloor: Math.max(1, Math.round(preset.winsPerFloor * 0.6)) },
        w,
      );

  // Eshik — faqat asosiy fasadda
  const doors: FacadeDoor[] = isMain ? [{
    x:      0.4,
    width:  input.style === 'highrise' ? 2.4 : 1.0,
    height: input.style === 'highrise' ? 2.5 : 2.1,
    style:  input.style === 'highrise' ? 'double'
          : input.style === 'modern'   ? 'sliding'
          : input.style === 'classic'  ? 'arched'
          : 'single',
    hasCanopy: preset.hasDoorCanopy,
    canopyDepth: preset.hasDoorCanopy ? 1.0 : 0,
  }] : [];

  const roof   = buildRoof(input, preset, w);
  const totalH = input.floorCount * floorH
    + (roof.ridgeH ?? 0)
    + (roof.parapetH ?? 0);

  return {
    id:          genId('elev'),
    side,
    label,
    totalWidth:  w,
    floors,
    doors,
    roof,
    decorations: preset.decorations,
    material,
    colors,
    totalHeight: totalH,
  };
}

// ── Main FacadeEngine ─────────────────────────────────────────────────────────

export class FacadeEngine {
  generate(input: FacadeInput): FacadeSchema {
    const preset = STYLE_DEFAULTS[input.style];
    const floorH = input.floorHeight ?? preset.floorH;
    const totalW = input.width  ?? preset.width;
    const totalD = input.depth  ?? Math.round(totalW * 0.62 * 10) / 10;
    const roof   = buildRoof(input, preset, totalW);
    const totalH = input.floorCount * floorH + (roof.ridgeH ?? 0) + (roof.parapetH ?? 0);
    const colors = colorSchemeAdjust(preset.colors, input.colorScheme);

    const sideLabels: Array<[FacadeElevation['side'], string, number, boolean]> = [
      ['main',  'Asosiy fasad (1-fasad)',  totalW, true ],
      ['rear',  'Orqa fasad (2-fasad)',    totalW, false],
      ['left',  'Chap yon fasad (3-fasad)', totalD, false],
      ['right', 'O\'ng yon fasad (4-fasad)', totalD, false],
    ];

    const elevations = sideLabels.map(([side, label, w, isMain]) =>
      buildElevation(input, preset, side, label, w, isMain)
    );

    const notes: string[] = [
      `Uslub: ${input.style}`,
      `Qavatlar: ${input.floorCount} × ${floorH.toFixed(1)}m`,
      `Asosiy fasad kengligi: ${totalW}m`,
      `Yon fasad: ${totalD}m`,
      `Tom turi: ${roof.type}`,
      `Devor materiali: ${input.material ?? preset.material}`,
      `Umumiy balandlik: ${totalH.toFixed(2)}m`,
      `Masshtab: 1:100`,
    ];

    const scale = totalW > 18 ? '1:200' : totalW > 10 ? '1:100' : '1:50';

    return {
      id:           genId('facade'),
      name:         `${input.style.charAt(0).toUpperCase() + input.style.slice(1)} fasad`,
      style:        input.style,
      buildingType: input.style === 'highrise' ? 'residential'
                  : input.style === 'industrial' ? 'industrial' : 'residential',
      floorCount:   input.floorCount,
      floorHeight:  floorH,
      totalWidth:   totalW,
      totalDepth:   totalD,
      totalHeight:  totalH,
      elevations,
      material:     input.material ?? preset.material,
      colors,
      roof,
      notes,
      scale,
    };
  }
}

// ── Input parser ──────────────────────────────────────────────────────────────

export function parseFacadeInput(description: string): FacadeInput {
  const text = description.toLowerCase();

  // Qavatlarni oldin aniqlaymiz — stil uchun kerak
  const fMatch = description.match(/(\d+)\s*[-\s]?\s*(?:qavat|этаж|floor|stor(?:ey|y|ies)|kat)/i);
  let floorCount = fMatch ? parseInt(fMatch[1]) : 2;

  // Stil aniqlash (qavatlar soniga ham qarab)
  let style: FacadeStyle = 'modern';
  if (/klassik|classic|an\'anaviy|traditional|классич|класс/.test(text)) style = 'classic';
  else if (/kottej|cottage|qishloq|деревн|коттедж/.test(text)) style = 'cottage';
  else if (/industrial|sanoat|zavodcha|factory/.test(text))  style = 'industrial';
  else if (/ko'p qavat|ko'p.kvartir|многоэтаж|многоквар|highrise|high.rise|apartament|apartment/.test(text)) style = 'highrise';
  else if (/minimalist|minimal/.test(text))                  style = 'minimalist';
  else if (/zamonaviy|modern|hozirgi|contemporary|villa|hasham/.test(text)) style = 'modern';
  // Qavatlar soniga qarab avtomatik uslub
  if (floorCount >= 5 && style !== 'industrial') style = 'highrise';
  else if (floorCount === 1 && style === 'modern' && /qishloq|oddiy|kichik|uy/.test(text)) style = 'cottage';

  if (style === 'highrise' && floorCount < 5) floorCount = 9;

  // O'lchamlar
  const wMatch = description.match(/(\d+(?:[.,]\d+)?)\s*m(?:etr)?\s*(?:keng|wide|width|en)/i);
  const width  = wMatch ? parseFloat(wMatch[1].replace(',', '.')) : undefined;

  // Boshqa xususiyatlar
  const hasBalcony  = /balkon|balkoni|balcony/.test(text);
  const hasVeranda  = /veranda|аyvon|porch/.test(text);
  const hasGarage   = /garaj|garage/.test(text);

  // Tom turi
  let roofType: RoofType | undefined;
  if (/tekis tom|flat roof|плоская крыш/.test(text))      roofType = 'flat';
  else if (/qiyshiq|gable|двускат/.test(text))            roofType = 'gable';
  else if (/mansard|мансард/.test(text))                  roofType = 'mansard';
  else if (/hip.roof|вальм/.test(text))                   roofType = 'hip';

  // Material
  let material: WallMaterial | undefined;
  if (/g'isht|кирпич|brick/.test(text))                   material = 'brick';
  else if (/tosh|камень|stone/.test(text))                 material = 'stone';
  else if (/beton|бетон|concrete/.test(text))              material = 'concrete';
  else if (/shisha|стекло|glass/.test(text))               material = 'glass_curtain';
  else if (/yog'och|дерево|wood/.test(text))               material = 'wood';
  else if (/metal|металл/.test(text))                      material = 'metal';

  // Rang sxema
  let colorScheme: 'dark' | 'light' | 'natural' | 'colorful' | undefined;
  if (/qoram|dark|to'q|темн/.test(text))    colorScheme = 'dark';
  else if (/oq|white|açık|светл/.test(text)) colorScheme = 'light';
  else if (/tabiiy|natural|табии/.test(text)) colorScheme = 'natural';
  else if (/rang|colorful|цветн/.test(text)) colorScheme = 'colorful';

  return {
    style,
    floorCount,
    width,
    hasBalcony,
    hasVeranda,
    hasGarage,
    roofType,
    material,
    colorScheme,
  };
}
