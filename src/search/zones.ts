import templates from "../generation/templates.json";

// Zones SetRoom (CreateMap) - source de vérité placement, pas rooms.ini
// (ex. room079 : ini=EZ mais forcé en HCZ).
export const SETROOM_ZONE: Record<string, number> = {
  start: 1,
  roompj: 1,
  "914": 1,
  room1archive: 1,
  room205: 1,
  room2closets: 1,
  room2testroom2: 1,
  room2scps: 1,
  room2storage: 1,
  room2gw_b: 1,
  room2sl: 1,
  room012: 1,
  room2scps2: 1,
  room1123: 1,
  room2elevator: 1,
  room3storage: 1,
  room1162: 1,
  room4info: 1,
  checkpoint1: 1,

  room079: 2,
  room106: 2,
  "008": 2,
  room035: 2,
  coffin: 2,
  room2nuke: 2,
  room2tunnel: 2,
  room049: 2,
  room2shaft: 2,
  testroom: 2,
  room2servers: 2,
  room513: 2,
  room966: 2,
  room2cpit: 2,

  exit1: 3,
  gateaentrance: 3,
  room1lifts: 3,
  room2poffices: 3,
  room2cafeteria: 3,
  room2sroom: 3,
  room2servers2: 3,
  room2offices: 3,
  room2offices4: 3,
  room860: 3,
  medibay: 3,
  room2poffices2: 3,
  room2offices2: 3,
  room2ccont: 3,
  lockroom2: 3,
  room3servers: 3,
  room3servers2: 3,
  room3offices: 3,
  checkpoint2: 3,

  gatea: 0,
  pocketdimension: 0,
  dimension1499: 0,
  "173": 0,
};

const BY_NAME = new Map(
  (templates as { name: string; zones: number[] }[]).map((t) => [t.name, t]),
);

/** Zones rooms.ini (positives uniquement). */
function iniZones(name: string): number[] {
  const t = BY_NAME.get(name);
  return t ? [...new Set(t.zones.filter((z) => z > 0))] : [];
}

/**
 * Zones pour picker + out-of-place : même source.
 * SetRoom gagne sur rooms.ini (évite room079 en EZ alors qu'elle est HCZ).
 */
export function catalogZones(name: string): number[] {
  const set = SETROOM_ZONE[name];
  if (set !== undefined) return [set];
  const ini = iniZones(name);
  return ini.length ? ini : [0];
}

export function isOutOfPlace(name: string, zone: number): boolean {
  if (!name || zone === 0) return false;
  const exp = catalogZones(name);
  return exp.length > 0 && !exp.includes(zone);
}

/** @deprecated Utiliser catalogZones (gardé pour les tests). */
export function expectedZones(name: string): number[] {
  return catalogZones(name);
}
