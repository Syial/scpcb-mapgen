// Port bit-exact du RNG Blitz3D 1.108 + hash GenerateSeedNumber.
// Note : certains forks (ex. Saalvage) remappent state=0 → RND_R ; le jeu officiel non.
export class BlitzRng {
  private state = 1;

  private static readonly A = 48271;
  private static readonly M = 2147483647; // 2^31 - 1
  private static readonly Q = 44488;
  private static readonly R = 3399;

  // Seed depuis un entier, une chaîne (via GenerateSeedNumber), ou le défaut moteur (0x1234).
  constructor(seed: number | string = 0x1234) {
    if (typeof seed === "string") {
      this.seed(BlitzRng.generateSeedNumber(seed));
    } else {
      this.seed(seed);
    }
  }

  // Hash de la seed texte, recopié depuis GenerateSeedNumber (Main.bb).
  static generateSeedNumber(seed: string): number {
    let temp = 0;
    let shift = 0;
    for (let i = 0; i < seed.length; i++) {
      // | 0 force l'arithmétique int32, comme les entiers Blitz
      temp = (temp ^ (seed.charCodeAt(i) << shift)) | 0;
      shift = (shift + 1) % 24;
    }
    return temp;
  }

  // SeedRnd : masque 31 bits ; seul 0 → 1. M (=2147483647) est autorisé
  // (Direct RNG / speedrun mod : SeedRnd Int(RandomSeed), sans hash).
  seed(seed: number): void {
    seed = seed & 0x7fffffff;
    this.state = seed !== 0 ? seed : 1;
  }

  // Avance l'état ; [0,1) float32. SeedRnd(M) → suite collée (« spine »).
  next(): number {
    this.state =
      BlitzRng.A * (this.state % BlitzRng.Q) -
      BlitzRng.R * Math.floor(this.state / BlitzRng.Q);
    if (this.state < 0) this.state += BlitzRng.M;
    return Math.fround(
      Math.fround((this.state & 65535) / 65536) + Math.fround(0.5 / 65536)
    );
  }

  // Rand(from, to) : entier, bornes incluses, swap si to < from.
  randInt(from: number, to: number = 1): number {
    if (to < from) {
      const t = from;
      from = to;
      to = t;
    }
    return Math.trunc(Math.fround(this.next() * (to - from + 1))) + from;
  }

  // Rnd(from, to) : flottant, sémantique float32.
  randFloat(from: number, to: number = 0): number {
    // Les arguments sont traités comme des float32 (comme les littéraux Blitz).
    const f = Math.fround(from);
    const t = Math.fround(to);
    return Math.fround(Math.fround(this.next() * Math.fround(t - f)) + f);
  }
}
