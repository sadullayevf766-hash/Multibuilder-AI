/**
 * WarmFloorAxonCanvas — Three.js 3D, 360° aylanadigan sxema
 *
 * PDF 7-sahifa uslubi, haqiqiy 3D:
 *  - OrbitControls: sichqoncha bilan aylantirib, zoom, pan
 *  - Har xona: tekis parallelpiped (pol sathi)
 *  - Snake konturlar: 3D chiziqlar pol ustida
 *  - Kollektorlar: 3D box + konturlar
 *  - Stoyaklar: vertikal silindrlar
 *  - Nasos, elevatsiya belgilari
 */
import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import jsPDF from 'jspdf';
import type {
  WarmFloorSchema,
  WarmFloorFloor,
  WarmFloorContour,
} from '../../../server/src/engine/WarmFloorEngine';

export interface WarmFloorAxonCanvasHandle {
  exportToPdf: (filename?: string) => void;
}
interface Props { schema: WarmFloorSchema; width?: number; }

// ─── O'lcham ─────────────────────────────────────────────────────────────────
const M = 1.0;           // 1 metr = 1 Three.js unit
const FLOOR_H = 3.2;     // qavatlar orasidagi balandlik (m)
const SLAB_T  = 0.12;    // pol sathi qalinligi (m)
const PIPE_R  = 0.035;   // quvur radiusi
const PIPE_SEG = 6;      // quvur segment soni (sifat/perf balans)

// ─── Materiallar ──────────────────────────────────────────────────────────────
function mats() {
  return {
    room:    new THREE.MeshLambertMaterial({ color: 0xfef08a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }),
    roomEdge:new THREE.LineBasicMaterial({ color: 0xb45309, linewidth: 2 }),
    sup:     new THREE.MeshLambertMaterial({ color: 0xdc2626, emissive: 0x660000, emissiveIntensity: 0.15 }),
    ret:     new THREE.MeshLambertMaterial({ color: 0x2563eb, emissive: 0x000066, emissiveIntensity: 0.15 }),
    supLine: new THREE.LineBasicMaterial({ color: 0xef4444 }),
    retLine: new THREE.LineBasicMaterial({ color: 0x3b82f6 }),
    coll:    new THREE.MeshLambertMaterial({ color: 0x7c3aed, emissive: 0x3b1f7f, emissiveIntensity: 0.2 }),
    collBody:new THREE.MeshLambertMaterial({ color: 0xede9fe }),
    pump:    new THREE.MeshLambertMaterial({ color: 0xd97706, emissive: 0x7c3f00, emissiveIntensity: 0.2 }),
    pumpBody:new THREE.MeshLambertMaterial({ color: 0xfef3c7 }),
    main:    new THREE.MeshLambertMaterial({ color: 0x475569 }),
    grid:    new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
    text3d:  new THREE.MeshBasicMaterial({ color: 0x1e293b }),
  };
}

// ─── Helper: silindrik quvur ──────────────────────────────────────────────────
function addCylinder(
  group: THREE.Group | THREE.Scene,
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  radius: number,
  mat: THREE.Material,
): THREE.Mesh {
  const dir = new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1);
  const len = dir.length();
  if (len < 0.001) return new THREE.Mesh();
  const geom = new THREE.CylinderGeometry(radius, radius, len, PIPE_SEG);
  const mesh = new THREE.Mesh(geom, mat);
  const mid  = new THREE.Vector3((x1+x2)/2, (y1+y2)/2, (z1+z2)/2);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
  group.add(mesh);
  return mesh;
}

// ─── Helper: chiziq ───────────────────────────────────────────────────────────
function addLine(
  group: THREE.Group | THREE.Scene,
  points: number[][],
  mat: THREE.LineBasicMaterial,
) {
  const pts = points.map(([x,y,z]) => new THREE.Vector3(x, y, z));
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  group.add(new THREE.Line(geom, mat));
}

