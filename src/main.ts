import { generateMap, generateMapFromNumber, type MapModel, type GenStep, applyGenStep, eventDescr } from "./generation";
import { buildStripScene } from "./render/strip_geometry";
import { renderStripSvg } from "./render/strip_renderer";
import { buildExtentScene } from "./render/extent_geometry";
import { renderExtentSvg } from "./render/extent_renderer";
import { fitMapViewBox } from "./render/fit_map_view";
import { renderTunnels } from "./render/tunnels_renderer";
import { renderForest } from "./render/forest_renderer";
import { analyseMap, earlyEscapeTunnel } from "./analysis";
import { zoneName, zoneCode, applyMapPalette } from "./render/theme";
import type { Scene } from "./render/geometry";
import { DEFAULT_CELL } from "./render/geometry";
import { esc as escHtml } from "./render/esc";
import { templates } from "./generation/selection";
import type { Filter } from "./search/filters";
import { catalogZones } from "./search/zones";
import { PD_ESCAPE_ROOM, PD_ESCAPE_TITLE, displayRoomTitle } from "./search/room_aliases";
import { possibleItemsForRoom, itemKey, parseItemKey, roomsWithItems } from "./search/item_catalog";
import { possibleEventsForRoom, roomsWithEvents } from "./search/event_catalog";
import roomNames from "./room_names.json";
import { officeToTunnels, tunnelsToOffice } from "./codes";
import type { ScanReply, ScanMatch } from "./scan_worker";
import {
  buildSession,
  downloadSession,
  readSessionFile,
  SESSION_RESULTS_MAX,
  sessionFileMaxMb,
  storeMatch,
  isVariableFilter,
  unpackVariable,
  type SearchSession,
  type StoredMatch,
} from "./search/session_io";
import { MOD_MAX, BASE_SEED_MAX } from "./seed_limits";
import "./style.css";
import "./themes/index.css";


/*
  Navigation main.ts
  - DOM toprail / map slots / rails
  - Search phase (compose | results)
  - Map Trace : paint, build anim, idle, trace()
  - Inspect salle
  - Search results + filter compose + room picker
  - Scan worker
  - Session I/O, Codes, About
  - Boot
*/

// --- Helpers DOM ---
const CELL = DEFAULT_CELL;
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;

// --- DOM : toprail (modes, seed, options, codes, about) ---
const tabTrace = $("#tab-trace"), tabSearch = $("#tab-search");
const barTrace = $<HTMLFormElement>("#bar-trace"), barSearch = $<HTMLFormElement>("#bar-search");
const seedInput = $<HTMLInputElement>("#seed"), modBox = $<HTMLInputElement>("#mod");
/** Lieux anomaux masqués (ancien toggle Options retiré). */
const SHOW_ANOMALOUS = false;
const extentsMapBox = $<HTMLInputElement>("#extents-map");
const oversizedMeshesBox = $<HTMLInputElement>("#oversized-meshes");
const speedrunLabelsBox = $<HTMLInputElement>("#speedrun-labels");
const minimalLabelsBox = $<HTMLInputElement>("#minimal-labels");
const genAnimBox = $<HTMLInputElement>("#gen-anim");
const chassis = $<HTMLElement>("main.chassis");
const randomBtn = $("#random");
const fromInput = $<HTMLInputElement>("#from"), toInput = $<HTMLInputElement>("#to");
const sMod = $<HTMLInputElement>("#s-mod");
const progress = $("#progress"), scanBtn = $<HTMLButtonElement>("#scan-btn");
const btnSessionIo = $<HTMLButtonElement>("#session-io-btn");
const sessionIoOverlay = $("#session-io-overlay");
const sessionExportBtn = $<HTMLButtonElement>("#session-export");
const sessionImportBtn = $<HTMLButtonElement>("#session-import");
const sessionIoLimits = $("#session-io-limits");
const sessionIoStatus = $("#session-io-status");
const btnCodes = $<HTMLButtonElement>("#codes-btn");
const codesOverlay = $("#codes-overlay");
const btnAbout = $<HTMLButtonElement>("#about-btn");
const aboutOverlay = $("#about-overlay");
const scanStats = $("#scan-stats");
const scanDone = $("#scan-done");
const scanFound = $("#scan-found");
const scanRate = $("#scan-rate");
const scanElapsed = $("#scan-elapsed");
const scanEta = $("#scan-eta");
const scanBar = $<HTMLElement>("#scan-bar");
// écrans
// --- DOM : map slots (facility / tunnels / forest) ---
const mapFacility = $("#map-facility");
const mapBuildPhase = $("#map-build-phase");
const mapBuildPhaseMain = $("#map-build-phase-main");
const mapBuildPhaseSub = $("#map-build-phase-sub");
const mapTunnels = $("#map-tunnels");
const mapForest = $("#map-forest");
const slotFacility = $<HTMLElement>(".map-slot-facility");
const slotTunnels = $<HTMLElement>(".map-slot-tunnels");
const slotForest = $<HTMLElement>(".map-slot-forest");
const colForest = $<HTMLElement>(".map-col-forest");
const subzoneInfoBody = $("#subzone-info-body");
const viewFacility = $<HTMLButtonElement>("#view-facility");
const viewSubzones = $<HTMLButtonElement>("#view-subzones");
type MapView = "facility" | "subzones";
let mapView: MapView = "facility";
let hasForest = false;

/** Une seule vue : facility (avec inspect) ou subzones (tunnels + forêt). */
// --- Vues map : Facility | Subzones ---
function syncMapVisibility() {
  const facility = mapView === "facility";
  const sub = mapView === "subzones";
  chassis.dataset.map = mapView;
  slotFacility.hidden = !facility;
  slotTunnels.hidden = !sub;
  colForest.hidden = !sub;
  slotForest.hidden = !sub;
  mapFacility.hidden = !facility;
  mapTunnels.hidden = !sub;
  mapForest.hidden = !sub;
}

function setMapView(view: MapView) {
  mapView = view;
  for (const [btn, v] of [[viewFacility, "facility"], [viewSubzones, "subzones"]] as const) {
    const on = v === view;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-selected", String(on));
  }
  syncMapVisibility();
  requestAnimationFrame(() => {
    fitMapViewBox(mapFacility);
    fitMapViewBox(mapTunnels);
    fitMapViewBox(mapForest);
  });
}

// --- DOM : status, rails inspect/search, filter UI ---
const statusBadge = $("#status-badge");
const seedStats = $("#seed-stats");
const mapMissing = $("#map-missing");
const sideSearch = $("#side-search");
const viewTabs = $<HTMLElement>(".view-tabs");
const panelInspect = $("#panel-inspect");
const selName = $("#sel-name"), selMeta = $("#sel-meta"), selBody = $("#sel-body");
const fbuild = $("#fbuild");
const searchResults = $("#search-results");
const resultsBox = $("#results");
const resultsTools = $("#results-tools");
const resultsPager = $("#results-pager");
const resultsPrev = $<HTMLButtonElement>("#results-prev");
const resultsNext = $<HTMLButtonElement>("#results-next");
const resultsPageLabel = $("#results-page-label");
const filterSummary = $<HTMLButtonElement>("#fb-summary");
const filterPopover = $("#fb-popover");
const filterMenu = $("#filter-menu");
const phaseTog = $("#search-phase-tog");

// --- Search phase : compose | results ---
type SearchPhase = "compose" | "results";
let searchPhase: SearchPhase = "compose";
let hasScanSession = false;

function closeFilterPopover() {
  filterPopover.hidden = true;
  filterSummary.setAttribute("aria-expanded", "false");
}

function openFilterPopover() {
  filterPopover.hidden = false;
  filterSummary.setAttribute("aria-expanded", "true");
}

function syncPhaseTog() {
  phaseTog.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
    const phase = b.dataset.phase as SearchPhase;
    b.classList.toggle("on", phase === searchPhase);
    if (phase === "results") b.disabled = !hasScanSession;
    else b.disabled = scanning;
  });
}

function setSearchPhase(phase: SearchPhase) {
  if (phase === "results" && !hasScanSession) return;
  if (phase === "compose" && scanning) return;
  searchPhase = phase;
  chassis.classList.toggle("search-compose", phase === "compose");
  chassis.classList.toggle("search-results", phase === "results");
  fbuild.hidden = phase !== "compose";
  searchResults.hidden = phase !== "results";
  syncPhaseTog();
  closeFilterPopover();
  if (phase === "compose") {
    syncFbParams();
    paintFlyList(flyQ.value.trim() ? "top" : "none");
  } else {
    clearPickTarget();
  }
}

// --- État Trace (scene + model courant) ---
let scene: Scene | null = null;
let model: MapModel | null = null;

// hors mod : pas de plafond jeu ; UI bornée à 20 caractères (largeur fixe du champ)
const SEED_CHARS = 20;
seedInput.maxLength = SEED_CHARS;

const displayName = (n: string): string | null => (roomNames.names as Record<string, string>)[n] ?? null;
const displayRoom = (n: string) => displayRoomTitle(n, roomNames.names as Record<string, string>);


viewFacility.addEventListener("click", () => setMapView("facility"));
viewSubzones.addEventListener("click", () => setMapView("subzones"));

// --- Map Trace : paint facility / subzones / pin ---
/** Index salle épinglée (clic) - le hover ne fait qu’un aperçu temporaire. */
let pinnedRoom: number | null = null;

function szRow(mark: string, text: string) {
  return (
    `<div class="sz-row">` +
      `<span class="sz-mark">${mark}</span>` +
      `<span class="sz-text">${text}</span>` +
    `</div>`
  );
}

