import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import type { DecorSchema, DecorFurniture, DecorOpening, WallSide } from '../../../shared/types';

export interface DecorCanvas3DHandle { exportToImage: (filename?: string) => void; }

// ── Lighting ──────────────────────────────────────────────────────────────────
function setupLights(scene: THREE.Scene, W: number, L: number, H: number) {
  scene.add(new THREE.AmbientLight(0xfff5e6, 0.55));

  const sun = new THREE.DirectionalLight(0xfff5cc, 0.80);
  sun.position.set(W * 0.6, H * 2.5, 3);
  scene.add(sun);

  // Warm ceiling point light (center)
  const ceil = new THREE.PointLight(0xfff5e6, 0.90, W * 3);
  ceil.position.set(W / 2, H - 0.05, -L / 2);
  scene.add(ceil);

  // Cool window bounce
  const bounce = new THREE.DirectionalLight(0xd0e8ff, 0.25);
  bounce.position.set(-W, H, -L);
  scene.add(bounce);
}

// ── Floor ─────────────────────────────────────────────────────────────────────
function buildFloor(scene: THREE.Scene, W: number, L: number, color: string) {
  const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(color), shininess: 30 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, L), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(W / 2, 0, -L / 2);
  scene.add(mesh);

  // Subtle grid lines on floor
  const gridHelper = new THREE.GridHelper(Math.max(W, L) * 2, 20, 0x000000, 0x000000);
  gridHelper.position.set(W / 2, 0.001, -L / 2);
  (gridHelper.material as THREE.LineBasicMaterial).opacity = 0.06;
  (gridHelper.material as THREE.LineBasicMaterial).transparent = true;
  scene.add(gridHelper);
}

// ── Ceiling ───────────────────────────────────────────────────────────────────
function buildCeiling(scene: THREE.Scene, W: number, L: number, H: number, color: string) {
  const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, L), mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(W / 2, H, -L / 2);
  scene.add(mesh);
}

// ── Wall with optional openings ───────────────────────────────────────────────
function buildWall(
  scene: THREE.Scene,
  side: WallSide,
  W: number, L: number, H: number,
  wallColor: string, _accentColor: string | null,
  openings: DecorOpening[],
) {
  const isAccent = false; // accent is visual only
  void isAccent;
  const wallOpenings = openings.filter(o => o.wall === side);
  const isNS = side === 'north' || side === 'south';
  const wallLen = isNS ? W : L;

  // We build the wall as a series of vertical planes with gaps for openings
  // For simplicity: one full plane + white cutout planes over openings
  const color = wallColor;
  const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide });

  const fullWall = new THREE.Mesh(new THREE.PlaneGeometry(wallLen, H), mat);
  switch (side) {
    case 'south': fullWall.position.set(W / 2, H / 2, 0); break;
    case 'north': fullWall.position.set(W / 2, H / 2, -L); fullWall.rotation.y = Math.PI; break;
    case 'west':  fullWall.position.set(0, H / 2, -L / 2); fullWall.rotation.y = Math.PI / 2; break;
    case 'east':  fullWall.position.set(W, H / 2, -L / 2); fullWall.rotation.y = -Math.PI / 2; break;
  }
  scene.add(fullWall);

  // Baseboard
  const baseMat = new THREE.MeshPhongMaterial({ color: 0xe8e8e8 });
  const base = new THREE.Mesh(new THREE.PlaneGeometry(wallLen, 0.08), baseMat);
  base.position.copy(fullWall.position);
  base.position.y = 0.04;
  base.rotation.copy(fullWall.rotation);
  scene.add(base);

  // Window glass panes
  for (const o of wallOpenings.filter(op => op.type === 'window')) {
    const glassMat = new THREE.MeshPhongMaterial({
      color: 0x87CEEB, transparent: true, opacity: 0.38, side: THREE.DoubleSide, shininess: 120,
    });
    const glassMesh = new THREE.Mesh(new THREE.PlaneGeometry(o.width, o.height), glassMat);

    let px = 0, py = o.sillHeight + o.height / 2, pz = 0;
    switch (side) {
      case 'south': px = o.offset + o.width / 2; pz =  0.001; break;
      case 'north': px = o.offset + o.width / 2; pz = -L - 0.001; break;
      case 'west':  py = o.sillHeight + o.height / 2; pz = -(o.offset + o.width / 2); px =  0.001; break;
      case 'east':  py = o.sillHeight + o.height / 2; pz = -(o.offset + o.width / 2); px = W - 0.001; break;
    }
    glassMesh.position.set(px, py, pz);
    glassMesh.rotation.copy(fullWall.rotation);
    scene.add(glassMesh);

    // Window frame
    const frameMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const frameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(o.width, o.height));
    const frame = new THREE.LineSegments(frameGeo, frameMat);
    frame.position.copy(glassMesh.position);
    frame.rotation.copy(glassMesh.rotation);
    scene.add(frame);

    // Window sill ledge
    const sillMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const sill = new THREE.Mesh(new THREE.BoxGeometry(o.width + 0.10, 0.04, 0.15), sillMat);
    sill.position.set(
      side === 'west' || side === 'east' ? px : px,
      o.sillHeight,
      side === 'west' || side === 'east' ? pz : pz
    );
    scene.add(sill);
  }
}

