import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Canvas2D, { type Canvas2DHandle } from '../components/Canvas2D';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { DrawingData } from '../../../shared/types';

type LoadingState = 'idle' | 'generating' | 'rendering' | 'ready' | 'error' | 'saving';

const FAVICONS: Record<LoadingState, string> = {
  idle:       `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%233b82f6'/><rect x='6' y='6' width='20' height='20' rx='2' fill='none' stroke='white' stroke-width='2'/><line x1='6' y1='16' x2='26' y2='16' stroke='white' stroke-width='1.5'/><line x1='16' y1='6' x2='16' y2='26' stroke='white' stroke-width='1.5'/></svg>`,
  generating: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23f59e0b'/><circle cx='16' cy='16' r='10' fill='none' stroke='white' stroke-width='2.5' stroke-dasharray='16 48' stroke-linecap='round'><animateTransform attributeName='transform' type='rotate' from='0 16 16' to='360 16 16' dur='0.8s' repeatCount='indefinite'/></circle></svg>`,
  rendering:  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%238b5cf6'/><circle cx='16' cy='16' r='10' fill='none' stroke='white' stroke-width='2.5' stroke-dasharray='24 40' stroke-linecap='round'><animateTransform attributeName='transform' type='rotate' from='0 16 16' to='360 16 16' dur='0.6s' repeatCount='indefinite'/></circle></svg>`,
  saving:     `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%2306b6d4'/><circle cx='16' cy='16' r='10' fill='none' stroke='white' stroke-width='2.5' stroke-dasharray='20 44' stroke-linecap='round'><animateTransform attributeName='transform' type='rotate' from='0 16 16' to='360 16 16' dur='0.7s' repeatCount='indefinite'/></circle></svg>`,
  ready:      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%2322c55e'/><polyline points='8,17 13,22 24,11' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/></svg>`,
  error:      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23ef4444'/><line x1='10' y1='10' x2='22' y2='22' stroke='white' stroke-width='3' stroke-linecap='round'/><line x1='22' y1='10' x2='10' y2='22' stroke='white' stroke-width='3' stroke-linecap='round'/></svg>`,
};

function setFavicon(state: LoadingState) {
  const url = `data:image/svg+xml,${FAVICONS[state]}`;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
  link.href = url;
}

const EXAMPLES = [
  '3x4 metr hammom, shimolda lavabo va dush, janubda eshik',
  '5x4 metr oshxona, shimolda lavabo va plita, janubda eshik',
  '4x5 metr yotoqxona, sharqda karavot, g\'arbda shkaf',
  '5x4 oshxona\n4x3 hammom\n4x5 yotoqxona',
];

export default function Generator() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canvasRef = useRef<Canvas2DHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [description, setDescription] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [drawingData, setDrawingData] = useState<DrawingData | null>(null);
  const [error, setError] = useState('');
  const [projectName, setProjectName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(900);

  useEffect(() => { setFavicon(loadingState); }, [loadingState]);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setCanvasWidth(containerRef.current.offsetWidth);
      }
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
        body: JSON.stringify({ description })
      });
      if (!response.ok) throw new Error('Chizma yaratishda xatolik yuz berdi');
      const data = await response.json();
      setLoadingState('rendering');
      setTimeout(() => { setDrawingData(data.drawingData); setLoadingState('ready'); }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noma'lum xatolik");
      setLoadingState('error');
    }
  };

  const handleSave = async () => {
    if (!projectName.trim()) { setError('Iltimos, loyiha nomini kiriting'); return; }
    if (!user) { navigate('/login'); return; }
    try {
      setLoadingState('saving');
      setError('');
      setShowSaveDialog(false);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: user.id, name: projectName, description, drawingData })
      });
      if (!response.ok) { const d = await response.json(); throw new Error(d.message || 'Saqlashda xatolik'); }
      const project = await response.json();
      navigate(`/project/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noma'lum xatolik");
      setLoadingState('ready');
    }
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
    } catch (err) { setError('DXF faylni yuklab olishda xatolik'); }
  };

  const handleDownloadPdf = () => {
    if (!drawingData || !canvasRef.current) return;
    canvasRef.current.exportToPdf(`floorplan-${drawingData.id}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white transition-colors duration-300">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-black/80 backdrop-blur-md border-b border-black/10 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="text-lg font-semibold tracking-tight">FloorPlan AI</Link>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">← Dashboard</Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-light" style={{ letterSpacing: '-0.02em' }}>Reja Generatori</h1>
          <p className="text-gray-500 text-sm mt-1">Xona tavsifini yozing — AI chizma yaratadi</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Input panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="liquid-glass border border-white/10 rounded-2xl p-5">
              <label className="block text-sm text-gray-300 mb-2">Xona tavsifi</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleGenerate(); }}
                placeholder="Masalan: 3x4 metr hammom, shimolda lavabo, janubda eshik..."
                className="glass-input w-full h-36 px-4 py-3 rounded-xl text-sm resize-none"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-600 mt-1.5">Ctrl+Enter — yaratish</p>

              {error && (
                <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="mt-4 w-full bg-white text-black py-3 rounded-xl text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loadingState === 'generating' && '⏳ Yaratilmoqda...'}
                {loadingState === 'rendering' && '🎨 Chizilmoqda...'}
                {loadingState === 'saving' && '💾 Saqlanmoqda...'}
                {!isLoading && '✨ Chizma yaratish'}
              </button>
            </div>

            {/* Example prompts */}
            <div className="liquid-glass border border-white/10 rounded-2xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Misollar</p>
              <div className="space-y-2">
                {EXAMPLES.map((ex, i) => (
                  <button key={i} onClick={() => setDescription(ex)}
                    className="w-full text-left text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors font-mono whitespace-pre-line">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Canvas panel */}
          <div className="lg:col-span-3">
            {loadingState === 'idle' && (
              <div className="liquid-glass border border-white/10 rounded-2xl h-full min-h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl mb-4">📐</div>
                  <p className="text-gray-500 text-sm">Chizma bu yerda ko'rinadi</p>
                </div>
              </div>
            )}

            {(loadingState === 'generating' || loadingState === 'rendering') && (
              <div className="liquid-glass border border-white/10 rounded-2xl h-full min-h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/40 mx-auto mb-4"></div>
                  <p className="text-gray-400 text-sm">
                    {loadingState === 'generating' ? 'AI tahlil qilmoqda...' : 'Chizma chizilmoqda...'}
                  </p>
                </div>
              </div>
            )}

            {loadingState === 'error' && (
              <div className="liquid-glass border border-red-500/20 rounded-2xl h-full min-h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-3">⚠️</div>
                  <p className="text-red-400 text-sm">Xatolik yuz berdi. Qayta urinib ko'ring.</p>
                </div>
              </div>
            )}

            {loadingState === 'ready' && drawingData && (
              <div className="liquid-glass border border-white/10 rounded-2xl overflow-hidden">
                {/* Canvas toolbar */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <span className="text-sm text-gray-400">Chizma tayyor</span>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setShowSaveDialog(true)}
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
                  <Canvas2D ref={canvasRef} drawingData={drawingData} width={canvasWidth} scale={1} />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-medium text-white mb-4">Loyihani saqlash</h3>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              placeholder="Loyiha nomi"
              className="glass-input w-full px-4 py-3 rounded-xl text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setShowSaveDialog(false)}
                className="flex-1 py-2.5 bg-white/10 text-gray-300 rounded-xl text-sm hover:bg-white/20 transition-colors">
                Bekor
              </button>
              <button onClick={handleSave}
                className="flex-1 py-2.5 bg-white text-black rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors">
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
