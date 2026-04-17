# Implementation Plan: Plumbing Axonometric Schema

## Overview

Extend the existing Multibuilder-AI app with a second drawing type — plumbing axonometric schema. Implementation follows the existing pattern: shared types → server engine → API route → client canvas.

## Tasks

- [x] 1. Extend shared types
  - Add `DrawingType`, `PlumbingFixtureType`, `PlumbingFixture`, `PlumbingPipe`, `PlumbingSchema` to `shared/types.ts`
  - Extend `DrawingData` with optional `drawingType?: DrawingType` and `plumbingSchema?: PlumbingSchema` fields (backward-compatible)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 2. Implement DiameterCalculator
  - [x] 2.1 Create `server/src/engine/DiameterCalculator.ts`
    - Export `FLOW_UNITS` record with values: sink=0.3, toilet=1.6, bathtub=0.3, shower=0.2, washing_machine=0.3
    - Implement `calcSupplyDiameter(totalFlow: number): number` — thresholds: ≤0.8→20, ≤1.5→25, ≤3.0→32, >3.0→40
    - Implement `calcDrainDiameter(fixtureCount: number): number` — 1→50, ≥2→100
    - Implement `annotateDiameters(schema: PlumbingSchema): PlumbingSchema` — sets `diameter` and `label` (`"Dn XX"`) on every pipe and riser
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 2.2 Write unit tests for DiameterCalculator
    - `calcSupplyDiameter(0.5)` → 20, `calcSupplyDiameter(0.9)` → 25, `calcSupplyDiameter(1.6)` → 32, `calcSupplyDiameter(3.1)` → 40
    - `calcDrainDiameter(1)` → 50, `calcDrainDiameter(2)` → 100
    - `annotateDiameters` sets label on every pipe and riser
    - File: `server/src/engine/__tests__/DiameterCalculator.test.ts`
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [ ]* 2.3 Write property tests for DiameterCalculator
    - **Property 2: Flow unit lookup is correct for all fixture types**
    - **Validates: Requirements 3.1**
    - **Property 3: Supply diameter thresholds are monotone**
    - **Validates: Requirements 3.2**
    - **Property 4: Branch diameter depends only on its own fixtures**
    - **Validates: Requirements 3.3**
    - **Property 5: Drain diameter threshold rule**
    - **Validates: Requirements 3.4**
    - **Property 6: All pipes have "Dn XX" formatted labels after annotation**
    - **Validates: Requirements 3.5**
    - File: `server/src/engine/__tests__/PlumbingEngine.property.test.ts`
    - Use `fast-check` — add to `server/package.json` devDependencies
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Implement PlumbingEngine
  - [x] 3.1 Create `server/src/engine/PlumbingEngine.ts`
    - Implement `generate(floorCount: number, description: string): PlumbingSchema`
    - Place standard fixture set per floor: sink at `x=200`, toilet at `x=350`, shower at `x=500`; `y = floorIndex * FLOOR_HEIGHT` (FLOOR_HEIGHT=300)
    - Compute three risers (cold at x=0, hot at x=50, drain at x=100) spanning `y=0` to `y=floorCount*300`
    - Compute branch pipes: horizontal line from each fixture position to its riser x at the same y
    - Cold/hot branches connect to cold/hot risers; drain branches connect to drain riser
    - Call `annotateDiameters` before returning
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x]* 3.2 Write unit tests for PlumbingEngine
    - `generate(1, ...)` → 3 fixtures all on floor 0
    - `generate(3, ...)` → fixtures on floors 0, 1, 2
    - Risers span full height (y=0 to y=floorCount*300)
    - Every fixture has at least one branch pipe in `schema.pipes`
    - `schema.risers` contains exactly one cold, one hot, one drain riser
    - Boiler room keywords in description do not add extra fixtures
    - `JSON.parse(JSON.stringify(schema))` deep-equals original
    - File: `server/src/engine/__tests__/PlumbingEngine.test.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 7.3_

  - [ ]* 3.3 Write property tests for PlumbingEngine
    - **Property 7: Schema generation produces correct floor count**
    - **Validates: Requirements 4.1, 4.2**
    - **Property 8: Riser y-coordinates follow FLOOR_HEIGHT invariant**
    - **Validates: Requirements 4.3**
    - **Property 9: Every fixture has a branch pipe**
    - **Validates: Requirements 4.4**
    - **Property 10: Three riser types are always present**
    - **Validates: Requirements 4.5**
    - **Property 15: PlumbingSchema JSON round-trip**
    - **Validates: Requirements 7.3**
    - File: `server/src/engine/__tests__/PlumbingEngine.property.test.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.3_

