FIX 1 — Red pipe still wrong:
Run: grep -n "fixture.wall\|fixtureCenter\|endpoint\|north\|south\|east\|west" \
  server/src/engine/FloorPlanEngine.ts | grep -A2 -B2 "createPipe\|endpoint"

Paste output. The fix from last time may not have been saved correctly.
Also add this log inside createPipe():
  console.log('[PIPE]', fixture.type, 'wall:', fixture.wall, 
              'center:', fixtureCenter, 'endpoint:', endpoint)
Run app, paste the log output for sink fixture.

FIX 2 — Height shows 4 not 5:
Run app with "8x5 hojatxona", open browser console.
Paste ALL console.log lines that contain numbers.
Specifically looking for where 5 becomes 4.

FIX 3 — Door frame outside wall:
In renderDoor(), east wall section, the white Rect opening is too wide.
Change:
  openingPoints = [roomW - WALL_T - 2, dy, roomW + 2, dy + doorWidth]
To:
  openingPoints = [roomW - WALL_T, dy, roomW, dy + doorWidth]

Also the black frame rect around the door — find where it is rendered
and add: clipX={roomW - WALL_T}, clipWidth={WALL_T}
so it cannot exceed the wall boundary.