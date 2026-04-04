Pipes are created correctly but hidden behind walls.

PROBLEM: cold/hot pipes go from y:45 to y:15 (inside wall thickness).
After adding CANVAS_PADDING (~80px), these render behind the wall rect.

FIX 1 — Extend cold/hot pipes to be visible inside room:
In createPipe(), for north wall cold/hot:
  Change endpoint from WALL_THICKNESS to fixtureCenter.y - 10
  So pipe goes from fixture center UP slightly, visible inside room.
  
  path: [
    { x: fixtureCenter.x, y: fixtureCenter.y },
    { x: fixtureCenter.x, y: WALL_THICKNESS + 5 }
  ]
  
  This makes pipe visible: from fixture top edge to inner wall surface.

FIX 2 — Make cold/hot pipes run along wall (professional style):
Instead of going straight up (invisible), route them along north wall:
  cold pipe: fixture center → left along north wall inner surface
  hot pipe:  fixture center → right along north wall inner surface

  For north wall fixtures:
  cold path: [
    { x: fixtureCenter.x, y: WALL_THICKNESS + 8 },
    { x: WALL_THICKNESS, y: WALL_THICKNESS + 8 }
  ]
  hot path: [
    { x: fixtureCenter.x, y: WALL_THICKNESS + 12 },  
    { x: roomWidth - WALL_THICKNESS, y: WALL_THICKNESS + 12 }
  ]

  This shows pipes running horizontally along north wall — 
  professional plumbing drawing style.

FIX 3 — Drain pipe from sink (y:45→y:485) is correct but thin:
Make drain pipe strokeWidth=2 in Canvas2D.tsx.
All pipes: cold=2px blue, hot=2px red, drain=1.5px gray dashed.

Run npm test. Screenshot.