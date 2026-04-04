import type { RoomSpec, FixtureSpec, DoorSpec, WindowSpec, FloorPlan, RoomLayout } from '../../../shared/types';

interface GeminiResponse {
  roomType: 'bathroom' | 'kitchen' | 'office' | 'apartment';
  dimensions: { width: number; length: number };
  fixtures: Array<{
    type: 'toilet' | 'sink' | 'bathtub' | 'shower' | 'stove' | 'fridge';
    wall: 'north' | 'south' | 'east' | 'west';
    offset?: number;
  }>;
  doors: Array<{ wall: 'north' | 'south' | 'east' | 'west'; position: 'center' | number }>;
  windows: Array<{ wall: 'north' | 'south' | 'east' | 'west'; count: number }>;
  notes?: string;
}

const SYSTEM_PROMPT = `You are a floor plan specification parser. Your ONLY job is to convert natural language descriptions into a specific JSON structure.

CRITICAL RULES:
1. Output ONLY valid JSON, nothing else
2. NEVER include coordinates (x, y, x1, y1, x2, y2)
3. NEVER include pipe paths or routing
4. Use semantic descriptions only (wall sides, positions)

Output structure:
{
  "roomType": "bathroom" | "kitchen" | "office" | "apartment",
  "dimensions": { "width": number, "length": number },
  "fixtures": [
    { 
      "type": "toilet"|"sink"|"bathtub"|"shower"|"stove"|"fridge",
      "wall": "north"|"south"|"east"|"west",
      "offset": number (meters from corner, optional)
    }
  ],
  "doors": [{ "wall": "south", "position": "center"|number }],
  "windows": [{ "wall": "north", "count": number }],
  "notes": "any special requirements"
}

Dimension extraction rules:
- dimensions field is REQUIRED
- Extract EXACT numbers from user input
- If user says '8x5', return: dimensions: { width: 8, length: 5 }
- If user says '6 metr kenglik 4 metr uzunlik', return: { width: 6, length: 4 }
- NEVER default to 3x4. If truly missing, use the largest numbers mentioned by user
- If fixture wall conflicts: auto-resolve to different wall
- Position defaults to "center" if not specified
- Smart defaults by fixture type:
  toilet → south wall
  sink → north or east wall
  stove → north wall
  fridge → west wall corner
  bed → west wall (longest wall opposite door)
  sofa → facing largest wall (north)
  desk → near window wall
- Supported fixture types: toilet, sink, bathtub, shower, stove, fridge, dishwasher, desk, bed, wardrobe, sofa, tv_unit, bookshelf
- Supported room types: bathroom, kitchen, office, bedroom, living, apartment`;

export class GeminiParser {
  private apiKey: string;
  private modelName = 'gemini-2.0-flash';
  private apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private cache = new Map<string, any>();

  async parseDescription(description: string): Promise<RoomSpec | FloorPlan> {
    const cacheKey = description.toLowerCase().trim();

    // Demo mode: if no API key, return mock data
    if (!this.apiKey) {
      console.log('[MODE] DEMO - No API key, using hardcoded data');
      return this.getMockRoomSpec(description);
    }

    // Cache hit
    if (this.cache.has(cacheKey)) {
      console.log('[GEMINI] Cache hit');
      return this.cache.get(cacheKey);
    }

    try {
      const geminiResponse = await this.callGeminiWithRetry(description);
      const result = this.convertToRoomSpec(geminiResponse);
      console.log('[MODE] LIVE - Gemini responded:', JSON.stringify(geminiResponse).slice(0, 100));
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.log('[MODE] DEMO - Gemini failed, using hardcoded data');
      return this.getMockRoomSpec(description);
    }
  }

