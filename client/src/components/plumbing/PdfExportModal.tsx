import { useState, useCallback } from 'react';
import type { PlumbingProject, ViewType } from '../../engine/plumbing-types';
import { exportPlumbingPDF, type PdfPage } from '../../utils/exportPlumbingPDF';

const VIEW_LABELS: Record<string, string> = {
  top: 'Yuqoridan (Reja)', front: 'Oldidan (Fasad)',
  back: 'Orqadan', left: 'Chapdan', right: 'O\'ngdan', bottom: 'Pastdan',
};
const VIEWS: ViewType[] = ['top', 'front', 'back', 'left', 'right', 'bottom'];

interface Props {
  project: PlumbingProject;
  onClose: () => void;
}

export default function PdfExportModal({ project, onClose }: Props) {
  const floors = Array.from({ length: project.floorCount }, (_, i) => i + 1);

  // Tanlangan view+floor kombinatsiyalar
  const [selected, setSelected] = useState<Set<string>>(() => {
    const s = new Set<string>();
    // Default: top view har qavat + front view
    floors.forEach(f => s.add(`top:${f}`));
    s.add('front:1');
    return s;
  });

  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [quality, setQuality] = useState(2);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  function toggle(key: string) {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return s;
    });
  }

  function toggleView(view: ViewType) {
    const allFloorsKeys = floors.map(f => `${view}:${f}`);
    const allSelected = allFloorsKeys.every(k => selected.has(k));
    setSelected(prev => {
      const s = new Set(prev);
      if (allSelected) allFloorsKeys.forEach(k => s.delete(k));
      else allFloorsKeys.forEach(k => s.add(k));
      return s;
    });
  }

  function toggleFloor(floor: number) {
    const allViewKeys = VIEWS.map(v => `${v}:${floor}`);
    const allSelected = allViewKeys.every(k => selected.has(k));
    setSelected(prev => {
      const s = new Set(prev);
      if (allSelected) allViewKeys.forEach(k => s.delete(k));
      else allViewKeys.forEach(k => s.add(k));
      return s;
    });
  }

  function selectAll() {
    const s = new Set<string>();
    VIEWS.forEach(v => floors.forEach(f => s.add(`${v}:${f}`)));
    setSelected(s);
  }

  const handleExport = useCallback(async () => {
    if (selected.size === 0) return;
    setExporting(true);
    setProgress(0);

    const pages: PdfPage[] = [];
    // Tartib: top view har qavat, keyin qolganlar
    const orderedViews: ViewType[] = ['top', 'front', 'back', 'left', 'right', 'bottom'];
    for (const view of orderedViews) {
      for (const floor of floors) {
        const key = `${view}:${floor}`;
        if (selected.has(key)) {
          pages.push({
            view,
            floor,
            label: `${VIEW_LABELS[view]?.toUpperCase()} | Miqyos 1:100 | ${floor}-qavat`,
          });
        }
      }
    }

    try {
      await exportPlumbingPDF(project, { pages, orientation, quality }, (cur, total) => {
        setProgress(Math.round((cur / total) * 100));
      });
    } catch (e) {
      console.error('PDF export error:', e);
    } finally {
      setExporting(false);
      setProgress(0);
      onClose();
    }
  }, [selected, orientation, quality, project, onClose, floors]);

  const pageCount = selected.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#111120] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
                <line x1="9" y1="11" x2="15" y2="11"/>
              </svg>
            </div>
            <div>
              <div className="font-semibold text-sm">PDF Eksport</div>
              <div className="text-xs text-white/40">{project.name}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Sahifalar tanlash */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium">Sahifalar tanlash</div>
              <div className="flex gap-2">
                <button onClick={selectAll}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  Barchasini
                </button>
                <button onClick={() => setSelected(new Set())}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors">
                  Tozalash
                </button>
              </div>
            </div>

            {/* Grid: views × floors */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left px-2 py-1.5 text-white/40 font-normal w-32">Ko'rinish</th>
                    {floors.map(f => (
                      <th key={f} className="text-center px-1 py-1.5">
                        <button onClick={() => toggleFloor(f)}
                          className="text-white/50 hover:text-blue-400 transition-colors font-normal">
                          {f}-qavat
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {VIEWS.map(view => {
                    const allSel = floors.every(f => selected.has(`${view}:${f}`));
                    return (
                      <tr key={view} className="border-t border-white/5">
                        <td className="px-2 py-1.5">
                          <button onClick={() => toggleView(view)}
                            className={`text-left transition-colors hover:text-blue-400 ${allSel ? 'text-white' : 'text-white/50'}`}>
                            {VIEW_LABELS[view]}
                          </button>
                        </td>
                        {floors.map(f => {
                          const key = `${view}:${f}`;
                          const sel = selected.has(key);
                          return (
                            <td key={f} className="text-center px-1 py-1.5">
                              <button onClick={() => toggle(key)}
                                className={`w-7 h-7 rounded-md border transition-all ${
                                  sel
                                    ? 'bg-blue-600 border-blue-500 text-white'
                                    : 'bg-white/5 border-white/10 text-white/30 hover:border-blue-500/40'
                                }`}>
                                {sel ? (
                                  <svg className="mx-auto" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <polyline points="20,6 9,17 4,12"/>
                                  </svg>
                                ) : (
                                  <span className="text-[9px] text-white/20">{f}</span>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Parametrlar */}
          <div className="grid grid-cols-2 gap-4">
            {/* Orientation */}
            <div>
              <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">Yo'nalish</div>
              <div className="flex gap-2">
                {(['landscape', 'portrait'] as const).map(o => (
                  <button key={o} onClick={() => setOrientation(o)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      orientation === o
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                    }`}>
                    <div className={`mx-auto mb-1 border-2 ${orientation === o ? 'border-white/70' : 'border-white/30'} ${
                      o === 'landscape' ? 'w-8 h-5' : 'w-5 h-8'
                    }`} />
                    {o === 'landscape' ? 'Gorizontal (A4)' : 'Vertikal (A4)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            <div>
              <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">Sifat</div>
              <div className="flex gap-2">
                {[{ q: 1, label: 'Tez', sub: '~1 MB' }, { q: 2, label: 'Normal', sub: '~3 MB' }, { q: 3, label: 'Yuqori', sub: '~8 MB' }].map(({ q, label, sub }) => (
                  <button key={q} onClick={() => setQuality(q)}
                    className={`flex-1 py-2 px-1 rounded-lg text-xs border transition-colors ${
                      quality === q
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                    }`}>
                    <div className="font-medium">{label}</div>
                    <div className={`text-[9px] ${quality === q ? 'text-blue-200' : 'text-white/30'}`}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white/3 border border-white/5 rounded-xl p-4 flex items-center gap-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
            <div>
              <div className="text-sm font-medium">{pageCount} sahifa</div>
              <div className="text-xs text-white/40">
                A4 {orientation === 'landscape' ? '297×210' : '210×297'} mm ·
                {quality === 1 ? ' 96 DPI' : quality === 2 ? ' 192 DPI' : ' 288 DPI'}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5">
          {exporting ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>PDF yaratilmoqda...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm transition-colors">
                Bekor
              </button>
              <button
                onClick={handleExport}
                disabled={pageCount === 0}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7,10 12,15 17,10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                PDF Yuklash ({pageCount} sahifa)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
