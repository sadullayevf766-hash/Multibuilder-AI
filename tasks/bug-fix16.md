STEP 1 — Add this log in GeminiParser.ts, 
right after receiving Gemini raw response:
  console.log('[GEMINI RAW]', JSON.stringify(geminiResponse, null, 2))

Run app with "8x5 metrli hojatxona", paste the full [GEMINI RAW] output here.

STEP 2 — While waiting, fix door frame:
In Canvas2D.tsx renderDoor(), find the east wall Rect component.
Add these props to it:
  clipX={roomW - WALL_T}
  clipY={dy}
  clipWidth={WALL_T + 2}
  clipHeight={doorWidth}

STEP 3 — Fix red pipe:
In FloorPlanEngine.ts createPipe(), 
paste the current endpoint logic block (lines after fixtureCenter is defined).