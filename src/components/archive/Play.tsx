"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  CHARGE_FULL, ENDING, MOTES, WALL, createMotes, endingDue, nextFacet, releasePulse, resolveFacetHit, stepMotes, stepPulse,
  type Hit, type Mote, type Pulse, type V3,
} from "./game";
import { sealSlug, type ArchiveState, type HudEls } from "./archiveState";
import { useArchiveProgress } from "@/store/useArchiveProgress";
import { useArchiveStore } from "@/store/useArchiveStore";
import { useSoundStore } from "@/store/useSoundStore";
import {
  playFacetCrack, playFreeBloom, playMote, playReassembled, playThud, setChargedHum, setFreedHarmonics,
} from "./archiveAudio";
import type { InputState } from "./input";
import type { SealRegistry } from "./Seal";
import { timed } from "@/components/scene/costs";
import { SEAL, SEALS } from "./layout";
import { CSS_EASE, FEEDBACK } from "@/lib/motion";

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
  // A fight lights the next equatorial facet (it must face the window)
  s.litFacet = SEAL.fight.includes(hit.seal) ? WALL.facets[s.hits % WALL.facets.length] : nextFacet(s.litFacet, s.hits);
  g.shake = reduced ? 0 : 0.35;
  return r;
}

function tickClock(g: ArchiveState, t: number) {
  g.t = t;
}

/** Sounds that follow state, sent only when it changes (not every frame). */
const _audio = { hum: "", harmonics: -1, formed: false };
function followAudio(g: ArchiveState) {
  const enabled = useSoundStore.getState().enabled;
  // Held while the pulse is ready, inside the open Archive, before the ending
  const hum = enabled && g.charge >= CHARGE_FULL && useArchiveStore.getState().open && !g.ending;
  const key = `${hum}`;
  if (key !== _audio.hum) {
    _audio.hum = key;
    setChargedHum(hum);
  }
  const n = g.seals.filter((s) => s.freed).length;
  if (n !== _audio.harmonics) {
    _audio.harmonics = n;
    setFreedHarmonics(n);
  }
  // The crystal is whole: the full triad, once
  const formed = !!g.ending && g.t - g.ending.t0 >= ENDING.converge;
  if (formed && !_audio.formed) playReassembled();
  _audio.formed = formed;
}

function hitSound(kind: Hit["kind"], result: "crack" | "freed" | "none", seal: number) {
  if (result === "freed") {
    playFacetCrack();
    playFreeBloom(seal);
  } else if (result === "crack") playFacetCrack();
  else if (kind !== "fizzle") playThud(); // body or shard: the pulse is wasted
}

const _ef = new THREE.Vector3();
/** All three freed: once the last panel is floated into (or the wait runs out), the crystal reassembles in front of you. */
function maybeStartEnding(g: ArchiveState, cam: THREE.Camera) {
  if (g.ending || g.completedBefore || !g.seals.every((s) => s.freed)) return;
  const last = g.seals.reduce((a, s) => (s.freedAt > a.freedAt ? s : a));
  if (!endingDue(true, last.freedAt, last.touched, g.t)) return;
  cam.getWorldDirection(_ef);
  g.ending = {
    t0: g.t,
    point: [cam.position.x + _ef.x * ENDING.distance, cam.position.y + _ef.y * ENDING.distance, cam.position.z + _ef.z * ENDING.distance],
  };
}

/** Dry fire: the reticle and the empty diamonds shake once. */
function nudgeReticle(h: HudEls) {
  const shake = [{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }];
  const timing = { duration: FEEDBACK.response * 1000, easing: CSS_EASE.entrance };
  h.reticle?.animate(shake, timing);
  h.motes?.animate(shake, timing);
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
/** Test hooks (scripts/shot/fight.mjs): the motes and the charge, live. */
function exposePlay(g: ArchiveState, ms: Mote[]) {
  const w = window as unknown as { __archiveMotes?: Mote[]; __archiveCharge?: () => number };
  w.__archiveMotes = ms;
  w.__archiveCharge = () => g.charge;
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

/* ── Shatter: a blocked pulse breaks into sparks ───────────────── */

const SHATTER_SLOTS = 3;
const SPARKS = 26;
/** Seconds a shatter lasts; sparks decelerate and fade over it. */
const SHATTER_LIFE = 0.55;
/** Spark directions, fixed: a cone thrown back off the shard, plus scatter. */
const SPARK_DIRS: V3[] = (() => {
  let s = 911;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: SPARKS }, () => {
    const th = Math.acos(2 * rnd() - 1);
    const ph = rnd() * Math.PI * 2;
    const sp = 0.5 + rnd();
    return [Math.sin(th) * Math.cos(ph) * sp, Math.cos(th) * sp, Math.sin(th) * Math.sin(ph) * sp] as V3;
  });
})();

