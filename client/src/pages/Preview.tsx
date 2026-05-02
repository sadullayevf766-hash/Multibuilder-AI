import { useState, useRef, useEffect } from 'react';
import Canvas2D, { type Canvas2DHandle } from '../components/Canvas2D';
import AxonometricCanvas from '../components/AxonometricCanvas';
import PlumbingCanvas3D from '../components/PlumbingCanvas3D';
import ElectricalCanvas from '../components/ElectricalCanvas';
import SingleLineCanvas from '../components/SingleLineCanvas';
import ElevationCanvas from '../components/ElevationCanvas';
import ArchCanvas3D from '../components/ArchCanvas3D';
import ElectricalCanvas3D from '../components/ElectricalCanvas3D';
import DecorCanvas2D from '../components/DecorCanvas2D';
import DecorCanvas3D from '../components/DecorCanvas3D';
import type { DrawingData, ElectricalDrawingData, ArchDrawingData, DecorSchema, RoomSpec, FloorPlan } from '../../../shared/types';

// ── Pre-defined test data (no Gemini needed) ───────────────────────────────────

const ARCH_BEDROOM: RoomSpec = {
  id: 'arch-bed', name: 'Yotoqxona', width: 4, length: 5,
  fixtures: [], doors: [{ id: 'd1', wall: 'south', width: 0.9 }],
  windows: [{ id: 'w1', wall: 'north', width: 1.5 }],
};
const ARCH_BATHROOM: RoomSpec = {
  id: 'arch-bath', name: 'Hammom', width: 3, length: 4,
  fixtures: [], doors: [{ id: 'd1', wall: 'south', width: 0.9 }],
  windows: [{ id: 'w1', wall: 'north', width: 0.6 }],
};
const ARCH_LIVING: RoomSpec = {
  id: 'arch-liv', name: 'Mehmonxona', width: 6, length: 5,
  fixtures: [], doors: [{ id: 'd1', wall: 'south', width: 1.0 }],
  windows: [{ id: 'w1', wall: 'north', width: 1.5 }, { id: 'w2', wall: 'north', width: 1.5 }],
};

const ELEC_BATHROOM: RoomSpec = {
  id: 'bath-1', name: 'Hammom', width: 3, length: 4,
  fixtures: [], doors: [{ id: 'd1', wall: 'south', width: 0.9 }], windows: [],
};
const ELEC_KITCHEN: RoomSpec = {
  id: 'kit-1', name: 'Oshxona', width: 5, length: 4,
  fixtures: [], doors: [{ id: 'd1', wall: 'south', width: 0.9 }], windows: [],
};
const ELEC_BEDROOM: RoomSpec = {
  id: 'bed-1', name: 'Yotoqxona', width: 4, length: 5,
  fixtures: [], doors: [{ id: 'd1', wall: 'south', width: 0.9 }], windows: [],
};
const ELEC_LIVING: RoomSpec = {
  id: 'liv-1', name: 'Mehmonxona', width: 6, length: 5,
  fixtures: [], doors: [{ id: 'd1', wall: 'south', width: 0.9 }], windows: [],
};

const MULTI_FP: FloorPlan = {
  id: 'fp-multi', name: '3 xonali kvartira', totalArea: 60,
  buildingDimensions: { width: 12, length: 10 },
  rooms: [
    { id: 'r1', position: { x: 0, y: 0 }, connections: [],
      roomSpec: { id: 'bath-2', name: 'Hammom', width: 3, length: 4, fixtures: [], doors: [{ id: 'd1', wall: 'east', width: 0.9 }], windows: [{ id: 'w1', wall: 'north', width: 0.6 }] } },
    { id: 'r2', position: { x: 3, y: 0 }, connections: [],
      roomSpec: { id: 'kit-2', name: 'Oshxona', width: 5, length: 4, fixtures: [], doors: [{ id: 'd2', wall: 'south', width: 0.9 }], windows: [{ id: 'w2', wall: 'north', width: 1.2 }] } },
    { id: 'r3', position: { x: 0, y: 4 }, connections: [],
      roomSpec: { id: 'bed-2', name: 'Yotoqxona', width: 4, length: 6, fixtures: [], doors: [{ id: 'd3', wall: 'east', width: 0.9 }], windows: [{ id: 'w3', wall: 'south', width: 1.5 }] } },
    { id: 'r4', position: { x: 4, y: 4 }, connections: [],
      roomSpec: { id: 'liv-2', name: 'Mehmonxona', width: 8, length: 6, fixtures: [], doors: [{ id: 'd4', wall: 'north', width: 1.0 }], windows: [{ id: 'w4', wall: 'south', width: 2.0 }] } },
  ],
};

// ── Test case types ────────────────────────────────────────────────────────────

