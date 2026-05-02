/**
 * Sewage3DCanvas — Three.js 3D kanalizatsiya sxemasi
 *
 * PDF (Xumson ОВиК) 10-12-sahifa uslubi:
 *  - К1 stoyaklar ø110 (jigarrang, katta silindrlar)
 *  - Ventilyatsiya stoyaklari ø50 (yashil, tepaga chiqadi)
 *  - Tarmoqlar ø50/ø110 qiya (slope 2% va 3%)
 *  - Reviziya lyuklari 400×400mm (ko'k kvadratlar)
 *  - Xonalar shaffof
 *  - Jihoz simvollari (unitaz, lavabo, dush)
 *  - OrbitControls: 360° aylanish
 */
import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import jsPDF from 'jspdf';
import type { SewageSchema } from '../../../server/src/engine/SewageEngine';

export interface Sewage3DCanvasHandle {
  exportToPdf: (filename?: string) => void;
}
interface Props { schema: SewageSchema; }

const FLOOR_H = 3.2;
const ROOM_H  = 2.8;
const PIPE_SEG = 10;

function makeMats() {
  return {
    riser110: new THREE.MeshLambertMaterial({ color: 0x92400e, emissive: 0x3d1a05, emissiveIntensity: 0.3 }),
    branch110:new THREE.MeshLambertMaterial({ color: 0xb45309, emissive: 0x5f2d05, emissiveIntensity: 0.2 }),
    branch50: new THREE.MeshLambertMaterial({ color: 0x6b7280, emissive: 0x2d3340, emissiveIntensity: 0.15 }),
    vent:     new THREE.MeshLambertMaterial({ color: 0x16a34a, emissive: 0x064e1e, emissiveIntensity: 0.2 }),
    revision: new THREE.MeshLambertMaterial({ color: 0x1d4ed8, transparent: true, opacity: 0.7 }),
    room:     new THREE.MeshLambertMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.12, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }),
    roomEdge: new THREE.LineBasicMaterial({ color: 0x92400e }),
    floor:    new THREE.MeshLambertMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.3, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    fixture:  new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xaaaaaa, emissiveIntensity: 0.2 }),
    pit:      new THREE.MeshLambertMaterial({ color: 0x374151, transparent: true, opacity: 0.5 }),
    outlet:   new THREE.MeshLambertMaterial({ color: 0x78350f }),
  };
}

function cylinder(
  parent: THREE.Group | THREE.Scene,
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  r: number, mat: THREE.Material,
) {
  const dir = new THREE.Vector3(x2-x1, y2-y1, z2-z1);
  const len = dir.length();
  if (len < 0.001) return;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, PIPE_SEG), mat);
  m.position.set((x1+x2)/2, (y1+y2)/2, (z1+z2)/2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
  parent.add(m);
}

function box(
  parent: THREE.Group | THREE.Scene,
  x: number, y: number, z: number,
  w: number, h: number, d: number,
  mat: THREE.Material,
  withEdge = false,
  edgeColor = 0x475569,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x+w/2, y+h/2, z+d/2);
  parent.add(m);
  if (withEdge) {
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: edgeColor }));
    e.position.copy(m.position);
    parent.add(e);
  }
  return m;
}

function makeLabel(text: string, color = '#1e293b', bg = 'rgba(255,255,255,0.88)'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg; ctx.roundRect(2,2,252,60,8); ctx.fill();
  ctx.fillStyle = color; ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(1.2, 0.3, 1);
  return sp;
}

