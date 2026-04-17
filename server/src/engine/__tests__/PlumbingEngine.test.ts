import { describe, it, expect } from 'vitest';
import { PlumbingEngine, parsePlumbingDescription } from '../PlumbingEngine';
import { calcSupplyDiameter, calcDrainDiameter, annotateDiameters, FLOW_UNITS } from '../DiameterCalculator';

const engine = new PlumbingEngine();

describe('DiameterCalculator', () => {
  it('calcSupplyDiameter thresholds', () => {
    expect(calcSupplyDiameter(0.5)).toBe(20);
    expect(calcSupplyDiameter(0.8)).toBe(20);
    expect(calcSupplyDiameter(0.9)).toBe(25);
    expect(calcSupplyDiameter(1.5)).toBe(25);
    expect(calcSupplyDiameter(1.6)).toBe(32);
    expect(calcSupplyDiameter(3.0)).toBe(32);
    expect(calcSupplyDiameter(3.1)).toBe(40);
  });

  it('calcDrainDiameter thresholds', () => {
    expect(calcDrainDiameter(1)).toBe(50);
    expect(calcDrainDiameter(2)).toBe(100);
    expect(calcDrainDiameter(10)).toBe(100);
  });

  it('FLOW_UNITS has correct values', () => {
    expect(FLOW_UNITS.sink).toBe(0.3);
    expect(FLOW_UNITS.toilet).toBe(1.6);
    expect(FLOW_UNITS.bathtub).toBe(0.3);
    expect(FLOW_UNITS.shower).toBe(0.2);
    expect(FLOW_UNITS.washing_machine).toBe(0.3);
  });

  it('annotateDiameters sets label on every pipe and riser', () => {
    const schema = engine.generate('lavabo, unitaz, dush');
    const annotated = annotateDiameters(schema);
    for (const pipe of [...annotated.pipes, ...annotated.risers]) {
      expect(pipe.label).toMatch(/^Dn \d+$/);
      expect(pipe.diameter).toBeGreaterThan(0);
    }
  });
});

describe('parsePlumbingDescription', () => {
  it('detects floor count from "3 qavatli"', () => {
    const specs = parsePlumbingDescription('3 qavatli bino, lavabo, unitaz');
    expect(specs).toHaveLength(3);
  });

  it('detects floor count from "2 qavat"', () => {
    const specs = parsePlumbingDescription('2 qavat, dush, unitaz');
    expect(specs).toHaveLength(2);
  });

  it('defaults to 1 floor when no floor keyword', () => {
    const specs = parsePlumbingDescription('lavabo va unitaz');
    expect(specs).toHaveLength(1);
  });

  it('detects sink (lavabo)', () => {
    const specs = parsePlumbingDescription('lavabo');
    expect(specs[0].fixtures).toContain('sink');
  });

  it('detects toilet (unitaz)', () => {
    const specs = parsePlumbingDescription('unitaz');
    expect(specs[0].fixtures).toContain('toilet');
  });

  it('detects shower (dush)', () => {
    const specs = parsePlumbingDescription('dush kabina');
    expect(specs[0].fixtures).toContain('shower');
  });

  it('detects bathtub (vanna)', () => {
    const specs = parsePlumbingDescription('vanna bor');
    expect(specs[0].fixtures).toContain('bathtub');
  });

  it('detects washing machine', () => {
    const specs = parsePlumbingDescription('kir yuvish mashinasi');
    expect(specs[0].fixtures).toContain('washing_machine');
  });

  it('falls back to default fixtures when nothing detected', () => {
    const specs = parsePlumbingDescription('bino');
    expect(specs[0].fixtures.length).toBeGreaterThan(0);
  });

  it('parses per-floor fixtures from exact user prompt', () => {
    const input = '3 qavatli uy, 1-qavatda lavabo va unitaz, 2-qavatda vanna va unitaz, 3-qavatda dush va lavabo';
    const specs = parsePlumbingDescription(input);

    // Inline verification of the logic
    const desc = input.toLowerCase();
    const idx1 = desc.indexOf('1-qavatda ');
    const idx2 = desc.indexOf('2-qavatda ');
    const idx3 = desc.indexOf('3-qavatda ');
    const s1 = desc.slice(idx1 + 10, idx2).trim();
    const s2 = desc.slice(idx2 + 10, idx3).trim();
    const s3 = desc.slice(idx3 + 10).trim();
    console.log('s1:', JSON.stringify(s1));
    console.log('s2:', JSON.stringify(s2));
    console.log('s3:', JSON.stringify(s3));
    console.log('specs:', JSON.stringify(specs));

    expect(specs).toHaveLength(3);
    expect(specs[0].fixtures).toContain('sink');
    expect(specs[0].fixtures).toContain('toilet');
    expect(specs[1].fixtures).toContain('bathtub');
    expect(specs[1].fixtures).toContain('toilet');
    expect(specs[2].fixtures).toContain('shower');
    expect(specs[2].fixtures).toContain('sink');
  });
});

