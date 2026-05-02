import type {
  MegaProjectSpec, MegaPlanResult, MegaEditResult, MegaDiscipline, MegaChatMessage,
} from '../../../shared/mega-types';
import {
  MEGA_PLANNER_SYSTEM_PROMPT, MEGA_EDITOR_SYSTEM_PROMPT,
} from './prompts/mega-planner.prompt';

// ── JSON extraction helpers ────────────────────────────────────────────────────

function extractSpecJson(text: string): MegaProjectSpec | null {
  const m = text.match(/###SPEC_JSON_START###\s*([\s\S]*?)\s*###SPEC_JSON_END###/);
  if (!m) return null;
  try { return JSON.parse(m[1]) as MegaProjectSpec; } catch { return null; }
}

function extractEditJson(text: string): Omit<MegaEditResult, 'reply'> | null {
  const m = text.match(/###EDIT_JSON_START###\s*([\s\S]*?)\s*###EDIT_JSON_END###/);
  if (!m) return null;
  try { return JSON.parse(m[1]) as Omit<MegaEditResult, 'reply'>; } catch { return null; }
}

function cleanReply(text: string): string {
  return text
    .replace(/###SPEC_JSON_START###[\s\S]*?###SPEC_JSON_END###/g, '')
    .replace(/###EDIT_JSON_START###[\s\S]*?###EDIT_JSON_END###/g, '')
    .trim();
}

// ── Gemini REST API fetch ──────────────────────────────────────────────────────
async function callGeminiRest(
  apiKey: string,
  systemPrompt: string,
  history: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }>,
  userMessage: string,
  timeoutMs = 30000,
): Promise<string> {
  const model = 'gemini-2.5-flash-preview-04-17';
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = [
    ...history,
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${res.statusText}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── Local fallback spec parser ────────────────────────────────────────────────

function localParseSpec(description: string): MegaProjectSpec {
  const text = description.toLowerCase();

  const floorMatch = description.match(/(\d+)\s*(?:qavat|этаж(?:а|ей)?|floor|kat)/i);
  const floorCount = floorMatch ? parseInt(floorMatch[1]) : 1;

  // Maydon regex — m², м², m2, м2, кв.м, sq.m
  const AREA_RX = /(\d+(?:[.,]\d+)?)\s*(?:m[²2²]|м[²2²]|кв\.?\s*м|sq\.?\s*m)/gi;
  // Avval "jami/umumiy/общий/total/итого" bilan birga kelgan sonni qidirish
  const totalAreaMatch = description.match(
    /(?:jami|umumiy|общий|total|итого|всего)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(?:m[²2²]|м[²2²]|кв\.?\s*м)/i
  );
  // Barcha maydon raqamlarini topib, eng kattasini olish
  const allAreaMatches = [...description.matchAll(AREA_RX)];
  const areas = allAreaMatches.map(m => parseFloat(m[1].replace(',', '.')));
  const maxArea = areas.length > 0 ? Math.max(...areas) : 0;
  const totalAreaM2 = totalAreaMatch
    ? parseFloat(totalAreaMatch[1].replace(',', '.'))
    : maxArea > 0 ? maxArea : floorCount * 120;
  const perFloor = Math.round(totalAreaM2 / floorCount);

  const disciplines: MegaDiscipline[] = [];
  if (/issiq pol|теплый пол|warm.?floor|теплые пол/i.test(text))           disciplines.push('warm-floor');
  if (/suv ta'?min|водоснабж|water.?supply|водопровод/i.test(text))        disciplines.push('water-supply');
  if (/kanalizatsiya|канализация|sewage|водоотведени/i.test(text))          disciplines.push('sewage');
  if (/yomg'?ir|ливневка|storm.?drain|дождев/i.test(text))                 disciplines.push('storm-drain');
  if (/qozonxona|котельная|boiler|тепловой насос/i.test(text))              disciplines.push('boiler-room');
  if (/elektr|электр|electr|освещени|проводк/i.test(text))                 disciplines.push('electrical');
  if (/xona reja|планировка|floor.?plan/i.test(text))                       disciplines.push('floor-plan');
  if (/arxitektura|архитектур|architect/i.test(text))                        disciplines.push('architecture');
  if (/fasad|фасад|facade|exterior|tashqi|экстерьер/i.test(text))           disciplines.push('facade');
  if (/santexnika|сантехника|plumbing/i.test(text))                         disciplines.push('plumbing');
  if (/interer|дизайн|interior|decor/i.test(text))                          disciplines.push('decor');
  // "barcha" / "все" / "all" kalit so'zi — asosiy 4 ta soha
  if (disciplines.length === 0 || /barcha.?muhand|все.?инжен|all.?engine/i.test(text)) {
    if (!disciplines.includes('water-supply')) disciplines.push('water-supply');
    if (!disciplines.includes('sewage'))       disciplines.push('sewage');
    if (!disciplines.includes('electrical'))   disciplines.push('electrical');
    if (!disciplines.includes('floor-plan'))   disciplines.push('floor-plan');
  }

  const hasWarmFloor  = /issiq pol|теплый пол/.test(text);
  const hasWarmWall   = /issiq devor|теплые стены/.test(text);
  const hasHvs        = !/no.?hvs|без.?гвс/.test(text);
  const roofMatch2    = description.match(/tom\s+(\d+)\s*m/i);
  const roofAreaM2    = roofMatch2 ? parseInt(roofMatch2[1]) : Math.round(totalAreaM2 / floorCount);
  const balcMatch     = description.match(/(\d+)\s*(?:ta\s+)?balkon/i);
  const balconyAreaM2 = balcMatch ? parseInt(balcMatch[1]) * 12 : 0;

  return {
    floorCount, totalAreaM2, floorAreas: Array(floorCount).fill(perFloor),
    buildingDescription: description, disciplines,
    hasWarmFloor, hasWarmWall, hasHvs, roofAreaM2, balconyAreaM2,
    style: 'modern', language: 'uz', notes: '',
  };
}

// ── Description builder: spec → per-discipline description ───────────────────

export function buildDescription(spec: MegaProjectSpec, discipline: MegaDiscipline): string {
  const { floorCount, floorAreas, totalAreaM2, buildingDescription } = spec;
  const floorStr = floorAreas.map((a, i) => `${i + 1}-qavat ${a}m²`).join(', ');
  const base = `${floorCount} qavatli bino: ${floorStr}. ${buildingDescription}`;

  switch (discipline) {
    case 'warm-floor':
      return `${base}${spec.hasWarmWall ? ', issiq devorlar ham bilan' : ''}`;
    case 'storm-drain':
      return `Tom ${spec.roofAreaM2}m², balkoni ${spec.balconyAreaM2}m². ${base}`;
    case 'boiler-room':
      return `${floorCount} qavatli uy, jami ${totalAreaM2}m²${spec.hasWarmFloor ? ', issiq pol tizimi bilan' : ''}${spec.hasHvs ? '' : ', GVS siz'}.`;
    case 'facade':
      return `${spec.style || 'modern'} uslubdagi ${floorCount} qavatli bino, ${totalAreaM2}m². ${buildingDescription}`;
    default:
      return base;
  }
}

// ── MegaPlannerParser ─────────────────────────────────────────────────────────

export class MegaPlannerParser {
  constructor(private apiKey: string) {}

  async chat(history: MegaChatMessage[], userMessage: string): Promise<MegaPlanResult> {
    if (this.apiKey) {
      try {
        const geminiHistory = history.map(m => ({
          role:  m.role === 'user' ? 'user' as const : 'model' as const,
          parts: [{ text: m.content }] as [{ text: string }],
        }));
        const rawText = await callGeminiRest(this.apiKey, MEGA_PLANNER_SYSTEM_PROMPT, geminiHistory, userMessage);
        const spec    = extractSpecJson(rawText);
        return { reply: cleanReply(rawText), isComplete: spec !== null, spec };
      } catch (err) {
        console.error('[MegaPlanner] Gemini error:', (err as Error).message);
      }
    }

    // Local fallback — barcha kontekstni birlashtirish
    const allText = [...history.map(m => m.content), userMessage].join(' ');
    const spec    = localParseSpec(allText);

    // Agar bitta xabarda yetarli ma'lumot bo'lsa — darhol spec qaytarish
    const hasFloors = /\d+\s*(?:qavat|этаж|этажа|этажей|floor|kat)/i.test(allText);
    const hasArea   = /\d+\s*(?:m[²2²]|кв\.?\s*м|м2|m2|sq\.?\s*m)/i.test(allText);
    const hasDisc   = spec.disciplines.length > 0;

    if (hasFloors && hasArea && hasDisc) {
      return {
        reply: `Ajoyib! ✅ ${spec.floorCount} qavatli, ${spec.totalAreaM2}m² bino uchun ${spec.disciplines.length} ta soha bo'yicha chizma tayyorlayman!\n\n` +
               spec.disciplines.map(d => `• ${d}`).join('\n'),
        isComplete: true, spec,
      };
    }

    // Agar faqat qavatlar va maydon bo'lsa, sohalar so'rash
    if (hasFloors && hasArea && !hasDisc) {
      return {
        reply: 'Qaysi muhandislik sohalari bo\'yicha chizma kerak? Keraklilarini ayting:\n\n📐 Xona rejasi · 🏛️ Arxitektura · ⚡ Elektr\n💧 Suv ta\'minoti · 🚽 Kanalizatsiya · 🌧️ Yomg\'ir suvi\n♨️ Issiq pol · 🔥 Qozonxona · 🛋️ Interer dizayn',
        isComplete: false, spec: null,
      };
    }

    // Agar faqat qavatlar bo'lsa, maydon so'rash
    if (hasFloors && !hasArea) {
      return {
        reply: `${spec.floorCount} qavat — ajoyib! Har bir qavatning taxminiy maydoni (m²) qancha?`,
        isComplete: false, spec: null,
      };
    }

    // Boshlang'ich savol
    return {
      reply: 'Salom! 🏗️ Loyihangizni rejalashtirish uchun bir nechta savol.\n\nBinoda nechta qavat bo\'ladi?',
      isComplete: false, spec: null,
    };
  }

  async classifyEdit(
    editHistory: MegaChatMessage[],
    userMessage: string,
    spec: MegaProjectSpec,
  ): Promise<MegaEditResult> {
    if (this.apiKey) {
      try {
        const context = `Mavjud loyiha: ${spec.floorCount} qavat, ${spec.totalAreaM2}m², sohalar: ${spec.disciplines.join(', ')}`;
        const geminiHistory: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [
          { role: 'user',  parts: [{ text: context }] },
          { role: 'model', parts: [{ text: 'Tushunarli, qanday o\'zgartirish kerak?' }] },
          ...editHistory.map(m => ({
            role:  (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
            parts: [{ text: m.content }] as [{ text: string }],
          })),
        ];
        const rawText = await callGeminiRest(this.apiKey, MEGA_EDITOR_SYSTEM_PROMPT, geminiHistory, userMessage);
        const parsed  = extractEditJson(rawText);
        const reply   = cleanReply(rawText) || 'O\'zgartirishni amalga oshiraman...';
        if (parsed) return { reply, targets: parsed.targets as MegaDiscipline[], specPatch: parsed.specPatch };
      } catch (err) {
        console.error('[MegaEditor] Gemini error:', (err as Error).message);
      }
    }

    // Local fallback
    const text = userMessage.toLowerCase();
    const targets: MegaDiscipline[] = [];
    const map: [RegExp, MegaDiscipline][] = [
      [/issiq pol|warm.?floor/, 'warm-floor'],
      [/suv ta'?min|water.?supply/, 'water-supply'],
      [/kanalizatsiya|sewage/, 'sewage'],
      [/yomg'?ir|storm/, 'storm-drain'],
      [/qozonxona|boiler/, 'boiler-room'],
      [/elektr|electr/, 'electrical'],
      [/xona reja|floor.?plan/, 'floor-plan'],
      [/arxitektura|architect/, 'architecture'],
      [/santexnika|plumbing/, 'plumbing'],
      [/interer|decor/, 'decor'],
    ];
    for (const [rx, d] of map) { if (rx.test(text) && spec.disciplines.includes(d)) targets.push(d); }
    const isGlobal = /hammasi|все|all|qayta gen|regenerat/.test(text);
    const final = isGlobal ? [...spec.disciplines] : (targets.length ? targets : [...spec.disciplines]);
    return { reply: `Tushunarli! ${final.join(', ')} qayta generatsiya qilaman...`, targets: final, specPatch: {} };
  }
}
