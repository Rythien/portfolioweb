"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { useScrollStore, getSectionProgress } from "@/store/useScrollStore";
import GlassCrystal from "@/components/crystal/GlassCrystal";
import Debris from "@/components/crystal/Debris";
import { useCrystalPose } from "@/hooks/useCrystalPose";
import { useThemeStore } from "@/store/useThemeStore";
import Marquee from "./Marquee";

/* ── Seeded PRNG ───────────────────────────────────────────────── */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── Crystal wrapper (shared pose) ─────────────────────────────── */

function DreamCrystal({
  reducedMotion,
}: {
  reducedMotion: boolean;
  isMobile: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pose = useCrystalPose();

  useFrame(() => {
    if (!groupRef.current || reducedMotion) return;
    groupRef.current.position.set(pose.x, pose.y, pose.z);
    groupRef.current.scale.setScalar(pose.scale);
    groupRef.current.rotation.y = pose.rotY;
    groupRef.current.rotation.x = pose.rotX;
  });

  const active = useThemeStore((s) => s.mode === "dream");
  return <GlassCrystal ref={groupRef} variant="dream" active={active} />;
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
            1,
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

/* ── Drifting fog billows ─────────────────────────────────────── */

let _fogTex: THREE.CanvasTexture | null = null;
function getFogTexture() {
  if (_fogTex) return _fogTex;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );
  grad.addColorStop(0, "rgba(140, 125, 220, 0.55)");
  grad.addColorStop(0.5, "rgba(120, 105, 200, 0.22)");
  grad.addColorStop(1, "rgba(100, 90, 180, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  _fogTex = new THREE.CanvasTexture(canvas);
  return _fogTex;
}

const FOG_BILLOWS = (() => {
  const rng = seededRandom(777);
  return Array.from({ length: 5 }, (_, i) => ({
    base: new THREE.Vector3(
      (rng() - 0.5) * 14,
      (rng() - 0.5) * 8,
      -4 - i * 0.8,
    ),
    scale: 7 + rng() * 5,
    speed: 0.025 + rng() * 0.03,
    phase: rng() * Math.PI * 2,
    spin: (rng() - 0.5) * 0.015,
    opacity: 0.05 + rng() * 0.04,
  }));
})();

function FogDrift() {
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const tex = useMemo(() => getFogTexture(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < FOG_BILLOWS.length; i++) {
      const s = refs.current[i];
      if (!s) continue;
      const b = FOG_BILLOWS[i];
      s.position.x = b.base.x + Math.sin(t * b.speed + b.phase) * 2.2;
      s.position.y = b.base.y + Math.cos(t * b.speed * 0.7 + b.phase) * 1.1;
      const mat = s.material as THREE.SpriteMaterial;
      mat.rotation += b.spin * 0.016;
      mat.opacity = b.opacity * (0.8 + Math.sin(t * 0.1 + b.phase) * 0.2);
    }
  });

  return (
    <>
      {FOG_BILLOWS.map((b, i) => (
        <sprite
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          position={b.base.toArray() as [number, number, number]}
          scale={[b.scale, b.scale * 0.65, 1]}
        >
          <spriteMaterial
            map={tex}
            transparent
            opacity={b.opacity}
            depthWrite={false}
          />
        </sprite>
      ))}
    </>
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

      <Environment background={false} resolution={512}>
        <color attach="background" args={["#020118"]} />
        <Lightformer form="rect" intensity={2.5} position={[4, 5, -3]} scale={[4, 1, 1]} rotation-x={Math.PI / 4} color="#c8c8ff" />
        <Lightformer form="rect" intensity={2.0} position={[-5, 3, 2]} scale={[3, 0.6, 1]} rotation-y={Math.PI / 3} color="#d0d0ff" />
        <Lightformer form="rect" intensity={1.5} position={[0, -4, 4]} scale={[6, 0.8, 1]} color="#b0b0ff" />
        <Lightformer form="rect" intensity={1.2} position={[5, 0, 3]} scale={[2, 3, 1]} color="#80e0e0" />
        <Lightformer form="rect" intensity={1.0} position={[-4, -1, -4]} scale={[2, 3, 1]} color="#e0a0d0" />
        <Lightformer form="rect" intensity={0.05} position={[2, 0, -5]} scale={[8, 8, 1]} color="#050520" />
        <Lightformer form="rect" intensity={0.05} position={[-3, -2, 3]} scale={[6, 6, 1]} color="#030318" />
      </Environment>

      <Marquee color="#a8b4ff" isMobile={isMobile} reducedMotion={reducedMotion} />
      <DreamCrystal reducedMotion={reducedMotion} isMobile={isMobile} />
      <Debris seed={42} />

      <DustParticles />
      <PixelSparkles />
      <FogDrift />

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
