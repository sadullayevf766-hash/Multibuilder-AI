import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Canvas2D, { type Canvas2DHandle } from '../components/Canvas2D';
import Canvas3D, { type Canvas3DHandle } from '../components/Canvas3D';
import AxonometricCanvas, { type AxonometricCanvasHandle } from '../components/AxonometricCanvas';
import PlumbingCanvas3D, { type PlumbingCanvas3DHandle } from '../components/PlumbingCanvas3D';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { DrawingData } from '../../../shared/types';

type LoadingState = 'idle' | 'generating' | 'rendering' | 'saving' | 'ready' | 'error';

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

const EXAMPLES = [
  '3x4 metr hammom, shimolda lavabo va dush, janubda eshik',
  '5x4 metr oshxona, shimolda lavabo va plita, janubda eshik',
  '4x5 metr yotoqxona, sharqda karavot, g\'arbda shkaf',
  '5x4 oshxona\n4x3 hammom\n4x5 yotoqxona',
];

const PLUMBING_EXAMPLES = [
  '2 qavatli bino, har qavatda lavabo, unitaz, dush',
  '3 qavatli uy, 1-qavatda lavabo va unitaz, 2-qavatda vanna va unitaz, 3-qavatda dush va lavabo',
  '1 qavat, lavabo, unitaz, vanna, kir yuvish mashinasi',
  '4 qavatli bino, har qavatda lavabo, unitaz, dush',
];

export default function Generator() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canvasRef = useRef<Canvas2DHandle>(null);
  const canvas3dRef = useRef<Canvas3DHandle>(null);
  const axoRef = useRef<AxonometricCanvasHandle>(null);
  const plumbing3dRef = useRef<PlumbingCanvas3DHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [description, setDescription] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [drawingData, setDrawingData] = useState<DrawingData | null>(null);
  const [error, setError] = useState('');
  const [canvasWidth, setCanvasWidth] = useState(900);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [drawingType, setDrawingType] = useState<'floor-plan' | 'plumbing-axonometric'>('floor-plan');
  // Auto-save name dialog
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [pendingDrawing, setPendingDrawing] = useState<DrawingData | null>(null);

  useEffect(() => { setFavicon(loadingState); }, [loadingState]);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) setCanvasWidth(containerRef.current.offsetWidth);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const isLoading = loadingState === 'generating' || loadingState === 'rendering' || loadingState === 'saving';

  const handleGenerate = async () => {
    if (!description.trim()) { setError('Iltimos, xona tavsifini kiriting'); return; }
    try {
      setLoadingState('generating');
      setError('');
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, drawingType })
      });
      if (!response.ok) throw new Error('Chizma yaratishda xatolik yuz berdi');
      const data = await response.json();
      setLoadingState('rendering');
      setTimeout(() => {
        const drawing = data.drawingData;
        setDrawingData(drawing);
        setLoadingState('ready');
        // Trigger auto-save: ask for project name
        setPendingDrawing(drawing);
        setShowNameDialog(true);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noma'lum xatolik");
      setLoadingState('error');
    }
  };

  const handleAutoSave = async () => {
    if (!projectName.trim() || !pendingDrawing || !user) return;
    try {
      setLoadingState('saving');
      setShowNameDialog(false);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: user.id, name: projectName, description, drawingData: pendingDrawing })
      });
      if (!response.ok) { const d = await response.json(); throw new Error(d.message || 'Saqlashda xatolik'); }
      const project = await response.json();
      navigate(`/project/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noma'lum xatolik");
      setLoadingState('ready');
    }
  };

  const handleSkipSave = () => {
    setShowNameDialog(false);
    setPendingDrawing(null);
  };

  const handleDownloadDxf = async () => {
    if (!drawingData) return;
    try {
      const response = await fetch('/api/export/dxf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawingData })
      });
      if (!response.ok) throw new Error('DXF yuklab olishda xatolik');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `floorplan-${drawingData.id}.dxf`; a.click();
    } catch { setError('DXF faylni yuklab olishda xatolik'); }
  };

  const handleDownloadPdf = () => {
    if (!drawingData || !canvasRef.current) return;
    canvasRef.current.exportToPdf(`floorplan-${drawingData.id}.pdf`);
  };

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
          {/* Input panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="liquid-glass border border-white/10 rounded-2xl p-5">
              <label className="block text-sm text-gray-300 mb-2">Chizma turi</label>
              <div className="flex gap-2 mb-4">
                <button onClick={() => setDrawingType('floor-plan')}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${drawingType === 'floor-plan' ? 'bg-white text-black' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                  📐 Arxitektura rejasi
                </button>
                <button onClick={() => setDrawingType('plumbing-axonometric')}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${drawingType === 'plumbing-axonometric' ? 'bg-white text-black' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                  🔧 Suv ta'minoti sxemasi
                </button>
              </div>
              <label className="block text-sm text-gray-300 mb-2">Xona tavsifi</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleGenerate(); }}
                placeholder={drawingType === 'plumbing-axonometric'
                  ? 'Masalan: 2 qavatli bino, har qavatda lavabo, unitaz, dush...'
                  : 'Masalan: 3x4 metr hammom, shimolda lavabo, janubda eshik...'}
                className="glass-input w-full h-36 px-4 py-3 rounded-xl text-sm resize-none"
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
                {loadingState === 'rendering' && '🎨 Chizilmoqda...'}
                {loadingState === 'saving' && '💾 Saqlanmoqda...'}
                {!isLoading && '✨ Chizma yaratish'}
              </button>
            </div>

            <div className="liquid-glass border border-white/10 rounded-2xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Misollar</p>
              <div className="space-y-2">
                {(drawingType === 'plumbing-axonometric' ? PLUMBING_EXAMPLES : EXAMPLES).map((ex, i) => (
                  <button key={i} onClick={() => setDescription(ex)}
                    className="w-full text-left text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors font-mono whitespace-pre-line">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Canvas panel */}
          <div className="lg:col-span-3">
            {loadingState === 'idle' && (
              <div className="liquid-glass border border-white/10 rounded-2xl min-h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl mb-4">📐</div>
                  <p className="text-gray-500 text-sm">Chizma bu yerda ko'rinadi</p>
                </div>
              </div>
            )}
            {(loadingState === 'generating' || loadingState === 'rendering' || loadingState === 'saving') && (
              <div className="liquid-glass border border-white/10 rounded-2xl min-h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/40 mx-auto mb-4"></div>
                  <p className="text-gray-400 text-sm">
                    {loadingState === 'generating' ? 'AI tahlil qilmoqda...' : loadingState === 'saving' ? 'Saqlanmoqda...' : 'Chizma chizilmoqda...'}
                  </p>
                </div>
              </div>
            )}
            {loadingState === 'error' && (
              <div className="liquid-glass border border-red-500/20 rounded-2xl min-h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-3">⚠️</div>
                  <p className="text-red-400 text-sm">Xatolik yuz berdi. Qayta urinib ko'ring.</p>
                </div>
              </div>
            )}
            {loadingState === 'ready' && drawingData && (
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

      {/* Auto-save name dialog */}
      {showNameDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-medium text-white mb-1">Loyihani saqlash</h3>
            <p className="text-gray-400 text-sm mb-4">Chizma tayyor. Loyiha nomini kiriting va saqlang.</p>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
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
