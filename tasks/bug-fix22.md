Pipes are not visible. Show me console output:

STEP 1 — Paste the [PIPES] console.log output from browser.
(Should show array of pipe objects with path coordinates)

STEP 2 — In Canvas2D.tsx, find the pipe rendering section.
Paste the exact JSX that renders pipes (the .map() over pipes/validPipes).

Most likely issue: pipes render BEHIND white room background rect.
Check render order — paste the full return() JSX structure 
showing order of: background rect, grid, pipes, walls, fixtures.
Just the element names/order, not full code.