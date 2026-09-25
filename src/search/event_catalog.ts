import { eventDescr } from "../generation/events";

/** room → events pouvant y être assignés (InitEvents, tous chemins RNG). */
const EVENT_BY_ROOM: Record<string, string[]> = {
  "173": ["173"],
  start: ["alarm"],
  pocketdimension: ["pocketdimension"],
  tunnel: ["tunnel106", "682roar", "096spawn"],
  lockroom: ["lockroom173"],
  room2: ["room2trick", "1048a"],
  room2storage: ["room2storage"],
  lockroom2: ["lockroom096"],
  endroom: ["endroom106"],
  room2poffices2: ["room2poffices2"],
  room2_2: ["room2fan"],
  room2elevator: ["room2elevator2", "room2elevator"],
  room3storage: ["room3storage"],
  tunnel2: ["tunnel2smoke", "tunnel2", "096spawn"],
  room2doors: ["room2doors173"],
  room2offices2: ["room2offices2"],
  room2closets: ["room2closets"],
  room2cafeteria: ["room2cafeteria"],
  room3pit: ["room3pitduck", "room3pit1048", "682roar", "096spawn"],
  room2offices3: ["room2offices3"],
  room2servers: ["room2servers"],
  room3servers: ["room3servers"],
  room3servers2: ["room3servers"],
  room3tunnel: ["room3tunnel", "room3door", "096spawn"],
  room4: ["room4", "106sinkhole"],
  room2z3: ["682roar"],
  room2testroom2: ["testroom173"],
  room2tesla: ["room2tesla"],
  room2tesla_lcz: ["room2tesla"],
  room2tesla_hcz: ["room2tesla"],
  room2nuke: ["room2nuke"],
  coffin: ["coffin106", "coffin"],
  checkpoint1: ["checkpoint"],
  checkpoint2: ["checkpoint"],
  room3: ["room3door", "106victim", "106sinkhole"],
  room3_2: ["106victim", "106sinkhole"],
  room079: ["room079"],
  room049: ["room049"],
  room012: ["room012"],
  room035: ["room035"],
  "008": ["008"],
  room106: ["room106"],
  roompj: ["pj"],
  "914": ["914"],
  room2toilets: ["buttghost", "toiletguard"],
  room2pipes: ["room2pipes106", "096spawn"],
  room2pit: ["room2pit", "room2pit106", "096spawn"],
  testroom: ["testroom"],
  room2tunnel: ["room2tunnel"],
  room2ccont: ["room2ccont"],
  gateaentrance: ["gateaentrance"],
  gatea: ["gatea"],
  exit1: ["exit1"],
  room205: ["room205"],
  room860: ["room860"],
  room966: ["room966"],
  room1123: ["room1123"],
  room4tunnels: ["room4tunnels", "096spawn"],
  room2gw: ["room_gw"],
  room3gw: ["room_gw"],
  dimension1499: ["dimension1499"],
  room1162: ["room1162"],
  room2scps2: ["room2scps2"],
  room2sl: ["room2sl"],
  medibay: ["medibay"],
  room2shaft: ["room2shaft"],
  room1lifts: ["room1lifts"],
  room2gw_b: ["room2gw_b"],
  room4pit: ["096spawn"],
  room3z2: ["096spawn"],
  room2_4: ["room2pit"],
  room2offices: ["room2offices035"],
  room1archive: ["room1archive"],
};

export interface EventOption {
  id: string;
  label: string;
}

export function possibleEventsForRoom(room: string): EventOption[] {
  const key = room === "tunnel_pd" ? "tunnel" : room;
  const ids = EVENT_BY_ROOM[key] ?? [];
  return ids
    .map((id) => ({ id, label: eventDescr[id] ? `${id} - ${eventDescr[id]}` : id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function roomsWithEvents(): string[] {
  return Object.keys(EVENT_BY_ROOM).sort();
}
