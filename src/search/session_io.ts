import type { Filter } from "./filters";
import type { ScanMatch } from "../scan_worker";
import { MOD_MAX, BASE_SEED_MAX } from "../seed_limits";

// Session Search (import/export). Fichier non fiable : on valide, on n'exécute rien.
// v2 : notes fixes reconstruites depuis `filters` ; seules les notes variables sont stockées par seed.

const MAGIC = "snav-search";
const FORMAT_VERSION = 2;

/** Cap partagé scan/export/import (lignes compactes v2). Au plafond ~8-15 Mo. */
export const SESSION_RESULTS_MAX = 200_000;

/** Taille max à la lecture d'un fichier (rejette les payloads trop gros). */
export const SESSION_FILE_MAX_BYTES = 50 * 1024 * 1024;

export function sessionFileMaxMb(): number {
  return Math.round(SESSION_FILE_MAX_BYTES / (1024 * 1024));
}

export interface SearchSession {
  magic: typeof MAGIC;
  version: number;
  mode: "base" | "mod";
  from: number;
  to: number;
  filters: Filter[];
  /** Résultats en forme compacte (variables dans `v` seulement). */
  results: StoredMatch[];
  meta?: { scanned?: number; found?: number; exportedAt?: string };
}

/** Ligne compacte en mémoire et sur disque (v2). */
export interface StoredMatch {
  seed: string;
  finishable: boolean;
  /** Payloads variables indexés par position de filtre. distance → number, sinon string. */
  v?: Record<string, string | number>;
}

interface WireSession {
  magic: typeof MAGIC;
  version: number;
  mode: "base" | "mod";
  from: number;
  to: number;
  filters: Filter[];
  results: StoredMatch[];
  meta?: SearchSession["meta"];
}

const FILTER_TYPES = new Set([
  "room", "distance", "finishable", "overlap", "item", "event", "out_of_place",
]);

/** True si la note ne se déduit pas du filtre seul. */
export function isVariableFilter(f: Filter): boolean {
  switch (f.type) {
    case "distance":
    case "out_of_place":
      return true;
    case "overlap":
      return !f.roomA || !f.roomB;
    case "finishable":
      return !f.want; // liste des rooms bloquantes varie
    default:
      return false;
  }
}

function packVariable(f: Filter, note: string): string | number {
  if (f.type === "distance") {
    const m = /: (\d+)\s*$/.exec(note);
    if (m) return Number(m[1]);
  }
  return note;
}

export function unpackVariable(f: Filter, v: string | number): string {
  if (f.type === "distance" && typeof v === "number" && Number.isFinite(v)) {
    return `${f.roomA}↔${f.roomB}: ${Math.floor(v)}`;
  }
  return String(v);
}

/** Compacte un match worker (notes complètes) pour le stockage. */
export function storeMatch(filters: Filter[], m: ScanMatch): StoredMatch {
  const row: StoredMatch = { seed: m.seed, finishable: m.finishable };
  const v: Record<string, string | number> = {};
  let any = false;
  for (let i = 0; i < filters.length; i++) {
    const f = filters[i]!;
    if (!isVariableFilter(f)) continue;
    const note = m.notes[i];
    if (note === undefined) continue;
    v[String(i)] = packVariable(f, note);
    any = true;
  }
  if (any) row.v = v;
  return row;
}

function toWire(session: SearchSession): WireSession {
  return {
    magic: MAGIC,
    version: FORMAT_VERSION,
    mode: session.mode,
    from: session.from,
    to: session.to,
    filters: session.filters,
    results: session.results.length > SESSION_RESULTS_MAX
      ? session.results.slice(0, SESSION_RESULTS_MAX)
      : session.results,
    meta: session.meta,
  };
}

// ─── EXPORT ───────────────────────────────────────────────────────────────

export function buildSession(input: {
  mode: "base" | "mod";
  from: number;
  to: number;
  filters: Filter[];
  results: StoredMatch[];
  scanned?: number;
  found?: number;
}): SearchSession {
  const truncated = input.results.length > SESSION_RESULTS_MAX;
  const results = truncated ? input.results.slice(0, SESSION_RESULTS_MAX) : input.results;
  return {
    magic: MAGIC,
    version: FORMAT_VERSION,
    mode: input.mode,
    from: input.from,
    to: input.to,
    filters: input.filters,
    results,
    meta: {
      scanned: input.scanned,
      found: input.found,
      exportedAt: new Date().toISOString(),
    },
  };
}

