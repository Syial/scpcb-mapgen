import type { Scene } from "./geometry";
import { theme, zoneName } from "./theme";

// Rend une Scene en SVG, pour l'écran et l'export. Hover géré en CSS.

export interface SvgOptions {
  // standalone = export : xmlns + fond peint
  standalone?: boolean;
  seed?: string;
}

export function renderSvg(scene: Scene, opts: SvgOptions = {}): string {
  const { width, height, cell, margin } = scene;
  const N = (width - margin * 2) / cell - 2;
  const p: string[] = [];

  // viewBox cadré sur les salles, gouttière à gauche pour l'accolade des zones
  let bx0 = width, by0 = height, bx1 = 0, by1 = 0;
  for (const sr of scene.rooms)
    for (const q of sr.rects) {
      bx0 = Math.min(bx0, q.x); by0 = Math.min(by0, q.y);
      bx1 = Math.max(bx1, q.x + q.w); by1 = Math.max(by1, q.y + q.h);
    }
  const PAD = cell * 0.6;
  const GUTTER = 44; // segment + titre vertical + air
  // crop gauche = première ligne de grille moins la gouttière
  const gxLpre = margin + Math.max(0, Math.floor((bx0 - margin) / cell)) * cell;
  const vx0 = Math.max(0, gxLpre - GUTTER);
  const vy0 = Math.max(0, by0 - PAD);
  const vx1 = Math.min(width, bx1 + PAD);
  const vy1 = Math.min(height, by1 + PAD);

  p.push(
    `<svg ${opts.standalone ? 'xmlns="http://www.w3.org/2000/svg" ' : ""}` +
      `viewBox="${f(vx0)} ${f(vy0)} ${f(vx1 - vx0)} ${f(vy1 - vy0)}" role="img" aria-label="Facility map">`
  );

  // fill en attribut, pas en CSS, sinon l'export perd les couleurs
  p.push(
    `<style>` +
      `.room{cursor:crosshair;outline:none}` +
      `.room rect{transition:fill .08s}` +
      `.room:hover rect,.room:focus rect{fill:${theme.ok}}` +
      `@media (prefers-reduced-motion:reduce){.room rect{transition:none}}` +
      `</style>`
  );

  if (opts.standalone) p.push(`<rect x="${f(vx0)}" y="${f(vy0)}" width="${f(vx1 - vx0)}" height="${f(vy1 - vy0)}" fill="${theme.screen}"/>`);

  // grille croppée au contenu, sinon case vide à droite
  const g0 = (v: number) => margin + Math.max(0, Math.floor((v - margin) / cell)) * cell;
  const g1 = (v: number) => margin + Math.min(N + 2, Math.ceil((v - margin) / cell)) * cell;
  const gxL = g0(bx0);
  const gx1 = g1(bx1), gy0 = g0(by0), gy1 = g1(by1);
  let grid = `<g stroke="${theme.grid}" stroke-width="1">`;
  for (let q = gxL; q <= gx1; q += cell) grid += `<line x1="${q}" y1="${gy0}" x2="${q}" y2="${gy1}"/>`;
  for (let q = gy0; q <= gy1; q += cell) grid += `<line x1="${gxL}" y1="${q}" x2="${gx1}" y2="${q}"/>`;
  p.push(grid + `</g>`);

  for (let i = 0; i < scene.rooms.length; i++) {
    const sr = scene.rooms[i];
    const r = sr.room;
    const rects = sr.rects
      .map((q) => `<rect x="${f(q.x)}" y="${f(q.y)}" width="${f(q.w)}" height="${f(q.h)}" rx="1.5"/>`)
      .join("");
    const seam = r.name.startsWith("checkpoint");
    p.push(
      `<g class="room${seam ? " seam" : ""}" data-i="${i}" tabindex="0" ` +
        `fill="${seam ? theme.checkpoint : theme.zone[r.zone] ?? theme.room}" ` +
        `aria-label="${esc(r.name || "generic room")}">${rects}</g>`
    );
  }

  // accolades de zone : un segment par bande, les checkpoints font le trou entre elles
  const NS = `vector-effect="non-scaling-stroke"`;
  // TX = M + FS/2 : compense la baseline du texte rotaté pour centrer visuellement
  const FS = 13;
  const gutterL = gxL - GUTTER;
  const segX = gutterL + 7;
  const M = (segX + gxL) / 2;
  const SEG_X = f(segX);
  const TICK_END = f(segX + 6);
  const TX = f(M + FS / 2);
  let braces = `<g pointer-events="none" stroke="${theme.inkDimmer}">`;
  let btitles = `<g pointer-events="none" font-family='${esc(theme.fontMono)}' font-size="${FS}" letter-spacing="2" fill="${theme.ink}" text-anchor="middle">`;
  for (const b of scene.bands) {
    const y0 = f(b.y + 1), y1 = f(b.y + b.h - 1), cy = f(b.y + b.h / 2);
    braces += `<line x1="${SEG_X}" y1="${y0}" x2="${SEG_X}" y2="${y1}" stroke-width="1.5" ${NS}/>`;
    braces += `<line x1="${SEG_X}" y1="${y0}" x2="${TICK_END}" y2="${y0}" stroke-width="1" ${NS}/>`;
    braces += `<line x1="${SEG_X}" y1="${y1}" x2="${TICK_END}" y2="${y1}" stroke-width="1" ${NS}/>`;
    btitles += `<text transform="rotate(-90 ${TX} ${cy})" x="${TX}" y="${cy + 4}">${esc(zoneName[b.zone].toUpperCase())}</text>`;
  }
  p.push(braces + `</g>` + btitles + `</g>`);


  let labels = `<g font-family='${esc(theme.fontMono)}' font-size="10" text-anchor="middle" pointer-events="none">`;
  for (const sr of scene.rooms) {
    if (!sr.label) continue;
    labels += `<text x="${f(sr.cx)}" y="${f(sr.cy + 3.5)}" fill="${theme.label}" letter-spacing="0.5">${esc(sr.label)}</text>`;
  }
  p.push(labels + `</g>`);

  if (opts.standalone && opts.seed) {
    p.push(
      `<text x="${f(vx0 + 10)}" y="${f(vy1 - 10)}" font-family='${esc(theme.fontMono)}' font-size="11" fill="${theme.inkDimmer}" letter-spacing="1.4">SEED <tspan fill="${theme.ink}">${esc(opts.seed)}</tspan></text>`
    );
  }

  return p.join("") + `</svg>`;
}

function f(n: number): number {
  return Math.round(n * 100) / 100;
}
export function esc(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
}
