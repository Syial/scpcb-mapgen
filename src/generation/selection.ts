import { BlitzRng } from "../rng/blitz_rng";
import templatesData from "./templates.json";

export interface Template {
  name: string;
  shape: number;      // ROOM1..ROOM4 = 1..5
  commonness: number;
  zones: number[];    // zone[0..4], valeurs de zone1..zone5 de rooms.ini
}

// Ordre préservé depuis rooms.ini — critique : la sélection en dépend.
export const templates = templatesData as Template[];

// Sélection du template d'une générique (CreateRoom 2058-2094) : un Rand(temp), deux boucles commonness identiques au jeu.
export function selectTemplate(rng: BlitzRng, zone: number, shape: number): Template | null {
  // boucle 1 : temp = somme des commonness des templates matchant (zone + forme)
  let temp = 0;
  for (const rt of templates) {
    for (let i = 0; i <= 4; i++) {
      if (rt.zones[i] === zone) {
        if (rt.shape === shape) {
          temp += rt.commonness;
          break; // Exit : uniquement quand zone ET forme matchent
        }
        // zone matche mais pas la forme → on continue les autres slots
      }
    }
  }

  const randomRoom = rng.randInt(temp); // Rand(temp) mono-argument → [1, temp]

  // boucle 2 : parcours (sans Exit sur i) et sélection par intervalle de commonness
  let acc = 0;
  for (const rt of templates) {
    for (let i = 0; i <= 4; i++) {
      if (rt.zones[i] === zone && rt.shape === shape) {
        acc += rt.commonness;
        if (randomRoom > acc - rt.commonness && randomRoom <= acc) return rt;
      }
    }
  }
  return null;
}
