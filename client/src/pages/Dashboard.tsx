import { apiUrl } from '../lib/api';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useSignOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useCredits } from '../hooks/useCredits';

interface Project {
  id: string;
  name: string;
  created_at: string;
  deleted_at: string | null;
  drawing_data?: {
    project_type?: string;
    spec?: { floorCount?: number; totalAreaM2?: number; disciplines?: string[] };
  } | null;
}

function isMegaProject(p: Project): boolean {
  return p.drawing_data?.project_type === 'mega';
}

const DISC_ICONS: Record<string, string> = {
  'warm-floor': '♨️', 'water-supply': '💧', 'sewage': '🚽',
  'storm-drain': '🌧️', 'boiler-room': '🔥', 'facade': '🏛️',
  'electrical': '⚡', 'floor-plan': '📐', 'architecture': '🏗️',
  'plumbing': '🔧', 'decor': '🛋️',
};

type Tab = 'projects' | 'trash';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const handleSignOut = useSignOut();
  const { profile: creditProfile, refresh: refreshCredits } = useCredits();
  const [paySuccess, setPaySuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setPaySuccess(true);
      refreshCredits();
      // URL ni tozalash
      window.history.replaceState({}, '', '/dashboard');
      setTimeout(() => setPaySuccess(false), 5000);
    }
  }, [refreshCredits]);
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
      const res = await fetch(apiUrl(`/api/projects/${user!.id}`), { headers });
      if (!res.ok) throw new Error((await res.json()).message);
      setProjects(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    } finally { setLoading(false); }
  };

  const loadTrash = async () => {
    try {
      const headers = await getHeaders();
      const res = await fetch(apiUrl(`/api/trash/${user!.id}`), { headers });
      if (!res.ok) return;
      setTrash(await res.json());
    } catch { /* silent */ }
  };

  const handleRename = async (id: string) => {
    if (!renameName.trim()) return;
    setActionLoading(id);
    try {
      const headers = await getHeaders();
      const res = await fetch(apiUrl(`/api/project/${id}/rename`), { method: 'PATCH', headers, body: JSON.stringify({ name: renameName.trim() }) });
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
      const res = await fetch(apiUrl(`/api/project/${id}`), { method: 'DELETE', headers });
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
      const res = await fetch(apiUrl(`/api/project/${id}/restore`), { method: 'PATCH', headers });
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
      const res = await fetch(apiUrl(`/api/project/${id}/permanent`), { method: 'DELETE', headers });
      if (!res.ok) throw new Error((await res.json()).message);
      setTrash(t => t.filter(x => x.id !== id));
    } catch (err) { setError(err instanceof Error ? err.message : 'Xatolik'); }
    finally { setActionLoading(null); }
  };


  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-orange-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#080810]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-sm shadow-sm shadow-orange-500/30">
                🏗️
              </div>
              <span className="text-sm font-semibold tracking-tight">Multibuild AI</span>
            </Link>
            <span className="hidden md:block w-px h-4 bg-white/10" />
            <span className="hidden md:block text-xs text-white/30">{user?.email}</span>
          </div>
          <div className="flex items-center gap-2">
            {creditProfile && (
              <Link to="/pricing"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:border-orange-500/30 transition-all">
                <span className="text-sm">⚡</span>
                <span className="text-sm font-semibold text-white">{creditProfile.credits}</span>
                <span className="text-xs text-white/30">credit</span>
                {creditProfile.plan_id !== 'free' && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[9px] font-bold uppercase">
                    {creditProfile.plan_id}
                  </span>
                )}
                {creditProfile.plan_id === 'free' && creditProfile.credits < 10 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] font-bold">
                    Kam!
                  </span>
                )}
              </Link>
            )}
            <Link to="/select"
              className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-500 text-white px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-orange-500/20">
              <span className="text-base leading-none">+</span>
              <span>Yangi loyiha</span>
            </Link>
            <button onClick={handleSignOut}
              className="px-3 py-1.5 text-sm text-white/35 hover:text-white/70 transition-colors rounded-lg hover:bg-white/5">
              Chiqish
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-10">

        {/* Payment success banner */}
        {paySuccess && (
          <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-6 py-4 flex items-center gap-4">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-emerald-400 font-semibold text-sm">Tabriklaymiz! Plan muvaffaqiyatli aktivlashtirildi.</p>
              <p className="text-emerald-400/60 text-xs mt-0.5">Creditlaringiz yangilandi. Endi barcha imkoniyatlar ochiq!</p>
            </div>
            <button onClick={() => setPaySuccess(false)} className="ml-auto text-emerald-400/40 hover:text-emerald-400">✕</button>
          </div>
        )}

        {/* Page title */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white" style={{ letterSpacing: '-0.02em' }}>Loyihalarim</h1>
            <p className="text-sm text-white/30 mt-1">Barcha saqlangan muhandislik chizmalari</p>
          </div>
          {/* Stats */}
          <div className="hidden sm:flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-semibold text-white">{projects.length}</div>
              <div className="text-xs text-white/30">Loyihalar</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-right">
              <div className="text-lg font-semibold text-orange-400">
                {projects.filter(isMegaProject).length}
              </div>
              <div className="text-xs text-white/30">Mega</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
          {(['projects', 'trash'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${tab === t
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/35 hover:text-white/60'}`}>
              <span>{t === 'projects' ? '📁' : '🗑️'}</span>
              <span>{t === 'projects' ? 'Loyihalar' : 'Savat'}</span>
              {t === 'projects' && projects.length > 0 && (
                <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded-full font-semibold">
                  {projects.length}
                </span>
              )}
              {t === 'trash' && trash.length > 0 && (
                <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full font-semibold">
                  {trash.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-6">
            <span className="text-red-400">⚠</span>
            <p className="text-red-400 text-sm flex-1">{error}</p>
            <button onClick={() => setError('')} className="text-red-400/50 hover:text-red-400 text-lg leading-none">×</button>
          </div>
        )}

        {/* Projects tab */}
        {tab === 'projects' && (
          <>
            {loading && (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
              </div>
            )}

            {!loading && projects.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-3xl mb-5">
                  📐
                </div>
                <h3 className="text-lg font-medium text-white/70 mb-2">Hali loyihalar yo'q</h3>
                <p className="text-sm text-white/30 mb-6 max-w-xs">Birinchi muhandislik loyihangizni yarating</p>
                <Link to="/select"
                  className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
                  + Yangi loyiha yaratish
                </Link>
              </div>
            )}

            {!loading && projects.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    renameId={renameId}
                    renameName={renameName}
                    actionLoading={actionLoading}
                    onRenameStart={(id, name) => { setRenameId(id); setRenameName(name); }}
                    onRenameChange={setRenameName}
                    onRenameSubmit={handleRename}
                    onRenameCancel={() => setRenameId(null)}
                    onTrash={handleTrash}
                  />
                ))}

                {/* New project card */}
                <Link to="/select"
                  className="group relative rounded-2xl border border-dashed border-white/10 hover:border-orange-500/40
                             flex flex-col items-center justify-center py-12 gap-3
                             hover:bg-orange-500/[0.03] transition-all duration-300 cursor-pointer">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 group-hover:border-orange-500/30
                                  flex items-center justify-center text-xl transition-all group-hover:scale-110">
                    +
                  </div>
                  <span className="text-sm text-white/30 group-hover:text-orange-400 transition-colors font-medium">
                    Yangi loyiha
                  </span>
                </Link>
              </div>
            )}
          </>
        )}

        {/* Trash tab */}
        {tab === 'trash' && (
          <>
            {trash.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-3xl mb-5">
                  🗑️
                </div>
                <h3 className="text-lg font-medium text-white/40">Savat bo'sh</h3>
              </div>
            )}
            {trash.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs text-white/30 mb-4">O'chirilgan loyihalar. Qayta tiklash yoki butunlay o'chirish mumkin.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trash.map(project => (
                    <div key={project.id}
                      className="rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-5 opacity-75 hover:opacity-100 transition-opacity">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-sm flex-shrink-0">
                          🗑️
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-white/70 text-sm line-clamp-1">{project.name}</h3>
                          <p className="text-xs text-white/25 mt-0.5">
                            {project.deleted_at ? `O'chirilgan: ${new Date(project.deleted_at).toLocaleDateString('uz-UZ')}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleRestore(project.id)} disabled={actionLoading === project.id}
                          className="flex-1 py-2 text-xs bg-emerald-500/10 text-emerald-400 rounded-lg
                                     hover:bg-emerald-500/20 transition-colors border border-emerald-500/20 disabled:opacity-50">
                          {actionLoading === project.id ? '...' : '♻ Tiklash'}
                        </button>
                        <button onClick={() => handleHardDelete(project.id)} disabled={actionLoading === project.id}
                          className="flex-1 py-2 text-xs bg-red-500/10 text-red-400 rounded-lg
                                     hover:bg-red-500/20 transition-colors border border-red-500/20 disabled:opacity-50">
                          {actionLoading === project.id ? '...' : "O'chirish"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ProjectCard({ project, renameId, renameName, actionLoading, onRenameStart, onRenameChange, onRenameSubmit, onRenameCancel, onTrash }: {
  project: Project;
  renameId: string | null;
  renameName: string;
  actionLoading: string | null;
  onRenameStart: (id: string, name: string) => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: (id: string) => void;
  onRenameCancel: () => void;
  onTrash: (id: string) => void;
}) {
  const isMega = isMegaProject(project);
  const disciplines = project.drawing_data?.spec?.disciplines ?? [];

  return (
    <div className={`group relative rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-0.5
      ${isMega
        ? 'border-orange-500/20 bg-gradient-to-b from-orange-500/[0.05] to-transparent hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/10'
        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-white/5'}`}>

      {renameId === project.id ? (
        <div>
          <input autoFocus value={renameName}
            onChange={e => onRenameChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onRenameSubmit(project.id); if (e.key === 'Escape') onRenameCancel(); }}
            className="w-full bg-white/[0.06] border border-white/15 rounded-lg px-3 py-2 text-sm text-white
                       focus:outline-none focus:border-orange-500/50 mb-3 placeholder-white/30"
            placeholder="Yangi nom..."
          />
          <div className="flex gap-2">
            <button onClick={() => onRenameSubmit(project.id)} disabled={actionLoading === project.id}
              className="flex-1 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors">
              {actionLoading === project.id ? '...' : 'Saqlash'}
            </button>
            <button onClick={onRenameCancel}
              className="flex-1 py-1.5 bg-white/5 text-white/50 hover:text-white rounded-lg text-xs transition-colors border border-white/10">
              Bekor
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Clickable overlay */}
          <Link
            to={isMega ? `/mega/${project.id}` : `/project/${project.id}`}
            className="absolute inset-0 rounded-2xl z-0"
          />

          {/* Card header */}
          <div className="relative z-10 flex items-start justify-between mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0
              ${isMega
                ? 'bg-gradient-to-br from-orange-500/30 to-red-500/30 border border-orange-500/20'
                : 'bg-white/[0.05] border border-white/10'}`}>
              {isMega ? '🏗️' : '📐'}
            </div>
            {isMega && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/20">
                MEGA
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="relative z-10 font-semibold text-sm text-white line-clamp-1 mb-1">{project.name}</h3>

          {/* Mega disciplines */}
          {isMega && disciplines.length > 0 && (
            <div className="relative z-10 flex flex-wrap gap-1 mb-2">
              {disciplines.slice(0, 5).map(d => (
                <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/8">
                  {DISC_ICONS[d] ?? '•'} {d.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}
                </span>
              ))}
              {disciplines.length > 5 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">+{disciplines.length - 5}</span>
              )}
            </div>
          )}

          {/* Meta info */}
          {isMega && project.drawing_data?.spec && (
            <p className="relative z-10 text-xs text-orange-400/60 mb-2">
              {project.drawing_data.spec.floorCount}q · {project.drawing_data.spec.totalAreaM2}m² · {disciplines.length} soha
            </p>
          )}
          <p className="relative z-10 text-xs text-white/25 mb-4">
            {new Date(project.created_at).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>

          {/* Actions — show on hover */}
          <div className="relative z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <button
              onClick={e => { e.preventDefault(); onRenameStart(project.id, project.name); }}
              className="flex-1 py-1.5 text-xs bg-white/5 text-white/50 hover:text-white rounded-lg
                         hover:bg-white/10 transition-colors border border-white/8 flex items-center justify-center gap-1">
              ✏ Nom
            </button>
            <button
              onClick={e => { e.preventDefault(); onTrash(project.id); }}
              disabled={actionLoading === project.id}
              className="flex-1 py-1.5 text-xs bg-red-500/8 text-red-400/70 hover:text-red-400 rounded-lg
                         hover:bg-red-500/15 transition-colors border border-red-500/15 disabled:opacity-50 flex items-center justify-center gap-1">
              {actionLoading === project.id ? '...' : "🗑 O'chir"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