// ── Furniture ─────────────────────────────────────────────────────────────────
function buildFurniture(scene: THREE.Scene, f: DecorFurniture) {
  const { position: { x: rx, y: ry }, size: { w, d }, height: h, color } = f;
  const cx = rx + w / 2, cy = h / 2, cz = -(ry + d / 2);

  const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(color), shininess: 40 });

  // Main body
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, cy, cz);
  scene.add(mesh);

  // Edge wireframe for CAD look
  const edges = new THREE.EdgesGeometry(geo);
  const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(darken3(color)), transparent: true, opacity: 0.55 });
  const wire = new THREE.LineSegments(edges, wireMat);
  wire.position.copy(mesh.position);
  scene.add(wire);

  // Type-specific details
  switch (f.type) {
    case 'sofa':
    case 'armchair': {
      // Backrest
      const bh = h * 0.55, bd = d * 0.22;
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(w, bh, bd),
        new THREE.MeshPhongMaterial({ color: new THREE.Color(darken3(color)) })
      );
      back.position.set(cx, h - bh / 2, cz + d / 2 - bd / 2);
      scene.add(back);
      // Cushion top plane
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.06, d * 0.72), mat.clone());
      cushion.position.set(cx, h + 0.03, cz - d * 0.06);
      scene.add(cushion);
      break;
    }
    case 'bed_double':
    case 'bed_single': {
      // Headboard
      const hbH = h * 0.85, hbD = d * 0.12;
      const hb = new THREE.Mesh(
        new THREE.BoxGeometry(w, hbH, hbD),
        new THREE.MeshPhongMaterial({ color: new THREE.Color(darken3(color)) })
      );
      hb.position.set(cx, hbH / 2, cz + d / 2 - hbD / 2);
      scene.add(hb);
      // Pillows
      const pilW = f.type === 'bed_double' ? w / 2 - 0.08 : w - 0.20;
      const count = f.type === 'bed_double' ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const pilX = cx - w / 2 + 0.10 + i * (pilW + 0.08) + pilW / 2;
        const pil = new THREE.Mesh(
          new THREE.BoxGeometry(pilW, 0.10, 0.48),
          new THREE.MeshPhongMaterial({ color: 0xf0f0f0 })
        );
        pil.position.set(pilX, h + 0.05, cz + d / 2 - 0.28);
        scene.add(pil);
      }
      break;
    }
    case 'dining_table': {
      // Tabletop
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.05, d),
        new THREE.MeshPhongMaterial({ color: new THREE.Color(color), shininess: 80 })
      );
      top.position.set(cx, h + 0.025, cz);
      scene.add(top);
      // 4 legs
      const legH = h, legR = 0.03;
      [[cx - w / 2 + 0.06, cz - d / 2 + 0.06], [cx + w / 2 - 0.06, cz - d / 2 + 0.06],
       [cx - w / 2 + 0.06, cz + d / 2 - 0.06], [cx + w / 2 - 0.06, cz + d / 2 - 0.06]
      ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR, legH, 6), mat.clone());
        leg.position.set(lx, legH / 2, lz);
        scene.add(leg);
      });
      break;
    }
    case 'dining_chair': {
      // Seat + backrest
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(w, h * 0.60, d * 0.12),
        new THREE.MeshPhongMaterial({ color: new THREE.Color(darken3(color)) })
      );
      back.position.set(cx, h * 0.50 + h * 0.30, cz + d / 2 - d * 0.06);
      scene.add(back);
      break;
    }
    case 'tv_stand': {
      // TV screen on top
      const tvW = w * 0.80, tvH = tvW * 0.56, tvD = 0.04;
      const tv = new THREE.Mesh(
        new THREE.BoxGeometry(tvW, tvH, tvD),
        new THREE.MeshPhongMaterial({ color: 0x0a0a14, shininess: 100 })
      );
      tv.position.set(cx, h + tvH / 2, cz + d / 2 - tvD / 2 - 0.02);
      scene.add(tv);
      break;
    }
    case 'plant': {
      // Pot + sphere
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.3, w * 0.2, h * 0.35, 8), mat.clone());
      pot.position.set(cx, h * 0.175, cz);
      scene.add(pot);
      const foliage = new THREE.Mesh(
        new THREE.SphereGeometry(w * 0.45, 8, 8),
        new THREE.MeshPhongMaterial({ color: 0x2E7D32 })
      );
      foliage.position.set(cx, h * 0.35 + w * 0.40, cz);
      scene.add(foliage);
      break;
    }
    case 'lamp_floor': {
      // Pole + shade
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h * 0.82, 6), new THREE.MeshPhongMaterial({ color: 0x888888 }));
      pole.position.set(cx, h * 0.41, cz);
      scene.add(pole);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.28, 12, 1, true), new THREE.MeshPhongMaterial({ color: 0xFFF9C4, side: THREE.DoubleSide }));
      shade.position.set(cx, h * 0.82 + 0.14, cz);
      scene.add(shade);
      const bulb = new THREE.PointLight(0xfff5e0, 0.5, 2.5);
      bulb.position.set(cx, h * 0.82, cz);
      scene.add(bulb);
      break;
    }
    case 'rug': {
      // Flat box (override: already drawn as thin box, add border)
      const border = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.06, 0.005, d + 0.06),
        new THREE.MeshPhongMaterial({ color: new THREE.Color(darken3(color)) })
      );
      border.position.set(cx, 0.002, cz);
      scene.add(border);
      break;
    }
  }
}

