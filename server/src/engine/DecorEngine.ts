import type {
  DecorSchema, DecorFurniture, DecorMaterial, DecorOpening,
  FurnitureType, DecorStyle, RoomCategory,
} from '../../../shared/types';

// ── Furniture height lookup ────────────────────────────────────────────────────
const FURNITURE_H: Record<FurnitureType, number> = {
  sofa:            0.85, armchair:        0.85, coffee_table:    0.42,
  tv_stand:        0.55, bookshelf:       1.90,
  dining_table:    0.76, dining_chair:    0.92, kitchen_counter: 0.90,
  refrigerator:    1.80, stove:           0.90, sink_kitchen:    0.90,
  bed_single:      0.55, bed_double:      0.55, wardrobe:        2.10,
  nightstand:      0.60, dresser:         0.80,
  bathtub:         0.60, shower_cabin:    2.00, toilet:          0.80, vanity: 0.85,
  desk:            0.76, office_chair:    1.10, bookcase:        1.90, filing_cabinet: 0.72,
  rug:             0.01, plant:           1.20, lamp_floor:      1.60,
};

// ── Color palettes per style ──────────────────────────────────────────────────
const STYLE_PALETTE: Record<DecorStyle, DecorMaterial> = {
  modern: {
    floorType: 'parquet', floorColor: '#3D2B1F',
    wallColor: '#F2F2F2', accentWall: 'north', accentColor: '#1E293B',
    ceilingColor: '#FFFFFF',
  },
  classic: {
    floorType: 'parquet', floorColor: '#8B6914',
    wallColor: '#F0E6D3', accentWall: 'north', accentColor: '#7C5C2A',
    ceilingColor: '#FFFDF8',
  },
  minimalist: {
    floorType: 'laminate', floorColor: '#C8A882',
    wallColor: '#FAFAFA', accentWall: null, accentColor: '#FAFAFA',
    ceilingColor: '#FFFFFF',
  },
  scandinavian: {
    floorType: 'parquet', floorColor: '#C09B6F',
    wallColor: '#F8F9FA', accentWall: 'north', accentColor: '#4A90D9',
    ceilingColor: '#FFFFFF',
  },
  industrial: {
    floorType: 'tile', floorColor: '#2C2925',
    wallColor: '#78716C', accentWall: 'east', accentColor: '#44403C',
    ceilingColor: '#3C3836',
  },
};

