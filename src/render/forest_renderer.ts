import type { ForestLog } from "../generation/forest";
import { forestTheme } from "./theme";
import { esc } from "./esc";
import { corridorTileSvg, type Open } from "./room_shapes";

// Forêt SCP-860-1 : grille fixe 10×10 (comme la facility), cases vides = fond vide.
// 0 vide, 1 chemin, 3 porte. Logs #n marqués sur leur case.

const N = 10;

export function renderForest(grid: number[], logs: ForestLog[] = []): string {
  const cell = 28;
  const gap = 3;
  const step = cell + gap;
  const padX = 10;
  const padTop = 36;
  const padBot = 10;
  const mx = (x: number) => N - 1 - x;
  const occ = (x: number, y: number) => x >= 0 && x < N && y >= 0 && y < N && grid[y * N + x] > 0;

  const logAt = new Map<string, ForestLog>();
  for (const log of logs) logAt.set(`${log.x},${log.y}`, log);

  // Deux portes (door1 / door2) : A = 1ʳᵉ en scan, B = 2ᵉ - pas entrée/sortie.
  const doors: { x: number; y: number }[] = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      if (grid[y * N + x] === 3) doors.push({ x, y });
  const doorMark = new Map<string, "A" | "B">();
  if (doors[0]) doorMark.set(`${doors[0].x},${doors[0].y}`, "A");
  if (doors[1]) doorMark.set(`${doors[1].x},${doors[1].y}`, "B");

  const contentW = N * step - gap;
  const contentH = N * step - gap;
  const tw = contentW + padX * 2;
  const th = contentH + padTop + padBot;
  const thm = forestTheme;

  const p: string[] = [];
  p.push(
    `<svg viewBox="0 0 ${tw} ${th}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" ` +
      `role="img" aria-label="SCP-860-1">`,
  );
  p.push(`<rect width="${tw}" height="${th}" fill="${thm.screen}"/>`);

  const labels: string[] = [];

  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const c = grid[y * N + x];
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
      const isDoor = c === 3;
      const doorLabel = doorMark.get(`${x},${y}`);
      const log = logAt.get(`${x},${y}`);
      const fill = isDoor ? thm.door : log ? thm.log : thm.path;
      p.push(corridorTileSvg(tx, ty, cell, cell, o, fill));

      if (doorLabel) {
        labels.push(
          `<text x="${tx + cell / 2}" y="${ty + cell / 2}" text-anchor="middle" dominant-baseline="central" ` +
            `font-family='${esc(thm.fontMono)}' font-size="13" fill="${thm.label}" letter-spacing="0.5">` +
            `${doorLabel}</text>`,
        );
      } else if (log) {
        const n = log.name.replace(/^Log\s*#?/i, "");
        labels.push(
          `<text x="${tx + cell / 2}" y="${ty + cell / 2}" text-anchor="middle" dominant-baseline="central" ` +
            `font-family='${esc(thm.fontMono)}' font-size="12" fill="${thm.label}" letter-spacing="0.35">` +
            `#${esc(n)}</text>`,
        );
      }
    }

  p.push(`<g pointer-events="none">${labels.join("")}</g>`);
  p.push(`</svg>`);
  return p.join("");
}
