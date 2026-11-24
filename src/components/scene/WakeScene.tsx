"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import StudioEnvironment from "@/components/crystal/StudioEnvironment";
import * as THREE from "three";
import GlassCrystal from "@/components/crystal/GlassCrystal";
import Debris from "@/components/crystal/Debris";
import CrystalHover from "@/components/crystal/CrystalHover";
import { useCrystalPose, crystalEvents } from "@/hooks/useCrystalPose";
import { useThemeStore } from "@/store/useThemeStore";
import Marquee from "./Marquee";
import OrbitRing from "./OrbitRing";
import { PALETTE } from "@/lib/palette";

/* ── Seeded PRNG (for pixel gem sparkles) ──────────────────────── */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── Pixel gem canvas texture ────────────────────────────────────── */

function usePixelGemTexture() {
  return useMemo(() => {
    const size = 16;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const pixels = [
      [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 2, 3, 3, 3, 2, 2, 1, 0, 0, 0, 0],
      [0, 0, 0, 1, 2, 3, 3, 4, 3, 3, 2, 2, 1, 0, 0, 0],
      [0, 0, 1, 2, 3, 3, 4, 4, 4, 3, 3, 2, 2, 1, 0, 0],
      [0, 1, 2, 3, 3, 4, 4, 4, 4, 3, 3, 3, 2, 2, 1, 0],
      [1, 2, 3, 3, 4, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 1],
      [1, 2, 3, 3, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 1],
      [1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1],
      [1, 2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1],
      [0, 1, 2, 2, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 1, 0],
      [0, 0, 1, 2, 2, 2, 3, 2, 2, 2, 2, 2, 2, 1, 0, 0],
      [0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0],
      [0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 1, 1, 2, 2, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
    ];
    const colors = [
      "transparent",
      "rgba(160,190,210,0.9)",
      "rgba(190,215,235,0.85)",
      "rgba(210,230,245,0.8)",
      "rgba(240,248,255,0.95)",
    ];

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = pixels[y][x];
        if (v > 0) {
          ctx.fillStyle = colors[v];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }, []);
}

/* ── Sparkle particle texture ────────────────────────────────────── */

function useSparkleTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = 8;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "rgba(220,235,255,0.9)";
    ctx.fillRect(3, 3, 2, 2);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }, []);
}

/* ── Crystal (uses shared pose) ─────────────────────────────────── */

// Reduced motion is handled in the pose itself (crystalState)
function WakeCrystal() {
  const groupRef = useRef<THREE.Group>(null);
  const pose = useCrystalPose();

  useFrame(() => {
    // Reduced motion too: the pose itself holds still (no travel, no
    // spin) and swaps hero -> parked inside a fade (crystalState)
    if (!groupRef.current) return;
    groupRef.current.position.set(pose.x, pose.y, pose.z);
    groupRef.current.scale.setScalar(pose.scale);
    groupRef.current.rotation.y = pose.rotY;
    groupRef.current.rotation.x = pose.rotX;
  });

  const active = useThemeStore((s) => s.mode === "wake");
  return <GlassCrystal ref={groupRef} active={active} />;
}

/* ── Pixel gem cursor follower ───────────────────────────────────── */

const SPARKLE_COUNT = 12;
const _gemWake = new THREE.Color(0xffffff);
const _gemDream = new THREE.Color(0xc4b5fd);

function PixelGem({
  reducedMotion,
  isMobile,
}: {
  reducedMotion: boolean;
  isMobile: boolean;
}) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const sparklesRef = useRef<THREE.Points>(null);
  const gemTex = usePixelGemTexture();
  const sparkleTex = useSparkleTexture();
  const mouseWorld = useRef(new THREE.Vector3(0, 0.5, 0));
  const currentPos = useRef(new THREE.Vector3(0, 0.5, 0));
  const { camera, size } = useThree();

  const sparkleGeoRef = useRef<THREE.BufferGeometry>(null);
  const sparkleState = useRef<
    | { life: number; speed: number; offsetX: number; offsetY: number }[]
    | null
  >(null);
  if (sparkleState.current === null) {
    const rng = seededRandom(999);
    sparkleState.current = Array.from({ length: SPARKLE_COUNT }, () => ({
      life: rng(),
      speed: rng() * 0.02 + 0.005,
      offsetX: (rng() - 0.5) * 0.6,
      offsetY: (rng() - 0.5) * 0.6,
    }));
  }

  useEffect(() => {
    if (isMobile || reducedMotion) return;
    const onMove = (e: MouseEvent) => {
      const ndc = new THREE.Vector3(
        (e.clientX / size.width) * 2 - 1,
        -(e.clientY / size.height) * 2 + 1,
        0.5,
      );
      ndc.unproject(camera);
      const dir = ndc.sub(camera.position).normalize();
      const dist = -camera.position.z / dir.z;
      mouseWorld.current = camera.position
        .clone()
        .add(dir.multiplyScalar(dist));
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [camera, size, isMobile, reducedMotion]);

  const matRef = useRef<THREE.SpriteMaterial>(null);

  useFrame(() => {
    if (!spriteRef.current || isMobile || reducedMotion) return;

    currentPos.current.lerp(mouseWorld.current, 0.08);
    spriteRef.current.position.copy(currentPos.current);

    // Gem turns violet with the flood itself, not the mode flip
    if (matRef.current) {
      matRef.current.color
        .copy(_gemWake)
        .lerp(_gemDream, crystalEvents.dreamLevel);
    }

    const geo = sparkleGeoRef.current;
    if (!geo) return;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    if (!posAttr) return;
    const sparks = sparkleState.current!;
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const s = sparks[i];
      s.life += s.speed;
      if (s.life > 1) s.life = 0;
      posAttr.setXYZ(
        i,
        currentPos.current.x + s.offsetX * s.life,
        currentPos.current.y + s.offsetY * s.life + s.life * 0.3,
        currentPos.current.z,
      );
    }
    posAttr.needsUpdate = true;
  });

  if (isMobile || reducedMotion) return null;

  return (
    <>
      <sprite ref={spriteRef} scale={[0.35, 0.35, 1]} position={[0, 0.5, 0]}>
        <spriteMaterial ref={matRef} map={gemTex} transparent depthWrite={false} />
      </sprite>
      <points ref={sparklesRef}>
        <bufferGeometry ref={sparkleGeoRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(SPARKLE_COUNT * 3), 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          map={sparkleTex}
          size={0.08}
          transparent
          opacity={0.7}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </>
  );
}

/* ── Scene ───────────────────────────────────────────────────────── */

export default function WakeScene({
  reducedMotion,
  isMobile,
}: {
  reducedMotion: boolean;
  isMobile: boolean;
}) {
  return (
    <>
      <color attach="background" args={[PALETTE.wake.paper]} />
      <StudioEnvironment variant="wake" />
      <Marquee color={PALETTE.wake.ink} isMobile={isMobile} reducedMotion={reducedMotion} testHooks />
      <WakeCrystal />
      <CrystalHover />
      <Debris seed={42} />
      <OrbitRing variant="wake" reducedMotion={reducedMotion} />
      <PixelGem reducedMotion={reducedMotion} isMobile={isMobile} />
    </>
  );
}