function paintSubzonePanel(m: MapModel) {
  const tunRoom = m.rooms.find((r) => r.name === "room2tunnel");
  const forestRoom = m.rooms.find((r) => r.name === "room860");

  const accessLine = (r: { name: string; zone: number; gx: number; gy: number } | undefined, missing: string) => {
    if (!r) return `<div class="sz-row"><span class="sz-text">${missing}</span></div>`;
    const name = escHtml(displayName(r.name) ?? r.name);
    const zone = escHtml(zoneName[r.zone] ?? `zone ${r.zone}`);
    return (
      `<div class="sz-row">` +
        `<span class="sz-text">${name}<span class="sz-meta"> · ${zone} · ${r.gx},${r.gy}</span></span>` +
      `</div>`
    );
  };

  subzoneInfoBody.innerHTML =
    `<div class="sec"><div class="sec-label">access</div><div class="sec-body sz-list">` +
      accessLine(tunRoom, "room2tunnel missing") +
      accessLine(forestRoom, "room860 missing") +
    `</div></div>` +
    `<div class="sec"><div class="sec-body legend-split">` +
      `<div class="legend-col">` +
        `<div class="sec-label">Tunnels</div>` +
        `<div class="sz-list">` +
          szRow("A / B", "Elevators") +
          szRow("GEN", "Generator") +
        `</div>` +
      `</div>` +
      `<div class="legend-col">` +
        `<div class="sec-label">SCP-860-1</div>` +
        `<div class="sz-list">` +
          szRow("A / B", "Doors") +
          szRow("#n", "Log document") +
        `</div>` +
      `</div>` +
    `</div>`;
}

function paintFacilityFrame(
  m: MapModel,
  layoutRooms?: MapModel["rooms"],
  fit = true,
  pendingAll = false,
) {
  const geo = {
    cell: CELL,
    showAnomalous: SHOW_ANOMALOUS,
    oversizedMeshes: oversizedMeshesBox.checked,
    speedrunLabels: speedrunLabelsBox.checked,
    minimalLabels: minimalLabelsBox.checked,
    layoutRooms,
  };
  if (extentsMapBox.checked) {
    scene = buildExtentScene(m, geo);
    mapFacility.innerHTML = renderExtentSvg(scene, { pendingAll });
  } else {
    const strip = buildStripScene(m, geo);
    scene = strip;
    mapFacility.innerHTML = renderStripSvg(strip, { roomShapes: true, pendingAll });
  }
  if (fit) fitMapViewBox(mapFacility);
}

function setAnimRoomAtCell(gx: number, gy: number, pending: boolean) {
  const g = mapFacility.querySelector(`g.room[data-gx="${gx}"][data-gy="${gy}"]`);
  if (!g) return;
  g.classList.toggle("is-pending", pending);
  const i = g.getAttribute("data-i");
  if (i !== null) {
    mapFacility.querySelector(`g.spawn-marker[data-i="${i}"]`)?.classList.toggle("is-pending", pending);
  }
}

/** Rejoue place+identify (deltas) → état juste avant overlap. */
function roomsBeforeOverlap(steps: GenStep[]): MapModel["rooms"] {
  const rooms: MapModel["rooms"] = [];
  for (const step of steps) {
    if (step.phase === "overlap") break;
    applyGenStep(rooms, step);
  }
  return rooms;
}

function paintMaps(m: MapModel) {
  setBuildPhase(null);
  paintFacilityFrame(m);

  const tunFilled = m.tunnels.cells.some((c) => c > 0);
  const tunNote = m.tunnels.ok
    ? ""
    : `<p class="map-empty">${
        tunFilled
          ? "Tunnels incomplete - game crashes on enter (no valid entrance/exit)"
          : "Tunnels invalid - entrance equals exit"
      }</p>`;
  mapTunnels.innerHTML = tunFilled
    ? renderTunnels(m.tunnels) + tunNote
    : tunNote;

  hasForest = !!m.forest;
  slotForest.classList.toggle("is-absent", !hasForest);
  if (m.forest) {
    mapForest.innerHTML = renderForest(m.forest.grid, m.forest.logs);
  } else {
    mapForest.innerHTML = `<p class="map-empty">SCP-860-1 absent</p>`;
  }

  paintSubzonePanel(m);

  syncMapVisibility();
  fitMapViewBox(mapTunnels);
  fitMapViewBox(mapForest);
  // re-épingle après re-render SVG
  if (pinnedRoom !== null && scene?.rooms[pinnedRoom]) {
    select(pinnedRoom);
    syncPinnedHighlight();
  } else {
    pinnedRoom = null;
  }
}

let mapFitObserver: ResizeObserver | null = null;
function ensureMapFitObserver() {
  if (mapFitObserver) return;
  mapFitObserver = new ResizeObserver(() => {
    fitMapViewBox(mapFacility);
    fitMapViewBox(mapTunnels);
    fitMapViewBox(mapForest);
  });
  mapFitObserver.observe(mapFacility);
  mapFitObserver.observe(mapTunnels);
  mapFitObserver.observe(mapForest);
}

// --- Map Trace : build anim (CreateRoom / PreventRoomOverlap) ---
const GEN_ANIM_MS: Record<GenStep["phase"], number> = {
  place: 18, // vague lisible (~2 s pour ~100 salles)
  identify: 5, // quasi rien à l'écran → phase courte
  overlap: 95, // chaque swap/rotate bien perceptible
};

const GEN_ANIM_LABEL: Record<GenStep["phase"], string> = {
  place: "CreateRoom()",
  identify: "CreateRoom()",
  overlap: "PreventRoomOverlap()",
};

const IDLE_CLEAR_MS = GEN_ANIM_MS.place;

let genAnimToken = 0;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setBuildPhase(main: string | null, sub?: string | null) {
  if (!main) {
    mapBuildPhase.hidden = true;
    mapBuildPhaseMain.textContent = "";
    mapBuildPhaseSub.textContent = "";
    mapBuildPhaseSub.hidden = true;
    return;
  }
  mapBuildPhase.hidden = false;
  mapBuildPhaseMain.textContent = main;
  if (sub) {
    mapBuildPhaseSub.hidden = false;
    mapBuildPhaseSub.textContent = sub;
  } else {
    mapBuildPhaseSub.hidden = true;
    mapBuildPhaseSub.textContent = "";
  }
}

function setWaitingStatus() {
  statusBadge.textContent = "Waiting…";
  seedStats.classList.remove("ok", "warn", "bad");
  mapMissing.hidden = true;
  mapMissing.innerHTML = "";
}

function finishTraceStatus(m: MapModel) {
  const a = analyseMap(m);

  statusBadge.textContent = a.finishable ? "Finishable" : "Unfinishable";
  seedStats.classList.remove("ok", "warn", "bad");
  if (!a.finishable) seedStats.classList.add("bad");
  else if (a.missing.length) seedStats.classList.add("warn");
  else seedStats.classList.add("ok");

  if (a.missing.length) {
    mapMissing.hidden = false;
    mapMissing.innerHTML = a.missing
      .map((miss) => `<div class="map-missing-name">${escHtml(miss.label)}</div>`)
      .join("");
  } else {
    mapMissing.hidden = true;
    mapMissing.innerHTML = "";
  }

  selName.textContent = "No room selected";
  selMeta.textContent = "Hover or click a room to inspect.";
  selBody.innerHTML =
    `<div class="sec evt-sec"><div class="sec-label">events</div><div class="sec-body"><p class="none">-</p></div></div>` +
    `<div class="sec doors-meta"><div class="sec-label">doors</div><div class="sec-body"><p class="none">-</p></div></div>` +
    `<div class="sec items"><div class="sec-label">items</div><p class="none">-</p></div>`;
  pinnedRoom = null;
}

async function playGenAnim(
  final: MapModel,
  steps: GenStep[],
  opts: { idle?: boolean } = {},
): Promise<void> {
  const token = ++genAnimToken;

  if (opts.idle) setWaitingStatus();
  else {
    statusBadge.textContent = "Building…";
    seedStats.classList.remove("ok", "warn", "bad");
  }
  mapMissing.hidden = true;
  mapMissing.innerHTML = "";
  setBuildPhase("CreateRoom()");

  // Post-fill / pré-overlap : reveal cheap ; re-paint seulement sur overlap.
  const preOverlap = roomsBeforeOverlap(steps);
  const draft: MapModel = {
    ...final,
    rooms: preOverlap,
    doors: [],
    forest: undefined,
  };
  model = final;
  paintFacilityFrame(draft, final.rooms, true, true);
  // Idle : garder le spawn visible (continuité entre seeds).
  if (opts.idle) {
    const spawn = findSpawnPlaced(preOverlap) ?? findSpawnPlaced(final.rooms);
    if (spawn) setAnimRoomAtCell(spawn.gx, spawn.gy, false);
  }

  let phase: GenStep["phase"] | "" = "";
  for (const step of steps) {
    if (token !== genAnimToken) return;
    if (opts.idle && document.hidden) {
      await waitForVisible();
      if (token !== genAnimToken) return;
    }
    if (step.phase !== phase) {
      phase = step.phase;
      setBuildPhase(GEN_ANIM_LABEL[phase]);
    }
    if (step.phase === "place") {
      setAnimRoomAtCell(step.room.gx, step.room.gy, false);
    } else if (step.phase === "overlap") {
      draft.rooms = step.rooms;
      paintFacilityFrame(draft, final.rooms, false, false);
    }
    await wait(GEN_ANIM_MS[step.phase]);
  }
  if (token !== genAnimToken) return;

  // Reveal résiduel + tunnels / forêt
  mapFacility.querySelectorAll(".is-pending").forEach((el) => el.classList.remove("is-pending"));
  paintMaps(final);
  if (opts.idle) {
    setBuildPhase("CreateMap()");
    setWaitingStatus();
    selName.textContent = "No room selected";
    selMeta.textContent = "Hover or click a room to inspect.";
    selBody.innerHTML =
      `<div class="sec evt-sec"><div class="sec-label">events</div><div class="sec-body"><p class="none">-</p></div></div>` +
      `<div class="sec doors-meta"><div class="sec-label">doors</div><div class="sec-body"><p class="none">-</p></div></div>` +
      `<div class="sec items"><div class="sec-label">items</div><p class="none">-</p></div>`;
    pinnedRoom = null;
  } else {
    finishTraceStatus(final);
  }
}

function isSpawnName(name: string): boolean {
  return name === "173" || name === "start";
}

function findSpawnPlaced(rooms: MapModel["rooms"]) {
  return rooms.find((r) => r.name === "173") ?? rooms.find((r) => r.name === "start");
}

