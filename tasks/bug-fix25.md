THREE fixes.

FIX 1 — Cold/hot pipes still missing from logs:
Run: grep -n "cold\|hot\|push\|generatePipes" \
  server/src/engine/FloorPlanEngine.ts

Paste output. The fix from last time may not have been applied.
Expected: sink creates 3 pipes (cold, hot, drain).
Currently logs show only 1 pipe per fixture.

FIX 2 — Sink drain goes LEFT to west wall (wrong):
Sink is on north wall. Drain should go DOWN to south wall, not left.
In findNearestWallPoint with excludeWall:
The function excludes 'north' wall but then picks 'west' (nearest x distance).

Force drain direction based on fixture wall:
  if (fixture.wall === 'north' || fixture.wall === 'south') {
    // drain goes to nearest horizontal wall (east or west excluded)
    const southWall = walls.find(w => w.side === 'south');
    const northWall = walls.find(w => w.side === 'north');
    const toSouth = Math.abs(position.y - southWall.start.y);
    const toNorth = Math.abs(position.y - northWall.start.y);
    if (toSouth < toNorth) {
      return { x: position.x, y: southWall.start.y - WALL_THICKNESS };
    } else {
      return { x: position.x, y: northWall.start.y + WALL_THICKNESS };
    }
  }
  if (fixture.wall === 'east' || fixture.wall === 'west') {
    // drain goes to nearest vertical wall
    const eastWall = walls.find(w => w.side === 'east');
    const westWall = walls.find(w => w.side === 'west');
    const toEast = Math.abs(position.x - eastWall.start.x);
    const toWest = Math.abs(position.x - westWall.start.x);
    if (toEast < toWest) {
      return { x: eastWall.start.x - WALL_THICKNESS, y: position.y };
    } else {
      return { x: westWall.start.x + WALL_THICKNESS, y: position.y };
    }
  }

FIX 3 — Toilet drain goes to east wall (wrong):
Toilet is on south wall, center x=420 (middle of 8m room).
Drain should go DOWN to south wall: endpoint = {x:420, y:500}
Not right to east wall.

Apply same fix as FIX 2 — toilet wall is 'south', 
so drain goes to nearest horizontal wall = south wall itself?
No — exclude own wall, go to OPPOSITE:
  south fixture → drain goes to south wall (floor drain, straight down)
  
Actually for toilet: drain goes straight DOWN into floor.
Special case for toilet:
  if (fixture.type === 'toilet') {
    const ownWall = walls.find(w => w.side === fixture.wall);
    return { x: position.x, y: ownWall.start.y };
  }