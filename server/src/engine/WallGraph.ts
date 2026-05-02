/**
 * WallGraph — shared wall detection and merging for multi-room floor plans.
 *
 * Problem: when two rooms share a boundary, each room independently generates
 * a wall on that boundary → two overlapping walls. This module merges them into
 * one authoritative wall and tracks which rooms own each face.
 *
 * Coordinate system: 1 unit = 1 cm, origin = floor NW corner.
 * All walls are axis-aligned (horizontal or vertical).
 */

import type { Wall, Point, InterRoomDoor, RoomLayout } from '../../../shared/types';
import { WALL_THICKNESS, UNITS_PER_METER } from '../../../shared/constants';

const TOL = 2; // units — snapping tolerance (2 cm)

// ── Segment helpers ───────────────────────────────────────────────────────────

/** True if two numbers are within TOL of each other */
const near = (a: number, b: number) => Math.abs(a - b) <= TOL;

/** Snap a value to the nearest grid point (avoids float drift) */
const snap = (v: number) => Math.round(v);

interface Seg {
  min: number;
  max: number;
  axis: number; // the fixed coordinate (y for H walls, x for V walls)
  isH: boolean; // true = horizontal (y constant), false = vertical (x constant)
}

function wallToSeg(wall: Wall): Seg {
  const isH = near(wall.start.y, wall.end.y);
  if (isH) {
    return {
      isH: true,
      axis: snap((wall.start.y + wall.end.y) / 2),
      min:  snap(Math.min(wall.start.x, wall.end.x)),
      max:  snap(Math.max(wall.start.x, wall.end.x)),
    };
  } else {
    return {
      isH: false,
      axis: snap((wall.start.x + wall.end.x) / 2),
      min:  snap(Math.min(wall.start.y, wall.end.y)),
      max:  snap(Math.max(wall.start.y, wall.end.y)),
    };
  }
}

function segsOverlap(a: Seg, b: Seg): boolean {
  if (a.isH !== b.isH) return false;
  if (!near(a.axis, b.axis)) return false;
  // ranges must overlap or touch
  return a.min <= b.max + TOL && b.min <= a.max + TOL;
}

function mergeSeg(a: Seg, b: Seg): Seg {
  return { isH: a.isH, axis: a.axis, min: Math.min(a.min, b.min), max: Math.max(a.max, b.max) };
}

function segToWall(seg: Seg, id: string, thickness: number): Wall {
  if (seg.isH) {
    return {
      id,
      start: { x: seg.min, y: seg.axis },
      end:   { x: seg.max, y: seg.axis },
      thickness,
      side: 'north', // re-assigned by caller based on context
    };
  } else {
    return {
      id,
      start: { x: seg.axis, y: seg.min },
      end:   { x: seg.axis, y: seg.max },
      thickness,
      side: 'west',  // re-assigned by caller based on context
    };
  }
}

// ── Wall ownership tracking ───────────────────────────────────────────────────

