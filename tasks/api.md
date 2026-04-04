Gemini API returns "Too Many Requests" — free tier limit hit.

TWO options, implement both:

OPTION 1 — Add retry with exponential backoff:
In callGemini(), wrap fetch in retry logic:

async callGeminiWithRetry(prompt: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await this.callGemini(prompt);
      return result;
    } catch (err: any) {
      if (err.message?.includes('Too Many Requests') && i < retries - 1) {
        const delay = (i + 1) * 2000; // 2s, 4s, 6s
        console.log(`[GEMINI] Rate limited, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

OPTION 2 — Cache responses:
Add simple in-memory cache:

const cache = new Map<string, any>();

async parseDescription(description: string) {
  const cacheKey = description.toLowerCase().trim();
  if (cache.has(cacheKey)) {
    console.log('[GEMINI] Cache hit');
    return cache.get(cacheKey);
  }
  const result = await this.callGeminiWithRetry(description);
  cache.set(cacheKey, result);
  return result;
}