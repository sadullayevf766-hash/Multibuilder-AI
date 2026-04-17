import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import Canvas2D, { type Canvas2DHandle } from "../components/Canvas2D";
import Canvas3D, { type Canvas3DHandle } from "../components/Canvas3D";
import { supabase } from "../lib/supabase";
import type { DrawingData } from "../../../shared/types";

interface ChatMessage { role: "user" | "assistant"; content: string; }
interface ProjectData { id: string; name: string; drawing_data: DrawingData; messages: ChatMessage[]; created_at: string; }
type EditState = "idle" | "generating" | "saving" | "error";

interface ChatPanelProps { mode: "2d" | "3d"; messages: ChatMessage[]; editState: EditState; editError: string; onSend: (msg: string) => void; }

function ChatPanel({ mode, messages, editState, editError, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const is2d = mode === "2d";
  const busy = editState === "generating" || editState === "saving";
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const send = () => { if (!input.trim() || busy) return; onSend(input.trim()); setInput(""); };
  return (
    <div className="w-full lg:w-80 xl:w-96 flex flex-col border-t lg:border-t-0 lg:border-l border-white/10 flex-shrink-0 min-h-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
        <p className="text-sm font-medium">{is2d ? "2D Reja" : "3D Ko'rinish"} — Tahrirlash</p>
        <p className="text-xs text-gray-500 mt-0.5">{is2d ? "Reja elementlarini o'zgartiring" : "3D ko'rinishni o'zgartiring"}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (<div className="text-center py-8"><div className="text-3xl mb-3">{is2d ? "📐" : "🏠"}</div><p className="text-gray-500 text-xs">{is2d ? "Masalan: muzlatgich qo'sh" : "Masalan: karavot qo'sh"}</p></div>)}
        {messages.filter(m => m.role === "user").map((msg, i) => (<div key={i} className="flex justify-end"><div className="bg-white text-black rounded-2xl rounded-tr-sm px-3 py-2 text-sm max-w-[85%]">{msg.content}</div></div>))}
        {busy && (<div className="flex justify-start"><div className="liquid-glass border border-white/10 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-gray-400"><span className="inline-flex gap-1"><span className="animate-bounce">•</span><span className="animate-bounce" style={{animationDelay:"150ms"}}>•</span><span className="animate-bounce" style={{animationDelay:"300ms"}}>•</span></span></div></div>)}
        {editError && (<div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3"><p className="text-red-400 text-xs">{editError}</p></div>)}
        <div ref={endRef} />
      </div>
      <div className="p-3 border-t border-white/10 flex-shrink-0">
        <div className="flex gap-2">
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={is2d ? "Masalan: muzlatgich qo'sh..." : "Masalan: karavot qo'sh..."} className="glass-input flex-1 px-3 py-2 rounded-xl text-sm resize-none" rows={2} disabled={busy} />
          <button onClick={send} disabled={busy || !input.trim()} className="px-3 py-2 bg-white text-black rounded-xl text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end">→</button>
        </div>
        <p className="text-xs text-gray-600 mt-1.5">Enter — yuborish, Shift+Enter — yangi qator</p>
      </div>
    </div>
  );
}

export default function Project() {
  const { id } = useParams<{ id: string }>();
  const canvasRef = useRef<Canvas2DHandle>(null);
  const canvas3dRef = useRef<Canvas3DHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canvasWidth, setCanvasWidth] = useState(900);
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [drawingVersion, setDrawingVersion] = useState(0);
  const [editState2d, setEditState2d] = useState<EditState>("idle");
  const [editError2d, setEditError2d] = useState("");
  const [messages2d, setMessages2d] = useState<ChatMessage[]>([]);
  const [editState3d, setEditState3d] = useState<EditState>("idle");
  const [editError3d, setEditError3d] = useState("");
  const [messages3d, setMessages3d] = useState<ChatMessage[]>([]);

  useEffect(() => { loadProject(); }, [id]);
  useEffect(() => {
    const update = () => { if (containerRef.current) setCanvasWidth(containerRef.current.offsetWidth); };
    update(); window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session) h["Authorization"] = `Bearer ${session.access_token}`;
    return h;
  };

  const loadProject = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/project/${id}`, { headers });
      if (!res.ok) throw new Error("Loyihani yuklashda xatolik");
      const data = await res.json();
      setProject(data); setMessages2d(data.messages || []);
    } catch (err) { setError(err instanceof Error ? err.message : "Noma'lum xatolik"); }
    finally { setLoading(false); }
  };

  const handleSend2d = useCallback(async (userMessage: string) => {
    if (editState2d !== "idle") return;
    const prev = messages2d;
    const currentData = project?.drawing_data;
    const next: ChatMessage[] = [...prev, { role: "user", content: userMessage }];
    setMessages2d(next); setEditError2d("");
    try {
      setEditState2d("generating");
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/project/${id}/drawing`, { method: "PATCH", headers, body: JSON.stringify({ userMessage, history: prev, currentDrawingData: currentData }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Xatolik"); }
      setEditState2d("saving");
      const updated = await res.json();
      setProject(p => p ? { ...p, drawing_data: updated.drawingData || updated.drawing_data } : p);
      setDrawingVersion(v => v + 1); setMessages2d(updated.messages || next); setEditState2d("idle");
    } catch (err) { setEditError2d(err instanceof Error ? err.message : "Noma'lum xatolik"); setEditState2d("error"); setMessages2d(prev); }
  }, [id, editState2d, messages2d, project]);

  const handleSend3d = useCallback(async (userMessage: string) => {
    if (editState3d !== "idle") return;
    const prev = messages3d;
    const currentData3d = project?.drawing_data;
    const next: ChatMessage[] = [...prev, { role: "user", content: userMessage }];
    setMessages3d(next); setEditError3d("");
    try {
      setEditState3d("generating");
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/project/${id}/drawing`, { method: "PATCH", headers, body: JSON.stringify({ userMessage, history: prev, currentDrawingData: currentData3d }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Xatolik"); }
      setEditState3d("saving");
      const updated = await res.json();
      setProject(p => p ? { ...p, drawing_data: updated.drawingData || updated.drawing_data } : p);
      setDrawingVersion(v => v + 1); setMessages3d(next); setEditState3d("idle");
    } catch (err) { setEditError3d(err instanceof Error ? err.message : "Noma'lum xatolik"); setEditState3d("error"); setMessages3d(prev); }
  }, [id, editState3d, messages3d, project]);

  const handleDownloadDxf = async () => {
    if (!project) return;
    try {
      const res = await fetch("/api/export/dxf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ drawingData: project.drawing_data }) });
      if (!res.ok) throw new Error();
      const blob = await res.blob(); const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${project.name}.dxf`; a.click();
    } catch { setError("DXF yuklab olishda xatolik"); }
  };

  const handleDownloadPdf = () => { if (!project || !canvasRef.current) return; canvasRef.current.exportToPdf(`${project.name}.pdf`); };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/40" /></div>;
  if (error || !project) return (<div className="min-h-screen bg-black text-white flex items-center justify-center p-4"><div className="text-center"><div className="text-5xl mb-4">⚠️</div><p className="text-red-400 mb-6">{error || "Loyiha topilmadi"}</p><Link to="/dashboard" className="bg-white text-black px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors">← Dashboard ga qaytish</Link></div></div>);

  const isProcessing = viewMode === "2d" ? (editState2d === "generating" || editState2d === "saving") : (editState3d === "generating" || editState3d === "saving");

  return (
    <div className="min-h-screen bg-black text-white flex flex-col" style={{ height: "100dvh", overflow: "hidden" }}>
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-lg font-semibold tracking-tight">FloorPlan AI</Link>
            <span className="text-white/20">/</span>
            <span className="text-sm text-gray-400 truncate max-w-32 md:max-w-none">{project.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadDxf} className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-xs hover:bg-white/20 transition-colors border border-white/10">📥 DXF</button>
            <button onClick={handleDownloadPdf} className="px-3 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors">📄 PDF</button>
            <Link to="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors ml-2 hidden md:block">← Dashboard</Link>
          </div>
        </div>
      </header>
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        <div className="flex-1 overflow-auto p-4 md:p-6 min-h-0">
          {isProcessing ? (
            <div className="liquid-glass border border-white/10 rounded-2xl min-h-64 flex items-center justify-center h-full"><div className="text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/40 mx-auto mb-4" /><p className="text-gray-400 text-sm">AI tahlil qilmoqda...</p></div></div>
          ) : (
            <div className="liquid-glass border border-white/10 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
                <button onClick={() => setViewMode("2d")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === "2d" ? "bg-white text-black" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}>2D Reja</button>
                <button onClick={() => setViewMode("3d")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === "3d" ? "bg-white text-black" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}>3D Ko'rinish</button>
              </div>
              <div ref={containerRef} className="overflow-x-auto bg-white w-full">
                {viewMode === "2d" && <Canvas2D ref={canvasRef} drawingData={project.drawing_data} width={canvasWidth} scale={1} />}
                {viewMode === "3d" && <Canvas3D key={`3d-v${drawingVersion}`} ref={canvas3dRef} drawingData={project.drawing_data} width={canvasWidth} />}
              </div>
            </div>
          )}
        </div>
        {viewMode === "2d"
          ? <ChatPanel mode="2d" messages={messages2d} editState={editState2d} editError={editError2d} onSend={handleSend2d} />
          : <ChatPanel mode="3d" messages={messages3d} editState={editState3d} editError={editError3d} onSend={handleSend3d} />
        }
      </div>
    </div>
  );
}




