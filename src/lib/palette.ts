/**
 * Theme colours for the WebGL scenes, which cannot read CSS custom
 * properties for the mode they are not in (both scenes render during the
 * flood). The WAKE values mirror globals.css (--t-ink, --t-surface under
 * html[data-mode="wake"]); src/lib/palette.test.ts fails if they drift.
 *
 *   wake.ink     the site's ink: the marquee, the orbit ring
 *   dream.label  the pale lavender of DREAM's WebGL type: the marquee, the
 *                ghosted titles, the orbit ring
 */
export const PALETTE = {
  wake: { paper: "#E9E7E2", ink: "#1a1a1e" },
  dream: { paper: "#07062B", label: "#a8b4ff" },
} as const;

/** The colour WebGL labels take in each mode. */
export const SCENE_LABEL = {
  wake: PALETTE.wake.ink,
  dream: PALETTE.dream.label,
} as const;
