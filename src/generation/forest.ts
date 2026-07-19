import { BlitzRng } from "../rng/blitz_rng";
import { ROOM1, ROOM2, ROOM2C, ROOM3, ROOM4 } from "./rooms";

// Forêt de room860 (877-1043) : grille 10×10, quirks Blitz répliqués (`Or` bitwise, Exit externe, bornes buggées).

const GRIDSIZE = 10;
const DEVIATION_CHANCE = 40;
const RETURN_CHANCE = 27;
const MAX_DEVIATION = 3;
const CENTER = 5;
const BRANCH_CHANCE = 65;
const COBBLE_CHANCE = 50; // valeur sans effet : tirage consommé, résultat ignoré
const BRANCH_DIE_CHANCE = 18;
const BRANCH_MAX_LIFE = 4;

function chance(rng: BlitzRng, c: number): boolean {
  return rng.randInt(0, 100) <= c;
}
function moveForward(dir: number, pathx: number, pathy: number, retval = 0): number {
  if (dir === 1) return retval === 0 ? pathx : pathy + 1;
  return retval === 0 ? pathx - 1 + dir : pathy;
}
function turnIfDeviating(maxDev: number, pathx: number, center: number, dir: number, retval = 0): number {
  const currentDeviation = center - pathx;
  let deviated = false;
  let d = dir;
  if ((dir === 0 && currentDeviation >= maxDev) || (dir === 2 && currentDeviation <= -maxDev)) {
    d = (dir + 2) % 4;
    deviated = true;
  }
  return retval === 0 ? d : deviated ? 1 : 0;
}

export function genForestGrid(rng: BlitzRng): number[] {
  // grille de 111 cases (comme Blitz : gridsize*gridsize+11), init 0
  const grid: number[] = new Array(GRIDSIZE * GRIDSIZE + 11).fill(0);
  // ((gridsize-1-Y)*gridsize)+X ; lecture sûre hors bornes → 0
  const idx = (x: number, y: number) => (GRIDSIZE - 1 - y) * GRIDSIZE + x;
  const get = (i: number) => (i >= 0 && i < grid.length ? grid[i] : 0);
  const set = (i: number, v: number) => { if (i >= 0 && i < grid.length) grid[i] = v; };

  const door1_pos = rng.randInt(3, 7);
  const door2_pos = rng.randInt(3, 7);

  set(door1_pos, 3);
  set((GRIDSIZE - 1) * GRIDSIZE + door2_pos, 3);

  let pathx = door2_pos;
  let pathy = 1;
  let dir = 1;
  set(idx(pathx, pathy), 1);

  let deviated = 0;
  while (pathy < GRIDSIZE - 4) {
    if (dir === 1) {
      if (chance(rng, DEVIATION_CHANCE)) {
        dir = 2 * rng.randInt(0, 1);
        dir = turnIfDeviating(MAX_DEVIATION, pathx, CENTER, dir);
        deviated = turnIfDeviating(MAX_DEVIATION, pathx, CENTER, dir, 1);
        if (deviated) set(idx(pathx, pathy), 1);
        pathx = moveForward(dir, pathx, pathy);
        pathy = moveForward(dir, pathx, pathy, 1);
      }
    } else {
      dir = turnIfDeviating(MAX_DEVIATION, pathx, CENTER, dir);
      deviated = turnIfDeviating(MAX_DEVIATION, pathx, CENTER, dir, 1);
      const ret = chance(rng, RETURN_CHANCE) ? 1 : 0; // Or non-court-circuité : toujours tiré
      if (deviated || ret) dir = 1;
      pathx = moveForward(dir, pathx, pathy);
      pathy = moveForward(dir, pathx, pathy, 1);
      if (dir === 1) {
        set(idx(pathx, pathy), 1);
        pathx = moveForward(dir, pathx, pathy);
        pathy = moveForward(dir, pathx, pathy, 1);
      }
    }
    set(idx(pathx, pathy), 1);
  }

  // ramener le chemin jusqu'au bout (pas de RNG)
  dir = 1;
  while (pathy < GRIDSIZE - 2) {
    pathx = moveForward(dir, pathx, pathy);
    pathy = moveForward(dir, pathx, pathy, 1);
    set(idx(pathx, pathy), 1);
  }
  // ramener vers door1 (pas de RNG)
  if (pathx !== door1_pos) {
    dir = 0;
    if (door1_pos > pathx) dir = 2;
    while (pathx !== door1_pos) {
      pathx = moveForward(dir, pathx, pathy);
      pathy = moveForward(dir, pathx, pathy, 1);
      set(idx(pathx, pathy), 1);
    }
  }

  // branches
  let new_y = -3;
  while (new_y < GRIDSIZE - 6) {
    new_y += 4;
    let temp_y = new_y;
    let new_x = 0;
    if (chance(rng, BRANCH_CHANCE)) {
      let branch_type = -1;
      if (chance(rng, COBBLE_CHANCE)) branch_type = -2; // tirage consommé, résultat sans impact
      const branch_pos = 2 * rng.randInt(0, 1);
      let leftmost = GRIDSIZE;
      let rightmost = 0;
      for (let i = 0; i <= GRIDSIZE; i++) {
        if (get(idx(i, new_y)) === 1) {
          if (i < leftmost) leftmost = i;
          if (i > rightmost) rightmost = i;
        }
      }
      new_x = branch_pos === 0 ? leftmost - 1 : rightmost + 1;
      // Exit ligne 989 : casse la boucle While new_y (pas juste cette branche)
      const above = temp_y !== 0 && get(idx(new_x, temp_y - 1)) === 1;
      const below = get(idx(new_x, temp_y + 1)) === 1;
      if (above || below) break;
      set(idx(new_x, temp_y), branch_type);
      new_x = branch_pos === 0 ? leftmost - 2 : rightmost + 2;
      set(idx(new_x, temp_y), branch_type);
      let i = 2;
      while (i < BRANCH_MAX_LIFE) {
        i++;
        if (chance(rng, BRANCH_DIE_CHANCE)) break;
        if (rng.randInt(0, 3) === 0) {
          new_x = branch_pos === 0 ? new_x - 1 : new_x + 1;
        } else {
          temp_y = temp_y + 1;
        }
        // bornes sur l'index BRUT (check buggé, reproduit tel quel)
        let n = (GRIDSIZE - 1 - temp_y + 1) * GRIDSIZE + new_x;
        if (n < GRIDSIZE - 1) {
          if (temp_y !== 0 && get(n) === 1) break;
        }
        n = (GRIDSIZE - 1 - temp_y - 1) * GRIDSIZE + new_x;
        if (n > 0) {
          if (get(n) === 1) break;
        }
        set(idx(new_x, temp_y), branch_type);
        if (temp_y >= GRIDSIZE - 2) break;
      }
    }
  }

  // -1/-2 → 1
  for (let i = 0; i < grid.length; i++) if (grid[i] === -1 || grid[i] === -2) grid[i] = 1;

  return grid;
}

