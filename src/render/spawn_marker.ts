import type { SceneRoom } from "./geometry";
import { DEFAULT_CELL } from "./geometry";
import { stripTheme } from "./theme";

/** Salle de spawn : intro 173 si présente, sinon start. */
export function findSpawnRoom(rooms: SceneRoom[]): SceneRoom | null {
  return rooms.find((sr) => sr.room.name === "173")
    ?? rooms.find((sr) => sr.room.name === "start")
    ?? null;
}

/** Orientation SVG (0 = nord / haut), vers la sortie ouverte. */
function facingDeg(sr: SceneRoom): number {
  const o = sr.open;
  if (o.n) return 0;
  if (o.e) return 90;
  if (o.s) return 180;
  if (o.w) return 270;
  return 0;
}

/** Point S-NAV : x+Cos(a)*len, y-Sin(a)*len (Main.bb). */
function navPt(yawDeg: number, len: number): { x: number; y: number } {
  const a = (yawDeg * Math.PI) / 180;
  return { x: Math.cos(a) * len, y: -Math.sin(a) * len };
}

/**
 * Flèche qui clignote (Main.bb) : 700 ms on / 300 ms off.
 * Triangle creux, taille fixe (indépendante de la case).
 */
export const SPAWN_MARKER_CSS =
  ".spawn-marker{pointer-events:none}" +
  ".spawn-arrow{animation:snav-arrow 1s step-end infinite}" +
  "@keyframes snav-arrow{0%,70%{opacity:1}70.01%,100%{opacity:0}}" +
  "@media (prefers-reduced-motion:reduce){.spawn-arrow{animation:none;opacity:1}}";

/** Échelle de la flèche, calée sur la grille normale (pas real-size). */
const ARROW_S = DEFAULT_CELL / 24;

export function spawnMarkerSvg(
  sr: SceneRoom,
  opts: { index?: number; pending?: boolean } = {},
): string {
  const rot = facingDeg(sr);

  // triangle - tip*6, base*5, +/-140° (Main.bb)
  const tip = navPt(90, 6 * ARROW_S);
  const b1 = navPt(90 - 140, 5 * ARROW_S);
  const b2 = navPt(90 + 140, 5 * ARROW_S);

  const cx = f(sr.cx);
  const cy = f(sr.cy);
  const d =
    "M" + f(tip.x) + " " + f(tip.y) +
    " L" + f(b1.x) + " " + f(b1.y) +
    " L" + f(b2.x) + " " + f(b2.y) + " Z";

  const pending = opts.pending ? " is-pending" : "";
  const dataI = opts.index !== undefined ? ` data-i="${opts.index}"` : "";
  // Phase calée sur l'horloge : un re-paint SVG (overlap) ne fige plus le clignotement.
  const phaseMs = Date.now() % 1000;

  return (
    '<g class="spawn-marker' + pending + '" transform="translate(' + cx + " " + cy + ") rotate(" + rot + ')"' +
      dataI +
      ' aria-label="Player spawn">' +
      '<path class="spawn-arrow" fill="none" stroke="' + stripTheme.frame + '" stroke-width="1" stroke-linejoin="miter"' +
        ' style="animation-delay:-' + phaseMs + 'ms"' +
        ' d="' + d + '"/>' +
    "</g>"
  );
}

function f(n: number): number {
  return Math.round(n * 100) / 100;
}
