LAST BUG. One line fix.

In Canvas2D.tsx, find where pipes are rendered as Konva Line.
Add this filter before rendering:

BEFORE rendering each pipe, skip if:
  - pipe.type === 'hot' AND pipe goes RIGHT (end.x > start.x + 10)
  - This means: end.x should NOT be greater than start.x for north wall fixture

More precisely, add endpoint validation in FloorPlanEngine.ts createPipe():
After endpoint is set, add:

  // Validate: north wall fixture pipe must go UP (endpoint.y < fixtureCenter.y)
  if (fixture.wall === 'north' && type !== 'drain') {
    endpoint = { x: fixtureCenter.x, y: 0 };
    // Force straight up, no L-shape needed
    return {
      id: `pipe-${type}-${fixture.id}`,
      type,
      path: [fixtureCenter, endpoint],
      color,
      fixtureId: fixture.id
    };
  }
  
  // South wall fixture pipe must go DOWN
  if (fixture.wall === 'south' && type !== 'drain') {
    const southWall = walls.find(w => w.side === 'south');
    endpoint = { x: fixtureCenter.x, y: southWall?.start.y ?? fixtureCenter.y + 50 };
    return {
      id: `pipe-${type}-${fixture.id}`,
      type,
      path: [fixtureCenter, endpoint],
      color,
      fixtureId: fixture.id
    };
  }

Run npm test. Then screenshot.