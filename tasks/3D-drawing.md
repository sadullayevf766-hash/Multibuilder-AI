You are a senior CAD/3D visualization engineer. Your task is to add a 
professional 3D isometric view system to the Multibuilder-AI project.

The target quality is the 3D drawings found in professional Uzbekistan 
construction projects (GOST/SNiP standard) — specifically:
1. Isometric floor plan view (building seen from 30° above, 45° rotated)
2. Isometric equipment/pipe node views (like boiler room 3D diagrams)

Both use the same isometric projection: 30° elevation, cabinet-style rendering
with flat shading on 3 visible faces (top=light, front=medium, side=dark).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## REFERENCE: WHAT THE TARGET 3D LOOKS LIKE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

From the reference PDF (page 25 "3D ВИД КОТЕЛЬНОГО ОБОРУДОВАНИЯ" and 
page 3 "УЗЕЛ КОЛЛЕКТОРА ТЁПЛОГО ПОЛА"), the 3D style is:

PROJECTION TYPE: True isometric (not perspective)
- X axis: goes right-down at 30° below horizontal
- Y axis: goes left-down at 30° below horizontal  
- Z axis: goes straight up
- Scale: all 3 axes equal (no foreshortening)

SHADING (flat, no gradients — CAD style):
- Top face:   lightest  — fill: #f0f0f0 (almost white)
- Front face: medium    — fill: #d0d0d0 (light gray)
- Right face: darkest   — fill: #b0b0b0 (medium gray)
- All edges:  stroke #333333, strokeWidth 1.0–1.5

