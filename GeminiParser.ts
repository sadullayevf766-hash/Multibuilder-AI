import type { RoomSpec, FixtureSpec, DoorSpec, WindowSpec, FloorPlan, RoomLayout } from '../../../shared/types';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedRoom {
  roomType?: string;
  dimensions?: { width: number; length: number };
  fixtures?: Array<{
    type: string;
    wall: 'north' | 'south' | 'east' | 'west';
    offset?: number;
    count?: number;
  }>;
  doors?: Array<{ wall: 'north' | 'south' | 'east' | 'west'; position?: 'center' | number }>;
  windows?: Array<{ wall: 'north' | 'south' | 'east' | 'west'; count: number }>;
  isMultiRoom?: boolean;
  totalArea?: number;
  rooms?: Array<{
    type: string;
    name: string;
    width: number;
    length: number;
    fixtures: Array<{ type: string; wall: string }>;
  }>;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert architectural floor plan parser. Convert natural language room descriptions into precise JSON specifications.

CRITICAL RULES:
1. Output ONLY valid JSON — no markdown, no backticks, no explanations
2. NEVER include coordinates (x, y, x1, y1, x2, y2)
3. NEVER include pipe paths or routing
4. Extract EVERY detail the user mentions — count, size, position
5. If user says "2 ta sink" add 2 sink fixtures
6. If user says "shimoliy tomonda deraza" add window on north wall
7. "katta" modifier increases dimensions by 1-2m

OUTPUT STRUCTURE for single room:
{
  "roomType": "bathroom"|"kitchen"|"office"|"bedroom"|"living"|"hallway",
  "dimensions": { "width": number_meters, "length": number_meters },
  "fixtures": [
    { "type": "toilet"|"sink"|"bathtub"|"shower"|"stove"|"fridge"|"dishwasher"|"desk"|"bed"|"wardrobe"|"sofa"|"tv_unit"|"bookshelf", "wall": "north"|"south"|"east"|"west", "count": 1 }
  ],
  "doors": [{ "wall": "south", "position": "center" }],
  "windows": [{ "wall": "north", "count": 1 }]
}

OUTPUT STRUCTURE for multi-room (kvartira, apartment, xonali):
{
  "isMultiRoom": true,
  "totalArea": number,
  "rooms": [
    { "type": "bathroom", "name": "Hammom", "width": 2.5, "length": 3, "fixtures": [{"type":"toilet","wall":"south"},{"type":"sink","wall":"north"}] },
    { "type": "kitchen",  "name": "Oshxona", "width": 4, "length": 4, "fixtures": [{"type":"stove","wall":"north"},{"type":"sink","wall":"north"},{"type":"fridge","wall":"west"}] }
  ]
}

DIMENSION RULES:
- Extract EXACT numbers: "8x5" → width:8, length:5
- "6 metr kenglik 4 uzunlik" → width:6, length:4
- "katta" adds 1-2m. "kichik" subtracts 1m.
- Defaults: bathroom 2.5×3, kitchen 4×4, bedroom 4×4, living 5×5

FIXTURE DEFAULTS by room:
- bathroom: toilet(south) + sink(north)
- kitchen: stove(north) + sink(north) + fridge(west)
- bedroom: bed(west) + wardrobe(east)
- living: sofa(south) + tv_unit(north)
- office: desk(north) + bookshelf(east)

Always extract every fixture and window the user explicitly mentions.`;

// ─────────────────────────────────────────────────────────────────────────────
// PARSER CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class GeminiParser {
  private geminiKey: string;
  private groqKey: string;
  private cache = new Map<string, RoomSpec | FloorPlan>();

  constructor(geminiKey: string, groqKey?: string) {
    this.geminiKey = geminiKey;
    this.groqKey = groqKey || process.env.GROQ_API_KEY || '';
  }

  async parseDescription(description: string): Promise<RoomSpec | FloorPlan> {
    const cacheKey = description.toLowerCase().trim();

    if (this.cache.has(cacheKey)) {
      console.log('[PARSER] Cache hit');
      return this.cache.get(cacheKey)!;
    }

    // 1. Try Groq (free, fast — 14,400 req/day)
    if (this.groqKey) {
      try {
        const parsed = await this.callGroq(description);
        const result = this.convertParsedToSpec(parsed, description);
        console.log('[MODE] LIVE via Groq');
        this.cache.set(cacheKey, result);
        return result;
      } catch (err) {
        console.log('[GROQ] Failed:', (err as Error).message, '— trying Gemini...');
      }
    }

    // 2. Try Gemini (with retry)
    if (this.geminiKey) {
      try {
        const parsed = await this.callGeminiWithRetry(description);
        const result = this.convertParsedToSpec(parsed, description);
        console.log('[MODE] LIVE via Gemini');
        this.cache.set(cacheKey, result);
        return result;
      } catch (err) {
        console.log('[GEMINI] Failed:', (err as Error).message, '— using smart demo...');
      }
    }

    // 3. Smart local parser (no AI)
    console.log('[MODE] DEMO — local smart parser');
    const result = this.smartLocalParse(description);
    this.cache.set(cacheKey, result);
    return result;
  }

  // ── GROQ API ──────────────────────────────────────────────────────────────

  private async callGroq(description: string): Promise<ParsedRoom> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.groqKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.1,
          max_tokens: 1500,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user',   content: description }
          ]
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const text = data.choices[0].message.content;
      console.log('[GROQ RAW]', text.slice(0, 300));
      return this.extractJSON(text);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  // ── GEMINI API ────────────────────────────────────────────────────────────

  private async callGeminiWithRetry(description: string, retries = 3): Promise<ParsedRoom> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.callGemini(description);
      } catch (err: any) {
        const isRateLimit = /429|RESOURCE_EXHAUSTED|Too Many Requests/.test(err.message || '');
        if (isRateLimit && i < retries - 1) {
          const delay = (i + 1) * 15000;
          console.log(`[GEMINI] Rate limited, retry in ${delay / 1000}s`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          throw err;
        }
      }
    }
    throw new Error('Gemini max retries exceeded');
  }

  private async callGemini(description: string): Promise<ParsedRoom> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${SYSTEM_PROMPT}\n\nUser: ${description}` }]
          }]
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Gemini ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.candidates[0].content.parts[0].text;
      console.log('[GEMINI RAW]', text.slice(0, 300));
      return this.extractJSON(text);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  // ── JSON EXTRACTION ───────────────────────────────────────────────────────

  private extractJSON(text: string): ParsedRoom {
    const clean = text.replace(/```json|```/gi, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in AI response');
    return JSON.parse(match[0]);
  }

  // ── CONVERT AI OUTPUT → RoomSpec | FloorPlan ─────────────────────────────

  private convertParsedToSpec(parsed: ParsedRoom, description: string): RoomSpec | FloorPlan {
    if (parsed.isMultiRoom && parsed.rooms) {
      return this.buildFloorPlan(parsed);
    }
    return this.buildRoomSpec(parsed, description);
  }

  private buildRoomSpec(p: ParsedRoom, description: string): RoomSpec {
    // Fallback: parse dimensions from description if AI missed
    let width = p.dimensions?.width || 0;
    let length = p.dimensions?.length || 0;

    if (!width || !length) {
      const dims = this.parseDimensions(description);
      width = dims.width;
      length = dims.length;
    }

    if (!width || !length) {
      throw new Error('Xona o\'lchamlari aniqlanmadi');
    }

    const fixtures: FixtureSpec[] = [];
    let fIdx = 0;

    for (const f of (p.fixtures || [])) {
      const cnt = f.count || 1;
      for (let c = 0; c < cnt; c++) {
        fixtures.push({
          id: `fixture-${fIdx++}`,
          type: f.type as any,
          wall: f.wall || this.defaultWall(f.type),
          needsWater: ['sink', 'bathtub', 'shower'].includes(f.type),
          needsDrain: ['sink', 'toilet', 'bathtub', 'shower'].includes(f.type)
        });
      }
    }

    const doors: DoorSpec[] = (p.doors?.length ? p.doors : [{ wall: 'south' }]).map((d, i) => ({
      id: `door-${i}`,
      wall: d.wall,
      width: 0.9
    }));

    const windows: WindowSpec[] = (p.windows || []).flatMap((w, i) =>
      Array.from({ length: w.count || 1 }, (_, j) => ({
        id: `window-${i}-${j}`,
        wall: w.wall,
        width: 1.2
      }))
    );

    const result: RoomSpec = {
      id: `room-${Date.now()}`,
      name: p.roomType || 'room',
      width,
      length,
      fixtures,
      doors,
      windows
    };

    console.log('[PARSER OUTPUT]', JSON.stringify(result, null, 2));
    return result;
  }

  private buildFloorPlan(p: ParsedRoom): FloorPlan {
    const rooms: RoomLayout[] = (p.rooms || []).map((r, i) => {
      const fixtures: FixtureSpec[] = (r.fixtures || []).map((f, j) => ({
        id: `f-${i}-${j}`,
        type: f.type as any,
        wall: (f.wall as any) || this.defaultWall(f.type),
        needsWater: ['sink', 'bathtub', 'shower'].includes(f.type),
        needsDrain: ['sink', 'toilet', 'bathtub', 'shower'].includes(f.type)
      }));

      const roomSpec: RoomSpec = {
        id: `room-${i}-${Date.now()}`,
        name: r.name,
        width: r.width,
        length: r.length,
        fixtures,
        doors: [{ id: `door-${i}`, wall: 'south', width: 0.9 }],
        windows: [{ id: `win-${i}`, wall: 'north', width: 1.2 }]
      };

      return {
        id: `layout-${i}`,
        roomSpec,
        position: { x: 0, y: 0 },
        connections: []
      };
    });

    const bW = Math.max(...rooms.map(r => r.position.x + r.roomSpec.width), 10);
    const bL = Math.max(...rooms.map(r => r.position.y + r.roomSpec.length), 10);

    return {
      id: `fp-${Date.now()}`,
      name: 'Floor Plan',
      totalArea: p.totalArea || bW * bL,
      rooms,
      buildingDimensions: { width: bW, length: bL }
    };
  }

  private defaultWall(type: string): 'north' | 'south' | 'east' | 'west' {
    const map: Record<string, 'north' | 'south' | 'east' | 'west'> = {
      toilet: 'south', stove: 'north', fridge: 'west',
      bed: 'west', sofa: 'south', tv_unit: 'north',
      desk: 'north', sink: 'north', bathtub: 'east',
      shower: 'east', wardrobe: 'east', bookshelf: 'east',
      dishwasher: 'north'
    };
    return map[type] || 'north';
  }

  // ── SMART LOCAL PARSER ────────────────────────────────────────────────────

  private smartLocalParse(description: string): RoomSpec | FloorPlan {
    const desc = description.toLowerCase();
    const isMultiRoom = /kvartira|apartment|xonali|ko'p xona|uy rejasi/.test(desc);
    if (isMultiRoom) return this.localFloorPlan(description, desc);
    return this.localSingleRoom(description, desc);
  }

  private localSingleRoom(description: string, desc: string): RoomSpec {
    const dims = this.parseDimensions(description);
    const roomType = this.detectRoomType(desc);

    const isLarge = /katta|keng|spacious|large/.test(desc);
    const isSmall = /kichik|tor|small|compact/.test(desc);

    let { width, length } = dims;

    if (!width || !length) {
      const defaults: Record<string, [number, number]> = {
        bathroom: [2.5, 3], kitchen: [4, 4], bedroom: [4, 4],
        living: [5, 5], office: [4, 5], hallway: [2, 3]
      };
      [width, length] = defaults[roomType] || [3, 4];
    }

    if (isLarge) { width += 1.5; length += 1.5; }
    if (isSmall && width > 2) { width -= 0.5; length -= 0.5; }

    const fixtures = this.extractFixtures(desc, roomType);
    const doors = this.extractDoors(desc);
    const windows = this.extractWindows(desc);

    const result: RoomSpec = {
      id: `room-${Date.now()}`,
      name: roomType,
      width: Math.max(width, 1.5),
      length: Math.max(length, 1.5),
      fixtures,
      doors,
      windows
    };

    console.log('[LOCAL PARSER OUTPUT]', JSON.stringify(result, null, 2));
    return result;
  }

  private parseDimensions(description: string): { width: number; length: number } {
    const patterns = [
      /([\d.]+)\s*[xх×*]\s*([\d.]+)/i,
      /([\d.]+)\s*metr\s+kenglik.*?([\d.]+)\s*metr/i,
      /kenglik[i:\s]*([\d.]+).*?uzunlik[i:\s]*([\d.]+)/i,
      /([\d.]+)\s*m\s*[xх×]\s*([\d.]+)\s*m/i,
      /([\d.]+)\s*ga\s*([\d.]+)/i
    ];
    for (const p of patterns) {
      const m = description.match(p);
      if (m) return { width: parseFloat(m[1]), length: parseFloat(m[2]) };
    }
    return { width: 0, length: 0 };
  }

  private extractFixtures(desc: string, roomType: string): FixtureSpec[] {
    const fixtures: FixtureSpec[] = [];
    let idx = 0;

    const add = (type: string, wall: 'north' | 'south' | 'east' | 'west') => {
      fixtures.push({
        id: `fixture-${idx++}`,
        type: type as any,
        wall,
        needsWater: ['sink', 'bathtub', 'shower'].includes(type),
        needsDrain: ['sink', 'toilet', 'bathtub', 'shower'].includes(type)
      });
    };

    const getCount = (keywords: string): number => {
      const m = desc.match(new RegExp(`(\\d+)\\s*ta\\s+(?:${keywords})`));
      if (m) return parseInt(m[1]);
      if (new RegExp(`ikki\\s*ta.*(?:${keywords})|juft.*(?:${keywords})`).test(desc)) return 2;
      return 1;
    };

    const getWall = (type: string): 'north' | 'south' | 'east' | 'west' => {
      const wallMatch = desc.match(new RegExp(`(shimol|janub|sharq|g.arb|north|south|east|west)[^.]*${type}|${type}[^.]*?(shimol|janub|sharq|g.arb|north|south|east|west)`));
      if (!wallMatch) return this.defaultWall(type);
      const w = wallMatch[1] || wallMatch[2];
      if (/shimol|north/.test(w)) return 'north';
      if (/janub|south/.test(w))  return 'south';
      if (/sharq|east/.test(w))   return 'east';
      if (/g.arb|west/.test(w))   return 'west';
      return this.defaultWall(type);
    };

    if (/hojatxona|toilet|unitas|wc/.test(desc)) {
      const n = getCount('hojatxona|toilet|unitas');
      for (let i = 0; i < n; i++) add('toilet', getWall('toilet'));
    }
    if (/lavabo|sink|rakovine/.test(desc)) {
      const n = getCount('lavabo|sink');
      for (let i = 0; i < n; i++) add('sink', i === 0 ? getWall('sink') : 'east');
    }
    if (/vanna[^xona]|bathtub/.test(desc)) add('bathtub', getWall('bathtub'));
    if (/dush|shower/.test(desc)) add('shower', getWall('shower'));
    if (/plita|stove|gazplita/.test(desc)) add('stove', getWall('stove'));
    if (/muzlatgich|fridge|holodilnik/.test(desc)) add('fridge', 'west');
    if (/idish yuv|dishwasher/.test(desc)) add('dishwasher', 'north');
    if (/\bstol\b|desk|ish stoli/.test(desc)) {
      const n = getCount('stol|desk');
      for (let i = 0; i < n; i++) add('desk', 'north');
    }
    if (/karavot|krovat|\bbed\b/.test(desc)) {
      const n = getCount('karavot|bed');
      for (let i = 0; i < n; i++) add('bed', i === 0 ? 'west' : 'east');
    }
    if (/shkaf|wardrobe|garderob/.test(desc)) add('wardrobe', 'east');
    if (/divan|sofa/.test(desc)) add('sofa', 'south');
    if (/televizor|\btv\b|tele/.test(desc)) add('tv_unit', 'north');
    if (/kitob javon|bookshelf|\bshelf\b/.test(desc)) add('bookshelf', 'east');

    return fixtures.length > 0 ? fixtures : this.defaultFixtures(roomType);
  }

  private defaultFixtures(roomType: string): FixtureSpec[] {
    const defs: Record<string, Array<{type: string; wall: 'north'|'south'|'east'|'west'}>> = {
      bathroom: [{type:'sink',wall:'north'},{type:'toilet',wall:'south'}],
      kitchen:  [{type:'stove',wall:'north'},{type:'sink',wall:'north'},{type:'fridge',wall:'west'}],
      bedroom:  [{type:'bed',wall:'west'},{type:'wardrobe',wall:'east'}],
      living:   [{type:'sofa',wall:'south'},{type:'tv_unit',wall:'north'}],
      office:   [{type:'desk',wall:'north'},{type:'bookshelf',wall:'east'}],
      hallway:  []
    };
    return (defs[roomType] || defs.bathroom).map((f, i) => ({
      id: `fixture-${i}`, type: f.type as any, wall: f.wall,
      needsWater: ['sink','bathtub','shower'].includes(f.type),
      needsDrain: ['sink','toilet','bathtub','shower'].includes(f.type)
    }));
  }

  private extractDoors(desc: string): DoorSpec[] {
    const wallMap: Record<string, 'north'|'south'|'east'|'west'> = {
      'shimol': 'north', 'north': 'north',
      'janub': 'south',  'south': 'south',
      'sharq': 'east',   'east': 'east',
      'garb':  'west',   'west': 'west'
    };
    for (const [key, wall] of Object.entries(wallMap)) {
      if (new RegExp(`${key}.*eshik|eshik.*${key}`).test(desc)) {
        return [{ id: 'door-0', wall, width: 0.9 }];
      }
    }
    return [{ id: 'door-0', wall: 'south', width: 0.9 }];
  }

  private extractWindows(desc: string): WindowSpec[] {
    const windows: WindowSpec[] = [];
    let idx = 0;
    const wallMap: Record<string, 'north'|'south'|'east'|'west'> = {
      'shimol': 'north', 'north': 'north',
      'janub': 'south',  'south': 'south',
      'sharq': 'east',   'east': 'east',
      'garb':  'west',   'west': 'west'
    };

    for (const [key, wall] of Object.entries(wallMap)) {
      if (new RegExp(`${key}.*deraza|deraza.*${key}`).test(desc)) {
        windows.push({ id: `win-${idx++}`, wall, width: 1.2 });
      }
    }

    if (windows.length === 0) {
      const m = desc.match(/(\d+)\s*ta\s+deraza/);
      const n = m ? parseInt(m[1]) : (/deraza|window/.test(desc) ? 1 : 0);
      for (let i = 0; i < n; i++) windows.push({ id: `win-${i}`, wall: 'north', width: 1.2 });
    }

    return windows;
  }

  private detectRoomType(desc: string): string {
    if (/hammom|vanna\s*xona|bathroom|dush|wc/.test(desc)) return 'bathroom';
    if (/oshxona|kitchen|plita|stove/.test(desc))           return 'kitchen';
    if (/yotoqxona|bedroom|karavot/.test(desc))             return 'bedroom';
    if (/mehmonxona|living|zal|divan/.test(desc))           return 'living';
    if (/ofis|office|kabinet/.test(desc))                   return 'office';
    if (/koridor|hallway|daliz/.test(desc))                 return 'hallway';
    return 'bathroom';
  }

  // ── LOCAL FLOOR PLAN ──────────────────────────────────────────────────────

  private localFloorPlan(description: string, desc: string): FloorPlan {
    const areaMatch = desc.match(/(\d+)\s*kv/);
    const totalArea = areaMatch ? parseInt(areaMatch[1]) : 60;

    const is4Room = /4\s*xonali|to'rt\s*xonali/.test(desc);
    const is3Room = /3\s*xonali|uch\s*xonali/.test(desc);

    const rooms: RoomLayout[] = [];

    if (is4Room) {
      rooms.push(
        this.makeLayout('living',   'living',   'Zal',         6,   5,  0,   0),
        this.makeLayout('kitchen',  'kitchen',  'Oshxona',     4,   4,  6,   0),
        this.makeLayout('bed1',     'bedroom',  'Yotoqxona 1', 4,   4,  0,   5),
        this.makeLayout('bed2',     'bedroom',  'Yotoqxona 2', 4,   4,  4,   5),
        this.makeLayout('bed3',     'bedroom',  'Yotoqxona 3', 3,   4,  8,   5),
        this.makeLayout('bed4',     'bedroom',  'Yotoqxona 4', 3,   4,  11,  5),
        this.makeLayout('bathroom', 'bathroom', 'Hammom',      2.5, 3,  0,   9),
        this.makeLayout('hallway',  'hallway',  'Koridor',     3,   2,  2.5, 9)
      );
    } else if (is3Room) {
      rooms.push(
        this.makeLayout('living',   'living',   'Zal',         6,   5,  0,   0),
        this.makeLayout('kitchen',  'kitchen',  'Oshxona',     4,   4,  6,   0),
        this.makeLayout('bed1',     'bedroom',  'Yotoqxona 1', 4,   4,  0,   5),
        this.makeLayout('bed2',     'bedroom',  'Yotoqxona 2', 3.5, 4,  4,   5),
        this.makeLayout('bed3',     'bedroom',  'Yotoqxona 3', 3,   4,  7.5, 5),
        this.makeLayout('bathroom', 'bathroom', 'Hammom',      2.5, 3,  0,   9),
        this.makeLayout('hallway',  'hallway',  'Koridor',     3,   2,  2.5, 9)
      );
    } else {
      rooms.push(
        this.makeLayout('living',   'living',   'Zal',       5, 4, 0, 0),
        this.makeLayout('kitchen',  'kitchen',  'Oshxona',   3, 4, 5, 0),
        this.makeLayout('bed1',     'bedroom',  'Yotoqxona', 4, 4, 0, 4),
        this.makeLayout('bathroom', 'bathroom', 'Hammom',    2, 2, 4, 4),
        this.makeLayout('hallway',  'hallway',  'Koridor',   2, 2, 6, 4)
      );
    }

    const bW = Math.max(...rooms.map(r => r.position.x + r.roomSpec.width));
    const bL = Math.max(...rooms.map(r => r.position.y + r.roomSpec.length));

    return {
      id: `fp-${Date.now()}`,
      name: description.slice(0, 50),
      totalArea,
      rooms,
      buildingDimensions: { width: bW, length: bL }
    };
  }

  private makeLayout(
    id: string, type: string, name: string,
    width: number, length: number,
    x: number, y: number
  ): RoomLayout {
    return {
      id: `layout-${id}`,
      roomSpec: {
        id: `spec-${id}`,
        name,
        width,
        length,
        fixtures: this.defaultFixtures(type),
        doors: [{ id: `door-${id}`, wall: 'south', width: 0.9 }],
        windows: type !== 'hallway' ? [{ id: `win-${id}`, wall: 'north', width: 1.2 }] : []
      },
      position: { x, y },
      connections: []
    };
  }
}
