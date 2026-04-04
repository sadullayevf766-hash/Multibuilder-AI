Three exact fixes. Show grep results before changing.

FIX 1 — Pipe goes to wrong wall:
In createPipe(), replace findNearestWallPoint with wall-aware routing.
Fixture already knows which wall it belongs to (fixture.wall).
Pipe must go to THAT wall, not nearest midpoint:

REPLACE entire endpoint logic with:
  const targetWall = walls.find(w => w.side === fixture.wall);
  if (!targetWall) return null;
  
  // Endpoint: same side as fixture, at wall surface
  let endpoint: Point;
  if (fixture.wall === 'north') {
    endpoint = { x: fixtureCenter.x, y: 0 };
  } else if (fixture.wall === 'south') {
    endpoint = { x: fixtureCenter.x, y: targetWall.start.y };
  } else if (fixture.wall === 'west') {
    endpoint = { x: 0, y: fixtureCenter.y };
  } else { // east
    endpoint = { x: targetWall.start.x, y: fixtureCenter.y };
  }
  
  // Drain: go to nearest wall instead
  if (type === 'drain') {
    endpoint = this.findNearestWallPoint(fixtureCenter, walls);
  }

FIX 2 — Canvas height shows 4 instead of 5:
Run: grep -n "roomHeight\|setRoom\|useState\|metadata" \
  client/src/components/Canvas2D.tsx | head -30
Show output. Do not fix yet.

FIX 3 — Door arc too large, exits wall:
In renderDoor(), east wall section:
Change outerRadius from doorWidth to doorWidth * 0.85
Also add clipFunc to Konva Arc to clip at wall boundary:
  clipX={roomW - WALL_T - doorWidth}
  clipY={arcY - doorWidth}  
  clipWidth={doorWidth + WALL_T}
  clipHeight={doorWidth * 2}

Run npm test after FIX 1 and FIX 3.
Show grep output for FIX 2.