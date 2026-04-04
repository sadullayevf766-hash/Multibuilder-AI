Create /client/components/Canvas2D.tsx using Konva.js

Render DrawingData:
- Walls: double-line style (15 unit gap), black
- Doors: wall opening + quarter-circle arc
- Windows: triple line in wall
- Toilet: standard CAD symbol (oval + rectangle)
- Sink: rectangle + oval
- Bathtub: rectangle + inner oval
- Pipes: colored lines (blue/red/gray), dashed for hidden
- Dimensions: arrows + text, outside the room
- Title block: bottom right (project name, scale, date)
- Scale: 1:50 default
- Grid: light gray, 100 units

|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

Create /server/export/DxfExporter.ts using 'dxf-writer' package

Layers:
- WALLS (color: white/7)
- DOORS (color: cyan/4)  
- PLUMBING (color: blue/5)
- ELECTRICAL (color: yellow/2)
- DIMENSIONS (color: green/3)
- TITLEBLOCK (color: white/7)

Units: meters
Scale: 1:50
Include all dimension lines

||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||

Create /server/export/PdfExporter.ts using 'pdfkit' package

A3 landscape format
Title block (ISO standard)
Scale 1:50
Include legend
Margin: 20mm