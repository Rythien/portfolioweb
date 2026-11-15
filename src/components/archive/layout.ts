/**
 * Where things sit in the Archive. One unit is roughly one metre of
 * perceived space; the playable void is a sphere of FLIGHT.softRadius.
 * You start at +Z facing -Z, with the first seal ahead and the other two
 * off either shoulder, so every seal is findable by turning, never hidden.
 */

export const VOID = {
  /** Background and fog colour: the deep violet the flood lands on. */
  fog: "#1d0f45",
  fogDensity: 0.026,
  /** Sky sphere radius; it rides with the camera. */
  skyRadius: 300,
};

export interface SealSpot {
  /** Index into PROJECTS. */
  project: number;
  pos: [number, number, number];
}

export const SEALS: SealSpot[] = [
  { project: 0, pos: [2, 3, -24] },
  { project: 1, pos: [-31, -5, 4] },
  { project: 2, pos: [29, 7, 9] },
];

/** Seal tuning (Seal.tsx). */
export const SEAL = {
  /** Body radius before the vertical stretch (x1.22). */
  radius: 3.2,
  /** Shards in orbit per seal, over three tilted rings. */
  orbiters: 15,
  /** Which facet is lit (the pulse target), per seal. */
  litFacet: [0, 5, 9],
};

/** Test hook (archiveat=<i>): a spot this far in front of seal i, facing it. */
export const VIEW_DISTANCE = 15;