// ─── Helper: kichik kub (ulanish joyi) ───────────────────────────────────────
function addBox(
  group: THREE.Group | THREE.Scene,
  x: number, y: number, z: number,
  w: number, h: number, d: number,
  mat: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

// ─── Helper: tekis to'rtburchak (pol sathi yuqori ko'rinishi) ─────────────────
function addFlatRect(
  group: THREE.Group | THREE.Scene,
  x: number, y: number, z: number,
  w: number, d: number, h: number,
  mat: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x + w/2, y + h/2, z + d/2);
  group.add(mesh);

  // Qirralar (wireframe)
  const edges = new THREE.EdgesGeometry(mesh.geometry);
  const line  = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xb45309, linewidth: 1.5 }));
  line.position.copy(mesh.position);
  group.add(line);
}

// ─── Snake konturlar — haqiqiy 3D silindrik quvurlar ────────────────────────
function buildSnake(
  group: THREE.Group | THREE.Scene,
  ox: number, oy: number, oz: number,
  roomW: number, roomD: number,
  contours: WarmFloorContour[],
  _unused1: THREE.LineBasicMaterial,
  _unused2: THREE.LineBasicMaterial,
) {
  const nC   = Math.max(1, contours.length);
  const colW = roomW / nC;
  const step = 0.22;   // qadam metrda
  const mg   = 0.12;   // devordan masofa
  const pr   = 0.042;  // quvur radiusi — ko'rinadigan bo'lsin
  const yPos = oy + SLAB_T + pr + 0.01; // pol sathining tepasida

  contours.forEach((cont, ci) => {
    const x0    = ox + ci * colW + mg;
    const x1    = ox + ci * colW + colW - mg;
    const z0    = oz + mg;
    const z1    = oz + roomD - mg;
    const nL    = Math.max(2, Math.round((z1 - z0) / step));
    const color = ci % 2 === 0 ? 0xef4444 : 0x3b82f6;
    const mat   = new THREE.MeshLambertMaterial({ color,
      emissive: ci % 2 === 0 ? 0x660000 : 0x000044,
      emissiveIntensity: 0.2,
    });

    let right = true;
    for (let li = 0; li <= nL; li++) {
      const z  = z0 + li * (z1 - z0) / nL;
      const xS = right ? x0 : x1;
      const xE = right ? x1 : x0;

      // Gorizontal quvur
      addCylinder(group, xS, yPos, z, xE, yPos, z, pr, mat);

      // U-turn (vertikal/diagonal)
      if (li < nL) {
        const zn = z0 + (li + 1) * (z1 - z0) / nL;
        addCylinder(group, xE, yPos, z, xE, yPos, zn, pr, mat);
      }
      right = !right;
    }

    // Kontur raqami ring
    const mcx = (x0 + x1) / 2;
    const mcz = (z0 + z1) / 2;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.05, 8, 16),
      new THREE.MeshLambertMaterial({ color }),
    );
    ring.position.set(mcx, yPos + 0.06, mcz);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    void cont;
  });
}

