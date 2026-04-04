import type { DrawingData, Wall, PlacedFixture, Pipe } from '../../../shared/types';

export class PdfExporter {
  private readonly A3_WIDTH = 420; // mm
  private readonly A3_HEIGHT = 297; // mm
  private readonly MARGIN = 20; // mm
  private readonly SCALE = 1 / 50;

  export(drawingData: DrawingData): Buffer {
    // Simplified PDF generation - in production use pdfkit
    const content = this.generatePdfContent(drawingData);
    return Buffer.from(content);
  }

  private generatePdfContent(drawingData: DrawingData): string {
    let content = '%PDF-1.4\n';
    content += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
    content += '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
    content += '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1191 842] /Contents 4 0 R >>\nendobj\n';
    
    let stream = '';
    stream += 'BT\n/F1 12 Tf\n50 800 Td\n(Floor Plan - Scale 1:50) Tj\nET\n';
    
    // Draw walls
    for (const wall of drawingData.walls) {
      const x1 = this.toMm(wall.start.x);
      const y1 = this.toMm(wall.start.y);
      const x2 = this.toMm(wall.end.x);
      const y2 = this.toMm(wall.end.y);
      
      stream += `${x1} ${y1} m ${x2} ${y2} l S\n`;
    }

    // Title block
    stream += this.generateTitleBlock(drawingData);

    content += `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`;
    content += 'xref\n0 5\n0000000000 65535 f\n';
    content += '0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000214 00000 n\n';
    content += 'trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n';
    content += `${content.length}\n%%EOF`;

    return content;
  }

  private toMm(units: number): number {
    return (units / 100) * this.SCALE * 1000 + this.MARGIN;
  }

  private generateTitleBlock(drawingData: DrawingData): string {
    const x = this.A3_WIDTH - 100;
    const y = this.MARGIN;

    let block = 'BT\n/F1 10 Tf\n';
    block += `${x} ${y} Td\n`;
    block += `(Project: ${drawingData.id}) Tj\n`;
    block += `0 -15 Td\n(Scale: 1:50) Tj\n`;
    block += `0 -15 Td\n(Date: ${new Date().toLocaleDateString()}) Tj\n`;
    block += 'ET\n';

    return block;
  }

  generateLegend(): string {
    return `
Legend:
- Black lines: Walls
- Blue lines: Cold water
- Red lines: Hot water
- Gray dashed: Drain pipes
- Green arrows: Dimensions
    `.trim();
  }
}
