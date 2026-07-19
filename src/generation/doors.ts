// Portes (CreateMap 7648-7734) : positions seules, chaque salle pose droite + bas. Le jeu itère la grille, les swaps d'overlap sont sans effet ici.

export interface Door {
  x: number; z: number; angle: number;
  from: [number, number];
  to: [number, number];
}

export function createDoors(grid: number[][], mapWidth: number, mapHeight: number): Door[] {
  const spacing = 8;
  const occ = (x: number, y: number): number =>
    x >= 0 && y >= 0 && x <= mapWidth + 1 && y <= mapHeight + 1 && grid[x][y] > 0 ? 1 : 0;

  const doors: Door[] = [];

  for (let y = mapHeight; y >= 0; y--) {
    for (let x = mapWidth; x >= 0; x--) {
      if (grid[x][y] > 0) {
        let rightC = false, downC = false;

        if (grid[x][y] === 255) {
          // checkpoint = ROOM2 angle 0 → porte du bas seulement
          rightC = false;
          downC = true;
        } else {
          const temp = occ(x + 1, y) + occ(x - 1, y) + occ(x, y + 1) + occ(x, y - 1);
          if (temp === 1) { // ROOM1
            let a = 0;
            if (occ(x, y + 1)) a = 180;
            else if (occ(x - 1, y)) a = 270;
            else if (occ(x + 1, y)) a = 90;
            rightC = a === 90;
            downC = a === 180;
          } else if (temp === 2) {
            if (occ(x - 1, y) && occ(x + 1, y)) { rightC = true; downC = false; }        // straight horizontal
            else if (occ(x, y - 1) && occ(x, y + 1)) { rightC = false; downC = true; }    // straight vertical
            else { // ROOM2C (coin)
              let a = 0;
              if (occ(x - 1, y) && occ(x, y + 1)) a = 180;
              else if (occ(x + 1, y) && occ(x, y + 1)) a = 90;
              else if (occ(x - 1, y) && occ(x, y - 1)) a = 270;
              rightC = a === 0 || a === 90;
              downC = a === 180 || a === 90;
            }
          } else if (temp === 3) { // ROOM3
            let a = 0;
            if (!occ(x, y - 1)) a = 180;
            else if (!occ(x - 1, y)) a = 90;
            else if (!occ(x + 1, y)) a = 270;
            rightC = a === 0 || a === 180 || a === 90;
            downC = a === 180 || a === 90 || a === 270;
          } else if (temp === 4) { // ROOM4 (default)
            rightC = true;
            downC = true;
          }
        }

        if (rightC && (x + 1) < (mapWidth + 1) && occ(x + 1, y)) {
          doors.push({ x: x * spacing + spacing / 2, z: y * spacing, angle: 90, from: [x, y], to: [x + 1, y] });
        }
        if (downC && (y + 1) < (mapHeight + 1) && occ(x, y + 1)) {
          doors.push({ x: x * spacing, z: y * spacing + spacing / 2, angle: 0, from: [x, y], to: [x, y + 1] });
        }
      }
    }
  }

  return doors;
}
