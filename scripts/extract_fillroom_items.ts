// Extrait les items FillRoom depuis MapSystem.bb (SCPCB_ROOT).
import { readFileSync, writeFileSync } from "fs";
import { scpcbFile } from "./_paths";

const src = readFileSync(scpcbFile("MapSystem.bb"), "utf8");
const start = src.indexOf("Function FillRoom");
const end = src.indexOf("\nEnd Function", start);
const body = src.slice(start, end);

const caseRe = /^\t\tCase ("[^"]+"(?:\s*,\s*"[^"]+")*)/gm;
const cases: { names: string[]; start: number; end: number }[] = [];
let m: RegExpExecArray | null;
while ((m = caseRe.exec(body))) {
  const names = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  cases.push({ names, start: m.index, end: 0 });
}
for (let i = 0; i < cases.length; i++) {
  cases[i].end = i + 1 < cases.length ? cases[i + 1].start : body.length;
}

type ItemHit = {
  name: string;
  tempname: string;
  rawArgs: string;
  line: number;
  conditional: boolean;
};

const out: Record<string, ItemHit[]> = {};
const lines: string[] = [];

for (const c of cases) {
  const block = body.slice(c.start, c.end);
  const blockLines = block.split(/\r?\n/);
  const items: ItemHit[] = [];
  for (let li = 0; li < blockLines.length; li++) {
    const line = blockLines[li];
    // strip comments
    const code = line.replace(/;.*$/, "");
    const re = /CreateItem\s*\(\s*"([^"]*)"\s*,\s*"([^"]*)"/g;
    let im: RegExpExecArray | null;
    while ((im = re.exec(code))) {
      // look back a few lines for If Rand
      const ctx = blockLines.slice(Math.max(0, li - 6), li + 1).join("\n");
      const conditional =
        /If\s+Rand\s*\(/i.test(ctx) ||
        /Else\b/.test(blockLines[li - 1] ?? "") ||
        /For\s+i\s*=\s*0\s+To\s+Rand/i.test(ctx) ||
        /Select\s+True/i.test(ctx) ||
        /Select\s+Rand/i.test(ctx) ||
        /Case\s*\(chance/i.test(ctx);
      items.push({
        name: im[1],
        tempname: im[2],
        rawArgs: code.trim(),
        line: li,
        conditional,
      });
    }
  }
  for (const name of c.names) {
    out[name] = items;
    lines.push(
      `${name}\t${items.length}\tfixed=${items.filter((i) => !i.conditional).length}\tcond=${items.filter((i) => i.conditional).length}`,
    );
    for (const it of items) {
      lines.push(`  ${it.conditional ? "?" : " "} "${it.name}" / ${it.tempname}`);
    }
  }
}

writeFileSync("scripts/_item_extract.txt", lines.join("\n"));
writeFileSync("scripts/_item_extract.json", JSON.stringify(out, null, 2));
console.log("rooms with items", Object.values(out).filter((a) => a.length).length);
