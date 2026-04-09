import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Canvas2D, { type Canvas2DHandle } from '../components/Canvas2D';
import { supabase } from '../lib/supabase';
import type { DrawingData } from '../../../shared/types';

interface ProjectData {
  id: string;
  name: string;
  drawing_data: DrawingData;
  created_at: string;
}

export default function Project() {
  const { id } = useParams<{ id: string }>();
  const canvasRef = useRef<Canvas2DHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canvasWidth, setCanvasWidth] = useState(900);

  useEffect(() => { loadProject(); }, [id]);

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

  const loadProject = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session) headers['Authorization'] = `Bearer ${session.access_token}`;
      const response = await fetch(`/api/project/${id}`, { headers });
      if (!response.ok) throw new Error('Loyihani yuklashda xatolik');
      setProject(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noma'lum xatolik");
    } finally { setLoading(false); }
  };

  const handleDownloadDxf = async () => {
    if (!project) return;
    try {
      const response = await fetch('/api/export/dxf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawingData: project.drawing_data })
      });
      if (!response.ok) throw new Error('DXF yuklab olishda xatolik');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${project.name}.dxf`; a.click();
    } catch (err) { setError('DXF faylni yuklab olishda xatolik'); }
  };

  const handleDownloadPdf = () => {
    if (!project || !canvasRef.current) return;
    canvasRef.current.exportToPdf(`${project.name}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-400 dark:border-white/40"></div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-red-400 mb-6">{error || 'Loyiha topilmadi'}</p>
          <Link to="/dashboard" className="bg-white text-black px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors">
            ← Dashboard ga qaytish
          </Link>
        </div>
      </div>
    );
  }

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-light" style={{ letterSpacing: '-0.02em' }}>{project.name}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {new Date(project.created_at).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleDownloadDxf}
              className="px-4 py-2.5 bg-white/10 text-white rounded-xl text-sm hover:bg-white/20 transition-colors border border-white/10">
              📥 DXF yuklab olish
            </button>
            <button onClick={handleDownloadPdf}
              className="px-4 py-2.5 bg-white text-black rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors">
              📄 PDF yuklab olish
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="liquid-glass border border-white/10 rounded-2xl overflow-hidden">
          <div ref={containerRef} className="overflow-x-auto bg-white w-full">
            <Canvas2D ref={canvasRef} drawingData={project.drawing_data} width={canvasWidth} scale={1} />
          </div>
        </div>

        {/* Back link */}
        <div className="mt-6">
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-white transition-colors">
            ← Barcha loyihalarga qaytish
          </Link>
        </div>
      </main>
    </div>
  );
}
