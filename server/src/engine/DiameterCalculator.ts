import type { PlumbingFixtureType, PlumbingSchema } from '../../../shared/types';

export const FLOW_UNITS: Record<PlumbingFixtureType, number> = {
  sink: 0.3,
  toilet: 1.6,
  bathtub: 0.3,
  shower: 0.2,
  washing_machine: 0.3,
};

export function calcSupplyDiameter(totalFlow: number): number {
  if (totalFlow <= 0.8) return 20;
  if (totalFlow <= 1.5) return 25;
  if (totalFlow <= 3.0) return 32;
  return 40;
}

export function calcDrainDiameter(fixtureCount: number): number {
  return fixtureCount <= 1 ? 50 : 100;
}

export function annotateDiameters(schema: PlumbingSchema): PlumbingSchema {
  // Group fixtures by floor for branch calculations
  const fixturesByFloor = new Map<number, typeof schema.fixtures>();
  for (const f of schema.fixtures) {
    if (!fixturesByFloor.has(f.floor)) fixturesByFloor.set(f.floor, []);
    fixturesByFloor.get(f.floor)!.push(f);
  }

  // Annotate branch pipes
  const annotatedPipes = schema.pipes.map(pipe => {
    if (pipe.type === 'drain') {
      // toilet drain = Dn 100, others = Dn 50
      const lastX = pipe.path[pipe.path.length - 2]?.x ?? pipe.path[0].x;
      const lastY = pipe.path[pipe.path.length - 2]?.y ?? pipe.path[0].y;
      const fixture = schema.fixtures.find(f =>
        Math.abs(f.position.x - lastX) < 10 ||
        Math.abs(f.position.x - pipe.path[0].x) < 10
      );
      const diameter = fixture?.type === 'toilet' ? 100 : 50;
      return { ...pipe, diameter, label: `Dn ${diameter}` };
    }
    // For supply branches: find fixture by matching X coordinate (last point of branch)
    const lastPoint = pipe.path[pipe.path.length - 1];
    const fixture = schema.fixtures.find(f =>
      Math.abs(f.position.x - lastPoint.x) < 10
    );
    const flow = FLOW_UNITS[fixture?.type ?? 'sink'] ?? 0.3;
    const diameter = calcSupplyDiameter(flow);
    return { ...pipe, diameter, label: `Dn ${diameter}` };
  });

  // Annotate risers
  const annotatedRisers = schema.risers.map(riser => {
    if (riser.type === 'drain') {
      const count = schema.fixtures.length;
      const diameter = calcDrainDiameter(count);
      return { ...riser, diameter, label: `Dn ${diameter}` };
    }
    const totalFlow = schema.fixtures.reduce((sum, f) => sum + (FLOW_UNITS[f.type] ?? 0.3), 0);
    const diameter = calcSupplyDiameter(totalFlow);
    return { ...riser, diameter, label: `Dn ${diameter}` };
  });

  return { ...schema, pipes: annotatedPipes, risers: annotatedRisers };
}
