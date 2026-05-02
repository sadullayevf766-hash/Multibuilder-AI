/**
 * RoomLayoutEngine — places rooms on a floor with touching walls (no gaps).
 *
 * Layout strategy:
 *   ┌─────────────┬─────────────┐
 *   │  Row 0      │  Row 0      │  (living, kitchen, office — "public" zone)
 *   ├─────────────┴─────────────┤
 *   │       Corridor 1.2m       │
 *   ├─────────────┬─────────────┤
 *   │  Row 1      │  Row 1      │  (bedrooms, bathrooms — "private" zone)
 *   └─────────────┴─────────────┘
 *
 * Staircase is placed at the east end of the corridor.
 * All positions are in METERS from the floor NW corner.
 */

import type { RoomLayout, StaircaseSpec } from '../../../shared/types';
import {
  CORRIDOR_WIDTH_M,
  STAIRCASE_WIDTH_M,
  STAIRCASE_LENGTH_M,
  MAX_BUILDING_WIDTH_M,
} from '../../../shared/constants';

// ── Room type classification ──────────────────────────────────────────────────

type Zone = 'public' | 'private' | 'service' | 'circulation';

const ZONE_MAP: Record<string, Zone> = {
  living:     'public',
  mehmonxona: 'public',
  zal:        'public',
  kitchen:    'public',
  oshxona:    'public',
  dining:     'public',
  office:     'public',
  ofis:       'public',
  bedroom:    'private',
  yotoqxona:  'private',
  children:   'private',
  bolalar:    'private',
  bathroom:   'service',
  hammom:     'service',
  toilet:     'service',
  hojatxona:  'service',
  wc:         'service',
  hallway:    'circulation',
  koridor:    'circulation',
  entrance:   'circulation',
  kirish:     'circulation',
  storage:    'service',
  laundry:    'service',
};

function getZone(name: string): Zone {
  const n = name.toLowerCase();
  for (const [key, zone] of Object.entries(ZONE_MAP)) {
    if (n.includes(key)) return zone;
  }
  return 'private';
}

// ── Layout result ─────────────────────────────────────────────────────────────

export interface LayoutResult {
  rooms: RoomLayout[];          // rooms with positions set (meters)
  footprint: { width: number; length: number }; // total floor size
  corridorY: number;            // Y start of corridor (meters)
  corridorLength: number;       // corridor width (X dimension, meters)
  staircaseSpec: StaircaseSpec;
}

// ── Main layout function ──────────────────────────────────────────────────────

export function layoutRooms(rooms: RoomLayout[], floorNumber: number): LayoutResult {
  // 1. Classify rooms into zones
  const publicRooms    = rooms.filter(r => getZone(r.roomSpec.name) === 'public');
  const privateRooms   = rooms.filter(r => getZone(r.roomSpec.name) === 'private');
  const serviceRooms   = rooms.filter(r => getZone(r.roomSpec.name) === 'service');
  const circRooms      = rooms.filter(r => getZone(r.roomSpec.name) === 'circulation');

  // 2. Assign rows:
  //    Row 0 (top/north): public rooms + service rooms that attach to public
  //    Corridor: horizontal passage
  //    Row 1 (bottom/south): private rooms + remaining service
  const row0: RoomLayout[] = [...publicRooms, ...serviceRooms.slice(0, Math.ceil(serviceRooms.length / 2))];
  const row1: RoomLayout[] = [...privateRooms, ...serviceRooms.slice(Math.ceil(serviceRooms.length / 2))];

  // If no public rooms, put everything in one row
  if (row0.length === 0) {
    row1.unshift(...row0);
    row0.length = 0;
    row0.push(...rooms);
  }
  if (row1.length === 0 && row0.length > 0) {
    // single row — no corridor needed
    return layoutSingleRow(rooms, floorNumber);
  }

  // 3. Calculate row widths (pack left-to-right)
  const hasCorridor = row0.length > 0 && row1.length > 0;
  const corridorW = hasCorridor ? CORRIDOR_WIDTH_M : 0;

  // Determine target building width: max of row widths, capped
  const row0TotalW = row0.reduce((s, r) => s + r.roomSpec.width, 0);
  const row1TotalW = row1.reduce((s, r) => s + r.roomSpec.width, 0);
  const buildingWidth = Math.min(
    MAX_BUILDING_WIDTH_M,
    Math.max(row0TotalW, row1TotalW),
  );

  // 4. Place row 0 rooms (north zone) from y=0
  const row0MaxLen = placeRow(row0, 0, buildingWidth);

  // 5. Corridor y starts after row 0
  const corridorY = row0MaxLen;

  // 6. Place row 1 rooms after corridor
  const row1StartY = corridorY + corridorW;
  const row1MaxLen = hasCorridor
    ? placeRow(row1, row1StartY, buildingWidth)
    : 0;

  // 7. Circulation rooms: place inside corridor space (or merge into rows)
  for (const circ of circRooms) {
    // Corridor room itself: spans full width at corridor Y
    circ.position = { x: 0, y: corridorY };
    // Its length IS the corridor width — override if needed
    if (circ.roomSpec.length > corridorW + 0.1) {
      circ.roomSpec.length = corridorW;
    }
  }

  // 8. Total footprint
  const totalLength = hasCorridor
    ? row0MaxLen + corridorW + row1MaxLen
    : row0MaxLen;
  const footprint = { width: buildingWidth, length: totalLength };

  // 9. Staircase: east end of corridor (or east end of floor if no corridor)
  const stairX = Math.max(0, buildingWidth - STAIRCASE_WIDTH_M);
  const stairY = hasCorridor ? corridorY : totalLength - STAIRCASE_LENGTH_M;
  const staircaseSpec: StaircaseSpec = {
    position:    { x: stairX, y: stairY },
    width:       STAIRCASE_WIDTH_M,
    length:      hasCorridor ? corridorW : STAIRCASE_LENGTH_M,
    flightCount: floorNumber,
  };

  return { rooms, footprint, corridorY, corridorLength: buildingWidth, staircaseSpec };
}

