import { BlitzRng } from "../rng/blitz_rng";

// Carving des couloirs (CreateMap 7037-7113) : grille MapTemp (1 couloir, 255 transition). ⚠ Rand des lignes 7093/7095 tiré seulement si x2 < x+width.

const ZONEAMOUNT = 3;

// GetZone (7802-7804) en float32 : en float64, y=6 basculerait de zone.
function getZone(y: number, mapWidth: number): number {
  const v = Math.fround(Math.fround(Math.fround(mapWidth - y) / mapWidth) * ZONEAMOUNT);
  return Math.min(Math.floor(v), ZONEAMOUNT - 1);
}

// division entière Blitz (troncature vers zéro)
const idiv = (a: number, b: number) => Math.trunc(a / b);

export interface CarveResult {
  grid: number[][]; // [x][y], indices 0..mapWidth+1 / 0..mapHeight+1
  mapWidth: number;
  mapHeight: number;
}

export function carveCorridors(rng: BlitzRng, mapSize = 18): CarveResult {
  const MapWidth = mapSize;
  const MapHeight = mapSize;

  // Dim MapTemp%(MapWidth+1, MapHeight+1)  -> indices 0..MapWidth+1
  const MapTemp: number[][] = [];
  for (let i = 0; i <= MapWidth + 1; i++) MapTemp.push(new Array(MapHeight + 2).fill(0));

  let x = Math.floor(MapWidth / 2);   // 7043
  let y = MapHeight - 2;              // 7044
  let temp = 0;                      // Local temp% (7031), sert de report de x

  for (let i = y; i <= MapHeight - 1; i++) MapTemp[x][i] = 1; // 7046-7048

  do {
    let width = rng.randInt(10, 15); // 7051

    if (x > MapWidth * 0.6) {          // 7053
      width = -width;
    } else if (x > MapWidth * 0.4) {   // 7055
      x = x - idiv(width, 2);          // 7056
    }

    // 7060-7068 : garder le couloir dans les bornes
    if (x + width > MapWidth - 3) {
      width = MapWidth - 3 - x;
    } else if (x + width < 2) {
      width = -x + 2;
    }

    x = Math.min(x, x + width);        // 7070
    width = Math.abs(width);           // 7071
    for (let i = x; i <= x + width; i++) MapTemp[Math.min(i, MapWidth)][y] = 1; // 7072-7074

    let height = rng.randInt(3, 4);    // 7076
    if (y - height < 1) height = y - 1; // 7077

    const yhallways = rng.randInt(4, 5); // 7079

    if (getZone(y - height, MapWidth) !== getZone(y - height + 1, MapWidth)) height = height - 1; // 7081

    for (let i = 1; i <= yhallways; i++) {                       // 7083
      let x2 = Math.max(Math.min(rng.randInt(x, x + width - 1), MapWidth - 2), 2); // 7085
      while (MapTemp[x2][y - 1] || MapTemp[x2 - 1][y - 1] || MapTemp[x2 + 1][y - 1]) { // 7086
        x2 = x2 + 1;
      }

      if (x2 < x + width) {            // 7090
        let tempheight: number;
        if (i === 1) {                 // 7091
          tempheight = height;
          if (rng.randInt(2) === 1) x2 = x; else x2 = x + width; // 7093
        } else {
          tempheight = rng.randInt(1, height); // 7095
        }

        for (let y2 = y - tempheight; y2 <= y; y2++) {           // 7098
          if (getZone(y2, MapWidth) !== getZone(y2 + 1, MapWidth)) {
            MapTemp[x2][y2] = 255;     // 7100
          } else {
            MapTemp[x2][y2] = 1;       // 7102
          }
        }

        if (tempheight === height) temp = x2; // 7106
      }
    }

    x = temp;          // 7111
    y = y - height;    // 7112
  } while (y >= 2);    // 7113 (Until y < 2)

  return { grid: MapTemp, mapWidth: MapWidth, mapHeight: MapHeight };
}
