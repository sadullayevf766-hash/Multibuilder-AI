/**
 * WarmFloorEngine — Issiq pol isitish tizimi generatsiyasi
 *
 * PDF (Xumson ОВиК) dagi chizmalar asosida:
 * - Har xona uchun PEX kontur hisoblash
 * - Isitish yuki (W)
 * - Kollektorlar guruhlash
 * - Snake (ilon) pattern koordinatalari
 *
 * Standart: SNiP 2.04.05 (KMK 2.04.05), GOST 21.601
 */

// ── Tiplar ────────────────────────────────────────────────────────────────────

export interface WarmFloorRoom {
  id:        string;
  number:    number;
  name:      string;
  width:     number;  // metr
  length:    number;  // metr
  area:      number;  // m²
  floor:     number;  // qavat (1, 2...)
  type:      'living' | 'bathroom' | 'kitchen' | 'hallway' | 'auxiliary';
}

export interface WarmFloorContour {
  id:          string;
  roomId:      string;
  number:      number;
  pipeType:    'PEX' | 'PEX-AL-PEX';
  diameter:    string;   // '16x2' mm
  length:      number;   // metr
  stepMm:      number;   // 150 | 200
  heatW:       number;
  path:        Array<{ x: number; y: number }>;
  collectorId: string;
}

export interface WarmFloorCollector {
  id:          string;
  floor:       number;
  contours:    string[];
  position:    'north' | 'south' | 'east' | 'west' | 'closet';
  pipeInDiam:  string;
  pipeOutDiam: string;
}

export interface WarmFloorFloor {
  floorNumber:    number;
  elevation:      number;
  label:          string;
  rooms:          WarmFloorRoom[];
  contours:       WarmFloorContour[];
  collectors:     WarmFloorCollector[];
  totalAreaM2:    number;
  totalHeatW:     number;
  buildingWidth:  number;
  buildingLength: number;
}

export interface WarmFloorSchema {
  id:           string;
  name:         string;
  floors:       WarmFloorFloor[];
  totalAreaM2:  number;
  totalHeatW:   number;
  heatSourceKw: number;
  systemParams: {
    supplyTemp: number;
    returnTemp: number;
    fluid:      string;
    pipeType:   string;
  };
}

// ── Konstantalar ──────────────────────────────────────────────────────────────

const HEAT_DENSITY: Record<string, number> = {
  living:    115,
  bathroom:  150,
  kitchen:   110,
  hallway:    90,
  auxiliary:  80,
};

const MAX_CONTOUR_LENGTH_M = 80;
const PIPE_DIAM = '16x2';
const SUPPLY_T  = 50;
const RETURN_T  = 40;

// ── Asosiy klass ──────────────────────────────────────────────────────────────

export class WarmFloorEngine {

  generate(rooms: WarmFloorRoom[]): WarmFloorSchema {
    const floorNums = [...new Set(rooms.map(r => r.floor))].sort();
    let contourCounter = 1;
    let collectorCounter = 1;

    const floors: WarmFloorFloor[] = floorNums.map(fn => {
      const floorRooms = rooms.filter(r => r.floor === fn);
      const { contours, collectors, cc, colC } = this._generateFloor(
        fn, floorRooms, contourCounter, collectorCounter
      );
      contourCounter = cc;
      collectorCounter = colC;

      const totalArea = floorRooms.reduce((s, r) => s + r.area, 0);
      const totalHeat = contours.reduce((s, c) => s + c.heatW, 0);

      return {
        floorNumber:    fn,
        elevation:      (fn - 1) * 3.0,
        label:          `${fn}-qavat`,
        rooms:          floorRooms,
        contours,
        collectors,
        totalAreaM2:    +totalArea.toFixed(2),
        totalHeatW:     Math.round(totalHeat),
        buildingWidth:  this._buildingWidth(floorRooms),
        buildingLength: this._buildingLength(floorRooms),
      };
    });

    const totalArea = floors.reduce((s, f) => s + f.totalAreaM2, 0);
    const totalHeat = floors.reduce((s, f) => s + f.totalHeatW, 0);

    return {
      id:           `wf-${Date.now()}`,
      name:         'Issiq pol isitish tizimi',
      floors,
      totalAreaM2:  +totalArea.toFixed(2),
      totalHeatW:   Math.round(totalHeat),
      heatSourceKw: Math.ceil(totalHeat / 1000 / 0.85 * 10) / 10,
      systemParams: {
        supplyTemp: SUPPLY_T,
        returnTemp: RETURN_T,
        fluid:      'Suv',
        pipeType:   `PEX ${PIPE_DIAM} mm`,
      },
    };
  }