/** Idle : NullGame en LIFO, spawn conservé entre seeds. */
async function playIdleDeconstruct(m: MapModel, steps: GenStep[]): Promise<void> {
  const token = ++genAnimToken;
  const cellOrder: { gx: number; gy: number; name: string }[] = [];
  for (const step of steps) {
    if (step.phase === "place") {
      cellOrder.push({ gx: step.room.gx, gy: step.room.gy, name: step.room.name });
    }
  }

  setWaitingStatus();
  setBuildPhase("NullGame()");

  for (let i = cellOrder.length - 1; i >= 0; i--) {
    if (token !== genAnimToken) return;
    if (document.hidden) {
      await waitForVisible();
      if (token !== genAnimToken) return;
    }
    const { gx, gy, name } = cellOrder[i];
    // Spawn jamais déplacé / toujours au même endroit sur les easter-eggs.
    if (isSpawnName(name)) continue;
    const here = m.rooms.find((r) => r.gx === gx && r.gy === gy);
    if (here && isSpawnName(here.name)) continue;
    setAnimRoomAtCell(gx, gy, true);
    await wait(IDLE_CLEAR_MS);
  }
  if (token !== genAnimToken) return;
}

// --- Idle carousel (seeds easter-egg, déconstruction) ---
/** Seeds easter-egg du menu New Game (Menu.bb / wiki). */
const EASTER_SEEDS = [
  "NIL",
  "NO",
  "d9341",
  "5CP_I73",
  "DONTBLINK",
  "CRUNCH",
  "die",
  "HTAED",
  "rustledjim",
  "larry",
  "JORGE",
  "dirtymetal",
  "whatpumpkin",
] as const;

const IDLE_GAP_MS = 1100; // temps mort sur la map finie

let idleActive = false;
let idleIndex = 0;
/** Incrémenté pour rejouer la même seed idle (ex. options). */
let idleEpoch = 0;

function stopIdleCarousel() {
  if (!idleActive) return;
  idleActive = false;
  idleEpoch++;
  genAnimToken++;
  seedInput.placeholder = "";
}

async function runIdleCarousel() {
  if (idleActive) return;
  idleActive = true;
  setWaitingStatus();
  while (idleActive) {
    if (document.hidden) {
      await waitForVisible();
      if (!idleActive) return;
    }
    const seed = EASTER_SEEDS[idleIndex % EASTER_SEEDS.length];
    const epoch = idleEpoch;
    seedInput.placeholder = seed;
    const built = await trace(seed, false, false, { forceAnim: true, idle: true });
    if (!idleActive) return;
    if (epoch !== idleEpoch) continue; // options : même seed
    await wait(IDLE_GAP_MS);
    if (!idleActive) return;
    if (epoch !== idleEpoch) continue;
    if (model && built?.length) await playIdleDeconstruct(model, built);
    // libère les steps dès que la clear est finie
    if (built) built.length = 0;
    if (!idleActive) return;
    if (epoch !== idleEpoch) continue;
    idleIndex++;
  }
}

function waitForVisible(): Promise<void> {
  if (!document.hidden) return Promise.resolve();
  return new Promise((resolve) => {
    const onVis = () => {
      if (document.hidden) return;
      document.removeEventListener("visibilitychange", onVis);
      resolve();
    };
    document.addEventListener("visibilitychange", onVis);
  });
}

function startIdleCarousel() {
  if (idleActive) return;
  void runIdleCarousel();
}

function currentTraceSeed(): string {
  // Tant que l'accueil tourne, on ignore le texte en cours de saisie.
  if (idleActive) return EASTER_SEEDS[idleIndex % EASTER_SEEDS.length];
  return seedInput.value.trim();
}

function retraceFromUi() {
  const seed = currentTraceSeed();
  if (!seed) return;
  if (idleActive) {
    idleEpoch++;
    genAnimToken++;
    return;
  }
  void trace(seed, false, modBox.checked);
}

// --- Trace seed (generateMap + paint / anim) ---
async function trace(
  seed: string,
  intro: boolean,
  mod: boolean,
  opts: { forceAnim?: boolean; idle?: boolean } = {},
): Promise<GenStep[] | undefined> {
  if (!seed) return;
  genAnimToken++; // cancel any in-flight build anim

  const steps: GenStep[] = [];
  const wantAnim = opts.forceAnim || genAnimBox.checked;
  const record = wantAnim ? (s: GenStep) => { steps.push(s); } : undefined;

  if (mod) {
    const n = Number(seed);
    if (!Number.isInteger(n) || n < 1 || n > MOD_MAX) {
      selName.textContent = "invalid seed";
      selMeta.textContent = `mod mode: integer between 1 and ${MOD_MAX}`;
      mapMissing.hidden = true;
      mapMissing.innerHTML = "";
      return;
    }
    model = generateMapFromNumber(n, seed, 18, intro, { onStep: record });
  } else {
    model = generateMap(seed, 18, intro, { onStep: record });
  }

  if (record && steps.length) {
    await playGenAnim(model, steps, { idle: opts.idle });
    return steps;
  }

  paintMaps(model);
  finishTraceStatus(model);
  return;
}

// --- Inspect : sélection salle (doors / items / events) ---
function formatDoorMeta(d: { keycard?: number; code?: string }): string {
  const bits: string[] = [];
  if (d.keycard !== undefined) {
    if (d.keycard > 0) bits.push(`Keycard level ${d.keycard}`);
    else if (d.keycard === -1) bits.push("DNA scanner (hand)");
    else if (d.keycard === -2) bits.push("DNA scanner (black hand)");
    else bits.push(`Keycard ${d.keycard}`);
  }
  if (d.code) {
    if (d.code === "AccessCode") bits.push("Office code (random each run)");
    else if (d.code === "TunnelsCode") bits.push("Tunnels code (office × 3)");
    // GEAR / ABCD : codes impossibles (pad 1-9) → keypad volontairement inutilisable
    else if (d.code === "GEAR" || d.code === "ABCD") bits.push("Keypad unusable");
    else bits.push(`Code ${d.code}`);
  }
  return bits.join(" · ");
}

/** Batterie / charge FillRoom - littéraux humanisés. */
function formatItemState(tempname: string, state: number): string {
  if (tempname === "nav" || tempname === "radio") return `battery ${state}`;
  if (tempname === "nvgoggles") return `charge ${state}`;
  return `state ${state}`;
}

function select(i: number) {
  if (!scene) return;
  const sr = scene.rooms[i];
  if (!sr) return;
  const r = sr.room;
  // nom commun d'abord, nom technique en méta
  const disp = r.name ? displayName(r.name) : null;
  selName.textContent = disp ?? (r.name || "generic room");
  const pdExit = model ? earlyEscapeTunnel(model.rooms) : null;
  const isPdExit = !!pdExit && r.gx === pdExit.gx && r.gy === pdExit.gy;
  selMeta.textContent =
    `${disp && r.name ? r.name + " · " : ""}${zoneName[r.zone]} · ${r.gx},${r.gy}` +
    (isPdExit ? " · PD early escape" : "");

  const parts: string[] = [];

  {
    let evtHtml = `<p class="none">-</p>`;
    if (r.event) {
      const d = eventDescr[r.event];
      evtHtml =
        `<div class="evt"><span class="evt-name">${r.event}</span>` +
        (d ? `<span class="evt-desc">${d}</span>` : "") +
        `</div>`;
    }
    parts.push(
      `<div class="sec evt-sec"><div class="sec-label">events</div><div class="sec-body">${evtHtml}</div></div>`,
    );
  }

  {
    const rows = r.doorMeta?.length
      ? r.doorMeta.map((d) => `<div class="door-row">${formatDoorMeta(d)}</div>`).join("")
      : `<p class="none">-</p>`;
    parts.push(
      `<div class="sec doors-meta"><div class="sec-label">doors</div><div class="sec-body">${rows}</div></div>`,
    );
  }

  {
    const itemRows: string[] = [];
    if (r.items?.length) {
      for (const it of r.items) {
        const meta: string[] = [];
        if (it.inventory) meta.push(`<span class="item-tag">inventory</span>`);
        if (it.state !== undefined) {
          meta.push(`<span class="item-tag">${formatItemState(it.tempname, it.state)}</span>`);
        }
        itemRows.push(`<div class="item-row"><span class="item-name">${it.name}</span>${meta.join("")}</div>`);
      }
    }
    if (r.name === "room2tunnel" && model?.tunnels.items.length) {
      for (const it of model.tunnels.items) {
        itemRows.push(
          `<div class="item-row"><span class="item-name">${it.name}</span>` +
            `<span class="item-tag">gen ${it.x},${it.y}</span></div>`,
        );
      }
    }
    const list = itemRows.length
      ? `<div class="item-list">${itemRows.join("")}</div>`
      : `<p class="none">-</p>`;
    parts.push(`<div class="sec items"><div class="sec-label">items</div>${list}</div>`);
  }

  selBody.innerHTML = parts.join("");
}

function syncPinnedHighlight() {
  for (const g of mapFacility.querySelectorAll<SVGGElement>("g.room.selected")) {
    g.classList.remove("selected");
  }
  if (pinnedRoom === null) return;
  const g = mapFacility.querySelector<SVGGElement>(`g.room[data-i="${pinnedRoom}"]`);
  g?.classList.add("selected");
}

function restorePinnedOrIdle() {
  if (pinnedRoom !== null && scene?.rooms[pinnedRoom]) {
    select(pinnedRoom);
  } else {
    clearPinnedSelection();
  }
}

function clearPinnedSelection() {
  pinnedRoom = null;
  syncPinnedHighlight();
  selName.textContent = "No room selected";
  selMeta.textContent = "Click a room to pin it · hover to preview.";
  selBody.innerHTML =
    `<div class="sec evt-sec"><div class="sec-label">events</div><div class="sec-body"><p class="none">-</p></div></div>` +
    `<div class="sec doors-meta"><div class="sec-label">doors</div><div class="sec-body"><p class="none">-</p></div></div>` +
    `<div class="sec items"><div class="sec-label">items</div><p class="none">-</p></div>`;
}