const SPARK_VERT = /* glsl */ `
  attribute float aAlpha;
  uniform float uPx;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPx * 190.0 / max(0.3, -mv.z);
    vA = aAlpha;
  }
`;
const SPARK_FRAG = /* glsl */ `
  varying float vA;
  void main() {
    vec2 q = abs(gl_PointCoord - 0.5) * 2.0;
    // A small hard diamond: a chip of the pulse, not a soft mote
    float d = q.x + q.y;
    float a = smoothstep(1.0, 0.6, d) * vA;
    // Hot white-gold when fresh, cooling to violet: reads on violet fog
    gl_FragColor = vec4(mix(vec3(0.8, 0.72, 1.0), vec3(1.4, 1.25, 0.95), vA) * a, 1.0);
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
  const tex = useMemo(() => timed("archive: mote textures", () => textures()), []);
  const buffers = useMemo(() => ({ pos: new Float32Array(MOTE_COUNT * 3), alpha: new Float32Array(MOTE_COUNT) }), []);
  const uniforms = useMemo(() => ({ uPx: { value: 1 }, uTime: { value: 0 } }), []);
  const sparkGeo = useRef<THREE.BufferGeometry>(null);
  const sparkBuf = useMemo(() => ({ pos: new Float32Array(SHATTER_SLOTS * SPARKS * 3), alpha: new Float32Array(SHATTER_SLOTS * SPARKS) }), []);
  const sparkUniforms = useMemo(() => ({ uPx: { value: 1 } }), []);
  const sparkMat = useRef<THREE.ShaderMaterial>(null);
  /** Live shatters: where, which way the pulse was going, when. */
  const shatters = useRef(Array.from({ length: SHATTER_SLOTS }, () => ({ t0: -1, at: [0, 0, 0] as V3, dir: [0, 0, 1] as V3 })));

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
    // A fight's motes lie in a band well outside its firing ring (game.ts)
    motes.current ??= createMotes(SEALS.map((s) => s.pos), 2024, SEALS.map((_, i) => SEAL.fight.includes(i)));
    const ms = motes.current;
    if (t === dt) exposePlay(g, ms);
    const cam = state.camera;
    const player: V3 = [cam.position.x, cam.position.y, cam.position.z];

    maybeStartEnding(g, cam);

    // Motes: drift, pull, collect
    const got = stepMotes(ms, t, dt, player, g.charge, reduced);
    if (got) {
      addCharge(g, got);
      playMote(g.charge);
    }

    // Release
    if (consumeFire(inp) && !g.ending) {
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
        hitSound(hit.kind, applyHit(g, hit, reduced), hit.seal);
        const slot = impactState.current.findIndex((s) => !s.alive);
        const k = slot < 0 ? 0 : slot;
        impactState.current[k] = { t0: t, kind: hit.kind, alive: true };
        impacts.current[k]?.position.set(...hit.at);
        // Blocked by a shard: the pulse visibly breaks up where it struck
        if (hit.kind === "shard" || hit.kind === "body") {
          const sl = shatters.current.reduce((a, b) => (b.t0 < a.t0 ? b : a));
          sl.t0 = t;
          sl.at = [...hit.at] as V3;
          sl.dir = [...p.dir] as V3;
        }
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
      // A blocked pulse gets a tight, hard ring: it broke here
      const size = (s.kind === "facet" ? SEAL.radius * 1.6 : 3.2) * (0.2 + 0.8 * Math.sqrt(a));
      sp.scale.set(size, size, 1);
      const m = sp.material as THREE.SpriteMaterial;
      m.opacity = (1 - a) * (s.kind === "facet" ? 1 : 0.9);
      m.color.set(s.kind === "facet" ? "#ffe2a0" : "#e9ddff");
    });

    // Sparks: thrown back off the shard and scattered, slowing as they fade
    const sg = sparkGeo.current;
    if (sg) {
      const pos = sg.getAttribute("position") as THREE.BufferAttribute;
      const al = sg.getAttribute("aAlpha") as THREE.BufferAttribute;
      shatters.current.forEach((sl, si) => {
        const age = sl.t0 < 0 ? Infinity : t - sl.t0;
        const a = age / SHATTER_LIFE;
        // Ease-out travel: fast off the shard, settling (1 - (1 - a)^3)
        const travel = a >= 1 ? 0 : (1 - Math.pow(1 - a, 3)) * 3.2;
        for (let k = 0; k < SPARKS; k++) {
          const d = SPARK_DIRS[k];
          const idx = si * SPARKS + k;
          // Recoil: biased back against the pulse's travel
          pos.setXYZ(
            idx,
            sl.at[0] + (d[0] - sl.dir[0] * 0.9) * travel,
            sl.at[1] + (d[1] - sl.dir[1] * 0.9) * travel,
            sl.at[2] + (d[2] - sl.dir[2] * 0.9) * travel,
          );
          al.setX(idx, a >= 1 ? 0 : (1 - a) * (1 - a));
        }
      });
      pos.needsUpdate = true;
      al.needsUpdate = true;
    }
    if (sparkMat.current) sparkMat.current.uniforms.uPx.value = state.gl.getPixelRatio();

    followAudio(g);

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
      <points frustumCulled={false}>
        <bufferGeometry ref={sparkGeo}>
          <bufferAttribute attach="attributes-position" args={[sparkBuf.pos, 3]} />
          <bufferAttribute attach="attributes-aAlpha" args={[sparkBuf.alpha, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={sparkMat}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={sparkUniforms}
          vertexShader={SPARK_VERT}
          fragmentShader={SPARK_FRAG}
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