  private _generateFloor(
    floorNum: number,
    rooms: WarmFloorRoom[],
    startContour: number,
    startCollector: number,
  ) {
    let cc   = startContour;
    let colC = startCollector;

    const collectors: WarmFloorCollector[] = [];
    const allContours: WarmFloorContour[]  = [];

    const COLL_SIZE = 12;
    for (let ci = 0; ci < rooms.length; ci += COLL_SIZE) {
      const batch  = rooms.slice(ci, ci + COLL_SIZE);
      const collId = `coll-${colC++}`;

      const batchContours: WarmFloorContour[] = [];
      batch.forEach(room => {
        const rc = this._contoursForRoom(room, cc, collId);
        cc += rc.length;
        batchContours.push(...rc);
        allContours.push(...rc);
      });

      collectors.push({
        id:          collId,
        floor:       floorNum,
        contours:    batchContours.map(c => c.id),
        position:    'closet',
        pipeInDiam:  '32',
        pipeOutDiam: '32',
      });
    }

    return { contours: allContours, collectors, cc, colC };
  }

  private _contoursForRoom(
    room: WarmFloorRoom,
    startNum: number,
    collId: string,
  ): WarmFloorContour[] {
    const density         = HEAT_DENSITY[room.type] ?? HEAT_DENSITY.living;
    const totalHeat       = Math.round(room.area * density);
    const stepMm          = room.type === 'bathroom' ? 150 : 200;
    const stepM           = stepMm / 1000;
    const theoreticalLen  = (room.area / stepM) * 2;
    const contourCount    = Math.max(1, Math.ceil(theoreticalLen / MAX_CONTOUR_LENGTH_M));
    const lenPerContour   = Math.round(theoreticalLen / contourCount);

    const contours: WarmFloorContour[] = [];
    for (let i = 0; i < contourCount; i++) {
      const num = startNum + i;
      contours.push({
        id:          `c-${num}`,
        roomId:      room.id,
        number:      num,
        pipeType:    'PEX',
        diameter:    PIPE_DIAM,
        length:      Math.min(MAX_CONTOUR_LENGTH_M, lenPerContour),
        stepMm,
        heatW:       Math.round(totalHeat / contourCount),
        path:        this._snakePath(room.width, room.length, stepM, i, contourCount),
        collectorId: collId,
      });
    }
    return contours;
  }

  private _snakePath(
    roomW: number,
    roomL: number,
    stepM: number,
    contourIdx: number,
    totalContours: number,
  ): Array<{ x: number; y: number }> {
    const sectorW = roomW / totalContours;
    const x0      = sectorW * contourIdx;
    const x1      = sectorW * (contourIdx + 1);
    const margin  = 0.15;

    const eX0 = Math.max(0.05, (x0 + margin) / roomW);
    const eX1 = Math.min(0.95, (x1 - margin) / roomW);
    const eY0 = margin / roomL;
    const eY1 = 1 - margin / roomL;

    const stepNorm = stepM / roomL;
    const lines    = Math.max(2, Math.floor((eY1 - eY0) / stepNorm));

    const path: Array<{ x: number; y: number }> = [];
    let goRight = true;

    for (let li = 0; li <= lines; li++) {
      const yn = Math.min(eY1, eY0 + li * stepNorm);
      if (goRight) {
        path.push({ x: eX0, y: yn });
        path.push({ x: eX1, y: yn });
      } else {
        path.push({ x: eX1, y: yn });
        path.push({ x: eX0, y: yn });
      }
      goRight = !goRight;
    }
    return path;
  }

  private _buildingWidth(rooms: WarmFloorRoom[]): number {
    if (!rooms.length) return 10;
    return Math.max(...rooms.map(r => r.width)) * 2.5 || 12;
  }

