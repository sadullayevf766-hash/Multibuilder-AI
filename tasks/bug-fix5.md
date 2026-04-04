Two critical bugs remain:

BUG 1 — Red pipe wrong origin:
In FloorPlanEngine.ts, find hot water pipe creation.
The pipe x1/y1 must equal the FIXTURE CENTER, not wall position.
Formula: 
  pipe.x1 = fixture.x + fixture.width / 2
  pipe.y1 = fixture.y + fixture.height / 2
Print console.log('hot pipe origin:', pipe.x1, pipe.y1) to verify.

BUG 2 — Dimensions ignored:
Add console.log at every step in the pipeline:
  Step 1 (GeminiParser): log parsed width/length
  Step 2 (FloorPlanEngine input): log received width/length  
  Step 3 (Canvas2D): log rendered width/length
Share the 3 log outputs with me. Do not fix until I see the logs.