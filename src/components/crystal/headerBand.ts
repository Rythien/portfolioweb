/**
 * The bottom edge of the fixed header band, in CSS px from the viewport
 * top: the header itself, plus the section strip under it below lg. The
 * broken shards keep their drift below it (GlassCrystal), so none floats
 * over the nav.
 *
 * Measured on first use and again on every resize of the window, the
 * header or the strip; never per frame (no layout read in the render loop).
 */
let bottomPx = 0;
let started = false;

function measure() {
  bottomPx = 0;
  for (const el of document.querySelectorAll("header[data-intro], [data-rail-strip]")) {
    const r = el.getBoundingClientRect();
    if (r.height > 0) bottomPx = Math.max(bottomPx, r.bottom);
  }
}

export function headerBandBottom(): number {
  if (typeof window === "undefined") return 0;
  if (!started) {
    started = true;
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    for (const el of document.querySelectorAll("header[data-intro], [data-rail-strip]")) ro.observe(el);
  }
  return bottomPx;
}
