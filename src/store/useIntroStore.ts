import { create } from "zustand";

/** Set once the preloader has handed the page over (or was skipped). */
export const useIntroStore = create<{ done: boolean }>(() => ({ done: false }));

export function markIntroDone() {
  if (useIntroStore.getState().done) return;
  // Test hook (scripts/perf/arrival.mjs): when the hero was handed over
  (window as unknown as { __introDoneAt?: number }).__introDoneAt = performance.now();
  useIntroStore.setState({ done: true });
}

/**
 * Hero entrance values the WebGL scene reads every frame (mutated by the
 * hero timeline, not React state). marquee: 0 held back, 1 go (the marquee
 * fades itself in from there).
 */
export const introReveal = { marquee: 0 };
