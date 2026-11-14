"use client";

import { forwardRef, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MeshTransmissionMaterial, useFBO, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { useFractureStore } from "@/store/useFractureStore";
import { getCrystalPose } from "@/hooks/useCrystalPose";
import { useCrystalSound } from "@/hooks/useCrystalSound";
import { initAudioContext } from "@/hooks/crystalAudio";
import { useSoundStore } from "@/store/useSoundStore";
import {
  subdivideNonIndexed,
  displaceAlongNormals,
  generateSphericalUVs,
  createFrostNormalMap,
  createGlowTexture,
} from "./frostUtils";
import { getHeroLogos, getUnitLogos } from "./logoGeometry";

/** Seconds between hero logo swaps in the intact crystal. */
export const LOGO_CYCLE_SECONDS = 3.5;
/** Reduced motion: slower cycle, crossfade instead of scale + spin. */
const LOGO_CYCLE_SECONDS_REDUCED = 6;
const SWAP_OUT = 0.35;
const SWAP_IN = 0.45;
const SWAP_SPIN = THREE.MathUtils.degToRad(25);

/*
 * Hero logo cycle state, shared by the WAKE and DREAM instances so both
 * show the same logo when the mode flips. Only the active instance runs
 * its frame loop, so only one advances it.
 */
const heroCycle = {
  index: 0,
  phase: "hold" as "hold" | "out" | "in",
  t: 0,
};

const expoIn = (x: number) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10));
const backOut = (x: number, s = 1.6) => {
  const u = x - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};

