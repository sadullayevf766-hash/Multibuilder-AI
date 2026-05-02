/**
 * SewageEngine — Kanalizatsiya tizimi generatsiyasi
 *
 * PDF (Xumson ОВиК) 10-12-sahifalar asosida:
 * - К1 stoyaklar (ø110)
 * - Gorizontal quvurlar ø50 (lavabo, dush) va ø110 (unitaz, vanna)
 * - Qiya: ø50 → 3sm/m, ø110 → 2sm/m
 * - Reviziya lyuklari 400×400 mm
 *
 * Standart: SNiP 2.04.03-85, SP 32.13330
 */

// ── Tiplar ────────────────────────────────────────────────────────────────────

export interface SewageFixture {
  id:        string;
  type:      'toilet' | 'sink' | 'bathtub' | 'shower' | 'floor_drain' | 'bidet' | 'washing_machine' | 'dishwasher';
  nameRu:    string;
  pipeDiam:  50 | 110;
  slope:     2 | 3;      // sm/m
  heightMm:  number;     // outlet height
  riserTag:  string;
}

export interface SewageRoom {
  id:       string;
  number:   number;
  name:     string;
  area:     number;
  floor:    number;
  type:     'bathroom' | 'kitchen' | 'laundry' | 'other';
  fixtures: SewageFixture[];
}

export interface SewageRiser {
  id:       string;
  tag:      string;   // 'К1-1', 'К1-2'
  diamMm:   110;
  floors:   number[];
  ventTag:  string;   // 'Ст К1 1-ø110'
  x:        number;
  y:        number;
}

export interface SewageBranch {
  id:       string;
  riserId:  string;
  roomId:   string;
  floor:    number;
  diamMm:   50 | 110;
  slope:    2 | 3;
  lengthM:  number;
  fixtures: string[];
}

export interface SewageRevision {
  id:     string;
  floor:  number;
  riserTag: string;
  size:   '400x400';
  heightMm: number;
}

// PDF 16: drenaj nasosi va aksonometrik ma'lumotlar
export interface DrainPump {
  id:       string;
  model:    string;           // 'UNILIFT KP 250-A1'
  nameUz:   string;
  elevation: number;          // m, -1.360 (yerto'la)
  pipeDiam: 50 | 90 | 110;
}

export interface SewageAxonSegment {
  riserTag:   string;
  fromElevM:  number;
  toElevM:    number;
  diamMm:     50 | 110;
  slope:      2 | 3;
  ventAbove:  boolean;   // tepasida ø50 vent stoyak
}

export interface SewageFloor {
  floorNumber:   number;
  label:         string;
  elevation:     number;
  rooms:         SewageRoom[];
  branches:      SewageBranch[];
  revisions:     SewageRevision[];
  totalFixtures: number;
}

export interface SewageSchema {
  id:            string;
  name:          string;
  floors:        SewageFloor[];
  risers:        SewageRiser[];
  axonSegments:  SewageAxonSegment[];   // aksonometrik sxema uchun
  drainPumps:    DrainPump[];           // PDF 16: drenaj nasosi
  mainOutletDiam: 110;
  mainOutletSlope: 2;
  pitTag:        string;
  buildingHeight: number;              // m
  totalFixtures: number;
  totalRisers:   number;
  specItems:     SewageSpecItem[];
  notes:         string[];
}

export interface SewageSpecItem {
  pos:      number;
  nameRu:   string;
  qty:      number;
  unit:     string;
}

// ── Fixture catalog ───────────────────────────────────────────────────────────
const SEWER_FIXTURES: Record<SewageRoom['type'], SewageFixture['type'][]> = {
  bathroom: ['toilet', 'sink', 'shower'],
  kitchen:  ['sink', 'dishwasher'],
  laundry:  ['washing_machine', 'sink'],
  other:    [],
};

const FIXTURE_META: Record<SewageFixture['type'], { diam: 50|110; slope: 2|3; height: number; nameRu: string }> = {
  toilet:          { diam: 110, slope: 2, height: 230,  nameRu: 'Unitaz (instaall.)' },
  sink:            { diam: 50,  slope: 3, height: 500,  nameRu: 'Lavabo keramik' },
  bathtub:         { diam: 50,  slope: 3, height: 0,    nameRu: 'Vanna' },
  shower:          { diam: 50,  slope: 3, height: 0,    nameRu: 'Dush profili (TECE)' },
  floor_drain:     { diam: 110, slope: 2, height: 0,    nameRu: 'Pol trapi' },
  bidet:           { diam: 50,  slope: 3, height: 230,  nameRu: 'Bide (instaall.)' },
  washing_machine: { diam: 50,  slope: 3, height: 600,  nameRu: 'Kir yuvish mashinasi' },
  dishwasher:      { diam: 50,  slope: 3, height: 450,  nameRu: 'Idish yuvish mashinasi' },
};

