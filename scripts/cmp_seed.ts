// Compare salles / events port vs dump jeu.
import { generateMap } from "../src/generation/index";
import { readFileSync } from "fs";
import { requireArgPath } from "./_paths";

// Usage: npx tsx scripts/cmp_seed.ts <SeedEvents.txt> [seed]
const dumpPath = requireArgPath(2, "Usage: cmp_seed.ts <SeedEvents.txt> [seed]");
const text = readFileSync(dumpPath, "utf8");
const seedLine = text.split(/\r?\n/).find((l) => l.startsWith("seed="));
const seed = process.argv[3] ?? seedLine?.slice(5) ?? "SITE19";

const m = generateMap(seed);
const gameRooms: { n: string; xy: string; e: string }[] = [];
let mode = "";
for (const line of text.split(/\r?\n/)) {
  if (line.startsWith("room\tgx")) {
    mode = "rooms";
    continue;
  }
  if (mode !== "rooms" || !line.trim()) continue;
  const a = line.split("\t");
  if (a.length >= 5) gameRooms.push({ n: a[0], xy: a[1], e: a[4] === "-" ? "" : a[4] });
}

const ours = m.rooms.map((r) => ({
  n: r.name,
  xy: `${r.gx},${r.gy}`,
  e: r.event ?? "",
}));

let orderDiff = 0;
for (let i = 0; i < Math.max(gameRooms.length, ours.length); i++) {
  const g = gameRooms[i];
  const o = ours[i];
  if (!g || !o || g.n !== o.n || g.xy !== o.xy) orderDiff++;
}

const byXy = new Map(ours.map((o) => [o.xy, o]));
const diffs: string[] = [];
for (const g of gameRooms) {
  const o = byXy.get(g.xy);
  if (!o) {
    diffs.push(`missing ${g.xy} ${g.n}`);
    continue;
  }
  if (o.n !== g.n) diffs.push(`${g.xy} NAME game=${g.n} ours=${o.n}`);
  if ((o.e || "") !== (g.e || "")) diffs.push(`${g.xy} ${g.n} game=${g.e || "-"} ours=${o.e || "-"}`);
}

console.log(`seed=${seed}`);
console.log(`rooms game=${gameRooms.length} ours=${ours.length} orderDiffs=${orderDiff}`);
console.log(`events game=${gameRooms.filter((g) => g.e).length} ours=${ours.filter((o) => o.e).length} eventDiffs=${diffs.length}`);
if (diffs.length) console.log(diffs.slice(0, 40).join("\n"));
else console.log("MATCH");
