import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gsap } from "gsap";
import { cubicBezier } from "../motion/bezier.ts";
import { stepSpring, zetaForOvershoot } from "../motion/spring.ts";
import {
  BEZIER,
  DURATION,
  EASE,
  FEEDBACK,
  HOLD,
  HOVER,
  LOOP,
  MAGNET,
  MODE,
  OVERSHOOT,
  REDUCED,
  STAGGER,
  ease,
  magnetOffset,
  magnetRelease,
  magnetTo,
} from "./motion.ts";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const css = readFileSync(join(SRC, "app/globals.css"), "utf8");
const prop = (name: string) => css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
const ms = (s: number) => `${Math.round(s * 1000)}ms`;

/* ── The scale ──────────────────────────────────────────────────── */

test("the scales are the agreed ones", () => {
  assert.deepEqual({ ...DURATION }, { quick: 0.4, standard: 0.8, grand: 1.2 });
  assert.deepEqual({ ...STAGGER }, { tight: 0.04, standard: 0.08 });
  assert.equal(MODE.flood, DURATION.grand);
  assert.equal(MODE.color, DURATION.grand / 2);
});

test("every hover leave runs at 60% of its enter; the copy confirmation holds 1.6 s", () => {
  assert.equal(HOVER.enter, DURATION.quick);
  assert.ok(Math.abs(HOVER.leave - HOVER.enter * 0.6) < 1e-9);
  assert.equal(HOLD.confirm, 1.6);
});

test("globals.css mirrors the motion tokens", () => {
  const bez = (b: readonly number[]) => `cubic-bezier(${b.join(", ")})`;
  assert.equal(prop("--ease-entrance"), bez(BEZIER.entrance));
  assert.equal(prop("--ease-state"), bez(BEZIER.state));
  assert.equal(prop("--ease-scroll"), bez(BEZIER.scroll));
  assert.equal(prop("--ease-linear"), "linear");
  assert.equal(prop("--dur-quick"), ms(DURATION.quick));
  assert.equal(prop("--dur-standard"), ms(DURATION.standard));
  assert.equal(prop("--dur-grand"), ms(DURATION.grand));
  assert.equal(prop("--dur-mode-color"), ms(MODE.color));
  assert.equal(prop("--dur-pointer"), ms(FEEDBACK.pointer));
  assert.equal(prop("--dur-press"), ms(FEEDBACK.press));
  assert.equal(prop("--dur-response"), ms(FEEDBACK.response));
  assert.equal(prop("--dur-reduced"), ms(REDUCED));
  assert.equal(prop("--dur-hover-in"), ms(HOVER.enter));
  assert.equal(prop("--dur-hover-out"), ms(HOVER.leave));
  // Bare Tailwind transitions rest on the leave timing
  assert.equal(prop("--default-transition-duration"), "var(--dur-hover-out)");
  assert.equal(prop("--loop-chip"), `${LOOP.chip}s`);
  assert.equal(prop("--loop-sound"), ms(LOOP.sound));
  // Retired names are gone
  for (const old of ["--ease-out-expo", "--ease-in-out-cubic", "--dur-entrance"]) {
    assert.ok(!css.includes(old), `${old} still in globals.css`);
  }
});

/* ── The curves ─────────────────────────────────────────────────── */

const worst = (a: (t: number) => number, b: (t: number) => number) => {
  let w = 0;
  for (let i = 0; i <= 100; i++) w = Math.max(w, Math.abs(a(i / 100) - b(i / 100)));
  return w;
};

test("the CSS beziers approximate the GSAP eases they stand for", () => {
  // expo.out has no exact cubic-bezier; this is the standard approximation
  assert.ok(worst(cubicBezier(...BEZIER.entrance), ease.entrance) < 0.08);
  assert.ok(worst(cubicBezier(...BEZIER.state), ease.state) < 0.03);
  // The scroll curve IS the bezier
  assert.ok(worst(cubicBezier(...BEZIER.scroll), ease.scroll) < 1e-9);
});

test("each ease is registered with GSAP and resolves to the same function", () => {
  const close = (name: string, fn: (t: number) => number) =>
    assert.ok(worst(gsap.parseEase(name) as (t: number) => number, fn) < 1e-9, name);
  close(EASE.entrance, ease.entrance);
  close(EASE.state, ease.state);
  close(EASE.scroll, ease.scroll);
  close(EASE.spring, ease.backOut(OVERSHOOT.magnet));
  // The registered curves match GSAP's own built-ins exactly
  close("expo.out", ease.entrance);
  close("power2.inOut", ease.state);
});

