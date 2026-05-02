/**
 * WaterSupplyEngine — Suv ta'minoti tizimi generatsiyasi
 *
 * PDF (Xumson ОВиК) 13-sahifa asosida:
 * - В1  = sovuq suv (cold water)
 * - Т3  = issiq suv (hot water)
 * - Т4  = sirkul (circulation)
 * - Diametrlar: ø20, ø25, ø32 (yuk bo'yicha)
 * - Stoyaklar: xona soniga qarab
 *
 * Standart: SNiP 2.04.01-85, SP 30.13330
 */

// ── Tiplar ────────────────────────────────────────────────────────────────────

export interface WaterRoom {
  id:     string;
  number: number;
  name:   string;
  area:   number;
  floor:  number;
  type:   'bathroom' | 'kitchen' | 'laundry' | 'living' | 'hallway' | 'other';
  fixtures: WaterFixture[];
}

export interface WaterFixture {
  id:       string;
  type:     'sink' | 'toilet' | 'bidet' | 'bathtub' | 'shower' | 'washing_machine' | 'dishwasher' | 'tap' | 'floor_drain' | 'towel_rail';
  nameRu:   string;
  coldWater: boolean;
  hotWater:  boolean;
  drainDiam: 50 | 110;
  riserTag:  string;
  heightMm:  number;
  branchDiamMm: 20 | 25 | 32;
}

// PDF 17-sahifa: koteln xonasidagi jihozlar
export interface WaterEquipment {
  id:      string;
  type:    'boiler' | 'pump_cold' | 'filter_softener' | 'filter_clean' | 'pump_circ' | 'drain_pump' | 'expansion_tank';
  model:   string;
  nameUz:  string;
  inputDiamMm:  20 | 25 | 32;
  outputDiamMm: 20 | 25 | 32;
  elevation:    number;   // m, kotelndan balandligi
}

// Aksonometrik sxema uchun stoyak segment
export interface RiserAxon {
  tag:        string;        // 'В1-1'
  type:       'cold' | 'hot' | 'circ';
  x:          number;        // aksonometrik x pozitsiya
  segments:   Array<{
    fromElevM: number;       // m, pastdan
    toElevM:   number;
    diamMm:    20 | 25 | 32;
    label:     string;       // 'В1-1-ø20'
  }>;
}

export interface WaterRiser {
  id:       string;
  tag:      string;      // 'В1-1', 'Т3-1', 'Т4-1'
  type:     'cold' | 'hot' | 'circ';
  diamMm:   20 | 25 | 32;   // asosiy (pastki) diametr
  segments: Array<{ fromFloor: number; toFloor: number; diamMm: 20 | 25 | 32 }>; // taper bo'limlari
  floors:   number[];
  x:        number;
  y:        number;
}

export interface WaterBranch {
  id:       string;
  riserId:  string;
  roomId:   string;
  floor:    number;
  type:     'cold' | 'hot' | 'circ';
  diamMm:   20 | 25 | 32;
  lengthM:  number;
  fixtures: string[];    // fixture ids
}

export interface WaterFloor {
  floorNumber:  number;
  label:        string;
  elevation:    number;
  rooms:        WaterRoom[];
  branches:     WaterBranch[];
  totalFixtures: number;
}

export interface WaterSupplySchema {
  id:            string;
  name:          string;
  floors:        WaterFloor[];
  risers:        WaterRiser[];
  riserAxons:    RiserAxon[];    // aksonometrik sxema uchun
  equipment:     WaterEquipment[]; // koteln jihozlari (PDF 17)
  boilerTag:     string;
  boilerVolL:    number;
  mainDiamMm:    20 | 25 | 32;
  totalFixtures: number;
  totalRisers:   number;
  buildingHeight: number;   // m, umumiy bino balandligi
  notes:         string[];
}

