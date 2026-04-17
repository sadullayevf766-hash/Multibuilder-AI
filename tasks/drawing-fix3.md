The codebase is Multibuilder-AI. Previous fixes improved the walls and 
removed the mascot. Now fix the remaining 7 problems listed below.
Scan the codebase first, then apply each fix precisely.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## REMAINING PROBLEM 1 — DIMENSION LINES STILL USE ARROWS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: client/src/components/Canvas2D.tsx
Function: addDimension()

Current wrong behavior: Konva.Arrow is used at line endpoints.
Required: Replace with GOST tick marks (45° slash at each end).

Replace the entire addDimension() function with this logic:

```typescript
function addDimension(layer: Konva.Layer, dim: DimensionLine) {
  const PAD = 120; // or whatever your current padding constant is
  const sx = dim.start.x + PAD, sy = dim.start.y + PAD;
  const ex = dim.end.x + PAD,   ey = dim.end.y + PAD;
  const mx = (sx + ex) / 2,     my = (sy + ey) / 2;

  // Room label only (value === 0 means label, not dimension)
  if (dim.value === 0) {
    layer.add(new Konva.Text({
      x: mx - 55, y: my - 9, width: 110, align: 'center',
      text: dim.label, fontSize: 10, fontStyle: 'bold', fill: '#1a1a1a',
    }));
    return;
  }

  const dx = ex - sx, dy = ey - sy;
  const len = Math.sqrt(dx*dx + dy*dy);
  if (len < 1) return;

  // Unit vectors
  const ux = dx/len, uy = dy/len;   // along dimension line
  const nx = -uy,    ny = ux;       // perpendicular (outward)
  const OFF = -45;                   // offset outside wall

  // Offset endpoints
  const osx = sx + nx*OFF, osy = sy + ny*OFF;
  const oex = ex + nx*OFF, oey = ey + ny*OFF;

  // Extension lines (wall face → 10 units past dim line)
  layer.add(new Konva.Line({
    points: [sx, sy, sx + nx*(OFF-10), sy + ny*(OFF-10)],
    stroke: '#555555', strokeWidth: 0.8,
  }));
  layer.add(new Konva.Line({
    points: [ex, ey, ex + nx*(OFF-10), ey + ny*(OFF-10)],
    stroke: '#555555', strokeWidth: 0.8,
  }));

  // Main dimension line
  layer.add(new Konva.Line({
    points: [osx, osy, oex, oey],
    stroke: '#111111', strokeWidth: 1.0,
  }));

  // Tick marks at each end — 45° slash (GOST style, NOT arrows)
  const T = 6; // half tick size
  layer.add(new Konva.Line({
    points: [osx - ux*T - nx*T, osy - uy*T - ny*T,
             osx + ux*T + nx*T, osy + uy*T + ny*T],
    stroke: '#111111', strokeWidth: 1.5,
  }));
  layer.add(new Konva.Line({
    points: [oex - ux*T - nx*T, oey - uy*T - ny*T,
             oex + ux*T + nx*T, oey + uy*T + ny*T],
    stroke: '#111111', strokeWidth: 1.5,
  }));

  // Text centered above dim line
  const isVertical = Math.abs(dy) > Math.abs(dx);
  layer.add(new Konva.Text({
    x: mx + nx*OFF - (isVertical ? 18 : 22),
    y: my + ny*OFF - (isVertical ? 6 : 14),
    text: dim.label,
    fontSize: 9.5, fontFamily: 'Arial', fill: '#111111',
    rotation: isVertical ? -90 : 0,
  }));
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## REMAINING PROBLEM 2 — WALL CORNERS HAVE GAPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: client/src/components/Canvas2D.tsx
Function: addWall() — called once per wall segment

The problem is each wall is drawn independently so the 
corner joints do not align perfectly.

Fix: After all 4 walls are drawn, draw 4 small filled squares 
at each corner to cover any gap:

Add this function and call it once after all addWall() calls:

```typescript
function fillCorners(layer: Konva.Layer, walls: Wall[], padding: number) {
  // Collect all corner points (where walls meet)
  const corners = [
    walls.find(w => w.side === 'north')?.start,
    walls.find(w => w.side === 'north')?.end,
    walls.find(w => w.side === 'south')?.start,
    walls.find(w => w.side === 'south')?.end,
  ].filter(Boolean) as Point[];

  const T = 15; // WALL_T
  corners.forEach(corner => {
    layer.add(new Konva.Rect({
      x: corner.x + padding - T/2 - 1,
      y: corner.y + padding - T/2 - 1,
      width: T + 2,
      height: T + 2,
      fill: '#cccccc',
      stroke: '#111111',
      strokeWidth: 0,
    }));
  });
}
```

Call fillCorners(layer, drawingData.walls, CANVAS_PADDING) 
right after all walls are drawn in the useEffect render loop.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## REMAINING PROBLEM 3 — FIXTURES ARE PLAIN RECTANGLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: client/src/components/Canvas2D.tsx
Function: addFixture()

Replace these specific fixture renderers inside addFixture():

### tv_unit (current: plain rect + small rect)
```typescript
} else if (t === 'tv_unit') {
  // Cabinet base
  g.add(new Konva.Rect({ x, y, width:150, height:45, 
    fill:'#e8e8e8', stroke:'#111', strokeWidth:1.5 }));
  // TV screen (dark inset)
  g.add(new Konva.Rect({ x:x+8, y:y+5, width:134, height:28, 
    fill:'#1a2035', stroke:'#444', strokeWidth:1 }));
  // Screen glare line
  g.add(new Konva.Line({ 
    points:[x+12, y+8, x+30, y+8], stroke:'#ffffff', 
    strokeWidth:1, opacity:0.3 }));
  // Two cabinet legs
  g.add(new Konva.Rect({ x:x+20, y:y+40, width:12, height:8, 
    fill:'#aaa', stroke:'#888', strokeWidth:0.5 }));
  g.add(new Konva.Rect({ x:x+118, y:y+40, width:12, height:8, 
    fill:'#aaa', stroke:'#888', strokeWidth:0.5 }));
```

### sofa (current: back panel + cushions but needs armrests)
```typescript
} else if (t === 'sofa') {
  const sw=200, sh=90;
  // Back panel
  g.add(new Konva.Rect({ x, y, width:sw, height:22, 
    fill:'#c0c0c0', stroke:'#111', strokeWidth:1.5 }));
  // Left armrest
  g.add(new Konva.Rect({ x, y:y+22, width:12, height:sh-22, 
    fill:'#b0b0b0', stroke:'#888', strokeWidth:1 }));
  // Right armrest
  g.add(new Konva.Rect({ x:x+sw-12, y:y+22, width:12, height:sh-22, 
    fill:'#b0b0b0', stroke:'#888', strokeWidth:1 }));
  // 3 seat cushions
  for (let i=0; i<3; i++) {
    g.add(new Konva.Rect({ 
      x:x+12+i*((sw-24)/3)+2, y:y+24, 
      width:(sw-24)/3-4, height:sh-28, 
      fill:'#d8d8d8', stroke:'#999', strokeWidth:1, cornerRadius:3 
    }));
  }
  // Cushion seam lines
  g.add(new Konva.Line({ 
    points:[x+12+(sw-24)/3, y+24, x+12+(sw-24)/3, y+sh], 
    stroke:'#aaa', strokeWidth:0.8 }));
  g.add(new Konva.Line({ 
    points:[x+12+2*(sw-24)/3, y+24, x+12+2*(sw-24)/3, y+sh], 
    stroke:'#aaa', strokeWidth:0.8 }));
```

### coffee_table
```typescript
} else if (t === 'coffee_table') {
  // Outer frame
  g.add(new Konva.Rect({ x, y, width:90, height:50, 
    fill:'#f5f0e8', stroke:'#111', strokeWidth:1.5, cornerRadius:2 }));
  // Glass top inset (lighter inner rect)
  g.add(new Konva.Rect({ x:x+6, y:y+6, width:78, height:38, 
    fill:'#fafaf5', stroke:'#ccc', strokeWidth:0.8, cornerRadius:1 }));
  // 4 corner leg dots
  [[x+5,y+5],[x+83,y+5],[x+5,y+43],[x+83,y+43]].forEach(([lx,ly]) =>
    g.add(new Konva.Circle({ x:lx, y:ly, radius:3, 
      fill:'#aaa', stroke:'#888', strokeWidth:0.5 }))
  );
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## REMAINING PROBLEM 4 — WINDOW SYMBOL IS BLUE (WRONG)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: client/src/components/Canvas2D.tsx
Function: addWindow()

Current: Window drawn with blue lines and blue fill tint.
Required: 3 parallel BLACK lines only. No fill. No color.

Find every line/rect in addWindow() that has:
  stroke: '#3b82f6'  or  fill with opacity  or  blue color
Change all strokes to '#1a1a1a'.
Remove any fill rect that adds color tint.
Remove any opacity on the lines.

The 3 lines should be:
  Line 1 (outer): strokeWidth 1.0, stroke '#1a1a1a'
  Line 2 (center): strokeWidth 1.8, stroke '#1a1a1a'  
  Line 3 (inner): strokeWidth 1.0, stroke '#1a1a1a'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## REMAINING PROBLEM 5 — DOOR HAS NO WALL GAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: client/src/components/Canvas2D.tsx
Function: addDoor()

Current: Arc is drawn on top of wall. Wall is not opened.
Required: Wall must be visually cut at door position.

In addDoor(), after computing openX/openY/openW/openH:

Step 1 — White out the wall fill at door position:
```typescript
// Already exists in most implementations as:
g.add(new Konva.Rect({ 
  x: openX, y: openY, width: openW, height: openH, 
  fill: 'white', strokeWidth: 0 
}));
```
If this rect exists but the wall fill still shows through, the issue 
is Z-order: doors must be added to layer AFTER walls.

Check the render order in useEffect:
  ✅ Correct order:
  1. Room background fill
  2. Grid  
  3. Pipes
  4. Walls          ← walls drawn here
  5. Doors          ← doors drawn AFTER walls (white rect covers wall fill)
  6. Windows
  7. Fixtures
  8. Dimensions

If doors are rendered before walls, swap the order.

Also ensure the door arc uses dashed line:
```typescript
g.add(new Konva.Arc({
  x: arcX, y: arcY,
  innerRadius: 0, outerRadius: doorWidth,
  angle: 90, rotation: arcRotation,
  stroke: '#111111', strokeWidth: 1,
  dash: [5, 3],    // ← MUST be dashed
  fill: undefined,
}));
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## REMAINING PROBLEM 6 — LEGEND HAS NO BORDER BOX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: client/src/components/Canvas2D.tsx
Function: addLegend()

Add a bordered rectangle around the entire legend content:

```typescript
function addLegend(layer: Konva.Layer, totalHeight: number) {
  const LX = CANVAS_PADDING;       // or PAD — your padding constant
  const LY = totalHeight + CANVAS_PADDING + 28;

  // Border box — ADD THIS (currently missing)
  layer.add(new Konva.Rect({
    x: LX - 8, y: LY - 6,
    width: 168, height: 58,
    fill: 'white',
    stroke: '#aaaaaa',
    strokeWidth: 0.8,
  }));

  // Keep existing legend lines and text unchanged below this
  // ...
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## REMAINING PROBLEM 7 — GRID TOO VISIBLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

File: client/src/components/Canvas2D.tsx
Function: addGrid()

Current: Grid lines are solid, distracting from drawing elements.

Replace the entire addGrid() function with dot grid:

```typescript
function addGrid(layer: Konva.Layer, gridW: number, gridH: number) {
  const STEP = 100;
  for (let x = 0; x <= gridW; x += STEP) {
    for (let y = 0; y <= gridH; y += STEP) {
      layer.add(new Konva.Circle({
        x, y, radius: 0.9,
        fill: '#cccccc',
      }));
    }
  }
}
```

This replaces full grid lines with subtle dots at intersections only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## AFTER ALL FIXES — VERIFY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run:
  cd server && npm test         → must show 39 passed
  cd client && npx tsc --noEmit → must show 0 errors

Report which files were modified and what changed in each.
```