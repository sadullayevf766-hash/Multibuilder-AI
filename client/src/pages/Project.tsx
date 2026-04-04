import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Canvas2D from '../components/Canvas2D';
import type { DrawingData } from '../../../shared/types';

interface ProjectData {
  id: string;
  name: string;
  description: string;
  drawing_data: DrawingData;
  created_at: string;
}

function Project() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      const response = await fetch(`/api/project/${id}`);
      
      if (!response.ok) {
        throw new Error('Loyihani yuklashda xatolik');
      }

      const data = await response.json();
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noma\'lum xatolik');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDxf = async () => {
    if (!project) return;

    try {
      const response = await fetch('/api/export/dxf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawingData: project.drawing_data })
      });

      if (!response.ok) throw new Error('DXF yuklab olishda xatolik');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}.dxf`;
      a.click();
    } catch (err) {
      setError('DXF faylni yuklab olishda xatolik yuz berdi');
    }
  };

  const handleDownloadPdf = async () => {
    if (!project) return;

    try {
      const response = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawingData: project.drawing_data })
      });

      if (!response.ok) throw new Error('PDF yuklab olishda xatolik');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}.pdf`;
      a.click();
    } catch (err) {
      setError('PDF faylni yuklab olishda xatolik yuz berdi');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
        <p className="text-gray-600">Yuklanmoqda...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">❌ {error || 'Loyiha topilmadi'}</p>
          </div>
          <Link
            to="/dashboard"
            className="text-blue-600 hover:text-blue-700"
          >
            ← Dashboard ga qaytish
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Link
          to="/dashboard"
          className="text-blue-600 hover:text-blue-700 mb-4 inline-block"
        >
          ← Dashboard ga qaytish
        </Link>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {project.name}
              </h1>
              {project.description && (
                <p className="text-gray-600">{project.description}</p>
              )}
              <p className="text-sm text-gray-500 mt-2">
                Yaratilgan: {new Date(project.created_at).toLocaleDateString('uz-UZ')}
              </p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
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

          <div className="overflow-x-auto">
            <Canvas2D drawingData={project.drawing_data} width={800} height={600} scale={1} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Project;
