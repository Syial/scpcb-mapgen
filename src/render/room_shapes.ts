import type { SceneRoom } from "./geometry";
import { ROOM1 } from "../generation/rooms";

// Formes de salles (strip) : un seul path par salle (pas d'assemblage de rects).
// Largeur de couloir fixe ; ROOM1 / cul-de-sac = carré plein.
// Checkpoints = couloir N-S (même style), y compris dans la bande basse.
// Réutilisé par tunnels / forêt.

/** marge unitaire → épaisseur de couloir = 1 - 2M (plus M est petit, plus c'est large) */
export const CORRIDOR_M = 0.12;

export type Open = { n: boolean; s: boolean; e: boolean; w: boolean };

/** Contour unique centre + bras, coords unitaires [0..1]. */
export function corridorOutline(o: Open): string {
  const m = CORRIDOR_M;
  const a = 1 - CORRIDOR_M;
  const p: string[] = [];
  const move = (x: number, y: number) => p.push(`M${x} ${y}`);
  const line = (x: number, y: number) => p.push(`L${x} ${y}`);

  if (o.n) {
    move(m, 0);
    line(a, 0);
    line(a, m);
  } else {
    move(m, m);
    line(a, m);
  }

  if (o.e) {
    line(1, m);
    line(1, a);
    line(a, a);
  } else {
    line(a, a);
  }

  if (o.s) {
    line(a, 1);
    line(m, 1);
    line(m, a);
  } else {
    line(m, a);
  }

  if (o.w) {
    line(0, a);
    line(0, m);
    line(m, m);
  } else {
    line(m, m);
  }

  if (o.n) line(m, 0);

  p.push("Z");
  return p.join(" ");
}

const f = (n: number) => Math.round(n * 1000) / 1000;

/** Tuile corridor (ou carré si ≤1 ouverture), placée dans le plan. */
export function corridorTileSvg(x: number, y: number, w: number, h: number, o: Open, fill: string): string {
  const nOpen = (o.n ? 1 : 0) + (o.s ? 1 : 0) + (o.e ? 1 : 0) + (o.w ? 1 : 0);
  const ns = `vector-effect="non-scaling-stroke"`;
  if (nOpen <= 1) {
    return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" ${ns}/>`;
  }
  return `<path transform="translate(${f(x)} ${f(y)}) scale(${f(w)} ${f(h)})" d="${corridorOutline(o)}" fill="${fill}" ${ns}/>`;
}

/**
 * SVG d'une salle facility. null → rect simple (zone 0, bande étroite non-CP).
 */
export function roomShapeSvg(sr: SceneRoom, fill: string): string | null {
  const r = sr.room;
  if (r.zone === 0) return null;

  const isCp = r.name.startsWith("checkpoint");
  const short = sr.tile.h < sr.tile.w * 0.85;
  if (short && !isCp) return null;

  const { x, y, w, h } = sr.tile;
  const o = sr.open;
  const nOpen = (o.n ? 1 : 0) + (o.s ? 1 : 0) + (o.e ? 1 : 0) + (o.w ? 1 : 0);

  if (isCp) {
    return corridorTileSvg(x, y, w, h, { n: true, s: true, e: false, w: false }, fill);
  }

  if (r.shape === ROOM1 || nOpen <= 1) {
    return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" vector-effect="non-scaling-stroke"/>`;
  }

  return corridorTileSvg(x, y, w, h, o, fill);
}
