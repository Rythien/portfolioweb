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

/* ── Icon list — index 0 is hero, rest map to shards ─────────── */

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

export const HERO_LOGO_WIDTH = 1.0;
export const SHARD_LOGO_WIDTH = 0.45;

// Extrude depth as a fraction of logo width (≈0.12 units at width 1.0)
const DEPTH_RATIO = 0.12;
// Bevel in SVG units (icons are 24 units wide → ~0.015 units at width 1.0)
const BEVEL = 0.35;

/* ── SVG path → ExtrudeGeometry ──────────────────────────────── */

function pathToGeometry(
  pathData: string,
  targetWidth: number,
): THREE.BufferGeometry | null {
  try {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${pathData}"/></svg>`;
    const loader = new SVGLoader();
    const parsed = loader.parse(svg);
    const shapes: THREE.Shape[] = [];
    for (const p of parsed.paths) {
      shapes.push(...SVGLoader.createShapes(p));
    }
    if (!shapes.length) return null;

    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: 2,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL,
      bevelSegments: 2,
    });

    // Center on origin
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

    // Normalise: targetWidth wide in XY, DEPTH_RATIO-proportional in Z
    geo.computeBoundingBox();
    bb = geo.boundingBox!;
    const width = bb.max.x - bb.min.x;
    const depth = bb.max.z - bb.min.z;
    if (width < 1e-6 || depth < 1e-6) return null;
    const sXY = targetWidth / width;
    const sZ = (DEPTH_RATIO * targetWidth) / depth;
    geo.scale(sXY, sXY, sZ);

    geo.computeVertexNormals();
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

const _cache = new Map<number, LogoData[]>();

export function getLogoGeometries(targetWidth: number): LogoData[] {
  const cached = _cache.get(targetWidth);
  if (cached) return cached;
  const logos: LogoData[] = [];
  for (const icon of ICONS) {
    const geo = pathToGeometry(icon.path, targetWidth);
    if (geo) logos.push({ geometry: geo, title: icon.title });
  }
  _cache.set(targetWidth, logos);
  return logos;
}

export function getHeroLogo(): LogoData | null {
  const logos = getLogoGeometries(HERO_LOGO_WIDTH);
  return logos[0] ?? null;
}

export function getShardLogos(shardCount: number): (LogoData | null)[] {
  const logos = getLogoGeometries(SHARD_LOGO_WIDTH);
  const result: (LogoData | null)[] = [];
  for (let i = 0; i < shardCount; i++) {
    result.push(logos[i % logos.length] ?? null);
  }
  return result;
}
