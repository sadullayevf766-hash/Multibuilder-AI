import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Canvas2D, { type Canvas2DHandle } from '../components/Canvas2D';
import { supabase } from '../lib/supabase';
import type { DrawingData } from '../../../shared/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ProjectData {
  id: string;
  name: string;
  drawing_data: DrawingData;
  messages: ChatMessage[];
  created_at: string;
}

type EditState = 'idle' | 'generating' | 'saving' | 'error';

export default function Project() {
  const { id } = useParams<{ id: string }>();
  const canvasRef = useRef<Canvas2DHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canvasWidth, setCanvasWidth] = useState(900);

  const [input, setInput] = useState('');
  const [editState, setEditState] = useState<EditState>('idle');
  const [editError, setEditError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => { loadProject(); }, [id]);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) setCanvasWidth(containerRef.current.offsetWidth);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session) h['Authorization'] = `Bearer ${session.access_token}`;
    return h;
  };

  const loadProject = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/project/${id}`, { headers });
      if (!response.ok) throw new Error('Loyihani yuklashda xatolik');
      const data = await response.json();
      setProject(data);
      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noma'lum xatolik");
    } finally { setLoading(false); }
  };

  const handleSend = async () => {
    if (!input.trim() || editState !== 'idle') return;
    const userMessage = input.trim();
    setInput('');

    // Add user message to chat immediately
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setEditError('');

    try {
      setEditState('generating');

      const headers = await getAuthHeaders();
      const res = await fetch(`/api/project/${id}/drawing`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          userMessage,
          history: messages // send full history
        })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Xatolik yuz berdi');
      }

      setEditState('saving');
      const updated = await res.json();

      // Update project drawing and messages
      setProject(p => p ? { ...p, drawing_data: updated.drawingData || updated.drawing_data } : p);
      setMessages(updated.messages || newMessages);
      setEditState('idle');
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Noma'lum xatolik";
      setEditError(msg);
      setEditState('error');
      // Remove the user message on error
      setMessages(messages);
    }
  };

  const handleDownloadDxf = async () => {
    if (!project) return;
    try {
      const response = await fetch('/api/export/dxf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawingData: project.drawing_data })
      });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${project.name}.dxf`; a.click();
    } catch { setError('DXF yuklab olishda xatolik'); }
  };

  const handleDownloadPdf = () => {
    if (!project || !canvasRef.current) return;
    canvasRef.current.exportToPdf(`${project.name}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/40"></div>
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

  const isProcessing = editState === 'generating' || editState === 'saving';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col" style={{ height: '100dvh', overflow: 'hidden' }}>
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-lg font-semibold tracking-tight">FloorPlan AI</Link>
            <span className="text-white/20">/</span>
            <span className="text-sm text-gray-400 truncate max-w-32 md:max-w-none">{project.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadDxf}
              className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-xs hover:bg-white/20 transition-colors border border-white/10">
              📥 DXF
            </button>
            <button onClick={handleDownloadPdf}
              className="px-3 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors">
              📄 PDF
            </button>
            <Link to="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors ml-2 hidden md:block">
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main: canvas + chat side by side */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

        {/* Canvas area — scrollable */}
        <div className="flex-1 overflow-auto p-4 md:p-6 min-h-0">
          {isProcessing ? (
            <div className="liquid-glass border border-white/10 rounded-2xl min-h-64 flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white/40 mx-auto mb-4"></div>
                <p className="text-gray-400 text-sm">
                  {editState === 'generating' ? 'AI tahlil qilmoqda...' : 'Saqlanmoqda...'}
                </p>
              </div>
            </div>
          ) : (
            <div className="liquid-glass border border-white/10 rounded-2xl overflow-hidden">
              <div ref={containerRef} className="overflow-x-auto bg-white w-full">
                <Canvas2D ref={canvasRef} drawingData={project.drawing_data} width={canvasWidth} scale={1} />
              </div>
            </div>
          )}
        </div>

        {/* Chat panel — fixed height, does NOT scroll with canvas */}
        <div className="w-full lg:w-80 xl:w-96 flex flex-col border-t lg:border-t-0 lg:border-l border-white/10 flex-shrink-0 min-h-0 overflow-hidden">
          {/* Chat header */}
          <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
            <p className="text-sm font-medium">Loyihani tahrirlash</p>
            <p className="text-xs text-gray-500 mt-0.5">AI bilan suhbat orqali o'zgartiring</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <div className="text-3xl mb-3">💬</div>
                <p className="text-gray-500 text-xs leading-relaxed">
                  Loyihani o'zgartirish uchun yozing.<br/>
                  Masalan: "muzlatgich qo'sh" yoki "eshikni janubga o'tkaz"
                </p>
              </div>
            )}

            {messages.filter(m => m.role === 'user').map((msg, i) => (
              <div key={i} className="flex justify-end">
                <div className="bg-white text-black rounded-2xl rounded-tr-sm px-3 py-2 text-sm max-w-[85%]">
                  {msg.content}
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex justify-start">
                <div className="liquid-glass border border-white/10 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-gray-400">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: '0ms' }}>•</span>
                    <span className="animate-bounce" style={{ animationDelay: '150ms' }}>•</span>
                    <span className="animate-bounce" style={{ animationDelay: '300ms' }}>•</span>
                  </span>
                </div>
              </div>
            )}

            {editError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-red-400 text-xs">{editError}</p>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/10 flex-shrink-0">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Masalan: muzlatgich qo'sh..."
                className="glass-input flex-1 px-3 py-2 rounded-xl text-sm resize-none"
                rows={2}
                disabled={isProcessing}
              />
              <button
                onClick={handleSend}
                disabled={isProcessing || !input.trim()}
                className="px-3 py-2 bg-white text-black rounded-xl text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
              >
                →
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1.5">Enter — yuborish, Shift+Enter — yangi qator</p>
          </div>
        </div>
      </div>
    </div>
  );
}
