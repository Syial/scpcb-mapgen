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
  room2scps2: "1499",
  room2servers: "096",
  room2storage: "970",
  exit1: "B",
  gateaentrance: "A",
  gatea: "A",
  // zone 0, visibles avec le toggle anomalous
  pocketdimension: "POCKET",
  dimension1499: "1499",
};

// étiquette d'une salle, null si rien à afficher
export function landmarkLabel(name: string): string | null {
  return LANDMARKS[name] ?? null;
}

