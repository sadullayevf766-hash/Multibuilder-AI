import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import type { DrawingData, Wall, PlacedFixture, Pipe } from '../../../shared/types';

export interface Canvas3DHandle {
  exportToImage: (filename?: string) => void;
}

interface Canvas3DProps {
  drawingData: DrawingData;
  width?: number;
}

const SCALE = 1.0;   // 1 canvas unit = 1 THREE unit (no scaling)
const WALL_H = 280;  // 280 canvas units = 2.8m wall height
const FS = 1.0;      // fixture scale

function cadMaterials(top: string, front: string, side: string): THREE.MeshPhongMaterial[] {
  const make = (c: string) => new THREE.MeshPhongMaterial({ color: c, shininess: 0 });
  return [make(side), make(side), make(top), make(front), make(front), make(side)];
}

function addEdges(mesh: THREE.Mesh, color = '#444444') {
  const edges = new THREE.EdgesGeometry(mesh.geometry as THREE.BufferGeometry);
  const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 });
  mesh.add(new THREE.LineSegments(edges, lineMat));
}

function box(w: number, h: number, d: number, top: string, front: string, side: string): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, cadMaterials(top, front, side));
  addEdges(mesh);
  return mesh;
}

function buildWall(wall: Wall, scene: THREE.Scene) {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.y - wall.start.y;
  const len = Math.sqrt(dx * dx + dz * dz) * SCALE;
  const angle = Math.atan2(dz, dx);
  const T = wall.thickness * SCALE;

  // Semi-transparent walls so fixtures inside are visible
  const mat = new THREE.MeshPhongMaterial({
    color: '#c8c8c8',
    transparent: true,
    opacity: 0.75,
    shininess: 0,
    side: THREE.DoubleSide,
  });
  const geo = new THREE.BoxGeometry(len, WALL_H, T);
  const mesh = new THREE.Mesh(geo, mat);
  // Edge lines for CAD look
  const edges = new THREE.EdgesGeometry(geo);
  mesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: '#555555' })));

  mesh.position.set(
    (wall.start.x + (wall.end.x - wall.start.x) / 2) * SCALE,
    WALL_H / 2,
    (wall.start.y + (wall.end.y - wall.start.y) / 2) * SCALE
  );
  mesh.rotation.y = -angle;
  scene.add(mesh);
}

function buildFloor(minX: number, maxX: number, minZ: number, maxZ: number, scene: THREE.Scene) {
  const w = maxX - minX, d = maxZ - minZ;
  const mesh = box(w, 5, d, '#f0f0f0', '#e8e8e8', '#e0e0e0');
  mesh.position.set(minX + w / 2, -2.5, minZ + d / 2);
  scene.add(mesh);
}

