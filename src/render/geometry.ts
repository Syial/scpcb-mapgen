import type { MapModel, PlacedRoom } from "../generation";
import { isOverlapTracked } from "../generation";
import { landmarkLabel } from "./labels";

// Géométrie de la carte : chaque salle = corps + bras vers ses voisins. Pas de couleurs ici.

export interface Rect { x: number; y: number; w: number; h: number; }
export interface SceneRoom {
  room: PlacedRoom;
  rects: Rect[];
  label: string | null;
  // false = DisableOverlapCheck : le jeu ne calcule aucun extent pour elle
  tracked: boolean;
  cx: number; cy: number;
}
// bande horizontale d'une zone
export interface SceneBand { zone: number; y: number; h: number; }
export interface Scene {
  width: number; height: number;
  cell: number; margin: number;
  rooms: SceneRoom[];
  bands: SceneBand[];
}

export interface GeometryOptions {
  cell?: number;
  margin?: number;
  bodyFrac?: number;
  armFrac?: number;
  mirrorX?: boolean; // Blitz3D est left-handed, on inverse en x (défaut true)
  // afficher les salles zone 0 (garées dans les coins par le jeu)
  showAnomalous?: boolean;
}

export function buildScene(model: MapModel, opts: GeometryOptions = {}): Scene {
  const cell = opts.cell ?? 40;
  const margin = opts.margin ?? 38; // accueille l'accolade latérale (titres 12px)
  const bodyFrac = opts.bodyFrac ?? 0.56;
  const armFrac = opts.armFrac ?? 0.3;

  const N = model.mapSize;
  const width = margin * 2 + (N + 2) * cell;
  const height = margin * 2 + (N + 2) * cell;

  const bodyW = cell * bodyFrac;
  const bodyInset = (cell - bodyW) / 2;
  const armW = cell * armFrac;
  const armInset = (cell - armW) / 2;

  const occ = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x <= N + 1 && y <= N + 1 && model.grid[x][y] > 0;

  const rooms: SceneRoom[] = [];

  const showAnomalous = opts.showAnomalous ?? true;

  for (const r of model.rooms) {
    // 173 est en zone 0 mais c'est la salle de départ, on la garde
    if (!showAnomalous && r.zone === 0 && r.name !== "173") continue;
    const ox = margin + r.gx * cell;
    const oy = margin + r.gy * cell;
    const cx = ox + cell / 2;
    const cy = oy + cell / 2;
    const label = landmarkLabel(r.name);
    const tracked = isOverlapTracked(r.name);

    if (r.zone === 0) {
      // salle zone 0 : boîte seule, pas de bras
      const inset = cell * 0.2;
      rooms.push({
        room: r,
        rects: [{ x: ox + inset, y: oy + inset, w: cell - 2 * inset, h: cell - 2 * inset }],
        label, tracked, cx, cy,
      });
      continue;
    }

    const rects: Rect[] = [
      { x: ox + bodyInset, y: oy + bodyInset, w: bodyW, h: bodyW },
    ];
    // un bras par voisin occupé, léger overlap pour une union sans couture
    if (occ(r.gx, r.gy - 1)) rects.push({ x: ox + armInset, y: oy, w: armW, h: bodyInset + 1 });
    if (occ(r.gx, r.gy + 1)) rects.push({ x: ox + armInset, y: oy + bodyInset + bodyW - 1, w: armW, h: bodyInset + 1 });
    if (occ(r.gx + 1, r.gy)) rects.push({ x: ox + bodyInset + bodyW - 1, y: oy + armInset, w: bodyInset + 1, h: armW });
    if (occ(r.gx - 1, r.gy)) rects.push({ x: ox, y: oy + armInset, w: bodyInset + 1, h: armW });

    rooms.push({ room: r, rects, label, tracked, cx, cy });
  }

  // miroir X : Blitz3D est left-handed, on inverse à l'affichage
  if (opts.mirrorX ?? true) {
    for (const sr of rooms) {
      for (const rc of sr.rects) rc.x = width - rc.x - rc.w;
      sr.cx = width - sr.cx;
    }
  }

  // bandes de zone, checkpoints exclus (deux zones adjacentes = segments qui se touchent)
  const bands: SceneBand[] = [];
  for (const z of [1, 2, 3]) {
    const ys = model.rooms
      .filter((r) => r.zone === z && !r.name.startsWith("checkpoint"))
      .map((r) => r.gy);
    if (!ys.length) continue;
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    bands.push({ zone: z, y: margin + y0 * cell, h: (y1 - y0 + 1) * cell });
  }

  return { width, height, cell, margin, rooms, bands };
}