  private _buildingLength(rooms: WarmFloorRoom[]): number {
    if (!rooms.length) return 10;
    return rooms.reduce((s, r) => s + r.length / rooms.length, 0) * 3 || 10;
  }
}

// ── Matn tahlillovchi (local parser) ─────────────────────────────────────────

// Xona turi aniqlash — regex asosida, ko'p til
const ROOM_TYPE_RULES: Array<[RegExp, WarmFloorRoom['type']]> = [
  [/hammom|bathroom|ванн|санузел|туалет|c\/u|wc|toilet/i,                              'bathroom'],
  [/oshxona|kitchen|кухн/i,                                                             'kitchen'],
  [/koridor|hallway|холл|коридор|kirish|прихожая|xol/i,                                'hallway'],
  [/garderob|wardrobe|laundry|kir.?chir|прачечная|гардероб|кладовая|omborxona|texnik/i,'auxiliary'],
  [/yotoqxona|bedroom|спальн|master|bola|детск|dam olish|kutubxona/i,                  'living'],
  [/mehmon|zal|living|гостин|ovqat|dining|ofis|qabul/i,                               'living'],
];

function detectRoomType(name: string): WarmFloorRoom['type'] {
  for (const [re, type] of ROOM_TYPE_RULES) {
    if (re.test(name)) return type;
  }
  return 'living';
}

// ── Qavat sarlavha ajratuvchi ──────────────────────────────────────────────────

const WORD_TO_FLOOR: Record<string, number> = {
  birinchi: 1, ikkinchi: 2, uchinchi: 3, tortinchi: 4,
  'первый': 1, 'второй': 2, 'третий': 3, 'четвертый': 4, 'пятый': 5,
  ground: 1, first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
};

// Each pattern: group 1 is the floor number/word
const FLOOR_HEADER_PATTERNS: Array<RegExp> = [
  /(\d+)\s*[-–]\s*(?:qavat|etaj)/i,             // "1-qavat", "1-etaj"
  /(?:^|\s)(\d+)\s+(?:qavat|etaj)/i,            // "1 qavat"
  /(?:^|\s)(\d+)\s*[-–]?(?:й)?\s*этаж/i,       // "1 этаж", "1-й этаж" (no \b — cyrillic)
  /этаж\s+(\d+)/i,                               // "этаж 2"
  /(\d+)(?:st|nd|rd|th)\s*floor/i,              // "1st floor", "2nd floor"
  /floor\s+(\d+)/i,                              // "floor 2"
  /(birinchi|ikkinchi|uchinchi|tortinchi)\s+qavat/i,
  /(первый|второй|третий|четвертый|пятый)\s+этаж/i,
  /(ground|first|second|third|fourth|fifth)\s+floor/i,
];

function tryMatchFloorHeader(text: string): number | null {
  for (const re of FLOOR_HEADER_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    const v = (m[1] || '').toLowerCase().trim();
    if (/^\d+$/.test(v)) return parseInt(v);
    if (WORD_TO_FLOOR[v]) return WORD_TO_FLOOR[v];
  }
  return null;
}

// Inline floor splitter regex — splits at any floor header token
const INLINE_FLOOR_SPLIT = new RegExp(
  '(?=' +
    '\\d+\\s*[-–]\\s*(?:qavat|etaj)' +         // 1-qavat
    '|\\d+\\s+(?:qavat|etaj)' +                // 1 qavat
    '|\\d+\\s*[-–]?(?:й)?\\s*этаж' +           // 1 этаж
    '|этаж\\s+\\d+' +                          // этаж 2
    '|\\d+(?:st|nd|rd|th)\\s*floor' +          // 1st floor
    '|floor\\s+\\d+' +                         // floor 2
    '|(?:birinchi|ikkinchi|uchinchi)\\s+qavat' +
    '|(?:первый|второй|третий)\\s+этаж' +
    '|(?:ground|first|second|third|fourth|fifth)\\s+floor' +
  ')',
  'i'
);

function stripFloorHeader(line: string): string {
  let s = line;
  for (const re of FLOOR_HEADER_PATTERNS) {
    s = s.replace(re, '');
  }
  return s.replace(/^[\s:,;.\-–]+/, '').trim();
}

