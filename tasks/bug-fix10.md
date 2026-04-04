Fix these 2 bugs exactly.

═══ FIX 1 — Pipe goes to wrong corner ═══

In createPipe(), replace findNearestCorner with findNearestWallPoint for ALL pipe types.
Hot and cold water pipes should also go to nearest wall, not corner:

CHANGE THIS:
  if (type === 'drain') {
    endpoint = this.findNearestWallPoint(fixtureCenter, walls);
  } else {
    endpoint = this.findNearestCorner(fixtureCenter, walls);
  }

TO THIS:
  endpoint = this.findNearestWallPoint(fixtureCenter, walls);

Then fix L-shape routing direction based on which wall the pipe goes to:
  const goingHorizontal = Math.abs(endpoint.x - fixtureCenter.x) > 
                          Math.abs(endpoint.y - fixtureCenter.y);
  const intermediatePoint: Point = goingHorizontal
    ? { x: endpoint.x, y: fixtureCenter.y }
    : { x: fixtureCenter.x, y: endpoint.y };

═══ FIX 2 — Door renders outside wall ═══

In Canvas2D.tsx, find renderDoor() function.
Show me its current code first (paste it here).
Then apply this fix:

Door must render ON the wall, arc swings INWARD.
const WALL_T = 15; // wall thickness units

For north wall door:
  - Opening: from (door.x, 0) to (door.x + doorWidth, WALL_T)
  - Arc center: (door.x, WALL_T), radius: doorWidth, from 0° to 90°

For south wall door:
  - Opening: from (door.x, roomH - WALL_T) to (door.x + doorWidth, roomH)  
  - Arc center: (door.x, roomH - WALL_T), radius: doorWidth, from 270° to 360°

For east wall door:
  - Opening: from (roomW - WALL_T, door.y) to (roomW, door.y + doorWidth)
  - Arc center: (roomW - WALL_T, door.y), radius: doorWidth, from 0° to 90°

For west wall door:
  - Opening: from (0, door.y) to (WALL_T, door.y + doorWidth)
  - Arc center: (WALL_T, door.y + doorWidth), radius: doorWidth, from 180° to 270°

Show me renderDoor() code before changing it.