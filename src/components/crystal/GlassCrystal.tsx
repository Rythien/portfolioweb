"use client";

import { forwardRef, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MeshTransmissionMaterial, useFBO } from "@react-three/drei";
import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { useFractureStore } from "@/store/useFractureStore";
import { getCrystalPose } from "@/hooks/useCrystalPose";
import { useCrystalSound } from "@/hooks/useCrystalSound";
import {
  subdivideNonIndexed,
  displaceAlongNormals,
  generateSphericalUVs,
  createFrostNormalMap,
  createGlowTexture,
} from "./frostUtils";
import { getHeroLogo, getShardLogos, type LogoData } from "./logoGeometry";

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

  if (!planes) {
    const fb = new THREE.IcosahedronGeometry(1.2, 1);
    const g = fb.toNonIndexed();
    fb.dispose();
    g.computeVertexNormals();
    return { rockGeo: g, shards: [] };
  }

  const rockV = solveHalfSpaces(planes);
  if (rockV.length < 8) {
    const fb = new THREE.IcosahedronGeometry(1.2, 1);
    const g = fb.toNonIndexed();
    fb.dispose();
    g.computeVertexNormals();
    return { rockGeo: g, shards: [] };
  }

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
  const rawRock = rockConvex.toNonIndexed();
  rockConvex.dispose();

  const rockSub = subdivideNonIndexed(rawRock, SUBDIV_LEVELS_ROCK);
  rawRock.dispose();
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
  let idx = 0;

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
    const rawShard = sConvex.toNonIndexed();
    sConvex.dispose();
    const geo = subdivideNonIndexed(rawShard, SUBDIV_LEVELS_SHARD);
    rawShard.dispose();
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
    const driftCenter = new THREE.Vector3(
      -2.5 + (idx / Math.max(SHARD_COUNT - 1, 1)) * 4,
      (animRng() - 0.5) * 3,
      (animRng() - 0.5) * 2,
    );
    const lissFreq = new THREE.Vector3(
      0.2 + animRng() * 0.3, 0.15 + animRng() * 0.25, 0.1 + animRng() * 0.2,
    );
    const lissPhase = new THREE.Vector3(
      animRng() * TWO_PI, animRng() * TWO_PI, animRng() * TWO_PI,
    );
    const lissAmp = new THREE.Vector3(
      0.5 + animRng() * 1.0, 0.3 + animRng() * 0.8, 0.2 + animRng() * 0.5,
    );

    shards.push({
      geometry: geo, centroid, direction, tumbleAxis, tumbleSpeed,
      driftCenter, lissFreq, lissPhase, lissAmp,
    });
    idx++;
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
  anisotropicBlur: 0.2,
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
    useCrystalSound();

    const frostNormalMap = useMemo(() => createFrostNormalMap(256), []);
    const glowTex = useMemo(() => createGlowTexture(128), []);
    const inclusions = useMemo(() => buildInclusions(seed, INCLUSION_COUNT, R), [seed]);
    const heroLogo = useMemo(() => getHeroLogo(), []);
    const shardLogos = useMemo(() => getShardLogos(shards.length), [shards.length]);

    const { scene: portalScene, camera: portalCamera } = useThree();
    const mergedRef = useRef<THREE.Mesh>(null);
    const heroLogoRef = useRef<THREE.Mesh>(null);
    const shardLogoRefs = useRef<(THREE.Mesh | null)[]>([]);
    const shardMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
    const inclusionRef = useRef<THREE.InstancedMesh>(null);
    const glowRef = useRef<THREE.Sprite>(null);
    const showShardsRef = useRef(false);
    const _invQ = useRef(new THREE.Quaternion());
    const _off = useRef(new THREE.Vector3());
    const mergedFbo = useFBO(1024, 1024, { depthBuffer: true });
    const shardFbo = useFBO(512, 512, { depthBuffer: true });

    useEffect(() => {
      if (!inclusionRef.current) return;
      for (let i = 0; i < inclusions.length; i++) {
        inclusionRef.current.setMatrixAt(i, inclusions[i].matrix);
      }
      inclusionRef.current.instanceMatrix.needsUpdate = true;
    }, [inclusions]);

    useFrame((state) => {
      if (!active) {
        if (mergedRef.current) mergedRef.current.visible = false;
        if (heroLogoRef.current) heroLogoRef.current.visible = false;
        if (inclusionRef.current) inclusionRef.current.visible = false;
        if (glowRef.current) glowRef.current.visible = false;
        for (let i = 0; i < shards.length; i++) {
          const m = shardMeshRefs.current[i];
          if (m) m.visible = false;
          const sl = shardLogoRefs.current[i];
          if (sl) sl.visible = false;
        }
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
        if (iMat) iMat.opacity = 1 - crossfade;
      }

      if (glowRef.current) {
        glowRef.current.visible = !mergedHidden;
        const sMat = glowRef.current.material as THREE.SpriteMaterial;
        if (sMat) sMat.opacity = (0.3 + Math.sin(elapsed * 0.8) * 0.08) * (1 - crossfade);
      }

      // Hero logo visible when intact, fades with crossfade
      if (heroLogoRef.current) {
        heroLogoRef.current.visible = !mergedHidden;
        const hMat = heroLogoRef.current.material as THREE.MeshStandardMaterial;
        if (hMat) hMat.opacity = (0.6 - crossfade * 0.6);
      }

      if (mergedRef.current) {
        mergedRef.current.visible = !mergedHidden;
        const mat = mergedRef.current.material as THREE.MeshPhysicalMaterial;
        if (mat) {
          mat.visible = !mergedHidden;
          if (!mergedHidden) {
            mat.opacity = 1 - crossfade;
            mat.transparent = crossfade > 0;
          }
        }
      }

      // Render refraction backdrop for merged mesh
      if (mergedRef.current?.visible) {
        mergedRef.current.visible = false;
        state.gl.setRenderTarget(mergedFbo);
        state.gl.clear();
        state.gl.render(portalScene, portalCamera);
        state.gl.setRenderTarget(null);
        mergedRef.current.visible = true;
      }

      // Render shared backdrop FBO for shard transmission
      if (showShards) {
        for (let i = 0; i < shards.length; i++) {
          const m = shardMeshRefs.current[i];
          if (m) m.visible = false;
        }
        state.gl.setRenderTarget(shardFbo);
        state.gl.clear();
        state.gl.render(portalScene, portalCamera);
        state.gl.setRenderTarget(null);
        for (let i = 0; i < shards.length; i++) {
          const m = shardMeshRefs.current[i];
          if (m) m.visible = true;
        }
      }

      const gs = pose.scale || 0.5;
      _invQ.current.setFromEuler(new THREE.Euler(pose.rotX, pose.rotY, 0));
      _invQ.current.invert();
      const explosionFade = 1 - smoothstep(0.3, 0.8, breakVal);
      const driftFade = smoothstep(0.1, 0.5, breakVal);
      const spreadDist = breakVal * 2.0 * explosionFade;

      for (let i = 0; i < shards.length; i++) {
        const mesh = shardMeshRefs.current[i];
        if (!mesh) continue;

        const logoMesh = shardLogoRefs.current[i];
        mesh.visible = showShards;
        if (logoMesh) logoMesh.visible = showShards;
        if (!showShards) continue;

        const shardOpacity = smoothstep(0.05, 0.15, breakVal);
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

        const tumbleFade = smoothstep(0.02, 0.15, breakVal);
        const tumbleAngle = tumbleFade *
          (breakVal * Math.PI + elapsed * s.tumbleSpeed * Math.min(breakVal * 2, 1));
        mesh.quaternion.setFromAxisAngle(s.tumbleAxis, tumbleAngle);

        // Sync shard logo position + rotation
        if (logoMesh) {
          logoMesh.position.copy(mesh.position);
          logoMesh.quaternion.copy(mesh.quaternion);
          const lMat = logoMesh.material as THREE.MeshStandardMaterial;
          if (lMat) lMat.opacity = shardOpacity * 0.55;
        }
      }
    });

    const normalScale = useMemo(() => new THREE.Vector2(0.4, 0.4), []);

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

        {/* Hero logo inside intact crystal */}
        {heroLogo && (
          <mesh ref={heroLogoRef} geometry={heroLogo.geometry}>
            <meshStandardMaterial
              color="#c0d8e8"
              emissive="#90b8d0"
              emissiveIntensity={0.25}
              transparent
              opacity={0.6}
              roughness={0.4}
              depthWrite={false}
            />
          </mesh>
        )}

        {/* Merged (intact) crystal */}
        <mesh ref={mergedRef} geometry={geo}>
          <MeshTransmissionMaterial
            buffer={mergedFbo.texture}
            thickness={GLASS_LOOK.thickness}
            chromaticAberration={GLASS_LOOK.chromaticAberration}
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
            normalMap={frostNormalMap}
            normalScale={normalScale}
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
              thickness={GLASS_LOOK.thickness * 0.8}
              chromaticAberration={GLASS_LOOK.chromaticAberration}
              anisotropicBlur={GLASS_LOOK.anisotropicBlur}
              roughness={GLASS_LOOK.roughness}
              distortion={GLASS_LOOK.distortion * 0.7}
              distortionScale={GLASS_LOOK.distortionScale}
              temporalDistortion={GLASS_LOOK.temporalDistortion}
              transmission={1}
              ior={GLASS_LOOK.ior}
              samples={6}
              resolution={512}
              color={tint.color}
              attenuationColor={tint.attenuationColor}
              attenuationDistance={GLASS_LOOK.attenuationDistance}
              envMapIntensity={tint.envMapIntensity}
              normalMap={frostNormalMap}
              normalScale={normalScale}
            />
          </mesh>
        ))}

        {/* Shard logos (one per shard, follow shard motion) */}
        {shardLogos.map((logo, i) =>
          logo ? (
            <mesh
              key={`logo-${i}`}
              ref={(el) => { shardLogoRefs.current[i] = el; }}
              geometry={logo.geometry}
              visible={false}
            >
              <meshStandardMaterial
                color="#c0d8e8"
                emissive="#90b8d0"
                emissiveIntensity={0.2}
                transparent
                opacity={0.55}
                roughness={0.4}
                depthWrite={false}
              />
            </mesh>
          ) : null,
        )}
      </group>
    );
  },
);

export default GlassCrystal;
