// Compare plusieurs seeds contre des dumps SeedEvents.
import { generateMap } from "../src/generation/index";
import { readFileSync, writeFileSync } from "fs";
import { scpcbFile } from "./_paths";

function load(p: string) {
  const t = readFileSync(p, "utf8");
  const rooms: { n: string; xy: string; e: string; ang: string; sh: string }[] = [];
  let m = "";
  for (const line of t.split(/\r?\n/)) {
    if (line.startsWith("room\tgx")) {
      m = "rooms";
      continue;
    }
    if (m !== "rooms" || !line.trim()) continue;
    const a = line.split("\t");
    if (a.length >= 5)
      rooms.push({ n: a[0], xy: a[1], e: a[4] === "-" ? "" : a[4], ang: a[2], sh: a[3] });
  }
  return rooms;
}

const out: string[] = [];
for (const seed of ["ABC123", "TEST", "65535", "scp", "SITE19"]) {
  const path =
    seed === "SITE19"
      ? scpcbFile("SeedEvents.txt")
      : scpcbFile(`SeedEvents_${seed}.txt`);
  let g;
  try {
    g = load(path);
  } catch {
    out.push(`${seed}: no dump`);
    continue;
  }
  const o = generateMap(seed).rooms.map((r) => ({
    n: r.name,
    xy: `${r.gx},${r.gy}`,
    e: r.event || "",
    ang: String(r.angle ?? 0),
    sh: String(r.shape),
  }));
  let ord = 0,
    name = 0,
    ang = 0,
    ev = 0;
  const diffs: string[] = [];
  for (let i = 0; i < Math.max(g.length, o.length); i++) {
    if (!g[i] || !o[i] || g[i].n.toLowerCase() !== o[i].n.toLowerCase() || g[i].xy !== o[i].xy) {
      ord++;
      if (ord <= 3) diffs.push(`  ORD ${i} g=${g[i]?.xy}/${g[i]?.n} o=${o[i]?.xy}/${o[i]?.n}`);
    }
  }
  const by = new Map(o.map((x) => [x.xy, x]));
  for (const r of g) {
    const x = by.get(r.xy);
    if (!x) {
      name++;
      diffs.push(`  miss ${r.xy} ${r.n}`);
      continue;
    }
    if (x.n.toLowerCase() !== r.n.toLowerCase()) {
      name++;
      diffs.push(`  NAME ${r.xy} g=${r.n} o=${x.n}`);
    }
    if (String(x.ang) !== r.ang) {
      ang++;
      if (ang <= 5) diffs.push(`  ANG ${r.xy} ${r.n} g=${r.ang} o=${x.ang}`);
    }
    if ((x.e || "") !== (r.e || "")) {
      ev++;
      if (ev <= 8) diffs.push(`  EV ${r.xy} ${r.n} g=${r.e || "-"} o=${x.e || "-"}`);
    }
  }
  out.push(
    `${seed}: rooms=${g.length}/${o.length} orderCI=${ord} nameCI=${name} ang=${ang} ev=${ev}`,
  );
  out.push(...diffs);
}
writeFileSync("multi_cmp.txt", out.join("\n"));
