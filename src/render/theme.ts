// Couleurs du rendu SVG, reprises du HUD de SCP-079 dans SCP: Secret Laboratory.

export const theme = {
  // duplique style.css : l'export SVG ne peut pas lire les variables CSS
  screen: "#0E131C",
  grid: "#111B29",

  room: "#5469B4",       // fallback si zone inconnue
  zone: { 1: "#586EBA", 2: "#586EBA", 3: "#586EBA", 0: "#586EBA" } as Record<number, string>,
  checkpoint: "#1E2942",

  ink: "#8492EA",
  inkDimmer: "#3A4A72",  // traits des accolades
  label: "#EAF0FF",      // texte sur les salles
  ok: "#19A789",         // hover + entrées/sorties tunnels et forêt

  fontMono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',
};

// noms de zones affichés
export const zoneName: Record<number, string> = {
  1: "Light Containment",
  2: "Heavy Containment",
  3: "Entrance",
  0: "Anomalous",
};
