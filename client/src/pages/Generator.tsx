import { apiUrl } from '../lib/api';
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Canvas2D, { type Canvas2DHandle } from '../components/Canvas2D';
import Canvas3D, { type Canvas3DHandle } from '../components/Canvas3D';
import AxonometricCanvas, { type AxonometricCanvasHandle } from '../components/AxonometricCanvas';
import PlumbingCanvas3D, { type PlumbingCanvas3DHandle } from '../components/PlumbingCanvas3D';
import ElectricalCanvas, { type ElectricalCanvasHandle } from '../components/ElectricalCanvas';
import SingleLineCanvas from '../components/SingleLineCanvas';
import ElectricalCanvas3D from '../components/ElectricalCanvas3D';
import ElevationCanvas, { type ElevationCanvasHandle } from '../components/ElevationCanvas';
import ArchCanvas3D, { type ArchCanvas3DHandle } from '../components/ArchCanvas3D';
import DecorCanvas2D from '../components/DecorCanvas2D';
import DecorCanvas3D from '../components/DecorCanvas3D';
import FloorNavigator from '../components/FloorNavigator';
import RoomPanel from '../components/RoomPanel';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { DrawingData, ElectricalDrawingData, ArchDrawingData, DecorSchema, Building } from '../../../shared/types';

type DrawingType = 'floor-plan' | 'plumbing-axonometric' | 'electrical-floor-plan' | 'architecture' | 'decor';
type LoadingState = 'idle' | 'generating' | 'rendering' | 'saving' | 'ready' | 'error';
type ArchView = 'fasad-1' | 'fasad-2' | 'fasad-3' | 'fasad-4' | 'kesim' | '3d';

const FAVICON_PATHS: Record<LoadingState, string> = {
  idle:       '/favicon-idle.png',
  generating: '/favicon-generating.png',
  rendering:  '/favicon-rendering.png',
  saving:     '/favicon-saving.png',
  ready:      `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%2322c55e'/><polyline points='8,17 13,22 24,11' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/></svg>`,
  error:      '/favicon-error.png',
};

function setFavicon(state: LoadingState) {
  const url = FAVICON_PATHS[state];
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
  link.href = url;
  link.type = url.startsWith('data:') ? 'image/svg+xml' : 'image/png';
}

const EXAMPLES: Record<DrawingType, string[]> = {
  'floor-plan': [
    '3x4 metr hammom, shimolda lavabo va dush, janubda eshik',
    '5x4 metr oshxona, shimolda lavabo va plita, janubda eshik',
    '4x5 metr yotoqxona, sharqda karavot, g\'arbda shkaf',
    '5x4 oshxona\n4x3 hammom\n4x5 yotoqxona',
    '2 qavatli uy: 1-qavatda mehmonxona 5x6, oshxona 4x4, hammom 2x3; 2-qavatda yotoqxona 4x5, yotoqxona 3x4, hammom 2x3',
    '3 qavatli turar-joy: 1-qavat mehmonxona va oshxona, 2-qavat 2 yotoqxona va hammom, 3-qavat bolalar xonasi va ofis',
  ],
  'plumbing-axonometric': [
    '2 qavatli bino, har qavatda lavabo, unitaz, dush',
    '3 qavatli uy, 1-qavatda lavabo va unitaz, 2-qavatda vanna va unitaz, 3-qavatda dush va lavabo',
    '1 qavat, lavabo, unitaz, vanna, kir yuvish mashinasi',
    '4 qavatli bino, har qavatda lavabo, unitaz, dush',
  ],
  'electrical-floor-plan': [
    '3x4 metr hammom, janubda eshik',
    '5x4 metr oshxona, janubda eshik',
    '4x5 metr yotoqxona, janubda eshik',
    '6x5 metr mehmonxona, janubda eshik',
    '5x4 oshxona\n4x3 hammom\n4x5 yotoqxona',
  ],
  'architecture': [
    '4x5 metr yotoqxona, janubda eshik, shimolda deraza',
    '3x4 metr hammom, sharqda eshik, g\'arbda deraza',
    '6x5 metr mehmonxona, janubda eshik, shimolda 2 deraza',
    '5x4 metr oshxona, janubda eshik, shimolda 2 deraza',
    '5x4 oshxona\n4x3 hammom\n4x5 yotoqxona',
  ],
  'decor': [
    'zamonaviy uslubda 5x4 metrli mehmonxona',
    'skandinaviya uslubda 4x5 metrli yotoqxona',
    'minimalist uslubda 3.5x4 oshxona',
    'klassik uslubda 3.5x4.5 kabinet',
    'zamonaviy hammom 2.5x3',
  ],
};

