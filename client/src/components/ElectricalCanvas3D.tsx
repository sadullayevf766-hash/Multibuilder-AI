import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import type { ElectricalDrawingData, ElectricalSymbol, ElectricalSymbolType } from '../../../shared/types';

export interface ElectricalCanvas3DHandle { exportToImage: (f?: string) => void; }

// ── Constants ──────────────────────────────────────────────────────────────────
const U       = 100;    // canvas units per meter (must match ElectricalEngine)
const ROOM_H  = 2.7;   // ceiling height, meters


// Symbol heights from floor (meters)
const SYM_H: Partial<Record<ElectricalSymbolType, number>> = {
  socket:            0.30,
  socket_double:     0.30,
  socket_waterproof: 0.30,
  socket_tv:         0.30,
  switch:            0.90,
  switch_double:     0.90,
  panel:             1.20,
  light_ceiling:     ROOM_H - 0.02,
  light_waterproof:  ROOM_H - 0.02,
  fan_exhaust:       ROOM_H - 0.12,
};

// Circuit palette matching ElectricalCanvas.tsx
const PALETTE = [0xf59e0b, 0x06b6d4, 0xef4444, 0x8b5cf6, 0x10b981, 0xf97316, 0xec4899];
function circuitHex(cid: string): number {
  const idx = parseInt(cid.replace(/\D/g, '')) || 0;
  return PALETTE[(idx - 1) % PALETTE.length] ?? 0x8b5cf6;
}

// ── 3D helpers ─────────────────────────────────────────────────────────────────
function addEdges(mesh: THREE.Mesh, col = 0x555555, op = 0.5) {
  mesh.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry as THREE.BufferGeometry),
    new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op }),
  ));
}

// ── Symbol builders ────────────────────────────────────────────────────────────

function addSocket(
  scene: THREE.Scene, x: number, y: number, z: number,
  nx: number, nz: number, color: number, type: ElectricalSymbolType,
) {
  const mat = new THREE.MeshPhongMaterial({ color, shininess: 30 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.03), mat);
  body.position.set(x + nx * 0.025, y, z + nz * 0.025);
  if (nx !== 0) body.rotation.y = Math.PI / 2;
  addEdges(body, 0x333, 0.7);
  scene.add(body);

  // Prong holes
  const holeMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
  const offsets = type === 'socket_double' ? [-0.025, 0.025] : [0];
  offsets.forEach(off => {
    const h1 = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.015, 8), holeMat);
    h1.rotation.set(nx !== 0 ? 0 : Math.PI / 2, 0, nx !== 0 ? Math.PI / 2 : 0);
    const hOff = nx !== 0 ? 0 : off;
    const vOff = nx !== 0 ? off : 0;
    h1.position.set(x + nx * 0.042 + (nz !== 0 ? hOff : 0), y + vOff + 0.015, z + nz * 0.042 + (nx !== 0 ? hOff : 0));
    scene.add(h1);
    const h2 = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.015, 8), holeMat);
    h2.rotation.set(nx !== 0 ? 0 : Math.PI / 2, 0, nx !== 0 ? Math.PI / 2 : 0);
    h2.position.set(x + nx * 0.042 + (nz !== 0 ? hOff : 0), y + vOff - 0.015, z + nz * 0.042 + (nx !== 0 ? hOff : 0));
    scene.add(h2);
  });

  // TV socket label
  if (type === 'socket_tv') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 8, 12), new THREE.MeshPhongMaterial({ color: 0x999 }));
    ring.position.set(x + nx * 0.042, y, z + nz * 0.042);
    if (nx !== 0) ring.rotation.y = Math.PI / 2;
    scene.add(ring);
  }
}

function addSwitch(
  scene: THREE.Scene, x: number, y: number, z: number,
  nx: number, nz: number, color: number,
) {
  const mat = new THREE.MeshPhongMaterial({ color: 0xeeeeee });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.025), mat);
  plate.position.set(x + nx * 0.02, y, z + nz * 0.02);
  if (nx !== 0) plate.rotation.y = Math.PI / 2;
  addEdges(plate, 0x888, 0.5);
  scene.add(plate);

  // Lever (rocker)
  const leverMat = new THREE.MeshPhongMaterial({ color });
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), leverMat);
  lever.position.set(x + nx * 0.032, y + 0.015, z + nz * 0.032);
  if (nx !== 0) lever.rotation.y = Math.PI / 2;
  scene.add(lever);
}

