import { BlitzRng } from "../rng/blitz_rng";
import { genForestGrid, placeForestRng, type ForestLog } from "./forest";
export type { ForestLog };
import lightCounts from "./light_counts.json";
import fillerDraws from "./filler_template_draws.json";
import fillerItems from "./filler_items.json";

const LIGHTS = lightCounts as Record<string, number>;
const DRAWS = fillerDraws as Record<string, number>;
const CATALOG = fillerItems as Record<string, { name: string; tempname: string; state?: number }[]>;

/** Item placé par FillRoom (ou inventaire start). */
export interface RoomItem {
  name: string;
  tempname: string;
  /** inventaire joueur (start sans intro), pas au sol */
  inventory?: boolean;
  /** it\state FillRoom (batterie nav/radio/nvg…) - littéral, pas RNG */
  state?: number;
}

function pushItem(
  out: RoomItem[],
  name: string,
  tempname: string,
  opts: { inventory?: boolean; state?: number } = {},
): void {
  out.push({
    name,
    tempname,
    ...(opts.inventory ? { inventory: true } : {}),
    ...(opts.state !== undefined ? { state: opts.state } : {}),
  });
}

/** CreateItem → toujours 1× Rand(360) (yaw). */
function createItem(
  rng: BlitzRng,
  out: RoomItem[],
  name: string,
  tempname: string,
  state?: number,
): void {
  rng.next();
  pushItem(out, name, tempname, state !== undefined ? { state } : {});
}

// room1archive (4655-4726)
function room1archive(rng: BlitzRng, out: RoomItem[]): void {
  const docs = ["1123", "1048", "939", "682", "079", "096"]; // Case 6 dupliqué (966) mort en Blitz
  for (let xtemp = 0; xtemp <= 1; xtemp++) {
    for (let ytemp = 0; ytemp <= 2; ytemp++) {
      for (let ztemp = 0; ztemp <= 2; ztemp++) {
        const chance = rng.randInt(-10, 100);
        if (chance < 0) break;
        let name = "9V Battery";
        let temp = "bat";
        if (chance < 40) {
          const d = rng.randInt(1, 6);
          name = "Document SCP-" + docs[d - 1];
          temp = "paper";
        } else if (chance < 45) {
          const lvl = rng.randInt(1, 2);
          name = "Level " + lvl + " Key Card";
          temp = "key" + lvl;
        } else if (chance < 50) {
          name = "First Aid Kit";
          temp = "firstaid";
        } else if (chance < 60) {
          name = "9V Battery";
          temp = "bat";
        } else if (chance < 70) {
          name = "S-NAV 300 Navigator";
          temp = "nav";
        } else if (chance < 85) {
          name = "Radio Transceiver";
          temp = "radio";
        } else if (chance < 95) {
          name = "Clipboard";
          temp = "clipboard";
        } else {
          const misc = rng.randInt(1, 3);
          name = misc === 1 ? "Playing Card" : misc === 2 ? "Mastercard" : "Origami";
          temp = "misc";
        }
        rng.next(); // Rnd(-96,96) sur z
        createItem(rng, out, name, temp);
      }
    }
  }
  rng.next(); // CreateDoor
}

function room2closets(rng: BlitzRng, out: RoomItem[]): void {
  createItem(rng, out, "Document SCP-1048", "paper");
  createItem(rng, out, "Gas Mask", "gasmask");
  createItem(rng, out, "9V Battery", "bat");
  if (rng.randInt(2) === 1) createItem(rng, out, "9V Battery", "bat");
  if (rng.randInt(2) === 1) createItem(rng, out, "9V Battery", "bat");
  createItem(rng, out, "Level 1 Key Card", "key1");
  createItem(rng, out, "Clipboard", "clipboard");
  createItem(rng, out, "Incident Report SCP-1048-A", "paper");
  rng.next(); // CreateDoor
}