function splitIntoFloors(desc: string): Array<{ floor: number; text: string }> {
  // Step 1: split text into lines (newlines)
  const lines = desc.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);

  // Step 2: look for floor headers on separate lines
  const lineMarkers: Array<{ lineIdx: number; floor: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const fn = tryMatchFloorHeader(lines[i]);
    if (fn !== null && fn >= 1 && fn <= 20) {
      lineMarkers.push({ lineIdx: i, floor: fn });
    }
  }

  if (lineMarkers.length >= 2) {
    // Agar bir nechta marker bir xil floor raqamiga ega bo'lsa (masalan ground=1, first=1)
    // ularni ketma-ket raqamlaymiz
    const seenFloors = new Set<number>();
    let autoFloor = 1;
    for (const mk of lineMarkers) {
      if (seenFloors.has(mk.floor)) {
        // Duplicate floor number — assign next sequential
        while (seenFloors.has(autoFloor)) autoFloor++;
        mk.floor = autoFloor++;
      } else {
        seenFloors.add(mk.floor);
        autoFloor = mk.floor + 1;
      }
    }

    // Multi-floor structure detected via newlines
    const sections: Array<{ floor: number; text: string }> = [];
    for (let i = 0; i < lineMarkers.length; i++) {
      const start = lineMarkers[i].lineIdx;
      const end   = i + 1 < lineMarkers.length ? lineMarkers[i + 1].lineIdx : lines.length;
      const sectionLines = lines.slice(start, end);
      sectionLines[0] = stripFloorHeader(sectionLines[0]);
      sections.push({ floor: lineMarkers[i].floor, text: sectionLines.join('\n') });
    }
    if (lineMarkers[0].lineIdx > 0) {
      sections.unshift({ floor: 1, text: lines.slice(0, lineMarkers[0].lineIdx).join('\n') });
    }
    return sections;
  }

  // Step 3: try inline splitting (e.g. "1-qavat: ... 2-qavat: ..." all on one line or mixed with dots)
  // Normalize: replace ". N-qavat" with "\nN-qavat" so inline separators become line breaks
  const normalized = desc
    .replace(/\.\s+(?=\d+\s*[-–]\s*(?:qavat|etaj))/gi, '\n')
    .replace(/\.\s+(?=\d+\s*(?:qavat|etaj))/gi, '\n')
    .replace(/\.\s+(?=(?:ground|first|second|third|fourth|fifth)\s+floor)/gi, '\n')
    .replace(/\.\s+(?=(?:birinchi|ikkinchi|uchinchi)\s+qavat)/gi, '\n')
    .replace(/\.\s+(?=(?:первый|второй|третий)\s+этаж)/gi, '\n');

  // Try splitting normalized by INLINE_FLOOR_SPLIT
  const inlineParts = normalized.split(INLINE_FLOOR_SPLIT).filter(p => p.trim().length > 0);
  if (inlineParts.length >= 2) {
    const sections: Array<{ floor: number; text: string }> = [];
    for (const part of inlineParts) {
      const fn = tryMatchFloorHeader(part);
      if (fn !== null) {
        sections.push({ floor: fn, text: stripFloorHeader(part) });
      } else if (sections.length === 0 && part.trim()) {
        // preamble (e.g. "2 qavatli uy.") — skip or treat as floor 1
        // only add if contains dimensions
        if (/\d+\s*[xX×]\s*\d+|\d+\s*(?:m[²2]|м[²2]?|кв\.?м)/i.test(part)) {
          sections.push({ floor: 1, text: part });
        }
      }
    }
    if (sections.length >= 2) return sections;
  }

  // Step 4: single floor — but still use line markers if found
  if (lineMarkers.length === 1) {
    return [{ floor: lineMarkers[0].floor, text: desc }];
  }

  return [{ floor: 1, text: desc }];
}

// ── O'lcham ajratuvchi ─────────────────────────────────────────────────────────

// WxL: 4x5, 4.5 x 5.2, 4,5×5 etc.
const DIM_RE  = /(\d+(?:[.,]\d+)?)\s*[xX×*]\s*(\d+(?:[.,]\d+)?)\s*m?/;
// Area only: 20m², 20m2, 20 кв.м, 20sq.m
const AREA_RE = /(\d+(?:[.,]\d+)?)\s*(?:m[²2²]?|м[²2]?|кв\.?м|sq\.?m)/i;

