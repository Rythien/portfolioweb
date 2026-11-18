/**
 * The motion source of truth. Every duration, ease, stagger and travel
 * distance on the site comes from here; nothing else may hard-code one
 * (src/lib/motion.test.ts scans the tree and fails if something does).
 *
 *   EASE      entrance   expo.out                   things arriving
 *             state      power2.inOut               WAKE <-> DREAM, overlays, any A -> B
 *             scroll     cubic-bezier(.16,1,.3,1)   scroll-linked progress (crystal path)
 *             linear     none                       scrubbed progress lines, loops
 *   DURATION  quick 0.4 · standard 0.8 · grand 1.2
 *   STAGGER   tight 0.04 · standard 0.08
 *
 * Input feedback (press, pointer follow, hover colour) is not choreography
 * and runs on its own short FEEDBACK tier; ambient loops have periods in
 * LOOP. Both live here so they are still never hard-coded.
 *
 * The same values exist in three forms, which must agree:
 *   EASE / DURATION   GSAP names and seconds, for tweens and the factories
 *   BEZIER + CSS      globals.css mirrors them as --ease-* / --dur-* / --loop-*
 *                     (the test fails if they drift)
 *   ease              exact JS functions, for code that eases by hand each
 *                     frame (the flood, the crystal, Lenis, the Archive)
 *
 * Choreography (motion-design): one entrance pattern (rise + fade, from
 * below), lead with the largest element, total stagger under 0.5 s,
 * entrances decelerate, state changes ease both ends. Every hover has a
 * leave at 60% of its enter (HOVER). No bounce, no elastic, with three
 * documented exceptions: the Archive's game feedback (ease.backOut), the
 * magnetic release (EASE.spring) and the crystal's 3% spring settle
 * (src/hooks/crystalState.ts).
 */
import { gsap } from "gsap";
import type { ScrollTrigger } from "gsap/ScrollTrigger";
import { cubicBezier } from "../motion/bezier.ts";

/* ── Curves ─────────────────────────────────────────────────────── */

/** Cubic-bezier control points (CSS mirrors these). */
export const BEZIER = {
  /** expo.out has no exact bezier; this is the standard approximation. */
  entrance: [0.16, 1, 0.3, 1] as const,
  /** power2.inOut is easeInOutCubic. */
  state: [0.65, 0, 0.35, 1] as const,
  /** Scroll-linked progress: the custom curve itself, not an approximation. */
  scroll: [0.16, 1, 0.3, 1] as const,
};

/** The same curves as CSS timing-function strings (for WAAPI and inline styles). */
export const CSS_EASE = {
  entrance: `cubic-bezier(${BEZIER.entrance.join(", ")})`,
  state: `cubic-bezier(${BEZIER.state.join(", ")})`,
  scroll: `cubic-bezier(${BEZIER.scroll.join(", ")})`,
} as const;

/**
 * Exact JS eases, for frame-driven code. entrance and state are GSAP's own
 * functions (its expo.out is not quite the textbook 1 - 2^-10t), so a frame-
 * driven move and a tween on the same curve land identically.
 */
export const ease = {
  entrance: gsap.parseEase("expo.out") as (t: number) => number,
  state: gsap.parseEase("power2.inOut") as (t: number) => number,
  scroll: cubicBezier(...BEZIER.scroll),
  linear: (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t),
  /** Hermite smoothstep: the Archive ending's converge. */
  smooth: (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)),
  /**
   * back.out with overshoot c. Archive game feedback only (a seal or the
   * reassembled crystal "landing"); the rest of the site never overshoots.
   */
  backOut: (c: number) => (t: number) => {
    const u = Math.min(1, Math.max(0, t)) - 1;
    return 1 + (c + 1) * u * u * u + c * u * u;
  },
};

/** Overshoot amounts for ease.backOut. */
export const OVERSHOOT = {
  /** Archive game feedback. */
  seal: 1.4,
  reassemble: 1.5,
  /** Magnetic release: the springy return, one visible overshoot. */
  magnet: 2.5,
} as const;

/** Registered GSAP ease names. Use these, never a literal ease string. */
export const EASE = {
  entrance: "motion.entrance",
  state: "motion.state",
  scroll: "motion.scroll",
  /** Magnetic release only: the one springy curve outside the Archive. */
  spring: "motion.spring",
  linear: "none",
} as const;

gsap.registerEase(EASE.entrance, ease.entrance);
gsap.registerEase(EASE.state, ease.state);
gsap.registerEase(EASE.scroll, ease.scroll);
gsap.registerEase(EASE.spring, ease.backOut(OVERSHOOT.magnet));

