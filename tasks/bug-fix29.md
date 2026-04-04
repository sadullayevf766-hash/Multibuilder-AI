Open server/src/engine/FloorPlanEngine.ts
Find the createPipe() function.
Find this exact block (or similar):

  if (fixture.wall === 'north' && type !== 'drain') {
    return {
      path: [
        { x: fixtureCenter.x, y: fixtureCenter.y },
        { x: fixtureCenter.x, y: WALL_THICKNESS }
      ],
      ...
    };
  }

DELETE this entire if block.

Replace with this EXACT code:

  if (type === 'cold') {
    return {
      id: `pipe-cold-${fixture.id}`,
      type: 'cold',
      path: [
        { x: fixtureCenter.x, y: fixtureCenter.y },
        { x: fixtureCenter.x, y: WALL_THICKNESS + 10 },
        { x: roomWidth * UNITS_PER_METER - WALL_THICKNESS - 10, y: WALL_THICKNESS + 10 }
      ],
      color: 'blue',
      fixtureId: fixture.id
    };
  }

  if (type === 'hot') {
    return {
      id: `pipe-hot-${fixture.id}`,
      type: 'hot',
      path: [
        { x: fixtureCenter.x, y: fixtureCenter.y },
        { x: fixtureCenter.x, y: WALL_THICKNESS + 18 },
        { x: roomWidth * UNITS_PER_METER - WALL_THICKNESS - 10, y: WALL_THICKNESS + 18 }
      ],
      color: 'red',
      fixtureId: fixture.id
    };
  }

Where roomWidth comes from: add parameter to createPipe():
  createPipe(fixture, type, walls, roomSpec)
And pass roomSpec when calling: this.createPipe(fixture, type, walls, roomSpec)

After this change, expected log:
  cold path: [{x:80,y:45},{x:80,y:25},{x:785,y:25}]
  hot  path: [{x:80,y:45},{x:80,y:33},{x:785,y:33}]

These are L-shaped paths — visible inside room along north wall.
Run npm test. Screenshot.