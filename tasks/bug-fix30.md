FINAL TWO fixes. After this the drawing is production-ready.

FIX 1 — Pipes render on top of walls (wrong):
In Canvas2D.tsx, change render order to:
  1. White background rect
  2. Grid
  3. ALL pipes (cold, hot, drain) ← BEFORE walls
  4. Walls (will cover pipe ends inside wall)
  5. Fixtures
  6. Door/Window
  7. Dimensions
  8. Title + Legend

Move pipe rendering JSX block to be BEFORE wall rendering.
Walls will naturally cover pipe segments that are inside wall thickness.

FIX 2 — Drain pipe visible through fixture symbol:
Drain pipes should render BEHIND fixtures.
This is already handled by FIX 1 render order above —
if pipes render before fixtures, fixtures cover the pipe.

Also: for drain pipe, start point should be at fixture BOTTOM edge, not center:
  For south-wall toilet (wall='south'): 
    start.y = fixture.position.y + fixture.height  (bottom of toilet)
  For north-wall sink (wall='north'):
    start.y = fixture.position.y + fixture.height  (bottom of sink)

In createPipe() for drain:
  const drainStart = fixture.wall === 'north' 
    ? { x: fixtureCenter.x, y: fixture.position.y + (fixture.height ?? 50) }
    : fixture.wall === 'south'
    ? { x: fixtureCenter.x, y: fixture.position.y + (fixture.height ?? 50) }
    : fixtureCenter;
  
  path = [drainStart, endpoint]

Run npm test. This is the final fix.