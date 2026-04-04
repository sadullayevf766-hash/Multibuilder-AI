Fix these specific bugs in FloorPlanEngine and Canvas2D:

BUG 1 — Wall color:
- Change wall color from green to: outline #1a1a1a, fill #f5f5f5
- Wall thickness: 15 units (double line style)

BUG 2 — Fixture out of bounds:
- In FloorPlanEngine.placeFixture():
  - Fixture must always be INSIDE the room
  - Gap from wall: exactly 10 units minimum
  - If fixture overflows, clamp to (wall_position - fixture_size - 10)
  - Add bounds check: throw error if room too small for fixture

BUG 3 — Dimension lines placement:
- Move ALL dimension lines OUTSIDE the room perimeter
- Offset: 40 units from outer wall edge
- Arrows on both ends, text centered above line

BUG 4 — Door symbol:
- If door exists in RoomSpec, render it:
  - Wall opening: 90 units wide
  - Quarter-circle arc showing swing direction
  - Color: #1a1a1a

BUG 5 — Title block:
- Bottom-right corner of canvas
- Content: project name, scale (1:50), date, "SNiP compliant"
- Size: 200x80 units
- Border: 1px black
- Font: monospace 10px