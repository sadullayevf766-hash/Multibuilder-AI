# FloorPlan AI — Loyiha To'liq Holat Hisoboti

**Sana:** 2026-04-05  
**Test natijasi:** 39/39 test o'tdi ✅  
**AI holati:** LIVE via Groq (LLaMA 3.3-70b) ✅

---

## 1. LOYIHA HAQIDA

Sun'iy intellekt yordamida xona rejalarini yaratuvchi full-stack TypeScript ilovasi. Foydalanuvchi o'zbek tilida xona tavsifini yozadi, tizim avtomatik ravishda professional chizma yaratadi.

---

## 2. TEXNOLOGIYALAR

| Qatlam | Texnologiya |
|--------|-------------|
| Frontend | React 18, Vite, TailwindCSS, Konva.js (react-konva@18.2.10) |
| Backend | Express, TypeScript, Node.js 24 |
| AI (primary) | Groq — LLaMA 3.3-70b-versatile (bepul, 14,400 req/kun) |
| AI (fallback) | Google Gemini 2.0 Flash |
| AI (offline) | Smart local parser (regex-based) |
| Auth & DB | Supabase |
| Export | dxf-writer (DXF), custom PDF |
| Test | Vitest (39/39) |

---

## 3. FAYL STRUKTURASI

```
/
├── client/                    # React frontend
│   └── src/
│       ├── components/
│       │   ├── Canvas2D.tsx   # Asosiy chizma komponenti (Konva.js)
│       │   └── symbols/       # ISO 128 / GOST CAD symbollar
│       │       ├── ToiletSymbol.tsx
│       │       ├── SinkSymbol.tsx
│       │       ├── BathtubSymbol.tsx
│       │       ├── ShowerSymbol.tsx
│       │       ├── DoorSymbol.tsx
│       │       ├── WindowSymbol.tsx
│       │       ├── ValveSymbol.tsx
│       │       └── ManifoldSymbol.tsx
│       ├── pages/
│       │   ├── Landing.tsx    # Bosh sahifa
│       │   ├── Login.tsx      # Kirish
│       │   ├── Signup.tsx     # Ro'yxatdan o'tish
│       │   ├── Dashboard.tsx  # Loyihalar ro'yxati
│       │   ├── Generator.tsx  # Chizma yaratish
│       │   └── Project.tsx    # Loyiha ko'rish
│       └── lib/
│           └── supabase.ts
│
├── server/                    # Express backend
│   └── src/
│       ├── ai/
│       │   └── GeminiParser.ts    # Groq → Gemini → Smart local
│       ├── engine/
│       │   └── FloorPlanEngine.ts # Koordinata hisoblash
│       ├── export/
│       │   ├── DxfExporter.ts     # DXF export (dxf-writer)
│       │   └── PdfExporter.ts     # PDF export
│       ├── db/
│       │   └── supabase.ts
│       └── index.ts               # Express server
│
└── shared/
    └── types.ts               # Umumiy TypeScript tiplari
```

---

## 4. ARXITEKTURA QOIDALARI

- **AI HECH QACHON koordinata bermaydi** — faqat semantik JSON
- **Barcha koordinatalar** faqat `FloorPlanEngine` da hisoblanadi
- **1 metr = 100 birlik** koordinata tizimi
- **TypeScript strict mode** — `any` tipi ishlatilmaydi

---

## 5. AI PIPELINE

```
Foydalanuvchi matni
        ↓
1. Groq (LLaMA 3.3-70b) — bepul, tez, 14,400 req/kun
        ↓ (xato bo'lsa)
2. Gemini 2.0 Flash — retry 3x (15s/30s/45s)
        ↓ (xato bo'lsa)
3. Smart local parser — regex, o'zbek tilini tushunadi
        ↓
FloorPlanEngine → DrawingData → Canvas2D
```

**Smart local parser qobiliyatlari:**
- `"3x4 hammom"` → width:3, length:4
- `"2 ta lavabo"` → 2 ta sink fixture
- `"shimoliy deraza"` → window on north wall
- `"katta oshxona"` → +1.5m dimensions
- `"2 xonali kvartira"` → to'liq FloorPlan (5 xona)
- `"3 xonali kvartira"` → to'liq FloorPlan (7 xona)

---

## 6. ASOSIY MODULLAR

### 6.1 GeminiParser

**Yangiliklar (v2):**
- `ParsedRoom` interface — `count` field qo'llab-quvvatlaydi
- `buildRoomSpec()` — fixture.count bilan bir nechta fixture
- `buildFloorPlan()` — multi-room support
- `smartLocalParse()` — AI siz ishlaydi
- In-memory cache — bir xil so'rovlar qayta yuborilmaydi
- Constructor: `new GeminiParser(geminiKey, groqKey)`

### 6.2 FloorPlanEngine

