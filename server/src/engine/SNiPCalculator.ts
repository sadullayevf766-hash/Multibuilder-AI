/**
 * SNiP 2.04.01-85 (SP 30.13330.2020) bo'yicha santexnika hisob-kitob
 *
 * Asosiy formulalar:
 *   q = 5 * q0 * sqrt(N * P)    — normal suv sarfi (l/s)
 *   P = qhr_u / (3600 * q0 * N) — ehtimol koeffitsiyenti
 *
 * Diametr jadval (SNiP jadval 3): v_max = 2.5 m/s (cold), 1.5 m/s (hot)
 * d = sqrt(4q / (π * v)) → mm ga o'girib, standart katakdan katta ni tanlaymiz
 */

export type PipeType = 'cold' | 'hot' | 'drain';
export type FixtureType =
  | 'toilet' | 'sink' | 'bathtub' | 'shower' | 'bidet'
  | 'washing_machine' | 'dishwasher' | 'kitchen_sink' | 'floor_drain'
  | 'towel_rail' | 'tap';

// ── SNiP jadval 1: Jihoz uchun soatlik suv sarfi (l/s) va ehtimol hisob ──────

interface FixtureFlow {
  q0_cold: number;   // bitta jihoz sovuq suv sarfi (l/s)
  q0_hot:  number;   // bitta jihoz issiq suv sarfi (l/s)
  qhr:     number;   // soatlik sarfida o'rtacha 1 jihoz (l/soat) — isteʼmolchi turi uchun
  drain:   number;   // kanalizatsiya sarfi (l/s)
  drainDiamMm: number; // minimal drain diametr
}

export const FIXTURE_FLOWS: Record<FixtureType, FixtureFlow> = {
  toilet:          { q0_cold: 0.10, q0_hot: 0,    qhr: 84,  drain: 1.6,  drainDiamMm: 110 },
  sink:            { q0_cold: 0.09, q0_hot: 0.09,  qhr: 60,  drain: 0.6,  drainDiamMm: 50  },
  kitchen_sink:    { q0_cold: 0.09, q0_hot: 0.09,  qhr: 90,  drain: 0.6,  drainDiamMm: 50  },
  bathtub:         { q0_cold: 0.18, q0_hot: 0.18,  qhr: 200, drain: 1.1,  drainDiamMm: 50  },
  shower:          { q0_cold: 0.12, q0_hot: 0.12,  qhr: 120, drain: 0.8,  drainDiamMm: 50  },
  bidet:           { q0_cold: 0.08, q0_hot: 0.08,  qhr: 40,  drain: 0.4,  drainDiamMm: 50  },
  washing_machine: { q0_cold: 0.25, q0_hot: 0,     qhr: 100, drain: 0.8,  drainDiamMm: 50  },
  dishwasher:      { q0_cold: 0.20, q0_hot: 0,     qhr: 80,  drain: 0.6,  drainDiamMm: 50  },
  floor_drain:     { q0_cold: 0,    q0_hot: 0,     qhr: 0,   drain: 0.5,  drainDiamMm: 50  },
  towel_rail:      { q0_cold: 0,    q0_hot: 0.05,  qhr: 10,  drain: 0,    drainDiamMm: 50  },
  tap:             { q0_cold: 0.10, q0_hot: 0,     qhr: 50,  drain: 0.3,  drainDiamMm: 50  },
};

// ── SNiP jadval 3: Standart quvur diamerlari ──────────────────────────────────

const STANDARD_DIAMS_PRESSURE = [15, 20, 25, 32, 40, 50, 65, 80, 100, 125, 150];
const STANDARD_DIAMS_DRAIN    = [50, 75, 100, 110, 150, 200];

// ── Hisob funksiyalari ────────────────────────────────────────────────────────

/**
 * N ta jihozdan q0 sarfli bitta tip uchun umumiy sarfni hisoblaydi (l/s)
 * SNiP formula: q = 5 * q0 * alpha(N, P)
 * Soddalashtirilgan: alpha jadvaldan interpolatsiya
 */
