Fix renderDoor() for east wall only. Replace the east wall section:

CURRENT (wrong):
  } else if (wall.side === 'east') {
    const dy = midY - halfDoor;
    openingPoints = [roomW - WALL_T, dy, roomW, dy + doorWidth];
    arcX = roomW - WALL_T;
    arcY = dy;
    arcRotation = 0;
  }

REPLACE WITH:
  } else if (wall.side === 'east') {
    const dy = midY - halfDoor;
    openingPoints = [roomW - WALL_T, dy, roomW, dy + doorWidth];
    arcX = roomW - WALL_T;
    arcY = dy + doorWidth;
    arcRotation = 180;
  }

Also fix the door leaf line for east wall inside the Line component:
CURRENT:
  wall.side === 'north' || wall.side === 'south'
    ? [arcX, arcY, arcX + doorWidth, arcY]
    : [arcX, arcY, arcX, arcY + doorWidth]

REPLACE WITH:
  wall.side === 'north' || wall.side === 'south'
    ? [arcX, arcY, arcX + doorWidth, arcY]
    : wall.side === 'east'
      ? [arcX, arcY, arcX, arcY - doorWidth]
      : [arcX, arcY, arcX, arcY + doorWidth]

Only these 2 changes. Run npm test after.