# LOYIHA QOIDALARI — KIRO O'QISHI SHART

## Asosiy prinsip
AI (Gemini) HECH QACHON koordinata bermaydi.
Barcha koordinatalar faqat FloorPlanEngine da hisoblanadi.

## Fayl strukturasi
- /shared/types.ts — barcha tiplar shu yerda
- /server/engine/ — Rule Engine (koordinata bu yerda)
- /server/ai/ — faqat semantik JSON parsing
- /server/export/ — DXF va PDF

## Qat'iy qoidalar
1. Gemini response da x1,y1,x2,y2 bo'lmasligi kerak
2. Har funksiya uchun unit test yozilishi shart
3. "any" tipi ishlatma — TypeScript strict mode
4. Har export funksiya /shared/types.ts dan import qiladi

## Hozirgi holat
✅ Milestone 1: Loyiha strukturasi yaratildi
✅ Milestone 2: FloorPlanEngine (11 test o'tdi)
✅ Milestone 3: GeminiParser (12 test o'tdi)
✅ Milestone 4: Canvas2D, DXF/PDF export (10 test o'tdi)
✅ Milestone 5: Final polish - loading states, error messages (O'zbek tilida), project history, download buttons, mobile responsive, deployment ready

Jami: 33/33 test o'tdi ✓