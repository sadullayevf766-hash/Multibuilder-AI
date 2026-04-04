# FloorPlan AI — Loyiha To'liq Holat Hisoboti

**Sana:** 2026-04-03  
**Test natijasi:** 33/33 test o'tdi ✅

---

## 1. LOYIHA HAQIDA

Sun'iy intellekt yordamida xona rejalarini yaratuvchi full-stack TypeScript ilovasi. Foydalanuvchi o'zbek tilida xona tavsifini yozadi, tizim avtomatik ravishda professional chizma yaratadi.

---

## 2. TEXNOLOGIYALAR

| Qatlam | Texnologiya |
|--------|-------------|
| Frontend | React 18, Vite, TailwindCSS, Konva.js |
| Backend | Express, TypeScript, Node.js 24 |
| AI | Google Gemini 2.0 Flash |
| Auth & DB | Supabase |
| Export | dxf-writer (DXF), custom PDF |
| Test | Vitest |

---

## 3. FAYL STRUKTURASI

```
/
├── client/                    # React frontend
│   └── src/
│       ├── components/
│       │   ├── Canvas2D.tsx   # Asosiy chizma komponenti (Konva.js)
│       │   └── symbols/       # CAD symbollar
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
│           └── supabase.ts    # Supabase client
│
├── server/                    # Express backend
│   └── src/
│       ├── ai/
│       │   └── GeminiParser.ts    # AI parsing
│       ├── engine/
│       │   └── FloorPlanEngine.ts # Koordinata hisoblash
│       ├── export/
│       │   ├── DxfExporter.ts     # DXF export
│       │   └── PdfExporter.ts     # PDF export
│       ├── db/
│       │   └── supabase.ts        # DB funksiyalar
│       └── index.ts               # Express server
│
└── shared/
    └── types.ts               # Umumiy TypeScript tiplari
```

---

## 4. ARXITEKTURA QOIDALARI

- **Gemini HECH QACHON koordinata bermaydi** — faqat semantik JSON (wall, type, offset)
- **Barcha koordinatalar** faqat `FloorPlanEngine` da hisoblanadi
- **1 metr = 100 birlik** koordinata tizimi
- **TypeScript strict mode** — `any` tipi ishlatilmaydi

---

## 5. ASOSIY MODULLAR

### 5.1 GeminiParser (`server/src/ai/GeminiParser.ts`)

**Vazifasi:** Tabiiy tilni strukturali JSON ga aylantirish

