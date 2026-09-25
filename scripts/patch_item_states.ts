// Patche filler_items.json avec les états extraits.
import { readFileSync, writeFileSync } from "fs";

const cat = JSON.parse(readFileSync("src/generation/filler_items.json", "utf8")) as Record<
  string,
  { name: string; tempname: string; state?: number }[]
>;

const STATES: { room: string; name: string; tempname: string; state: number }[] = [
  { room: "roompj", name: "Radio Transceiver", tempname: "radio", state: 80 },
  { room: "room2testroom2", name: "S-NAV 300 Navigator", tempname: "nav", state: 20 },
  { room: "room966", name: "Night Vision Goggles", tempname: "nvgoggles", state: 300 },
  { room: "room3storage", name: "Night Vision Goggles", tempname: "nvgoggles", state: 450 },
  { room: "room2offices", name: "S-NAV 300 Navigator", tempname: "nav", state: 20 },
  { room: "coffin", name: "Night Vision Goggles", tempname: "nvgoggles", state: 400 },
  { room: "room2servers2", name: "Night Vision Goggles", tempname: "nvgoggles", state: 200 },
];

for (const s of STATES) {
  const list = cat[s.room];
  if (!list) throw new Error("missing room " + s.room);
  const it = list.find((i) => i.name === s.name && i.tempname === s.tempname);
  if (!it) throw new Error("missing item " + s.room + " " + s.name);
  it.state = s.state;
}

writeFileSync("src/generation/filler_items.json", JSON.stringify(cat, null, 1) + "\n");
console.log("patched states", STATES.length);
