import type { TunnelGrid } from "../generation/tunnels";
import { tunnelsTheme } from "./theme";
import { esc } from "./esc";
import { corridorTileSvg, type Open } from "./room_shapes";

// Tunnels : grille fixe. La marche du jeu est bornée à [0, size-2] (jamais size-1) ;
// on affiche donc size-1 cases - sinon, après miroir X, une colonne vide reste collée à gauche.

export function renderTunnels(t: TunnelGrid): string {
  const N = t.size;
  const drawN = N - 1;
  const cell = 28;
  const gap = 3;
  const step = cell + gap;
  const padX = 10;
  const padTop = 36;
  const padBot = 10;
  const mx = (x: number) => drawN - 1 - x;
  const occ = (x: number, y: number) =>
    x >= 0 && x < N && y >= 0 && y < N && t.cells[x + y * N] > 0;

  const contentW = drawN * step - gap;
  const contentH = drawN * step - gap;
  const tw = contentW + padX * 2;
  const th = contentH + padTop + padBot;
  const thm = tunnelsTheme;

  const p: string[] = [];
  p.push(
    `<svg viewBox="0 0 ${tw} ${th}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" ` +
      `role="img" aria-label="Maintenance Tunnels">`,
  );
  p.push(`<rect width="${tw}" height="${th}" fill="${thm.screen}"/>`);

  const labels: string[] = [];

  for (let y = 0; y < drawN; y++)
    for (let x = 0; x < drawN; x++) {
      const c = t.cells[x + y * N];
      if (c <= 0) continue;
      const gx = mx(x);
      const tx = padX + gx * step;
      const ty = padTop + y * step;
      const o: Open = {
        n: occ(x, y - 1),
        s: occ(x, y + 1),
        e: occ(x - 1, y),
        w: occ(x + 1, y),
      };
      const isA = t.entrance?.[0] === x && t.entrance?.[1] === y;
      const isB = t.exit?.[0] === x && t.exit?.[1] === y;
      const isGen = c === 7;

      let fill = thm.path;
      if (isGen) fill = thm.gen;
      if (isA || isB) fill = thm.portal;

      if (isGen) {
        p.push(`<rect x="${tx}" y="${ty}" width="${cell}" height="${cell}" fill="${fill}"/>`);
        labels.push(
          `<text x="${tx + cell / 2}" y="${ty + cell / 2}" text-anchor="middle" dominant-baseline="central" ` +
            `font-family='${esc(thm.fontMono)}' font-size="12" fill="${thm.label}" letter-spacing="0.35">` +
            `GEN</text>`,
        );
      } else {
        p.push(corridorTileSvg(tx, ty, cell, cell, o, fill));
      }

      if (isA || isB) {
        labels.push(
          `<text x="${tx + cell / 2}" y="${ty + cell / 2}" text-anchor="middle" dominant-baseline="central" ` +
            `font-family='${esc(thm.fontMono)}' font-size="13" fill="${thm.label}" letter-spacing="0.5">` +
            `${isA ? "A" : "B"}</text>`,
        );
      }
    }

  p.push(`<g pointer-events="none">${labels.join("")}</g>`);
  p.push(`</svg>`);
  return p.join("");
}
