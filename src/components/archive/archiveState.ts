/**
 * Live Archive state shared by the scene, the seals and the HUD. A plain
 * mutable object (read every frame, never drives React renders); pure
 * rules live in game.ts.
 */
import { SEAL, SEALS } from "./layout";
import { CHARGE_FULL, HITS_TO_FREE, WALL, type V3 } from "./game";
import { archiveProjects } from "@/content/projects";

export { CHARGE_FULL, HITS_TO_FREE };

export interface SealState {
  /** Facet hits so far (HITS_TO_FREE frees the project). */
  hits: number;
  freed: boolean;
  /** Which facet is lit (the target); moves after every hit. */
  litFacet: number;
  /** Impact directions in body space, one per facet hit (crack origins). */
  cracks: V3[];
  /** Game time it was freed (-1 never; -Infinity freed on an earlier visit). */
  freedAt: number;
  /** The visitor floated into its panel this visit. */
  touched: boolean;
}

export interface ArchiveState {
  seals: SealState[];
  /** Motes collected toward the next pulse, 0..CHARGE_FULL. */
  charge: number;
  /** Seconds of camera shake left (facet hits; never under reduced motion). */
  shake: number;
  /** Game clock (s), advanced by Play. */
  t: number;
  /** All three freed: when the ending began and where the crystal forms. */
  ending: { t0: number; point: V3 } | null;
  /** True when every seal was already freed on arrival (no second ending). */
  completedBefore: boolean;
}

/** Project slug held by seal i. */
export function sealSlug(i: number): string {
  return archiveProjects[SEALS[i].project]?.slug ?? String(i);
}

/** freed: slugs freed on earlier visits (they arrive already open). */
export function createArchiveState(freed: string[] = []): ArchiveState {
  const seals = SEALS.map((_, i) => {
    const was = freed.includes(sealSlug(i));
    return {
      hits: was ? HITS_TO_FREE : 0,
      freed: was,
      // A fight lights an equatorial facet: it has to look out through the window
      litFacet: SEAL.fight.includes(i) ? WALL.facets[0] : SEAL.litFacet[i % SEAL.litFacet.length],
      cracks: [],
      freedAt: was ? -Infinity : -1,
      touched: false,
    };
  });
  return { seals, charge: 0, shake: 0, t: 0, ending: null, completedBefore: seals.every((s) => s.freed) };
}

/** 0 (untouched) .. 1 (freed): how close a seal is to giving up its project. */
export function sealProgress(s: SealState): number {
  return s.freed ? 1 : s.hits / HITS_TO_FREE;
}

/** HUD nodes the scene writes to each frame (no React renders). */
export interface HudEls {
  /** Compass arc group: rotated toward the nearest unfreed seal. */
  compass: SVGGElement | null;
  /** Outer ring that lights when the pulse is ready. */
  ready: SVGCircleElement | null;
  /** Reticle group (nudged when you fire without charge). */
  reticle: SVGSVGElement | null;
  /** "n" in PROJECTS RECOVERED n / 3. */
  count: HTMLElement | null;
  /** Bottom-left mote diamonds, one per mote of charge. */
  diamonds: (SVGPathElement | null)[];
  /** "PULSE READY" beside the diamonds. */
  readyLabel: HTMLElement | null;
  /** The bottom-left charge group (nudged on a dry fire). */
  motes: HTMLElement | null;
  /** "The archive is yours." (data-on="1" shows it). */
  endLine: HTMLElement | null;
  /** The ending has already asked to wake. */
  exited: boolean;
  /** Edge vignette (fades as the fog lifts). */
  vignette: HTMLElement | null;
}

export function createHudEls(): HudEls {
  return {
    compass: null, ready: null, reticle: null,
    count: null, diamonds: [null, null, null], readyLabel: null, motes: null, endLine: null, exited: false, vignette: null,
  };
}
