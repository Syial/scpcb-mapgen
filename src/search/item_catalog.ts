import fillerItems from "../generation/filler_items.json";

// Catalogue items FillRoom (+ extras RNG hors JSON).

export interface ItemOption {
  name: string;
  tempname: string;
}

const CATALOG = fillerItems as Record<string, ItemOption[]>;

/** Possibles pour les salles RNG (hors catalog JSON). */
const RNG_ITEMS: Record<string, ItemOption[]> = {
  room1archive: [
    { name: "9V Battery", tempname: "bat" },
    { name: "Document SCP-1123", tempname: "paper" },
    { name: "Document SCP-1048", tempname: "paper" },
    { name: "Document SCP-939", tempname: "paper" },
    { name: "Document SCP-682", tempname: "paper" },
    { name: "Document SCP-079", tempname: "paper" },
    { name: "Document SCP-096", tempname: "paper" },
    { name: "Level 1 Key Card", tempname: "key1" },
    { name: "Level 2 Key Card", tempname: "key2" },
    { name: "First Aid Kit", tempname: "firstaid" },
    { name: "S-NAV 300 Navigator", tempname: "nav" },
    { name: "Radio Transceiver", tempname: "radio" },
    { name: "Clipboard", tempname: "clipboard" },
    { name: "Playing Card", tempname: "misc" },
    { name: "Mastercard", tempname: "misc" },
    { name: "Origami", tempname: "misc" },
  ],
  room2closets: [
    { name: "Document SCP-1048", tempname: "paper" },
    { name: "Gas Mask", tempname: "gasmask" },
    { name: "9V Battery", tempname: "bat" },
    { name: "Level 1 Key Card", tempname: "key1" },
    { name: "Clipboard", tempname: "clipboard" },
    { name: "Incident Report SCP-1048-A", tempname: "paper" },
  ],
  room3servers: [
    { name: "9V Battery", tempname: "bat" },
    { name: "S-NAV 300 Navigator", tempname: "nav" },
  ],
  room2offices2: [
    { name: "Level 1 Key Card", tempname: "key1" },
    { name: "Document SCP-895", tempname: "paper" },
    { name: "Document SCP-860", tempname: "paper" },
    { name: "SCP-093 Recovered Materials", tempname: "paper" },
    { name: "S-NAV 300 Navigator", tempname: "nav" },
  ],
  room2offices3: [
    { name: "Mobile Task Forces", tempname: "paper" },
    { name: "Security Clearance Levels", tempname: "paper" },
    { name: "Object Classes", tempname: "paper" },
    { name: "Document", tempname: "paper" },
    { name: "Radio Transceiver", tempname: "radio" },
    { name: "ReVision Eyedrops", tempname: "eyedrops" },
    { name: "9V Battery", tempname: "bat" },
  ],
  room860: [
    { name: "Document SCP-860-1", tempname: "paper" },
    { name: "Document SCP-860", tempname: "paper" },
  ],
  start: [
    { name: "Class D Orientation Leaflet", tempname: "paper" },
    { name: "Document SCP-173", tempname: "paper" },
  ],
  room2tunnel: [
    { name: "SCP-500-01", tempname: "scp500" },
    { name: "Night Vision Goggles", tempname: "nvgoggles" },
  ],
};

function dedupe(items: ItemOption[]): ItemOption[] {
  const seen = new Set<string>();
  const out: ItemOption[] = [];
  for (const it of items) {
    const k = `${it.tempname}\0${it.name}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Items pouvant apparaître dans cette salle (catalog + RNG + extras). */
export function possibleItemsForRoom(room: string): ItemOption[] {
  const base = CATALOG[room] ?? [];
  const rng = RNG_ITEMS[room] ?? [];
  return dedupe([...base, ...rng]);
}

export function roomsWithItems(): string[] {
  const names = new Set([...Object.keys(CATALOG), ...Object.keys(RNG_ITEMS)]);
  return [...names].sort();
}

export function itemKey(it: { name: string; tempname: string }): string {
  return `${it.tempname}::${it.name}`;
}

export function parseItemKey(key: string): ItemOption | null {
  const i = key.indexOf("::");
  if (i < 0) return null;
  return { tempname: key.slice(0, i), name: key.slice(i + 2) };
}
