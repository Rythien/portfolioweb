"use client";

import { forwardRef, useMemo } from "react";
import { MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { useFractureStore } from "@/store/useFractureStore";

/* ── Seeded PRNG ───────────────────────────────────────────────── */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── Types ─────────────────────────────────────────────────────── */

const DEFAULT_SEED = 3131;
const SHARD_COUNT = 16;
const R = 1.4;
const SCALE = new THREE.Vector3(1.2, 1.0, 0.9);

interface HalfPlane {
  n: THREE.Vector3;
  d: number;
}

export interface ShardData {
  geometry: THREE.BufferGeometry;
  centroid: THREE.Vector3;
  direction: THREE.Vector3;
  tumbleAxis: THREE.Vector3;
  delay: number;
}

/* ── 3×3 Cramer solve: n_i · p = d_i for three planes ────────── */

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

/* ── Half-space intersection: vertices of ∩{ n_k·p ≤ d_k } ──── */

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

/* ── Generate deterministic rock planes from seed ────────────── */

function buildRockPlanes(seed: number): HalfPlane[] {
  const rng = seededRandom(seed);
  const count = 16 + Math.floor(rng() * 7);
  const planes: HalfPlane[] = [];

  for (let i = 0; i < count; i++) {
    const theta = Math.acos(2 * rng() - 1);
    const phi = 2 * Math.PI * rng();
    const n = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.sin(theta) * Math.sin(phi),
      Math.cos(theta),
    );
    const isCleavage = i < 3;
    const d = isCleavage
      ? R * (0.55 + rng() * 0.1)
      : R * (0.85 + rng() * 0.25);
    planes.push({ n, d });
  }

  return planes;
}

/* ── Build merged rock geometry ──────────────────────────────── */

function buildRockGeo(seed: number): THREE.BufferGeometry {
  const planes = buildRockPlanes(seed);
  const verts = solveHalfSpaces(planes);

  if (verts.length < 4) {
    const fb = new THREE.IcosahedronGeometry(1.2, 1);
    const g = fb.toNonIndexed();
    fb.dispose();
    g.computeVertexNormals();
    return g;
  }

  for (const v of verts) v.multiply(SCALE);

  const convex = new ConvexGeometry(verts);
  const geo = convex.toNonIndexed();
  convex.dispose();
  geo.computeVertexNormals();
  return geo;
}

/* ── Build Voronoi shards from bisector planes ───────────────── */

function buildShards(seed: number): ShardData[] {
  const planes = buildRockPlanes(seed);
  const rng = seededRandom(seed + 5555);

  const shardSeeds: THREE.Vector3[] = [];
  for (let i = 0; i < SHARD_COUNT; i++) {
    const theta = Math.acos(2 * rng() - 1);
    const phi = 2 * Math.PI * rng();
    const r = 0.2 + rng() * 0.5;
    shardSeeds.push(
      new THREE.Vector3(
        r * Math.sin(theta) * Math.cos(phi),
        r * Math.sin(theta) * Math.sin(phi),
        r * Math.cos(theta),
      ),
    );
  }

  const shards: ShardData[] = [];

  for (let i = 0; i < SHARD_COUNT; i++) {
    const shardPlanes: HalfPlane[] = planes.map((p) => ({
      n: p.n.clone(),
      d: p.d,
    }));

    for (let j = 0; j < SHARD_COUNT; j++) {
      if (i === j) continue;
      const diff = new THREE.Vector3().subVectors(shardSeeds[j], shardSeeds[i]);
      const len = diff.length();
      if (len < 1e-10) continue;
      const n = diff.clone().divideScalar(len);
      const mid = new THREE.Vector3()
        .addVectors(shardSeeds[i], shardSeeds[j])
        .multiplyScalar(0.5);
      const d = n.dot(mid);
      shardPlanes.push({ n, d });
    }

    const verts = solveHalfSpaces(shardPlanes);
    if (verts.length < 4) continue;

    for (const v of verts) v.multiply(SCALE);

    const convex = new ConvexGeometry(verts);
    const geo = convex.toNonIndexed();
    convex.dispose();
    geo.computeVertexNormals();

    const pos = geo.attributes.position;
    const centroid = new THREE.Vector3();
    for (let v = 0; v < pos.count; v++) {
      centroid.x += pos.getX(v);
      centroid.y += pos.getY(v);
      centroid.z += pos.getZ(v);
    }
    centroid.divideScalar(pos.count);

    for (let v = 0; v < pos.count; v++) {
      pos.setXYZ(
        v,
        pos.getX(v) - centroid.x,
        pos.getY(v) - centroid.y,
        pos.getZ(v) - centroid.z,
      );
    }
    pos.needsUpdate = true;

    const direction = centroid.clone().normalize();
    const tumbleAxis = new THREE.Vector3(
      rng() - 0.5,
      rng() - 0.5,
      rng() - 0.5,
    ).normalize();
    const delay = rng() * 0.3;

    shards.push({ geometry: geo, centroid, direction, tumbleAxis, delay });
  }

  return shards;
}

