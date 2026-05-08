import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { apiUrl } from '../lib/api';

interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  floorCount: number;
  updatedAt: string;
  stats: {
    totalFixtures: number;
    totalPipeM: number;
    totalRisers: number;
  };
}

export default function PlumbingHub() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  // Wizard state
  const [prompt, setPrompt]     = useState('');
  const [projName, setProjName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  async function getAuthHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }

  async function fetchProjects() {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(apiUrl('/api/plumbing'), { headers });
      const data = await res.json() as { projects: ProjectSummary[] };
      setProjects(data.projects ?? []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) { setError('Tavsif kiriting'); return; }
    setGenerating(true);
    setError('');
    try {
      const authHeaders = await getAuthHeader();
      const res = await fetch(apiUrl('/api/plumbing/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ description: prompt, name: projName || undefined }),
      });
      const data = await res.json() as { project?: { id: string }; error?: string };
      if (!res.ok || !data.project) throw new Error(data.error ?? 'Xatolik');
      navigate(`/plumbing/${data.project.id}`);
    } catch (e) {
      setError((e as Error).message);
      setGenerating(false);
    }
  }

  const EXAMPLE_PROMPTS = [
    '2 qavatli uy: 1-qavat — oshxona 14m², hammom 6m², hojatxona 3m². 2-qavat — vannaxona 9m², hammom 7m²',
    '3 qavatli bino: har qavatda 1 ta hammom 8m², 1 ta oshxona 12m²',
    '1 qavatli: oshxona 18m², hammom 10m² (vanna + dush), kir yuvish xonasi 5m²',
    '4 qavatli ko\'p qavatli: 1-qavat — oshxona 20m², 2 ta hammom 7m². Har qavatda 2 ta hammom 6m²',
  ];

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0c0c18]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')}
              className="text-white/40 hover:text-white/70 transition-colors text-sm">
              ← Dashboard
            </button>
            <span className="text-white/20">/</span>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                  <polyline points="9,22 9,12 15,12 15,22"/>
                </svg>
              </div>
              <span className="font-semibold text-lg">Santexnika</span>
            </div>
          </div>

          <button onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Yangi loyiha
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero */}
        {projects.length === 0 && !loading && (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-3">Santexnika moduli</h2>
            <p className="text-white/50 max-w-md mx-auto mb-8 text-sm leading-relaxed">
              AI yordamida yoki qo'lda professional santexnika chizmalari.
              2D/3D ko'rinish, 6 proeksiya, PDF/DXF eksport.
            </p>
            <button onClick={() => setShowWizard(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors">
              Birinchi loyiha yaratish
            </button>

            {/* Feature grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 text-left">
              {[
                {
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>,
                  title: 'AI Generator', desc: 'Matn → to\'liq sxema',
                },
                {
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
                  title: 'Qo\'l bilan edit', desc: 'Drag & drop elementlar',
                },
                {
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
                  title: '6 Proeksiya', desc: 'Top/Front/Back/Left/Right/Bottom',
                },
                {
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
                  title: '3D Ko\'rinish', desc: 'Three.js + Axonometrik',
                },
              ].map(f => (
                <div key={f.title} className="p-4 rounded-xl bg-white/3 border border-white/5">
                  <div className="mb-2">{f.icon}</div>
                  <div className="font-medium text-sm mb-1">{f.title}</div>
                  <div className="text-white/40 text-xs">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects grid */}
        {(projects.length > 0 || loading) && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Loyihalar</h2>
              <span className="text-white/40 text-sm">{projects.length} ta</span>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-40 rounded-xl bg-white/3 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* New project card */}
                <button onClick={() => setShowWizard(true)}
                  className="h-40 rounded-xl border border-dashed border-white/15 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex flex-col items-center justify-center gap-2 group">
                  <div className="w-10 h-10 rounded-full border border-white/20 group-hover:border-blue-500/50 flex items-center justify-center transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </div>
                  <span className="text-sm text-white/40 group-hover:text-blue-400 transition-colors">Yangi loyiha</span>
                </button>

                {projects.map(p => (
                  <button key={p.id} onClick={() => navigate(`/plumbing/${p.id}`)}
                    className="h-40 rounded-xl bg-white/3 border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-left p-5 flex flex-col justify-between group">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                          </svg>
                        </div>
                        <span className="font-medium text-sm truncate">{p.name}</span>
                      </div>
                      <p className="text-white/40 text-xs line-clamp-2 leading-relaxed">{p.description}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-white/30">
                      <span>{p.floorCount} qavat</span>
                      <span>{p.stats?.totalFixtures ?? 0} jihoz</span>
                      <span>{p.stats?.totalPipeM ?? 0}m truba</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-[#111120] border border-white/10 rounded-2xl shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="font-semibold text-lg">Yangi santexnika loyihasi</h3>
              <button onClick={() => { setShowWizard(false); setError(''); }}
                className="text-white/40 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Project name */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Loyiha nomi (ixtiyoriy)</label>
                <input
                  value={projName}
                  onChange={e => setProjName(e.target.value)}
                  placeholder="Masalan: 3-qavatli turar-joy"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-500/50 placeholder-white/20"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Bino tavsifi</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="Masalan: 2 qavatli uy: 1-qavat — oshxona 14m², hammom 8m². 2-qavat — vannaxona 10m², hammom 6m²"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500/50 placeholder-white/20 resize-none"
                />
              </div>

              {/* Example prompts */}
              <div>
                <div className="text-xs text-white/30 mb-2">Namunalar:</div>
                <div className="space-y-1.5">
                  {EXAMPLE_PROMPTS.map((ex, i) => (
                    <button key={i} onClick={() => setPrompt(ex)}
                      className="w-full text-left text-xs text-white/40 hover:text-blue-400 bg-white/3 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/20 rounded-lg px-3 py-2 transition-all truncate">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    AI tahlil qilyapti...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5,3 19,12 5,21"/>
                    </svg>
                    Loyiha yaratish
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
