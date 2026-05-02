/**
 * StormDrainEngine — Ливнёвка (yomg'ir suvi kanalizatsiyasi)
 *
 * PDF (Xumson ОВиК) 15-sahifa asosida:
 * - Trap qabul nuqtalari (tom, balkon, terras)
 * - ø110 tarmoq quvurlar (i=2%)
 * - ø160 magistral quvur (i=1%)
 * - Vertikal stoyaklar (tom trapidan pastga)
 * - Chiqish: ochiq grunt yoki kollektor
 *
 * Standart: SP 32.13330, SNiP 2.04.03-85
 */

// ── Tiplar ────────────────────────────────────────────────────────────────────

export interface StormTrap {
  id:        string;
  number:    number;          // 3-12 (PDF 15-sahifa pozitsiyalari)
  type:      'roof' | 'balcony' | 'terrace' | 'parking' | 'yard';
  nameRu:    string;
  floor:     number;
  areaM2:    number;          // yomg'ir suv yig'iladigan maydon
  flowLps:   number;          // hisoblangan oqim l/s
  branchDiam: 110 | 160;
  riserTag:  string;
  x:         number;          // nisbiy pozitsiya 0-1
  y:         number;
}

export interface StormRiser {
  id:      string;
  tag:     string;            // 'СД-1', 'СД-2'
  floors:  number[];
  diamMm:  110 | 160;
  x:       number;
  y:       number;
}

export interface StormBranch {
  id:       string;
  fromTrap: string;
  toRiser:  string;
  floor:    number;
  diamMm:   110 | 160;
  slope:    1 | 2;            // % qiya
  lengthM:  number;
}

export interface StormFloor {
  floorNumber: number;
  label:       string;
  elevation:   number;
  traps:       StormTrap[];
  branches:    StormBranch[];
  totalFlowLps: number;
}

export interface StormDrainSchema {
  id:            string;
  name:          string;
  floors:        StormFloor[];
  risers:        StormRiser[];
  mainDiamMm:    110 | 160;
  mainSlopePct:  1 | 2;
  outletType:    'ground' | 'collector' | 'well';
  outletTag:     string;
  totalTraps:    number;
  totalFlowLps:  number;
  notes:         string[];
}

// ── Hisoblash konstantalari ───────────────────────────────────────────────────
// Qozon qiyasi: q = A * i * ψ  (A=maydon m², i=intensivlik 0.02 l/(s·m²), ψ=0.95 tom)
const RAIN_INTENSITY = 0.02;  // l/(s·m²) — O'zbekiston uchun
const RUNOFF_COEFF: Record<StormTrap['type'], number> = {
  roof:     0.95,
  balcony:  0.90,
  terrace:  0.85,
  parking:  0.80,
  yard:     0.30,
};

function calcFlow(area: number, type: StormTrap['type']): number {
  return Math.round(area * RAIN_INTENSITY * RUNOFF_COEFF[type] * 100) / 100;
}

function selectDiam(flowLps: number): 110 | 160 {
  return flowLps > 8 ? 160 : 110;
}

function trapName(type: StormTrap['type']): string {
  const N: Record<StormTrap['type'], string> = {
    roof:     'Tom trapi',
    balcony:  'Balkon trapi',
    terrace:  'Terras trapi',
    parking:  'Avto turargoh trapi',
    yard:     'Hovli trapi',
  };
  return N[type];
}

// ── Input parser ──────────────────────────────────────────────────────────────

export interface StormRoomInput {
  name:  string;
  area:  number;
  floor: number;
}

