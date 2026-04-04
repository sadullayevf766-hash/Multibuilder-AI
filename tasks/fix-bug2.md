I need you to fix bugs in specific files. 
Before changing anything, show me the current 
content of these files:
1. client/src/components/Canvas2D.tsx (or wherever walls are drawn)
2. server/engine/FloorPlanEngine.ts

Then fix EXACTLY these issues:

FIX 1 — Find every occurrence of these colors and replace:
- '#00ff00' → '#1a1a1a'
- 'green' → '#1a1a1a'  
- rgb(0,255,0) → '#1a1a1a'
Show me grep result: grep -rn "00ff00\|green" client/src/

FIX 2 — Find pipe initialization bug:
Run: grep -n "x1\|y1\|x2\|y2" server/engine/FloorPlanEngine.ts
Find any pipe/line created with x1=0, y1=0 as default.
Add validation: skip any element where x1===0 && y1===0.

FIX 3 — Fixture boundary:
Run: grep -n "placeFixture\|fixture.x\|fixture.y" server/engine/FloorPlanEngine.ts
After fixture position is set, add:
  const MARGIN = 10;
  const maxX = (roomWidth * 100) - fixture.width - MARGIN;
  const maxY = (roomLength * 100) - fixture.height - MARGIN;
  pos.x = Math.max(MARGIN, Math.min(pos.x, maxX));
  pos.y = Math.max(MARGIN, Math.min(pos.y, maxY));

FIX 4 — Dimension lines offset:
Run: grep -n "dimension\|Dimension" client/src/components/Canvas2D.tsx
Find where dimension lines are drawn.
Add padding to canvas: at least 80px on all sides.
Shift all room elements by offset: x+80, y+80.
Draw dimensions at: top=-30, bottom=roomH+30, left=-30, right=roomW+30.

After each fix, show me the changed lines (before/after).
Then run: npm test