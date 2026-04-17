ou are working on the Multibuilder-AI project. The goal is to upgrade Canvas2D.tsx to produce professional GOST/SNiP-standard architectural drawings.

## TASK: Rewrite client/src/components/Canvas2D.tsx

### Problem summary (current vs required):

1. **WALLS** — Currently drawn as 2 separate lines per wall, leaving gaps at corners.
   Fix: Draw wall fill as closed polygon with `fill: '#cccccc'`, then draw outer/inner face lines with `lineCap: 'square'` so corners meet cleanly.

2. **DIMENSION LINES** — Currently uses arrow pointers. Professional standard requires:
   - Offset dimension line 45 units away from wall (outside the room)
   - Extension lines from wall face to slightly past the dim line
   - 45° tick marks (slash) at each end instead of arrowheads
   - Text centered above the dimension line, font: Arial 9.5px

3. **DOORS** — Arc is drawn on top of wall. Fix:
   - First white-out the wall opening with a white Rect
   - Draw door leaf as a line from pivot point
   - Draw swing arc as dashed line (`dash: [4, 3]`)
   - Arc should use `innerRadius: 0` (filled sector outline only)

4. **FIXTURE SYMBOLS** — Add realistic CAD details:
   - `desk`: add monitor rectangle on top
   - `bed`: add headboard rect + two pillow rects + blanket line
   - `sink`: add faucet rect at top + drain circle
   - `bathtub`: add inner rounded rect + drain circle + faucet
   - `toilet`: tank rect + ellipse bowl + inner ellipse seat line
   - `wardrobe`: 3-panel door lines + handle lines
   - `sofa`: back panel + 3 seat cushions + two arm rects

5. **TITLE BLOCK** — Expand from 180x70 to 220x80 with GOST shtamp layout:
   - Two columns separated by vertical line at x+100
   - Rows: Loyiha nomi / Floor Plan / Masshtab / 1:50 / SNiP 2.04.01-85
   - Right column: Sana / [date] / Bosqich / РП
   - All borders with strokeWidth 1.5 outer, 0.8 inner dividers

### Constants to use:
const PAD = 120          // canvas padding (was CANVAS_PADDING = 80)
const WALL_T = 15        // wall thickness
const DIM_OFFSET = 45    // dimension line offset from wall
const DIM_EXT = 10       // extension line overhang past dim line
const TICK_SIZE = 10     // tick mark length

### Render order (keep this exact order):
1. White room fill rect
2. Room color backgrounds (per room type)
3. Grid lines (stroke: '#e8e8e8', strokeWidth: 0.3)
4. Pipes (with directional arrow at endpoint for hot/cold, not drain)
5. Walls (hatch fill + face lines)
6. Doors (gap + leaf + dashed arc)
7. Windows (3 parallel lines, GOST style)
8. Fixtures + labels
9. Dimension lines (tick-mark style, offset outside)
10. Title block + Legend box

### Keep unchanged:
- All TypeScript types and imports
- `useImperativeHandle` exportToPdf logic (upgrade pixelRatio to 3)
- `FIXTURE_LABELS` record
- Multi-room vs single-room logic
- The forwardRef pattern and component signature

### File to edit: `client/src/components/Canvas2D.tsx`

Do not change any other files. After editing, confirm the change compiles with: `cd client && npx tsc --noEmit`