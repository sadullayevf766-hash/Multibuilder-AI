import type { PlumbingSchema, PlumbingFixture, PlumbingPipe, PlumbingFixtureType } from '../../../shared/types';
import { annotateDiameters } from './DiameterCalculator';

const FLOOR_HEIGHT = 220;
const COLD_X  = 0;
const HOT_X   = 45;
const DRAIN_X = 100;
const COLD_Y_OFF  = 80;
const HOT_Y_OFF   = 95;
const DRAIN_Y_OFF = 40;
const FIXTURE_START_X = 200;
const FIXTURE_STEP_X  = 160;

export interface FloorSpec {
  floor: number;
  fixtures: PlumbingFixtureType[];
}

function detectFixtures(text: string): PlumbingFixtureType[] {
  const t = text.toLowerCase();
  const r: PlumbingFixtureType[] = [];
  if (/lavabo|sink/.test(t))               r.push('sink');
  if (/unitaz|toilet|hojatxona|wc/.test(t)) r.push('toilet');
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
  const sections: string[] = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].contentStart;
    const end   = i + 1 < markers.length ? markers[i + 1].markerStart : desc.length;
    sections.push(desc.slice(start, end).trim());
  }
  return sections;
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
  const common = detectFixtures(desc);
  const fixtures = common.length > 0 ? common : ['sink', 'toilet', 'shower'] as PlumbingFixtureType[];
  return Array.from({ length: floorCount }, (_, i) => ({ floor: i, fixtures }));
}

export class PlumbingEngine {
  generate(description: string): PlumbingSchema {
    const id = `plumbing-${Date.now()}`;
    const specs = parsePlumbingDescription(description);
    const floorCount = specs.length;
    const fixtures: PlumbingFixture[] = [];
    const pipes: PlumbingPipe[] = [];
    for (const spec of specs) {
      const floorY = spec.floor * FLOOR_HEIGHT;
      const coldBranchY  = floorY + COLD_Y_OFF;
      const hotBranchY   = floorY + HOT_Y_OFF;
      const drainBranchY = floorY + DRAIN_Y_OFF;
      spec.fixtures.forEach((type, idx) => {
        const x = FIXTURE_START_X + idx * FIXTURE_STEP_X;
        const fid = `f-${spec.floor}-${type}-${idx}`;
        fixtures.push({ id: fid, type, floor: spec.floor, position: { x, y: coldBranchY } });
        pipes.push({ id: `cold-${spec.floor}-${idx}`, type: 'cold', path: [{ x: COLD_X, y: coldBranchY }, { x, y: coldBranchY }], diameter: 20, label: 'Dn 20' });
        if (type !== 'toilet') {
          pipes.push({ id: `hot-${spec.floor}-${idx}`, type: 'hot', path: [{ x: HOT_X, y: hotBranchY }, { x, y: hotBranchY }], diameter: 20, label: 'Dn 20' });
        }
        pipes.push({ id: `drain-${spec.floor}-${idx}`, type: 'drain', path: [{ x, y: coldBranchY }, { x, y: drainBranchY }, { x: DRAIN_X, y: drainBranchY }], diameter: type === 'toilet' ? 100 : 50, label: type === 'toilet' ? 'Dn 100' : 'Dn 50' });
      });
    }
    const totalH = floorCount * FLOOR_HEIGHT;
    const risers: PlumbingPipe[] = [
      { id: 'riser-cold',  type: 'cold',  path: [{ x: COLD_X,  y: 0 }, { x: COLD_X,  y: totalH }], diameter: 32,  label: 'Dn 32'  },
      { id: 'riser-hot',   type: 'hot',   path: [{ x: HOT_X,   y: 0 }, { x: HOT_X,   y: totalH }], diameter: 32,  label: 'Dn 32'  },
      { id: 'riser-drain', type: 'drain', path: [{ x: DRAIN_X, y: 0 }, { x: DRAIN_X, y: totalH }], diameter: 100, label: 'Dn 100' },
    ];
    return annotateDiameters({ id, floorCount, fixtures, pipes, risers });
  }
}
