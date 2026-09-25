import type { BlitzRng } from "../rng/blitz_rng";
import type { PlacedRoom } from "./placement";

// Port de CreateEvent + InitEvents (Main.bb) et du RNG de loading (décalques + yaw)
// qui s'intercale entre CreateMap et InitEvents.

/** rooms.ini → disabledecals = true */
const DISABLE_DECALS = new Set([
  "173", "start", "room1123", "room2storage", "room012", "room2closets", "roompj",
  "008", "room049", "room106", "coffin", "testroom", "room2pipes", "room2pit",
  "room3pit", "room2shaft", "room2tunnel", "room2cpit", "room2pipes2", "room079",
  "room2cafeteria", "room2offices2", "room3servers", "room3servers2", "dimension1499",
]);

/** Descriptions courtes (Data/events.ini + commentaires Main.bb). L'ini n'est PAS la source du spawn. */
export const eventDescr: Record<string, string> = {
  "173": "Intro SCP-173 chamber.",
  alarm: "Start-room breach alarm / 173 cutscene.",
  pocketdimension: "Pocket Dimension logic.",
  tunnel106: "SCP-106 may appear in this tunnel.",
  lockroom173: "SCP-173 spawns in this lockroom.",
  room2trick: "Turns the player 180° mid-hallway.",
  "1048a": "SCP-1048-A spawns here.",
  room2storage: "SCP-970 endless hallway.",
  lockroom096: "SCP-096 in lockroom2.",
  endroom106: "SCP-106 takes a janitor into the PD.",
  room2poffices2: "Audio cues in Dr L's office.",
  room2fan: "Activates the wall fan.",
  room2elevator2: "Dead janitor in the elevator hall.",
  room2elevator: "Guard enters the elevator.",
  room3storage: "SCP-939 storage + elevators.",
  tunnel2smoke: "Gas valves open.",
  tunnel2: "Lights out + SCP-173 spawn.",
  room2doors173: "SCP-173 in the airlock.",
  room2offices2: "Anomalous duck.",
  room2closets: "173 kills scientist & janitor.",
  room2cafeteria: "SCP-294.",
  room3pitduck: "Saxophone duck.",
  room3pit1048: "SCP-1048 drawing handoff.",
  room2offices3: "Door closes behind the player.",
  room2servers: "SCP-096 kills a guard.",
  room3servers: "SCP-173 in the server farm.",
  room3tunnel: "Dead guard (rare).",
  room4: "SCP-049 may appear on the walkway.",
  "682roar": "Distant SCP-682 roar.",
  testroom173: "173 breaks the testroom window.",
  room2tesla: "Tesla gate.",
  room2nuke: "Warhead levers.",
  coffin106: "SCP-895 + SCP-106 near the coffin.",
  coffin: "SCP-895 chamber.",
  checkpoint: "Checkpoint door logic.",
  room3door: "Doors close behind the player.",
  "106victim": "Dead scientist falls from ceiling.",
  "106sinkhole": "Sinkhole to the Pocket Dimension.",
  room079: "SCP-079 interaction.",
  room049: "SCP-049 + levers / elevators.",
  room012: "SCP-012.",
  room035: "Possessed scientist (SCP-035).",
  "008": "SCP-008 + 173 window break.",
  room106: "SCP-106 recall protocol.",
  pj: "SCP-372.",
  "914": "SCP-914.",
  buttghost: "Butt ghost.",
  toiletguard: "Guard suicide in toilets.",
  room2pipes106: "SCP-106 emerges from a wall.",
  room2pit: "SCP-173 on the catwalk.",
  testroom: "Gas valves + intercom.",
  room2tunnel: "Maintenance tunnels.",
  room2ccont: "Electrical center levers.",
  gateaentrance: "Gate A entrance.",
  gatea: "Gate A surface.",
  exit1: "Gate B.",
  room205: "SCP-205.",
  room860: "SCP-860 forest entrance.",
  room966: "SCP-966 instances.",
  room1123: "SCP-1123.",
  room4tunnels: "Dead body in 4-way tunnels.",
  room_gw: "Contamination airlock.",
  dimension1499: "SCP-1499 dimension.",
  room1162: "SCP-1162.",
  room2scps2: "Emily Ross / SCP-106 capture.",
  room2sl: "Surveillance room (049).",
  medibay: "Infected surgeon (008-1).",
  room2shaft: "Dead guard by the shaft.",
  room1lifts: "Elevator buttons.",
  room2gw_b: "Guard in broken airlock.",
  "096spawn": "SCP-096 may spawn here.",
  room2offices035: "035 scientist corpse after release.",
  room2pit106: "SCP-106 under the catwalk.",
  room1archive: "Archive door.",
};

