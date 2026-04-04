THREE fixes.

FIX 1 — Pipes not visible inside room:
Add this log in Canvas2D.tsx before pipe rendering:
  console.log('[PIPES]', validPipes.map(p => ({
    type: p.type,
    path: p.path,
    color: p.color
  })))

Paste the console output. 
Also check: are pipes being rendered UNDER the room background rect?
If yes, move pipe rendering AFTER the room background, BEFORE fixtures.
Render order must be:
  1. Room background (white rect)
  2. Grid
  3. Pipes ← here
  4. Walls
  5. Fixtures
  6. Dimensions
  7. Title block + Legend

FIX 2 — Red line outside sink symbol:
The hot water pipe for north wall sink must be hidden inside wall.
In Canvas2D.tsx, for pipes going to north wall (endpoint.y === CANVAS_PADDING):
  Do not render the pipe segment that is inside the wall thickness.
  Clip pipe end point to: y = CANVAS_PADDING + WALL_THICKNESS

Or simpler: hide cold/hot pipes entirely when they are shorter than 20 units:
  const validPipes = pipes.filter(p => {
    const dx = p.path[p.path.length-1].x - p.path[0].x;
    const dy = p.path[p.path.length-1].y - p.path[0].y;
    return Math.sqrt(dx*dx + dy*dy) > 20;
  });

FIX 3 — Toilet too small:
In FloorPlanEngine.ts confirm these values are saved:
  toilet: width=40, height=70
Then in ToiletSymbol.tsx (or wherever toilet is drawn),
make sure it uses fixture.width and fixture.height, not hardcoded values.
grep -n "toilet\|40\|70\|width\|height" client/src/components/Canvas2D.tsx | head -20