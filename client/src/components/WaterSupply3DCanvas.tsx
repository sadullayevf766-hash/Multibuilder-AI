/**
 * WaterSupply3DCanvas — Three.js 3D suv ta'minoti sxemasi
 * В1 (ko'k), Т3 (qizil), Т4 (sariq)
 * Professional aksonometrik ko'rinish, 360° aylanadigan
 */
import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import jsPDF from 'jspdf';
import type { WaterSupplySchema } from '../../../server/src/engine/WaterSupplyEngine';

export interface WaterSupply3DCanvasHandle {
  exportToPdf: (filename?: string) => void;
}
interface Props { schema: WaterSupplySchema; }

const FLOOR_H  = 3.2;
const ROOM_H   = 2.8;
const PIPE_SEG = 10;
const CELL     = 4.5;    // metres per room cell

function makeMats() {
  return {
    cold:    new THREE.MeshLambertMaterial({ color: 0x3b82f6, emissive: 0x1e3a5f, emissiveIntensity: 0.25 }),
    hot:     new THREE.MeshLambertMaterial({ color: 0xef4444, emissive: 0x5f1e1e, emissiveIntensity: 0.25 }),
    circ:    new THREE.MeshLambertMaterial({ color: 0xf59e0b, emissive: 0x5f3c0a, emissiveIntensity: 0.25 }),
    room:    new THREE.MeshLambertMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
    roomEdge:new THREE.LineBasicMaterial({ color: 0x94a3b8 }),
    floor:   new THREE.MeshLambertMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.45 }),
    boiler:  new THREE.MeshLambertMaterial({ color: 0x374151, emissive: 0x111827, emissiveIntensity: 0.3 }),
    boilerT: new THREE.MeshLambertMaterial({ color: 0x9ca3af }),
    fixture: new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x93c5fd, emissiveIntensity: 0.25 }),
    tee:     new THREE.MeshLambertMaterial({ color: 0x64748b }),
    grid:    new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.4 }),
  };
}

function cyl(p: THREE.Scene | THREE.Group, x1:number,y1:number,z1:number, x2:number,y2:number,z2:number, r:number, mat:THREE.Material) {
  const dir = new THREE.Vector3(x2-x1,y2-y1,z2-z1); const len = dir.length();
  if (len<0.001) return;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,PIPE_SEG), mat);
  m.position.set((x1+x2)/2,(y1+y2)/2,(z1+z2)/2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
  p.add(m);
}

function bx(p: THREE.Scene|THREE.Group, x:number,y:number,z:number, w:number,h:number,d:number, mat:THREE.Material, edge=false, ec=0x475569) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x+w/2, y+h/2, z+d/2); p.add(m);
  if (edge) { const e=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:ec})); e.position.copy(m.position); p.add(e); }
  return m;
}

function label(text:string, color='#1e293b', bg='rgba(255,255,255,0.88)'): THREE.Sprite {
  const cv=document.createElement('canvas'); cv.width=256; cv.height=64;
  const ctx=cv.getContext('2d')!;
  ctx.fillStyle=bg; ctx.roundRect(2,2,252,60,8); ctx.fill();
  ctx.fillStyle=color; ctx.font='bold 22px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text.slice(0,28), 128, 32);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthTest:false}));
  sp.scale.set(1.4,0.35,1); return sp;
}

