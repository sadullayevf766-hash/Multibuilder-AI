import { Group, Rect, Circle } from 'react-konva';

interface SymbolProps {
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
}

export default function SinkSymbol({ x, y, rotation = 0, scale = 1 }: SymbolProps) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      {/* Outer shell */}
      <Rect
        x={-25}
        y={-20}
        width={50}
        height={40}
        stroke="#1a1a1a"
        strokeWidth={1.5}
        fill="#f5f5f5"
        cornerRadius={3}
      />
      {/* Basin */}
      <Rect
        x={-20}
        y={-15}
        width={40}
        height={30}
        stroke="#1a1a1a"
        strokeWidth={1}
        fill="white"
        cornerRadius={2}
      />
      {/* Drain */}
      <Circle
        x={0}
        y={0}
        radius={4}
        stroke="#1a1a1a"
        strokeWidth={1}
        fill="#64748b"
      />
      {/* Faucet (cold) */}
      <Circle
        x={-10}
        y={-10}
        radius={3}
        fill="#3b82f6"
        stroke="#1a1a1a"
        strokeWidth={0.5}
      />
      {/* Faucet (hot) */}
      <Circle
        x={10}
        y={-10}
        radius={3}
        fill="#ef4444"
        stroke="#1a1a1a"
        strokeWidth={0.5}
      />
    </Group>
  );
}
