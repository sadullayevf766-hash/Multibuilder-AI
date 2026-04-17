import PDFDocument from 'pdfkit';
import type { DrawingData, Wall, PlacedFixture, Pipe, DimensionLine } from '../../../shared/types';

const SCALE = 1.8;        // pixels per unit (1 unit = 1cm in drawing)
const MARGIN = 50;        // page margin px
const PADDING = 30;       // drawing padding inside margin

const COLORS = {
  wall:       '#1a1a1a',
  wallFill:   '#e8e8e8',
  cold:       '#3b82f6',
  hot:        '#ef4444',
  drain:      '#94a3b8',
  fixture:    '#f5f5f5',
  fixtureLine:'#333333',
  dim:        '#1a1a1a',
  grid:       '#e5e7eb',
  bg:         '#ffffff',
  roomBg:     '#fafafa',
};

const FIXTURE_LABELS: Record<string, string> = {
  sink: 'Lavabo', toilet: 'Hojatxona', bathtub: 'Vanna', shower: 'Dush',
  stove: 'Plita', fridge: 'Muzlatgich', dishwasher: 'Idish yuv.',
  desk: 'Stol', bed: 'Karavot', wardrobe: 'Shkaf',
  sofa: 'Divan', tv_unit: 'TV', bookshelf: 'Kitob javon',
  armchair: 'Kreslo', coffee_table: 'J.stol', dining_table: 'Ovqat stoli',
  chair: 'Stul', coat_rack: 'Ilgich',
};

