/**
 * Live Archive state shared by the scene, the seals and the HUD. A plain
 * mutable object (read every frame, never drives React renders); pure
 * rules live in game.ts.
 */
import { SEAL, SEALS } from "./layout";

export interface SealState {
  /** Facet hits so far (HITS_TO_FREE frees the project). */
  hits: number;
  freed: boolean;
  /** Which facet is lit (the target); moves after every hit. */
  litFacet: number;
}

export const HITS_TO_FREE = 3;
export const CHARGE_FULL = 3;

export interface ArchiveState {
  seals: SealState[];
  /** Motes collected toward the next pulse, 0..CHARGE_FULL. */
  charge: number;
}

export function createArchiveState(): ArchiveState {
  return {
    seals: SEALS.map((_, i) => ({ hits: 0, freed: false, litFacet: SEAL.litFacet[i % SEAL.litFacet.length] })),
    charge: 0,
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
}

export function createHudEls(): HudEls {
  return { compass: null, charge: [null, null, null] };
}