// ─── Kollektor 3D ─────────────────────────────────────────────────────────────
function buildCollector(
  group: THREE.Group | THREE.Scene,
  x: number, y: number, z: number,
  nContours: number,
  M: ReturnType<typeof mats>,
) {
  const W = 0.3, H = 0.08 + nContours * 0.06, D = 0.12;

  // Asosiy korpus
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), M.collBody);
  body.position.set(x, y + H/2, z);
  group.add(body);

  // Header
  const hdr = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, D + 0.02), M.coll);
  hdr.position.set(x, y + H + 0.03, z);
  group.add(hdr);

  // Korpus qirralari
  const be = new THREE.EdgesGeometry(body.geometry);
  const bl = new THREE.LineSegments(be, new THREE.LineBasicMaterial({ color: 0x553c9a, linewidth: 2 }));
  bl.position.copy(body.position);
  group.add(bl);

  // Kontur chiziqlari kollektorda
  const show = Math.min(nContours, 8);
  for (let i = 0; i < show; i++) {
    const cy = y + 0.06 + i * 0.06;
    const col = i % 2 === 0 ? 0xef4444 : 0x3b82f6;
    addLine(group, [[x - W/2 + 0.02, cy, z - D/2 - 0.01], [x + W/2 - 0.02, cy, z - D/2 - 0.01]],
      new THREE.LineBasicMaterial({ color: col, linewidth: 2 }));
  }

  // Kirish/chiqish quvurlar
  addCylinder(group, x - W/2 - 0.2, y + H * 0.7, z, x - W/2, y + H * 0.7, z, PIPE_R * 1.5, M.sup);
  addCylinder(group, x - W/2 - 0.2, y + H * 0.4, z, x - W/2, y + H * 0.4, z, PIPE_R * 1.5, M.ret);
  addCylinder(group, x + W/2, y + H * 0.7, z, x + W/2 + 0.15, y + H * 0.7, z, PIPE_R * 1.5, M.sup);
  addCylinder(group, x + W/2, y + H * 0.4, z, x + W/2 + 0.15, y + H * 0.4, z, PIPE_R * 1.5, M.ret);

  return { H, top: y + H + 0.06 };
}

// ─── Nasos 3D ─────────────────────────────────────────────────────────────────
function buildPump(
  group: THREE.Group | THREE.Scene,
  x: number, y: number, z: number,
  M: ReturnType<typeof mats>,
) {
  // Korpus
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.24, 16), M.pumpBody);
  body.position.set(x, y, z);
  group.add(body);

  // Markaziy disk
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.28, 16), M.pump);
  disk.position.set(x, y, z);
  group.add(disk);

  // Qirralar
  const be = new THREE.EdgesGeometry(body.geometry);
  const bl = new THREE.LineSegments(be, new THREE.LineBasicMaterial({ color: 0xd97706, linewidth: 2 }));
  bl.position.copy(body.position);
  group.add(bl);

  // Kirish/chiqish shtutser
  addCylinder(group, x, y + 0.12, z, x, y + 0.35, z, PIPE_R * 2.5, M.sup);
  addCylinder(group, x + 0.18, y, z, x + 0.40, y, z, PIPE_R * 2.5, M.ret);
}

