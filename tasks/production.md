MAJOR FEATURE: Multi-room floor plan generation.
This is a significant architecture change. Implement step by step.

═══ STEP 1: New shared types (/shared/types.ts) ═══

Add these types:

interface FloorPlan {
  id: string;
  name: string;
  totalArea: number;
  rooms: RoomLayout[];
  buildingDimensions: { width: number; length: number };
}

interface RoomLayout {
  id: string;
  roomSpec: RoomSpec;
  position: { x: number; y: number }; // meters from building origin
  connections: RoomConnection[];       // doors to adjacent rooms
}

interface RoomConnection {
  fromRoomId: string;
  toRoomId: string;
  wall: 'north'|'south'|'east'|'west';
  offset: number; // meters from wall start
}

═══ STEP 2: Update GeminiParser (/server/src/ai/GeminiParser.ts) ═══

Update system prompt to handle both single room AND multi-room:

"Analyze user request. Determine if it's:
A) Single room: output RoomSpec as before
B) Multi-room: output FloorPlan JSON:

{
  name: string,
  rooms: [
    {
      id: 'room_1',
      type: 'bathroom'|'kitchen'|'bedroom'|'living'|'office'|'hallway',
      name: string (e.g. 'Hammom', 'Oshxona'),
      dimensions: { width: number, length: number },
      position: { x: number, y: number }, // auto-layout if not specified
      fixtures: [...],
      doors: [...],
      windows: [...]
    }
  ],
  connections: [
    {
      fromRoomId: 'room_1',
      toRoomId: 'room_2', 
      wall: 'east',
      offset: 0.5
    }
  ]
}

Auto-layout rules:
- Rooms share walls when connected
- Total width = sum of room widths in a row
- Place bathroom adjacent to bedroom
- Place kitchen adjacent to living room
- Hallway connects all rooms
- Standard apartment layout:
  Row 1: living_room + kitchen
  Row 2: bedroom(s) + bathroom + hallway

Examples:
'2 xonali kvartira 65 kv.m' →
  living: 5x4, kitchen: 3x4, bedroom: 4x4, bathroom: 2x2, hallway: 2x2

'3 xonali kvartira' →
  living: 6x5, kitchen: 4x4, bedroom1: 4x4, bedroom2: 3.5x4,
  bedroom3: 3x4, bathroom: 2.5x3, toilet: 1.5x2, hallway: 3x2"

═══ STEP 3: FloorPlanEngine update ═══

Add generateFloorPlan() method:

generateFloorPlan(floorPlan: FloorPlan): DrawingData {
  const allWalls: Wall[] = [];
  const allFixtures: PlacedFixture[] = [];
  const allPipes: Pipe[] = [];
  const allDimensions: Dimension[] = [];

  for (const room of floorPlan.rooms) {
    // Offset all coordinates by room position
    const offsetX = room.position.x * UNITS_PER_METER;
    const offsetY = room.position.y * UNITS_PER_METER;

    const roomDrawing = this.generate(room.roomSpec);

    // Add offset to all elements
    roomDrawing.walls.forEach(wall => {
      allWalls.push({
        ...wall,
        start: { x: wall.start.x + offsetX, y: wall.start.y + offsetY },
        end:   { x: wall.end.x + offsetX,   y: wall.end.y + offsetY }
      });
    });

    // Same offset for fixtures, pipes, dimensions
    // ... (apply offsetX, offsetY to all coordinates)
    
    allFixtures.push(...offsetFixtures(roomDrawing.fixtures, offsetX, offsetY));
    allPipes.push(...offsetPipes(roomDrawing.pipes, offsetX, offsetY));
  }

  // Remove duplicate shared walls between adjacent rooms
  const dedupedWalls = removeDuplicateWalls(allWalls);

  return {
    walls: dedupedWalls,
    fixtures: allFixtures,
    pipes: allPipes,
    dimensions: generateFloorPlanDimensions(floorPlan),
    metadata: {
      projectName: floorPlan.name,
      dimensions: floorPlan.buildingDimensions,
      roomCount: floorPlan.rooms.length
    }
  };
}

// Helper: remove walls that overlap (shared walls between rooms)
function removeDuplicateWalls(walls: Wall[]): Wall[] {
  return walls.filter((wall, i) => {
    return !walls.some((other, j) => {
      if (i >= j) return false;
      return (
        Math.abs(wall.start.x - other.start.x) < 5 &&
        Math.abs(wall.start.y - other.start.y) < 5 &&
        Math.abs(wall.end.x - other.end.x) < 5 &&
        Math.abs(wall.end.y - other.end.y) < 5
      );
    });
  });
}

═══ STEP 4: Test prompts ═══

Test 1: "2 xonali kvartira, 60 kv.m, 1 yotoqxona, 
         zal, oshxona, hammom, koridor"

Test 2: "Ofis, 3 ta xona: katta zal 8x6, 
         2 ta kichik xona 4x3, umumiy hammom"

Test 3: "Oddiy uy: 3 yotoqxona, oshxona-zal, 
         2 hammom, koridor"

After each test paste:
1. [PARSER OUTPUT] JSON
2. Screenshot of generated floor plan