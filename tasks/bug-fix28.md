THREE small fixes.

FIX 1 — Cold pipe too short, goes left (wrong):
Cold pipe must go RIGHT along north wall (to supply point).
Change cold pipe direction:
  cold path: [
    { x: fixtureCenter.x, y: WALL_THICKNESS + 8 },
    { x: roomWidth * UNITS_PER_METER - WALL_THICKNESS, y: WALL_THICKNESS + 8 }
  ]
  
Both cold and hot go to RIGHT wall (supply comes from right/east).
Offset them slightly: cold y = WALL_T + 8, hot y = WALL_T + 13.

FIX 2 — Hot pipe crosses full room width (too long):
Pipes should only go from fixture to nearest supply point (right wall).
This is already correct for hot. 
But visually it crosses over toilet area — this is OK for plumbing drawings,
pipes run along walls at top.

Actually the real fix: pipes should run INSIDE wall thickness zone.
Change both cold and hot y to be between 0 and WALL_THICKNESS:
  cold: y = WALL_THICKNESS - 5  (just inside wall)
  hot:  y = WALL_THICKNESS - 10

This hides them inside wall — professional style (pipes in wall).
Show only short stub from fixture to wall: 
  { x: fixtureCenter.x, y: fixtureCenter.y } → 
  { x: fixtureCenter.x, y: WALL_THICKNESS }

FIX 3 — Render order:
In Canvas2D.tsx return() JSX, ensure this exact order:
  1. Background rect (white)
  2. Grid
  3. Drain pipes (gray dashed) ← render first, under everything
  4. Cold/hot pipes (colored) ← render second  
  5. Walls (black double line)
  6. Door + Window
  7. Fixtures (symbols on top)
  8. Dimensions
  9. Title block + Legend

Move all pipe rendering BEFORE wall rendering in JSX.