/**
 * PlumbingAIParser
 *
 * User promptini → PlumbingProjectSpec ga aylantiradi.
 * Gemini RAW JSON bermaydi — balki tabiiy til bilan gaplashib,
 * server tomonida deterministik spec yaratadi.
 *
 * Pipeline:
 *   user prompt → Gemini (tahlil) → structured text → local spec builder
 *   Gemini fail bo'lsa → to'liq local regex parser
 *
 * Shunday qilib: Gemini faqat "aql" beradi, lekin qaror server tomonida.
 */

import type { PlumbingProjectSpec, FixtureType } from '../engine/PlumbingProjectEngine';

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

const PLUMBING_SYSTEM_PROMPT = `
Sen O'zbekistonda ishlaydigan tajribali santexnik-muhandissan (20+ yil tajriba).
SNiP 2.04.01-85 va SP 30.13330.2020 standartlarini mukammal bilasan.

Foydalanuvchi beradigan matnni tahlil qil va FAQAT quyidagi formatda javob ber:

###PLUMBING_SPEC_START###
floors: <son>
floor_height: 2.8
building_width: <metr>
building_length: <metr>
rooms:
  - floor: 1 name: Hammom type: bathroom width: 2.5 length: 3.0 fixtures: toilet sink shower
  - floor: 1 name: Oshxona type: kitchen width: 3.5 length: 4.0 fixtures: kitchen_sink
  - floor: 2 name: Hammom type: bathroom width: 2.5 length: 3.0 fixtures: toilet sink shower
notes: <izoh>
###PLUMBING_SPEC_END###

MUHIM QOIDALAR:
1. fixtures ro'yxatida faqat bu so'zlar (bo'sh joy bilan): toilet sink bathtub shower bidet washing_machine dishwasher kitchen_sink floor_drain towel_rail
2. Xona o'lchamiga qarab fixtures:
   - hammom <5m²: toilet sink
   - hammom 5-8m²: toilet sink shower
   - hammom >8m²: toilet sink bathtub towel_rail
   - oshxona: kitchen_sink (>10m²: kitchen_sink dishwasher)
   - kir yuvish: washing_machine sink
3. "har qavatda N ta hammom" desa — HAR BIR QAVAT UCHUN alohida room qatori qo'sh
   Masalan: 3 qavat, har qavatda 1 hammom → 3 ta alohida qator (floor: 1, floor: 2, floor: 3)
4. Faqat namliq xonalar (hammom, oshxona, hojatxona, kir yuvish) — mehmonxona, yotoqxona qo'shma
5. Javobda FAQAT spec blok, boshqa matn yo'q
`;

// ═══════════════════════════════════════════════════════════════════════════════
// GEMINI CALL (model cascade)
// ═══════════════════════════════════════════════════════════════════════════════

const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];

// Groq — OpenAI-compatible, tez va bepul (Llama 3.x)
async function callGroq(apiKey: string, userPrompt: string): Promise<string | null> {
  if (!apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: PLUMBING_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) { console.log('[PLUMBING-AI] Groq error:', res.status); return null; }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = data?.choices?.[0]?.message?.content;
    if (text) { console.log('[PLUMBING-AI] Groq OK'); return text; }
  } catch (e) {
    clearTimeout(timer);
    console.log('[PLUMBING-AI] Groq failed:', (e as Error).message);
  }
  return null;
}

async function callGemini(apiKey: string, userPrompt: string): Promise<string | null> {
  if (!apiKey) return null;

  let lastErr = '';
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: PLUMBING_SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 404 || res.status === 429) { lastErr = `${res.status}`; continue; }
      if (!res.ok) { lastErr = `${res.status}`; continue; }

      const data = await res.json() as Record<string, unknown>;
      type GeminiCandidate = { content?: { parts?: Array<{ text?: string }> } };
      const text = ((data?.candidates as GeminiCandidate[])?.[0]
        ?.content?.parts?.[0] as { text?: string } | undefined)?.text;
      if (text) {
        console.log(`[PLUMBING-AI] Gemini ${model} OK`);
        return text;
      }
    } catch (e) {
      clearTimeout(timer);
      lastErr = (e as Error).message;
    }
  }

  console.log('[PLUMBING-AI] Gemini failed:', lastErr);
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPEC TEXT PARSER (Gemini javobini → PlumbingProjectSpec)
// ═══════════════════════════════════════════════════════════════════════════════

