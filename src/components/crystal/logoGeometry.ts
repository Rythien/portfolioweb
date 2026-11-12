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

const LOGO_SCALE = 0.014;
const EXTRUDE_DEPTH = 1.5;

/* ── SVG path → ExtrudeGeometry ──────────────────────────────── */

function pathToGeometry(pathData: string): THREE.BufferGeometry | null {
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
      depth: EXTRUDE_DEPTH,
      bevelEnabled: false,
    });

    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    geo.translate(-cx, -cy, -cz);
    geo.scale(LOGO_SCALE, -LOGO_SCALE, LOGO_SCALE);
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

let _cache: LogoData[] | null = null;

export function getLogoGeometries(): LogoData[] {
  if (_cache) return _cache;
  _cache = [];
  for (const icon of ICONS) {
    const geo = pathToGeometry(icon.path);
    if (geo) _cache.push({ geometry: geo, title: icon.title });
  }
  return _cache;
}

export function getHeroLogo(): LogoData | null {
  const logos = getLogoGeometries();
  return logos[0] ?? null;
}

export function getShardLogos(shardCount: number): (LogoData | null)[] {
  const logos = getLogoGeometries();
  const result: (LogoData | null)[] = [];
  for (let i = 0; i < shardCount; i++) {
    result.push(logos[i % logos.length] ?? null);
  }
  return result;
}
