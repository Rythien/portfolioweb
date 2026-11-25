/**
 * THE VOID's palette (DREAM's), and which colour plays which role. No
 * imports, no DOM: render.ts draws with it and
 * scripts/verify/void-contrast.mjs checks it.
 *
 * Value order, darkest to brightest: void < floor < enemies < ice accents
 * < the gem. Pure white belongs to the gem alone (the spec'd one-frame
 * enemy hit flash and the gem's own shatter are the only other whites).
 */
export const COLOR = {
  void0: "#07062B",
  void1: "#1a1050",
  floorA: "#1a1050",
  floorB: "#241764",
  deep: "#2c1d80",
  energy0: "#4b32b8",
  energy1: "#8f7bff",
  ice0: "#cfe3ea",
  ice1: "#e4dcff",
  white: "#ffffff",
  danger: "#ff5c7a",
  dangerHot: "#ffe0e6",
} as const;

/** Every colour a tile can show (floor dither, specks, cracks, rims, cliffs, the void). */
export const TILE_COLORS = {
  "void": COLOR.void0,
  "floor A": COLOR.floorA,
  "floor B": COLOR.floorB,
  "floor speck / crack": COLOR.energy0,
  "north rim (lit ice)": COLOR.ice1,
  "side rim": COLOR.energy1,
  "cliff lip / icicle": COLOR.ice0,
  "cliff strata": COLOR.energy0,
  "cliff deep": COLOR.deep,
} as const;

/** Every colour a drifter shows (its flash excepted: one frame, by design). */
export const ENEMY_COLORS = {
  "drifter body": COLOR.energy1,
  "drifter shade": COLOR.energy0,
  "drifter outline": COLOR.void0,
  "drifter eye": COLOR.danger,
  "drifter eye core": COLOR.dangerHot,
} as const;

/** The gem: its fill (darkest facet first) and its 1px outline. */
export const GEM_COLORS = {
  fill: [COLOR.ice0, COLOR.ice1, COLOR.white] as const,
  outline: COLOR.void0,
} as const;
