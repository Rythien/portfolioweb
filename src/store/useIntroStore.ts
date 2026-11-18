import { create } from "zustand";

/** Set once the preloader has handed the page over (or was skipped). */
export const useIntroStore = create<{ done: boolean }>(() => ({ done: false }));

export function markIntroDone() {
  if (!useIntroStore.getState().done) useIntroStore.setState({ done: true });
}

/**
 * Hero entrance values the WebGL scene reads every frame (mutated by the
 * hero timeline, not React state). marquee: 0 hidden below its mask, 1 in.
 */
export const introReveal = { marquee: 0 };