export function calcFlowRate(N: number, q0: number, P = 0.01): number {
  if (N === 0 || q0 === 0) return 0;
  // SNiP jadval 2: N*P bo'yicha alpha koeffitsiyentlari (interpolatsiya)
  const NP = N * P;
  const alpha = getAlpha(NP);
  return 5 * q0 * alpha;
}

function getAlpha(NP: number): number {
  // SNiP jadval 2 — muxtasar versiya (to'liq jadval 0.01 dan 200 gacha)
  const table: Array<[number, number]> = [
    [0.01, 0.200], [0.02, 0.260], [0.03, 0.303], [0.04, 0.339],
    [0.05, 0.370], [0.06, 0.398], [0.08, 0.447], [0.10, 0.491],
    [0.20, 0.636], [0.30, 0.754], [0.40, 0.854], [0.50, 0.944],
    [0.60, 1.028], [0.70, 1.106], [0.80, 1.181], [1.00, 1.323],
    [1.50, 1.648], [2.00, 1.952], [3.00, 2.524], [4.00, 3.071],
    [5.00, 3.601], [8.00, 5.148], [10.0, 6.312], [20.0, 11.99],
    [50.0, 28.55], [100., 55.65], [200., 109.4],
  ];

  if (NP <= table[0][0]) return table[0][1];
  if (NP >= table[table.length - 1][0]) return table[table.length - 1][1];

  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i];
    const [x1, y1] = table[i + 1];
    if (NP >= x0 && NP <= x1) {
      return y0 + (y1 - y0) * (NP - x0) / (x1 - x0);
    }
  }
  return 1.0;
}

/**
 * Bosim quvuri diametrini hisoblaydi (d, mm)
 * v_max = 1.5 m/s (issiq) yoki 2.0 m/s (sovuq) — magistral
 *       = 2.5 m/s — branch
 */
export function calcPressureDiam(flowLs: number, vMax = 2.0): number {
  if (flowLs <= 0) return 15;
  const flowM3s = flowLs / 1000;
  const area = flowM3s / vMax; // m²
  const diamM = Math.sqrt(4 * area / Math.PI);
  const diamMm = diamM * 1000;
  return roundUpToStandard(diamMm, STANDARD_DIAMS_PRESSURE);
}

/**
 * Kanalizatsiya quvuri diametrini hisoblaydi
 * SNiP: q_drain, qiyalik 0.008–0.02, v >= 0.7 m/s
 */
export function calcDrainDiam(drainFlowLs: number): number {
  if (drainFlowLs <= 0) return 50;
  // Manning + eng yaqin standart (soddalashtirilgan)
  if (drainFlowLs <= 0.8) return 50;
  if (drainFlowLs <= 2.0) return 75;
  if (drainFlowLs <= 5.0) return 100;
  if (drainFlowLs <= 8.0) return 110;
  if (drainFlowLs <= 15.)  return 150;
  return 200;
}

function roundUpToStandard(diam: number, standards: number[]): number {
  for (const d of standards) {
    if (d >= diam) return d;
  }
  return standards[standards.length - 1];
}

// ── To'liq loyiha hisob-kitob ─────────────────────────────────────────────────

export interface PipeCalcResult {
  pipeId: string;
  oldDiamMm: number;
  newDiamMm: number;
  flowLs: number;
  fixtureCount: number;
  note: string;
}

export interface ProjectCalcResult {
  pipes: PipeCalcResult[];
  mainColdDiamMm: number;
  mainHotDiamMm: number;
  notes: string[];
}

/**
 * Loyiha uchun barcha quvur diametrlarini qayta hisoblaydi
 * P (ehtimol) = 0.012 — ko'p qavatli turar-joy uchun
 */