export function parseStormRooms(description: string): StormRoomInput[] {
  const rooms: StormRoomInput[] = [];
  const floorSections = splitByFloors(description);

  for (const { floorNum, text } of floorSections) {
    const roomRx = /([a-zA-ZА-Яа-яЎўҚқҒғҲҳ\s''-]+?)\s+(\d+(?:[.,]\d+)?)\s*(?:m[²2²]?|м[²2]?|кв\.?м|sq\.?m)/gi;
    let m: RegExpExecArray | null;
    while ((m = roomRx.exec(text)) !== null) {
      const rawName = m[1].trim().replace(/^[-–—,;:]+|[-–—,;:]+$/g, '').trim();
      if (rawName.length < 2) continue;
      const area = parseFloat(m[2].replace(',', '.'));
      if (area < 1 || area > 2000) continue;
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

function detectTrapType(name: string): StormTrap['type'] {
  const n = name.toLowerCase();
  if (/tom|кровля|roof|krisha/.test(n))           return 'roof';
  if (/balkon|балкон|balcony/.test(n))             return 'balcony';
  if (/terras|терраса|terrace/.test(n))            return 'terrace';
  if (/parking|парковка|стоянка|avto/.test(n))     return 'parking';
  if (/hovli|двор|yard|aylan/.test(n))             return 'yard';
  // Agar alohida nom bo'lmasa — maydon bo'yicha taxmin
  return 'roof';
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

export class StormDrainEngine {

  generate(roomInputs: StormRoomInput[]): StormDrainSchema {
    const id = `sd-${Date.now()}`;

    // Agar input bo'sh — default: 2 qavat tom + balkon
    if (!roomInputs.length) {
      roomInputs = [
        { name: 'Tom', area: 120, floor: 2 },
        { name: 'Balkon', area: 15, floor: 2 },
        { name: 'Terras', area: 30, floor: 1 },
      ];
    }

    const floorNums = [...new Set(roomInputs.map(r => r.floor))].sort((a, b) => a - b);
    let trapIdx = 1;
    let riserIdx = 1;

    const allTraps: StormTrap[] = [];
    const risers: StormRiser[] = [];

    // Har qavat uchun traplar
    for (const fn of floorNums) {
      const fRooms = roomInputs.filter(r => r.floor === fn);

      // Har 3 trap uchun 1 stoyak
      const groups: StormRoomInput[][] = [];
      let g: StormRoomInput[] = [];
      for (const r of fRooms) {
        g.push(r);
        if (g.length >= 3) { groups.push(g); g = []; }
      }
      if (g.length) groups.push(g);

      for (const grp of groups) {
        const totalFlow = grp.reduce((s, r) => s + calcFlow(r.area, detectTrapType(r.name)), 0);
        const rDiam = selectDiam(totalFlow);
        const tag = `СД-${riserIdx}`;

        risers.push({
          id:     `rs-${riserIdx}`,
          tag,
          floors: floorNums,
          diamMm: rDiam,
          x:      (riserIdx) / (groups.length + 1),
          y:      0,
        });

        grp.forEach((r, ri) => {
          const type = detectTrapType(r.name);
          const flow = calcFlow(r.area, type);
          allTraps.push({
            id:          `trap-${trapIdx}`,
            number:      trapIdx + 2,  // PDF 15: pozitsiyalar 3dan boshlanadi
            type,
            nameRu:      trapName(type),
            floor:       fn,
            areaM2:      r.area,
            flowLps:     flow,
            branchDiam:  selectDiam(flow),
            riserTag:    tag,
            x:           (riserIdx - 1 + (ri + 1) / (grp.length + 1)) / (groups.length),
            y:           0,
          });
          trapIdx++;
        });
        riserIdx++;
      }
    }

    // Qavat sxemalari
    const floors: StormFloor[] = floorNums.map(fn => {
      const fTraps = allTraps.filter(t => t.floor === fn);
      const branches: StormBranch[] = fTraps.map((trap, bi) => {
        const riser = risers.find(rs => rs.tag === trap.riserTag);
        return {
          id:       `br-${fn}-${bi}`,
          fromTrap: trap.id,
          toRiser:  riser?.id ?? '',
          floor:    fn,
          diamMm:   trap.branchDiam,
          slope:    2,
          lengthM:  Math.round(Math.sqrt(trap.areaM2) * 1.2 * 10) / 10,
        };
      });

      return {
        floorNumber:  fn,
        label:        `${fn}-qavat`,
        elevation:    (fn - 1) * 3.0,
        traps:        fTraps,
        branches,
        totalFlowLps: Math.round(fTraps.reduce((s, t) => s + t.flowLps, 0) * 100) / 100,
      };
    });

    const totalFlow = Math.round(allTraps.reduce((s, t) => s + t.flowLps, 0) * 100) / 100;
    const mainDiam: 110 | 160 = totalFlow > 12 ? 160 : 110;

    return {
      id,
      name:         'Ливнёвка (yomg\'ir suvi kanalizatsiyasi)',
      floors,
      risers,
      mainDiamMm:   mainDiam,
      mainSlopePct: 1,
      outletType:   'ground',
      outletTag:    'Grunt/kollektor',
      totalTraps:   allTraps.length,
      totalFlowLps: totalFlow,
      notes: [
        'Quvurlar: NPVX (tashqi kanalizatsiya)',
        `Qiya: tarmoq ø110→i=2%, magistral ø${mainDiam}→i=1%`,
        'Tom traplari: cho\'yan yoki zanglamaydigan po\'lat',
        'Biriktirishlar: rezinoviy muftali qo\'ng\'iroqsimon',
        'Reviziya: Du110, har stoyakda 400×400mm lyuk',
        `Hisoblangan oqim: q=${totalFlow} l/s (intensivlik 0.02 l/(s·m²))`,
      ],
    };
  }
}
