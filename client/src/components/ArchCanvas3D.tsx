import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import type { ArchDrawingData, ElevationData } from '../../../shared/types';

export interface ArchCanvas3DHandle { exportToImage: (f?: string) => void; }

// ── Constants ──────────────────────────────────────────────────────────────────
const WALL_T     = 0.25;
const ROOF_T     = 0.2;
const SLAB_T     = 0.12;
const GROUND_EXT = 3.0;

function addEdges(mesh: THREE.Mesh, col = 0x444444, op = 0.5) {
  mesh.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry as THREE.BufferGeometry),
    new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op }),
  ));
}

// ── Openings ──────────────────────────────────────────────────────────────────
function addOpenings(
  scene: THREE.Scene,
  elev: ElevationData,
  side: 'south' | 'north' | 'west' | 'east',
  W: number, D: number,
) {
  const isNS   = side === 'south' || side === 'north';
  const wallW  = isNS ? W : D;
  const wallZ  = side === 'south'  ?  D / 2 + WALL_T / 2
               : side === 'north'  ? -(D / 2 + WALL_T / 2)
               : side === 'west'   ? -(W / 2 + WALL_T / 2)
               :                      W / 2 + WALL_T / 2;
  const eps    = 0.012;

  elev.openings.forEach(op => {
    const centre = -wallW / 2 + op.xOffset + op.width / 2;
    const opY    = op.sillHeight + op.height / 2;
    const dir    = (side === 'south' || side === 'east') ? 1 : -1;

    let pos: THREE.Vector3;
    let bW: number, bD: number;
    if (isNS) {
      pos = new THREE.Vector3(centre, opY, wallZ + dir * eps);
      bW  = op.width; bD = WALL_T * 0.55;
    } else {
      pos = new THREE.Vector3(wallZ + dir * eps, opY, centre);
      bW  = WALL_T * 0.55; bD = op.width;
    }

    if (op.type === 'door') {
      const mat  = new THREE.MeshPhongMaterial({ color: 0x92400e, transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(bW, op.height, bD), mat);
      mesh.position.copy(pos);
      addEdges(mesh, 0x5d2906, 0.7);
      scene.add(mesh);
    } else {
      // Glass pane
      const glassMat = new THREE.MeshPhongMaterial({
        color: 0xbfdbfe, transparent: true, opacity: 0.45, side: THREE.DoubleSide, shininess: 80,
      });
      const plane = new THREE.Mesh(
        isNS ? new THREE.PlaneGeometry(op.width, op.height) : new THREE.PlaneGeometry(op.width, op.height),
        glassMat,
      );
      if (!isNS) plane.rotation.y = Math.PI / 2;
      plane.position.copy(pos);
      scene.add(plane);

      // Frame
      const frameMat = new THREE.MeshPhongMaterial({ color: 0x1e40af });
      const fx = isNS ? op.width + 0.05 : WALL_T * 0.22;
      const fd = isNS ? WALL_T * 0.22   : op.width + 0.05;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(fx, op.height + 0.05, fd), frameMat);
      frame.position.copy(pos);
      addEdges(frame, 0x1e3a8a, 0.8);
      scene.add(frame);

      // Horizontal muntin
      const mW = isNS ? op.width + 0.03 : WALL_T * 0.18;
      const mD = isNS ? WALL_T * 0.18   : op.width + 0.03;
      const muntin = new THREE.Mesh(new THREE.BoxGeometry(mW, 0.04, mD), frameMat.clone());
      muntin.position.set(pos.x, opY, pos.z);
      scene.add(muntin);
    }
  });
}

// ── Interior room details ──────────────────────────────────────────────────────
function buildInterior(scene: THREE.Scene, W: number, D: number, H: number) {
  // Interior floor (wood)
  const floorMat = new THREE.MeshPhongMaterial({ color: 0xd4a76a, shininess: 30 });
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W - WALL_T * 2, D - WALL_T * 2), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, SLAB_T * 0.5, 0);
  scene.add(floorMesh);

  // Baseboard strip
  const boardMat = new THREE.MeshPhongMaterial({ color: 0xf5f0e8 });
  const bH = 0.08, bT = 0.03;
  [
    [new THREE.BoxGeometry(W - WALL_T * 2, bH, bT), 0, bH / 2,  D / 2 - WALL_T - bT / 2],
    [new THREE.BoxGeometry(W - WALL_T * 2, bH, bT), 0, bH / 2, -D / 2 + WALL_T + bT / 2],
    [new THREE.BoxGeometry(bT, bH, D - WALL_T * 2), -W / 2 + WALL_T + bT / 2, bH / 2, 0],
    [new THREE.BoxGeometry(bT, bH, D - WALL_T * 2),  W / 2 - WALL_T - bT / 2, bH / 2, 0],
  ].forEach(([geo, px, py, pz]) => {
    const m = new THREE.Mesh(geo as THREE.BufferGeometry, boardMat.clone());
    m.position.set(px as number, py as number, pz as number);
    scene.add(m);
  });

  // Ceiling light (fixture)
  const lightBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 8),
    new THREE.MeshPhongMaterial({ color: 0xfffde7, emissive: 0xffffaa, emissiveIntensity: 0.8 }),
  );
  lightBulb.position.set(0, H - 0.18, 0);
  scene.add(lightBulb);

  // Point light from ceiling
  const pointLight = new THREE.PointLight(0xfff8e1, 1.2, H * 3);
  pointLight.position.set(0, H - 0.2, 0);
  scene.add(pointLight);
}

