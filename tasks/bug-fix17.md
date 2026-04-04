THREE fixes. Exact locations below.

FIX 1 — Canvas gets width/length swapped:
In Canvas2D.tsx, find where roomWidth and roomHeight are set from data.
Run: grep -n "roomWidth\|roomHeight\|width\|length\|metadata" \
  client/src/components/Canvas2D.tsx | head -20

Almost certainly this is swapped:
  WRONG:  roomWidth = metadata.width,  roomHeight = metadata.length  
  or:     roomWidth = dimensions[0],   roomHeight = dimensions[1]

Paste the grep output. Fix by ensuring:
  roomWidth  = data.metadata.dimensions.width  * UNITS_PER_METER
  roomHeight = data.metadata.dimensions.length * UNITS_PER_METER

FIX 2 — Sink creates 3 pipes instead of 1:
In generatePipes(), sink is calling createPipe 3 times.
Run: grep -n "sink\|cold\|hot\|drain\|push" \
  server/src/engine/FloorPlanEngine.ts | head -30

Find the switch/if block that decides which pipes to create per fixture type.
Sink should only get: cold + hot (no drain).
Toilet should only get: drain (no cold/hot).

Fix:
  if (fixture.type === 'sink' || fixture.type === 'bathtub') {
    pipes.push(createPipe(fixture, 'cold', walls));
    pipes.push(createPipe(fixture, 'hot', walls));
  }
  if (fixture.type === 'toilet' || fixture.type === 'sink' || 
      fixture.type === 'bathtub') {
    pipes.push(createPipe(fixture, 'drain', walls));
  }

FIX 3 — Third pipe goes to (0,0):
After FIX 2, the extra pipe disappears.
But also add safety filter in Canvas2D.tsx before rendering pipes:
  const validPipes = pipes.filter(p => 
    p.path.every(pt => pt.x > 0 || pt.y > 0)
  );
Use validPipes instead of pipes for rendering.

Run npm test after all fixes.