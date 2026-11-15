/**
 * Free-float flight through the Archive void. Pure (no three.js, no DOM)
 * so it runs under plain node for tests. Every rate is exponential, so the
 * result is frame-rate independent: two 1/120 s steps land where one
 * 1/60 s step does (within float error).
 *
 * Feel targets: you drift, you do not fly. Thrust builds speed over about
 * a second, letting go coasts for two to three seconds, turning eases in
 * and out, and the camera leans into turns.
 */

export interface FlightInput {
  /** -1 back .. 1 forward. */
  thrust: number;
  /** -1 left .. 1 right. */
  strafe: number;
  /** -1 down .. 1 up. */
  lift: number;
  /** Turn rate request, -1 .. 1 (positive = turn right). */
  yaw: number;
  /** Turn rate request, -1 .. 1 (positive = look up). */
  pitch: number;
}

export interface FlightState {
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  /** Heading (rad); 0 looks down -Z. */
  yaw: number;
  pitch: number;
  yawRate: number;
  pitchRate: number;
  /** Camera lean (rad), visual only. */
  roll: number;
  /** Seconds of flight, drives the idle bob. */
  t: number;
}

export interface FlightTuning {
  /** Thrust acceleration, units/s². */
  accel: number;
  /** Velocity damping per second; terminal speed = accel / drag. */
  drag: number;
  /** Max turn rate, rad/s. */
  turnRate: number;
  /** How fast the turn rate follows the request, 1/s. */
  turnResponse: number;
  /** Pitch limit, rad. */
  pitchMax: number;
  /** Lean per rad/s of yaw rate. */
  rollGain: number;
  /** Radius beyond which the void eases you back. */
  softRadius: number;
  /** Spring toward the centre per unit past softRadius, 1/s². */
  boundSpring: number;
}

export const FLIGHT: FlightTuning = {
  accel: 7.5,
  drag: 0.85,
  turnRate: 1.35,
  turnResponse: 5,
  pitchMax: 1.15,
  rollGain: 0.28,
  softRadius: 58,
  boundSpring: 1.6,
};

/** Calmer variant for prefers-reduced-motion: slower, no lean. */
export const FLIGHT_REDUCED: FlightTuning = {
  ...FLIGHT,
  accel: 5,
  drag: 1.1,
  turnRate: 0.9,
  turnResponse: 8,
  rollGain: 0,
};

export function createFlight(): FlightState {
  return {
    px: 0, py: 0, pz: 18,
    vx: 0, vy: 0, vz: 0,
    yaw: 0, pitch: 0.04,
    yawRate: 0, pitchRate: 0,
    roll: 0,
    t: 0,
  };
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Unit forward vector for a heading. */
export function forward(yaw: number, pitch: number): [number, number, number] {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

export function speed(s: FlightState): number {
  return Math.hypot(s.vx, s.vy, s.vz);
}

export function terminalSpeed(k: FlightTuning = FLIGHT): number {
  return k.accel / k.drag;
}

/** Advance the flight by dt seconds (clamp dt at the call site). */
export function stepFlight(s: FlightState, input: FlightInput, dt: number, k: FlightTuning = FLIGHT): void {
  s.t += dt;

  // Turning: the rate eases toward the request, the heading integrates it
  const turnK = 1 - Math.exp(-k.turnResponse * dt);
  s.yawRate += (clamp(input.yaw, -1, 1) * k.turnRate - s.yawRate) * turnK;
  s.pitchRate += (clamp(input.pitch, -1, 1) * k.turnRate * 0.8 - s.pitchRate) * turnK;
  s.yaw -= s.yawRate * dt;
  s.pitch = clamp(s.pitch + s.pitchRate * dt, -k.pitchMax, k.pitchMax);
  if (Math.abs(s.pitch) >= k.pitchMax) s.pitchRate = 0;

  // Thrust in camera space: forward follows pitch, strafe stays level,
  // lift is world up
  const [fx, fy, fz] = forward(s.yaw, s.pitch);
  const rx = Math.cos(s.yaw);
  const rz = -Math.sin(s.yaw);
  const th = clamp(input.thrust, -1, 1);
  const st = clamp(input.strafe, -1, 1);
  const li = clamp(input.lift, -1, 1);
  // Diagonal input is no faster than straight input
  const mag = Math.max(1, Math.hypot(th, st, li));
  const a = k.accel / mag;
  let ax = (fx * th + rx * st) * a;
  let ay = (fy * th + li) * a;
  let az = (fz * th + rz * st) * a;

  // Soft boundary: past softRadius the void pulls you back, gently
  const r = Math.hypot(s.px, s.py, s.pz);
  if (r > k.softRadius) {
    const pull = (r - k.softRadius) * k.boundSpring;
    ax -= (s.px / r) * pull;
    ay -= (s.py / r) * pull;
    az -= (s.pz / r) * pull;
  }

  // Semi-implicit Euler with exponential drag
  const damp = Math.exp(-k.drag * dt);
  s.vx = (s.vx + ax * dt) * damp;
  s.vy = (s.vy + ay * dt) * damp;
  s.vz = (s.vz + az * dt) * damp;
  s.px += s.vx * dt;
  s.py += s.vy * dt;
  s.pz += s.vz * dt;

  // Lean into turns and sideways drift (visual only)
  const sideVel = s.vx * rx + s.vz * rz;
  const rollTarget = clamp(-s.yawRate * k.rollGain * 1.4 - sideVel * k.rollGain * 0.03, -0.35, 0.35);
  s.roll += (rollTarget - s.roll) * (1 - Math.exp(-3 * dt));
}

/** Idle bob offset (units) for the camera, zero under reduced motion. */
export function bob(s: FlightState, reduced: boolean): { y: number; x: number } {
  if (reduced) return { x: 0, y: 0 };
  return {
    y: Math.sin(s.t * 0.85) * 0.07 + Math.sin(s.t * 0.37 + 1.3) * 0.05,
    x: Math.sin(s.t * 0.52 + 0.4) * 0.04,
  };
}
