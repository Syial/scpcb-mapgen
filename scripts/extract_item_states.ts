// Extrait les états items (it\\state) depuis MapSystem.bb.
import { readFileSync } from "fs";
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

const re = /it\\state\s*=\s*([0-9.]+)/g;
let m: RegExpExecArray | null;
while ((m = re.exec(body))) {
  const before = body.slice(Math.max(0, m.index - 500), m.index);
  const items = [...before.matchAll(/CreateItem\("([^"]+)",\s*"([^"]+)"/g)];
  const last = items[items.length - 1];
  console.log(`${roomAt(m.index)}\t${last?.[1]}\t${last?.[2]}\t${m[1]}`);
}
