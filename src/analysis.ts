import type { MapModel, PlacedRoom } from "./generation";

// Quelles salles obligatoires manquent - le jeu ne le vérifie jamais (SetRoom échoue en silence).

export type Severity = "blocking" | "degraded";

export interface MissingRoom {
  name: string;
  severity: Severity;
  label: string;
  effect: string;
}

export interface MapAnalysis {
  // false si une salle blocking manque
  finishable: boolean;
  // salles absentes, les bloquantes d'abord
  missing: MissingRoom[];
  /**
   * Tunnel early-escape PD (UpdateEvents Case 16-19) :
   * premier `tunnel` CreateMap (y↓, x↑), 106 State=250.
   */
  pdEarlyEscape: PlacedRoom | null;
}

// Salles sans lesquelles finir est impossible (chaîne electrical center → 079).
const BLOCKING: Record<string, Omit<MissingRoom, "name" | "severity">> = {
  // perdue si aucun slot ROOM2C en zone d'entrée, ~6,3 % des seeds
  room2ccont: {
    label: "Electrical center",
    effect: "SCP-079's gate access cannot be cut off, so it cannot be bargained with.",
  },
  // absente seulement si HCZ n'a aucun slot ROOM1, atteignable qu'en mode mod (~0,02 %)
  room079: {
    label: "SCP-079",
    effect: "No one to bargain with for the exit gates.",
  },
};

// Absences non bloquantes - servies dans cet ordre, les dernières sautent en premier.
const DEGRADED: Record<string, Omit<MissingRoom, "name" | "severity">> = {
  room106: { label: "SCP-106", effect: "Containment chamber missing." },
  // le jeu prévoit son absence : lockdown HCZ désactivé d'office
  "008": { label: "SCP-008", effect: "HCZ lockdown is disabled from the start." },
  room035: { label: "SCP-035", effect: "Containment chamber missing." },
  coffin: { label: "SCP-895", effect: "Containment chamber missing." },
};

// Ordre d'affichage : bloquantes d'abord, puis l'ordre de service de SetRoom.
const ORDER = ["room2ccont", "room079", "room106", "008", "room035", "coffin"];

/** Premier `tunnel` créé (= ordre CreateMap / model.rooms). */
export function earlyEscapeTunnel(rooms: PlacedRoom[]): PlacedRoom | null {
  return rooms.find((r) => r.name === "tunnel") ?? null;
}

export function analyseMap(model: MapModel): MapAnalysis {
  const present = new Set(model.rooms.map((r) => r.name));
  const missing: MissingRoom[] = [];

  for (const name of ORDER) {
    if (present.has(name)) continue;
    const b = BLOCKING[name];
    if (b) { missing.push({ name, severity: "blocking", ...b }); continue; }
    const d = DEGRADED[name];
    if (d) missing.push({ name, severity: "degraded", ...d });
  }

  return {
    finishable: !missing.some((m) => m.severity === "blocking"),
    missing,
    pdEarlyEscape: earlyEscapeTunnel(model.rooms),
  };
}
