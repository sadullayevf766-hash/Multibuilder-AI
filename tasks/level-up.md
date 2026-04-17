---

```
You are a senior CAD software engineer. Your task is to make the Multibuilder-AI 
drawing engine produce output identical in quality to professional GOST/SNiP 
architectural drawings (like those produced by AutoCAD or ArchiCAD for Uzbekistan 
construction projects).

## REFERENCE STANDARD
The target output must match this professional drawing standard:
- GOST 21.501-2011 (architectural drawings)
- GOST 21.205-93 (conventional symbols)
- SNiP 2.04.01-85 (plumbing systems)
- Line weights: 0.18 / 0.35 / 0.5 / 0.7mm (scaled proportionally)

---

## CURRENT STATE (what the code does now)

**File:** `client/src/components/Canvas2D.tsx`
**Engine:** `server/src/engine/FloorPlanEngine.ts`
**Renderer:** Konva.js on HTML Canvas

Current problems:
1. Walls have gaps at corners (drawn as 2 lines, not closed polygons)
2. Dimension lines use arrows instead of GOST tick marks
3. Door openings are not cut into walls (arc drawn on top of wall)
4. Fixtures are simple rectangles without CAD-standard details
5. Title block (shtamp) is too small and incomplete
6. No proper line weight hierarchy
7. Window symbol is not GOST standard
8. No hatching inside walls (should be diagonal lines or solid gray)
9. Room area labels are not positioned correctly
10. Pipe arrows are missing direction indicators

---

## REQUIRED CHANGES — PRECISE SPECIFICATIONS

### 1. WALLS — GOST double-line with hatch

**Rule:** Every wall = outer face line (0.7mm) + inner face line (0.5mm) + hatch fill between them.

**Hatch pattern:** Diagonal lines at 45°, spacing 4 units, color #999999, strokeWidth 0.5
OR solid fill #d0d0d0 (acceptable simplified version for screen rendering)

**Corner treatment:** Wall polygons must close perfectly at corners.
Method: At each corner, extend lines to their intersection point.
No gaps, no overlaps visible.

```
Wall polygon points (for a north wall from x=0,y=0 to x=600,y=0, thickness=15):
  Outer: (0, -7.5) → (600, -7.5)   ← outside of building
  Inner: (0, +7.5) → (600, +7.5)   ← inside of building
  Fill the rectangle between them with #d0d0d0
```

**Door opening:** Before rendering door, punch a white rectangle through the 
wall fill AND both face lines. Width = door width, centered on door position.

**Window opening:** Same — punch white rectangle, then draw 3 parallel lines.

---

### 2. DIMENSION LINES — GOST tick-mark style

**Never use arrows for architectural dimensions.**

```
Structure of one dimension line (example: north wall, 6.00m wide):

  |————————————————————————————|   ← dimension line (0.35mm)
  ╲                            ╲   ← tick marks (45° slash, 10 units, 0.5mm)
  |                            |   ← extension lines (from wall to 10u past dim line)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ← wall outer face

         6.00m                     ← text, centered, Arial 9.5px, above line
```

**Exact measurements:**
- Offset from wall outer face: 45 units
- Extension line: starts at wall outer face, ends 10 units past dimension line
- Tick mark: 45° diagonal slash, 10 units long, centered on endpoint
- Text: centered between ticks, 4 units above dimension line
- Font: Arial (or monospace fallback), 9.5px, color #111111

**For multi-room plans:** Show only overall building dimensions outside,
not per-room dimensions (too cluttered).

---

### 3. DOORS — Proper architectural symbol

```
Wall before door:  ████████[   GAP   ]████████
                           ↑ white rect punched through

Door symbol inside gap:
  - Thin line from pivot point = door leaf (width = door width, 0.35mm)  
  - Quarter-circle arc from leaf end back to wall = swing indicator
  - Arc style: dashed (dash: [4,3]), 0.35mm
  - Arc radius = door width
  
Example for south wall door (swings inward = upward on plan):
  Pivot at bottom-left of opening
  Leaf goes right (horizontal line)  
  Arc swings 90° counterclockwise up and left
```

**Door width standard:** 0.9m = 90 units (interior), 1.0m = 100 units (entrance)

---

### 4. WINDOWS — GOST 3-line symbol

```
Wall section with window:
  ████[  3 lines  ]████

The 3 lines:
  Line 1: at outer wall face (1px)
  Line 2: at center of wall (1.8px) ← main line
  Line 3: at inner wall face (1px)
  All 3 lines span exactly the window width
  Color: #1a1a1a
  No fill, no color (windows are not blue)