function buildScene(scene: THREE.Scene, schema: WaterSupplySchema, M: ReturnType<typeof makeMats>) {
  const CR = 0.038;   // cold riser radius
  const HR = 0.038;   // hot riser radius
  const TR = 0.022;   // circ riser radius
  const BR = 0.020;   // branch radius

  const allRooms = schema.floors.flatMap(f => f.rooms.map(r => ({ ...r, fl: f.floorNumber })));
  const COLS = Math.max(2, Math.ceil(Math.sqrt(Math.max(1, schema.floors[0]?.rooms.length ?? 1))));
  const totalW = COLS * CELL;
  const totalH_scene = schema.floors.length * FLOOR_H;

  // Grid floor
  const gh = new THREE.GridHelper(totalW + 6, Math.ceil(totalW+6), 0xd1d5db, 0xe2e8f0);
  gh.position.set(totalW/2, -0.02, totalW/2);
  scene.add(gh);

  // Riser column — right side of building, at x = totalW + 1.5
  const RISERS_X = totalW + 1.5;
  const risers = schema.risers;
  const coldR  = risers.filter(r => r.type === 'cold');
  const hotR   = risers.filter(r => r.type === 'hot');
  const circR  = risers.filter(r => r.type === 'circ');
  const TOTAL_H_PIPE = totalH_scene + 0.8;

  // Stoyaklar — parallel, z spacing 0.25m
  // Stoyak segment helper: taper bo'yicha diam o'zgaradigan vertikal quvur
  function riserWithTaper(
    rz: number, color: THREE.Material, colorDark: THREE.Material,
    rs: typeof coldR[0], maxH: number
  ) {
    const segs = rs.segments;
    if (!segs || segs.length === 0) {
      cyl(scene, RISERS_X, -0.3, rz, RISERS_X, maxH, rz, CR, color);
      return;
    }
    // Segment bo'yicha har bo'lakni chizish
    let prevY = -0.3;
    const floorH = FLOOR_H;
    segs.forEach((seg, si) => {
      const y0 = (seg.fromFloor - 1) * floorH;
      const y1 = (seg.toFloor - 1) * floorH;
      const r = seg.diamMm / 1000 * 0.55;
      cyl(scene, RISERS_X, y0, rz, RISERS_X, y1, rz, r, color);
      // Segment diam label
      const dLbl = label(`ø${seg.diamMm}`, '#374151', 'rgba(255,255,255,0)');
      dLbl.scale.set(0.55, 0.18, 1);
      dLbl.position.set(RISERS_X + 0.35, (y0+y1)/2, rz);
      scene.add(dLbl);
      // Taper o'zgarish marker
      if (si > 0) {
        bx(scene, RISERS_X-0.06, y0-0.04, rz-0.06, 0.12, 0.08, 0.12, colorDark, false);
      }
      prevY = y1;
    });
    // Yuqori qism (oxirgi segmentdan tepagacha)
    if (prevY < maxH) {
      cyl(scene, RISERS_X, prevY, rz, RISERS_X, maxH, rz, CR, color);
    }
    void prevY;
  }

  coldR.forEach((rs, i) => {
    const rz = 1.2 + i * 0.6;
    riserWithTaper(rz, M.cold, M.tee, rs, TOTAL_H_PIPE);
    const lb = label(`${rs.tag} ø${rs.diamMm}`, '#1d4ed8');
    lb.position.set(RISERS_X, TOTAL_H_PIPE + 0.45, rz); scene.add(lb);
  });
  hotR.forEach((rs, i) => {
    const rz = 1.2 + coldR.length * 0.6 + i * 0.6;
    riserWithTaper(rz, M.hot, M.tee, rs, TOTAL_H_PIPE);
    const lb = label(`${rs.tag} ø${rs.diamMm}`, '#dc2626');
    lb.position.set(RISERS_X, TOTAL_H_PIPE + 0.8, rz); scene.add(lb);
  });
  circR.forEach((rs, i) => {
    const rz = 1.2 + (coldR.length + hotR.length) * 0.6 + i * 0.6;
    cyl(scene, RISERS_X, -0.3, rz, RISERS_X, TOTAL_H_PIPE, rz, TR, M.circ);
    const lb = label(`${rs.tag} ø${rs.diamMm}`, '#b45309');
    lb.position.set(RISERS_X, TOTAL_H_PIPE + 1.15, rz); scene.add(lb);
  });

  // Main horizontal supply pipe (bottom)
  const mainY = 0.15;
  cyl(scene, -2, mainY, 1.2, RISERS_X, mainY, 1.2, schema.mainDiamMm/1000*0.5, M.cold);
  cyl(scene, -2, mainY+0.12, 1.2 + coldR.length*0.6, RISERS_X, mainY+0.12, 1.2 + coldR.length*0.6, schema.mainDiamMm/1000*0.45, M.hot);
  // Main supply label
  const mainL = label(`В1 ø${schema.mainDiamMm}мм — asosiy`, '#1d4ed8', 'rgba(219,234,254,0.92)');
  mainL.scale.set(2.4, 0.38, 1);
  mainL.position.set(RISERS_X*0.4, mainY - 0.4, 1.2);
  scene.add(mainL);

  // ── Boiler ────────────────────────────────────────────────────────────────
  const bH = Math.max(1.2, schema.boilerVolL/500 * 1.8);
  const bR = 0.48, bx_ = -2.2, bz_ = 1.2;
  const bm = new THREE.Mesh(new THREE.CylinderGeometry(bR,bR,bH,16), M.boiler);
  bm.position.set(bx_, bH/2, bz_); scene.add(bm);
  const bcap = new THREE.Mesh(new THREE.SphereGeometry(bR,12,8,0,Math.PI*2,0,Math.PI/2), M.boilerT);
  bcap.position.set(bx_, bH, bz_); scene.add(bcap);
  const bedge = new THREE.LineSegments(new THREE.EdgesGeometry(bm.geometry), new THREE.LineBasicMaterial({color:0x4b5563}));
  bedge.position.copy(bm.position); scene.add(bedge);
  const bL = label(`${schema.boilerTag}\n${schema.boilerVolL}L`, '#374151', 'rgba(243,244,246,0.95)');
  bL.scale.set(2,0.5,1); bL.position.set(bx_, bH+0.7, bz_); scene.add(bL);
  // Boiler connections
  cyl(scene, bx_+bR, bH*0.75, bz_, RISERS_X, bH*0.75, 1.2+coldR.length*0.6, HR, M.hot);
  cyl(scene, bx_+bR, bH*0.35, bz_, RISERS_X, bH*0.35, 1.2, CR, M.cold);

  // ── Floors & rooms ────────────────────────────────────────────────────────
  schema.floors.forEach((floor, fi) => {
    const baseY = fi * FLOOR_H;

    // Floor slab
    const slabM = new THREE.Mesh(new THREE.BoxGeometry(totalW+0.5, 0.18, totalW+0.5), M.floor);
    slabM.position.set((totalW+0.5)/2, baseY-0.09, (totalW+0.5)/2);
    scene.add(slabM);

    // Floor label
    const fL = label(`${floor.floorNumber}-QAVAT  +${floor.elevation.toFixed(1)}м`, '#1e293b', 'rgba(255,255,255,0.95)');
    fL.scale.set(2.8, 0.5, 1);
    fL.position.set(totalW*0.45, baseY + ROOM_H + 0.5, -1.5);
    scene.add(fL);

    // Elevation tick
    const ep = [new THREE.Vector3(-1.5, baseY, 1), new THREE.Vector3(-0.5, baseY, 1)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ep), new THREE.LineBasicMaterial({color:0x475569})));
    const eL = label(`+${floor.elevation.toFixed(3)}`, '#374151', 'rgba(0,0,0,0)');
    eL.scale.set(1.1,0.28,1); eL.position.set(-1.5, baseY+0.12, 1); scene.add(eL);

    // Rooms
    floor.rooms.forEach((room, ri) => {
      const col = ri % COLS;
      const row = Math.floor(ri / COLS);
      const rx = col * CELL + 0.25;
      const rz = row * CELL + 0.25;
      const rw = Math.max(2.5, Math.sqrt(room.area) * 1.1);
      const rd = Math.max(2.5, room.area / rw);

      // Room walls (transparent box + edge)
      const roomMesh = new THREE.Mesh(new THREE.BoxGeometry(rw, ROOM_H, rd), M.room);
      roomMesh.position.set(rx+rw/2, baseY+ROOM_H/2, rz+rd/2); scene.add(roomMesh);
      const re = new THREE.LineSegments(new THREE.EdgesGeometry(roomMesh.geometry), M.roomEdge);
      re.position.copy(roomMesh.position); scene.add(re);

      // Floor of room
      bx(scene, rx, baseY, rz, rw, 0.04, rd, M.floor);

      // Room name
      const rL = label(`${room.name}`, '#1e293b');
      rL.position.set(rx+rw/2, baseY+ROOM_H+0.2, rz+rd/2); scene.add(rL);

      // ── Fixtures ─────────────────────────────────────────────────────────
      room.fixtures.forEach((fix, fxi) => {
        const fw = 0.32, fd = 0.22, fh = 0.07;
        const fx_x = rx + 0.18 + fxi * 0.42;
        const fx_z = rz + rd - fd - 0.18;
        const hm = fix.heightMm / 1000;
        const fy = baseY + hm;
        const bd = (fix as any).branchDiamMm ?? 20;
        const brR = bd === 32 ? 0.028 : bd === 25 ? 0.022 : 0.016;  // taper vizual

        // Towel rail — alohida 3D model (devorga yopishtirilgan radiator)
        if (fix.type === 'towel_rail') {
          // Gorizontal trubalar (polotentsesushitel)
          const trW = 0.55, trD = 0.08;
          for (let ti = 0; ti < 5; ti++) {
            const ty = fy + ti * 0.06;
            bx(scene, fx_x, ty, fx_z, trW, 0.012, trD,
              new THREE.MeshLambertMaterial({ color: 0xd1d5db, emissive: 0x888888, emissiveIntensity: 0.2 }),
              false);
          }
          // Ikki vertikal collector
          cyl(scene, fx_x, fy, fx_z+trD/2, fx_x, fy+0.24, fx_z+trD/2, 0.014, M.hot);
          cyl(scene, fx_x+trW, fy, fx_z+trD/2, fx_x+trW, fy+0.24, fx_z+trD/2, 0.014, M.hot);
        } else {
          // Oddiy jihoz — plita
          bx(scene, fx_x, fy, fx_z, fw, fh, fd, M.fixture, true, 0x93c5fd);
        }

        // Cold water vertical to fixture (taper radius)
        if (fix.coldWater) {
          cyl(scene, fx_x+fw/2, baseY, fx_z+fd/2, fx_x+fw/2, fy, fx_z+fd/2, brR, M.cold);
        }
        // Hot water if needed
        if (fix.hotWater) {
          cyl(scene, fx_x+fw/2+0.07, baseY+0.05, fx_z+fd/2, fx_x+fw/2+0.07, fy, fx_z+fd/2, brR, M.hot);
        }

        // Horizontal branch from riser (at fixture height)
        const riserZ = coldR.length > 0 ? 1.2 : 1.5;
        if (fix.coldWater) {
          cyl(scene, RISERS_X, fy, riserZ, fx_x+fw/2, fy, fx_z+fd/2, brR, M.cold);
        }
        if (fix.hotWater && hotR.length > 0) {
          const hrz = 1.2 + coldR.length*0.6;
          cyl(scene, RISERS_X, fy-0.07, hrz, fx_x+fw/2+0.07, fy-0.07, fx_z+fd/2, brR, M.hot);
        }

        // Height label (PDF 14: 550мм, 900мм, 1000мм...)
        const hL = label(`${fix.heightMm}мм`, '#4b5563', 'rgba(249,250,251,0.88)');
        hL.scale.set(0.75, 0.22, 1);
        hL.position.set(fx_x + fw/2, fy + fh + 0.22, fx_z - 0.35);
        scene.add(hL);

        // Branch diam label
        const dL = label(`ø${bd}`, '#6b7280', 'rgba(255,255,255,0)');
        dL.scale.set(0.5, 0.18, 1);
        dL.position.set(fx_x + fw/2, fy + 0.12, fx_z + fd + 0.2);
        scene.add(dL);

        // Tee joint on riser
        bx(scene, RISERS_X-0.05, fy-0.05, riserZ-0.05, 0.10, 0.10, 0.10, M.tee);
      });
    });
  });

  // ── Notes at bottom ───────────────────────────────────────────────────────
  schema.notes.forEach((note, ni) => {
    const nl = label(note.slice(0,38), '#374151', 'rgba(248,250,252,0.92)');
    nl.scale.set(4.2, 0.45, 1);
    nl.position.set(totalW*0.4, -0.6 - ni*0.58, totalW + 1);
    scene.add(nl);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
const WaterSupply3DCanvas = forwardRef<WaterSupply3DCanvasHandle, Props>(({ schema }, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendRef  = useRef<THREE.WebGLRenderer | null>(null);
  const animRef  = useRef<number>(0);

  useImperativeHandle(ref, () => ({
    exportToPdf(filename = 'water-supply-3d.pdf') {
      if (!rendRef.current) return;
      const url = rendRef.current.domElement.toDataURL('image/png');
      const pdf = new jsPDF({ orientation:'landscape', unit:'mm', format:'a2' });
      pdf.addImage(url,'PNG',10,10,400,270);
      pdf.save(filename);
    },
  }));

  useEffect(() => {
    const el = mountRef.current;
    if (!el || !schema) return;
    const W = el.clientWidth||900, H = el.clientHeight||600;

    const renderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setSize(W,H); renderer.shadowMap.enabled=true;
    renderer.setClearColor(0xf8fafc);
    el.appendChild(renderer.domElement); rendRef.current=renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xf8fafc, 50, 120);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.9); d1.position.set(10,20,10); d1.castShadow=true; scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xe0f2fe, 0.4); d2.position.set(-8,10,-5); scene.add(d2);
    const d3 = new THREE.DirectionalLight(0xfff7ed, 0.3); d3.position.set(0,6,-10); scene.add(d3);

    buildScene(scene, schema, makeMats());

    // Auto-fit camera
    const box3 = new THREE.Box3().setFromObject(scene);
    const center = box3.getCenter(new THREE.Vector3());
    const size   = box3.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    const camera = new THREE.PerspectiveCamera(48, W/H, 0.1, 500);
    camera.position.set(center.x - maxDim*0.5, center.y + maxDim*0.55, center.z + maxDim*0.75);
    camera.lookAt(center);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping=true; controls.dampingFactor=0.06;
    controls.minDistance=2; controls.maxDistance=maxDim*4;
    controls.update();

    const animate = () => { animRef.current=requestAnimationFrame(animate); controls.update(); renderer.render(scene,camera); };
    animate();

    const onResize = () => { const nW=el.clientWidth,nH=el.clientHeight; camera.aspect=nW/nH; camera.updateProjectionMatrix(); renderer.setSize(nW,nH); };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', onResize);
      controls.dispose(); renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      rendRef.current=null;
    };
  }, [schema]);

  return (
    <div style={{ width:'100%', height:'100%', position:'relative' }}>
      <div ref={mountRef} style={{ width:'100%', height:'100%' }} />
      <div style={{ position:'absolute', bottom:16, left:16, background:'rgba(255,255,255,0.88)', borderRadius:8, padding:'8px 14px', fontSize:11, color:'#374151', backdropFilter:'blur(4px)', border:'1px solid rgba(0,0,0,0.08)' }}>
        🖱 Sol klik = aylanish · O'ng klik = pan · Scroll = zoom
      </div>
      <div style={{ position:'absolute', top:16, right:16, background:'rgba(255,255,255,0.92)', borderRadius:8, padding:'10px 14px', fontSize:11, color:'#374151', backdropFilter:'blur(4px)', border:'1px solid rgba(0,0,0,0.08)', lineHeight:'1.8' }}>
        <div style={{ fontWeight:700, marginBottom:4, fontSize:12 }}>PARAMETRLAR</div>
        <div><span style={{ color:'#3b82f6', fontWeight:700 }}>●</span> В1 — Sovuq suv</div>
        <div><span style={{ color:'#ef4444', fontWeight:700 }}>●</span> Т3 — Issiq suv</div>
        <div><span style={{ color:'#f59e0b', fontWeight:700 }}>●</span> Т4 — Sirkul</div>
        <div style={{ marginTop:6, borderTop:'1px solid #e2e8f0', paddingTop:6 }}>
          <div>Quvurlar: PPR PN20</div>
          <div>Boyler: {schema.boilerTag}</div>
          <div>Jihoz: {schema.totalFixtures} ta</div>
          <div>Stoyak: {schema.totalRisers} ta</div>
        </div>
      </div>
    </div>
  );
});

WaterSupply3DCanvas.displayName = 'WaterSupply3DCanvas';
export default WaterSupply3DCanvas;