/* ── Time ───────────────────────────────────────────────────────── */

/** The duration scale, in seconds. */
export const DURATION = {
  /** Small things moving a short way: labels, hovers that transform, release. */
  quick: 0.4,
  /** Entrances. */
  standard: 0.8,
  /** Whole-page or theatrical moves: the flood, image masks, the intro. */
  grand: 1.2,
} as const;

/** The WAKE <-> DREAM change. data-mode flips at the flood's midpoint. */
export const MODE = {
  flood: DURATION.grand,
  /** Page colours turning over: the flood's second half. */
  color: DURATION.grand / 2,
} as const;

/** Input feedback, in seconds. Faster than choreography on purpose. */
export const FEEDBACK = {
  /** Things glued to the pointer (cursor dot, kinetic weight). */
  pointer: 0.08,
  /** Press-down scale. */
  press: 0.12,
  /** Hover colour, HUD flashes, a dry-fire shake. */
  response: 0.24,
} as const;

/**
 * Hover: every hover has a leave, and the leave runs at LEAVE_RATIO of the
 * enter. CSS mirrors these as --dur-hover-in / --dur-hover-out.
 */
const LEAVE_RATIO = 0.6;
export const HOVER = {
  enter: DURATION.quick,
  leave: DURATION.quick * LEAVE_RATIO,
  ratio: LEAVE_RATIO,
} as const;

/** How long a confirmation ("Copied") stays before it reverts. */
export const HOLD = {
  confirm: 1.6,
} as const;

/** Ambient loop periods, in seconds. */
export const LOOP = {
  chip: 26,
  ticker: 42,
  sound: 0.9,
} as const;

/** The reduced-motion kill switch for CSS (effectively instant). */
export const REDUCED = 0.01;

/** Seconds between siblings. Keep a group's total under 0.5 s. */
export const STAGGER = {
  /** Lines and rows. */
  tight: 0.04,
  /** Blocks. */
  standard: 0.08,
} as const;

/* ── Space ──────────────────────────────────────────────────────── */

/** Entrance travel, px (docs/direction.md: 24 to 40). */
export const DISTANCE = {
  line: 24,
  block: 40,
} as const;

/**
 * Magnetic field: an element starts to lean toward the pointer once the
 * pointer is within `radius` px of its edge, by a share (`strength`) of
 * the pointer's offset from its centre, never more than `max` px, and
 * fully only when the pointer is on it.
 */
export const MAGNET = {
  radius: 80,
  strength: 0.32,
  max: 8,
} as const;

/** Hover tilt, degrees. */
export const TILT = {
  max: 6,
} as const;

/** Offsets inside a choreographed moment, seconds. */
export const OFFSET = {
  /** Contact: the italic word arrives after its statement. */
  accent: 0.15,
} as const;

/** Scale states, unitless. */
export const SCALE = {
  /** Works: a panel away from centre. */
  slideAway: 0.94,
  /** Contact: the statement before it arrives. */
  statementFrom: 0.92,
  /** A pressed control (CSS .pressable mirrors it as scale: 0.97). */
  press: 0.97,
} as const;

/**
 * Scroll-velocity couplings. Velocity is px/s from src/lib/scroll.ts; each
 * consumer eases toward its target on QUICK, so all of them settle back
 * when scrolling stops.
 */
export const VELOCITY = {
  /** Section skew: degrees per px/s, clamped to skewMax. */
  skewPerPx: 0.0005,
  skewMax: 1.5,
  /** Footer ticker: extra timeScale per px/s on top of 1 (never below 1). */
  tickerPerPx: 1 / 1200,
  tickerMax: 4,
  /** Works chip: degrees of rotation per px scrolled. */
  chipDegPerPx: 0.05,
} as const;

/**
 * Default ScrollTrigger for entrances. A reveal plays once and stays: it
 * never reverses on the way back up. clamp() keeps the start reachable for
 * content near the bottom of the page, and fastScrollEnd completes it at
 * once when the reader scrolls past fast, so nothing is left mid-way.
 */
export const TRIGGER = {
  start: "clamp(top 75%)",
  toggleActions: "play none none none",
  fastScrollEnd: true,
} as const;

/* ── Presets ────────────────────────────────────────────────────── */

/** gsap vars for a single entrance. */
export const ENTRANCE = { duration: DURATION.standard, ease: EASE.entrance } as const;
/** gsap vars for a quick, decelerating move (hover transforms, release). */
export const QUICK = { duration: DURATION.quick, ease: EASE.entrance } as const;
/** gsap vars for an A -> B state change. */
export const STATE = { duration: DURATION.grand, ease: EASE.state } as const;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ── Timeline factories ─────────────────────────────────────────── */

