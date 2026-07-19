import { BlitzRng } from "../rng/blitz_rng";
import type { CarveResult } from "./carving";

// Types, forçages et salles nommées (CreateMap 7116-7453) : grille → codes 1..4 + MapRoom[type][pos]. Un seul tirage (room3storage).

export const ROOM1 = 1, ROOM2 = 2, ROOM2C = 3, ROOM3 = 4, ROOM4 = 5;
const ZONEAMOUNT = 3;

function getZone(y: number, mapWidth: number): number {
  const v = Math.fround(Math.fround(Math.fround(mapWidth - y) / mapWidth) * ZONEAMOUNT);
  return Math.min(Math.floor(v), ZONEAMOUNT - 1);
}
const clamp1 = (v: number) => Math.min(v, 1); // Min(x,1) de Blitz
const idiv = (a: number, b: number) => Math.trunc(a / b);

export interface RoomsResult {
  grid: number[][];
  room1: number[]; room2: number[]; room2c: number[]; room3: number[]; room4: number[];
  mapRoom: string[][];
  maxRooms: number;
}

export function assignRooms(rng: BlitzRng, carve: CarveResult): RoomsResult {
  const M = carve.grid;
  const MapWidth = carve.mapWidth, MapHeight = carve.mapHeight;

  const room1 = [0, 0, 0, 0], room2 = [0, 0, 0, 0];
  const room2c = [0, 0, 0, 0], room3 = [0, 0, 0, 0], room4 = [0, 0, 0, 0];

  // comptage (7120-7146)
  for (let y = 1; y <= MapHeight - 1; y++) {
    const zone = getZone(y, MapWidth);
    for (let x = 1; x <= MapWidth - 1; x++) {
      if (M[x][y] > 0) {
        let t = clamp1(M[x + 1][y]) + clamp1(M[x - 1][y]);
        t = t + clamp1(M[x][y + 1]) + clamp1(M[x][y - 1]);
        if (M[x][y] < 255) M[x][y] = t;
        switch (M[x][y]) {
          case 1: room1[zone]++; break;
          case 2:
            if (clamp1(M[x + 1][y]) + clamp1(M[x - 1][y]) === 2) room2[zone]++;
            else if (clamp1(M[x][y + 1]) + clamp1(M[x][y - 1]) === 2) room2[zone]++;
            else room2c[zone]++;
            break;
          case 3: room3[zone]++; break;
          case 4: room4[zone]++; break;
        }
      }
    }
  }

  // forçage de ROOM1 supplémentaires si < 5 (7148-7209)
  for (let i = 0; i <= 2; i++) {
    let need = -room1[i] + 5;
    if (need > 0) {
      const mhza = idiv(MapHeight, ZONEAMOUNT);
      const yStart = mhza * (2 - i) + 1;
      const yEnd = mhza * ((2 - i) + 1.0) - 2;
      let done = false;
      for (let y = yStart; y <= yEnd && !done; y++) {
        for (let x = 2; x <= MapWidth - 2; x++) {
          if (M[x][y] === 0) {
            if (clamp1(M[x + 1][y]) + clamp1(M[x - 1][y]) + clamp1(M[x][y + 1]) + clamp1(M[x][y - 1]) === 1) {
              let x2 = 0, y2 = 0;
              if (M[x + 1][y]) { x2 = x + 1; y2 = y; }
              else if (M[x - 1][y]) { x2 = x - 1; y2 = y; }
              else if (M[x][y + 1]) { x2 = x; y2 = y + 1; }
              else if (M[x][y - 1]) { x2 = x; y2 = y - 1; }

              let placed = false;
              if (M[x2][y2] > 1 && M[x2][y2] < 4) {
                switch (M[x2][y2]) {
                  case 2:
                    if (clamp1(M[x2 + 1][y2]) + clamp1(M[x2 - 1][y2]) === 2) { room2[i]--; room3[i]++; placed = true; }
                    else if (clamp1(M[x2][y2 + 1]) + clamp1(M[x2][y2 - 1]) === 2) { room2[i]--; room3[i]++; placed = true; }
                    break;
                  case 3:
                    room3[i]--; room4[i]++; placed = true;
                    break;
                }
                if (placed) {
                  M[x2][y2]++;
                  M[x][y] = 1;
                  room1[i]++;
                  need--;
                }
              }
            }
          }
          if (need === 0) { done = true; break; }
        }
      }
    }
  }

  // forçage d'au moins 1 ROOM4 et 1 ROOM2C par zone (7215-7356)
  for (let i = 0; i <= 2; i++) {
    let zoneStart: number, temp2: number;
    switch (i) {
      case 2: zoneStart = 2; temp2 = idiv(MapHeight, 3); break;
      case 1: zoneStart = idiv(MapHeight, 3) + 1; temp2 = MapHeight * (2.0 / 3.0) - 1; break;
      default: zoneStart = MapHeight * (2.0 / 3.0) + 1; temp2 = MapHeight - 2; break;
    }

    // ROOM4 (7230-7265)
    if (room4[i] < 1) {
      let temp = 0, done = false;
      for (let y = zoneStart; y <= temp2 && !done; y++) {
        for (let x = 2; x <= MapWidth - 2; x++) {
          if (M[x][y] === 3) {
            // Select 0 : première direction dont les cases cibles sont toutes vides
            if ((M[x + 1][y] | M[x + 1][y + 1] | M[x + 1][y - 1] | M[x + 2][y]) === 0) { M[x + 1][y] = 1; temp = 1; }
            else if ((M[x - 1][y] | M[x - 1][y + 1] | M[x - 1][y - 1] | M[x - 2][y]) === 0) { M[x - 1][y] = 1; temp = 1; }
            else if ((M[x][y + 1] | M[x + 1][y + 1] | M[x - 1][y + 1] | M[x][y + 2]) === 0) { M[x][y + 1] = 1; temp = 1; }
            else if ((M[x][y - 1] | M[x + 1][y - 1] | M[x - 1][y - 1] | M[x][y - 2]) === 0) { M[x][y - 1] = 1; temp = 1; }
            if (temp === 1) {
              M[x][y] = 4;
              room4[i]++; room3[i]--; room1[i]++;
            }
          }
          if (temp === 1) { done = true; break; }
        }
      }
    }

    // ROOM2C (7267-7354)
    if (room2c[i] < 1) {
      let temp = 0, done = false;
      const zStart = zoneStart + 1;
      const zEnd = temp2 - 1;
      for (let y = zStart; y <= zEnd && !done; y++) {
        for (let x = 3; x <= MapWidth - 3; x++) {
          if (M[x][y] === 1) {
            // Select True : première branche vraie
            if (M[x - 1][y] > 0) {
              if ((M[x][y - 1] + M[x][y + 1] + M[x + 2][y]) === 0) {
                if ((M[x + 1][y - 2] + M[x + 2][y - 1] + M[x + 1][y - 1]) === 0) {
                  M[x][y] = 2; M[x + 1][y] = 2; M[x + 1][y - 1] = 1; temp = 1;
                } else if ((M[x + 1][y + 2] + M[x + 2][y + 1] + M[x + 1][y + 1]) === 0) {
                  M[x][y] = 2; M[x + 1][y] = 2; M[x + 1][y + 1] = 1; temp = 1;
                }
              }
            } else if (M[x + 1][y] > 0) {
              if ((M[x][y - 1] + M[x][y + 1] + M[x - 2][y]) === 0) {
                if ((M[x - 1][y - 2] + M[x - 2][y - 1] + M[x - 1][y - 1]) === 0) {
                  M[x][y] = 2; M[x - 1][y] = 2; M[x - 1][y - 1] = 1; temp = 1;
                } else if ((M[x - 1][y + 2] + M[x - 2][y + 1] + M[x - 1][y + 1]) === 0) {
                  M[x][y] = 2; M[x - 1][y] = 2; M[x - 1][y + 1] = 1; temp = 1;
                }
              }
            } else if (M[x][y - 1] > 0) {
              if ((M[x - 1][y] + M[x + 1][y] + M[x][y + 2]) === 0) {
                if ((M[x - 2][y + 1] + M[x - 1][y + 2] + M[x - 1][y + 1]) === 0) {
                  M[x][y] = 2; M[x][y + 1] = 2; M[x - 1][y + 1] = 1; temp = 1;
                } else if ((M[x + 2][y + 1] + M[x + 1][y + 2] + M[x + 1][y + 1]) === 0) {
                  M[x][y] = 2; M[x][y + 1] = 2; M[x + 1][y + 1] = 1; temp = 1;
                }
              }
            } else if (M[x][y + 1] > 0) {
              if ((M[x - 1][y] + M[x + 1][y] + M[x][y - 2]) === 0) {
                if ((M[x - 2][y - 1] + M[x - 1][y - 2] + M[x - 1][y - 1]) === 0) {
                  M[x][y] = 2; M[x][y - 1] = 2; M[x - 1][y - 1] = 1; temp = 1;
                } else if ((M[x + 2][y - 1] + M[x + 1][y - 2] + M[x + 1][y - 1]) === 0) {
                  M[x][y] = 2; M[x][y - 1] = 2; M[x + 1][y - 1] = 1; temp = 1;
                }
              }
            }
            if (temp === 1) { room2c[i]++; room2[i]++; }
          }
          if (temp === 1) { done = true; break; }
        }
      }
    }
  }

  // MaxRooms + allocation de MapRoom (7358-7364)
  let maxRooms = idiv(55 * MapWidth, 20);
  maxRooms = Math.max(maxRooms, room1[0] + room1[1] + room1[2] + 1);
  maxRooms = Math.max(maxRooms, room2[0] + room2[1] + room2[2] + 1);
  maxRooms = Math.max(maxRooms, room2c[0] + room2c[1] + room2c[2] + 1);
  maxRooms = Math.max(maxRooms, room3[0] + room3[1] + room3[2] + 1);
  maxRooms = Math.max(maxRooms, room4[0] + room4[1] + room4[2] + 1);

  const mapRoom: string[][] = [];
  for (let t = 0; t <= ROOM4 + 1; t++) mapRoom.push(new Array(maxRooms + 1).fill(""));

  // SetRoom (7771-7800) : sondage linéaire déterministe, sans écraser
  const setRoom = (name: string, type: number, pos: number, minPos: number, maxPos: number): void => {
    if (maxPos < minPos) return;
    let looped = false;
    while (mapRoom[type][pos] !== "") {
      pos++;
      if (pos > maxPos) {
        if (!looped) { pos = minPos + 1; looped = true; }
        else return;
      }
    }
    mapRoom[type][pos] = name;
  };
  const floor = Math.floor;

  // zone 1 (7367-7398)
  let minPos = 1, maxPos = room1[0] - 1;
  mapRoom[ROOM1][0] = "start";
  setRoom("roompj", ROOM1, floor(0.1 * room1[0]), minPos, maxPos);
  setRoom("914", ROOM1, floor(0.3 * room1[0]), minPos, maxPos);
  setRoom("room1archive", ROOM1, floor(0.5 * room1[0]), minPos, maxPos);
  setRoom("room205", ROOM1, floor(0.6 * room1[0]), minPos, maxPos);

  mapRoom[ROOM2C][0] = "lockroom";

  minPos = 1; maxPos = room2[0] - 1;
  mapRoom[ROOM2][0] = "room2closets";
  setRoom("room2testroom2", ROOM2, floor(0.1 * room2[0]), minPos, maxPos);
  setRoom("room2scps", ROOM2, floor(0.2 * room2[0]), minPos, maxPos);
  setRoom("room2storage", ROOM2, floor(0.3 * room2[0]), minPos, maxPos);
  setRoom("room2gw_b", ROOM2, floor(0.4 * room2[0]), minPos, maxPos);
  setRoom("room2sl", ROOM2, floor(0.5 * room2[0]), minPos, maxPos);
  setRoom("room012", ROOM2, floor(0.55 * room2[0]), minPos, maxPos);
  setRoom("room2scps2", ROOM2, floor(0.6 * room2[0]), minPos, maxPos);
  setRoom("room1123", ROOM2, floor(0.7 * room2[0]), minPos, maxPos);
  setRoom("room2elevator", ROOM2, floor(0.85 * room2[0]), minPos, maxPos);

  // le seul tirage RNG de toute la phase (produit en float32 comme Blitz) :
  mapRoom[ROOM3][floor(Math.fround(rng.randFloat(0.2, 0.8) * room3[0]))] = "room3storage";
  mapRoom[ROOM2C][floor(0.5 * room2c[0])] = "room1162";
  mapRoom[ROOM4][floor(0.3 * room4[0])] = "room4info";

  // zone 2 (7400-7424)
  minPos = room1[0]; maxPos = room1[0] + room1[1] - 1;
  setRoom("room079", ROOM1, room1[0] + floor(0.15 * room1[1]), minPos, maxPos);
  setRoom("room106", ROOM1, room1[0] + floor(0.3 * room1[1]), minPos, maxPos);
  setRoom("008", ROOM1, room1[0] + floor(0.4 * room1[1]), minPos, maxPos);
  setRoom("room035", ROOM1, room1[0] + floor(0.5 * room1[1]), minPos, maxPos);
  setRoom("coffin", ROOM1, room1[0] + floor(0.7 * room1[1]), minPos, maxPos);

  minPos = room2[0]; maxPos = room2[0] + room2[1] - 1;
  mapRoom[ROOM2][room2[0] + floor(0.1 * room2[1])] = "room2nuke";
  setRoom("room2tunnel", ROOM2, room2[0] + floor(0.25 * room2[1]), minPos, maxPos);
  setRoom("room049", ROOM2, room2[0] + floor(0.4 * room2[1]), minPos, maxPos);
  setRoom("room2shaft", ROOM2, room2[0] + floor(0.6 * room2[1]), minPos, maxPos);
  setRoom("testroom", ROOM2, room2[0] + floor(0.7 * room2[1]), minPos, maxPos);
  setRoom("room2servers", ROOM2, room2[0] + floor(0.9 * room2[1]), minPos, maxPos);

  mapRoom[ROOM3][room3[0] + floor(0.3 * room3[1])] = "room513";
  mapRoom[ROOM3][room3[0] + floor(0.6 * room3[1])] = "room966";

  mapRoom[ROOM2C][room2c[0] + floor(0.5 * room2c[1])] = "room2cpit";

  // zone 3 (7427-7453)
  mapRoom[ROOM1][room1[0] + room1[1] + room1[2] - 2] = "exit1";
  mapRoom[ROOM1][room1[0] + room1[1] + room1[2] - 1] = "gateaentrance";
  mapRoom[ROOM1][room1[0] + room1[1]] = "room1lifts";

  minPos = room2[0] + room2[1]; maxPos = room2[0] + room2[1] + room2[2] - 1;
  mapRoom[ROOM2][minPos + floor(0.1 * room2[2])] = "room2poffices";
  setRoom("room2cafeteria", ROOM2, minPos + floor(0.2 * room2[2]), minPos, maxPos);
  setRoom("room2sroom", ROOM2, minPos + floor(0.3 * room2[2]), minPos, maxPos);
  setRoom("room2servers2", ROOM2, minPos + floor(0.4 * room2[2]), minPos, maxPos);
  setRoom("room2offices", ROOM2, minPos + floor(0.45 * room2[2]), minPos, maxPos);
  setRoom("room2offices4", ROOM2, minPos + floor(0.5 * room2[2]), minPos, maxPos);
  setRoom("room860", ROOM2, minPos + floor(0.6 * room2[2]), minPos, maxPos);
  setRoom("medibay", ROOM2, minPos + floor(0.7 * room2[2]), minPos, maxPos);
  setRoom("room2poffices2", ROOM2, minPos + floor(0.8 * room2[2]), minPos, maxPos);
  setRoom("room2offices2", ROOM2, minPos + floor(0.9 * room2[2]), minPos, maxPos);

  mapRoom[ROOM2C][room2c[0] + room2c[1]] = "room2ccont";
  mapRoom[ROOM2C][room2c[0] + room2c[1] + 1] = "lockroom2";

  mapRoom[ROOM3][room3[0] + room3[1] + floor(0.3 * room3[2])] = "room3servers";
  mapRoom[ROOM3][room3[0] + room3[1] + floor(0.7 * room3[2])] = "room3servers2";
  mapRoom[ROOM3][room3[0] + room3[1] + floor(0.5 * room3[2])] = "room3offices";

  return { grid: M, room1, room2, room2c, room3, room4, mapRoom, maxRooms };
}
