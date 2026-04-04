import { Group, Rect, Circle } from 'react-konva';

interface SymbolProps {
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
}

export default function BathtubSymbol({ x, y, rotation = 0, scale = 1 }: SymbolProps) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      {/* Outer tub */}
      <Rect
        x={-40}
        y={-80}
        width={80}
        height={160}
        stroke="#1a1a1a"
        strokeWidth={2}
        fill="#f5f5f5"
        cornerRadius={8}
      />
      {/* Inner tub */}
      <Rect
        x={-35}
        y={-75}
        width={70}
        height={150}
        stroke="#1a1a1a"
        strokeWidth={1}
        fill="white"
        cornerRadius={6}
      />
      {/* Drain */}
      <Circle
        x={0}
        y={60}
        radius={4}
        stroke="#1a1a1a"
        strokeWidth={1}
        fill="#64748b"
      />
      {/* Faucet */}
      <Circle
        x={0}
        y={-60}
        radius={6}
        stroke="#1a1a1a"
        strokeWidth={1.5}
        fill="#3b82f6"
      />
    </Group>
  );
}