COLORS by element type:
- Walls/structure:  grays above (#b0–#f0)
- Hot water pipes:  #e05050 (red-pink, semi-transparent tubes)
- Cold water pipes: #5080e0 (blue, semi-transparent tubes)
- Heating pipes:    #e07050 (salmon/copper)
- Gas pipes:        #f0c030 (yellow)
- Equipment boxes:  #e8e8e8 top, #d0d0d0 front, #b8b8b8 side
- Large tanks:      #f5f5f5 body with dark #333 caps
- Expansion tank:   #cc2020 (red cylinder)
- Water softeners:  #4080c0 (blue cylinders)

LINES:
- Visible edges: stroke #333333, strokeWidth 1.0
- Hidden edges:  stroke #aaaaaa, strokeWidth 0.5, dash [3,3]
- Pipe centerlines NOT shown (solid tube shapes instead)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ARCHITECTURE DECISION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use THREE.js (already available in the client) for 3D rendering.
Render to a canvas element alongside the existing 2D Konva canvas.

Do NOT use WebGL shaders — use THREE.js MeshLambertMaterial or 
MeshPhongMaterial with fixed lighting for the CAD flat-shading look.

Camera: OrthographicCamera (NOT perspective) to achieve true isometric.
Camera position: normalized isometric vector (1, 1, 1) * distance
Camera rotation: look at scene center.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 1: CREATE THE 3D ENGINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create new file: client/src/components/Canvas3D.tsx

```typescript
// Canvas3D.tsx — Isometric 3D floor plan viewer
// Uses THREE.js with OrthographicCamera for true isometric projection

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { DrawingData, Wall, PlacedFixture } from '../../../shared/types';

interface Canvas3DProps {
  drawingData: DrawingData;
  width?: number;
  height?: number;
  roomType?: string; // for room color
}

// ── Isometric camera setup ────────────────────────────────────────────────
// True isometric: camera at equal distance on all 3 axes
// Orthographic projection: no perspective distortion

const ISO_ANGLE = Math.PI / 6; // 30 degrees

function createIsoCamera(sceneWidth: number, sceneHeight: number, zoom: number) {
  const aspect = sceneWidth / sceneHeight;
  const d = Math.max(sceneWidth, sceneHeight) / zoom;
  const camera = new THREE.OrthographicCamera(
    -d * aspect, d * aspect,   // left, right
     d, -d,                     // top, bottom
     0.1, 10000                 // near, far
  );
  // True isometric position: camera at 45° horizontal, 35.26° vertical
  camera.position.set(d * 0.8, d * 0.8, d * 0.8);
  camera.lookAt(sceneWidth / 2, 0, sceneHeight / 2);
  return camera;
}

// ── Material factory ──────────────────────────────────────────────────────
// CAD-style flat shading: 3 materials per object (top, front, side)
// Using MeshLambertMaterial with directional light for flat look

function cadMaterials(topColor: string, frontColor: string, sideColor: string) {
  return [
    new THREE.MeshLambertMaterial({ color: sideColor }),   // right
    new THREE.MeshLambertMaterial({ color: sideColor }),   // left  
    new THREE.MeshLambertMaterial({ color: topColor }),    // top
    new THREE.MeshLambertMaterial({ color: frontColor }),  // bottom
    new THREE.MeshLambertMaterial({ color: frontColor }),  // front
    new THREE.MeshLambertMaterial({ color: sideColor }),   // back
  ];
}

// ── 3D element builders ───────────────────────────────────────────────────

// Wall as extruded box
function buildWall(wall: Wall, wallHeight: number, scene: THREE.Scene) {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.y - wall.start.y;
  const len = Math.sqrt(dx*dx + dz*dz);
  const angle = Math.atan2(dz, dx);
  
  const geo = new THREE.BoxGeometry(len, wallHeight, wall.thickness);
  const mat = cadMaterials('#e8e8e8', '#d0d0d0', '#b8b8b8');
  const mesh = new THREE.Mesh(geo, mat);
  
  mesh.position.set(
    wall.start.x + dx/2,
    wallHeight/2,
    wall.start.y + dz/2
  );
  mesh.rotation.y = -angle;
  
  // Edge lines (wireframe overlay for CAD look)
  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: '#333333', linewidth: 1 });
  const wireframe = new THREE.LineSegments(edges, lineMat);
  mesh.add(wireframe);
  
  scene.add(mesh);
}

// Floor slab
function buildFloor(minX: number, maxX: number, minZ: number, maxZ: number, 
                    scene: THREE.Scene) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  const geo = new THREE.BoxGeometry(w, 2, d);
  const mat = cadMaterials('#f8f8f8', '#e0e0e0', '#d0d0d0');
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(minX + w/2, -1, minZ + d/2);
  scene.add(mesh);
}

// Ceiling slab (optional, semi-transparent)
function buildCeiling(minX: number, maxX: number, minZ: number, maxZ: number,
                      wallHeight: number, scene: THREE.Scene) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  const geo = new THREE.BoxGeometry(w, 3, d);
  const mat = new THREE.MeshLambertMaterial({ 
    color: '#f0f0f0', transparent: true, opacity: 0.15 
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(minX + w/2, wallHeight + 1.5, minZ + d/2);
  scene.add(mesh);
}

export default function Canvas3D({ drawingData, width = 800, roomType = 'default' }: Canvas3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!mountRef.current) return;
    
    const SCALE = 0.1;    // 100 units = 1 THREE unit (so 1m = 1 unit in 3D)
    const WALL_H = 28;    // wall height in scene units (represents 2.8m)
    
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#ffffff');
    
    // Lighting for CAD flat-shading look
    const ambient = new THREE.AmbientLight('#ffffff', 0.6);
    scene.add(ambient);
    
    // Key light (top-front-left — creates the 3-face shading)
    const keyLight = new THREE.DirectionalLight('#ffffff', 0.8);
    keyLight.position.set(-1, 2, 1);
    scene.add(keyLight);
    
    // Fill light (opposite side, dimmer)
    const fillLight = new THREE.DirectionalLight('#e0e8ff', 0.3);
    fillLight.position.set(1, 0.5, -1);
    scene.add(fillLight);
    
    // Get scene bounds from wall data
    const allX = drawingData.walls.flatMap(w => [w.start.x, w.end.x]).map(x => x * SCALE);
    const allZ = drawingData.walls.flatMap(w => [w.start.y, w.end.y]).map(y => y * SCALE);
    const minX = Math.min(...allX), maxX = Math.max(...allX);
    const minZ = Math.min(...allZ), maxZ = Math.max(...allZ);
    const sceneW = maxX - minX;
    const sceneD = maxZ - minZ;
    
    // Build floor
    buildFloor(minX, maxX, minZ, maxZ, scene);
    
    // Build walls
    drawingData.walls.forEach(wall => {
      const scaledWall = {
        ...wall,
        start: { x: wall.start.x * SCALE, y: wall.start.y * SCALE },
        end:   { x: wall.end.x * SCALE,   y: wall.end.y * SCALE },
        thickness: wall.thickness * SCALE,
      };
      buildWall(scaledWall, WALL_H, scene);
    });
    
    // Build fixtures
    drawingData.fixtures.forEach(fixture => {
      build3DFixture(fixture, SCALE, WALL_H, scene);
    });
    
    // Camera
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, Math.round(width * 0.75));
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    
    const camera = createIsoCamera(sceneW, sceneD, 1.4);
    
    // Single render (static image, no animation loop needed for CAD)
    renderer.render(scene, camera);
    
    return () => {
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [drawingData, width]);
  
  return (
    <div ref={mountRef} className="border border-gray-200 rounded-lg overflow-hidden" />
  );
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 2: 3D FIXTURE LIBRARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create file: client/src/components/fixtures3d.ts

This file exports build3DFixture() which renders each fixture type 
as a proper 3D CAD model using THREE.js primitives only.

### General approach for each fixture:
- Use BoxGeometry for box-shaped items
- Use CylinderGeometry for round items (tanks, toilet bowl, pipes)
- Apply cadMaterials() for consistent CAD shading
- Scale: same SCALE factor (0.1) as walls
- Height (Y): fixtures sit on floor (y = height/2)

### Required fixtures:

**TOILET:**
```typescript
// Tank: box 40×12×20 (w×h×d at real units before scale)
// Bowl: CylinderGeometry(radiusTop=14, radiusBottom=18, height=10, segments=12)
// Position bowl in front of tank
// Materials: top #f0f0f0, front #e0e0e0, side #d0d0d0
```

**SINK:**
```typescript
// Cabinet: BoxGeometry 60×85×50
// Basin cutout: subtract using CSG OR draw basin as separate 
//   CylinderGeometry (radiusTop=16, radiusBottom=14, height=8)
//   positioned on top of cabinet
// Faucet: small box 8×18×4 on top-back edge
```

**BATHTUB:**
```typescript
// Body: BoxGeometry 80×50×180, cornerRadius approximated
// Interior (lighter color): BoxGeometry 64×6×164 on top
// Feet: 4 small cylinders at corners (r=3, h=8)
```

**DESK:**
```typescript
// Surface: BoxGeometry 120×4×60 at height 75
// 4 legs: BoxGeometry 4×75×4 at each corner
// Monitor: BoxGeometry 50×35×3 on back edge, tilted 5°
// Monitor stand: BoxGeometry 4×8×4
```

**BED:**
```typescript
// Frame: BoxGeometry 160×25×200
// Mattress: BoxGeometry 152×20×185, color #f5f0e0
// Headboard: BoxGeometry 160×40×8 at head end
// 2 pillows: BoxGeometry 70×12×45, color #ffffff, on mattress
// Blanket: BoxGeometry 152×8×140, color #d8e8f0, at foot end
```

**SOFA:**
```typescript
// Base: BoxGeometry 200×40×80
// Back: BoxGeometry 200×45×12 at rear, total h=85
// Left arm: BoxGeometry 12×50×80
// Right arm: BoxGeometry 12×50×80
// 3 cushions: BoxGeometry 56×15×68 each, on base
// Color: base #c0c0c0, cushions #d8d8d8
```

**WARDROBE:**
```typescript
// Body: BoxGeometry 120×220×60
// 3 door panels as thin boxes (BoxGeometry 38×200×2) on front face
// Door handles: CylinderGeometry (r=1.5, h=12) horizontal on each door
// Feet: 4 small boxes at bottom corners
```

**TV UNIT:**
```typescript
// Cabinet: BoxGeometry 150×45×40
// TV screen: BoxGeometry 140×80×4 centered on top-back, 
//            color #1a2035 (dark screen)
// Screen stand: BoxGeometry 6×12×4
// Screen bezel: slightly larger box wireframe
```

**STOVE:**
```typescript
// Body: BoxGeometry 60×85×60
// Top surface: BoxGeometry 58×2×58 on top
// 4 burner rings: TorusGeometry (r=8, tube=1.5) on top surface
// Oven door: BoxGeometry 52×28×2 on front
```

**FRIDGE:**
```typescript
// Body: BoxGeometry 60×170×65
// Door divider line at y=50 from bottom (freezer/fridge split)
// Handle: CylinderGeometry (r=1.5, h=35) on front-right edge
// Color: #f0f0f0 top, #e0e0e0 front, #d0d0d0 side
```

### For all fixtures:
- Add EdgesGeometry wireframe overlay (stroke #444444, opacity 0.6)
- Position: fixture.position.x * SCALE, 0, fixture.position.y * SCALE
- All fixtures rest on floor (y = height/2 in THREE coordinates)
- Use fixture.wall to determine rotation if needed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 3: PIPE RENDERING IN 3D
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each pipe in drawingData.pipes, render as a 3D tube:

```typescript
function build3DPipe(pipe: Pipe, scale: number, scene: THREE.Scene) {
  const PIPE_RADIUS = {
    cold:  1.2,   // cold water pipe diameter
    hot:   1.2,   // hot water pipe diameter  
    drain: 1.8,   // drain pipe (larger)
  }[pipe.type] ?? 1.0;
  
  const PIPE_HEIGHT = {
    cold:  8,    // height above floor (running near ceiling)
    hot:   10,   // slightly higher than cold
    drain: 3,    // low, near floor
  }[pipe.type] ?? 8;
  
  const PIPE_COLOR = {
    cold:  '#3b6fd4',
    hot:   '#d43b3b',
    drain: '#708090',
  }[pipe.type] ?? '#888888';
  
  // Build path points in 3D
  const points = pipe.path.map(p => 
    new THREE.Vector3(p.x * scale, PIPE_HEIGHT, p.y * scale)
  );
  
  if (points.length < 2) return;
  
  // Create tube along path
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0);
  const tubeGeo = new THREE.TubeGeometry(curve, points.length * 4, 
                                          PIPE_RADIUS * scale, 8, false);
  const mat = new THREE.MeshLambertMaterial({ color: PIPE_COLOR });
  const tube = new THREE.Mesh(tubeGeo, mat);
  scene.add(tube);
  
  // Cap at both ends
  [points[0], points[points.length-1]].forEach(pt => {
    const capGeo = new THREE.SphereGeometry(PIPE_RADIUS * scale, 8, 8);
    const cap = new THREE.Mesh(capGeo, mat);
    cap.position.copy(pt);
    scene.add(cap);
  });
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 4: DOOR AND WINDOW IN 3D
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Doors:**
```typescript
// Door frame: 3 thin boxes forming U-shape (left jamb + top + right jamb)
// Door leaf: thin box (doorWidth × wallHeight × 2) 
//   rotated 30-45° open (to show it's a door)
// Door leaf color: #d4b896 (wood color)
// Frame color: #888888 (metal/painted)
```

**Windows:**
```typescript
// Window opening in wall: wall geometry should have gap 
//   (handled by FloorPlanEngine segmentation)
// Window frame: 4 thin boxes forming rectangle
// Glass: BoxGeometry (windowWidth × windowHeight × 1)
//   MeshLambertMaterial color #a0c8e0, transparent true, opacity 0.3
// Sill: BoxGeometry (windowWidth+8 × 4 × 12) at bottom of window
// Frame color: #d0d0d0 (aluminum)
// Glass color: light blue, 30% opacity
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 5: INTERACTIVE CONTROLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add OrbitControls-style interaction WITHOUT importing OrbitControls 
(to avoid CDN issues). Implement minimal mouse rotation manually:

```typescript
// In Canvas3D useEffect, after renderer.render():

let isDragging = false;
let prevMouse = { x: 0, y: 0 };
let cameraTheta = Math.PI / 4;   // horizontal angle
let cameraPhi = Math.PI / 4;     // vertical angle
const cameraRadius = /* computed from scene size */;

const onMouseDown = (e: MouseEvent) => { 
  isDragging = true; 
  prevMouse = { x: e.clientX, y: e.clientY }; 
};
const onMouseMove = (e: MouseEvent) => {
  if (!isDragging) return;
  const dx = e.clientX - prevMouse.x;
  const dy = e.clientY - prevMouse.y;
  cameraTheta -= dx * 0.01;
  cameraPhi = Math.max(0.2, Math.min(Math.PI/2 - 0.1, cameraPhi - dy * 0.01));
  prevMouse = { x: e.clientX, y: e.clientY };
  
  camera.position.set(
    centerX + cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta),
    cameraRadius * Math.cos(cameraPhi),
    centerZ + cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta)
  );
  camera.lookAt(centerX, 0, centerZ);
  renderer.render(scene, camera);
};
const onMouseUp = () => { isDragging = false; };

