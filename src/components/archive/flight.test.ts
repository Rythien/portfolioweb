import { test } from "node:test";
import assert from "node:assert/strict";
import { FLIGHT, createFlight, speed, stepFlight, terminalSpeed, type FlightInput } from "./flight.ts";

const idle: FlightInput = { thrust: 0, strafe: 0, lift: 0, yaw: 0, pitch: 0 };
const fwd: FlightInput = { ...idle, thrust: 1 };

function run(input: FlightInput, seconds: number, dt: number) {
  const s = createFlight();
  for (let t = 0; t < seconds - 1e-9; t += dt) stepFlight(s, input, dt);
  return s;
}

test("frame-rate independent: 30, 60 and 144 Hz land in the same place", () => {
  const input = { ...fwd, yaw: 0.6, pitch: 0.2 };
  const a = run(input, 3, 1 / 30);
  const b = run(input, 3, 1 / 60);
  const c = run(input, 3, 1 / 144);
  for (const k of ["px", "py", "pz", "yaw", "pitch"] as const) {
    assert.ok(Math.abs(a[k] - b[k]) < 0.25, `${k}: 30 Hz ${a[k]} vs 60 Hz ${b[k]}`);
    assert.ok(Math.abs(c[k] - b[k]) < 0.15, `${k}: 144 Hz ${c[k]} vs 60 Hz ${b[k]}`);
  }
});

test("thrust builds over about a second toward terminal speed", () => {
  const vmax = terminalSpeed();
  assert.ok(speed(run(fwd, 0.25, 1 / 60)) < vmax * 0.3, "not instant");
  assert.ok(speed(run(fwd, 1.5, 1 / 60)) > vmax * 0.55, "most of the way in 1.5 s");
  assert.ok(speed(run(fwd, 8, 1 / 60)) <= vmax + 1e-6, "never past terminal");
});

test("letting go coasts for seconds, it does not stop dead", () => {
  const s = run(fwd, 4, 1 / 60);
  const v0 = speed(s);
  for (let i = 0; i < 60; i++) stepFlight(s, idle, 1 / 60);
  assert.ok(speed(s) > v0 * 0.35, "still drifting after 1 s");
  for (let i = 0; i < 300; i++) stepFlight(s, idle, 1 / 60);
  assert.ok(speed(s) < 0.2, "settled after 6 s");
});

test("diagonal input is no faster than straight", () => {
  const diag = run({ ...fwd, strafe: 1, lift: 1 }, 6, 1 / 60);
  assert.ok(speed(diag) <= terminalSpeed() + 1e-6);
});

test("the void eases you back past the soft radius; no wall, no death", () => {
  const s = createFlight();
  s.pz = FLIGHT.softRadius + 20;
  s.vz = 0;
  for (let i = 0; i < 600; i++) stepFlight(s, idle, 1 / 60);
  assert.ok(Math.hypot(s.px, s.py, s.pz) < FLIGHT.softRadius + 5, "pulled back inside");
});

test("pitch is clamped short of straight up and down", () => {
  const s = run({ ...idle, pitch: 1 }, 10, 1 / 60);
  assert.ok(s.pitch <= FLIGHT.pitchMax + 1e-9);
});
