"use client";

import { useRef, useEffect, useMemo, useCallback, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree, createPortal } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";
import * as THREE from "three";
import { useThemeStore, type Mode } from "@/store/useThemeStore";

function subscribeMotion(cb: () => void) {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

function getMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ── Seeded pseudo-random ───────────────────────────────────────── */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── FBM ink-blob composite shader ──────────────────────────────── */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uSceneA;
  uniform sampler2D uSceneB;
  uniform float uProgress;
  uniform vec2 uOrigin;
  uniform vec2 uResolution;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = rot * p * 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 origin = uOrigin * aspect;
    vec2 pos = uv * aspect;

    float dist = length(pos - origin);
    float maxDist = length(aspect * 1.5);

    float n = fbm(uv * 6.0 + uProgress * 2.0) * 0.3;
    float expandRadius = uProgress * maxDist * 1.3;
    float reveal = smoothstep(expandRadius - 0.12 + n, expandRadius + 0.04 + n, dist);
    reveal = 1.0 - reveal;

    float edgeDist = abs(dist - expandRadius + n);
    float edgeGlow = exp(-edgeDist * 14.0)
      * smoothstep(0.0, 0.12, uProgress)
      * smoothstep(1.0, 0.88, uProgress);

    vec4 colorA = texture2D(uSceneA, uv);
    vec4 colorB = texture2D(uSceneB, uv);

    vec4 result = mix(colorA, colorB, reveal);
    result.rgb += vec3(1.0) * edgeGlow * 0.7;

    gl_FragColor = result;
  }
