import type { MapModel, PlacedRoom } from "../generation";
import { isOverlapTracked } from "../generation";
import { calculateRoomExtents } from "../generation/overlap";
import { earlyEscapeTunnel } from "../analysis";
import { roomMapLabel } from "./labels";
import type { GeometryOptions, Scene, SceneRoom } from "./geometry";

// Carte aux extents monde réels (XZ). Les overlaps résiduels restent visibles.
// Clamp réservé aux salles dont l'AABB inclut un autre endroit (pas juste une grosse salle).

const SPACING = 8;
const SCALE = 12; // px SVG par unité monde
const MARGIN = 14;
const FALLBACK = SPACING * 0.85; // vraiment sans template
/** Taille max "salle jouable" quand on ignore les annexes mesh. */
const MAX_SPAN = SPACING * 1.35;

/** AABB mesh = salle + autre endroit (tunnels / sous-zone / extérieur). */
const OVERSIZED_ANNEX = new Set(["exit1", "room3storage", "room049"]);

export interface ExtentOptions extends GeometryOptions {
  /** true = AABB mesh complets pour exit1 / room3storage / room049. */
  oversizedMeshes?: boolean;
}

interface RawBox {
  r: PlacedRoom;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  tracked: boolean;
}

function clampToFootprint(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  r: PlacedRoom,
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const cx = r.gx * SPACING;
  const cz = r.gy * SPACING;
  const half = MAX_SPAN / 2;
  let x0 = minX;
  let x1 = maxX;
  let z0 = minZ;
  let z1 = maxZ;
  if (x1 - x0 > MAX_SPAN) {
    x0 = cx - half;
    x1 = cx + half;
  }
  if (z1 - z0 > MAX_SPAN) {
    z0 = cz - half;
    z1 = cz + half;
  }
  return { minX: x0, maxX: x1, minZ: z0, maxZ: z1 };
}

function collectRaws(
  rooms: PlacedRoom[],
  showAnomalous: boolean,
  showAnnex: boolean,
): RawBox[] {
  const raws: RawBox[] = [];
  for (const r of rooms) {
    if (!showAnomalous && r.zone === 0 && r.name !== "173") continue;
    // forDisplay : aussi les DisableOverlapCheck (bornes mesh présentes)
    const e = calculateRoomExtents(r, r.angle ?? 0, { forDisplay: true });
    if (e) {
      const box =
        !showAnnex && OVERSIZED_ANNEX.has(r.name)
          ? clampToFootprint(e.minX, e.maxX, e.minZ, e.maxZ, r)
          : e;
      raws.push({
        r,
        minX: box.minX,
        maxX: box.maxX,
        minZ: box.minZ,
        maxZ: box.maxZ,
        tracked: isOverlapTracked(r.name),
      });
    } else {
      const cx = r.gx * SPACING;
      const cz = r.gy * SPACING;
      const h = FALLBACK / 2;
      raws.push({
        r,
        minX: cx - h,
        maxX: cx + h,
        minZ: cz - h,
        maxZ: cz + h,
        tracked: false,
      });
    }
  }
  return raws;
}

function worldBounds(raws: RawBox[]) {
  let wMinX = Infinity;
  let wMaxX = -Infinity;
  let wMinZ = Infinity;
  let wMaxZ = -Infinity;
  for (const a of raws) {
    wMinX = Math.min(wMinX, a.minX);
    wMaxX = Math.max(wMaxX, a.maxX);
    wMinZ = Math.min(wMinZ, a.minZ);
    wMaxZ = Math.max(wMaxZ, a.maxZ);
  }
  return { wMinX, wMaxX, wMinZ, wMaxZ };
}

export function buildExtentScene(model: MapModel, opts: ExtentOptions = {}): Scene {
  const showAnomalous = opts.showAnomalous ?? true;
  const mirror = opts.mirrorX ?? true;
  const showAnnex = opts.oversizedMeshes ?? false;
  const speedrun = opts.speedrunLabels ?? false;
  const minimal = opts.minimalLabels ?? false;
  const pdExit = earlyEscapeTunnel(model.rooms);
  const isPdExit = (r: PlacedRoom) => !!pdExit && r.gx === pdExit.gx && r.gy === pdExit.gy;

  const raws = collectRaws(model.rooms, showAnomalous, showAnnex);
  const boundRaws = opts.layoutRooms
    ? collectRaws(opts.layoutRooms, showAnomalous, showAnnex)
    : raws;

  if (!boundRaws.length) {
    return {
      width: 80,
      height: 80,
      cell: SCALE * SPACING,
      margin: MARGIN,
      rooms: [],
    };
  }

  const { wMinX, wMaxX, wMinZ, wMaxZ } = worldBounds(boundRaws);
  const worldW = Math.max(wMaxX - wMinX, 1);
  const worldH = Math.max(wMaxZ - wMinZ, 1);

  const toSvgX = (wx: number) =>
    mirror ? MARGIN + (wMaxX - wx) * SCALE : MARGIN + (wx - wMinX) * SCALE;
  const toSvgY = (wz: number) => MARGIN + (wz - wMinZ) * SCALE;

  const rooms: SceneRoom[] = [];
  for (const a of raws) {
    const x0 = toSvgX(a.minX);
    const x1 = toSvgX(a.maxX);
    const y0 = toSvgY(a.minZ);
    const y1 = toSvgY(a.maxZ);
    const x = Math.min(x0, x1);
    const y = Math.min(y0, y1);
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    const info = roomMapLabel(a.r.name, isPdExit(a.r), { speedrun, minimal });
    rooms.push({
      room: a.r,
      tile: { x, y, w, h },
      label: info,
      tracked: a.tracked,
      cx: x + w / 2,
      cy: y + h / 2,
      open: { n: false, s: false, e: false, w: false },
    });
  }

  return {
    width: MARGIN * 2 + worldW * SCALE,
    height: MARGIN * 2 + worldH * SCALE,
    cell: SCALE * SPACING,
    margin: MARGIN,
    rooms,
  };
}
