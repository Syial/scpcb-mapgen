import { generateMap, generateMapFromNumber, type MapModel } from "./generation";
import { buildScene, type Scene } from "./render/geometry";
import { renderSvg } from "./render/svg_renderer";
import { renderTunnels } from "./render/tunnels_renderer";
import { renderForest } from "./render/forest_renderer";
import { calculateRoomExtents } from "./generation/overlap";
import { analyseMap } from "./analysis";
import { zoneName } from "./render/theme";
import roomNames from "./room_names.json";
import { officeToTunnels, tunnelsToOffice } from "./codes";
import type { ScanReply, ScanMatch } from "./scan_worker";
import "./style.css";

const CELL = 40;
const MOD_MAX = 2147483647;
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;

// pupitre
const tabTrace = $("#tab-trace"), tabSearch = $("#tab-search");
const barTrace = $<HTMLFormElement>("#bar-trace"), barSearch = $<HTMLFormElement>("#bar-search");
const seedInput = $<HTMLInputElement>("#seed"), introBox = $<HTMLInputElement>("#intro"), modBox = $<HTMLInputElement>("#mod");
const anomalousBox = $<HTMLInputElement>("#anomalous");
const randomBtn = $("#random"), alertLine = $("#alert-line");
const fromInput = $<HTMLInputElement>("#from"), toInput = $<HTMLInputElement>("#to");
const sIntro = $<HTMLInputElement>("#s-intro"), sMod = $<HTMLInputElement>("#s-mod");
const progress = $("#progress"), scanBtn = $<HTMLButtonElement>("#scan-btn");
// écrans
const screenMap = $("#screen-map"), mapBox = $("#map");
const miniTunnels = $("#mini-tunnels");
const miniForest = $("#mini-forest");
// colonne
const panelInspect = $("#panel-inspect"), panelSearch = $("#panel-search");
const selName = $("#sel-name"), selMeta = $("#sel-meta"), selBody = $("#sel-body");
const missingBox = $("#missing"), counts = $("#counts"), bits = $("#bits");
const resultsBox = $("#results"), resCount = $("#res-count");

let scene: Scene | null = null;
let model: MapModel | null = null;

const displayName = (n: string): string | null => (roomNames.names as Record<string, string>)[n] ?? null;

const dv = new DataView(new ArrayBuffer(4));
const toBits = (n: number) => { dv.setFloat32(0, n); return dv.getInt32(0) >>> 0; };
const hex = (n: number) => "0x" + n.toString(16).toUpperCase().padStart(8, "0");

function trace(seed: string, intro: boolean, mod: boolean) {
  if (!seed) return;
  if (mod) {
    const n = Number(seed);
    if (!Number.isInteger(n) || n < 1 || n > MOD_MAX) {
      selName.textContent = "invalid seed";
      selMeta.textContent = `mod mode: integer between 1 and ${MOD_MAX}`;
      return;
    }
    model = generateMapFromNumber(n, seed, 18, intro);
  } else {
    model = generateMap(seed, 18, intro);
  }
  scene = buildScene(model, { cell: CELL, showAnomalous: anomalousBox.checked });

  const a = analyseMap(model);

  // carte infinissable : cadre rouge, les salles gardent leur couleur
  mapBox.innerHTML = renderSvg(scene);
  miniTunnels.innerHTML = renderTunnels(model.tunnels) + '<span class="cap">Maintenance tunnels</span>';
  // la forêt n'existe que si room860 est dans la carte
  if (model.forest) {
    miniForest.innerHTML = renderForest(model.forest) + '<span class="cap">SCP-860 forest</span>';
    miniForest.classList.remove("off");
  } else {
    miniForest.innerHTML = "";
    miniForest.textContent = "SCP-860 absent";
    miniForest.classList.add("off");
  }
  screenMap.classList.toggle("alert", !a.finishable);
  alertLine.hidden = a.finishable;

  missingBox.innerHTML = a.missing.length
    ? a.missing
        .map((m) => {
          // nom d'affichage en titre, nom technique en sous-ligne
          const disp = displayName(m.name);
          const title = disp ?? m.name;
          const sub = disp ? `${m.name} — ${m.effect}` : m.effect;
          return `<div class="gone ${m.severity === "blocking" ? "blocking" : ""}">` +
            `<b>${title}</b><span>${sub}</span></div>`;
        })
        .join("")
    : `<p class="none">None. Every mandatory room found a slot.</p>`;

  counts.textContent = `${model.rooms.length} rooms · ${model.doors.length} doors · hash ${model.seedNumber}`;
  selName.textContent = "—";
  selMeta.textContent = "hover a room";
  selBody.innerHTML = "";
  bits.innerHTML = "";
}

