Implement DXF export. Use 'dxf-writer' npm package.

Install: npm install dxf-writer
Install types: npm install --save-dev @types/dxf-writer

Create /server/src/export/DxfExporter.ts:

import DxfWriter from 'dxf-writer';
import { DrawingData } from '../../shared/types';

export function exportToDxf(drawing: DrawingData): string {
  const d = new DxfWriter();
  
  // Layers
  d.addLayer('WALLS', DxfWriter.ACI.BLACK, 'CONTINUOUS');
  d.addLayer('PLUMBING_COLD', DxfWriter.ACI.CYAN, 'CONTINUOUS');
  d.addLayer('PLUMBING_HOT', DxfWriter.ACI.RED, 'CONTINUOUS');
  d.addLayer('PLUMBING_DRAIN', DxfWriter.ACI.GRAY, 'DASHED');
  d.addLayer('FIXTURES', DxfWriter.ACI.BLACK, 'CONTINUOUS');
  d.addLayer('DIMENSIONS', DxfWriter.ACI.GREEN, 'CONTINUOUS');

  const S = 0.01; // scale: 100 units = 1 meter

  // Walls
  d.setActiveLayer('WALLS');
  drawing.walls.forEach(wall => {
    d.drawLine(
      wall.start.x * S, -wall.start.y * S,
      wall.end.x * S,   -wall.end.y * S
    );
  });

  // Pipes
  drawing.pipes.forEach(pipe => {
    const layer = pipe.type === 'cold' ? 'PLUMBING_COLD' 
                : pipe.type === 'hot'  ? 'PLUMBING_HOT'
                : 'PLUMBING_DRAIN';
    d.setActiveLayer(layer);
    for (let i = 0; i < pipe.path.length - 1; i++) {
      d.drawLine(
        pipe.path[i].x * S,   -pipe.path[i].y * S,
        pipe.path[i+1].x * S, -pipe.path[i+1].y * S
      );
    }
  });

  // Fixtures (bounding boxes)
  d.setActiveLayer('FIXTURES');
  drawing.fixtures.forEach(f => {
    const x = f.position.x * S;
    const y = -f.position.y * S;
    const w = (f.width ?? 50) * S;
    const h = (f.height ?? 50) * S;
    d.drawRect(x, y - h, x + w, y);
    d.drawText(x + w/2, y - h/2, 0.1, 0, f.type);
  });

  return d.toDxfString();
}

// Add route in server/src/routes/export.ts:
router.get('/export/dxf/:projectId', async (req, res) => {
  const drawing = await getDrawing(req.params.projectId);
  const dxf = exportToDxf(drawing);
  res.setHeader('Content-Type', 'application/dxf');
  res.setHeader('Content-Disposition', 
    `attachment; filename="drawing-${req.params.projectId}.dxf"`);
  res.send(dxf);
});

// In client: add Download DXF button in ProjectView.tsx
<button onClick={() => window.open(`/api/export/dxf/${projectId}`)}>
  DXF Yuklab olish
</button>