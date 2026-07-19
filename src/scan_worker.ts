import { generateMap, generateMapFromNumber, type MapModel } from "./generation";
import { residualOverlaps } from "./generation/overlap";
import { analyseMap } from "./analysis";

// Scanner de seeds en Web Worker ; mode `base` (chaîne hashée) ou `mod` (nombre brut).

export interface ScanRequest {
  cmd: "start";
  mode: "base" | "mod";
  from: number;
  to: number; // inclus
  intro: boolean;
  // toutes ces salles doivent être absentes (ET logique)
  missing: string[];
  unfinishable: boolean;
  // deux salles jouables encore superposées après l'anti-overlap (~9 % des seeds)
  overlap: boolean;
}
export interface ScanMatch {
  seed: string;
  finishable: boolean;
  missing: string[]; // salles notables absentes
  overlaps: string[]; // couples "a∩b" en overlap résiduel
}
export type ScanReply =
  | { type: "progress"; done: number; total: number; found: number }
  | { type: "batch"; matches: ScanMatch[] }
  | { type: "done"; scanned: number; found: number };

const BATCH = 800; // seeds traitées entre deux rendus de main
const REPORT_EVERY = 4000;

let stop = false;

self.onmessage = (e: MessageEvent<ScanRequest | { cmd: "stop" }>) => {
  if (e.data.cmd === "stop") { stop = true; return; }
  stop = false;
  run(e.data);
};

function run(req: ScanRequest) {
  const total = req.to - req.from + 1;
  let i = req.from, done = 0, found = 0, lastReport = 0;
  let pending: ScanMatch[] = [];

  const step = () => {
    const end = Math.min(i + BATCH - 1, req.to);
    for (; i <= end; i++) {
      const model: MapModel =
        req.mode === "mod"
          ? generateMapFromNumber(i, String(i), 18, req.intro)
          : generateMap(String(i), 18, req.intro);
      done++;

      const a = analyseMap(model);
      const absent = new Set(a.missing.map((m) => m.name));
      if (req.missing.length && !req.missing.every((n) => absent.has(n))) continue;
      if (req.unfinishable && a.finishable) continue;
      const overlaps = req.overlap ? residualOverlaps(model.rooms) : [];
      if (req.overlap && !overlaps.length) continue;

      found++;
      pending.push({
        seed: String(i),
        finishable: a.finishable,
        missing: a.missing.map((m) => m.name),
        overlaps: overlaps.map(([x, y]) => `${x}∩${y}`),
      });
    }

    if (pending.length && (pending.length >= 20 || i > req.to)) {
      (self as unknown as Worker).postMessage({ type: "batch", matches: pending } satisfies ScanReply);
      pending = [];
    }
    if (done - lastReport >= REPORT_EVERY || i > req.to) {
      lastReport = done;
      (self as unknown as Worker).postMessage({ type: "progress", done, total, found } satisfies ScanReply);
    }

    if (stop || i > req.to) {
      (self as unknown as Worker).postMessage({ type: "done", scanned: done, found } satisfies ScanReply);
      return;
    }
    setTimeout(step, 0); // rend la main pour pouvoir recevoir un stop
  };
  step();
}
