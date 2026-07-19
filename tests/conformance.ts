// Conformité bit-exacte : extents comparés motif à motif au dump du runtime — un ULP d'écart échoue.
import { BlitzRng } from "../src/rng/blitz_rng";
import { carveCorridors } from "../src/generation/carving";
import { assignRooms } from "../src/generation/rooms";
import { placeRooms } from "../src/generation/placement";
import { preventRoomOverlap, calculateRoomExtents } from "../src/generation/overlap";
import { identifyGenericRooms } from "../src/generation/index";
import extentsData from "../src/generation/room_extents.json";
import * as fs from "fs";
import * as path from "path";

const D = extentsData as any;
const f = Math.fround;
const DIR = path.join(import.meta.dirname, "fixtures");

// cas de référence [seed, intro] : l'union couvre les 91 templates suivis
const CASES: [string, boolean][] = [
  ["SITE19", false], ["173", false], ["1114", true],
  ["2111", true], ["4", true], ["58", true],
];

const _dv = new DataView(new ArrayBuffer(4));
const bits = (b: number) => { _dv.setInt32(0, b | 0); return _dv.getFloat32(0); };

// Séquence d'extents produite par notre port, dans l'ordre des appels du jeu.
function ourExtents(seed: string, introEnabled: boolean): number[][] {
  const rng = new BlitzRng(BlitzRng.generateSeedNumber(seed));
  const carve = carveCorridors(rng, 18);
  const placed = placeRooms(assignRooms(rng, carve), 18, 18, introEnabled);
  identifyGenericRooms(rng, carve.grid, placed);

  const out: number[][] = [];
  // CreateRoom : CalculateRoomExtents à l'angle 0 (l'orientation est posée après)
  for (const r of placed) {
    const t = D.templates[r.name];
    if (!t || t.disableOverlap) continue;
    const e = calculateRoomExtents(r, 0);
    if (e) out.push([e.minX, e.minY, e.minZ, e.maxX, e.maxY, e.maxZ]);
  }
  // PreventRoomOverlap : chaque recalcul, dans l'ordre
  preventRoomOverlap(placed, (_r, e) => out.push([e.minX, e.minY, e.minZ, e.maxX, e.maxY, e.maxZ]));
  return out;
}

function gameExtents(seed: string): number[][] {
  const raw = fs.readFileSync(path.join(DIR, `${seed}.txt`), "utf8");
  return raw.split("\n").filter(l => l.trim()).map(l => l.trim().split(",").map(x => bits(Number(x))));
}

let failed = 0, total = 0;
for (const [seed, intro] of CASES) {
  const ours = ourExtents(seed, intro), game = gameExtents(seed);
  let diffs = 0, first = -1;
  const n = Math.min(ours.length, game.length);
  for (let i = 0; i < n; i++) {
    if (!ours[i].every((v, k) => Object.is(f(v), game[i][k]))) { diffs++; if (first < 0) first = i; }
  }
  const ok = ours.length === game.length && diffs === 0;
  if (!ok) failed++;
  total += n;
  const tag = `${seed}${intro ? " [intro]" : ""}`.padEnd(15);
  console.log(ok
    ? `  ✓ ${tag} ${n} extents bit-exacts`
    : `  ✗ ${tag} ${diffs} écarts (1er @${first}) — ${ours.length} vs ${game.length}`);
}
console.log(failed
  ? `\n✗ ${failed}/${CASES.length} cas en échec`
  : `\n✓ ${CASES.length} maps, ${total} extents — 100% bit-exact`);
process.exit(failed ? 1 : 0);