test("only back.out (the Archive and the magnetic release) overshoots", () => {
  for (const fn of [ease.entrance, ease.state, ease.scroll, ease.linear, ease.smooth]) {
    for (let i = 0; i <= 100; i++) assert.ok(fn(i / 100) <= 1 + 1e-9);
  }
  assert.ok(Math.max(...Array.from({ length: 101 }, (_, i) => ease.backOut(1.4)(i / 100))) > 1);
});

test("the magnetic field: 80 px reach, 8 px cap, springy return", () => {
  const len = (o: { x: number; y: number }) => Math.hypot(o.x, o.y);
  // On the element: a share of the offset, capped at MAGNET.max
  assert.ok(Math.abs(len(magnetOffset(1000, -1000, 0)) - MAGNET.max) < 1e-9);
  assert.ok(Math.abs(magnetOffset(10, 0, 0).x - 10 * MAGNET.strength) < 1e-9);
  // Halfway out of the field: half the pull; at the radius and beyond: none
  const half = magnetOffset(1000, 0, MAGNET.radius / 2);
  assert.ok(Math.abs(half.x - MAGNET.max / 2) < 1e-9);
  assert.equal(len(magnetOffset(1000, 0, MAGNET.radius)), 0);
  assert.equal(len(magnetOffset(1000, 0, MAGNET.radius * 2)), 0);
  assert.equal(MAGNET.radius, 80);
  assert.equal(MAGNET.max, 8);

  const el = { x: 0, y: 0 } as unknown as Element;
  const pull = magnetTo(el, 10, 0)!;
  assert.equal(pull.vars.duration, HOVER.enter);
  const back = magnetRelease(el)!;
  assert.equal(back.vars.x, 0);
  assert.equal(back.vars.duration, HOVER.leave);
  assert.equal(back.vars.ease, EASE.spring);
  gsap.killTweensOf(el);
});

/* ── Nothing else hard-codes a duration or an ease ──────────────── */

/**
 * Files that are allowed to hold literal timing, and why. Everything else
 * under src/ must take its timing from src/lib/motion.ts.
 */
const EXEMPT: Record<string, string> = {
  "lib/motion.ts": "the source of truth",
  // Game simulation: the Archive's seconds are game rules, covered by
  // game.test.ts and flight.test.ts, not page choreography
  "components/archive/game.ts": "game rules",
  "components/archive/flight.ts": "game rules",
};

const RULES: [RegExp, string][] = [
  [/\b(duration|delay|repeatDelay|scrub)\s*:\s*-?\d/, "literal duration / delay / scrub"],
  [/\bstagger\s*:\s*\d/, "literal stagger"],
  [/\b(ease|easing)\s*:\s*["'`]/, "literal ease string"],
  [/["'`](power[1-4]|expo|sine|circ|back|elastic|bounce|quad|cubic|quart|quint)\.(in|out|inOut)\b/, "GSAP ease name"],
  [/cubic-bezier\(\s*\d/, "literal cubic-bezier"],
  [/(^|[\s"'`])(duration|delay)-(\d|\[)/, "Tailwind duration / delay utility"],
  [/(^|[\s"'`])ease-(in|out|in-out|linear)(?![\w-])/, "Tailwind ease utility"],
  [/["'`][^"'`]*\b\d+(\.\d+)?m?s\s+(ease|linear|cubic|var|steps)/, "inline transition timing"],
  [/(transition|animation)[^;\n]*(?<![\w-])\d*\.?\d+m?s\b/, "inline transition timing"],
];

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) yield p;
  }
}

test("no file outside lib/motion.ts hard-codes a duration or an ease", () => {
  const hits: string[] = [];
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file).replace(/\\/g, "/");
    if (EXEMPT[rel]) continue;
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, "");
        if (/^\s*(\*|\/\*)/.test(code)) return;
        for (const [re, why] of RULES) {
          if (re.test(code)) hits.push(`${rel}:${i + 1}  ${why}\n    ${line.trim()}`);
        }
      });
  }
  assert.equal(hits.length, 0, `\n${hits.join("\n")}`);
});

test("globals.css transitions and animations use tokens only", () => {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const bad: string[] = [];
  for (const m of body.matchAll(/(?:^|[;{\s])((?:transition|animation)[\w-]*)\s*:\s*([^;]+);/g)) {
    const value = m[2].replace(/var\([^)]*\)/g, "");
    if (/(?<![\w-])\d*\.?\d+m?s\b/.test(value) || /(?<![\w-])(ease|ease-in|ease-out|ease-in-out|linear|cubic-bezier)(?![\w-])/.test(value)) {
      bad.push(`${m[1]}: ${m[2].trim()}`);
    }
  }
  assert.deepEqual(bad, []);
});

/* ── Helpers the tokens rely on ─────────────────────────────────── */

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
