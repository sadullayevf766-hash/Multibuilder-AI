Show me console output FIRST, then fix.

STEP 1 — Add logs and share output:
In GeminiParser.ts, after parsing add:
  console.log('[PARSER] dimensions:', result.dimensions)

In FloorPlanEngine.ts, at start of generate():
  console.log('[ENGINE] received:', spec.width, spec.length)

In Canvas2D.tsx, at render start:
  console.log('[CANVAS] drawing:', data.metadata.dimensions)

Run the app, generate "8x5 metrli hojatxona", 
copy ALL 3 console lines here before changing anything.

STEP 2 — Fix pipe origin (after showing logs):
In FloorPlanEngine.ts, find where hot/cold water pipes are created.
Change starting point to fixture center:
  const cx = fixture.x + fixture.width / 2
  const cy = fixture.y + fixture.height / 2
  pipe.x1 = cx
  pipe.y1 = cy

STEP 3 — Fix fixture position:
Fixture must be placed INSIDE the room, touching the wall from inside.
  const WALL_T = 15  // wall thickness in units
  if (fixture.wall === 'north') fixture.y = WALL_T + 5
  if (fixture.wall === 'south') fixture.y = roomH - WALL_T - fixture.height - 5
  if (fixture.wall === 'west')  fixture.x = WALL_T + 5
  if (fixture.wall === 'east')  fixture.x = roomW - WALL_T - fixture.width - 5

Share the 3 console.log lines with me after step 1.