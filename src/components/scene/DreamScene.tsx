"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useScrollStore, getSectionProgress } from "@/store/useScrollStore";

/* ── Seeded PRNG ───────────────────────────────────────────────── */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── Crystal shard ─────────────────────────────────────────────── */

function CrystalShard({
  position,
  rotation,
  scale,
  speed,
  isMobile,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  speed: number;
  isMobile: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const initialPos = useMemo(
    () => new THREE.Vector3(...position),
    [position]
  );

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime * speed;
    const { progress } = useScrollStore.getState();
    const parallax = progress * speed * 2;
    meshRef.current.position.x = initialPos.x + Math.sin(t * 0.7) * 0.3;
    meshRef.current.position.y = initialPos.y + Math.sin(t * 0.5) * 0.2 - parallax;
    meshRef.current.position.z = initialPos.z + Math.cos(t * 0.3) * 0.15;
    meshRef.current.rotation.x += 0.001 * speed;
    meshRef.current.rotation.y += 0.002 * speed;
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      <octahedronGeometry args={[1, isMobile ? 0 : 1]} />
      <meshPhysicalMaterial
        color="#7b6bc4"
        emissive="#2a1a6e"
        emissiveIntensity={0.6}
        roughness={0.12}
        metalness={0.35}
        transparent
        opacity={0.75}
        envMapIntensity={0.6}
        clearcoat={0.4}
        clearcoatRoughness={0.2}
        iridescence={isMobile ? 0 : 0.8}
        iridescenceIOR={1.3}
      />
    </mesh>
  );
}

/* ── Shard data (deterministic) ────────────────────────────────── */

const SHARD_SEED = 77;
const shardData = (() => {
  const rng = seededRandom(SHARD_SEED);
  return Array.from({ length: 12 }, (_, i) => ({
    key: i,
    position: [
      (rng() - 0.5) * 10,
      (rng() - 0.5) * 8,
      (rng() - 0.5) * 6 - 2,
    ] as [number, number, number],
    rotation: [rng() * Math.PI, rng() * Math.PI, rng() * Math.PI] as [
      number,
      number,
      number,
    ],
    scale: rng() * 0.35 + 0.1,
    speed: rng() * 0.5 + 0.3,
  }));
})();

/* ── Drifting dust particles ───────────────────────────────────── */

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

/* ── Pixel sparkles ────────────────────────────────────────────── */

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

/* ── Ghosted project titles ────────────────────────────────────── */

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

/* ── Fog background plane ──────────────────────────────────────── */

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

/* ── Scene ─────────────────────────────────────────────────────── */

export default function DreamScene({
  isMobile,
}: {
  reducedMotion: boolean;
  isMobile: boolean;
}) {
  const shardCount = isMobile ? 6 : 12;
  const shards = useMemo(() => shardData.slice(0, shardCount), [shardCount]);

  return (
    <>
      <color attach="background" args={["#07062B"]} />
      <fog attach="fog" args={["#07062B", 5, 20]} />

      <ambientLight intensity={0.35} />
      <pointLight position={[5, 4, 3]} intensity={0.6} color="#6366f1" />
      <pointLight position={[-4, -3, 2]} intensity={0.35} color="#a855f7" />
      <pointLight position={[0, 2, -2]} intensity={0.2} color="#7c3aed" />

      {shards.map(({ key, ...props }) => (
        <CrystalShard key={key} {...props} isMobile={isMobile} />
      ))}

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