import hmData from "./forest_heightmaps.json";
const HM = hmData as Record<string, { w: number; h: number; px: number[] }>;

// PlaceForest (1119-1276) : par pixel de heightmap, Rand(100,260) puis 8 tirages (arbre) ou 2 (rocher).
export function placeForestRng(rng: BlitzRng, grid: number[]): void {
  const GS = 10;
  const g = (i: number) => (i >= 0 && i < grid.length ? grid[i] : 0);
  const itemPlaced: boolean[] = [false, false, false, false];

  for (let tx = 1; tx <= GS - 1; tx++) {
    for (let ty = 1; ty <= GS - 1; ty++) {
      if (g(ty * GS + tx) === 1) {
        // nombre de voisins occupés (= tile_type brut)
        let nt = 0;
        if (tx + 1 < GS) nt = g(ty * GS + tx + 1) > 0 ? 1 : 0;
        if (tx - 1 >= 0) nt += g(ty * GS + tx - 1) > 0 ? 1 : 0;
        if (ty + 1 < GS) nt += g((ty + 1) * GS + tx) > 0 ? 1 : 0;
        if (ty - 1 >= 0) nt += g((ty - 1) * GS + tx) > 0 ? 1 : 0;

        // mappage vers la constante ROOM (choisit la heightmap)
        let tileType = 0;
        switch (nt) {
          case 1: tileType = ROOM1; break;
          case 2:
            if (g((ty - 1) * GS + tx) > 0 && g((ty + 1) * GS + tx) > 0) tileType = ROOM2;
            else if (g(ty * GS + tx + 1) > 0 && g(ty * GS + tx - 1) > 0) tileType = ROOM2;
            else tileType = ROOM2C;
            break;
          case 3: tileType = ROOM3; break;
          case 4: tileType = ROOM4; break;
          default: tileType = 0;
        }

        if (tileType > 0) {
          // Bug fidèle : itemPlaced re-déclaré par tile → un item par tile où (ty%3)=2.
          if (ty % 3 === 2 && !itemPlaced[Math.floor(ty / 3)]) {
            itemPlaced[Math.floor(ty / 3)] = true;
            rng.next();
          }

          const hm = HM[String(tileType)];
          const width = hm.w; // 30
          for (let lx = 3; lx <= width - 2; lx++) {
            for (let ly = 3; ly <= width - 2; ly++) {
              const pixel = hm.px[(width - ly) * width + lx]; // GetColor lx, width-ly ; ColorRed
              const threshold = rng.randInt(100, 260);
              if (pixel > threshold) {
                const sel = rng.randInt(0, 7);
                const body = sel <= 6 ? 8 : 2; // arbre : 8 tirages ; rocher : 2
                for (let k = 0; k < body; k++) rng.next();
              }
            }
          }
        }
      }
    }
  }
}