// ── Fixture heights (mm from floor) — PDF 13-14 sahifa ───────────────────────
const FIXTURE_HEIGHTS: Record<WaterFixture['type'], number> = {
  sink:            550,   // умывальник
  toilet:          230,   // инсталляция
  bidet:           230,   // биде инсталляция
  bathtub:         800,   // смеситель ванны
  shower:          900,   // душ
  washing_machine: 550,
  dishwasher:      450,   // мойка
  tap:             450,
  floor_drain:     0,
  towel_rail:      1000,  // полотенцесушитель — PDF 14-sahifa
};

// ── Fixture catalog ───────────────────────────────────────────────────────────
const FIXTURE_CATALOG: Record<WaterRoom['type'], WaterFixture['type'][]> = {
  bathroom:  ['toilet', 'sink', 'shower', 'towel_rail'],
  kitchen:   ['sink', 'dishwasher', 'tap'],
  laundry:   ['washing_machine', 'sink'],
  living:    [],
  hallway:   [],
  other:     [],
};

// ── Taper diameter: bo'lim uchun yuk bo'yicha (PDF 14: ø32→ø25→ø20) ─────────
function taperDiam(totalFixBelow: number): 20 | 25 | 32 {
  if (totalFixBelow <= 2)  return 20;
  if (totalFixBelow <= 6)  return 25;
  return 32;
}

// ── Branch diameter: xona uchun ───────────────────────────────────────────────
function branchDiam(fixtureCount: number): 20 | 25 | 32 {
  if (fixtureCount <= 1) return 20;
  if (fixtureCount <= 3) return 25;
  return 32;
}

// ── Room type detector ────────────────────────────────────────────────────────
function detectRoomType(name: string): WaterRoom['type'] {
  const n = name.toLowerCase();
  if (/hammom|vanna|туалет|санузел|ванная|bathroom|wc/.test(n))  return 'bathroom';
  if (/oshxona|kitchen|кухня/.test(n))                           return 'kitchen';
  if (/koridor|hallway|коридор|прихожая/.test(n))                return 'hallway';
  if (/laundry|кладовая|prачечная|gigiena/.test(n))              return 'laundry';
  return 'other';
}

// ── Total diameter (main riser at bottom) ─────────────────────────────────────
function selectDiam(fixtureCount: number): 20 | 25 | 32 {
  if (fixtureCount <= 2) return 20;
  if (fixtureCount <= 6) return 25;
  return 32;
}

// ── Parser ────────────────────────────────────────────────────────────────────

export interface WaterRoomInput {
  name:  string;
  area:  number;
  floor: number;
}