function buildScene(scene: THREE.Scene, schema: SewageSchema, M: ReturnType<typeof makeMats>) {
  const R110 = 0.055;   // ø110 → radius
  const R50  = 0.025;   // ø50  → radius
  const VENT_R = 0.025;

  const wetRoomsCount = schema.floors.flatMap(f => f.rooms.filter(r=>r.fixtures.length>0)).length;
  const COLS = Math.max(2, Math.ceil(Math.sqrt(Math.max(1, schema.floors[0]?.rooms.filter(r=>r.fixtures.length>0).length ?? 1))));
  const CELL = 4.5;
  const totalW = COLS * CELL;
  const TOTAL_H = schema.floors.length * FLOOR_H + 1.5;
  void wetRoomsCount;

  // Grid
  scene.add(new THREE.GridHelper(totalW+6, Math.ceil(totalW+6), 0xd1d5db, 0xe2e8f0));
  const gridHelper = scene.children[scene.children.length-1] as THREE.GridHelper;
  gridHelper.position.set((totalW+6)/2-3, -0.02, (totalW+6)/2-3);

  // ── Pit (kanalizatsiya chuquri) ───────────────────────────────────────────
  const pitX = -3, pitZ = 1.5;
  box(scene, pitX - 0.6, -1.2, pitZ - 0.6, 1.2, 1.2, 1.2, M.pit, true, 0x1f2937);
  const pitLbl = makeLabel('Kanalizatsiya chuquriga\nø110 · i=2%', '#374151', 'rgba(243,244,246,0.95)');
  pitLbl.scale.set(2.2, 0.45, 1);
  pitLbl.position.set(pitX, 0.55, pitZ);
  scene.add(pitLbl);

  // ── К1 Risers — right side of building ──────────────────────────────────
  const RISER_X_BASE = totalW + 1.2;
  schema.risers.forEach((rs, i) => {
    const rx = RISER_X_BASE;
    const rz = 1.5 + i * 0.65;

    // Main riser ø110
    cylinder(scene, rx, -0.5, rz, rx, TOTAL_H + 0.3, rz, R110, M.riser110);

    // Ventilation riser extends above roof
    cylinder(scene, rx, TOTAL_H + 0.3, rz, rx, TOTAL_H + 1.8, rz, VENT_R, M.vent);
    const ventLbl = makeLabel(`Вент. ст. ${rs.tag}`, '#15803d');
    ventLbl.position.set(rx + 0.5, TOTAL_H + 2.1, rz); scene.add(ventLbl);

    // Riser tag label
    const rLbl = makeLabel(`${rs.tag} ø110`, '#92400e', 'rgba(255,251,235,0.95)');
    rLbl.position.set(rx + 0.5, TOTAL_H + 0.6, rz); scene.add(rLbl);
  });

  // ── Main horizontal outlet (underground, slope 2%) ────────────────────────
  const outletY0 = -0.3;
  const outletSlope = 0.02;
  const outletLen = RISER_X_BASE;
  cylinder(scene,
    outletLen, outletY0, 1.5,
    pitX + 0.6, outletY0 - outletLen * outletSlope, 1.5,
    R110, M.outlet
  );
  const outletLbl = makeLabel(`ø110 · i=2% → яма`, '#78350f');
  outletLbl.scale.set(3, 0.4, 1);
  outletLbl.position.set(outletLen * 0.4, outletY0 - 0.45, 1.5);
  scene.add(outletLbl);

  // ── Floors & rooms ────────────────────────────────────────────────────────
  let roomIdx = 0;
  schema.floors.forEach((floor, fi) => {
    const baseY = fi * FLOOR_H;
    const slabW = totalW + 0.5;

    // Floor slab
    const slab = new THREE.Mesh(new THREE.BoxGeometry(slabW, 0.18, slabW), M.floor);
    slab.position.set(slabW/2, baseY - 0.09, slabW/2);
    scene.add(slab);

    // Floor label
    const floorLbl = makeLabel(`${floor.floorNumber}-QAVAT  +${floor.elevation.toFixed(1)}m`, '#1e293b');
    floorLbl.scale.set(2.5, 0.5, 1);
    floorLbl.position.set(slabW/2, baseY + ROOM_H + 0.4, -1.2);
    scene.add(floorLbl);

    // Rooms
    floor.rooms.forEach((room, ri) => {
      const col = roomIdx % COLS;
      const row = Math.floor(roomIdx / COLS);
      roomIdx++;
      const rx = col * CELL + 0.3;
      const rz = row * CELL + 0.3;
      const rw = Math.max(2.5, Math.sqrt(room.area));
      const rd = Math.max(2.5, room.area / rw);

      // Room box
      box(scene, rx, baseY, rz, rw, ROOM_H, rd, M.room, false);
      const rmEdge = new THREE.Mesh(new THREE.BoxGeometry(rw, ROOM_H, rd), M.room);
      rmEdge.position.set(rx+rw/2, baseY+ROOM_H/2, rz+rd/2);
      const re = new THREE.LineSegments(new THREE.EdgesGeometry(rmEdge.geometry), M.roomEdge);
      re.position.copy(rmEdge.position);
      scene.add(re);

      // Room label
      const rLbl = makeLabel(`${room.name}  ${room.area}m²`);
      rLbl.position.set(rx+rw/2, baseY + ROOM_H + 0.15, rz+rd/2);
      scene.add(rLbl);

      // Floor drain (floor-level)
      box(scene, rx+0.1, baseY, rz+0.1, 0.2, 0.02, 0.2, M.fixture, true, 0x6b7280);

      // ── Fixtures & drain pipes ───────────────────────────────────────────
      room.fixtures.forEach((fix, fxi) => {
        const fw = 0.3, fd = 0.22, fh = 0.08;
        const fx_x = rx + 0.15 + fxi * 0.4;
        const fx_z = rz + rd - fd - 0.15;
        const fx_y = baseY + fix.heightMm / 1000;
        const r = fix.pipeDiam === 110 ? R110 : R50;
        const mat = fix.pipeDiam === 110 ? M.branch110 : M.branch50;

        // Fixture symbol
        box(scene, fx_x, fx_y, fx_z, fw, fh, fd, M.fixture, true, 0x94a3b8);

        // Drain pipe: vertical down to floor, then horizontal with slope to riser
        const branchY = baseY - 0.15;  // below floor, in slab
        const riserTarget = schema.risers[0];
        const rsX = riserTarget ? RISER_X_BASE : RISER_X_BASE;

        // Vertical from fixture outlet to floor
        cylinder(scene, fx_x + fw/2, fx_y, fx_z + fd/2, fx_x + fw/2, branchY, fx_z + fd/2, r, mat);

        // Horizontal with slope to riser (using RISER_X_BASE)
        const rsXtarget = RISER_X_BASE;
        const horizLen = Math.abs(rsXtarget - (fx_x + fw/2));
        const dropY = horizLen * (fix.slope / 100);
        cylinder(scene,
          fx_x + fw/2, branchY, fx_z + fd/2,
          rsXtarget, branchY - dropY, 1.5 + (schema.risers[0] ? 0 : 0),
          r, mat
        );

        // Slope label
        const slopeLbl = makeLabel(`ø${fix.pipeDiam} i=${fix.slope}%`, '#6b7280', 'rgba(255,255,255,0.75)');
        slopeLbl.scale.set(0.8, 0.22, 1);
        slopeLbl.position.set((fx_x + rsX) / 2, branchY + 0.1, (fx_z + 1.5) / 2);
        scene.add(slopeLbl);

        // Height marker
        const hLbl = makeLabel(`${fix.heightMm}мм`, '#64748b', 'rgba(255,255,255,0)');
        hLbl.scale.set(0.6, 0.2, 1);
        hLbl.position.set(fx_x - 0.1, fx_y + 0.15, fx_z - 0.2);
        scene.add(hLbl);
      });

      // ── Revision hatch (400×400) ─────────────────────────────────────────
      const branch = floor.branches.find(b => b.roomId === room.id);
      if (branch) {
        const rev = floor.revisions.find(r => r.riserTag === room.fixtures[0]?.riserTag);
        if (rev) {
          // Revision luchok on wall
          const revMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.04), M.revision);
          revMesh.position.set(rx + rw - 0.5, baseY + rev.heightMm / 1000 + 0.2, rz + rd);
          scene.add(revMesh);
          const revE = new THREE.LineSegments(new THREE.EdgesGeometry(revMesh.geometry), new THREE.LineBasicMaterial({ color: 0x1d4ed8, linewidth: 2 }));
          revE.position.copy(revMesh.position);
          scene.add(revE);
          const revLbl = makeLabel('Reviziya\n400×400', '#1d4ed8', 'rgba(219,234,254,0.9)');
          revLbl.scale.set(0.9, 0.35, 1);
          revLbl.position.set(rx + rw - 0.5, baseY + rev.heightMm / 1000 + 0.75, rz + rd + 0.3);
          scene.add(revLbl);
        }
      }

      void ri;
    });

    // ── Floor elevation marker ────────────────────────────────────────────
    const dimLbl = makeLabel(`+${floor.elevation.toFixed(3)}`, '#374151', 'rgba(255,255,255,0.0)');
    dimLbl.scale.set(1, 0.28, 1);
    dimLbl.position.set(-1.5, baseY + 0.1, 1);
    scene.add(dimLbl);

    // Dimension tick
    const pts = [new THREE.Vector3(-2, baseY, 1), new THREE.Vector3(-1, baseY, 1)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x475569 })));
  });

  // ── Ground level ─────────────────────────────────────────────────────────
  const zeroPts = [new THREE.Vector3(-2, 0, 1), new THREE.Vector3(-1, 0, 1)];
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(zeroPts), new THREE.LineBasicMaterial({ color: 0x1e293b })));
  const zeroLbl = makeLabel('±0.000', '#1e293b', 'rgba(255,255,255,0)');
  zeroLbl.scale.set(1, 0.28, 1);
  zeroLbl.position.set(-1.5, 0.1, 1);
  scene.add(zeroLbl);

  // ── Specification cards ───────────────────────────────────────────────────
  schema.specItems.slice(0, 8).forEach((item, i) => {
    const lbl = makeLabel(`${item.pos}. ${item.nameRu.slice(0, 22)} — ${item.qty}шт`, '#374151', 'rgba(248,250,252,0.95)');
    lbl.scale.set(3.8, 0.45, 1);
    lbl.position.set(COLS * CELL * 0.5, -0.5 - i * 0.55, COLS * CELL + 1);
    scene.add(lbl);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
const Sewage3DCanvas = forwardRef<Sewage3DCanvasHandle, Props>(({ schema }, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendRef  = useRef<THREE.WebGLRenderer | null>(null);
  const animRef  = useRef<number>(0);

  useImperativeHandle(ref, () => ({
    exportToPdf(filename = 'sewage-3d.pdf') {
      if (!rendRef.current) return;
      const dataUrl = rendRef.current.domElement.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a2' });
      pdf.addImage(dataUrl, 'PNG', 10, 10, 400, 270);
      pdf.save(filename);
    },
  }));

  useEffect(() => {
    const el = mountRef.current;
    if (!el || !schema) return;
    const W = el.clientWidth || 900;
    const H = el.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.setClearColor(0xfafaf9);
    el.appendChild(renderer.domElement);
    rendRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xfafaf9, 40, 100);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(10, 20, 10);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0xfff7ed, 0.35);
    fill.position.set(-6, 10, -8);
    scene.add(fill);

    const M = makeMats();
    buildScene(scene, schema, M);

    const box3 = new THREE.Box3().setFromObject(scene);
    const center = box3.getCenter(new THREE.Vector3());
    const size   = box3.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 500);
    camera.position.set(center.x + maxDim * 0.75, center.y + maxDim * 0.55, center.z + maxDim * 0.85);
    camera.lookAt(center);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2;
    controls.maxDistance = maxDim * 4;
    controls.update();

    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nW = el.clientWidth, nH = el.clientHeight;
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
      renderer.setSize(nW, nH);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      rendRef.current = null;
    };
  }, [schema]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        background: 'rgba(255,255,255,0.88)', borderRadius: 8, padding: '8px 14px',
        fontSize: 11, color: '#374151', backdropFilter: 'blur(4px)',
        border: '1px solid rgba(0,0,0,0.08)',
      }}>
        🖱 Sol klik = aylanish · O'ng klik = pan · Scroll = zoom
      </div>
      <div style={{
        position: 'absolute', top: 16, right: 16,
        background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '10px 14px',
        fontSize: 11, color: '#374151', backdropFilter: 'blur(4px)',
        border: '1px solid rgba(0,0,0,0.08)', lineHeight: '1.8',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>PARAMETRLAR</div>
        <div><span style={{ color: '#92400e', fontWeight: 700 }}>●</span> К1 — Stoyak ø110</div>
        <div><span style={{ color: '#b45309', fontWeight: 700 }}>●</span> Tarmoq ø110 · i=2%</div>
        <div><span style={{ color: '#6b7280', fontWeight: 700 }}>●</span> Tarmoq ø50 · i=3%</div>
        <div><span style={{ color: '#16a34a', fontWeight: 700 }}>●</span> Vent. stoyak ø50</div>
        <div><span style={{ color: '#1d4ed8', fontWeight: 700 }}>■</span> Reviziya 400×400</div>
        <div style={{ marginTop: 6, borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
          <div>Jihoz: {schema.totalFixtures} ta</div>
          <div>Stoyak: {schema.totalRisers} ta</div>
          <div>Chiqish: {schema.pitTag}</div>
        </div>
      </div>
    </div>
  );
});

Sewage3DCanvas.displayName = 'Sewage3DCanvas';
export default Sewage3DCanvas;
