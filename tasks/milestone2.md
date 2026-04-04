Create /server/engine/FloorPlanEngine.ts

Requirements:
- Input: RoomSpec (width, length, fixtures[], doors[], windows[])
- Output: DrawingData (walls[], fixtures[], pipes[], dimensions[])

Rules:
- 1 meter = 100 units (coordinate system)
- Walls: always closed rectangle, 15 units thick
- Door: opening in wall + arc symbol (900mm standard)
- Fixtures snap to nearest wall with 50mm gap
- Pipes: auto-route from fixture to nearest corner
  - Cold water: blue
  - Hot water: red  
  - Drain: gray, always goes to floor (z-index bottom)
- Dimension lines: auto-generated for all walls
- No coordinates from AI — engine calculates everything

Write unit tests for each function in /server/engine/__tests__/