**Xususiyatlar:**
- Model: `gemini-2.0-flash`
- In-memory cache (bir xil so'rovlar qayta yuborilmaydi)
- Retry logic: 3 urinish, 15s/30s/45s kutish
- 30 soniya timeout + AbortController
- Demo mode: API key yo'q yoki xato bo'lsa mock data qaytaradi
- Multi-room detection: "kvartira", "xonali" so'zlari bo'lsa FloorPlan qaytaradi

**Demo mode aqlli:**
- "oshxona" → stove + sink + fridge
- "yotoqxona" → bed + wardrobe
- "ofis" → desk + bookshelf
- "mehmonxona" → sofa + tv_unit
- "kvartira/2 xonali" → to'liq FloorPlan (5 xona)
- "3 xonali" → to'liq FloorPlan (7 xona)

**Qo'llab-quvvatlanadigan xona turlari:**
`bathroom, kitchen, office, bedroom, living, apartment`

**Qo'llab-quvvatlanadigan jihozlar:**
`toilet, sink, bathtub, shower, stove, fridge, dishwasher, desk, bed, wardrobe, sofa, tv_unit, bookshelf`

---

### 5.2 FloorPlanEngine (`server/src/engine/FloorPlanEngine.ts`)

**Vazifasi:** RoomSpec → DrawingData (barcha koordinatalar bu yerda)

**Metodlar:**
- `generateDrawing(roomSpec)` — bitta xona uchun
- `generateFloorPlan(floorPlan)` — ko'p xonali reja
- `generateWalls()` — 4 ta devor, 15 birlik qalinlik
- `placeFixtures()` — jihozlarni devorga joylashtirish
- `generatePipes()` — quvurlarni avtomatik yo'naltirish
- `generateDimensions()` — o'lchov chiziqlari
- `removeDuplicateWalls()` — umumiy devorlarni bir marta chizish

**Quvur routing:**
- Cold/hot: L-shape, devor bo'ylab gorizontal
- Drain: sink → south wall ga vertikal; toilet → o'z devorga
- Barcha quvurlar orthogonal (diagonal yo'q)

**Jihozlar o'lchamlari (birlik):**
| Jihoz | Kenglik | Uzunlik |
|-------|---------|---------|
| sink | 60 | 50 |
| toilet | 40 | 70 |
| bathtub | 70 | 170 |
| shower | 90 | 90 |
| stove | 60 | 60 |
| fridge | 60 | 65 |
| desk | 120 | 60 |
| bed | 160 | 200 |
| wardrobe | 120 | 60 |
| sofa | 200 | 90 |
| tv_unit | 150 | 45 |

---

### 5.3 Canvas2D (`client/src/components/Canvas2D.tsx`)

**Vazifasi:** DrawingData ni Konva.js bilan vizualizatsiya qilish

**Render tartibi:**
1. Oq fon (room background)
2. Grid (100 birlik, och kulrang)
3. Quvurlar (pipes — devorlar ostida)
4. Devorlar (double-line, #1a1a1a, #f5f5f5 fill)
5. Eshiklar (arc swing)
6. Jihozlar (CAD symbollar)
7. O'lchov chiziqlari
8. Title block + Legend

**Rang kodlari:**
- Cold water: `#3b82f6` (ko'k), 2px
- Hot water: `#ef4444` (qizil), 2px
- Drain: `#64748b` (kulrang), 1.5px, dashed [4,4], opacity 0.6

**Auto-scale:** Canvas o'lchamiga qarab avtomatik moslashadi

**Title block:** "Floor Plan", "Masshtab: 1:50", sana, "SNiP 2.04.01-85"

**Legend:** Sovuq suv (H), Issiq suv (I), Kanalizatsiya (K)

---

### 5.4 DxfExporter (`server/src/export/DxfExporter.ts`)

**Layerlar:**
- WALLS (7 = black) — double line, 0.15m offset
- PLUMBING_COLD (4 = cyan)
- PLUMBING_HOT (1 = red)
- PLUMBING_DRAIN (8 = gray, DASHED)
- FIXTURES (7 = black) — CAD symbollar
- DIMENSIONS (7 = black)

**Jihozlar DXF da:**
- Toilet: circle (bowl) + rect (tank)
- Sink: outer rect + inner rect + drain circle
- Bathtub: outer + inner rect
- Shower: rect + center circle

---

## 6. API ENDPOINTLAR

| Method | URL | Tavsif |
|--------|-----|--------|
| GET | `/api/health` | Server holati |
| POST | `/api/generate` | Chizma yaratish |
| POST | `/api/export/dxf` | DXF yuklab olish |
| POST | `/api/export/pdf` | PDF yuklab olish |
| POST | `/api/projects` | Loyihani saqlash |
| GET | `/api/projects/:userId` | Loyihalar ro'yxati |
| GET | `/api/project/:id` | Bitta loyiha |

---

## 7. SHARED TYPES

```typescript
// Asosiy tiplar
RoomSpec       // Xona spesifikatsiyasi (o'lcham, jihozlar, eshiklar)
DrawingData    // Chizma ma'lumotlari (devorlar, quvurlar, o'lchovlar)
FloorPlan      // Ko'p xonali reja
RoomLayout     // Xona pozitsiyasi bilan
Wall           // Devor (start, end, thickness, side)
PlacedFixture  // Joylashtirilgan jihoz (position, wall)
Pipe           // Quvur (type, path, color)
DimensionLine  // O'lchov chizig'i
```

---

## 8. TEST HOLATI

```
Test Files: 4 passed
Tests:      33 passed

server/src/engine/__tests__/engine.test.ts    (11 test)
server/src/ai/__tests__/GeminiParser.test.ts  (12 test)
server/src/export/__tests__/DxfExporter.test.ts (5 test)
server/src/export/__tests__/PdfExporter.test.ts (5 test)
```

---

## 9. MUHIT O'ZGARUVCHILARI

### server/.env
```
PORT=5000
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
GEMINI_API_KEY=...   ← Bu yerda muammo bor (pastga qarang)
```

### client/.env
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## 10. HOZIRGI MUAMMO — GEMINI API KEY

**Holat:** Gemini API ishlamayapti

**Xato:** `RESOURCE_EXHAUSTED — limit: 0`

**Sabab:** Barcha sinab ko'rilgan API keylar bir xil Google Cloud projectga tegishli. Bu project uchun free tier limiti `0` ga tushgan (kunlik limit tugagan yoki project quota o'chirilgan).

**Sinab ko'rilgan keylar:**
- `AIzaSyB0...` — 429 (limit: 0)
- `AIzaSyBj...` — 429 (limit: 0)
- `AIzaSyDt...` — 429 (limit: 0)
- `AIzaSyC9...` — 400 (expired)
- `AIzaSyAz...` — 429 (limit: 0)
- `AIzaSyCh...` — 400 (expired)

**Yechim:**
1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) ga kiring
2. **"Create API key in new project"** bosing (yangi project!)
3. Yangi keyni `server/.env` ga qo'ying

**Hozirgi holat:** Demo mode ishlayapti — dimensions, room type, fixtures to'g'ri aniqlanmoqda. Gemini API ulanganda `[MODE] LIVE` logi ko'rinadi.

---

## 11. DEPLOYMENT

**Railway:**
```bash
# render.yaml va railway.json mavjud
# Environment variables qo'shish kerak
```

**Render:**
```yaml
# render.yaml tayyor
buildCommand: npm install && npm run build --workspace=server
startCommand: npm run start --workspace=server
```

**Supabase DB:**
```sql
-- projects jadvali kerak
-- DEPLOYMENT.md da to'liq SQL bor
```

---

## 12. ISHGA TUSHIRISH

```bash
# Dependencies o'rnatish
npm install
cd client && npm install
cd server && npm install

# Development
cd server && npm run dev   # Port 5000
cd client && npm run dev   # Port 3000

# Testlar
cd server && npm test
```

---

## 13. BAJARILGAN MILESTONELAR

| Milestone | Holat | Tavsif |
|-----------|-------|--------|
| 1 | ✅ | Loyiha strukturasi, shared types, routing |
| 2 | ✅ | FloorPlanEngine, koordinata tizimi |
| 3 | ✅ | GeminiParser, AI integration |
| 4 | ✅ | Canvas2D, DXF/PDF export |
| 5 | ✅ | Loading states, error messages, project history |
| + | ✅ | Landing, Login, Signup sahifalari |
| + | ✅ | Professional SVG symbollar (ISO 128/GOST) |
| + | ✅ | Universal engine (13 fixture type, 6 room type) |
| + | ✅ | Multi-room floor plan (FloorPlan type) |
| + | ✅ | Gemini retry + cache |
| + | ✅ | DXF quality (double walls, CAD symbols) |

---

## 14. QOLGAN ISHLAR

1. **Gemini API key** — yangi project dan key olish
2. **Supabase DB** — `projects` jadvalini yaratish (DEPLOYMENT.md da SQL bor)
3. **Deploy** — Railway yoki Render ga deploy qilish
4. **Canvas2D room labels** — multi-room rejada xona nomlari ko'rsatish (isFloorPlan flag bor, lekin hali ishlatilmagan)