// ─── Asosiy sahna qurilishi ────────────────────────────────────────────────────
function buildScene(scene: THREE.Scene, schema: WarmFloorSchema) {
  const MAT    = mats();
  const floors = [...schema.floors].sort((a, b) => a.floorNumber - b.floorNumber);
  const nF     = floors.length;

  // ── Xonalarning max 1-qator kengligi (stoyak uchun) ────────────────────────
  // Har qavat uchun 1-qatordagi xonalar yig'indisi
  let maxRowW = 0;
  floors.forEach(floor => {
    const nCols = Math.ceil(Math.sqrt(floor.rooms.length + 0.5));
    let rowW = 0;
    floor.rooms.slice(0, nCols).forEach(r => { rowW += r.width * M + 0.25; });
    maxRowW = Math.max(maxRowW, rowW);
  });

  // Stoyak: xonalar o'ng tomonida 1.5m uzoqda
  const stoyakX = maxRowW + 1.2;
  const stoyakZ = 2.5;

  // ── Grid ──────────────────────────────────────────────────────────────────
  const gridSize = Math.max(stoyakX + 4, 20);
  const gridH = new THREE.GridHelper(gridSize * 2, gridSize * 2, 0xd1d5db, 0xe5e7eb);
  gridH.position.set(stoyakX / 2, -0.02, stoyakZ / 2);
  scene.add(gridH);

  // ── Har qavat ─────────────────────────────────────────────────────────────
  floors.forEach((floor, fi) => {
    const baseY  = fi * FLOOR_H;
    const nCols  = Math.ceil(Math.sqrt(floor.rooms.length + 0.5));
    let curX     = 0;
    let curZ     = 0;
    let rowMaxZ  = 0;
    let col      = 0;
    let maxEndX  = 0;  // bu qavatdagi eng katta X

    floor.rooms.forEach(room => {
      const rW = room.width  * M;
      const rD = room.length * M;

      if (col >= nCols) {
        curX = 0; curZ += rowMaxZ + 0.25;
        rowMaxZ = 0; col = 0;
      }

      // ── Pol sathi (sariq plita) ──────────────────────────────────────────
      addFlatRect(scene, curX, baseY, curZ, rW, rD, SLAB_T, MAT.room);

      // ── Snake konturlar ──────────────────────────────────────────────────
      const rc = floor.contours.filter(c => c.roomId === room.id);
      if (rc.length > 0) {
        buildSnake(scene, curX, baseY, curZ, rW, rD, rc, MAT.supLine, MAT.retLine);
      }

      maxEndX  = Math.max(maxEndX, curX + rW);
      rowMaxZ  = Math.max(rowMaxZ, rD);
      curX    += rW + 0.25;
      col++;
    });

    // ── Gorizontal magistral: xonalar → stoyak ────────────────────────────
    const pipeY_sup = baseY + 0.9;
    const pipeY_ret = baseY + 0.6;

    // Supply (xonalardan o'ngga stoyakka)
    addCylinder(scene, maxEndX + 0.1, pipeY_sup, stoyakZ, stoyakX, pipeY_sup, stoyakZ, PIPE_R * 2, MAT.sup);
    // Return
    addCylinder(scene, maxEndX + 0.1, pipeY_ret, stoyakZ, stoyakX, pipeY_ret, stoyakZ, PIPE_R * 2, MAT.ret);

    // ── Kollektor ──────────────────────────────────────────────────────────
    const totalDepth = curZ + rowMaxZ;
    floor.collectors.forEach((coll, ci) => {
      const cX = maxEndX + 0.3 + ci * 0.6;
      const cZ = stoyakZ + 0.3 + ci * 0.8;
      buildCollector(scene, cX, baseY + 0.4, cZ, coll.contours.length, MAT);

      // Kollektor → magistral quvur
      addCylinder(scene, cX, pipeY_sup, cZ, cX, pipeY_sup, stoyakZ, PIPE_R * 1.5, MAT.sup);
      addCylinder(scene, cX, pipeY_ret, cZ, cX, pipeY_ret, stoyakZ, PIPE_R * 1.5, MAT.ret);
    });

    // ── Elevatsiya belgisi ────────────────────────────────────────────────
    const eX = -0.8;
    const eZ = totalDepth / 2;
    const elvLabel = (floor.elevation >= 0 ? '+' : '') + floor.elevation.toFixed(3);
    addLine(scene, [[eX, baseY, eZ], [eX, baseY + 0.5, eZ]],
      new THREE.LineBasicMaterial({ color: 0x059669, linewidth: 3 }));
    addLine(scene, [[eX - 0.2, baseY, eZ], [eX + 0.2, baseY, eZ]],
      new THREE.LineBasicMaterial({ color: 0x059669, linewidth: 2 }));
    // Tom elevatsiyasi — birinchi qavat ustida
    if (fi === 0) {
      const topY = baseY + FLOOR_H;
      addLine(scene, [[eX, topY, eZ], [eX, topY + 0.5, eZ]],
        new THREE.LineBasicMaterial({ color: 0x059669, linewidth: 3 }));
      addLine(scene, [[eX-0.2, topY, eZ], [eX+0.2, topY, eZ]],
        new THREE.LineBasicMaterial({ color: 0x059669, linewidth: 2 }));
    }
    void elvLabel; // matn CSS overlay da ko'rsatiladi
  });

  // ── Vertikal magistral stoyak ──────────────────────────────────────────────
  const stoyBot = -0.6;
  const stoyTop = nF * FLOOR_H + 0.5;
  // Supply (qizil) — qalin
  addCylinder(scene, stoyakX,        stoyBot, stoyakZ,       stoyakX,        stoyTop, stoyakZ,       PIPE_R * 4, MAT.sup);
  // Return (ko'k) — qalin
  addCylinder(scene, stoyakX + 0.15, stoyBot, stoyakZ,       stoyakX + 0.15, stoyTop, stoyakZ,       PIPE_R * 4, MAT.ret);

  // ── Nasos ──────────────────────────────────────────────────────────────────
  buildPump(scene, stoyakX + 0.06, stoyBot - 0.7, stoyakZ, MAT);

  // ── Qozonxona pastga ──────────────────────────────────────────────────────
  addCylinder(scene, stoyakX + 0.06, stoyBot - 0.7, stoyakZ, stoyakX + 0.06, stoyBot - 1.5, stoyakZ, PIPE_R * 3.5, MAT.main);
}

