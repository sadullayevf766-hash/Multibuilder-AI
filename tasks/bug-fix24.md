TWO fixes. Exact code changes.

FIX 1 — Sink gets no cold/hot pipes:
In FloorPlanEngine.ts generatePipes(), 
show me current if/switch block for fixture types.
Run: grep -n -A5 "fixture.type\|cold\|hot\|drain\|push" \
  server/src/engine/FloorPlanEngine.ts | head -40

The block must be:
  for (const fixture of fixtures) {
    if (['sink', 'bathtub', 'shower'].includes(fixture.type)) {
      pipes.push(this.createPipe(fixture, 'cold', walls));
      pipes.push(this.createPipe(fixture, 'hot', walls));
    }
    if (['sink', 'bathtub', 'shower', 'toilet'].includes(fixture.type)) {
      pipes.push(this.createPipe(fixture, 'drain', walls));
    }
  }

FIX 2 — Drain endpoint {x:0, y:0} for sink on north wall:
The sink is on north wall, so nearest wall IS north wall.
findNearestWallPoint returns {x:0,y:0} because north wall 
start point is {x:0, y:0}.

Fix findNearestWallPoint to return wall SURFACE point, not wall start:
  if (wall.side === 'north') candidate = { x: position.x, y: wall.start.y }
  // north wall y = 0, so candidate = {x: fixture.x, y: 0} ✓
  // But this is inside wall — move to inner surface:
  candidate = { x: position.x, y: WALL_THICKNESS }

Update all 4 sides:
  north: { x: position.x, y: WALL_THICKNESS }
  south: { x: position.x, y: roomLength * 100 - WALL_THICKNESS }
  east:  { x: roomWidth * 100 - WALL_THICKNESS, y: position.y }
  west:  { x: WALL_THICKNESS, y: position.y }

But for north wall sink, drain should go DOWN to nearest drain wall.
Since sink is on north wall, nearest drain point is south wall.
Add: skip the wall the fixture is ON, find nearest OTHER wall.

  findNearestWallPoint(position, walls, excludeWall?) {
    for (const wall of walls) {
      if (wall.side === excludeWall) continue; // skip own wall
      ...
    }
  }

Call: this.findNearestWallPoint(fixtureCenter, walls, fixture.wall)