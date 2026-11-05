"use client";

import { useRef, useMemo, useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars } from "@react-three/drei";
import * as THREE from "three";
import { useThemeStore } from "@/store/useThemeStore";

function subscribeMotion(cb: () => void) {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

function getMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ── Seeded pseudo-random for deterministic layouts ─────────────── */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── Crystal shard ──────────────────────────────────────────────── */

function CrystalShard({
  position,
  rotation,
  scale,
  speed,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  speed: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const initialPos = useMemo(() => new THREE.Vector3(...position), [position]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime * speed;
    meshRef.current.position.x = initialPos.x + Math.sin(t * 0.7) * 0.3;
    meshRef.current.position.y = initialPos.y + Math.sin(t * 0.5) * 0.2;
    meshRef.current.position.z = initialPos.z + Math.cos(t * 0.3) * 0.15;
    meshRef.current.rotation.x += 0.001 * speed;
    meshRef.current.rotation.y += 0.002 * speed;
  });

  return (
    <mesh ref={meshRef} position={position} rotation={rotation} scale={scale}>
      <octahedronGeometry args={[1, 0]} />
      <meshPhysicalMaterial
        color="#a8b4ff"
        emissive="#2a1a6e"
        emissiveIntensity={0.4}
        roughness={0.15}
        metalness={0.3}
        transparent
        opacity={0.7}
        envMapIntensity={0.5}
      />
    </mesh>
  );
}

/* ── Drifting particles ─────────────────────────────────────────── */

const PARTICLE_SEED = 42;
const PARTICLE_COUNT = 200;

const particleData = (() => {
  const rng = seededRandom(PARTICLE_SEED);
  const pos = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    pos[i * 3] = (rng() - 0.5) * 16;
    pos[i * 3 + 1] = (rng() - 0.5) * 12;
    pos[i * 3 + 2] = (rng() - 0.5) * 10;
  }
  return pos;
})();

function Particles() {
  const ref = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * 0.05;
    ref.current.rotation.y = t;
    ref.current.rotation.x = Math.sin(t * 0.5) * 0.1;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[particleData, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#8b8eff"
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ── Ghosted project titles (depth planes) ──────────────────────── */

const TITLE_DATA = [
  { position: [-2, 2, -3] as const, speed: 0.4 },
  { position: [2, 0.5, -4] as const, speed: 0.3 },
  { position: [-1, -1.5, -3.5] as const, speed: 0.5 },
];

function GhostedTitle({
  position,
  speed,
}: {
  position: readonly [number, number, number];
  speed: number;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed;
    ref.current.position.z = position[2] + Math.sin(t) * 0.3;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.08 + Math.sin(t * 1.5) * 0.03;
  });

  return (
    <mesh ref={ref} position={[position[0], position[1], position[2]]}>
      <planeGeometry args={[4, 0.4]} />
      <meshBasicMaterial
        color="#f2efe9"
        transparent
        opacity={0.08}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ── Fog layer ──────────────────────────────────────────────────── */

function FogPlane() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.12 + Math.sin(state.clock.elapsedTime * 0.3) * 0.04;
  });

  return (
    <mesh ref={ref} position={[0, 0, -5]}>
      <planeGeometry args={[30, 20]} />
      <meshBasicMaterial color="#0a0940" transparent opacity={0.12} depthWrite={false} />
    </mesh>
  );
}

/* ── Crystal shard layout (deterministic) ───────────────────────── */

const SHARD_SEED = 77;
const shardData = (() => {
  const rng = seededRandom(SHARD_SEED);
  return Array.from({ length: 10 }, (_, i) => ({
    key: i,
    position: [
      (rng() - 0.5) * 8,
      (rng() - 0.5) * 6,
      (rng() - 0.5) * 4 - 2,
    ] as [number, number, number],
    rotation: [
      rng() * Math.PI,
      rng() * Math.PI,
      rng() * Math.PI,
    ] as [number, number, number],
    scale: rng() * 0.3 + 0.1,
    speed: rng() * 0.5 + 0.3,
  }));
})();

/* ── Full dream scene ───────────────────────────────────────────── */

function DreamScene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={0.5} color="#6366f1" />
      <pointLight position={[-5, -3, 3]} intensity={0.3} color="#a855f7" />

      <Stars radius={10} depth={8} count={800} factor={2} saturation={0.3} fade speed={0.5} />

      {shardData.map(({ key, ...props }) => (
        <Float key={key} speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
          <CrystalShard {...props} />
        </Float>
      ))}

      <Particles />

      {TITLE_DATA.map((t, i) => (
        <GhostedTitle key={i} {...t} />
      ))}

      <FogPlane />
      <fog attach="fog" args={["#07062B", 5, 18]} />
    </>
  );
}

/* ── Canvas wrapper (visible only in dream mode) ────────────────── */

export default function DreamCanvas() {
  const mode = useThemeStore((s) => s.mode);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getMotionSnapshot, () => false);

  if (mode !== "dream" || reducedMotion) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ background: "linear-gradient(180deg, #07062B 0%, #120e45 50%, #1a0e3e 100%)" }}
    >
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        style={{ position: "absolute", inset: 0 }}
      >
        <DreamScene />
      </Canvas>
    </div>
  );
}
