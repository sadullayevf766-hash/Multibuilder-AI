DO NOT write new code yet. 

First, open terminal and run these grep commands:
Show me the EXACT output of each:

1. grep -n "width\|length\|dimension" server/src/ai/GeminiParser.ts
2. grep -n "width\|length\|SCALE\|scale" server/src/engine/FloorPlanEngine.ts | head -30
3. grep -rn "3\b\|4\b" server/src/engine/FloorPlanEngine.ts | grep -i "default\|fallback\|min\|max"

Then find hot water pipe creation:
4. grep -n "hot\|red\|ef4444\|issiq\|x1\|pipe" server/src/engine/FloorPlanEngine.ts | head -20

Paste ALL grep results here. I will tell you exactly what to change.