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
