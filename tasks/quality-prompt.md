Four improvements for professional quality.

IMPROVEMENT 1 — Show water pipes along walls:
In Canvas2D.tsx, render cold/hot pipes with:
  - cold: stroke='#3b82f6', strokeWidth=2, opacity=0.8
  - hot:  stroke='#ef4444', strokeWidth=2, opacity=0.8
  - drain: stroke='#64748b', strokeWidth=1.5, dash=[4,4], opacity=0.6
Make sure validPipes filter is NOT removing cold/hot pipes.
Add log: console.log('[RENDER] pipes count:', validPipes.length)

IMPROVEMENT 2 — Fixture real sizes:
In FloorPlanEngine.ts, update fixture dimensions (in units, 1m=100):
  sink:    width=60, height=50   (0.6m x 0.5m)
  toilet:  width=40, height=70   (0.4m x 0.7m)
  bathtub: width=70, height=170  (0.7m x 1.7m)
  shower:  width=90, height=90   (0.9m x 0.9m)

IMPROVEMENT 3 — Title block:
In Canvas2D.tsx, after room rendering add title block (bottom-right):
  Position: x=roomW+P-220, y=roomH+P-10, width=200, height=70
  Content:
    Line 1: project name (bold, 12px)
    Line 2: "Masshtab: 1:50"
    Line 3: current date
    Line 4: "SNiP 2.04.01-85"
  Border: 1px black rect

IMPROVEMENT 4 — Legend (bottom-left):
  Position: x=P, y=roomH+P+10
  Show: blue line + "Sovuq suv (H)"
         red line  + "Issiq suv (I)"  
         gray dash + "Kanalizatsiya (K)"