/**
 * Live Archive state shared by the scene, the seals and the HUD. A plain
 * mutable object (read every frame, never drives React renders); pure
 * rules live in game.ts.
 */
import { SEAL, SEALS } from "./layout";
import { CHARGE_FULL, HITS_TO_FREE, type V3 } from "./game";

export { CHARGE_FULL, HITS_TO_FREE };

export interface SealState {
  /** Facet hits so far (HITS_TO_FREE frees the project). */
  hits: number;
  freed: boolean;
  /** Which facet is lit (the target); moves after every hit. */
  litFacet: number;
  /** Impact directions in body space, one per facet hit (crack origins). */
  cracks: V3[];
}

export interface ArchiveState {
  seals: SealState[];
  /** Motes collected toward the next pulse, 0..CHARGE_FULL. */
  charge: number;
  /** Seconds of camera shake left (facet hits; never under reduced motion). */
  shake: number;
}

export function createArchiveState(): ArchiveState {
  return {
    seals: SEALS.map((_, i) => ({ hits: 0, freed: false, litFacet: SEAL.litFacet[i % SEAL.litFacet.length], cracks: [] })),
    charge: 0,
    shake: 0,
  };
}

/** 0 (untouched) .. 1 (freed): how close a seal is to giving up its project. */
export function sealProgress(s: SealState): number {
  return s.freed ? 1 : s.hits / HITS_TO_FREE;
}

/** HUD nodes the scene writes to each frame (no React renders). */
export interface HudEls {
  /** Compass arc group: rotated toward the nearest unfreed seal. */
  compass: SVGGElement | null;
  /** Reticle charge segments, one per mote of charge. */
  charge: (SVGPathElement | null)[];
  /** Outer ring that lights when the pulse is ready. */
  ready: SVGCircleElement | null;
  /** Reticle group (nudged when you fire without charge). */
  reticle: SVGSVGElement | null;
}

export function createHudEls(): HudEls {
  return { compass: null, charge: [null, null, null], ready: null, reticle: null };
}