// ── Furniture colors per style ─────────────────────────────────────────────────
const FURNITURE_COLORS: Record<DecorStyle, Partial<Record<FurnitureType, string>>> = {
  modern: {
    sofa: '#37474F', armchair: '#455A64', coffee_table: '#263238',
    tv_stand: '#1C2526', bookshelf: '#37474F',
    bed_double: '#ECEFF1', bed_single: '#ECEFF1', wardrobe: '#263238',
    nightstand: '#37474F', dresser: '#37474F',
    dining_table: '#263238', dining_chair: '#607D8B',
    kitchen_counter: '#E0E0E0', refrigerator: '#BDBDBD', stove: '#424242',
    desk: '#455A64', office_chair: '#212121', bookcase: '#37474F',
    bathtub: '#ECEFF1', toilet: '#F5F5F5', vanity: '#ECEFF1', shower_cabin: '#B0BEC5',
    rug: '#546E7A', plant: '#2E7D32', lamp_floor: '#FFA726',
  },
  classic: {
    sofa: '#8D6E63', armchair: '#795548', coffee_table: '#5D4037',
    tv_stand: '#6D4C41', bookshelf: '#4E342E',
    bed_double: '#D7CCC8', bed_single: '#D7CCC8', wardrobe: '#5D4037',
    nightstand: '#6D4C41', dresser: '#6D4C41',
    dining_table: '#5D4037', dining_chair: '#795548',
    kitchen_counter: '#D7CCC8', refrigerator: '#EFEBE9', stove: '#5D4037',
    desk: '#6D4C41', office_chair: '#4E342E', bookcase: '#4E342E',
    bathtub: '#EFEBE9', toilet: '#FFF8E1', vanity: '#EFEBE9', shower_cabin: '#D7CCC8',
    rug: '#A1887F', plant: '#388E3C', lamp_floor: '#FFD54F',
  },
  minimalist: {
    sofa: '#E8E8E8', armchair: '#EEEEEE', coffee_table: '#E0E0E0',
    tv_stand: '#BDBDBD', bookshelf: '#BDBDBD',
    bed_double: '#F5F5F5', bed_single: '#F5F5F5', wardrobe: '#E0E0E0',
    nightstand: '#EEEEEE', dresser: '#E8E8E8',
    dining_table: '#E8E8E8', dining_chair: '#F5F5F5',
    kitchen_counter: '#E8E8E8', refrigerator: '#F5F5F5', stove: '#BDBDBD',
    desk: '#E8E8E8', office_chair: '#9E9E9E', bookcase: '#E0E0E0',
    bathtub: '#FAFAFA', toilet: '#FAFAFA', vanity: '#F5F5F5', shower_cabin: '#E8E8E8',
    rug: '#BDBDBD', plant: '#66BB6A', lamp_floor: '#FFF176',
  },
  scandinavian: {
    sofa: '#4A90D9', armchair: '#7CB9E8', coffee_table: '#8D6E63',
    tv_stand: '#EFEBE9', bookshelf: '#8D6E63',
    bed_double: '#F5F5F5', bed_single: '#F5F5F5', wardrobe: '#EFEBE9',
    nightstand: '#8D6E63', dresser: '#EFEBE9',
    dining_table: '#EFEBE9', dining_chair: '#4A90D9',
    kitchen_counter: '#F5F5F5', refrigerator: '#F5F5F5', stove: '#EFEBE9',
    desk: '#EFEBE9', office_chair: '#4A90D9', bookcase: '#8D6E63',
    bathtub: '#F5F5F5', toilet: '#FAFAFA', vanity: '#F5F5F5', shower_cabin: '#E3F2FD',
    rug: '#90CAF9', plant: '#81C784', lamp_floor: '#FFF9C4',
  },
  industrial: {
    sofa: '#44403C', armchair: '#57534E', coffee_table: '#292524',
    tv_stand: '#1C1917', bookshelf: '#292524',
    bed_double: '#57534E', bed_single: '#57534E', wardrobe: '#1C1917',
    nightstand: '#44403C', dresser: '#44403C',
    dining_table: '#1C1917', dining_chair: '#44403C',
    kitchen_counter: '#78716C', refrigerator: '#44403C', stove: '#292524',
    desk: '#44403C', office_chair: '#1C1917', bookcase: '#292524',
    bathtub: '#44403C', toilet: '#78716C', vanity: '#57534E', shower_cabin: '#3C3836',
    rug: '#57534E', plant: '#4CAF50', lamp_floor: '#FF8F00',
  },
};

function furColor(type: FurnitureType, style: DecorStyle): string {
  return FURNITURE_COLORS[style][type] ?? '#90A4AE';
}

function fur(
  id: string, type: FurnitureType, label: string,
  x: number, y: number, w: number, d: number,
  style: DecorStyle,
  material: DecorFurniture['material'] = 'wood',
): DecorFurniture {
  return {
    id, type, label,
    position: { x, y },
    size: { w, d },
    height: FURNITURE_H[type] ?? 0.80,
    color: furColor(type, style),
    material,
  };
}

// ── Room furniture presets ─────────────────────────────────────────────────────
// All positions/sizes in meters. Room origin = SW corner. X=east, Y=north.

