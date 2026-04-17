import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import type { PlumbingSchema, PlumbingFixture, PlumbingPipe } from '../../../shared/types';

export interface PlumbingCanvas3DHandle {
  exportToImage: (filename?: string) => void;
}

interface PlumbingCanvas3DProps {
  schema: PlumbingSchema;
  width?: number;
}

// ── Scale: engine unit → THREE unit ──────────────────────────────────────────
// Engine: X horizontal, Y vertical (floor height), Z = 0 (2D schema)
// 3D: spread fixtures in X-Z plane, Y = height
// 1 engine unit ≈ 1cm → scale to meters: /100
const S = 0.01; // 1 engine unit = 0.01 THREE unit (1cm)

const PIPE_COLORS: Record<string, number> = {
  cold:  0x3b82f6,  // blue
  hot:   0xef4444,  // red
  drain: 0x94a3b8,  // slate
};

const PIPE_RADIUS: Record<string, number> = {
  cold:  0.015,
  hot:   0.015,
  drain: 0.025,
};

const FIXTURE_COLORS: Record<string, number> = {
  sink:            0x60a5fa,  // blue — lavabo
  toilet:          0x9ca3af,  // gray — unitaz
  bathtub:         0xa78bfa,  // purple — vanna
  shower:          0x34d399,  // green — dush
  washing_machine: 0xfbbf24,  // amber — kir yuvish
};

const FIXTURE_LABELS: Record<string, string> = {
  sink:            'Lavabo',
  toilet:          'Unitaz',
  bathtub:         'Vanna',
  shower:          'Dush',
  washing_machine: 'Kir yuv.',
};

// Fixture 3D dimensions [w, h, d] in THREE units
const FIXTURE_DIMS: Record<string, [number, number, number]> = {
  sink:            [0.55, 0.85, 0.45],
  toilet:          [0.38, 0.80, 0.65],
  bathtub:         [0.75, 0.55, 1.70],
  shower:          [0.90, 1.20, 0.90],  // reduced height for better visual proportion
  washing_machine: [0.60, 0.85, 0.60],
};

function setupLighting(scene: THREE.Scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6);
  sun.position.set(5, 10, 5);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-3, 4, -3);
  scene.add(fill);
}

function buildFloorSlab(floor: number, maxX: number, scene: THREE.Scene) {
  const FLOOR_H_3D = 3.0; // 3 meters per floor
  const y = floor * FLOOR_H_3D;
  const w = maxX * S + 1.0;
  const d = 1.5;

  // Floor slab (semi-transparent, thin)
  const geo = new THREE.BoxGeometry(w, 0.015, d);
  const mat = new THREE.MeshPhongMaterial({
    color: 0xdde1e7,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
  });
  const slab = new THREE.Mesh(geo, mat);
  slab.position.set(w / 2 - 0.5, y, d / 2 - 0.5);
  scene.add(slab);

  // Floor edge lines
  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.6 });
  const lines = new THREE.LineSegments(edges, lineMat);
  lines.position.copy(slab.position);
  scene.add(lines);
}

function buildFixture3D(fixture: PlumbingFixture, scene: THREE.Scene) {
  const FLOOR_H_3D = 3.0;
  const [fw, fh, fd] = FIXTURE_DIMS[fixture.type] ?? [0.5, 0.85, 0.5];
  const color = FIXTURE_COLORS[fixture.type] ?? 0xe2e8f0;

  const x = fixture.position.x * S;
  const y = fixture.floor * FLOOR_H_3D + fh / 2;
  const z = 0; // all fixtures on same Z line (schema is 2D)

  const geo = new THREE.BoxGeometry(fw, fh, fd);
  const mat = new THREE.MeshPhongMaterial({ color, shininess: 60, specular: 0x444444 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);

  // Edge lines for CAD look
  const edges = new THREE.EdgesGeometry(geo);
  mesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x475569 })));
  scene.add(mesh);
}

