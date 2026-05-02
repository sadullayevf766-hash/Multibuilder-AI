/**
 * BoilerRoomCanvas3D — Qozonxona 3D ko'rinishi (Three.js + CSS2DRenderer)
 * - Uzoq zoomda labellar yashiriladi (masofaga qarab)
 * - Elementga hover qilinganda label ko'rsatiladi (har doim)
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { BoilerRoomSchema, BoilerEquipment } from '../../../server/src/engine/BoilerRoomEngine';

interface Props { schema: BoilerRoomSchema; }

// Kamera masofasi chegaralari
const LABEL_HIDE_DISTANCE  = 14;   // bu masofadan uzoqda — barcha labellar yashiriladi
const LABEL_FADE_DISTANCE  = 10;   // bu masofadan yaqinda — labellar to'liq ko'rinadi

const COLOR_MAP: Record<string, number> = {
  heat_pump_outdoor:      0x064e3b,
  heat_pump_indoor:       0x065f46,
  buffer_tank:            0x1e3a8a,
  boiler_indirect:        0x7c2d12,
  pump_cold:              0x1d4ed8,
  pump_circulation_hvs:   0xd97706,
  pump_circulation_floor: 0xb45309,
  filter_mechanical:      0x4b5563,
  filter_softener:        0x6b7280,
  filter_clean:           0x9ca3af,
  expansion_tank_heating: 0xdc2626,
  expansion_tank_hvs:     0x2563eb,
  water_meter:            0x0369a1,
  electric_valve:         0x0c4a6e,
  mixing_valve_3way:      0x78350f,
  manifold_supply:        0xb91c1c,
  manifold_return:        0x1e40af,
};

const HEX_CSS: Record<string, string> = {
  heat_pump_outdoor:      '#064e3b',
  heat_pump_indoor:       '#065f46',
  buffer_tank:            '#1e3a8a',
  boiler_indirect:        '#7c2d12',
  pump_cold:              '#1d4ed8',
  pump_circulation_hvs:   '#d97706',
  pump_circulation_floor: '#92400e',
  filter_mechanical:      '#374151',
  filter_softener:        '#4b5563',
  filter_clean:           '#6b7280',
  expansion_tank_heating: '#dc2626',
  expansion_tank_hvs:     '#1d4ed8',
  water_meter:            '#0369a1',
  electric_valve:         '#0c4a6e',
  mixing_valve_3way:      '#78350f',
  manifold_supply:        '#991b1b',
  manifold_return:        '#1e40af',
};

const SHOW_LABEL_TYPES = new Set([
  'heat_pump_outdoor', 'heat_pump_indoor', 'buffer_tank',
  'boiler_indirect', 'pump_cold', 'pump_circulation_hvs',
  'expansion_tank_heating', 'expansion_tank_hvs',
  'manifold_supply', 'manifold_return',
]);

function makeLabel(eq: BoilerEquipment, compact = false): CSS2DObject {
  const div = document.createElement('div');
  const color = HEX_CSS[eq.type] ?? '#64748b';
  const shortName = eq.nameUz.length > 26 ? eq.nameUz.slice(0, 24) + '…' : eq.nameUz;

  div.style.cssText = compact
    ? `background:rgba(15,23,42,0.85);color:#cbd5e1;padding:2px 6px;border-radius:3px;
       font-size:9px;font-family:system-ui,sans-serif;pointer-events:none;white-space:nowrap;
       border-left:2px solid ${color};transition:opacity 0.2s;`
    : `background:rgba(15,23,42,0.92);color:#f1f5f9;padding:4px 8px;border-radius:5px;
       font-size:10px;font-family:system-ui,sans-serif;line-height:1.4;pointer-events:none;
       white-space:nowrap;border-left:3px solid ${color};box-shadow:0 2px 8px rgba(0,0,0,0.5);
       transition:opacity 0.2s;`;

  div.innerHTML = compact
    ? `${eq.model}`
    : `<b>${shortName}</b><br><span style="color:#94a3b8;font-size:8.5px">${eq.model}</span>`;

  return new CSS2DObject(div);
}

// Hover tooltip — har qanday element uchun (to'liq ma'lumot)
function makeHoverLabel(eq: BoilerEquipment): CSS2DObject {
  const div = document.createElement('div');
  const color = HEX_CSS[eq.type] ?? '#64748b';
  div.style.cssText = `
    background: rgba(15,23,42,0.96);
    color: #f8fafc;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-family: system-ui, sans-serif;
    line-height: 1.5;
    pointer-events: none;
    white-space: nowrap;
    border-left: 3px solid ${color};
    box-shadow: 0 4px 16px rgba(0,0,0,0.6);
  `;
  div.innerHTML = `
    <b style="font-size:12px">${eq.nameUz}</b><br>
    <span style="color:#94a3b8">${eq.model}</span>
    ${eq.note ? `<br><span style="color:#64748b;font-size:9px">${eq.note}</span>` : ''}
  `;
  return new CSS2DObject(div);
}

export default function BoilerRoomCanvas3D({ schema }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el || !schema) return;

    const W = el.clientWidth  || 900;
    const H = el.clientHeight || 600;

    // ── WebGL renderer ────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.setClearColor(0xf0f4f8);
    el.appendChild(renderer.domElement);

    // ── CSS2D renderer ────────────────────────────────────────────────────────
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(W, H);
    labelRenderer.domElement.style.cssText =
      `position:absolute;top:0;left:0;width:${W}px;height:${H}px;pointer-events:none;overflow:hidden;`;
    el.appendChild(labelRenderer.domElement);

    const scene  = new THREE.Scene();
    scene.fog    = new THREE.Fog(0xf0f4f8, 20, 60);

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    camera.position.set(12, 9, 14);
    camera.lookAt(schema.roomWidthM / 2, 1.2, schema.roomDepthM / 2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance   = 2;
    controls.maxDistance   = 25;

    // ── Yorug'lik ─────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(8, 12, 6);
    dirLight.castShadow = true;
    scene.add(dirLight);
    scene.add(new THREE.HemisphereLight(0xdbeafe, 0xfef9c3, 0.35));

    // ── Zamin ─────────────────────────────────────────────────────────────────
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(schema.roomWidthM + 2, schema.roomDepthM + 2),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(schema.roomWidthM / 2, 0, schema.roomDepthM / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    // ── Devorlar ──────────────────────────────────────────────────────────────
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, transparent: true, opacity: 0.07, side: THREE.DoubleSide,
    });
    const roomH = 3.0;
    ([
      [schema.roomWidthM, roomH, schema.roomWidthM / 2, roomH / 2, 0,                     0],
      [schema.roomWidthM, roomH, schema.roomWidthM / 2, roomH / 2, schema.roomDepthM,      Math.PI],
      [schema.roomDepthM, roomH, 0,                     roomH / 2, schema.roomDepthM / 2,  Math.PI / 2],
      [schema.roomDepthM, roomH, schema.roomWidthM,     roomH / 2, schema.roomDepthM / 2, -Math.PI / 2],
    ] as [number,number,number,number,number,number][]).forEach(([w, h, x, y, z, ry]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
      m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
    });

    // ── Jihoz qo'shish + hover label ─────────────────────────────────────────
    // meshToEq — hover uchun mesh → equipment mapping
    const meshToEq = new Map<THREE.Mesh, BoilerEquipment>();
    // normalLabels — masofaga qarab yashiriladigan labellar
    const normalLabels: Array<{ obj: CSS2DObject; div: HTMLElement }> = [];
    // hoverLabels — hover qilganda ko'rinadigan labellar (har doim sahnada)
    const hoverLabels = new Map<THREE.Mesh, { obj: CSS2DObject; div: HTMLElement }>();

    function addEquipment(eq: BoilerEquipment) {
      const x     = eq.x * schema.roomWidthM;
      const z     = eq.y * schema.roomDepthM;
      const color = COLOR_MAP[eq.type] ?? 0x6b7280;
      const mat   = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });

      const isCylinder = eq.type === 'buffer_tank' ||
                         eq.type === 'boiler_indirect' ||
                         eq.type === 'expansion_tank_heating' ||
                         eq.type === 'expansion_tank_hvs';

      let mesh: THREE.Mesh;
      if (isCylinder) {
        const r = Math.min(eq.width, eq.depth) / 2;
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, eq.height, 32), mat);
      } else {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(eq.width, eq.height, eq.depth), mat);
      }
      mesh.position.set(x + eq.width / 2, eq.height / 2, z + eq.depth / 2);
      mesh.castShadow = true;
      mesh.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
      ));
      scene.add(mesh);
      meshToEq.set(mesh, eq);

      // Izolatsiya
      if (isCylinder && (eq.type === 'buffer_tank' || eq.type === 'boiler_indirect')) {
        const r = Math.min(eq.width, eq.depth) / 2 + 0.04;
        const ins = new THREE.Mesh(
          new THREE.CylinderGeometry(r, r, eq.height - 0.05, 32),
          new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.18 })
        );
        ins.position.copy(mesh.position);
        scene.add(ins);
      }

      // Normal label — sahnaga qo'shiladi, masofaga qarab visibility boshqariladi
      if (SHOW_LABEL_TYPES.has(eq.type)) {
        const isMain = eq.type === 'buffer_tank' || eq.type === 'boiler_indirect' ||
                       eq.type === 'heat_pump_outdoor' || eq.type === 'heat_pump_indoor';
        const labelObj = makeLabel(eq, !isMain);
        labelObj.position.set(x + eq.width / 2, eq.height + 0.20, z + eq.depth / 2);
        scene.add(labelObj);
        // CSS2DObject.element — to'g'ri Three.js property nomi
        const div = labelObj.element as HTMLElement;
        normalLabels.push({ obj: labelObj, div });
      }

      // Hover label — sahnaga QO'SHILMAYDI, faqat hover da qo'shiladi/olinadi
      const hoverObj = makeHoverLabel(eq);
      hoverObj.position.set(x + eq.width / 2, eq.height + 0.30, z + eq.depth / 2);
      // scene.add QILMAYMIZ — hover da qo'shamiz
      hoverLabels.set(mesh, { obj: hoverObj, div: hoverObj.element as HTMLElement });
    }

    schema.equipment.forEach(addEquipment);

    // ── Quvurlar ──────────────────────────────────────────────────────────────
    const PIPE_COLORS: Record<string, number> = {
      supply: 0xdc2626, return: 0x2563eb,
      cold:   0x0ea5e9, hot:    0xf97316,
      circ:   0xf59e0b, drain:  0x6b7280,
    };
    const eqMap = new Map(schema.equipment.map(e => [e.id, e]));

    schema.pipes.forEach(pipe => {
      const from = eqMap.get(pipe.from);
      const to   = eqMap.get(pipe.to);
      if (!from || !to) return;
      const x1 = from.x * schema.roomWidthM + from.width / 2;
      const z1 = from.y * schema.roomDepthM + from.depth / 2;
      const x2 = to.x   * schema.roomWidthM + to.width   / 2;
      const z2 = to.y   * schema.roomDepthM + to.depth   / 2;
      const py = pipe.diamMm >= 32 ? 0.62 : 0.52;
      const r  = pipe.diamMm >= 32 ? 0.024 : 0.016;
      scene.add(new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(x1, py, z1),
            new THREE.Vector3(x1, py, z2),
            new THREE.Vector3(x2, py, z2),
          ]), 20, r, 8, false
        ),
        new THREE.MeshStandardMaterial({ color: PIPE_COLORS[pipe.type] ?? 0x94a3b8, roughness: 0.45, metalness: 0.35 })
      ));
    });

    schema.equipment.filter(e => e.type === 'pump_circulation_floor').forEach(p => {
      const x = p.x * schema.roomWidthM + p.width / 2;
      const z = p.y * schema.roomDepthM + p.depth / 2;
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.85, 8),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45, metalness: 0.35 })
      );
      tube.position.set(x, 1.2, z);
      scene.add(tube);
    });

    // ── Grid + Axes ───────────────────────────────────────────────────────────
    const grid = new THREE.GridHelper(
      Math.max(schema.roomWidthM, schema.roomDepthM) + 4, 20, 0xcbd5e1, 0xe2e8f0
    );
    grid.position.set(schema.roomWidthM / 2, 0.01, schema.roomDepthM / 2);
    scene.add(grid);
    const axes = new THREE.AxesHelper(0.8);
    axes.position.set(0.3, 0.05, 0.3);
    scene.add(axes);

    // ── Hover: Raycaster ──────────────────────────────────────────────────────
    const raycaster  = new THREE.Raycaster();
    const mouse      = new THREE.Vector2();
    const allMeshes  = [...meshToEq.keys()];
    let hoveredMesh: THREE.Mesh | null = null;
    // Har jihoz uchun original material saqlash
    const originalMaterials = new Map<THREE.Mesh, THREE.Material>();
    allMeshes.forEach(m => originalMaterials.set(m, (m.material as THREE.Material).clone()));

    const onMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)   / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(allMeshes, false);

      // Oldingi hover ni tiklash
      if (hoveredMesh) {
        const orig = originalMaterials.get(hoveredMesh);
        if (orig) hoveredMesh.material = orig.clone();
        // Hover labelni sahnadan olib tashlash
        const hl = hoverLabels.get(hoveredMesh);
        if (hl) scene.remove(hl.obj);
        hoveredMesh = null;
      }

      if (hits.length > 0) {
        const m = hits[0].object as THREE.Mesh;
        if (meshToEq.has(m)) {
          hoveredMesh = m;
          // Highlight
          const hmat = (m.material as THREE.MeshStandardMaterial).clone();
          hmat.emissive          = new THREE.Color(0x334155);
          hmat.emissiveIntensity = 0.35;
          m.material = hmat;
          // Hover labelni sahnaga qo'shish (masofadan qat'i nazar ko'rinadi)
          const hl = hoverLabels.get(m);
          if (hl) scene.add(hl.obj);
          renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        renderer.domElement.style.cursor = 'grab';
      }
    };
    renderer.domElement.addEventListener('mousemove', onMouseMove);

    // ── Render loop ───────────────────────────────────────────────────────────
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      // Kamera masofasiga qarab normal labellarni yashirish/ko'rsatish
      const dist = camera.position.distanceTo(controls.target);
      const show = dist < LABEL_HIDE_DISTANCE;
      // Opacity: masofaga qarab silliq o'tish
      const opacity = show
        ? Math.min(1, (LABEL_HIDE_DISTANCE - dist) / (LABEL_HIDE_DISTANCE - LABEL_FADE_DISTANCE))
        : 0;

      normalLabels.forEach(({ div }) => {
        div.style.opacity  = String(Math.max(0, opacity));
        div.style.display  = opacity <= 0 ? 'none' : 'block';
      });

      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
      labelRenderer.domElement.style.width  = `${w}px`;
      labelRenderer.domElement.style.height = `${h}px`;
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      controls.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement))      el.removeChild(renderer.domElement);
      if (el.contains(labelRenderer.domElement)) el.removeChild(labelRenderer.domElement);
    };
  }, [schema]);

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 8, left: 8, zIndex: 10,
        background: 'rgba(15,23,42,0.80)', color: '#e2e8f0',
        fontSize: 10, padding: '4px 8px', borderRadius: 4, pointerEvents: 'none',
      }}>
        Qozonxona 3D · Aylanish: sichqoncha · Zoom: g'ildirak · Hover: jihoz nomi
      </div>
    </div>
  );
}
