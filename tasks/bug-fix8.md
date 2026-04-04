Fix exactly these 3 lines. Nothing else.

FIX 1 — GeminiParser.ts line 139:
Change:
  dimensions: data.dimensions || { width: 3, length: 4 },

To:
  dimensions: data.dimensions ?? data.size ?? data.room_size ?? { 
    width: parseFloat(data.width) || parseFloat(data.room_width) || 3, 
    length: parseFloat(data.length) || parseFloat(data.room_length) || 4 
  },

Also add this log on line 140:
  console.log('[PARSER RAW] full Gemini response keys:', Object.keys(data));
  console.log('[PARSER RAW] dimensions raw:', data.dimensions, data.size, data.width, data.length);

FIX 2 — FloorPlanEngine.ts, inside createPipe():
Show me lines 145-180 exactly (copy paste them here).
I need to see how fixtureCenter is calculated before fixing.

FIX 3 — After fix 1, run the app and paste the 
2 new console.log lines output for input "8x5 hojatxona".