mapFacility.addEventListener("mouseover", (e) => {
  const g = (e.target as Element).closest<SVGGElement>("g.room");
  if (g?.dataset.i) select(+g.dataset.i);
  else if (pinnedRoom !== null) restorePinnedOrIdle();
  else clearPinnedSelection();
});

mapFacility.addEventListener("focusin", (e) => {
  const g = (e.target as Element).closest<SVGGElement>("g.room");
  if (g?.dataset.i) select(+g.dataset.i);
});

mapFacility.addEventListener("click", (e) => {
  const g = (e.target as Element).closest<SVGGElement>("g.room");
  if (g?.dataset.i) {
    pinnedRoom = +g.dataset.i;
    select(pinnedRoom);
    syncPinnedHighlight();
  } else {
    clearPinnedSelection();
  }
});

mapFacility.addEventListener("mouseleave", () => {
  if (pinnedRoom !== null) restorePinnedOrIdle();
});

mapFacility.addEventListener("focusout", (e) => {
  if (!mapFacility.contains(e.relatedTarget as Node) && pinnedRoom !== null) {
    restorePinnedOrIdle();
  }
});

barTrace.addEventListener("submit", (e) => {
  e.preventDefault();
  const seed = seedInput.value.trim();
  if (!seed) {
    startIdleCarousel();
    return;
  }
  stopIdleCarousel();
  void trace(seed, false, modBox.checked);
});
modBox.addEventListener("change", () => retraceFromUi());
extentsMapBox.addEventListener("change", () => {
  if (!extentsMapBox.checked) oversizedMeshesBox.checked = false;
  syncOversizedToggle();
  retraceFromUi();
});
oversizedMeshesBox.addEventListener("change", () => {
  if (oversizedMeshesBox.checked) extentsMapBox.checked = true;
  syncOversizedToggle();
  retraceFromUi();
});
speedrunLabelsBox.addEventListener("change", () => {
  retraceFromUi();
});
minimalLabelsBox.addEventListener("change", () => {
  retraceFromUi();
});
genAnimBox.addEventListener("change", () => {
  if (!idleActive) retraceFromUi();
});

function syncOversizedToggle() {
  oversizedMeshesBox.disabled = !extentsMapBox.checked;
  oversizedMeshesBox.parentElement?.classList.toggle("is-disabled", !extentsMapBox.checked);
}
syncOversizedToggle();
// --- Layout panels Trace vs Search ---
function syncPanels() {
  const search = chassis.classList.contains("mode-search");
  panelInspect.hidden = search;
  sideSearch.hidden = !search;
  viewTabs.hidden = search;
  syncMapVisibility();
}

syncPanels();
randomBtn.addEventListener("click", () => {
  stopIdleCarousel();
  seedInput.value = String(1 + Math.floor(Math.random() * (modBox.checked ? MOD_MAX : BASE_SEED_MAX)));
  void trace(seedInput.value, false, modBox.checked);
});

// --- Search results : état, tri, pagination ---
let worker: Worker | null = null;
let scanning = false;
const PAGE_SIZE = 500;
/** Source de vérité compacte des résultats (cap SESSION_RESULTS_MAX). */
let allMatches: StoredMatch[] = [];
/** Après tri / filtre secondaire. */
let viewMatches: StoredMatch[] = [];
let resultsPage = 0;
/** Pagination active après scan terminé / import (pendant scan : page 0 live). */
let resultsPagingEnabled = false;
/** Tri secondaire sur le premier filtre distance (index dans `filters`). */
let distSort: "asc" | "desc" | "off" = "off";
let lastScan = { mode: "base" as "base" | "mod", from: 0, to: 0, scanned: 0, found: 0 };
let memoryTruncated = false;

// --- Mode Trace | Search ---
function setMode(search: boolean) {
  tabTrace.classList.toggle("on", !search);
  tabSearch.classList.toggle("on", search);
  tabTrace.setAttribute("aria-selected", String(!search));
  tabSearch.setAttribute("aria-selected", String(search));
  chassis.classList.toggle("mode-search", search);
  chassis.classList.toggle("mode-trace", !search);
  if (search && mapView !== "facility") setMapView("facility");
  syncPanels();
  if (search) {
    setSearchPhase(searchPhase);
    // Pas de seed Trace → l'accueil idle continue derrière Search.
    if (!seedInput.value.trim()) startIdleCarousel();
  } else {
    closeFilterPopover();
    clearPickTarget();
    if (!seedInput.value.trim()) startIdleCarousel();
  }
}
tabTrace.addEventListener("click", () => setMode(false));
tabSearch.addEventListener("click", () => setMode(true));

function firstDistanceFilterIndex(): number {
  return filters.findIndex((f) => f.type === "distance");
}

function rebuildViewMatches() {
  const di = firstDistanceFilterIndex();
  if (di >= 0 && distSort !== "off") {
    const key = String(di);
    const sign = distSort === "asc" ? 1 : -1;
    viewMatches = allMatches.slice().sort((a, b) => {
      const av = a.v?.[key];
      const bv = b.v?.[key];
      const an = typeof av === "number" ? av : Number.POSITIVE_INFINITY;
      const bn = typeof bv === "number" ? bv : Number.POSITIVE_INFINITY;
      return (an - bn) * sign;
    });
  } else {
    viewMatches = allMatches;
  }
}

function paintResultsTools() {
  const di = firstDistanceFilterIndex();
  if (di < 0 || !resultsPagingEnabled) {
    resultsTools.hidden = true;
    resultsTools.innerHTML = "";
    return;
  }
  const f = filters[di]!;
  if (f.type !== "distance") return;
  resultsTools.hidden = false;
  const label = `${displayRoom(f.roomA)} ↔ ${displayRoom(f.roomB)}`;
  resultsTools.innerHTML =
    `<div class="results-tool-row">` +
      `<span class="results-tool-lbl">${escHtml(label)}</span>` +
      `<div class="fb-tog results-sort-tog" role="group" aria-label="Sort distance">` +
        `<button type="button" data-sort="off"${distSort === "off" ? " class=\"on\"" : ""}>Order</button>` +
        `<button type="button" data-sort="asc"${distSort === "asc" ? " class=\"on\"" : ""}>Asc</button>` +
        `<button type="button" data-sort="desc"${distSort === "desc" ? " class=\"on\"" : ""}>Desc</button>` +
      `</div>` +
    `</div>`;

  resultsTools.querySelectorAll<HTMLButtonElement>("[data-sort]").forEach((b) => {
    b.addEventListener("click", () => {
      distSort = (b.dataset.sort as "asc" | "desc" | "off") ?? "off";
      resultsPage = 0;
      rebuildViewMatches();
      paintResultsTools();
      renderResults();
      resultsBox.scrollTop = 0;
    });
  });
}

function paintResultsPager() {
  const total = viewMatches.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (!resultsPagingEnabled || total <= PAGE_SIZE) {
    resultsPager.hidden = true;
    return;
  }
  resultsPager.hidden = false;
  if (resultsPage >= pages) resultsPage = pages - 1;
  resultsPageLabel.textContent = `${resultsPage + 1} / ${pages}`;
  resultsPrev.disabled = resultsPage <= 0;
  resultsNext.disabled = resultsPage >= pages - 1;
}

function renderResults() {
  paintResultsTools();
  paintResultsPager();

  const total = viewMatches.length;
  const start = resultsPagingEnabled ? resultsPage * PAGE_SIZE : 0;
  const end = resultsPagingEnabled
    ? Math.min(start + PAGE_SIZE, total)
    : Math.min(PAGE_SIZE, total);

  resultsBox.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (let i = start; i < end; i++) {
    const m = viewMatches[i]!;
    const div = document.createElement("div");
    div.className = "res" + (m.finishable ? "" : " bad");
    div.dataset.seed = m.seed;
    const seedEl = document.createElement("span");
    seedEl.className = "res-seed";
    seedEl.textContent = m.seed;
    div.append(seedEl);

    const parts: string[] = [];
    for (let fi = 0; fi < filters.length; fi++) {
      const f = filters[fi]!;
      if (!isVariableFilter(f)) continue;
      const raw = m.v?.[String(fi)];
      if (raw === undefined) continue;
      parts.push(unpackVariable(f, raw));
    }
    if (parts.length) {
      const whoEl = document.createElement("span");
      whoEl.className = "who";
      whoEl.textContent = parts.join(" · ");
      div.append(whoEl);
    }
    frag.append(div);
  }
  resultsBox.append(frag);
}

function pushMatch(m: ScanMatch) {
  if (allMatches.length >= SESSION_RESULTS_MAX) {
    memoryTruncated = true;
    return;
  }
  allMatches.push(storeMatch(filters, m));
}

function resetResultsState() {
  allMatches = [];
  viewMatches = [];
  resultsPage = 0;
  resultsPagingEnabled = false;
  distSort = "off";
  memoryTruncated = false;
  resultsBox.innerHTML = "";
  resultsTools.hidden = true;
  resultsTools.innerHTML = "";
  resultsPager.hidden = true;
}

resultsPrev.addEventListener("click", () => {
  if (resultsPage <= 0) return;
  resultsPage--;
  renderResults();
  resultsBox.scrollTop = 0;
});
resultsNext.addEventListener("click", () => {
  const pages = Math.max(1, Math.ceil(viewMatches.length / PAGE_SIZE));
  if (resultsPage >= pages - 1) return;
  resultsPage++;
  renderResults();
  resultsBox.scrollTop = 0;
});

// --- Results list : hover preview = Trace, clic = Trace ---
resultsBox.addEventListener("mouseover", (e) => {
  const el = (e.target as Element).closest<HTMLElement>(".res");
  if (!el?.dataset.seed) return;
  resultsBox.querySelector(".res.on")?.classList.remove("on");
  el.classList.add("on");
  stopIdleCarousel();
  void trace(el.dataset.seed, false, sMod.checked);
});
resultsBox.addEventListener("click", (e) => {
  const el = (e.target as Element).closest<HTMLElement>(".res");
  if (!el?.dataset.seed) return;
  stopIdleCarousel();
  seedInput.value = el.dataset.seed;
  modBox.checked = sMod.checked;
  setMode(false);
  void trace(el.dataset.seed, false, modBox.checked);
});

