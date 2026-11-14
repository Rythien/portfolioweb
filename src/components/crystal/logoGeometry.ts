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

/** Hero logo inside the intact crystal (crystal is ~2.4 wide). */
export const HERO_LOGO_WIDTH = 1.25;
export const HERO_LOGO_DEPTH = 0.18;

/** Shard logos are built at unit width and scaled to fit their shard. */
const UNIT_DEPTH = HERO_LOGO_DEPTH / HERO_LOGO_WIDTH;

// Bevel in SVG units (icons are 24 units wide); large enough that the
// edge catches the environment's lightformers
const BEVEL = 0.5;

interface LogoShape {
  width: number;
  depth: number;
  bevel: number;
}

/* ── SVG path → ExtrudeGeometry ──────────────────────────────── */

function pathToGeometry(pathData: string, shape: LogoShape): THREE.BufferGeometry | null {
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
    const width = bb.max.x - bb.min.x;
    const depth = bb.max.z - bb.min.z;
    if (width < 1e-6 || depth < 1e-6) return null;
    geo.scale(shape.width / width, shape.width / width, shape.depth / depth);

    geo.computeVertexNormals();
    geo.computeBoundingBox();
    return geo;
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
  const logos: LogoData[] = [];
  for (const icon of ICONS) {
    const geometry = pathToGeometry(icon.path, shape);
    if (geometry) logos.push({ geometry, title: icon.title });
  }
  _cache.set(key, logos);
  return logos;
}

/** Every icon at hero size (1.25 wide, 0.18 deep), in cycle order. */
export function getHeroLogos(): LogoData[] {
  return buildSet({ width: HERO_LOGO_WIDTH, depth: HERO_LOGO_DEPTH, bevel: BEVEL });
}

/** Every icon at unit width, same order as getHeroLogos; scale to size. */
export function getUnitLogos(): LogoData[] {
  return buildSet({ width: 1, depth: UNIT_DEPTH, bevel: BEVEL });
}
