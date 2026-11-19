"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MeshTransmissionMaterial, useFBO } from "@react-three/drei";
import { UNUSED_FBO, applyCrystalShader, crystalCheapProps, crystalGlassProps, thicknessFor } from "@/components/crystal/crystalMaterial";
import * as THREE from "three";
import { setPadOpen } from "@/hooks/crystalAudio";
import {
  FLIGHT, FLIGHT_REDUCED, bob, createFlight, speed, stepFlight, terminalSpeed,
  type FlightInput, type FlightState,
} from "./flight";
import { readFlightInput, type InputState } from "./input";
import { SEALS, VIEW_DISTANCE, VOID } from "./layout";
import Seal, { SEAL_RIM, SEAL_SIZE, SHARD_RIM, type SealRegistry } from "./Seal";
import Play from "./Play";
import { CHARGE_FULL, type ArchiveState, type HudEls } from "./archiveState";
import { ENDING } from "./game";
import Reassembly from "./Reassembly";
import StudioEnvironment from "@/components/crystal/StudioEnvironment";
import { timed } from "@/components/scene/costs";
import { projects } from "@/content/projects";

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
          uniform float uLift;
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
            // The ending: the void lifts to pale violet
            col = mix(col, mix(vec3(0.86, 0.81, 0.97), vec3(0.78, 0.71, 0.94), smoothstep(0.6, -0.6, h)), uLift);
            gl_FragColor = vec4(col, 1.0);
          }
`;

/** 0 (the violet void) .. 1 (lifted to pale violet) as the ending plays. */
function liftOf(g: ArchiveState): number {
  if (!g.ending) return 0;
  const x = Math.min(1, Math.max(0, (g.t - g.ending.t0 - 1.5) / ENDING.lift));
  return x * x * (3 - 2 * x);
}

function VoidSky({ game }: { game: React.RefObject<ArchiveState> }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uLift: { value: 0 } }), []);
  useFrame((state) => {
    if (mat.current) {
      mat.current.uniforms.uTime.value = state.clock.elapsedTime;
      mat.current.uniforms.uLift.value = liftOf(game.current);
    }
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
  const data = useMemo(() => timed("archive: dust", () => makeDust(count)), [count]);
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
  uniform float uFade;
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
    gl_FragColor = vec4(col * a * vFade * uFade * 0.16, 1.0);
  }
`;

function FogBanks({ count, game }: { count: number; game: React.RefObject<ArchiveState> }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const data = useMemo(() => timed("archive: fog banks", () => makeBanks(count)), [count]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uFade: { value: 1 } }), []);
  useFrame((state) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    // Additive glow turns to white glare over the lifted fog: it goes
    u.uFade.value = 1 - liftOf(game.current);
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

/* ── Seal beacons: far glows behind each seal, the void's compass ── */

function SealBeacons({ game }: { game: React.RefObject<ArchiveState> }) {
  const tex = useMemo(() => glowTexture(), []);
  const mats = useRef<(THREE.SpriteMaterial | null)[]>([]);
  useFrame(() => {
    // Gone as the fog lifts (additive white over pale violet is glare)
    const k = 0.55 * (1 - liftOf(game.current));
    mats.current.forEach((m) => m && (m.opacity = k));
  });
  return (
    <>
      {SEALS.map((s, i) => (
        <sprite key={s.project} position={s.pos} scale={[22, 22, 1]} renderOrder={-4}>
          <spriteMaterial ref={(m) => { mats.current[i] = m; }} map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} opacity={0.55} />
        </sprite>
      ))}
    </>
  );
}

/* ── The fog lifts (ending) ───────────────────────────────────── */

const FOG_BASE = new THREE.Color(VOID.fog);
const FOG_PALE = new THREE.Color("#d6cbf3");

function FogLift({ game }: { game: React.RefObject<ArchiveState> }) {
  useFrame((state) => {
    const lift = liftOf(game.current);
    const bg = state.scene.background;
    if (bg instanceof THREE.Color) bg.copy(FOG_BASE).lerp(FOG_PALE, lift);
    const fog = state.scene.fog as THREE.FogExp2 | null;
    if (fog) {
      fog.color.copy(FOG_BASE).lerp(FOG_PALE, lift);
      fog.density = VOID.fogDensity * (1 - 0.65 * lift);
    }
  });
  return null;
}

