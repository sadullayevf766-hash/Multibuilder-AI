import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiParser } from '../GeminiParser';

describe('GeminiParser', () => {
  let parser: GeminiParser;

  beforeEach(() => {
    parser = new GeminiParser('', ''); // no keys → demo mode
  });

  // ── extractJSON ──────────────────────────────────────────────────────────

  describe('extractJSON', () => {
    it('should extract JSON from text with surrounding content', () => {
      const text = 'Here is the result: {"roomType": "bathroom", "dimensions": {"width": 3, "length": 4}, "fixtures": [], "doors": [], "windows": []}';
      const result = (parser as any).extractJSON(text);
      expect(result.roomType).toBe('bathroom');
      expect(result.dimensions).toEqual({ width: 3, length: 4 });
    });

    it('should strip markdown fences', () => {
      const text = '```json\n{"roomType": "kitchen", "dimensions": {"width": 4, "length": 4}, "fixtures": [], "doors": [], "windows": []}\n```';
      const result = (parser as any).extractJSON(text);
      expect(result.roomType).toBe('kitchen');
    });

    it('should throw error when no JSON found', () => {
      expect(() => (parser as any).extractJSON('No JSON here')).toThrow('No JSON in AI response');
    });
  });

  // ── buildRoomSpec ─────────────────────────────────────────────────────────

  describe('buildRoomSpec', () => {
    it('should convert fixtures with correct water/drain needs', () => {
      const parsed = {
        roomType: 'bathroom',
        dimensions: { width: 3, length: 4 },
        fixtures: [
          { type: 'sink',   wall: 'north' },
          { type: 'toilet', wall: 'south' }
        ],
        doors: [],
        windows: []
      };
      const roomSpec = (parser as any).buildRoomSpec(parsed, '');
      expect(roomSpec.fixtures).toHaveLength(2);
      expect(roomSpec.fixtures[0].needsWater).toBe(true);
      expect(roomSpec.fixtures[0].needsDrain).toBe(true);
      expect(roomSpec.fixtures[1].needsWater).toBe(false);
      expect(roomSpec.fixtures[1].needsDrain).toBe(true);
    });

    it('should create doors with default width', () => {
      const parsed = {
        roomType: 'bathroom',
        dimensions: { width: 3, length: 4 },
        fixtures: [],
        doors: [{ wall: 'south', position: 'center' }],
        windows: []
      };
      const roomSpec = (parser as any).buildRoomSpec(parsed, '');
      expect(roomSpec.doors).toHaveLength(1);
      expect(roomSpec.doors[0].width).toBe(0.9);
    });

    it('should expand windows by count', () => {
      const parsed = {
        roomType: 'office',
        dimensions: { width: 5, length: 6 },
        fixtures: [],
        doors: [],
        windows: [{ wall: 'north', count: 3 }]
      };
      const roomSpec = (parser as any).buildRoomSpec(parsed, '');
      expect(roomSpec.windows).toHaveLength(3);
      expect(roomSpec.windows[0].wall).toBe('north');
      expect(roomSpec.windows[0].width).toBe(1.2);
    });

    it('should set room name from roomType', () => {
      const parsed = {
        roomType: 'kitchen',
        dimensions: { width: 4, length: 5 },
        fixtures: [],
        doors: [],
        windows: []
      };
      const roomSpec = (parser as any).buildRoomSpec(parsed, '');
      expect(roomSpec.name).toBe('kitchen');
    });

    it('should generate unique IDs', () => {
      const parsed = {
        roomType: 'bathroom',
        dimensions: { width: 3, length: 4 },
        fixtures: [
          { type: 'sink',   wall: 'north' },
          { type: 'toilet', wall: 'south' }
        ],
        doors: [{ wall: 'east', position: 'center' }],
        windows: [{ wall: 'west', count: 2 }]
      };
      const roomSpec = (parser as any).buildRoomSpec(parsed, '');
      expect(roomSpec.fixtures[0].id).toBe('fixture-0');
      expect(roomSpec.fixtures[1].id).toBe('fixture-1');
      expect(roomSpec.doors[0].id).toBe('door-0');
      expect(roomSpec.windows[0].id).toBe('window-0-0');
      expect(roomSpec.windows[1].id).toBe('window-0-1');
    });

    it('should handle fixture count field', () => {
      const parsed = {
        roomType: 'kitchen',
        dimensions: { width: 4, length: 4 },
        fixtures: [{ type: 'sink', wall: 'north', count: 2 }],
        doors: [],
        windows: []
      };
      const roomSpec = (parser as any).buildRoomSpec(parsed, '');
      expect(roomSpec.fixtures).toHaveLength(2);
      expect(roomSpec.fixtures[0].type).toBe('sink');
      expect(roomSpec.fixtures[1].type).toBe('sink');
    });
  });

  // ── parseDescription (demo mode) ─────────────────────────────────────────

  describe('parseDescription', () => {
    it('should fallback to demo mode on API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, statusText: 'API Error', text: async () => 'err' });
      const p = new GeminiParser('bad-key', 'bad-groq');
      const result = await p.parseDescription('hammom');
      expect('width' in result).toBe(true);
    });

    it('should parse valid AI response (mocked as Groq)', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"roomType": "bathroom", "dimensions": {"width": 3, "length": 4}, "fixtures": [{"type": "sink", "wall": "north"}], "doors": [], "windows": []}'
          }
        }]
      };
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockResponse });

      const p = new GeminiParser('', 'valid-groq-key');
      const result = await p.parseDescription('Create a bathroom with a sink');

      expect(result.name).toBe('bathroom');
      expect((result as any).width).toBe(3);
      expect((result as any).length).toBe(4);
      expect((result as any).fixtures).toHaveLength(1);
    });

    it('should detect multi-room from description in demo mode', async () => {
      const p = new GeminiParser('', '');
      const result = await p.parseDescription('2 xonali kvartira');
      expect('rooms' in result).toBe(true);
    });

    it('should return cached result on second call', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => 'err' });
      const p = new GeminiParser('', '');
      const r1 = await p.parseDescription('oshxona 4x4');
      const r2 = await p.parseDescription('oshxona 4x4');
      expect(r1).toBe(r2); // same reference = cache hit
    });
  });

  // ── local smart parser ────────────────────────────────────────────────────

  describe('smartLocalParse', () => {
    it('should extract dimensions from "4x5 hammom"', async () => {
      const p = new GeminiParser('', '');
      const result = await p.parseDescription('4x5 hammom');
      expect((result as any).width).toBe(4);
      expect((result as any).length).toBe(5);
    });

    it('should extract 2 sinks from "2 ta lavabo bor hammom"', async () => {
      const p = new GeminiParser('', '');
      const result = await p.parseDescription('2 ta lavabo bor hammom 3x3');
      const sinks = (result as any).fixtures.filter((f: any) => f.type === 'sink');
      expect(sinks.length).toBe(2);
    });

    it('should detect window wall from "shimoliy deraza"', async () => {
      const p = new GeminiParser('', '');
      const result = await p.parseDescription('3x4 hammom shimoliy deraza');
      const win = (result as any).windows[0];
      expect(win?.wall).toBe('north');
    });

    it('should parse bathroom with unitaz on south and dush on east', async () => {
      const p = new GeminiParser('', '');
      const result = await p.parseDescription('3x4 hammom, shimolda lavabo, janubda unitaz, sharqda dush kabinasi') as any;
      const toilet = result.fixtures.find((f: any) => f.type === 'toilet');
      const shower = result.fixtures.find((f: any) => f.type === 'shower');
      const sink = result.fixtures.find((f: any) => f.type === 'sink');
      expect(toilet).toBeDefined();
      expect(toilet?.wall).toBe('south');
      expect(shower?.wall).toBe('east');
      expect(sink?.wall).toBe('north');
    });

    it('should apply katta modifier', async () => {
      const p = new GeminiParser('', '');
      const small = await p.parseDescription('oshxona') as any;
      const large = await p.parseDescription('katta oshxona xona') as any;
      expect(large.width).toBeGreaterThan(small.width);
    });

    it('should detect 3 xonali floor plan', async () => {
      const p = new GeminiParser('', '');
      const result = await p.parseDescription('3 xonali kvartira') as any;
      expect('rooms' in result).toBe(true);
      expect(result.rooms.length).toBeGreaterThanOrEqual(5);
    });
  });
});
