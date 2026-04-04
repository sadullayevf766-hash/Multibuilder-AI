THREE fixes.

FIX 1 — Shared walls drawn twice:
In removeDuplicateWalls(), current comparison is too strict.
Replace with:

function removeDuplicateWalls(walls: Wall[]): Wall[] {
  const unique: Wall[] = [];
  
  for (const wall of walls) {
    const isDuplicate = unique.some(existing => {
      const sameForward = (
        Math.abs(existing.start.x - wall.start.x) < 8 &&
        Math.abs(existing.start.y - wall.start.y) < 8 &&
        Math.abs(existing.end.x - wall.end.x) < 8 &&
        Math.abs(existing.end.y - wall.end.y) < 8
      );
      const sameReverse = (
        Math.abs(existing.start.x - wall.end.x) < 8 &&
        Math.abs(existing.start.y - wall.end.y) < 8 &&
        Math.abs(existing.end.x - wall.start.x) < 8 &&
        Math.abs(existing.end.y - wall.start.y) < 8
      );
      return sameForward || sameReverse;
    });
    
    if (!isDuplicate) unique.push(wall);
  }
  
  return unique;
}

FIX 2 — Dimension lines: show only overall building dimensions:
In generateFloorPlan(), replace per-room dimensions with:

// Only 4 overall dimensions: top, bottom, left, right
const overallDimensions = [
  {
    // Top: total width
    x1: 0, x2: buildingWidth * UNITS_PER_METER,
    y: -60, label: `${buildingWidth.toFixed(2)}m`
  },
  {
    // Bottom: total width  
    x1: 0, x2: buildingWidth * UNITS_PER_METER,
    y: buildingLength * UNITS_PER_METER + 60,
    label: `${buildingWidth.toFixed(2)}m`
  },
  // Left and right similar
];

// Add room name labels inside each room (centered):
floorPlan.rooms.forEach(room => {
  const cx = (room.position.x + room.roomSpec.width/2) * UNITS_PER_METER;
  const cy = (room.position.y + room.roomSpec.length/2) * UNITS_PER_METER;
  roomLabels.push({
    x: cx, y: cy,
    text: `${room.roomSpec.name}\n${(room.roomSpec.width * room.roomSpec.length).toFixed(1)} m²`
  });
});

FIX 3 — Gemini timeout:
In GeminiParser.ts or gemini-direct.ts, find fetch() call.
Add timeout: 30000 (30 seconds):

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);

const response = await fetch(geminiUrl, {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify(...),
  signal: controller.signal
});
clearTimeout(timeout);

Also increase retry: if first attempt fails, retry once after 2 seconds.