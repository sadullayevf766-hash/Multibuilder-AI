Make the system work for ANY room type.

STEP 1 — Expand GeminiParser system prompt:

Add these fixture types to the JSON schema:
  Bathroom:  toilet, sink, bathtub, shower
  Kitchen:   stove, fridge, sink, dishwasher, kitchen_cabinet
  Office:    desk, chair, bookshelf, door, window
  Bedroom:   bed, wardrobe, desk, door, window
  Living:    sofa, tv_unit, coffee_table, door, window
  Apartment: (combination of above per room)

Update system prompt in GeminiParser.ts:

"You are an architectural drawing assistant.
Extract room information from user description.
Output ONLY this JSON:
{
  roomType: 'bathroom'|'kitchen'|'office'|'bedroom'|'living'|'apartment',
  dimensions: { width: number, length: number },
  fixtures: [
    {
      id: string,
      type: 'toilet'|'sink'|'bathtub'|'shower'|'stove'|'fridge'|
            'dishwasher'|'desk'|'bed'|'wardrobe'|'sofa'|'tv_unit',
      wall: 'north'|'south'|'east'|'west',
      offset: number (meters from west/north corner, default 0.5)
    }
  ],
  doors: [{ wall: 'south', position: 'center' }],
  windows: [{ wall: 'north', count: 1 }]
}

Rules:
- Extract EXACT dimensions from user text
- If fixture wall not mentioned, use smart defaults:
  toilet → south wall
  sink → north or east wall  
  stove → against any wall with 0.6m clearance
  fridge → corner placement
  bed → against longest wall opposite door
  sofa → facing largest wall
- NEVER output coordinates, only semantic placement"

STEP 2 — Expand FloorPlanEngine fixture sizes:

Add to fixture dimensions map:
  stove:      { width: 60, height: 60 }
  fridge:     { width: 60, height: 65 }
  dishwasher: { width: 60, height: 60 }
  desk:       { width: 120, height: 60 }
  bed_single: { width: 90, height: 200 }
  bed_double: { width: 160, height: 200 }
  wardrobe:   { width: 120, height: 60 }
  sofa:       { width: 200, height: 90 }
  tv_unit:    { width: 150, height: 45 }
  bookshelf:  { width: 80, height: 30 }

STEP 3 — Add fixture symbols in Canvas2D.tsx:

Create simple but recognizable symbols:

stove: rect + 4 circles (burners)
  <Rect w=60 h=60 fill=#f5f5f5 stroke=#1a1a1a/>
  <Circle r=8 at each corner offset 15px/>

fridge: rect + horizontal line at 1/3 height
  <Rect w=60 h=65/>
  <Line horizontal at y+20/>

desk: rect + thin rect (monitor)
  <Rect w=120 h=60/>
  <Rect w=40 h=5 at top center/>

bed: rect + small rect (pillow) + arc (headboard)
  <Rect w=160 h=200/>
  <Rect w=140 h=40 at top (pillow)/>
  <Line horizontal at y+45/>

sofa: rect + 3 small rects (cushions) + back rect
  <Rect w=200 h=90/>
  <Rect h=20 at top (back)/>
  3x <Rect w=60 h=60 side by side (cushions)/>

wardrobe: rect + vertical lines (doors)
  <Rect w=120 h=60/>
  <Line vertical at center/>

tv_unit: wide flat rect + small rect (TV)
  <Rect w=150 h=45/>
  <Rect w=80 h=5 centered above (TV screen)/>

STEP 4 — Test these prompts after implementation:
1. "3x4 metrli hojatxona, shimolda lavabo, janubda unitaz, 
    sharqda eshik"
2. "5x4 metrli oshxona, shimolda gaz plita va sink, 
    g'arbda muzlatgich, janubda eshik"  
3. "4x5 metrli yotoqxona, g'arbda ikki kishilik karavot,
    sharqda shkaf, janubda eshik va deraza"
4. "6x8 metrli ofis, 3 ta stol, kitob javoni, 
    janubda eshik, shimolda 2 ta deraza"

Each test: screenshot + show parsed JSON from GeminiParser.