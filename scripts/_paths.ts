import { join } from "path";

/** Arborescence SCP:CB (doit contenir MapSystem.bb). */
export function scpcbRoot(): string {
  const root = process.env.SCPCB_ROOT?.trim();
  if (!root) {
    console.error("Set SCPCB_ROOT to the SCP:CB source tree (directory containing MapSystem.bb).");
    process.exit(1);
  }
  return root;
}

export function scpcbFile(...parts: string[]): string {
  return join(scpcbRoot(), ...parts);
}

/** Exige un chemin argv, sinon affiche l'usage et quitte. */
export function requireArgPath(argvIndex: number, usage: string): string {
  const p = process.argv[argvIndex]?.trim();
  if (!p || p.startsWith("-")) {
    console.error(usage);
    process.exit(1);
  }
  return p;
}
