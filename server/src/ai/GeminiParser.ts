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
    const cacheKey = 'v2:' + description.toLowerCase().trim();
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.time < this.CACHE_TTL) {
      console.log('[PARSER] Cache hit');
      return cached.result;
    }

    // Detect multi-line prompt (each line = separate room)
    const lines = description.trim().split('\n').map(l => l.trim()).filter(l => l.length > 3);
    if (lines.length >= 2) {
      console.log('[PARSER] Multi-line prompt detected:', lines.length, 'rooms');
      const result = await this.parseMultiLineRooms(lines);
      this.cache.set(cacheKey, { result, time: Date.now() });
      return result;
    }

    // For simple prompts (no detailed fixture info), use local parser directly
    // Groq is only useful when user provides detailed fixture/wall info
    const hasDetailedInfo = /shimol|janub|sharq|g.arb|lavabo|plita|karavot|divan|stol|shkaf|dush|unitaz|muzlatgich|sink|stove|bed|sofa|desk|toilet|shower|fridge|wardrobe/i.test(description);

    // 1. Try Groq only for detailed prompts
    if (this.groqKey && hasDetailedInfo) {
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

    // 2. Try Gemini (with retry) for detailed prompts
    if (this.geminiKey && hasDetailedInfo) {
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

    // 3. Smart local architect (always used for simple prompts)
    console.log('[MODE] DEMO — local smart parser');
    const result = this.smartLocalParse(description);
    this.cache.set(cacheKey, { result, time: Date.now() });
    return result;
  }

  // Parse multi-line prompt: each line = one room → FloorPlan
  private async parseMultiLineRooms(lines: string[]): Promise<FloorPlan> {
    // Always use local parser for multi-line — more reliable wall placement
    const rooms: RoomLayout[] = [];
    let currentX = 0;
    let currentY = 0;
    let rowMaxLength = 0;
    const MAX_ROW_WIDTH = 12;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const roomSpec = this.localSingleRoom(line, line.toLowerCase());
      console.log(`[MULTI-LINE] Room ${i + 1}:`, roomSpec.name, roomSpec.width, 'x', roomSpec.length,
        'fixtures:', roomSpec.fixtures.map(f => `${f.type}@${f.wall}`).join(', '),
        'doors:', roomSpec.doors.map(d => d.wall).join(','),
        'windows:', roomSpec.windows.map(w => w.wall).join(','));

      // Auto-layout
      if (currentX > 0 && currentX + roomSpec.width > MAX_ROW_WIDTH) {
        currentY += rowMaxLength;
        currentX = 0;
        rowMaxLength = 0;
      }

      rooms.push({
        id: `layout-${i}`,
        roomSpec,
        position: { x: currentX, y: currentY },
        connections: []
      });

      currentX += roomSpec.width;
      rowMaxLength = Math.max(rowMaxLength, roomSpec.length);
    }

    const bW = Math.max(...rooms.map(r => r.position.x + r.roomSpec.width));
    const bL = Math.max(...rooms.map(r => r.position.y + r.roomSpec.length));

    return {
      id: `fp-${Date.now()}`,
      name: 'Floor Plan',
      totalArea: bW * bL,
      rooms,
      buildingDimensions: { width: bW, length: bL }
    };
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

    // Bathroom: door must be south (toilet is south, door can't be same wall as toilet)
    // Also ensure door is not on same wall as toilet
    const toiletWall = (p.fixtures || []).find(f => f.type === 'toilet')?.wall;
    const finalDoors = doors.map(d => ({
      ...d,
      wall: (toiletWall && d.wall === toiletWall && p.roomType === 'bathroom')
        ? ('east' as const)
        : d.wall
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
      doors: finalDoors,
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

      // Use doors/windows from AI response if available, else defaults
      const roomDoors: DoorSpec[] = ((r as any).doors?.length
        ? (r as any).doors.map((d: any, di: number) => ({ id: `door-${i}-${di}`, wall: d.wall || 'south', width: d.width || 0.9 }))
        : [{ id: `door-${i}`, wall: 'south' as const, width: 0.9 }]);

      const roomWindows: WindowSpec[] = ((r as any).windows?.length
        ? (r as any).windows.flatMap((w: any, wi: number) => {
            const count = w.count || 1;
            return Array.from({ length: count }, (_, c) => ({
              id: `win-${i}-${wi}-${c}`,
              wall: w.wall || 'north',
              width: w.width || 1.2
            }));
          })
        : (r.type !== 'hallway' ? [{ id: `win-${i}`, wall: 'north' as const, width: 1.2 }] : []));

      const roomSpec: RoomSpec = {
        id: `room-${i}-${Date.now()}`,
        name: r.name,
        width: r.width,
        length: r.length,
        fixtures,
        doors: roomDoors,
        windows: roomWindows
      };

      return {
        id: `layout-${i}`,
        roomSpec,
        position: { x: 0, y: 0 },
        connections: []
      };
    });

    // Calculate actual building bounds after layout
    // Rooms are laid out in a row by FloorPlanEngine, so estimate here
    const totalRoomWidth = rooms.reduce((sum, r) => sum + r.roomSpec.width, 0);
    const maxRoomLength = Math.max(...rooms.map(r => r.roomSpec.length));
    const bW = Math.max(totalRoomWidth, 10);
    const bL = Math.max(maxRoomLength, 8);

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
    const isMultiRoom = /kvartira|apartment|(\d+)\s*xonali|ko.p\s*xona|uy\s*rejasi|kichik\s*uy|zamonaviy\s*uy/.test(desc);
    if (isMultiRoom) return this.localFloorPlan(description, desc);
    return this.localSingleRoom(description, desc);
  }

  private localSingleRoom(description: string, desc: string): RoomSpec {
    // Normalize apostrophes in g'arb → garb
    desc = desc.replace(/g[`'']/g, 'g').replace(/g'arb|garb/g, 'garb');
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
      [width, length] = defaults[roomType] || [4, 5];
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
    let windows = this.extractWindows(desc, doors[0]?.wall);

    // Add default window if none specified (except hallway/bathroom)
    if (windows.length === 0 && !['bathroom', 'hallway'].includes(roomType)) {
      const defaultWinWall = doors[0]?.wall === 'north' ? 'south' : 'north';
      windows = [{ id: 'win-default', wall: defaultWinWall as 'north'|'south'|'east'|'west', width: 1.2 }];
    }

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

    const getWall = (type: string): 'north' | 'south' | 'east' | 'west' => {
      // Normalize apostrophe variants: g'arb, g`arb → garb
      const normalized = desc.replace(/g[`'']/g, 'g').replace(/garb/g, 'garb');
      const wallKeywords = 'shimol|janub|sharq|garb|north|south|east|west';

      // Uzbek keyword aliases for each fixture type
      const aliases: Record<string, string> = {
        sink:       'lavabo|sink|rakovine',
        toilet:     'hojatxona|toilet|unitas|wc|unitaz',
        bathtub:    'vanna|bathtub',
        shower:     'dush|shower|kabina',
        stove:      'plita|stove|gazplita',
        fridge:     'muzlatgich|fridge|holodilnik',
        dishwasher: 'idish|dishwasher',
        desk:       'stol|desk',
        bed:        'karavot|krovat|bed',
        wardrobe:   'shkaf|wardrobe|garderob',
        sofa:       'divan|sofa',
        tv_unit:    'televizor|tv|tele',
        bookshelf:  'kitob|bookshelf|shelf',
        coat_rack:  'kiyim|coat',
        armchair:   'kreslo|armchair',
        coffee_table: 'jurnal|coffee',
        dining_table: 'ovqat|dining',
        chair:      'stul|chair'
      };
      const searchPattern = aliases[type] || type;

      // Split by comma or newline — each fragment is one "clause"
      const sentences = normalized.split(/[,\n]/);
      for (const sentence of sentences) {
        if (!new RegExp(searchPattern).test(sentence)) continue;
        const wm = sentence.match(new RegExp(`(${wallKeywords})`));
        if (wm) {
          const w = wm[1];
          if (/shimol|north/.test(w)) return 'north';
          if (/janub|south/.test(w))  return 'south';
          if (/sharq|east/.test(w))   return 'east';
          if (/garb|west/.test(w))    return 'west';
        }
      }
      return this.defaultWall(type);
    };

    if (/hojatxona|toilet|unitas|unitaz|wc/.test(desc)) {
      const n = getCount('hojatxona|toilet|unitas|unitaz');
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
      for (let i = 0; i < n; i++) add('desk', getWall('desk'), i * 1.5);
    }
    if (/karavot|krovat|\bbed\b/.test(desc)) {
      const n = getCount('karavot|bed');
      for (let i = 0; i < n; i++) add('bed', i === 0 ? getWall('bed') : 'east');
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
      kitchen:  [{type:'stove',wall:'north',offset:0.3},{type:'sink',wall:'north',offset:1.5},{type:'fridge',wall:'west',offset:0.1}],
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
    const normalized = desc.replace(/g[`'']/g, 'g').replace(/g'arb|g`arb|garb/g, 'garb');
    const wallMap: Record<string, 'north'|'south'|'east'|'west'> = {
      'shimol': 'north', 'north': 'north',
      'janub': 'south',  'south': 'south',
      'sharq': 'east',   'east': 'east',
      'garb':  'west',   'west': 'west'
    };
    for (const [key, wall] of Object.entries(wallMap)) {
      if (new RegExp(`${key}[^,\\n]*eshik|eshik[^,\\n]*${key}`).test(normalized)) {
        return [{ id: 'door-0', wall, width: 0.9 }];
      }
    }
    return [{ id: 'door-0', wall: 'south', width: 0.9 }];
  }

  private extractWindows(desc: string, doorWall?: string): WindowSpec[] {
    const normalized = desc.replace(/g[`'']/g, 'g').replace(/g'arb|g`arb|garb/g, 'garb');
    const windows: WindowSpec[] = [];
    let idx = 0;
    const wallMap: Record<string, 'north'|'south'|'east'|'west'> = {
      'shimol': 'north', 'north': 'north',
      'janub': 'south',  'south': 'south',
      'sharq': 'east',   'east': 'east',
      'garb':  'west',   'west': 'west'
    };

    for (const [key, wall] of Object.entries(wallMap)) {
      if (new RegExp(`${key}[^,\\n]*deraza|deraza[^,\\n]*${key}`).test(normalized)) {
        if (wall !== doorWall) {
          // Check for count: "shimolda 2 ta deraza"
          const countMatch = normalized.match(new RegExp(`${key}[^,\\n]*?(\\d+)\\s*ta\\s*deraza|(\\d+)\\s*ta\\s*deraza[^,\\n]*?${key}`));
          const count = countMatch ? parseInt(countMatch[1] || countMatch[2]) : 1;
          for (let c = 0; c < count; c++) {
            windows.push({ id: `win-${idx++}`, wall, width: 1.2 });
          }
        }
      }
    }

    if (windows.length === 0) {
      const m = normalized.match(/(\d+)\s*ta\s+deraza/);
      const n = m ? parseInt(m[1]) : (/deraza|window/.test(normalized) ? 1 : 0);
      const defaultWall = doorWall === 'north' ? 'south' : 'north';
      for (let i = 0; i < n; i++) windows.push({ id: `win-${i}`, wall: defaultWall as 'north'|'south'|'east'|'west', width: 1.2 });
    }

    return windows;
  }

  private detectRoomType(desc: string): string {
    if (/hammom|vanna\s*xona|bathroom|dush|wc/.test(desc)) return 'bathroom';
    if (/oshxona|kitchen|plita|stove/.test(desc))           return 'kitchen';
    if (/bolalar\s*xona|children|nursery|o.yin\s*xona/.test(desc)) return 'bedroom';
    if (/yotoqxona|bedroom|karavot/.test(desc))             return 'bedroom';
    if (/mehmonxona.*oshxona|oshxona.*mehmonxona|studio|birlashgan/.test(desc)) return 'living';
    if (/mehmonxona|living|zal|divan/.test(desc))           return 'living';
    if (/ofis|office|kabinet/.test(desc))                   return 'office';
    if (/koridor|hallway|daliz/.test(desc))                 return 'hallway';
    // Stress test: generic prompts → default to living room
    if (/katta\s*joy|zamonaviy|xona|room/.test(desc))       return 'living';
    return 'living'; // default: living room (most common)
  }

  // ── LOCAL FLOOR PLAN ──────────────────────────────────────────────────────

  private localFloorPlan(description: string, desc: string): FloorPlan {
    const areaMatch = desc.match(/(\d+)\s*kv/);
    const totalArea = areaMatch ? parseInt(areaMatch[1]) : 60;

    const is4Room = /4\s*xonali|to.rt\s*xonali/.test(desc);
    const is3Room = /3\s*xonali|uch\s*xonali/.test(desc);
    const is2Room = /2\s*xonali|ikki\s*xonali/.test(desc);
    // "kichik uy: 2 yotoqxona, oshxona, hammom" → 2 bedroom + kitchen + bathroom
    const has2Bedrooms = /2\s*ta\s*yotoqxona|ikki\s*(ta\s*)?yotoqxona/.test(desc);

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
    } else if (is2Room || has2Bedrooms) {
      // 2 xonali kvartira OR kichik uy: 2 yotoqxona, oshxona, hammom
      rooms.push(
        this.makeLayout('living',   'living',   'Zal',         5,   4,  0,   0),
        this.makeLayout('kitchen',  'kitchen',  'Oshxona',     3,   4,  5,   0),
        this.makeLayout('bed1',     'bedroom',  'Yotoqxona 1', 4,   4,  0,   4),
        this.makeLayout('bed2',     'bedroom',  'Yotoqxona 2', 3.5, 4,  4,   4),
        this.makeLayout('bathroom', 'bathroom', 'Hammom',      2.5, 3,  7.5, 4),
        this.makeLayout('hallway',  'hallway',  'Koridor',     2,   2,  0,   8)
      );
    } else {
      // Default: 1 xonali kvartira
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