type TestCase =
  | { label: string; group: 'fp';    kind: 'floor-plan' | 'plumbing'; desc: string }
  | { label: string; group: 'elec';  kind: 'elec-room'; roomSpec: RoomSpec }
  | { label: string; group: 'elec';  kind: 'elec-fp';   floorPlan: FloorPlan }
  | { label: string; group: 'arch';  kind: 'arch-room'; roomSpec: RoomSpec }
  | { label: string; group: 'arch';  kind: 'arch-fp';   floorPlan: FloorPlan }
  | { label: string; group: 'decor'; kind: 'decor';     desc: string };

const TEST_CASES: TestCase[] = [
  { label: '3×4 Hammom',    group: 'fp',   kind: 'floor-plan', desc: '3x4 metr hammom, shimolda lavabo va dush, janubda eshik' },
  { label: '5×4 Oshxona',   group: 'fp',   kind: 'floor-plan', desc: '5x4 metr oshxona, shimolda lavabo va plita, janubda eshik' },
  { label: '4×5 Yotoqxona', group: 'fp',   kind: 'floor-plan', desc: "4x5 metr yotoqxona, sharqda karavot, g'arbda shkaf" },
  { label: "Ko'p xonali",   group: 'fp',   kind: 'floor-plan', desc: "5x4 oshxona\n4x3 hammom\n4x5 yotoqxona" },
  { label: 'Suv sxemasi',   group: 'fp',   kind: 'plumbing',   desc: '2 qavatli bino, har qavatda lavabo, unitaz, dush' },
  { label: '⚡ Hammom el.', group: 'elec', kind: 'elec-room',  roomSpec: ELEC_BATHROOM },
  { label: '⚡ Oshxona el.',group: 'elec', kind: 'elec-room',  roomSpec: ELEC_KITCHEN  },
  { label: '⚡ Yotoq el.',  group: 'elec', kind: 'elec-room',  roomSpec: ELEC_BEDROOM  },
  { label: '⚡ Mehmon el.', group: 'elec', kind: 'elec-room',  roomSpec: ELEC_LIVING   },
  { label: "⚡ Ko'p xona",  group: 'elec', kind: 'elec-fp',    floorPlan: MULTI_FP     },
  { label: '🛋️ Mehmon dizayn', group: 'decor', kind: 'decor', desc: 'zamonaviy uslubda 5x4 metrli mehmonxona' },
  { label: '🛏️ Yotoq dizayn',  group: 'decor', kind: 'decor', desc: 'skandinaviya uslubda 4x5 metrli yotoqxona' },
  { label: '🍳 Oshxona dizayn', group: 'decor', kind: 'decor', desc: 'minimalist uslubda 3.5x4 oshxona' },
  { label: '🛁 Hammom dizayn',  group: 'decor', kind: 'decor', desc: 'zamonaviy hammom 2.5x3' },
  { label: '💼 Kabinet dizayn', group: 'decor', kind: 'decor', desc: 'klassik uslubda 3.5x4.5 kabinet' },
  { label: '🏛️ Yotoq fasad', group: 'arch', kind: 'arch-room', roomSpec: ARCH_BEDROOM  },
  { label: '🏛️ Hammom fasad',group: 'arch', kind: 'arch-room', roomSpec: ARCH_BATHROOM },
  { label: '🏛️ Mehmon fasad',group: 'arch', kind: 'arch-room', roomSpec: ARCH_LIVING   },
  { label: "🏛️ Ko'p fasad", group: 'arch', kind: 'arch-fp',   floorPlan: MULTI_FP     },
];

const GROUP_BG: Record<string, string> = { fp: '#fff', elec: '#fef3c7', arch: '#eff6ff', decor: '#fdf4ff' };

