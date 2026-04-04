THREE fixes.

FIX 1 — Gemini model name (CRITICAL):
In server/src/ai/GeminiParser.ts or gemini-direct.ts:
grep -n "model\|gemini" server/src/ai/GeminiParser.ts | head -10

Change model name to:
  'gemini-1.5-flash'  ← most stable
  or 'gemini-2.0-flash' ← if that fails

Also run: curl test to verify API key works:
  console.log('[GEMINI] Using model:', modelName)
  console.log('[GEMINI] API key prefix:', apiKey?.slice(0,8))

FIX 2 — Sofa symbol:
In Canvas2D.tsx, find sofa rendering.
Sofa must look like a sofa, not a wardrobe:

  // Sofa: wide rect (back) + 3 cushions side by side
  // Back rest: full width, 20% height
  <Rect x={x} y={y} width={w} height={h*0.2} 
        fill="#d0d0d0" stroke="#1a1a1a" strokeWidth={1.5}/>
  // 3 cushions below back rest:
  {[0,1,2].map(i => (
    <Rect x={x + i*(w/3)} y={y + h*0.2} 
          width={w/3 - 2} height={h*0.8}
          fill="#e8e8e8" stroke="#1a1a1a" strokeWidth={1}/>
  ))}
  // Armrests on sides:
  <Rect x={x} y={y+h*0.2} width={8} height={h*0.8} fill="#c0c0c0"/>
  <Rect x={x+w-8} y={y+h*0.2} width={8} height={h*0.8} fill="#c0c0c0"/>

FIX 3 — Room boundary overflow:
In placeFixture(), add stricter boundary check:
  const WALL_T = 15;
  const GAP = 8;
  
  // Hard limits — fixture MUST stay inside these:
  const minX = WALL_T + GAP;
  const minY = WALL_T + GAP;
  const maxX = roomWidth * UNITS_PER_METER - fixture.width - WALL_T - GAP;
  const maxY = roomLength * UNITS_PER_METER - fixture.height - WALL_T - GAP;
  
  // If room too small for fixture, scale down fixture:
  if (maxX < minX || maxY < minY) {
    fixture.width = Math.min(fixture.width, 
      roomWidth * UNITS_PER_METER - 2*(WALL_T + GAP));
    fixture.height = Math.min(fixture.height,
      roomLength * UNITS_PER_METER - 2*(WALL_T + GAP));
  }
  
  position.x = Math.max(minX, Math.min(position.x, maxX));
  position.y = Math.max(minY, Math.min(position.y, maxY));

Run npm test. Screenshot.