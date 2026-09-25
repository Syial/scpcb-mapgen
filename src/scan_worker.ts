import { generateMap, generateMapFromNumber, type MapModel } from "./generation";
import { analyseMap } from "./analysis";
import { evalFilter, type Filter } from "./search/filters";

// Scanner de seeds en Web Worker ; mode `base` (chaîne hashée) ou `mod` (nombre brut).

export interface ScanRequest {
  cmd: "start";
  mode: "base" | "mod";
  from: number;
  to: number; // inclus
  // filtres composables, cumul en ET
  filters: Filter[];
}
export interface ScanMatch {
  seed: string;
  finishable: boolean;
  notes: string[]; // une note par filtre satisfait
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
          ? generateMapFromNumber(i, String(i), 18, false)
          : generateMap(String(i), 18, false);
      done++;

      const a = analyseMap(model);
      const names = new Set(model.rooms.map((r) => r.name));
      const notes: string[] = [];
      let pass = true;
      for (const f of req.filters) {
        const note = evalFilter(model, f, names, a);
        if (note === null) { pass = false; break; }
        notes.push(note);
      }
      if (!pass) continue;

      found++;
      pending.push({ seed: String(i), finishable: a.finishable, notes });
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