// ── Arch view tabs ─────────────────────────────────────────────────────────────
const ARCH_VIEWS = [
  { key: 'fasad-1' as const, label: '1-fasad (janub)' },
  { key: 'fasad-2' as const, label: '2-fasad (shimol)' },
  { key: 'fasad-3' as const, label: '3-fasad (g\'arb)' },
  { key: 'fasad-4' as const, label: '4-fasad (sharq)' },
  { key: 'kesim'   as const, label: '1-1 Kesim' },
  { key: '3d'      as const, label: '🏛️ 3D Ko\'rinish' },
];
type ArchView = typeof ARCH_VIEWS[number]['key'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Preview() {
  const [drawingData,    setDrawingData]    = useState<DrawingData | null>(null);
  const [electricalData, setElectricalData] = useState<ElectricalDrawingData | null>(null);
  const [archData,       setArchData]       = useState<ArchDrawingData | null>(null);
  const [decorData,      setDecorData]      = useState<DecorSchema | null>(null);
  const [archView,       setArchView]       = useState<ArchView>('fasad-1');
  const [elecView,       setElecView]       = useState<'plan' | 'schema' | '3d'>('plan');
  const [plumbView,      setPlumbView]      = useState<'2d' | '3d'>('2d');
  const [decorView,      setDecorView]      = useState<'2d' | '3d'>('2d');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [activeTest,  setActiveTest]  = useState('');
  const [containerWidth, setContainerWidth] = useState(900);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<Canvas2DHandle>(null);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) setContainerWidth(containerRef.current.offsetWidth);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Re-measure when any result loads (ref points to newly-mounted canvas div)
  useEffect(() => {
    if (containerRef.current) setContainerWidth(containerRef.current.offsetWidth);
  }, [drawingData, electricalData, archData, decorData]);

  const runTest = async (tc: TestCase) => {
    setLoading(true);
    setError('');
    setActiveTest(tc.label);
    setDrawingData(null);
    setElectricalData(null);
    setArchData(null);
    setDecorData(null);

    try {
      if (tc.kind === 'elec-room') {
        const res = await fetch('/api/generate-electrical', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomSpec: tc.roomSpec }) });
        if (!res.ok) throw new Error('API xatolik');
        setElectricalData((await res.json()).electricalData);

      } else if (tc.kind === 'elec-fp') {
        const res = await fetch('/api/generate-electrical', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ floorPlan: tc.floorPlan }) });
        if (!res.ok) throw new Error('API xatolik');
        setElectricalData((await res.json()).electricalData);

      } else if (tc.kind === 'arch-room') {
        const res = await fetch('/api/generate-architecture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomSpec: tc.roomSpec }) });
        if (!res.ok) throw new Error('API xatolik');
        setArchData((await res.json()).archData);
        setArchView('fasad-1');

      } else if (tc.kind === 'arch-fp') {
        const res = await fetch('/api/generate-architecture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ floorPlan: tc.floorPlan }) });
        if (!res.ok) throw new Error('API xatolik');
        setArchData((await res.json()).archData);
        setArchView('fasad-1');

      } else if (tc.kind === 'decor') {
        const res = await fetch('/api/generate-decor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: tc.desc }) });
        if (!res.ok) throw new Error('API xatolik');
        setDecorData((await res.json()).decorSchema);
        setDecorView('2d');

      } else {
        const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: tc.desc, drawingType: tc.kind === 'plumbing' ? 'plumbing-axonometric' : 'floor-plan' }) });
        if (!res.ok) throw new Error('API xatolik');
        setDrawingData((await res.json()).drawingData);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setLoading(false);
    }
  };

  const archElevIdx  = archView === 'fasad-1' ? 0 : archView === 'fasad-2' ? 1 : archView === 'fasad-3' ? 2 : 3;
  const archViewMode: 'elevations' | 'section' = archView === 'kesim' ? 'section' : 'elevations';
  const archIs3d = archView === '3d';

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 20, background: '#f5f5f5', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: 16, fontSize: 20 }}>Canvas Drawing Preview Test</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {TEST_CASES.map(tc => (
          <button key={tc.label} onClick={() => runTest(tc)} disabled={loading}
            style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid #ddd',
              background: activeTest === tc.label ? '#333' : GROUP_BG[tc.group],
              color: activeTest === tc.label ? '#fff' : '#333',
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13,
            }}>
            {tc.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: '#666' }}>Yuklanmoqda...</p>}
      {error   && <p style={{ color: 'red' }}>{error}</p>}

      {/* ── Decor / Interior Design ── */}
      {decorData && !loading && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
            {([['2d', '📐 Reja (2D)'], ['3d', '🏠 3D Vizualizatsiya']] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setDecorView(k)}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12,
                  background: decorView === k ? '#7c3aed' : '#fff', color: decorView === k ? '#fff' : '#333', cursor: 'pointer' }}>
                {lbl}
              </button>
            ))}
            <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>
              {decorData.roomName} · {decorData.roomWidth}×{decorData.roomLength} m ·{' '}
              {decorData.furniture.length} mebel · {decorData.style}
            </span>
          </div>
          <div ref={containerRef} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #ddd',
            background: decorView === '3d' ? '#D6E4F0' : 'white' }}>
            {decorView === '2d'
              ? <DecorCanvas2D schema={decorData} width={containerWidth} />
              : <DecorCanvas3D schema={decorData} width={containerWidth} />
            }
          </div>
          <details style={{ marginTop: 6 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: '#666' }}>
              Mebel: {decorData.furniture.length} | Ochilmalar: {decorData.openings.length} | Pol: {decorData.material.floorType}
            </summary>
            <pre style={{ background: '#1a1a1a', color: '#ccc', padding: 12, borderRadius: 6, overflow: 'auto', fontSize: 10, maxHeight: 260 }}>
              {JSON.stringify(decorData, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* ── Architecture drawing ── */}
      {archData && !loading && (
        <div>
          {/* View tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {ARCH_VIEWS.map(v => (
              <button key={v.key} onClick={() => setArchView(v.key)}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12,
                  background: archView === v.key ? '#1d4ed8' : '#fff', color: archView === v.key ? '#fff' : '#333', cursor: 'pointer' }}>
                {v.label}
              </button>
            ))}
          </div>

          <div ref={containerRef} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #ddd', marginBottom: 12, background: archIs3d ? '#eef2f7' : 'white' }}>
            {archIs3d
              ? <ArchCanvas3D data={archData} width={containerWidth} />
              : <ElevationCanvas data={archData} view={archViewMode} elevationIdx={archElevIdx} width={containerWidth} />
            }
          </div>

          <details style={{ marginTop: 4 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: '#666' }}>
              Fasadlar: {archData.elevations.length} | Xonalar (kesim): {archData.section.rooms.length} | Balandlik: {archData.section.floorHeight}m
            </summary>
            <pre style={{ background: '#1a1a1a', color: '#ccc', padding: 12, borderRadius: 6, overflow: 'auto', fontSize: 10, maxHeight: 300 }}>
              {JSON.stringify(archData, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* ── Electrical drawing ── */}
      {electricalData && !loading && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {([['plan', '⚡ Reja'], ['schema', '📋 Sxema'], ['3d', '🏠 3D Ko\'rinish']] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setElecView(k)}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12,
                  background: elecView === k ? '#f59e0b' : '#fff', color: elecView === k ? '#fff' : '#333', cursor: 'pointer' }}>
                {lbl}
              </button>
            ))}
          </div>

          <div ref={!archData ? containerRef : undefined}
            style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #ddd', marginBottom: 12,
              background: elecView === '3d' ? '#f0f4f8' : 'white' }}>
            {elecView === 'plan'   && <ElectricalCanvas data={electricalData} width={containerWidth} />}
            {elecView === 'schema' && <SingleLineCanvas panel={electricalData.panel} width={containerWidth} />}
            {elecView === '3d'     && <ElectricalCanvas3D data={electricalData} width={containerWidth} />}
          </div>

          <details>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: '#666' }}>
              Symbols: {electricalData.symbols.length} | Circuits: {electricalData.panel.circuits.length} | Load: {electricalData.panel.totalLoad} kVt
            </summary>
            <pre style={{ background: '#1a1a1a', color: '#ccc', padding: 12, borderRadius: 6, overflow: 'auto', fontSize: 10, maxHeight: 300 }}>
              {JSON.stringify(electricalData, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* ── Plumbing (2D + 3D) ── */}
      {drawingData && !loading && drawingData.drawingType === 'plumbing-axonometric' && drawingData.plumbingSchema && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {([['2d', '📐 Sxema (2D)'], ['3d', '🔧 3D Ko\'rinish']] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setPlumbView(k)}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12,
                  background: plumbView === k ? '#2563eb' : '#fff', color: plumbView === k ? '#fff' : '#333', cursor: 'pointer' }}>
                {lbl}
              </button>
            ))}
            <span style={{ fontSize: 11, color: '#888', alignSelf: 'center', marginLeft: 8 }}>
              Qavatlar: {drawingData.plumbingSchema.floorCount} | Priborlar: {drawingData.plumbingSchema.fixtures.length} | Quvurlar: {drawingData.plumbingSchema.pipes.length + drawingData.plumbingSchema.risers.length}
            </span>
          </div>
          <div ref={containerRef} style={{ background: plumbView === '3d' ? '#f8fafc' : 'white', borderRadius: 8, overflow: 'hidden', border: '1px solid #ddd' }}>
            {plumbView === '2d'
              ? <AxonometricCanvas schema={drawingData.plumbingSchema} width={containerWidth} />
              : <PlumbingCanvas3D schema={drawingData.plumbingSchema} width={containerWidth} />
            }
          </div>
        </div>
      )}

      {/* ── Floor plan ── */}
      {drawingData && !loading && drawingData.drawingType !== 'plumbing-axonometric' && (
        <div>
          <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
            <button onClick={() => canvasRef.current?.exportToPdf('test.pdf')}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 12 }}>
              PDF yuklab olish
            </button>
            <span style={{ fontSize: 11, color: '#888', alignSelf: 'center' }}>
              Walls: {drawingData.walls.length} | Fixtures: {drawingData.fixtures.length} | Pipes: {drawingData.pipes.length}
            </span>
          </div>
          <div ref={!archData ? containerRef : undefined} style={{ background: 'white', borderRadius: 8, overflow: 'hidden', border: '1px solid #ddd' }}>
            <Canvas2D ref={canvasRef} drawingData={drawingData} width={containerWidth} scale={1} />
          </div>
        </div>
      )}
    </div>
  );
}