// --- Filter compose : état + chips ---
const filters: Filter[] = [];
const chips = $("#chips");
const filterEmpty = $("#filter-empty");
const fbType = $<HTMLSelectElement>("#fb-type");
const fbTypeBtn = $<HTMLButtonElement>("#fb-type-btn");
const fbTypeLabel = $("#fb-type-label");
const fbTypeDesc = $("#fb-type-desc");
const fbTypeMenu = $("#fb-type-menu");
const fbTypePick = $("#fb-type-pick");

const FILTER_TYPE_LABELS: Record<string, string> = {
  room: "Room presence",
  distance: "Walk distance",
  item: "Item presence",
  event: "Event on room",
  out_of_place: "Out of place",
  finishable: "Finishable",
  overlap: "Room overlap",
};

const FILTER_TYPE_DESC: Record<string, string> = {
  room: "Room is present or missing on the map.",
  item: "Item spawns in a chosen room.",
  event: "Chosen room has a specific event.",
  distance: "Walk distance between two rooms.",
  overlap: "Residual geometry overlaps. Leave rooms empty for any.",
  out_of_place: "Room outside its expected zone. Leave empty for any.",
  finishable: "Seed can or cannot be finished.",
};

function closeFbTypeMenu() {
  fbTypeMenu.hidden = true;
  fbTypeBtn.setAttribute("aria-expanded", "false");
}

function syncFbTypeUi() {
  const v = fbType.value;
  fbTypeLabel.textContent = FILTER_TYPE_LABELS[v] ?? v;
  fbTypeDesc.textContent = FILTER_TYPE_DESC[v] ?? "";
  fbTypeMenu.querySelectorAll<HTMLButtonElement>("[data-type]").forEach((b) => {
    b.classList.toggle("on", b.dataset.type === v);
    b.setAttribute("aria-selected", b.dataset.type === v ? "true" : "false");
  });
}

function setFbType(v: string, fire = true) {
  if (fbType.value === v && fire) {
    closeFbTypeMenu();
    return;
  }
  fbType.value = v;
  syncFbTypeUi();
  closeFbTypeMenu();
  if (fire) fbType.dispatchEvent(new Event("change"));
}

fbTypeBtn.addEventListener("click", () => {
  const open = fbTypeMenu.hidden;
  fbTypeMenu.hidden = !open;
  fbTypeBtn.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) fbTypeMenu.querySelector<HTMLButtonElement>(".on")?.focus();
});
fbTypeMenu.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>("[data-type]");
  if (!b?.dataset.type) return;
  setFbType(b.dataset.type);
});
document.addEventListener("pointerdown", (e) => {
  if (fbTypeMenu.hidden) return;
  if (fbTypePick.contains(e.target as Node)) return;
  closeFbTypeMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || fbTypeMenu.hidden) return;
  e.preventDefault();
  closeFbTypeMenu();
  fbTypeBtn.focus();
});
syncFbTypeUi();
const fbRoomParams = $("#fb-room-params");
const fbFinishParams = $("#fb-finish-params");
const fbPairParams = $("#fb-pair-params");
const fbDistExtra = $("#fb-dist-extra");
const fbDistCmp = $("#fb-dist-cmp");
const fbDistBoundLbl = $("#fb-dist-bound-lbl");
const fbChoiceParams = $("#fb-choice-params");
const fbChoiceLbl = $("#fb-choice-lbl");
const fbChoice = $<HTMLSelectElement>("#fb-choice");
const fbPairSep = $("#fb-pair-sep");
const fbNeg = $("#fb-neg");
const fbFinish = $("#fb-finish");
const fbMax = $<HTMLInputElement>("#fb-max");
// --- Filter compose : toggles présence / finishable / distance ---
let roomNegate = false;
let finishWant = true;
let distCmp: "le" | "ge" = "le";
fbNeg.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>("button[data-neg]");
  if (!b) return;
  roomNegate = b.dataset.neg === "1";
  fbNeg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
  syncPickPane();
});
fbFinish.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>("button[data-want]");
  if (!b) return;
  finishWant = b.dataset.want === "1";
  fbFinish.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
});
fbDistCmp.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>("button[data-cmp]");
  if (!b?.dataset.cmp) return;
  distCmp = b.dataset.cmp === "ge" ? "ge" : "le";
  fbDistCmp.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
  fbDistBoundLbl.textContent = distCmp === "le" ? "at most" : "at least";
});

interface RoomEntry {
  name: string;
  title: string;   // display name or internal
  label: string;   // "Title (name)" ou name
  search: string;
  zones: number[];
}

const ROOM_CATALOG: RoomEntry[] = [
  ...templates.map((t) => {
    const title = displayName(t.name) ?? t.name;
    const label = displayName(t.name) ? `${title} (${t.name})` : t.name;
    return {
      name: t.name,
      title,
      label,
      search: `${title} ${t.name}`.toLowerCase(),
      zones: catalogZones(t.name),
    };
  }),
  {
    name: PD_ESCAPE_ROOM,
    title: PD_ESCAPE_TITLE,
    label: `${PD_ESCAPE_TITLE} (${PD_ESCAPE_ROOM})`,
    search: `${PD_ESCAPE_TITLE} pocket dimension escape pd tunnel`.toLowerCase(),
    zones: catalogZones("tunnel"),
  },
].sort((a, b) => a.label.localeCompare(b.label));

const ITEM_ROOMS = new Set(roomsWithItems());
const EVENT_ROOMS = new Set([...roomsWithEvents(), PD_ESCAPE_ROOM]);

type RoomPicker = {
  value: string;
  label: string;
  root: HTMLElement | null;
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  setValue: (name: string, silent?: boolean) => void;
  clear: () => void;
  paint: () => void;
};

const roomPickers: RoomPicker[] = [];
const fly = $("#fb-pick-fly");
const flySolo = $("#fb-room-pick");
const flyDuo = $("#fb-pick-duo");
const flyQ = $<HTMLInputElement>("#fb-pick-q");
const flyZones = $("#fb-pick-zones");
const flyZoneLabel = $("#fb-pick-zone-label");
const flyList = $("#fb-pick-list");
// --- Room picker (fly list + slots A/B) ---
let flyOwner: RoomPicker | null = null;
let flyZone: number | null = null;
let flyActive = -1;

function setFlyZoneLabel(text: string | null) {
  if (!text) {
    flyZoneLabel.hidden = true;
    flyZoneLabel.textContent = "";
    return;
  }
  flyZoneLabel.hidden = false;
  flyZoneLabel.textContent = text;
}

function syncFlyZoneLabelFromScroll() {
  if (flyZoneLabel.hidden || flyZone !== null || flyQ.value.trim()) return;
  const top = flyList.scrollTop;
  const opts = flyList.querySelectorAll<HTMLElement>(".room-pick-opt[data-z]");
  let z = opts[0]?.dataset.z ?? "";
  for (const opt of opts) {
    if (opt.offsetTop <= top + 4) z = opt.dataset.z ?? z;
    else break;
  }
  if (z !== "") setFlyZoneLabel(zoneCode[Number(z)] ?? z);
}

function roomsNeeded(): boolean {
  const t = fbType.value;
  return (
    t === "room" ||
    t === "distance" ||
    t === "overlap" ||
    t === "item" ||
    t === "event" ||
    t === "out_of_place"
  );
}

function flyMatches() {
  const needle = flyQ.value.trim().toLowerCase();
  const t = fbType.value;
  return ROOM_CATALOG.filter((r) => {
    if (t === "item" && !ITEM_ROOMS.has(r.name)) return false;
    if (t === "event" && !EVENT_ROOMS.has(r.name)) return false;
    if (flyZone !== null && !r.zones.includes(flyZone)) return false;
    if (needle && !r.search.includes(needle)) return false;
    return true;
  });
}

function paintFlyList(scroll: "top" | "selection" | "none" = "none") {
  const value = flyOwner?.value ?? "";
  const rows = flyMatches();
  flyActive = rows.findIndex((r) => r.name === value);
  if (!rows.length) {
    setFlyZoneLabel(null);
    flyList.innerHTML = `<div class="room-pick-empty">No rooms</div>`;
    return;
  }
  const home = (r: RoomEntry) => {
    const pos = r.zones.filter((z) => z > 0);
    return pos.length ? Math.min(...pos) : 0;
  };
  const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const opt = (r: RoomEntry, meta: string, z: number | null, zoneStart: boolean) =>
    `<button type="button" class="room-pick-opt${r.name === value ? " on" : ""}${zoneStart ? " zone-start" : ""}" role="option" data-name="${escAttr(r.name)}"${z !== null ? ` data-z="${z}"` : ""} title="${escAttr(r.label)}">` +
      `<span class="room-pick-title">${escAttr(r.title)}</span>` +
      `<span class="room-pick-meta">${escAttr(meta)}</span>` +
    `</button>`;

  if (!flyQ.value.trim()) {
    const parts: string[] = [];
    const pool = flyZone === null ? [1, 2, 3, 0] : [flyZone];
    let labelZ: number | null = null;
    let firstGroup = true;
    for (const z of pool) {
      const group = rows
        .filter((r) => (flyZone !== null ? r.zones.includes(z) : home(r) === z))
        .sort((a, b) => a.label.localeCompare(b.label));
      if (!group.length) continue;
      if (labelZ === null) labelZ = z;
      let start = !firstGroup;
      firstGroup = false;
      for (const r of group) {
        const multi = flyZone === null && r.zones.length > 1
          ? ` · ${r.zones.map((zz) => zoneCode[zz]).join("·")}`
          : "";
        parts.push(opt(r, `${r.name}${multi}`, z, start));
        start = false;
      }
    }
    setFlyZoneLabel(labelZ !== null ? zoneCode[labelZ] : null);
    flyList.innerHTML = parts.join("");
  } else {
    setFlyZoneLabel(null);
    flyList.innerHTML = rows
      .map((r) => opt(r, `${r.name} · ${r.zones.map((zz) => zoneCode[zz]).join("·")}`, null, false))
      .join("");
  }
  if (scroll === "top") flyList.scrollTop = 0;
  else if (scroll === "selection") {
    flyList.querySelector<HTMLElement>(".room-pick-opt.on")?.scrollIntoView({ block: "nearest" });
  }
  syncFlyZoneLabelFromScroll();
}

