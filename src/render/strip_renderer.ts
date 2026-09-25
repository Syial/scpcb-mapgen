import type { StripScene } from "./strip_geometry";
import { stripTheme, MAP_FRAME_PX } from "./theme";
import { esc } from "./esc";
import { roomShapeSvg } from "./room_shapes";
import { findSpawnRoom, spawnMarkerSvg } from "./spawn_marker";
import { roomInteractionCss } from "./room_interaction_css";

// Rendu strip map : fond olive uniforme, séparation checkpoint par le vide.

export function renderStripSvg(
  scene: StripScene,
  opts: { roomShapes?: boolean; pendingAll?: boolean } = {},
): string {
  const t = stripTheme;
  const shaped = opts.roomShapes ?? true;
  const pendingAll = opts.pendingAll ?? false;
  const p: string[] = [];
  const NS = `vector-effect="non-scaling-stroke"`;

  p.push(
    `<svg viewBox="0 0 ${f(scene.width)} ${f(scene.height)}" ` +
      `preserveAspectRatio="xMidYMid meet" ` +
      `role="img" aria-label="Facility map (strip view)">`,
  );

  p.push(`<style>${roomInteractionCss(t)}</style>`);

  p.push(`<rect x="0" y="0" width="${f(scene.width)}" height="${f(scene.height)}" fill="${t.screen}"/>`);

  // Séparateurs checkpoint : même épaisseur/couleur que le cadre map (--map-frame), sous les salles.
  // x déborde largement : après fitMapViewBox le viewBox s'élargit, la ligne doit coller au cadre.
  const frameW = MAP_FRAME_PX;
  const linePad = 9999;
  for (const d of scene.dividers) {
    const cy = d.y + d.h / 2;
    p.push(
      `<line x1="${-linePad}" y1="${f(cy)}" x2="${f(scene.width + linePad)}" y2="${f(cy)}" ` +
        `stroke="${t.frame}" stroke-width="${frameW}" stroke-linecap="square" ` +
        `vector-effect="non-scaling-stroke"/>`,
    );
  }

  const order = [
    ...scene.rooms.map((sr, i) => ({ sr, i })).filter(({ sr }) => !sr.room.name.startsWith("checkpoint")),
    ...scene.rooms.map((sr, i) => ({ sr, i })).filter(({ sr }) => sr.room.name.startsWith("checkpoint")),
  ];

  for (const { sr, i } of order) {
    const r = sr.room;
    const q = sr.tile;
    const isCp = r.name.startsWith("checkpoint");
    const fill = isCp ? t.frame : t.room;
    const shape = shaped ? roomShapeSvg(sr, fill) : null;
    const pending = pendingAll ? " is-pending" : "";
    p.push(
      `<g class="room${isCp ? " cp" : ""}${pending}" data-i="${i}" data-gx="${r.gx}" data-gy="${r.gy}" ` +
        `tabindex="0" aria-label="${esc(r.name || "generic room")}">`,
    );
    if (shape) {
      p.push(shape);
    } else {
      p.push(`<rect x="${f(q.x)}" y="${f(q.y)}" width="${f(q.w)}" height="${f(q.h)}" fill="${fill}" ${NS}/>`);
    }
    if (sr.label && !isCp) {
      p.push(
        `<text x="${f(sr.cx)}" y="${f(sr.cy + 5)}" fill="${t.label}" ` +
          `font-family='${esc(t.fontMono)}' font-size="16" text-anchor="middle" ` +
          `letter-spacing="0.08" pointer-events="none">${esc(sr.label)}</text>`,
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