describe('PlumbingEngine', () => {
  it('generates fixtures for single floor with lavabo, unitaz, dush', () => {
    const schema = engine.generate('lavabo, unitaz, dush');
    expect(schema.floorCount).toBe(1);
    expect(schema.fixtures.length).toBeGreaterThan(0);
    expect(schema.fixtures.every(f => f.floor === 0)).toBe(true);
  });

  it('generates fixtures on all floors for 3 qavatli', () => {
    const schema = engine.generate('3 qavatli bino, lavabo, unitaz, dush');
    const floors = new Set(schema.fixtures.map(f => f.floor));
    expect(floors).toEqual(new Set([0, 1, 2]));
  });

  it('risers span full height', () => {
    const schema = engine.generate('2 qavatli, lavabo, unitaz');
    const totalHeight = schema.floorCount * 220;
    for (const riser of schema.risers) {
      const ys = riser.path.map(p => p.y);
      expect(Math.min(...ys)).toBe(0);
      expect(Math.max(...ys)).toBe(totalHeight);
    }
  });

  it('every fixture has at least one branch pipe', () => {
    const schema = engine.generate('2 qavatli, lavabo, unitaz, dush');
    for (const fixture of schema.fixtures) {
      const hasBranch = schema.pipes.some(p =>
        p.path.some(pt => Math.abs(pt.x - fixture.position.x) < 5)
      );
      expect(hasBranch).toBe(true);
    }
  });

  it('schema.risers contains exactly one cold, one hot, one drain', () => {
    const schema = engine.generate('lavabo, dush');
    expect(schema.risers.filter(r => r.type === 'cold')).toHaveLength(1);
    expect(schema.risers.filter(r => r.type === 'hot')).toHaveLength(1);
    expect(schema.risers.filter(r => r.type === 'drain')).toHaveLength(1);
  });

  it('JSON round-trip preserves schema', () => {
    const schema = engine.generate('lavabo, unitaz');
    const roundTripped = JSON.parse(JSON.stringify(schema));
    expect(roundTripped).toEqual(schema);
  });

  it('floorCount matches parsed description', () => {
    expect(engine.generate('1 qavat, lavabo').floorCount).toBe(1);
    expect(engine.generate('3 qavatli bino, unitaz').floorCount).toBe(3);
  });

  it('per-floor fixtures: 3 qavatli uy with different fixtures per floor', () => {
    const schema = engine.generate(
      '3 qavatli uy, 1-qavatda lavabo va unitaz, 2-qavatda vanna va unitaz, 3-qavatda dush va lavabo'
    );
    expect(schema.floorCount).toBe(3);
    // Floor 0: sink + toilet
    const f0 = schema.fixtures.filter(f => f.floor === 0).map(f => f.type);
    expect(f0).toContain('sink');
    expect(f0).toContain('toilet');
    // Floor 1: bathtub + toilet
    const f1 = schema.fixtures.filter(f => f.floor === 1).map(f => f.type);
    expect(f1).toContain('bathtub');
    expect(f1).toContain('toilet');
    // Floor 2: shower + sink
    const f2 = schema.fixtures.filter(f => f.floor === 2).map(f => f.type);
    expect(f2).toContain('shower');
    expect(f2).toContain('sink');
  });
});
