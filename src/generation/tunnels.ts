import { BlitzRng } from "../rng/blitz_rng";

// Tunnels de maintenance (UpdateEvents 3164-3293) : re-seed sur le hash, donc dérivables de la seed. Marche aléatoire 19×19, puis case = nb de voisins, entrée/sortie/générateur placés.
const GRIDSZ = 19;

export interface TunnelGrid {
  size: number;
  // 19×19. 0 vide ; 1..4 = couloir (nb de voisins) ; 3 aussi = porte ; 7 = salle générateur.
  cells: number[];
  entrance: [number, number] | null;
  exit: [number, number] | null;
  // Faux si le jeu aurait levé RuntimeError (entrée == sortie) : tunnels non générables.
  ok: boolean;
}

// Accès borné : hors grille → 0, comme la lecture tableau de Blitz dans ce code.
function at(g: number[], x: number, y: number): number {
  if (x < 0 || x >= GRIDSZ || y < 0 || y >= GRIDSZ) return 0;
  return g[x + y * GRIDSZ];
}

export function generateTunnels(seedNumber: number): TunnelGrid {
  const rng = new BlitzRng(seedNumber); // re-seed sur le hash (le jeu fait SeedRnd(hash) ici)
  const g = new Array(GRIDSZ * GRIDSZ).fill(0);

  let dir = rng.randInt(0, 1) << 1; // 0 droite, 1 haut, 2 gauche, 3 bas
  let ix = Math.floor(GRIDSZ / 2) + rng.randInt(-2, 2);
  let iy = Math.floor(GRIDSZ / 2) + rng.randInt(-2, 2);

  g[ix + iy * GRIDSZ] = 1;
  if (dir === 2) g[ix + 1 + iy * GRIDSZ] = 1;
  else g[ix - 1 + iy * GRIDSZ] = 1;

  let count = 2;
  while (count < 100) {
    const tempInt = rng.randInt(1, 5) << rng.randInt(1, 2);
    for (let i = 1; i <= tempInt; i++) {
      let advanced = true;
      switch (dir) {
        case 0: if (ix < GRIDSZ - 2 - (i % 2)) ix++; else advanced = false; break;
        case 1: if (iy < GRIDSZ - 2 - (i % 2)) iy++; else advanced = false; break;
        case 2: if (ix > 1 + (i % 2)) ix--; else advanced = false; break;
        case 3: if (iy > 1 + (i % 2)) iy--; else advanced = false; break;
      }
      if (advanced) {
        if (g[ix + iy * GRIDSZ] === 0) { g[ix + iy * GRIDSZ] = 1; count++; }
      } else break;
    }
    dir = dir + ((rng.randInt(0, 1) << 1) - 1);
    while (dir < 0) dir += 4;
    while (dir > 3) dir -= 4;
  }

  // chaque case marquée → nombre de voisins (choisit le type de tuile)
  const walk = g.slice();
  for (let y = 0; y < GRIDSZ; y++)
    for (let x = 0; x < GRIDSZ; x++)
      if (walk[x + y * GRIDSZ] > 0)
        g[x + y * GRIDSZ] =
          (at(walk, x, y + 1) > 0 ? 1 : 0) + (at(walk, x, y - 1) > 0 ? 1 : 0) +
          (at(walk, x + 1, y) > 0 ? 1 : 0) + (at(walk, x - 1, y) > 0 ? 1 : 0);

  // Generator room (7) greffée sur le bord droit d'un couloir.
  let maxX = GRIDSZ - 1;
  for (let x = 0; x <= maxX; x++) {
    let canRetry = 0;
    for (let y = 0; y < GRIDSZ; y++) {
      if (at(g, x + 1, y) > 0) {
        maxX = x;
        if (at(g, x + 1, y + 1) < 3 && at(g, x + 1, y - 1) < 3) {
          canRetry = 1;
          if (rng.randInt(0, 1) === 1) {
            g[x + 1 + y * GRIDSZ] += 1;
            g[x + y * GRIDSZ] = 7;
            canRetry = 0;
            break;
          }
        }
      }
    }
    if (canRetry) x--;
  }

  // entrée (firstX) et sortie (lastX) : cases droites (valeur 2) isolées
  let firstX = -1, firstY = -1, lastX = -1, lastY = -1;
  const isolated = (x: number, y: number) =>
    at(g, x - 1, y) < 3 && at(g, x + 1, y) < 3 && at(g, x, y - 1) < 3 && at(g, x, y + 1) < 3 &&
    at(g, x - 1, y - 1) < 1 && at(g, x + 1, y - 1) < 1 && at(g, x - 1, y + 1) < 1;
  for (let y = 0; y < GRIDSZ; y++)
    for (let x = 0; x < GRIDSZ; x++) {
      if (g[x + y * GRIDSZ] !== 2) continue;
      const horiz = at(g, x + 1, y) > 0 && at(g, x - 1, y) > 0;
      const vert = at(g, x, y + 1) > 0 && at(g, x, y - 1) > 0;
      if (!horiz && !vert) continue;
      if ((firstX === -1 || firstY === -1) && isolated(x, y)) { firstX = x; firstY = y; }
      if (isolated(x, y)) { lastX = x; lastY = y; }
    }

  const ok = !(firstX === lastX && firstY === lastY);
  return {
    size: GRIDSZ,
    cells: g,
    entrance: firstX >= 0 ? [firstX, firstY] : null,
    exit: lastX >= 0 ? [lastX, lastY] : null,
    ok,
  };
}
