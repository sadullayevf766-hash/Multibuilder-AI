import { describe, it, expect } from 'vitest';
import { exportToDxf } from '../DxfExporter';
import type { DrawingData } from '../../../../shared/types';

describe('DxfExporter', () => {
  const mockDrawingData: DrawingData = {
    id: 'test-drawing',
    walls: [
      {
        id: 'wall-1',
        start: { x: 0, y: 0 },
        end: { x: 300, y: 0 },
        thickness: 15,
        side: 'north'
      }
    ],
    fixtures: [
      {
        id: 'fixture-1',
        type: 'sink',
        position: { x: 150, y: 50 },
        wall: 'north'
      }
    ],
    pipes: [
      {
        id: 'pipe-1',
        type: 'cold',
        path: [{ x: 150, y: 50 }, { x: 0, y: 0 }],
        color: 'blue',
        fixtureId: 'fixture-1'
      }
    ],
    dimensions: [
      {
        id: 'dim-1',
        start: { x: 0, y: 0 },
        end: { x: 300, y: 0 },
        value: 3,
        label: '3.00m'
      }
    ],
    doors: []
  };

  it('should generate valid DXF header', () => {
    const dxf = exportToDxf(mockDrawingData);
    expect(dxf).toContain('SECTION');
    expect(dxf).toContain('HEADER');
  });

  it('should include all required layers', () => {
    const dxf = exportToDxf(mockDrawingData);
    expect(dxf).toContain('WALLS');
    expect(dxf).toContain('PLUMBING_COLD');
    expect(dxf).toContain('PLUMBING_HOT');
    expect(dxf).toContain('PLUMBING_DRAIN');
    expect(dxf).toContain('FIXTURES');
    expect(dxf).toContain('DIMENSIONS');
  });

  it('should convert units to meters', () => {
    const dxf = exportToDxf(mockDrawingData);
    expect(dxf).toContain('3'); // 300 units = 3 meters
  });

  it('should end with EOF', () => {
    const dxf = exportToDxf(mockDrawingData);
    expect(dxf).toContain('EOF');
  });

  it('should include entities section', () => {
    const dxf = exportToDxf(mockDrawingData);
    expect(dxf).toContain('ENTITIES');
  });
});