function room3servers(rng: BlitzRng, out: RoomItem[]): void {
  createItem(rng, out, "9V Battery", "bat");
  if (rng.randInt(2) === 1) createItem(rng, out, "9V Battery", "bat");
  if (rng.randInt(2) === 1) createItem(rng, out, "9V Battery", "bat");
  createItem(rng, out, "S-NAV 300 Navigator", "nav", 20);
}

function room2offices2(rng: BlitzRng, out: RoomItem[]): void {
  createItem(rng, out, "Level 1 Key Card", "key1");
  createItem(rng, out, "Document SCP-895", "paper");
  if (rng.randInt(2) === 1) createItem(rng, out, "Document SCP-860", "paper");
  else createItem(rng, out, "SCP-093 Recovered Materials", "paper");
  createItem(rng, out, "S-NAV 300 Navigator", "nav", 28);
  rng.randInt(1, 4); // duck position
}

function room2offices3(rng: BlitzRng, out: RoomItem[]): void {
  if (rng.randInt(2) === 1) createItem(rng, out, "Mobile Task Forces", "paper");
  else createItem(rng, out, "Security Clearance Levels", "paper");
  createItem(rng, out, "Object Classes", "paper");
  createItem(rng, out, "Document", "paper");
  createItem(rng, out, "Radio Transceiver", "radio");
  let i = 0;
  for (;;) {
    const bound = rng.randInt(0, 1);
    if (i > bound) break;
    createItem(rng, out, "ReVision Eyedrops", "eyedrops");
    i++;
  }
  createItem(rng, out, "9V Battery", "bat");
  if (rng.randInt(2) === 1) createItem(rng, out, "9V Battery", "bat");
  if (rng.randInt(2) === 1) createItem(rng, out, "9V Battery", "bat");
  rng.next(); // CreateDoor
}

function room860(rng: BlitzRng, out: RoomItem[]): { grid: number[]; logs: ForestLog[] } {
  rng.next();
  rng.next();
  rng.next();
  rng.next(); // 4 CreateDoor
  const grid = genForestGrid(rng);
  const logs = placeForestRng(rng, grid);
  for (const log of logs) pushItem(out, log.name, log.tempname);
  createItem(rng, out, "Document SCP-860-1", "paper");
  createItem(rng, out, "Document SCP-860", "paper");
  return { grid, logs };
}

/** FillRoom : RNG + items, même ordre de tirages (bit-exact). */
export function consumeFiller(
  rng: BlitzRng,
  name: string,
  grid?: number[][],
  gx?: number,
  gy?: number,
): { forest?: { grid: number[]; logs: ForestLog[] }; items: RoomItem[] } {
  const items: RoomItem[] = [];
  let forest: { grid: number[]; logs: ForestLog[] } | undefined;

  if (name === "room860") {
    forest = room860(rng, items);
  } else if (name === "room1archive") {
    room1archive(rng, items);
  } else if (name === "room2closets") {
    room2closets(rng, items);
  } else if (name === "room3servers") {
    room3servers(rng, items);
  } else if (name === "room2offices2") {
    room2offices2(rng, items);
  } else if (name === "room2offices3") {
    room2offices3(rng, items);
  } else if (name === "checkpoint1" || name === "checkpoint2") {
    rng.next();
    rng.next();
    if (grid && gx !== undefined && gy !== undefined) {
      const above = gy - 1 >= 0 ? grid[gx][gy - 1] : 0;
      if (above === 0) rng.next();
    }
  } else {
    // pocketdimension = 9 : item + 2 portes + Rnd(0.8) + 5× Rnd(0.5)
    const n = DRAWS[name] ?? 0;
    for (let k = 0; k < n; k++) rng.next();
    const cat = CATALOG[name];
    if (cat) for (const it of cat) pushItem(items, it.name, it.tempname, { state: it.state });
  }

  const lightDraws = 2 * Math.min(LIGHTS[name] ?? 0, 32);
  for (let k = 0; k < lightDraws; k++) rng.next();

  return { forest, items };
}
