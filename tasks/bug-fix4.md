Three bugs remain. Fix them one by one.

═══ BUG 1 — Red pipe starts from wrong position ═══

The red (hot water) pipe starts from x=0 or left wall 
instead of the fixture center.

Run this:
grep -n "hot\|red\|#ef4444\|#e74c3c" server/engine/FloorPlanEngine.ts

The pipe x1 must equal fixture.x + fixture.width/2
The pipe y1 must equal fixture.y + fixture.height/2
NOT the wall position, NOT 0.

Fix: pipe origin = fixture center point, not wall coordinate.

═══ BUG 2 — Gray drain pipe ends in empty space ═══

Drain pipe must end at the nearest wall, not at a fixed offset.

Current (wrong):
{ x1: fixture.x, y1: fixture.y, x2: fixture.x + 100, y2: fixture.y }

Correct:
const nearestWallX = fixture.x > roomCenterX 
  ? roomWidth * SCALE - WALL_THICKNESS  
  : WALL_THICKNESS;
{ x1: fixture.x, y1: fixture.y, x2: nearestWallX, y2: fixture.y }

═══ BUG 3 — Dimensions ignored (8x5 → shows 3x4) ═══

This is critical. Run:
grep -rn "width\|length" server/ai/GeminiParser.ts
grep -rn "width\|length\|roomWidth\|roomLength" server/engine/FloorPlanEngine.ts
grep -rn "dimensions" server/routes/generate.ts

Find where user input "8x5" is parsed. 
Console.log the value at each step:
  1. After GeminiParser: console.log('Parsed dims:', result.dimensions)
  2. After FloorPlanEngine: console.log('Engine dims:', spec.width, spec.length)
  3. In Canvas2D: console.log('Canvas dims:', drawingData.metadata.dimensions)

Show me the console output for input "8x5 metrli hojatxona".
The number shown in canvas MUST match user input exactly.

Run npm test after fixes.