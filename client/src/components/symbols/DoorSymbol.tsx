import { Group, Line, Arc } from 'react-konva';

interface SymbolProps {
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
  wall?: 'north' | 'south' | 'east' | 'west';
}

export default function DoorSymbol({ x, y, rotation = 0, scale = 1 }: SymbolProps) {
  const doorWidth = 90;

  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      {/* Wall opening (gap) */}
      <Line
        points={[-doorWidth / 2, 0, doorWidth / 2, 0]}
        stroke="white"
        strokeWidth={20}
      />
      {/* Door leaf */}
      <Line
        points={[-doorWidth / 2, 0, -doorWidth / 2, -doorWidth]}
        stroke="#1a1a1a"
        strokeWidth={1.5}
      />
      {/* Swing arc */}
      <Arc
        x={-doorWidth / 2}
        y={0}
        innerRadius={0}
        outerRadius={doorWidth}
        angle={90}
        rotation={0}
        stroke="#1a1a1a"
        strokeWidth={1.5}
      />
    </Group>
  );
}