/* ── Hooks ───────────────────────────────────────────────────── */

export function useRockGeo(seed = DEFAULT_SEED) {
  return useMemo(() => buildRockGeo(seed), [seed]);
}

export function useRockShards(seed = DEFAULT_SEED) {
  return useMemo(() => buildShards(seed), [seed]);
}

/* ── Material presets per variant ─────────────────────────────── */

const WAKE_TINT = {
  color: "#ffffff",
  attenuationColor: "#eaf0f6",
  envMapIntensity: 0.8,
} as const;

const DREAM_TINT = {
  color: "#c4b5fd",
  attenuationColor: "#b4a0e8",
  envMapIntensity: 1.0,
} as const;

/* ── Component ───────────────────────────────────────────────── */

interface GlassCrystalProps {
  buffer?: THREE.Texture;
  seed?: number;
  variant?: "wake" | "dream";
}

const GlassCrystal = forwardRef<THREE.Group, GlassCrystalProps>(
  function GlassCrystal({ buffer, seed = DEFAULT_SEED, variant = "wake" }, ref) {
    const geo = useRockGeo(seed);
    const shards = useRockShards(seed);
    const burst = useFractureStore((s) => s.burst);
    const tint = variant === "dream" ? DREAM_TINT : WAKE_TINT;

    return (
      <group ref={ref}>
        {!burst && (
          <mesh geometry={geo}>
            <MeshTransmissionMaterial
              buffer={buffer}
              thickness={1.5}
              chromaticAberration={0.06}
              anisotropicBlur={0.1}
              roughness={0.03}
              distortion={0.15}
              distortionScale={0.2}
              temporalDistortion={0}
              transmission={1}
              ior={1.3}
              samples={8}
              resolution={768}
              color={tint.color}
              attenuationColor={tint.attenuationColor}
              attenuationDistance={4}
              backside
              backsideThickness={0.3}
              envMapIntensity={tint.envMapIntensity}
            />
          </mesh>
        )}
        {burst &&
          shards.map((shard, i) => (
            <mesh
              key={i}
              geometry={shard.geometry}
              position={shard.centroid.toArray() as [number, number, number]}
            >
              <MeshTransmissionMaterial
                buffer={buffer}
                thickness={1.0}
                chromaticAberration={0.04}
                anisotropicBlur={0.08}
                roughness={0.04}
                distortion={0.1}
                distortionScale={0.15}
                temporalDistortion={0}
                transmission={1}
                ior={1.3}
                samples={4}
                resolution={512}
                color={tint.color}
                attenuationColor={tint.attenuationColor}
                attenuationDistance={4}
                backside
                backsideThickness={0.2}
                envMapIntensity={tint.envMapIntensity}
              />
            </mesh>
          ))}
      </group>
    );
  },
);

export default GlassCrystal;
