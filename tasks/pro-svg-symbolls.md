Replace all canvas-drawn symbols with these professional SVG components.
Create /client/src/components/symbols/ folder with these files:

1. ToiletSymbol.tsx — oval tank + D-shaped bowl + inner oval
2. SinkSymbol.tsx — rect shell + rect basin + drain circle + two faucets  
3. BathtubSymbol.tsx — rounded rect + inner rounded rect + drain + faucet circle
4. ShowerSymbol.tsx — square tray + cross drain + dots (shower head)
5. DoorSymbol.tsx — wall opening + door leaf line + quarter-circle arc (swing)
6. WindowSymbol.tsx — wall section + triple line + blue tint rect
7. ValveSymbol.tsx — two opposing triangles meeting at center + stem line + handle
8. ManifoldSymbol.tsx — horizontal rect (amber) + 3 inlet circles (red) + 3 outlet circles (blue/gray)

Each component props:
  interface SymbolProps {
    x: number;
    y: number; 
    rotation?: number; // 0, 90, 180, 270
    scale?: number;    // default 1
    wall?: 'north'|'south'|'east'|'west';
  }

Base size: 60x60 units
Stroke: 1.5px, color: #1a1a1a
Fill: #f5f5f5 (fixtures), transparent (pipes)
Colors: cold=#3b82f6, hot=#ef4444, drain=#64748b, electrical=#fbbf24

In Canvas2D.tsx, replace all existing shape drawing code 
with these symbol components.