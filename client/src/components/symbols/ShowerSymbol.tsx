import { Group, Rect, Line, Circle } from 'react-konva';

interface SymbolProps {
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
}

export default function ShowerSymbol({ x, y, rotation = 0, scale = 1 }: SymbolProps) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      {/* Tray */}
      <Rect
        x={-40}
        y={-40}
        width={80}
        height={80}
        stroke="#1a1a1a"
        strokeWidth={2}
        fill="#f5f5f5"
      />
      {/* Cross drain */}
      <Line
        points={[-30, 0, 30, 0]}
        stroke="#64748b"
        strokeWidth={1.5}
      />
      <Line
        points={[0, -30, 0, 30]}
        stroke="#64748b"
        strokeWidth={1.5}
      />
      {/* Shower head (dots) */}
      {[-15, -5, 5, 15].map((dx, i) => (
        <Circle
          key={i}
          x={dx}
          y={-30}
          radius={2}
          fill="#3b82f6"
        />
      ))}
    </Group>
  );
}