export interface WallFace {
  wallId: string;
  roomId: string;
  side: Wall['side'];
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface WallGraphResult {
  walls: Wall[];          // merged, deduplicated walls
  faces: WallFace[];      // which room owns which side of each wall
}

/**
 * Given all walls from all rooms (already offset to floor coords),
 * merge overlapping collinear walls into single walls and return
 * ownership info for door placement.
 */
export function buildWallGraph(
  wallsWithRoomId: Array<Wall & { roomId: string }>,
): WallGraphResult {
  // Group by axis + orientation
  const segs: Array<{ seg: Seg; wall: Wall & { roomId: string } }> = wallsWithRoomId.map(w => ({
    seg:  wallToSeg(w),
    wall: w,
  }));

  // Union-find style merge: repeatedly merge overlapping segs
  const merged: Array<{ seg: Seg; walls: Array<Wall & { roomId: string }> }> = [];

  for (const item of segs) {
    let placed = false;
    for (const m of merged) {
      if (segsOverlap(m.seg, item.seg)) {
        m.seg = mergeSeg(m.seg, item.seg);
        m.walls.push(item.wall);
        placed = true;
        break;
      }
    }
    if (!placed) {
      merged.push({ seg: item.seg, walls: [item.wall] });
    }
  }

  // Second pass — re-merge any newly adjacent groups
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < merged.length; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        if (segsOverlap(merged[i].seg, merged[j].seg)) {
          merged[i].seg = mergeSeg(merged[i].seg, merged[j].seg);
          merged[i].walls.push(...merged[j].walls);
          merged.splice(j, 1);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  const walls: Wall[] = [];
  const faces: WallFace[] = [];

  for (let idx = 0; idx < merged.length; idx++) {
    const { seg, walls: srcWalls } = merged[idx];
    const rep = srcWalls[0]; // representative wall for side/thickness
    const wallId = `merged-${idx}`;

    // Determine dominant side: use the most common side among sources
    const sideCounts: Record<string, number> = {};
    for (const w of srcWalls) sideCounts[w.side] = (sideCounts[w.side] || 0) + 1;
    const side = Object.entries(sideCounts).sort((a, b) => b[1] - a[1])[0][0] as Wall['side'];

    const wall = segToWall(seg, wallId, rep.thickness ?? WALL_THICKNESS);
    wall.side = side;
    walls.push(wall);

    // Record each room's face
    const seen = new Set<string>();
    for (const w of srcWalls) {
      const key = `${w.roomId}-${w.side}`;
      if (!seen.has(key)) {
        faces.push({ wallId, roomId: w.roomId, side: w.side });
        seen.add(key);
      }
    }
  }

  return { walls, faces };
}

// ── Inter-room door placement ─────────────────────────────────────────────────

/**
 * Given merged walls and room connections, produce InterRoomDoor records
 * pointing at the correct merged wall.
 */
export function placeInterRoomDoors(
  connections: Array<{
    fromRoomId: string;
    toRoomId: string;
    wall: Wall['side'];
    offsetFromCorner: number; // meters
    width: number;            // meters
  }>,
  faces: WallFace[],
): InterRoomDoor[] {
  const doors: InterRoomDoor[] = [];

  for (let i = 0; i < connections.length; i++) {
    const conn = connections[i];

    // Find the shared wall: a wall that has a face for fromRoom on conn.wall side
    const face = faces.find(
      f => f.roomId === conn.fromRoomId && f.side === conn.wall,
    );
    if (!face) continue;

    doors.push({
      id: `ird-${i}`,
      wallId: face.wallId,
      offsetFromCorner: conn.offsetFromCorner,
      width: conn.width,
      fromRoomId: conn.fromRoomId,
      toRoomId:   conn.toRoomId,
    });
  }

  return doors;
}

// ── Shared wall detection (auto) ─────────────────────────────────────────────

/**
 * Auto-detect which rooms share a boundary and create connections.
 * Used when AI doesn't specify explicit connections — we infer from layout.
 */
export function detectSharedWalls(
  rooms: Array<RoomLayout & { roomId: string }>,
): Array<{ fromRoomId: string; toRoomId: string; wall: Wall['side']; offsetFromCorner: number; width: number }> {
  const connections: Array<{ fromRoomId: string; toRoomId: string; wall: Wall['side']; offsetFromCorner: number; width: number }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i];
      const b = rooms[j];
      const ax1 = a.position.x, ax2 = a.position.x + a.roomSpec.width;
      const ay1 = a.position.y, ay2 = a.position.y + a.roomSpec.length;
      const bx1 = b.position.x, bx2 = b.position.x + b.roomSpec.width;
      const by1 = b.position.y, by2 = b.position.y + b.roomSpec.length;

      const key = `${a.roomId}-${b.roomId}`;
      if (seen.has(key)) continue;

      // A's east wall touches B's west wall
      if (Math.abs(ax2 - bx1) < 0.05) {
        const overlapY1 = Math.max(ay1, by1);
        const overlapY2 = Math.min(ay2, by2);
        if (overlapY2 - overlapY1 > 0.3) { // at least 30cm overlap
          seen.add(key);
          const doorOffset = (overlapY2 - overlapY1) / 2 - 0.45 + overlapY1 - ay1;
          connections.push({
            fromRoomId: a.roomId, toRoomId: b.roomId,
            wall: 'east', offsetFromCorner: Math.max(0.1, doorOffset), width: 0.9,
          });
        }
      }
      // A's south wall touches B's north wall
      if (Math.abs(ay2 - by1) < 0.05) {
        const overlapX1 = Math.max(ax1, bx1);
        const overlapX2 = Math.min(ax2, bx2);
        if (overlapX2 - overlapX1 > 0.3) {
          seen.add(key);
          const doorOffset = (overlapX2 - overlapX1) / 2 - 0.45 + overlapX1 - ax1;
          connections.push({
            fromRoomId: a.roomId, toRoomId: b.roomId,
            wall: 'south', offsetFromCorner: Math.max(0.1, doorOffset), width: 0.9,
          });
        }
      }
    }
  }

  return connections;
}
