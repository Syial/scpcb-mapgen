import type { MapModel, PlacedRoom } from "../generation";
import { isOverlapTracked } from "../generation";
import { earlyEscapeTunnel } from "../analysis";
import { roomMapLabel } from "./labels";

/** Grille strip / spawn (px). */
export const DEFAULT_CELL = 40;

// Géométrie de la carte, langage S-NAV : tuiles pleines collées. Pas de couleurs ici.

export interface Rect { x: number; y: number; w: number; h: number; }
export interface SceneRoom {
  room: PlacedRoom;
  tile: Rect;
  label: string | null;
  // false = DisableOverlapCheck : le jeu ne calcule aucun extent pour elle
  tracked: boolean;
  cx: number; cy: number;
  // voisins occupés APRÈS miroir : ouvertures de la salle
  open: { n: boolean; s: boolean; e: boolean; w: boolean };
}
export interface Scene {
  width: number; height: number;
  cell: number; margin: number;
  rooms: SceneRoom[];
}

export interface GeometryOptions {
  cell?: number;
  margin?: number;
  mirrorX?: boolean; // Blitz3D est left-handed, on inverse en x (défaut true)
  // afficher les salles zone 0 (garées dans les coins par le jeu)
  showAnomalous?: boolean;
  /** Labels K1/K2/EC/MT/SR/PD pour le routing speedrun. */
  speedrunLabels?: boolean;
  /** Ne garder que A, B, 914, 008, 079. */
  minimalLabels?: boolean;
  /** Cadrage figé (build anim) : bandes / bornes calculées sur ces salles. */
  layoutRooms?: PlacedRoom[];
}

export function buildScene(model: MapModel, opts: GeometryOptions = {}): Scene {
  const cell = opts.cell ?? DEFAULT_CELL;
  const margin = opts.margin ?? 38; // accueille l'accolade latérale (titres 12px)
  const N = model.mapSize;
  const width = margin * 2 + (N + 2) * cell;
  const height = margin * 2 + (N + 2) * cell;
  const mirror = opts.mirrorX ?? true;
  const showAnomalous = opts.showAnomalous ?? true;
  const speedrun = opts.speedrunLabels ?? false;
  const minimal = opts.minimalLabels ?? false;
  const pdExit = earlyEscapeTunnel(model.rooms);
  const isPdExit = (r: PlacedRoom) => !!pdExit && r.gx === pdExit.gx && r.gy === pdExit.gy;

  const occ = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x <= N + 1 && y <= N + 1 && model.grid[x][y] > 0;
  // colonne d'affichage : le miroir se fait en indices, tout le reste suit
  const dx = (x: number) => (mirror ? N + 1 - x : x);

  const rooms: SceneRoom[] = [];
  for (const r of model.rooms) {
    // 173 est en zone 0 mais c'est la salle de départ, on la garde
    if (!showAnomalous && r.zone === 0 && r.name !== "173") continue;
    const gx = dx(r.gx);
    const ox = margin + gx * cell, oy = margin + r.gy * cell;
    const label = roomMapLabel(r.name, isPdExit(r), { speedrun, minimal });
    const tracked = isOverlapTracked(r.name);

    if (r.zone === 0) {
      // salle zone 0 : boîte seule, en retrait
      const inset = cell * 0.2;
      rooms.push({
        room: r,
        tile: { x: ox + inset, y: oy + inset, w: cell - 2 * inset, h: cell - 2 * inset },
        label, tracked, cx: ox + cell / 2, cy: oy + cell / 2,
        open: { n: false, s: false, e: false, w: false },
      });
      continue;
    }

    // e/w s'échangent au miroir
    const open = {
      n: occ(r.gx, r.gy - 1),
      s: occ(r.gx, r.gy + 1),
      e: mirror ? occ(r.gx - 1, r.gy) : occ(r.gx + 1, r.gy),
      w: mirror ? occ(r.gx + 1, r.gy) : occ(r.gx - 1, r.gy),
    };
    rooms.push({
      room: r,
      tile: { x: ox, y: oy, w: cell, h: cell },
      label, tracked, cx: ox + cell / 2, cy: oy + cell / 2, open,
    });
  }

  return { width, height, cell, margin, rooms };
}
