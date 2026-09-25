import type { PlacedRoom } from "./placement";
import { ROOM2 } from "./rooms";
import extentsData from "./room_extents.json";

// PreventRoomOverlap + CalculateRoomExtents (8544-8732) : rotation 180° ou swap pour séparer les salles qui se chevauchent, 0 RNG.

const SHRINK = Math.fround(0.05);   // Local shrinkAmount# = 0.05 → float32 dans Blitz, PAS un double
const SPACING = 8.0;

interface TmplExt {
  ext: [number, number, number, number, number, number]; // minX,minY,minZ,maxX,maxY,maxZ (locaux)
  shape: string;
  commonness: number;
  disableOverlap: boolean;
}
interface AABB { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number }

const DATA = extentsData as unknown as { roomScale: number; templates: Record<string, TmplExt> };
const TMPL = DATA.templates;

const f = Math.fround;
const _dv = new DataView(new ArrayBuffer(4));

// Matrices monde par angle, dumpées bit à bit du runtime ; 450≠90 d'un ULP, d'où des entrées séparées.
const MAT_BITS: Record<number, number[]> = {
  0:   [998244352, 0, 0, 0, 998244352, 0, 0, 0, 998244352],
  90:  [-1342177280, 0, 998244353, 0, 998244352, 0, -1149239295, 0, -1342177280],
  180: [-1149239296, 0, -1346650834, 0, 998244352, 0, 800832814, 0, -1149239296],
  270: [-1342177280, 0, -1149239295, 0, 998244352, 0, 998244353, 0, -1342177280],
  360: [998244352, 0, 809221422, -2147483648, 998244352, 0, -1338262226, -2147483648, 998244352],
  450: [809500672, 0, 998244351, -2147483648, 998244352, 0, -1149239297, -2147483648, 809500672],
};
function bitsToF32(b: number): number { _dv.setInt32(0, b | 0); return _dv.getFloat32(0); }
// Matrice décodée : [i.x,i.y,i.z, j.x,j.y,j.z, k.x,k.y,k.z] en float32 exacts.
const MAT: Record<number, number[]> = {};
for (const a in MAT_BITS) MAT[a] = MAT_BITS[a].map(bitsToF32);

