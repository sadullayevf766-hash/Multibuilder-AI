/**
 * StormDrain3DCanvas — Three.js 3D ливнёвка sxemasi
 * PDF 15-sahifa uslubi:
 * - Bino hajmi (shaffof)
 * - Krovlya traplari — tom yuzasida
 * - ø110 tarmoq quvurlar (ko'k-yashil)
 * - ø160 magistral (to'q ko'k, pastki)
 * - Vertikal stoyaklar (bino yoni bo'ylab)
 * - OrbitControls: 360° aylanish
 */
import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import jsPDF from 'jspdf';
import type { StormDrainSchema } from '../../../server/src/engine/StormDrainEngine';

export interface StormDrain3DCanvasHandle {
  exportToPdf: (filename?: string) => void;
}
interface Props { schema: StormDrainSchema; }

const FLOOR_H  = 3.2;
const PIPE_SEG = 10;

function makeMats() {
  return {
    pipe110: new THREE.MeshLambertMaterial({ color: 0x0ea5e9, emissive: 0x075985, emissiveIntensity: 0.25 }),
    pipe160: new THREE.MeshLambertMaterial({ color: 0x1d4ed8, emissive: 0x1e3a8a, emissiveIntensity: 0.25 }),
    trap:    new THREE.MeshLambertMaterial({ color: 0x06b6d4, emissive: 0x0e7490, emissiveIntensity: 0.3 }),
    roof:    new THREE.MeshLambertMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
    wall:    new THREE.MeshLambertMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }),
    wallEdge:new THREE.LineBasicMaterial({ color: 0x94a3b8 }),
    floor:   new THREE.MeshLambertMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.4 }),
    outlet:  new THREE.MeshLambertMaterial({ color: 0x1e3a8a }),
    ground:  new THREE.MeshLambertMaterial({ color: 0xd1fae5, transparent: true, opacity: 0.5 }),
    tee:     new THREE.MeshLambertMaterial({ color: 0x475569 }),
    arrow:   new THREE.MeshLambertMaterial({ color: 0x0ea5e9 }),
  };
}

function cyl(parent: THREE.Scene|THREE.Group, x1:number,y1:number,z1:number, x2:number,y2:number,z2:number, r:number, mat:THREE.Material) {
  const dir = new THREE.Vector3(x2-x1,y2-y1,z2-z1); const len=dir.length();
  if (len<0.001) return;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,PIPE_SEG),mat);
  m.position.set((x1+x2)/2,(y1+y2)/2,(z1+z2)/2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
  parent.add(m);
}

function bx(parent:THREE.Scene|THREE.Group, x:number,y:number,z:number, w:number,h:number,d:number, mat:THREE.Material, edge=false) {
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x+w/2,y+h/2,z+d/2); parent.add(m);
  if(edge){const e=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:0x475569}));e.position.copy(m.position);parent.add(e);}
  return m;
}

function lbl(text:string, color='#0f172a', bg='rgba(255,255,255,0.9)'): THREE.Sprite {
  const cv=document.createElement('canvas'); cv.width=256; cv.height=64;
  const ctx=cv.getContext('2d')!;
  ctx.fillStyle=bg; ctx.roundRect(2,2,252,60,8); ctx.fill();
  ctx.fillStyle=color; ctx.font='bold 22px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text.slice(0,28),128,32);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthTest:false}));
  sp.scale.set(1.4,0.35,1); return sp;
}

