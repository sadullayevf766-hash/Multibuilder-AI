One line fix only.

In createPipe() drain section for toilet (south wall):
Current: drainStart.y = fixture.position.y + fixture.height = 500
But endpoint.y = 500 too — same point, zero length pipe.

Fix: toilet drain goes DOWN from fixture bottom to south wall:
  if (fixture.wall === 'south') {
    drainStart = { 
      x: fixtureCenter.x, 
      y: fixture.position.y  ← use TOP of fixture, not bottom
    }
    endpoint = { x: fixtureCenter.x, y: roomLength * UNITS_PER_METER }
  }

Expected result: drain path from y:430 to y:500 (visible short segment)