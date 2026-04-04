Four fixes for multi-room floor plan.

FIX 1 — Room positioning gaps:
In generateFloorPlan(), rooms must share walls exactly.
Current: rooms have gaps between them.

Auto-layout algorithm:
  Row 1 (y=0): place rooms left to right, x accumulates
  Row 2 (y=row1_max_length): next row of rooms

  let currentX = 0;
  let currentY = 0; 
  let rowMaxLength = 0;
  let rowRooms = [];

  // Group rooms into rows (max 3 rooms per row, total width ≤ building width)
  for room in floorPlan.rooms:
    if currentX + room.width > buildingWidth:
      currentY += rowMaxLength  // next row
      currentX = 0
      rowMaxLength = 0
    room.position = { x: currentX, y: currentY }
    currentX += room.width
    rowMaxLength = max(rowMaxLength, room.length)

FIX 2 — Canvas auto-resize for floor plan:
In Canvas2D.tsx, calculate total floor plan bounds:
  const totalWidth = max(room.position.x + room.width) * UNITS_PER_METER
  const totalHeight = max(room.position.y + room.length) * UNITS_PER_METER
  
  Set canvas size to totalWidth + CANVAS_PADDING*2, totalHeight + CANVAS_PADDING*2
  Auto-scale to fit viewport: scale = min(viewportW/totalWidth, viewportH/totalHeight)

FIX 3 — Title block always below drawing:
  titleBlock.y = totalHeight + CANVAS_PADDING + 20
  legend.y = titleBlock.y + 80

FIX 4 — Dimension lines outside rooms:
For floor plan mode, show only overall building dimensions:
  Top: total building width
  Left: total building height
  Individual room labels inside room (just room name + area)
  
  Room label: centered in room, font 12px:
    "Yotoqxona\n16.0 m²"

Run test: "2 xonali kvartira 60 kv.m"
Screenshot + paste room positions from [ENGINE] log.