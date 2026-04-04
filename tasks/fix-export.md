Fix DXF export quality.

FIX 1 — Wall color and thickness:
DXF ACI colors: 7=white/black, 1=red, 3=green, 4=cyan, 8=gray

Change wall layer:
  d.addLayer('WALLS', 7, 'CONTINUOUS');  // 7 = black in AutoCAD

Draw walls as DOUBLE LINE (two parallel lines, 0.15m apart):
  drawing.walls.forEach(wall => {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const nx = -dy/len * 0.15;  // normal offset 0.15m
    const ny =  dx/len * 0.15;
    
    // Line 1 (outer)
    d.drawLine(
      wall.start.x*S + nx, -(wall.start.y*S + ny),
      wall.end.x*S + nx,   -(wall.end.y*S + ny)
    );
    // Line 2 (inner)  
    d.drawLine(
      wall.start.x*S - nx, -(wall.start.y*S - ny),
      wall.end.x*S - nx,   -(wall.end.y*S - ny)
    );
  });

FIX 2 — Fixture symbols in DXF:
Replace simple rect+text with proper CAD symbols.

For toilet:
  const cx = (f.position.x + 20) * S;
  const cy = -(f.position.y + 35) * S;
  d.drawCircle(cx, cy, 0.15);           // bowl
  d.drawRect(                            // tank
    f.position.x*S, -(f.position.y*S),
    (f.position.x+40)*S, -(f.position.y+16)*S
  );

For sink:
  d.drawRect(                            // outer
    f.position.x*S, -(f.position.y*S),
    (f.position.x+60)*S, -(f.position.y+50)*S
  );
  d.drawRect(                            // basin
    (f.position.x+8)*S, -(f.position.y+8)*S,
    (f.position.x+52)*S, -(f.position.y+42)*S
  );
  d.drawCircle(                          // drain
    (f.position.x+30)*S, -(f.position.y+25)*S, 0.03
  );

FIX 3 — Dimension lines black:
  d.addLayer('DIMENSIONS', 7, 'CONTINUOUS');  // 7 = black

Run: test DXF by opening in AutoCAD or LibreCAD.