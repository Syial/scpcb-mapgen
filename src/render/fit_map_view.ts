/** Ajuste le viewBox SVG pour des marges visuelles égales (meet sans bandes asymétriques). */
export function fitMapViewBox(mapRoot: HTMLElement): void {
  const svg = mapRoot.querySelector<SVGSVGElement>("svg");
  if (!svg) return;

  if (!svg.dataset.baseW) {
    const vb = svg.viewBox.baseVal;
    svg.dataset.baseX = String(vb.x);
    svg.dataset.baseY = String(vb.y);
    svg.dataset.baseW = String(vb.width);
    svg.dataset.baseH = String(vb.height);
  }

  const vx = Number(svg.dataset.baseX);
  const vy = Number(svg.dataset.baseY);
  const vw = Number(svg.dataset.baseW);
  const vh = Number(svg.dataset.baseH);
  const cw = mapRoot.clientWidth;
  const ch = mapRoot.clientHeight;
  if (!cw || !ch || !vw || !vh) return;

  const mapAR = vw / vh;
  const boxAR = cw / ch;
  let x = vx;
  let y = vy;
  let w = vw;
  let h = vh;

  if (boxAR > mapAR) {
    w = vh * boxAR;
    x = vx - (w - vw) / 2;
  } else {
    h = vw / boxAR;
    y = vy - (h - vh) / 2;
  }

  svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
}
