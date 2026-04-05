Bu juda to'g'ri arxitektura fikri. Aslida hozirgi tizimda AI "parser" sifatida ishlaydi — faqat so'zlarni JSON ga o'giradi. Siz aytayotgan narsa esa AI "architect" sifatida ishlashi kerak — o'ylashi, rejalash, professional qaror qabul qilishi kerak.
Mana agent uchun to'liq prompt:

AGENT TASK: AI Architect — "Thinking AI" arxitekturasi
KONSEPSIYA
Hozirgi tizim:
User prompt → GeminiParser (so'z → JSON) → FloorPlanEngine (JSON → chizma)
Kerakli tizim:
User prompt → AI Architect (o'ylaydi, rejalashtiradi, professional qaror qabul qiladi) 
            → Semantic JSON (nisbatlar, guruhlar, mantiq)
            → FloorPlanEngine (faqat geometriya hisoblaydi)
            → Chizma
AI Architect professional interior dizayner kabi o'ylashi kerak:

Bu xona uchun odatda qanday jihozlar bo'ladi?
Ular bir-biriga nisbatan qanday joylashadi?
Funktsional guruhlar qanday?
Trafikk yo'li (odamlar harakati) qanday bo'lishi kerak?
SNiP/GOST normalari bo'yicha minimal masofalar qanday?


FAYL 1: server/src/ai/prompts/architect.prompt.ts — YANGI FAYL
Bu faylda AI ga beriladigan "thinking prompt" bo'ladi:
typescriptexport const ARCHITECT_SYSTEM_PROMPT = `
You are a professional architectural interior designer with 20 years of experience.
You think deeply before designing any room. Your reasoning process:

STEP 1 — ANALYZE the request:
- What room type is this?
- What are the exact dimensions?
- What special requirements did the user mention?
- What is the room's purpose and typical usage patterns?

STEP 2 — THINK like a professional:
- What fixtures/furniture are ESSENTIAL for this room type?
- What fixtures are OPTIONAL but improve functionality?
- What are the traffic flow paths (how people move through the space)?
- What are the functional zones? (e.g., cooking zone, prep zone, dining zone)
- What are SNiP 2.08.01-89 minimum clearances?
  * Passage width: min 900mm
  * Working area in front of fixtures: min 1200mm
  * Between parallel counters: min 1200mm

STEP 3 — PLAN placement using RATIOS and RELATIONSHIPS:
- Describe each fixture's position as relationship to walls and other fixtures
- Use percentages/ratios: "sink at 30% of north wall from west corner"
- Group related fixtures: "cooking triangle: stove-sink-fridge within 4m"
- Respect functional logic: "fridge near entrance", "sink between stove and dishwasher"

STEP 4 — OUTPUT structured JSON:

{
  "roomType": string,
  "roomName": string (in Uzbek),
  "dimensions": { "width": number, "length": number },
  "analysis": {
    "totalArea": number,
    "functionalZones": [
      { "name": string, "description": string, "wallSide": string }
    ],
    "trafficFlow": string,
    "specialRequirements": string[]
  },
  "fixtures": [
    {
      "type": string,
      "nameUz": string,
      "wall": "north"|"south"|"east"|"west",
      "placement": {
        "offsetFromCorner": number,  // meters from left corner of that wall
        "distanceFromWall": 0,       // always 0 (flush with wall)
        "snapToWall": true
      },
      "dimensions": { "width": number, "length": number },  // meters
      "functionalGroup": string,
      "priority": "essential"|"recommended"|"optional",
      "clearanceNeeded": number  // meters in front of fixture for usage
    }
  ],
  "doors": [
    {
      "wall": string,
      "offsetFromCorner": number,
      "width": 0.9,
      "opensInward": boolean,
      "openDirection": "left"|"right"
    }
  ],
  "windows": [
    {
      "wall": string,
      "offsetFromCorner": number,
      "width": number,
      "height": 1.2,
      "sillHeight": 0.9
    }
  ],
  "designNotes": string[]
}

ROOM-SPECIFIC KNOWLEDGE BASE:

KITCHEN (Oshxona):
- Essential: stove, sink, fridge (the "kitchen triangle")
- Triangle rule: stove-sink-fridge total path < 6m, each leg 1.2-2.7m
- Sink: near window (natural light), between stove and fridge
- Stove: NOT under window (fire hazard), near ventilation wall
- Fridge: near entrance (easy access), away from stove (min 300mm)
- Counter space: min 600mm on each side of stove
- If > 10m²: add dishwasher next to sink
- If > 14m²: add dining table in center or east zone
- Working height counter: 850mm (standard)

BATHROOM (Hammom/Vannaхона):
- Small (<5m²): toilet + sink only
- Medium (5-8m²): toilet + sink + shower OR bathtub
- Large (>8m²): toilet + sink + bathtub + shower separate
- Toilet: min 600mm from any wall on sides, 600mm clear in front
- Sink: min 200mm from toilet side
- Bathtub: along longest wall
- Shower: corner placement preferred

BEDROOM (Yotoqxona):
- Bed: against longest wall, away from door, NOT under window
- Wardrobe: near entrance wall or opposite bed
- If > 12m²: add desk near window
- If > 16m²: add armchair/seating area
- Bed clearance: min 600mm on both sides (walking space)
- Avoid: bed facing door directly (feng shui + privacy)

LIVING ROOM (Mehmonxona/Zal):
- Sofa: facing TV, NOT against wall ideally (float 300-500mm from wall)
- TV unit: on main focal wall (longest wall opposite entrance)
- Coffee table: 400-500mm in front of sofa
- If > 20m²: add secondary seating (armchairs)
- Conversation distance: sofa to TV 2.5-4m
- Traffic flow: clear path min 900mm around furniture

OFFICE (Ofis/Ish xonasi):
- Desk: near window (natural light), NOT facing wall directly
- Monitor: perpendicular to window (avoid glare)
- Bookshelf: accessible from desk (within 1-2m)
- If > 12m²: add meeting area or secondary desk
- Ergonomic: desk at 720-760mm height, chair space 1m behind desk

OUTPUT RULES:
1. ONLY output valid JSON, nothing else
2. NEVER include actual x,y coordinates
3. offsetFromCorner is in METERS from the left corner of that wall
4. Think step by step internally, but output ONLY the final JSON
5. Always include designNotes explaining your key decisions
6. If user mentions specific fixtures, ALWAYS include them
7. If user says "2 ta X", add 2 fixtures of that type with different offsets
`;

FAYL 2: server/src/ai/GeminiParser.ts — To'liq qayta yoz
Yangi arxitektura:
typescript// Eski flow:
// parseDescription() → callGemini() → validateAndDefault() → convertToRoomSpec()

// Yangi flow:
// parseDescription() → callAIArchitect() → convertArchitectJSONToSpec()

class GeminiParser {
  
  async parseDescription(description: string): Promise<RoomSpec | FloorPlan> {
    // 1. Try Groq (primary, free)
    // 2. Try Gemini (fallback)  
    // 3. Smart local architect (demo mode)
    
    // Har uchala holatda ham bir xil ARCHITECT_SYSTEM_PROMPT ishlatiladi
    // Faqat API endpoint farq qiladi
  }

  // AI qaytargan architect JSON → RoomSpec ga o'zgartirish
  private convertArchitectJSON(architectData: ArchitectResponse): RoomSpec {
    // fixture.placement.offsetFromCorner → wall bo'ylab pozitsiya
    // Bu pozitsiyani FloorPlanEngine ga berish uchun FixtureSpec ga qo'sh
    
    // MUHIM: offsetFromCorner ni FixtureSpec ga saqlash kerak
    // Hozirgi FixtureSpec da faqat wall bor, offset yo'q
    // shared/types.ts da FixtureSpec ga offset field qo'sh
  }
}

FAYL 3: shared/types.ts — FixtureSpec ga offset qo'sh
typescriptexport interface FixtureSpec {
  id: string;
  type: FixtureType;
  wall?: WallSide;
  offsetFromCorner?: number;  // ← YANGI: meters from wall's left corner
  needsWater?: boolean;
  needsDrain?: boolean;
  clearanceNeeded?: number;   // ← YANGI: meters of clear space in front
  priority?: 'essential' | 'recommended' | 'optional'; // ← YANGI
}

FAYL 4: server/src/engine/FloorPlanEngine.ts — placeFixtures() ni qayta yoz
typescriptplaceFixtures(roomSpec: RoomSpec, walls: Wall[]): PlacedFixture[] {
  
  // Har bir wall uchun alohida placement tracker
  // Wall bo'ylab sequential joylashish (cursor pattern)
  
  for (const fixture of roomSpec.fixtures) {
    const wall = walls.find(w => w.side === fixture.wall);
    
    // Agar AI offsetFromCorner bergan bo'lsa → uni ishlat
    if (fixture.offsetFromCorner !== undefined) {
      position = this.placeAtOffset(wall, fixture.offsetFromCorner, fixtureDims);
    } else {
      // Fallback: sequential cursor
      position = this.placeSequential(wall, wallCursors, fixtureDims);
    }
    
    // Boundary validation (chizmadan chiqmasin)
    position = this.clampToBoundary(position, fixtureDims, roomSpec);
    
    // Overlap check (boshqa fixture bilan to'qnashmasin)
    if (this.hasOverlap(position, fixtureDims, placed)) {
      position = this.resolveOverlap(position, fixtureDims, placed, wall);
    }
  }
}

// offsetFromCorner → absolut koordinata
private placeAtOffset(
  wall: Wall, 
  offsetMeters: number, 
  dims: {w: number, h: number}
): Point {
  const offsetUnits = offsetMeters * UNITS_PER_METER;
  
  if (wall.side === 'north') {
    return { 
      x: wall.start.x + offsetUnits,  // left corner + offset
      y: wall.start.y + WALL_THICKNESS // flush with wall
    };
  }
  if (wall.side === 'south') {
    return { 
      x: wall.end.x + offsetUnits,
      y: wall.start.y - WALL_THICKNESS - dims.h
    };
  }
  if (wall.side === 'west') {
    return { 
      x: wall.start.x + WALL_THICKNESS,
      y: wall.end.y + offsetUnits  // top corner + offset going down
    };
  }
  if (wall.side === 'east') {
    return { 
      x: wall.start.x - WALL_THICKNESS - dims.w,
      y: wall.start.y + offsetUnits
    };
  }
}

FAYL 5: server/src/engine/FloorPlanEngine.ts — Pipe routing yaxshila
typescript// Yangi pipe routing qoidalari:
// 1. Pipe faqat needsWater/needsDrain=true bo'lgan fixture uchun chiqsin
// 2. Cold/Hot pipe: fixture → wall bo'ylab → shimoli-sharqiy burchak (riser)
// 3. Drain: fixture → eng yaqin janubiy yoki g'arbiy devorgacha
// 4. Riser point: shimoli-sharqiy burchak (x: roomWidth-20, y: 20)
// 5. Barcha turning faqat 90° (orthogonal)

FAYL 6: client/src/components/Canvas2D.tsx — Fixture labels qo'sh
typescript// Har bir fixture ichiga Uzbekcha nom yoz:
const FIXTURE_LABELS_UZ: Record<string, string> = {
  sink: 'Lavabo', toilet: 'Hojatxona', bathtub: 'Vanna',
  shower: 'Dush', stove: 'Plita', fridge: 'Muzlatgich',
  dishwasher: 'Idish yuv.', desk: 'Stol', bed: 'Karavot',
  wardrobe: 'Shkaf', sofa: 'Divan', tv_unit: 'TV',
  bookshelf: 'Kitob javon'
};

// Label: fixture markazida, fontSize 8, color #555
// Agar fixture kichik bo'lsa (w<60) label qisqartirilsin

MUVAFFAQIYAT MEZONI
Quyidagi promptlar uchun natija professional bo'lishi kerak:
PromptAI nimani o'ylashi kerakNatija8x5 mehmonxonaZal uchun: sofa+TV asosiy, 40m² → katta → ikkinchi o'rindiq ham kerak, traffic yo'li shimoliy eshikdansofa (south, float), tv_unit (north), coffee_table (center), armchair6x4 oshxonaKitchen triangle: sink-stove-fridge < 6m, sink oynaga yaqin, stove ventilatsiya devoridastove+sink (north, 1.2m apart), fridge (west corner)4x3 hammom12m² → o'rta → toilet+sink+shower, toilet 600mm bo'shlik, shower burchakdatoilet (south), sink (north), shower (east corner)12x8 ofis, 4 ish o'rni4 desk kerak, har biri oynaga yaqin, traffic 900mm, meeting zona4 desk (north+east walls), bookshelf (west), meeting area (center)

ARXITEKTURA QOIDALARI (o'zgartirma!)

AI HECH QACHON koordinata bermaydi — faqat offsetFromCorner (metrda)
Barcha x, y faqat FloorPlanEngine da hisoblanadi
1 metr = 100 birlik
TypeScript strict, any yo'q
Barcha testlar o'tishi shart (npm test)