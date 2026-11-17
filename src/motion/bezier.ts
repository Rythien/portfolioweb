/**
 * CSS cubic-bezier(x1, y1, x2, y2) as a function of progress 0..1, so
 * scroll-driven and frame-driven code can use the same curves as CSS and
 * GSAP. Solves x(t) = p with Newton steps, bisection as the fallback.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  const solve = (p: number) => {
    let t = p;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - p;
      if (Math.abs(err) < 1e-6) return t;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = p;
    for (let i = 0; i < 30; i++) {
      const x = sx(t);
      if (Math.abs(x - p) < 1e-6) break;
      if (x < p) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };

  return (p: number) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    return sy(solve(p));
  };
}
