"use client";

import { forwardRef, useMemo } from "react";
import { MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

/* ── Seeded PRNG ───────────────────────────────────────────────── */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── 3D value noise ────────────────────────────────────────────── */

function hash(n: number) {
  const s = Math.sin(n) * 43758.5453;
  return s - Math.floor(s);
}

function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const fx = x - ix,
    fy = y - iy,
    fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const n = ix + iy * 157 + iz * 113;
  return (
    hash(n) * (1 - ux) * (1 - uy) * (1 - uz) +
    hash(n + 1) * ux * (1 - uy) * (1 - uz) +
    hash(n + 157) * (1 - ux) * uy * (1 - uz) +
    hash(n + 158) * ux * uy * (1 - uz) +
    hash(n + 113) * (1 - ux) * (1 - uy) * uz +
    hash(n + 114) * ux * (1 - uy) * uz +
    hash(n + 270) * (1 - ux) * uy * uz +
    hash(n + 271) * ux * uy * uz
  );
}

/* ── Types ─────────────────────────────────────────────────────── */

const SHARD_COUNT = 18;
const SEED = 3131;

export interface ShardData {
  geometry: THREE.BufferGeometry;
  centroid: THREE.Vector3;
  direction: THREE.Vector3;
  tumbleAxis: THREE.Vector3;
  delay: number;
}

/* ── Hook: generate Voronoi-fractured shards ───────────────────── */

export function useGlassCrystalShards(detail = 5): ShardData[] {
  return useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1.4, detail);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const dir = v.clone().normalize();
      const n1 = noise3(dir.x * 1.8, dir.y * 1.8, dir.z * 1.8);
      const raw = noise3(
        dir.x * 4.5 + 7.3,
        dir.y * 4.5 + 3.1,
        dir.z * 4.5 + 1.7
      );
      const ridged = 1 - Math.abs(raw * 2 - 1);
      const displacement = (n1 - 0.5) * 0.35 + ridged * 0.12;
      v.copy(dir).multiplyScalar(1.4 + displacement);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();

    const rng = seededRandom(SEED);
    const seeds: THREE.Vector3[] = [];
    for (let i = 0; i < SHARD_COUNT; i++) {
      const theta = Math.acos(2 * rng() - 1);
      const phi = 2 * Math.PI * rng();
      seeds.push(
        new THREE.Vector3(
          Math.sin(theta) * Math.cos(phi),
          Math.sin(theta) * Math.sin(phi),
          Math.cos(theta)
        )
      );
    }

    const triCount = pos.count / 3;
    const assignments = new Int32Array(triCount);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const triCenter = new THREE.Vector3();

    for (let t = 0; t < triCount; t++) {
      const base = t * 3;
      a.fromBufferAttribute(pos, base);
      b.fromBufferAttribute(pos, base + 1);
      c.fromBufferAttribute(pos, base + 2);
      triCenter.copy(a).add(b).add(c).divideScalar(3).normalize();

      let best = 0;
      let bestDist = Infinity;
      for (let s = 0; s < seeds.length; s++) {
        const d = triCenter.distanceToSquared(seeds[s]);
        if (d < bestDist) {
          bestDist = d;
          best = s;
        }
      }
      assignments[t] = best;
    }

    const srcNormals = geo.attributes.normal;
    const shards: ShardData[] = [];

    for (let s = 0; s < SHARD_COUNT; s++) {
      const verts: number[] = [];
      const norms: number[] = [];

      for (let t = 0; t < triCount; t++) {
        if (assignments[t] !== s) continue;
        const base = t * 3;
        for (let vi = 0; vi < 3; vi++) {
          const idx = base + vi;
          verts.push(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
          norms.push(
            srcNormals.getX(idx),
            srcNormals.getY(idx),
            srcNormals.getZ(idx)
          );
        }
      }

      if (verts.length === 0) continue;

      const centroid = new THREE.Vector3();
      const vertCount = verts.length / 3;
      for (let i = 0; i < verts.length; i += 3) {
        centroid.x += verts[i];
        centroid.y += verts[i + 1];
        centroid.z += verts[i + 2];
      }
      centroid.divideScalar(vertCount);

      for (let i = 0; i < verts.length; i += 3) {
        verts[i] -= centroid.x;
        verts[i + 1] -= centroid.y;
        verts[i + 2] -= centroid.z;
      }

      const shardGeo = new THREE.BufferGeometry();
      shardGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(verts, 3)
      );
      shardGeo.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(norms, 3)
      );

      const direction = centroid.clone().normalize();
      const tumbleAxis = new THREE.Vector3(
        rng() - 0.5,
        rng() - 0.5,
        rng() - 0.5
      ).normalize();
      const delay = rng() * 0.3;

      shards.push({ geometry: shardGeo, centroid, direction, tumbleAxis, delay });
    }

    geo.dispose();
    return shards;
  }, [detail]);
}

/* ── Component: assembled glass crystal ────────────────────────── */

const GlassCrystal = forwardRef<THREE.Group>(function GlassCrystal(_, ref) {
  const shards = useGlassCrystalShards(5);

  return (
    <group ref={ref}>
      {shards.map((shard, i) => (
        <mesh
          key={i}
          geometry={shard.geometry}
          position={shard.centroid.toArray() as [number, number, number]}
        >
          <MeshTransmissionMaterial
            thickness={2.0}
            chromaticAberration={0.4}
            anisotropicBlur={0.3}
            roughness={0.08}
            distortion={0.3}
            distortionScale={0.25}
            temporalDistortion={0.08}
            transmission={1}
            ior={1.3}
            samples={8}
            resolution={1024}
            color="#f0f4fa"
            backside
            backsideThickness={0.6}
          />
        </mesh>
      ))}
    </group>
  );
});

export default GlassCrystal;
