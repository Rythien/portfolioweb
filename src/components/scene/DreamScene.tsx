"use client";

import { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial, Environment, Text } from "@react-three/drei";
import * as THREE from "three";
import { damp } from "maath/easing";
import { SITE_DATA } from "@/content/site";
import { useScrollStore, getSectionProgress } from "@/store/useScrollStore";

/* ── Seeded PRNG ───────────────────────────────────────────────── */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── 3D value noise for crystal displacement ───────────────────── */

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

/* ── Crystal geometry + Voronoi fracture ──────────────────────── */

interface ShardData {
  geometry: THREE.BufferGeometry;
  centroid: THREE.Vector3;
  direction: THREE.Vector3;
  delay: number;
}

function useCrystalShards(
  detail: number,
  shardCount: number,
  isMobile: boolean
): ShardData[] {
  return useMemo(() => {
    const d = isMobile ? Math.max(2, detail - 2) : detail;
    const geo = new THREE.IcosahedronGeometry(1.4, d);
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

    const rng = seededRandom(4242);
    const seeds: THREE.Vector3[] = [];
    for (let i = 0; i < shardCount; i++) {
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
    const centA = new THREE.Vector3();
    const centB = new THREE.Vector3();
    const centC = new THREE.Vector3();
    const triCenter = new THREE.Vector3();

    for (let t = 0; t < triCount; t++) {
      const base = t * 3;
      centA.fromBufferAttribute(pos, base);
      centB.fromBufferAttribute(pos, base + 1);
      centC.fromBufferAttribute(pos, base + 2);
      triCenter
        .copy(centA)
        .add(centB)
        .add(centC)
        .divideScalar(3)
        .normalize();

      let best = 0;
      let bestDist = Infinity;
      for (let s = 0; s < seeds.length; s++) {
        const dist = triCenter.distanceToSquared(seeds[s]);
        if (dist < bestDist) {
          bestDist = dist;
          best = s;
        }
      }
      assignments[t] = best;
    }

    const srcNormals = geo.attributes.normal;
    const shards: ShardData[] = [];

    for (let s = 0; s < shardCount; s++) {
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

      const shardGeo = new THREE.BufferGeometry();
      shardGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(verts, 3)
      );
      shardGeo.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(norms, 3)
      );

      const centroid = new THREE.Vector3();
      for (let i = 0; i < verts.length; i += 3) {
        centroid.x += verts[i];
        centroid.y += verts[i + 1];
        centroid.z += verts[i + 2];
      }
      centroid.divideScalar(verts.length / 3);

      const direction = centroid.clone().normalize();
      const delay = rng() * 0.3;

      shards.push({ geometry: shardGeo, centroid, direction, delay });
    }

    geo.dispose();
    return shards;
  }, [detail, shardCount, isMobile]);
}

/* ── Spline paths for dream crystal scroll choreography ────────── */

const crystalSpline = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(1.2, -0.6, -0.8),
  new THREE.Vector3(-1.0, -1.2, -1.5),
  new THREE.Vector3(-1.8, -0.3, -0.8),
  new THREE.Vector3(0.3, 0.6, -0.3),
]);

const crystalScaleSpline = [1.0, 0.9, 0.7, 0.6, 0.5];

function scrollScaleAt(scales: number[], t: number) {
  const idx = t * (scales.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, scales.length - 1);
  const frac = idx - lo;
  return scales[lo] + (scales[hi] - scales[lo]) * frac;
}

/* ── Crystal with fracture ────────────────────────────────────── */

const SHARD_COUNT = 16;
const FRACTURE_END = 0.35;

const shardMeshes: THREE.Mesh[] = [];

