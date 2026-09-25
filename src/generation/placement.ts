import type { RoomsResult } from "./rooms";
import { ROOM1, ROOM2, ROOM2C, ROOM3, ROOM4 } from "./rooms";
import type { RoomItem } from "./filler";
import roomDoors from "./room_doors.json";

// Boucle de création (7455-7584) : place les salles, noms depuis MapRoom[type][rang] ; génériques résolus plus tard par identifyGenericRooms.

const idiv = (a: number, b: number) => Math.trunc(a / b);
const clamp1 = (v: number) => Math.min(v, 1);

/** Porte FillRoom avec keycard / code (pas les couloirs CreateMap). */
export interface RoomDoorMeta {
  /** >0 niveau keycard ; -1 scanner main ; -2 scanner main noire */
  keycard?: number;
  /** code fixe, "AccessCode", ou "TunnelsCode" */
  code?: string;
}

const DOORS = roomDoors as Record<string, RoomDoorMeta[]>;

export function doorsForRoom(name: string): RoomDoorMeta[] | undefined {
  const d = DOORS[name];
  return d?.length ? d : undefined;
}

export interface PlacedRoom {
  gx: number; gy: number;   // case de grille
  x: number; z: number;     // position monde (× 8)
  shape: number;            // ROOM1..ROOM4
  zone: number;             // 0 (spéciale) ou 1/2/3
  name: string;             // "" = salle générique anonyme
  angle: number | null;     // null = ROOM2 droit (flip cosmétique non déterminé)
  /** event assignée par InitEvents (au plus une par salle) */
  event?: string;
  /** items créés par FillRoom (ou inventaire start sans intro) */
  items?: RoomItem[];
  /** portes à code / keycard de la salle (catalogue FillRoom) */
  doorMeta?: RoomDoorMeta[];
}

export function placeRooms(
  rooms: RoomsResult,
  mapWidth: number,
  mapHeight: number,
  introEnabled = true,
  onPlace?: (placed: PlacedRoom[]) => void,
): PlacedRoom[] {
  const M = rooms.grid;
  const MapRoom = rooms.mapRoom;
  const MaxRooms = rooms.maxRooms;
  const SPACING = 8; // RoomSpacing du jeu : 1 case de grille = 8 unités monde

  // MapRoomID (7041) : compteur courant par forme
  const id = [0, 0, 0, 0, 0, 0]; // indices ROOM1..ROOM4
  const placed: PlacedRoom[] = [];
  const emit = () => onPlace?.(placed);

  const nameFor = (type: number): string => {
    // If MapRoomID(type) < MaxRooms And MapName="" Then If MapRoom(type,id)<>"" ...
    if (id[type] < MaxRooms && MapRoom[type][id[type]]) return MapRoom[type][id[type]];
    return "";
  };

  for (let y = mapHeight - 1; y >= 1; y--) {
    let zone: number;
    if (y < idiv(mapHeight, 3) + 1) zone = 3;
    else if (y < mapHeight * (2.0 / 3.0)) zone = 2;
    else zone = 1;

    for (let x = 1; x <= mapWidth - 2; x++) {
      if (M[x][y] === 255) {
        // checkpoint (n'incrémente PAS MapRoomID)
        const name = y > idiv(mapHeight, 2) ? "checkpoint1" : "checkpoint2";
        placed.push({ gx: x, gy: y, x: x * SPACING, z: y * SPACING, shape: ROOM2, zone, name, angle: 0 });
        emit();
      } else if (M[x][y] > 0) {
        const temp = clamp1(M[x + 1][y]) + clamp1(M[x - 1][y]) + clamp1(M[x][y + 1]) + clamp1(M[x][y - 1]);

        switch (temp) {
          case 1: { // ROOM1
            const name = nameFor(ROOM1);
            let angle = 0;
            if (M[x][y + 1]) angle = 180;
            else if (M[x - 1][y]) angle = 270;
            else if (M[x + 1][y]) angle = 90;
            placed.push({ gx: x, gy: y, x: x * SPACING, z: y * SPACING, shape: ROOM1, zone, name, angle });
            id[ROOM1]++;
            emit();
            break;
          }
          case 2: {
            if (M[x - 1][y] > 0 && M[x + 1][y] > 0) {
              // ROOM2 horizontal : angle 90/270 (Rand, cosmétique) → null
              const name = nameFor(ROOM2);
              placed.push({ gx: x, gy: y, x: x * SPACING, z: y * SPACING, shape: ROOM2, zone, name, angle: null });
              id[ROOM2]++;
              emit();
            } else if (M[x][y - 1] > 0 && M[x][y + 1] > 0) {
              // ROOM2 vertical : angle 180/0 (Rand, cosmétique) → null
              const name = nameFor(ROOM2);
              placed.push({ gx: x, gy: y, x: x * SPACING, z: y * SPACING, shape: ROOM2, zone, name, angle: null });
              id[ROOM2]++;
              emit();
            } else {
              // ROOM2C (angle déterministe)
              const name = nameFor(ROOM2C);
              let angle = 0;
              if (M[x - 1][y] > 0 && M[x][y + 1] > 0) angle = 180;
              else if (M[x + 1][y] > 0 && M[x][y + 1] > 0) angle = 90;
              else if (M[x - 1][y] > 0 && M[x][y - 1] > 0) angle = 270;
              placed.push({ gx: x, gy: y, x: x * SPACING, z: y * SPACING, shape: ROOM2C, zone, name, angle });
              id[ROOM2C]++;
              emit();
            }
            break;
          }
          case 3: { // ROOM3
            const name = nameFor(ROOM3);
            let angle = 0;
            if (!M[x][y - 1]) angle = 180;
            else if (!M[x - 1][y]) angle = 90;
            else if (!M[x + 1][y]) angle = 270;
            placed.push({ gx: x, gy: y, x: x * SPACING, z: y * SPACING, shape: ROOM3, zone, name, angle });
            id[ROOM3]++;
            emit();
            break;
          }
          case 4: { // ROOM4 (angle 0)
            const name = nameFor(ROOM4);
            placed.push({ gx: x, gy: y, x: x * SPACING, z: y * SPACING, shape: ROOM4, zone, name, angle: 0 });
            id[ROOM4]++;
            emit();
            break;
          }
        }
      }
    }
  }

  // salles spéciales hors grille (7572-7584), zone 0
  placed.push({ gx: mapWidth - 1, gy: 1, x: (mapWidth - 1) * SPACING, z: SPACING, shape: ROOM1, zone: 0, name: "gatea", angle: 0 });
  id[ROOM1]++;
  emit();
  placed.push({ gx: mapWidth - 1, gy: mapHeight - 1, x: (mapWidth - 1) * SPACING, z: (mapHeight - 1) * SPACING, shape: ROOM1, zone: 0, name: "pocketdimension", angle: 0 });
  id[ROOM1]++;
  emit();
  if (introEnabled) {
    placed.push({ gx: 1, gy: mapHeight - 1, x: 8, z: (mapHeight - 1) * 8, shape: ROOM1, zone: 0, name: "173", angle: 0 });
    id[ROOM1]++;
    emit();
  }
  placed.push({ gx: 1, gy: 0, x: 8, z: 0, shape: ROOM1, zone: 0, name: "dimension1499", angle: 0 });
  id[ROOM1]++;
  emit();

  return placed;
}
