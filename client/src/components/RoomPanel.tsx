import type { BuildingFloor } from '../../../shared/types';

const ROOM_ICONS: Record<string, string> = {
  bathroom: '🚿', hammom: '🚿',
  kitchen: '🍳',  oshxona: '🍳',
  bedroom: '🛏',  yotoqxona: '🛏',
  living: '🛋',   mehmonxona: '🛋', zal: '🛋',
  office: '💻',   ofis: '💻',
  hallway: '🚶',  koridor: '🚶',
  toilet: '🚽',   hojatxona: '🚽',
  staircase: '🪜', zinapoya: '🪜',
};

function roomIcon(name: string): string {
  const n = name.toLowerCase();
  for (const [k, v] of Object.entries(ROOM_ICONS)) {
    if (n.includes(k)) return v;
  }
  return '📐';
}

interface RoomPanelProps {
  floor: BuildingFloor;
}

export default function RoomPanel({ floor }: RoomPanelProps) {
  const rooms = floor.rooms;
  const totalArea = rooms.reduce((s, r) => s + r.roomSpec.width * r.roomSpec.length, 0);

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">
        {floor.label} — {rooms.length} xona ({totalArea.toFixed(1)} m²)
      </div>
      <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
        {rooms.map(room => {
          const area = (room.roomSpec.width * room.roomSpec.length).toFixed(1);
          const icon = roomIcon(room.roomSpec.name);
          const fixtureCount = room.roomSpec.fixtures.length;
          return (
            <div
              key={room.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 cursor-default transition-colors"
            >
              <span className="text-base leading-none">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white truncate">
                  {room.roomSpec.name.charAt(0).toUpperCase() + room.roomSpec.name.slice(1)}
                </div>
                <div className="text-[10px] text-slate-400">
                  {room.roomSpec.width}×{room.roomSpec.length}m · {area}m²
                  {fixtureCount > 0 && ` · ${fixtureCount} jihoz`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