// ─── Komponent ────────────────────────────────────────────────────────────────
const WarmFloorAxonCanvas = forwardRef<WarmFloorAxonCanvasHandle, Props>(
  function WarmFloorAxonCanvas({ schema, width = 1100 }, ref) {
    const mountRef     = useRef<HTMLDivElement>(null);
    const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef     = useRef<THREE.Scene | null>(null);
    const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef  = useRef<OrbitControls | null>(null);
    const animRef      = useRef<number>(0);
    const [hint, setHint] = useState(true);

    useImperativeHandle(ref, () => ({
      exportToPdf(filename = 'warm-floor-3d.pdf') {
        const renderer = rendererRef.current;
        if (!renderer) return;
        renderer.render(sceneRef.current!, cameraRef.current!);
        const url = renderer.domElement.toDataURL('image/png');
        const w   = renderer.domElement.width;
        const h   = renderer.domElement.height;
        const pdf = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] });
        pdf.addImage(url, 'PNG', 0, 0, w, h);
        pdf.save(filename);
      },
    }));

    const resetView = useCallback(() => {
      const cam   = cameraRef.current;
      const ctrl  = controlsRef.current;
      const scene = sceneRef.current;
      if (!cam || !ctrl || !scene) return;
      const box    = new THREE.Box3().setFromObject(scene);
      const center = new THREE.Vector3();
      const size   = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const dist   = maxDim * 1.4;
      cam.position.set(center.x + dist*0.7, center.y + dist*0.6, center.z + dist*0.8);
      cam.lookAt(center);
      ctrl.target.copy(center);
      ctrl.update();
    }, []);

    useEffect(() => {
      if (!mountRef.current || !schema) return;

      const height = 600;

      // ── Renderer ──────────────────────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0xf8fafc);
      renderer.shadowMap.enabled = true;
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // ── Sahna ─────────────────────────────────────────────────────────────
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf8fafc);
      sceneRef.current = scene;

      // Chiroqlar
      const ambLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
      dirLight.position.set(15, 20, 10);
      dirLight.castShadow = true;
      scene.add(dirLight);
      const fillLight = new THREE.DirectionalLight(0xddeeff, 0.4);
      fillLight.position.set(-10, 10, -10);
      scene.add(fillLight);

      // ── Sahna bbox dan kamera pozitsiyasini hisoblash ──────────────────────
      const nF = schema.floors.length;

      // Sahnani build qilish, keyin bbox hisoblash
      buildScene(scene, schema);

      const box = new THREE.Box3().setFromObject(scene);
      const center = new THREE.Vector3();
      const size   = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, maxDim * 10);
      // Kamera: sahnaning diagonal burchagidan, biroz yuqoridan qarash
      const camDist = maxDim * 1.4;
      camera.position.set(
        center.x + camDist * 0.7,
        center.y + camDist * 0.6,
        center.z + camDist * 0.8,
      );
      camera.lookAt(center);
      cameraRef.current = camera;

      // ── Controls ──────────────────────────────────────────────────────────
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping     = true;
      controls.dampingFactor     = 0.06;
      controls.screenSpacePanning = true;
      controls.minDistance       = maxDim * 0.15;
      controls.maxDistance       = maxDim * 4;
      controls.target.copy(center);
      controls.update();
      controlsRef.current = controls;

      // buildScene yuqorida bbox uchun chaqirildi — bu yerda qayta chaqirmang

      // ── Animation loop ────────────────────────────────────────────────────
      let rafId: number;
      function animate() {
        rafId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      }
      animate();
      animRef.current = rafId!;

      // ── Resize ────────────────────────────────────────────────────────────
      function onResize() {
        if (!mountRef.current) return;
        const w = mountRef.current.clientWidth;
        renderer.setSize(w, height);
        camera.aspect = w / height;
        camera.updateProjectionMatrix();
      }
      window.addEventListener('resize', onResize);

      // Hint 3 soniyada yashir
      const t = setTimeout(() => setHint(false), 3000);

      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', onResize);
        clearTimeout(t);
        controls.dispose();
        renderer.dispose();
        if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
          mountRef.current.removeChild(renderer.domElement);
        }
        rendererRef.current  = null;
        sceneRef.current     = null;
        cameraRef.current    = null;
        controlsRef.current  = null;
      };
    }, [schema, width]);

    return (
      <div className="flex flex-col border border-slate-700 rounded-xl overflow-hidden w-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-700 shrink-0">
          <span className="text-xs text-slate-400">
            🔧 3D Aksonometrik · Sol klik = aylanish · O'ng klik = pan · Scroll = zoom
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={resetView}
              className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            >
              ↺ Reset
            </button>
          </div>
        </div>

        {/* Three.js canvas container */}
        <div className="relative w-full bg-[#f8fafc]">
          <div ref={mountRef} className="w-full" style={{ height: 600 }} />

          {/* Ko'rsatma */}
          {hint && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-4 py-2 rounded-full pointer-events-none transition-opacity">
              🖱️ Sichqoncha bilan aylantirib ko'ring
            </div>
          )}

          {/* Schema info */}
          <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur text-xs text-slate-300 rounded-lg p-2.5 space-y-1 min-w-[160px]">
            <div className="text-slate-400 font-semibold text-[10px] uppercase tracking-wide mb-1.5">Parametrlar</div>
            {[
              ['Truba',       schema.systemParams.pipeType],
              ['T° pod/obr',  `${schema.systemParams.supplyTemp}/${schema.systemParams.returnTemp}°C`],
              ['Maydon',      `${schema.totalAreaM2.toFixed(1)} m²`],
              ['Yuk',         `${(schema.totalHeatW/1000).toFixed(1)} кВт`],
              ['Qozon',       `${schema.heatSourceKw} кВт`],
            ].map(([k,v]) => (
              <div key={k} className="flex justify-between gap-3">
                <span className="text-slate-500">{k}</span>
                <span className="text-slate-200 font-medium">{v}</span>
              </div>
            ))}
          </div>

          {/* Legenda */}
          <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur text-xs rounded-lg p-2.5 space-y-1.5">
            {[
              { color: '#ef4444', label: 'Подача (supply)' },
              { color: '#3b82f6', label: 'Обратная (return)' },
              { color: '#7c3aed', label: 'Коллектор' },
              { color: '#d97706', label: 'Насос' },
              { color: '#fef9c3', label: 'Pol sathlari' },
            ].map(lg => (
              <div key={lg.label} className="flex items-center gap-2">
                <div className="w-6 h-2.5 rounded-sm" style={{ background: lg.color }} />
                <span className="text-slate-300">{lg.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
);

export default WarmFloorAxonCanvas;