function buildPipe3D(pipe: PlumbingPipe, scene: THREE.Scene) {
  if (pipe.path.length < 2) return;

  const FLOOR_H_3D = 3.0;
  const color  = PIPE_COLORS[pipe.type]  ?? 0x888888;
  const radius = PIPE_RADIUS[pipe.type]  ?? 0.015;

  // Convert engine coords to 3D:
  // engine X → THREE X (horizontal)
  // engine Y → THREE Y (vertical, floor height)
  // Z = 0 for all (schema is 2D, pipes are in a vertical plane)
  const points = pipe.path.map(p => {
    // engine Y is height above floor 0 bottom
    // FLOOR_HEIGHT engine units = FLOOR_H_3D THREE units
    const engineFloorH = 220; // must match PlumbingEngine FLOOR_HEIGHT
    return new THREE.Vector3(
      p.x * S,
      (p.y / engineFloorH) * FLOOR_H_3D,
      0
    );
  });

  // Build tube segments
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end   = points[i + 1];
    const dir   = new THREE.Vector3().subVectors(end, start);
    const len   = dir.length();
    if (len < 0.001) continue;

    const geo = new THREE.CylinderGeometry(radius, radius, len, 8);
    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);

    // Position at midpoint, orient along direction
    mesh.position.copy(start).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize()
    );
    scene.add(mesh);
  }

  // Junction spheres at path points
  for (const pt of points) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.3, 6, 6),
      new THREE.MeshLambertMaterial({ color })
    );
    sphere.position.copy(pt);
    scene.add(sphere);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const PlumbingCanvas3D = forwardRef<PlumbingCanvas3DHandle, PlumbingCanvas3DProps>(
  function PlumbingCanvas3D({ schema, width = 800 }, ref) {
    const mountRef   = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef   = useRef<THREE.Scene | null>(null);
    const cameraRef  = useRef<THREE.OrthographicCamera | null>(null);

    useImperativeHandle(ref, () => ({
      exportToImage(filename = 'plumbing-3d.png') {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        const url = rendererRef.current.domElement.toDataURL('image/png');
        const a = document.createElement('a');
        a.download = filename; a.href = url; a.click();
      },
    }));

    useEffect(() => {
      if (!mountRef.current || !schema?.fixtures?.length) return;

      const height = Math.round(width * 0.65);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#f8fafc');
      sceneRef.current = scene;
      setupLighting(scene);

      // Grid helper
      const grid = new THREE.GridHelper(20, 20, 0xdde1e7, 0xe8ecf0);
      grid.position.set(4, 0, 0);
      scene.add(grid);

      // Max engine X for slab width
      const maxEngineX = Math.max(...schema.fixtures.map(f => f.position.x), 600);

      // Floor slabs
      for (let f = 0; f <= schema.floorCount; f++) {
        buildFloorSlab(f, maxEngineX, scene);
      }

      // Risers (draw first)
      for (const riser of schema.risers) {
        buildPipe3D(riser, scene);
      }

      // Branch pipes
      for (const pipe of schema.pipes) {
        buildPipe3D(pipe, scene);
      }

      // Fixtures
      for (const fixture of schema.fixtures) {
        buildFixture3D(fixture, scene);
      }

      // Camera setup — isometric view
      const FLOOR_H_3D = 3.0;
      const sceneW = maxEngineX * S + 1.0;
      const sceneH = schema.floorCount * FLOOR_H_3D;
      const centerX = sceneW / 2;
      const centerY = sceneH / 2;
      const sceneSize = Math.max(sceneW, sceneH) * 1.5;

      const aspect = width / height;
      const d = sceneSize * 0.55;
      const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 1000);
      cameraRef.current = camera;

      let zoom = 1.0;
      let theta = Math.PI / 5;   // view from front-right so fixtures are left, risers right
      let phi   = 0.9;
      const radius = sceneSize * 1.1;

      const updateCamera = () => {
        camera.position.set(
          centerX + radius * Math.sin(phi) * Math.cos(theta),
          centerY + radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta)
        );
        camera.lookAt(centerX, centerY, 0);
        const z = zoom;
        camera.left   = -d * aspect / z;
        camera.right  =  d * aspect / z;
        camera.top    =  d / z;
        camera.bottom = -d / z;
        camera.updateProjectionMatrix();
      };
      updateCamera();

      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      rendererRef.current = renderer;
      mountRef.current.appendChild(renderer.domElement);
      renderer.render(scene, camera);

      // Mouse drag to rotate
      let isDragging = false;
      let prev = { x: 0, y: 0 };

      const onDown  = (e: MouseEvent) => { isDragging = true; prev = { x: e.clientX, y: e.clientY }; };
      const onMove  = (e: MouseEvent) => {
        if (!isDragging) return;
        theta -= (e.clientX - prev.x) * 0.012;
        phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.05, phi - (e.clientY - prev.y) * 0.012));
        prev = { x: e.clientX, y: e.clientY };
        updateCamera();
        renderer.render(scene, camera);
      };
      const onUp    = () => { isDragging = false; };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        zoom = Math.max(0.3, Math.min(5.0, zoom - e.deltaY * 0.001));
        updateCamera();
        renderer.render(scene, camera);
      };

      renderer.domElement.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

      return () => {
        renderer.domElement.removeEventListener('mousedown', onDown);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
        renderer.dispose();
        rendererRef.current = null;
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
        title="Sichqoncha bilan aylantiring, g'ildirak bilan zoom"
      />
    );
  }
);

export default PlumbingCanvas3D;
