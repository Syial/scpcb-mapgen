import type { BlitzRng } from "../rng/blitz_rng";
import type { PlacedRoom } from "./placement";
import { ROOM1, ROOM2, ROOM2C, ROOM3 } from "./rooms";

// Portes (CreateMap 7648-7734) + RNG de CreateDoor (Main.bb).
// CreateDoor : d\open = dopen ; If d\open And big=False And Rand(8)=1 Then AutoClose
// Blitz n'a théoriquement pas de short-circuit ; on tire Rand(8) toujours (fidèle).

export interface Door {
  x: number; z: number; angle: number;
  from: [number, number];
  to: [number, number];
  open: number;
}

/** I_Zone\Transition fixe dans CreateMap : [0]=13, [1]=7 */
function doorBig(y: number): number {
  // y < Transition[1]-1 → zone 3 ; elif y < Transition[0]-1 → zone 2 ; else zone 1
  // zone 2 → big=2, sinon big=0
  if (y < 6) return 0; // zone 3
  if (y < 12) return 2; // zone 2
  return 0; // zone 1
}

function wrapAngle(angle: number): number {
  let a = angle;
  while (a < 0) a += 360;
  while (a >= 360) a -= 360;
  return a;
}

export function createDoors(
  grid: number[][],
  rooms: PlacedRoom[],
  mapWidth: number,
  mapHeight: number,
  rng: BlitzRng,
): Door[] {
  const spacing = 8;
  const doors: Door[] = [];

  for (let y = mapHeight; y >= 0; y--) {
    for (let x = mapWidth; x >= 0; x--) {
      if (!(grid[x]?.[y] > 0)) continue;

      let r: PlacedRoom | undefined;
      for (const cand of rooms) {
        if (cand.gx === x && cand.gy === y) {
          r = cand;
          break;
        }
      }
      if (!r) continue;

      const angle = wrapAngle(r.angle ?? 0);
      const big = doorBig(y);

      const pushDoor = (east: boolean) => {
        let should = false;
        if (east) {
          switch (r!.shape) {
            case ROOM1: should = angle === 90; break;
            case ROOM2: should = angle === 90 || angle === 270; break;
            case ROOM2C: should = angle === 0 || angle === 90; break;
            case ROOM3: should = angle === 0 || angle === 180 || angle === 90; break;
            default: should = true;
          }
          if (!(should && x + 1 < mapWidth + 1 && grid[x + 1][y] > 0)) return;
        } else {
          switch (r!.shape) {
            case ROOM1: should = angle === 180; break;
            case ROOM2: should = angle === 0 || angle === 180; break;
            case ROOM2C: should = angle === 180 || angle === 90; break;
            case ROOM3: should = angle === 180 || angle === 90 || angle === 270; break;
            default: should = true;
          }
          if (!(should && y + 1 < mapHeight + 1 && grid[x][y + 1] > 0)) return;
        }

        const open = Math.max(rng.randInt(-3, 1), 0);
        // Pas de short-circuit Blitz : Rand(8) toujours
        rng.randInt(8);
        void big;
        doors.push({
          x: east ? x * spacing + spacing / 2 : x * spacing,
          z: east ? y * spacing : y * spacing + spacing / 2,
          angle: east ? 90 : 0,
          from: [x, y],
          to: east ? [x + 1, y] : [x, y + 1],
          open,
        });
      };

      pushDoor(true);
      pushDoor(false);
    }
  }

  return doors;
}
