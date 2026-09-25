import type { MapModel } from "../generation";
import { residualOverlaps } from "../generation/overlap";
import type { MapAnalysis } from "../analysis";
import { isOutOfPlace } from "./zones";
import { zoneCode } from "../zone_meta";
import { isPdEscapeRoom, roomInstances, roomPresent } from "./room_aliases";

// Filtres composables du scanner : chaque filtre est évalué par seed, cumul en ET.

export interface RoomFilter {
  type: "room";
  room: string;
  negate: boolean; // true = la salle doit être absente
}

export interface DistanceFilter {
  type: "distance";
  roomA: string;
  roomB: string;
  bound: number;
  cmp: "le" | "ge"; // le = au plus ; ge = au moins
}

export interface FinishableFilter {
  type: "finishable";
  want: boolean;
}

export interface OverlapFilter {
  type: "overlap";
  /** Si défini : cette room doit être dans la paire ; sinon libre. */
  roomA?: string;
  roomB?: string;
}

export interface ItemFilter {
  type: "item";
  room: string;
  name: string;
  tempname: string;
  negate: boolean;
}

export interface EventFilter {
  type: "event";
  room: string;
  event: string;
  negate: boolean;
}

/** Room hors de son bucket SetRoom / zones attendues. */
export interface OutOfPlaceFilter {
  type: "out_of_place";
  /** Si défini : cette room uniquement ; sinon n'importe laquelle. */
  room?: string;
}

export type Filter =
  | RoomFilter
  | DistanceFilter
  | FinishableFilter
  | OverlapFilter
  | ItemFilter
  | EventFilter
  | OutOfPlaceFilter;

/** Distance BFS sur la grille entre deux salles (en cases). */
export function walkDistance(
  model: MapModel,
  roomA: string,
  roomB: string,
  analysis: MapAnalysis,
): number | null {
  const starts: Array<[number, number]> = roomInstances(model, roomA, analysis).map((r) => [r.gx, r.gy]);
  const targets = new Set<number>();
  const W = model.mapSize + 2;
  for (const r of roomInstances(model, roomB, analysis)) {
    if (r.zone === 0) continue;
    targets.add(r.gx * W + r.gy);
  }
  if (!starts.length || !targets.size) return null;

  const grid = model.grid;
  const dist = new Map<number, number>();
  let frontier = starts.map(([x, y]) => x * W + y);
  for (const k of frontier) dist.set(k, 0);
  let d = 0;
  while (frontier.length) {
    for (const k of frontier) if (targets.has(k)) return d;
    d++;
    const next: number[] = [];
    for (const k of frontier) {
      const x = Math.floor(k / W), y = k % W;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
        if (!grid[nx] || grid[nx][ny] <= 0) continue;
        const nk = nx * W + ny;
        if (dist.has(nk)) continue;
        dist.set(nk, d);
        next.push(nk);
      }
    }
    frontier = next;
  }
  return null;
}

function overlapAlias(name: string): string {
  return isPdEscapeRoom(name) ? "tunnel" : name;
}

/** Paires résiduelles filtrées selon roomA / roomB optionnels. */
export function matchingOverlaps(
  model: MapModel,
  roomA?: string,
  roomB?: string,
): Array<[string, string]> {
  const pairs = residualOverlaps(model.rooms);
  const a = roomA ? overlapAlias(roomA) : undefined;
  const b = roomB ? overlapAlias(roomB) : undefined;
  if (a && b) {
    if (a === b) return [];
    return pairs.filter(([x, y]) => (x === a && y === b) || (x === b && y === a));
  }
  if (a) return pairs.filter(([x, y]) => x === a || y === a);
  if (b) return pairs.filter(([x, y]) => x === b || y === b);
  return pairs;
}

function roomItems(model: MapModel, room: string): Array<{ name: string; tempname: string }> {
  const out: Array<{ name: string; tempname: string }> = [];
  for (const r of model.rooms) {
    if (r.name !== room) continue;
    if (r.items) for (const it of r.items) out.push(it);
    if (room === "room2tunnel" && model.tunnels?.items?.length) {
      for (const it of model.tunnels.items) out.push(it);
    }
  }
  return out;
}

/** Renvoie null si le filtre échoue, sinon la note à afficher. */
export function evalFilter(
  model: MapModel,
  f: Filter,
  names: Set<string>,
  analysis: MapAnalysis,
): string | null {
  switch (f.type) {
    case "room": {
      const present = roomPresent(model, f.room, names, analysis);
      if (present === f.negate) return null;
      return f.negate ? `no ${f.room}` : f.room;
    }
    case "distance": {
      const d = walkDistance(model, f.roomA, f.roomB, analysis);
      if (d === null) return null;
      if (f.cmp === "le" ? d > f.bound : d < f.bound) return null;
      return `${f.roomA}↔${f.roomB}: ${d}`;
    }
    case "finishable": {
      if (analysis.finishable !== f.want) return null;
      if (f.want) return "finishable";
      const blocking = analysis.missing.filter((m) => m.severity === "blocking").map((m) => m.name);
      return blocking.length ? `unfinishable (${blocking.join(", ")})` : "unfinishable";
    }
    case "overlap": {
      if (f.roomA && !roomPresent(model, f.roomA, names, analysis)) return null;
      if (f.roomB && !roomPresent(model, f.roomB, names, analysis)) return null;
      if (f.roomA && f.roomB && overlapAlias(f.roomA) === overlapAlias(f.roomB)) return null;
      const hits = matchingOverlaps(model, f.roomA, f.roomB);
      if (!hits.length) return null;
      if (f.roomA && f.roomB) return `${f.roomA}∩${f.roomB}`;
      return hits.map(([x, y]) => `${x}∩${y}`).join(", ");
    }
    case "item": {
      const hit = roomItems(model, f.room).some(
        (it) => it.name === f.name && it.tempname === f.tempname,
      );
      if (hit === f.negate) return null;
      return f.negate ? `no ${f.name} @ ${f.room}` : `${f.name} @ ${f.room}`;
    }
    case "event": {
      const rooms = roomInstances(model, f.room, analysis);
      if (!rooms.length) return null;
      const hit = rooms.some((r) => r.event === f.event);
      if (hit === f.negate) return null;
      return f.negate ? `no ${f.event} @ ${f.room}` : `${f.event} @ ${f.room}`;
    }
    case "out_of_place": {
      const hits = model.rooms.filter(
        (r) =>
          r.name &&
          isOutOfPlace(r.name, r.zone) &&
          (!f.room || r.name === f.room || (isPdEscapeRoom(f.room) && r === analysis.pdEarlyEscape)),
      );
      if (!hits.length) return null;
      const parts = hits.map((r) => `${r.name}@${zoneCode[r.zone] ?? r.zone}`);
      return `oop: ${[...new Set(parts)].join(", ")}`;
    }
  }
}
