/**
 * Damped spring toward a target, stepped with the exact solution of
 * x'' = -omega^2 (x - target) - 2 zeta omega x', holding the target for
 * the step. Frame-rate independent and unconditionally stable.
 *
 * zeta = 1 is critically damped: the fastest approach with no overshoot.
 * zeta < 1 overshoots a step by exp(-zeta*pi / sqrt(1 - zeta^2)):
 * zeta 0.745 -> 3%.
 */
export interface Spring {
  x: number;
  v: number;
}

/** Damping ratio that overshoots a step by `fraction` (0.03 = 3%). */
export function zetaForOvershoot(fraction: number): number {
  const l = Math.log(fraction);
  return -l / Math.sqrt(Math.PI * Math.PI + l * l);
}

export function stepSpring(s: Spring, target: number, omega: number, zeta: number, dt: number) {
  const x0 = s.x - target;
  const v0 = s.v;
  if (zeta >= 1) {
    const e = Math.exp(-omega * dt);
    const c = v0 + omega * x0;
    const p = x0 + c * dt;
    s.x = target + p * e;
    s.v = (c - omega * p) * e;
    return;
  }
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  const e = Math.exp(-zeta * omega * dt);
  const a = x0;
  const b = (v0 + zeta * omega * x0) / wd;
  const cos = Math.cos(wd * dt);
  const sin = Math.sin(wd * dt);
  s.x = target + e * (a * cos + b * sin);
  s.v = e * (-zeta * omega * (a * cos + b * sin) + wd * (b * cos - a * sin));
}
