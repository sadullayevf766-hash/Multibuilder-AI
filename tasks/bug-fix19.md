ONE bug remains. The engine is correct (end y:0 is right).
Problem is in Canvas2D.tsx pipe rendering.

STEP 1 — Show me pipe rendering code:
grep -n "pipe\|path\|points\|Line\|stroke" \
  client/src/components/Canvas2D.tsx | grep -i "pipe\|path" | head -20

STEP 2 — The path array is:
  [{x:75, y:45}, {x:75, y:0}, {x:75, y:0}]
  
This means: start at (75,45), go to (75,0) — straight UP. Correct.
But it renders going DOWN-RIGHT. 

Check if Canvas2D is adding CANVAS_PADDING to path points:
  If path point y=0 gets + CANVAS_PADDING = y=80, 
  then pipe starts at wall, not fixture center.

Find where path points are converted to Konva Line points array.
It should be:
  const points = pipe.path.flatMap(p => [
    p.x + CANVAS_PADDING, 
    p.y + CANVAS_PADDING
  ]);

If CANVAS_PADDING is added to both start AND end, 
the pipe will render correctly relative to room.
Show me the current flatMap or points conversion code.