function DreamCrystal({
  reducedMotion,
  isMobile,
}: {
  reducedMotion: boolean;
  isMobile: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const shards = useCrystalShards(4, SHARD_COUNT, isMobile);
  const mouseRef = useRef({ x: 0, y: 0 });
  const dampedPos = useRef(new THREE.Vector3(0, 0, 0));
  const dampedScale = useRef(1);
  const dampedFracture = useRef<number[]>(
    new Array(SHARD_COUNT).fill(0)
  );
  const dampedVelKick = useRef({ v: 0 });

  const shardRefCb = useCallback(
    (index: number) => (el: THREE.Mesh | null) => {
      if (el) shardMeshes[index] = el;
    },
    []
  );

  useEffect(() => {
    if (isMobile || reducedMotion) return;
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [isMobile, reducedMotion]);

  useFrame((state, delta) => {
    if (!groupRef.current || reducedMotion) return;
    const elapsed = state.clock.elapsedTime;
    const { progress, velocity } = useScrollStore.getState();

    const targetPos = crystalSpline.getPointAt(Math.min(progress, 1));
    const targetScale = scrollScaleAt(
      crystalScaleSpline,
      Math.min(progress, 1)
    );

    damp(dampedPos.current, "x", targetPos.x, 0.25, delta);
    damp(dampedPos.current, "y", targetPos.y, 0.25, delta);
    damp(dampedPos.current, "z", targetPos.z, 0.25, delta);
    dampedScale.current = THREE.MathUtils.lerp(
      dampedScale.current,
      targetScale,
      1 - Math.exp(-4 * delta)
    );

    groupRef.current.position.copy(dampedPos.current);
    groupRef.current.scale.setScalar(dampedScale.current);

    groupRef.current.rotation.y = elapsed * 0.12;
    groupRef.current.rotation.x = Math.sin(elapsed * 0.08) * 0.25;
    if (!isMobile) {
      groupRef.current.rotation.y += mouseRef.current.x * 0.12;
      groupRef.current.rotation.x += mouseRef.current.y * 0.08;
    }

    const rawFrac = Math.min(progress / FRACTURE_END, 1);
    const easedFrac = 1 - Math.pow(1 - rawFrac, 3);

    damp(dampedVelKick.current, "v", velocity * 0.0006, 0.3, delta);
    const velBoost = dampedVelKick.current.v;

    for (let i = 0; i < shards.length; i++) {
      const mesh = shardMeshes[i];
      if (!mesh) continue;
      const s = shards[i];

      const delayed =
        Math.max(0, easedFrac - s.delay) / (1 - s.delay);
      const targetF = delayed + velBoost * 0.5;

      if (!dampedFracture.current[i]) dampedFracture.current[i] = 0;
      dampedFracture.current[i] = THREE.MathUtils.lerp(
        dampedFracture.current[i],
        targetF,
        1 - Math.exp(-6 * delta)
      );
      const f = dampedFracture.current[i];

      const dist = (1 + s.delay * 2) * f * 2.5;
      mesh.position.set(
        s.centroid.x + s.direction.x * dist,
        s.centroid.y + s.direction.y * dist,
        s.centroid.z + s.direction.z * dist
      );

      const tumble = f * (1 + s.delay) * 0.8;
      mesh.rotation.set(
        s.direction.y * tumble,
        s.direction.z * tumble,
        s.direction.x * tumble
      );
    }
  });

  return (
    <group ref={groupRef}>
      {shards.map((shard, i) => (
        <mesh key={i} ref={shardRefCb(i)} geometry={shard.geometry}>
          {isMobile ? (
            <meshPhysicalMaterial
              color="#c4b5fd"
              emissive="#4c1d95"
              emissiveIntensity={0.3}
              roughness={0.12}
              metalness={0.08}
              transparent
              opacity={0.8}
              transmission={0.6}
              ior={1.35}
              thickness={1.2}
            />
          ) : (
            <MeshTransmissionMaterial
              thickness={2.2}
              chromaticAberration={0.5}
              anisotropicBlur={0.35}
              roughness={0.06}
              distortion={0.35}
              distortionScale={0.3}
              temporalDistortion={0.1}
              transmission={1}
              ior={1.35}
              samples={8}
              resolution={1024}
              color="#c4b5fd"
              backside
              backsideThickness={0.8}
            />
          )}
        </mesh>
      ))}
    </group>
  );
}

/* ── Drifting dust particles ──────────────────────────────────── */

const PARTICLE_SEED = 42;
const PARTICLE_COUNT = 300;

const particlePositions = (() => {
  const rng = seededRandom(PARTICLE_SEED);
  const pos = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    pos[i * 3] = (rng() - 0.5) * 20;
    pos[i * 3 + 1] = (rng() - 0.5) * 15;
    pos[i * 3 + 2] = (rng() - 0.5) * 12;
  }
  return pos;
})();

function DustParticles() {
  const ref = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * 0.03;
    const { progress } = useScrollStore.getState();
    ref.current.rotation.y = t;
    ref.current.rotation.x = Math.sin(t * 0.5) * 0.08;
    ref.current.position.y = -progress * 1.5;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particlePositions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color="#a8b4ff"
        transparent
        opacity={0.6}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

/* ── Pixel sparkles ───────────────────────────────────────────── */

const SPARKLE_SEED = 202;
const SPARKLE_COUNT = 80;

const sparkleData = (() => {
  const rng = seededRandom(SPARKLE_SEED);
  const pos = new Float32Array(SPARKLE_COUNT * 3);
  for (let i = 0; i < SPARKLE_COUNT; i++) {
    pos[i * 3] = (rng() - 0.5) * 16;
    pos[i * 3 + 1] = (rng() - 0.5) * 12;
    pos[i * 3 + 2] = (rng() - 0.5) * 8 - 1;
  }
  return pos;
})();

function PixelSparkles() {
  const ref = useRef<THREE.Points>(null);
  const opacityRef = useRef(0.7);

  useFrame((state) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.PointsMaterial;
    opacityRef.current = 0.5 + Math.sin(state.clock.elapsedTime * 2.0) * 0.3;
    mat.opacity = opacityRef.current;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[sparkleData, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#dcd0ff"
        transparent
        opacity={0.7}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

/* ── Ghosted project titles ───────────────────────────────────── */

const GHOST_TITLES = ["PIXEL PLUS", "4C ICED COFFEE", "KINETIC ARCHITECTURE"];

function GhostedTitle({
  text,
  position,
  speed,
  index,
}: {
  text: string;
  position: [number, number, number];
  speed: number;
  index: number;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;

    const worksP = getSectionProgress("works");
    const titleStart = 0.15 + index * 0.22;
    const titleEnd = titleStart + 0.25;
    const vis =
      worksP > titleStart && worksP < titleEnd
        ? Math.min(
            (worksP - titleStart) / 0.08,
            (titleEnd - worksP) / 0.08,
            1
          )
        : 0;

    ref.current.visible = vis > 0.001;
    if (!ref.current.visible) return;

    const t = state.clock.elapsedTime * speed;
    ref.current.position.z = position[2] + Math.sin(t) * 0.4;
    ref.current.position.x = position[0] + Math.sin(t * 0.7) * 0.2;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = (0.06 + Math.sin(t * 1.3) * 0.02) * vis;
  });

  const geo = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "transparent";
    ctx.fillRect(0, 0, 512, 64);
    ctx.font = "bold 48px sans-serif";
    ctx.fillStyle = "#f2efe9";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }, [text]);

  return (
    <mesh ref={ref} position={position}>
      <planeGeometry args={[6, 0.75]} />
      <meshBasicMaterial
        map={geo}
        transparent
        opacity={0.06}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ── Dream marquee text ───────────────────────────────────────── */

const HEADLINE_TILE = `${SITE_DATA.hero.headlineLine1}  ${SITE_DATA.hero.headlineLine2}  ·  `;
const FONT_URL = "/fonts/inter-tight-bold.ttf";
const TILE_COUNT = 4;

const FBO_HALF_FOV_RAD = (50 / 2) * (Math.PI / 180);
const FBO_CAM_Z = 6;
const TEXT_Z = -3;
const CAM_TO_TEXT = FBO_CAM_Z - TEXT_Z;

function DreamMarquee({
  isMobile,
  reducedMotion,
}: {
  isMobile: boolean;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const firstTextRef = useRef<THREE.Mesh>(null);
  const offsetRef = useRef(0);
  const tileWidthRef = useRef(0);
  const dampState = useRef({ vel: 0 });
  const visHeight = 2 * CAM_TO_TEXT * Math.tan(FBO_HALF_FOV_RAD);

  const fontSize = isMobile ? visHeight * 0.14 : visHeight * 0.22;

  const measureTile = useCallback(() => {
    const mesh = firstTextRef.current as unknown as {
      geometry: THREE.BufferGeometry;
    };
    if (!mesh?.geometry) return;
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (bb && bb.max.x - bb.min.x > 0.1) {
      tileWidthRef.current = bb.max.x - bb.min.x;
    }
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const heroP = getSectionProgress("top");
    const heroOut = heroP >= 1;

    if (heroOut) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    // heroP ≈ 0.5 at rest (section visible but not scrolled).
    // Remap so rest = 0 offset, fully scrolled out = full offset.
    const heroScroll = Math.max(0, (heroP - 0.5) / 0.5);
    const scrollY = heroScroll * visHeight * 0.85;
    groupRef.current.position.y = -scrollY;

    const fade = heroScroll < 0.2 ? 1 : 1 - (heroScroll - 0.2) / 0.8;
    const children = groupRef.current.children;
    for (let i = 0; i < children.length; i++) {
      const mat = (children[i] as THREE.Mesh).material as THREE.Material & {
        opacity: number;
      };
      if (mat) {
        mat.transparent = true;
        mat.opacity = fade;
      }
    }

    if (reducedMotion) return;

    if (tileWidthRef.current === 0) {
      measureTile();
      return;
    }

    const tw = tileWidthRef.current;
    const { velocity, direction } = useScrollStore.getState();

    damp(dampState.current, "vel", velocity * 0.0004, 0.4, delta);

    const baseSpeed = tw / 22;
    const scrollKick = dampState.current.vel * direction;
    const raw = baseSpeed + scrollKick;
    const speed =
      Math.sign(raw) * Math.min(Math.abs(raw), baseSpeed * 2.5);

    offsetRef.current -= speed * delta;
    offsetRef.current = ((offsetRef.current % tw) + tw) % tw;

    for (let i = 0; i < children.length; i++) {
      children[i].position.x = offsetRef.current + i * tw - tw;
    }
  });

  if (reducedMotion) {
    return (
      <group position={[0, 0, TEXT_Z]}>
        <Text
          font={FONT_URL}
          fontSize={fontSize}
          letterSpacing={-0.04}
          color="#a8b4ff"
          anchorX="center"
          anchorY="middle"
        >
          {SITE_DATA.hero.headlineLine1}
        </Text>
      </group>
    );
  }

  return (
    <group ref={groupRef} position={[0, 0, TEXT_Z]}>
      {Array.from({ length: TILE_COUNT }, (_, i) => (
        <Text
          key={i}
          ref={i === 0 ? firstTextRef : undefined}
          font={FONT_URL}
          fontSize={fontSize}
          letterSpacing={-0.04}
          color="#a8b4ff"
          anchorX="left"
          anchorY="middle"
          onSync={i === 0 ? measureTile : undefined}
        >
          {HEADLINE_TILE}
        </Text>
      ))}
    </group>
  );
}

/* ── Fog background plane ─────────────────────────────────────── */

function FogPlane() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.15 + Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
  });

  return (
    <mesh ref={ref} position={[0, 0, -8]}>
      <planeGeometry args={[40, 30]} />
      <meshBasicMaterial
        color="#0a0940"
        transparent
        opacity={0.15}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ── Scene ────────────────────────────────────────────────────── */

export default function DreamScene({
  reducedMotion,
  isMobile,
}: {
  reducedMotion: boolean;
  isMobile: boolean;
}) {
  return (
    <>
      <color attach="background" args={["#07062B"]} />
      <fog attach="fog" args={["#07062B", 5, 20]} />

      <ambientLight intensity={0.35} />
      <pointLight position={[5, 4, 3]} intensity={0.6} color="#6366f1" />
      <pointLight position={[-4, -3, 2]} intensity={0.35} color="#a855f7" />
      <pointLight position={[0, 2, -2]} intensity={0.2} color="#7c3aed" />

      <Environment preset="night" />

      <DreamMarquee isMobile={isMobile} reducedMotion={reducedMotion} />
      <DreamCrystal reducedMotion={reducedMotion} isMobile={isMobile} />

      <DustParticles />
      <PixelSparkles />

      {GHOST_TITLES.map((text, i) => (
        <GhostedTitle
          key={text}
          text={text}
          index={i}
          position={[
            (i - 1) * 3,
            2 - i * 1.5,
            -3 - i * 0.5,
          ]}
          speed={0.3 + i * 0.1}
        />
      ))}

      <FogPlane />
    </>
  );
}
