"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { setPadOpen } from "@/hooks/crystalAudio";
import {
  FLIGHT, FLIGHT_REDUCED, bob, createFlight, speed, stepFlight, terminalSpeed,
  type FlightInput, type FlightState,
} from "./flight";
import { readFlightInput, type InputState } from "./input";
import { SEALS, VOID } from "./layout";

/** Longest frame fed to the flight; a hitch never fast-forwards. */
const MAX_DT = 1 / 20;

/* ── Shared GLSL: cheap 3D value noise ────────────────────────── */

const NOISE = /* glsl */ `
float h3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}
float fbm3(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
`;

/* ── Sky: violet gradient, a lilac haze band, slow cloud wisps ── */

const SKY_VERT = /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = position;
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = vec4(p.xy, p.w * 0.9999, p.w);
          }
`;
const SKY_FRAG = /* glsl */ `
          uniform float uTime;
          varying vec3 vDir;
          ${NOISE}
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 deep = vec3(0.030, 0.018, 0.105);
            vec3 mid  = vec3(0.115, 0.060, 0.270);
            vec3 haze = vec3(0.420, 0.250, 0.640);
            vec3 col = mix(mid, deep, smoothstep(-0.05, 0.85, h));
            col = mix(col, deep * 0.8, smoothstep(-0.05, -0.9, h));
            col += haze * exp(-pow(h * 3.0, 2.0)) * 0.22;
            float c = fbm3(d * 2.2 + vec3(0.0, uTime * 0.008, uTime * 0.005));
            float w = fbm3(d * 5.5 - vec3(uTime * 0.01));
            col += haze * smoothstep(0.48, 0.86, c) * (0.55 + 0.45 * w) * 0.30;
            // A few far motes, fixed to the sky
            vec3 g = floor(d * 160.0);
            float star = step(0.9975, h3(g)) * smoothstep(0.6, 0.0, length(fract(d * 160.0) - 0.5));
            col += vec3(0.85, 0.80, 1.0) * star * 0.55;
            gl_FragColor = vec4(col, 1.0);
          }