function clearPickTarget() {
  if (flyOwner?.root) flyOwner.root.classList.remove("open");
  flyOwner = null;
  for (const p of roomPickers) p.paint();
  syncPickPane();
  paintFlyList("none");
}

function setPickTarget(owner: RoomPicker, focusSearch = true) {
  flyOwner = owner;
  for (const p of roomPickers) {
    p.root?.classList.toggle("open", p === owner);
    p.paint();
  }
  if (focusSearch) {
    flyQ.value = "";
    flyZone = null;
    flyZones.querySelectorAll("button").forEach((b) => b.classList.toggle("on", (b as HTMLButtonElement).dataset.z === ""));
  }
  syncPickPane();
  paintFlyList(focusSearch ? "selection" : "none");
  if (focusSearch) flyQ.focus();
}

let onRoomAssigned: (owner: RoomPicker) => void = () => {};
let assignFromList: (name: string) => void = () => {};

flyQ.addEventListener("input", () => paintFlyList("top"));
flyList.addEventListener("scroll", syncFlyZoneLabelFromScroll, { passive: true });
flyQ.addEventListener("keydown", (e) => {
  const opts = [...flyList.querySelectorAll<HTMLButtonElement>(".room-pick-opt")];
  if (e.key === "ArrowDown") {
    e.preventDefault();
    flyActive = Math.min(opts.length - 1, flyActive + 1);
    opts[flyActive]?.focus();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    flyActive = Math.max(0, flyActive - 1);
    opts[flyActive]?.focus();
  } else if (e.key === "Enter") {
    e.preventDefault();
    const name = opts[Math.max(0, flyActive)]?.dataset.name;
    if (name) assignFromList(name);
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    if (flyQ.value) {
      flyQ.value = "";
      paintFlyList("top");
      return;
    }
    flyQ.blur();
  }
});
flyZones.addEventListener("click", (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>("button[data-z]");
  if (!b) return;
  flyZone = b.dataset.z === "" ? null : Number(b.dataset.z);
  flyZones.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
  paintFlyList("top");
  flyQ.focus();
});
flyList.addEventListener("click", (e) => {
  const opt = (e.target as Element).closest<HTMLButtonElement>(".room-pick-opt");
  if (opt?.dataset.name) assignFromList(opt.dataset.name);
});

// --- Room picker factory ---
/** Valeur seule (filtre room) ou bouton compact A/B. */
function createRoomPicker(label: string, root: HTMLElement | null = null): RoomPicker {
  let value = "";
  let btn: HTMLButtonElement | null = null;
  let clearBtn: HTMLButtonElement | null = null;
  if (root) {
    root.innerHTML =
      `<div class="room-slot">` +
        `<button type="button" class="room-slot-btn"></button>` +
        `<button type="button" class="room-slot-clear" hidden aria-label="Clear room">✕</button>` +
      `</div>`;
    btn = root.querySelector<HTMLButtonElement>(".room-slot-btn");
    clearBtn = root.querySelector<HTMLButtonElement>(".room-slot-clear");
  }

  const api: RoomPicker = {
    get value() { return value; },
    label,
    root,
    open: () => setPickTarget(api),
    close: () => {},
    isOpen: () => flyOwner === api,
    setValue: (name: string, silent = false) => {
      value = name;
      api.paint();
      syncPickPane();
      if (!silent) onRoomAssigned(api);
      else paintFlyList("none");
    },
    clear: () => {
      value = "";
      api.paint();
      syncPickPane();
      paintFlyList("none");
    },
    paint: () => {
      if (!btn || !root) return;
      const e = value ? ROOM_CATALOG.find((r) => r.name === value) : undefined;
      btn.textContent = e ? e.title : label;
      btn.title = e ? e.label : "";
      btn.classList.toggle("empty", !e);
      if (clearBtn) clearBtn.hidden = !e;
      root.classList.toggle("open", flyOwner === api);
    },
  };

  btn?.addEventListener("click", () => setPickTarget(api));
  clearBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    api.clear();
    onRoomAssigned(api);
  });
  api.paint();
  roomPickers.push(api);
  return api;
}

const pickRoom = createRoomPicker("Select a room below", $("#fb-room-pick"));
const pickRoomA = createRoomPicker("Room A", $("#fb-roomA-pick"));
const pickRoomB = createRoomPicker("Room B", $("#fb-roomB-pick"));

function fillChoiceSelect(preserve = true) {
  const t = fbType.value;
  const prev = preserve ? fbChoice.value : "";
  fbChoice.innerHTML = "";
  const room = pickRoom.value;
  if (t === "item") {
    fbChoiceLbl.textContent = "item";
    if (!room) {
      fbChoice.innerHTML = `<option value="">Pick a room first</option>`;
      return;
    }
    const items = possibleItemsForRoom(room);
    if (!items.length) {
      fbChoice.innerHTML = `<option value="">No items in this room</option>`;
      return;
    }
    for (const it of items) {
      const o = document.createElement("option");
      o.value = itemKey(it);
      o.textContent = it.name;
      fbChoice.appendChild(o);
    }
  } else if (t === "event") {
    fbChoiceLbl.textContent = "event";
    if (!room) {
      fbChoice.innerHTML = `<option value="">Pick a room first</option>`;
      return;
    }
    const evs = possibleEventsForRoom(room);
    if (!evs.length) {
      fbChoice.innerHTML = `<option value="">No events on this room</option>`;
      return;
    }
    for (const ev of evs) {
      const o = document.createElement("option");
      o.value = ev.id;
      o.textContent = ev.label;
      fbChoice.appendChild(o);
    }
  }
  if (prev && [...fbChoice.options].some((o) => o.value === prev)) fbChoice.value = prev;
}

function syncPickPane() {
  const needed = roomsNeeded();
  fly.hidden = !needed;
  fbuild.classList.toggle("no-picker", !needed);
  if (!needed) return;
  const t = fbType.value;
  const duo = t === "distance" || t === "overlap";
  flySolo.hidden = duo;
  flyDuo.hidden = !duo;
  fbPairSep.textContent = t === "overlap" ? "∩" : "↔";
  pickRoom.label = t === "out_of_place" ? "Any room below (optional)" : "Select a room below";
  pickRoomA.label = t === "overlap" ? "Any (optional)" : "Room A";
  pickRoomB.label = t === "overlap" ? "Any (optional)" : "Room B";
  for (const p of roomPickers) p.paint();
}

function resolveAssignTarget(): RoomPicker | null {
  if (!roomsNeeded()) return null;
  const t = fbType.value;
  if (t === "room" || t === "item" || t === "event" || t === "out_of_place") {
    return pickRoom;
  }
  if (t === "distance" || t === "overlap") {
    if (!pickRoomA.value) return pickRoomA;
    if (!pickRoomB.value) return pickRoomB;
    return flyOwner ?? pickRoomA;
  }
  return null;
}

assignFromList = (name: string) => {
  let owner = flyOwner;
  if (!owner) {
    owner = resolveAssignTarget();
    if (!owner) return;
    setPickTarget(owner, false);
  }
  owner.setValue(name);
};

onRoomAssigned = (owner) => {
  paintFlyList("selection");
  syncPickPane();
  if (owner === pickRoom) fillChoiceSelect(false);
  if (owner === pickRoomA && !pickRoomB.value) {
    setPickTarget(pickRoomB, false);
    return;
  }
  if (owner === pickRoomB && !pickRoomA.value) {
    setPickTarget(pickRoomA, false);
  }
};

function syncFbParams() {
  const t = fbType.value;
  const showNeg = t === "room" || t === "item" || t === "event";
  fbRoomParams.hidden = !showNeg;
  fbFinishParams.hidden = t !== "finishable";
  fbPairParams.hidden = t !== "distance";
  fbDistExtra.hidden = t !== "distance";
  fbChoiceParams.hidden = t !== "item" && t !== "event";
  if (t === "item" || t === "event") fillChoiceSelect();
  if (t === "room" || t === "item" || t === "event" || t === "out_of_place") {
    setPickTarget(pickRoom, false);
  } else if (t === "distance" || t === "overlap") setPickTarget(pickRoomA, false);
  else clearPickTarget();
  paintFlyList();
  syncPickPane();
}
fbType.addEventListener("change", syncFbParams);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!sessionIoOverlay.hidden) {
    e.preventDefault();
    closeSessionIo();
    btnSessionIo.focus();
    return;
  }
  if (!aboutOverlay.hidden) {
    e.preventDefault();
    closeAbout();
    btnAbout.focus();
    return;
  }
  if (!codesOverlay.hidden) {
    e.preventDefault();
    closeCodes();
    btnCodes.focus();
    return;
  }
  if (!chassis.classList.contains("mode-search")) return;
  if (!filterPopover.hidden) {
    e.preventDefault();
    closeFilterPopover();
    filterSummary.focus();
  }
});
syncFbParams();
paintFlyList();
syncPickPane();
setSearchPhase("compose");

function chipParts(f: Filter): { kind: string; detail?: string } {
  switch (f.type) {
    case "room":
      return {
        kind: FILTER_TYPE_LABELS.room,
        detail: `${displayRoom(f.room)} · ${f.negate ? "missing" : "present"}`,
      };
    case "distance": {
      const op = f.cmp === "ge" ? "≥" : "≤";
      return {
        kind: FILTER_TYPE_LABELS.distance,
        detail: `${displayRoom(f.roomA)} ↔ ${displayRoom(f.roomB)} · ${op}${f.bound} rooms`,
      };
    }
    case "finishable":
      return {
        kind: FILTER_TYPE_LABELS.finishable,
        detail: f.want ? "finishable" : "unfinishable",
      };
    case "overlap": {
      const a = f.roomA ? displayRoom(f.roomA) : null;
      const b = f.roomB ? displayRoom(f.roomB) : null;
      let detail = "any residual";
      if (a && b) detail = `${a} ∩ ${b}`;
      else if (a) detail = `${a} ∩ any`;
      else if (b) detail = `any ∩ ${b}`;
      return { kind: FILTER_TYPE_LABELS.overlap, detail };
    }
    case "item":
      return {
        kind: FILTER_TYPE_LABELS.item,
        detail: `${f.name} @ ${displayRoom(f.room)}${f.negate ? " · missing" : ""}`,
      };
    case "event":
      return {
        kind: FILTER_TYPE_LABELS.event,
        detail: `${f.event} @ ${displayRoom(f.room)}${f.negate ? " · missing" : ""}`,
      };
    case "out_of_place":
      return {
        kind: FILTER_TYPE_LABELS.out_of_place,
        detail: f.room ? displayRoom(f.room) : "any room",
      };
  }
}