function bedroomFurniture(W: number, L: number, style: DecorStyle): DecorFurniture[] {
  const bedW = Math.min(1.80, W * 0.42);
  const bedBx = (W - bedW) / 2;
  return [
    fur('bed', 'bed_double', 'Karavot', bedBx, L - 2.05, bedW, 2.00, style, 'fabric'),
    fur('ns-l', 'nightstand', 'Yonboshliq', bedBx - 0.55, L - 1.90, 0.50, 0.40, style),
    fur('ns-r', 'nightstand', 'Yonboshliq', bedBx + bedW + 0.05, L - 1.90, 0.50, 0.40, style),
    fur('wardrobe', 'wardrobe', 'Shkaf', 0.10, 0.10, Math.min(1.80, W * 0.38), 0.62, style),
    fur('dresser', 'dresser', 'Komod', W - 1.10, 0.15, 1.00, 0.50, style),
    fur('rug', 'rug', "Ko'rpacha", bedBx - 0.15, L - 2.90, bedW + 0.30, 1.50, style, 'fabric'),
  ];
}

function livingFurniture(W: number, L: number, style: DecorStyle): DecorFurniture[] {
  const sofaW = Math.min(2.40, W * 0.46);
  const sofaBx = (W - sofaW) / 2;
  const tvW = Math.min(1.80, W * 0.36);
  const tvBx = (W - tvW) / 2;
  return [
    fur('sofa', 'sofa', 'Divan', sofaBx, 0.12, sofaW, 0.90, style, 'fabric'),
    fur('table', 'coffee_table', 'Jurnal stol', sofaBx + 0.25, 1.15, sofaW - 0.5, 0.60, style),
    fur('tv', 'tv_stand', 'TV stend', tvBx, L - 0.48, tvW, 0.40, style),
    fur('armchair', 'armchair', 'Kreslo', W - 1.00, 0.20, 0.82, 0.82, style, 'fabric'),
    fur('bookshelf', 'bookshelf', 'Kitob javon', W - 0.38, L * 0.45, 0.30, 1.20, style),
    fur('rug', 'rug', "Ko'rpacha", sofaBx - 0.10, 0.95, sofaW + 0.20, 1.70, style, 'fabric'),
    fur('plant', 'plant', "O'simlik", 0.10, L - 0.55, 0.40, 0.40, style),
  ];
}

function kitchenFurniture(W: number, L: number, style: DecorStyle): DecorFurniture[] {
  const counterD = 0.60;
  const tableW = Math.min(1.20, W * 0.42);
  const tableL = Math.min(0.80, L * 0.22);
  const tableBx = (W - tableW) / 2;
  const tableBY = L * 0.45;
  const items: DecorFurniture[] = [
    // South wall counter (full width)
    fur('counter-s', 'kitchen_counter', 'Ish stoli', 0.10, 0.10, W - 0.20, counterD, style),
    // East wall counter
    fur('counter-e', 'kitchen_counter', 'Javon', W - counterD, counterD + 0.20, counterD, L * 0.38, style),
    fur('fridge', 'refrigerator', 'Muzlatgich', W - 0.65, L - 0.70, 0.65, 0.65, style, 'metal'),
    fur('stove', 'stove', 'Plita', W * 0.35, 0.10, 0.60, counterD, style, 'metal'),
    fur('sink-k', 'sink_kitchen', 'Lavabo', 0.10, 0.10, 0.60, counterD, style, 'metal'),
    // Dining
    fur('dtable', 'dining_table', 'Ovqat stoli', tableBx, tableBY, tableW, tableL, style),
  ];
  // 4 chairs around table
  const chairSz = 0.42;
  items.push(fur('ch1', 'dining_chair', 'Stul', tableBx - chairSz - 0.05, tableBY + (tableL - chairSz) / 2, chairSz, chairSz, style, 'fabric'));
  items.push(fur('ch2', 'dining_chair', 'Stul', tableBx + tableW + 0.05, tableBY + (tableL - chairSz) / 2, chairSz, chairSz, style, 'fabric'));
  items.push(fur('ch3', 'dining_chair', 'Stul', tableBx + (tableW - chairSz) / 2, tableBY - chairSz - 0.05, chairSz, chairSz, style, 'fabric'));
  items.push(fur('ch4', 'dining_chair', 'Stul', tableBx + (tableW - chairSz) / 2, tableBY + tableL + 0.05, chairSz, chairSz, style, 'fabric'));
  return items;
}