`;

function VoidSky() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((state) => {
    if (mat.current) mat.current.uniforms.uTime.value = state.clock.elapsedTime;
    ref.current?.position.copy(state.camera.position);
  });
  return (
    <mesh ref={ref} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[VOID.skyRadius, 48, 24]} />
      <shaderMaterial
        ref={mat}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={SKY_VERT}
        fragmentShader={SKY_FRAG}
      />
    </mesh>
  );
}

/* ── Seeded data, built once per mount (pure) ─────────────────── */

const DUST_BOX = 36;

function lcg(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function makeDust(count: number) {
  const rnd = lcg(1234567);
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rnd() * DUST_BOX;
    pos[i * 3 + 1] = rnd() * DUST_BOX;
    pos[i * 3 + 2] = rnd() * DUST_BOX;
    seed[i] = rnd();
  }
  return { pos, seed };
}

function makeBanks(count: number) {
  const rnd = lcg(7654321);
  const center = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Spread through the void, flattened a little toward the equator
    const r = 10 + rnd() * 52;
    const th = rnd() * Math.PI * 2;
    center[i * 3] = Math.cos(th) * r;
    center[i * 3 + 1] = (rnd() - 0.5) * 34;
    center[i * 3 + 2] = Math.sin(th) * r;
    size[i] = 18 + rnd() * 26;
    seed[i] = rnd();
  }
  return { center, size, seed };
}

const QUAD_POS = new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
const QUAD_UV = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
const QUAD_INDEX = new Uint16Array([0, 1, 2, 0, 2, 3]);

let _glowTex: THREE.CanvasTexture | null = null;
function glowTexture(): THREE.CanvasTexture {
  if (_glowTex) return _glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.18, "rgba(220,200,255,0.55)");
  g.addColorStop(0.5, "rgba(150,110,255,0.14)");
  g.addColorStop(1, "rgba(120,80,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

/* ── Dust: a box of motes wrapped around the camera ──────────────
 * Endless parallax at any speed; this is what sells the floating. */

const DUST_VERT = /* glsl */ `
  uniform vec3 uCam;
  uniform float uTime;
  uniform float uPx;
  uniform float uDrift;
  attribute float aSeed;
  varying float vA;
  void main() {
    vec3 p = position;
    p += uDrift * vec3(sin(uTime * 0.11 + aSeed * 30.0), uTime * (0.05 + 0.12 * aSeed), cos(uTime * 0.09 + aSeed * 21.0)) * 0.8;
    vec3 rel = mod(p - uCam, ${DUST_BOX.toFixed(1)}) - ${(DUST_BOX / 2).toFixed(1)};
    vec4 mv = viewMatrix * vec4(uCam + rel, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = max(0.1, -mv.z);
    gl_PointSize = uPx * (0.5 + 1.1 * aSeed * aSeed) * 18.0 / dist;
    // Fade at the box edge (hides the wrap) and right at the lens
    float edge = 1.0 - smoothstep(${(DUST_BOX * 0.28).toFixed(1)}, ${(DUST_BOX * 0.5).toFixed(1)}, length(rel));
    float near = smoothstep(0.25, 1.4, dist);
    float tw = 0.75 + 0.25 * sin(uTime * (0.8 + aSeed * 1.7) + aSeed * 40.0);
    vA = edge * near * tw * (0.25 + 0.75 * fract(aSeed * 13.7));
  }
`;
const DUST_FRAG = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(0.78, 0.72, 1.0) * a * vA, 1.0);
  }
`;

function Dust({ count, reduced }: { count: number; reduced: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const data = useMemo(() => makeDust(count), [count]);
  const uniforms = useMemo(
    () => ({
      uCam: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uPx: { value: 1 },
      uDrift: { value: reduced ? 0 : 1 },
    }),
    [reduced],
  );
  useFrame((state) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    u.uCam.value.copy(state.camera.position);
    u.uTime.value = state.clock.elapsedTime;
    u.uPx.value = state.gl.getPixelRatio();
  });
  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.pos, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[data.seed, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={DUST_VERT}
        fragmentShader={DUST_FRAG}
      />
    </points>
  );
}

/* ── Fog banks: large soft billboards, thin out as you pass through ── */

const BANK_VERT = /* glsl */ `
  attribute vec3 aCenter;
  attribute float aSize;
  attribute float aSeed;
  uniform vec3 uCam;
  varying vec2 vUv;
  varying float vSeed;
  varying float vFade;
  void main() {
    vUv = uv;
    vSeed = aSeed;
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 wp = aCenter + (right * position.x + up * position.y) * aSize;
    float d = distance(uCam, aCenter);
    vFade = smoothstep(aSize * 0.18, aSize * 0.7, d) * exp(-d * 0.012);
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }
`;
const BANK_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vSeed;
  varying float vFade;
  ${NOISE}
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float n = fbm3(vec3(c * 2.6, vSeed * 9.0 + uTime * 0.025));
    float a = smoothstep(1.0, 0.15, r) * smoothstep(0.32, 0.78, n);
    vec3 col = mix(vec3(0.36, 0.20, 0.62), vec3(0.62, 0.42, 0.85), vSeed);
    gl_FragColor = vec4(col * a * vFade * 0.16, 1.0);
  }
