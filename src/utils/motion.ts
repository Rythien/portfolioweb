/**
 * Global Motion and Easing Tokens
 * Consistent easing curves and durations for GSAP, CSS, and transitions.
 */

export const EASING = {
  // Primary fluid easing
  outExpo: "power4.out",
  inOutExpo: "power4.inOut",
  // Cinematic smooth curve
  smooth: "cubic-bezier(0.16, 1, 0.3, 1)",
  inOutCirc: "cubic-bezier(0.85, 0, 0.15, 1)",
  // Snappy for micro-interactions
  snappy: "power2.out",
} as const;

export const DURATIONS = {
  instant: 0.1,
  fast: 0.25,
  base: 0.45,
  slow: 0.8,
  pageTransition: 0.6,
} as const;