function bathroomFurniture(W: number, L: number, style: DecorStyle): DecorFurniture[] {
  return [
    fur('tub', 'bathtub', 'Vanna', 0.10, L - 1.70 - 0.10, Math.min(0.80, W - 0.20), 1.70, style, 'ceramic'),
    fur('toilet', 'toilet', 'Unitaz', W - 0.70, 0.10, 0.40, 0.70, style, 'ceramic'),
    fur('vanity', 'vanity', ' Vannaxona stoli', 0.10, 0.10, Math.min(0.90, W - 0.30), 0.50, style, 'ceramic'),
  ];
}

function officeFurniture(W: number, L: number, style: DecorStyle): DecorFurniture[] {
  const deskW = Math.min(1.60, W * 0.52);
  return [
    fur('desk', 'desk', 'Ish stoli', 0.10, L - 0.75, deskW, 0.70, style),
    fur('chair', 'office_chair', 'Kreslo', 0.10 + deskW * 0.30, L - 1.50, 0.60, 0.65, style, 'leather'),
    fur('bookcase', 'bookcase', 'Kitob javon', W - 0.35, 0.10, 0.30, Math.min(1.40, L * 0.36), style),
    fur('filing', 'filing_cabinet', 'Seif', W - 0.55, L - 0.65, 0.45, 0.60, style, 'metal'),
    fur('plant', 'plant', "O'simlik", 0.10, 0.15, 0.40, 0.40, style),
    fur('lamp', 'lamp_floor', 'Chiroq', 0.10 + deskW + 0.15, L - 1.60, 0.35, 0.35, style, 'metal'),
  ];
}

// ── Opening presets ────────────────────────────────────────────────────────────

function defaultOpenings(roomCategory: RoomCategory, W: number, L: number): DecorOpening[] {
  const openings: DecorOpening[] = [];
  switch (roomCategory) {
    case 'living':
      openings.push({ id: 'door1', type: 'door',   wall: 'south', offset: 0.5,          width: 1.0, height: 2.1, sillHeight: 0, swingIn: true });
      openings.push({ id: 'win1',  type: 'window', wall: 'north', offset: W * 0.25,      width: 1.5, height: 1.4, sillHeight: 0.90, swingIn: false });
      openings.push({ id: 'win2',  type: 'window', wall: 'north', offset: W * 0.60,      width: 1.5, height: 1.4, sillHeight: 0.90, swingIn: false });
      break;
    case 'bedroom':
      openings.push({ id: 'door1', type: 'door',   wall: 'south', offset: W - 1.50,      width: 0.9, height: 2.1, sillHeight: 0, swingIn: true });
      openings.push({ id: 'win1',  type: 'window', wall: 'north', offset: (W - 1.40) / 2, width: 1.40, height: 1.2, sillHeight: 0.90, swingIn: false });
      break;
    case 'kitchen':
      openings.push({ id: 'door1', type: 'door',   wall: 'west',  offset: L - 1.20,      width: 0.9, height: 2.1, sillHeight: 0, swingIn: true });
      openings.push({ id: 'win1',  type: 'window', wall: 'north', offset: (W - 1.0) / 2,  width: 1.0, height: 0.9, sillHeight: 1.0, swingIn: false });
      break;
    case 'bathroom':
      openings.push({ id: 'door1', type: 'door',   wall: 'south', offset: W - 1.00,      width: 0.75, height: 2.1, sillHeight: 0, swingIn: true });
      openings.push({ id: 'win1',  type: 'window', wall: 'east',  offset: L * 0.60,       width: 0.50, height: 0.60, sillHeight: 1.5, swingIn: false });
      break;
    case 'office':
      openings.push({ id: 'door1', type: 'door',   wall: 'south', offset: 0.5,            width: 0.9, height: 2.1, sillHeight: 0, swingIn: true });
      openings.push({ id: 'win1',  type: 'window', wall: 'north', offset: (W - 1.20) / 2, width: 1.20, height: 1.2, sillHeight: 0.90, swingIn: false });
      openings.push({ id: 'win2',  type: 'window', wall: 'east',  offset: L * 0.50,        width: 0.80, height: 1.2, sillHeight: 0.90, swingIn: false });
      break;
  }
  return openings;
}

