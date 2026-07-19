// Case de couloir (corps + bras vers les voisins), partagée par tunnels et forêt.
export interface Rect { x: number; y: number; w: number; h: number }

export function corridorRects(
  ox: number,
  oy: number,
  cell: number,
  neigh: { up: boolean; down: boolean; left: boolean; right: boolean },
  bodyFrac = 0.5,
  armFrac = 0.3
): Rect[] {
  const bodyW = cell * bodyFrac;
  const bodyInset = (cell - bodyW) / 2;
  const armW = cell * armFrac;
  const armInset = (cell - armW) / 2;

  const rects: Rect[] = [{ x: ox + bodyInset, y: oy + bodyInset, w: bodyW, h: bodyW }];
  if (neigh.up) rects.push({ x: ox + armInset, y: oy, w: armW, h: bodyInset + 1 });
  if (neigh.down) rects.push({ x: ox + armInset, y: oy + bodyInset + bodyW - 1, w: armW, h: bodyInset + 1 });
  if (neigh.right) rects.push({ x: ox + bodyInset + bodyW - 1, y: oy + armInset, w: bodyInset + 1, h: armW });
  if (neigh.left) rects.push({ x: ox, y: oy + armInset, w: bodyInset + 1, h: armW });
  return rects;
}