function addCeilingLight(
  scene: THREE.Scene, x: number, y: number, z: number,
  color: number, waterproof: boolean,
) {
  // Fixture base
  const baseMat = new THREE.MeshPhongMaterial({ color: 0xddd, shininess: 60 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.035, 20), baseMat);
  base.position.set(x, y - 0.017, z);
  scene.add(base);

  // Bulb / diffuser
  const bulbCol = waterproof ? 0xb0d8ff : 0xfffde7;
  const bulbMat = new THREE.MeshPhongMaterial({
    color: bulbCol, emissive: bulbCol, emissiveIntensity: 0.6, transparent: true, opacity: 0.9,
  });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), bulbMat);
  bulb.position.set(x, y - 0.05, z);
  scene.add(bulb);

  // Waterproof outer ring
  if (waterproof) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.015, 8, 20),
      new THREE.MeshPhongMaterial({ color: 0x888, transparent: true, opacity: 0.8 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y - 0.02, z);
    scene.add(ring);
  }

  // Point light (warm glow)
  const light = new THREE.PointLight(color, 0.9, 5.0, 1.5);
  light.position.set(x, y - 0.1, z);
  scene.add(light);
}

function addFan(scene: THREE.Scene, x: number, y: number, z: number, color: number) {
  const mat = new THREE.MeshPhongMaterial({ color: 0xaaa });
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), mat);
  hub.position.set(x, y, z);
  scene.add(hub);

  // 3 blades
  const bladeMat = new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.7 });
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.07), bladeMat.clone());
    blade.position.set(x + Math.cos((i * 120 * Math.PI) / 180) * 0.1, y - 0.02, z + Math.sin((i * 120 * Math.PI) / 180) * 0.1);
    blade.rotation.y = (i * 120 * Math.PI) / 180;
    scene.add(blade);
  }
}

function addPanel(scene: THREE.Scene, x: number, y: number, z: number, nx: number, nz: number) {
  const boxMat = new THREE.MeshPhongMaterial({ color: 0xe8f4fd, shininess: 20 });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.09), boxMat);
  panel.position.set(x + nx * 0.06, y, z + nz * 0.06);
  if (nx !== 0) panel.rotation.y = Math.PI / 2;
  addEdges(panel, 0x1d4ed8, 0.6);
  scene.add(panel);

  // Circuit breakers (small rects inside)
  const breakerMat = new THREE.MeshPhongMaterial({ color: 0x3b82f6 });
  for (let i = 0; i < 4; i++) {
    const breaker = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.04), breakerMat.clone());
    breaker.position.set(
      x + nx * 0.11 + (nx !== 0 ? 0 : (i % 2 === 0 ? -0.06 : 0.06)),
      y + 0.12 - Math.floor(i / 2) * 0.1,
      z + nz * 0.11 + (nz !== 0 ? 0 : (i % 2 === 0 ? -0.06 : 0.06)),
    );
    if (nx !== 0) breaker.rotation.y = Math.PI / 2;
    scene.add(breaker);
  }
}

// ── Wiring ────────────────────────────────────────────────────────────────────
function addWiring(
  scene: THREE.Scene,
  symbols: ElectricalSymbol[],
  panelX: number, panelZ: number,
  cx: number, cy: number,
) {
  // Group by circuit
  const byCircuit = new Map<string, ElectricalSymbol[]>();
  symbols.forEach(s => {
    const arr = byCircuit.get(s.circuit) ?? [];
    arr.push(s); byCircuit.set(s.circuit, arr);
  });

  const WIRE_Y = ROOM_H - 0.1; // wires run near ceiling

  byCircuit.forEach((syms, cid) => {
    const color = circuitHex(cid);
    const mat = new THREE.LineBasicMaterial({ color });

    syms.forEach(sym => {
      if (sym.type === 'panel') return;
      const sx = (sym.position.x - cx) / U;
      const sz = (sym.position.y - cy) / U;
      const sy = SYM_H[sym.type] ?? 0.5;

      // L-shaped wire: panel → ceiling junction → drop to symbol
      const pts = [
        new THREE.Vector3(panelX, WIRE_Y, panelZ),
        new THREE.Vector3(sx,     WIRE_Y, panelZ),
        new THREE.Vector3(sx,     WIRE_Y, sz),
        new THREE.Vector3(sx,     sy + 0.08, sz),
      ];
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    });
  });
}