/**
 * CreateEvent : une event max par salle, l'ordre des appels compte.
 * Si prob > 0 : Rnd sur chaque salle matchante (même si déjà prise, pas de short-circuit Blitz).
 * Si prob = 0 : id-ième salle matchante libre (0 et 1 = première libre).
 */
export function createEvent(
  rng: BlitzRng,
  rooms: PlacedRoom[],
  eventName: string,
  roomName: string,
  id: number,
  prob = 0,
): void {
  const p = Math.fround(prob);
  if (p === 0) {
    let i = 0;
    for (const r of rooms) {
      if (roomName !== "" && r.name !== roomName) continue;
      const taken = r.event !== undefined;
      i++;
      if (i >= id && !taken) {
        r.event = eventName;
        return;
      }
    }
    return;
  }

  for (const r of rooms) {
    if (roomName !== "" && r.name !== roomName) continue;
    const taken = r.event !== undefined;
    // Toujours tirer : `If Rnd(...) < prob And temp=False` évalue Rnd d'abord.
    const roll = rng.randFloat(0, 1);
    if (roll < p && !taken) r.event = eventName;
  }
}

/** RNG entre CreateMap et InitEvents (InitNewGame dans Main.bb). */
export function consumeLoadingRng(
  rng: BlitzRng,
  rooms: PlacedRoom[],
  introEnabled = false,
): void {
  // Curr106\State = 70*60*Rand(12,17)
  rng.randInt(12, 17);

  for (const r of rooms) {
    if (!DISABLE_DECALS.has(r.name)) {
      if (rng.randInt(4) === 1) {
        rng.randInt(2, 3);
        rng.randFloat(-2, 2);
        rng.randFloat(-2, 2);
        rng.randInt(360);
        rng.randFloat(0.1, 0.4);
        rng.randFloat(0.85, 0.95);
      }
      if (rng.randInt(4) === 1) {
        rng.randFloat(-2, 2);
        rng.randFloat(-2, 2);
        rng.randInt(360);
        rng.randFloat(0.5, 0.7);
        rng.randFloat(0.7, 0.85);
      }
    }

    // Start sans intro : 2 CreateItem inventaire → 2× Rand(360)
    if (r.name === "start" && !introEnabled) {
      rng.randInt(360);
      rng.randInt(360);
      const inv = [
        { name: "Class D Orientation Leaflet", tempname: "paper", inventory: true as const },
        { name: "Document SCP-173", tempname: "paper", inventory: true as const },
      ];
      r.items = [...(r.items ?? []), ...inv];
    }
  }
  rng.randInt(160, 200);
}

