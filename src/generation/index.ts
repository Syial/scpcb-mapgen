import { BlitzRng } from "../rng/blitz_rng";
import { carveCorridors } from "./carving";
import { assignRooms } from "./rooms";
import { placeRooms, type PlacedRoom } from "./placement";
import { ROOM2 } from "./rooms";
import { createDoors, type Door } from "./doors";
import extentsData from "./room_extents.json";
import { selectTemplate } from "./selection";
import { consumeFiller } from "./filler";
import { preventRoomOverlap } from "./overlap";
import { generateTunnels, type TunnelGrid } from "./tunnels";

export type { PlacedRoom, Door };

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
  forest?: number[];
}

// Rejoue la boucle de création (7459-7570) au niveau RNG : identifie les génériques, oriente les ROOM2 droites, capture la forêt.
export function identifyGenericRooms(rng: BlitzRng, grid: number[][], placed: PlacedRoom[]): number[] | undefined {
  let forestGrid: number[] | undefined;
  for (const p of placed) {
    if (p.zone === 0) break; // les spéciales arrivent après toutes les génériques
    let templateName = p.name;
    if (templateName === "") {
      const t = selectTemplate(rng, p.zone, p.shape);
      templateName = t ? t.name : "";
      p.name = templateName;
    }
    const fg = consumeFiller(rng, templateName, grid, p.gx, p.gy);
    if (fg) forestGrid = fg; // room860 renvoie sa grille de forêt
    if (p.shape === ROOM2 && p.angle === null) {
      // Rand(2) fixe l'angle des ROOM2 droites, cosmétique mais le tirage compte
      const horizontal = grid[p.gx - 1][p.gy] > 0 && grid[p.gx + 1][p.gy] > 0;
      const roll = rng.randInt(2);
      p.angle = horizontal ? (roll === 1 ? 90 : 270) : roll === 1 ? 180 : 0;
    }
  }
  return forestGrid;
}

// Faux = DisableOverlapCheck (rooms.ini) : le jeu ne teste jamais ces salles.
export function isOverlapTracked(name: string): boolean {
  const t = (extentsData as any).templates[name];
  return !!t && !t.disableOverlap;
}

// Carte complète d'une seed : RNG → carving → salles → placement → génériques → portes.
export function generateMap(seed: string, mapSize = 18, introEnabled = false): MapModel {
  return generateMapFromNumber(BlitzRng.generateSeedNumber(seed), seed, mapSize, introEnabled);
}

// Trace depuis un nombre brut (mode mod, sans hash) — seul accès au-delà de ~2²².
export function generateMapFromNumber(seedNumber: number, seedLabel: string, mapSize = 18, introEnabled = false): MapModel {
  const rng = new BlitzRng(seedNumber);

  // CreateMap (MapSystem.bb 7023-7588), dans l'ordre du jeu
  const carve = carveCorridors(rng, mapSize);
  const rooms = assignRooms(rng, carve);
  // placeRooms émet aussi les spéciales (zone 0) ; 173 participe à l'overlap
  const placed = placeRooms(rooms, mapSize, mapSize, introEnabled);
  const forestGrid = identifyGenericRooms(rng, carve.grid, placed);
  // PreventRoomOverlap (7586-7588) : 0 RNG mais déplace des salles
  preventRoomOverlap(placed);
  const doors = createDoors(carve.grid, mapSize, mapSize);

  const tunnels = generateTunnels(seedNumber);

  return { seed: seedLabel, seedNumber, mapSize, grid: carve.grid, rooms: placed, doors, tunnels, forest: forestGrid };
}
