import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { useSyncExternalStore } from "react";
import { sliceIdle } from "@/components/scene/warm";
import {
  siNextdotjs,
  siReact,
  siThreedotjs,
  siTypescript,
  siTailwindcss,
  siGreensock,
  siBlender,
  siFigma,
  siNodedotjs,
  siGit,
} from "simple-icons";

/* ── Icons: the hero cycles through all of them; broken shards show the
   ones after the current hero logo, so a shard never repeats it ──── */

const ICONS = [
  siNextdotjs,
  siReact,
  siThreedotjs,
  siTypescript,
  siTailwindcss,
  siGreensock,
  siBlender,
  siFigma,
  siNodedotjs,
  siGit,
];

/**
 * Hero logo size as a fraction of the intact crystal's smallest bounding
 * box side; GlassCrystal computes the actual size from the mesh. "Size" is
 * the logo's bounding-box DIAGONAL, so a square mark and a wide wordmark
 * carry the same weight; filled area is then evened out across the set
 * (AREA_TOLERANCE). At 0.62 on the larger side, square marks filled the
 * crystal and it stopped reading as ice.
 */
export const HERO_LOGO_FILL = 0.34;
/** Each logo's filled area is brought within this of the set's median. */
export const AREA_TOLERANCE = 0.15;
export const HERO_LOGO_DEPTH = 0.26;

/** Shard logos are built at unit size and scaled to fit their shard; same
 * depth-to-size ratio as a hero logo of ~1.4. */
const UNIT_DEPTH = HERO_LOGO_DEPTH / 1.4;

/**
 * Bevel in SVG units (icons are 24 units wide). three grows the bevel
 * OUTWARD by this much on every contour, holes included, so it must stay
 * well under half the narrowest gap in a mark: at 1.4 (WAKE) and 0.8
 * (DREAM) the Next.js N's cut-outs closed up and folded through each
 * other, and the mark rendered as overlapping light edges (a wireframe)
 * instead of a solid. A small bevel softens the edge; the mark is solid.
 */
export const BEVEL = { wake: 0.3, dream: 0.3 } as const;
export type BevelKind = keyof typeof BEVEL;

/** Faces whose normal is within this of the extrusion plane are walls;
 * between walls and caps is bevel. */
const WALL_MAX_NZ = 0.2;
const CAP_MIN_NZ = 0.98;

/**
 * Re-group a (non-indexed) extrusion into 0 = caps, 1 = straight walls,
 * 2 = bevel, by each face's normal: ExtrudeGeometry puts walls and bevel
 * in one group, and the bevel needs its own material.
 */
function splitBevel(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const P = geo.getAttribute("position");
  const names = Object.keys(geo.attributes);
  const buckets: number[][] = [[], [], []];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < P.count; t += 3) {
    a.fromBufferAttribute(P, t);
    b.fromBufferAttribute(P, t + 1);
    c.fromBufferAttribute(P, t + 2);
    const n = b.sub(a).cross(c.sub(a));
    const len = n.length();
    const nz = len > 1e-12 ? Math.abs(n.z) / len : 0;
    buckets[nz >= CAP_MIN_NZ ? 0 : nz <= WALL_MAX_NZ ? 1 : 2].push(t);
  }
  const out = new THREE.BufferGeometry();
  const order = buckets.flat();
  for (const name of names) {
    const src = geo.getAttribute(name) as THREE.BufferAttribute;
    const k = src.itemSize;
    const arr = new (src.array.constructor as Float32ArrayConstructor)(src.array.length);
    order.forEach((t, i) => {
      for (let v = 0; v < 3; v++) for (let j = 0; j < k; j++) arr[(i * 3 + v) * k + j] = src.array[(t + v) * k + j];
    });
    out.setAttribute(name, new THREE.BufferAttribute(arr, k));
  }
  let start = 0;
  buckets.forEach((bk, g) => {
    out.addGroup(start, bk.length * 3, g);
    start += bk.length * 3;
  });
  return out;
}

interface LogoShape {
  /** Bounding-box diagonal (x/y) after fitting. */
  width: number;
  depth: number;
  bevel: number;
}

/* ── SVG path → ExtrudeGeometry ──────────────────────────────── */

/** Filled area of a set of shapes (outer contours minus holes), SVG units². */
function filledArea(shapes: THREE.Shape[]): number {
  let a = 0;
  for (const sh of shapes) {
    a += Math.abs(THREE.ShapeUtils.area(sh.getPoints(12)));
    for (const h of sh.holes) a -= Math.abs(THREE.ShapeUtils.area(h.getPoints(12)));
  }
  return Math.max(0, a);
}