const fbOk = $<HTMLButtonElement>("#fb-ok");
let editingIndex: number | null = null;

// --- Filter compose : edit / chips / readCompose ---
function setPresenceToggle(neg: boolean) {
  roomNegate = neg;
  fbNeg.querySelectorAll("button").forEach((x) =>
    x.classList.toggle("on", (x as HTMLButtonElement).dataset.neg === (neg ? "1" : "0")),
  );
}

function setFinishToggle(want: boolean) {
  finishWant = want;
  fbFinish.querySelectorAll("button").forEach((x) =>
    x.classList.toggle("on", (x as HTMLButtonElement).dataset.want === (want ? "1" : "0")),
  );
}

function setDistCmp(cmp: "le" | "ge") {
  distCmp = cmp;
  fbDistCmp.querySelectorAll("button").forEach((x) =>
    x.classList.toggle("on", (x as HTMLButtonElement).dataset.cmp === cmp),
  );
  fbDistBoundLbl.textContent = cmp === "le" ? "at most" : "at least";
}

function syncEditMode() {
  fbOk.textContent = editingIndex === null ? "Add filter" : "Save filter";
}

function clearEditMode() {
  editingIndex = null;
  syncEditMode();
}

function loadFilterIntoCompose(f: Filter) {
  fbType.value = f.type;
  syncFbTypeUi();
  if (f.type === "room") {
    setPresenceToggle(f.negate);
    syncFbParams();
    pickRoom.setValue(f.room, true);
  } else if (f.type === "distance") {
    setDistCmp(f.cmp);
    fbMax.value = String(f.bound);
    syncFbParams();
    pickRoomA.setValue(f.roomA, true);
    pickRoomB.setValue(f.roomB, true);
  } else if (f.type === "finishable") {
    setFinishToggle(f.want);
    syncFbParams();
  } else if (f.type === "item") {
    setPresenceToggle(f.negate);
    syncFbParams();
    pickRoom.setValue(f.room, true);
    fillChoiceSelect(false);
    fbChoice.value = itemKey(f);
  } else if (f.type === "event") {
    setPresenceToggle(f.negate);
    syncFbParams();
    pickRoom.setValue(f.room, true);
    fillChoiceSelect(false);
    fbChoice.value = f.event;
  } else if (f.type === "out_of_place") {
    syncFbParams();
    pickRoom.setValue(f.room ?? "", true);
  } else if (f.type === "overlap") {
    syncFbParams();
    pickRoomA.setValue(f.roomA ?? "", true);
    pickRoomB.setValue(f.roomB ?? "", true);
  } else {
    syncFbParams();
  }
  syncPickPane();
  paintFlyList("none");
}

function editFilter(i: number) {
  if (scanning) return;
  const f = filters[i];
  if (!f) return;
  editingIndex = i;
  syncEditMode();
  setSearchPhase("compose");
  loadFilterIntoCompose(f);
  closeFilterPopover();
}

function syncFilterLock() {
  const locked = scanning;
  filterMenu.classList.toggle("locked", locked);
  chips.querySelectorAll<HTMLButtonElement>(".chip-edit, .chip-del").forEach((b) => {
    b.disabled = locked;
  });
  btnSessionIo.disabled = locked;
  if (locked) closeSessionIo();
  else syncSessionExportEnabled();
  syncPhaseTog();
}

function renderFilters() {
  const n = filters.length;
  filterSummary.textContent = n === 0 ? "no filters" : n === 1 ? "1 filter" : `${n} filters`;
  filterSummary.classList.toggle("has-filters", n > 0);
  filterEmpty.hidden = n > 0;
  chips.innerHTML = filters
    .map((f, i) => {
      const { kind, detail } = chipParts(f);
      return (
        `<div class="chip">` +
          `<span class="chip-label">` +
            `<span class="chip-kind">${escHtml(kind)}</span>` +
            (detail ? `<span class="chip-detail">${escHtml(detail)}</span>` : "") +
          `</span>` +
          `<span class="chip-actions">` +
            `<button type="button" class="chip-edit" data-i="${i}" aria-label="Edit">✎</button>` +
            `<button type="button" class="chip-del" data-i="${i}" aria-label="Remove">✕</button>` +
          `</span>` +
        `</div>`
      );
    })
    .join("");
  chips.querySelectorAll<HTMLButtonElement>(".chip-del").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (scanning) return;
      const i = Number(b.dataset.i);
      filters.splice(i, 1);
      if (editingIndex !== null) {
        if (editingIndex === i) clearEditMode();
        else if (editingIndex > i) editingIndex--;
      }
      renderFilters();
    }),
  );
  chips.querySelectorAll<HTMLButtonElement>(".chip-edit").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      editFilter(Number(b.dataset.i));
    }),
  );
  syncFilterLock();
}
renderFilters();
syncEditMode();

filterSummary.addEventListener("click", () => {
  if (filterPopover.hidden) openFilterPopover();
  else closeFilterPopover();
});
phaseTog.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-phase]");
  if (!btn || btn.disabled) return;
  const phase = btn.dataset.phase as SearchPhase;
  if (phase === "compose") clearEditMode();
  setSearchPhase(phase);
});
document.addEventListener("pointerdown", (e) => {
  if (filterPopover.hidden) return;
  const t = e.target as Node;
  if (filterMenu.contains(t)) return;
  closeFilterPopover();
});

function readComposeFilter(): Filter | null {
  switch (fbType.value) {
    case "room":
      if (!pickRoom.value) return null;
      return { type: "room", room: pickRoom.value, negate: roomNegate };
    case "distance": {
      if (!pickRoomA.value || !pickRoomB.value || pickRoomA.value === pickRoomB.value) return null;
      const bound = Math.max(0, Math.min(40, Number(fbMax.value) || 8));
      return { type: "distance", roomA: pickRoomA.value, roomB: pickRoomB.value, bound, cmp: distCmp };
    }
    case "finishable":
      return { type: "finishable", want: finishWant };
    case "overlap": {
      const roomA = pickRoomA.value || undefined;
      const roomB = pickRoomB.value || undefined;
      if (roomA && roomB && roomA === roomB) return null;
      return {
        type: "overlap",
        ...(roomA ? { roomA } : {}),
        ...(roomB ? { roomB } : {}),
      };
    }
    case "item": {
      if (!pickRoom.value) return null;
      const it = parseItemKey(fbChoice.value);
      if (!it) return null;
      return { type: "item", room: pickRoom.value, name: it.name, tempname: it.tempname, negate: roomNegate };
    }
    case "event": {
      if (!pickRoom.value || !fbChoice.value) return null;
      return { type: "event", room: pickRoom.value, event: fbChoice.value, negate: roomNegate };
    }
    case "out_of_place":
      return pickRoom.value
        ? { type: "out_of_place", room: pickRoom.value }
        : { type: "out_of_place" };
    default:
      return null;
  }
}

fbOk.addEventListener("click", () => {
  const next = readComposeFilter();
  if (!next) return;
  if (editingIndex !== null && editingIndex < filters.length) {
    filters[editingIndex] = next;
  } else {
    filters.push(next);
  }
  clearEditMode();
  renderFilters();
});