type Targets = gsap.TweenTarget;

export interface RevealOptions {
  /** Shorthand: scroll-trigger on this element with TRIGGER defaults. */
  trigger?: Element | null;
  /** Merged over TRIGGER (or used alone without `trigger`). */
  scrollTrigger?: ScrollTrigger.Vars;
  /** A token, e.g. DURATION.quick. */
  delay?: number;
  stagger?: gsap.TweenVars["stagger"];
  paused?: boolean;
}

/** Jump a reveal to its end when its start is already behind the reader. */
function finishIfPassed(st: ScrollTrigger) {
  const a = st.animation;
  if (a && st.scroll() >= st.start && a.progress() < 1) a.progress(1);
}

/**
 * Every reveal's targets carry [data-reveal] (scripts/verify/reveals.mjs
 * checks that they all finish visible), and every reveal has a terminal
 * guarantee (also for hand-built reveals: call settleReveal on their
 * timeline): if its trigger is already behind the reader when it is set
 * up, or when the layout is re-measured, it jumps to its end state instead
 * of waiting for an entry that will never come.
 */
export function settleReveal(tl: gsap.core.Timeline) {
  // After the caller has added its tweens (same task)
  queueMicrotask(() => {
    if (typeof Element !== "undefined") {
      for (const child of tl.getChildren(true, true, false)) {
        for (const t of (child as gsap.core.Tween).targets()) {
          if (t instanceof Element) t.setAttribute("data-reveal", "");
        }
      }
    }
    if (tl.scrollTrigger) finishIfPassed(tl.scrollTrigger);
  });
  // Done is done: once a reveal has finished, its trigger goes (leaving
  // the element where it ended), so no later re-measure or scroll back
  // can put it back to its starting state
  tl.eventCallback("onComplete", () => {
    tl.scrollTrigger?.kill(false);
  });
}

function timelineFor(opts: RevealOptions): gsap.core.Timeline {
  const st =
    opts.trigger || opts.scrollTrigger
      ? {
          ...TRIGGER,
          // Re-measured (fonts, preloader, resize): finish if now passed
          onRefresh: finishIfPassed,
          ...(opts.trigger ? { trigger: opts.trigger } : {}),
          ...opts.scrollTrigger,
        }
      : undefined;
  const tl = gsap.timeline({ scrollTrigger: st, delay: opts.delay, paused: opts.paused });
  settleReveal(tl);
  return tl;
}

function rise(
  targets: Targets,
  distance: number,
  stagger: gsap.TweenVars["stagger"],
  opts: RevealOptions
): gsap.core.Timeline {
  const tl = timelineFor(opts);
  // Reduced motion: the entrance becomes a plain fade
  const reduced = prefersReducedMotion();
  tl.fromTo(
    targets,
    { autoAlpha: 0, y: reduced ? 0 : distance },
    {
      autoAlpha: 1,
      y: 0,
      duration: reduced ? DURATION.quick : DURATION.standard,
      ease: EASE.entrance,
      stagger: opts.stagger ?? stagger,
    }
  );
  return tl;
}

/** Lines, rows, characters: a short rise on a tight stagger. */
export function revealLines(targets: Targets, opts: RevealOptions = {}) {
  return rise(targets, DISTANCE.line, STAGGER.tight, opts);
}

/** Blocks and panels: a longer rise on the standard stagger. */
export function revealBlock(targets: Targets, opts: RevealOptions = {}) {
  return rise(targets, DISTANCE.block, STAGGER.standard, opts);
}

/**
 * Lines wiped up from below their own mask: each target is the inner of an
 * overflow-hidden wrapper, and rises from 100% of its height to 0.
 */
export function maskLines(targets: Targets, opts: RevealOptions = {}) {
  const tl = timelineFor(opts);
  if (prefersReducedMotion()) {
    tl.fromTo(targets, { autoAlpha: 0 }, { autoAlpha: 1, duration: DURATION.quick, ease: EASE.entrance });
    return tl;
  }
  tl.fromTo(
    targets,
    { yPercent: 100 },
    { yPercent: 0, ...ENTRANCE, stagger: opts.stagger ?? STAGGER.standard }
  );
  return tl;
}

/**
 * Words wiped up from below their masks. The stagger is tight, shortened
 * for long statements so the whole sentence lands inside DURATION.quick.
 */
export function revealWords(words: Element[], opts: RevealOptions = {}) {
  const each = Math.min(STAGGER.tight, DURATION.quick / Math.max(1, words.length));
  return maskLines(words, { ...opts, stagger: opts.stagger ?? each });
}