const TYPE_META: Record<DrawingType, { icon: string; label: string; placeholder: string }> = {
  'floor-plan':            { icon: '📐', label: 'Arxitektura rejasi',    placeholder: 'Masalan: 3x4 metr hammom, shimolda lavabo, janubda eshik...' },
  'plumbing-axonometric':  { icon: '🔧', label: 'Suv ta\'minoti sxemasi', placeholder: 'Masalan: 2 qavatli bino, har qavatda lavabo, unitaz, dush...' },
  'electrical-floor-plan': { icon: '⚡', label: 'Elektrik chizma',        placeholder: 'Masalan: 3x4 metr hammom, janubda eshik...' },
  'architecture':          { icon: '🏛️', label: 'Arxitektura chizmasi',  placeholder: 'Masalan: 4x5 metr yotoqxona, janubda eshik, shimolda deraza...' },
  'decor':                 { icon: '🛋️', label: 'Dizayn loyihasi',        placeholder: 'Masalan: zamonaviy uslubda 5x4 metrli mehmonxona...' },
};

const ARCH_VIEWS: { key: ArchView; label: string }[] = [
  { key: 'fasad-1', label: '1-fasad (janub)' },
  { key: 'fasad-2', label: '2-fasad (shimol)' },
  { key: 'fasad-3', label: '3-fasad (g\'arb)' },
  { key: 'fasad-4', label: '4-fasad (sharq)' },
  { key: 'kesim',   label: '1-1 Kesim' },
  { key: '3d',      label: '🏛️ 3D Ko\'rinish' },
];