export function parseWaterRooms(description: string): WaterRoomInput[] {
  const rooms: WaterRoomInput[] = [];

  // Floor split
  const floorSections = splitByFloors(description);


  for (const { floorNum, text } of floorSections) {
    // Parse room lines: "mehmonxona 25m²", "hammom 8m²", "bathroom 12m2"
    const roomRx = /([a-zA-ZА-Яа-яЎўҚқҒғҲҳ\s''-]+?)\s+(\d+(?:[.,]\d+)?)\s*(?:m[²2²]?|м[²2]?|кв\.?м|sq\.?m)/gi;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = roomRx.exec(text)) !== null) {
      const rawName = m[1].trim().replace(/^[-–—,;:]+|[-–—,;:]+$/g, '').trim();
      if (rawName.length < 2) continue;
      const area = parseFloat(m[2].replace(',', '.'));
      if (area < 1 || area > 500) continue;
      rooms.push({ name: rawName, area, floor: floorNum });
      idx++;
    }

    // Also detect "3 yotoqxona 18m², 15m², 14m²" → 3 bedrooms
    const multiRx = /(\d+)\s+(?:ta\s+)?([a-zA-ZА-Яа-яЎўҚқ\s]+?)\s+((?:\d+(?:[.,]\d+)?\s*(?:m[²2]?|м[²2]?)\s*[,،]\s*)+\d+(?:[.,]\d+)?\s*(?:m[²2]?|м[²2]?))/gi;
    while ((m = multiRx.exec(text)) !== null) {
      const count = parseInt(m[1]);
      const baseName = m[2].trim();
      const areas = m[3].match(/\d+(?:[.,]\d+)?/g) || [];
      for (let i = 0; i < Math.min(count, areas.length); i++) {
        const area = parseFloat(areas[i].replace(',', '.'));
        if (area < 1) continue;
        rooms.push({ name: `${baseName} ${i + 1}`, area, floor: floorNum });
      }
    }
  }

  // Deduplicate by name+floor
  const seen = new Set<string>();
  const deduped = rooms.filter(r => {
    const key = `${r.floor}-${r.name.toLowerCase()}-${r.area}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  // Fallback: if no rooms parsed (no area numbers), detect rooms by keyword
  if (deduped.length === 0) {
    const d = description.toLowerCase();
    // Count bathroom/kitchen mentions
    const bathCount = (d.match(/hammom|vanna|санузел|ванная|туалет|bathroom|wc|bath/g) || []).length;
    const kitchCount = (d.match(/oshxona|kitchen|кухня|кухн/g) || []).length;
    const floorMatch = d.match(/(\d+)\s*(?:qavat|этаж|floor|stor)/);
    const floorCount = floorMatch ? Math.max(1, Math.min(parseInt(floorMatch[1]), 30)) : 1;

    for (let f = 1; f <= floorCount; f++) {
      if (kitchCount > 0) deduped.push({ name: 'Oshxona', area: 15, floor: f });
      if (bathCount > 0)  deduped.push({ name: 'Hammom', area: 6, floor: f });
      // Always add at least one wet room per floor
      if (kitchCount === 0 && bathCount === 0) {
        deduped.push({ name: 'Hammom', area: 6, floor: f });
        deduped.push({ name: 'Oshxona', area: 12, floor: f });
      }
    }
  }

  return deduped;
}

interface FloorSection { floorNum: number; text: string }

function splitByFloors(desc: string): FloorSection[] {
  const patterns = [
    /(\d+)\s*-\s*qavat\s*[-:–]/gi,
    /(\d+)\s*-\s*этаж\s*[-:–]/gi,
    /(\d+)\s*(?:st|nd|rd|th)\s*floor\s*[-:–]/gi,
  ];

  let sections: FloorSection[] = [];

  for (const rx of patterns) {
    const matches = [...desc.matchAll(rx)];
    if (matches.length > 1) {
      for (let i = 0; i < matches.length; i++) {
        const floorNum = parseInt(matches[i][1]);
        const start = (matches[i].index ?? 0) + matches[i][0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index ?? desc.length : desc.length;
        sections.push({ floorNum, text: desc.slice(start, end) });
      }
      return sections;
    }
  }

  // Single floor
  return [{ floorNum: 1, text: desc }];
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class WaterSupplyEngine {

  generate(roomInputs: WaterRoomInput[]): WaterSupplySchema {
    const id = `ws-${Date.now()}`;
    const floorNums = [...new Set(roomInputs.map(r => r.floor))].sort((a, b) => a - b);

    // Build rooms with fixtures
    const allRooms: WaterRoom[] = roomInputs.map((r, i) => {
      const type = detectRoomType(r.name);
      const fixTypes = FIXTURE_CATALOG[type] || [];
      const fixtures: WaterFixture[] = fixTypes.map((ft, fi) => ({
        id:           `f-${i}-${fi}`,
        type:         ft,
        nameRu:       this._fixtureName(ft),
        coldWater:    ft !== 'towel_rail',
        hotWater:     ['sink','bathtub','shower','washing_machine','dishwasher','tap','towel_rail'].includes(ft),
        drainDiam:    ['toilet','bathtub','floor_drain'].includes(ft) ? 110 : 50,
        riserTag:     '',
        heightMm:     FIXTURE_HEIGHTS[ft],
        branchDiamMm: branchDiam(fixTypes.length),
      }));
      return {
        id:       `r-${i}`,
        number:   i + 1,
        name:     r.name,
        area:     r.area,
        floor:    r.floor,
        type,
        fixtures,
      };
    });

    // Build risers per floor group
    const risers: WaterRiser[] = [];
    let riserIdx = 1;

    for (const fn of floorNums) {
      const fRooms = allRooms.filter(r => r.floor === fn);
      const wetRooms = fRooms.filter(r => r.fixtures.length > 0);

      // Group wet rooms into stacks (max 4 fixtures per riser)
      const groups: WaterRoom[][] = [];
      let group: WaterRoom[] = [];
      for (const wr of wetRooms) {
        group.push(wr);
        if (group.reduce((s, r) => s + r.fixtures.length, 0) >= 4) {
          groups.push(group); group = [];
        }
      }
      if (group.length) groups.push(group);

      for (let gi = 0; gi < groups.length; gi++) {
        const g = groups[gi];
        const totalFix = g.reduce((s, r) => s + r.fixtures.length, 0);
        const mainDiam = selectDiam(totalFix);
        const tag = `В1-${riserIdx}`;
        const tagH = `Т3-${riserIdx}`;
        const tagC = `Т4-${riserIdx}`;
        const xPos = (gi + 1) / (groups.length + 1);

        // Taper segments: pastdan tepaga diametr kamayadi (PDF 14: ø32→ø25→ø20)
        const segments = this._buildTaperSegments(floorNums, allRooms.filter(r => g.includes(r)));

        risers.push(
          { id: `rs-cold-${riserIdx}`, tag, type: 'cold', diamMm: mainDiam, segments, floors: floorNums, x: xPos, y: 0 },
          { id: `rs-hot-${riserIdx}`,  tag: tagH, type: 'hot',  diamMm: mainDiam, segments, floors: floorNums, x: xPos + 0.02, y: 0 },
          { id: `rs-circ-${riserIdx}`, tag: tagC, type: 'circ', diamMm: 20, segments: [], floors: floorNums, x: xPos + 0.04, y: 0 },
        );

        // Assign riser tag to fixtures
        for (const room of g) {
          for (const fix of room.fixtures) fix.riserTag = tag;
        }
        riserIdx++;
      }
    }

    // Build floors
    const floors: WaterFloor[] = floorNums.map(fn => {
      const fRooms = allRooms.filter(r => r.floor === fn);
      const branches: WaterBranch[] = fRooms
        .filter(r => r.fixtures.length > 0)
        .map((r, bi) => {
          const fRiser = risers.find(rs => rs.type === 'cold' && rs.floors.includes(fn));
          const diam = selectDiam(r.fixtures.length);
          return {
            id:       `br-${fn}-${bi}`,
            riserId:  fRiser?.id ?? '',
            roomId:   r.id,
            floor:    fn,
            type:     'cold' as const,
            diamMm:   diam,
            lengthM:  Math.round(Math.sqrt(r.area) * 1.5 * 10) / 10,
            fixtures: r.fixtures.map(f => f.id),
          };
        });

      return {
        floorNumber:   fn,
        label:         `${fn}-qavat`,
        elevation:     (fn - 1) * 3.0,
        rooms:         fRooms,
        branches,
        totalFixtures: fRooms.reduce((s, r) => s + r.fixtures.length, 0),
      };
    });

    const totalFixtures = allRooms.reduce((s, r) => s + r.fixtures.length, 0);
    const mainDiam = selectDiam(totalFixtures);
    const buildingHeight = floorNums.length * 3.0 + 0.5;

    // ── PDF 17: Koteln jihozlari ──────────────────────────────────────────────
    const equipment: WaterEquipment[] = [
      { id:'eq-boiler',   type:'boiler',         model:'AI 500/1M_B',      nameUz:'Qozon (bilvosita boyler)',      inputDiamMm:32, outputDiamMm:32, elevation:-0.3  },
      { id:'eq-pump-cw',  type:'pump_cold',      model:'CMBE 5-62',        nameUz:'Sovuq suv nasosi',              inputDiamMm:32, outputDiamMm:32, elevation:-0.1  },
      { id:'eq-filt-s',   type:'filter_softener',model:'BWT AQA perla-20', nameUz:'Suv yumshatish filtri (BWT)',   inputDiamMm:25, outputDiamMm:25, elevation: 0.2  },
      { id:'eq-filt-c',   type:'filter_clean',   model:'MULTI 2000 C',     nameUz:'Suv tozalash filtri',           inputDiamMm:25, outputDiamMm:25, elevation: 0.4  },
      { id:'eq-pump-hr',  type:'pump_circ',      model:'Grundfos UP',      nameUz:'Sirkul nasosi (T4)',             inputDiamMm:20, outputDiamMm:20, elevation: 0.6  },
    ];

    // ── Aksonometrik riser sxemasi (PDF 17 uslubi) ───────────────────────────
    const riserAxons: RiserAxon[] = [];
    const coldRisers = risers.filter(r => r.type === 'cold');
    const hotRisers  = risers.filter(r => r.type === 'hot');
    const circRisers = risers.filter(r => r.type === 'circ');

    [...coldRisers, ...hotRisers, ...circRisers].forEach((rs, ri) => {
      const segs = rs.segments.length > 0 ? rs.segments.map(seg => ({
        fromElevM: (seg.fromFloor - 1) * 3.0,
        toElevM:   (seg.toFloor   - 1) * 3.0,
        diamMm:    seg.diamMm,
        label:     `${rs.tag}-ø${seg.diamMm}`,
      })) : [{
        fromElevM: 0,
        toElevM:   buildingHeight,
        diamMm:    rs.diamMm,
        label:     `${rs.tag}-ø${rs.diamMm}`,
      }];
      riserAxons.push({ tag: rs.tag, type: rs.type, x: ri, segments: segs });
    });

    return {
      id,
      name:     'Suv ta\'minoti sxemasi',
      floors,
      risers,
      riserAxons,
      equipment,
      boilerTag:     'AI 500/1M_B',
      boilerVolL:    500,
      mainDiamMm:    mainDiam,
      totalFixtures,
      totalRisers:   riserIdx - 1,
      buildingHeight,
      notes: [
        'Quvurlar: PPR PN 20',
        'Tarmoqlar Energoflex issiqlik izolyatsiyasida',
        'Balandliklar: lavabo 550mm, moy 450mm, vanna 800mm, dush 900mm, polotentse 1000mm',
        'Biriktirishlar armaturalangan lenta bilan yelimlangan',
        'Suv yumshatish: BWT AQA perla-20 (qattiqlik < 3°dH)',
        'Sovuq suv nasosi: CMBE 5-62',
      ],
    };
  }

  // Taper segments: har qavat uchun uning ustidagi umumiy yukka qarab diam
  private _buildTaperSegments(
    floorNums: number[],
    groupRooms: WaterRoom[],
  ): Array<{ fromFloor: number; toFloor: number; diamMm: 20 | 25 | 32 }> {
    if (floorNums.length <= 1) return [];

    // Har qavat uchun o'sha qavat + ustidagi qavatlar yuki
    const segments: Array<{ fromFloor: number; toFloor: number; diamMm: 20 | 25 | 32 }> = [];

    for (let i = 0; i < floorNums.length; i++) {
      const fn = floorNums[i];
      // Bu segment: fn qavatdan fn+1 gacha
      const nextFn = floorNums[i + 1];
      if (!nextFn) break;

      // Yuk = shu qavat va undan yuqori qavatlar uchun
      const fixturesAbove = groupRooms
        .filter(r => r.floor >= fn)
        .reduce((s, r) => s + r.fixtures.length, 0);

      segments.push({
        fromFloor: fn,
        toFloor:   nextFn,
        diamMm:    taperDiam(fixturesAbove),
      });
    }

    return segments;
  }

  private _fixtureName(type: WaterFixture['type']): string {
    const names: Record<WaterFixture['type'], string> = {
      sink:            'Lavabo keramik',
      toilet:          'Unitaz (instaall.)',
      bidet:           'Bide (instaall.)',
      bathtub:         'Vanna',
      shower:          'Dush tizimi (termostatli)',
      washing_machine: 'Kir yuvish mashinasi',
      dishwasher:      'Idish yuvish mashinasi',
      tap:             'Oshxona kranlari',
      floor_drain:     'Pol trapi',
      towel_rail:      'Sochiq isitgich',
    };
    return names[type] || type;
  }
}