`;

/* ── WAKE scene (simple solid) ──────────────────────────────────── */

function WakeSceneFBO() {
  return (
    <>
      <color attach="background" args={["#E9E7E2"]} />
      <ambientLight intensity={1.0} />
    </>
  );
}

/* ── DREAM scene for FBO ────────────────────────────────────────── */

const SHARD_SEED_FBO = 99;
const fboShardData = (() => {
  const rng = seededRandom(SHARD_SEED_FBO);
  return Array.from({ length: 8 }, () => ({
    position: [
      (rng() - 0.5) * 8,
      (rng() - 0.5) * 6,
      (rng() - 0.5) * 4 - 2,
    ] as [number, number, number],
    rotation: [rng() * Math.PI, rng() * Math.PI, 0] as [number, number, number],
    scale: rng() * 0.25 + 0.08,
  }));
})();

const STAR_SEED_FBO = 123;
const fboStarPositions = (() => {
  const rng = seededRandom(STAR_SEED_FBO);
  const count = 400;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rng() - 0.5) * 20;
    pos[i * 3 + 1] = (rng() - 0.5) * 15;
    pos[i * 3 + 2] = (rng() - 0.5) * 10 - 3;
  }
  return pos;
})();

function DreamSceneFBO() {
  const starsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (starsRef.current) {
      starsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  return (
    <>
      <color attach="background" args={["#07062B"]} />
      <fog attach="fog" args={["#07062B", 4, 16]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 3, 3]} intensity={0.6} color="#6366f1" />
      <pointLight position={[-3, -2, 2]} intensity={0.3} color="#a855f7" />

      <points ref={starsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[fboStarPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.04} color="#a8b4ff" transparent opacity={0.7} depthWrite={false} />
      </points>

      {fboShardData.map((s, i) => (
        <mesh key={i} position={s.position} rotation={s.rotation} scale={s.scale}>
          <octahedronGeometry args={[1, 0]} />
          <meshPhysicalMaterial
            color="#8b8eff"
            emissive="#2a1a6e"
            emissiveIntensity={0.5}
            transparent
            opacity={0.6}
            roughness={0.2}
            metalness={0.2}
          />
        </mesh>
      ))}

      <mesh position={[0, 0, -6]}>
        <planeGeometry args={[30, 20]} />
        <meshBasicMaterial color="#120e45" transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </>
  );
}

/* ── Transition compositor ──────────────────────────────────────── */

function TransitionCompositor() {
  const { size, gl } = useThree();

  const transitioning = useThemeStore((s) => s.transitioning);
  const clickOrigin = useThemeStore((s) => s.clickOrigin);
  const setMode = useThemeStore((s) => s.setMode);
  const endTransition = useThemeStore((s) => s.endTransition);

  const wakeScene = useMemo(() => new THREE.Scene(), []);
  const dreamScene = useMemo(() => new THREE.Scene(), []);

  const wakeTarget = useFBO(size.width, size.height, { depthBuffer: false });
  const dreamTarget = useFBO(size.width, size.height, { depthBuffer: false });

  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const progressRef = useRef(0);
  const startTimeRef = useRef(0);
  const activeRef = useRef(false);
  const directionRef = useRef(1);
  const themeSwitchedRef = useRef(false);

  const handleMidpoint = useCallback(() => {
    if (!themeSwitchedRef.current) {
      themeSwitchedRef.current = true;
      const target: Mode = directionRef.current === 1 ? "dream" : "wake";
      setMode(target);
    }
  }, [setMode]);

  useEffect(() => {
    if (transitioning && clickOrigin) {
      const currentMode = useThemeStore.getState().mode;
      activeRef.current = true;
      progressRef.current = 0;
      startTimeRef.current = performance.now();
      themeSwitchedRef.current = false;
      directionRef.current = currentMode === "wake" ? 1 : -1;

      if (materialRef.current) {
        const ox = clickOrigin.x / size.width;
        const oy = 1 - clickOrigin.y / size.height;
        materialRef.current.uniforms.uOrigin.value.set(ox, oy);
      }
    }
  }, [transitioning, clickOrigin, size]);

  useFrame(() => {
    const fboCamera = new THREE.PerspectiveCamera(50, size.width / size.height, 0.1, 100);
    fboCamera.position.set(0, 0, 6);

    gl.setRenderTarget(wakeTarget);
    gl.render(wakeScene, fboCamera);
    gl.setRenderTarget(dreamTarget);
    gl.render(dreamScene, fboCamera);
    gl.setRenderTarget(null);

    if (!materialRef.current) return;
    const mat = materialRef.current;

    mat.uniforms.uSceneA.value = wakeTarget.texture;
    mat.uniforms.uSceneB.value = dreamTarget.texture;
    mat.uniforms.uResolution.value.set(size.width, size.height);

    if (!activeRef.current) {
      const currentMode = useThemeStore.getState().mode;
      mat.uniforms.uProgress.value = currentMode === "dream" ? 1 : 0;
      return;
    }

    const elapsed = (performance.now() - startTimeRef.current) / 1400;
    const t = Math.min(elapsed, 1);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    if (directionRef.current === 1) {
      progressRef.current = eased;
    } else {
      progressRef.current = 1 - eased;
    }

    mat.uniforms.uProgress.value = progressRef.current;

    if (t >= 0.45) handleMidpoint();

    if (t >= 1) {
      activeRef.current = false;
      endTransition();
    }
  });

  return (
    <>
      {createPortal(<WakeSceneFBO />, wakeScene)}
      {createPortal(<DreamSceneFBO />, dreamScene)}

      <mesh>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{
            uSceneA: { value: null },
            uSceneB: { value: null },
            uProgress: { value: 0 },
            uOrigin: { value: new THREE.Vector2(0.5, 0.5) },
            uResolution: { value: new THREE.Vector2(1, 1) },
          }}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

/* ── Wrapper canvas ─────────────────────────────────────────────── */

export default function ShaderTransition() {
  const transitioning = useThemeStore((s) => s.transitioning);
  const mode = useThemeStore((s) => s.mode);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getMotionSnapshot, () => false);

  const show = transitioning || mode === "dream";

  if (reducedMotion || !show) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: transitioning ? 998 : -1 }}
    >
      <Canvas
        dpr={[1, 1.75]}
        orthographic
        camera={{ left: -1, right: 1, top: 1, bottom: -1, near: 0, far: 1 }}
        gl={{ alpha: true, antialias: false, preserveDrawingBuffer: false }}
        style={{ position: "absolute", inset: 0 }}
      >
        <TransitionCompositor />
      </Canvas>
    </div>
  );
}
