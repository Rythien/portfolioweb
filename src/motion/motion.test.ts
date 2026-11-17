import { test } from "node:test";
import assert from "node:assert/strict";
import { cubicBezier } from "./bezier.ts";
import { stepSpring, zetaForOvershoot } from "./spring.ts";

test("cubicBezier matches its endpoints and is monotonic for (0.16, 1, 0.3, 1)", () => {
  const e = cubicBezier(0.16, 1, 0.3, 1);
  assert.equal(e(0), 0);
  assert.equal(e(1), 1);
  let prev = 0;
  for (let i = 1; i <= 100; i++) {
    const v = e(i / 100);
    assert.ok(v >= prev - 1e-9, `not monotonic at ${i / 100}`);
    prev = v;
  }
  // Strong deceleration: well past halfway by a fifth of the way in
  assert.ok(e(0.2) > 0.7, `e(0.2) = ${e(0.2)}`);
});

test("cubicBezier(0.25,0.25,0.75,0.75) is linear", () => {
  const e = cubicBezier(0.25, 0.25, 0.75, 0.75);
  for (const p of [0.1, 0.33, 0.5, 0.9]) assert.ok(Math.abs(e(p) - p) < 1e-4);
});

function stepResponse(zeta: number, omega = 6, dt = 1 / 60) {
  const s = { x: 0, v: 0 };
  let peak = 0;
  for (let i = 0; i < 600; i++) {
    stepSpring(s, 1, omega, zeta, dt);
    peak = Math.max(peak, s.x);
  }
  return { peak, end: s.x };
}

test("critically damped spring never overshoots", () => {
  const r = stepResponse(1);
  assert.ok(r.peak <= 1 + 1e-9, `peak ${r.peak}`);
  assert.ok(Math.abs(r.end - 1) < 1e-6);
});

test("zeta for 3% overshoots by 3%", () => {
  const z = zetaForOvershoot(0.03);
  assert.ok(Math.abs(z - 0.745) < 0.002, `zeta ${z}`);
  const r = stepResponse(z);
  assert.ok(Math.abs(r.peak - 1.03) < 0.002, `peak ${r.peak}`);
});

test("spring is frame-rate independent", () => {
  const a = { x: 0, v: 0 };
  const b = { x: 0, v: 0 };
  for (let i = 0; i < 30; i++) stepSpring(a, 1, 6, 0.8, 1 / 30);
  for (let i = 0; i < 120; i++) stepSpring(b, 1, 6, 0.8, 1 / 120);
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.v - b.v) < 1e-9);
});