/** InitEvents (Main.bb). aggressiveNPCs = difficulté. Écrit rooms[].event. */
export function initEvents(rng: BlitzRng, rooms: PlacedRoom[], aggressiveNPCs = false): void {
  for (const r of rooms) delete r.event;

  const agg = aggressiveNPCs ? 1 : 0;
  const f = Math.fround;
  const ce = (name: string, room: string, id: number, prob = 0) =>
    createEvent(rng, rooms, name, room, id, prob);

  ce("173", "173", 0);
  ce("alarm", "start", 0);
  ce("pocketdimension", "pocketdimension", 0);

  ce("tunnel106", "tunnel", 0, f(0.07 + 0.1 * agg));

  // ~66 % sur la première lockroom libre, puis proba sur les suivantes
  if (rng.randInt(3) < 3) ce("lockroom173", "lockroom", 0);
  ce("lockroom173", "lockroom", 0, f(0.3 + 0.5 * agg));

  ce("room2trick", "room2", 0, 0.15);
  ce("1048a", "room2", 0, 1.0);

  ce("room2storage", "room2storage", 0);
  ce("lockroom096", "lockroom2", 0);
  ce("endroom106", "endroom", rng.randInt(0, 1));

  ce("room2poffices2", "room2poffices2", 0);
  ce("room2fan", "room2_2", 0, 1.0);

  ce("room2elevator2", "room2elevator", 0);
  ce("room2elevator", "room2elevator", rng.randInt(1, 2));

  ce("room3storage", "room3storage", 0, 0);

  ce("tunnel2smoke", "tunnel2", 0, 0.2);
  ce("tunnel2", "tunnel2", rng.randInt(0, 2), 0);
  ce("tunnel2", "tunnel2", 0, f(0.2 * agg));

  ce("room2doors173", "room2doors", 0, f(0.5 + 0.4 * agg));
  ce("room2offices2", "room2offices2", 0, 0.7);

  ce("room2closets", "room2closets", 0);
  ce("room2cafeteria", "room2cafeteria", 0);

  ce("room3pitduck", "room3pit", 0);
  ce("room3pit1048", "room3pit", 1);

  ce("room2offices3", "room2offices3", 0, 1.0);
  ce("room2servers", "room2servers", 0);
  ce("room3servers", "room3servers", 0);
  ce("room3servers", "room3servers2", 0);

  ce("room3tunnel", "room3tunnel", 0, 0.08);
  ce("room4", "room4", 0);

  if (rng.randInt(5) < 5) {
    switch (rng.randInt(3)) {
      case 1:
        ce("682roar", "tunnel", rng.randInt(0, 2), 0);
        break;
      case 2:
        ce("682roar", "room3pit", rng.randInt(0, 2), 0);
        break;
      case 3:
        ce("682roar", "room2z3", 0, 0);
        break;
    }
  }

  ce("testroom173", "room2testroom2", 0, 1.0);
  ce("room2tesla", "room2tesla", 0, 0.9);
  ce("room2nuke", "room2nuke", 0, 0);

  if (rng.randInt(5) < 5) ce("coffin106", "coffin", 0, 0);
  else ce("coffin", "coffin", 0, 0);

  ce("checkpoint", "checkpoint1", 0, 1.0);
  ce("checkpoint", "checkpoint2", 0, 1.0);

  ce("room3door", "room3", 0, 0.1);
  ce("room3door", "room3tunnel", 0, 0.1);

  if (rng.randInt(2) === 1) {
    ce("106victim", "room3", rng.randInt(1, 2));
    ce("106sinkhole", "room3_2", rng.randInt(2, 3));
  } else {
    ce("106victim", "room3_2", rng.randInt(1, 2));
    ce("106sinkhole", "room3", rng.randInt(2, 3));
  }
  ce("106sinkhole", "room4", rng.randInt(1, 2));

  ce("room079", "room079", 0, 0);
  ce("room049", "room049", 0, 0);
  ce("room012", "room012", 0, 0);
  ce("room035", "room035", 0, 0);
  ce("008", "008", 0, 0);
  ce("room106", "room106", 0, 0);
  ce("pj", "roompj", 0, 0);
  ce("914", "914", 0, 0);

  ce("buttghost", "room2toilets", 0, 0);
  ce("toiletguard", "room2toilets", 1, 0);

  ce("room2pipes106", "room2pipes", rng.randInt(0, 3));
  ce("room2pit", "room2pit", 0, f(0.4 + 0.4 * agg));

  ce("testroom", "testroom", 0);
  ce("room2tunnel", "room2tunnel", 0);
  ce("room2ccont", "room2ccont", 0);

  ce("gateaentrance", "gateaentrance", 0);
  ce("gatea", "gatea", 0);
  ce("exit1", "exit1", 0);

  ce("room205", "room205", 0);
  ce("room860", "room860", 0);
  ce("room966", "room966", 0);
  ce("room1123", "room1123", 0, 0);

  ce("room2tesla", "room2tesla_lcz", 0, 0.9);
  ce("room2tesla", "room2tesla_hcz", 0, 0.9);

  ce("room4tunnels", "room4tunnels", 0);
  ce("room_gw", "room2gw", 0, 1.0);
  ce("dimension1499", "dimension1499", 0);
  ce("room1162", "room1162", 0);
  ce("room2scps2", "room2scps2", 0);
  ce("room_gw", "room3gw", 0, 1.0);
  ce("room2sl", "room2sl", 0);
  ce("medibay", "medibay", 0);
  ce("room2shaft", "room2shaft", 0);
  ce("room1lifts", "room1lifts", 0);

  ce("room2gw_b", "room2gw_b", rng.randInt(0, 1));

  ce("096spawn", "room4pit", 0, f(0.6 + 0.2 * agg));
  ce("096spawn", "room3pit", 0, f(0.6 + 0.2 * agg));
  ce("096spawn", "room2pipes", 0, f(0.4 + 0.2 * agg));
  ce("096spawn", "room2pit", 0, f(0.5 + 0.2 * agg));
  ce("096spawn", "room3tunnel", 0, f(0.6 + 0.2 * agg));
  ce("096spawn", "room4tunnels", 0, f(0.7 + 0.2 * agg));
  ce("096spawn", "tunnel", 0, f(0.6 + 0.2 * agg));
  ce("096spawn", "tunnel2", 0, f(0.4 + 0.2 * agg));
  ce("096spawn", "room3z2", 0, f(0.7 + 0.2 * agg));

  ce("room2pit", "room2_4", 0, f(0.4 + 0.4 * agg));
  ce("room2offices035", "room2offices", 0);
  ce("room2pit106", "room2pit", 0, f(0.07 + 0.1 * agg));
  ce("room1archive", "room1archive", 0, 1.0);
}
