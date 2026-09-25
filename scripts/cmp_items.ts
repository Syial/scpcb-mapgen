// Compare items port vs dump jeu.
/**
 * Compare SeedItems_<seed>.txt (dump jeu) vs generateMap().
 *
 * Usage:
 *   npx tsx scripts/cmp_items.ts [path] [seed]
 *
 * Critère principal : multiset (name, tempname, inv) - l’attribution salle du dump
 * peut dériver pour des items très offset (room3storage, bords cafeteria) ; le
 * rattachement logique FillRoom reste celui de notre modèle.
 */
import { requireArgPath } from "./_paths";
import { readFileSync } from "fs";
import { generateMap } from "../src/generation/index";

type Row = { room: string; xy: string; inv: boolean; name: string; temp: string };

function idKey(r: Row): string {
  return `${r.inv ? 1 : 0}\t${r.name}\t${r.temp}`;
}
function roomKey(r: Row): string {
  return `${r.xy}\t${idKey(r)}`;
}

function parseDump(text: string): { seed: string; intro: boolean; rows: Row[] } {
  const lines = text.split(/\r?\n/);
  const seed = (lines.find((l) => l.startsWith("seed=")) ?? "seed=?").slice(5);
  const intro = /intro=1/.test(text);
  const rows: Row[] = [];
  let mode = false;
  for (const line of lines) {
    if (line.startsWith("room\tgx")) {
      mode = true;
      continue;
    }
    if (!mode || !line.trim()) continue;
    const a = line.split("\t");
    if (a.length < 5) continue;
    rows.push({
      room: a[0],
      xy: a[1],
      inv: a[2] === "1",
      name: a[3],
      temp: a[4],
    });
  }
  return { seed, intro, rows };
}

function oursFor(seed: string, intro = false): Row[] {
  const m = generateMap(seed, 18, intro);
  const rows: Row[] = [];
  for (const r of m.rooms) {
    for (const it of r.items ?? []) {
      rows.push({
        room: r.name,
        xy: `${r.gx},${r.gy}`,
        inv: !!it.inventory,
        name: it.name,
        temp: it.tempname,
      });
    }
  }
  return rows;
}

function bag(rows: Row[], keyFn: (r: Row) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(keyFn(r), (m.get(keyFn(r)) ?? 0) + 1);
  return m;
}

function diffBags(g: Map<string, number>, o: Map<string, number>): { miss: string[]; extra: string[] } {
  const miss: string[] = [];
  const extra: string[] = [];
  for (const [k, n] of g) {
    const x = o.get(k) ?? 0;
    if (x < n) miss.push(`${n - x}× ${k}`);
  }
  for (const [k, n] of o) {
    const x = g.get(k) ?? 0;
    if (x < n) extra.push(`${n - x}× ${k}`);
  }
  return { miss, extra };
}

const dumpPath =
  requireArgPath(2, "Usage: cmp_items.ts <SeedItems.txt>");
const text = readFileSync(dumpPath, "utf8");
const { seed: dumpSeed, intro, rows: game } = parseDump(text);
const seed = process.argv[3] ?? dumpSeed;
const ours = oursFor(seed, intro);

const id = diffBags(bag(game, idKey), bag(ours, idKey));
const byRoom = diffBags(bag(game, roomKey), bag(ours, roomKey));

console.log(`seed=${seed} intro=${intro ? 1 : 0}`);
console.log(`items game=${game.length} ours=${ours.length}`);
console.log(
  `identity (name/temp/inv): ${id.miss.length === 0 && id.extra.length === 0 ? "MATCH" : "DIFF"}`,
);
if (id.miss.length) console.log("  missing:\n  " + id.miss.slice(0, 30).join("\n  "));
if (id.extra.length) console.log("  extra:\n  " + id.extra.slice(0, 30).join("\n  "));

console.log(
  `by-room attribution: ${byRoom.miss.length === 0 && byRoom.extra.length === 0 ? "MATCH" : `${byRoom.miss.length + byRoom.extra.length} dump-vs-model room tags (offsets)`}`,
);
if (byRoom.miss.length || byRoom.extra.length) {
  // Afficher seulement si l'identité matche déjà (heuristiques dump).
  if (id.miss.length === 0 && id.extra.length === 0) {
    console.log("  (same items; dump nearest-room mis-tagged far offsets - ignore if identity MATCH)");
  }
}

// Spot-check variable rooms: ordered lists by room name
const m = generateMap(seed, 18, intro);
for (const name of ["room1archive", "room860", "room2offices2", "room2closets", "room3servers", "start"]) {
  const dumpNames = game.filter((r) => r.room === name || (name === "start" && r.inv)).map((r) => (r.inv ? "[inv]" : "") + r.name);
  // for start, dump uses room=start; also catch inv tagged elsewhere
  const dumpOrdered =
    name === "start"
      ? game.filter((r) => r.inv || r.room === "start").map((r) => (r.inv ? "[inv]" : "") + r.name)
      : text
          .split(/\r?\n/)
          .filter((l) => l.startsWith(name + "\t"))
          .map((l) => {
            const a = l.split("\t");
            return (a[2] === "1" ? "[inv]" : "") + a[3];
          });
  const room = m.rooms.find((r) => r.name === name);
  const ourOrdered = (room?.items ?? []).map((i) => (i.inventory ? "[inv]" : "") + i.name);
  // Salles mal taguées dans le dump : comparer via notre room + lignes jeu au même multiset. Ignorer l'ordre si le dump split
  if (name === "room1archive" || name === "room860" || name === "room2offices2" || name === "room2closets") {
    const ok = dumpOrdered.join("|") === ourOrdered.join("|");
    console.log(`order ${name}: ${ok ? "MATCH" : "DIFF"} (${ourOrdered.length} items)`);
    if (!ok) {
      console.log("  game:", dumpOrdered.join(" | "));
      console.log("  ours:", ourOrdered.join(" | "));
    }
  } else if (name === "start") {
    const ok = ourOrdered.join("|") === dumpOrdered.join("|");
    console.log(`order start: ${ok ? "MATCH" : "DIFF"}`);
  } else if (name === "room3servers") {
    const ok = dumpOrdered.join("|") === ourOrdered.join("|");
    console.log(`order room3servers: ${ok ? "MATCH" : "DIFF"}`);
  }
}
