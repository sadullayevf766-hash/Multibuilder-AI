STEP 1 — Paste exact browser console output for [PIPES] log.

STEP 2 — Paste ONLY the JSX element names in render order 
from Canvas2D.tsx return() block. Example format:
  <Layer>
    <Rect> // background
    <Grid lines>
    <Pipes?>
    <Walls>
    <Fixtures>
    <Dimensions>
  </Layer>

STEP 3 — Check if validPipes array is empty:
In the [PIPES] log — how many pipes are shown?
If 0, the filter is removing all pipes.

Change filter temporarily to show ALL pipes:
  const validPipes = drawing.pipes ?? [];
  console.log('[PIPES ALL]', validPipes.length, validPipes)

Paste output.