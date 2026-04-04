In GeminiParser.ts, find the API URL (line ~290-300).
Paste the exact URL being used.

Correct Gemini API URL format:
https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY

Common mistakes:
- /v1/ instead of /v1beta/  ← most common
- Wrong model name
- Key in header instead of query param

Run: grep -n "generativelanguage\|googleapis\|v1\|generateContent\|model" \
  server/src/ai/GeminiParser.ts | head -15

Paste output.