function parseDimensions(line: string): { w: number; l: number; dimStr: string; areaStr: string } | null {
  const dm = DIM_RE.exec(line);
  if (dm) {
    const w = parseFloat(dm[1].replace(',', '.'));
    const l = parseFloat(dm[2].replace(',', '.'));
    if (w >= 0.5 && w <= 50 && l >= 0.5 && l <= 50) {
      return { w, l, dimStr: dm[0], areaStr: '' };
    }
  }
  const am = AREA_RE.exec(line);
  if (am) {
    const area = parseFloat(am[1].replace(',', '.'));
    if (area >= 1 && area <= 500) {
      const w = +(Math.sqrt(area * 1.2)).toFixed(2);
      const l = +(area / w).toFixed(2);
      return { w, l, dimStr: '', areaStr: am[0] };
    }
  }
  return null;
}

// So'zlar bo'lib xona nomi emasligini ko'rsatuvchi kalit so'zlar
const NOISE_WORDS = new Set([
  'va', 'bor', 'u', 'bu', 'da', 'de', 'ga', 'dan', 'ham', 'esa', 'metr', 'metrda',
  'kerak', 'bizda', 'bizning', 'uyda', 'uyimizda', 'kengligida', 'uzunligida',
  'birinchisi', 'ikkinchisi', 'uchinchisi', 'bunda', 'unda', 'ular',
  'bor', 'xona', 'uchun', 'ulardan', 'hisobida', 'tashkil',
  'и', 'в', 'на', 'у', 'это', 'есть', 'наш', 'нашей',
  'the', 'a', 'an', 'is', 'are', 'has', 'have', 'our', 'we', 'with', 'of', 'there',
]);

function extractRoomName(line: string, dimStr: string, areaStr: string): string {
  let s = line;
  if (dimStr) s = s.replace(dimStr, ' ');
  if (areaStr) s = s.replace(areaStr, ' ');
  // Remove brackets, numbering, units
  s = s.replace(/[()[\]{}]/g, ' ')
       .replace(/\b(?:metr|m|sm|кв|sq)\b\.?/gi, ' ')
       .replace(/^\d+[.):\-\s]+/, '')
       .trim();
  s = s.replace(/\s{2,}/g, ' ').replace(/[,;:.]+$/, '').trim();

  // Noise word filter: agar barcha so'zlar noise bo'lsa — "Xona"
  const words = s.split(/\s+/).filter(w => w.length > 1);
  const meaningful = words.filter(w => !NOISE_WORDS.has(w.toLowerCase()));
  if (meaningful.length === 0) return 'Xona';

  // Maksimal 4 ta so'z — uzun matn qoldig'i nom bo'la olmaydi
  return meaningful.slice(0, 4).join(' ') || 'Xona';
}

/** Matndan xonalar ro'yxatini chiqarish — UZ/RU/EN, har qanday format */
export function parseWarmFloorRooms(description: string): WarmFloorRoom[] {
  const rooms: WarmFloorRoom[] = [];
  let roomNum = 2;

  const sections = splitIntoFloors(description);

  for (const { floor, text } of sections) {
    // Satrga bo'lish: yangi qator, nuqtali vergul, nuqta (agar keyin harf kelsa)
    const rawLines = text.split(/[\n;]+|\.(?=\s+[A-ZА-ЯЎa-zа-яўA-Za-z])/);
    const lines: string[] = [];
    for (const raw of rawLines) {
      // Vergul yoki " va " bilan ajratilgan xonalar
      const subParts = raw.split(/,\s*|\s+(?:va|and|и)\s+(?=\S)/i);
      lines.push(...subParts);
    }

    for (const rawLine of lines) {
      // Qavslarni olib tashlash (masalan "(5.5 x 4.8m)" → "5.5 x 4.8m")
      const line = rawLine.replace(/[()[\]]/g, ' ').trim();
      if (line.length < 2) continue;

      const dim = parseDimensions(line);
      if (!dim) continue;

      const { w, l, dimStr, areaStr } = dim;
      let rawName = extractRoomName(line, dimStr, areaStr);
      // Agar nom floor header bilan boshlanса — headerни olib tashlaymiz
      // masalan "этаж 1: гостиная" → "гостиная"
      for (const re of FLOOR_HEADER_PATTERNS) {
        rawName = rawName.replace(re, '').trim();
      }
      rawName = rawName.replace(/^[\s:,;.-]+/, '').replace(/[\s:,;.-]+$/, '').trim();
      const name = rawName.replace(/^\d+\.?\s*/, '').trim();
      if (!name) continue;

      rooms.push({
        id:     `room-${floor}-${roomNum}`,
        number: roomNum++,
        name:   name || 'Xona',
        width:  Math.round(w * 100) / 100,
        length: Math.round(l * 100) / 100,
        area:   Math.round(w * l * 100) / 100,
        floor,
        type:   detectRoomType(name),
      });
    }
  }

  if (rooms.length === 0) return defaultPdfRooms();
  return rooms;
}

