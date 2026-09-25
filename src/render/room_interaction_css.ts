import { SPAWN_MARKER_CSS } from "./spawn_marker";

/** CSS SVG partagé strip/extent (hover, sélection, pending). */
export function roomInteractionCss(
  t: { hover: string; label: string },
  extra = "",
): string {
  return (
    `.room{cursor:crosshair;outline:none}` +
    `.room.is-pending,.spawn-marker.is-pending{visibility:hidden}` +
    `.room > *:not(text){transition:fill .08s,stroke .08s,stroke-width .08s}` +
    `.room:hover:not(.selected) > *:not(text),.room:focus:not(.selected) > *:not(text){stroke:${t.hover};stroke-width:2}` +
    `.room.selected > *:not(text){fill:${t.hover};stroke:${t.hover};stroke-width:1}` +
    `.room.selected text{fill:${t.label}}` +
    extra +
    `@media (prefers-reduced-motion:reduce){.room > *:not(text){transition:none}}` +
    SPAWN_MARKER_CSS
  );
}
