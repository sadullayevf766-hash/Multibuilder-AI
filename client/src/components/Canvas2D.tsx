import { Stage, Layer, Line, Circle, Rect, Text, Group, Arrow, Arc } from 'react-konva';
import type { DrawingData, Wall, PlacedFixture, Pipe, DimensionLine, DoorSpec } from '../../../shared/types';
import ToiletSymbol from './symbols/ToiletSymbol';
import SinkSymbol from './symbols/SinkSymbol';
import BathtubSymbol from './symbols/BathtubSymbol';
import ShowerSymbol from './symbols/ShowerSymbol';

interface Canvas2DProps {
  drawingData: DrawingData;
  width?: number;
  height?: number;
  scale?: number;
}

export default function Canvas2D({ drawingData, width = 800, height = 600, scale = 1 }: Canvas2DProps) {
  console.log('[CANVAS] drawing:', drawingData.dimensions?.[0]?.value, drawingData.dimensions?.[1]?.value);

  const GRID_SIZE = 100;
  const CANVAS_PADDING = 80;

  // Calculate total drawing bounds from all walls
  const allX = drawingData.walls.flatMap(w => [w.start.x, w.end.x]);
  const allY = drawingData.walls.flatMap(w => [w.start.y, w.end.y]);
  const totalWidth  = allX.length > 0 ? Math.max(...allX) - Math.min(...allX) : 300;
  const totalHeight = allY.length > 0 ? Math.max(...allY) - Math.min(...allY) : 400;

  // For single room compatibility
  const roomWidth  = totalWidth;
  const roomHeight = totalHeight;

  // Auto-scale to fit canvas
  const contentWidth  = totalWidth  + CANVAS_PADDING * 2;
  const contentHeight = totalHeight + CANVAS_PADDING * 2 + 100; // extra for title+legend
  const scaleX = width  / contentWidth;
  const scaleY = height / contentHeight;
  const autoScale = Math.min(scaleX, scaleY, 1) * scale;

  // Is this a multi-room floor plan?
  const isFloorPlan = drawingData.walls.length > 4;

  console.log('[CANVAS] auto-scale:', autoScale.toFixed(2), 'room:', roomWidth, 'x', roomHeight);

  const renderGrid = () => {
    const lines = [];
    const gridWidth = width / autoScale;
    const gridHeight = height / autoScale;

    for (let i = 0; i <= gridWidth; i += GRID_SIZE) {
      lines.push(
        <Line
          key={`v-${i}`}
          points={[i, 0, i, gridHeight]}
          stroke="#e0e0e0"
          strokeWidth={0.5}
        />
      );
    }

    for (let i = 0; i <= gridHeight; i += GRID_SIZE) {
      lines.push(
        <Line
          key={`h-${i}`}
          points={[0, i, gridWidth, i]}
          stroke="#e0e0e0"
          strokeWidth={0.5}
        />
      );
    }

    return lines;
  };

  const renderWall = (wall: Wall) => {
    const offset = wall.thickness / 2;
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / length;
    const ny = dx / length;

    // Apply canvas padding offset
    const startX = wall.start.x + CANVAS_PADDING;
    const startY = wall.start.y + CANVAS_PADDING;
    const endX = wall.end.x + CANVAS_PADDING;
    const endY = wall.end.y + CANVAS_PADDING;

    return (
      <Group key={wall.id}>
        {/* Outer line */}
        <Line
          points={[
            startX + nx * offset,
            startY + ny * offset,
            endX + nx * offset,
            endY + ny * offset
          ]}
          stroke="#1a1a1a"
          strokeWidth={2}
        />
        {/* Inner line */}
        <Line
          points={[
            startX - nx * offset,
            startY - ny * offset,
            endX - nx * offset,
            endY - ny * offset
          ]}
          stroke="#1a1a1a"
          strokeWidth={2}
        />
        {/* Fill between walls */}
        <Line
          points={[
            startX + nx * offset,
            startY + ny * offset,
            endX + nx * offset,
            endY + ny * offset,
            endX - nx * offset,
            endY - ny * offset,
            startX - nx * offset,
            startY - ny * offset
          ]}
          closed
          fill="#f5f5f5"
          stroke="none"
        />
      </Group>
    );
  };

  const renderFixture = (fixture: PlacedFixture) => {
    const { type, position } = fixture;
    const x = position.x + CANVAS_PADDING;
    const y = position.y + CANVAS_PADDING;

    switch (type) {
      case 'toilet':
        return <ToiletSymbol key={fixture.id} x={x} y={y} scale={0.8} />;

      case 'sink':
        return <SinkSymbol key={fixture.id} x={x} y={y} />;

      case 'bathtub':
        return <BathtubSymbol key={fixture.id} x={x} y={y} />;

      case 'shower':
        return <ShowerSymbol key={fixture.id} x={x} y={y} />;

      case 'stove':
        return (
          <Group key={fixture.id}>
            <Rect x={x} y={y} width={60} height={60} fill="#f5f5f5" stroke="#1a1a1a" strokeWidth={1.5} />
            <Circle x={x+15} y={y+15} radius={8} stroke="#1a1a1a" strokeWidth={1} />
            <Circle x={x+45} y={y+15} radius={8} stroke="#1a1a1a" strokeWidth={1} />
            <Circle x={x+15} y={y+45} radius={8} stroke="#1a1a1a" strokeWidth={1} />
            <Circle x={x+45} y={y+45} radius={8} stroke="#1a1a1a" strokeWidth={1} />
          </Group>
        );

      case 'fridge':
        return (
          <Group key={fixture.id}>
            <Rect x={x} y={y} width={60} height={65} fill="#f5f5f5" stroke="#1a1a1a" strokeWidth={1.5} />
            <Line points={[x, y+20, x+60, y+20]} stroke="#1a1a1a" strokeWidth={1} />
          </Group>
        );

      case 'dishwasher':
        return (
          <Group key={fixture.id}>
            <Rect x={x} y={y} width={60} height={60} fill="#f5f5f5" stroke="#1a1a1a" strokeWidth={1.5} />
            <Circle x={x+30} y={y+30} radius={20} stroke="#1a1a1a" strokeWidth={1} />
          </Group>
        );

      case 'desk':
        return (
          <Group key={fixture.id}>
            <Rect x={x} y={y} width={120} height={60} fill="#f5f5f5" stroke="#1a1a1a" strokeWidth={1.5} />
            <Rect x={x+40} y={y} width={40} height={5} fill="#1a1a1a" />
          </Group>
        );

      case 'bed':
        return (
          <Group key={fixture.id}>
            <Rect x={x} y={y} width={160} height={200} fill="#f5f5f5" stroke="#1a1a1a" strokeWidth={1.5} />
            <Rect x={x+10} y={y+5} width={140} height={40} fill="#e0e0e0" stroke="#1a1a1a" strokeWidth={1} />
            <Line points={[x, y+50, x+160, y+50]} stroke="#1a1a1a" strokeWidth={1} />
          </Group>
        );

      case 'wardrobe':
        return (
          <Group key={fixture.id}>
            <Rect x={x} y={y} width={120} height={60} fill="#f5f5f5" stroke="#1a1a1a" strokeWidth={1.5} />
            <Line points={[x+60, y, x+60, y+60]} stroke="#1a1a1a" strokeWidth={1} />
          </Group>
        );

      case 'sofa': {
        const sw = 200, sh = 90;
        return (
          <Group key={fixture.id}>
            {/* Back rest */}
            <Rect x={x} y={y} width={sw} height={sh * 0.22} fill="#d0d0d0" stroke="#1a1a1a" strokeWidth={1.5} />
            {/* 3 cushions */}
            {[0, 1, 2].map(i => (
              <Rect key={i} x={x + i * (sw / 3)} y={y + sh * 0.22} width={sw / 3 - 2} height={sh * 0.78} fill="#e8e8e8" stroke="#1a1a1a" strokeWidth={1} />
            ))}
            {/* Armrests */}
            <Rect x={x} y={y + sh * 0.22} width={8} height={sh * 0.78} fill="#c0c0c0" stroke="#1a1a1a" strokeWidth={0.5} />
            <Rect x={x + sw - 8} y={y + sh * 0.22} width={8} height={sh * 0.78} fill="#c0c0c0" stroke="#1a1a1a" strokeWidth={0.5} />
          </Group>
        );
      }

      case 'tv_unit':
        return (
          <Group key={fixture.id}>
            <Rect x={x} y={y} width={150} height={45} fill="#f5f5f5" stroke="#1a1a1a" strokeWidth={1.5} />
            <Rect x={x+35} y={y-8} width={80} height={5} fill="#1a1a1a" />
          </Group>
        );

      case 'bookshelf':
        return (
          <Group key={fixture.id}>
            <Rect x={x} y={y} width={80} height={30} fill="#f5f5f5" stroke="#1a1a1a" strokeWidth={1.5} />
            <Line points={[x+20, y, x+20, y+30]} stroke="#1a1a1a" strokeWidth={0.5} />
            <Line points={[x+40, y, x+40, y+30]} stroke="#1a1a1a" strokeWidth={0.5} />
            <Line points={[x+60, y, x+60, y+30]} stroke="#1a1a1a" strokeWidth={0.5} />
          </Group>
        );

      default:
        return (
          <Group key={fixture.id}>
            <Rect x={x} y={y} width={50} height={50} fill="#f0f0f0" stroke="#1a1a1a" strokeWidth={1} />
            <Text x={x+5} y={y+18} text={type} fontSize={9} fill="#555" />
          </Group>
        );
    }
  };

  const renderPipe = (pipe: Pipe) => {
    const points = pipe.path.flatMap(p => [p.x + CANVAS_PADDING, p.y + CANVAS_PADDING]);
    const isDrain = pipe.type === 'drain';
    const isCold = pipe.type === 'cold';
    
    return (
      <Line
        key={pipe.id}
        points={points}
        stroke={isCold ? '#3b82f6' : isDrain ? '#64748b' : '#ef4444'}
        strokeWidth={isDrain ? 1.5 : 2}
        dash={isDrain ? [4, 4] : undefined}
        opacity={isDrain ? 0.7 : 0.9}
      />
    );
  };

  const renderDoor = (door: DoorSpec, walls: Wall[]) => {
    const wall = walls.find(w => w.side === door.wall);
    if (!wall) return null;

    const doorWidth = (door.width || 0.9) * 100;
    const WALL_T = 15;
    const P = CANVAS_PADDING;

    // Room bounds
    const roomW = roomWidth + P;
    const roomH = roomHeight + P;

    // Door center on wall midpoint
    const midX = (wall.start.x + wall.end.x) / 2 + P;
    const midY = (wall.start.y + wall.end.y) / 2 + P;
    const halfDoor = doorWidth / 2;

    let openingPoints: number[] = [];
    let arcX = 0, arcY = 0, arcRotation = 0;

    if (wall.side === 'north') {
      const dx = midX - halfDoor;
      openingPoints = [dx, P, dx + doorWidth, P + WALL_T];
      arcX = dx;
      arcY = P + WALL_T;
      arcRotation = -90;
    } else if (wall.side === 'south') {
      const dx = midX - halfDoor;
      openingPoints = [dx, roomH - WALL_T, dx + doorWidth, roomH];
      arcX = dx;
      arcY = roomH - WALL_T;
      arcRotation = 0;
    } else if (wall.side === 'east') {
      const dy = midY - halfDoor;
      openingPoints = [roomW - WALL_T, dy, roomW, dy + doorWidth];
      arcX = roomW - WALL_T;
      arcY = dy + doorWidth;
      arcRotation = 180;
    } else {
      // west
      const dy = midY - halfDoor;
      openingPoints = [P, dy, P + WALL_T, dy + doorWidth];
      arcX = P + WALL_T;
      arcY = dy + doorWidth;
      arcRotation = 180;
    }

    return (
      <Group key={door.id}>
        {/* Wall opening */}
        <Rect
          x={openingPoints[0]}
          y={openingPoints[1]}
          width={openingPoints[2] - openingPoints[0]}
          height={openingPoints[3] - openingPoints[1]}
          fill="white"
          stroke="none"
          clipX={wall.side === 'east' ? roomW - WALL_T : undefined}
          clipY={wall.side === 'east' ? openingPoints[1] : undefined}
          clipWidth={wall.side === 'east' ? WALL_T + 2 : undefined}
          clipHeight={wall.side === 'east' ? doorWidth : undefined}
        />
        {/* Door leaf */}
        <Line
          points={
            wall.side === 'north' || wall.side === 'south'
              ? [arcX, arcY, arcX + doorWidth, arcY]
              : wall.side === 'east'
                ? [arcX, arcY, arcX, arcY - doorWidth]
                : [arcX, arcY, arcX, arcY + doorWidth]
          }
          stroke="#1a1a1a"
          strokeWidth={1.5}
          clipX={wall.side === 'east' ? roomW - WALL_T - 1 : undefined}
          clipY={wall.side === 'east' ? arcY - doorWidth - 1 : undefined}
          clipWidth={wall.side === 'east' ? WALL_T + 2 : undefined}
          clipHeight={wall.side === 'east' ? doorWidth + 2 : undefined}
        />
        {/* Swing arc */}
        <Arc
          x={arcX}
          y={arcY}
          innerRadius={0}
          outerRadius={wall.side === 'east' ? doorWidth * 0.85 : doorWidth}
          angle={90}
          rotation={arcRotation}
          stroke="#1a1a1a"
          strokeWidth={1}
          clipX={wall.side === 'east' ? roomWidth + CANVAS_PADDING - WALL_T - doorWidth : undefined}
          clipY={wall.side === 'east' ? arcY - doorWidth : undefined}
          clipWidth={wall.side === 'east' ? doorWidth + WALL_T : undefined}
          clipHeight={wall.side === 'east' ? doorWidth * 2 : undefined}
        />
      </Group>
    );
  };

  const renderDimension = (dim: DimensionLine) => {
    const startX = dim.start.x + CANVAS_PADDING;
    const startY = dim.start.y + CANVAS_PADDING;
    const endX = dim.end.x + CANVAS_PADDING;
    const endY = dim.end.y + CANVAS_PADDING;
    
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const offset = -30; // Place dimensions outside room (negative = outside)

    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / length;
    const ny = dx / length;

    const arrowStart = {
      x: startX + nx * offset,
      y: startY + ny * offset
    };
    const arrowEnd = {
      x: endX + nx * offset,
      y: endY + ny * offset
    };

    return (
      <Group key={dim.id}>
        <Arrow
          points={[arrowStart.x, arrowStart.y, arrowEnd.x, arrowEnd.y]}
          stroke="#1a1a1a"
          strokeWidth={1}
          pointerLength={8}
          pointerWidth={8}
          pointerAtBeginning
        />
        <Text
          x={midX + nx * offset - 20}
          y={midY + ny * offset - 15}
          text={dim.label}
          fontSize={12}
          fill="#1a1a1a"
        />
      </Group>
    );
  };

  const renderTitleBlock = () => {
    const blockX = totalWidth + CANVAS_PADDING - 220;
    const blockY = totalHeight + CANVAS_PADDING + 20;
    const date = new Date().toLocaleDateString('uz-UZ');

    return (
      <Group>
        <Rect x={blockX} y={blockY} width={200} height={70} stroke="#1a1a1a" strokeWidth={1} fill="white" />
        <Text x={blockX + 8} y={blockY + 8}  text="Floor Plan" fontSize={12} fontFamily="monospace" fontStyle="bold" />
        <Text x={blockX + 8} y={blockY + 24} text="Masshtab: 1:50" fontSize={10} fontFamily="monospace" />
        <Text x={blockX + 8} y={blockY + 38} text={`Sana: ${date}`} fontSize={10} fontFamily="monospace" />
        <Text x={blockX + 8} y={blockY + 52} text="SNiP 2.04.01-85" fontSize={10} fontFamily="monospace" fill="#555" />
      </Group>
    );
  };

  const renderLegend = () => {
    const lx = CANVAS_PADDING;
    const ly = totalHeight + CANVAS_PADDING + 20;

    return (
      <Group>
        <Line points={[lx, ly + 8, lx + 30, ly + 8]} stroke="#3b82f6" strokeWidth={2} opacity={0.8} />
        <Text x={lx + 36} y={ly} text="Sovuq suv (H)" fontSize={10} fontFamily="monospace" />
        <Line points={[lx, ly + 24, lx + 30, ly + 24]} stroke="#ef4444" strokeWidth={2} opacity={0.8} />
        <Text x={lx + 36} y={ly + 16} text="Issiq suv (I)" fontSize={10} fontFamily="monospace" />
        <Line points={[lx, ly + 40, lx + 30, ly + 40]} stroke="#64748b" strokeWidth={1.5} dash={[4, 4]} opacity={0.6} />
        <Text x={lx + 36} y={ly + 32} text="Kanalizatsiya (K)" fontSize={10} fontFamily="monospace" />
      </Group>
    );
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <Stage width={width} height={height} scaleX={autoScale} scaleY={autoScale}>
        <Layer>
          {/* 1. Room background */}
          <Rect
            x={CANVAS_PADDING}
            y={CANVAS_PADDING}
            width={totalWidth}
            height={totalHeight}
            fill="white"
            stroke="none"
          />
          {/* 2. Grid */}
          {renderGrid()}
          {/* 3. ALL pipes BEFORE walls (walls cover pipe ends inside wall) */}
          {(() => {
            const allPipes = drawingData.pipes ?? [];
            console.log('[PIPES ALL]', allPipes.length, allPipes.map(p => ({ type: p.type, path: p.path })));
            return allPipes.map(renderPipe);
          })()}
          {/* 4. Walls (covers pipe ends inside wall thickness) */}
          {drawingData.walls.map(renderWall)}
          {/* 5. Doors */}
          {drawingData.doors?.map(door => renderDoor(door, drawingData.walls))}
          {/* 6. Fixtures (covers drain pipe start) */}
          {drawingData.fixtures.map(renderFixture)}
          {/* 7. Dimensions */}
          {drawingData.dimensions.map(renderDimension)}
          {/* 8. Title block + Legend */}
          {renderTitleBlock()}
          {renderLegend()}
        </Layer>
      </Stage>
    </div>
  );
}
