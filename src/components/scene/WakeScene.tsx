"use client";

import { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { damp } from "maath/easing";
import { SITE_DATA } from "@/content/site";
import { useScrollStore, getSectionProgress } from "@/store/useScrollStore";
import GlassCrystal from "@/components/crystal/GlassCrystal";
import { useCrystalPose, getCrystalPose } from "@/hooks/useCrystalPose";
import { useThemeStore } from "@/store/useThemeStore";

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
      "rgba(80,40,120,0.9)",
      "rgba(120,80,200,0.85)",
      "rgba(160,120,240,0.8)",
      "rgba(220,200,255,0.95)",
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
    ctx.fillStyle = "rgba(220,200,255,0.9)";
    ctx.fillRect(3, 3, 2, 2);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }, []);
}

/* ── Marquee headline ────────────────────────────────────────────── */

const HEADLINE_TILE = `${SITE_DATA.hero.headlineLine1}  ${SITE_DATA.hero.headlineLine2}  ·  `;
const FONT_URL = "/fonts/inter-tight-bold.ttf";
const TILE_COUNT = 4;

const FBO_HALF_FOV_RAD = (50 / 2) * (Math.PI / 180);
const FBO_CAM_Z = 6;
const TEXT_Z = -3;
const CAM_TO_TEXT = FBO_CAM_Z - TEXT_Z;

function MarqueeText({
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
    const fading = fade < 0.999;
    const children = groupRef.current.children;
    for (let i = 0; i < children.length; i++) {
      const mat = (children[i] as THREE.Mesh).material as THREE.Material & {
        opacity: number;
      };
      if (mat) {
        mat.transparent = fading;
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
          color="#1a1a1e"
          anchorX="center"
          anchorY="middle"
          onSync={(troika: any) => {
            if (troika.material) {
              troika.material.transparent = false;
              troika.material.alphaTest = 0.5;
            }
          }}
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
          color="#1a1a1e"
          anchorX="left"
          anchorY="middle"
          onSync={(troika: any) => {
            if (i === 0) measureTile();
            if (troika.material) {
              troika.material.transparent = false;
              troika.material.alphaTest = 0.5;
            }
          }}
        >
          {HEADLINE_TILE}
        </Text>
      ))}
    </group>
  );
}

/* ── Crystal (uses shared pose) ─────────────────────────────────── */

function WakeCrystal({
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

  const active = useThemeStore((s) => s.mode === "wake");
  return <GlassCrystal ref={groupRef} active={active} />;
}

/* ── Orbit ring (follows crystal pose) ──────────────────────────── */

function createOrbitTexture() {
  const w = 2048,
    h = 64;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "transparent";
  ctx.fillRect(0, 0, w, h);
  ctx.font = "bold 22px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.textBaseline = "middle";
  const label = "SELECTED WORK  ·  2026  ·  SEARON MAHARJAN  ·  ";
  let x = 0;
  while (x < w) {
    ctx.fillText(label, x, h / 2);
    x += ctx.measureText(label).width;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function OrbitRing({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const texRef = useRef<THREE.CanvasTexture | null>(null);
  if (texRef.current === null) texRef.current = createOrbitTexture();
  const dampedPos = useRef(new THREE.Vector3(0, 0, 0));
  const dampedOpacity = useRef(0.45);

  useEffect(() => {
    if (matRef.current && texRef.current) {
      matRef.current.map = texRef.current;
      matRef.current.needsUpdate = true;
    }
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current || reducedMotion) return;
    const elapsed = state.clock.elapsedTime;
    const pose = getCrystalPose();

    damp(dampedPos.current, "x", pose.x, 0.3, delta);
    damp(dampedPos.current, "y", pose.y, 0.3, delta);
    damp(dampedPos.current, "z", pose.z, 0.3, delta);

    meshRef.current.position.copy(dampedPos.current);
    meshRef.current.rotation.x = 0.5 + Math.sin(elapsed * 0.06) * 0.1;
    meshRef.current.rotation.y = elapsed * 0.08;

    const scrollP = useScrollStore.getState().progress;
    meshRef.current.rotation.z = 0.2 + scrollP * 0.4;

    texRef.current!.offset.x = elapsed * 0.02;

    // Fade out as crystal breaks
    const breakFade = Math.max(0, 1 - pose.breakVal * 3);
    const scrollFade = scrollP < 0.6 ? 1 : 1 - (scrollP - 0.6) / 0.4;
    const targetOpacity = 0.45 * Math.min(breakFade, scrollFade);
    dampedOpacity.current = THREE.MathUtils.lerp(
      dampedOpacity.current,
      targetOpacity,
      1 - Math.exp(-4 * delta),
    );
    (meshRef.current.material as THREE.MeshBasicMaterial).opacity =
      dampedOpacity.current;
  });

  return (
    <mesh ref={meshRef} rotation={[0.5, 0, 0.2]}>
      <cylinderGeometry args={[2.6, 2.6, 0.08, 64, 1, true]} />
      <meshBasicMaterial
        ref={matRef}
        transparent
        opacity={0.45}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ── Pixel gem cursor follower ───────────────────────────────────── */

const SPARKLE_COUNT = 12;

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
  const mouseWorld = useRef(new THREE.Vector3(4, 2, 0));
  const currentPos = useRef(new THREE.Vector3(4, 2, 0));
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

  useFrame(() => {
    if (!spriteRef.current || isMobile || reducedMotion) return;

    currentPos.current.lerp(mouseWorld.current, 0.08);
    spriteRef.current.position.copy(currentPos.current);

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
      <sprite ref={spriteRef} scale={[0.35, 0.35, 1]} position={[4, 2, 0]}>
        <spriteMaterial map={gemTex} transparent depthWrite={false} />
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
      <color attach="background" args={["#E9E7E2"]} />
      <Environment background={false} resolution={512}>
        <color attach="background" args={["#000000"]} />
        <Lightformer form="rect" intensity={3} position={[4, 5, -3]} scale={[4, 1, 1]} rotation-x={Math.PI / 4} color="#ffffff" />
        <Lightformer form="rect" intensity={2.5} position={[-5, 3, 2]} scale={[3, 0.6, 1]} rotation-y={Math.PI / 3} color="#ffffff" />
        <Lightformer form="rect" intensity={1.8} position={[0, -4, 4]} scale={[6, 0.8, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.2} position={[5, 0, 3]} scale={[2, 3, 1]} color="#a0f0f0" />
        <Lightformer form="rect" intensity={1.0} position={[-4, -1, -4]} scale={[2, 3, 1]} color="#f0b0c8" />
        <Lightformer form="rect" intensity={0.1} position={[2, 0, -5]} scale={[8, 8, 1]} color="#111111" />
        <Lightformer form="rect" intensity={0.1} position={[-3, -2, 3]} scale={[6, 6, 1]} color="#0a0a0a" />
      </Environment>
      <MarqueeText isMobile={isMobile} reducedMotion={reducedMotion} />
      <WakeCrystal reducedMotion={reducedMotion} isMobile={isMobile} />
      <OrbitRing reducedMotion={reducedMotion} />
      <PixelGem reducedMotion={reducedMotion} isMobile={isMobile} />
    </>
  );
}
