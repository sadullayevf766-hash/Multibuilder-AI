import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiParser } from '../GeminiParser';

describe('GeminiParser', () => {
  let parser: GeminiParser;

  beforeEach(() => {
    parser = new GeminiParser('test-api-key');
  });

  describe('validateAndDefault', () => {
    it('should apply default dimensions when missing', () => {
      const result = (parser as any).validateAndDefault({
        roomType: 'bathroom',
        fixtures: [],
        doors: [],
        windows: []
      });

      expect(result.dimensions).toEqual({ width: 0, length: 0 });
    });

    it('should use provided dimensions when available', () => {
      const result = (parser as any).validateAndDefault({
        roomType: 'bathroom',
        dimensions: { width: 5, length: 6 },
        fixtures: [],
        doors: [],
        windows: []
      });

      expect(result.dimensions).toEqual({ width: 5, length: 6 });
    });

    it('should default to bathroom when roomType missing', () => {
      const result = (parser as any).validateAndDefault({
        fixtures: [],
        doors: [],
        windows: []
      });

      expect(result.roomType).toBe('bathroom');
    });
  });

  describe('extractJSON', () => {
    it('should extract JSON from text with surrounding content', () => {
      const text = 'Here is the result: {"roomType": "bathroom", "dimensions": {"width": 3, "length": 4}, "fixtures": [], "doors": [], "windows": []}';
      
      const result = (parser as any).extractJSON(text);

      expect(result.roomType).toBe('bathroom');
      expect(result.dimensions).toEqual({ width: 3, length: 4 });
    });

    it('should throw error when no JSON found', () => {
      const text = 'No JSON here';

      expect(() => (parser as any).extractJSON(text)).toThrow('No valid JSON found');
    });
  });

  describe('convertToRoomSpec', () => {
    it('should convert fixtures with correct water/drain needs', () => {
      const geminiResponse = {
        roomType: 'bathroom' as const,
        dimensions: { width: 3, length: 4 },
        fixtures: [
          { type: 'sink' as const, wall: 'north' as const },
          { type: 'toilet' as const, wall: 'south' as const }
        ],
        doors: [],
        windows: []
      };

      const roomSpec = (parser as any).convertToRoomSpec(geminiResponse);

      expect(roomSpec.fixtures).toHaveLength(2);
      expect(roomSpec.fixtures[0].needsWater).toBe(true);
      expect(roomSpec.fixtures[0].needsDrain).toBe(true);
      expect(roomSpec.fixtures[1].needsWater).toBe(false);
      expect(roomSpec.fixtures[1].needsDrain).toBe(true);
    });

    it('should create doors with default width', () => {
      const geminiResponse = {
        roomType: 'bathroom' as const,
        dimensions: { width: 3, length: 4 },
        fixtures: [],
        doors: [{ wall: 'south' as const, position: 'center' as const }],
        windows: []
      };

      const roomSpec = (parser as any).convertToRoomSpec(geminiResponse);

      expect(roomSpec.doors).toHaveLength(1);
      expect(roomSpec.doors[0].width).toBe(0.9);
    });

    it('should expand windows by count', () => {
      const geminiResponse = {
        roomType: 'office' as const,
        dimensions: { width: 5, length: 6 },
        fixtures: [],
        doors: [],
        windows: [{ wall: 'north' as const, count: 3 }]
      };

      const roomSpec = (parser as any).convertToRoomSpec(geminiResponse);

      expect(roomSpec.windows).toHaveLength(3);
      expect(roomSpec.windows[0].wall).toBe('north');
      expect(roomSpec.windows[0].width).toBe(1.2);
    });

    it('should set room name from roomType', () => {
      const geminiResponse = {
        roomType: 'kitchen' as const,
        dimensions: { width: 4, length: 5 },
        fixtures: [],
        doors: [],
        windows: []
      };

      const roomSpec = (parser as any).convertToRoomSpec(geminiResponse);

      expect(roomSpec.name).toBe('kitchen');
    });

    it('should generate unique IDs for all elements', () => {
      const geminiResponse = {
        roomType: 'bathroom' as const,
        dimensions: { width: 3, length: 4 },
        fixtures: [
          { type: 'sink' as const, wall: 'north' as const },
          { type: 'toilet' as const, wall: 'south' as const }
        ],
        doors: [{ wall: 'east' as const, position: 'center' as const }],
        windows: [{ wall: 'west' as const, count: 2 }]
      };

      const roomSpec = (parser as any).convertToRoomSpec(geminiResponse);

      expect(roomSpec.fixtures[0].id).toBe('fixture-0');
      expect(roomSpec.fixtures[1].id).toBe('fixture-1');
      expect(roomSpec.doors[0].id).toBe('door-0');
      expect(roomSpec.windows[0].id).toBe('window-0-0');
      expect(roomSpec.windows[1].id).toBe('window-0-1');
    });
  });

  describe('parseDescription', () => {
    it('should fallback to demo mode on API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'API Error'
      });

      const result = await parser.parseDescription('test');
      
      // Should return mock data instead of throwing
      expect(result.name).toBe('bathroom');
      expect(result.width).toBe(3);
      expect(result.length).toBe(4);
    });

    it('should parse valid Gemini response', async () => {
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: '{"roomType": "bathroom", "dimensions": {"width": 3, "length": 4}, "fixtures": [{"type": "sink", "wall": "north"}], "doors": [], "windows": []}'
            }]
          }
        }]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const result = await parser.parseDescription('Create a bathroom with a sink');

      expect(result.name).toBe('bathroom');
      expect(result.width).toBe(3);
      expect(result.length).toBe(4);
      expect(result.fixtures).toHaveLength(1);
    });
  });
});