export function downloadSession(session: SearchSession, filename?: string): void {
  // JSON compact (pas d'indentation) : gros gain sur les sessions à beaucoup de seeds.
  const json = JSON.stringify(toWire(session));
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `snav-search-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── IMPORT (validation stricte) ────────────────────────────────────────────

export type ImportResult =
  | { ok: true; session: SearchSession; truncated: boolean }
  | { ok: false; error: string };

/** Parse + valide le texte d'un fichier. Ne fait JAMAIS confiance au contenu. */
export function parseSession(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Not a valid JSON file." };
  }
  if (!isObject(raw)) return { ok: false, error: "File is not a S-Nav search session." };

  if (raw.magic !== MAGIC) {
    return { ok: false, error: "This file is not a S-Nav search session." };
  }
  if (typeof raw.version !== "number" || raw.version < 1 || raw.version > FORMAT_VERSION) {
    return { ok: false, error: `Unsupported session version (${String(raw.version)}).` };
  }
  const fileVersion = raw.version;

  const mode = raw.mode === "mod" ? "mod" : raw.mode === "base" ? "base" : null;
  if (!mode) return { ok: false, error: "Invalid scan mode in file." };

  const cap = mode === "mod" ? MOD_MAX : BASE_SEED_MAX;
  const from = intInRange(raw.from, mode === "mod" ? 1 : 0, cap);
  const to = intInRange(raw.to, mode === "mod" ? 1 : 0, cap);
  if (from === null || to === null || to < from) {
    return { ok: false, error: "Invalid seed range in file." };
  }

  const filters = validateFilters(raw.filters);
  if (filters === null) return { ok: false, error: "Invalid or unknown filters in file." };

  const rv = fileVersion >= 2
    ? validateResultsV2(raw.results, filters)
    : validateResultsV1(raw.results, filters);
  if (rv === null) return { ok: false, error: "Invalid results in file." };

  const session: SearchSession = {
    magic: MAGIC,
    version: FORMAT_VERSION,
    mode,
    from,
    to,
    filters,
    results: rv.results,
    meta: validateMeta(raw.meta),
  };
  return { ok: true, session, truncated: rv.truncated };
}

/** Lit un File et le valide. Rejette les fichiers déraisonnablement gros. */
export async function readSessionFile(file: File): Promise<ImportResult> {
  if (file.size > SESSION_FILE_MAX_BYTES) {
    return {
      ok: false,
      error: `File is larger than ${sessionFileMaxMb()} MB (sessions store at most ${SESSION_RESULTS_MAX.toLocaleString("en")} results).`,
    };
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: "Could not read the file." };
  }
  return parseSession(text);
}

// ─── validateurs internes ───────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function intInRange(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.floor(v);
  if (n < min || n > max) return null;
  return n;
}

function str(v: unknown, maxLen = 200): string | null {
  if (typeof v !== "string") return null;
  if (v.length > maxLen) return null;
  return v;
}

function validateFilters(v: unknown): Filter[] | null {
  if (!Array.isArray(v)) return null;
  if (v.length > 64) return null;
  const out: Filter[] = [];
  for (const f of v) {
    if (!isObject(f) || typeof f.type !== "string" || !FILTER_TYPES.has(f.type)) return null;
    const parsed = validateOneFilter(f);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

function validateOneFilter(f: Record<string, unknown>): Filter | null {
  switch (f.type) {
    case "room": {
      const room = str(f.room);
      if (room === null || typeof f.negate !== "boolean") return null;
      return { type: "room", room, negate: f.negate };
    }
    case "distance": {
      const roomA = str(f.roomA), roomB = str(f.roomB);
      const bound = intInRange(f.bound, 0, 100000);
      if (roomA === null || roomB === null || bound === null) return null;
      if (f.cmp !== "le" && f.cmp !== "ge") return null;
      return { type: "distance", roomA, roomB, bound, cmp: f.cmp };
    }
    case "finishable": {
      if (typeof f.want !== "boolean") return null;
      return { type: "finishable", want: f.want };
    }
    case "overlap": {
      const roomA = f.roomA === undefined ? undefined : str(f.roomA);
      const roomB = f.roomB === undefined ? undefined : str(f.roomB);
      if (f.roomA !== undefined && roomA === null) return null;
      if (f.roomB !== undefined && roomB === null) return null;
      if (roomA && roomB && roomA === roomB) return null;
      return {
        type: "overlap",
        ...(roomA ? { roomA } : {}),
        ...(roomB ? { roomB } : {}),
      };
    }
    case "item": {
      const room = str(f.room), name = str(f.name), tempname = str(f.tempname);
      if (room === null || name === null || tempname === null || typeof f.negate !== "boolean") return null;
      return { type: "item", room, name, tempname, negate: f.negate };
    }
    case "event": {
      const room = str(f.room), event = str(f.event);
      if (room === null || event === null || typeof f.negate !== "boolean") return null;
      return { type: "event", room, event, negate: f.negate };
    }
    case "out_of_place": {
      if (f.room === undefined) return { type: "out_of_place" };
      const room = str(f.room);
      if (room === null) return null;
      return { type: "out_of_place", room };
    }
    default:
      return null;
  }
}

/** v1 : notes complètes → forme compacte. */
function validateResultsV1(
  v: unknown,
  filters: Filter[],
): { results: StoredMatch[]; truncated: boolean } | null {
  if (!Array.isArray(v)) return null;
  const truncated = v.length > SESSION_RESULTS_MAX;
  const slice = truncated ? v.slice(0, SESSION_RESULTS_MAX) : v;
  const out: StoredMatch[] = [];
  for (const m of slice) {
    if (!isObject(m)) return null;
    const seed = str(m.seed, 32);
    if (seed === null || typeof m.finishable !== "boolean") return null;
    if (!Array.isArray(m.notes)) return null;
    const notes: string[] = [];
    for (const n of m.notes) {
      const s = str(n, 300);
      if (s === null) return null;
      notes.push(s);
    }
    out.push(storeMatch(filters, { seed, finishable: m.finishable, notes }));
  }
  return { results: out, truncated };
}

/** v2 : déjà compact. */
function validateResultsV2(
  v: unknown,
  filters: Filter[],
): { results: StoredMatch[]; truncated: boolean } | null {
  if (!Array.isArray(v)) return null;
  const truncated = v.length > SESSION_RESULTS_MAX;
  const slice = truncated ? v.slice(0, SESSION_RESULTS_MAX) : v;
  const out: StoredMatch[] = [];
  for (const m of slice) {
    if (!isObject(m)) return null;
    const seed = str(m.seed, 32);
    if (seed === null || typeof m.finishable !== "boolean") return null;

    let packed: Record<string, string | number> | undefined;
    if (m.v !== undefined) {
      if (!isObject(m.v)) return null;
      packed = {};
      for (const [k, val] of Object.entries(m.v)) {
        const idx = Number(k);
        if (!Number.isInteger(idx) || idx < 0 || idx >= filters.length) return null;
        const f = filters[idx]!;
        if (!isVariableFilter(f)) return null;
        if (f.type === "distance") {
          if (typeof val !== "number" || !Number.isFinite(val) || val < 0 || val > 100000) return null;
          packed[k] = Math.floor(val);
        } else {
          const s = str(val, 300);
          if (s === null) return null;
          packed[k] = s;
        }
      }
    }

    out.push({ seed, finishable: m.finishable, v: packed });
  }
  return { results: out, truncated };
}

function validateMeta(v: unknown): SearchSession["meta"] {
  if (!isObject(v)) return undefined;
  const meta: NonNullable<SearchSession["meta"]> = {};
  if (typeof v.scanned === "number" && Number.isFinite(v.scanned)) meta.scanned = Math.floor(v.scanned);
  if (typeof v.found === "number" && Number.isFinite(v.found)) meta.found = Math.floor(v.found);
  const at = str(v.exportedAt, 40);
  if (at !== null) meta.exportedAt = at;
  return meta;
}
