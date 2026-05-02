import type { Building, BuildingFloor, DrawingData } from '../../../shared/types';

interface FloorNavigatorProps {
  building: Building;
  floorDrawings: DrawingData[];
  currentFloor: number;        // 1-based
  onFloorChange: (floorNumber: number) => void;
}

export default function FloorNavigator({
  building, floorDrawings, currentFloor, onFloorChange,
}: FloorNavigatorProps) {
  const totalRooms = building.floors.reduce((s, f) => s + f.rooms.length, 0);
  const totalArea  = building.floors
    .flatMap(f => f.rooms)
    .reduce((s, r) => s + r.roomSpec.width * r.roomSpec.length, 0);

  return (
    <div className="flex flex-col gap-2">
      {/* Building stats strip */}
      <div className="flex items-center gap-4 px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg">
        <span className="font-semibold text-white">🏢 {building.name || 'Bino'}</span>
        <span>{building.floors.length} qavat</span>
        <span>{totalRooms} xona</span>
        <span>{totalArea.toFixed(0)} m²</span>
        {building.footprint && (
          <span className="text-slate-400">
            {building.footprint.width.toFixed(1)}×{building.footprint.length.toFixed(1)} m
          </span>
        )}
      </div>

      {/* Floor tabs */}
      <div className="flex gap-1 flex-wrap">
        {building.floors.map(floor => {
          const active = floor.floorNumber === currentFloor;
          const dd = floorDrawings[floor.floorNumber - 1];
          const roomCount = floor.rooms.length;
          const elev = floor.elevation >= 0
            ? `+${floor.elevation.toFixed(1)}`
            : floor.elevation.toFixed(1);

          return (
            <button
              key={floor.floorNumber}
              onClick={() => onFloorChange(floor.floorNumber)}
              className={`
                flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium
                transition-all duration-150 border
                ${active
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                  : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'}
              `}
            >
              <span className="font-semibold">{floor.label}</span>
              <span className={`text-[10px] ${active ? 'text-blue-200' : 'text-slate-400'}`}>
                {elev}m · {roomCount} xona
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
