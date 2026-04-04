Test Gemini is actually being used (not demo):

Add this log in parseDescription():
  if (usingDemoMode) {
    console.log('[MODE] DEMO - Gemini failed, using hardcoded data')
  } else {
    console.log('[MODE] LIVE - Gemini responded:', 
      JSON.stringify(geminiResponse).slice(0, 100))
  }

Then test these 3 different prompts and check if output DIFFERS:
1. "3 xonali kvartira 80 kv.m"
2. "Kichik ofis, 2 ta xona"  
3. "Hammom va oshxona"

If all 3 return same rooms → demo mode hardcoded
If all 3 return different rooms → Gemini working

Show [MODE] log for each test.