// ── Parser ─────────────────────────────────────────────────────────────────────

function parseDescription(description: string): {
  roomCategory: RoomCategory;
  style: DecorStyle;
  roomWidth: number;
  roomLength: number;
  roomName: string;
} {
  const t = description.toLowerCase();

  // Room category
  let roomCategory: RoomCategory = 'living';
  let roomName = 'Mehmonxona';
  if (/yotoq|bedroom|uxlash/.test(t))           { roomCategory = 'bedroom';  roomName = 'Yotoqxona'; }
  else if (/oshxona|kitchen|ovqat/.test(t))     { roomCategory = 'kitchen';  roomName = 'Oshxona'; }
  else if (/hammom|bathroom|vanna/.test(t))     { roomCategory = 'bathroom'; roomName = 'Hammom'; }
  else if (/kabinet|ofis|office|ish xon/.test(t))  { roomCategory = 'office';  roomName = 'Ish xonasi'; }
  else if (/mehmon|living|qabul/.test(t))       { roomCategory = 'living';   roomName = 'Mehmonxona'; }

  // Style
  let style: DecorStyle = 'modern';
  if (/klassik|classic/.test(t))                style = 'classic';
  else if (/minimalist/.test(t))                style = 'minimalist';
  else if (/skandinav|scand/.test(t))           style = 'scandinavian';
  else if (/industrial|sanoat/.test(t))         style = 'industrial';
  else if (/zamonaviy|modern/.test(t))          style = 'modern';

  // Room size
  let roomWidth = 5.0, roomLength = 4.0;
  if (roomCategory === 'bedroom')  { roomWidth = 4.0; roomLength = 5.0; }
  if (roomCategory === 'kitchen')  { roomWidth = 3.5; roomLength = 4.0; }
  if (roomCategory === 'bathroom') { roomWidth = 2.5; roomLength = 3.0; }
  if (roomCategory === 'office')   { roomWidth = 3.5; roomLength = 4.5; }

  const sizeMatch = t.match(/(\d+(?:[.,]\d)?)\s*[x×*]\s*(\d+(?:[.,]\d)?)/);
  if (sizeMatch) {
    const a = parseFloat(sizeMatch[1].replace(',', '.'));
    const b = parseFloat(sizeMatch[2].replace(',', '.'));
    if (a > 1 && b > 1 && a < 20 && b < 20) { roomWidth = a; roomLength = b; }
  }

  return { roomCategory, style, roomWidth, roomLength, roomName };
}

// ── Engine ─────────────────────────────────────────────────────────────────────

export class DecorEngine {
  generate(description: string): DecorSchema {
    const { roomCategory, style, roomWidth, roomLength, roomName } = parseDescription(description);

    const W = roomWidth, L = roomLength;
    let furniture: DecorFurniture[] = [];

    switch (roomCategory) {
      case 'bedroom':  furniture = bedroomFurniture(W, L, style);  break;
      case 'living':   furniture = livingFurniture(W, L, style);   break;
      case 'kitchen':  furniture = kitchenFurniture(W, L, style);  break;
      case 'bathroom': furniture = bathroomFurniture(W, L, style); break;
      case 'office':   furniture = officeFurniture(W, L, style);   break;
    }

    // Clamp furniture to room bounds
    furniture = furniture.map(f => ({
      ...f,
      position: {
        x: Math.max(0.05, Math.min(W - f.size.w - 0.05, f.position.x)),
        y: Math.max(0.05, Math.min(L - f.size.d - 0.05, f.position.y)),
      },
    }));

    return {
      id: `decor-${Date.now()}`,
      drawingType: 'decor',
      roomName,
      roomCategory,
      style,
      roomWidth: W,
      roomLength: L,
      roomHeight: 2.70,
      furniture,
      material: STYLE_PALETTE[style],
      openings: defaultOpenings(roomCategory, W, L),
    };
  }
}