/**
 * Uncovered left to right from their own left edge (a clip-path wipe), so
 * rows appear to come out of a rule on their left.
 */
export function wipeFromLeft(targets: Targets, opts: RevealOptions = {}) {
  const tl = timelineFor(opts);
  if (prefersReducedMotion()) {
    tl.fromTo(targets, { autoAlpha: 0 }, { autoAlpha: 1, duration: DURATION.quick, ease: EASE.entrance });
    return tl;
  }
  tl.fromTo(
    targets,
    { clipPath: "inset(0% 100% 0% 0%)" },
    { clipPath: "inset(0% 0% 0% 0%)", ...ENTRANCE, stagger: opts.stagger ?? STAGGER.tight }
  );
  return tl;
}

/** Hairlines drawn left to right (scaleX from the left edge). */
export function drawRules(targets: Targets, opts: RevealOptions = {}) {
  const tl = timelineFor(opts);
  if (prefersReducedMotion()) {
    tl.set(targets, { scaleX: 1 });
    return tl;
  }
  tl.fromTo(
    targets,
    { scaleX: 0, transformOrigin: "0% 50%" },
    { scaleX: 1, ...ENTRANCE, stagger: opts.stagger ?? STAGGER.tight }
  );
  return tl;
}

/**
 * An image uncovered top to bottom by a clip-path wipe. Put it on the
 * image's frame, not on anything with overhanging children.
 */
export function maskImage(targets: Targets, opts: RevealOptions = {}) {
  const tl = timelineFor(opts);
  if (prefersReducedMotion()) {
    tl.fromTo(targets, { autoAlpha: 0 }, { autoAlpha: 1, duration: DURATION.quick, ease: EASE.entrance });
    return tl;
  }
  tl.fromTo(
    targets,
    { clipPath: "inset(0% 0% 100% 0%)" },
    {
      clipPath: "inset(0% 0% 0% 0%)",
      duration: DURATION.grand,
      ease: EASE.entrance,
      stagger: opts.stagger ?? STAGGER.standard,
    }
  );
  return tl;
}

export interface CounterOptions extends RevealOptions {
  from?: number;
  /** Zero-pad to this many digits. */
  pad?: number;
  /** Defaults to standard. Pass a token. */
  duration?: number;
  ease?: string;
}

/**
 * Counts an element's text from `from` to `to`, writing the DOM directly
 * (no React state per frame). Reduced motion: shows the final value.
 */
export function counterTo(el: Element | null, to: number, opts: CounterOptions = {}) {
  const tl = timelineFor(opts);
  if (!el) return tl;
  const pad = opts.pad ?? 0;
  const write = (v: number) => {
    el.textContent = String(Math.round(v)).padStart(pad, "0");
  };
  if (prefersReducedMotion()) {
    tl.call(write, [to]);
    return tl;
  }
  const proxy = { v: opts.from ?? 0 };
  write(proxy.v);
  tl.to(proxy, {
    v: to,
    duration: opts.duration ?? DURATION.standard,
    ease: opts.ease ?? EASE.entrance,
    onUpdate: () => write(proxy.v),
  });
  return tl;
}

const clamp01 = gsap.utils.clamp(0, 1);

/**
 * The pull for a pointer `dx, dy` px from an element's centre and `edge`
 * px outside its box (0 when on it): MAGNET.strength of the offset, its
 * length capped at MAGNET.max, fading linearly to 0 at MAGNET.radius.
 */
export function magnetOffset(dx: number, dy: number, edge: number) {
  const falloff = clamp01(1 - edge / MAGNET.radius);
  const len = Math.hypot(dx, dy) * MAGNET.strength;
  if (len === 0 || falloff === 0) return { x: 0, y: 0 };
  const k = (Math.min(len, MAGNET.max) / len) * MAGNET.strength * falloff;
  return { x: dx * k, y: dy * k };
}

/** Pulls an element by magnetOffset, following on the hover-enter timing. */
export function magnetTo(el: Element | null, dx: number, dy: number, edge = 0) {
  if (!el) return null;
  const { x, y } = magnetOffset(dx, dy, edge);
  return gsap.to(el, {
    x,
    y,
    duration: HOVER.enter,
    ease: EASE.entrance,
    overwrite: "auto",
  });
}

/** Lets go: a springy return home at the hover-leave timing. */
export function magnetRelease(el: Element | null) {
  if (!el) return null;
  return gsap.to(el, {
    x: 0,
    y: 0,
    duration: HOVER.leave,
    ease: EASE.spring,
    overwrite: "auto",
  });
}