/** Geometry fitted by diagonal, plus its filled area in final units². */
function pathToGeometry(pathData: string, shape: LogoShape): { geo: THREE.BufferGeometry; area: number } | null {
  try {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${pathData}"/></svg>`;
    const parsed = new SVGLoader().parse(svg);
    const shapes: THREE.Shape[] = [];
    for (const p of parsed.paths) shapes.push(...p.toShapes());
    if (!shapes.length) return null;

    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: 2,
      bevelEnabled: true,
      bevelThickness: shape.bevel,
      bevelSize: shape.bevel,
      bevelSegments: 3,
    });

    geo.computeBoundingBox();
    let bb = geo.boundingBox!;
    geo.translate(
      -(bb.min.x + bb.max.x) / 2,
      -(bb.min.y + bb.max.y) / 2,
      -(bb.min.z + bb.max.z) / 2,
    );

    // SVG Y axis points down: flip with a rotation (determinant +1),
    // never a negative scale — that reverses winding and culls every face.
    geo.rotateX(Math.PI);

    geo.computeBoundingBox();
    bb = geo.boundingBox!;
    const diag = Math.hypot(bb.max.x - bb.min.x, bb.max.y - bb.min.y);
    const depth = bb.max.z - bb.min.z;
    if (diag < 1e-6 || depth < 1e-6) return null;
    const k = shape.width / diag;
    geo.scale(k, k, shape.depth / depth);

    // Groups: 0 = front/back caps, 1 = straight walls (darker, so the
    // extrusion reads as form), 2 = bevel (light: the edge highlight)
    geo.computeVertexNormals();
    const out = splitBevel(geo);
    geo.dispose();
    out.computeBoundingBox();
    return { geo: out, area: filledArea(shapes) * k * k };
  } catch {
    return null;
  }
}

/* ── Public API ──────────────────────────────────────────────── */

export interface LogoData {
  geometry: THREE.BufferGeometry;
  title: string;
}

/*
 * Logo sets are built in idle slices, one icon per step (scene/warm.ts
 * sliceIdle): all ~10 icons extruded synchronously on the crystal's first
 * render cost ~0.25 s per set on a slow machine, four sets in all. A set
 * is published whole, once its area-evening pass is done (the pass needs
 * every icon), so a logo never appears and then changes size.
 */
interface SetState {
  logos: LogoData[];
  done: boolean;
  listeners: Set<() => void>;
}
const _sets = new Map<string, SetState>();
const EMPTY: LogoData[] = [];

function* buildSetSteps(shape: LogoShape, st: SetState) {
  const built: { geometry: THREE.BufferGeometry; title: string; area: number }[] = [];
  for (const icon of ICONS) {
    const r = pathToGeometry(icon.path, shape);
    if (r) built.push({ geometry: r.geo, title: icon.title, area: r.area });
    yield;
  }
  // Even out visual weight: a thin outline mark (React) reads far lighter
  // than a solid one (TypeScript) at the same diagonal. Scale each into
  // +/- AREA_TOLERANCE of the median filled area (x/y only; depth kept).
  const areas = built.map((b) => b.area).sort((p, q) => p - q);
  const median = areas[Math.floor(areas.length / 2)] ?? 1;
  for (const b of built) {
    const target = Math.min(median * (1 + AREA_TOLERANCE), Math.max(median * (1 - AREA_TOLERANCE), b.area));
    const f = b.area > 0 ? Math.sqrt(target / b.area) : 1;
    if (Math.abs(f - 1) > 1e-3) {
      b.geometry.scale(f, f, 1);
      b.geometry.computeBoundingBox();
    }
  }
  st.logos = built.map(({ geometry, title }) => ({ geometry, title }));
  st.done = true;
  st.listeners.forEach((l) => l());
}

function ensureSet(shape: LogoShape): SetState {
  const key = `${shape.width}:${shape.depth}:${shape.bevel}`;
  let st = _sets.get(key);
  if (!st) {
    st = { logos: EMPTY, done: false, listeners: new Set() };
    _sets.set(key, st);
    sliceIdle(buildSetSteps(shape, st));
  }
  return st;
}

function useLogoSet(shape: LogoShape): LogoData[] {
  const st = ensureSet(shape);
  return useSyncExternalStore(
    (cb) => {
      st.listeners.add(cb);
      return () => st.listeners.delete(cb);
    },
    () => st.logos,
    () => EMPTY,
  );
}

/** Every icon at hero size (diagonal `size`, area-evened, 0.26 deep), in
 * cycle order. Empty until the whole set is built. */
export function useHeroLogos(size: number, bevel: BevelKind = "wake"): LogoData[] {
  return useLogoSet({ width: size, depth: HERO_LOGO_DEPTH, bevel: BEVEL[bevel] });
}

/** Every icon at unit width, same order as useHeroLogos; scale to size. */
export function useUnitLogos(bevel: BevelKind = "wake"): LogoData[] {
  return useLogoSet({ width: 1, depth: UNIT_DEPTH, bevel: BEVEL[bevel] });
}