// ── Room type detector ────────────────────────────────────────────────────────
function detectType(name: string): SewageRoom['type'] {
  const n = name.toLowerCase();
  if (/hammom|vanna|туалет|санузел|ванная|bathroom|wc/.test(n)) return 'bathroom';
  if (/oshxona|kitchen|кухня/.test(n))                          return 'kitchen';
  if (/laundry|кладовая|прачечная/.test(n))                     return 'laundry';
  return 'other';
}

// ── Parser (reuses logic from WaterSupplyEngine) ──────────────────────────────
export interface SewageRoomInput {
  name:  string;
  area:  number;
  floor: number;
}

export function parseSewageRooms(description: string): SewageRoomInput[] {
  const rooms: SewageRoomInput[] = [];
  const floorSections = splitByFloors(description);

  for (const { floorNum, text } of floorSections) {
    const roomRx = /([a-zA-ZА-Яа-яЎўҚқҒғҲҳ\s''-]+?)\s+(\d+(?:[.,]\d+)?)\s*(?:m[²2²]?|м[²2]?|кв\.?м|sq\.?m)/gi;
    let m: RegExpExecArray | null;
    while ((m = roomRx.exec(text)) !== null) {
      const rawName = m[1].trim().replace(/^[-–—,;:]+|[-–—,;:]+$/g, '').trim();
      if (rawName.length < 2) continue;
      const area = parseFloat(m[2].replace(',', '.'));
      if (area < 1 || area > 500) continue;
      rooms.push({ name: rawName, area, floor: floorNum });
    }
  }

  const seen = new Set<string>();
  return rooms.filter(r => {
    const key = `${r.floor}-${r.name.toLowerCase()}-${r.area}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

function splitByFloors(desc: string): Array<{ floorNum: number; text: string }> {
  const rx = /(\d+)\s*-\s*(?:qavat|этаж|floor)\s*[-:–]/gi;
  const matches = [...desc.matchAll(rx)];
  if (matches.length > 1) {
    return matches.map((match, i) => ({
      floorNum: parseInt(match[1]),
      text: desc.slice(
        (match.index ?? 0) + match[0].length,
        i + 1 < matches.length ? matches[i + 1].index ?? desc.length : desc.length
      ),
    }));
  }
  return [{ floorNum: 1, text: desc }];
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class SewageEngine {

  generate(roomInputs: SewageRoomInput[]): SewageSchema {
    const id = `sew-${Date.now()}`;
    const floorNums = [...new Set(roomInputs.map(r => r.floor))].sort((a, b) => a - b);

    // Build rooms with fixtures
    const allRooms: SewageRoom[] = roomInputs.map((r, i) => {
      const type = detectType(r.name);
      const fixTypes = SEWER_FIXTURES[type] || [];
      const fixtures: SewageFixture[] = fixTypes.map((ft, fi) => {
        const meta = FIXTURE_META[ft];
        return {
          id:       `sf-${i}-${fi}`,
          type:     ft,
          nameRu:   meta.nameRu,
          pipeDiam: meta.diam,
          slope:    meta.slope,
          heightMm: meta.height,
          riserTag: '',
        };
      });
      return { id: `sr-${i}`, number: i + 1, name: r.name, area: r.area, floor: r.floor, type, fixtures };
    });

    // Build risers — one per wet room group (max 3 wet rooms per riser)
    const risers: SewageRiser[] = [];
    let rIdx = 1;

    for (const fn of floorNums) {
      const fRooms = allRooms.filter(r => r.floor === fn && r.fixtures.length > 0);
      const groups: SewageRoom[][] = [];
      let g: SewageRoom[] = [];
      for (const wr of fRooms) {
        g.push(wr);
        if (g.length >= 3) { groups.push(g); g = []; }
      }
      if (g.length) groups.push(g);

      for (let gi = 0; gi < groups.length; gi++) {
        const tag = `К1-${rIdx}`;
        const xPos = (gi + 1) / (groups.length + 1);
        risers.push({
          id:      `rs-${rIdx}`,
          tag,
          diamMm:  110,
          floors:  floorNums,
          ventTag: `Ст К1 ${rIdx}-ø110`,
          x:       xPos,
          y:       0,
        });
        for (const room of groups[gi]) {
          for (const fix of room.fixtures) fix.riserTag = tag;
        }
        rIdx++;
      }
    }

    // Build floors
    const floors: SewageFloor[] = floorNums.map(fn => {
      const fRooms = allRooms.filter(r => r.floor === fn);
      const wetRooms = fRooms.filter(r => r.fixtures.length > 0);

      const branches: SewageBranch[] = wetRooms.map((r, bi) => {
        // Dominant diameter: if has toilet/bathtub → 110, else 50
        const has110 = r.fixtures.some(f => f.pipeDiam === 110);
        const diam = has110 ? 110 : 50;
        const slope = has110 ? 2 : 3;
        const riser = risers.find(rs => rs.floors.includes(fn) && r.fixtures[0]?.riserTag === rs.tag);
        return {
          id:       `br-${fn}-${bi}`,
          riserId:  riser?.id ?? '',
          roomId:   r.id,
          floor:    fn,
          diamMm:   diam,
          slope,
          lengthM:  Math.round(Math.sqrt(r.area) * 1.8 * 10) / 10,
          fixtures: r.fixtures.map(f => f.id),
        };
      });

      // Revisions — one per riser on this floor
      const floorRisers = risers.filter(rs => rs.floors.includes(fn));
      const revisions: SewageRevision[] = floorRisers.map((rs, ri) => ({
        id:       `rev-${fn}-${ri}`,
        floor:    fn,
        riserTag: rs.tag,
        size:     '400x400' as const,
        heightMm: 600,
      }));

      return {
        floorNumber:   fn,
        label:         `${fn}-qavat`,
        elevation:     (fn - 1) * 3.0,
        rooms:         fRooms,
        branches,
        revisions,
        totalFixtures: fRooms.reduce((s, r) => s + r.fixtures.length, 0),
      };
    });

    const totalFixtures = allRooms.reduce((s, r) => s + r.fixtures.length, 0);
    const buildingHeight = floorNums.length * 3.0 + 0.5;

    // ── PDF 16: Drenaj nasosi (yerto'la bo'lsa) ──────────────────────────────
    const drainPumps: DrainPump[] = [];
    const hasBasement = floorNums[0] === 0 || buildingHeight > 6 || floorNums.length >= 2;
    if (hasBasement) {
      drainPumps.push({
        id:        'dp-1',
        model:     'UNILIFT KP 250-A1',
        nameUz:    'Drenaj nasosi (yerto\'la)',
        elevation: -1.36,
        pipeDiam:  110,
      });
    }

    // ── Aksonometrik segmentlar (PDF 16 uslubi) ───────────────────────────────
    const axonSegments: SewageAxonSegment[] = risers.map(rs => ({
      riserTag:  rs.tag,
      fromElevM: -0.5,
      toElevM:   buildingHeight,
      diamMm:    110,
      slope:     2,
      ventAbove: true,   // har stoyak tepasida ø50 vent chiqadi
    }));

    // Specification
    const specMap = new Map<string, SewageSpecItem>();
    for (const room of allRooms) {
      for (const fix of room.fixtures) {
        const key = fix.nameRu;
        if (specMap.has(key)) specMap.get(key)!.qty++;
        else specMap.set(key, { pos: specMap.size + 1, nameRu: fix.nameRu, qty: 1, unit: 'шт' });
      }
    }

    return {
      id,
      name:              'Kanalizatsiya sxemasi',
      floors,
      risers,
      mainOutletDiam:    110,
      mainOutletSlope:   2,
      pitTag:            'Kanalizatsiya chuquriga',
      buildingHeight,
      totalFixtures,
      totalRisers:       rIdx - 1,
      specItems:         [...specMap.values()],
      axonSegments,
      drainPumps,
      notes: [
        'Quvurlar qiyasi: ø50→3sm/m, ø110→2sm/m',
        'Chiqish balandligi: lavabo 500mm, instaall. unitaz 230mm',
        'Qo\'ng\'iroqlar suv oqimi qarshi yo\'nalishda',
        'Burilishlar: 2×45° (90° emas)',
        'Reviziya Du110, 400×400mm lyuk',
        'Drenaj nasosi: UNILIFT KP 250-A1 (yerto\'la)',
      ],
    };
  }
}
