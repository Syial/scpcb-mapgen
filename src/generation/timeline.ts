import type { PlacedRoom } from "./placement";

/**
 * Étapes de gen pour l'anim (observation seule).
 * Place / identify = deltas (O(n)), pas de snapshot complet à chaque salle (O(n²)).
 * Overlap = état complet (peu d'événements).
 */
export type GenStep =
  | { phase: "place"; room: PlacedRoom }
  | { phase: "identify"; index: number; room: PlacedRoom }
  | { phase: "overlap"; kind: "rotate" | "swap"; rooms: PlacedRoom[] };

/** Snapshot léger pour l'anim carte (pas d'items / events / doorMeta). */
export function snapshotRoom(r: PlacedRoom): PlacedRoom {
  return {
    gx: r.gx,
    gy: r.gy,
    x: r.x,
    z: r.z,
    shape: r.shape,
    zone: r.zone,
    name: r.name,
    angle: r.angle,
  };
}

export function snapshotRooms(rooms: PlacedRoom[]): PlacedRoom[] {
  return rooms.map(snapshotRoom);
}

/** Applique une step sur le buffer de playback (mutatif). */
export function applyGenStep(rooms: PlacedRoom[], step: GenStep): void {
  if (step.phase === "place") {
    rooms.push(step.room);
    return;
  }
  if (step.phase === "identify") {
    rooms[step.index] = step.room;
    return;
  }
  rooms.length = 0;
  for (const r of step.rooms) rooms.push(r);
}
