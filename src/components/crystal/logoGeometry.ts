import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
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
export const HERO_LOGO_FILL = 0.4;
/** Each logo's filled area is brought within this of the set's median. */
export const AREA_TOLERANCE = 0.15;
export const HERO_LOGO_DEPTH = 0.26;

/** Shard logos are built at unit size and scaled to fit their shard; same
 * depth-to-size ratio as a hero logo of ~1.4. */
const UNIT_DEPTH = HERO_LOGO_DEPTH / 1.4;

// Bevel in SVG units (icons are 24 units wide): wide enough that the
// rounded edge reads as form and catches the strip light
const BEVEL = 0.8;

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

    // ExtrudeGeometry keeps two groups: 0 = front/back caps, 1 = side
    // walls + bevel. GlassCrystal gives the walls a darker material so the
    // extrusion edge shows.
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    return { geo, area: filledArea(shapes) * k * k };
  } catch {
    return null;
  }
}

/* ── Public API ──────────────────────────────────────────────── */

export interface LogoData {
  geometry: THREE.BufferGeometry;
  title: string;
}

const _cache = new Map<string, LogoData[]>();

function buildSet(shape: LogoShape): LogoData[] {
  const key = `${shape.width}:${shape.depth}:${shape.bevel}`;
  const cached = _cache.get(key);
  if (cached) return cached;
  const built: { geometry: THREE.BufferGeometry; title: string; area: number }[] = [];
  for (const icon of ICONS) {
    const r = pathToGeometry(icon.path, shape);
    if (r) built.push({ geometry: r.geo, title: icon.title, area: r.area });
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
  const logos: LogoData[] = built.map(({ geometry, title }) => ({ geometry, title }));
  _cache.set(key, logos);
  return logos;
}

/** Every icon at hero size (diagonal `size`, area-evened, 0.26 deep), in cycle order. */
export function getHeroLogos(size: number): LogoData[] {
  return buildSet({ width: size, depth: HERO_LOGO_DEPTH, bevel: BEVEL });
}

/** Every icon at unit width, same order as getHeroLogos; scale to size. */
export function getUnitLogos(): LogoData[] {
  return buildSet({ width: 1, depth: UNIT_DEPTH, bevel: BEVEL });
}