/* ── Pilot: input → flight → camera ───────────────────────────── */

interface PilotProps {
  input: React.RefObject<InputState>;
  reduced: boolean;
  game: React.RefObject<ArchiveState>;
  registry: SealRegistry;
}

/** Test hook (archiveaim=<i>): face seal i's lit facet head-on from approach distance. */
const AIM = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("archiveaim") : null;

function decayShake(g: ArchiveState, dt: number): number {
  const s = g.shake;
  g.shake = Math.max(0, g.shake - dt);
  return s;
}

function Pilot({ input, reduced, game, registry }: PilotProps) {
  const aimed = useRef(AIM === null);
  const aimIdx = useRef(AIM === null ? 0 : Number(AIM));
  const flight = useRef<FlightState>(createFlight());
  // Test hook (archiveat=<i>): start in front of seal i, facing it
  useEffect(() => {
    const at = new URLSearchParams(window.location.search).get("archiveat");
    const spot = at !== null ? SEALS[Number(at)] : undefined;
    if (!spot) return;
    const f = flight.current;
    const [sx, sy, sz] = spot.pos;
    const len = Math.hypot(sx, sz) || 1;
    f.px = sx - (sx / len) * VIEW_DISTANCE;
    f.py = sy + 1.5;
    f.pz = sz - (sz / len) * VIEW_DISTANCE;
    f.yaw = Math.atan2(-(sx - f.px), -(sz - f.pz));
    f.pitch = Math.atan2(sy - f.py, Math.hypot(sx - f.px, sz - f.pz));
  }, []);
  const fi = useRef<FlightInput>({ thrust: 0, strafe: 0, lift: 0, yaw: 0, pitch: 0 });
  const look = useRef({ x: 0, y: 0 });
  const tuning = reduced ? FLIGHT_REDUCED : FLIGHT;
  const vmax = terminalSpeed(tuning);

  // Test hook: Playwright reads the flight state (never used by the UI)
  useEffect(() => {
    const w = window as unknown as {
      __archiveFlight?: FlightState;
      __archiveAim?: (i: number) => void;
      __archiveTargets?: SealRegistry["targets"];
      __archiveT?: () => number;
    };
    w.__archiveFlight = flight.current;
    // What a pulse can hit (live) and the game clock: a scripted pilot can
    // lead a moving facet (scripts/shot/fight.mjs)
    w.__archiveTargets = registry.targets;
    w.__archiveT = () => game.current.t;
    // Re-park facing seal i's lit facet (it moves after every hit)
    w.__archiveAim = (i: number) => {
      aimIdx.current = i;
      aimed.current = false;
    };
    return () => {
      delete w.__archiveFlight;
      delete w.__archiveAim;
      delete w.__archiveTargets;
      delete w.__archiveT;
      setPadOpen(0);
    };
  }, [registry, game]);

  useFrame((state, delta) => {
    // Test hook: frames rendered (Playwright times the handover with it)
    const tw = window as unknown as { __archiveFrames?: number };
    tw.__archiveFrames = (tw.__archiveFrames ?? 0) + 1;
    if (tw.__archiveFrames === 1) (window as unknown as { __archiveFirstFrameAt?: number }).__archiveFirstFrameAt = performance.now();
    const f = flight.current;
    const inp = input.current;
    const dt = Math.min(delta, MAX_DT);
    // Test hook: once the seal has published its target, park in front of its lit facet
    if (!aimed.current) {
      const tg = registry.targets[aimIdx.current];
      if (tg) {
        aimed.current = true;
        const c = Math.cos(tg.rotY), sn = Math.sin(tg.rotY);
        // Facet direction in world space (body turns about Y)
        const wx = tg.facet[0] * c + tg.facet[2] * sn, wy = tg.facet[1], wz = -tg.facet[0] * sn + tg.facet[2] * c;
        const l = Math.hypot(wx, wy, wz) || 1;
        f.px = tg.center[0] + (wx / l) * VIEW_DISTANCE;
        f.py = tg.center[1] + (wy / l) * VIEW_DISTANCE;
        f.pz = tg.center[2] + (wz / l) * VIEW_DISTANCE;
        f.vx = f.vy = f.vz = 0;
        f.yaw = Math.atan2(-(tg.center[0] - f.px), -(tg.center[2] - f.pz));
        f.pitch = Math.atan2(tg.center[1] - f.py, Math.hypot(tg.center[0] - f.px, tg.center[2] - f.pz));
      }
    }
    readFlightInput(inp, fi.current);
    // The ending holds you still in front of the crystal
    if (game.current.ending) {
      const fz = fi.current;
      fz.thrust = fz.strafe = fz.lift = fz.yaw = fz.pitch = 0;
      const damp = Math.exp(-3 * dt);
      f.vx *= damp;
      f.vy *= damp;
      f.vz *= damp;
    }
    stepFlight(f, fi.current, dt, tuning);

    const cam = state.camera as THREE.PerspectiveCamera;
    const b = bob(f, reduced);
    cam.position.set(f.px + b.x, f.py + b.y, f.pz);
    // A short shake on a facet hit (never under reduced motion)
    const sh = decayShake(game.current, dt);
    if (sh > 0 && !reduced) {
      const a = sh * 0.35;
      cam.position.x += (Math.random() - 0.5) * a;
      cam.position.y += (Math.random() - 0.5) * a;
    }

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

/* ── Seals' backdrop: one pass for all three ─────────────────────
 * The seals wear the hero's transmission material, which refracts a
 * backdrop of the scene without them; one shared pass serves all three
 * (and their orbiting shards), like the hero's shards. */

function hideFromBackdrop(r: SealRegistry, o: THREE.Object3D | null) {
  if (o) r.backdropHidden.add(o);
}

function SealBackdrop({ registry, fbo }: { registry: SealRegistry; fbo: THREE.WebGLRenderTarget }) {
  useFrame((state) => {
    const hidden: THREE.Object3D[] = [];
    registry.backdropHidden.forEach((o) => {
      if (o.visible) {
        o.visible = false;
        hidden.push(o);
      }
    });
    state.gl.setRenderTarget(fbo);
    state.gl.clear();
    state.gl.render(state.scene, state.camera);
    state.gl.setRenderTarget(null);
    hidden.forEach((o) => (o.visible = true));
  });
  return null;
}

/* ── Which seal refracts ──────────────────────────────────────────
 * Only the nearest unfreed seal wears transmission. Another takes over
 * only once it is NEAREST_HYST units closer than the current one, so
 * hovering near the midpoint never flickers between the two looks. */

const NEAREST_HYST = 4;
const _sp = new THREE.Vector3();

function pickNearest(r: SealRegistry, g: ArchiveState, camera: THREE.Camera) {
  const dist = (i: number) => camera.position.distanceTo(_sp.set(SEALS[i].pos[0], SEALS[i].pos[1], SEALS[i].pos[2]));
  let best = -1;
  let bestD = Infinity;
  SEALS.forEach((_, i) => {
    if (g.seals[i].freed) return;
    const d = dist(i);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  const cur = r.nearest;
  const curOk = cur >= 0 && !g.seals[cur].freed;
  if (!curOk || (best >= 0 && best !== cur && bestD < dist(cur) - NEAREST_HYST)) r.nearest = best;
}

function NearestSeal({ registry, game }: { registry: SealRegistry; game: React.RefObject<ArchiveState> }) {
  // Priority -1: before the seals' own frames, which read registry.nearest
  useFrame(({ camera }) => pickNearest(registry, game.current, camera), -1);
  return null;
}

/* ── HUD: compass toward the nearest unfreed seal, reticle charge ── */

const _cv = new THREE.Vector3();
const _nv = new THREE.Vector3();

/** Writes the HUD for one frame (DOM nodes, outside React). */
function writeHud(g: ArchiveState, h: HudEls, camera: THREE.Camera) {
  let best = -1;
  let bestD = Infinity;
  SEALS.forEach((spot, i) => {
    if (g.seals[i].freed) return;
    const d = camera.position.distanceTo(_cv.set(spot.pos[0], spot.pos[1], spot.pos[2]));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  if (h.compass) {
    if (best < 0) {
      h.compass.style.opacity = "0";
    } else {
      const [x, y, z] = SEALS[best].pos;
      // Camera space: x right, y up, -z ahead; screen angle has y down
      _cv.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      const deg = (Math.atan2(-_cv.y, _cv.x) * 180) / Math.PI;
      _nv.set(x, y, z).project(camera);
      const ahead = _cv.z < 0;
      const off = Math.max(Math.abs(_nv.x), Math.abs(_nv.y));
      h.compass.setAttribute("transform", `rotate(${deg.toFixed(1)})`);
      // Gone when the seal is plainly in view (its direction is
      // meaningless there), faint near the edge, insistent off screen
      h.compass.style.opacity = !ahead || off > 0.85 ? "0.95" : off > 0.45 ? "0.3" : "0";
      h.compass.dataset.target = String(best);
    }
  }
  // The ending: the line, then the exit to Contact (once)
  const end = g.ending;
  const et = end ? g.t - end.t0 : -1;
  if (h.reticle) h.reticle.style.opacity = end ? "0" : "1";
  if (h.vignette) h.vignette.style.opacity = String(1 - liftOf(g));
  if (h.compass && end) h.compass.style.opacity = "0";
  if (h.endLine) {
    const lineOn = et >= ENDING.line;
    h.endLine.dataset.on = lineOn ? "1" : "0";
    // Inserted when it appears, so the live region announces it
    if (lineOn && !h.endLine.textContent) h.endLine.textContent = h.endLine.dataset.text ?? "";
  }
  if (end && et >= ENDING.exit && !h.exited) {
    h.exited = true;
    window.dispatchEvent(new Event("archive-ending-exit"));
  }
  const full = g.charge >= CHARGE_FULL;
  h.diamonds.forEach((el, i) => {
    if (el) el.setAttribute("fill-opacity", i < g.charge ? "1" : "0");
  });
  if (h.readyLabel) h.readyLabel.style.opacity = full ? "1" : "0";
  if (h.ready) h.ready.style.opacity = full ? "1" : "0";
  if (h.count) {
    const n = String(g.seals.filter((s) => s.freed).length);
    if (h.count.textContent !== n) h.count.textContent = n;
    // The whole HUD steps aside for the ending; the chrome turns dark on the pale fog
    const root = h.count.closest<HTMLElement>(".archive-root");
    if (root) root.dataset.ending = end ? "1" : "0";
  }
}

function setInfoAutoReset(gl: THREE.WebGLRenderer, on: boolean) {
  gl.info.autoReset = on;
}

/** Test hook plumbing: copy and reset the renderer's counters once per frame. */
function snapshotInfo(out: { calls: number; triangles: number }, gl: THREE.WebGLRenderer) {
  out.calls = gl.info.render.calls;
  out.triangles = gl.info.render.triangles;
  gl.info.reset();
}

function HudDriver({ game, hud }: { game: React.RefObject<ArchiveState>; hud: React.RefObject<HudEls> }) {
  const { gl } = useThree();
  // Test hook: Playwright reads draw calls / triangles per frame (perf checks)
  // Totals over one whole frame (backdrop pass included), not the last render
  const frameInfo = useRef({ calls: 0, triangles: 0 });
  useEffect(() => {
    const w = window as unknown as { __archiveInfo?: () => { calls: number; triangles: number; programs: number } };
    setInfoAutoReset(gl, false);
    w.__archiveInfo = () => ({ ...frameInfo.current, programs: gl.info.programs?.length ?? 0 });
    return () => {
      setInfoAutoReset(gl, true);
      delete w.__archiveInfo;
    };
  }, [gl]);
  useFrame(({ camera }) => {
    snapshotInfo(frameInfo.current, gl);
    writeHud(game.current, hud.current, camera);
  });
  return null;
}

export interface ArchiveSceneProps {
  input: React.RefObject<InputState>;
  reduced: boolean;
  lowPower: boolean;
  game: React.RefObject<ArchiveState>;
  hud: React.RefObject<HudEls>;
}

export default function ArchiveScene({ input, reduced, lowPower, game, hud }: ArchiveSceneProps) {
  const { size } = useThree();
  const backdrop = useFBO(Math.max(256, Math.round(size.width * 0.6)), Math.max(256, Math.round(size.height * 0.6)));
  const registry = useMemo<SealRegistry>(() => ({ backdropHidden: new Set(), bodies: [], targets: [], nearest: -1 }), []);
  const hideCrystal = useCallback((o: THREE.Object3D | null) => hideFromBackdrop(registry, o), [registry]);
  // ONE material for every seal body, ONE for every orbiting shard: owned
  // here (on a hidden holder mesh), handed to the three seals
  const glassProps = useMemo(() => timed("archive: seal glass props", () => crystalGlassProps("dream", "seal")), []);
  const shardProps = useMemo(() => timed("archive: shard glass props", () => crystalGlassProps("dream", "shard")), []);
  const cheapProps = useMemo(() => timed("archive: cheap props", () => crystalCheapProps("dream")), []);
  const [sealGlass, setSealGlass] = useState<THREE.Material | null>(null);
  const [shardGlass, setShardGlass] = useState<THREE.Material | null>(null);
  const [cheapSeal, setCheapSeal] = useState<THREE.Material | null>(null);
  const [cheapShard, setCheapShard] = useState<THREE.Material | null>(null);
  const holdSealGlass = useCallback((m: unknown) => {
    applyCrystalShader(m as THREE.Material | null, SEAL_RIM);
    if (m) setSealGlass(m as THREE.Material);
  }, []);
  const holdShardGlass = useCallback((m: unknown) => {
    applyCrystalShader(m as THREE.Material | null, SHARD_RIM);
    if (m) setShardGlass(m as THREE.Material);
  }, []);
  const holdCheapSeal = useCallback((m: THREE.Material | null) => {
    applyCrystalShader(m, SEAL_RIM);
    if (m) setCheapSeal(m);
  }, []);
  const holdCheapShard = useCallback((m: THREE.Material | null) => {
    applyCrystalShader(m, SHARD_RIM);
    if (m) setCheapShard(m);
  }, []);
  return (
    <>
      <color attach="background" args={[VOID.fog]} />
      <fogExp2 attach="fog" args={[VOID.fog, VOID.fogDensity]} />
      <hemisphereLight args={["#b9a2ff", "#140a30", 0.9]} />
      <directionalLight position={[8, 14, 6]} intensity={0.6} color="#e8dcff" />
      <VoidSky game={game} />
      <FogLift game={game} />
      <FogBanks count={lowPower ? 10 : 18} game={game} />
      <Dust count={lowPower ? 900 : 1800} reduced={reduced} />
      <SealBeacons game={game} />
      {/* The same studio the hero crystal is lit by, so the ice matches */}
      <StudioEnvironment variant="dream" />
      <SealBackdrop registry={registry} fbo={backdrop} />
      <NearestSeal registry={registry} game={game} />
      {/* Holders for the shared materials (hidden; userData.warm: the
          Warmup compiles them even while no seal wears one) */}
      <mesh visible={false} userData={{ warm: true }}>
        <MeshTransmissionMaterial {...glassProps} buffer={backdrop.texture} thickness={thicknessFor(SEAL_SIZE)} resolution={UNUSED_FBO} ref={holdSealGlass} />
      </mesh>
      <mesh visible={false} userData={{ warm: true }}>
        <MeshTransmissionMaterial {...shardProps} buffer={backdrop.texture} thickness={thicknessFor(1.2, true)} resolution={UNUSED_FBO} flatShading ref={holdShardGlass} />
      </mesh>
      <mesh visible={false} userData={{ warm: true }}>
        <meshPhysicalMaterial {...cheapProps} ref={holdCheapSeal} />
      </mesh>
      <mesh visible={false} userData={{ warm: true }}>
        <meshPhysicalMaterial {...cheapProps} flatShading ref={holdCheapShard} />
      </mesh>
      {sealGlass && shardGlass && cheapSeal && cheapShard && SEALS.map((spot, i) => {
        const pr = projects[spot.project];
        return (
          <Seal
            key={spot.project}
            spot={spot}
            index={i}
            cover={(pr?.cover.src ?? "").replace(".webp", "-800.webp")}
            label={pr ? `${pr.title}  ·  ${pr.category}  ·  ${pr.year}`.toUpperCase() : ""}
            project={pr}
            reduced={reduced}
            glassMaterial={sealGlass}
            shardMaterial={shardGlass}
            cheapGlassMaterial={cheapSeal}
            cheapShardMaterial={cheapShard}
            registry={registry}
            state={game.current}
          />
        );
      })}
      <Suspense fallback={null}>
        <Reassembly game={game} buffer={backdrop.texture} hide={hideCrystal} glowTex={glowTexture()} reduced={reduced} />
      </Suspense>
      <HudDriver game={game} hud={hud} />
      <Play input={input} game={game} hud={hud} registry={registry} reduced={reduced} />
      <Pilot input={input} reduced={reduced} game={game} registry={registry} />
    </>
  );
}
