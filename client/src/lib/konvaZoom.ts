/**
 * Reusable Konva zoom behavior.
 * Call setupKonvaZoom() after stage creation, inside useEffect.
 * Returns a cleanup function.
 */
import Konva from 'konva';

export const ZOOM_STEP = 1.18;
export const MIN_ZOOM  = 0.15;
export const MAX_ZOOM  = 10;

export interface ZoomState {
  zoom: number;       // current user zoom (1 = fit-to-width)
}

export function setupKonvaZoom(
  stage: Konva.Stage,
  baseScale: number,
  zoomRef: { current: number },
  setZoomState: (z: number) => void,
): () => void {
  // Make stage draggable for panning
  stage.draggable(true);

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor  = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current * factor));
    const ptr     = stage.getPointerPosition() ?? { x: stage.width() / 2, y: stage.height() / 2 };
    const oldScale = stage.scaleX();
    const ptX = (ptr.x - stage.x()) / oldScale;
    const ptY = (ptr.y - stage.y()) / oldScale;
    const fs  = baseScale * newZoom;
    stage.scale({ x: fs, y: fs });
    stage.position({ x: ptr.x - ptX * fs, y: ptr.y - ptY * fs });
    stage.batchDraw();
    zoomRef.current = newZoom;
    setZoomState(newZoom);
  };

  stage.container().addEventListener('wheel', handleWheel, { passive: false });
  return () => stage.container().removeEventListener('wheel', handleWheel as EventListener);
}

/** Reset zoom to fit-to-width */
export function resetKonvaZoom(
  stage: Konva.Stage,
  baseScale: number,
  zoomRef: { current: number },
  setZoomState: (z: number) => void,
) {
  stage.scale({ x: baseScale, y: baseScale });
  stage.position({ x: 0, y: 0 });
  stage.batchDraw();
  zoomRef.current = 1;
  setZoomState(1);
}

/** Zoom in by one step */
export function zoomInKonva(
  stage: Konva.Stage,
  baseScale: number,
  zoomRef: { current: number },
  setZoomState: (z: number) => void,
) {
  const newZoom = Math.min(MAX_ZOOM, zoomRef.current * ZOOM_STEP);
  const fs = baseScale * newZoom;
  stage.scale({ x: fs, y: fs });
  stage.batchDraw();
  zoomRef.current = newZoom;
  setZoomState(newZoom);
}

/** Zoom out by one step */
export function zoomOutKonva(
  stage: Konva.Stage,
  baseScale: number,
  zoomRef: { current: number },
  setZoomState: (z: number) => void,
) {
  const newZoom = Math.max(MIN_ZOOM, zoomRef.current / ZOOM_STEP);
  const fs = baseScale * newZoom;
  stage.scale({ x: fs, y: fs });
  stage.batchDraw();
  zoomRef.current = newZoom;
  setZoomState(newZoom);
}
