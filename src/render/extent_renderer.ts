import type { Rect, Scene } from "./geometry";
import { stripTheme } from "./theme";
import { esc } from "./esc";
import { findSpawnRoom, spawnMarkerSvg } from "./spawn_marker";
import { roomInteractionCss } from "./room_interaction_css";

// Rendu extents : rectangles opaques ; fill accent sur l'intersection exacte des overlaps.

function rectIntersection(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x || y2 <= y) return null;
  return { x, y, w: x2 - x, h: y2 - y };
}

export function renderExtentSvg(scene: Scene, opts: { pendingAll?: boolean } = {}): string {
  const t = stripTheme;
  const pendingAll = opts.pendingAll ?? false;
  const p: string[] = [];
  const NS = `vector-effect="non-scaling-stroke"`;

  const overlapping = new Set<number>();
  const hits: Rect[] = [];
  for (let i = 0; i < scene.rooms.length; i++) {
    for (let j = i + 1; j < scene.rooms.length; j++) {
      const inter = rectIntersection(scene.rooms[i].tile, scene.rooms[j].tile);
      if (!inter) continue;
      overlapping.add(i);
      overlapping.add(j);
      hits.push(inter);
    }
  }

  p.push(
    `<svg viewBox="0 0 ${f(scene.width)} ${f(scene.height)}" ` +
      `preserveAspectRatio="xMidYMid meet" ` +
      `role="img" aria-label="Facility map (real extents)">`,
  );

  p.push(`<style>${roomInteractionCss(t, `.overlap-hit{pointer-events:none}`)}</style>`);

  p.push(`<rect x="0" y="0" width="${f(scene.width)}" height="${f(scene.height)}" fill="${t.screen}"/>`);

  // petits d'abord → gros ensuite (la salle du dessus reste cliquable)
  const order = scene.rooms
    .map((sr, i) => ({ sr, i, area: sr.tile.w * sr.tile.h }))
    .sort((a, b) => a.area - b.area);

  for (const { sr, i } of order) {
    const r = sr.room;
    const q = sr.tile;
    const isCp = r.name.startsWith("checkpoint");
    const hit = overlapping.has(i);
    const pending = pendingAll ? " is-pending" : "";
    const fill = isCp ? t.frame : t.room;
    p.push(
      `<g class="room${isCp ? " cp" : ""}${hit ? " overlap" : ""}${pending}" data-i="${i}" ` +
        `data-gx="${r.gx}" data-gy="${r.gy}" tabindex="0" ` +
        `aria-label="${esc(r.name || "generic room")}">` +
        `<rect x="${f(q.x)}" y="${f(q.y)}" width="${f(q.w)}" height="${f(q.h)}" ` +
        `fill="${fill}" stroke="none" stroke-width="0" ${NS}/>`,
    );
    if (sr.label && !isCp) {
      const fs = labelFontSize(q, sr.label);
      p.push(
        `<text x="${f(sr.cx)}" y="${f(sr.cy)}" fill="${t.label}" ` +
          `font-family='${esc(t.fontMono)}' font-size="${f(fs)}" text-anchor="middle" ` +
          `dominant-baseline="central" letter-spacing="0.06" pointer-events="none">${esc(sr.label)}</text>`,
      );
    }
    p.push(`</g>`);
  }

  if (hits.length) {
    p.push(`<g class="overlap-hits" aria-hidden="true">`);
    for (const q of hits) {
      p.push(
        `<rect class="overlap-hit" x="${f(q.x)}" y="${f(q.y)}" width="${f(q.w)}" height="${f(q.h)}" ` +
          `fill="${t.hover}" fill-opacity="0.72"/>`,
      );
    }
    p.push(`</g>`);
  }

  const spawn = findSpawnRoom(scene.rooms);
  if (spawn) {
    const si = scene.rooms.indexOf(spawn);
    p.push(spawnMarkerSvg(spawn, { index: si >= 0 ? si : undefined, pending: pendingAll }));
  }

  return p.join("") + `</svg>`;
}

function f(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Taille de label proportionnelle à la room (extents seulement). */
function labelFontSize(tile: Rect, text: string): number {
  const side = Math.min(tile.w, tile.h);
  const bySide = side * 0.34;
  const byWidth = (tile.w * 0.82) / Math.max(text.length * 0.62, 1);
  return Math.min(40, Math.max(11, Math.min(bySide, byWidth)));
}
