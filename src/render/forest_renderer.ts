import { theme } from "./theme";
import { corridorRects } from "./corridor";

// Forêt de SCP-860 (10×10), miroir X ; 0 vide, 1 chemin, 3 porte.
const N = 10;

export function renderForest(grid: number[]): string {
  const cell = 24;
  const pad = 8;
  const mx = (x: number) => N - 1 - x;
  const occ = (x: number, y: number) => x >= 0 && x < N && y >= 0 && y < N && grid[y * N + x] > 0;

  let x0 = N, y0 = N, x1 = 0, y1 = 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      if (grid[y * N + x] > 0) {
        const gx = mx(x);
        x0 = Math.min(x0, gx); x1 = Math.max(x1, gx);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
  if (x1 < x0) { x0 = 0; y0 = 0; x1 = N - 1; y1 = N - 1; }
  const vx = x0 * cell, vy = y0 * cell, vw = (x1 - x0 + 1) * cell, vh = (y1 - y0 + 1) * cell;

  const p: string[] = [];
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx - pad} ${vy - pad} ${vw + pad * 2} ${vh + pad * 2}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="SCP-860 forest">`);
  p.push(`<rect x="${vx - pad}" y="${vy - pad}" width="${vw + pad * 2}" height="${vh + pad * 2}" fill="${theme.screen}"/>`);

  let g = `<g stroke="${theme.grid}" stroke-width="1" vector-effect="non-scaling-stroke">`;
  for (let gx = x0; gx <= x1 + 1; gx++) g += `<line x1="${gx * cell}" y1="${vy - pad}" x2="${gx * cell}" y2="${vy + vh + pad}"/>`;
  for (let gy = y0; gy <= y1 + 1; gy++) g += `<line x1="${vx - pad}" y1="${gy * cell}" x2="${vx + vw + pad}" y2="${gy * cell}"/>`;
  p.push(g + `</g>`);

  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const c = grid[y * N + x];
      if (c <= 0) continue;
      const gx = mx(x);
      const fill = c === 3 ? theme.ok : theme.zone[3];
      const rects = corridorRects(gx * cell, y * cell, cell, {
        up: occ(x, y - 1), down: occ(x, y + 1),
        left: occ(x + 1, y), right: occ(x - 1, y),
      });
      const r = rects.map((q) => `<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" rx="1"/>`).join("");
      p.push(`<g fill="${fill}">${r}</g>`);
    }

  p.push(`</svg>`);
  return p.join("");
}