**Metodlar:**
- `generateDrawing(roomSpec)` — bitta xona
- `generateFloorPlan(floorPlan)` — ko'p xonali, auto-layout, dedup walls
- `generatePipes()` — cold/hot L-shape, drain vertikal
- `placeFixtures()` — strict boundary check, fixture o'lchamiga qarab

**Jihozlar o'lchamlari (birlik):**
| Jihoz | W | H | | Jihoz | W | H |
|-------|---|---|-|-------|---|---|
| sink | 60 | 50 | | stove | 60 | 60 |
| toilet | 40 | 70 | | fridge | 60 | 65 |
| bathtub | 70 | 170 | | desk | 120 | 60 |
| shower | 90 | 90 | | bed | 160 | 200 |
| wardrobe | 120 | 60 | | sofa | 200 | 90 |
| tv_unit | 150 | 45 | | bookshelf | 80 | 30 |

### 6.3 Canvas2D

**Render tartibi:**
1. Oq fon
2. Grid (100 birlik)
3. Quvurlar (pipes)
4. Devorlar (double-line, #1a1a1a, #f5f5f5 fill)
5. Eshiklar (arc swing)
6. Jihozlar (CAD symbollar)
7. O'lchov chiziqlari
8. Title block + Legend

**Rang kodlari:**
- Cold: `#3b82f6` (ko'k), 2px
- Hot: `#ef4444` (qizil), 2px
- Drain: `#64748b` (kulrang), 1.5px, dashed, opacity 0.6

**Muhim fix:** `Text as KonvaText` — React DOM `Text` bilan konflikt oldini olish. `React.StrictMode` olib tashlangan (react-konva bilan konflikt).

---

## 7. API ENDPOINTLAR

| Method | URL | Tavsif |
|--------|-----|--------|
| GET | `/api/health` | Server holati |
| POST | `/api/generate` | Chizma yaratish (Groq/Gemini/demo) |
| POST | `/api/export/dxf` | DXF yuklab olish |
| POST | `/api/export/pdf` | PDF yuklab olish |
| POST | `/api/projects` | Loyihani saqlash |
| GET | `/api/projects/:userId` | Loyihalar ro'yxati |
| GET | `/api/project/:id` | Bitta loyiha |

---

## 8. TEST HOLATI

```
Test Files: 4 passed
Tests:      39 passed (was 33)

engine.test.ts        (11 test) — FloorPlanEngine
GeminiParser.test.ts  (18 test) — Groq/Gemini/local parser
DxfExporter.test.ts   ( 5 test) — DXF export
PdfExporter.test.ts   ( 5 test) — PDF export
```

---

## 9. MUHIT O'ZGARUVCHILARI

### server/.env
```
PORT=5000
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
GEMINI_API_KEY=...    ← fallback (429 muammosi bor)
GROQ_API_KEY=gsk_...  ← PRIMARY (ishlayapti ✅)
```

### client/.env
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## 10. HOZIRGI HOLAT

| Komponent | Holat |
|-----------|-------|
| Groq AI (primary) | ✅ LIVE — `[MODE] LIVE via Groq` |
| Gemini AI (fallback) | ⚠️ 429 rate limit |
| Smart local parser | ✅ Ishlayapti |
| Canvas2D rendering | ✅ Tuzatildi (KonvaText, StrictMode) |
| DXF export | ✅ |
| PDF export | ✅ |
| Supabase auth | ✅ |
| Project history | ✅ |
| Multi-room floor plan | ✅ |
| GitHub | ✅ github.com/sadullayevf766-hash/Multibuilder-AI |

---

## 11. ISHGA TUSHIRISH

```bash
# Dependencies
npm install
cd client && npm install
cd server && npm install

# Development
cd server && npm run dev   # Port 5000
cd client && npm run dev   # Port 3000

# Tests
cd server && npm test      # 39/39
```

---

## 12. DEPLOYMENT

**Railway / Render:** `render.yaml` va `railway.json` tayyor.

**Supabase DB:** `DEPLOYMENT.md` da to'liq SQL bor.

---

## 13. BAJARILGAN MILESTONELAR

| # | Holat | Tavsif |
|---|-------|--------|
| M1 | ✅ | Loyiha strukturasi, shared types, routing |
| M2 | ✅ | FloorPlanEngine, koordinata tizimi |
| M3 | ✅ | GeminiParser, AI integration |
| M4 | ✅ | Canvas2D, DXF/PDF export |
| M5 | ✅ | Loading states, error messages, project history |
| + | ✅ | Landing, Login, Signup sahifalari |
| + | ✅ | ISO 128/GOST SVG symbollar |
| + | ✅ | Universal engine (13 fixture, 6 room type) |
| + | ✅ | Multi-room floor plan |
| + | ✅ | Groq primary + Gemini fallback + smart local |
| + | ✅ | DXF quality (double walls, CAD symbols) |
| + | ✅ | Canvas2D bug fixes (KonvaText, StrictMode) |
