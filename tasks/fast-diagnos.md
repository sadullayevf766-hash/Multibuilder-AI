STEP 1 — Show parsed JSON:
In GeminiParser.ts, add this log right before return:
  console.log('[PARSER OUTPUT]', JSON.stringify(result, null, 2))

Run app with "8x5 metrli oshxona, shimolda gaz plita va sink,
g'arbda muzlatgich, janubda eshik"

Paste the full [PARSER OUTPUT] log.

STEP 2 — Show fixture rendering code:
grep -n "stove\|fridge\|kitchen\|renderFixture\|fixture.type" \
  client/src/components/Canvas2D.tsx | head -20

These two outputs will show exactly what's missing.
Do not fix anything yet.