// ── Main component ─────────────────────────────────────────────────────────────
const ArchCanvas3D = forwardRef<ArchCanvas3DHandle, { data: ArchDrawingData; width?: number }>(
  function ArchCanvas3D({ data, width = 900 }, ref) {
    const mountRef    = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const stateRef    = useRef({ radius: 10, theta: Math.PI * 0.35, phi: 1.0, raf: 0 });

    useImperativeHandle(ref, () => ({
      exportToImage(filename = 'arxitektura-3d.png') {
        if (!rendererRef.current) return;
        const url = rendererRef.current.domElement.toDataURL('image/png');
        Object.assign(document.createElement('a'), { href: url, download: filename }).click();
      },
    }));

    useEffect(() => {
      const el = mountRef.current;
      if (!el) return;

      rendererRef.current?.dispose();
      rendererRef.current = null;
      cancelAnimationFrame(stateRef.current.raf);
      while (el.firstChild) el.removeChild(el.firstChild);

      const { elevations, section } = data;
      const W = elevations[0]?.wallWidth ?? section.totalWidth;
      const D = elevations[2]?.wallWidth ?? (section.rooms[0]?.width ?? 5);
      const H = section.floorHeight;
      const height = Math.round(width * 0.58);

      // ── Scene ──────────────────────────────────────────────────────────────
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xe8edf2);
      scene.fog = new THREE.FogExp2(0xe8edf2, 0.04);

      // Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const sun = new THREE.DirectionalLight(0xfffbf0, 1.0);
      sun.position.set(W * 2, H * 5, D * 2);
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xd0e8ff, 0.35);
      fill.position.set(-W, H * 2, -D);
      scene.add(fill);

      // ── Ground ─────────────────────────────────────────────────────────────
      const gW = W + GROUND_EXT * 2, gD = D + GROUND_EXT * 2;
      const groundMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(gW, gD),
        new THREE.MeshPhongMaterial({ color: 0xb8cc8a, shininess: 0 }),
      );
      groundMesh.rotation.x = -Math.PI / 2;
      groundMesh.position.y = -SLAB_T / 2 - 0.01;
      scene.add(groundMesh);
      const grid = new THREE.GridHelper(Math.max(gW, gD), 14, 0x6e8c42, 0x8aa854);
      (grid.material as THREE.LineBasicMaterial).opacity = 0.28;
      (grid.material as THREE.LineBasicMaterial).transparent = true;
      grid.position.y = -SLAB_T / 2;
      scene.add(grid);

      // ── Floor slab ─────────────────────────────────────────────────────────
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(W, SLAB_T, D),
        new THREE.MeshPhongMaterial({ color: 0xddd5c5 }),
      );
      slab.position.set(0, -SLAB_T / 2, 0);
      addEdges(slab, 0x888, 0.25);
      scene.add(slab);

      // ── Exterior walls ─────────────────────────────────────────────────────
      const wallMat = () => new THREE.MeshPhongMaterial({
        color: 0xf0ece0, transparent: true, opacity: 0.85, side: THREE.DoubleSide, shininess: 4,
      });

      const addWall = (gW2: number, gH: number, gD2: number, px: number, py: number, pz: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(gW2, gH, gD2), wallMat());
        m.position.set(px, py, pz);
        addEdges(m, 0x555, 0.4);
        scene.add(m);
      };
      addWall(W,      H, WALL_T,          0,               H / 2,  D / 2 + WALL_T / 2);
      addWall(W,      H, WALL_T,          0,               H / 2, -D / 2 - WALL_T / 2);
      addWall(WALL_T, H, D + WALL_T * 2, -W / 2 - WALL_T / 2, H / 2, 0);
      addWall(WALL_T, H, D + WALL_T * 2,  W / 2 + WALL_T / 2, H / 2, 0);

      // ── Roof (semi-transparent so interior visible from above) ─────────────
      const roofMesh = new THREE.Mesh(
        new THREE.BoxGeometry(W + WALL_T * 2, ROOF_T, D + WALL_T * 2),
        new THREE.MeshPhongMaterial({ color: 0xcfb97a, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
      );
      roofMesh.position.set(0, H + ROOF_T / 2, 0);
      addEdges(roofMesh, 0x665533, 0.5);
      scene.add(roofMesh);

      // Overhang lip
      const lip = new THREE.Mesh(
        new THREE.BoxGeometry(W + WALL_T * 2 + 0.3, 0.07, D + WALL_T * 2 + 0.3),
        new THREE.MeshPhongMaterial({ color: 0xc0a860 }),
      );
      lip.position.set(0, H + ROOF_T + 0.035, 0);
      scene.add(lip);

      // ── Interior details ───────────────────────────────────────────────────
      buildInterior(scene, W, D, H);

      // ── Openings ───────────────────────────────────────────────────────────
      const sides: Array<'south' | 'north' | 'west' | 'east'> = ['south', 'north', 'west', 'east'];
      elevations.forEach((elev, i) => { if (sides[i]) addOpenings(scene, elev, sides[i], W, D); });

      // ── Perspective camera ─────────────────────────────────────────────────
      const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 500);
      const st = stateRef.current;
      st.radius = Math.max(W, D) * 2.2;
      st.theta  = Math.PI * 0.35;
      st.phi    = 1.0;

      const target = new THREE.Vector3(0, H * 0.42, 0);

      const updateCam = () => {
        const { radius, theta, phi } = st;
        camera.position.set(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi) + H * 0.25,
          radius * Math.sin(phi) * Math.sin(theta),
        );
        camera.lookAt(target);
      };
      updateCam();

      // ── Renderer ───────────────────────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = false;
      rendererRef.current = renderer;
      el.appendChild(renderer.domElement);
      renderer.render(scene, camera);

      // ── HUD: hint label ────────────────────────────────────────────────────
      const hint = document.createElement('div');
      hint.textContent = '🖱 Drag: aylan  |  Scroll: ichiga/tashqariga  |  📸 PNG';
      Object.assign(hint.style, {
        position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.45)', color: '#fff', padding: '3px 10px',
        borderRadius: '20px', fontSize: '11px', pointerEvents: 'none', whiteSpace: 'nowrap',
      });
      el.style.position = 'relative';
      el.appendChild(hint);

      // ── Mouse orbit ─────────────────────────────────────────────────────────
      let drag = false, prev = { x: 0, y: 0 };

      const render = () => renderer.render(scene, camera);

      const onDown  = (e: MouseEvent) => { drag = true;  prev = { x: e.clientX, y: e.clientY }; };
      const onMove  = (e: MouseEvent) => {
        if (!drag) return;
        st.theta -= (e.clientX - prev.x) * 0.013;
        st.phi    = Math.max(0.05, Math.min(Math.PI * 0.9, st.phi + (e.clientY - prev.y) * 0.013));
        prev      = { x: e.clientX, y: e.clientY };
        updateCam();
        render();
      };
      const onUp    = () => { drag = false; };

      // ── Scroll: physically move camera in/out ──────────────────────────────
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        // deltaY > 0 = scroll down = move camera closer; < 0 = scroll up = move away
        const minR = 0.08;
        const maxR = Math.max(W, D) * 7;
        const factor = 1 - e.deltaY * 0.0012;   // proportional step, ~12% per 100px
        st.radius = Math.max(minR, Math.min(maxR, st.radius * factor));
        updateCam();
        // Hide roof when camera is inside building footprint so interior is visible
        const inB = Math.abs(camera.position.x) < W / 2 + WALL_T
                 && Math.abs(camera.position.z) < D / 2 + WALL_T
                 && camera.position.y < H + 0.4;
        (roofMesh.material as THREE.MeshPhongMaterial).opacity = inB ? 0.0 : 0.7;
        render();
      };

      renderer.domElement.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup',   onUp);
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

      // Touch support
      let lastPinchDist = 0;
      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) { drag = true; prev = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
        if (e.touches.length === 2) lastPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      };
      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 1 && drag) {
          st.theta -= (e.touches[0].clientX - prev.x) * 0.013;
          st.phi    = Math.max(0.05, Math.min(Math.PI * 0.9, st.phi + (e.touches[0].clientY - prev.y) * 0.013));
          prev      = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          updateCam(); render();
        }
        if (e.touches.length === 2) {
          const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          // Pinch in = fingers closer = d decreasing = move camera in
          st.radius = Math.max(0.08, Math.min(Math.max(W,D)*7, st.radius * (1 - (d - lastPinchDist) * 0.005)));
          lastPinchDist = d;
          updateCam(); render();
        }
      };
      const onTouchEnd = () => { drag = false; };
      renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
      renderer.domElement.addEventListener('touchmove',  onTouchMove,  { passive: false });
      renderer.domElement.addEventListener('touchend',   onTouchEnd);

      return () => {
        renderer.domElement.removeEventListener('mousedown', onDown);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup',   onUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
        renderer.domElement.removeEventListener('touchstart', onTouchStart);
        renderer.domElement.removeEventListener('touchmove',  onTouchMove);
        renderer.domElement.removeEventListener('touchend',   onTouchEnd);
        renderer.dispose();
        rendererRef.current = null;
        while (el.firstChild) el.removeChild(el.firstChild);
      };
    }, [data, width]);

    return (
      <div ref={mountRef}
        className="w-full cursor-grab active:cursor-grabbing"
        style={{ userSelect: 'none' }}
      />
    );
  }
);

export default ArchCanvas3D;
