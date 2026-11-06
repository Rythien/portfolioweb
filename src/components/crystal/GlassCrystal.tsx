"use client";

import { forwardRef, useMemo } from "react";
import { MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";

/* ── Seeded PRNG ───────────────────────────────────────────────── */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── Types ─────────────────────────────────────────────────────── */

const SHARD_COUNT = 18;
const DEFAULT_SEED = 3131;

export interface ShardData {
  geometry: THREE.BufferGeometry;
  centroid: THREE.Vector3;
  direction: THREE.Vector3;
  tumbleAxis: THREE.Vector3;
  delay: number;
}

/* ── Build convex-hull crystal geometry ────────────────────────── */

function clipByPlane(
  geo: THREE.BufferGeometry,
  plane: THREE.Plane,
): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const outV: number[] = [];
  const outN: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3();

  for (let t = 0; t < pos.count / 3; t++) {
    const base = t * 3;
    a.fromBufferAttribute(pos, base);
    b.fromBufferAttribute(pos, base + 1);
    c.fromBufferAttribute(pos, base + 2);
    if (plane.distanceToPoint(a) > 0 && plane.distanceToPoint(b) > 0 && plane.distanceToPoint(c) > 0) continue;
    na.fromBufferAttribute(nrm, base);
    nb.fromBufferAttribute(nrm, base + 1);
    nc.fromBufferAttribute(nrm, base + 2);
    outV.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    outN.push(na.x, na.y, na.z, nb.x, nb.y, nb.z, nc.x, nc.y, nc.z);
  }

  const kept = new THREE.BufferGeometry();
  kept.setAttribute("position", new THREE.Float32BufferAttribute(outV, 3));
  kept.setAttribute("normal", new THREE.Float32BufferAttribute(outN, 3));

  // Cap: collect vertices on the positive side of the plane to form a cap face
  const capPts: THREE.Vector3[] = [];
  for (let i = 0; i < outV.length; i += 3) {
    const p = new THREE.Vector3(outV[i], outV[i+1], outV[i+2]);
    if (Math.abs(plane.distanceToPoint(p)) < 0.15) capPts.push(p);
  }

  if (capPts.length >= 3) {
    // Project cap points to plane, re-hull as fan from centroid
    const center = new THREE.Vector3();
    for (const p of capPts) center.add(p);
    center.divideScalar(capPts.length);

    const planeNormal = plane.normal.clone();
    const up = Math.abs(planeNormal.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
    const tangent = new THREE.Vector3().crossVectors(planeNormal, up).normalize();
    const bitangent = new THREE.Vector3().crossVectors(planeNormal, tangent);

    const sorted = capPts
      .map(p => {
        const d = p.clone().sub(center);
        return { p, angle: Math.atan2(d.dot(bitangent), d.dot(tangent)) };
      })
      .sort((a, b) => a.angle - b.angle);

    const capV: number[] = [];
    const capN: number[] = [];
    for (let i = 1; i < sorted.length - 1; i++) {
      const p0 = sorted[0].p, p1 = sorted[i].p, p2 = sorted[i+1].p;
      capV.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      capN.push(
        -planeNormal.x, -planeNormal.y, -planeNormal.z,
        -planeNormal.x, -planeNormal.y, -planeNormal.z,
        -planeNormal.x, -planeNormal.y, -planeNormal.z,
      );
    }

    const combined = new THREE.BufferGeometry();
    const allV = new Float32Array(outV.length + capV.length);
    allV.set(outV); allV.set(capV, outV.length);
    const allN = new Float32Array(outN.length + capN.length);
    allN.set(outN); allN.set(capN, outN.length);
    combined.setAttribute("position", new THREE.BufferAttribute(allV, 3));
    combined.setAttribute("normal", new THREE.BufferAttribute(allN, 3));
    geo.dispose();
    kept.dispose();
    return combined;
  }

  geo.dispose();
  return kept;
}

function buildCrystalGeo(seed: number): THREE.BufferGeometry {
  const rng = seededRandom(seed);
  const SX = 1.25, SY = 1.0, SZ = 0.9;
  const BASE_R = 1.4;
  const points: THREE.Vector3[] = [];

  for (let i = 0; i < 50; i++) {
    const theta = Math.acos(2 * rng() - 1);
    const phi = 2 * Math.PI * rng();
    const jitter = 0.8 + rng() * 0.4;
    const r = BASE_R * jitter;
    points.push(new THREE.Vector3(
      r * Math.sin(theta) * Math.cos(phi) * SX,
      r * Math.sin(theta) * Math.sin(phi) * SY,
      r * Math.cos(theta) * SZ,
    ));
  }

  for (let i = 0; i < 4; i++) {
    const theta = Math.acos(2 * rng() - 1);
    const phi = 2 * Math.PI * rng();
    const r = BASE_R * (0.5 + rng() * 0.3);
    points.push(new THREE.Vector3(
      r * Math.sin(theta) * Math.cos(phi) * SX,
      r * Math.sin(theta) * Math.sin(phi) * SY,
      r * Math.cos(theta) * SZ,
    ));
  }

  const tilt = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1), 0.08 + rng() * 0.1
  );
  for (const p of points) p.applyQuaternion(tilt);

  const convex = new ConvexGeometry(points);
  let geo = convex.toNonIndexed();
  convex.dispose();

  // 2 cleavage planes shave corners to create large flat faces
  for (let i = 0; i < 2; i++) {
    const nx = rng() - 0.5, ny = rng() - 0.5, nz = rng() - 0.5;
    const normal = new THREE.Vector3(nx, ny, nz).normalize();
    const offset = 1.3 + rng() * 0.25;
    const plane = new THREE.Plane(normal, -offset);
    geo = clipByPlane(geo, plane);
  }

  geo.computeVertexNormals();
  return geo;
}

