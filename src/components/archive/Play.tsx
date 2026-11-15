"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  CHARGE_FULL, MOTES, createMotes, nextFacet, releasePulse, resolveFacetHit, stepMotes, stepPulse,
  type Hit, type Mote, type Pulse, type V3,
} from "./game";
import { sealSlug, type ArchiveState, type HudEls } from "./archiveState";
import { useArchiveProgress } from "@/store/useArchiveProgress";
import type { InputState } from "./input";
import type { SealRegistry } from "./Seal";
import { SEAL, SEALS } from "./layout";

/**
 * The play loop: motes drift (denser near seals) and are collected by
 * flying through them; three charge the pulse; releasing sends it
 * forward along your aim; the lit facet cracks the seal, the body or an
 * orbiting shard wastes it. Rules live in game.ts.
 */

const MOTE_COUNT = MOTES.free + MOTES.perSeal * SEALS.length;
const TRAIL = 10;
/** Longest frame fed to the rules; a hitch never teleports a pulse through a seal. */
const MAX_DT = 1 / 20;

/** Test hooks (Playwright): archivecharge=3 starts charged. */
const START_CHARGE =
  typeof window !== "undefined" ? Math.min(CHARGE_FULL, Number(new URLSearchParams(window.location.search).get("archivecharge")) || 0) : 0;

function radialTexture(stops: [number, string][]): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let _tex: { head: THREE.CanvasTexture; ring: THREE.CanvasTexture } | null = null;
function textures() {
  if (_tex) return _tex;
  _tex = {
    head: radialTexture([[0, "rgba(255,255,255,1)"], [0.2, "rgba(255,240,200,0.9)"], [0.5, "rgba(255,214,140,0.25)"], [1, "rgba(255,200,120,0)"]]),
    ring: radialTexture([[0, "rgba(255,255,255,0)"], [0.62, "rgba(255,255,255,0)"], [0.78, "rgba(255,255,255,0.9)"], [0.9, "rgba(255,255,255,0.25)"], [1, "rgba(255,255,255,0)"]]),
  };
  return _tex;
}

/* ── Rules applied to the shared state (outside React) ─────────── */

/** Applies a pulse's end; returns what it did to the seal. */
function applyHit(g: ArchiveState, hit: Hit, reduced: boolean): "crack" | "freed" | "none" {
  const w = window as unknown as { __archiveHits?: string[] };
  (w.__archiveHits ??= []).push(hit.kind);
  if (hit.kind !== "facet") return "none"; // body, shard, fizzle: the pulse is wasted
  const s = g.seals[hit.seal];
  const r = resolveFacetHit(s);
  if (r === "none") return r;
  if (hit.local) s.cracks.push(hit.local);
  if (r === "freed") {
    s.freedAt = g.t;
    useArchiveProgress.getState().free(sealSlug(hit.seal));
    g.shake = reduced ? 0 : 0.6;
    return r;
  }
  s.litFacet = nextFacet(s.litFacet, s.hits);
  g.shake = reduced ? 0 : 0.35;
  return r;
}

function tickClock(g: ArchiveState, t: number) {
  g.t = t;
}

function nudgeReticle(h: HudEls) {
  h.reticle?.animate(
    [{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }],
    { duration: 220, easing: "ease-out" },
  );
}

/** True once per release request; clears it. */
function consumeFire(inp: InputState): boolean {
  const f = inp.fire;
  inp.fire = false;
  return f;
}

function addCharge(g: ArchiveState, n: number) {
  g.charge = Math.min(CHARGE_FULL, g.charge + n);
}
function spendCharge(g: ArchiveState) {
  g.charge = 0;
}
function setStartCharge(g: ArchiveState) {
  if (!START_CHARGE) return;
  g.charge = START_CHARGE;
  // Test hook alongside archivecharge: Playwright can recharge between shots
  (window as unknown as { __archiveRecharge?: () => void }).__archiveRecharge = () => {
    g.charge = CHARGE_FULL;
  };
}

