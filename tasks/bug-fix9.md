The problem is in the Gemini system prompt, not the parser.

STEP 1 — Find the system prompt:
grep -rn "3x4\|default.*3\|default.*4\|If dimensions missing" server/src/

Show me the file path and the exact lines found.

STEP 2 — In that system prompt file, find and change:

WRONG (current):
  "If dimensions missing: use 3x4 meters"
  or any line with default 3x4 or width: 3, length: 4

CORRECT — replace with:
  "dimensions field is REQUIRED. 
   Extract EXACT numbers from user input.
   If user says '8x5', return: dimensions: { width: 8, length: 5 }
   If user says '6 metr kenglik 4 metr uzunlik', return: { width: 6, length: 4 }
   NEVER default to 3x4. If truly missing, ask is impossible — use the 
   largest numbers mentioned by user."

STEP 3 — In GeminiParser.ts, find the fallback on line 139:
Change default from { width: 3, length: 4 } to { width: 0, length: 0 }
Then add validation after parsing:
  if (result.width === 0 || result.length === 0) {
    throw new Error('Xona o\'lchamlari aniqlanmadi. Iltimos qayta kiriting.')
  }

STEP 4 — Test: generate "8x5 metrli hojatxona"
Expected log: [PARSER] dimensions: 8 5
If still 3x4, show me the exact system prompt file content.