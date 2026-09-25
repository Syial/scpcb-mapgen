import type { MapModel, PlacedRoom } from "../generation";
import type { GeometryOptions, Scene, SceneRoom } from "./geometry";
import { buildScene } from "./geometry";

// Strip : bandes EZ → HCZ → LCZ, X global partagé.
// Checkpoints = bande courte. Endroom ROOM1 sur ligne CP : taille normale, déborde
// vers le cul-de-sac (haut si ouverte au sud, bas si au nord) pour éviter le chevauchement.

const STRIP_ORDER = [3, 2, 1] as const;
const CP_BETWEEN: Record<string, string> = {
  "3-2": "checkpoint2",
  "2-1": "checkpoint1",
};

const MAP_PAD = 4;
const ROOM_GAP = 3;
/** Padding haut/bas d'une bande (= ROOM_GAP) pour le même écart qu'entre deux salles. */
const STRIP_PAD_Y = ROOM_GAP;
const STRIP_PAD_X = 0;
const SEAM = 0;
const CP_H_RATIO = 0.62;

export interface StripMeta {
  zone: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StripDivider {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StripScene extends Scene {
  strips: StripMeta[];
  dividers: StripDivider[];
}

type LayoutCell = { gx: number; gy: number; zone: number; name: string };

export function buildStripScene(model: MapModel, opts: GeometryOptions = {}): StripScene {
  const base = buildScene(model, opts);
  const cell = base.cell;
  const gap = ROOM_GAP;
  const step = cell + gap;
  const margin = MAP_PAD;
  const N = model.mapSize;
  const mirror = opts.mirrorX ?? true;
  const dx = (x: number) => (mirror ? N + 1 - x : x);

  const rooms: SceneRoom[] = base.rooms.map((sr) => ({
    ...sr,
    tile: { ...sr.tile },
    open: { ...sr.open },
  }));

  type Entry = { sr: SceneRoom; i: number; gx: number; gy: number };
  const all: Entry[] = rooms.map((sr, i) => ({
    sr,
    i,
    gx: dx(sr.room.gx),
    gy: sr.room.gy,
  }));

  const toCell = (r: PlacedRoom): LayoutCell => ({
    gx: dx(r.gx),
    gy: r.gy,
    zone: r.zone,
    name: r.name,
  });

  // layoutRooms = cadrage final (anim) ; sinon les salles affichées
  const layout: LayoutCell[] = opts.layoutRooms
    ? opts.layoutRooms.map(toCell)
    : all.map((e) => ({
        gx: e.gx,
        gy: e.gy,
        zone: e.sr.room.zone,
        name: e.sr.room.name,
      }));

  const isCpName = (name: string) => name.startsWith("checkpoint");
  const isCp = (e: Entry) => isCpName(e.sr.room.name);

  const cpGy = new Map<string, number>();
  for (const c of layout) {
    if (!isCpName(c.name)) continue;
    if (!cpGy.has(c.name)) cpGy.set(c.name, c.gy);
  }
  const seamGys = new Set(cpGy.values());
  const isSeamCell = (c: { gy: number; name: string }) => !isCpName(c.name) && seamGys.has(c.gy);
  const isSeamRoom = (e: Entry) => !isCp(e) && seamGys.has(e.gy);

  // Largeur fixe = span de placement facility (x ∈ [1, N-2]), pas toute la grille 0‥N+1.
  const placeLo = 1;
  const placeHi = N - 2;
  const col0 = Math.min(dx(placeLo), dx(placeHi));
  const col1 = Math.max(dx(placeLo), dx(placeHi));
  const contentW = STRIP_PAD_X * 2 + (col1 - col0 + 1) * step - gap;
  const totalW = margin * 2 + contentW;
  const stripX = margin;
  const ox = stripX + STRIP_PAD_X;

  const layoutByZone = (z: number) =>
    layout.filter((c) => c.zone === z && !isCpName(c.name) && !isSeamCell(c));
  const byZone = (z: number) =>
    all.filter((e) => e.sr.room.zone === z && !isCp(e) && !isSeamRoom(e));

  const rowBounds = (list: { gy: number }[]) => {
    if (!list.length) return null;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const e of list) {
      y0 = Math.min(y0, e.gy);
      y1 = Math.max(y1, e.gy);
    }
    return { y0, y1, rows: y1 - y0 + 1 };
  };

  const place = (e: Entry, tx: number, ty: number, w: number, h: number) => {
    rooms[e.i].tile = { x: tx, y: ty, w, h };
    rooms[e.i].cx = tx + w / 2;
    rooms[e.i].cy = ty + h / 2;
  };

  const strips: StripMeta[] = [];
  const dividers: StripDivider[] = [];
  const cpH = cell * CP_H_RATIO;
  let y = margin;

  for (let zi = 0; zi < STRIP_ORDER.length; zi++) {
    const z = STRIP_ORDER[zi];
    const rb = rowBounds(layoutByZone(z));
    if (!rb) continue;

    const stripH = STRIP_PAD_Y * 2 + rb.rows * step - gap;
    strips.push({ zone: z, x: stripX, y, w: contentW, h: stripH });

    const oy = y + STRIP_PAD_Y;
    for (const e of byZone(z)) {
      const tx = ox + (e.gx - col0) * step;
      const ty = oy + (e.gy - rb.y0) * step;
      if (e.sr.room.zone === 0) {
        const inset = cell * 0.18;
        place(e, tx + inset, ty + inset, cell - inset * 2, cell - inset * 2);
      } else {
        place(e, tx, ty, cell, cell);
      }
    }

    y += stripH;

    if (zi < STRIP_ORDER.length - 1) {
      const nextZ = STRIP_ORDER[zi + 1];
      const cpName = CP_BETWEEN[`${z}-${nextZ}`];
      const cps = all.filter((e) => e.sr.room.name === cpName);
      const gy = cpGy.get(cpName);
      const seamRooms = gy === undefined ? [] : all.filter((e) => isSeamRoom(e) && e.gy === gy);
      // Bande toujours courte. Endrooms non-CP : taille normale, calées pour
      // déborder vers le vide (pas vers le voisin N/S).
      const divH = SEAM * 2 + cpH;
      dividers.push({ x: stripX, y, w: contentW, h: divH });
      const rowY = y + SEAM;
      for (const e of cps) {
        place(e, ox + (e.gx - col0) * step, rowY, cell, cpH);
      }
      for (const e of seamRooms) {
        // Ouverte au nord → top-align (débord bas) ; sinon bottom-align (débord haut).
        const ty = e.sr.open.n && !e.sr.open.s ? rowY : rowY + cpH - cell;
        place(e, ox + (e.gx - col0) * step, ty, cell, cell);
      }
      y += divH;
    }
  }

  const host = strips.find((s) => s.zone === 3) ?? strips[0];
  for (const e of all) {
    if (e.sr.room.zone !== 0 || isCp(e) || isSeamRoom(e)) continue;
    if (!host) continue;
    const inset = cell * 0.18;
    const ty = host.y + STRIP_PAD_Y + inset;
    if (e.gx < col0 || e.gx > col1) {
      place(e, host.x + host.w - cell + inset, ty, cell - inset * 2, cell - inset * 2);
    } else {
      place(e, ox + (e.gx - col0) * step + inset, ty, cell - inset * 2, cell - inset * 2);
    }
  }

  return {
    ...base,
    width: totalW,
    height: y + margin,
    margin,
    rooms,
    strips,
    dividers,
  };
}