// ── Main component ─────────────────────────────────────────────────────────────
const ElectricalCanvas3D = forwardRef<ElectricalCanvas3DHandle, { data: ElectricalDrawingData; width?: number }>(
  function ElectricalCanvas3D({ data, width = 900 }, ref) {
    const mountRef  = useRef<HTMLDivElement>(null);
    const rendRef   = useRef<THREE.WebGLRenderer | null>(null);
    const stateRef  = useRef({ radius: 2.8, theta: Math.PI * 0.25, phi: 1.15 });

    useImperativeHandle(ref, () => ({
      exportToImage(filename = 'elektrik-3d.png') {
        if (!rendRef.current) return;
        Object.assign(document.createElement('a'), {
          href: rendRef.current.domElement.toDataURL('image/png'), download: filename,
        }).click();
      },
    }));

    useEffect(() => {
      const el = mountRef.current;
      if (!el) return;
      rendRef.current?.dispose();
      while (el.firstChild) el.removeChild(el.firstChild);

      const { walls, symbols } = data;

      // ── Room dimensions from walls bounding box ──────────────────────────
      const allX = walls.flatMap(w => [w.start.x, w.end.x]);
      const allY = walls.flatMap(w => [w.start.y, w.end.y]);
      const minX = Math.min(...allX), maxX = Math.max(...allX);
      const minY = Math.min(...allY), maxY = Math.max(...allY);
      const W_m  = (maxX - minX) / U;   // room width in meters
      const L_m  = (maxY - minY) / U;   // room length in meters
      const cx   = (minX + maxX) / 2;   // canvas center x
      const cy   = (minY + maxY) / 2;   // canvas center y

      const height = Math.round(width * 0.58);

      // ── Scene ──────────────────────────────────────────────────────────────
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f4f8);
      scene.fog = new THREE.FogExp2(0xf0f4f8, 0.06);

      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const sun = new THREE.DirectionalLight(0xfff8e7, 0.6);
      sun.position.set(W_m, ROOM_H * 3, L_m);
      scene.add(sun);

      // ── Room shell — dollhouse style (no ceiling, semi-transparent walls) ───
      const wallMat  = new THREE.MeshPhongMaterial({
        color: 0xf5f0e8, side: THREE.DoubleSide, shininess: 5,
        transparent: true, opacity: 0.38,
      });
      const floorMat = new THREE.MeshPhongMaterial({ color: 0xcba87a, shininess: 15 });

      // Floor
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(W_m, L_m), floorMat);
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);

      // No ceiling — dollhouse open-top so symbols visible from above

      // Four walls (slightly thick box for depth)
      const wallH = ROOM_H + 0.02;
      const wallDefs: [number, number, number, number, number, number][] = [
        // [gW, gH, gD, px, py, pz]
        [W_m, wallH, 0.12, 0,        wallH/2, -L_m/2],  // North
        [W_m, wallH, 0.12, 0,        wallH/2,  L_m/2],  // South
        [0.12, wallH, L_m + 0.12, -W_m/2, wallH/2, 0],  // West
        [0.12, wallH, L_m + 0.12,  W_m/2, wallH/2, 0],  // East
      ];
      wallDefs.forEach(([gW2, gH, gD, px, py, pz]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(gW2, gH, gD), wallMat.clone());
        m.position.set(px, py, pz);
        addEdges(m, 0x888, 0.3);
        scene.add(m);
      });

      // Baseboard strip (solid, marks floor level)
      const boardMat = new THREE.MeshPhongMaterial({ color: 0xd5cdc0 });
      [
        [W_m + 0.12, 0.07, 0.12, 0, 0.035, -L_m/2],
        [W_m + 0.12, 0.07, 0.12, 0, 0.035,  L_m/2],
        [0.12, 0.07, L_m + 0.12, -W_m/2, 0.035, 0],
        [0.12, 0.07, L_m + 0.12,  W_m/2, 0.035, 0],
      ].forEach(([gW2, gH, gD, px, py, pz]) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(gW2 as number, gH as number, gD as number), boardMat.clone());
        b.position.set(px as number, py as number, pz as number);
        scene.add(b);
      });

      // ── Electrical symbols ─────────────────────────────────────────────────
      let panelX = 0, panelZ = -L_m / 2 + 0.3;  // default panel position

      symbols.forEach(sym => {
        const sx = (sym.position.x - cx) / U;
        const sz = (sym.position.y - cy) / U;
        const sy = SYM_H[sym.type] ?? 0.5;
        const color = circuitHex(sym.circuit);

        // Wall normal (direction away from wall into room)
        let nx = 0, nz = 0;
        if (sym.wall === 'north') nz =  1;
        else if (sym.wall === 'south') nz = -1;
        else if (sym.wall === 'west')  nx =  1;
        else if (sym.wall === 'east')  nx = -1;

        switch (sym.type) {
          case 'socket':
          case 'socket_double':
          case 'socket_waterproof':
          case 'socket_tv':
            addSocket(scene, sx, sy, sz, nx, nz, color, sym.type);
            break;
          case 'switch':
          case 'switch_double':
            addSwitch(scene, sx, sy, sz, nx, nz, color);
            break;
          case 'light_ceiling':
          case 'light_waterproof':
            addCeilingLight(scene, sx, sy, sz, color, sym.type === 'light_waterproof');
            break;
          case 'fan_exhaust':
            addFan(scene, sx, sy, sz, color);
            break;
          case 'panel':
            panelX = sx; panelZ = sz;
            addPanel(scene, sx, sy, sz, nx, nz);
            break;
        }
      });

      // ── Wiring ─────────────────────────────────────────────────────────────
      addWiring(scene, symbols, panelX, panelZ, cx, cy);

      // ── Perspective camera (inside room) ───────────────────────────────────
      const camera = new THREE.PerspectiveCamera(68, width / height, 0.01, 100);
      const st = stateRef.current;
      // Dollhouse: camera above-outside, looking down into the open-top room
      st.radius = Math.max(W_m, L_m) * 1.4;
      st.theta  = Math.PI * 0.3;   // south-east angle
      st.phi    = 0.72;             // ~41° from vertical → bird's-eye-ish

      const target = new THREE.Vector3(0, ROOM_H * 0.4, 0);

      const updateCam = () => {
        const { radius, theta, phi } = st;
        camera.position.set(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi) + ROOM_H * 0.4,
          radius * Math.sin(phi) * Math.sin(theta),
        );
        camera.lookAt(target);
      };
      updateCam();

      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      rendRef.current = renderer;
      el.appendChild(renderer.domElement);
      renderer.render(scene, camera);

      // ── HUD ────────────────────────────────────────────────────────────────
      const hint = document.createElement('div');
      hint.textContent = '🖱 Drag: aylan  |  Scroll: kattalashtir  |  📸 PNG';
      Object.assign(hint.style, {
        position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.45)', color: '#fff', padding: '3px 10px',
        borderRadius: '20px', fontSize: '11px', pointerEvents: 'none', whiteSpace: 'nowrap',
      });
      el.style.position = 'relative';
      el.appendChild(hint);

      const render = () => renderer.render(scene, camera);

      // ── Mouse orbit ─────────────────────────────────────────────────────────
      let drag = false, prev = { x: 0, y: 0 };
      const onDown  = (e: MouseEvent) => { drag = true;  prev = { x: e.clientX, y: e.clientY }; };
      const onMove  = (e: MouseEvent) => {
        if (!drag) return;
        st.theta -= (e.clientX - prev.x) * 0.013;
        st.phi    = Math.max(0.1, Math.min(Math.PI * 0.88, st.phi + (e.clientY - prev.y) * 0.013));
        prev = { x: e.clientX, y: e.clientY };
        updateCam(); render();
      };
      const onUp    = () => { drag = false; };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const maxR = Math.max(W_m, L_m) * 3.0;  // allow zooming far out
        st.radius = Math.max(0.05, Math.min(maxR, st.radius * (1 - e.deltaY * 0.0012)));
        updateCam(); render();
      };

      renderer.domElement.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup',   onUp);
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

      return () => {
        renderer.domElement.removeEventListener('mousedown', onDown);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup',   onUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
        renderer.dispose();
        rendRef.current = null;
        while (el.firstChild) el.removeChild(el.firstChild);
      };
    }, [data, width]);

    return <div ref={mountRef} className="w-full cursor-grab active:cursor-grabbing" style={{ userSelect: 'none' }} />;
  }
);

export default ElectricalCanvas3D;
