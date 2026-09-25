// Tests filtres : unitaires + seeds fixtures (pas de scan multi-heure).
import { generateMap } from "../src/generation/index";
import { analyseMap } from "../src/analysis";
import {
  evalFilter,
  walkDistance,
  type Filter,
} from "../src/search/filters";
import { isOutOfPlace, expectedZones } from "../src/search/zones";
import { possibleItemsForRoom } from "../src/search/item_catalog";
import { possibleEventsForRoom } from "../src/search/event_catalog";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed++;
    console.log(`  ✗ ${msg}`);
  } else {
    console.log(`  ✓ ${msg}`);
  }
}

function evalAll(seed: string, f: Filter): string | null {
  const model = generateMap(seed, 18, false);
  const a = analyseMap(model);
  const names = new Set(model.rooms.map((r) => r.name));
  return evalFilter(model, f, names, a);
}

console.log("zones / out-of-place");
assert(expectedZones("coffin")[0] === 2, "coffin expected HCZ (SetRoom)");
assert(expectedZones("room079")[0] === 2, "room079 expected HCZ not rooms.ini EZ");
assert(isOutOfPlace("coffin", 3) === true, "coffin in EZ is out of place");
assert(isOutOfPlace("coffin", 2) === false, "coffin in HCZ is ok");
assert(isOutOfPlace("room079", 2) === false, "room079 in HCZ is ok");

{
  // seed 1003 : coffin + room2cpit en EZ (probe)
  const note = evalAll("1003", { type: "out_of_place" });
  assert(!!note && note.includes("coffin"), `seed 1003 oop mentions coffin (got ${note})`);
  assert(
    evalAll("1003", { type: "out_of_place", room: "coffin" }) !== null,
    "seed 1003 oop coffin specifically",
  );
}

console.log("residual overlap (optional rooms)");
{
  // seed 8 : room079 ∩ room106
  const any = evalAll("8", { type: "overlap" });
  assert(!!any && any.includes("room079") && any.includes("room106"), `seed 8 any overlap (got ${any})`);
  assert(
    evalAll("8", { type: "overlap", roomA: "room079" }) !== null,
    "seed 8 overlap room079 vs any",
  );
  assert(
    evalAll("8", { type: "overlap", roomA: "room079", roomB: "room106" }) !== null,
    "seed 8 overlap room079 ∩ room106",
  );
  assert(
    evalAll("8", { type: "overlap", roomA: "start" }) === null,
    "seed 8 start has no residual overlap",
  );
  assert(
    evalAll("SITE19", { type: "overlap" }) === null,
    "SITE19 no residual overlap",
  );
}

console.log("walk distance cmp");
{
  const model = generateMap("SITE19", 18, false);
  const a = analyseMap(model);
  const d = walkDistance(model, "start", "914", a);
  assert(d !== null && d >= 0, `SITE19 start↔914 distance ${d}`);
  const names = new Set(model.rooms.map((r) => r.name));
  if (d !== null) {
    assert(
      evalFilter(model, { type: "distance", roomA: "start", roomB: "914", bound: d, cmp: "le" }, names, a) !== null,
      "distance ≤ d passes",
    );
    assert(
      evalFilter(model, { type: "distance", roomA: "start", roomB: "914", bound: d - 1, cmp: "le" }, names, a) === null,
      "distance ≤ d-1 fails",
    );
    assert(
      evalFilter(model, { type: "distance", roomA: "start", roomB: "914", bound: d, cmp: "ge" }, names, a) !== null,
      "distance ≥ d passes",
    );
    assert(
      evalFilter(model, { type: "distance", roomA: "start", roomB: "914", bound: d + 1, cmp: "ge" }, names, a) === null,
      "distance ≥ d+1 fails",
    );
  }
}

console.log("item / event catalogs + eval");
assert(possibleItemsForRoom("914").some((i) => i.name.includes("First Aid")), "914 has First Aid Kit");
assert(possibleEventsForRoom("coffin").some((e) => e.id === "coffin" || e.id === "coffin106"), "coffin events");
assert(possibleEventsForRoom("tunnel_pd").length > 0, "tunnel_pd shares tunnel events");
assert(possibleEventsForRoom("tunnel_pd").some((e) => e.id === "tunnel106"), "tunnel_pd has tunnel106");

{
  const model = generateMap("SITE19", 18, false);
  const a = analyseMap(model);
  const names = new Set(model.rooms.map((r) => r.name));
  const withItems = model.rooms.find((r) => r.items && r.items.length);
  if (withItems?.items?.[0]) {
    const it = withItems.items[0];
    const note = evalFilter(
      model,
      { type: "item", room: withItems.name, name: it.name, tempname: it.tempname, negate: false },
      names,
      a,
    );
    assert(note !== null, `item present ${it.name} @ ${withItems.name}`);
    assert(
      evalFilter(
        model,
        { type: "item", room: withItems.name, name: it.name, tempname: it.tempname, negate: true },
        names,
        a,
      ) === null,
      "item negate rejects when present",
    );
  } else {
    assert(false, "SITE19 should have at least one room with items");
  }

  const withEv = model.rooms.find((r) => r.event);
  if (withEv?.event) {
    assert(
      evalFilter(
        model,
        { type: "event", room: withEv.name, event: withEv.event, negate: false },
        names,
        a,
      ) !== null,
      `event ${withEv.event} @ ${withEv.name}`,
    );
  } else {
    assert(false, "SITE19 should have events");
  }

  if (a.pdEarlyEscape?.event) {
    assert(
      evalFilter(
        model,
        { type: "event", room: "tunnel_pd", event: a.pdEarlyEscape.event, negate: false },
        names,
        a,
      ) !== null,
      `event ${a.pdEarlyEscape.event} @ tunnel_pd`,
    );
    assert(
      evalFilter(model, { type: "room", room: "tunnel_pd", negate: false }, names, a) !== null,
      "tunnel_pd room present when pdEarlyEscape exists",
    );
  }
}

console.log(failed ? `\n✗ ${failed} assertion(s) failed` : "\n✓ filter tests ok");
process.exit(failed ? 1 : 0);
