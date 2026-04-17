You are a senior CAD software engineer. You have been given a codebase for 
"Multibuilder-AI" — an AI-powered architectural drawing generator. 

Your job: analyze the entire codebase, identify every file responsible for 
rendering drawings, and upgrade the output quality to match professional 
GOST/SNiP architectural drawing standards.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## CURRENT OUTPUT (what the app produces now)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Looking at the current screenshot, these problems are visible:

PROBLEM 1 — WALLS ARE TOO THIN AND UNFINISHED
Current: Walls are drawn as simple gray rectangles with black outlines.
The corners where walls meet are not properly joined — there are visible 
gaps or overlaps at every corner junction.
Wall fill is flat #f5f5f5 (too light, looks like empty space).

PROBLEM 2 — DIMENSION LINES USE ARROWS (WRONG)
Current: Dimension lines end with arrowheads (→←).
Professional GOST standard requires 45° tick marks (╲ ╲), not arrows.
Also: dimension text is too small and not centered properly above the line.
Extension lines are missing (should go from wall face to past the dim line).

PROBLEM 3 — DOOR ARC IS DRAWN ON TOP OF WALL (WRONG)
Current: The door swing arc sits on top of the wall fill — the wall is 
not opened/cut where the door is.
Required: The wall must have a visible GAP at the door position, then the 
door leaf line and dashed swing arc drawn inside that gap.

PROBLEM 4 — WINDOW SYMBOL IS WRONG
Current: Window is shown as a blue-tinted rectangle with 3 blue lines.
Required: Window symbol = 3 parallel black lines spanning the wall 
thickness only. No blue color. No fill. Clean thin lines.

PROBLEM 5 — FIXTURES LACK CAD DETAIL
Current: All fixtures (TV, sofa, coffee table, desk, bed, etc.) are plain 
rectangles with a text label inside.
Required: Each fixture must be drawn as a recognizable CAD symbol:
  - Sofa: back panel + 3 separate seat cushions + two armrests
  - TV unit: dark screen rectangle inset + two small legs
  - Coffee table: outer rect + inner inset rect (glass top effect)
  - Desk: monitor rectangle on top edge + stand line
  - Bed: headboard + two pillows + blanket dividing line
  - Wardrobe: vertical panel lines + small handle marks
  - Toilet: tank rectangle + teardrop bowl ellipse + inner seat ellipse
  - Sink: outer rect + basin ellipse + faucet rectangle + drain dot
  - Bathtub: outer rect with rounded corners + inner inset + drain circle

PROBLEM 6 — TITLE BLOCK IS TOO SMALL AND INCOMPLETE
Current: Small box in bottom-right with "Floor Plan", scale, date, SNiP.
Required: Full GOST shtamp with:
  - Two-column layout divided by vertical line
  - Left col: "Loyiha nomi" label + "Floor Plan" value, "Masshtab" + "1:50", 
    "SNiP 2.04.01-85"
  - Right col: "Sana" label + date value, "Bosqich" + "РП"
  - Outer border strokeWidth 1.5, inner dividers strokeWidth 0.8
  - Size: at least 220×80 units

PROBLEM 7 — LEGEND BOX HAS NO BORDER
Current: Legend (Sovuq suv / Issiq suv / Kanalizatsiya) floats with no 
enclosing box.
Required: Legend inside a bordered rectangle with white fill, thin border.

PROBLEM 8 — NO LINE WEIGHT HIERARCHY
Current: Every line has the same strokeWidth (~1-2px).
Required GOST line weights:
  - Outer wall face: strokeWidth 2.5
  - Inner wall face: strokeWidth 1.5  
  - Dimensions, leaders: strokeWidth 1.0
  - Grid, hatching: strokeWidth 0.3
  - Fixture outlines: strokeWidth 1.5
  - Fixture inner details: strokeWidth 0.8

PROBLEM 9 — ROBOT MASCOT APPEARS IN DRAWING AREA
Current: There is a cartoon robot image visible in the bottom-left of 
the drawing output.
Required: No mascots, logos, or decorative images inside the drawing frame.
The drawing area must contain only architectural elements.

