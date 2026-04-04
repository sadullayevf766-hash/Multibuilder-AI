Fix these bugs. Run grep commands first to find exact locations.

BUG 1 & 2 — Pipe routing diagonal lines:
grep -n "pipe\|Pipe\|route" server/engine/FloorPlanEngine.ts

Pipes must NEVER be diagonal. Only orthogonal routing (L-shape):
- Go horizontal first, then vertical (or vice versa)
- Replace any direct point-to-point pipe with L-shaped route:

// WRONG:
{ x1: fixture.x, y1: fixture.y, x2: manifold.x, y2: manifold.y }

// CORRECT (L-shape, two segments):
[
  { x1: fixture.x, y1: fixture.y, x2: manifold.x, y2: fixture.y },
  { x1: manifold.x, y1: fixture.y, x2: manifold.x, y2: manifold.y }
]

Also filter: remove any pipe where x1===0 || y1===0.

BUG 3 — Dimensions wrong (requested 8x5, got 4x3):
grep -n "width\|length\|dimension\|scale\|SCALE" server/engine/FloorPlanEngine.ts
grep -n "width\|length\|dimension" server/ai/GeminiParser.ts

Find where dimensions are processed. 
DO NOT divide or multiply user input dimensions anywhere.
If user says 8x5, engine receives exactly: width=8, length=5.
Check if dimensions are being halved somewhere — remove that logic.

BUG 4 — Door outside wall:
grep -n "door\|Door" server/engine/FloorPlanEngine.ts

Door frame must be entirely inside wall thickness.
Door position: wall inner edge, not outer edge.
For east wall door: x = (roomWidth * SCALE) - WALL_THICKNESS + 2

BUG 5 — Fixture on wall line:
grep -n "placeFixture\|offset\|margin" server/engine/FloorPlanEngine.ts

Minimum gap between fixture edge and inner wall surface: 5 units.
fixture.x must be >= WALL_THICKNESS + 5
fixture.y must be >= WALL_THICKNESS + 5

After fixes run: npm test
Show before/after for each changed line.