"use client";

import { forwardRef, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { useFractureStore } from "@/store/useFractureStore";
import { getCrystalPose } from "@/hooks/useCrystalPose";

/* ── Seeded PRNG ───────────────────────────────────────────────── */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── Constants ────────────────────────────────────────────────── */

const DEFAULT_SEED = 3131;
const SHARD_COUNT = 10;
const R = 1.4;
const SCALE = new THREE.Vector3(1.2, 1.0, 0.9);
const TWO_PI = Math.PI * 2;

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

/* ── Generate rock planes ────────────────────────────────────── */

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

/* ── Build Voronoi shards with Lissajous data ────────────────── */

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
      rng() - 0.5, rng() - 0.5, rng() - 0.5,
    ).normalize();
    const tumbleSpeed = 0.3 + rng() * 0.4;

    const driftCenter = new THREE.Vector3(
      -2.5 + (i / Math.max(SHARD_COUNT - 1, 1)) * 4,
      (rng() - 0.5) * 3,
      (rng() - 0.5) * 2,
    );
    const lissFreq = new THREE.Vector3(
      0.2 + rng() * 0.3,
      0.15 + rng() * 0.25,
      0.1 + rng() * 0.2,
    );
    const lissPhase = new THREE.Vector3(
      rng() * TWO_PI,
      rng() * TWO_PI,
      rng() * TWO_PI,
    );
    const lissAmp = new THREE.Vector3(
      0.5 + rng() * 1.0,
      0.3 + rng() * 0.8,
      0.2 + rng() * 0.5,
    );

    shards.push({
      geometry: geo,
      centroid,
      direction,
      tumbleAxis,
      tumbleSpeed,
      driftCenter,
      lissFreq,
      lissPhase,
      lissAmp,
    });
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

/* ── Material tints ──────────────────────────────────────────── */

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
  seed?: number;
  variant?: "wake" | "dream";
}

const GlassCrystal = forwardRef<THREE.Group, GlassCrystalProps>(
  function GlassCrystal({ seed = DEFAULT_SEED, variant = "wake" }, ref) {
    const geo = useRockGeo(seed);
    const shards = useRockShards(seed);
    const tint = variant === "dream" ? DREAM_TINT : WAKE_TINT;

    const mergedRef = useRef<THREE.Mesh>(null);
    const shardMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
    const showShardsRef = useRef(false);

    useFrame((state) => {
      const breakVal = useFractureStore.getState().breakVal;
      const elapsed = state.clock.elapsedTime;
      const pose = getCrystalPose();

      // Hysteresis for shard visibility
      if (!showShardsRef.current && breakVal >= 0.08) showShardsRef.current = true;
      if (showShardsRef.current && breakVal <= 0.05) showShardsRef.current = false;
      const showShards = showShardsRef.current;

      // Merged mesh visibility
      if (mergedRef.current) {
        mergedRef.current.visible = !showShards;
        const mat = mergedRef.current.material as THREE.Material;
        if (mat) mat.visible = !showShards;
      }

      // Shard animation
      const gs = pose.scale || 0.5;
      const explosionFade = 1 - smoothstep(0.3, 0.8, breakVal);
      const driftFade = smoothstep(0.1, 0.5, breakVal);
      const spreadDist = breakVal * 2.0 * explosionFade;

      for (let i = 0; i < shards.length; i++) {
        const mesh = shardMeshRefs.current[i];
        if (!mesh) continue;

        mesh.visible = showShards;
        const mat = mesh.material as THREE.Material;
        if (mat) mat.visible = showShards;

        if (!showShards) continue;

        const s = shards[i];

        // Lissajous world position
        const driftX = s.driftCenter.x
          + Math.sin(elapsed * s.lissFreq.x + s.lissPhase.x) * s.lissAmp.x;
        const driftY = s.driftCenter.y
          + Math.sin(elapsed * s.lissFreq.y + s.lissPhase.y) * s.lissAmp.y;
        const driftZ = s.driftCenter.z
          + Math.sin(elapsed * s.lissFreq.z + s.lissPhase.z) * s.lissAmp.z;

        // Mouse parallax (varies per shard)
        const mx = pose.mouseX * 0.15 * (1 + i * 0.05);
        const my = pose.mouseY * 0.08 * (1 + i * 0.05);

        // Convert drift world → group local
        const dlx = (driftX + mx - pose.x) / gs;
        const dly = (driftY + my - pose.y) / gs;
        const dlz = (driftZ - pose.z) / gs;

        // Position: lerp centroid → drift, plus explosion spread
        mesh.position.x = s.centroid.x
          + driftFade * (dlx - s.centroid.x)
          + s.direction.x * spreadDist;
        mesh.position.y = s.centroid.y
          + driftFade * (dly - s.centroid.y)
          + s.direction.y * spreadDist;
        mesh.position.z = s.centroid.z
          + driftFade * (dlz - s.centroid.z)
          + s.direction.z * spreadDist;

        // Tumble rotation
        const tumbleAngle =
          breakVal * Math.PI + elapsed * s.tumbleSpeed * Math.min(breakVal * 2, 1);
        mesh.quaternion.setFromAxisAngle(s.tumbleAxis, tumbleAngle);
      }
    });

    return (
      <group ref={ref}>
        {/* Merged crystal — always mounted, visibility toggled */}
        <mesh ref={mergedRef} geometry={geo}>
          <MeshTransmissionMaterial
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

        {/* Shards — always mounted, visibility toggled */}
        {shards.map((shard, i) => (
          <mesh
            key={i}
            ref={(el) => { shardMeshRefs.current[i] = el; }}
            geometry={shard.geometry}
            position={shard.centroid.toArray() as [number, number, number]}
            visible={false}
          >
            <MeshTransmissionMaterial
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