  private async callGeminiWithRetry(description: string, retries = 3): Promise<GeminiResponse> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.callGemini(description);
      } catch (err: any) {
        const isRateLimit = err.message?.includes('Too Many Requests') || 
                            err.message?.includes('429') ||
                            err.message?.includes('RESOURCE_EXHAUSTED');
        if (isRateLimit && i < retries - 1) {
          const delay = (i + 1) * 15000; // 15s, 30s, 45s (Gemini retry hint)
          console.log(`[GEMINI] Rate limited, retrying in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          throw err;
        }
      }
    }
    throw new Error('Gemini max retries exceeded');
  }

  private getMockRoomSpec(description: string): RoomSpec | FloorPlan {
    const desc = description.toLowerCase();

    // Detect multi-room request
    const isMultiRoom = /kvartira|apartment|xonali|ko'p xona|ofis.*xona|uy.*xona/.test(desc);

    if (isMultiRoom) {
      return this.getMockFloorPlan(description, desc);
    }

    return this.getMockSingleRoom(description, desc);
  }

  private getMockFloorPlan(description: string, desc: string): FloorPlan {
    // Parse total area or room count
    const areaMatch = desc.match(/(\d+)\s*kv/);
    const totalArea = areaMatch ? parseInt(areaMatch[1]) : 60;

    // Detect room count
    const is2Room = /2\s*xonali|ikki\s*xonali/.test(desc);
    const is3Room = /3\s*xonali|uch\s*xonali/.test(desc);

    const rooms: RoomLayout[] = [];

    if (is3Room) {
      rooms.push(
        { id: 'room_living',   roomSpec: this.makeRoom('living',   'Zal',       6, 5), position: { x: 0, y: 0 }, connections: [] },
        { id: 'room_kitchen',  roomSpec: this.makeRoom('kitchen',  'Oshxona',   4, 4), position: { x: 6, y: 0 }, connections: [] },
        { id: 'room_bed1',     roomSpec: this.makeRoom('bedroom',  'Yotoqxona 1', 4, 4), position: { x: 0, y: 5 }, connections: [] },
        { id: 'room_bed2',     roomSpec: this.makeRoom('bedroom',  'Yotoqxona 2', 3.5, 4), position: { x: 4, y: 5 }, connections: [] },
        { id: 'room_bed3',     roomSpec: this.makeRoom('bedroom',  'Yotoqxona 3', 3, 4), position: { x: 7.5, y: 5 }, connections: [] },
        { id: 'room_bathroom', roomSpec: this.makeRoom('bathroom', 'Hammom',    2.5, 3), position: { x: 0, y: 9 }, connections: [] },
        { id: 'room_hallway',  roomSpec: this.makeRoom('hallway',  'Koridor',   3, 2), position: { x: 2.5, y: 9 }, connections: [] }
      );
    } else {
      // 2-room apartment (default)
      rooms.push(
        { id: 'room_living',   roomSpec: this.makeRoom('living',   'Zal',     5, 4), position: { x: 0, y: 0 }, connections: [] },
        { id: 'room_kitchen',  roomSpec: this.makeRoom('kitchen',  'Oshxona', 3, 4), position: { x: 5, y: 0 }, connections: [] },
        { id: 'room_bed1',     roomSpec: this.makeRoom('bedroom',  'Yotoqxona', 4, 4), position: { x: 0, y: 4 }, connections: [] },
        { id: 'room_bathroom', roomSpec: this.makeRoom('bathroom', 'Hammom',  2, 2), position: { x: 4, y: 4 }, connections: [] },
        { id: 'room_hallway',  roomSpec: this.makeRoom('hallway',  'Koridor', 2, 2), position: { x: 6, y: 4 }, connections: [] }
      );
    }

    const buildingWidth  = Math.max(...rooms.map(r => r.position.x + r.roomSpec.width));
    const buildingLength = Math.max(...rooms.map(r => r.position.y + r.roomSpec.length));

    const result: FloorPlan = {
      id: `floorplan-${Date.now()}`,
      name: description.slice(0, 50),
      totalArea,
      rooms,
      buildingDimensions: { width: buildingWidth, length: buildingLength }
    };

    console.log('[PARSER OUTPUT]', JSON.stringify(result, null, 2));
    return result;
  }

  private makeRoom(type: string, name: string, width: number, length: number): RoomSpec {
    const fixtures: FixtureSpec[] = [];
    const doors: DoorSpec[] = [{ id: 'door-0', wall: 'south', width: 0.9 }];

    if (type === 'bathroom') {
      fixtures.push(
        { id: 'f0', type: 'sink',   wall: 'north', needsWater: true,  needsDrain: true  },
        { id: 'f1', type: 'toilet', wall: 'south', needsWater: false, needsDrain: true  }
      );
    } else if (type === 'kitchen') {
      fixtures.push(
        { id: 'f0', type: 'stove',  wall: 'north', needsWater: false, needsDrain: false },
        { id: 'f1', type: 'sink',   wall: 'north', needsWater: true,  needsDrain: true  },
        { id: 'f2', type: 'fridge', wall: 'west',  needsWater: false, needsDrain: false }
      );
    } else if (type === 'bedroom') {
      fixtures.push(
        { id: 'f0', type: 'bed',      wall: 'west',  needsWater: false, needsDrain: false },
        { id: 'f1', type: 'wardrobe', wall: 'east',  needsWater: false, needsDrain: false }
      );
    } else if (type === 'living') {
      fixtures.push(
        { id: 'f0', type: 'sofa',    wall: 'south', needsWater: false, needsDrain: false },
        { id: 'f1', type: 'tv_unit', wall: 'north', needsWater: false, needsDrain: false }
      );
    }

    return {
      id: `room-${type}-${Date.now()}`,
      name,
      width,
      length,
      fixtures,
      doors,
      windows: [{ id: 'w0', wall: 'north', width: 1.2 }]
    };
  }

  private getMockSingleRoom(description: string, desc: string): RoomSpec {
    let width = 3;
    let length = 4;

    const dimensionPatterns = [
      /(\d+)\s*[xх×]\s*(\d+)/i,
      /(\d+)\s*metr.*?(\d+)\s*metr/i,
      /kenglik[:\s]*(\d+).*?uzunlik[:\s]*(\d+)/i,
      /(\d+)\s*m\s*[xх×]\s*(\d+)\s*m/i
    ];
    
    for (const pattern of dimensionPatterns) {
      const match = description.match(pattern);
      if (match) {
        width = parseInt(match[1]);
        length = parseInt(match[2]);
        console.log('[DEMO MODE] Extracted dimensions:', width, length);
        break;
      }
    }

    // Detect room type from description
    const isKitchen = /oshxona|kitchen|plita|muzlatgich|fridge|stove/.test(desc);
    const isBedroom = /yotoqxona|bedroom|karavot|bed|shkaf|wardrobe/.test(desc);
    const isOffice  = /ofis|office|stol|desk|kitob/.test(desc);
    const isLiving  = /mehmonxona|living|divan|sofa|tv/.test(desc);

    let roomType: string = 'bathroom';
    let fixtures: any[] = [];

    if (isKitchen) {
      roomType = 'kitchen';
      fixtures = [
        { id: 'fixture-0', type: 'stove',  wall: 'north', needsWater: false, needsDrain: false },
        { id: 'fixture-1', type: 'sink',   wall: 'north', needsWater: true,  needsDrain: true  },
        { id: 'fixture-2', type: 'fridge', wall: 'west',  needsWater: false, needsDrain: false }
      ];
    } else if (isBedroom) {
      roomType = 'bedroom';
      fixtures = [
        { id: 'fixture-0', type: 'bed',      wall: 'west',  needsWater: false, needsDrain: false },
        { id: 'fixture-1', type: 'wardrobe', wall: 'east',  needsWater: false, needsDrain: false }
      ];
    } else if (isOffice) {
      roomType = 'office';
      fixtures = [
        { id: 'fixture-0', type: 'desk',      wall: 'north', needsWater: false, needsDrain: false },
        { id: 'fixture-1', type: 'bookshelf', wall: 'east',  needsWater: false, needsDrain: false }
      ];
    } else if (isLiving) {
      roomType = 'living';
      fixtures = [
        { id: 'fixture-0', type: 'sofa',    wall: 'south', needsWater: false, needsDrain: false },
        { id: 'fixture-1', type: 'tv_unit', wall: 'north', needsWater: false, needsDrain: false }
      ];
    } else {
      // Default: bathroom
      roomType = 'bathroom';
      fixtures = [
        { id: 'fixture-0', type: 'sink',   wall: 'north', needsWater: true,  needsDrain: true  },
        { id: 'fixture-1', type: 'toilet', wall: 'south', needsWater: false, needsDrain: true  }
      ];
    }

    const result = {
      id: `room-${Date.now()}`,
      name: roomType,
      width,
      length,
      fixtures,
      doors: [{ id: 'door-0', wall: 'east' as const, width: 0.9 }],
      windows: []
    };

    console.log('[PARSER OUTPUT]', JSON.stringify(result, null, 2));
    return result;
  }

  private async callGemini(description: string): Promise<GeminiResponse> {
    const makeRequest = async (): Promise<Response> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `${SYSTEM_PROMPT}\n\nUser description: ${description}`
              }]
            }]
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        return response;
      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }
    };

    let response: Response;
    try {
      console.log('[GEMINI] Using model:', this.modelName);
      console.log('[GEMINI] API key prefix:', this.apiKey?.slice(0, 8));
      response = await makeRequest();
    } catch {
      // Retry once after 2 seconds
      await new Promise(r => setTimeout(r, 2000));
      response = await makeRequest();
    }

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    
    return this.extractJSON(text);
  }

  private extractJSON(text: string): GeminiResponse {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in Gemini response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log('[GEMINI RAW]', JSON.stringify(parsed, null, 2));
    return this.validateAndDefault(parsed);
  }

  private validateAndDefault(data: Partial<GeminiResponse>): GeminiResponse {
    console.log('[PARSER RAW] full Gemini response keys:', Object.keys(data));
    console.log('[PARSER RAW] dimensions raw:', data.dimensions, (data as any).size, (data as any).width, (data as any).length);

    return {
      roomType: data.roomType || 'bathroom',
      dimensions: data.dimensions ?? (data as any).size ?? (data as any).room_size ?? { 
        width: parseFloat((data as any).width) || parseFloat((data as any).room_width) || 0, 
        length: parseFloat((data as any).length) || parseFloat((data as any).room_length) || 0 
      },
      fixtures: data.fixtures || [],
      doors: data.doors || [],
      windows: data.windows || [],
      notes: data.notes
    };
  }

  private convertToRoomSpec(geminiResponse: GeminiResponse): RoomSpec {
    const fixtures: FixtureSpec[] = geminiResponse.fixtures.map((f, i) => ({
      id: `fixture-${i}`,
      type: f.type as any,
      wall: f.wall,
      needsWater: ['sink', 'bathtub', 'shower'].includes(f.type),
      needsDrain: ['sink', 'toilet', 'bathtub', 'shower'].includes(f.type)
    }));

    const doors: DoorSpec[] = geminiResponse.doors.map((d, i) => ({
      id: `door-${i}`,
      wall: d.wall,
      width: 0.9
    }));

    const windows: WindowSpec[] = geminiResponse.windows.flatMap((w, i) => 
      Array.from({ length: w.count }, (_, j) => ({
        id: `window-${i}-${j}`,
        wall: w.wall,
        width: 1.2
      }))
    );

    const result = {
      id: `room-${Date.now()}`,
      name: geminiResponse.roomType,
      width: geminiResponse.dimensions.width,
      length: geminiResponse.dimensions.length,
      fixtures,
      doors,
      windows
    };

    console.log('[PARSER] dimensions:', result.width, result.length);
    console.log('[PARSER OUTPUT]', JSON.stringify(result, null, 2));

    // Validate dimensions
    if (result.width === 0 || result.length === 0) {
      throw new Error('Xona o\'lchamlari aniqlanmadi. Iltimos qayta kiriting.');
    }

    return result;
  }
}