renderer.domElement.addEventListener('mousedown', onMouseDown);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);

// Cleanup:
return () => {
  renderer.domElement.removeEventListener('mousedown', onMouseDown);
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  renderer.dispose();
};
```

Also add zoom via scroll wheel:
```typescript
const onWheel = (e: WheelEvent) => {
  e.preventDefault();
  zoom = Math.max(0.5, Math.min(3.0, zoom + e.deltaY * -0.001));
  // Recompute camera frustum with new zoom
  updateCameraZoom(camera, zoom);
  renderer.render(scene, camera);
};
renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 6: UI INTEGRATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In client/src/pages/Generator.tsx (or Project.tsx):

Add a view toggle button:
```tsx
const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

// Toggle button UI:
<div className="flex gap-2 mb-3">
  <button
    onClick={() => setViewMode('2d')}
    className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
      viewMode === '2d' 
        ? 'bg-blue-600 text-white' 
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
  >
    2D Reja
  </button>
  <button
    onClick={() => setViewMode('3d')}
    className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
      viewMode === '3d' 
        ? 'bg-blue-600 text-white' 
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
  >
    3D Ko'rinish
  </button>
</div>

// Conditional render:
{viewMode === '2d' && (
  <Canvas2D ref={canvasRef} drawingData={drawingData} width={canvasWidth} />
)}
{viewMode === '3d' && (
  <Canvas3D drawingData={drawingData} width={canvasWidth} />
)}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 7: LIGHTING PRESET FOR CAD LOOK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To achieve the exact flat-shaded CAD appearance from the PDF 
(not photorealistic, but technical/engineering style):

```typescript
function setupCadLighting(scene: THREE.Scene) {
  // Remove default lighting
  // Ambient: soft overall light
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  
  // Top light: creates bright top faces
  const topLight = new THREE.DirectionalLight(0xffffff, 0.6);
  topLight.position.set(0, 10, 0);
  scene.add(topLight);
  
  // Front-left key light: illuminates front faces
  const keyLight = new THREE.DirectionalLight(0xfff5e0, 0.4);
  keyLight.position.set(-5, 3, 5);
  scene.add(keyLight);
  
  // Right fill: dim light for side faces  
  const fillLight = new THREE.DirectionalLight(0xe0e8ff, 0.2);
  fillLight.position.set(5, 2, -3);
  scene.add(fillLight);
}
```

This 4-light setup gives exactly the 3-tone flat shading seen in the 
PDF: bright top, medium front, dark side.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 8: EXPORT 3D AS IMAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add export capability to Canvas3D (for PDF inclusion):

```typescript
// In Canvas3D, expose exportToImage via ref:
useImperativeHandle(ref, () => ({
  exportToImage(filename = '3d-view.png') {
    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }
}));
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## FILES TO CREATE/MODIFY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE:
  client/src/components/Canvas3D.tsx       ← main 3D component
  client/src/components/fixtures3d.ts      ← 3D fixture library
  client/src/components/lighting3d.ts      ← CAD lighting setup

MODIFY:
  client/src/pages/Generator.tsx           ← add 2D/3D toggle
  client/src/pages/Project.tsx             ← add 2D/3D toggle
  shared/types.ts                          ← add wallHeight field (optional)

DO NOT MODIFY:
  server/ (any server files)
  shared/types.ts core types
  Canvas2D.tsx
  FloorPlanEngine.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## VERIFY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After implementation:
  cd client && npx tsc --noEmit    → 0 errors
  cd server && npm test            → 39/39 passed (unchanged)

The 3D view must show:
✅ Walls as 3D boxes with visible height (~2.8m)
✅ Floor slab visible beneath walls  
✅ All fixtures as recognizable 3D objects
✅ Correct isometric camera angle (matches PDF style)
✅ CAD flat shading: 3 visible face tones
✅ Mouse drag to rotate, scroll to zoom
✅ 2D/3D toggle button in UI
✅ Export 3D view as PNG image
✅ Export 3D view as PNG image