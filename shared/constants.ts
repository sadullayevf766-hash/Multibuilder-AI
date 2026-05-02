// Shared fixture dimensions — 1 unit = 1cm (100 units = 1m)
// Used by FloorPlanEngine (server) and Canvas2D (client) for placement + rendering.
// ALL locations MUST use this single source of truth.

export const FIXTURE_DIMS: Record<string, { w: number; h: number }> = {
  sink:          { w: 60,  h: 50  },
  toilet:        { w: 40,  h: 68  }, // tank(18)+gap(6)+bowl center@44+radiusY=22 → max 66 < 68 ✓
  bathtub:       { w: 70,  h: 170 },
  shower:        { w: 90,  h: 90  },
  stove:         { w: 60,  h: 60  },
  fridge:        { w: 60,  h: 65  },
  dishwasher:    { w: 60,  h: 60  },
  desk:          { w: 120, h: 60  },
  bed:           { w: 160, h: 200 },
  wardrobe:      { w: 120, h: 60  },
  sofa:          { w: 200, h: 90  },
  tv_unit:       { w: 150, h: 45  },
  bookshelf:     { w: 80,  h: 30  },
  armchair:      { w: 80,  h: 80  },
  coffee_table:  { w: 90,  h: 50  },
  dining_table:  { w: 120, h: 80  },
  chair:         { w: 50,  h: 50  },
  coat_rack:     { w: 60,  h: 30  },
};

// ── Drawing units ──────────────────────────────────────────────────────────────
export const UNITS_PER_METER = 100;   // 1 unit = 1 sm
export const WALL_THICKNESS  = 15;    // units (15 sm = 0.15 m)
export const FIXTURE_GAP     = 5;     // units — devor va jihoz orasidagi bo'shliq

// ── Building geometry ──────────────────────────────────────────────────────────
export const FLOOR_HEIGHT_M  = 3.0;   // metr — standart qavat balandligi
export const DOOR_HEIGHT_M   = 2.1;   // metr — eshik balandligi
export const WINDOW_SILL_M   = 0.9;   // metr — deraza tokchasi balandligi
export const WINDOW_HEIGHT_M = 1.2;   // metr — standart deraza balandligi

// ── Staircase defaults ─────────────────────────────────────────────────────────
export const STAIRCASE_WIDTH_M  = 1.2;  // metr
export const STAIRCASE_LENGTH_M = 2.4;  // metr

// ── Layout constraints ─────────────────────────────────────────────────────────
export const MAX_BUILDING_WIDTH_M = 15; // metr — avtomatik joylashda maksimal kenglik
export const CORRIDOR_WIDTH_M     = 1.2; // metr — koridor minimal kengligi