function buildScene(scene: THREE.Scene, schema: StormDrainSchema, M: ReturnType<typeof makeMats>) {
  const R110 = 0.055, R160 = 0.080;

  const allTraps = schema.floors.flatMap(f => f.traps);
  const COLS = Math.max(2, Math.ceil(Math.sqrt(Math.max(1, allTraps.length))));
  const CELL = 4.0;
  const BW = COLS * CELL;         // bino eni
  const BD = COLS * CELL;         // bino chuqurligi
  const TOTAL_H = schema.floors.length * FLOOR_H;

  // Zamin grid
  const grid = new THREE.GridHelper(BW + 6, Math.ceil(BW + 6), 0xd1d5db, 0xe2e8f0);
  grid.position.set((BW + 6) / 2 - 3, -0.02, (BW + 6) / 2 - 3);
  scene.add(grid);

  // ── Bino qobig'i (shaffof) ────────────────────────────────────────────────
  schema.floors.forEach((floor, fi) => {
    const baseY = fi * FLOOR_H;

    // Pol
    bx(scene, 0, baseY - 0.12, 0, BW, 0.12, BD, M.floor);

    // Devorlar — 4 ta shaffof panel
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(BW, FLOOR_H, BD), M.wall);
    wallMesh.position.set(BW/2, baseY + FLOOR_H/2, BD/2);
    scene.add(wallMesh);
    const we = new THREE.LineSegments(new THREE.EdgesGeometry(wallMesh.geometry), M.wallEdge);
    we.position.copy(wallMesh.position); scene.add(we);

    // Qavat labeli
    const fl = lbl(`${floor.floorNumber}-QAVAT  +${floor.elevation.toFixed(1)}м`, '#1e293b');
    fl.scale.set(2.2,0.44,1); fl.position.set(BW/2, baseY+FLOOR_H+0.4, -1); scene.add(fl);
  });

  // Tom (roof)
  const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(BW+0.2, 0.15, BD+0.2), M.roof);
  roofMesh.position.set(BW/2, TOTAL_H + 0.075, BD/2); scene.add(roofMesh);
  const re = new THREE.LineSegments(new THREE.EdgesGeometry(roofMesh.geometry), new THREE.LineBasicMaterial({color:0x0ea5e9,linewidth:2}));
  re.position.copy(roofMesh.position); scene.add(re);

  // ── Stoyaklar (bino tashqi devoriga yopishtirilgan) ───────────────────────
  const RISER_X = BW + 0.8;
  schema.risers.forEach((rs, ri) => {
    const rz = 1.5 + ri * 0.8;
    const r = rs.diamMm === 160 ? R160 : R110;
    const mat = rs.diamMm === 160 ? M.pipe160 : M.pipe110;

    // Vertikal stoyak: tomdan pastga
    cyl(scene, RISER_X, -0.5, rz, RISER_X, TOTAL_H + 0.15, rz, r, mat);

    // Tag labeli
    const rL = lbl(`${rs.tag} ø${rs.diamMm}`, rs.diamMm === 160 ? '#1d4ed8' : '#0369a1');
    rL.position.set(RISER_X + 0.6, TOTAL_H + 0.5, rz); scene.add(rL);

    // Diam labeli
    const dL = lbl(`ø${rs.diamMm}`, '#0ea5e9', 'rgba(0,0,0,0)');
    dL.scale.set(0.6, 0.2, 1); dL.position.set(RISER_X + 0.5, TOTAL_H * 0.5, rz); scene.add(dL);
  });

  // ── Magistral (pastki gorizontal, yerosti) ────────────────────────────────
  const magR = R160, magY = -0.35;
  cyl(scene, -2, magY, 1.5, RISER_X + 0.5, magY, 1.5, magR, M.pipe160);
  const magL = lbl(`Magistral ø${schema.mainDiamMm} · i=${schema.mainSlopePct}%`, '#1d4ed8', 'rgba(219,234,254,0.95)');
  magL.scale.set(3.2, 0.42, 1); magL.position.set(RISER_X * 0.4, magY - 0.5, 1.5); scene.add(magL);

  // Chiqish (outlet) — oxirgi nuqta
  const outL = lbl(schema.outletTag, '#1e3a8a', 'rgba(224,242,254,0.95)');
  outL.scale.set(2.5, 0.4, 1); outL.position.set(-1.5, magY, 2); scene.add(outL);
  // "→" yo'nalish ko'rsatgich
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 8), M.arrow);
  cone.rotation.z = Math.PI / 2; cone.position.set(-2.2, magY, 1.5); scene.add(cone);

  // ── Traplar (tom yuzasida) ─────────────────────────────────────────────────
  let trapIdx = 0;
  schema.floors.forEach((floor, fi) => {
    const baseY = fi * FLOOR_H;
    const isTopFloor = fi === schema.floors.length - 1;
    const trapY = isTopFloor ? TOTAL_H + 0.15 : baseY + FLOOR_H - 0.1;

    floor.traps.forEach((trap, ti) => {
      const col = trapIdx % COLS;
      const row = Math.floor(trapIdx / COLS);
      trapIdx++;

      const tx = col * CELL + CELL / 2;
      const tz = row * CELL + CELL / 2;

      // Trap qabul moslamasi (kichik disk)
      const trapMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.08, 12), M.trap);
      trapMesh.position.set(tx, trapY, tz); scene.add(trapMesh);

      // Trap raqami
      const tL = lbl(`${trap.number}`, '#0f172a', 'rgba(224,242,254,0.9)');
      tL.scale.set(0.7, 0.25, 1); tL.position.set(tx, trapY + 0.3, tz); scene.add(tL);

      // Oqim labeli
      const qL = lbl(`q=${trap.flowLps}л/с ø${trap.branchDiam}`, '#0369a1', 'rgba(0,0,0,0)');
      qL.scale.set(1.1, 0.24, 1); qL.position.set(tx, trapY + 0.55, tz); scene.add(qL);

      // Vertikal tarmoq: trapdan stoyakka
      const riser = schema.risers.find(rs => rs.tag === trap.riserTag);
      if (riser) {
        const ri = schema.risers.indexOf(riser);
        const rz = 1.5 + ri * 0.8;
        const r = trap.branchDiam === 160 ? R160 : R110;
        const mat = trap.branchDiam === 160 ? M.pipe160 : M.pipe110;

        // Tomdan stoyakka — vertikal + gorizontal
        const midY = baseY + FLOOR_H * 0.3;
        cyl(scene, tx, trapY, tz, tx, midY, tz, r, mat);       // vertikal pastga
        cyl(scene, tx, midY, tz, RISER_X, midY, rz, r, mat);   // gorizontal stoyakka

        // Qiya ko'rsatkichi
        const sL = lbl('i=2%', '#6b7280', 'rgba(255,255,255,0)');
        sL.scale.set(0.55, 0.2, 1); sL.position.set((tx + RISER_X) / 2, midY + 0.15, (tz + rz) / 2); scene.add(sL);

        // Stoyakka ulanish tee
        bx(scene, RISER_X - 0.06, midY - 0.06, rz - 0.06, 0.12, 0.12, 0.12, M.tee);

        // Stoyakdan magistralga
        cyl(scene, RISER_X, midY, rz, RISER_X, magY, rz, r, mat);
        cyl(scene, RISER_X, magY, rz, RISER_X, magY, 1.5, magR, M.pipe160);
      }

      void ti;
    });
  });

  // ── Eslatmalar ────────────────────────────────────────────────────────────
  schema.notes.slice(0, 4).forEach((note, ni) => {
    const nL = lbl(note.slice(0, 36), '#374151', 'rgba(240,249,255,0.94)');
    nL.scale.set(4, 0.44, 1); nL.position.set(BW * 0.5, -0.55 - ni * 0.58, BD + 1.5); scene.add(nL);
  });
}

