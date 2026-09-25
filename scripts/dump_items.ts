// Dump items d'une seed (debug).
import { generateMap } from "../src/generation/index";

const seeds = process.argv.slice(2);
const list = seeds.length ? seeds : ["SITE19", "ABC123", "446YPT", "H0UY7"];

for (const seed of list) {
  const m = generateMap(seed, 18, false);
  const nItems = m.rooms.reduce((n, r) => n + (r.items?.length ?? 0), 0);
  const nEvt = m.rooms.filter((r) => r.event).length;
  console.log(`=== ${seed} rooms=${m.rooms.length} events=${nEvt} items=${nItems} hash=${m.seedNumber}`);
  for (const r of m.rooms) {
    if (!r.items?.length && !r.event) continue;
    const its = (r.items ?? []).map((i) => i.name + (i.inventory ? "[inv]" : "")).join(", ");
    console.log(`  ${r.name}@${r.gx},${r.gy}` + (r.event ? ` evt=${r.event}` : "") + (its ? ` [${its}]` : ""));
  }
}