function buildQuartzGeo(): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const R = 1.0, H = 1.8, tipH = 1.0;

  // Hexagonal prism vertices (6 sides, top and bottom rings)
  for (let ring = 0; ring < 2; ring++) {
    const y = ring === 0 ? -H : H;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.15;
      const jitter = 0.92 + (Math.sin(i * 7.3 + ring * 3.1) * 0.5 + 0.5) * 0.16;
      points.push(new THREE.Vector3(
        Math.cos(angle) * R * jitter,
        y,
        Math.sin(angle) * R * jitter,
      ));
    }
  }

  // Pointed top: 6 tip vertices converging
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.15;
    const between = ((i + 0.5) / 6) * Math.PI * 2 + 0.15;
    const tipR = 0.15 + Math.sin(i * 4.7) * 0.08;
    points.push(new THREE.Vector3(
      Math.cos(between) * tipR,
      H + tipH * (0.7 + Math.sin(i * 2.3) * 0.3),
      Math.sin(between) * tipR,
    ));
  }
  // Apex
  points.push(new THREE.Vector3(0.05, H + tipH, -0.03));

  // Bottom flat (just a center point below)
  points.push(new THREE.Vector3(0, -H - 0.15, 0));

  const tilt = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0.3, 0, 1).normalize(), 0.25
  );
  for (const p of points) p.applyQuaternion(tilt);

  const convex = new ConvexGeometry(points);
  const geo = convex.toNonIndexed();
  convex.dispose();
  geo.computeVertexNormals();
  return geo;
}

/* ── Hook: generate Voronoi-fractured shards ───────────────────── */

export function useGlassCrystalShards(seed = DEFAULT_SEED, variant: "rock" | "quartz" = "rock"): ShardData[] {
  return useMemo(() => {
    const geo = variant === "quartz" ? buildQuartzGeo() : buildCrystalGeo(seed);
    const pos = geo.attributes.position;
    const srcNormals = geo.attributes.normal;

    const rng = seededRandom(seed + 7777);
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
  }, [seed, variant]);
}

/* ── Component: assembled glass crystal ────────────────────────── */

interface GlassCrystalProps {
  buffer?: THREE.Texture;
  seed?: number;
  variant?: "rock" | "quartz";
}

const GlassCrystal = forwardRef<THREE.Group, GlassCrystalProps>(function GlassCrystal({ buffer, seed = DEFAULT_SEED, variant = "rock" }, ref) {
  const shards = useGlassCrystalShards(seed, variant);

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
            envMapIntensity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
});

export default GlassCrystal;
