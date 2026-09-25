// Construit le catalog items depuis les extracts FillRoom.
import { readFileSync, writeFileSync } from "fs";

const raw = JSON.parse(readFileSync("scripts/_item_extract.json", "utf8")) as Record<
  string,
  { name: string; tempname: string; conditional: boolean }[]
>;

// Salles dont les items sont 100% RNG : gérées dans filler.ts, pas ce catalog.
const SKIP = new Set([
  "room1archive",
  "room2closets",
  "room3servers",
  "room2offices2",
  "room2offices3",
  "room860", // docs + forest logs emitted by handler
]);

const catalog: Record<string, { name: string; tempname: string }[]> = {};
for (const [room, items] of Object.entries(raw)) {
  if (SKIP.has(room)) continue;
  const fixed = items.filter((i) => !i.conditional).map((i) => ({ name: i.name, tempname: i.tempname }));
  // CreateItem("cup") then it\name overwritten in FillRoom
  if (room === "room2cafeteria") {
    const cups = fixed.filter((i) => i.name === "cup");
    if (cups[0]) cups[0].name = "Cup of Orange Juice";
    if (cups[1]) cups[1].name = "Cup of Coffee";
  }
  if (fixed.length) catalog[room] = fixed;
}

writeFileSync("src/generation/filler_items.json", JSON.stringify(catalog, null, 1) + "\n");
console.log("rooms", Object.keys(catalog).length, "items", Object.values(catalog).reduce((s, a) => s + a.length, 0));