export default function Generator() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const canvasRef      = useRef<Canvas2DHandle>(null);
  const canvas3dRef    = useRef<Canvas3DHandle>(null);
  const axoRef         = useRef<AxonometricCanvasHandle>(null);
  const plumbing3dRef  = useRef<PlumbingCanvas3DHandle>(null);
  const electricalRef  = useRef<ElectricalCanvasHandle>(null);
  const elevationRef   = useRef<ElevationCanvasHandle>(null);
  const arch3dRef      = useRef<ArchCanvas3DHandle>(null);
  const decorCanvasRef = useRef<import('../components/DecorCanvas2D').DecorCanvas2DHandle>(null);
  const containerRef   = useRef<HTMLDivElement>(null);

  const [description,    setDescription]    = useState('');
  const [drawingType,    setDrawingType]    = useState<DrawingType>('floor-plan');
  const [loadingState,   setLoadingState]   = useState<LoadingState>('idle');
  const [drawingData,    setDrawingData]    = useState<DrawingData | null>(null);
  const [electricalData, setElectricalData] = useState<ElectricalDrawingData | null>(null);
  const [archData,       setArchData]       = useState<ArchDrawingData | null>(null);
  const [decorData,      setDecorData]      = useState<DecorSchema | null>(null);
  const [electricalView, setElectricalView] = useState<'plan' | 'schema' | '3d'>('plan');
  const [archView,       setArchView]       = useState<ArchView>('fasad-1');
  const [decorView,      setDecorView]      = useState<'2d' | '3d'>('2d');
  const [error,          setError]          = useState('');
  const [canvasWidth,    setCanvasWidth]    = useState(900);
  const [viewMode,       setViewMode]       = useState<'2d' | '3d'>('2d');
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [projectName,    setProjectName]    = useState('');
  const [pendingDrawing, setPendingDrawing] = useState<DrawingData | null>(null);
  // Multi-floor building state
  const [building,       setBuilding]       = useState<Building | null>(null);
  const [floorDrawings,  setFloorDrawings]  = useState<DrawingData[]>([]);
  const [currentFloor,   setCurrentFloor]   = useState(1);

  useEffect(() => { setFavicon(loadingState); }, [loadingState]);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) setCanvasWidth(containerRef.current.offsetWidth);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (containerRef.current) setCanvasWidth(containerRef.current.offsetWidth);
  }, [drawingData, electricalData, archData, decorData]);

  const isLoading = loadingState === 'generating' || loadingState === 'rendering' || loadingState === 'saving';

  // Detect multi-floor description
  const isMultiFloorDesc = (desc: string) =>
    /(\d+)\s*(?:qavatli|qavat\b|floor|etaj|kat)/i.test(desc);

  const handleGenerate = async () => {
    if (!description.trim()) { setError('Iltimos, xona tavsifini kiriting'); return; }
    try {
      setLoadingState('generating');
      setError('');
      setDrawingData(null);
      setElectricalData(null);
      setArchData(null);
      setDecorData(null);
      setBuilding(null);
      setFloorDrawings([]);

      // ── Multi-floor building ───────────────────────────────────────────────
      if (drawingType === 'floor-plan' && isMultiFloorDesc(description)) {
        const response = await fetch(apiUrl('/api/generate-building'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description }),
        });
        if (!response.ok) throw new Error('Bino yaratishda xatolik');
        const data = await response.json();
        setLoadingState('rendering');
        setTimeout(() => {
          setBuilding(data.building);
          setFloorDrawings(data.floorDrawings);
          setCurrentFloor(1);
          // Also set drawingData to first floor for export
          if (data.floorDrawings?.length > 0) {
            setDrawingData(data.floorDrawings[0]);
          }
          setLoadingState('ready');
        }, 300);
        return;
      }

      // ── Standard single-type generation ───────────────────────────────────
      let response: Response;
      if (drawingType === 'decor') {
        response = await fetch(apiUrl('/api/generate-decor'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description }),
        });
      } else {
        response = await fetch(apiUrl('/api/generate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description, drawingType }),
        });
      }
      if (!response.ok) throw new Error('Chizma yaratishda xatolik yuz berdi');
      const data = await response.json();

      setLoadingState('rendering');
      setTimeout(() => {
        if (drawingType === 'decor') {
          setDecorData(data.decorSchema);
          setDecorView('2d');
        } else if (drawingType === 'electrical-floor-plan') {
          setElectricalData(data.electricalData);
          setElectricalView('plan');
        } else if (drawingType === 'architecture') {
          setArchData(data.archData);
          setArchView('fasad-1');
        } else {
          const drawing = data.drawingData;
          setDrawingData(drawing);
          setPendingDrawing(drawing);
          setShowNameDialog(true);
        }
        setLoadingState('ready');
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noma'lum xatolik");
      setLoadingState('error');
    }
  };

  // Current floor drawing (building mode)
  const currentFloorDrawing = building && floorDrawings.length > 0
    ? floorDrawings[currentFloor - 1] ?? floorDrawings[0]
    : null;
  const currentFloorSpec = building?.floors.find(f => f.floorNumber === currentFloor);

  const handleAutoSave = async () => {
    if (!projectName.trim() || !pendingDrawing || !user) return;
    try {
      setLoadingState('saving');
      setShowNameDialog(false);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }
      const response = await fetch(apiUrl('/api/projects'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: user.id, name: projectName, description, drawingData: pendingDrawing }),
      });
      if (!response.ok) { const d = await response.json(); throw new Error(d.message || 'Saqlashda xatolik'); }
      const project = await response.json();
      navigate(`/project/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noma'lum xatolik");
      setLoadingState('ready');
    }
  };

  const handleSkipSave = () => { setShowNameDialog(false); setPendingDrawing(null); };

  const handleDownloadDxf = async () => {
    if (!drawingData) return;
    try {
      const response = await fetch(apiUrl('/api/export/dxf'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawingData }),
      });
      if (!response.ok) throw new Error('DXF yuklab olishda xatolik');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `floorplan-${drawingData.id}.dxf`; a.click();
    } catch { setError('DXF faylni yuklab olishda xatolik'); }
  };

  const handleDownloadPdf = () => {
    if (archData && archView === '3d') { arch3dRef.current?.exportToImage('arxitektura-3d.png'); return; }
    if (archData)       { elevationRef.current?.exportToPdf('arxitektura.pdf'); return; }
    if (electricalData) { electricalRef.current?.exportToPdf('elektrik-chizma.pdf'); return; }
    if (decorData)      { decorCanvasRef.current?.exportToPdf(`dizayn-${decorData.id}.pdf`); return; }
    if (drawingData)    { canvasRef.current?.exportToPdf(`floorplan-${drawingData.id}.pdf`); }
  };

  const switchType = (t: DrawingType) => {
    setDrawingType(t);
    setDrawingData(null);
    setElectricalData(null);
    setArchData(null);
    setDecorData(null);
    setLoadingState('idle');
    setError('');
  };

  // Resolve archView to ElevationCanvas props
  const archElevIdx  = archView === 'fasad-1' ? 0 : archView === 'fasad-2' ? 1 : archView === 'fasad-3' ? 2 : 3;
  const archViewMode: 'elevations' | 'section' = archView === 'kesim' ? 'section' : 'elevations';
  const archIs3d = archView === '3d';

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="text-lg font-semibold tracking-tight">FloorPlan AI</Link>
          <Link to="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-light" style={{ letterSpacing: '-0.02em' }}>Yangi loyiha</h1>
          <p className="text-gray-500 text-sm mt-1">Xona tavsifini yozing — AI chizma yaratadi va avtomatik saqlanadi</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Input panel ── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="liquid-glass border border-white/10 rounded-2xl p-5">
              <label className="block text-sm text-gray-300 mb-2">Chizma turi</label>
              <div className="flex flex-col gap-2 mb-4">
                {(Object.entries(TYPE_META) as [DrawingType, typeof TYPE_META[DrawingType]][]).map(([key, meta]) => (
                  <button key={key} onClick={() => switchType(key)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-medium transition-colors text-left flex items-center gap-2 ${
                      drawingType === key ? 'bg-white text-black' : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}>
                    <span>{meta.icon}</span> {meta.label}
                  </button>
                ))}
              </div>

              <label className="block text-sm text-gray-300 mb-2">Xona tavsifi</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleGenerate(); }}
                placeholder={TYPE_META[drawingType].placeholder}
                className="glass-input w-full h-32 px-4 py-3 rounded-xl text-sm resize-none"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-600 mt-1.5">Ctrl+Enter — yaratish</p>

              {error && (
                <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button onClick={handleGenerate} disabled={isLoading}
                className="mt-4 w-full bg-white text-black py-3 rounded-xl text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {loadingState === 'generating' && '⏳ Yaratilmoqda...'}
                {loadingState === 'rendering'  && '🎨 Chizilmoqda...'}
                {loadingState === 'saving'     && '💾 Saqlanmoqda...'}
                {!isLoading && `${TYPE_META[drawingType].icon} Chizma yaratish`}
              </button>
            </div>

            <div className="liquid-glass border border-white/10 rounded-2xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Misollar</p>
              <div className="space-y-2">
                {EXAMPLES[drawingType].map((ex, i) => (
                  <button key={i} onClick={() => setDescription(ex)}
                    className="w-full text-left text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors font-mono whitespace-pre-line">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Canvas panel ── */}
          <div className="lg:col-span-3">

            {/* Idle */}
            {loadingState === 'idle' && (
              <div className="liquid-glass border border-white/10 rounded-2xl min-h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl mb-4">{TYPE_META[drawingType].icon}</div>
                  <p className="text-gray-500 text-sm">Chizma bu yerda ko'rinadi</p>
                </div>
              </div>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="liquid-glass border border-white/10 rounded-2xl min-h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/40 mx-auto mb-4"></div>
                  <p className="text-gray-400 text-sm">
                    {loadingState === 'generating' ? 'AI tahlil qilmoqda...' :
                     loadingState === 'saving'     ? 'Saqlanmoqda...' : 'Chizma chizilmoqda...'}
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {loadingState === 'error' && (
              <div className="liquid-glass border border-red-500/20 rounded-2xl min-h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-3">⚠️</div>
                  <p className="text-red-400 text-sm">Xatolik yuz berdi. Qayta urinib ko'ring.</p>
                </div>
              </div>
            )}

            {/* ── Architecture result ── */}
            {loadingState === 'ready' && archData && (
              <div className="space-y-3">
                <div className="liquid-glass border border-white/10 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div className="flex gap-1.5 flex-wrap">
                      {ARCH_VIEWS.map(v => (
                        <button key={v.key} onClick={() => setArchView(v.key)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${archView === v.key ? 'bg-white text-black' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                          {v.label}
                        </button>
                      ))}
                    </div>
                    <button onClick={handleDownloadPdf}
                      className="ml-2 px-3 py-1.5 bg-white/10 text-white rounded-lg text-xs hover:bg-white/20 transition-colors border border-white/10 shrink-0">
                      {archIs3d ? '🖼️ PNG' : '📄 PDF'}
                    </button>
                  </div>
                  <div ref={containerRef} className={archIs3d ? 'w-full' : 'bg-white w-full overflow-x-auto'}>
                    {archIs3d ? (
                      <ArchCanvas3D ref={arch3dRef} data={archData} width={canvasWidth} />
                    ) : (
                      <ElevationCanvas
                        ref={elevationRef}
                        data={archData}
                        view={archViewMode}
                        elevationIdx={archElevIdx}
                        width={canvasWidth}
                      />
                    )}
                  </div>
                </div>

                <div className="liquid-glass border border-white/10 rounded-xl px-4 py-2.5 flex flex-wrap gap-4 text-xs text-gray-400">
                  <span>🏛️ {archData.elevations.length} fasad</span>
                  <span>📐 {archData.section.rooms.length} xona (kesim)</span>
                  <span>📏 {archData.section.floorHeight.toFixed(1)}m balandlik</span>
                  <span>🔢 {archData.roomName ?? 'Ko\'p xonali bino'}</span>
                </div>
              </div>
            )}

            {/* ── Electrical result ── */}
            {loadingState === 'ready' && electricalData && (
              <div className="space-y-3">
                <div className="liquid-glass border border-white/10 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div className="flex gap-2 flex-wrap">
                      {([['plan','⚡ Elektr reja'],['schema','📋 Bir chiziqli'],['3d','🏠 3D Ko\'rinish']] as const).map(([k,lbl]) => (
                        <button key={k} onClick={() => setElectricalView(k)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${electricalView === k ? 'bg-white text-black' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                    <button onClick={handleDownloadPdf}
                      className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-xs hover:bg-white/20 transition-colors border border-white/10">
                      {electricalView === '3d' ? '🖼️ PNG' : '📄 PDF'}
                    </button>
                  </div>
                  <div ref={containerRef} className={electricalView === '3d' ? 'w-full' : 'bg-white w-full overflow-x-auto'}>
                    {electricalView === 'plan'   && <ElectricalCanvas ref={electricalRef} data={electricalData} width={canvasWidth} />}
                    {electricalView === 'schema' && <SingleLineCanvas panel={electricalData.panel} width={canvasWidth} />}
                    {electricalView === '3d'     && <ElectricalCanvas3D data={electricalData} width={canvasWidth} />}
                  </div>
                </div>
                <div className="liquid-glass border border-white/10 rounded-xl px-4 py-2.5 flex flex-wrap gap-4 text-xs text-gray-400">
                  <span>⚡ {electricalData.symbols.length} simvol</span>
                  <span>🔌 {electricalData.panel.circuits.length} guruh</span>
                  <span>💡 {electricalData.panel.totalLoad} kVt</span>
                  <span>🔒 {electricalData.panel.mainBreaker}A asosiy avtomat</span>
                </div>
              </div>
            )}

            {/* ── Decor / Interior design result ── */}
            {loadingState === 'ready' && decorData && (
              <div className="space-y-3">
                <div className="liquid-glass border border-white/10 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <div className="flex gap-1.5 flex-wrap items-center">
                      {([['2d','📐 Reja (2D)'],['3d','🏠 3D Ko\'rinish']] as const).map(([k,lbl]) => (
                        <button key={k} onClick={() => setDecorView(k)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${decorView === k ? 'bg-white text-black' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                          {lbl}
                        </button>
                      ))}
                      <span className="text-xs text-gray-500 ml-2">
                        {decorData.roomWidth}×{decorData.roomLength}m · {decorData.furniture.length} mebel
                      </span>
                    </div>
                    {decorView === '2d' && (
                      <button onClick={handleDownloadPdf}
                        className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-xs hover:bg-white/20 transition-colors border border-white/10 shrink-0">
                        📄 PDF
                      </button>
                    )}
                  </div>
                  <div ref={containerRef} className={decorView === '3d' ? 'w-full' : 'bg-white w-full overflow-x-auto'}>
                    {decorView === '2d'
                      ? <DecorCanvas2D ref={decorCanvasRef} schema={decorData} width={canvasWidth} />
                      : <DecorCanvas3D schema={decorData} width={canvasWidth} />
                    }
                  </div>
                </div>
                <div className="liquid-glass border border-white/10 rounded-xl px-4 py-2.5 flex flex-wrap gap-4 text-xs text-gray-400">
                  <span>🛋️ {decorData.roomName}</span>
                  <span>📐 {decorData.roomWidth}×{decorData.roomLength} m ({(decorData.roomWidth*decorData.roomLength).toFixed(1)} m²)</span>
                  <span>🎨 {decorData.style}</span>
                  <span>🪑 {decorData.furniture.length} mebel</span>
                  <span>🪟 {decorData.openings.filter(o=>o.type==='window').length} deraza · {decorData.openings.filter(o=>o.type==='door').length} eshik</span>
                </div>
              </div>
            )}

            {/* ── MULTI-FLOOR BUILDING result ── */}
            {loadingState === 'ready' && building && floorDrawings.length > 0 && (
              <div className="liquid-glass border border-white/10 rounded-2xl overflow-hidden flex flex-col gap-0">
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <FloorNavigator
                    building={building}
                    floorDrawings={floorDrawings}
                    currentFloor={currentFloor}
                    onFloorChange={(n) => {
                      setCurrentFloor(n);
                      setDrawingData(floorDrawings[n - 1] ?? floorDrawings[0]);
                    }}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setViewMode('2d')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === '2d' ? 'bg-white text-black' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                      2D Reja
                    </button>
                    <button onClick={() => setViewMode('3d')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === '3d' ? 'bg-white text-black' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                      3D
                    </button>
                    <button onClick={handleDownloadPdf}
                      className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-xs hover:bg-white/20 transition-colors border border-white/10">
                      📄 PDF
                    </button>
                    <button onClick={handleDownloadDxf}
                      className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-xs hover:bg-white/20 transition-colors border border-white/10">
                      📥 DXF
                    </button>
                  </div>
                </div>

                {/* Main: canvas + room panel */}
                <div className="flex gap-0">
                  {/* Room panel (left sidebar) */}
                  {currentFloorSpec && (
                    <div className="w-48 shrink-0 bg-slate-900 border-r border-white/10 p-3">
                      <RoomPanel floor={currentFloorSpec} />
                    </div>
                  )}
                  {/* Floor canvas */}
                  <div ref={containerRef} className="flex-1 overflow-x-auto bg-white">
                    {currentFloorDrawing && (
                      viewMode === '2d'
                        ? <Canvas2D ref={canvasRef} drawingData={currentFloorDrawing} width={canvasWidth - 192} scale={1} />
                        : <Canvas3D ref={canvas3dRef} drawingData={currentFloorDrawing} width={canvasWidth - 192} />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Single floor plan / plumbing result ── */}
            {loadingState === 'ready' && drawingData && !building && (
              <div className="liquid-glass border border-white/10 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="flex gap-2">
                    <button onClick={() => setViewMode('2d')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === '2d' ? 'bg-white text-black' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                      {drawingData.drawingType === 'plumbing-axonometric' ? '📐 Sxema' : '2D Reja'}
                    </button>
                    <button onClick={() => setViewMode('3d')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === '3d' ? 'bg-white text-black' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                      3D Ko'rinish
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => { setPendingDrawing(drawingData); setShowNameDialog(true); }}
                      className="px-3 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors">
                      💾 Saqlash
                    </button>
                    <button onClick={handleDownloadDxf}
                      className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-xs hover:bg-white/20 transition-colors border border-white/10">
                      📥 DXF
                    </button>
                    <button onClick={handleDownloadPdf}
                      className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-xs hover:bg-white/20 transition-colors border border-white/10">
                      📄 PDF
                    </button>
                  </div>
                </div>
                <div ref={containerRef} className="overflow-x-auto bg-white w-full">
                  {drawingData.drawingType === 'plumbing-axonometric' && drawingData.plumbingSchema ? (
                    viewMode === '3d' ? (
                      <PlumbingCanvas3D ref={plumbing3dRef} schema={drawingData.plumbingSchema} width={canvasWidth} />
                    ) : (
                      <AxonometricCanvas ref={axoRef} schema={drawingData.plumbingSchema} width={canvasWidth} />
                    )
                  ) : viewMode === '2d' ? (
                    <Canvas2D ref={canvasRef} drawingData={drawingData} width={canvasWidth} scale={1} />
                  ) : (
                    <Canvas3D ref={canvas3dRef} drawingData={drawingData} width={canvasWidth} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Auto-save dialog */}
      {showNameDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-medium text-white mb-1">Loyihani saqlash</h3>
            <p className="text-gray-400 text-sm mb-4">Chizma tayyor. Loyiha nomini kiriting va saqlang.</p>
            <input
              type="text" value={projectName} onChange={e => setProjectName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAutoSave(); }}
              placeholder="Masalan: Uy loyihasi"
              className="glass-input w-full px-4 py-3 rounded-xl text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={handleSkipSave}
                className="flex-1 py-2.5 bg-white/10 text-gray-300 rounded-xl text-sm hover:bg-white/20 transition-colors">
                Keyinroq
              </button>
              <button onClick={handleAutoSave} disabled={!projectName.trim()}
                className="flex-1 py-2.5 bg-white text-black rounded-xl text-sm font-medium hover:bg-gray-100 disabled:opacity-50 transition-colors">
                Saqlash →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
