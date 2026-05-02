import type { PlumbingSchema, PlumbingFixture, PlumbingPipe, PlumbingFixtureType } from '../../../shared/types';
import { FLOW_UNITS, calcSupplyDiameter } from './DiameterCalculator';

// ── Layout constants ────────────────────────────────────────────────────────────
const FLOOR_HEIGHT    = 240;  // canvas px per floor (increased for better spacing)
const COLD_X          = 0;
const HOT_X           = 50;
const DRAIN_X         = 110;
const COLD_Y_OFF      = 90;   // cold branch height within floor
const HOT_Y_OFF       = 106;  // hot branch height (15px below cold)
const DRAIN_COLL_Y    = 30;   // drain collector height within floor (near bottom)
const FIXTURE_START_X = 220;  // first fixture X
const FIXTURE_STEP_X  = 175;  // spacing between fixtures

// ── Types ────────────────────────────────────────────────────────────────────────
export interface FloorSpec {
  floor: number;
  fixtures: PlumbingFixtureType[];
}

// ── Description parser ────────────────────────────────────────────────────────────
function detectFixtures(text: string): PlumbingFixtureType[] {
  const t = text.toLowerCase();
  const r: PlumbingFixtureType[] = [];
  if (/lavabo|sink/.test(t))                r.push('sink');
  if (/unitar|unitaz|toilet|hojatxona|wc/.test(t)) r.push('toilet');
  if (/vanna|bathtub/.test(t))              r.push('bathtub');
  if (/dush|shower|kabina/.test(t))         r.push('shower');
  if (/kir\s*yuv|washing/.test(t))          r.push('washing_machine');
  return r;
}

function extractFloorSections(desc: string, floorCount: number): string[] {
  const markers: Array<{ floor: number; contentStart: number; markerStart: number }> = [];
  for (let f = 1; f <= floorCount; f++) {
    const pats = [`${f}-qavatda `, `${f}-qavatga `, `${f}-qavat: `, `${f} qavatda `];
    for (const pat of pats) {
      const idx = desc.indexOf(pat);
      if (idx !== -1) {
        markers.push({ floor: f, markerStart: idx, contentStart: idx + pat.length });
        break;
      }
    }
  }
  if (markers.length !== floorCount) return [];
  markers.sort((a, b) => a.floor - b.floor);
  return markers.map((m, i) => {
    const end = i + 1 < markers.length ? markers[i + 1].markerStart : desc.length;
    return desc.slice(m.contentStart, end).trim();
  });
}

export function parsePlumbingDescription(description: string): FloorSpec[] {
  const desc = description.toLowerCase();
  let floorCount = 1;
  const fcMatch = desc.match(/(\d+)\s*(?:qavatli|qavat)/);
  if (fcMatch) floorCount = Math.min(10, Math.max(1, parseInt(fcMatch[1])));
  const sections = extractFloorSections(desc, floorCount);
  if (sections.length === floorCount) {
    return sections.map((text, i) => ({ floor: i, fixtures: detectFixtures(text) }));
  }
  const common  = detectFixtures(desc);
  const fixtures = common.length > 0 ? common : ['sink', 'toilet', 'shower'] as PlumbingFixtureType[];
  return Array.from({ length: floorCount }, (_, i) => ({ floor: i, fixtures }));
}

// ── Engine ────────────────────────────────────────────────────────────────────────
export class PlumbingEngine {
  generate(description: string): PlumbingSchema {
    const id        = `plumbing-${Date.now()}`;
    const specs     = parsePlumbingDescription(description);
    const floorCount = specs.length;

    const fixtures: PlumbingFixture[] = [];
    const pipes: PlumbingPipe[]       = [];

    for (const spec of specs) {
      const n = spec.fixtures.length;
      if (n === 0) continue;

      const floorBase  = spec.floor * FLOOR_HEIGHT;
      const coldY      = floorBase + COLD_Y_OFF;
      const hotY       = floorBase + HOT_Y_OFF;
      const drainCollY = floorBase + DRAIN_COLL_Y;

      const lastX      = FIXTURE_START_X + (n - 1) * FIXTURE_STEP_X;
      const hasHot     = spec.fixtures.some(t => t !== 'toilet');

      // ── Single cold branch for the whole floor ──────────────────────────────
      const coldFlow = spec.fixtures
        .filter(t => t !== 'toilet')
        .reduce((s, t) => s + (FLOW_UNITS[t] ?? 0.3), 0);
      const branchDn = calcSupplyDiameter(coldFlow || 0.3);

      pipes.push({
        id: `cold-branch-${spec.floor}`,
        type: 'cold',
        path: [{ x: COLD_X, y: coldY }, { x: lastX, y: coldY }],
        diameter: branchDn,
        label: `Dn ${branchDn}`,
      });

      // ── Single hot branch for the whole floor ───────────────────────────────
      if (hasHot) {
        pipes.push({
          id: `hot-branch-${spec.floor}`,
          type: 'hot',
          path: [{ x: HOT_X, y: hotY }, { x: lastX, y: hotY }],
          diameter: branchDn,
          label: `Dn ${branchDn}`,
        });
      }

      // ── Horizontal drain collector ──────────────────────────────────────────
      pipes.push({
        id: `drain-coll-${spec.floor}`,
        type: 'drain',
        path: [{ x: DRAIN_X, y: drainCollY }, { x: lastX, y: drainCollY }],
        diameter: 100,
        label: 'Dn 100',
      });

      // ── Per-fixture: place fixture + vertical drain drop ────────────────────
      spec.fixtures.forEach((type, idx) => {
        const x   = FIXTURE_START_X + idx * FIXTURE_STEP_X;
        const fid = `f-${spec.floor}-${type}-${idx}`;

        fixtures.push({ id: fid, type, floor: spec.floor, position: { x, y: coldY } });

        // Vertical drain drop from fixture level to drain collector
        const drainDn = type === 'toilet' ? 100 : 50;
        pipes.push({
          id: `drain-drop-${spec.floor}-${idx}`,
          type: 'drain',
          path: [{ x, y: coldY }, { x, y: drainCollY }],
          diameter: drainDn,
          label: `Dn ${drainDn}`,
        });
      });
    }

    // ── Risers ────────────────────────────────────────────────────────────────
    const totalH   = floorCount * FLOOR_HEIGHT;
    const allFixtures = fixtures; // for diameter calc
    const totalFlow   = allFixtures.reduce((s, f) => s + (FLOW_UNITS[f.type] ?? 0.3), 0);
    const riserDn     = calcSupplyDiameter(totalFlow);

    const risers: PlumbingPipe[] = [
      {
        id: 'riser-cold', type: 'cold',
        path: [{ x: COLD_X, y: 0 }, { x: COLD_X, y: totalH }],
        diameter: riserDn, label: `Dn ${riserDn}`,
      },
      {
        id: 'riser-hot', type: 'hot',
        path: [{ x: HOT_X, y: 0 }, { x: HOT_X, y: totalH }],
        diameter: riserDn, label: `Dn ${riserDn}`,
      },
      {
        id: 'riser-drain', type: 'drain',
        path: [{ x: DRAIN_X, y: 0 }, { x: DRAIN_X, y: totalH }],
        diameter: 100, label: 'Dn 100',
      },
    ];

    return { id, floorCount, fixtures, pipes, risers };
  }
}
