import { describe, it, expect } from 'vitest';
import { PdfExporter } from '../PdfExporter';
import type { DrawingData } from '../../../../shared/types';

describe('PdfExporter', () => {
  const exporter = new PdfExporter();

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
    fixtures: [],
    pipes: [],
    dimensions: []
  };

  it('should generate PDF buffer', () => {
    const pdf = exporter.export(mockDrawingData);

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(0);
  });

  it('should include PDF header', () => {
    const pdf = exporter.export(mockDrawingData);
    const content = pdf.toString();

    expect(content).toContain('%PDF');
  });

  it('should include scale information', () => {
    const pdf = exporter.export(mockDrawingData);
    const content = pdf.toString();

    expect(content).toContain('1:50');
  });

  it('should include title block', () => {
    const pdf = exporter.export(mockDrawingData);
    const content = pdf.toString();

    expect(content).toContain('Floor Plan');
  });

  it('should generate legend', () => {
    const legend = exporter.generateLegend();

    expect(legend).toContain('Walls');
    expect(legend).toContain('Cold water');
    expect(legend).toContain('Hot water');
    expect(legend).toContain('Drain pipes');
  });
});
