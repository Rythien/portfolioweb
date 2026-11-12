"use client";

import { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer, Text } from "@react-three/drei";
import * as THREE from "three";
import { damp } from "maath/easing";
import { SITE_DATA } from "@/content/site";
import { useScrollStore, getSectionProgress } from "@/store/useScrollStore";
import GlassCrystal from "@/components/crystal/GlassCrystal";
import { useCrystalPose } from "@/hooks/useCrystalPose";
import { useThemeStore } from "@/store/useThemeStore";

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