```

---

### 5. FIXTURE SYMBOLS — ISO 128 CAD standard

Each fixture must be recognizable as its real-world counterpart.
Use only lines, rectangles, ellipses, circles — no images.

**Toilet (40×70 units):**
```
┌──────┐  ← tank (40×18, fill #e8e8e8)
│      │
└──────┘
  (  )    ← bowl ellipse (radiusX:19, radiusY:26, center at x+20,y+48)
  ( · )   ← seat line (inner ellipse, slightly smaller, stroke #666 0.8px)
```

**Sink (60×50 units):**
```
┌────────┐  ← body (60×50, fill white)
│ ┌────┐ │  ← faucet (12×8, fill #bbb, centered top)
│ │ ○  │ │  ← basin ellipse (radiusX:19, radiusY:15)
│ └────┘ │    with drain dot (circle r:3.5, fill #888)
└────────┘
```

**Bathtub (80×180 units):**
```
╔══════╗  ← outer rect with cornerRadius:6
║      ║  ← inner rect (inset 8 units, cornerRadius:5, fill #f0f0f0)
║      ║
║      ║
║  ○   ║  ← drain circle (r:7) near foot end
╚══════╝
```

**Desk (120×60 units):**
```
┌──────────────────┐
│  ┌────────────┐  │  ← monitor rect (50×30, fill #e0e8f0)
│  └─────┬──────┘  │  ← monitor stand line
└────────┴─────────┘
```

**Bed (160×200 units):**
```
┌──────────────────────┐
│▓▓▓▓▓ HEADBOARD ▓▓▓▓▓│  ← fill #e0e0e0, height 38
├──────────┬───────────┤
│ [pillow] │ [pillow]  │  ← two rects (56×38, fill #f8f8f8, cornerRadius:4)
├──────────┴───────────┤  ← blanket line
│                      │
└──────────────────────┘
```

**Wardrobe (120×60 units):**
```
┌────────┬────────┬────────┐
│   |    │   |    │   |    │  ← 3 panels with center handle lines
└────────┴────────┴────────┘
```

**Sofa (200×90 units):**
```
┌──────────────────────────┐  ← back panel (height 22, fill #c8c8c8)
█[  cushion  ][  cushion  ][  cushion  ]█  ← 3 cushions + 2 arms
└──────────────────────────┘
```

---

### 6. PIPES — Direction and type clarity

**Cold water (H):** Blue #2563eb, strokeWidth 2, solid line
**Hot water (I):** Red #dc2626, strokeWidth 2, solid line  
**Drain (K):** Gray #64748b, strokeWidth 1.5, dashed [6,4], opacity 0.75

**Arrow at pipe endpoint** (cold and hot only, not drain):
- Small filled arrowhead pointing in flow direction
- Size: pointerLength 6, pointerWidth 5
- Color matches pipe color

**Pipe routing:** L-shaped (horizontal then vertical or vice versa).
Pipes run along wall inside the room, 18-25 units from wall face.

---

### 7. TITLE BLOCK (Shtamp) — GOST format

Position: bottom-right of drawing area.
Size: 220 wide × 80 tall (units before scale).

```
┌──────────────────────┬──────────────┐
│ Loyiha nomi          │ Sana         │
│ Floor Plan           │ 13.04.2026   │
├──────────────────────┼──────────────┤
│ Masshtab             │ Bosqich      │
│ 1:50                 │ РП           │
├──────────────────────┼──────────────┤
│ SNiP 2.04.01-85      │              │
└──────────────────────┴──────────────┘
  ↑ col width 120           ↑ col width 100
```

Label rows: fontSize 7.5, color #666666
Value rows: fontSize 8.5, fontStyle bold, color #111111
Outer border: strokeWidth 1.5
Inner dividers: strokeWidth 0.8

---

### 8. LEGEND BOX

Position: bottom-left, same Y as title block.
Size: 165 wide × 55 tall, border stroke #bbb 0.8px, fill white.

```
┌─────────────────────────────┐
│ ——————  Sovuq suv (H)       │  blue line
│ ——————  Issiq suv (I)       │  red line
│ - - - - Kanalizatsiya (K)   │  gray dashed
└─────────────────────────────┘
```

---

### 9. ROOM LABELS — Professional positioning

For each room, display centered in room:
```
Line 1: Room name (bold, 10px)    e.g. "Hammom"
Line 2: Area (regular, 9px)       e.g. "12.0 m²"
```
Position: exact geometric center of room polygon.
No background, no border on label.

---

### 10. GRID

Dots (not lines) at every 100-unit intersection for cleaner look:
```javascript
// Instead of full grid lines, use dots:
layer.add(new Konva.Circle({ 
  x: i, y: j, radius: 0.8, 
  fill: '#cccccc' 
}));
```
OR keep lines but use strokeWidth 0.3, color #e8e8e8.

---

## IMPLEMENTATION INSTRUCTIONS

### Step 1: Fix Canvas2D.tsx
Rewrite these functions completely:
- `addWall()` → closed polygon + hatch fill + clean corners
- `addDimension()` → tick marks + extension lines + offset text
- `addDoor()` → wall gap + leaf + dashed arc
- `addWindow()` → 3 parallel lines only (no blue fill)
- `addFixture()` → detailed CAD symbols per spec above
- `addTitleBlock()` → full GOST shtamp
- `addLegend()` → bordered box

### Step 2: Fix FloorPlanEngine.ts  
Add wall segmentation for doors/windows:
```typescript
// Instead of full wall start→end, generate segments:
// [start → doorStart], [doorEnd → end]
// This gives Canvas2D the exact gap coordinates
```

### Step 3: Verify
Run: `cd server && npm test` — all 39 tests must still pass.
Run: `cd client && npx tsc --noEmit` — zero TypeScript errors.

---

## SUCCESS CRITERIA

The output drawing must have:
✅ No corner gaps in walls
✅ Dimension lines with tick marks, not arrows  
✅ Door arcs that visually cut through the wall
✅ Fixtures recognizable without labels
✅ Title block with project info in GOST format
✅ All 39 tests still passing
✅ Zero TypeScript compile errors
```

---