function build3DFixture(fixture: PlacedFixture, scene: THREE.Scene) {
  const px = fixture.position.x * SCALE;
  const pz = fixture.position.y * SCALE;
  const t = fixture.type;

  // Dimensions in canvas units (100 = 1m), SCALE=1 so direct
  const b = (w: number, h: number, d: number, top: string, front: string, side: string) =>
    box(w, h, d, top, front, side);

  const add = (mesh: THREE.Mesh, cx: number, cy: number, cz: number) => {
    mesh.position.set(px + cx, cy, pz + cz);
    scene.add(mesh);
  };

  if (t === 'toilet') {
    add(b(40, 18, 20, '#f0f0f0', '#e0e0e0', '#d0d0d0'), 20, 9, 10);
    add(b(36, 10, 50, '#f0f0f0', '#e0e0e0', '#d0d0d0'), 20, 5, 45);
  } else if (t === 'sink') {
    add(b(60, 85, 50, '#f0f0f0', '#e0e0e0', '#d0d0d0'), 30, 42.5, 25);
    const basinGeo = new THREE.CylinderGeometry(16, 14, 8, 12);
    const basin = new THREE.Mesh(basinGeo, new THREE.MeshPhongMaterial({ color: '#ffffff', shininess: 0 }));
    basin.position.set(px + 30, 89, pz + 25);
    scene.add(basin);
  } else if (t === 'bathtub') {
    add(b(80, 50, 180, '#f5f5f5', '#e8e8e8', '#d8d8d8'), 40, 25, 90);
  } else if (t === 'shower') {
    add(b(90, 200, 90, '#e8f4ff', '#d8ecff', '#c8e0f8'), 45, 100, 45);
  } else if (t === 'stove') {
    add(b(60, 85, 60, '#e0e0e0', '#d0d0d0', '#c0c0c0'), 30, 42.5, 30);
  } else if (t === 'fridge') {
    add(b(60, 170, 65, '#f0f0f0', '#e0e0e0', '#d0d0d0'), 30, 85, 32.5);
  } else if (t === 'desk') {
    add(b(120, 4, 60, '#e8e8e8', '#d8d8d8', '#c8c8c8'), 60, 75, 30);
    [[5, 5], [115, 5], [5, 55], [115, 55]].forEach(([lx, lz]) => {
      const leg = b(4, 75, 4, '#c0c0c0', '#b0b0b0', '#a0a0a0');
      leg.position.set(px + lx, 37.5, pz + lz);
      scene.add(leg);
    });
    const monitor = b(50, 35, 3, '#1a2035', '#1a2035', '#111111');
    monitor.position.set(px + 60, 110, pz + 5);
    scene.add(monitor);
  } else if (t === 'bed') {
    add(b(160, 25, 200, '#e0d8c8', '#d0c8b8', '#c0b8a8'), 80, 12.5, 100);
    add(b(160, 20, 185, '#f5f0e0', '#ede8d8', '#ddd8c8'), 80, 35, 107.5);
    add(b(160, 40, 8, '#d0c8b8', '#c0b8a8', '#b0a898'), 80, 45, 4);
    [[35, 25], [115, 25]].forEach(([bx, bz]) => {
      const pillow = b(70, 12, 45, '#ffffff', '#f0f0f0', '#e0e0e0');
      pillow.position.set(px + bx, 51, pz + bz);
      scene.add(pillow);
    });
  } else if (t === 'wardrobe') {
    add(b(120, 220, 60, '#e8e8e8', '#d8d8d8', '#c8c8c8'), 60, 110, 30);
  } else if (t === 'sofa') {
    add(b(200, 40, 80, '#c8c8c8', '#b8b8b8', '#a8a8a8'), 100, 20, 40);
    add(b(200, 45, 12, '#c0c0c0', '#b0b0b0', '#a0a0a0'), 100, 62.5, 6);
    [6, 188].forEach(ax => {
      const arm = b(12, 50, 80, '#b8b8b8', '#a8a8a8', '#989898');
      arm.position.set(px + ax, 45, pz + 40);
      scene.add(arm);
    });
    [35, 100, 165].forEach(cx => {
      const cushion = b(56, 15, 68, '#d8d8d8', '#c8c8c8', '#b8b8b8');
      cushion.position.set(px + cx, 57.5, pz + 40);
      scene.add(cushion);
    });
  } else if (t === 'tv_unit') {
    add(b(150, 45, 40, '#e8e8e8', '#d8d8d8', '#c8c8c8'), 75, 22.5, 20);
    const screen = b(140, 80, 4, '#1a2035', '#1a2035', '#111111');
    screen.position.set(px + 75, 90, pz + 2);
    scene.add(screen);
  } else if (t === 'bookshelf') {
    add(b(80, 180, 30, '#e8e8e8', '#d8d8d8', '#c8c8c8'), 40, 90, 15);
  } else if (t === 'armchair') {
    add(b(80, 45, 80, '#d8d8d8', '#c8c8c8', '#b8b8b8'), 40, 22.5, 40);
    add(b(80, 40, 10, '#c8c8c8', '#b8b8b8', '#a8a8a8'), 40, 62.5, 5);
  } else if (t === 'coffee_table') {
    add(b(90, 4, 50, '#f0ebe0', '#e0dbd0', '#d0cbc0'), 45, 45, 25);
    [[5, 5], [85, 5], [5, 45], [85, 45]].forEach(([lx, lz]) => {
      const leg = b(4, 45, 4, '#c0b8a8', '#b0a898', '#a09888');
      leg.position.set(px + lx, 22.5, pz + lz);
      scene.add(leg);
    });
  } else if (t === 'dining_table') {
    add(b(120, 4, 80, '#f5f0e8', '#e5e0d8', '#d5d0c8'), 60, 75, 40);
  } else if (t === 'chair') {
    add(b(50, 45, 50, '#e8e8e8', '#d8d8d8', '#c8c8c8'), 25, 22.5, 25);
    add(b(50, 40, 5, '#d8d8d8', '#c8c8c8', '#b8b8b8'), 25, 62.5, 2.5);
  } else {
    add(b(50, 50, 50, '#e8e8e8', '#d8d8d8', '#c8c8c8'), 25, 25, 25);
  }
}

function build3DPipe(pipe: Pipe, scene: THREE.Scene) {
  const PIPE_R = { cold: 3, hot: 3, drain: 5 }[pipe.type] ?? 3;
  const PIPE_Y = { cold: 240, hot: 250, drain: 10 }[pipe.type] ?? 240;
  const PIPE_COLOR = { cold: '#3b6fd4', hot: '#d43b3b', drain: '#708090' }[pipe.type] ?? '#888888';

  const points = pipe.path.map(p => new THREE.Vector3(p.x * SCALE, PIPE_Y, p.y * SCALE));
  if (points.length < 2) return;

  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0);
  const tubeGeo = new THREE.TubeGeometry(curve, points.length * 4, PIPE_R, 8, false);
  const mat = new THREE.MeshLambertMaterial({ color: PIPE_COLOR });
  scene.add(new THREE.Mesh(tubeGeo, mat));
}

