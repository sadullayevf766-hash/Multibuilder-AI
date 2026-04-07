import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Canvas2D from '../components/Canvas2D';
import { supabase } from '../lib/supabase';
import type { DrawingData } from '../../../shared/types';

type LoadingState = 'idle' | 'generating' | 'rendering' | 'ready' | 'error' | 'saving';

// Favicon SVGs for each state
const FAVICONS: Record<LoadingState, string> = {
  idle:       `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%233b82f6'/><rect x='6' y='6' width='20' height='20' rx='2' fill='none' stroke='white' stroke-width='2'/><line x1='6' y1='16' x2='26' y2='16' stroke='white' stroke-width='1.5'/><line x1='16' y1='6' x2='16' y2='26' stroke='white' stroke-width='1.5'/></svg>`,
  generating: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23f59e0b'/><circle cx='16' cy='16' r='10' fill='none' stroke='white' stroke-width='2.5' stroke-dasharray='16 48' stroke-linecap='round'><animateTransform attributeName='transform' type='rotate' from='0 16 16' to='360 16 16' dur='0.8s' repeatCount='indefinite'/></circle></svg>`,
  rendering:  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%238b5cf6'/><circle cx='16' cy='16' r='10' fill='none' stroke='white' stroke-width='2.5' stroke-dasharray='24 40' stroke-linecap='round'><animateTransform attributeName='transform' type='rotate' from='0 16 16' to='360 16 16' dur='0.6s' repeatCount='indefinite'/></circle></svg>`,
  saving:     `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%2306b6d4'/><circle cx='16' cy='16' r='10' fill='none' stroke='white' stroke-width='2.5' stroke-dasharray='20 44' stroke-linecap='round'><animateTransform attributeName='transform' type='rotate' from='0 16 16' to='360 16 16' dur='0.7s' repeatCount='indefinite'/></circle></svg>`,
  ready:      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%2322c55e'/><polyline points='8,17 13,22 24,11' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/></svg>`,
  error:      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23ef4444'/><line x1='10' y1='10' x2='22' y2='22' stroke='white' stroke-width='3' stroke-linecap='round'/><line x1='22' y1='10' x2='10' y2='22' stroke='white' stroke-width='3' stroke-linecap='round'/></svg>`,
};

function setFavicon(state: LoadingState) {
  const svg = FAVICONS[state];
  const url = `data:image/svg+xml,${svg}`;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
}

export default function Generator() {
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [drawingData, setDrawingData] = useState<DrawingData | null>(null);
  const [error, setError] = useState('');
  const [projectName, setProjectName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Update favicon on state change
  useEffect(() => {
    setFavicon(loadingState);
  }, [loadingState]);

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Iltimos, xona tavsifini kiriting');
      return;
    }

    try {
      setLoadingState('generating');
      setError('');

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      });

      if (!response.ok) {
        throw new Error('Chizma yaratishda xatolik yuz berdi');
      }

      const data = await response.json();
      
      setLoadingState('rendering');
      
      setTimeout(() => {
        setDrawingData(data.drawingData);
        setLoadingState('ready');
      }, 500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noma\'lum xatolik');
      setLoadingState('error');
    }
  };

  const handleSave = async () => {
    if (!projectName.trim()) {
      setError('Iltimos, loyiha nomini kiriting');
      return;
    }

    try {
      setLoadingState('saving');
      setError('');

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('Saqlash uchun tizimga kirish kerak');
        setLoadingState('ready');
        setShowSaveDialog(false);
        // Redirect to login
        navigate('/login');
        return;
      }

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: projectName,
          description,
          drawingData
        })
      });

      if (!response.ok) {
        throw new Error('Loyihani saqlashda xatolik');
      }

      const project = await response.json();
      navigate(`/project/${project.id}`);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noma\'lum xatolik');
      setLoadingState('ready');
    }
  };

  const handleDownloadDxf = async () => {
    if (!drawingData) return;

    try {
      const response = await fetch('/api/export/dxf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawingData })
      });

      if (!response.ok) throw new Error('DXF yuklab olishda xatolik');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `floorplan-${drawingData.id}.dxf`;
      a.click();
    } catch (err) {
      setError('DXF faylni yuklab olishda xatolik yuz berdi');
    }
  };

  const handleDownloadPdf = async () => {
    if (!drawingData) return;

    try {
      const response = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawingData })
      });

      if (!response.ok) throw new Error('PDF yuklab olishda xatolik');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `floorplan-${drawingData.id}.pdf`;
      a.click();
    } catch (err) {
      setError('PDF faylni yuklab olishda xatolik yuz berdi');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Reja Generatori
        </h1>

        {loadingState === 'idle' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm">
              💡 Maslahat: Xona tavsifini kiriting, masalan "3x4 metr hammom, lavabo va dush kabinasi bilan"
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Xona tavsifi
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Masalan: 3x4 metr hammom, shimolda lavabo, janubda eshik..."
            className="w-full h-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            disabled={loadingState === 'generating' || loadingState === 'rendering' || loadingState === 'saving'}
          />

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm">❌ {error}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loadingState === 'generating' || loadingState === 'rendering' || loadingState === 'saving'}
            className="mt-4 w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loadingState === 'generating' && '⏳ Yaratilmoqda...'}
            {loadingState === 'rendering' && '🎨 Chizilmoqda...'}
            {loadingState === 'saving' && '💾 Saqlanmoqda...'}
            {(loadingState === 'idle' || loadingState === 'error' || loadingState === 'ready') && '✨ Yaratish'}
          </button>
        </div>

        {loadingState === 'ready' && drawingData && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Chizma
                </h2>
                <div className="flex gap-3 w-full md:w-auto flex-wrap">
                  <button
                    onClick={() => setShowSaveDialog(true)}
                    className="flex-1 md:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    💾 Saqlash
                  </button>
                  <button
                    onClick={handleDownloadDxf}
                    className="flex-1 md:flex-none px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    📥 DXF
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    className="flex-1 md:flex-none px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    📄 PDF
                  </button>
                </div>
              </div>
              
              <div className="overflow-auto">
                <Canvas2D drawingData={drawingData} width={900} height={700} scale={1} />
              </div>
            </div>
          </div>
        )}

        {showSaveDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-semibold mb-4">Loyihani saqlash</h3>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Loyiha nomi"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Saqlash
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