// Extents bit-exacts : TFormVector + shrink + position, avec f() après chaque op (le x87 sous D3D arrondit en 24 bits).
function calcExtentsRaw(
  r: PlacedRoom,
  angle: number,
  opts: { forDisplay?: boolean } = {},
): AABB | null {
  const t = TMPL[r.name];
  // disableOverlap : le jeu ne teste pas, mais le mesh a quand même des bornes (ex. room3storage)
  if (!t) return null;
  if (t.disableOverlap && !opts.forDisplay) return null;
  const e = t.ext;
  const A = MAT[angle] !== undefined ? angle : (((angle % 360) + 360) % 360);
  const m = MAT[A] ?? MAT[0];
  // m = [i.x,i.y,i.z, j.x,j.y,j.z, k.x,k.y,k.z]
  const rx = f(r.gx * SPACING), rz = f(r.gy * SPACING), sh = SHRINK;

  // i.c*q.x + j.c*q.y + k.c*q.z, arrondi f32 à chaque opération (PC=24-bit).
  const tf = (qx: number, qy: number, qz: number, a: number, b: number, c: number) =>
    f(f(f(a * qx) + f(b * qy)) + f(c * qz));

  // TFormVector(MinX,MinY,MinZ, r\obj, 0) puis (MaxX,MaxY,MaxZ, r\obj, 0)
  const tMinX = tf(e[0], e[1], e[2], m[0], m[3], m[6]);
  const tMinY = tf(e[0], e[1], e[2], m[1], m[4], m[7]);
  const tMinZ = tf(e[0], e[1], e[2], m[2], m[5], m[8]);
  const tMaxX = tf(e[3], e[4], e[5], m[0], m[3], m[6]);
  const tMaxY = tf(e[3], e[4], e[5], m[1], m[4], m[7]);
  const tMaxZ = tf(e[3], e[4], e[5], m[2], m[5], m[8]);

  // r\Min = TFormed + shrink (+ r\x / r\z)  ;  r\Max = TFormed - shrink (+ ...)
  let minX = f(f(tMinX + sh) + rx);
  const minY = f(tMinY + sh);
  let minZ = f(f(tMinZ + sh) + rz);
  let maxX = f(f(tMaxX - sh) + rx);
  const maxY = f(tMaxY - sh);
  let maxZ = f(f(tMaxZ - sh) + rz);

  if (minX > maxX) { const tmp = maxX; maxX = minX; minX = tmp; }
  if (minZ > maxZ) { const tmp = maxZ; maxZ = minZ; minZ = tmp; }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

/** Bornes monde. `forDisplay` : calcule aussi les salles DisableOverlapCheck (mesh présent). */
export function calculateRoomExtents(
  r: PlacedRoom,
  angle: number,
  opts: { forDisplay?: boolean } = {},
): AABB | null {
  return calcExtentsRaw(r, angle, opts);
}
// CheckRoomOverlap : intersection AABB (bornes strictes comme le moteur).
function overlaps(a: AABB, b: AABB): boolean {
  if (a.maxX <= b.minX || a.maxY <= b.minY || a.maxZ <= b.minZ) return false;
  if (a.minX >= b.maxX || a.minY >= b.maxY || a.minZ >= b.maxZ) return false;
  return true;
}

// Salles jamais soumises au check (flag template ou skip runtime).
function isSkipped(r: PlacedRoom): boolean {
  const t = TMPL[r.name];
  return (
    !t || t.disableOverlap ||
    r.name === "checkpoint1" || r.name === "checkpoint2" || r.name === "start"
  );
}

// Anti-overlap sur toutes les salles, ordre de création ; onExtent = hook de conformité des tests.
export function preventRoomOverlap(
  rooms: PlacedRoom[],
  onExtent?: (r: PlacedRoom, e: AABB) => void,
  onStep?: (kind: "rotate" | "swap") => void,
): void {
  const ext = new Map<PlacedRoom, AABB>();
  let trace: ((r: PlacedRoom, e: AABB) => void) | undefined;  // activé après les extents initiaux
  const setExt = (r: PlacedRoom, angle: number) => {
    const a = calcExtentsRaw(r, angle);
    if (a) { ext.set(r, a); trace?.(r, a); } else ext.delete(r);
  };
  for (const r of rooms) {
    // Extents initiaux à angle 0 (CreateRoom calcule avant l'orientation).
    setExt(r, 0);
  }
  trace = onExtent; // hook activé seulement après les extents initiaux (phase CreateRoom)

  // Ne pas écarter les checkpoints côté cible (room079 doit pouvoir les overlapper).
  const anyOverlap = (r: PlacedRoom, skip?: PlacedRoom, skip2?: PlacedRoom): boolean => {
    const er = ext.get(r);
    if (!er) return false;
    for (const r2 of rooms) {
      if (r2 === r || r2 === skip || r2 === skip2) continue;
      const e2 = ext.get(r2);
      if (e2 && overlaps(er, e2)) return true;
    }
    return false;
  };

  const firstOverlap = (r: PlacedRoom): PlacedRoom | null => {
    const er = ext.get(r);
    if (!er) return null;
    for (const r2 of rooms) {
      if (r2 === r) continue;
      const e2 = ext.get(r2);
      if (e2 && overlaps(er, e2)) return r2;
    }
    return null;
  };

  for (const r of rooms) {
    if (isSkipped(r)) continue;
    if (!anyOverlap(r)) continue;

    // 1. ROOM2 : tenter rotation 180°
    if (r.shape === ROOM2) {
      const orig = r.angle ?? 0;
      r.angle = orig + 180;
      setExt(r, r.angle ?? 0);
      if (!anyOverlap(r)) {
        onStep?.("rotate");
        continue;
      }
      r.angle = orig; // revert
      setExt(r, r.angle ?? 0);
    }

    // 2. Swap même forme/zone - bug fidèle : pas de break, r finit au dernier swap valide.
    for (const r2 of rooms) {
      if (r2 === r || isSkipped(r2)) continue;
      if (r.shape !== r2.shape || r.zone !== r2.zone) continue;
      if (r2.name === "checkpoint1" || r2.name === "checkpoint2" || r2.name === "start") continue;

      const rG: [number, number, number | null] = [r.gx, r.gy, r.angle];
      const r2G: [number, number, number | null] = [r2.gx, r2.gy, r2.angle];

      r.gx = r2G[0]; r.gy = r2G[1]; r.angle = r2G[2];
      r2.gx = rG[0]; r2.gy = rG[1]; r2.angle = rG[2];
      setExt(r, r.angle ?? 0);
      setExt(r2, r2.angle ?? 0);

      // revert si l'une des deux overlap encore, et pas de break (bug du jeu)
      if (firstOverlap(r) || firstOverlap(r2)) {
        r.gx = rG[0]; r.gy = rG[1]; r.angle = rG[2];
        r2.gx = r2G[0]; r2.gy = r2G[1]; r2.angle = r2G[2];
        setExt(r, r.angle ?? 0);
        setExt(r2, r2.angle ?? 0);
      } else {
        onStep?.("swap");
      }
    }
  }
}
// Overlaps résiduels : salles jouables encore superposées après l'anti-overlap (~9 % des seeds).
export function residualOverlaps(rooms: PlacedRoom[]): Array<[string, string]> {
  const ext = rooms
    .filter((r) => r.zone > 0)
    .map((r) => ({ r, e: calculateRoomExtents(r, r.angle ?? 0) }))
    .filter((x): x is { r: PlacedRoom; e: AABB } => x.e !== null);
  const out: Array<[string, string]> = [];
  for (let i = 0; i < ext.length; i++)
    for (let j = i + 1; j < ext.length; j++) {
      const a = ext[i].e, b = ext[j].e;
      const ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
      const oz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
      if (ox > 0.5 && oz > 0.5 && ox * oz > 50) out.push([ext[i].r.name, ext[j].r.name]);
    }
  return out;
}
