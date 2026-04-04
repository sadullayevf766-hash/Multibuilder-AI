import { Group, Rect, Line } from 'react-konva';

interface SymbolProps {
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
}

export default function WindowSymbol({ x, y, rotation = 0, scale = 1 }: SymbolProps) {
  const width = 120;
  const height = 15;

  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      {/* Wall section */}
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill="#f5f5f5"
        stroke="#1a1a1a"
        strokeWidth={1.5}
      />
      {/* Triple line */}
      <Line
        points={[-width / 2 + 5, 0, width / 2 - 5, 0]}
        stroke="#1a1a1a"
        strokeWidth={1}
      />
      <Line
        points={[-width / 2 + 5, -3, width / 2 - 5, -3]}
        stroke="#1a1a1a"
        strokeWidth={0.5}
      />
      <Line
        points={[-width / 2 + 5, 3, width / 2 - 5, 3]}
        stroke="#1a1a1a"
        strokeWidth={0.5}
      />
      {/* Blue tint */}
      <Rect
        x={-width / 2 + 5}
        y={-height / 2 + 2}
        width={width - 10}
        height={height - 4}
        fill="#3b82f6"
        opacity={0.2}
      />
    </Group>
  );
}
