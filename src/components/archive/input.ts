/**
 * Archive input: keyboard (by physical key, so AZERTY works), pointer
 * hold-to-drift and touch, folded into one FlightInput each frame.
 *
 *   Pointer / touch: press and hold to drift toward where you point;
 *                    release to coast.
 *   Keyboard:        W S forward/back, A D strafe, Q E down/up,
 *                    arrow keys look.
 */
import type { FlightInput } from "./flight";

export interface InputState {
  keys: Set<string>;
  /** Pointer held on the canvas. */
  held: boolean;
  /** Pointer position relative to the canvas centre, -1..1 on the short axis. */
  px: number;
  py: number;
  /** Set on the first real move; the hint fades after it. */
  moved: boolean;
}

export function createInput(): InputState {
  return { keys: new Set(), held: false, px: 0, py: 0, moved: false };
}

export const FLIGHT_KEYS = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
]);

/** Pointer steering: a small dead zone, then a soft curve to full rate. */
function steer(v: number): number {
  const dead = 0.07;
  const a = Math.abs(v);
  if (a < dead) return 0;
  const t = Math.min(1, (a - dead) / (0.85 - dead));
  return Math.sign(v) * Math.pow(t, 1.35);
}

export function readFlightInput(s: InputState, out: FlightInput): FlightInput {
  const k = s.keys;
  const axis = (pos: string, neg: string) => (k.has(pos) ? 1 : 0) - (k.has(neg) ? 1 : 0);
  out.thrust = axis("KeyW", "KeyS");
  out.strafe = axis("KeyD", "KeyA");
  out.lift = axis("KeyE", "KeyQ");
  out.yaw = axis("ArrowRight", "ArrowLeft");
  out.pitch = axis("ArrowUp", "ArrowDown");
  if (s.held) {
    out.thrust = Math.max(out.thrust, 1);
    out.yaw += steer(s.px);
    out.pitch += steer(-s.py);
  }
  return out;
}

/** Set the pointer position from a client point over an element. */
export function setPointer(s: InputState, el: HTMLElement, clientX: number, clientY: number): void {
  const r = el.getBoundingClientRect();
  const half = Math.min(r.width, r.height) / 2;
  s.px = Math.max(-1.5, Math.min(1.5, (clientX - (r.left + r.width / 2)) / half));
  s.py = Math.max(-1.5, Math.min(1.5, (clientY - (r.top + r.height / 2)) / half));
}
