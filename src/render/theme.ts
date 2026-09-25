// Palette carte S-NAV - fond olive CRT, salles vert très foncé.

/** Épaisseur du cadre map et des séparateurs checkpoint (sync avec --map-frame). */
export const MAP_FRAME_PX = 6;

export interface MapPalette {
  screen: string;
  frame: string;
  header: string;
  muted: string;
  label: string;
  hover: string;
  room: string;
  zone: Record<number, string>;
  wash: Record<number, string>;
  checkpointRoom: string;
  grid: string;
  wall: string;
  joint: string;
  ink: string;
  inkDimmer: string;
  ok: string;
  checkpoint: string;
  fontMono: string;
}

const MAP_OLIVE = "#6A785F";
const ROOM = "#2E382C";
const FRAME = "#1E1E1E";
const FONT = '"DS-Digital", "IBM Plex Mono", ui-monospace, monospace';

const ZONES = { 1: ROOM, 2: ROOM, 3: ROOM, 0: ROOM };
const WASH = { 1: MAP_OLIVE, 2: MAP_OLIVE, 3: MAP_OLIVE, 0: MAP_OLIVE };

function pal(
  screen: string,
  room: string,
  wall: string,
  label: string,
  frame: string,
  muted: string,
  hover: string,
  grid: string,
  zones: Record<number, string>,
  wash: Record<number, string>,
  checkpoint = frame,
): MapPalette {
  return {
    fontMono: FONT,
    screen,
    frame,
    header: room,
    muted,
    label,
    hover,
    room,
    zone: zones,
    wash,
    checkpointRoom: checkpoint,
    grid,
    wall,
    joint: room,
    ink: room,
    inkDimmer: muted,
    ok: hover,
    checkpoint: wash[2] ?? screen,
  };
}

const SNAV = pal(
  MAP_OLIVE,
  ROOM,
  ROOM,
  "#A8B4A0",
  FRAME,
  "#8A9682",
  "#9B4A3F", // select / hover - label-accent
  MAP_OLIVE,
  ZONES,
  WASH,
  ROOM,
);

export const MAP_PALETTES: Record<string, MapPalette> = {
  snav: SNAV,
};

export const stripTheme = {
  screen: SNAV.screen,
  frame: SNAV.frame,
  header: SNAV.header,
  muted: SNAV.muted,
  label: SNAV.label,
  hover: SNAV.hover,
  room: SNAV.room,
  zone: { ...SNAV.zone } as Record<number, string>,
  wash: { ...SNAV.wash } as Record<number, string>,
  checkpointRoom: SNAV.checkpointRoom,
  fontMono: SNAV.fontMono,
};

export const tunnelsTheme = {
  screen: SNAV.screen,
  frame: SNAV.frame,
  wash: SNAV.wash[2] ?? SNAV.screen,
  path: SNAV.room,
  gen: SNAV.room,
  portal: SNAV.room,
  label: SNAV.label,
  fontMono: SNAV.fontMono,
};

export const forestTheme = {
  screen: SNAV.screen,
  frame: SNAV.frame,
  wash: SNAV.wash[1] ?? SNAV.screen,
  path: SNAV.room,
  door: SNAV.room,
  log: SNAV.room,
  label: SNAV.label,
  fontMono: SNAV.fontMono,
};

function applyPalette(p: MapPalette): void {
  stripTheme.screen = p.screen;
  stripTheme.frame = p.frame;
  stripTheme.header = p.header;
  stripTheme.muted = p.muted;
  stripTheme.label = p.label;
  stripTheme.hover = p.hover;
  stripTheme.room = p.room;
  Object.assign(stripTheme.zone, p.zone);
  Object.assign(stripTheme.wash, p.wash);
  stripTheme.checkpointRoom = p.checkpointRoom;
  stripTheme.fontMono = p.fontMono;

  tunnelsTheme.screen = p.screen;
  tunnelsTheme.label = p.label;
  tunnelsTheme.frame = p.frame;
  tunnelsTheme.wash = p.wash[2] ?? p.screen;
  tunnelsTheme.path = p.room;
  tunnelsTheme.gen = p.room;
  tunnelsTheme.portal = p.room;
  tunnelsTheme.fontMono = p.fontMono;

  forestTheme.screen = p.screen;
  forestTheme.label = p.label;
  forestTheme.frame = p.frame;
  forestTheme.wash = p.wash[1] ?? p.screen;
  forestTheme.path = p.room;
  forestTheme.door = p.room;
  forestTheme.log = p.room;
  forestTheme.fontMono = p.fontMono;
}

export function applyMapPalette(themeId?: string): void {
  const id = themeId ?? document.documentElement.dataset.theme ?? "snav";
  applyPalette(MAP_PALETTES[id] ?? SNAV);
}

export { zoneName, zoneCode } from "../zone_meta";

