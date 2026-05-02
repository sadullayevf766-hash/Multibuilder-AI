import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

interface Project {
  id: string;
  name: string;
  created_at: string;
  deleted_at: string | null;
}

type Tab = 'projects' | 'trash';

function AppNav({ email, onSignOut }: { email?: string; onSignOut: () => void }) {
  return (
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-black/80 backdrop-blur-md border-b border-black/10 dark:border-white/10">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
        <Link to="/dashboard" className="text-lg font-semibold tracking-tight">FloorPlan AI</Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden md:block">{email}</span>
          <Link to="/select" className="bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors">
            + Yangi
          </Link>
          <button onClick={onSignOut} className="text-sm text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-2 py-2">
            Chiqish
          </button>
        </div>
      </div>
    </header>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [trash, setTrash] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { if (user) { loadProjects(); loadTrash(); } }, [user]);

  const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session) h['Authorization'] = `Bearer ${session.access_token}`;
    return h;
  };

  const loadProjects = async () => {
    try {
      setLoading(true);
      const headers = await getHeaders();
      const res = await fetch(`/api/projects/${user!.id}`, { headers });
      if (!res.ok) throw new Error((await res.json()).message);
      setProjects(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    } finally { setLoading(false); }
  };

  const loadTrash = async () => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/trash/${user!.id}`, { headers });
      if (!res.ok) return;
      setTrash(await res.json());
    } catch { /* silent */ }
  };

  const handleRename = async (id: string) => {
    if (!renameName.trim()) return;
    setActionLoading(id);
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/project/${id}/rename`, { method: 'PATCH', headers, body: JSON.stringify({ name: renameName.trim() }) });
      if (!res.ok) throw new Error((await res.json()).message);
      setProjects(p => p.map(x => x.id === id ? { ...x, name: renameName.trim() } : x));
      setRenameId(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Xatolik'); }
    finally { setActionLoading(null); }
  };

  const handleTrash = async (id: string) => {
    setActionLoading(id);
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/project/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error((await res.json()).message);
      const moved = projects.find(p => p.id === id);
      setProjects(p => p.filter(x => x.id !== id));
      if (moved) setTrash(t => [{ ...moved, deleted_at: new Date().toISOString() }, ...t]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Xatolik'); }
    finally { setActionLoading(null); }
  };

  const handleRestore = async (id: string) => {
    setActionLoading(id);
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/project/${id}/restore`, { method: 'PATCH', headers });
      if (!res.ok) throw new Error((await res.json()).message);
      const restored = trash.find(p => p.id === id);
      setTrash(t => t.filter(x => x.id !== id));
      if (restored) setProjects(p => [{ ...restored, deleted_at: null }, ...p]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Xatolik'); }
    finally { setActionLoading(null); }
  };

  const handleHardDelete = async (id: string) => {
    if (!confirm("Loyihani butunlay o'chirishni tasdiqlaysizmi?")) return;
    setActionLoading(id);
    try {
      const headers = await getHeaders();
      const res = await fetch(`/api/project/${id}/permanent`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error((await res.json()).message);
      setTrash(t => t.filter(x => x.id !== id));
    } catch (err) { setError(err instanceof Error ? err.message : 'Xatolik'); }
    finally { setActionLoading(null); }
  };

  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white transition-colors duration-300">
      <AppNav email={user?.email} onSignOut={handleSignOut} />

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-light" style={{ letterSpacing: '-0.02em' }}>Loyihalarim</h1>
          <p className="text-gray-500 text-sm mt-1">Barcha saqlangan chizmalar</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 w-fit border border-white/10">
          {(['projects', 'trash'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}>
              {t === 'projects' ? '📁 Loyihalar' : '🗑️ Savat'}
              {t === 'projects' && projects.length > 0 && (
                <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">{projects.length}</span>
              )}
              {t === 'trash' && trash.length > 0 && (
                <span className="ml-2 text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">{trash.length}</span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex justify-between items-center">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 text-xl leading-none ml-4">×</button>
          </div>
        )}

        {/* Projects tab */}
        {tab === 'projects' && (
          <>
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/40"></div>
              </div>
            )}
            {!loading && projects.length === 0 && (
              <div className="liquid-glass border border-white/10 rounded-2xl p-16 text-center">
                <div className="text-5xl mb-4">📐</div>
                <p className="text-gray-400 mb-6">Hali loyihalar yo'q</p>
                <Link to="/generator" className="inline-block bg-white text-black px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors">
                  Birinchi loyihani yarating →
                </Link>
              </div>
            )}
            {!loading && projects.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(project => (
                  <div key={project.id} className="liquid-glass border border-white/10 rounded-2xl p-5 hover:border-white/25 transition-all group relative">
                    {renameId === project.id ? (
                      <div className="mb-3">
                        <input autoFocus value={renameName}
                          onChange={e => setRenameName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRename(project.id); if (e.key === 'Escape') setRenameId(null); }}
                          className="glass-input w-full px-3 py-2 rounded-lg text-sm mb-2"
                          placeholder="Yangi nom..." />
                        <div className="flex gap-2">
                          <button onClick={() => handleRename(project.id)} disabled={actionLoading === project.id}
                            className="flex-1 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-gray-100 disabled:opacity-50">
                            {actionLoading === project.id ? '...' : 'Saqlash'}
                          </button>
                          <button onClick={() => setRenameId(null)}
                            className="flex-1 py-1.5 bg-white/10 text-gray-300 rounded-lg text-xs hover:bg-white/20">
                            Bekor
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Full card clickable overlay */}
                        <Link to={`/project/${project.id}`} className="absolute inset-0 rounded-2xl z-0" aria-label={project.name} />
                        <h3 className="font-medium text-white mb-1 line-clamp-1 relative z-10">{project.name}</h3>
                      </>
                    )}
                    <p className="text-xs text-gray-500 mb-4 relative z-10">
                      {new Date(project.created_at).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                      <button onClick={e => { e.preventDefault(); setRenameId(project.id); setRenameName(project.name); }}
                        className="flex-1 py-1.5 text-xs bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-colors border border-white/10">
                        ✏️ Tahrirlash
                      </button>
                      <button onClick={e => { e.preventDefault(); handleTrash(project.id); }} disabled={actionLoading === project.id}
                        className="flex-1 py-1.5 text-xs bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors border border-red-500/20 disabled:opacity-50">
                        {actionLoading === project.id ? '...' : "🗑️ O'chirish"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Trash tab */}
        {tab === 'trash' && (
          <>
            {trash.length === 0 && (
              <div className="liquid-glass border border-white/10 rounded-2xl p-16 text-center">
                <div className="text-5xl mb-4">🗑️</div>
                <p className="text-gray-400">Savat bo'sh</p>
              </div>
            )}
            {trash.length > 0 && (
              <>
                <p className="text-sm text-gray-500 mb-4">O'chirilgan loyihalar. Qayta tiklash yoki butunlay o'chirish mumkin.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trash.map(project => (
                    <div key={project.id} className="liquid-glass border border-red-500/15 rounded-2xl p-5 opacity-75">
                      <h3 className="font-medium text-gray-300 mb-1 line-clamp-1">{project.name}</h3>
                      <p className="text-xs text-gray-500 mb-0.5">Yaratilgan: {new Date(project.created_at).toLocaleDateString('uz-UZ')}</p>
                      <p className="text-xs text-red-400/70 mb-4">
                        {project.deleted_at ? `O'chirilgan: ${new Date(project.deleted_at).toLocaleDateString('uz-UZ')}` : ''}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => handleRestore(project.id)} disabled={actionLoading === project.id}
                          className="flex-1 py-2 text-xs bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors border border-emerald-500/20 disabled:opacity-50">
                          {actionLoading === project.id ? '...' : '♻️ Tiklash'}
                        </button>
                        <button onClick={() => handleHardDelete(project.id)} disabled={actionLoading === project.id}
                          className="flex-1 py-2 text-xs bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors border border-red-500/20 disabled:opacity-50">
                          {actionLoading === project.id ? '...' : "🗑️ O'chirish"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