/** PDF dagi real xonalar (Xumson uyi — namuna) */
function defaultPdfRooms(): WarmFloorRoom[] {
  const floor1: Array<{ n: number; name: string; w: number; l: number; type: WarmFloorRoom['type'] }> = [
    { n: 2,  name: 'Mehmon xonasi', w: 5.2,  l: 5.1,  type: 'living'    },
    { n: 3,  name: 'Oshxona',       w: 4.9,  l: 4.96, type: 'kitchen'   },
    { n: 4,  name: 'Zal',           w: 6.0,  l: 6.02, type: 'living'    },
    { n: 5,  name: 'Kir-chir',      w: 2.2,  l: 2.24, type: 'auxiliary' },
    { n: 6,  name: 'Garderob',      w: 1.8,  l: 1.89, type: 'auxiliary' },
    { n: 7,  name: 'Xol',           w: 4.0,  l: 5.57, type: 'hallway'   },
    { n: 8,  name: 'Master yotoq',  w: 4.7,  l: 4.84, type: 'living'    },
    { n: 9,  name: 'C/U Hovli',     w: 2.6,  l: 2.6,  type: 'bathroom'  },
    { n: 10, name: 'C/U Mehmon',    w: 1.8,  l: 1.77, type: 'bathroom'  },
    { n: 11, name: 'C/U Master',    w: 2.1,  l: 2.13, type: 'bathroom'  },
    { n: 12, name: 'C/U Hovli',     w: 1.8,  l: 1.81, type: 'bathroom'  },
  ];

  const floor2: Array<{ n: number; name: string; w: number; l: number; type: WarmFloorRoom['type'] }> = [
    { n: 14, name: 'Master yotoq',  w: 4.7,  l: 5.56, type: 'living'    },
    { n: 15, name: 'Koridor',       w: 2.5,  l: 3.99, type: 'hallway'   },
    { n: 16, name: 'Dam olish',     w: 5.5,  l: 5.78, type: 'living'    },
    { n: 17, name: 'Garderob',      w: 4.0,  l: 4.0,  type: 'auxiliary' },
    { n: 18, name: 'C/U Master',    w: 2.7,  l: 3.42, type: 'bathroom'  },
    { n: 19, name: 'Garderob',      w: 1.2,  l: 1.95, type: 'auxiliary' },
    { n: 20, name: 'C/U',           w: 1.5,  l: 2.29, type: 'bathroom'  },
    { n: 21, name: 'Bolalar xona',  w: 4.0,  l: 4.59, type: 'living'    },
    { n: 22, name: 'Bolalar xona',  w: 4.0,  l: 3.85, type: 'living'    },
    { n: 23, name: 'Garderob',      w: 1.2,  l: 1.93, type: 'auxiliary' },
    { n: 24, name: 'C/U',           w: 1.5,  l: 2.09, type: 'bathroom'  },
    { n: 26, name: 'Kirish',         w: 1.5,  l: 2.47, type: 'hallway'   },
  ];

  return [
    ...floor1.map(r => ({
      id: `room-1-${r.n}`, number: r.n, name: r.name,
      width: r.w, length: r.l, area: +(r.w * r.l).toFixed(2),
      floor: 1, type: r.type,
    })),
    ...floor2.map(r => ({
      id: `room-2-${r.n}`, number: r.n, name: r.name,
      width: r.w, length: r.l, area: +(r.w * r.l).toFixed(2),
      floor: 2, type: r.type,
    })),
  ];
}