function setupLighting(scene: THREE.Scene) {
  // Strong ambient to prevent dark faces
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  // Top light
  const top = new THREE.DirectionalLight(0xffffff, 0.5);
  top.position.set(0, 10, 0);
  scene.add(top);
  // Front-left key
  const key = new THREE.DirectionalLight(0xffffff, 0.35);
  key.position.set(-5, 3, 5);
  scene.add(key);
  // Right fill
  const fill = new THREE.DirectionalLight(0xffffff, 0.2);
  fill.position.set(5, 2, -3);
  scene.add(fill);
}

const Canvas3D = forwardRef<Canvas3DHandle, Canvas3DProps>(
  function Canvas3D({ drawingData, width = 800 }, ref) {
    const mountRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.OrthographicCamera | null>(null);

    useImperativeHandle(ref, () => ({
      exportToImage(filename = '3d-view.png') {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
      },
    }));

    useEffect(() => {
      if (!mountRef.current) return;

      const height = Math.round(width * 0.65);

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#ffffff');
      sceneRef.current = scene;
      setupLighting(scene);

      // Bounds
      const allX = drawingData.walls.flatMap(w => [w.start.x, w.end.x]).map(x => x * SCALE);
      const allZ = drawingData.walls.flatMap(w => [w.start.y, w.end.y]).map(y => y * SCALE);
      const minX = Math.min(...allX), maxX = Math.max(...allX);
      const minZ = Math.min(...allZ), maxZ = Math.max(...allZ);
      const centerX = (minX + maxX) / 2;
      const centerZ = (minZ + maxZ) / 2;
      const sceneSize = Math.max(maxX - minX, maxZ - minZ);

      // Floor
      buildFloor(minX, maxX, minZ, maxZ, scene);

      // Walls
      drawingData.walls.forEach(w => buildWall(w, scene));

      // Fixtures
      console.log('[3D] fixtures count:', drawingData.fixtures.length, drawingData.fixtures.map(f => f.type));
      drawingData.fixtures.forEach(f => {
        try { build3DFixture(f, scene); } catch(e) { console.error('Fixture error:', f.type, e); }
      });

      // Pipes
      (drawingData.pipes ?? []).forEach(p => build3DPipe(p, scene));

      // Camera (orthographic isometric)
      const aspect = width / height;
      const d = sceneSize * 0.6;
      const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 10000);
      cameraRef.current = camera;

      let zoom = 1.2;
      let theta = Math.PI / 4;
      let phi = 1.1;  // ~63° from vertical
      const radius = sceneSize * 1.2;

      const updateCamera = () => {
        camera.position.set(
          centerX + radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi),
          centerZ + radius * Math.sin(phi) * Math.sin(theta)
        );
        camera.lookAt(centerX, 0, centerZ);
        const z = zoom;
        camera.left = -d * aspect / z;
        camera.right = d * aspect / z;
        camera.top = d / z;
        camera.bottom = -d / z;
        camera.updateProjectionMatrix();
      };
      updateCamera();

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.sortObjects = true;
      rendererRef.current = renderer;
      mountRef.current.appendChild(renderer.domElement);
      renderer.render(scene, camera);

      // Mouse interaction
      let isDragging = false;
      let prevMouse = { x: 0, y: 0 };

      const onMouseDown = (e: MouseEvent) => { isDragging = true; prevMouse = { x: e.clientX, y: e.clientY }; };
      const onMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        theta -= (e.clientX - prevMouse.x) * 0.01;
        phi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, phi - (e.clientY - prevMouse.y) * 0.01));
        prevMouse = { x: e.clientX, y: e.clientY };
        updateCamera();
        renderer.render(scene, camera);
      };
      const onMouseUp = () => { isDragging = false; };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        zoom = Math.max(0.4, Math.min(4.0, zoom - e.deltaY * 0.001));
        updateCamera();
        renderer.render(scene, camera);
      };

      renderer.domElement.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

      return () => {
        renderer.domElement.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
        renderer.dispose();
        rendererRef.current = null;
        if (mountRef.current?.contains(renderer.domElement)) {
          mountRef.current.removeChild(renderer.domElement);
        }
      };
    }, [drawingData, width]);

    return (
      <div
        ref={mountRef}
        className="border border-gray-200 rounded-lg overflow-hidden w-full cursor-grab active:cursor-grabbing"
        style={{ userSelect: 'none' }}
      />
    );
  }
);

export default Canvas3D;