/** A very quiet glass tick for each logo swap (only when sound is on). */
function playSwapTick() {
  if (!useSoundStore.getState().enabled) return;
  try {
    const ctx = initAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(3400, now);
    osc.frequency.exponentialRampToValueAtTime(2600, now + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.012, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch {
    // Audio is decoration; never let it break the frame loop
  }
}

const _swayEuler = new THREE.Euler();
const _swayQ = new THREE.Quaternion();
const _parentInvQ = new THREE.Quaternion();

/* ── Seeded PRNG ───────────────────────────────────────────────── */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── Constants ────────────────────────────────────────────────── */

const DEFAULT_SEED = 105;
const SHARD_COUNT = 10;
const R = 1.4;
const SCALE = new THREE.Vector3(1.2, 1.0, 0.9);
const TWO_PI = Math.PI * 2;
const BODY = 10;
const CLEAVE = 2;
const VCHIPS = 26;
const ECHIPS = 26;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/* ── Types ────────────────────────────────────────────────────── */

interface HalfPlane {
  n: THREE.Vector3;
  d: number;
}

export interface ShardData {
  geometry: THREE.BufferGeometry;
  centroid: THREE.Vector3;
  direction: THREE.Vector3;
  tumbleAxis: THREE.Vector3;
  tumbleSpeed: number;
  driftCenter: THREE.Vector3;
  lissFreq: THREE.Vector3;
  lissPhase: THREE.Vector3;
  lissAmp: THREE.Vector3;
  brokenScale: number;
}

/* ── 3×3 Cramer solve ────────────────────────────────────────── */

function solve3x3(
  n0: THREE.Vector3, d0: number,
  n1: THREE.Vector3, d1: number,
  n2: THREE.Vector3, d2: number,
): THREE.Vector3 | null {
  const det =
    n0.x * (n1.y * n2.z - n1.z * n2.y) -
    n0.y * (n1.x * n2.z - n1.z * n2.x) +
    n0.z * (n1.x * n2.y - n1.y * n2.x);
  if (Math.abs(det) < 1e-10) return null;
  const inv = 1 / det;
  return new THREE.Vector3(
    (d0 * (n1.y * n2.z - n1.z * n2.y) - n0.y * (d1 * n2.z - n1.z * d2) + n0.z * (d1 * n2.y - n1.y * d2)) * inv,
    (n0.x * (d1 * n2.z - n1.z * d2) - d0 * (n1.x * n2.z - n1.z * n2.x) + n0.z * (n1.x * d2 - d1 * n2.x)) * inv,
    (n0.x * (n1.y * d2 - d1 * n2.y) - n0.y * (n1.x * d2 - d1 * n2.x) + d0 * (n1.x * n2.y - n1.y * n2.x)) * inv,
  );
}

/* ── Half-space intersection ─────────────────────────────────── */

function solveHalfSpaces(planes: HalfPlane[]): THREE.Vector3[] {
  const N = planes.length;
  const EPS = 1e-5;
  const verts: THREE.Vector3[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < N - 2; i++) {
    for (let j = i + 1; j < N - 1; j++) {
      for (let k = j + 1; k < N; k++) {
        const p = solve3x3(
          planes[i].n, planes[i].d,
          planes[j].n, planes[j].d,
          planes[k].n, planes[k].d,
        );
        if (!p) continue;

        let valid = true;
        for (let m = 0; m < N; m++) {
          if (planes[m].n.dot(p) > planes[m].d + EPS) {
            valid = false;
            break;
          }
        }
        if (!valid) continue;

        const key = `${Math.round(p.x * 1e4)},${Math.round(p.y * 1e4)},${Math.round(p.z * 1e4)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        verts.push(p);
      }
    }
  }

  return verts;
}

/* ── Fibonacci sphere ────────────────────────────────────────── */

function fibSphere(n: number): THREE.Vector3[] {
  const ga = Math.PI * (3 - Math.sqrt(5));
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - 2 * (i + 0.5) / n;
    const r = Math.sqrt(1 - y * y);
    const t = ga * i;
    out.push(new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r));
  }
  return out;
}

/* ── Unit random direction ───────────────────────────────────── */

function unitDir(rng: () => number): THREE.Vector3 {
  const th = Math.acos(2 * rng() - 1);
  const ph = 2 * Math.PI * rng();
  return new THREE.Vector3(
    Math.sin(th) * Math.cos(ph),
    Math.sin(th) * Math.sin(ph),
    Math.cos(th),
  );
}

/* ── Generate rock planes (chunky ice-rock, ported from rockgen.mjs) */

function buildRockPlanes(seed: number): HalfPlane[] | null {
  const rng = seededRandom(seed);
  rng(); rng();

  const P: HalfPlane[] = [];

  for (const b of fibSphere(BODY)) {
    const u = unitDir(rng);
    const n = new THREE.Vector3(
      b.x + u.x * 0.35, b.y + u.y * 0.35, b.z + u.z * 0.35,
    ).normalize();
    P.push({ n, d: R * (0.74 + rng() * 0.18) });
  }

  for (let i = 0; i < CLEAVE; i++) {
    P.push({ n: unitDir(rng), d: R * (0.58 + rng() * 0.10) });
  }

  const nb = P.length;
  const V = solveHalfSpaces(P);
  if (V.length < 8) return null;

  const on = V.map(v => {
    const s = new Set<number>();
    for (let m = 0; m < nb; m++) {
      if (Math.abs(P[m].n.dot(v) - P[m].d) < 1e-4) s.add(m);
    }
    return s;
  });

  for (let c = 0; c < VCHIPS; c++) {
    const v = V[Math.floor(rng() * V.length)];
    const L = v.length();
    const u = unitDir(rng);
    const n = new THREE.Vector3(
      v.x / L + u.x * 0.12, v.y / L + u.y * 0.12, v.z / L + u.z * 0.12,
    ).normalize();
    P.push({ n, d: L * (0.80 + rng() * 0.14) });
  }

  const edges: [number, number][] = [];
  for (let a = 0; a < V.length; a++) {
    for (let b = a + 1; b < V.length; b++) {
      let common = 0;
      for (const m of on[a]) if (on[b].has(m)) common++;
      if (common >= 2) edges.push([a, b]);
    }
  }
  if (!edges.length) return null;

  for (let c = 0; c < ECHIPS; c++) {
    const [a, b] = edges[Math.floor(rng() * edges.length)];
    const mid = new THREE.Vector3().addVectors(V[a], V[b]).multiplyScalar(0.5);
    const L = mid.length();
    const u = unitDir(rng);
    const n = new THREE.Vector3(
      mid.x / L + u.x * 0.10, mid.y / L + u.y * 0.10, mid.z / L + u.z * 0.10,
    ).normalize();
    P.push({ n, d: L * (0.86 + rng() * 0.09) });
  }

  return P;
}

/* ── Build rock geometry + Voronoi shards ────────────────────── */

interface RockResult {
  rockGeo: THREE.BufferGeometry;
  shards: ShardData[];
}

function buildRockData(seed: number): RockResult {
  const planes = buildRockPlanes(seed);

  // Polyhedron and Convex geometries are already non-indexed
  const fallback = () => {
    const g = new THREE.IcosahedronGeometry(1.2, 1);
    g.computeVertexNormals();
    return { rockGeo: g as THREE.BufferGeometry, shards: [] };
  };

  if (!planes) return fallback();

  const rockV = solveHalfSpaces(planes);
  if (rockV.length < 8) return fallback();

  const active = planes.filter(p =>
    rockV.filter(v => Math.abs(p.n.dot(v) - p.d) < 1e-4).length >= 3
  );

  const bb = new THREE.Box3();
  for (const v of rockV) bb.expandByPoint(v);
  const center = new THREE.Vector3();
  bb.getCenter(center);
  const maxLen = Math.max(...rockV.map(v => v.clone().sub(center).length()));
  const f = R * 1.05 / maxLen;

  const xf = (v: THREE.Vector3) => new THREE.Vector3(
    (v.x - center.x) * f * SCALE.x,
    (v.y - center.y) * f * SCALE.y,
    (v.z - center.z) * f * SCALE.z,
  );

  const finalVerts = rockV.map(xf);
  const rockConvex = new ConvexGeometry(finalVerts);
  const rockSub = subdivideNonIndexed(rockConvex, SUBDIV_LEVELS_ROCK);
  rockConvex.dispose();
  displaceAlongNormals(rockSub, DISPLACE_STRENGTH, DISPLACE_FREQ, seed * 0.13);
  generateSphericalUVs(rockSub);
  const rockGeo = rockSub;

  const rng = seededRandom(seed + 5555);
  rng(); rng();

  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < SHARD_COUNT; i++) {
    const th = Math.acos(2 * rng() - 1);
    const ph = 2 * Math.PI * rng();
    const r = (0.15 + rng() * 0.6) * R;
    pts.push(new THREE.Vector3(
      center.x + r * Math.sin(th) * Math.cos(ph),
      center.y + r * Math.sin(th) * Math.sin(ph),
      center.z + r * Math.cos(th),
    ));
  }

  const animRng = seededRandom(seed + 7777);
  const shards: ShardData[] = [];

  for (let i = 0; i < SHARD_COUNT; i++) {
    const P: HalfPlane[] = active.map(p => ({ n: p.n.clone(), d: p.d }));
    for (let j = 0; j < SHARD_COUNT; j++) {
      if (i === j) continue;
      const diff = new THREE.Vector3().subVectors(pts[j], pts[i]);
      const L = diff.length();
      if (L < 1e-9) continue;
      const n = diff.clone().divideScalar(L);
      const mid = new THREE.Vector3().addVectors(pts[i], pts[j]).multiplyScalar(0.5);
      P.push({ n, d: n.dot(mid) });
    }

    const V = solveHalfSpaces(P).map(xf);
    if (V.length < 4) continue;

    const sConvex = new ConvexGeometry(V);
    const geo = subdivideNonIndexed(sConvex, SUBDIV_LEVELS_SHARD);
    sConvex.dispose();
    displaceAlongNormals(geo, DISPLACE_STRENGTH * 0.6, DISPLACE_FREQ * 1.2, seed * 0.13 + i);
    generateSphericalUVs(geo);

    const pos = geo.attributes.position;
    const centroid = new THREE.Vector3();
    for (let v = 0; v < pos.count; v++) {
      centroid.x += pos.getX(v);
      centroid.y += pos.getY(v);
      centroid.z += pos.getZ(v);
    }
    centroid.divideScalar(pos.count);

    for (let v = 0; v < pos.count; v++) {
      pos.setXYZ(v, pos.getX(v) - centroid.x, pos.getY(v) - centroid.y, pos.getZ(v) - centroid.z);
    }
    pos.needsUpdate = true;

    const direction = centroid.clone().normalize();
    const tumbleAxis = new THREE.Vector3(
      animRng() - 0.5, animRng() - 0.5, animRng() - 0.5,
    ).normalize();
    const tumbleSpeed = 0.3 + animRng() * 0.4;
    // Bias drift targets to the top band and the right third, keeping
    // shards off the hero centre line and the project text column
    const edgeBias = animRng();
    let dx: number, dy: number;
    if (edgeBias < 0.5) {
      // Right third
      dx = 1.9 + animRng() * 1.3;
      dy = (animRng() - 0.4) * 2.6;
    } else {
      // Top band
      dx = (animRng() - 0.35) * 3.2;
      dy = 1.3 + animRng() * 1.1;
    }
    const driftCenter = new THREE.Vector3(dx, dy, (animRng() - 0.5) * 0.6);
    const lissFreq = new THREE.Vector3(
      0.15 + animRng() * 0.2, 0.12 + animRng() * 0.18, 0.08 + animRng() * 0.12,
    );
    const lissPhase = new THREE.Vector3(
      animRng() * TWO_PI, animRng() * TWO_PI, animRng() * TWO_PI,
    );
    const lissAmp = new THREE.Vector3(
      0.3 + animRng() * 0.5, 0.2 + animRng() * 0.4, 0.1 + animRng() * 0.2,
    );

    const brokenScale = 0.35 + animRng() * 0.25;
    shards.push({
      geometry: geo, centroid, direction, tumbleAxis, tumbleSpeed,
      driftCenter, lissFreq, lissPhase, lissAmp, brokenScale,
    });
  }

  return { rockGeo, shards };
}

/* ── Hook ───────────────────────────────────────────────────── */

export function useRockData(seed = DEFAULT_SEED) {
  return useMemo(() => buildRockData(seed), [seed]);
}

/* ── Glass look (single tweak point) ─────────────────────────── */

export const GLASS_LOOK = {
  thickness: 1.2,
  chromaticAberration: 0.12,
  anisotropicBlur: 0.1,
  roughness: 0.05,
  distortion: 0.1,
  distortionScale: 0.2,
  temporalDistortion: 0.02,
  ior: 1.35,
  samples: 8,
  resolution: 1024,
  color: "#e8f1f5",
  attenuationColor: "#cfe3ea",
  attenuationDistance: 5,
  backsideThickness: 0.25,
  envMapIntensity: 1.0,
} as const;

/*
 * Logo contrast. WAKE: dark slate with a reflective bevel, so the faces
 * read darker than the page and the edges catch the lightformers.
 * DREAM: pale lavender glowing inside the violet glass. The ghost is a
 * flat copy drawn over the glass so the logo stays readable through
 * refraction.
 */
const LOGO_LOOK = {
  wake: {
    color: "#4a5263",
    emissive: "#000000",
    emissiveIntensity: 0,
    roughness: 0.35,
    metalness: 0.25,
    envMapIntensity: 1.2,
    ghost: "#3a4150",
  },
  dream: {
    color: "#e4dcff",
    emissive: "#8f7bff",
    emissiveIntensity: 0.45,
    roughness: 0.35,
    metalness: 0.25,
    envMapIntensity: 1.2,
    ghost: "#d9ccff",
  },
} as const;
const GHOST_OPACITY = 0.22;
const GHOST_RENDER_ORDER = 10;
/*
 * Shard logos are drawn over their shard, not refracted through it: seen
 * only through a small tumbling faceted shard, the WAKE logos smeared
 * into dark blotches. They stay out of the shard backdrop pass.
 */
const SHARD_LOGO_RENDER_ORDER = 9;
/** Intact glass: calmer surface so the interior reads, still frosty. */
const INTACT_NORMAL_SCALE = 0.14;
const INTACT_CHROMATIC_ABERRATION = 0.08;
// Refraction strength of the intact glass. At 1.2 the lens-shaped crystal
// magnified the dark WAKE logo across the whole interior (a dark mass);
// lower keeps the logo near true size inside clear ice
const INTACT_THICKNESS = 0.45;

/** Broken state: logos on the largest shards only. */
const SHARD_LOGO_COUNT = 8;
const SHARD_LOGO_FILL = 0.7;
/** Minimum logo width in group units (world units at pose scale 1). */
const SHARD_LOGO_MIN = 0.35;
const SHARD_LOGO_SWAY = THREE.MathUtils.degToRad(20);
const SHARD_NORMAL_SCALE = 0.12;
// Same reason as INTACT_THICKNESS: thick shards magnified the dark WAKE
// logos into blotches
const SHARD_THICKNESS = 0.35;
const SHARD_BACKDROP_PX = 768;

const INCLUSION_COUNT = 10;
const SUBDIV_LEVELS_ROCK = 2;
const SUBDIV_LEVELS_SHARD = 1;
const DISPLACE_STRENGTH = 0.045;
const DISPLACE_FREQ = 3.5;

/* ── Material tints ──────────────────────────────────────────── */

const WAKE_TINT = {
  color: "#e8f1f5",
  attenuationColor: "#cfe3ea",
  envMapIntensity: 1.0,
} as const;

const DREAM_TINT = {
  color: "#c4b5fd",
  attenuationColor: "#b4a0e8",
  envMapIntensity: 1.0,
} as const;

/* ── Component ───────────────────────────────────────────────── */

interface GlassCrystalProps {
  seed?: number;
  variant?: "wake" | "dream";
  active?: boolean;
}

/* ── Inclusion sliver data (random thin needles inside crystal) ── */

interface InclusionData {
  matrix: THREE.Matrix4;
}

function buildInclusions(seed: number, count: number, maxR: number): InclusionData[] {
  const rng = seededRandom(seed + 9999);
  const out: InclusionData[] = [];
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _euler = new THREE.Euler();
  const _scale = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const r = rng() * maxR * 0.6;
    const th = Math.acos(2 * rng() - 1);
    const ph = TWO_PI * rng();
    _pos.set(
      r * Math.sin(th) * Math.cos(ph),
      r * Math.sin(th) * Math.sin(ph),
      r * Math.cos(th),
    );
    const length = 0.06 + rng() * 0.14;
    const thickness = 0.006 + rng() * 0.008;
    _scale.set(thickness, length, thickness);
    _euler.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    _quat.setFromEuler(_euler);

    const m = new THREE.Matrix4();
    m.compose(_pos, _quat, _scale);
    out.push({ matrix: m });
  }
  return out;
}

/* ── Component ───────────────────────────────────────────────── */

const _inclusionGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 4, 1);

const GlassCrystal = forwardRef<THREE.Group, GlassCrystalProps>(
  function GlassCrystal({ seed = DEFAULT_SEED, variant = "wake", active = true }, ref) {
    const { rockGeo: geo, shards } = useRockData(seed);
    const tint = variant === "dream" ? DREAM_TINT : WAKE_TINT;
    const logoLook = LOGO_LOOK[variant];
    useCrystalSound();

    // Baked intact mesh from Blender; procedural rock stays as fallback and
    // as the bounds reference so pose/hover/break tuning still fits
    const { nodes } = useGLTF("/models/crystal.glb") as unknown as {
      nodes: Record<string, THREE.Object3D>;
    };
    const { intactGeo, bakedNormalMap } = useMemo(() => {
      const node = nodes?.Crystal;
      if (!(node instanceof THREE.Mesh)) {
        return { intactGeo: geo, bakedNormalMap: null as THREE.Texture | null };
      }
      const g = (node.geometry as THREE.BufferGeometry).clone();
      g.computeBoundingBox();
      const bb = g.boundingBox!;
      const center = bb.getCenter(new THREE.Vector3());
      g.translate(-center.x, -center.y, -center.z);
      const size = bb.getSize(new THREE.Vector3());
      geo.computeBoundingBox();
      const target = geo.boundingBox!.getSize(new THREE.Vector3());
      // Uniform scale only: non-uniform would skew the exported split
      // normals the bake relies on
      const s =
        Math.max(target.x, target.y, target.z) /
        Math.max(size.x, size.y, size.z);
      g.scale(s, s, s);
      const mat = node.material as THREE.MeshStandardMaterial | undefined;
      // Local clone (shares the image): normal data is linear and GLB
      // textures are not flipped
      const nm = mat?.normalMap ? mat.normalMap.clone() : null;
      if (nm) {
        nm.colorSpace = THREE.NoColorSpace;
        nm.flipY = false;
        nm.needsUpdate = true;
      }
      return { intactGeo: g, bakedNormalMap: nm };
    }, [nodes, geo]);

    const frostNormalMap = useMemo(() => createFrostNormalMap(256), []);
    const glowTex = useMemo(() => createGlowTexture(128), []);
    const inclusions = useMemo(() => buildInclusions(seed, INCLUSION_COUNT, R), [seed]);
    const heroLogos = useMemo(() => getHeroLogos(), []);
    const unitLogos = useMemo(() => getUnitLogos(), []);
    // The largest shards (by volume) each carry a logo, sized from the
    // shard's own bounds; smaller shards and debris carry none
    const shardLogoSlots = useMemo(() => {
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      const info = shards.map((s, i) => {
        const pos = s.geometry.attributes.position;
        let vol = 0;
        for (let v = 0; v + 2 < pos.count; v += 3) {
          a.fromBufferAttribute(pos, v);
          b.fromBufferAttribute(pos, v + 1);
          c.fromBufferAttribute(pos, v + 2);
          vol += a.dot(b.clone().cross(c)) / 6;
        }
        s.geometry.computeBoundingBox();
        const size = s.geometry.boundingBox!.getSize(new THREE.Vector3());
        // Face-on silhouette: the two largest dims; its short side is the
        // middle one (the smallest is the slab's thickness)
        const dims = [size.x, size.y, size.z].sort((p, q) => p - q);
        return { shard: i, vol: Math.abs(vol), shortSide: dims[1] };
      });
      return info
        .sort((p, q) => q.vol - p.vol)
        .slice(0, SHARD_LOGO_COUNT)
        .map((r, rank) => ({
          shard: r.shard,
          rank,
          size: SHARD_LOGO_FILL * r.shortSide,
          swayFreq: 0.45 + rank * 0.07,
          swayPhase: rank * 1.7,
        }));
    }, [shards]);
    const reducedMotion = useMemo(
      () =>
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      [],
    );

    const { scene: portalScene, camera: portalCamera } = useThree();
    const mergedRef = useRef<THREE.Mesh>(null);
    const heroLogoRef = useRef<THREE.Mesh>(null);
    const heroGhostRef = useRef<THREE.Mesh>(null);
    const shardLogoRefs = useRef<(THREE.Mesh | null)[]>([]);
    const shardGhostRefs = useRef<(THREE.Mesh | null)[]>([]);
    const shardMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
    const inclusionRef = useRef<THREE.InstancedMesh>(null);
    const glowRef = useRef<THREE.Sprite>(null);
    const showShardsRef = useRef(false);
    const _invQ = useRef(new THREE.Quaternion());
    const _off = useRef(new THREE.Vector3());
    const mergedFbo = useFBO(1024, 1024, { depthBuffer: true });
    const shardFbo = useFBO(SHARD_BACKDROP_PX, SHARD_BACKDROP_PX, { depthBuffer: true });

    useEffect(() => {
      if (!inclusionRef.current) return;
      for (let i = 0; i < inclusions.length; i++) {
        inclusionRef.current.setMatrixAt(i, inclusions[i].matrix);
      }
      inclusionRef.current.instanceMatrix.needsUpdate = true;
    }, [inclusions]);

    useFrame((state, rawDelta) => {
      const fade = getCrystalPose().fade;
      if (!active || fade < 0.01) {
        if (mergedRef.current) mergedRef.current.visible = false;
        if (heroLogoRef.current) heroLogoRef.current.visible = false;
        if (heroGhostRef.current) heroGhostRef.current.visible = false;
        if (inclusionRef.current) inclusionRef.current.visible = false;
        if (glowRef.current) glowRef.current.visible = false;
        for (let i = 0; i < shards.length; i++) {
          const m = shardMeshRefs.current[i];
          if (m) m.visible = false;
        }
        for (const l of shardLogoRefs.current) if (l) l.visible = false;
        for (const g of shardGhostRefs.current) if (g) g.visible = false;
        return;
      }
      const breakVal = useFractureStore.getState().breakVal;
      const elapsed = state.clock.elapsedTime;
      const pose = getCrystalPose();

      if (!showShardsRef.current && breakVal >= 0.08) showShardsRef.current = true;
      if (showShardsRef.current && breakVal <= 0.05) showShardsRef.current = false;
      const showShards = showShardsRef.current;

      // Inclusion + glow visibility follows merged mesh
      const crossfade = showShards ? smoothstep(0.05, 0.15, breakVal) : 0;
      const mergedHidden = crossfade >= 1;

      if (inclusionRef.current) {
        inclusionRef.current.visible = !mergedHidden;
        const iMat = inclusionRef.current.material as THREE.MeshStandardMaterial;
        if (iMat) iMat.opacity = (1 - crossfade) * fade;
      }

      if (glowRef.current) {
        glowRef.current.visible = !mergedHidden;
        const sMat = glowRef.current.material as THREE.SpriteMaterial;
        if (sMat) sMat.opacity = (0.3 + Math.sin(elapsed * 0.8) * 0.08) * (1 - crossfade) * fade;
      }

      // ── Hero logo: cycles through every icon, always facing the camera
      const delta = Math.min(rawDelta, 0.1);
      const cyc = heroCycle;
      const nLogos = heroLogos.length;
      const paused = useFractureStore.getState().hoverBreak || breakVal > 0.05;
      const period = reducedMotion ? LOGO_CYCLE_SECONDS_REDUCED : LOGO_CYCLE_SECONDS;
      if (nLogos > 1) {
        if (cyc.phase === "hold") {
          if (!paused) cyc.t += delta;
          if (cyc.t >= period - SWAP_OUT - SWAP_IN) {
            cyc.phase = "out";
            cyc.t = 0;
          }
        } else {
          cyc.t += delta;
          if (cyc.phase === "out" && cyc.t >= SWAP_OUT) {
            cyc.index = (cyc.index + 1) % nLogos;
            cyc.phase = "in";
            cyc.t = 0;
            playSwapTick();
          } else if (cyc.phase === "in" && cyc.t >= SWAP_IN) {
            cyc.phase = "hold";
            cyc.t = 0;
          }
        }
      }
      let heroScale = 1;
      let heroAlpha = 1;
      let heroSpin = 0;
      if (cyc.phase === "out") {
        const p = Math.min(cyc.t / SWAP_OUT, 1);
        if (reducedMotion) heroAlpha = 1 - p;
        else {
          heroScale = 1 - expoIn(p);
          heroSpin = SWAP_SPIN * 0.5 * p;
        }
      } else if (cyc.phase === "in") {
        const p = Math.min(cyc.t / SWAP_IN, 1);
        if (reducedMotion) heroAlpha = p;
        else {
          heroScale = backOut(p);
          heroSpin = -SWAP_SPIN * 0.5 * (1 - p);
        }
      }

      const heroMesh = heroLogoRef.current;
      if (heroMesh) {
        const geo = heroLogos[cyc.index % Math.max(nLogos, 1)]?.geometry;
        if (geo && heroMesh.geometry !== geo) heroMesh.geometry = geo;

        // Cancel the crystal group's rotation so the logo faces the
        // camera, then add a gentle sway that never reaches edge-on
        const swayY = reducedMotion ? 0 : Math.sin(elapsed * 0.6) * 0.35;
        const swayX = reducedMotion ? 0 : Math.sin(elapsed * 0.45) * 0.15;
        _swayEuler.set(swayX, swayY + heroSpin, 0);
        _swayQ.setFromEuler(_swayEuler);
        if (heroMesh.parent) _parentInvQ.copy(heroMesh.parent.quaternion).invert();
        else _parentInvQ.identity();
        heroMesh.quaternion.multiplyQuaternions(_parentInvQ, _swayQ);
        heroMesh.position.set(0, 0, 0);
        heroMesh.scale.setScalar(Math.max(heroScale, 1e-4));

        heroMesh.visible = !mergedHidden;
        const heroOpacity = (1 - crossfade) * fade * heroAlpha;
        const hMat = heroMesh.material as THREE.MeshStandardMaterial;
        if (hMat) hMat.opacity = heroOpacity;

        const ghost = heroGhostRef.current;
        if (ghost) {
          if (ghost.geometry !== heroMesh.geometry) ghost.geometry = heroMesh.geometry;
          ghost.position.copy(heroMesh.position);
          ghost.quaternion.copy(heroMesh.quaternion);
          ghost.scale.copy(heroMesh.scale);
          ghost.visible = heroMesh.visible && heroOpacity > 0.001;
          (ghost.material as THREE.MeshBasicMaterial).opacity = GHOST_OPACITY * heroOpacity;
        }
      }

      if (mergedRef.current) {
        mergedRef.current.visible = !mergedHidden;
        const mat = mergedRef.current.material as THREE.MeshPhysicalMaterial;
        if (mat) {
          mat.visible = !mergedHidden;
          if (!mergedHidden) {
            mat.opacity = (1 - crossfade) * fade;
            mat.transparent = crossfade > 0 || fade < 1;
          }
        }
      }

      // Backdrop FBOs must clear to the scene background, not the
      // compositor's transparent black, or the glass refracts a dark
      // void and the interior logo reads black
      const sceneBg =
        portalScene.background instanceof THREE.Color
          ? portalScene.background
          : null;

      // Ghost layers (and the over-glass shard logos) sit on top of the
      // glass; they must never be part of the backdrop the glass refracts
      const ghosts = [heroGhostRef.current, ...shardGhostRefs.current, ...shardLogoRefs.current];
      const ghostWasVisible = ghosts.map((g) => !!g?.visible);
      const hideGhosts = () => ghosts.forEach((g) => { if (g) g.visible = false; });
      const restoreGhosts = () =>
        ghosts.forEach((g, i) => { if (g) g.visible = ghostWasVisible[i]; });

      // Render refraction backdrop for merged mesh
      if (mergedRef.current?.visible) {
        mergedRef.current.visible = false;
        hideGhosts();
        state.gl.setRenderTarget(mergedFbo);
        if (sceneBg) state.gl.setClearColor(sceneBg, 1);
        state.gl.clear();
        state.gl.render(portalScene, portalCamera);
        state.gl.setRenderTarget(null);
        restoreGhosts();
        mergedRef.current.visible = true;
      }

      // Render shared backdrop FBO for shard transmission
      if (showShards) {
        for (let i = 0; i < shards.length; i++) {
          const m = shardMeshRefs.current[i];
          if (m) m.visible = false;
        }
        hideGhosts();
        state.gl.setRenderTarget(shardFbo);
        if (sceneBg) state.gl.setClearColor(sceneBg, 1);
        state.gl.clear();
        state.gl.render(portalScene, portalCamera);
        state.gl.setRenderTarget(null);
        restoreGhosts();
        for (let i = 0; i < shards.length; i++) {
          const m = shardMeshRefs.current[i];
          if (m) m.visible = true;
        }
      }
      if (sceneBg) state.gl.setClearColor(0x000000, 0);

      const gs = Math.max(pose.scale, 0.05);
      _invQ.current.setFromEuler(new THREE.Euler(pose.rotX, pose.rotY, 0));
      _invQ.current.invert();
      const explosionFade = 1 - smoothstep(0.3, 0.8, breakVal);
      const driftFade = smoothstep(0.1, 0.5, breakVal);
      const spreadDist = breakVal * 2.0 * explosionFade;

      for (let i = 0; i < shards.length; i++) {
        const mesh = shardMeshRefs.current[i];
        if (!mesh) continue;

        mesh.visible = showShards;
        if (!showShards) continue;

        const shardOpacity = smoothstep(0.05, 0.15, breakVal) * fade;
        const sMat = mesh.material as THREE.MeshPhysicalMaterial;
        if (sMat) {
          sMat.opacity = shardOpacity;
          sMat.transparent = shardOpacity < 1;
        }

        const s = shards[i];

        const driftX = s.driftCenter.x
          + Math.sin(elapsed * s.lissFreq.x + s.lissPhase.x) * s.lissAmp.x;
        const driftY = s.driftCenter.y
          + Math.sin(elapsed * s.lissFreq.y + s.lissPhase.y) * s.lissAmp.y;
        const driftZ = s.driftCenter.z
          + Math.sin(elapsed * s.lissFreq.z + s.lissPhase.z) * s.lissAmp.z;

        const mx = pose.mouseX * 0.15 * (1 + i * 0.05);
        const my = pose.mouseY * 0.08 * (1 + i * 0.05);

        _off.current.set(driftX + mx - pose.x, driftY + my - pose.y, driftZ - pose.z);
        _off.current.applyQuaternion(_invQ.current);
        const dlx = _off.current.x / gs;
        const dly = _off.current.y / gs;
        const dlz = _off.current.z / gs;

        mesh.position.x = s.centroid.x
          + driftFade * (dlx - s.centroid.x)
          + s.direction.x * spreadDist;
        mesh.position.y = s.centroid.y
          + driftFade * (dly - s.centroid.y)
          + s.direction.y * spreadDist;
        mesh.position.z = s.centroid.z
          + driftFade * (dlz - s.centroid.z)
          + s.direction.z * spreadDist;
        if (mesh.position.z > 0.5) mesh.position.z = 0.5;

        const scaleVal = 1 - driftFade * (1 - s.brokenScale);
        mesh.scale.setScalar(scaleVal);

        const tumbleFade = smoothstep(0.02, 0.15, breakVal);
        const tumbleAngle = tumbleFade *
          (breakVal * Math.PI + elapsed * s.tumbleSpeed * Math.min(breakVal * 2, 1));
        mesh.quaternion.setFromAxisAngle(s.tumbleAxis, tumbleAngle);
      }

      // ── Shard logos: follow their shard's position, not its tumble.
      // Each faces the camera with its own small sway, and fades in as
      // the shard separates; fully gone (alpha 0 at breakVal .15) before
      // the intact crystal starts to reappear, so nothing is left behind
      const logoAlpha = showShards ? smoothstep(0.15, 0.4, breakVal) * fade : 0;
      const parent = heroLogoRef.current?.parent ?? null;
      if (parent) _parentInvQ.copy(parent.quaternion).invert();
      else _parentInvQ.identity();
      for (const slot of shardLogoSlots) {
        const logo = shardLogoRefs.current[slot.rank];
        const ghost = shardGhostRefs.current[slot.rank];
        const shardMesh = shardMeshRefs.current[slot.shard];
        const on = logoAlpha > 0.001 && !!shardMesh;
        if (logo) logo.visible = on;
        if (ghost) ghost.visible = on;
        if (!on || !logo || !shardMesh) continue;

        // Icons after the current hero logo, so a shard never repeats it
        const geo = unitLogos[(cyc.index + 1 + slot.rank) % Math.max(nLogos, 1)]?.geometry;
        if (geo && logo.geometry !== geo) logo.geometry = geo;

        logo.position.copy(shardMesh.position);
        const sway = reducedMotion ? 0 : SHARD_LOGO_SWAY;
        _swayEuler.set(
          Math.sin(elapsed * slot.swayFreq * 0.8 + slot.swayPhase) * sway * 0.5,
          Math.sin(elapsed * slot.swayFreq + slot.swayPhase) * sway,
          0,
        );
        _swayQ.setFromEuler(_swayEuler);
        logo.quaternion.multiplyQuaternions(_parentInvQ, _swayQ);
        logo.scale.setScalar(Math.max(SHARD_LOGO_MIN, slot.size * shardMesh.scale.x));
        (logo.material as THREE.MeshStandardMaterial).opacity = logoAlpha;

        if (ghost) {
          if (ghost.geometry !== logo.geometry) ghost.geometry = logo.geometry;
          ghost.position.copy(logo.position);
          ghost.quaternion.copy(logo.quaternion);
          ghost.scale.copy(logo.scale);
          (ghost.material as THREE.MeshBasicMaterial).opacity = GHOST_OPACITY * logoAlpha;
        }
      }
    });

    const intactNormalScale = useMemo(() => new THREE.Vector2(INTACT_NORMAL_SCALE, INTACT_NORMAL_SCALE), []);
    const shardNormalScale = useMemo(() => new THREE.Vector2(SHARD_NORMAL_SCALE, SHARD_NORMAL_SCALE), []);

    return (
      <group ref={ref}>
        {/* Radial glow sprite underneath */}
        <sprite ref={glowRef} position={[0, -1.1, 0]} scale={[4, 2, 1]}>
          <spriteMaterial map={glowTex} transparent opacity={0.3} depthWrite={false} />
        </sprite>

        {/* Inclusion slivers inside crystal volume */}
        <instancedMesh
          ref={inclusionRef}
          args={[_inclusionGeo, undefined, INCLUSION_COUNT]}
          frustumCulled={false}
        >
          <meshStandardMaterial
            color="#dceef5"
            emissive="#b8d8e8"
            emissiveIntensity={0.3}
            transparent
            opacity={0.5}
            roughness={0.3}
            depthWrite={false}
          />
        </instancedMesh>

        {/* Hero logo inside the intact crystal (cycles, faces the camera) */}
        {heroLogos[0] && (
          <mesh ref={heroLogoRef} geometry={heroLogos[0].geometry}>
            <meshStandardMaterial
              color={logoLook.color}
              emissive={logoLook.emissive}
              emissiveIntensity={logoLook.emissiveIntensity}
              roughness={logoLook.roughness}
              metalness={logoLook.metalness}
              envMapIntensity={logoLook.envMapIntensity}
              transparent
              opacity={1}
            />
          </mesh>
        )}

        {/* Ghost of the hero logo drawn over the glass for legibility */}
        {heroLogos[0] && (
          <mesh
            ref={heroGhostRef}
            geometry={heroLogos[0].geometry}
            renderOrder={GHOST_RENDER_ORDER}
            frustumCulled={false}
          >
            <meshBasicMaterial
              color={logoLook.ghost}
              transparent
              opacity={GHOST_OPACITY}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        )}

        {/* Merged (intact) crystal */}
        <mesh ref={mergedRef} geometry={intactGeo}>
          <MeshTransmissionMaterial
            buffer={mergedFbo.texture}
            thickness={INTACT_THICKNESS}
            chromaticAberration={INTACT_CHROMATIC_ABERRATION}
            anisotropicBlur={GLASS_LOOK.anisotropicBlur}
            roughness={GLASS_LOOK.roughness}
            distortion={GLASS_LOOK.distortion}
            distortionScale={GLASS_LOOK.distortionScale}
            temporalDistortion={GLASS_LOOK.temporalDistortion}
            transmission={1}
            ior={GLASS_LOOK.ior}
            samples={GLASS_LOOK.samples}
            resolution={GLASS_LOOK.resolution}
            color={tint.color}
            attenuationColor={tint.attenuationColor}
            attenuationDistance={GLASS_LOOK.attenuationDistance}
            backside
            backsideThickness={GLASS_LOOK.backsideThickness}
            envMapIntensity={tint.envMapIntensity}
            normalMap={bakedNormalMap ?? frostNormalMap}
            normalScale={intactNormalScale}
          />
        </mesh>

        {/* Shards */}
        {shards.map((shard, i) => (
          <mesh
            key={i}
            ref={(el) => { shardMeshRefs.current[i] = el; }}
            geometry={shard.geometry}
            position={shard.centroid.toArray() as [number, number, number]}
            visible={false}
          >
            <MeshTransmissionMaterial
              buffer={shardFbo.texture}
              thickness={SHARD_THICKNESS}
              chromaticAberration={GLASS_LOOK.chromaticAberration}
              anisotropicBlur={GLASS_LOOK.anisotropicBlur}
              roughness={GLASS_LOOK.roughness}
              distortion={GLASS_LOOK.distortion * 0.7}
              distortionScale={GLASS_LOOK.distortionScale}
              temporalDistortion={GLASS_LOOK.temporalDistortion}
              transmission={1}
              ior={GLASS_LOOK.ior}
              samples={6}
              resolution={SHARD_BACKDROP_PX}
              color={tint.color}
              attenuationColor={tint.attenuationColor}
              attenuationDistance={GLASS_LOOK.attenuationDistance}
              envMapIntensity={tint.envMapIntensity}
              normalMap={frostNormalMap}
              normalScale={shardNormalScale}
            />
          </mesh>
        ))}

        {/* Shard logos: one per large shard, each a different icon, with a
            ghost copy over the glass like the hero logo */}
        {unitLogos[0] &&
          shardLogoSlots.map((slot) => (
            <group key={`slot-${slot.rank}`}>
              <mesh
                ref={(el) => { shardLogoRefs.current[slot.rank] = el; }}
                geometry={unitLogos[0].geometry}
                renderOrder={SHARD_LOGO_RENDER_ORDER}
                frustumCulled={false}
                visible={false}
              >
                <meshStandardMaterial
                  color={logoLook.color}
                  emissive={logoLook.emissive}
                  emissiveIntensity={logoLook.emissiveIntensity}
                  roughness={logoLook.roughness}
                  metalness={logoLook.metalness}
                  envMapIntensity={logoLook.envMapIntensity}
                  transparent
                  opacity={0}
                  depthTest={false}
                  depthWrite={false}
                />
              </mesh>
              <mesh
                ref={(el) => { shardGhostRefs.current[slot.rank] = el; }}
                geometry={unitLogos[0].geometry}
                renderOrder={GHOST_RENDER_ORDER}
                frustumCulled={false}
                visible={false}
              >
                <meshBasicMaterial
                  color={logoLook.ghost}
                  transparent
                  opacity={0}
                  depthTest={false}
                  depthWrite={false}
                />
              </mesh>
            </group>
          ))}
      </group>
    );
  },
);

useGLTF.preload("/models/crystal.glb");

export default GlassCrystal;
