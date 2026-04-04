import { Group, Rect, Circle } from 'react-konva';

interface SymbolProps {
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
}

export default function ManifoldSymbol({ x, y, rotation = 0, scale = 1 }: SymbolProps) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      {/* Main body (amber) */}
      <Rect
        x={-40}
        y={-10}
        width={80}
        height={20}
        stroke="#1a1a1a"
        strokeWidth={1.5}
        fill="#fbbf24"
        cornerRadius={3}
      />
      {/* Inlet circles (red - hot) */}
      <Circle x={-25} y={-10} radius={4} fill="#ef4444" stroke="#1a1a1a" strokeWidth={1} />
      <Circle x={0} y={-10} radius={4} fill="#ef4444" stroke="#1a1a1a" strokeWidth={1} />
      <Circle x={25} y={-10} radius={4} fill="#ef4444" stroke="#1a1a1a" strokeWidth={1} />
      
      {/* Outlet circles (blue/gray) */}
      <Circle x={-25} y={10} radius={4} fill="#3b82f6" stroke="#1a1a1a" strokeWidth={1} />
      <Circle x={0} y={10} radius={4} fill="#3b82f6" stroke="#1a1a1a" strokeWidth={1} />
      <Circle x={25} y={10} radius={4} fill="#64748b" stroke="#1a1a1a" strokeWidth={1} />
    </Group>
  );
}