/* ── Motes ────────────────────────────────────────────────────── */

const MOTE_VERT = /* glsl */ `
  attribute float aAlpha;
  uniform float uPx;
  uniform float uTime;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = max(0.3, -mv.z);
    float tw = 0.8 + 0.2 * sin(uTime * 3.0 + position.x * 1.7 + position.z);
    gl_PointSize = uPx * 110.0 / dist;
    vA = aAlpha * tw * smoothstep(0.6, 2.0, dist);
  }
`;
const MOTE_FRAG = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = smoothstep(0.28, 0.0, d);
    float halo = smoothstep(1.0, 0.0, d) * 0.35;
    gl_FragColor = vec4(vec3(1.0, 0.86, 0.55) * (core + halo) * vA, 1.0);
  }
`;

interface PlayProps {
  input: React.RefObject<InputState>;
  game: React.RefObject<ArchiveState>;
  hud: React.RefObject<HudEls>;
  registry: SealRegistry;
  reduced: boolean;
}

const _f = new THREE.Vector3();
const _u = new THREE.Vector3();

export default function Play({ input, game, hud, registry, reduced }: PlayProps) {
  const motes = useRef<Mote[] | null>(null);
  const pulse = useRef<Pulse | null>(null);
  const trail = useRef<V3[]>([]);
  const clock = useRef(0);
  const started = useRef(false);
  const moteGeo = useRef<THREE.BufferGeometry>(null);
  const moteMat = useRef<THREE.ShaderMaterial>(null);
  const head = useRef<THREE.Sprite>(null);
  const trailRefs = useRef<(THREE.Sprite | null)[]>([]);
  const impacts = useRef<(THREE.Sprite | null)[]>([]);
  const impactState = useRef<{ t0: number; kind: Hit["kind"]; alive: boolean }[]>(
    Array.from({ length: 4 }, () => ({ t0: 0, kind: "fizzle" as Hit["kind"], alive: false })),
  );
  const tex = useMemo(() => textures(), []);
  const buffers = useMemo(() => ({ pos: new Float32Array(MOTE_COUNT * 3), alpha: new Float32Array(MOTE_COUNT) }), []);
  const uniforms = useMemo(() => ({ uPx: { value: 1 }, uTime: { value: 0 } }), []);

  useFrame((state, delta) => {
    const g = game.current;
    const inp = input.current;
    const dt = Math.min(delta, MAX_DT);
    clock.current += dt;
    const t = clock.current;
    tickClock(g, t);
    if (!started.current) {
      started.current = true;
      setStartCharge(g);
    }
    motes.current ??= createMotes(SEALS.map((s) => s.pos));
    const ms = motes.current;
    const cam = state.camera;
    const player: V3 = [cam.position.x, cam.position.y, cam.position.z];

    // Motes: drift, pull, collect
    const got = stepMotes(ms, t, dt, player, g.charge, reduced);
    if (got) addCharge(g, got);

    // Release
    if (consumeFire(inp)) {
      if (g.charge >= CHARGE_FULL && !pulse.current) {
        cam.getWorldDirection(_f);
        _u.set(0, 1, 0).applyQuaternion(cam.quaternion);
        // From just below the eye, converging on the reticle's aim line
        const origin: V3 = [
          cam.position.x + _f.x * 0.9 - _u.x * 0.3,
          cam.position.y + _f.y * 0.9 - _u.y * 0.3,
          cam.position.z + _f.z * 0.9 - _u.z * 0.3,
        ];
        const aim: V3 = [cam.position.x + _f.x * 40, cam.position.y + _f.y * 40, cam.position.z + _f.z * 40];
        pulse.current = releasePulse(origin, [aim[0] - origin[0], aim[1] - origin[1], aim[2] - origin[2]]);
        trail.current = [];
        spendCharge(g);
      } else if (!pulse.current) {
        nudgeReticle(hud.current);
      }
    }

    // Pulse
    const p = pulse.current;
    if (p) {
      const hit = stepPulse(p, dt, registry.targets.filter(Boolean));
      trail.current.unshift([...p.pos] as V3);
      if (trail.current.length > TRAIL) trail.current.length = TRAIL;
      if (hit) {
        applyHit(g, hit, reduced);
        const slot = impactState.current.findIndex((s) => !s.alive);
        const k = slot < 0 ? 0 : slot;
        impactState.current[k] = { t0: t, kind: hit.kind, alive: true };
        impacts.current[k]?.position.set(...hit.at);
        pulse.current = null;
      }
    }
    if (head.current) {
      head.current.visible = !!pulse.current;
      if (pulse.current) head.current.position.set(...pulse.current.pos);
    }
    trailRefs.current.forEach((sp, i) => {
      if (!sp) return;
      const q = trail.current[i + 1];
      sp.visible = !!pulse.current && !!q;
      if (q) sp.position.set(...q);
    });

    // Impacts: a ring that opens and fades
    impactState.current.forEach((s, i) => {
      const sp = impacts.current[i];
      if (!sp) return;
      const life = s.kind === "facet" ? 0.7 : 0.4;
      const a = (t - s.t0) / life;
      if (!s.alive || a >= 1) {
        s.alive = false;
        sp.visible = false;
        return;
      }
      sp.visible = true;
      const size = (s.kind === "facet" ? SEAL.radius * 1.6 : 1.6) * (0.2 + 0.8 * Math.sqrt(a));
      sp.scale.set(size, size, 1);
      const m = sp.material as THREE.SpriteMaterial;
      m.opacity = (1 - a) * (s.kind === "facet" ? 1 : 0.5);
      m.color.set(s.kind === "facet" ? "#ffe2a0" : "#a99bd6");
    });

    // Motes to the GPU
    const geo = moteGeo.current;
    if (geo) {
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      const al = geo.getAttribute("aAlpha") as THREE.BufferAttribute;
      for (let i = 0; i < ms.length; i++) {
        pos.setXYZ(i, ms[i].pos[0], ms[i].pos[1], ms[i].pos[2]);
        al.setX(i, ms[i].alive ? ms[i].fade : 0);
      }
      pos.needsUpdate = true;
      al.needsUpdate = true;
    }
    if (moteMat.current) {
      moteMat.current.uniforms.uPx.value = state.gl.getPixelRatio();
      moteMat.current.uniforms.uTime.value = reduced ? 0 : t;
    }
  });

  return (
    <>
      <points frustumCulled={false}>
        <bufferGeometry ref={moteGeo}>
          <bufferAttribute attach="attributes-position" args={[buffers.pos, 3]} />
          <bufferAttribute attach="attributes-aAlpha" args={[buffers.alpha, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={moteMat}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={uniforms}
          vertexShader={MOTE_VERT}
          fragmentShader={MOTE_FRAG}
        />
      </points>
      <sprite ref={head} scale={[2.4, 2.4, 1]} visible={false}>
        <spriteMaterial map={tex.head} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} toneMapped={false} />
      </sprite>
      {Array.from({ length: TRAIL - 1 }, (_, i) => (
        <sprite
          key={i}
          ref={(el) => { trailRefs.current[i] = el; }}
          scale={[1.8 * (1 - i / TRAIL), 1.8 * (1 - i / TRAIL), 1]}
          visible={false}
        >
          <spriteMaterial map={tex.head} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} opacity={0.55 * (1 - i / TRAIL)} toneMapped={false} />
        </sprite>
      ))}
      {Array.from({ length: 4 }, (_, i) => (
        <sprite key={`impact-${i}`} ref={(el) => { impacts.current[i] = el; }} visible={false}>
          <spriteMaterial map={tex.ring} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} toneMapped={false} />
        </sprite>
      ))}
    </>
  );
}