function select(i: number) {
  if (!scene) return;
  const sr = scene.rooms[i];
  const r = sr.room;
  // nom commun d'abord, nom technique en méta
  const disp = r.name ? displayName(r.name) : null;
  selName.textContent = disp ?? (r.name || "generic room");
  selMeta.textContent = `${disp && r.name ? r.name + " · " : ""}${zoneName[r.zone]} · ${r.gx},${r.gy}`;
  selBody.innerHTML = "";

  if (!sr.tracked) {
    bits.innerHTML = `<tr><td colspan="3">Untracked room — <code>DisableOverlapCheck</code>: no extents computed.</td></tr>`;
    return;
  }
  const e = calculateRoomExtents(r, r.angle ?? 0);
  if (!e) { bits.innerHTML = ""; return; }
  const rows: [string, number][] = [
    ["MinX", e.minX], ["MinY", e.minY], ["MinZ", e.minZ],
    ["MaxX", e.maxX], ["MaxY", e.maxY], ["MaxZ", e.maxZ],
  ];
  bits.innerHTML = rows
    .map(([k, v]) => `<tr><td>${k}</td><td class="hex">${hex(toBits(v))}</td><td>${v.toFixed(4)}</td></tr>`)
    .join("");
}

for (const ev of ["mouseover", "focusin"] as const) {
  mapBox.addEventListener(ev, (e) => {
    const g = (e.target as Element).closest<SVGGElement>("g.room");
    if (g?.dataset.i) select(+g.dataset.i);
  });
}

barTrace.addEventListener("submit", (e) => {
  e.preventDefault();
  trace(seedInput.value.trim(), introBox.checked, modBox.checked);
});
introBox.addEventListener("change", () => trace(seedInput.value.trim(), introBox.checked, modBox.checked));
anomalousBox.addEventListener("change", () => trace(seedInput.value.trim(), introBox.checked, modBox.checked));
randomBtn.addEventListener("click", () => {
  seedInput.value = String(1 + Math.floor(Math.random() * (modBox.checked ? MOD_MAX : 999999)));
  trace(seedInput.value, introBox.checked, modBox.checked);
});

let worker: Worker | null = null;
let scanning = false;
let shown = 0;
const SHOW_MAX = 300;

function setMode(search: boolean) {
  tabTrace.classList.toggle("on", !search);
  tabSearch.classList.toggle("on", search);
  tabTrace.setAttribute("aria-selected", String(!search));
  tabSearch.setAttribute("aria-selected", String(search));
  barTrace.hidden = search;
  barSearch.hidden = !search;
  panelInspect.hidden = search;
  panelSearch.hidden = !search;
}
tabTrace.addEventListener("click", () => setMode(false));
tabSearch.addEventListener("click", () => setMode(true));

function addResult(m: ScanMatch) {
  if (shown >= SHOW_MAX) return;
  shown++;
  const div = document.createElement("div");
  div.className = "res" + (m.finishable ? "" : " bad");
  div.dataset.seed = m.seed;
  const who = m.missing.length ? m.missing.join(", ") : m.overlaps.join(", ");
  div.innerHTML = `<span>${m.seed}</span><span class="who">${who}</span>`;
  resultsBox.appendChild(div);
}

// Survol = preview de la carte ; clic = garder et repasser en TRACE.
resultsBox.addEventListener("mouseover", (e) => {
  const el = (e.target as Element).closest<HTMLElement>(".res");
  if (!el?.dataset.seed) return;
  resultsBox.querySelector(".res.on")?.classList.remove("on");
  el.classList.add("on");
  trace(el.dataset.seed, sIntro.checked, sMod.checked);
});
resultsBox.addEventListener("click", (e) => {
  const el = (e.target as Element).closest<HTMLElement>(".res");
  if (!el?.dataset.seed) return;
  seedInput.value = el.dataset.seed;
  introBox.checked = sIntro.checked;
  modBox.checked = sMod.checked;
  setMode(false);
  trace(el.dataset.seed, introBox.checked, modBox.checked);
});

