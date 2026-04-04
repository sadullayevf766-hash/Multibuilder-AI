Fix these in order:

FIX 1 — Length shows 4 instead of 5:
grep -n "length\|roomHeight\|roomH\b" server/src/engine/FloorPlanEngine.ts | head -20
grep -n "length\|roomHeight\|roomH\b" client/src/components/Canvas2D.tsx | head -20

Find where roomHeight is calculated and show me that code block.
Expected: if user says 8x5, roomHeight = 5 * 100 = 500 units.

FIX 2 — Door frame outside east wall:
In renderDoor(), east wall opening is wrong.
The opening rect must be INSIDE the wall, not outside.
Change east wall opening:
  openingPoints = [roomW - WALL_T, dy, roomW, dy + doorWidth]
To:
  openingPoints = [roomW - WALL_T - 2, dy, roomW + 2, dy + doorWidth]
And clip the opening with wall bounds so it does not exceed roomW.

FIX 3 — Drain pipe hidden under floor:
Drain pipe from toilet should be dashed gray line going to south wall.
In createPipe(), for drain type, set:
  strokeDashArray = [4, 4]
In Canvas2D.tsx, render drain pipes with:
  dash={[4, 4]}
  opacity={0.6}

FIX 4 — Fixtures must snap to nearest wall:
In FloorPlanEngine.ts placeFixture():
Toilet default wall: 'south', centered horizontally
Sink default wall: 'north', offset 0.5m from west corner
Show me current placeFixture() code first.