// Codes keypad : tunnels = (bureau × 3) mod 10000 (+1000 si < 1000) — l'AccessCode lui-même n'est pas dérivable de la seed.

const isOffice = (n: number): boolean =>
  Number.isInteger(n) && n >= 1111 && n <= 9999 && String(n).split("").every((d) => d >= "1" && d <= "9");

// Sens direct, exact et unique.
export function officeToTunnels(office: number): number | null {
  if (!isOffice(office)) return null;
  let t = (office * 3) % 10000;
  if (t < 1000) t += 1000;
  return t;
}

// Sens inverse, non injectif (~4 % ambigus) : renvoie tous les antécédents.
export function tunnelsToOffice(tunnels: number): number[] {
  if (!Number.isInteger(tunnels) || tunnels < 1000 || tunnels > 9999) return [];
  const out: number[] = [];
  for (let o = 1111; o <= 9999; o++) {
    if (isOffice(o) && officeToTunnels(o) === tunnels) out.push(o);
  }
  return out;
}