// --- Scan worker : stats live + start/stop ---
/** Horloge numérique (évite s/m/h ambigus en DS-Digital). */
function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(r)}`;
  return `${m}:${pad(r)}`;
}

function paintScanStats(opts: {
  done: number;
  total: number;
  found: number;
  rate: number | null;
  elapsed?: number | null;
  finished?: boolean;
}) {
  const { done, total, found, rate, finished } = opts;
  const elapsed = opts.elapsed ?? null;
  scanStats.hidden = false;
  scanDone.textContent = total > 0
    ? `${done.toLocaleString("en")} / ${total.toLocaleString("en")}`
    : done.toLocaleString("en");
  scanFound.textContent = found.toLocaleString("en");
  scanRate.textContent = rate !== null ? rate.toLocaleString("en") : "-";
  scanElapsed.textContent = elapsed !== null && elapsed >= 0 ? fmtDuration(elapsed) : "-";
  if (finished) {
    scanEta.textContent = "done";
  } else if (rate !== null && rate > 0 && done < total) {
    scanEta.textContent = fmtDuration((total - done) / rate);
  } else {
    scanEta.textContent = "-";
  }
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  scanBar.style.width = `${pct}%`;
  scanStats.classList.toggle("done", !!finished);
}

let scanStartedAt = 0;
let scanLive = { done: 0, total: 0, found: 0 };
let scanTick: ReturnType<typeof setInterval> | null = null;

function clearScanTick() {
  if (scanTick !== null) {
    clearInterval(scanTick);
    scanTick = null;
  }
}

function tickScanClock() {
  if (!scanning || scanStartedAt <= 0) return;
  const elapsed = (performance.now() - scanStartedAt) / 1000;
  const rate = elapsed > 0.25 ? Math.round(scanLive.done / elapsed) : null;
  paintScanStats({
    done: scanLive.done,
    total: scanLive.total,
    found: scanLive.found,
    rate,
    elapsed,
  });
}

function startScanTick(total: number) {
  clearScanTick();
  scanLive = { done: 0, total, found: 0 };
  scanTick = setInterval(tickScanClock, 250);
}

function stopScan(final?: {
  scanned: number;
  found: number;
  total: number;
  rate: number | null;
  elapsed?: number | null;
}) {
  clearScanTick();
  worker?.postMessage({ cmd: "stop" });
  scanning = false;
  scanBtn.textContent = "Search";
  barSearch.classList.remove("scanning");
  syncFilterLock();
  if (final) {
    paintScanStats({
      done: final.scanned,
      total: final.total,
      found: final.found,
      rate: final.rate,
      elapsed: final.elapsed ?? null,
      finished: true,
    });
  } else if (!scanStats.hidden) {
    scanStats.classList.add("done");
    if (scanStartedAt > 0) {
      scanElapsed.textContent = fmtDuration((performance.now() - scanStartedAt) / 1000);
    }
    scanEta.textContent = "-";
  }
  if (allMatches.length) {
    resultsPagingEnabled = true;
    rebuildViewMatches();
    renderResults();
  }
}

barSearch.addEventListener("submit", (e) => {
  e.preventDefault();
  if (scanning) { stopScan(); return; }

  const mod = sMod.checked;
  const max = mod ? MOD_MAX : BASE_SEED_MAX;
  const from = Math.max(mod ? 1 : 0, Math.floor(Number(fromInput.value) || 0));
  const to = Math.min(max, Math.floor(Number(toInput.value) || 0));
  if (to < from) { progress.textContent = "empty range"; return; }

  if (!filters.length) { progress.textContent = "no filters"; return; }

  const total = to - from + 1;
  hasScanSession = true;
  setSearchPhase("results");
  resetResultsState();
  lastScan = { mode: mod ? "mod" : "base", from, to, scanned: 0, found: 0 };
  syncPhaseTog();
  scanning = true;
  scanBtn.textContent = "Stop";
  barSearch.classList.add("scanning");
  syncFilterLock();
  progress.textContent = "";
  scanStartedAt = performance.now();
  startScanTick(total);
  paintScanStats({ done: 0, total, found: 0, rate: null, elapsed: 0 });

  worker ??= new Worker(new URL("./scan_worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (ev: MessageEvent<ScanReply>) => {
    const msg = ev.data;
    if (msg.type === "progress") {
      scanLive.done = msg.done;
      scanLive.found = msg.found;
      const elapsed = (performance.now() - scanStartedAt) / 1000;
      const rate = elapsed > 0.25 ? Math.round(msg.done / elapsed) : null;
      paintScanStats({ done: msg.done, total, found: msg.found, rate, elapsed });
    } else if (msg.type === "batch") {
      msg.matches.forEach(pushMatch);
      rebuildViewMatches();
      renderResults();
    } else if (msg.type === "done") {
      lastScan.scanned = msg.scanned;
      lastScan.found = msg.found;
      const elapsed = (performance.now() - scanStartedAt) / 1000;
      const rate = elapsed > 0.25 ? Math.round(msg.scanned / elapsed) : null;
      resultsPagingEnabled = true;
      resultsPage = 0;
      rebuildViewMatches();
      renderResults();
      stopScan({ scanned: msg.scanned, found: msg.found, total, rate, elapsed });
      if (memoryTruncated) {
        progress.textContent = `stored first ${SESSION_RESULTS_MAX.toLocaleString("en")} matches`;
      }
    }
  };
  worker.postMessage({ cmd: "start", mode: mod ? "mod" : "base", from, to, filters });
});

// --- Session I/O (export / import JSON) ---
btnSessionIo.addEventListener("click", () => {
  if (scanning) return;
  if (sessionIoOverlay.hidden) openSessionIo();
  else closeSessionIo();
});

sessionIoOverlay.addEventListener("click", (e) => {
  const t = e.target as Element;
  if (t.closest("[data-session-io-close]")) closeSessionIo();
});

// --- Session I/O : helpers + applySession ---
function canExportSession(): boolean {
  return filters.length > 0 || allMatches.length > 0;
}

function paintSessionIoCopy() {
  const n = SESSION_RESULTS_MAX.toLocaleString("en");
  const mb = sessionFileMaxMb();
  sessionIoLimits.replaceChildren(
    document.createTextNode(`Export is capped at ${n} results (~8-15 MB typical).`),
    document.createElement("br"),
    document.createTextNode(`Import rejects files larger than ${mb} MB.`),
  );
}

paintSessionIoCopy();

function syncSessionExportEnabled() {
  sessionExportBtn.disabled = scanning || !canExportSession();
  sessionImportBtn.disabled = scanning;
}

function setSessionIoStatus(msg: string, kind: "ok" | "error" | "plain" = "plain") {
  if (!msg) {
    sessionIoStatus.hidden = true;
    sessionIoStatus.textContent = "";
    sessionIoStatus.classList.remove("is-error", "is-ok");
    return;
  }
  sessionIoStatus.hidden = false;
  sessionIoStatus.textContent = msg;
  sessionIoStatus.classList.toggle("is-error", kind === "error");
  sessionIoStatus.classList.toggle("is-ok", kind === "ok");
}

function closeSessionIo() {
  if (sessionIoOverlay.hidden) return;
  sessionIoOverlay.hidden = true;
  btnSessionIo.setAttribute("aria-expanded", "false");
  setSessionIoStatus("");
}

function openSessionIo() {
  if (scanning) return;
  closeCodes();
  closeAbout();
  setSessionIoStatus("");
  syncSessionExportEnabled();
  sessionIoOverlay.hidden = false;
  btnSessionIo.setAttribute("aria-expanded", "true");
  (sessionExportBtn.disabled ? sessionImportBtn : sessionExportBtn).focus();
}

sessionExportBtn.addEventListener("click", () => {
  if (scanning) return;
  if (!canExportSession()) {
    setSessionIoStatus("Nothing to export. Add a filter or run a scan first.", "error");
    return;
  }
  const mod = sMod.checked;
  const max = mod ? MOD_MAX : BASE_SEED_MAX;
  const uiFrom = Math.max(mod ? 1 : 0, Math.floor(Number(fromInput.value) || 0));
  const uiTo = Math.min(max, Math.floor(Number(toInput.value) || 0));
  const hasScan = allMatches.length > 0 || lastScan.scanned > 0;
  const session = buildSession({
    mode: hasScan ? lastScan.mode : (mod ? "mod" : "base"),
    from: hasScan ? lastScan.from : uiFrom,
    to: hasScan ? lastScan.to : uiTo,
    filters,
    results: allMatches,
    scanned: hasScan ? lastScan.scanned : undefined,
    found: hasScan ? lastScan.found : undefined,
  });
  downloadSession(session);
  setSessionIoStatus("Exported.", "ok");
  progress.textContent = "";
});

sessionImportBtn.addEventListener("click", () => {
  if (scanning) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    const res = await readSessionFile(file);
    if (!res.ok) {
      setSessionIoStatus(res.error, "error");
      return;
    }
    applySession(res.session, res.truncated);
    closeSessionIo();
  });
  input.click();
});

function applySession(session: SearchSession, truncated: boolean) {
  setMode(true);

  filters.length = 0;
  filters.push(...session.filters);
  renderFilters();

  sMod.checked = session.mode === "mod";
  fromInput.value = String(session.from);
  toInput.value = String(session.to);

  resetResultsState();
  allMatches = session.results.slice();
  lastScan = {
    mode: session.mode,
    from: session.from,
    to: session.to,
    scanned: session.meta?.scanned ?? session.results.length,
    found: session.meta?.found ?? session.results.length,
  };
  hasScanSession = session.results.length > 0 || (session.meta?.scanned ?? 0) > 0;
  if (hasScanSession) {
    setSearchPhase("results");
    resultsPagingEnabled = true;
    resultsPage = 0;
    rebuildViewMatches();
    renderResults();
    paintScanStats({
      done: lastScan.scanned,
      total: Math.max(1, lastScan.to - lastScan.from + 1),
      found: lastScan.found,
      rate: null,
      elapsed: null,
      finished: true,
    });
  } else {
    setSearchPhase("compose");
  }
  syncPhaseTog();
  syncSessionExportEnabled();

  const notes: string[] = ["imported"];
  if (truncated) notes.push(`first ${session.results.length.toLocaleString("en")} results`);
  progress.textContent = notes.join(" · ");
}

// --- Codes office ↔ tunnels ---
const codeOffice = $<HTMLInputElement>("#code-office");
const codeTunnels = $<HTMLInputElement>("#code-tunnels");
const codeNote = $("#code-note");
let codeSync = false; // évite la boucle input→input

function closeCodes() {
  if (codesOverlay.hidden) return;
  codesOverlay.hidden = true;
  btnCodes.setAttribute("aria-expanded", "false");
}

function openCodes() {
  closeAbout();
  closeSessionIo();
  codesOverlay.hidden = false;
  btnCodes.setAttribute("aria-expanded", "true");
  codeOffice.focus();
}

btnCodes.addEventListener("click", () => {
  if (codesOverlay.hidden) openCodes();
  else closeCodes();
});

codesOverlay.addEventListener("click", (e) => {
  const t = e.target as Element;
  if (t.closest("[data-codes-close]")) closeCodes();
});

// --- About (licence) ---
function closeAbout() {
  if (aboutOverlay.hidden) return;
  aboutOverlay.hidden = true;
  btnAbout.setAttribute("aria-expanded", "false");
}

function openAbout() {
  closeCodes();
  closeSessionIo();
  aboutOverlay.hidden = false;
  btnAbout.setAttribute("aria-expanded", "true");
  const close = aboutOverlay.querySelector<HTMLButtonElement>("[data-about-close].session-io-close");
  close?.focus();
}

btnAbout.addEventListener("click", () => {
  if (aboutOverlay.hidden) openAbout();
  else closeAbout();
});

aboutOverlay.addEventListener("click", (e) => {
  const t = e.target as Element;
  if (t.closest("[data-about-close]")) closeAbout();
});

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
    codeNote.textContent = "Office code is four digits, each 1-9.";
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

// --- Boot ---
seedInput.value = "";
document.documentElement.dataset.theme = "snav";
document.documentElement.dataset.btn = "clay";
ensureMapFitObserver();
applyMapPalette();
startIdleCarousel();