// ── Component ──────────────────────────────────────────────────────────────────
const StormDrain3DCanvas = forwardRef<StormDrain3DCanvasHandle, Props>(({ schema }, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendRef  = useRef<THREE.WebGLRenderer | null>(null);
  const animRef  = useRef<number>(0);

  useImperativeHandle(ref, () => ({
    exportToPdf(filename = 'livnevka-3d.pdf') {
      if (!rendRef.current) return;
      const url = rendRef.current.domElement.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a2' });
      pdf.addImage(url, 'PNG', 10, 10, 400, 270);
      pdf.save(filename);
    },
  }));

  useEffect(() => {
    const el = mountRef.current;
    if (!el || !schema) return;
    const W = el.clientWidth || 900, H = el.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0xf0f9ff);
    el.appendChild(renderer.domElement);
    rendRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xf0f9ff, 40, 110);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.85); d1.position.set(10, 20, 10); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xe0f2fe, 0.4); d2.position.set(-8, 10, -5); scene.add(d2);
    const d3 = new THREE.DirectionalLight(0xfff7ed, 0.25); d3.position.set(0, 5, -10); scene.add(d3);

    buildScene(scene, schema, makeMats());

    const box3 = new THREE.Box3().setFromObject(scene);
    const center = box3.getCenter(new THREE.Vector3());
    const size   = box3.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 500);
    camera.position.set(center.x - maxDim * 0.5, center.y + maxDim * 0.65, center.z + maxDim * 0.8);
    camera.lookAt(center);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.minDistance = 2; controls.maxDistance = maxDim * 4;
    controls.update();

    const animate = () => { animRef.current = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate();

    const onResize = () => { const nW = el.clientWidth, nH = el.clientHeight; camera.aspect = nW / nH; camera.updateProjectionMatrix(); renderer.setSize(nW, nH); };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', onResize);
      controls.dispose(); renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      rendRef.current = null;
    };
  }, [schema]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(255,255,255,0.88)', borderRadius: 8, padding: '8px 14px', fontSize: 11, color: '#374151', backdropFilter: 'blur(4px)', border: '1px solid rgba(0,0,0,0.08)' }}>
        🖱 Sol klik = aylanish · O'ng klik = pan · Scroll = zoom
      </div>
      <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(240,249,255,0.95)', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: '#0f172a', backdropFilter: 'blur(4px)', border: '1px solid #bae6fd', lineHeight: '1.8' }}>
        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>ПАРАМЕТРЫ</div>
        <div><span style={{ color: '#0ea5e9', fontWeight: 700 }}>●</span> ø110 · i=2% (tarmoq)</div>
        <div><span style={{ color: '#1d4ed8', fontWeight: 700 }}>●</span> ø{schema.mainDiamMm} · i={schema.mainSlopePct}% (magistral)</div>
        <div><span style={{ color: '#06b6d4', fontWeight: 700 }}>■</span> Krovlya trapi</div>
        <div style={{ marginTop: 6, borderTop: '1px solid #bae6fd', paddingTop: 6 }}>
          <div>Trap: {schema.totalTraps} ta</div>
          <div>Oqim: q={schema.totalFlowLps} л/с</div>
          <div>Chiqish: {schema.outletTag}</div>
        </div>
      </div>
    </div>
  );
});

StormDrain3DCanvas.displayName = 'StormDrain3DCanvas';
export default StormDrain3DCanvas;