function darken3(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - 60);
  const g = Math.max(0, ((n >> 8)  & 0xff) - 60);
  const b = Math.max(0, (n & 0xff)        - 60);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ── Component ─────────────────────────────────────────────────────────────────
const DecorCanvas3D = forwardRef<DecorCanvas3DHandle, { schema: DecorSchema; width?: number }>(
  function DecorCanvas3D({ schema, width = 900 }, ref) {
    const mountRef   = useRef<HTMLDivElement>(null);
    const rendRef    = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef   = useRef<THREE.Scene | null>(null);
    const cameraRef  = useRef<THREE.PerspectiveCamera | null>(null);
    const frameRef   = useRef<number | null>(null);

    useImperativeHandle(ref, () => ({
      exportToImage(filename = 'decor-3d.png') {
        if (!rendRef.current || !sceneRef.current || !cameraRef.current) return;
        rendRef.current.render(sceneRef.current, cameraRef.current);
        const url = rendRef.current.domElement.toDataURL('image/png');
        const a = document.createElement('a'); a.download = filename; a.href = url; a.click();
      },
    }));

    useEffect(() => {
      if (!mountRef.current) return;

      const { roomWidth: W, roomLength: L, roomHeight: H, material, furniture, openings } = schema;
      const height = Math.round(width * 0.60);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#D6E4F0');
      scene.fog = new THREE.Fog('#D6E4F0', Math.max(W, L) * 3, Math.max(W, L) * 10);
      sceneRef.current = scene;

      setupLights(scene, W, L, H);
      buildFloor(scene, W, L, material.floorColor);
      // Ceiling only shown from outside; removed for open-top dollhouse view

      const sides: WallSide[] = ['south', 'north', 'west', 'east'];
      for (const side of sides) {
        buildWall(scene, side, W, L, H, material.wallColor, null, openings);
      }

      // Rug first
      for (const f of furniture.filter(f => f.type === 'rug')) buildFurniture(scene, f);
      // Then all other furniture
      for (const f of furniture.filter(f => f.type !== 'rug')) buildFurniture(scene, f);

      // Camera
      const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 200);
      cameraRef.current = camera;

      const cx = W / 2, cy = H * 0.38, cz = -L / 2;
      const maxDim = Math.max(W, L);
      // Dollhouse view: elevated from south-east corner, looking down-northwest
      let theta = Math.PI * 0.22, phi = 0.72, radius = maxDim * 1.80;

      const minR = Math.min(W, L) * 0.4, maxR = maxDim * 4.0;

      const updateCamera = () => {
        camera.position.set(
          cx + radius * Math.sin(phi) * Math.cos(theta),
          cy + radius * Math.cos(phi),
          cz + radius * Math.sin(phi) * Math.sin(theta),
        );
        camera.lookAt(cx, cy * 0.6, cz);
        // Hide ceiling when inside room
        const inside = camera.position.x > 0 && camera.position.x < W
          && camera.position.z > -L && camera.position.z < 0
          && camera.position.y < H;
        scene.children.forEach(ch => {
          if (ch instanceof THREE.Mesh && ch.geometry instanceof THREE.PlaneGeometry
              && Math.abs(ch.position.y - H) < 0.01) {
            (ch.material as THREE.MeshPhongMaterial).opacity = inside ? 0 : 0.6;
          }
        });
      };
      updateCamera();

      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = false;
      rendRef.current = renderer;
      mountRef.current.appendChild(renderer.domElement);

      const render = () => { renderer.render(scene, camera); };
      render();

      // Mouse orbit
      let dragging = false, prev = { x: 0, y: 0 };
      const onDown  = (e: MouseEvent) => { dragging = true; prev = { x: e.clientX, y: e.clientY }; };
      const onMove  = (e: MouseEvent) => {
        if (!dragging) return;
        theta -= (e.clientX - prev.x) * 0.010;
        phi = Math.max(0.15, Math.min(Math.PI * 0.80, phi - (e.clientY - prev.y) * 0.010));
        prev = { x: e.clientX, y: e.clientY };
        updateCamera(); render();
      };
      const onUp    = () => { dragging = false; };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        radius = Math.max(minR, Math.min(maxR, radius * (1 - e.deltaY * 0.0010)));
        updateCamera(); render();
      };

      // Touch pinch
      let lastPinch = 0;
      const onTouchStart = (e: TouchEvent) => { if (e.touches.length === 2) lastPinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); };
      const onTouchMove  = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          radius = Math.max(minR, Math.min(maxR, radius * (lastPinch / d)));
          lastPinch = d; updateCamera(); render();
        } else if (e.touches.length === 1 && dragging) {
          theta -= (e.touches[0].clientX - prev.x) * 0.010;
          phi = Math.max(0.15, Math.min(Math.PI * 0.80, phi - (e.touches[0].clientY - prev.y) * 0.010));
          prev = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          updateCamera(); render();
        }
      };
      const onTouchEnd = () => { dragging = false; };
      const onTouchDragStart = (e: TouchEvent) => { if (e.touches.length === 1) { dragging = true; prev = { x: e.touches[0].clientX, y: e.touches[0].clientY }; } };

      renderer.domElement.addEventListener('mousedown', onDown);
      renderer.domElement.addEventListener('touchstart', onTouchDragStart, { passive: true });
      renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
      renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: true });
      renderer.domElement.addEventListener('touchend', onTouchEnd);

      return () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        renderer.domElement.removeEventListener('mousedown', onDown);
        renderer.domElement.removeEventListener('touchstart', onTouchDragStart);
        renderer.domElement.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
        renderer.domElement.removeEventListener('touchmove', onTouchMove);
        renderer.domElement.removeEventListener('touchend', onTouchEnd);
        renderer.dispose();
        rendRef.current = null;
        if (mountRef.current?.contains(renderer.domElement)) {
          mountRef.current.removeChild(renderer.domElement);
        }
      };
    }, [schema, width]);

    return (
      <div
        ref={mountRef}
        className="border border-gray-200 rounded-lg overflow-hidden w-full cursor-grab active:cursor-grabbing"
        style={{ userSelect: 'none' }}
        title="Sichqoncha bilan aylantiring • G'ildirak: zoom • Ichiga kirish mumkin"
      />
    );
  },
);

export default DecorCanvas3D;
