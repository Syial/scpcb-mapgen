import type { MapAnalysis } from "../analysis";
import type { MapModel, PlacedRoom } from "../generation";

/** Première instance `tunnel` = early-escape PD (UpdateEvents 16-19). */
export const PD_ESCAPE_ROOM = "tunnel_pd";
export const PD_ESCAPE_TITLE = "Pocket Dimension Escape";

export function isPdEscapeRoom(name: string): boolean {
  return name === PD_ESCAPE_ROOM;
}

export function displayRoomTitle(name: string, names: Record<string, string>): string {
  if (isPdEscapeRoom(name)) return PD_ESCAPE_TITLE;
  return names[name] ?? name;
}

/** Instances de salle à utiliser pour distance / overlap / event. */
export function roomInstances(
  model: MapModel,
  room: string,
  analysis: MapAnalysis,
): PlacedRoom[] {
  if (isPdEscapeRoom(room)) {
    return analysis.pdEarlyEscape ? [analysis.pdEarlyEscape] : [];
  }
  return model.rooms.filter((r) => r.name === room);
}

export function roomPresent(
  model: MapModel,
  room: string,
  names: Set<string>,
  analysis: MapAnalysis,
): boolean {
  if (isPdEscapeRoom(room)) return analysis.pdEarlyEscape !== null;
  return names.has(room);
}
