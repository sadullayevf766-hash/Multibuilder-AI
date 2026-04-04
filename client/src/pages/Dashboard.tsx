import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // No user logged in, show empty state
        setProjects([]);
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/projects/${user.id}`);
      
      if (!response.ok) {
        // If server error, just show empty state
        setProjects([]);
        setLoading(false);
        return;
      }

      const data = await response.json();
      setProjects(data);
    } catch (err) {
      // Silently fail and show empty state
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <Link
            to="/generator"
            className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
          >
            + Yangi loyiha
          </Link>
        </div>

        {loading && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600">Yuklanmoqda...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">❌ {error}</p>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 mb-4">Hali loyihalar yo'q</p>
            <Link
              to="/generator"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Birinchi loyihani yarating
            </Link>
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/project/${project.id}`}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-gray-600 mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}
                <p className="text-sm text-gray-500">
                  {new Date(project.created_at).toLocaleDateString('uz-UZ')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
