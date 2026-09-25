// Extrait keycards / codes portes FillRoom depuis MapSystem.bb.
import { readFileSync, writeFileSync } from "fs";
import { scpcbFile } from "./_paths";

const bb = readFileSync(scpcbFile("MapSystem.bb"), "utf8");
const fillStart = bb.indexOf("Function FillRoom");
const fillEnd = bb.indexOf("\nEnd Function", fillStart + 100);
const body = bb.slice(fillStart, fillEnd);

const cases = [...body.matchAll(/Case "([^"]+)"/g)].map((m) => ({
  name: m[1],
  idx: m.index!,
}));

function roomAt(i: number): string {
  let r = "?";
  for (const c of cases) {
    if (c.idx <= i) r = c.name;
    else break;
  }
  return r;
}

function splitArgs(args: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let inS = false;
  for (let i = 0; i < args.length; i++) {
    const ch = args[i];
    if (ch === '"') {
      inS = !inS;
      cur += ch;
      continue;
    }
    if (ch === "," && !inS) {
      parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}

/** keycard level, DNA scanner, or keypad code */
export type DoorMeta = {
  /** >0 keycard level ; -1 hand scanner ; -2 hand2 scanner */
  keycard?: number;
  /** fixed code, "AccessCode", or "TunnelsCode" */
  code?: string;
};

const byRoom = new Map<string, DoorMeta[]>();

function add(room: string, d: DoorMeta) {
  const list = byRoom.get(room) ?? [];
  list.push(d);
  byRoom.set(room, list);
}

const doorRe = /CreateDoor\(([^)]*)\)/g;
let m: RegExpExecArray | null;
while ((m = doorRe.exec(body))) {
  const parts = splitArgs(m[1]);
  const keycard = parts[8];
  const codeRaw = parts[9];
  const meta: DoorMeta = {};

  if (keycard !== undefined && keycard !== "" && keycard !== "False" && keycard !== "false") {
    if (/^-?\d+$/.test(keycard) && keycard !== "0") meta.keycard = Number(keycard);
  }
  if (codeRaw !== undefined && codeRaw !== "" && codeRaw !== '""') {
    if (codeRaw.includes("AccessCode")) meta.code = "AccessCode";
    else {
      const cm = codeRaw.match(/"([^"]*)"/);
      if (cm && cm[1] !== "") meta.code = cm[1];
      else if (codeRaw === "temp" || codeRaw.includes("temp")) {
        // room2tunnel : temp = (AccessCode*3) mod 10000
        meta.code = "TunnelsCode";
      }
    }
  }
  if (meta.keycard === undefined && meta.code === undefined) continue;
  add(roomAt(m.index), meta);
}

// Multi-name Case "a","b"
for (const mm of body.matchAll(/Case (("[\w]+")(,\s*"[\w]+")+)/g)) {
  const names = [...mm[1].matchAll(/"([\w]+)"/g)].map((x) => x[1]);
  const doors = byRoom.get(names[0]);
  if (!doors) continue;
  for (const n of names.slice(1)) {
    if (!byRoom.has(n)) byRoom.set(n, doors.map((d) => ({ ...d })));
  }
}

const catalog: Record<string, DoorMeta[]> = {};
for (const [k, v] of [...byRoom.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const seen = new Set<string>();
  catalog[k] = v.filter((d) => {
    const s = JSON.stringify(d);
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });
}

writeFileSync("src/generation/room_doors.json", JSON.stringify(catalog, null, 1) + "\n");
console.log("rooms", Object.keys(catalog).length);
