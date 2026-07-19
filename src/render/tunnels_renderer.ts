import type { TunnelGrid } from "../generation/tunnels";
import { theme } from "./theme";
import { corridorRects } from "./corridor";
import { esc } from "./svg_renderer";

// Tunnels de maintenance en vrais couloirs, miroir X, cadrés sur le contenu.
export function renderTunnels(t: TunnelGrid): string {
  const N = t.size;
  const cell = 20;
  const pad = 6;
  const mx = (x: number) => N - 1 - x;
  const occ = (x: number, y: number) => x >= 0 && x < N && y >= 0 && y < N && t.cells[x + y * N] > 0;

  // bbox du contenu (en coordonnées miroir)
  let x0 = N, y0 = N, x1 = 0, y1 = 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      if (t.cells[x + y * N] > 0) {
        const gx = mx(x);
        x0 = Math.min(x0, gx); x1 = Math.max(x1, gx);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
  if (x1 < x0) { x0 = 0; y0 = 0; x1 = N - 1; y1 = N - 1; }
  const vx = x0 * cell, vy = y0 * cell, vw = (x1 - x0 + 1) * cell, vh = (y1 - y0 + 1) * cell;

  const p: string[] = [];
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx - pad} ${vy - pad} ${vw + pad * 2} ${vh + pad * 2}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Maintenance tunnels">`);
  p.push(`<rect x="${vx - pad}" y="${vy - pad}" width="${vw + pad * 2}" height="${vh + pad * 2}" fill="${theme.screen}"/>`);

  let g = `<g stroke="${theme.grid}" stroke-width="1" vector-effect="non-scaling-stroke">`;
  for (let gx = x0; gx <= x1 + 1; gx++) g += `<line x1="${gx * cell}" y1="${vy - pad}" x2="${gx * cell}" y2="${vy + vh + pad}"/>`;
  for (let gy = y0; gy <= y1 + 1; gy++) g += `<line x1="${vx - pad}" y1="${gy * cell}" x2="${vx + vw + pad}" y2="${gy * cell}"/>`;
  p.push(g + `</g>`);

  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (t.cells[x + y * N] <= 0) continue;
      const gx = mx(x);
      const isE = t.entrance?.[0] === x && t.entrance?.[1] === y;
      const isX = t.exit?.[0] === x && t.exit?.[1] === y;
      const isGen = t.cells[x + y * N] === 7;
      const fill = isGen ? theme.checkpoint : isE || isX ? theme.ok : theme.zone[2];
      // voisins en coordonnées miroir : left/right sont inversés
      const rects = corridorRects(gx * cell, y * cell, cell, {
        up: occ(x, y - 1), down: occ(x, y + 1),
        left: occ(x + 1, y), right: occ(x - 1, y),
      });
      const r = rects.map((q) => `<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" rx="1"/>`).join("");
      p.push(`<g fill="${fill}">${r}</g>`);
    }

  const mark = (pt: [number, number] | null, label: string) => {
    if (!pt) return "";
    const cx = mx(pt[0]) * cell + cell / 2, cy = pt[1] * cell + cell / 2;
    return `<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-family='${esc(theme.fontMono)}' font-size="8" fill="${theme.screen}" font-weight="bold">${label}</text>`;
  };
  p.push(mark(t.entrance, "E"));
  p.push(mark(t.exit, "X"));

  p.push(`</svg>`);
  return p.join("");
}