/** Place rooms in a single horizontal row, return max length (Y depth) used */
function placeRow(rooms: RoomLayout[], startY: number, buildingWidth: number): number {
  let x = 0;
  let maxLen = 0;

  // Sort by width descending for better packing
  const sorted = [...rooms].sort((a, b) => b.roomSpec.width - a.roomSpec.width);

  // Simple left-to-right placement; wrap if exceeds buildingWidth
  let rowStartY = startY;
  let rowMaxLen = 0;

  for (const room of sorted) {
    if (x + room.roomSpec.width > buildingWidth + 0.05 && x > 0) {
      // wrap to next sub-row
      rowStartY += rowMaxLen;
      rowMaxLen = 0;
      x = 0;
    }
    room.position = { x, y: rowStartY };
    x += room.roomSpec.width;
    rowMaxLen = Math.max(rowMaxLen, room.roomSpec.length);
    maxLen = Math.max(maxLen, rowStartY - startY + room.roomSpec.length);
  }

  return maxLen > 0 ? maxLen : (rooms.length > 0 ? rooms[0].roomSpec.length : 0);
}

/** Layout for single-row floor (ground floor with no private zone, or top floor) */
function layoutSingleRow(rooms: RoomLayout[], floorNumber: number): LayoutResult {
  const buildingWidth = Math.min(
    MAX_BUILDING_WIDTH_M,
    rooms.reduce((s, r) => s + r.roomSpec.width, 0),
  );
  const maxLen = placeRow(rooms, 0, buildingWidth);
  const footprint = { width: buildingWidth, length: maxLen };
  const stairX = Math.max(0, buildingWidth - STAIRCASE_WIDTH_M);
  const staircaseSpec: StaircaseSpec = {
    position:    { x: stairX, y: 0 },
    width:       STAIRCASE_WIDTH_M,
    length:      Math.min(STAIRCASE_LENGTH_M, maxLen),
    flightCount: floorNumber,
  };
  return { rooms, footprint, corridorY: maxLen / 2, corridorLength: buildingWidth, staircaseSpec };
}

// ── Footprint enforcement ─────────────────────────────────────────────────────

/**
 * Ensure all floors have the same building footprint (largest floor wins).
 * Rooms that don't fill the full width get padding on the right side.
 */
export function normalizeFootprints(
  layoutResults: LayoutResult[],
): { width: number; length: number } {
  const width  = Math.max(...layoutResults.map(r => r.footprint.width));
  const length = Math.max(...layoutResults.map(r => r.footprint.length));
  // Update staircase positions to use the normalized width
  for (const lr of layoutResults) {
    lr.footprint.width  = width;
    lr.footprint.length = length;
    lr.staircaseSpec.position.x = Math.max(0, width - STAIRCASE_WIDTH_M);
  }
  return { width, length };
}
