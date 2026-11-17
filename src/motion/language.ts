/**
 * The motion language. Every entrance, reveal and mode change on the site
 * takes its easing and timing from here, so the whole page moves with one
 * voice. Premium, decelerating, no bounce:
 *
 *   ENTRANCE     expo.out, 0.8 s          things arriving on the page
 *   REVEAL       ENTRANCE + 0.06 s stagger   groups arriving together
 *   MODE CHANGE  power2.inOut             WAKE <-> DREAM: the 1.1 s flood,
 *                                          then the 0.6 s page-colour turn
 *                                          (data-mode flips at its midpoint)
 *
 * The same curves exist in three forms, which must agree:
 *   EASE    GSAP ease names, for gsap tweens
 *   BEZIER  cubic-bezier control points; globals.css mirrors them as
 *           --ease-out-expo and --ease-in-out-cubic (and the durations as
 *           --dur-*), and src/motion/motion.test.ts fails if they drift
 *   ease    exact JS functions (GSAP's own definitions), for code that
 *           eases by hand each frame (the flood, the crystal)
 *
 * GSAP naming, for the record: power1 = quad, power2 = cubic, power3 =
 * quart. The flood used to say power2.inOut and run a quad.
 *
 * Not in the language (the audit list is in the commit that added this):
 * hover / press / cursor feedback, scroll-scrubbed motion (ease "none"
 * by definition), ambient loops (linear), the preloader intro and the
 * Archive's game feedback.
 */
/** GSAP ease names. */
export const EASE = {
  entrance: "expo.out",
  modeChange: "power2.inOut",
} as const;

/** The same curves as CSS cubic-bezier() control points. */
export const BEZIER = {
  /** expo.out, as CSS approximates it. */
  entrance: [0.16, 1, 0.3, 1] as const,
  /** power2.inOut: easeInOutCubic. */
  modeChange: [0.65, 0, 0.35, 1] as const,
};

/** Durations, in seconds. */
export const DURATION = {
  entrance: 0.8,
  /** The WAKE <-> DREAM flood, start to finish. */
  modeChange: 1.1,
  /** Page colours turning over once data-mode flips (the flood's second half). */
  modeColor: 0.6,
} as const;

export const STAGGER = {
  reveal: 0.06,
} as const;

/** gsap vars for an entrance: spread into a tween. */
export const ENTRANCE = { duration: DURATION.entrance, ease: EASE.entrance } as const;
/** gsap vars for a staggered group entrance. */
export const REVEAL = { ...ENTRANCE, stagger: STAGGER.reveal } as const;

/** Exact JS forms of the GSAP eases, for frame-driven code. */
export const ease = {
  /** GSAP expo.out. */
  entrance: (t: number) => (t >= 1 ? 1 : t <= 0 ? 0 : 1 - Math.pow(2, -10 * t)),
  /** GSAP power2.inOut (cubic). */
  modeChange: (t: number) =>
    t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};
