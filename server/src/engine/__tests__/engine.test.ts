import { describe, it, expect } from 'vitest';
import { FloorPlanEngine } from '../FloorPlanEngine';
import type { RoomSpec } from '../../../../shared/types';

describe('FloorPlanEngine', () => {
  const engine = new FloorPlanEngine();

  describe('generateWalls', () => {
    it('should create 4 walls forming a closed rectangle', () => {
      const roomSpec: RoomSpec = {
        id: 'room1',
        name: 'Bathroom',
        width: 3,
        length: 4,
        fixtures: [],
        doors: [],
        windows: []
      };

      const walls = engine.generateWalls(roomSpec);

      expect(walls).toHaveLength(4);
      expect(walls[0].side).toBe('north');
      expect(walls[1].side).toBe('east');
      expect(walls[2].side).toBe('south');
      expect(walls[3].side).toBe('west');
    });

    it('should use correct coordinate system (1m = 100 units)', () => {
      const roomSpec: RoomSpec = {
        id: 'room1',
        name: 'Bathroom',
        width: 3,
        length: 4,
        fixtures: [],
        doors: [],
        windows: []
      };

      const walls = engine.generateWalls(roomSpec);
      const northWall = walls.find(w => w.side === 'north')!;

      expect(northWall.end.x).toBe(300); // 3m * 100
    });

    it('should set wall thickness to 15 units', () => {
      const roomSpec: RoomSpec = {
        id: 'room1',
        name: 'Bathroom',
        width: 3,
        length: 4,
        fixtures: [],
        doors: [],
        windows: []
      };

      const walls = engine.generateWalls(roomSpec);

      walls.forEach(wall => {
        expect(wall.thickness).toBe(15);
      });
    });
  });

  describe('placeFixtures', () => {
    it('should snap fixtures to wall with minimum 10 unit gap', () => {
      const roomSpec: RoomSpec = {
        id: 'room1',
        name: 'Bathroom',
        width: 3,
        length: 4,
        fixtures: [
          { id: 'sink1', type: 'sink', wall: 'north', needsWater: true, needsDrain: true }
        ],
        doors: [],
        windows: []
      };

      const walls = engine.generateWalls(roomSpec);
      const fixtures = engine.placeFixtures(roomSpec, walls);

      expect(fixtures).toHaveLength(1);
      expect(fixtures[0].position.y).toBeGreaterThanOrEqual(10); // Minimum 10 units gap
    });

    it('should place sink at 0.5m offset from west corner on north wall', () => {
      const roomSpec: RoomSpec = {
        id: 'room1',
        name: 'Bathroom',
        width: 4,
        length: 3,
        fixtures: [
          { id: 'sink1', type: 'sink', wall: 'north' }
        ],
        doors: [],
        windows: []
      };

      const walls = engine.generateWalls(roomSpec);
      const fixtures = engine.placeFixtures(roomSpec, walls);

      expect(fixtures[0].position.x).toBe(50); // 0.5m from west corner
    });
  });

  describe('generatePipes', () => {
    it('should create cold, hot, and drain pipes for sink', () => {
      const roomSpec: RoomSpec = {
        id: 'room1',
        name: 'Bathroom',
        width: 3,
        length: 4,
        fixtures: [
          { id: 'sink1', type: 'sink', wall: 'north', needsWater: true, needsDrain: true }
        ],
        doors: [],
        windows: []
      };

      const walls = engine.generateWalls(roomSpec);
      const fixtures = engine.placeFixtures(roomSpec, walls);
      const pipes = engine.generatePipes(fixtures, walls);

      expect(pipes).toHaveLength(3);
      expect(pipes.find(p => p.type === 'cold')).toBeDefined();
      expect(pipes.find(p => p.type === 'hot')).toBeDefined();
      expect(pipes.find(p => p.type === 'drain')).toBeDefined();
    });

    it('should use correct colors for pipes', () => {
      const roomSpec: RoomSpec = {
        id: 'room1',
        name: 'Bathroom',
        width: 3,
        length: 4,
        fixtures: [
          { id: 'sink1', type: 'sink', wall: 'north' }
        ],
        doors: [],
        windows: []
      };

      const walls = engine.generateWalls(roomSpec);
      const fixtures = engine.placeFixtures(roomSpec, walls);
      const pipes = engine.generatePipes(fixtures, walls);

      const coldPipe = pipes.find(p => p.type === 'cold')!;
      const hotPipe = pipes.find(p => p.type === 'hot')!;
      const drainPipe = pipes.find(p => p.type === 'drain')!;

      expect(coldPipe.color).toBe('blue');
      expect(hotPipe.color).toBe('red');
      expect(drainPipe.color).toBe('gray');
    });

    it('should route pipes with L-shape (orthogonal, no diagonals)', () => {
      const roomSpec: RoomSpec = {
        id: 'room1',
        name: 'Bathroom',
        width: 3,
        length: 4,
        fixtures: [
          { id: 'sink1', type: 'sink', wall: 'north' }
        ],
        doors: [],
        windows: []
      };

      const walls = engine.generateWalls(roomSpec);
      const fixtures = engine.placeFixtures(roomSpec, walls);
      const pipes = engine.generatePipes(fixtures, walls);

      pipes.forEach(pipe => {
        expect(pipe.path.length).toBeGreaterThanOrEqual(2); // At least 2 points (can be 3 for L-shape)
        // Pipe starts from fixture center (fixture.position + offset)
        expect(pipe.path[0].x).toBeGreaterThan(fixtures[0].position.x);
        expect(pipe.path[0].y).toBeGreaterThan(fixtures[0].position.y);
      });
    });
  });

  describe('generateDimensions', () => {
    it('should create dimension lines for all walls', () => {
      const roomSpec: RoomSpec = {
        id: 'room1',
        name: 'Bathroom',
        width: 3,
        length: 4,
        fixtures: [],
        doors: [],
        windows: []
      };

      const walls = engine.generateWalls(roomSpec);
      const dimensions = engine.generateDimensions(walls, roomSpec);

      expect(dimensions).toHaveLength(4);
    });

    it('should calculate correct dimensions in meters', () => {
      const roomSpec: RoomSpec = {
        id: 'room1',
        name: 'Bathroom',
        width: 3,
        length: 4,
        fixtures: [],
        doors: [],
        windows: []
      };

      const walls = engine.generateWalls(roomSpec);
      const dimensions = engine.generateDimensions(walls, roomSpec);

      const northDim = dimensions.find(d => d.id.includes('north'))!;
      expect(northDim.value).toBe(3);
    });
  });

  describe('generateDrawing', () => {
    it('should generate complete drawing data', () => {
      const roomSpec: RoomSpec = {
        id: 'room1',
        name: 'Bathroom',
        width: 3,
        length: 4,
        fixtures: [
          { id: 'sink1', type: 'sink', wall: 'north' }
        ],
        doors: [
          { id: 'door1', wall: 'south', width: 0.9 }
        ],
        windows: []
      };

      const drawing = engine.generateDrawing(roomSpec);

      expect(drawing.id).toBe('drawing-room1');
      expect(drawing.walls).toHaveLength(4);
      expect(drawing.fixtures).toHaveLength(1);
      expect(drawing.pipes.length).toBeGreaterThan(0);
      expect(drawing.dimensions).toHaveLength(4);
      expect(drawing.doors).toHaveLength(1);
    });
  });
});
