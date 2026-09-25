import { BlitzRng } from "../rng/blitz_rng";
import { carveCorridors } from "./carving";
import { assignRooms } from "./rooms";
import { placeRooms, type PlacedRoom, doorsForRoom } from "./placement";
import { ROOM2 } from "./rooms";
import { createDoors, type Door } from "./doors";
import extentsData from "./room_extents.json";
import { selectTemplate } from "./selection";
import { consumeFiller, type RoomItem, type ForestLog } from "./filler";
import { preventRoomOverlap } from "./overlap";
import { generateTunnels, type TunnelGrid } from "./tunnels";
import { consumeLoadingRng, initEvents } from "./events";
import { snapshotRoom, snapshotRooms, type GenStep } from "./timeline";

export type { PlacedRoom, Door, RoomItem, ForestLog };
export type { RoomDoorMeta } from "./placement";
export type { GenStep } from "./timeline";
export { eventDescr } from "./events";
export { applyGenStep } from "./timeline";

export interface ForestMap {
  grid: number[];
  logs: ForestLog[];
}

export interface MapModel {
  seed: string;
  seedNumber: number;
  mapSize: number;
  grid: number[][];        // grille de types (0/1..4/255), indices 0..mapSize+1
  rooms: PlacedRoom[];
  doors: Door[];
  // tunnels de maintenance, re-seedés sur le hash donc dérivables de la seed
  tunnels: TunnelGrid;
  // forêt de SCP-860 (10×10), undefined si room860 absente
  forest?: ForestMap;
}

// Rejoue la boucle de création (7459-7570) au niveau RNG : identifie les génériques, oriente les ROOM2 droites, capture la forêt.
// Inclut les salles zone 0 (gatea, PD, 1499, 173) : FillRoom y tourne aussi (lumières / tirages).
export function identifyGenericRooms(
  rng: BlitzRng,
  grid: number[][],
  placed: PlacedRoom[],
  onIdentify?: (placed: PlacedRoom[], index: number) => void,
): ForestMap | undefined {
  let forest: ForestMap | undefined;
  for (let i = 0; i < placed.length; i++) {
    const p = placed[i];
    let templateName = p.name;
    if (templateName === "" && p.zone > 0) {
      const t = selectTemplate(rng, p.zone, p.shape);
      templateName = t ? t.name : "";
      p.name = templateName;
    }
    const filled = consumeFiller(rng, templateName, grid, p.gx, p.gy);
    if (filled.forest) forest = filled.forest;
    if (filled.items.length) p.items = filled.items;
    const dm = doorsForRoom(templateName);
    if (dm?.length) p.doorMeta = dm;
    if (p.shape === ROOM2 && p.angle === null) {
      // Rand(2) fixe l'angle des ROOM2 droites, cosmétique mais le tirage compte
      const horizontal = grid[p.gx - 1][p.gy] > 0 && grid[p.gx + 1][p.gy] > 0;
      const roll = rng.randInt(2);
      p.angle = horizontal ? (roll === 1 ? 90 : 270) : roll === 1 ? 180 : 0;
    }
    onIdentify?.(placed, i);
  }
  return forest;
}

// Faux = DisableOverlapCheck (rooms.ini) : le jeu ne teste jamais ces salles.
export function isOverlapTracked(name: string): boolean {
  const t = (extentsData as any).templates[name];
  return !!t && !t.disableOverlap;
}

// Carte complète d'une seed : RNG → carving → salles → placement → génériques → portes → events.
export function generateMap(
  seed: string,
  mapSize = 18,
  introEnabled = false,
  opts: {
    aggressiveNPCs?: boolean;
    onStep?: (step: GenStep) => void;
  } = {},
): MapModel {
  return generateMapFromNumber(BlitzRng.generateSeedNumber(seed), seed, mapSize, introEnabled, opts);
}

// Trace depuis un nombre brut (mode mod, sans hash) - seul accès au-delà de ~2²².
export function generateMapFromNumber(
  seedNumber: number,
  seedLabel: string,
  mapSize = 18,
  introEnabled = false,
  opts: {
    aggressiveNPCs?: boolean;
    /** Enregistrement optionnel des étapes (observation seule, n'altère pas le RNG). */
    onStep?: (step: GenStep) => void;
  } = {},
): MapModel {
  const rng = new BlitzRng(seedNumber);
  const onStep = opts.onStep;
  const emit = (step: GenStep) => onStep?.(step);

  // CreateMap (MapSystem.bb 7023-7588), dans l'ordre du jeu
  const carve = carveCorridors(rng, mapSize);
  const rooms = assignRooms(rng, carve);
  // placeRooms émet aussi les spéciales (zone 0) ; 173 participe à l'overlap
  const placed = placeRooms(rooms, mapSize, mapSize, introEnabled, (p) => {
    emit({ phase: "place", room: snapshotRoom(p[p.length - 1]) });
  });
  const forest = identifyGenericRooms(rng, carve.grid, placed, (_p, index) => {
    emit({ phase: "identify", index, room: snapshotRoom(placed[index]) });
  });
  // PreventRoomOverlap (7586-7588) : 0 RNG mais déplace des salles
  preventRoomOverlap(placed, undefined, (kind) => {
    emit({ phase: "overlap", kind, rooms: snapshotRooms(placed) });
  });
  const doors = createDoors(carve.grid, placed, mapSize, mapSize, rng);

  // Loading (Main.bb) : 106 state + décalques (+ items start) + yaw, puis InitEvents
  consumeLoadingRng(rng, placed, introEnabled);
  initEvents(rng, placed, opts.aggressiveNPCs ?? false);

  const tunnels = generateTunnels(seedNumber);

  return { seed: seedLabel, seedNumber, mapSize, grid: carve.grid, rooms: placed, doors, tunnels, forest };
}
