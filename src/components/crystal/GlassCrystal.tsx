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

function buildRefNormals(): THREE.Vector3[] {
  const ref = new THREE.IcosahedronGeometry(1, 0).toNonIndexed();
  const rp = ref.attributes.position;
  const normals: THREE.Vector3[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < rp.count / 3; t++) {
    a.fromBufferAttribute(rp, t * 3);
    b.fromBufferAttribute(rp, t * 3 + 1);
    c.fromBufferAttribute(rp, t * 3 + 2);
    normals.push(
      new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize()
    );
  }
  ref.dispose();
  return normals;
}

const REF_NORMALS = buildRefNormals();

export function useGlassCrystalShards(detail = 5): ShardData[] {
  return useMemo(() => {
    const indexed = new THREE.IcosahedronGeometry(1.4, detail);
    const geo = indexed.toNonIndexed();
    indexed.dispose();

    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    const SX = 1.2, SY = 1.0, SZ = 0.9;
    const chipDir = new THREE.Vector3(0.6, -0.4, 0.55).normalize();
    const tilt = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1), 0.12
    );

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.x *= SX; v.y *= SY; v.z *= SZ;
      v.applyQuaternion(tilt);
      const dir = v.clone().normalize();
      const r = v.length();

      const n1 = noise3(dir.x * 0.7, dir.y * 0.7, dir.z * 0.7);
      const n2 = noise3(dir.x * 1.3 + 5.0, dir.y * 1.3 + 2.0, dir.z * 1.3 + 8.0);
      const raw1 = noise3(dir.x * 2.4 + 7.3, dir.y * 2.4 + 3.1, dir.z * 2.4 + 1.7);
      const ridged1 = 1 - Math.abs(raw1 * 2 - 1);
      const raw2 = noise3(dir.x * 5.5 + 13.7, dir.y * 5.5 + 9.2, dir.z * 5.5 + 5.8);
      const ridged2 = 1 - Math.abs(raw2 * 2 - 1);

      const chipDot = dir.dot(chipDir);
      const chipMask = Math.max(0, chipDot - 0.6) / 0.4;
      const chipNoise = noise3(dir.x * 9 + 20, dir.y * 9 + 20, dir.z * 9 + 20);

      const displacement =
        (n1 - 0.5) * 0.5 +
        (n2 - 0.5) * 0.3 +
        ridged1 * 0.12 +
        ridged2 * 0.05 +
        chipMask * (chipNoise - 0.5) * 0.4;

      v.copy(dir).multiplyScalar(r + displacement);
      pos.setXYZ(i, v.x, v.y, v.z);
    }

    geo.computeVertexNormals();
    const normals = geo.attributes.normal;
    const fn = new THREE.Vector3();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < pos.count / 3; t++) {
      const base = t * 3;
      a.fromBufferAttribute(pos, base);
      b.fromBufferAttribute(pos, base + 1);
      c.fromBufferAttribute(pos, base + 2);
      fn.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();

      let bestDot = -Infinity;
      let bestIdx = 0;
      for (let ri = 0; ri < REF_NORMALS.length; ri++) {
        const d = fn.dot(REF_NORMALS[ri]);
        if (d > bestDot) { bestDot = d; bestIdx = ri; }
      }
      const qn = REF_NORMALS[bestIdx];
      normals.setXYZ(base, qn.x, qn.y, qn.z);
      normals.setXYZ(base + 1, qn.x, qn.y, qn.z);
      normals.setXYZ(base + 2, qn.x, qn.y, qn.z);
    }

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
    const va = new THREE.Vector3();
    const vb = new THREE.Vector3();
    const vc = new THREE.Vector3();
    const triCenter = new THREE.Vector3();

    for (let t = 0; t < triCount; t++) {
      const base = t * 3;
      va.fromBufferAttribute(pos, base);
      vb.fromBufferAttribute(pos, base + 1);
      vc.fromBufferAttribute(pos, base + 2);
      triCenter.copy(va).add(vb).add(vc).divideScalar(3).normalize();

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

interface GlassCrystalProps {
  buffer?: THREE.Texture;
  detail?: number;
}

const GlassCrystal = forwardRef<THREE.Group, GlassCrystalProps>(function GlassCrystal({ buffer, detail = 5 }, ref) {
  const shards = useGlassCrystalShards(detail);

  return (
    <group ref={ref}>
      {shards.map((shard, i) => (
        <mesh
          key={i}
          geometry={shard.geometry}
          position={shard.centroid.toArray() as [number, number, number]}
        >
          <MeshTransmissionMaterial
            buffer={buffer}
            thickness={0.6}
            chromaticAberration={0.03}
            anisotropicBlur={0.4}
            roughness={0.03}
            distortion={0}
            distortionScale={0}
            temporalDistortion={0}
            transmission={1}
            ior={1.15}
            samples={16}
            resolution={1024}
            color="#ffffff"
            attenuationColor="#eaf0f6"
            attenuationDistance={6}
            backside
            backsideThickness={0.2}
            envMapIntensity={2.5}
          />
        </mesh>
      ))}
    </group>
  );
});

export default GlassCrystal;
