// Étiquettes affichées sur la carte : numéros SCP et gates A/B.
const LANDMARKS: Record<string, string> = {
  // salles de confinement
  "008": "008",
  "914": "914",
  "173": "173",
  room012: "012",
  room035: "035",
  room049: "049",
  room079: "079",
  room106: "106",
  room205: "205",
  room513: "513",
  room860: "860",
  room966: "966",
  room1123: "1123",
  room1162: "1162",
  roompj: "372",
  coffin: "895",
  room2scps: "714",      // contient 714, 860 et 1025 mais un seul numéro tient
  room3storage: "939",
  room2scps2: "1499",
  room2servers: "096",
  room2storage: "970",
  room2cafeteria: "294",
  exit1: "B",
  gateaentrance: "A",
  gatea: "A",
  // zone 0, visibles avec le toggle anomalous
  dimension1499: "1499",
};

/** Sous-ensemble landmarks pour le toggle « minimal labels ». */
const MINIMAL_LABELS = new Set(["A", "B", "914", "008", "079"]);

/** Labels speedrun (K1/K2, Electrical Center, Maintenance Tunnels, Surveillance, PD). */
export const SPEEDRUN_LABELS: Record<string, string> = {
  room2closets: "K1",
  room2testroom2: "K2",
  room2ccont: "EC",
  room2tunnel: "MT",
  room2sl: "SR",
  pocketdimension: "PD",
};

/** Early-escape PD : premier `tunnel` (UpdateEvents Case 16-19). */
export const PD_EARLY_ESCAPE_LABEL = "PD";

// étiquette d'une salle, null si rien à afficher
export function landmarkLabel(name: string): string | null {
  return LANDMARKS[name] ?? null;
}

export function speedrunLabel(name: string): string | null {
  return SPEEDRUN_LABELS[name] ?? null;
}

/** Label carte : landmark SCP/gate, sinon labels speedrun (opt., dont PD early-escape). */
export function roomMapLabel(
  name: string,
  isPdEarlyEscape: boolean,
  opts: { speedrun?: boolean; minimal?: boolean } = {},
): string | null {
  const landmark = landmarkLabel(name);
  if (landmark) {
    if (opts.minimal && !MINIMAL_LABELS.has(landmark)) return null;
    return landmark;
  }
  if (!opts.speedrun) return null;
  return speedrunLabel(name) ?? (isPdEarlyEscape ? PD_EARLY_ESCAPE_LABEL : null);
}