PROBLEM 10 — GRID IS TOO VISIBLE
Current: Grid lines are solid and distracting.
Required: Either use very faint dots (r=0.8, fill=#cccccc) at grid 
intersections, or reduce grid line opacity to strokeWidth=0.3, 
color=#eeeeee so it does not compete with drawing elements.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## REFERENCE STANDARD (target quality)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The target output must look like a professional AutoCAD drawing following:
- GOST 21.501-2011 (architectural floor plans)
- GOST 21.205-93 (conventional symbols for plumbing fixtures)
- SNiP 2.04.01-85 (water supply and drainage)

Key visual characteristics of professional drawings:
1. Walls are clearly double-line with visible gray hatch fill between lines
2. Corners are perfectly mitered — zero gaps
3. Dimension lines are clean with tick marks and centered text above line
4. Every fixture is immediately recognizable by its shape alone, no label needed
5. Line weights create clear visual hierarchy: walls dominate, details recede
6. Title block looks like an official stamp with proper table structure

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## YOUR TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 — SCAN THE CODEBASE
Find and read every file involved in drawing generation and rendering.
Start with:
  client/src/components/Canvas2D.tsx     ← main renderer (Konva.js)
  server/src/engine/FloorPlanEngine.ts   ← coordinate engine
  shared/types.ts                        ← type definitions
  client/src/components/symbols/         ← existing SVG symbols (if any)
  server/src/export/PdfExporter.ts       ← PDF export renderer
  server/src/export/DxfExporter.ts       ← DXF export renderer

For each file, understand exactly what it draws and how.

STEP 2 — FIX ALL 10 PROBLEMS
Apply all fixes described above. For each fix:
- Edit the exact function responsible
- Do not break existing functionality
- Keep all TypeScript types intact
- Do not change API endpoints or data flow

STEP 3 — SPECIFIC IMPLEMENTATION DETAILS

### Wall corners (Problem 1):
Instead of drawing each wall as an independent rectangle, compute the 
corner intersection points for all 4 walls and draw the outer polygon 
and inner polygon of the room separately:

```typescript
// Outer polygon (outside face of all walls)
// Inner polygon (inside face of all walls — the room floor area)
// Fill outer polygon with #d0d0d0
// Stroke both polygons with #111111
// The inner polygon defines the room floor (fill white or room color)
```

### Dimension lines (Problem 2):
```typescript
// Replace addDimension() completely:
// 1. Offset line 45 units outside the wall
// 2. Draw extension lines from wall face to 10 units past dim line
// 3. At each endpoint draw a 45° tick: 
//    line from (ex - ux*5 - nx*5) to (ex + ux*5 + nx*5)
//    where ux,uy = unit vector along dim line, nx,ny = perpendicular
// 4. Draw centered text 6 units above the dim line midpoint
// 5. Font: Arial 9.5px #111111
// NEVER use Konva.Arrow for dimensions
```

### Door gap (Problem 3):
```typescript
// In addDoor():
// Step 1: Draw white rectangle over wall at door position (erases wall)
// Step 2: Redraw wall segments on either side of door opening
// Step 3: Draw door leaf as thin line from pivot
// Step 4: Draw swing arc as dashed line (dash:[4,3])
```

### Fixture symbols (Problem 5):
Replace every fixture's rendering with proper CAD symbols.
Use ONLY Konva primitives: Rect, Line, Ellipse, Circle, Arc.
No external images. No emoji. No text as the primary identifier.
Labels should be secondary (small text below the symbol).

### Remove mascot (Problem 9):
Search for any img tag, Image component, or asset reference that loads 
the robot/mascot illustration. Remove it from the drawing canvas area.
It may remain in other UI areas (header, landing page) but must not 
appear inside the drawing frame.

STEP 4 — VERIFY
After all changes:
  cd server && npm test
All 39 tests must still pass.
  cd client && npx tsc --noEmit  
Zero TypeScript errors.

STEP 5 — REPORT
After completing, provide a summary:
- List every file you modified
- For each file: what function was changed and why
- Confirm test results
- Note anything that could not be fixed and why

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## CONSTRAINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Do NOT change the AI parsing logic (GeminiParser.ts)
- Do NOT change API routes (server/src/index.ts)  
- Do NOT change database logic (supabase.ts)
- Do NOT change shared/types.ts unless adding optional display fields
- Do NOT upgrade or downgrade any npm packages
- Do NOT change the coordinate system (1 meter = 100 units stays)
- All new code must be TypeScript strict-compatible
- Konva.js is already installed — use it for all canvas rendering
- The renderer uses imperative Konva API (not react-konva declarative)