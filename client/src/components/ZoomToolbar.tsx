interface ZoomToolbarProps {
  zoom: number;           // current zoom level (1 = 100%)
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  minZoom?: number;
  maxZoom?: number;
  className?: string;
}

export default function ZoomToolbar({
  zoom, onZoomIn, onZoomOut, onReset,
  minZoom = 0.2, maxZoom = 8,
  className = '',
}: ZoomToolbarProps) {
  const pct = Math.round(zoom * 100);

  return (
    <div className={`flex items-center gap-1 select-none ${className}`}>
      <button
        onClick={onZoomOut}
        disabled={zoom <= minZoom}
        title="Kichiklashtirish (scroll pastga)"
        className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600
                   disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold
                   transition-colors border border-slate-600"
      >−</button>

      <button
        onClick={onReset}
        title="Asl o'lchamga qaytarish"
        className="min-w-[52px] h-7 px-2 flex items-center justify-center rounded
                   bg-slate-700 hover:bg-slate-600 text-white text-xs font-mono
                   transition-colors border border-slate-600"
      >
        {pct}%
      </button>

      <button
        onClick={onZoomIn}
        disabled={zoom >= maxZoom}
        title="Kattalashtirish (scroll yuqoriga)"
        className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 hover:bg-slate-600
                   disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold
                   transition-colors border border-slate-600"
      >+</button>

      <span className="text-slate-500 text-[10px] ml-1 hidden sm:block">
        Ctrl+scroll · ←drag→
      </span>
    </div>
  );
}