- [ ] 4. Checkpoint — Ensure all server-side tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Extend API route in server/src/index.ts
  - [x] 5.1 Add `PlumbingEngine` instance and update `/api/generate` handler
    - Destructure `drawingType` and `floorCount` from `req.body`
    - If `drawingType === 'plumbing-axonometric'`: validate `floorCount` (1–3), call `plumbingEngine.generate()`, return `DrawingData` with `drawingType` and `plumbingSchema`
    - If `drawingType === 'floor-plan'` or absent: keep existing FloorPlanEngine path unchanged
    - Return `400` with `{ error: 'floorCount must be 1–3' }` for out-of-range values
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 5.2 Write unit tests for API routing
    - POST with `drawingType: 'plumbing-axonometric'` and valid `floorCount` → response contains `drawingData.plumbingSchema`
    - POST with `drawingType: 'floor-plan'` → response contains `drawingData.walls`
    - POST with `floorCount: 0` → HTTP 400
    - POST with `floorCount: 4` → HTTP 400
    - **Property 13: API routing by drawingType**
    - **Validates: Requirements 6.1, 6.2**
    - **Property 14: floorCount validation rejects out-of-range values**
    - **Validates: Requirements 6.4**
    - File: `server/src/engine/__tests__/PlumbingEngine.property.test.ts`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 6. Create AxonometricCanvas component
  - [x] 6.1 Create `client/src/components/AxonometricCanvas.tsx`
    - `forwardRef` component with `AxonometricCanvasHandle` (same pattern as `Canvas2D`)
    - Draw risers as vertical Konva.Line: cold=`#c084fc` solid, hot=`#3b82f6` solid, drain=`#64748b` dashed `[6,4]`
    - Draw branch pipes as horizontal Konva.Line with matching colors
    - Draw `Konva.Text` diameter labels (`"Dn XX"`) centered on each pipe segment
    - Draw fixture symbols as labeled CAD rectangles (Konva.Rect + Konva.Text) at each fixture position
    - Draw floor level markers: horizontal dashed lines with `"X qavat"` labels at each `y = floor * FLOOR_HEIGHT`
    - Draw GOST title block (bottom-right) — reuse same structure as Canvas2D
    - Render `"Ma'lumot yo'q"` message when `schema` is missing or empty
    - Implement `exportToPdf` via `useImperativeHandle` using `jsPDF` (same pattern as Canvas2D)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [ ]* 6.2 Write unit/render tests for AxonometricCanvas
    - Pipe color mapping: cold renders with `#c084fc`, hot with `#3b82f6`, drain with `#64748b`
    - Diameter labels rendered for all pipes (**Property 12**)
    - Empty schema renders fallback message
    - **Property 11: Pipe color matches pipe type**
    - **Validates: Requirements 5.2, 5.3, 5.4**
    - File: `client/src/components/__tests__/AxonometricCanvas.test.tsx`
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

- [ ] 7. Update Generator.tsx UI
  - [x] 7.1 Add drawing type selector and floorCount input to `client/src/pages/Generator.tsx`
    - Add `drawingType` state (`'floor-plan' | 'plumbing-axonometric'`, default `'floor-plan'`)
    - Add `floorCount` state (number, default 1)
    - Render two tab/radio buttons: "Arxitektura rejasi" and "Suv ta'minoti aksonometrik sxemasi"
    - Show `floorCount` selector (1–3) only when `plumbing-axonometric` is selected
    - Include `drawingType` and `floorCount` in the `/api/generate` POST body
    - After generation, render `<AxonometricCanvas>` when `drawingData.drawingType === 'plumbing-axonometric'`, otherwise keep `<Canvas2D>`
    - **Property 1: DrawingType is always forwarded in API requests**
    - **Validates: Requirements 1.4**
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 7.2 Write UI tests for Generator drawing type selector
    - Drawing type selector renders both options (Requirement 1.1)
    - `floorCount` input visible only for plumbing type (Requirement 1.2)
    - Selecting floor-plan keeps existing flow unchanged (Requirement 1.3)
    - File: `client/src/components/__tests__/AxonometricCanvas.test.tsx`
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 8. Update Project.tsx canvas routing
  - In `client/src/pages/Project.tsx`, check `drawingData.drawingType`:
    - If `'plumbing-axonometric'` → render `<AxonometricCanvas schema={drawingData.plumbingSchema} />`
    - Otherwise → render existing `<Canvas2D>` (no change to existing path)
  - Add visual badge/label on Dashboard for plumbing schema projects (Requirement 8.3)
  - **Property 17: Canvas component routing by drawingType**
  - **Validates: Requirements 8.2**
  - _Requirements: 8.2, 8.3_

  - [ ]* 8.1 Write render test for Project.tsx canvas routing
    - `drawingType='plumbing-axonometric'` → `AxonometricCanvas` is mounted
    - `drawingType='floor-plan'` → `Canvas2D` is mounted
    - **Property 17: Canvas component routing by drawingType**
    - **Validates: Requirements 8.2**
    - File: `client/src/components/__tests__/AxonometricCanvas.test.tsx`
    - _Requirements: 8.2_

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `fast-check` must be added to `server/package.json` devDependencies before running property tests
- All new types must be imported from `shared/types.ts` — no `any` types (per AGENTS.md)
- AI (Gemini) must not return coordinates — `PlumbingEngine` computes all geometry (per AGENTS.md)
- Property tests require minimum 100 iterations (fast-check default)