export function calcProjectDiameters(
  fixtures: Array<{ id: string; type: FixtureType; floor: number; roomId: string }>,
  pipes: Array<{ id: string; type: string; diamMm: number; floor: number; isRiser: boolean; isMain: boolean }>,
  floorCount: number,
  P = 0.012,
): ProjectCalcResult {
  const results: PipeCalcResult[] = [];
  const notes: string[] = [];

  // Jihozlar bo'yicha sarflar
  const totalColdN  = fixtures.filter(f => FIXTURE_FLOWS[f.type]?.q0_cold > 0).length;
  const totalHotN   = fixtures.filter(f => FIXTURE_FLOWS[f.type]?.q0_hot  > 0).length;
  const totalDrainN = fixtures.filter(f => FIXTURE_FLOWS[f.type]?.drain   > 0).length;

  // O'rtacha q0 (weighted average)
  const q0_cold_avg = totalColdN > 0
    ? fixtures.reduce((s, f) => s + (FIXTURE_FLOWS[f.type]?.q0_cold ?? 0), 0) / totalColdN
    : 0.1;
  const q0_hot_avg = totalHotN > 0
    ? fixtures.reduce((s, f) => s + (FIXTURE_FLOWS[f.type]?.q0_hot ?? 0), 0) / totalHotN
    : 0.09;

  // Bosh magistral sarflari
  const mainColdFlow  = calcFlowRate(totalColdN,  q0_cold_avg, P);
  const mainHotFlow   = calcFlowRate(totalHotN,   q0_hot_avg,  P);
  const mainColdDiam  = calcPressureDiam(mainColdFlow, 1.5);
  const mainHotDiam   = calcPressureDiam(mainHotFlow,  1.5);

  notes.push(`В1 bosh sarfi: ${mainColdFlow.toFixed(3)} l/s → ø${mainColdDiam} mm (${totalColdN} ta jihoz)`);
  notes.push(`Т3 bosh sarfi: ${mainHotFlow.toFixed(3)} l/s → ø${mainHotDiam} mm (${totalHotN} ta jihoz)`);

  // Har bir quvur uchun diametr hisob
  for (const pipe of pipes) {
    const flows = FIXTURE_FLOWS as Record<string, FixtureFlow>;

    // Quvurga tegishli fixture soni (floor + tip bo'yicha)
    const relevantFix = fixtures.filter(f => {
      const flow = FIXTURE_FLOWS[f.type];
      if (!flow) return false;
      if (pipe.type === 'cold')  return flow.q0_cold > 0 && (pipe.isRiser || f.floor <= pipe.floor);
      if (pipe.type === 'hot')   return flow.q0_hot  > 0 && (pipe.isRiser || f.floor <= pipe.floor);
      if (pipe.type === 'drain') return flow.drain   > 0 && f.floor === pipe.floor;
      return false;
    });

    const N = relevantFix.length;
    if (N === 0) continue;

    let newDiam: number;
    let flowLs: number;

    if (pipe.type === 'drain') {
      flowLs  = relevantFix.reduce((s, f) => s + (FIXTURE_FLOWS[f.type]?.drain ?? 0), 0);
      newDiam = calcDrainDiam(flowLs);
    } else {
      const q0 = pipe.type === 'cold' ? q0_cold_avg : q0_hot_avg;
      const vMax = pipe.isMain ? 1.5 : (pipe.isRiser ? 1.8 : 2.5);
      flowLs  = calcFlowRate(N, q0, P);
      newDiam = calcPressureDiam(flowLs, vMax);
    }

    if (newDiam !== pipe.diamMm) {
      results.push({
        pipeId: pipe.id,
        oldDiamMm: pipe.diamMm,
        newDiamMm: newDiam,
        flowLs,
        fixtureCount: N,
        note: `${pipe.type} q=${flowLs.toFixed(3)}l/s N=${N}`,
      });
    }
  }

  if (results.length > 0) {
    notes.push(`${results.length} ta quvur diametri SNiP bo'yicha yangilandi`);
  } else {
    notes.push('Barcha quvur diamerlari SNiP talablariga mos');
  }

  return { pipes: results, mainColdDiamMm: mainColdDiam, mainHotDiamMm: mainHotDiam, notes };
}
