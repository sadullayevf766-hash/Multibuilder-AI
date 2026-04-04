Two final bugs.

FIX 1 — Red pipe (hot water) wrong direction:
Add this log in createPipe() right before return:
  console.log('[PIPE FINAL]', type, 
    'start:', fixtureCenter, 
    'end:', endpoint,
    'path:', JSON.stringify(path))

Run app, paste [PIPE FINAL] log for sink hot pipe.

Also check: hot water pipe endpoint for north wall fixture 
should be { x: fixtureCenter.x, y: 0 } — going UP to north wall.
Current code likely has:
  if (fixture.wall === 'north') endpoint = { x: fixtureCenter.x, y: 0 }
But pipe renders going DOWN. 

Check Canvas2D.tsx — how are pipe paths rendered?
Run: grep -n "path\|points\|pipe\|Line" \
  client/src/components/Canvas2D.tsx | grep -i "pipe\|path" | head -20

FIX 2 — Door frame outside wall:
In Canvas2D.tsx renderDoor(), find the door frame Rect or Line.
It must be clipped to wall thickness.
For east wall, add to the frame element:
  clipX={roomW - WALL_T - 1}
  clipY={dy - 1}
  clipWidth={WALL_T + 2}
  clipHeight={doorWidth + 2}

Show me the door frame rendering code (the Rect/Line after wall opening).