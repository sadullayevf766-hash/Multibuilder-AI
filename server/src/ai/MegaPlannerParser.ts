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
  try {
    const spec = JSON.parse(m[1]) as MegaProjectSpec;
    // disciplinePrompts bo'sh bo'lsa default bo'sh ob'ekt
    if (!spec.disciplinePrompts) spec.disciplinePrompts = {};
    return spec;
  } catch { return null; }
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

// ── Gemini REST API fetch (model cascade on 404/429) ─────────────────────────
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];

async function callGeminiRest(
  apiKey: string,
  systemPrompt: string,
  history: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }>,
  userMessage: string,
  timeoutMs = 30000,
): Promise<string> {
  const contents = [
    ...history,
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  let lastErr: Error = new Error('No models available');

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 3000 },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 404 || res.status === 429) {
        // Try next model
        lastErr = new Error(`Gemini ${res.status} (${model})`);
        continue;
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${res.statusText}`);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (text) return text;
      lastErr = new Error(`Gemini empty response (${model})`);
    } catch (err) {
      clearTimeout(timer);
      lastErr = err as Error;
      if ((err as Error).name === 'AbortError') throw lastErr; // timeout — don't retry
    }
  }

  throw lastErr;
}

// ── Local fallback: spec + disciplinePrompts parser ───────────────────────────

function localParseSpec(description: string): MegaProjectSpec {
  const text = description.toLowerCase();

  const floorMatch = description.match(/(\d+)\s*(?:qavat|этаж(?:а|ей)?|floor|kat)/i);
  const floorCount = floorMatch ? parseInt(floorMatch[1]) : 1;

  const AREA_RX = /(\d+(?:[.,]\d+)?)\s*(?:m[²2²]|м[²2²]|кв\.?\s*м|sq\.?\s*m)/gi;
  const totalAreaMatch = description.match(
    /(?:jami|umumiy|общий|total|итого|всего)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(?:m[²2²]|м[²2²]|кв\.?\s*м)/i
  );
  const allAreaMatches = [...description.matchAll(AREA_RX)];
  const areas = allAreaMatches.map(m => parseFloat(m[1].replace(',', '.')));
  const maxArea = areas.length > 0 ? Math.max(...areas) : 0;
  const totalAreaM2 = totalAreaMatch
    ? parseFloat(totalAreaMatch[1].replace(',', '.'))
    : maxArea > 0 ? maxArea : floorCount * 120;
  const perFloor = Math.round(totalAreaM2 / floorCount);

  const disciplines: MegaDiscipline[] = [];
  if (/issiq pol|теплый пол|warm.?floor/i.test(text))             disciplines.push('warm-floor');
  if (/suv ta'?min|водоснабж|water.?supply/i.test(text))          disciplines.push('water-supply');
  if (/kanalizatsiya|канализация|sewage/i.test(text))             disciplines.push('sewage');
  if (/yomg'?ir|ливневка|storm.?drain/i.test(text))              disciplines.push('storm-drain');
  if (/qozonxona|котельная|boiler/i.test(text))                   disciplines.push('boiler-room');
  if (/elektr|электр|electr/i.test(text))                         disciplines.push('electrical');
  if (/xona reja|планировка|floor.?plan/i.test(text))             disciplines.push('floor-plan');
  if (/arxitektura|архитектур|architect/i.test(text))             disciplines.push('architecture');
  if (/fasad|фасад|facade|tashqi/i.test(text))                    disciplines.push('facade');
  if (/santexnika|сантехника|plumbing/i.test(text))               disciplines.push('plumbing');
  if (/interer|дизайн|interior|decor/i.test(text))                disciplines.push('decor');

  if (disciplines.length === 0 || /barcha.?muhand|все.?инжен|all.?engine/i.test(text)) {
    if (!disciplines.includes('water-supply')) disciplines.push('water-supply');
    if (!disciplines.includes('sewage'))       disciplines.push('sewage');
    if (!disciplines.includes('electrical'))   disciplines.push('electrical');
    if (!disciplines.includes('floor-plan'))   disciplines.push('floor-plan');
  }

  const hasWarmFloor  = disciplines.includes('warm-floor');
  const hasWarmWall   = /issiq devor|теплые стены/.test(text);
  const hasHvs        = !/no.?hvs|без.?гвс/.test(text);
  const roofMatch2    = description.match(/tom\s+(\d+)\s*m/i);
  const roofAreaM2    = roofMatch2 ? parseInt(roofMatch2[1]) : Math.round(totalAreaM2 / floorCount);
  const balcMatch     = description.match(/(\d+)\s*(?:ta\s+)?balkon/i);
  const balconyAreaM2 = balcMatch ? parseInt(balcMatch[1]) * 12 : 0;

  // Har modul uchun fallback natural tavsif yasash
  const floorStr = Array.from({ length: floorCount }, (_, i) => `${i + 1}-qavat ${perFloor}m²`).join('. ');
  const disciplinePrompts: Partial<Record<MegaDiscipline, string>> = {};

  for (const disc of disciplines) {
    disciplinePrompts[disc] = buildLocalPrompt(disc, {
      floorCount, perFloor, totalAreaM2,
      hasWarmFloor, hasWarmWall, hasHvs,
      roofAreaM2, balconyAreaM2,
      floorStr, description,
    });
  }

  return {
    floorCount, totalAreaM2, floorAreas: Array(floorCount).fill(perFloor),
    buildingDescription: description, disciplines, disciplinePrompts,
    hasWarmFloor, hasWarmWall, hasHvs, roofAreaM2, balconyAreaM2,
    style: 'modern', language: 'uz', notes: '',
  };
}

// ── Local fallback prompt builder per discipline ──────────────────────────────

interface LocalPromptCtx {
  floorCount: number; perFloor: number; totalAreaM2: number;
  hasWarmFloor: boolean; hasWarmWall: boolean; hasHvs: boolean;
  roofAreaM2: number; balconyAreaM2: number;
  floorStr: string; description: string;
}

function buildLocalPrompt(disc: MegaDiscipline, ctx: LocalPromptCtx): string {
  const { floorCount, perFloor, totalAreaM2, hasWarmFloor, hasHvs,
          roofAreaM2, balconyAreaM2, description } = ctx;

  // Xona qatorini quramiz: har qavat uchun taxminiy xonalar
  const roomsPerFloor = () => {
    const living  = Math.round(perFloor * 0.30);
    const kitchen = Math.round(perFloor * 0.15);
    const bath    = Math.round(perFloor * 0.08);
    const bed     = Math.round(perFloor * 0.20);
    return `mehmonxona ${living}m², oshxona ${kitchen}m², hammom ${bath}m², yotoqxona ${bed}m²`;
  };

  switch (disc) {
    case 'warm-floor':
    case 'water-supply':
    case 'sewage': {
      const floors = Array.from({ length: floorCount }, (_, i) =>
        `${i + 1}-qavat: ${roomsPerFloor()}`
      ).join('. ');
      return floors + '.';
    }
    case 'storm-drain':
      return `tom ${roofAreaM2}m²${balconyAreaM2 > 0 ? `, balkon ${balconyAreaM2}m²` : ''}.`;
    case 'boiler-room':
      return `${floorCount} qavatli uy, jami ${totalAreaM2}m²${hasWarmFloor ? ', issiq pol tizimi bilan' : ''}${hasHvs ? ', GVS kerak' : ', GVS siz'}.`;
    case 'facade':
      return `zamonaviy uslubdagi ${floorCount} qavatli bino, jami ${totalAreaM2}m². ${description}`;
    case 'floor-plan':
    case 'architecture':
    case 'electrical':
    case 'plumbing':
    case 'decor':
    default: {
      const floors = Array.from({ length: floorCount }, (_, i) =>
        `${i + 1}-qavat: ${roomsPerFloor()}`
      ).join('. ');
      return `${floorCount} qavatli bino, jami ${totalAreaM2}m². ${floors}.`;
    }
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

    // Local fallback
    const allText = [...history.map(m => m.content), userMessage].join(' ');
    const spec    = localParseSpec(allText);

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

    if (hasFloors && hasArea && !hasDisc) {
      return {
        reply: 'Qaysi muhandislik sohalari bo\'yicha chizma kerak?\n\n📐 Xona rejasi · 🏛️ Arxitektura · ⚡ Elektr\n💧 Suv ta\'minoti · 🚽 Kanalizatsiya · 🌧️ Yomg\'ir suvi\n♨️ Issiq pol · 🔥 Qozonxona · 🛋️ Interer dizayn',
        isComplete: false, spec: null,
      };
    }

    if (hasFloors && !hasArea) {
      return {
        reply: `${spec.floorCount} qavat — ajoyib! Har bir qavatning taxminiy maydoni (m²) qancha?`,
        isComplete: false, spec: null,
      };
    }

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
      [/fasad|facade/, 'facade'],
      [/santexnika|plumbing/, 'plumbing'],
      [/interer|decor/, 'decor'],
    ];
    for (const [rx, d] of map) {
      if (rx.test(text) && spec.disciplines.includes(d)) targets.push(d);
    }
    const isGlobal = /hammasi|все|all|qayta gen|regenerat/.test(text);
    const final = isGlobal ? [...spec.disciplines] : (targets.length ? targets : [...spec.disciplines]);

    // Rebuild disciplinePrompts for targets
    const updatedPrompts: Partial<Record<MegaDiscipline, string>> = {};
    const perFloor = Math.round(spec.totalAreaM2 / spec.floorCount);
    for (const disc of final) {
      updatedPrompts[disc] = buildLocalPrompt(disc, {
        floorCount: spec.floorCount, perFloor, totalAreaM2: spec.totalAreaM2,
        hasWarmFloor: spec.hasWarmFloor, hasWarmWall: spec.hasWarmWall, hasHvs: spec.hasHvs,
        roofAreaM2: spec.roofAreaM2, balconyAreaM2: spec.balconyAreaM2,
        floorStr: '', description: spec.buildingDescription,
      });
    }

    return {
      reply: `Tushunarli! ${final.join(', ')} qayta generatsiya qilaman...`,
      targets: final,
      specPatch: { disciplinePrompts: { ...spec.disciplinePrompts, ...updatedPrompts } },
    };
  }
}
