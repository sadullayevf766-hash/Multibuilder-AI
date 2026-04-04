import { Group, Circle, Path, Rect } from 'react-konva';

interface SymbolProps {
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
  width?: number;
  height?: number;
}

export default function ToiletSymbol({ x, y, rotation = 0, scale = 1, width = 40, height = 70 }: SymbolProps) {
  const hw = width / 2;
  const tankH = height * 0.35;
  const bowlH = height * 0.65;

  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      {/* Tank (rect) */}
      <Rect
        x={-hw}
        y={-height / 2}
        width={width}
        height={tankH}
        stroke="#1a1a1a"
        strokeWidth={1.5}
        fill="#f5f5f5"
        cornerRadius={3}
      />
      {/* Bowl (D-shape) */}
      <Path
        data={`M ${-hw} ${-height / 2 + tankH} Q ${-hw} ${height / 2} 0 ${height / 2} Q ${hw} ${height / 2} ${hw} ${-height / 2 + tankH} Z`}
        stroke="#1a1a1a"
        strokeWidth={1.5}
        fill="#f5f5f5"
      />
      {/* Inner oval */}
      <Circle
        x={0}
        y={height / 2 - bowlH * 0.4}
        radius={hw * 0.6}
        stroke="#1a1a1a"
        strokeWidth={1}
        fill="white"
      />
    </Group>
  );
}
