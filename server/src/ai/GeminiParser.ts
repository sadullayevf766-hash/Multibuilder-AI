import type { RoomSpec, FixtureSpec, DoorSpec, WindowSpec, FloorPlan, RoomLayout } from '../../../shared/types';
import { ARCHITECT_SYSTEM_PROMPT } from './prompts/architect.prompt';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface ArchitectFixture {
  type: string;
  nameUz?: string;
  wall: 'north' | 'south' | 'east' | 'west';
  placement?: { offsetFromCorner?: number; distanceFromWall?: number };
  dimensions?: { width: number; length: number };
  functionalGroup?: string;
  priority?: 'essential' | 'recommended' | 'optional';
  clearanceNeeded?: number;
  count?: number;
  reason?: string;
}

interface ArchitectDoor {
  wall: 'north' | 'south' | 'east' | 'west';
  offsetFromCorner?: number;
  width?: number;
  opensInward?: boolean;
  openDirection?: 'left' | 'right';
}

interface ArchitectWindow {
  wall: 'north' | 'south' | 'east' | 'west';
  offsetFromCorner?: number;
  width?: number;
  count?: number;
}

interface ArchitectResponse {
  roomType?: string;
  roomName?: string;
  dimensions?: { width: number; length: number };
  analysis?: {
    totalArea?: number;
    primaryZone?: string;
    trafficFlow?: string;
    designDecisions?: string[];
    functionalZones?: Array<{ name: string; description: string; wallSide: string }>;
    specialRequirements?: string[];
  };
  fixtures?: ArchitectFixture[];
  doors?: ArchitectDoor[];
  windows?: ArchitectWindow[];
  designNotes?: string[];
  // Multi-room support
  isMultiRoom?: boolean;
  totalArea?: number;
  rooms?: Array<{
    type: string;
    name: string;
    width: number;
    length: number;
    fixtures: Array<{ type: string; wall: string; placement?: { offsetFromCorner?: number } }>;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class GeminiParser {
  private geminiKey: string;
  private groqKey: string;
  private cache = new Map<string, { result: RoomSpec | FloorPlan; time: number }>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(geminiKey: string, groqKey?: string) {
    this.geminiKey = geminiKey;
    this.groqKey = groqKey || process.env.GROQ_API_KEY || '';
  }

  async parseDescription(description: string): Promise<RoomSpec | FloorPlan> {
    const cacheKey = description.toLowerCase().trim();
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.time < this.CACHE_TTL) {
      console.log('[PARSER] Cache hit');
      return cached.result;
    }
    // 1. Try Groq (free, fast — 14,400 req/day)
    if (this.groqKey) {
      try {
        const parsed = await this.callGroq(description);
        const result = this.convertArchitectJSON(parsed, description);
        console.log('[MODE] LIVE via Groq');
        this.cache.set(cacheKey, { result, time: Date.now() });
        return result;
      } catch (err) {
        console.log('[GROQ] Failed:', (err as Error).message, '— trying Gemini...');
      }
    }

    // 2. Try Gemini (with retry)
    if (this.geminiKey) {
      try {
        const parsed = await this.callGeminiWithRetry(description);
        const result = this.convertArchitectJSON(parsed, description);
        console.log('[MODE] LIVE via Gemini');
        this.cache.set(cacheKey, { result, time: Date.now() });
        return result;
      } catch (err) {
        console.log('[GEMINI] Failed:', (err as Error).message, '— using smart demo...');
      }
    }

    // 3. Smart local architect (no AI)
    console.log('[MODE] DEMO — local smart parser');
    const result = this.smartLocalParse(description);
    this.cache.set(cacheKey, { result, time: Date.now() });
    return result;
  }

  // ── GROQ API ──────────────────────────────────────────────────────────────

  private async callGroq(description: string): Promise<ArchitectResponse> {
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
          max_tokens: 2000,
          messages: [
            { role: 'system', content: ARCHITECT_SYSTEM_PROMPT },
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

  private async callGeminiWithRetry(description: string, retries = 3): Promise<ArchitectResponse> {
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

  private async callGemini(description: string): Promise<ArchitectResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${ARCHITECT_SYSTEM_PROMPT}\n\nUser: ${description}` }]
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

  private extractJSON(text: string): ArchitectResponse {
    const clean = text.replace(/```json|```/gi, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in AI response');
    return JSON.parse(match[0]);
  }

  // ── CONVERT ARCHITECT JSON → RoomSpec | FloorPlan ────────────────────────

  private convertArchitectJSON(data: ArchitectResponse, description: string): RoomSpec | FloorPlan {
    if (data.isMultiRoom && data.rooms) {
      return this.buildFloorPlan(data);
    }

    // Override roomType if description says combined living+kitchen
    const desc = description.toLowerCase();
    if (/mehmonxona.*oshxona|oshxona.*mehmonxona|birlashgan|studio|open.?plan/.test(desc)) {
      data.roomType = 'living';
      // Add kitchen fixtures if not present
      const hasKitchen = (data.fixtures || []).some(f => ['stove','fridge','sink'].includes(f.type));
      if (!hasKitchen) {
        data.fixtures = [
          { type: 'stove', wall: 'north', placement: { offsetFromCorner: 0.5 } },
          { type: 'sink',  wall: 'north', placement: { offsetFromCorner: 1.5 } },
          { type: 'fridge', wall: 'west', placement: { offsetFromCorner: 0.1 } },
          ...(data.fixtures || [])
        ];
      }
      // Add living fixtures if not present
      const hasLiving = (data.fixtures || []).some(f => ['sofa','tv_unit'].includes(f.type));
      if (!hasLiving) {
        data.fixtures = [
          ...(data.fixtures || []),
          { type: 'sofa',    wall: 'south', placement: { offsetFromCorner: 0.5 } },
          { type: 'tv_unit', wall: 'north', placement: { offsetFromCorner: 2.5 } }
        ];
      }
    }

    return this.buildRoomSpec(data, description);
  }

  private buildRoomSpec(p: ArchitectResponse, description: string): RoomSpec {
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

    // Normalize unknown fixture types to known ones
    const FIXTURE_TYPE_MAP: Record<string, string> = {
      'meeting table': 'dining_table', meeting_table: 'dining_table', meeting_room: 'dining_table',
      conference_table: 'dining_table', conference: 'dining_table',
      toy: 'bookshelf', toy_box: 'bookshelf', toy_shelf: 'bookshelf',
      play_mat: 'bookshelf', toys: 'bookshelf', playmat: 'bookshelf',
      robot: 'bookshelf', game: 'bookshelf', game_console: 'bookshelf',
      coat_rack: 'coat_rack', mirror: 'bookshelf', plant: 'bookshelf',
      nightstand: 'bookshelf', side_table: 'coffee_table',
      ottoman: 'armchair', recliner: 'armchair',
      cabinet: 'wardrobe', closet: 'wardrobe',
      counter: 'desk', workbench: 'desk',
      range: 'stove', oven: 'stove', cooktop: 'stove',
      refrigerator: 'fridge', freezer: 'fridge',
      washer: 'dishwasher', dryer: 'dishwasher',
      tub: 'bathtub', wc: 'toilet', commode: 'toilet',
      basin: 'sink', washbasin: 'sink', vanity: 'sink'
    };

    for (const f of (p.fixtures || [])) {
      const normalizedType = FIXTURE_TYPE_MAP[f.type?.toLowerCase()] || f.type;
      const cnt = f.count || 1;
      for (let c = 0; c < cnt; c++) {
        fixtures.push({
          id: `fixture-${fIdx++}`,
          type: normalizedType as any,
          wall: f.wall || this.defaultWall(normalizedType),
          offsetFromCorner: f.placement?.offsetFromCorner,
          clearanceNeeded: f.clearanceNeeded,
          priority: f.priority,
          needsWater: ['sink', 'bathtub', 'shower'].includes(normalizedType),
          needsDrain: ['sink', 'toilet', 'bathtub', 'shower'].includes(normalizedType)
        });
      }
    }

    const doors: DoorSpec[] = (p.doors?.length ? p.doors : [{ wall: 'south' as const }]).map((d, i) => ({
      id: `door-${i}`,
      wall: d.wall,
      width: d.width || 0.9
    }));

    const windows: WindowSpec[] = (p.windows || []).flatMap((w, i) => {
      const count = w.count || 1;
      return Array.from({ length: count }, (_, j) => ({
        id: `window-${i}-${j}`,
        wall: w.wall,
        width: w.width || 1.2
      }));
    });

    const result: RoomSpec = {
      id: `room-${Date.now()}`,
      name: p.roomType || 'room',
      width,
      length,
      fixtures,
      doors,
      windows
    };

    if (p.designNotes?.length) {
      console.log('[ARCHITECT NOTES]', p.designNotes.join(' | '));
    }
    if (p.analysis?.designDecisions?.length) {
      console.log('[ARCHITECT DECISIONS]', p.analysis.designDecisions.join(' | '));
    }
    console.log('[PARSER OUTPUT]', JSON.stringify(result, null, 2));
    return result;
  }

  private buildFloorPlan(p: ArchitectResponse): FloorPlan {
    const rooms: RoomLayout[] = (p.rooms || []).map((r, i) => {
      const fixtures: FixtureSpec[] = (r.fixtures || []).map((f, j) => ({
        id: `f-${i}-${j}`,
        type: f.type as any,
        wall: (f.wall as any) || this.defaultWall(f.type),
        offsetFromCorner: f.placement?.offsetFromCorner,
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

  // ── SMART LOCAL ARCHITECT ─────────────────────────────────────────────────

  private smartLocalParse(description: string): RoomSpec | FloorPlan {
    const desc = description.toLowerCase();
    const isMultiRoom = /kvartira|apartment|xonali|ko'p xona|uy rejasi/.test(desc);
    if (isMultiRoom) return this.localFloorPlan(description, desc);
    return this.localSingleRoom(description, desc);
  }

  private localSingleRoom(description: string, desc: string): RoomSpec {
    const dims = this.parseDimensions(description);
    const roomType = this.detectRoomType(desc);
    const isCombined = /mehmonxona.*oshxona|oshxona.*mehmonxona|birlashgan|studio/.test(desc);

    const isLarge = /katta|keng|spacious|large/.test(desc);
    const isSmall = /kichik|tor|small|compact/.test(desc);

    let { width, length } = dims;

    if (!width || !length) {
      const defaults: Record<string, [number, number]> = {
        bathroom: [2.5, 3], kitchen: [4, 4], bedroom: [4, 4],
        living: [5, 5], office: [4, 5], hallway: [2, 3]
      };
      [width, length] = defaults[roomType] || [3, 4];
      if (isCombined) { width = 6; length = 5; } // combined needs more space
    }

    if (isLarge && !dims.width) { width += 1.5; length += 1.5; }
    if (isSmall && !dims.width && width > 2) { width -= 0.5; length -= 0.5; }

    let fixtures = this.extractFixtures(desc, roomType);

    // Combined living+kitchen: add both sets of fixtures
    if (isCombined) {
      const hasKitchen = fixtures.some(f => ['stove','fridge','sink'].includes(f.type));
      const hasLiving = fixtures.some(f => ['sofa','tv_unit'].includes(f.type));
      let idx = fixtures.length;
      if (!hasKitchen) {
        fixtures.push(
          { id: `fixture-${idx++}`, type: 'stove' as any, wall: 'north', offsetFromCorner: 0.5, needsWater: false, needsDrain: false },
          { id: `fixture-${idx++}`, type: 'sink' as any, wall: 'north', offsetFromCorner: 1.5, needsWater: true, needsDrain: true },
          { id: `fixture-${idx++}`, type: 'fridge' as any, wall: 'west', offsetFromCorner: 0.1, needsWater: false, needsDrain: false }
        );
      }
      if (!hasLiving) {
        fixtures.push(
          { id: `fixture-${idx++}`, type: 'sofa' as any, wall: 'south', offsetFromCorner: 0.5, needsWater: false, needsDrain: false },
          { id: `fixture-${idx++}`, type: 'tv_unit' as any, wall: 'north', offsetFromCorner: 2.5, needsWater: false, needsDrain: false }
        );
      }
    }

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

    const add = (type: string, wall: 'north' | 'south' | 'east' | 'west', offset?: number) => {
      fixtures.push({
        id: `fixture-${idx++}`,
        type: type as any,
        wall,
        offsetFromCorner: offset,
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

    // Normalize apostrophes and special chars for matching
    const normalizedDesc = desc.replace(/g[''\u2019\u2018]arb/g, 'garb').replace(/[''\u2019\u2018]/g, '');

    // Split into clauses by comma/newline for accurate wall detection
    const clauses = normalizedDesc.split(/[,\n]+/).map(c => c.trim());

    const getWall = (type: string): 'north' | 'south' | 'east' | 'west' => {
      const fixtureKeywords: Record<string, string> = {
        sink: 'lavabo|sink', toilet: 'hojatxona|toilet|unitas|wc',
        bathtub: 'vanna', shower: 'dush|shower', stove: 'plita|stove|gazplita',
        fridge: 'muzlatgich|fridge', dishwasher: 'idish yuv|dishwasher',
        desk: 'stol|desk', bed: 'karavot|krovat|bed', wardrobe: 'shkaf|wardrobe|garderob',
        sofa: 'divan|sofa', tv_unit: 'televizor|tv|tele', bookshelf: 'kitob javon|bookshelf|shelf',
        coat_rack: 'kiyim ilgich|coat'
      };
      const fkw = fixtureKeywords[type] || type;
      const fkwRe = new RegExp(fkw, 'i');

      // Search only within the clause that contains this fixture keyword
      for (const clause of clauses) {
        if (!fkwRe.test(clause)) continue;
        // Found the clause — now find wall keyword in it
        const wallMatch = clause.match(/(shimol|janub|sharq|garb|north|south|east|west)/i);
        if (wallMatch) {
          const w = wallMatch[1].toLowerCase();
          if (/shimol|north/.test(w)) return 'north';
          if (/janub|south/.test(w))  return 'south';
          if (/sharq|east/.test(w))   return 'east';
          if (/garb|west/.test(w))    return 'west';
        }
      }

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
    if (/plita|stove|gazplita/.test(desc)) add('stove', getWall('stove'), 0.5);
    if (/muzlatgich|fridge|holodilnik/.test(desc)) add('fridge', getWall('fridge'), 0.1);
    if (/idish yuv|dishwasher/.test(desc)) add('dishwasher', getWall('dishwasher'));
    if (/\bstol\b|desk|ish stoli/.test(desc)) {
      const n = getCount('stol|desk');
      const deskWall = getWall('desk');
      for (let i = 0; i < n; i++) add('desk', deskWall, i * 1.5);
    }
    if (/karavot|krovat|\bbed\b/.test(desc)) {
      const n = getCount('karavot|bed');
      const bedWall = getWall('bed');
      for (let i = 0; i < n; i++) add('bed', i === 0 ? bedWall : (bedWall === 'west' ? 'east' : bedWall));
    }
    if (/shkaf|wardrobe|garderob/.test(desc)) add('wardrobe', getWall('wardrobe'), 0.1);
    if (/divan|sofa/.test(desc)) add('sofa', getWall('sofa'), 0.5);
    if (/televizor|\btv\b|tele/.test(desc)) add('tv_unit', getWall('tv_unit'), 0.5);
    if (/kitob javon|bookshelf|\bshelf\b/.test(desc)) add('bookshelf', getWall('bookshelf'), 0.1);

    return fixtures.length > 0 ? fixtures : this.defaultFixtures(roomType);
  }

  private defaultFixtures(roomType: string): FixtureSpec[] {
    const defs: Record<string, Array<{type: string; wall: 'north'|'south'|'east'|'west'; offset?: number}>> = {
      bathroom: [{type:'sink',wall:'north',offset:0.3},{type:'toilet',wall:'south',offset:0.3}],
      kitchen:  [{type:'stove',wall:'north',offset:0.5},{type:'sink',wall:'north',offset:1.5},{type:'fridge',wall:'west',offset:0.1}],
      bedroom:  [{type:'bed',wall:'west',offset:0.3},{type:'wardrobe',wall:'east',offset:0.1}],
      living:   [{type:'sofa',wall:'south',offset:0.5},{type:'tv_unit',wall:'north',offset:0.5},{type:'coffee_table',wall:'south',offset:1.2}],
      office:   [{type:'desk',wall:'north',offset:0.3},{type:'bookshelf',wall:'east',offset:0.1},{type:'desk',wall:'north',offset:1.8},{type:'armchair',wall:'west',offset:0.5}],
      hallway:  [{type:'wardrobe',wall:'north',offset:0.1},{type:'coat_rack',wall:'south',offset:0.3}]
    };
    return (defs[roomType] || defs.bathroom).map((f, i) => ({
      id: `fixture-${i}`, type: f.type as any, wall: f.wall,
      offsetFromCorner: f.offset,
      needsWater: ['sink','bathtub','shower'].includes(f.type),
      needsDrain: ['sink','toilet','bathtub','shower'].includes(f.type)
    }));
  }

  private extractDoors(desc: string): DoorSpec[] {
    const normalizedDesc = desc.replace(/g[''\u2019\u2018]arb/g, 'garb').replace(/[''\u2019\u2018]/g, '');
    const clauses = normalizedDesc.split(/[,\n]+/).map(c => c.trim());
    const wallMap: Record<string, 'north'|'south'|'east'|'west'> = {
      shimol: 'north', north: 'north', janub: 'south', south: 'south',
      sharq: 'east', east: 'east', garb: 'west', west: 'west'
    };
    for (const clause of clauses) {
      if (!/eshik|door/.test(clause)) continue;
      const wm = clause.match(/(shimol|janub|sharq|garb|north|south|east|west)/i);
      if (wm) return [{ id: 'door-0', wall: wallMap[wm[1].toLowerCase()] || 'south', width: 0.9 }];
    }
    return [{ id: 'door-0', wall: 'south', width: 0.9 }];
  }

  private extractWindows(desc: string): WindowSpec[] {
    const windows: WindowSpec[] = [];
    let idx = 0;
    const normalizedDesc = desc.replace(/g[''\u2019\u2018]arb/g, 'garb').replace(/[''\u2019\u2018]/g, '');
    const clauses = normalizedDesc.split(/[,\n]+/).map(c => c.trim());
    const wallMap: Record<string, 'north'|'south'|'east'|'west'> = {
      shimol: 'north', north: 'north', janub: 'south', south: 'south',
      sharq: 'east', east: 'east', garb: 'west', west: 'west'
    };

    for (const clause of clauses) {
      if (!/deraza|window/.test(clause)) continue;
      const wm = clause.match(/(shimol|janub|sharq|garb|north|south|east|west)/i);
      const wall = wm ? (wallMap[wm[1].toLowerCase()] || 'north') : 'north';
      // Count: "2 ta deraza" or "shimolda 2 ta deraza"
      const countMatch = clause.match(/(\d+)\s*ta\s+deraza/);
      const count = countMatch ? parseInt(countMatch[1]) : 1;
      for (let c = 0; c < count; c++) {
        windows.push({ id: `win-${idx++}`, wall, width: 1.2 });
      }
    }

    return windows;
  }

  private detectRoomType(desc: string): string {
    if (/hammom|vanna\s*xona|bathroom|dush|wc/.test(desc)) return 'bathroom';
    if (/oshxona|kitchen|plita|stove/.test(desc))           return 'kitchen';
    if (/bolalar\s*xona|children|nursery|o'yin\s*xona/.test(desc)) return 'bedroom';
    if (/yotoqxona|bedroom|karavot/.test(desc))             return 'bedroom';
    if (/mehmonxona.*oshxona|oshxona.*mehmonxona|studio|birlashgan/.test(desc)) return 'living';
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