function stopScan(finalText?: string) {
  worker?.postMessage({ cmd: "stop" });
  scanning = false;
  scanBtn.textContent = "Scan";
  if (finalText) progress.textContent = finalText;
}

barSearch.addEventListener("submit", (e) => {
  e.preventDefault();
  if (scanning) { stopScan(); return; }

  const mod = sMod.checked;
  const max = mod ? MOD_MAX : 999999999;
  const from = Math.max(mod ? 1 : 0, Math.floor(Number(fromInput.value) || 0));
  const to = Math.min(max, Math.floor(Number(toInput.value) || 0));
  if (to < from) { progress.textContent = "empty range"; return; }

  const missing = [...document.querySelectorAll<HTMLInputElement>(".c-miss:checked")].map((c) => c.value);
  const unfinishable = $<HTMLInputElement>("#c-unfin").checked;
  const overlap = $<HTMLInputElement>("#c-overlap").checked;
  if (!missing.length && !unfinishable && !overlap) { progress.textContent = "no criteria"; return; }

  resultsBox.innerHTML = "";
  resCount.textContent = "";
  shown = 0;
  scanning = true;
  scanBtn.textContent = "Stop";

  worker ??= new Worker(new URL("./scan_worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (ev: MessageEvent<ScanReply>) => {
    const msg = ev.data;
    if (msg.type === "progress") {
      progress.textContent = `${msg.done.toLocaleString("en")} / ${(to - from + 1).toLocaleString("en")} · ${msg.found} found`;
      resCount.textContent = `· ${msg.found}`;
    } else if (msg.type === "batch") {
      msg.matches.forEach(addResult);
    } else if (msg.type === "done") {
      stopScan(`done: ${msg.scanned.toLocaleString("en")} scanned · ${msg.found} found`);
      resCount.textContent = `· ${msg.found}${msg.found > SHOW_MAX ? ` (${SHOW_MAX} shown)` : ""}`;
    }
  };
  worker.postMessage({ cmd: "start", mode: mod ? "mod" : "base", from, to, intro: sIntro.checked, missing, unfinishable, overlap });
});
const codeOffice = $<HTMLInputElement>("#code-office");
const codeTunnels = $<HTMLInputElement>("#code-tunnels");
const codeNote = $("#code-note");
let codeSync = false; // évite la boucle input→input

const clean = (el: HTMLInputElement) => { el.value = el.value.replace(/\D/g, "").slice(0, 4); };

codeOffice.addEventListener("input", () => {
  if (codeSync) return;
  clean(codeOffice);
  codeSync = true;
  const t = officeToTunnels(Number(codeOffice.value));
  if (codeOffice.value.length < 4) {
    codeTunnels.value = ""; codeNote.textContent = ""; codeNote.classList.remove("warn");
  } else if (t === null) {
    codeTunnels.value = "";
    codeNote.textContent = "Office code is four digits, each 1–9.";
    codeNote.classList.add("warn");
  } else {
    codeTunnels.value = String(t);
    codeNote.textContent = "";
    codeNote.classList.remove("warn");
  }
  codeSync = false;
});

codeTunnels.addEventListener("input", () => {
  if (codeSync) return;
  clean(codeTunnels);
  codeSync = true;
  codeOffice.value = "";
  if (codeTunnels.value.length < 4) {
    codeNote.textContent = ""; codeNote.classList.remove("warn");
  } else {
    const offices = tunnelsToOffice(Number(codeTunnels.value));
    if (!offices.length) {
      codeNote.textContent = "No office code produces this value.";
      codeNote.classList.add("warn");
    } else if (offices.length === 1) {
      codeOffice.value = String(offices[0]);
      codeNote.textContent = "";
      codeNote.classList.remove("warn");
    } else {
      codeNote.textContent = `${offices.length} candidates: ${offices.join(", ")}`;
      codeNote.classList.remove("warn");
    }
  }
  codeSync = false;
});

seedInput.value = "SITE19";
trace("SITE19", false, false);
