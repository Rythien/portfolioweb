"use client";

import { useRef, useMemo, useEffect, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, MeshTransmissionMaterial, Environment } from "@react-three/drei";
import * as THREE from "three";
import { SITE_DATA } from "@/content/site";

/* ── Subscriptions ─────────────────────────────────────────────── */

function subscribeMotion(cb: () => void) {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}
function getMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeWidth(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}
function getWidthSnapshot() {
  return window.innerWidth;
}

/* ── Seeded PRNG ───────────────────────────────────────────────── */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── Simple 3D noise (value noise for vertex displacement) ──── */

function hash(n: number) {
  const s = Math.sin(n) * 43758.5453;
  return s - Math.floor(s);
}

function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
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

/* ── Displaced icosahedron geometry ────────────────────────────── */

function useDisplacedIcosahedron(detail: number, displace: number, seed: number) {
  return useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1.4, detail);
    const pos = geo.attributes.position;
    const rng = seededRandom(seed);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = noise3(v.x * 2 + rng() * 0.5, v.y * 2, v.z * 2);
      v.normalize().multiplyScalar(1.4 + (n - 0.5) * displace);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }, [detail, displace, seed]);
}

/* ── Pixel gem canvas texture ──────────────────────────────────── */

function usePixelGemTexture() {
  return useMemo(() => {
    const size = 16;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const pixels = [
      [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
      [0,0,0,0,1,2,3,3,3,2,2,1,0,0,0,0],
      [0,0,0,1,2,3,3,4,3,3,2,2,1,0,0,0],
      [0,0,1,2,3,3,4,4,4,3,3,2,2,1,0,0],
      [0,1,2,3,3,4,4,4,4,3,3,3,2,2,1,0],
      [1,2,3,3,4,4,4,4,3,3,3,3,2,2,2,1],
      [1,2,3,3,4,4,4,3,3,3,3,2,2,2,2,1],
      [1,2,3,3,3,3,3,3,3,3,2,2,2,2,2,1],
      [1,2,2,3,3,3,3,3,3,2,2,2,2,2,2,1],
      [0,1,2,2,3,3,3,3,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,2,3,2,2,2,2,2,2,1,0,0],
      [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
      [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0],
      [0,0,0,0,0,1,1,2,2,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
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

/* ── Sparkle particle texture ──────────────────────────────────── */

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

/* ── Marquee headline ──────────────────────────────────────────── */

const HEADLINE = `${SITE_DATA.hero.headlineLine1}  ${SITE_DATA.hero.headlineLine2}  ·  `;
const FONT_URL = "/fonts/inter-tight-bold.ttf";

function MarqueeText({ isMobile }: { isMobile: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const scrollRef = useRef(0);
  const fontSize = isMobile ? 1.2 : 2.2;

  useEffect(() => {
    const onScroll = () => { scrollRef.current = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useFrame(() => {
    if (!groupRef.current) return;
    const offset = scrollRef.current * 0.003;
    groupRef.current.position.x = -(offset % 30);
  });

  return (
    <group ref={groupRef} position={[0, 0, -3]}>
      {[0, 1].map((i) => (
        <Text
          key={i}
          font={FONT_URL}
          fontSize={fontSize}
          letterSpacing={-0.04}
          color="#1a1a1e"
          anchorX="center"
          anchorY="middle"
          position={[i * 30, 0, 0]}
          maxWidth={60}
        >
          {HEADLINE.repeat(3)}
        </Text>
      ))}
    </group>
  );
}

/* ── Crystal ───────────────────────────────────────────────────── */

function Crystal({ reducedMotion, isMobile }: { reducedMotion: boolean; isMobile: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geo = useDisplacedIcosahedron(1, 0.6, 1337);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isMobile || reducedMotion) return;
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [isMobile, reducedMotion]);

  useFrame((state) => {
    if (!meshRef.current) return;
    if (reducedMotion) return;
    const t = state.clock.elapsedTime;
    meshRef.current.rotation.y = t * 0.15;
    meshRef.current.rotation.x = Math.sin(t * 0.1) * 0.2;
    if (!isMobile) {
      meshRef.current.rotation.y += mouseRef.current.x * 0.15;
      meshRef.current.rotation.x += mouseRef.current.y * 0.1;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geo}>
      <MeshTransmissionMaterial
        thickness={1.2}
        chromaticAberration={0.3}
        anisotropicBlur={0.4}
        roughness={0.08}
        distortion={0.3}
        distortionScale={0.3}
        temporalDistortion={0.1}
        transmission={1}
        ior={1.5}
        samples={isMobile ? 4 : 8}
        resolution={isMobile ? 256 : 512}
        color="#e8e4de"
        backside
        backsideThickness={0.4}
      />
    </mesh>
  );
}

/* ── Orbit ring ────────────────────────────────────────────────── */

function createOrbitTexture() {
  const w = 2048, h = 64;
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

  useEffect(() => {
    if (matRef.current && texRef.current) {
      matRef.current.map = texRef.current;
      matRef.current.needsUpdate = true;
    }
  }, []);

  useFrame((state) => {
    if (!meshRef.current || reducedMotion) return;
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.08;
    texRef.current!.offset.x = state.clock.elapsedTime * 0.02;
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

/* ── Pixel gem cursor follower ─────────────────────────────────── */

const SPARKLE_COUNT = 12;

function PixelGem({ reducedMotion, isMobile }: { reducedMotion: boolean; isMobile: boolean }) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const sparklesRef = useRef<THREE.Points>(null);
  const gemTex = usePixelGemTexture();
  const sparkleTex = useSparkleTexture();
  const mouseWorld = useRef(new THREE.Vector3(4, 2, 0));
  const currentPos = useRef(new THREE.Vector3(4, 2, 0));
  const { camera, size } = useThree();

  const sparkleGeoRef = useRef<THREE.BufferGeometry>(null);
  const sparkleState = useRef<{ life: number; speed: number; offsetX: number; offsetY: number }[] | null>(null);
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
        0.5
      );
      ndc.unproject(camera);
      const dir = ndc.sub(camera.position).normalize();
      const dist = -camera.position.z / dir.z;
      mouseWorld.current = camera.position.clone().add(dir.multiplyScalar(dist));
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
        currentPos.current.z
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

/* ── Scene ─────────────────────────────────────────────────────── */

function HeroScene({ reducedMotion, isMobile }: { reducedMotion: boolean; isMobile: boolean }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <Environment preset="city" />

      <MarqueeText isMobile={isMobile} />
      <Crystal reducedMotion={reducedMotion} isMobile={isMobile} />
      <OrbitRing reducedMotion={reducedMotion} />
      <PixelGem reducedMotion={reducedMotion} isMobile={isMobile} />
    </>
  );
}

/* ── CSS fallback (no WebGL) ───────────────────────────────────── */

function HeroFallback() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden"
    >
      <div className="relative">
        <h1 className="font-[family-name:var(--font-sans)] text-[clamp(3rem,8vw,8rem)] font-bold tracking-[-0.04em] text-ink/10 whitespace-nowrap select-none leading-none">
          {SITE_DATA.hero.headlineLine1}
        </h1>
        <div className="absolute inset-0 bg-gradient-to-b from-surface/0 via-surface/60 to-surface" />
      </div>
    </div>
  );
}

/* ── WebGL detection ───────────────────────────────────────────── */

function subscribeWebGL(cb: () => void) {
  window.addEventListener("webglcontextlost", cb);
  return () => window.removeEventListener("webglcontextlost", cb);
}

function getWebGLSnapshot() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/* ── Main export ───────────────────────────────────────────────── */

export default function HeroCanvas() {
  const reducedMotion = useSyncExternalStore(subscribeMotion, getMotionSnapshot, () => false);
  const width = useSyncExternalStore(subscribeWidth, getWidthSnapshot, () => 1440);
  const isMobile = width < 768;
  const webgl = useSyncExternalStore(subscribeWebGL, getWebGLSnapshot, () => true);

  if (!webgl) return <HeroFallback />;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none"
    >
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <HeroScene reducedMotion={reducedMotion} isMobile={isMobile} />
      </Canvas>
    </div>
  );
}
