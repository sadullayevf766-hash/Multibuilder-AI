Cold/hot pipes are still not being created.

Run this and paste output:
grep -n -A3 "cold\|hot\|push" server/src/engine/FloorPlanEngine.ts | head -50

Expected to see:
  pipes.push(this.createPipe(fixture, 'cold', walls));
  pipes.push(this.createPipe(fixture, 'hot', walls));

If not found → the fix was never applied.

Apply now in generatePipes():
  for (const fixture of fixtures) {
    if (['sink', 'bathtub', 'shower'].includes(fixture.type)) {
      pipes.push(this.createPipe(fixture, 'cold', walls));
      pipes.push(this.createPipe(fixture, 'hot', walls));
    }
    if (['sink', 'bathtub', 'shower', 'toilet'].includes(fixture.type)) {
      pipes.push(this.createPipe(fixture, 'drain', walls));
    }
  }

Then in createPipe() for cold/hot on north wall:
  if (fixture.wall === 'north' && type !== 'drain') {
    return {
      id: `pipe-${type}-${fixture.id}`,
      type,
      path: [
        { x: fixtureCenter.x, y: fixtureCenter.y },
        { x: fixtureCenter.x, y: WALL_THICKNESS }
      ],
      color,
      fixtureId: fixture.id
    };
  }

After fix, expected logs:
  [PIPE] sink cold ...
  [PIPE] sink hot ...
  [PIPE] sink drain ...
  [PIPE] toilet drain ...

Run npm test. Screenshot.