function parseSpecText(text: string): PlumbingProjectSpec | null {
  const match = text.match(/###PLUMBING_SPEC_START###\s*([\s\S]*?)\s*###PLUMBING_SPEC_END###/);
  if (!match) return null;

  const block = match[1];
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

  let floors = 1;
  let floorHeight = 2.8;
  let buildingWidth = 10;
  let buildingLength = 12;
  let notes = '';
  const rooms: PlumbingProjectSpec['rooms'] = [];

  for (const line of lines) {
    if (line.startsWith('floors:')) {
      floors = parseInt(line.replace('floors:', '').trim()) || 1;
    } else if (line.startsWith('floor_height:')) {
      floorHeight = parseFloat(line.replace('floor_height:', '').trim()) || 2.8;
    } else if (line.startsWith('building_width:')) {
      buildingWidth = parseFloat(line.replace('building_width:', '').trim()) || 10;
    } else if (line.startsWith('building_length:')) {
      buildingLength = parseFloat(line.replace('building_length:', '').trim()) || 12;
    } else if (line.startsWith('notes:')) {
      notes = line.replace('notes:', '').trim();
    } else if (line.startsWith('-')) {
      const room = parseRoomLine(line.slice(1).trim(), floors);
      if (room) rooms.push(room);
    }
  }

  if (rooms.length === 0) return null;

  return { floorCount: floors, floorHeight, buildingWidth, buildingLength, rooms, notes };
}

function parseRoomLine(line: string, maxFloors: number): PlumbingProjectSpec['rooms'][0] | null {
  const getVal = (key: string) => {
    const m = line.match(new RegExp(`${key}:\\s*([^\\s]+)`));
    return m ? m[1] : null;
  };

  const floorStr = getVal('floor');
  const name     = getVal('name');
  const typeStr  = getVal('type');
  const wStr     = getVal('width');
  const lStr     = getVal('length');
  const fixStr   = line.match(/fixtures:\s*(.+)$/)?.[1];

  if (!name) return null;

  const floor  = Math.min(parseInt(floorStr ?? '1') || 1, maxFloors);
  const width  = parseFloat(wStr ?? '2.5') || 2.5;
  const length = parseFloat(lStr ?? '2.5') || 2.5;
  const type   = (typeStr as PlumbingProjectSpec['rooms'][0]['type']) || 'bathroom';

  const VALID_FIXTURES = new Set<FixtureType>([
    'toilet','sink','bathtub','shower','bidet','washing_machine',
    'dishwasher','kitchen_sink','floor_drain','towel_rail','tap',
  ]);

  const fixtures: FixtureType[] = (fixStr ?? '')
    .split(/[,\s]+/)
    .map(s => s.trim().toLowerCase() as FixtureType)
    .filter(s => VALID_FIXTURES.has(s));

  return { name, type, floor, width, length, fixtures };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL FALLBACK PARSER (regex asosida, Gemini kerak emas)
// ═══════════════════════════════════════════════════════════════════════════════

const UZ_RU_MONTHS: Record<string, FixtureType[]> = {
  'hammom':     ['toilet', 'sink', 'shower'],
  'vannaxona':  ['toilet', 'sink', 'bathtub', 'towel_rail'],
  'hojatxona':  ['toilet', 'sink'],
  'туалет':     ['toilet', 'sink'],
  'ванная':     ['toilet', 'sink', 'bathtub', 'towel_rail'],
  'санузел':    ['toilet', 'sink', 'shower'],
  'oshxona':    ['kitchen_sink'],
  'кухня':      ['kitchen_sink'],
  'laundry':    ['washing_machine', 'sink'],
  'kir yuvish': ['washing_machine', 'sink'],
  'прачечная':  ['washing_machine', 'sink'],
};

function fixturesForArea(type: string, areM2: number): FixtureType[] {
  const base = UZ_RU_MONTHS[type.toLowerCase()] ?? [];
  const area = areM2;

  if (/hammom|vannaxona|ванная|санузел/.test(type.toLowerCase())) {
    if (area < 5)  return ['toilet', 'sink'];
    if (area < 7)  return ['toilet', 'sink', 'shower'];
    if (area < 10) return ['toilet', 'sink', 'bathtub', 'towel_rail'];
    return ['toilet', 'sink', 'bathtub', 'shower', 'towel_rail'];
  }
  if (/oshxona|кухня/i.test(type)) {
    return area >= 10 ? ['kitchen_sink', 'dishwasher'] : ['kitchen_sink'];
  }
  return base.length ? base : ['sink'];
}

function localParse(prompt: string): PlumbingProjectSpec {
  const text = prompt.toLowerCase();

  // Qavat soni
  const floorMatch = text.match(/(\d+)\s*(?:qavatli|qavat|этаж)/);
  const floorCount = Math.min(10, parseInt(floorMatch?.[1] ?? '1') || 1);

  // "Har qavatda" pattern
  const isAllFloors = /har\s*(?:bir\s*)?qavat|every\s*floor|each\s*floor/i.test(text);

  // Bino o'lchamlari
  const dimMatch = text.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*m/);
  const buildingWidth  = dimMatch ? parseFloat(dimMatch[1].replace(',', '.')) : 10;
  const buildingLength = dimMatch ? parseFloat(dimMatch[2].replace(',', '.')) : 12;

  const rooms: PlumbingProjectSpec['rooms'] = [];

  // "har qavatda" yoki "each floor" pattern — barchaga bir xil xonalar
  const allFloorsMatch = text.match(/har\s*(?:bir\s*)?qavat(?:da)?[:\s]+([^\n.]+)/i) ||
                         text.match(/(?:each|every)\s*floor[:\s]+([^\n.]+)/i);

  // Alohida qavat-spetsifik xonalar (1-qavat, 2-qavat...)
  const floorSpecificRooms: Map<number, string> = new Map();
  for (let floor = 1; floor <= floorCount; floor++) {
    const floorPatterns = [
      new RegExp(`${floor}[- ]?(?:qavat|этаж)[^a-z\\d]*:?\\s*([^.\\n]+)`, 'i'),
      new RegExp(`${floor}[- ]?(?:qavatda|этаже)[^a-z\\d]*:?\\s*([^.\\n]+)`, 'i'),
    ];
    for (const pat of floorPatterns) {
      const m = text.match(pat);
      if (m) { floorSpecificRooms.set(floor, m[1]); break; }
    }
  }

  // Xona qo'shish yordamchi
  function addRoomsFromText(floorText: string, floor: number) {
    const roomPattern = /(hammom|vannaxona|hojatxona|wc|туалет|oshxona|kir\s*yuvish|ванная|санузел|кухня|прачечная)\s*(?:(\d+(?:[.,]\d+)?)\s*m[²2]?)?/gi;
    let rm: RegExpExecArray | null;
    let found = false;
    while ((rm = roomPattern.exec(floorText)) !== null) {
      found = true;
      const roomName = rm[1].toLowerCase();
      const area = rm[2] ? parseFloat(rm[2].replace(',', '.')) : 6;
      const sqrtArea = Math.sqrt(area);
      const w = Math.round(sqrtArea * 10) / 10;
      const l = Math.round((area / w) * 10) / 10;

      const type: PlumbingProjectSpec['rooms'][0]['type'] =
        /oshxona|кухня/i.test(roomName) ? 'kitchen' :
        /kir|прачечная/i.test(roomName) ? 'laundry' :
        /hojatxona|wc|туалет/i.test(roomName) ? 'toilet' : 'bathroom';

      const dispName = /oshxona|кухня/i.test(roomName) ? 'Oshxona' :
                       /kir/i.test(roomName) ? 'Kir yuvish' :
                       /hojatxona|wc|туалет/i.test(roomName) ? 'Hojatxona' : 'Hammom';

      rooms.push({ name: dispName, type, floor, width: w, length: l, fixtures: fixturesForArea(roomName, area) });
    }
    return found;
  }

  // Har bir qavat uchun xona topish
  for (let floor = 1; floor <= floorCount; floor++) {
    let found = false;

    // 1. Alohida qavat matn bor?
    const specificText = floorSpecificRooms.get(floor);
    if (specificText) {
      found = addRoomsFromText(specificText, floor);
    }

    // 2. "har qavatda" pattern bor?
    if (!found && allFloorsMatch) {
      found = addRoomsFromText(allFloorsMatch[1], floor);
    }

    // 3. Bitta qavat — hamma matn
    if (!found && floorCount === 1) {
      found = addRoomsFromText(text, floor);
    }

    // 4. Fallback: standart xonalar
    if (!found) {
      rooms.push({ name: 'Hammom', type: 'bathroom', floor, width: 2.5, length: 3.0, fixtures: ['toilet','sink','shower'] });
      if (floor === 1) {
        rooms.push({ name: 'Oshxona', type: 'kitchen', floor, width: 3.5, length: 4.0, fixtures: ['kitchen_sink'] });
      }
      found = true;
    }

    // 5. "Har qavatda hammom" deyilsa, agar bu qavat uchun wet room qo'shilmagan bo'lsa — qo'sh
    if (isAllFloors && !rooms.some(r => r.floor === floor && (r.type === 'bathroom' || r.type === 'toilet'))) {
      rooms.push({ name: 'Hammom', type: 'bathroom', floor, width: 2.5, length: 3.0, fixtures: ['toilet','sink','shower'] });
    }
  }

  // Agar hech narsa topilmasa — standart 1 qavat
  if (rooms.length === 0) {
    rooms.push({ name: 'Hammom',  type: 'bathroom', floor: 1, width: 2.5, length: 3.0, fixtures: ['toilet','sink','shower'] });
    rooms.push({ name: 'Oshxona', type: 'kitchen',  floor: 1, width: 3.5, length: 4.0, fixtures: ['kitchen_sink'] });
  }

  return {
    floorCount,
    floorHeight: 2.8,
    buildingWidth,
    buildingLength,
    rooms,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI EDIT — matn buyrug'i bo'yicha project patch
// ═══════════════════════════════════════════════════════════════════════════════

const PLUMBING_EDIT_PROMPT = `
Sen santexnik muhandissan. Foydalanuvchi mavjud santexnika loyihasiga o'zgartirish kiritishni so'rayapti.

Mavjud loyiha spec:
{CURRENT_SPEC}

Foydalanuvchi so'rovi: {USER_REQUEST}

Faqat o'zgargan qismlarni ###PLUMBING_SPEC_START### formatida qaytargin.
Agar faqat bitta xona o'zgarsa — faqat shu xona rooms ro'yxatida bo'lsin (boshqalari o'chmaydi).
O'chirish kerak bo'lsa: fixtures ro'yxatidan olib tashla.
Qo'shish kerak bo'lsa: fixtures ro'yxatiga qo'sh.
`;

// ═══════════════════════════════════════════════════════════════════════════════
// POST-PROCESSING: "har qavatda" xonalar kengaytirish
// ═══════════════════════════════════════════════════════════════════════════════

function expandRoomsForAllFloors(spec: PlumbingProjectSpec, prompt: string): PlumbingProjectSpec {
  if (spec.floorCount <= 1) return spec;

  const text = prompt.toLowerCase();
  const isAllFloors = /har\s*(?:bir\s*)?qavat|every\s*floor|each\s*floor/i.test(text);

  // Barcha qavatlar uchun rooms bormi?
  const floorsWithRooms = new Set(spec.rooms.map(r => r.floor));
  const missingFloors: number[] = [];
  for (let f = 1; f <= spec.floorCount; f++) {
    if (!floorsWithRooms.has(f)) missingFloors.push(f);
  }

  if (missingFloors.length === 0) return spec; // hammasi to'liq

  // "har qavatda" deyilsa yoki rooms faqat 1-qavatda bo'lsa — kengaytir
  const floor1Rooms = spec.rooms.filter(r => r.floor === 1);
  if (!isAllFloors && floor1Rooms.length === 0) return spec;

  // 1-qavat rooms (yoki barcha rooms dan unikal nomlar)
  const templateRooms = floor1Rooms.length > 0 ? floor1Rooms : spec.rooms.filter((r, i) => {
    return spec.rooms.findIndex(r2 => r2.name === r.name) === i;
  });

  // Har bir bo'sh qavat uchun template dan nusxa olish
  // Bathroom/toilet tipidagi xonalarni barcha qavatlarga ko'paytir
  const newRooms = [...spec.rooms];
  const wetTemplates = templateRooms.filter(r => r.type === 'bathroom' || r.type === 'toilet');

  for (const floor of missingFloors) {
    for (const template of wetTemplates) {
      // Bu qavat da allaqachon shu nom bor?
      if (newRooms.some(r => r.floor === floor && r.name === template.name)) continue;
      newRooms.push({ ...template, floor });
    }
  }

  // 1-qavat: agar "har qavatda hammom" deyilsa va 1-qavatda hammom yo'q bo'lsa — boshqa qavatdan ko'pir
  if (isAllFloors && !newRooms.some(r => r.floor === 1 && (r.type === 'bathroom' || r.type === 'toilet'))) {
    // Boshqa qavatlardan wet room template topish
    const anyWetTemplate = spec.rooms.find(r => r.type === 'bathroom' || r.type === 'toilet');
    if (anyWetTemplate && !newRooms.some(r => r.floor === 1 && r.name === anyWetTemplate.name)) {
      // Bathroom/toilet tipidagi barcha xonalarni 1-qavatga ham qo'sh
      const otherFloorWet = spec.rooms.filter(r => r.type === 'bathroom' || r.type === 'toilet');
      const uniqueWet = otherFloorWet.filter((r, i) => otherFloorWet.findIndex(r2 => r2.name === r.name) === i);
      for (const t of uniqueWet) {
        newRooms.push({ ...t, floor: 1 });
      }
    }
  }

  return { ...spec, rooms: newRooms };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export class PlumbingAIParser {
  private geminiKey: string;
  private groqKey: string;

  constructor(geminiKey: string, groqKey = '') {
    this.geminiKey = geminiKey;
    this.groqKey = groqKey;
  }

  async parse(userPrompt: string): Promise<PlumbingProjectSpec> {
    console.log('[PLUMBING-AI] Parsing:', userPrompt.slice(0, 80));

    let spec: PlumbingProjectSpec | null = null;

    // 1. Gemini
    const geminiText = await callGemini(this.geminiKey, userPrompt);
    if (geminiText) {
      spec = parseSpecText(geminiText);
      if (spec && spec.rooms.length > 0) {
        console.log('[PLUMBING-AI] Gemini spec OK —', spec.rooms.length, 'xona');
      } else spec = null;
    }

    // 2. Groq (Llama) fallback
    if (!spec && this.groqKey) {
      const groqText = await callGroq(this.groqKey, userPrompt);
      if (groqText) {
        spec = parseSpecText(groqText);
        if (spec && spec.rooms.length > 0) {
          console.log('[PLUMBING-AI] Groq spec OK —', spec.rooms.length, 'xona');
        } else spec = null;
      }
    }

    // 3. Local fallback
    if (!spec) {
      console.log('[PLUMBING-AI] Local parse fallback');
      spec = localParse(userPrompt);
    }

    // 3. Post-process: "har qavatda" xonalar ko'paytirish
    //    Agar prompt "har qavatda" yoki "every floor" deysa va
    //    rooms faqat 1-qavat uchun bo'lsa — barcha qavatlar uchun takrorlash
    spec = expandRoomsForAllFloors(spec, userPrompt);

    return spec;
  }

  async applyEdit(
    userRequest: string,
    currentSpec: PlumbingProjectSpec,
  ): Promise<Partial<PlumbingProjectSpec>> {
    const specStr = JSON.stringify(currentSpec, null, 2);
    const editPrompt = PLUMBING_EDIT_PROMPT
      .replace('{CURRENT_SPEC}', specStr)
      .replace('{USER_REQUEST}', userRequest);

    const geminiText = await callGemini(this.geminiKey, editPrompt) ?? await callGroq(this.groqKey, editPrompt);
    if (!geminiText) return {};

    const newSpec = parseSpecText(geminiText);
    if (!newSpec) return {};

    // Merge: mavjud spec + yangi o'zgarishlar
    const updatedRooms = [...currentSpec.rooms];

    for (const newRoom of newSpec.rooms) {
      const idx = updatedRooms.findIndex(
        r => r.floor === newRoom.floor && r.name.toLowerCase() === newRoom.name.toLowerCase()
      );
      if (idx >= 0) {
        updatedRooms[idx] = { ...updatedRooms[idx], ...newRoom };
      } else {
        updatedRooms.push(newRoom);
      }
    }

    return {
      floorCount:    newSpec.floorCount    || currentSpec.floorCount,
      floorHeight:   newSpec.floorHeight   || currentSpec.floorHeight,
      buildingWidth: newSpec.buildingWidth || currentSpec.buildingWidth,
      rooms: updatedRooms,
    };
  }
}
