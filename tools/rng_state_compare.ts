// Compare l'état RNG salle par salle (port vs log jeu).
// Usage : node rng_state_compare.mjs <seed> <logfile>
// Log attendu : RNGSTATE <state> <name> <x> <z> après chaque CalculateRoomExtents.
// Checkpoints port : afterFill (après FillRoom) et afterRoll (après orientation ROOM2).

import { BlitzRng } from "../src/rng/blitz_rng";
import { carveCorridors } from "../src/generation/carving";
import { assignRooms } from "../src/generation/rooms";
import { placeRooms } from "../src/generation/placement";
import { selectTemplate } from "../src/generation/selection";
import { consumeFiller } from "../src/generation/filler";
import * as fs from "fs";

const ROOM2 = 2;
const seed = process.argv[2];
const logfile = process.argv[3];
if (!seed || !logfile) {
  console.error("Usage: rng_state_compare.ts <seed> <logfile>");
  process.exit(1);
}

// --- état jeu ---
const gameRows: { state: number; name: string; gx: number; gy: number }[] = [];
for (const l of fs.readFileSync(logfile, "utf8").split("\n")) {
  const m = l.trim().match(/^RNGSTATE\s+(-?\d+)\s+(\S+)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
  if (m) gameRows.push({ state: Number(m[1]), name: m[2], gx: Math.round(Number(m[3]) / 8), gy: Math.round(Number(m[4]) / 8) });
}

// --- mon état ---
const rng = new BlitzRng(BlitzRng.generateSeedNumber(seed));
const carve = carveCorridors(rng, 18);
const rooms = assignRooms(rng, carve);
const placed = placeRooms(rooms, 18, 18);
const mine: { afterFill: number; afterRoll: number; name: string; gx: number; gy: number }[] = [];
for (const p of placed) {
  if (p.zone === 0) break;
  let name = p.name;
  if (name === "") { const t = selectTemplate(rng, p.zone, p.shape); name = t ? t.name : ""; p.name = name; }
  consumeFiller(rng, name, carve.grid, p.gx, p.gy); // retourne { forest, items } - RNG inchangé
  const afterFill = (rng as any).state;
  if (p.shape === ROOM2 && p.angle === null) {
    const h = carve.grid[p.gx - 1][p.gy] > 0 && carve.grid[p.gx + 1][p.gy] > 0;
    const r = rng.randInt(2); p.angle = h ? (r === 1 ? 90 : 270) : (r === 1 ? 180 : 0);
  }
  mine.push({ afterFill, afterRoll: (rng as any).state, name, gx: p.gx, gy: p.gy });
}

// --- alignement ---
if (gameRows.length === 0) {
  console.log("Aucune ligne RNGSTATE trouvée dans le log - vérifier l'instrumentation.");
  process.exit(0);
}
console.log(`Aligne ${Math.min(gameRows.length, mine.length)} salles (jeu=${gameRows.length}, moi=${mine.length})\n`);
let firstDiv = -1;
const n = Math.min(gameRows.length, mine.length);
for (let i = 0; i < n; i++) {
  const g = gameRows[i], m = mine[i];
  const matchFill = g.state === m.afterFill;
  const matchRoll = g.state === m.afterRoll;
  if (!matchFill && !matchRoll && firstDiv < 0) {
    firstDiv = i;
    console.log(`>>> PREMIÈRE DIVERGENCE salle [${i}]`);
    for (let j = Math.max(0, i - 2); j <= i; j++) {
      const gg = gameRows[j], mm = mine[j];
      console.log(`  [${j}] jeu: state=${gg.state} ${gg.name}@(${gg.gx},${gg.gy})`);
      console.log(`       moi: fill=${mm.afterFill} roll=${mm.afterRoll} ${mm.name}@(${mm.gx},${mm.gy})`);
    }
    break;
  }
}
if (firstDiv < 0) console.log(`✓ Tous les états matchent sur ${n} salles.`);