export class PdfExporter {
  export(drawingData: DrawingData): Promise<Buffer> {
    return new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: MARGIN });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.render(doc, drawingData);
      doc.end();
    });
  }

  exportAsync(drawingData: DrawingData): Promise<Buffer> {
    return this.export(drawingData);
  }

  generateLegend(): string {
    return 'Walls: solid gray | Cold water (H) | Hot water (I) | Drain pipes (K)';
  }

  getScale(): string {
    return '1:50';
  }

  getTitleInfo(): string {
    return 'Floor Plan | SNiP 2.04.01-85';
  }

  private render(doc: PDFKit.PDFDocument, d: DrawingData) {
    const pageW = doc.page.width;
    const pageH = doc.page.height;

    // Calculate drawing bounds
    const allX = d.walls.flatMap(w => [w.start.x, w.end.x]);
    const allY = d.walls.flatMap(w => [w.start.y, w.end.y]);
    const minX = allX.length ? Math.min(...allX) : 0;
    const minY = allY.length ? Math.min(...allY) : 0;
    const maxX = allX.length ? Math.max(...allX) : 300;
    const maxY = allY.length ? Math.max(...allY) : 400;

    const drawW = (maxX - minX) * SCALE;
    const drawH = (maxY - minY) * SCALE;

    // Available area (leave room for title block at bottom)
    const availW = pageW - MARGIN * 2 - PADDING * 2;
    const availH = pageH - MARGIN * 2 - PADDING * 2 - 80;

    // Auto-fit scale
    const fitScale = Math.min(availW / (drawW || 1), availH / (drawH || 1), 1);
    const S = SCALE * fitScale;

    // Origin offset (center drawing)
    const ox = MARGIN + PADDING + (availW - drawW * fitScale) / 2;
    const oy = MARGIN + PADDING + (availH - drawH * fitScale) / 2;

    const tx = (x: number) => ox + (x - minX) * S;
    const ty = (y: number) => oy + (y - minY) * S;

    // Background
    doc.rect(0, 0, pageW, pageH).fill('#f8fafc');
    doc.rect(MARGIN, MARGIN, pageW - MARGIN * 2, pageH - MARGIN * 2)
       .fill(COLORS.bg).stroke('#cccccc');

    // Room background
    if (d.walls.length > 0) {
      doc.rect(tx(minX), ty(minY), (maxX - minX) * S, (maxY - minY) * S)
         .fill(COLORS.roomBg);
    }

    // Grid
    doc.save();
    doc.lineWidth(0.3).strokeColor(COLORS.grid);
    const gridStep = 100; // 1 meter
    for (let gx = minX; gx <= maxX + gridStep; gx += gridStep) {
      doc.moveTo(tx(gx), ty(minY)).lineTo(tx(gx), ty(maxY)).stroke();
    }
    for (let gy = minY; gy <= maxY + gridStep; gy += gridStep) {
      doc.moveTo(tx(minX), ty(gy)).lineTo(tx(maxX), ty(gy)).stroke();
    }
    doc.restore();

    // Pipes (draw before walls)
    for (const pipe of d.pipes ?? []) {
      const color = pipe.type === 'cold' ? COLORS.cold
                  : pipe.type === 'hot'  ? COLORS.hot
                  : COLORS.drain;
      doc.save();
      doc.strokeColor(color).lineWidth(pipe.type === 'drain' ? 1 : 1.5);
      if (pipe.type === 'drain') doc.dash(4, { space: 4 });
      if (pipe.path.length >= 2) {
        doc.moveTo(tx(pipe.path[0].x), ty(pipe.path[0].y));
        for (let i = 1; i < pipe.path.length; i++) {
          doc.lineTo(tx(pipe.path[i].x), ty(pipe.path[i].y));
        }
        doc.stroke();
      }
      doc.restore();
    }

    // Walls
    for (const wall of d.walls) {
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;
      const nx = (-dy / len) * (wall.thickness / 2);
      const ny = (dx / len) * (wall.thickness / 2);

      // Fill
      doc.save();
      doc.polygon(
        [tx(wall.start.x + nx), ty(wall.start.y + ny)],
        [tx(wall.end.x + nx),   ty(wall.end.y + ny)],
        [tx(wall.end.x - nx),   ty(wall.end.y - ny)],
        [tx(wall.start.x - nx), ty(wall.start.y - ny)],
      ).fill(COLORS.wallFill);
      doc.restore();

      // Outer line
      doc.save();
      doc.moveTo(tx(wall.start.x + nx), ty(wall.start.y + ny))
         .lineTo(tx(wall.end.x + nx),   ty(wall.end.y + ny))
         .strokeColor(COLORS.wall).lineWidth(1.5).stroke();
      // Inner line
      doc.moveTo(tx(wall.start.x - nx), ty(wall.start.y - ny))
         .lineTo(tx(wall.end.x - nx),   ty(wall.end.y - ny))
         .strokeColor(COLORS.wall).lineWidth(1.5).stroke();
      doc.restore();
    }

    // Fixtures
    for (const f of d.fixtures) {
      this.drawFixture(doc, f, tx, ty, S);
    }

    // Dimensions
    for (const dim of d.dimensions) {
      const offset = -25;
      const dx = dim.end.x - dim.start.x;
      const dy = dim.end.y - dim.start.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;
      const nx = (-dy / len) * offset;
      const ny = (dx / len) * offset;

      const x1 = tx(dim.start.x) + nx;
      const y1 = ty(dim.start.y) + ny;
      const x2 = tx(dim.end.x) + nx;
      const y2 = ty(dim.end.y) + ny;

      doc.save();
      doc.moveTo(x1, y1).lineTo(x2, y2)
         .strokeColor(COLORS.dim).lineWidth(0.8).stroke();
      // Arrows
      this.drawArrow(doc, x2, y2, x1, y1);
      this.drawArrow(doc, x1, y1, x2, y2);
      // Label
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      doc.fontSize(7).fillColor(COLORS.dim)
         .text(dim.label, mx - 15, my - 8, { width: 30, align: 'center' });
      doc.restore();
    }

    // Title block
    this.drawTitleBlock(doc, d, pageW, pageH);

    // Legend
    this.drawLegend(doc, MARGIN + 5, pageH - MARGIN - 65);
  }

  private drawFixture(
    doc: PDFKit.PDFDocument,
    f: PlacedFixture,
    tx: (x: number) => number,
    ty: (y: number) => number,
    S: number
  ) {
    const x = tx(f.position.x);
    const y = ty(f.position.y);
    const label = FIXTURE_LABELS[f.type] || f.type;

    doc.save();
    doc.fillColor(COLORS.fixture).strokeColor(COLORS.fixtureLine).lineWidth(1);

    const DIMS: Record<string, [number, number]> = {
      sink: [60, 50], toilet: [40, 70], bathtub: [80, 180], shower: [90, 90],
      stove: [60, 60], fridge: [60, 65], dishwasher: [60, 60],
      desk: [120, 60], bed: [160, 200], wardrobe: [120, 60],
      sofa: [200, 90], tv_unit: [150, 45], bookshelf: [80, 30],
    };
    const [fw, fh] = (DIMS[f.type] ?? [50, 50]).map(v => v * S / SCALE);

    switch (f.type) {
      case 'toilet':
        doc.rect(x, y, fw, fh * 0.25).fillAndStroke();
        doc.circle(x + fw / 2, y + fh * 0.6, fw * 0.4).fillAndStroke();
        break;
      case 'sink':
        doc.rect(x, y, fw, fh).fillAndStroke();
        doc.rect(x + fw * 0.1, y + fh * 0.1, fw * 0.8, fh * 0.8).stroke();
        doc.circle(x + fw / 2, y + fh / 2, fw * 0.08).fill('#888');
        break;
      case 'bathtub':
        doc.rect(x, y, fw, fh).fillAndStroke();
        doc.rect(x + fw * 0.06, y + fh * 0.03, fw * 0.88, fh * 0.94).stroke();
        break;
      case 'shower':
        doc.rect(x, y, fw, fh).fillAndStroke();
        doc.circle(x + fw / 2, y + fh / 2, fw * 0.3).stroke();
        break;
      case 'stove':
        doc.rect(x, y, fw, fh).fillAndStroke();
        [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].forEach(([cx, cy]) => {
          doc.circle(x + fw * cx, y + fh * cy, fw * 0.15).stroke();
        });
        break;
      case 'bed':
        doc.rect(x, y, fw, fh).fillAndStroke();
        doc.rect(x + fw * 0.05, y + fh * 0.02, fw * 0.9, fh * 0.2).fill('#d0d0d0').stroke();
        doc.moveTo(x, y + fh * 0.25).lineTo(x + fw, y + fh * 0.25).stroke();
        break;
      case 'sofa':
        doc.rect(x, y, fw, fh * 0.25).fill('#c0c0c0').stroke();
        for (let i = 0; i < 3; i++) {
          doc.rect(x + i * (fw / 3), y + fh * 0.25, fw / 3 - 1, fh * 0.75).fillAndStroke();
        }
        break;
      default:
        doc.rect(x, y, fw, fh).fillAndStroke();
    }

    // Label
    doc.fontSize(6).fillColor('#444')
       .text(label, x, y + fh / 2 - 3, { width: fw, align: 'center' });
    doc.restore();
  }

  private drawArrow(doc: PDFKit.PDFDocument, fromX: number, fromY: number, toX: number, toY: number) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const size = 5;
    doc.save();
    doc.moveTo(fromX, fromY)
       .lineTo(fromX + size * Math.cos(angle + 2.5), fromY + size * Math.sin(angle + 2.5))
       .lineTo(fromX + size * Math.cos(angle - 2.5), fromY + size * Math.sin(angle - 2.5))
       .closePath().fill(COLORS.dim);
    doc.restore();
  }

  private drawTitleBlock(doc: PDFKit.PDFDocument, d: DrawingData, pageW: number, pageH: number) {
    const bx = pageW - MARGIN - 200;
    const by = pageH - MARGIN - 70;
    const bw = 200;
    const bh = 70;

    doc.save();
    doc.rect(bx, by, bw, bh).fill('white').stroke('#333');
    doc.moveTo(bx, by + 20).lineTo(bx + bw, by + 20).stroke('#333');
    doc.moveTo(bx, by + 40).lineTo(bx + bw, by + 40).stroke('#333');

    doc.fontSize(10).fillColor('#000').font('Helvetica-Bold')
       .text('Floor Plan', bx + 5, by + 5, { width: bw - 10 });
    doc.fontSize(8).font('Helvetica')
       .text(`Masshtab: 1:50  |  SNiP 2.04.01-85`, bx + 5, by + 25, { width: bw - 10 });
    doc.fontSize(8)
       .text(`Sana: ${new Date().toLocaleDateString('uz-UZ')}`, bx + 5, by + 45, { width: bw - 10 });
    doc.restore();
  }

  private drawLegend(doc: PDFKit.PDFDocument, x: number, y: number) {
    doc.save();
    const items: [string, string, boolean][] = [
      [COLORS.cold,  'Sovuq suv (H)', false],
      [COLORS.hot,   'Issiq suv (I)', false],
      [COLORS.drain, 'Kanalizatsiya (K)', true],
    ];
    items.forEach(([color, label, dashed], i) => {
      const lx = x + i * 120;
      doc.save();
      doc.strokeColor(color).lineWidth(1.5);
      if (dashed) doc.dash(4, { space: 4 });
      doc.moveTo(lx, y + 5).lineTo(lx + 25, y + 5).stroke();
      doc.restore();
      doc.fontSize(7).fillColor('#333').text(label, lx + 30, y, { width: 90 });
    });
    doc.restore();
  }
}
