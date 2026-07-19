import { BlitzRng } from "../rng/blitz_rng";
import { genForestGrid, placeForestRng } from "./forest";
import lightCounts from "./light_counts.json";
import fillerDraws from "./filler_template_draws.json";

const LIGHTS = lightCounts as Record<string, number>;
const DRAWS = fillerDraws as Record<string, number>;

// room1archive (4655-4726) : `chance` décide branche et early-exit, donc le nombre de tirages.
function room1archive(rng: BlitzRng): void {
  for (let xtemp = 0; xtemp <= 1; xtemp++) {
    for (let ytemp = 0; ytemp <= 2; ytemp++) {
      for (let ztemp = 0; ztemp <= 2; ztemp++) {
        const chance = rng.randInt(-10, 100); // valeur décisive
        if (chance < 0) break; // Exit : casse la boucle ztemp
        if (chance < 40) rng.next();          // document : Rand(1,6)
        else if (chance < 45) rng.next();     // keycard : Rand(1,2)
        else if (chance < 95) { } // medkit/battery/snav/radio/clipboard : 0 tirage
        else rng.next();                      // misc : Rand(1,3)
        rng.next();                           // z : Rnd(-96,96)
        rng.next();                           // CreateItem : Rand(360) interne
      }
    }
  }
  rng.next(); // r\RoomDoors[0] = CreateDoor(...)
}

// room2closets — 8 items dont 2 conditionnels, + 1 porte (1 Rand(360) par item).
function room2closets(rng: BlitzRng): void {
  rng.next(); rng.next(); rng.next();            // 3 items inconditionnels
  if (rng.randInt(2) === 1) rng.next();          // item conditionnel
  if (rng.randInt(2) === 1) rng.next();          // item conditionnel
  rng.next(); rng.next(); rng.next();            // 3 items inconditionnels
  rng.next();                                    // porte
}

// room3servers — 2 items inconditionnels + 2 items conditionnels.
function room3servers(rng: BlitzRng): void {
  rng.next();                                    // item
  if (rng.randInt(2) === 1) rng.next();          // item conditionnel
  if (rng.randInt(2) === 1) rng.next();          // item conditionnel
  rng.next();                                    // item (S-NAV)
}

// room2offices3 — ⚠ Blitz réévalue la borne du For à chaque test : marche aléatoire, pas une borne fixe.
function room2offices3(rng: BlitzRng): void {
  rng.randInt(2);                                // If Rand(2)=1 : les 2 branches créent 1 item
  rng.next();                                    // item (branche)
  rng.next(); rng.next(); rng.next();            // Object, Document, Radio
  let i = 0;
  for (;;) {
    const bound = rng.randInt(0, 1);             // cond : Rand(0,1) réévalué à chaque test
    if (i > bound) break;
    rng.next();                                  // body : eyedrops (CreateItem)
    i++;
  }
  rng.next();                                    // Battery
  if (rng.randInt(2) === 1) rng.next();          // item conditionnel
  if (rng.randInt(2) === 1) rng.next();          // item conditionnel
  rng.next();                                    // porte
}

// Consomme le RNG de FillRoom pour une salle : tirages du template + lumières (2 × min(n, 32)).
export function consumeFiller(
  rng: BlitzRng,
  name: string,
  grid?: number[][],
  gx?: number,
  gy?: number
): number[] | undefined {
  let forestGrid: number[] | undefined;
  if (name === "room860") {
    // Case room860 (MapSystem.bb 2111-2193) : 4 portes → forêt → 2 items
    rng.next(); rng.next(); rng.next(); rng.next(); // 4 CreateDoor (Rand(8))
    forestGrid = genForestGrid(rng);
    placeForestRng(rng, forestGrid);
    rng.next(); rng.next(); // 2 CreateItem (Rand(360))
  } else if (name === "room1archive") {
    room1archive(rng);
  } else if (name === "room2closets") {
    room2closets(rng);
  } else if (name === "room3servers") {
    room3servers(rng);
  } else if (name === "room2offices3") {
    room2offices3(rng);
  } else if (name === "checkpoint1" || name === "checkpoint2") {
    rng.next(); // 2 portes de base
    rng.next();
    // porte conditionnelle : If MapTemp(gx, gy-1) = 0
    if (grid && gx !== undefined && gy !== undefined) {
      const above = gy - 1 >= 0 ? grid[gx][gy - 1] : 0;
      if (above === 0) rng.next();
    }
  } else {
    const n = DRAWS[name] ?? 0; // 0 pour les génériques sans case FillRoom
    for (let k = 0; k < n; k++) rng.next();
  }

  // boucle de lumières (après le bloc Select, pour toutes les salles)
  const lightDraws = 2 * Math.min(LIGHTS[name] ?? 0, 32);
  for (let k = 0; k < lightDraws; k++) rng.next();

  return forestGrid; // défini seulement pour room860
}