`;

function FogBanks({ count }: { count: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const data = useMemo(() => makeBanks(count), [count]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } }), []);
  useFrame((state) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    u.uTime.value = state.clock.elapsedTime;
    u.uCam.value.copy(state.camera.position);
  });
  return (
    <mesh frustumCulled={false} renderOrder={-5}>
      <instancedBufferGeometry instanceCount={count}>
        <bufferAttribute attach="index" args={[QUAD_INDEX, 1]} />
        <bufferAttribute attach="attributes-position" args={[QUAD_POS, 3]} />
        <bufferAttribute attach="attributes-uv" args={[QUAD_UV, 2]} />
        <instancedBufferAttribute attach="attributes-aCenter" args={[data.center, 3]} />
        <instancedBufferAttribute attach="attributes-aSize" args={[data.size, 1]} />
        <instancedBufferAttribute attach="attributes-aSeed" args={[data.seed, 1]} />
      </instancedBufferGeometry>
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={BANK_VERT}
        fragmentShader={BANK_FRAG}
      />
    </mesh>
  );
}

/* ── Seal beacons: far glows that give the void a compass ────────
 * Placeholder silhouettes until the seals themselves land. */

function SealBeacons() {
  const tex = useMemo(() => glowTexture(), []);
  const cores = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((state, dt) => {
    cores.current.forEach((m, i) => {
      if (!m) return;
      m.rotation.y += dt * (0.12 + i * 0.03);
      m.rotation.x = Math.sin(state.clock.elapsedTime * 0.2 + i) * 0.3;
    });
  });
  return (
    <>
      {SEALS.map((s, i) => (
        <group key={s.project} position={s.pos}>
          <sprite scale={[16, 16, 1]}>
            <spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} opacity={0.75} />
          </sprite>
          <mesh ref={(m) => { cores.current[i] = m; }}>
            <octahedronGeometry args={[2.4, 0]} />
            <meshStandardMaterial color="#120a2c" roughness={0.35} metalness={0.2} flatShading emissive="#2a1660" emissiveIntensity={0.35} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/* ── Pilot: input → flight → camera ───────────────────────────── */

interface PilotProps {
  input: React.RefObject<InputState>;
  reduced: boolean;
}

function Pilot({ input, reduced }: PilotProps) {
  const flight = useRef<FlightState>(createFlight());
  const fi = useRef<FlightInput>({ thrust: 0, strafe: 0, lift: 0, yaw: 0, pitch: 0 });
  const look = useRef({ x: 0, y: 0 });
  const tuning = reduced ? FLIGHT_REDUCED : FLIGHT;
  const vmax = terminalSpeed(tuning);

  // Test hook: Playwright reads the flight state (never used by the UI)
  useEffect(() => {
    const w = window as unknown as { __archiveFlight?: FlightState };
    w.__archiveFlight = flight.current;
    return () => {
      delete w.__archiveFlight;
      setPadOpen(0);
    };
  }, []);

  useFrame((state, delta) => {
    // Test hook: frames rendered (Playwright times the handover with it)
    const tw = window as unknown as { __archiveFrames?: number };
    tw.__archiveFrames = (tw.__archiveFrames ?? 0) + 1;
    const f = flight.current;
    const inp = input.current;
    const dt = Math.min(delta, MAX_DT);
    readFlightInput(inp, fi.current);
    stepFlight(f, fi.current, dt, tuning);

    const cam = state.camera as THREE.PerspectiveCamera;
    const b = bob(f, reduced);
    cam.position.set(f.px + b.x, f.py + b.y, f.pz);

    // Free look: the view leans a few degrees toward a resting pointer
    const lk = 1 - Math.exp(-4 * dt);
    const lx = reduced || inp.held ? 0 : inp.px * 0.06;
    const ly = reduced || inp.held ? 0 : inp.py * 0.045;
    look.current.x += (lx - look.current.x) * lk;
    look.current.y += (ly - look.current.y) * lk;
    cam.rotation.set(f.pitch - look.current.y, f.yaw - look.current.x, f.roll, "YXZ");

    // Speed widens the lens a touch
    const sp = speed(f) / vmax;
    const fov = 62 + (reduced ? 0 : sp * 9);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    setPadOpen(sp * 0.6);
  });
  return null;
}

/* ── Scene ────────────────────────────────────────────────────── */

export interface ArchiveSceneProps {
  input: React.RefObject<InputState>;
  reduced: boolean;
  lowPower: boolean;
}

export default function ArchiveScene({ input, reduced, lowPower }: ArchiveSceneProps) {
  return (
    <>
      <color attach="background" args={[VOID.fog]} />
      <fogExp2 attach="fog" args={[VOID.fog, VOID.fogDensity]} />
      <hemisphereLight args={["#b9a2ff", "#140a30", 0.9]} />
      <directionalLight position={[8, 14, 6]} intensity={0.6} color="#e8dcff" />
      <VoidSky />
      <FogBanks count={lowPower ? 10 : 18} />
      <Dust count={lowPower ? 900 : 1800} reduced={reduced} />
      <SealBeacons />
      <Pilot input={input} reduced={reduced} />
    </>
  );
}
