import { Group, Line, Path } from 'react-konva';

interface SymbolProps {
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
}

export default function ValveSymbol({ x, y, rotation = 0, scale = 1 }: SymbolProps) {
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      {/* Stem line */}
      <Line
        points={[0, -15, 0, 15]}
        stroke="#1a1a1a"
        strokeWidth={1.5}
      />
      {/* Triangle 1 (top) */}
      <Path
        data="M -10 -5 L 0 -15 L 10 -5 Z"
        stroke="#1a1a1a"
        strokeWidth={1.5}
        fill="white"
      />
      {/* Triangle 2 (bottom) */}
      <Path
        data="M -10 5 L 0 15 L 10 5 Z"
        stroke="#1a1a1a"
        strokeWidth={1.5}
        fill="white"
      />
      {/* Handle */}
      <Line
        points={[-12, 0, 12, 0]}
        stroke="#1a1a1a"
        strokeWidth={2}
      />
    </Group>
  );
}
