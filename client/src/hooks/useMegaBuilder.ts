/**
 * useMegaBuilder — Mega Builder 3 bosqich holat boshqaruvi
 * Plan → Build → Review/Edit
 */
import { useState, useCallback, useRef } from 'react';
import type {
  MegaStage, MegaDiscipline, MegaChatMessage, MegaProjectSpec,
  GenerationState, MegaGenerations, ViewMode,
} from '../../../shared/mega-types';
import { emptyGenerations, DISCIPLINE_META } from '../../../shared/mega-types';

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function apiFetch(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Server xatolik ${res.status}`);
  }
  return res.json();
}

// ── State ─────────────────────────────────────────────────────────────────────
export interface MegaBuilderHook {
  // stage
  stage:       MegaStage;

  // Plan
  chatHistory: MegaChatMessage[];
  chatLoading: boolean;
  spec:        MegaProjectSpec | null;
  sendMessage: (text: string) => Promise<void>;
  goToBuild:   () => void;

  // Build
  generations:      MegaGenerations;
  buildLoading:     boolean;
  buildProgress:    number;           // 0-100
  buildAll:         () => Promise<void>;
  rebuildDisc:      (d: MegaDiscipline) => Promise<void>;

  // Review / Edit
  activeDisc:   MegaDiscipline | null;
  activeView:   ViewMode;
  editHistory:  MegaChatMessage[];
  editLoading:  boolean;
  setActiveDisc: (d: MegaDiscipline) => void;
  setActiveView: (v: ViewMode) => void;
  sendEdit:      (text: string) => Promise<void>;
  goToPlan:      () => void;

  // Save
  savedProjectId: string | null;
  saveLoading:    boolean;
  saveProject:    (userId: string, authToken?: string) => Promise<string | null>;
  updateProject:  (authToken?: string) => Promise<void>;
}

export function useMegaBuilder(): MegaBuilderHook {
  const [stage,       setStage]       = useState<MegaStage>('plan');
  const [chatHistory, setChatHistory] = useState<MegaChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [spec,        setSpec]        = useState<MegaProjectSpec | null>(null);

  const [generations,   setGenerations]   = useState<MegaGenerations>(emptyGenerations);
  const [buildLoading,  setBuildLoading]  = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);

  const [activeDisc,  setActiveDisc]  = useState<MegaDiscipline | null>(null);
  const [activeView,  setActiveView]  = useState<ViewMode>('2d');
  const [editHistory, setEditHistory] = useState<MegaChatMessage[]>([]);
  const [editLoading, setEditLoading] = useState(false);

  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [saveLoading,    setSaveLoading]    = useState(false);

  const specRef = useRef<MegaProjectSpec | null>(null);
  specRef.current = spec;

  // ── Plan Stage ──────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || chatLoading) return;
    setChatLoading(true);

    const userMsg: MegaChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);

    try {
      const data = await apiFetch('/api/mega/chat', {
        history: chatHistory,
        message: text,
      });

      const aiMsg: MegaChatMessage = {
        role:      'assistant',
        content:   data.reply,
        timestamp: Date.now(),
      };
      setChatHistory(h => [...h, aiMsg]);

      if (data.isComplete && data.spec) {
        setSpec(data.spec);
      }
    } catch (err) {
      const errMsg: MegaChatMessage = {
        role:      'assistant',
        content:   `❌ Xatolik: ${(err as Error).message}`,
        timestamp: Date.now(),
      };
      setChatHistory(h => [...h, errMsg]);
    } finally {
      setChatLoading(false);
    }
  }, [chatHistory, chatLoading]);

  const goToBuild = useCallback(() => {
    if (!spec) return;
    setStage('build');
  }, [spec]);

  // ── Build Stage ─────────────────────────────────────────────────────────────
  const updateDisc = useCallback((disc: MegaDiscipline, patch: Partial<GenerationState>) => {
    setGenerations(prev => ({
      ...prev,
      [disc]: { ...prev[disc], ...patch },
    }));
  }, []);

  const buildAll = useCallback(async () => {
    const currentSpec = specRef.current;
    if (!currentSpec) return;
    setBuildLoading(true);
    setBuildProgress(0);

    const discs = currentSpec.disciplines;
    // Hammasi "building" holatiga o'tkazish
    discs.forEach(d => updateDisc(d, { status: 'building', error: null }));

    // Har bir disciplineni alohida parallel so'rovda build qilamiz
    // Shu tarzda real-time progress ko'rsatiladi
    let done = 0;
    const firstDoneRef: { disc: MegaDiscipline | null } = { disc: null };

    await Promise.all(discs.map(async (d) => {
      try {
        const partialSpec = { ...currentSpec, disciplines: [d] };
        const data = await apiFetch('/api/mega/build', { spec: partialSpec });
        const schema = data.results?.[d];
        if (schema !== undefined && schema !== null) {
          updateDisc(d, { status: 'done', schema, generatedAt: Date.now() });
          if (!firstDoneRef.disc) firstDoneRef.disc = d;
        } else {
          updateDisc(d, { status: 'error', error: 'Generatsiya amalga oshmadi' });
        }
      } catch (err) {
        updateDisc(d, { status: 'error', error: (err as Error).message });
      } finally {
        done += 1;
        setBuildProgress(Math.round(done / discs.length * 100));
      }
    }));

    if (firstDoneRef.disc) setActiveDisc(firstDoneRef.disc);
    setStage('review');
    setBuildLoading(false);
  }, [updateDisc]);

  const rebuildDisc = useCallback(async (disc: MegaDiscipline) => {
    const currentSpec = specRef.current;
    if (!currentSpec) return;

    updateDisc(disc, { status: 'building', error: null });

    try {
      const partialSpec = { ...currentSpec, disciplines: [disc] };
      const data = await apiFetch('/api/mega/build', { spec: partialSpec });
      const schema = data.results?.[disc];
      if (schema) {
        updateDisc(disc, { status: 'done', schema, generatedAt: Date.now() });
      } else {
        updateDisc(disc, { status: 'error', error: 'Qayta generatsiya amalga oshmadi' });
      }
    } catch (err) {
      updateDisc(disc, { status: 'error', error: (err as Error).message });
    }
  }, [updateDisc]);

  // ── Edit Stage ──────────────────────────────────────────────────────────────
  const sendEdit = useCallback(async (text: string) => {
    const currentSpec = specRef.current;
    if (!text.trim() || editLoading || !currentSpec) return;
    setEditLoading(true);

    const userMsg: MegaChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    setEditHistory(h => [...h, userMsg]);

    try {
      const data = await apiFetch('/api/mega/edit', {
        editHistory,
        message:  text,
        spec:     currentSpec,
      });

      const aiMsg: MegaChatMessage = {
        role:      'assistant',
        content:   data.reply,
        timestamp: Date.now(),
      };
      setEditHistory(h => [...h, aiMsg]);

      // specPatch ni qo'llash
      if (data.specPatch && Object.keys(data.specPatch).length > 0) {
        setSpec(s => s ? { ...s, ...data.specPatch } : s);
      }

      // targets sohalarini qayta build qilish
      const targets: MegaDiscipline[] = data.targets ?? [];
      const validTargets = targets.filter((d: MegaDiscipline) =>
        d in DISCIPLINE_META && currentSpec.disciplines.includes(d)
      );
      for (const disc of validTargets) {
        await rebuildDisc(disc);
      }
    } catch (err) {
      setEditHistory(h => [
        ...h,
        { role: 'assistant', content: `❌ ${(err as Error).message}`, timestamp: Date.now() },
      ]);
    } finally {
      setEditLoading(false);
    }
  }, [editHistory, editLoading, rebuildDisc]);

  const goToPlan = useCallback(() => {
    setStage('plan');
    setSpec(null);
    setChatHistory([]);
    setGenerations(emptyGenerations());
    setEditHistory([]);
    setActiveDisc(null);
    setBuildProgress(0);
    setSavedProjectId(null);
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────────
  const saveProject = useCallback(async (userId: string, authToken?: string): Promise<string | null> => {
    const currentSpec = specRef.current;
    if (!currentSpec) return null;
    setSaveLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch('/api/mega/save', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId,
          name: `Mega loyiha — ${currentSpec.floorCount}q ${currentSpec.totalAreaM2}m²`,
          spec: currentSpec,
          generations,
          chatHistory,
          editHistory,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      const data = await res.json();
      setSavedProjectId(data.id);
      return data.id;
    } catch (err) {
      console.error('[SAVE] Error:', err);
      return null;
    } finally {
      setSaveLoading(false);
    }
  }, [generations, chatHistory, editHistory]);

  const updateProject = useCallback(async (authToken?: string): Promise<void> => {
    if (!savedProjectId) return;
    const currentSpec = specRef.current;
    if (!currentSpec) return;
    setSaveLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      await fetch(`/api/mega/project/${savedProjectId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ spec: currentSpec, generations, chatHistory, editHistory }),
      });
    } catch (err) {
      console.error('[UPDATE] Error:', err);
    } finally {
      setSaveLoading(false);
    }
  }, [savedProjectId, generations, chatHistory, editHistory]);

  return {
    stage,
    chatHistory, chatLoading, spec,
    sendMessage, goToBuild,
    generations, buildLoading, buildProgress,
    buildAll, rebuildDisc,
    activeDisc, activeView, editHistory, editLoading,
    setActiveDisc, setActiveView,
    sendEdit, goToPlan,
    savedProjectId, saveLoading, saveProject, updateProject,
  };
}
