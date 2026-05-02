/**
 * FacadeCanvas3D — Professional arxitektura fasad 3D ko'rinishi (Three.js)
 * To'liq qayta yozildi: to'g'ri gable tom, devor materiallari, oynalar, eshiklar
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { FacadeSchema, WallMaterial } from '../../../server/src/engine/FacadeEngine';

interface Props { schema: FacadeSchema; }

function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

// ─── Materials ────────────────────────────────────────────────────────────────

function wallMat(mat: WallMaterial, colorHex: string): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: hexToNum(colorHex) });
  if (mat === 'brick')        { m.roughness = 0.95; m.metalness = 0.0; }
  else if (mat === 'stone')   { m.roughness = 0.90; m.metalness = 0.0; }
  else if (mat === 'concrete'){ m.roughness = 0.80; m.metalness = 0.02; }
  else if (mat === 'wood')    { m.roughness = 0.85; m.metalness = 0.0; }
  else if (mat === 'metal' || mat === 'composite') { m.roughness = 0.35; m.metalness = 0.4; }
  else if (mat === 'glass_curtain') { m.roughness = 0.05; m.metalness = 0.6; m.transparent = true; m.opacity = 0.7; }
  else                        { m.roughness = 0.75; m.metalness = 0.0; } // plaster
  return m;
}

function solidMat(colorHex: number, roughness = 0.75): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: colorHex, roughness, metalness: 0 });
}

// ─── Brick mortar lines (horizontal only, on front face only) ─────────────────

function addBrickRows(scene: THREE.Scene, w: number, h: number, z: number, color: number) {
  const rowHeight = 0.075;
  const mortarH   = 0.01;
  const rows = Math.floor(h / (rowHeight + mortarH));
  const mat  = solidMat(color, 1.0);
  for (let r = 0; r < rows; r++) {
    const y = r * (rowHeight + mortarH) + mortarH / 2;
    const geo = new THREE.BoxGeometry(w, mortarH, 0.005);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, y, z + 0.003);
    scene.add(mesh);
  }
}

// ─── Window ───────────────────────────────────────────────────────────────────

function makeWindow(
  wW: number, wH: number,
  frameColor: number, glassColor: number,
  style: string,
): THREE.Group {
  const g = new THREE.Group();
  const ft  = 0.05; // frame thickness
  const fMat = solidMat(frameColor, 0.5);
  const gMat = new THREE.MeshStandardMaterial({
    color: glassColor, roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.55,
  });

  // Glass
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(wW - ft * 2, wH - ft * 2), gMat);
  glass.position.z = 0.005;
  g.add(glass);

  // Frame bars
  const bars: [number, number, number, number][] = [
    [wW, ft, 0, wH / 2 - ft / 2],       // top
    [wW, ft, 0, -(wH / 2 - ft / 2)],    // bottom
    [ft, wH, -(wW / 2 - ft / 2), 0],    // left
    [ft, wH, wW / 2 - ft / 2, 0],       // right
  ];
  bars.forEach(([bw, bh, bx, by]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, ft), fMat);
    m.position.set(bx, by, 0);
    g.add(m);
  });

  // Dividers
  if (style === 'standard' || style === 'grid') {
    const hb = new THREE.Mesh(new THREE.BoxGeometry(wW - ft * 2, ft * 0.6, ft * 0.4), fMat);
    g.add(hb);
    const vb = new THREE.Mesh(new THREE.BoxGeometry(ft * 0.6, wH - ft * 2, ft * 0.4), fMat);
    g.add(vb);
  } else if (style === 'panoramic' || style === 'floor_to_ceiling') {
    const vb = new THREE.Mesh(new THREE.BoxGeometry(ft * 0.6, wH - ft * 2, ft * 0.4), fMat);
    g.add(vb);
  }
  return g;
}

// ─── Door ─────────────────────────────────────────────────────────────────────

function makeDoor(dW: number, dH: number, doorColor: number, trimColor: number): THREE.Group {
  const g = new THREE.Group();
  const dMat  = solidMat(doorColor, 0.7);
  const tMat  = solidMat(trimColor, 0.5);
  const hMat  = new THREE.MeshStandardMaterial({ color: 0xc0982a, roughness: 0.3, metalness: 0.8 });

  // Door leaf
  const panel = new THREE.Mesh(new THREE.BoxGeometry(dW - 0.08, dH - 0.04, 0.06), dMat);
  panel.position.z = 0.01;
  g.add(panel);

  // Frame
  const ft = 0.055;
  [[dW, ft, 0, dH / 2 - ft / 2],
   [ft, dH, -(dW / 2 - ft / 2), 0],
   [ft, dH, dW / 2 - ft / 2, 0],
  ].forEach(([fw, fh, fx, fy]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(fw as number, fh as number, 0.08), tMat);
    m.position.set(fx as number, fy as number, -0.005);
    g.add(m);
  });

  // Handle
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.1, 8), hMat);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(dW * 0.28, -dH * 0.1, 0.05);
  g.add(handle);

  return g;
}

// ─── Correct Gable Roof ───────────────────────────────────────────────────────
// Two rectangular panels hinged at the ridge, no crossing

function makeGableRoof(
  bW: number, bD: number, ridgeH: number, overhang: number, roofColor: number,
): THREE.Group {
  const g = new THREE.Group();
  const mat = solidMat(roofColor, 0.85);
  const ov  = overhang;
  const fW  = bW + ov * 2; // full width with overhang
  const fD  = bD + ov * 2; // full depth with overhang
  // Slant length from eave to ridge
  const panelW = Math.sqrt((fW / 2) ** 2 + ridgeH ** 2);
  const angle  = Math.atan2(ridgeH, fW / 2); // pitch angle

  // Panel geometry: width=slant length, depth=building depth (Z axis), thickness=0.12
  // Rotation around Z axis tilts the panel in XY plane — Z stays as building depth
  const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(panelW, 0.12, fD), mat);
  leftPanel.rotation.z = angle;
  leftPanel.position.set(-fW / 4, ridgeH / 2, 0);
  g.add(leftPanel);

  const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(panelW, 0.12, fD), mat);
  rightPanel.rotation.z = -angle;
  rightPanel.position.set(fW / 4, ridgeH / 2, 0);
  g.add(rightPanel);

  // Gable end walls (front and back) — filled triangles using wall color
  const wallColor2 = roofColor; // same color, or pass separately
  const triShape = new THREE.Shape();
  triShape.moveTo(-fW / 2, 0);
  triShape.lineTo(fW / 2, 0);
  triShape.lineTo(0, ridgeH);
  triShape.closePath();
  const triGeo = new THREE.ShapeGeometry(triShape);
  const triMat = solidMat(wallColor2, 0.85);

  const front = new THREE.Mesh(triGeo, triMat);
  front.position.z = fD / 2 + 0.01;
  g.add(front);

  const rear = new THREE.Mesh(triGeo, triMat);
  rear.rotation.y = Math.PI;
  rear.position.z = -(fD / 2 + 0.01);
  g.add(rear);

  // Ridge cap
  const ridgeCap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, fD + 0.1), mat);
  ridgeCap.position.set(0, ridgeH, 0);
  g.add(ridgeCap);

  // Eave gutters
  const gutterMat = solidMat(0x777777, 0.6);
  for (const sx of [-1, 1]) {
    const gutter = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, fD + 0.3), gutterMat);
    gutter.position.set(sx * fW / 2, -0.03, 0);
    g.add(gutter);
  }

  return g;
}

// ─── Hip Roof (4-sided) ───────────────────────────────────────────────────────

function makeHipRoof(
  bW: number, bD: number, ridgeH: number, overhang: number, roofColor: number,
): THREE.Group {
  const g   = new THREE.Group();
  const mat = solidMat(roofColor, 0.85);
  const ov  = overhang;
  const fW  = bW + ov * 2;
  const fD  = bD + ov * 2;
  const ridgeL = Math.max(0.4, fW - fD); // ridge length (0 for pyramid)

  // Front and rear trapezoidal panels
  for (const sz of [-1, 1]) {
    const geo = new THREE.BufferGeometry();
    const hw = fW / 2, rl = ridgeL / 2;
    const verts = new Float32Array([
      -hw, 0, 0,
       hw, 0, 0,
       rl, ridgeH, 0,
      -rl, ridgeH, 0,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(sz > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
    geo.computeVertexNormals();
    const panel = new THREE.Mesh(geo, mat);
    panel.position.z = sz * fD / 2;
    g.add(panel);
  }

  // Left and right triangular panels
  for (const sx of [-1, 1]) {
    const geo = new THREE.BufferGeometry();
    const hd = fD / 2, rl = ridgeL / 2;
    const verts = new Float32Array([
      0, 0, -hd,
      0, 0,  hd,
      sx * rl, ridgeH, 0,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(sx > 0 ? [0, 2, 1] : [0, 1, 2]);
    geo.computeVertexNormals();
    const panel = new THREE.Mesh(geo, mat);
    panel.position.x = sx * fW / 2;
    g.add(panel);
  }

  return g;
}

// ─── Shed Roof (one slope) ────────────────────────────────────────────────────

function makeShedRoof(
  bW: number, bD: number, ridgeH: number, overhang: number, roofColor: number,
): THREE.Group {
  const g   = new THREE.Group();
  const mat = solidMat(roofColor, 0.85);
  const ov  = overhang;
  const fW  = bW + ov * 2;
  const fD  = bD + ov * 2;
  const panelLen = Math.sqrt(fW ** 2 + ridgeH ** 2);
  const angle    = Math.atan2(ridgeH, fW);
  const panel    = new THREE.Mesh(new THREE.BoxGeometry(panelLen, fD, 0.12), mat);
  panel.rotation.z = -angle;
  panel.position.set(0, ridgeH / 2, 0);
  g.add(panel);
  return g;
}

// ─── Flat / Parapet Roof ──────────────────────────────────────────────────────

function makeFlatRoof(
  bW: number, bD: number, parapetH: number, roofColor: number, wallColor: number,
): THREE.Group {
  const g   = new THREE.Group();
  const rMat = solidMat(roofColor, 0.85);
  const pMat = solidMat(wallColor, 0.80);
  const ov  = 0.05;

  // Roof slab
  const slab = new THREE.Mesh(new THREE.BoxGeometry(bW + ov * 2, 0.18, bD + ov * 2), rMat);
  slab.position.set(0, 0.09, 0);
  g.add(slab);

  // Parapet walls (4 sides)
  if (parapetH > 0.1) {
    const pH = parapetH;
    const thick = 0.15;
    const pSides: [number, number, number, number, number, number][] = [
      [bW + ov * 2 + thick * 2, pH, thick, 0, pH / 2, (bD + ov * 2) / 2 + thick / 2],
      [bW + ov * 2 + thick * 2, pH, thick, 0, pH / 2, -(bD + ov * 2) / 2 - thick / 2],
      [thick, pH, bD + ov * 2, -(bW + ov * 2) / 2 - thick / 2, pH / 2, 0],
      [thick, pH, bD + ov * 2, (bW + ov * 2) / 2 + thick / 2, pH / 2, 0],
    ];
    pSides.forEach(([pw, ph, pd, px, py, pz]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), pMat);
      m.position.set(px, py, pz);
      g.add(m);
    });
  }
  return g;
}

// ─── Mansard Roof ─────────────────────────────────────────────────────────────

function makeMansardRoof(
  bW: number, bD: number, ridgeH: number, overhang: number, roofColor: number,
): THREE.Group {
  const g    = new THREE.Group();
  const mat  = solidMat(roofColor, 0.85);
  const ov   = overhang;
  const fW   = bW + ov * 2;
  const fD   = bD + ov * 2;
  const lowerH = ridgeH * 0.6;
  const upperW = Math.max(1.0, fW * 0.5);
  const upperD = Math.max(1.0, fD * 0.6);

  const lSlope = lowerH / ((fW - upperW) / 2);
  const ang    = Math.atan(lSlope);
  const panelW = Math.sqrt(((fW - upperW) / 2) ** 2 + lowerH ** 2);
  const panelD = Math.sqrt(((fD - upperD) / 2) ** 2 + lowerH ** 2);

  // Front / rear lower panels — rotate around X axis, span full width
  for (const sz of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(fW + 0.1, 0.10, panelD), mat);
    panel.rotation.x = sz * ang;
    panel.position.set(0, lowerH / 2, sz * (upperD / 2 + panelD * Math.cos(ang) / 2));
    g.add(panel);
  }
  // Left / right lower panels — rotate around Z axis, span full depth
  for (const sx of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(panelW, 0.10, fD + 0.1), mat);
    panel.rotation.z = -sx * ang;
    panel.position.set(sx * (upperW / 2 + panelW * Math.cos(ang) / 2), lowerH / 2, 0);
    g.add(panel);
  }
  // Upper flat
  const upper = new THREE.Mesh(new THREE.BoxGeometry(upperW, 0.14, upperD), mat);
  upper.position.set(0, lowerH + 0.07, 0);
  g.add(upper);

  return g;
}

// ─── Balcony ──────────────────────────────────────────────────────────────────

function makeBalcony(bW: number, depth: number, accentColor: number): THREE.Group {
  const g     = new THREE.Group();
  const cMat  = solidMat(accentColor, 0.85);
  const rMat  = solidMat(0xe8e8e8, 0.5);

  // Slab
  const slab = new THREE.Mesh(new THREE.BoxGeometry(bW, 0.12, depth), cMat);
  slab.position.set(0, 0, depth / 2);
  g.add(slab);

  // Posts
  const posts = Math.max(2, Math.round(bW / 0.7));
  for (let i = 0; i < posts; i++) {
    const px = -bW / 2 + (i / (posts - 1)) * bW;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.95, 0.055), rMat);
    post.position.set(px, 0.535, depth - 0.03);
    g.add(post);
  }
  // Handrail
  const rail = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.055, 0.055, 0.07), rMat);
  rail.position.set(0, 1.0, depth - 0.03);
  g.add(rail);
  // Side rails
  for (const sx of [-bW / 2, bW / 2]) {
    const sr = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.0, depth), rMat);
    sr.position.set(sx, 0.5, depth / 2);
    g.add(sr);
  }
  return g;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FacadeCanvas3D({ schema }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const W = el.clientWidth  || 900;
    const H = el.clientHeight || 600;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc8dff0);
    scene.fog = new THREE.Fog(0xc8dff0, 80, 200);

    // Dimensions
    const bW = schema.totalWidth;
    const bD = schema.totalDepth;
    const bH = schema.totalHeight;
    const fH = schema.floorHeight;
    const nF = schema.floorCount;
    const wallH = nF * fH;           // wall height, without roof
    const colors = schema.colors;
    const mat = schema.material;
    const roof = schema.roof;
    const mainEl = schema.elevations.find(e => e.side === 'main' || e.side === 'south')
                ?? schema.elevations[0];

    // Camera
    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 500);
    const dist   = Math.max(bW, bH, bD) * 2.2;
    camera.position.set(dist * 0.6, wallH * 0.55, dist * 0.85);
    camera.lookAt(0, wallH / 2, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, wallH / 2, 0);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.07;
    controls.minDistance    = bW * 0.4;
    controls.maxDistance    = bW * 8;
    controls.maxPolarAngle  = Math.PI * 0.87;
    controls.update();

    // Lights
    scene.add(new THREE.AmbientLight(0xfff5e0, 0.75));

    const sun = new THREE.DirectionalLight(0xfff8e0, 2.0);
    sun.position.set(bW * 1.5, bH * 3.5, bD * 1.8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near   = 1;
    sun.shadow.camera.far    = dist * 5;
    sun.shadow.camera.left   = -bW * 3;
    sun.shadow.camera.right  =  bW * 3;
    sun.shadow.camera.top    =  bH * 4;
    sun.shadow.camera.bottom = -bH;
    sun.shadow.bias = -0.001;
    scene.add(sun);

    scene.add(new THREE.DirectionalLight(0xb0d0ff, 0.45).position.set(-bW * 2, bH, -bD) && new THREE.DirectionalLight(0xb0d0ff, 0.45));
    const fill = new THREE.DirectionalLight(0xb0d0ff, 0.45);
    fill.position.set(-bW * 2, bH, -bD);
    scene.add(fill);
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a7a2a, 0.35));

    // ── Ground ────────────────────────────────────────────────────────────────
    const groundGeo  = new THREE.PlaneGeometry(bW * 6, bD * 6);
    const groundMesh = new THREE.Mesh(groundGeo, solidMat(0x3a7a32, 1.0));
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Driveway/path
    const pathMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, bD * 0.5), solidMat(0x808078, 0.9));
    pathMesh.rotation.x = -Math.PI / 2;
    pathMesh.position.set(0, 0.01, bD * 0.4);
    pathMesh.receiveShadow = true;
    scene.add(pathMesh);

    // ── Foundation / plinth ───────────────────────────────────────────────────
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(bW + 0.2, 0.38, bD + 0.2),
      solidMat(0x7a7a72, 0.9)
    );
    plinth.position.set(0, -0.19, 0);
    plinth.castShadow = true;
    scene.add(plinth);

    // ── Walls (4 solid slabs) ─────────────────────────────────────────────────
    const thick  = 0.28;
    const wMat3D = wallMat(mat, colors.wall);
    wMat3D.side = THREE.FrontSide;

    const wallDefs: [number, number, number, number, number, number][] = [
      // w,     h,     d,       x,        y,         z
      [bW,     wallH, thick,   0,        wallH / 2, bD / 2],          // front (south)
      [bW,     wallH, thick,   0,        wallH / 2, -bD / 2],         // rear
      [thick,  wallH, bD - thick * 2, -(bW - thick) / 2, wallH / 2, 0], // left
      [thick,  wallH, bD - thick * 2,  (bW - thick) / 2, wallH / 2, 0], // right
    ];

    wallDefs.forEach(([w, h, d, x, y, z]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wMat3D.clone());
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    });

    // Brick mortar lines on front wall only (horizontal, very thin)
    if (mat === 'brick' || mat === 'stone') {
      addBrickRows(scene, bW - 0.01, wallH, bD / 2 + thick / 2, hexToNum(colors.trim));
    }

    // ── Floor slabs (horizontal, inside walls) ────────────────────────────────
    const slabMat = solidMat(hexToNum(colors.trim), 0.85);
    for (let f = 0; f <= nF; f++) {
      const y = f * fH;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(bW, 0.15, bD), slabMat);
      slab.position.set(0, y, 0);
      slab.castShadow = f === 0;
      scene.add(slab);
    }

    // ── Windows on front wall ─────────────────────────────────────────────────
    mainEl.floors.forEach(floor => {
      const baseY = floor.index * fH;
      floor.windows.forEach(win => {
        const wg = makeWindow(
          win.width, win.height,
          hexToNum(colors.trim), hexToNum(colors.window), win.style,
        );
        wg.position.set(
          -bW / 2 + win.x + win.width / 2,
          baseY + win.sill + win.height / 2,
          bD / 2 + thick / 2 + 0.015,
        );
        scene.add(wg);
      });

      // Balcony
      if (floor.hasBalcony && floor.index > 0) {
        const balW  = mainEl.totalWidth * 0.42;
        const balD  = floor.balconyDepth ?? 1.2;
        const bal   = makeBalcony(balW, balD, hexToNum(colors.accent));
        bal.position.set(0, baseY, bD / 2 + thick / 2);
        scene.add(bal);
      }
    });

    // ── Simple windows on rear & side walls ───────────────────────────────────
    const simpGlass = new THREE.MeshStandardMaterial({
      color: hexToNum(colors.window), roughness: 0.05, metalness: 0.4,
      transparent: true, opacity: 0.55,
    });
    const simpFrame = solidMat(hexToNum(colors.trim), 0.6);

    // Rear windows (mirror of front)
    mainEl.floors.forEach(floor => {
      const baseY = floor.index * fH;
      floor.windows.forEach(win => {
        const wg = new THREE.Group();
        const g  = new THREE.Mesh(new THREE.PlaneGeometry(win.width - 0.1, win.height - 0.1), simpGlass);
        wg.add(g);
        const fr = new THREE.Mesh(new THREE.BoxGeometry(win.width, win.height, 0.05), simpFrame);
        fr.position.z = -0.03;
        wg.add(fr);
        wg.rotation.y = Math.PI;
        wg.position.set(
          -bW / 2 + win.x + win.width / 2,
          baseY + win.sill + win.height / 2,
          -(bD / 2 + thick / 2 + 0.01),
        );
        scene.add(wg);
      });
    });

    // Side wall simplified windows
    const sWinW = 0.9, sWinH = 1.15;
    const sWinsPerFloor = Math.max(1, Math.round(bD / 3.5));
    for (let fi = 0; fi < nF; fi++) {
      const baseY = fi * fH + 0.85;
      for (let wi = 0; wi < sWinsPerFloor; wi++) {
        const wz = -bD / 2 + (wi + 0.5) * (bD / sWinsPerFloor);
        for (const sx of [-1, 1]) {
          const wg = new THREE.Group();
          wg.add(new THREE.Mesh(new THREE.PlaneGeometry(sWinW - 0.08, sWinH - 0.08), simpGlass));
          const fr = new THREE.Mesh(new THREE.BoxGeometry(sWinW, sWinH, 0.05), simpFrame);
          fr.position.z = -0.03;
          wg.add(fr);
          wg.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
          wg.position.set(sx * (bW / 2 + 0.015), baseY + sWinH / 2, wz);
          scene.add(wg);
        }
      }
    }

    // ── Door on front wall ────────────────────────────────────────────────────
    mainEl.doors.forEach(door => {
      const dg = makeDoor(door.width, door.height, hexToNum(colors.door), hexToNum(colors.trim));
      dg.position.set(
        -bW / 2 + door.x + door.width / 2,
        door.height / 2,
        bD / 2 + thick / 2 + 0.03,
      );
      scene.add(dg);

      // Canopy
      if (door.hasCanopy) {
        const cW  = door.width + 0.5;
        const cD  = door.canopyDepth ?? 1.0;
        const can = new THREE.Mesh(new THREE.BoxGeometry(cW, 0.08, cD), solidMat(hexToNum(colors.accent), 0.6));
        can.position.set(
          -bW / 2 + door.x + door.width / 2,
          door.height + 0.04,
          bD / 2 + thick / 2 + cD / 2,
        );
        scene.add(can);
        // Canopy posts
        for (const cpx of [-cW / 2 + 0.06, cW / 2 - 0.06]) {
          const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, door.height, 0.08),
            solidMat(hexToNum(colors.trim), 0.7)
          );
          post.position.set(
            -bW / 2 + door.x + door.width / 2 + cpx,
            door.height / 2,
            bD / 2 + thick / 2 + cD - 0.04,
          );
          scene.add(post);
        }
      }
    });

    // ── Decorations ───────────────────────────────────────────────────────────
    mainEl.decorations.forEach(dec => {
      const dColor = hexToNum(dec.color ?? colors.trim);
      const dMat   = solidMat(dColor, 0.8);

      if (dec.type === 'cornice') {
        const ch = dec.height ?? 0.3;
        const cor = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.15, ch, 0.22), dMat);
        cor.position.set(0, wallH - ch / 2, bD / 2 + 0.11);
        scene.add(cor);
      } else if (dec.type === 'belt') {
        const bh = dec.height ?? 0.12;
        for (let f = 1; f < nF; f++) {
          const belt = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.08, bh, 0.1), dMat);
          belt.position.set(0, f * fH - bh / 2, bD / 2 + 0.05);
          scene.add(belt);
        }
      } else if (dec.type === 'pilaster') {
        const spacing = dec.spacing ?? 3.5;
        const cols    = Math.floor(bW / spacing) + 1;
        for (let ci = 0; ci < cols; ci++) {
          const px = -bW / 2 + ci * spacing;
          if (px > bW / 2) continue;
          const pil = new THREE.Mesh(new THREE.BoxGeometry(0.18, wallH, 0.12), dMat);
          pil.position.set(px, wallH / 2, bD / 2 + 0.06);
          scene.add(pil);
        }
      } else if (dec.type === 'fins') {
        const spacing = dec.spacing ?? 1.5;
        const cols    = Math.floor(bW / spacing);
        for (let ci = 0; ci < cols; ci++) {
          const px = -bW / 2 + (ci + 0.5) * spacing;
          const fin = new THREE.Mesh(new THREE.BoxGeometry(0.07, wallH, 0.35), dMat);
          fin.position.set(px, wallH / 2, bD / 2 + 0.18);
          scene.add(fin);
        }
      }
    });

    // ── Roof ──────────────────────────────────────────────────────────────────
    const roofColor   = hexToNum(colors.roof);
    const wallColor   = hexToNum(colors.wall);
    const ridgeH      = roof.ridgeH  ?? (bW / 2) * Math.tan(((roof.pitch ?? 30) * Math.PI) / 180);
    const overhang    = roof.overhang ?? 0.5;
    const parapetH    = roof.parapetH ?? 0.55;
    let   roofGroup: THREE.Group;

    switch (roof.type) {
      case 'gable':
        roofGroup = makeGableRoof(bW, bD, ridgeH, overhang, roofColor);
        break;
      case 'hip':
        roofGroup = makeHipRoof(bW, bD, ridgeH, overhang, roofColor);
        break;
      case 'shed':
        roofGroup = makeShedRoof(bW, bD, ridgeH, overhang, roofColor);
        break;
      case 'mansard':
        roofGroup = makeMansardRoof(bW, bD, ridgeH, overhang, roofColor);
        break;
      default: // flat, parapet, butterfly
        roofGroup = makeFlatRoof(bW, bD, parapetH, roofColor, wallColor);
    }

    roofGroup.position.set(0, wallH, 0);
    roofGroup.traverse(obj => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).castShadow    = true;
        (obj as THREE.Mesh).receiveShadow = true;
      }
    });
    scene.add(roofGroup);

    // ── Trees ─────────────────────────────────────────────────────────────────
    const treeMat  = solidMat(0x2d6a2d, 1.0);
    const trunkMat = solidMat(0x6b3a1f, 1.0);
    const treePos: [number, number][] = [
      [-bW * 0.8, bD * 0.7], [bW * 0.8, bD * 0.7],
      [-bW * 0.6, -bD * 0.75], [bW * 0.6, -bD * 0.75],
    ];
    treePos.forEach(([tx, tz]) => {
      const tH = 3.2 + Math.abs(tx % 1.3);
      const cone  = new THREE.Mesh(new THREE.ConeGeometry(0.9, tH, 7), treeMat);
      cone.position.set(tx, tH / 2, tz);
      cone.castShadow = true;
      scene.add(cone);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.7, 6), trunkMat);
      trunk.position.set(tx, 0.35, tz);
      scene.add(trunk);
    });

    // ── Animation loop ────────────────────────────────────────────────────────
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // ── Resize ────────────────────────────────────────────────────────────────
    const onResize = () => {
      if (!el) return;
      const nW = el.clientWidth, nH = el.clientHeight;
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
      renderer.setSize(nW, nH);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      scene.traverse(obj => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry.dispose();
          const mats = Array.isArray((obj as THREE.Mesh).material)
            ? (obj as THREE.Mesh).material as THREE.Material[]
            : [(obj as THREE.Mesh).material as THREE.Material];
          mats.forEach(m => m.dispose());
        }
      });
    };
  }, [schema]);

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100%', minHeight: 520, background: '#c8dff0' }}
    />
  );
}
