"use client";

import { forwardRef, use, useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { MeshTransmissionMaterial, useFBO } from "@react-three/drei";
import * as THREE from "three";
import { useFractureStore } from "@/store/useFractureStore";
import { getCrystalPose } from "@/hooks/useCrystalPose";
import { setCrystalTimeOverride } from "@/hooks/crystalState";
import { useCrystalSound } from "@/hooks/useCrystalSound";
import { initAudioContext } from "@/hooks/crystalAudio";
import { useSoundStore } from "@/store/useSoundStore";
import { createGlowTexture } from "./frostUtils";
import { decodeCrystal, TARGET_SIZE } from "./crystalGen";
import {
  CRYSTAL_MATERIAL,
  applyCrystalShader,
  getFrostNormalMap,
  getRoughnessMap,
  getCreviceMap,
  thicknessFor,
} from "./crystalMaterial";
import { HERO_LOGO_FILL, getHeroLogos, getUnitLogos } from "./logoGeometry";

/** Seconds between hero logo swaps in the intact crystal. */
export const LOGO_CYCLE_SECONDS = 3.5;
/** Reduced motion: slower cycle, crossfade instead of scale + spin. */
const LOGO_CYCLE_SECONDS_REDUCED = 6;
const SWAP_OUT = 0.35;
const SWAP_IN = 0.45;
const SWAP_SPIN = THREE.MathUtils.degToRad(25);

/*
 * Hero logo cycle state, shared by the WAKE and DREAM instances so both
 * show the same logo when the mode flips. Only the active instance runs
 * its frame loop, so only one advances it.
 */
const heroCycle = {
  index: 0,
  phase: "hold" as "hold" | "out" | "in",
  t: 0,
};

const expoIn = (x: number) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10));
const backOut = (x: number, s = 1.6) => {
  const u = x - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};

/** A very quiet glass tick for each logo swap (only when sound is on). */
function playSwapTick() {
  if (!useSoundStore.getState().enabled) return;
  try {
    const ctx = initAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(3400, now);
    osc.frequency.exponentialRampToValueAtTime(2600, now + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.012, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch {
    // Audio is decoration; never let it break the frame loop
  }
}

/*
 * Test-only views behind URL params (Playwright comparisons; the UI never
 * sets them): crystalview=assembled shows the shards laid back together in
 * place of the intact mesh; crystalfreeze=<s> pins rotation and the logo;
 * crystallogo=0 hides the hero logo (to sample the glass behind it).
 */
const DEBUG = (() => {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const freeze = q.has("crystalfreeze") ? Number(q.get("crystalfreeze")) : null;
  if (freeze !== null) setCrystalTimeOverride(freeze);
  return { assembled: q.get("crystalview") === "assembled", freeze, noLogo: q.get("crystallogo") === "0" };
})();

const _swayEuler = new THREE.Euler();
const _swayQ = new THREE.Quaternion();
const _parentInvQ = new THREE.Quaternion();
const _identityQ = new THREE.Quaternion();
const _shardWorldQ = new THREE.Quaternion();
const _faceQ = new THREE.Quaternion();
const _wp = new THREE.Vector3();
const _fwd = new THREE.Vector3();

/* ── Seeded PRNG ───────────────────────────────────────────────── */

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── Crystal data: one generated source ─────────────────────────
 * The intact chunk and its shards are generated at build time from one
 * procedural mesh (crystalGen.ts, npm run gen:crystal) and loaded here.
 * Shards are Voronoi cells cut out of the intact mesh itself. */

const DEFAULT_SEED = 105;
/** Nominal radius for the inclusion needles (the chunk is ~2.4 across). */
const R = 1.4;
const TWO_PI = Math.PI * 2;
const CRYSTAL_URL = "/models/crystal-chunk.bin";
const arrayBuffer = (loader: THREE.Loader) => (loader as THREE.FileLoader).setResponseType("arraybuffer");

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export interface ShardData {
  geometry: THREE.BufferGeometry;
  /** Largest bounding-box side, for thickness and logo sizing. */
  size: number;
  centroid: THREE.Vector3;
  direction: THREE.Vector3;
  tumbleAxis: THREE.Vector3;
  tumbleSpeed: number;
  driftCenter: THREE.Vector3;
  lissFreq: THREE.Vector3;
  lissPhase: THREE.Vector3;
  lissAmp: THREE.Vector3;
  brokenScale: number;
}

/** Recentre each shard on its centroid and give it its flight path. */
function buildShards(geos: THREE.BufferGeometry[], seed: number): ShardData[] {
  const animRng = seededRandom(seed + 7777);
  return geos.map((geo) => {
    const pos = geo.attributes.position;
    const centroid = new THREE.Vector3();
    for (let v = 0; v < pos.count; v++) {
      centroid.x += pos.getX(v);
      centroid.y += pos.getY(v);
      centroid.z += pos.getZ(v);
    }
    centroid.divideScalar(pos.count);
    geo.translate(-centroid.x, -centroid.y, -centroid.z);
    geo.computeBoundingBox();
    const dims = geo.boundingBox!.getSize(new THREE.Vector3());
    const size = Math.max(dims.x, dims.y, dims.z);

    const direction = centroid.clone().normalize();
    const tumbleAxis = new THREE.Vector3(animRng() - 0.5, animRng() - 0.5, animRng() - 0.5).normalize();
    const tumbleSpeed = 0.3 + animRng() * 0.4;
    // Bias drift targets to the top band and the right third, keeping
    // shards off the hero centre line and the project text column
    const edgeBias = animRng();
    let dx: number, dy: number;
    if (edgeBias < 0.5) {
      dx = 1.9 + animRng() * 1.3;
      dy = (animRng() - 0.4) * 2.6;
    } else {
      dx = (animRng() - 0.35) * 3.2;
      dy = 1.3 + animRng() * 1.1;
    }
    const driftCenter = new THREE.Vector3(dx, dy, (animRng() - 0.5) * 0.6);
    const lissFreq = new THREE.Vector3(0.15 + animRng() * 0.2, 0.12 + animRng() * 0.18, 0.08 + animRng() * 0.12);
    const lissPhase = new THREE.Vector3(animRng() * TWO_PI, animRng() * TWO_PI, animRng() * TWO_PI);
    const lissAmp = new THREE.Vector3(0.3 + animRng() * 0.5, 0.2 + animRng() * 0.4, 0.1 + animRng() * 0.2);
    const brokenScale = 0.35 + animRng() * 0.25;
    return {
      geometry: geo, size, centroid, direction, tumbleAxis, tumbleSpeed,
      driftCenter, lissFreq, lissPhase, lissAmp, brokenScale,
    };
  });
}

/**
 * Resolves once the page has painted and finished loading. The crystal
 * (~0.5 MB) must never compete with first paint or the page's own
 * scripts, so its fetch waits for this; the scene suspends meanwhile
 * (the preloader already waits for the scene's first frame).
 */
let _afterPaint: Promise<void> | null = null;
function afterFirstPaint(): Promise<void> {
  if (_afterPaint) return _afterPaint;
  _afterPaint = new Promise<void>((resolve) => {
    const painted = () => requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    if (document.readyState === "complete") painted();
    else window.addEventListener("load", painted, { once: true });
  });
  return _afterPaint;
}

export function useCrystalData(seed = DEFAULT_SEED) {
  use(afterFirstPaint());
  const buf = useLoader(THREE.FileLoader, CRYSTAL_URL, arrayBuffer) as unknown as ArrayBuffer;
  return useMemo(() => {
    const [intact, ...shardGeos] = decodeCrystal(buf);
    return { intact, shards: buildShards(shardGeos, seed) };
  }, [buf, seed]);
}

/*
 * Logo look. A logo reads by its silhouette plus its edge shading, so the
 * faces stay lit by the environment (low emissive: at 2.0 the WAKE logo
 * blew out into a flat grey disc) and the extrusion walls get a darker
 * material so the edge shows. DREAM may glow, never above 0.6. No
 * ghost copies anywhere: the glass makes a logo readable, not an overlay.
 * The rim is an inverted hull that keeps a
 * defined outline against the light page.
 */
const LOGO_LOOK = {
  wake: {
    color: "#6c7482",
    emissive: "#5d6472",
    emissiveIntensity: 0.15,
    side: "#262a31",
    roughness: 0.45,
    metalness: 0.0,
    envMapIntensity: 0.9,
    rim: "#6f7889",
  },
  dream: {
    color: "#ffffff",
    emissive: "#ffffff",
    emissiveIntensity: 0.6,
    side: "#8f80d6",
    roughness: 0.3,
    metalness: 0.1,
    envMapIntensity: 4.0,
    rim: "#c8b8ff",
  },
} as const;
const RIM_SCALE = 1.02;
const RIM_OPACITY = 0.35;
/*
 * Shard logos are drawn over their shard, not refracted through it: seen
 * only through a small tumbling faceted shard, the WAKE logos smeared
 * into dark blotches. They stay out of the shard backdrop pass.
 */
const SHARD_LOGO_RENDER_ORDER = 9;
// Shard rims draw just before their logo (both skip the depth test), so
// the logo covers all but the thin outline
const SHARD_RIM_RENDER_ORDER = 8;
// Hero rim draws after the hero logo so the logo's depth hides its centre
const HERO_RIM_RENDER_ORDER = 1;

/** Broken state: logos on the 5 largest shards only (fewer, bigger). */
const SHARD_LOGO_COUNT = 5;
/** Logo size as a fraction of its shard's smallest projected dimension. */
const SHARD_LOGO_FILL = 0.45;
/** Below this on-screen shard size a logo is noise: the shard carries none. */
const SHARD_LOGO_MIN_PX = 70;
/** Camera-facing, but never turned more than this from the shard itself. */
const SHARD_LOGO_MAX_TURN = THREE.MathUtils.degToRad(35);
/** Vertices sampled per shard to measure its projected silhouette. */
const SHARD_SAMPLE = 192;
const INCLUSION_COUNT = CRYSTAL_MATERIAL.slivers;

/* ── Component ───────────────────────────────────────────────── */

interface GlassCrystalProps {
  seed?: number;
  variant?: "wake" | "dream";
  active?: boolean;
}

/* ── Inclusion sliver data (random thin needles inside crystal) ── */

interface InclusionData {
  matrix: THREE.Matrix4;
}

function buildInclusions(seed: number, count: number, maxR: number): InclusionData[] {
  const rng = seededRandom(seed + 9999);
  const out: InclusionData[] = [];
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _euler = new THREE.Euler();
  const _scale = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const r = rng() * maxR * 0.35;
    const th = Math.acos(2 * rng() - 1);
    const ph = TWO_PI * rng();
    _pos.set(
      r * Math.sin(th) * Math.cos(ph),
      r * Math.sin(th) * Math.sin(ph),
      r * Math.cos(th),
    );
    const length = 0.35 + rng() * 0.35;
    const thickness = 0.007 + rng() * 0.007;
    _scale.set(thickness, length, thickness);
    _euler.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    _quat.setFromEuler(_euler);

    const m = new THREE.Matrix4();
    m.compose(_pos, _quat, _scale);
    out.push({ matrix: m });
  }
  return out;
}

/* ── Component ───────────────────────────────────────────────── */

const _inclusionGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 4, 1);
const CLOUD = CRYSTAL_MATERIAL.cloud;
const SLIVER_OPACITY = 0.5;

/** Set every material under an internal-cloud group to its base opacity x k. */
/** Opacity on a mesh with one material or a [caps, walls] pair. */
function setOpacity(mesh: THREE.Mesh, a: number) {
  const m = mesh.material;
  if (Array.isArray(m)) for (const x of m) x.opacity = a;
  else if (m) m.opacity = a;
}

const _sv = new THREE.Vector3();
const _sq = new THREE.Quaternion();
/**
 * Smallest side of a shard's silhouette as the camera sees it, in group
 * units: sampled vertices rotated by the group and the shard's tumble,
 * scaled by the shard, measured across the view plane (the camera looks
 * down -Z, so view x/y are world x/y).
 */
function projectedShortSide(samples: Float32Array, shard: THREE.Mesh, parentQ: THREE.Quaternion): number {
  _sq.multiplyQuaternions(parentQ, shard.quaternion);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let k = 0; k < samples.length; k += 3) {
    _sv.set(samples[k], samples[k + 1], samples[k + 2]).applyQuaternion(_sq);
    if (_sv.x < x0) x0 = _sv.x;
    if (_sv.x > x1) x1 = _sv.x;
    if (_sv.y < y0) y0 = _sv.y;
    if (_sv.y > y1) y1 = _sv.y;
  }
  return Math.min(x1 - x0, y1 - y0) * shard.scale.x;
}

function setCloudOpacity(g: THREE.Object3D, k: number) {
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && typeof o.userData.baseOpacity === "number") m.opacity = o.userData.baseOpacity * k;
  });
}

const GlassCrystal = forwardRef<THREE.Group, GlassCrystalProps>(
  function GlassCrystal({ seed = DEFAULT_SEED, variant = "wake", active = true }, ref) {
    const { intact: intactGeo, shards } = useCrystalData(seed);
    const tint = CRYSTAL_MATERIAL.tint[variant];
    const logoLook = LOGO_LOOK[variant];
    useCrystalSound();

    // ONE material: every value below is shared by the intact mesh and the
    // shards; only thickness (by mesh size) and backdrop resolution differ
    const glass = useMemo(
      () => ({
        transmission: 1,
        ior: CRYSTAL_MATERIAL.ior,
        chromaticAberration: CRYSTAL_MATERIAL.chromaticAberration,
        anisotropicBlur: CRYSTAL_MATERIAL.anisotropicBlur,
        roughness: CRYSTAL_MATERIAL.roughness,
        roughnessMap: getRoughnessMap(),
        clearcoat: CRYSTAL_MATERIAL.clearcoat,
        clearcoatRoughness: CRYSTAL_MATERIAL.clearcoatRoughness,
        distortion: CRYSTAL_MATERIAL.distortion,
        distortionScale: CRYSTAL_MATERIAL.distortionScale,
        temporalDistortion: CRYSTAL_MATERIAL.temporalDistortion,
        samples: CRYSTAL_MATERIAL.samples,
        attenuationDistance: CRYSTAL_MATERIAL.attenuationDistance,
        envMapIntensity: CRYSTAL_MATERIAL.envMapIntensity,
        color: tint.color,
        attenuationColor: tint.attenuationColor,
        normalMap: getFrostNormalMap(),
        normalScale: new THREE.Vector2(CRYSTAL_MATERIAL.normalScale, CRYSTAL_MATERIAL.normalScale),
        iridescence: CRYSTAL_MATERIAL.iridescence,
        iridescenceIOR: CRYSTAL_MATERIAL.iridescenceIOR,
        iridescenceThicknessMinimum: CRYSTAL_MATERIAL.iridescenceThicknessMinimum,
        iridescenceThicknessMaximum: CRYSTAL_MATERIAL.iridescenceThicknessMaximum,
        iridescenceMap: getCreviceMap(),
        // Rim + streak shading chained onto drei's own shader patch
        ref: (m: unknown) => applyCrystalShader(m as THREE.Material | null),
      }),
      [tint],
    );

    const glowTex = useMemo(() => createGlowTexture(128), []);
    const inclusions = useMemo(() => buildInclusions(seed, INCLUSION_COUNT, R), [seed]);
    // Hero logo size: HERO_LOGO_FILL of the intact crystal's smallest side,
    // computed from the mesh (its thinnest caliper is still wider, so the
    // logo never pokes out of the silhouette at any angle)
    const heroLogos = useMemo(() => {
      intactGeo.computeBoundingBox();
      const d = intactGeo.boundingBox!.getSize(new THREE.Vector3());
      return getHeroLogos(HERO_LOGO_FILL * Math.min(d.x, d.y, d.z));
    }, [intactGeo]);
    const unitLogos = useMemo(() => getUnitLogos(), []);
    // The largest shards (by volume) each carry a logo, sized from the
    // shard's own bounds; smaller shards and debris carry none
    const shardLogoSlots = useMemo(() => {
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      const info = shards.map((s, i) => {
        const pos = s.geometry.attributes.position;
        let vol = 0;
        for (let v = 0; v + 2 < pos.count; v += 3) {
          a.fromBufferAttribute(pos, v);
          b.fromBufferAttribute(pos, v + 1);
          c.fromBufferAttribute(pos, v + 2);
          vol += a.dot(b.clone().cross(c)) / 6;
        }
        s.geometry.computeBoundingBox();
        const size = s.geometry.boundingBox!.getSize(new THREE.Vector3());
        // Face-on silhouette: the two largest dims; its short side is the
        // middle one (the smallest is the slab's thickness)
        const dims = [size.x, size.y, size.z].sort((p, q) => p - q);
        // A spread of vertices to measure the projected silhouette each frame
        const step = Math.max(1, Math.floor(pos.count / SHARD_SAMPLE));
        const samples: number[] = [];
        for (let v = 0; v < pos.count; v += step) samples.push(pos.getX(v), pos.getY(v), pos.getZ(v));
        return { shard: i, vol: Math.abs(vol), shortSide: dims[1], samples: new Float32Array(samples) };
      });
      return info
        .sort((p, q) => q.vol - p.vol)
        .slice(0, SHARD_LOGO_COUNT)
        .map((r, rank) => ({
          shard: r.shard,
          rank,
          samples: r.samples,
          /** Starting size until the first projection is measured. */
          size: SHARD_LOGO_FILL * r.shortSide,
        }));
    }, [shards]);
    /** Smoothed per-slot logo size (group units), so tumbling never pulses it. */
    const shardLogoSize = useRef<number[]>([]);
    // Internal cloud for the shards: each of the largest shards also
    // carries one sliver, so shattered ice is no emptier than intact ice
    const shardSlivers = useMemo(() => {
      const rng = seededRandom(seed + 4242);
      const ranked = [...shardLogoSlots].map((s) => s.shard);
      return shards.map((s, i) => {
        if (!ranked.slice(0, CRYSTAL_MATERIAL.slivers).includes(i)) return null;
        s.geometry.computeBoundingBox();
        const d = s.geometry.boundingBox!.getSize(new THREE.Vector3());
        const short = [d.x, d.y, d.z].sort((p, q) => p - q)[1];
        return {
          rotation: [rng() * Math.PI, rng() * Math.PI, rng() * Math.PI] as [number, number, number],
          length: Math.min(0.55, short * 0.7),
          thickness: 0.007 + rng() * 0.006,
        };
      });
    }, [shards, shardLogoSlots, seed]);
    const reducedMotion = useMemo(
      () =>
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      [],
    );

    const { scene: portalScene, camera: portalCamera } = useThree();
    const mergedRef = useRef<THREE.Mesh>(null);
    const heroLogoRef = useRef<THREE.Mesh>(null);
    const heroRimRef = useRef<THREE.Mesh>(null);
    const shardLogoRefs = useRef<(THREE.Mesh | null)[]>([]);
    /** Which shard logos are live; they are drawn only in the shard backdrop pass. */
    const shardLogoOn = useRef<boolean[]>([]);
    const shardRimRefs = useRef<(THREE.Mesh | null)[]>([]);
    const shardMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
    const inclusionRef = useRef<THREE.InstancedMesh>(null);
    const intactCloudRef = useRef<THREE.Mesh>(null);
    const shardCloudRefs = useRef<(THREE.Group | null)[]>([]);
    const glowRef = useRef<THREE.Sprite>(null);
    const showShardsRef = useRef(false);
    const _invQ = useRef(new THREE.Quaternion());
    const _off = useRef(new THREE.Vector3());
    const mergedFbo = useFBO(1024, 1024, { depthBuffer: true });
    const shardFbo = useFBO(CRYSTAL_MATERIAL.resolution.shard, CRYSTAL_MATERIAL.resolution.shard, { depthBuffer: true });

    // Tell the Compositor to precompile now that the crystal is in the graph
    useEffect(() => {
      window.dispatchEvent(new Event("crystal-ready"));
    }, []);

    useEffect(() => {
      if (!inclusionRef.current) return;
      for (let i = 0; i < inclusions.length; i++) {
        inclusionRef.current.setMatrixAt(i, inclusions[i].matrix);
      }
      inclusionRef.current.instanceMatrix.needsUpdate = true;
    }, [inclusions]);

    useFrame((state, rawDelta) => {
      const fade = getCrystalPose().fade;
      if (!active || fade < 0.01) {
        if (mergedRef.current) mergedRef.current.visible = false;
        if (heroLogoRef.current) heroLogoRef.current.visible = false;
        if (heroRimRef.current) heroRimRef.current.visible = false;
        if (inclusionRef.current) inclusionRef.current.visible = false;
        if (intactCloudRef.current) intactCloudRef.current.visible = false;
        for (const g of shardCloudRefs.current) if (g) g.visible = false;
        if (glowRef.current) glowRef.current.visible = false;
        for (let i = 0; i < shards.length; i++) {
          const m = shardMeshRefs.current[i];
          if (m) m.visible = false;
        }
        for (const l of shardLogoRefs.current) if (l) l.visible = false;
        for (const r of shardRimRefs.current) if (r) r.visible = false;
        return;
      }
      const breakVal = useFractureStore.getState().breakVal;
      const elapsed = state.clock.elapsedTime;
      const pose = getCrystalPose();

      if (!showShardsRef.current && breakVal >= 0.08) showShardsRef.current = true;
      if (showShardsRef.current && breakVal <= 0.05) showShardsRef.current = false;
      const assembled = !!DEBUG?.assembled;
      const showShards = assembled || showShardsRef.current;

      // Inclusion + glow visibility follows merged mesh
      const crossfade = assembled ? 1 : showShards ? smoothstep(0.05, 0.15, breakVal) : 0;
      const mergedHidden = crossfade >= 1;

      if (inclusionRef.current) {
        inclusionRef.current.visible = !mergedHidden || assembled;
        const iMat = inclusionRef.current.material as THREE.MeshStandardMaterial;
        if (iMat) iMat.opacity = SLIVER_OPACITY * (assembled ? 1 : 1 - crossfade) * fade;
      }

      const ic = intactCloudRef.current;
      if (ic) {
        ic.visible = !mergedHidden || assembled;
        setCloudOpacity(ic, (assembled ? 1 : 1 - crossfade) * fade);
      }

      if (glowRef.current) {
        glowRef.current.visible = !mergedHidden || assembled;
        const sMat = glowRef.current.material as THREE.SpriteMaterial;
        const glowT = DEBUG?.freeze ?? elapsed;
        if (sMat) sMat.opacity = (0.3 + Math.sin(glowT * 0.8) * 0.08) * (assembled ? 1 : 1 - crossfade) * fade;
      }

      // ── Hero logo: cycles through every icon, always facing the camera
      const delta = Math.min(rawDelta, 0.1);
      const cyc = heroCycle;
      const nLogos = heroLogos.length;
      const paused = useFractureStore.getState().hoverBreak || breakVal > 0.05 || DEBUG?.freeze != null;
      const period = reducedMotion ? LOGO_CYCLE_SECONDS_REDUCED : LOGO_CYCLE_SECONDS;
      if (nLogos > 1) {
        if (cyc.phase === "hold") {
          if (!paused) cyc.t += delta;
          if (cyc.t >= period - SWAP_OUT - SWAP_IN) {
            cyc.phase = "out";
            cyc.t = 0;
          }
        } else {
          cyc.t += delta;
          if (cyc.phase === "out" && cyc.t >= SWAP_OUT) {
            cyc.index = (cyc.index + 1) % nLogos;
            cyc.phase = "in";
            cyc.t = 0;
            playSwapTick();
          } else if (cyc.phase === "in" && cyc.t >= SWAP_IN) {
            cyc.phase = "hold";
            cyc.t = 0;
          }
        }
      }
      let heroScale = 1;
      let heroAlpha = 1;
      let heroSpin = 0;
      if (cyc.phase === "out") {
        const p = Math.min(cyc.t / SWAP_OUT, 1);
        if (reducedMotion) heroAlpha = 1 - p;
        else {
          heroScale = 1 - expoIn(p);
          heroSpin = SWAP_SPIN * 0.5 * p;
        }
      } else if (cyc.phase === "in") {
        const p = Math.min(cyc.t / SWAP_IN, 1);
        if (reducedMotion) heroAlpha = p;
        else {
          heroScale = backOut(p);
          heroSpin = -SWAP_SPIN * 0.5 * (1 - p);
        }
      }

      const heroMesh = heroLogoRef.current;
      if (heroMesh) {
        const geo = heroLogos[cyc.index % Math.max(nLogos, 1)]?.geometry;
        if (geo && heroMesh.geometry !== geo) heroMesh.geometry = geo;

        // Cancel the crystal group's rotation so the logo faces the
        // camera, then add a gentle sway that never reaches edge-on
        const swayT = DEBUG?.freeze ?? elapsed;
        const swayY = reducedMotion ? 0 : Math.sin(swayT * 0.6) * 0.35;
        const swayX = reducedMotion ? 0 : Math.sin(swayT * 0.45) * 0.15;
        _swayEuler.set(swayX, swayY + heroSpin, 0);
        _swayQ.setFromEuler(_swayEuler);
        if (heroMesh.parent) _parentInvQ.copy(heroMesh.parent.quaternion).invert();
        else _parentInvQ.identity();
        heroMesh.quaternion.multiplyQuaternions(_parentInvQ, _swayQ);
        heroMesh.position.set(0, 0, 0);
        heroMesh.scale.setScalar(Math.max(heroScale, 1e-4));

        heroMesh.visible = (!mergedHidden || assembled) && !DEBUG?.noLogo;
        const heroOpacity = (assembled ? 1 : 1 - crossfade) * fade * heroAlpha;
        setOpacity(heroMesh, heroOpacity);

        const rim = heroRimRef.current;
        if (rim) {
          if (rim.geometry !== heroMesh.geometry) rim.geometry = heroMesh.geometry;
          rim.position.copy(heroMesh.position);
          rim.quaternion.copy(heroMesh.quaternion);
          rim.scale.copy(heroMesh.scale).multiplyScalar(RIM_SCALE);
          rim.visible = heroMesh.visible && heroOpacity > 0.001;
          (rim.material as THREE.MeshBasicMaterial).opacity = RIM_OPACITY * heroOpacity;
        }
      }

      if (mergedRef.current) {
        mergedRef.current.visible = !mergedHidden;
        const mat = mergedRef.current.material as THREE.MeshPhysicalMaterial;
        if (mat) {
          mat.visible = !mergedHidden;
          if (!mergedHidden) {
            mat.opacity = (1 - crossfade) * fade;
            mat.transparent = crossfade > 0 || fade < 1;
          }
        }
      }

      // Backdrop FBOs must clear to the scene background, not the
      // compositor's transparent black, or the glass refracts a dark
      // void and the interior logo reads black
      const sceneBg =
        portalScene.background instanceof THREE.Color
          ? portalScene.background
          : null;

      // Shard logos exist only inside the shard backdrop: the shard samples
      // that buffer through its own silhouette, so a logo can never show
      // where its shard is not. They stay hidden for every other render.
      const setShardLogos = (show: boolean) => {
        for (const slot of shardLogoSlots) {
          const v = show && !!shardLogoOn.current[slot.rank];
          const l = shardLogoRefs.current[slot.rank];
          const r = shardRimRefs.current[slot.rank];
          if (l) l.visible = v;
          if (r) r.visible = v;
        }
      };
      setShardLogos(false);

      // Render refraction backdrop for merged mesh
      if (mergedRef.current?.visible) {
        mergedRef.current.visible = false;
        state.gl.setRenderTarget(mergedFbo);
        if (sceneBg) state.gl.setClearColor(sceneBg, 1);
        state.gl.clear();
        state.gl.render(portalScene, portalCamera);
        state.gl.setRenderTarget(null);
        mergedRef.current.visible = true;
      }

      // Render shared backdrop FBO for shard transmission
      if (showShards) {
        for (let i = 0; i < shards.length; i++) {
          const m = shardMeshRefs.current[i];
          if (m) m.visible = false;
        }
        setShardLogos(true);
        state.gl.setRenderTarget(shardFbo);
        if (sceneBg) state.gl.setClearColor(sceneBg, 1);
        state.gl.clear();
        state.gl.render(portalScene, portalCamera);
        state.gl.setRenderTarget(null);
        setShardLogos(false);
        for (let i = 0; i < shards.length; i++) {
          const m = shardMeshRefs.current[i];
          if (m) m.visible = true;
        }
      }
      if (sceneBg) state.gl.setClearColor(0x000000, 0);

      const gs = Math.max(pose.scale, 0.05);
      _invQ.current.setFromEuler(new THREE.Euler(pose.rotX, pose.rotY, 0));
      _invQ.current.invert();
      const explosionFade = 1 - smoothstep(0.3, 0.8, breakVal);
      const driftFade = smoothstep(0.1, 0.5, breakVal);
      const spreadDist = breakVal * 2.0 * explosionFade;

      for (let i = 0; i < shards.length; i++) {
        const mesh = shardMeshRefs.current[i];
        if (!mesh) continue;

        mesh.visible = showShards;
        const cloud = shardCloudRefs.current[i];
        if (cloud) cloud.visible = showShards;
        if (!showShards) continue;

        const shardOpacity = assembled ? fade : smoothstep(0.05, 0.15, breakVal) * fade;
        const sMat = mesh.material as THREE.MeshPhysicalMaterial;
        if (sMat) {
          sMat.opacity = shardOpacity;
          sMat.transparent = shardOpacity < 1;
        }

        const s = shards[i];

        const driftX = s.driftCenter.x
          + Math.sin(elapsed * s.lissFreq.x + s.lissPhase.x) * s.lissAmp.x;
        const driftY = s.driftCenter.y
          + Math.sin(elapsed * s.lissFreq.y + s.lissPhase.y) * s.lissAmp.y;
        const driftZ = s.driftCenter.z
          + Math.sin(elapsed * s.lissFreq.z + s.lissPhase.z) * s.lissAmp.z;

        const mx = pose.mouseX * 0.15 * (1 + i * 0.05);
        const my = pose.mouseY * 0.08 * (1 + i * 0.05);

        _off.current.set(driftX + mx - pose.x, driftY + my - pose.y, driftZ - pose.z);
        _off.current.applyQuaternion(_invQ.current);
        const dlx = _off.current.x / gs;
        const dly = _off.current.y / gs;
        const dlz = _off.current.z / gs;

        mesh.position.x = s.centroid.x
          + driftFade * (dlx - s.centroid.x)
          + s.direction.x * spreadDist;
        mesh.position.y = s.centroid.y
          + driftFade * (dly - s.centroid.y)
          + s.direction.y * spreadDist;
        mesh.position.z = s.centroid.z
          + driftFade * (dlz - s.centroid.z)
          + s.direction.z * spreadDist;
        if (mesh.position.z > 0.5) mesh.position.z = 0.5;

        const scaleVal = 1 - driftFade * (1 - s.brokenScale);
        mesh.scale.setScalar(scaleVal);

        const tumbleFade = smoothstep(0.02, 0.15, breakVal);
        const tumbleAngle = tumbleFade *
          (breakVal * Math.PI + elapsed * s.tumbleSpeed * Math.min(breakVal * 2, 1));
        mesh.quaternion.setFromAxisAngle(s.tumbleAxis, tumbleAngle);
        if (assembled) {
          mesh.position.copy(s.centroid);
          mesh.scale.setScalar(1);
          mesh.quaternion.identity();
        }
        // The cloud is a sibling (not a child) so it stays in the backdrop
        // pass while the shard itself is hidden for it
        if (cloud) {
          cloud.position.copy(mesh.position);
          cloud.quaternion.copy(mesh.quaternion);
          cloud.scale.copy(mesh.scale);
          setCloudOpacity(cloud, shardOpacity);
        }
      }

      // ── Shard logos: sit at their shard's centre, turned toward the
      // camera but clamped to 35° from the shard's own orientation (so they
      // look embedded), sized to 45% of the shard's smallest projected side
      // (smoothed), skipped when that side is under 70 px on screen, and
      // faded with the break: hidden under 0.2, full at 0.5
      const logoAlpha = showShards && !assembled ? smoothstep(0.2, 0.5, breakVal) * fade : 0;
      const fovRad = THREE.MathUtils.degToRad((portalCamera as THREE.PerspectiveCamera).fov ?? 50);
      const pxPerUnitAt = (dist: number) => state.size.height / (2 * Math.tan(fovRad / 2) * Math.max(0.1, dist));
      const groupScale = heroLogoRef.current?.parent?.scale.x ?? 1;
      const parent = heroLogoRef.current?.parent ?? null;
      if (parent) _parentInvQ.copy(parent.quaternion).invert();
      else _parentInvQ.identity();
      for (const slot of shardLogoSlots) {
        const logo = shardLogoRefs.current[slot.rank];
        const rim = shardRimRefs.current[slot.rank];
        const shardMesh = shardMeshRefs.current[slot.shard];
        let on = logoAlpha > 0.001 && !!shardMesh;
        let short = 0;
        if (on && shardMesh) {
          short = projectedShortSide(slot.samples, shardMesh, parent ? parent.quaternion : _identityQ);
          shardMesh.getWorldPosition(_wp);
          const px = short * groupScale * pxPerUnitAt(portalCamera.position.z - _wp.z);
          if (px < SHARD_LOGO_MIN_PX) on = false;
        }
        shardLogoOn.current[slot.rank] = on;
        if (!on || !logo || !shardMesh) continue;

        // Icons after the current hero logo, so a shard never repeats it
        const geo = unitLogos[(cyc.index + 1 + slot.rank) % Math.max(nLogos, 1)]?.geometry;
        if (geo && logo.geometry !== geo) logo.geometry = geo;

        logo.position.copy(shardMesh.position);
        // World orientation: from the shard's own toward facing the camera
        // (identity), at most SHARD_LOGO_MAX_TURN away from the shard
        _shardWorldQ.multiplyQuaternions(parent ? parent.quaternion : _identityQ, shardMesh.quaternion);
        const turn = _shardWorldQ.angleTo(_identityQ);
        _faceQ.copy(_shardWorldQ).slerp(_identityQ, turn > SHARD_LOGO_MAX_TURN ? SHARD_LOGO_MAX_TURN / turn : 1);
        logo.quaternion.multiplyQuaternions(_parentInvQ, _faceQ);
        const target = SHARD_LOGO_FILL * short;
        const sizes = shardLogoSize.current;
        sizes[slot.rank] = sizes[slot.rank] === undefined
          ? target
          : sizes[slot.rank] + (target - sizes[slot.rank]) * (1 - Math.exp(-3 * delta));
        logo.scale.setScalar(Math.max(1e-4, sizes[slot.rank]));
        // Turned well away from the camera (the clamp can leave it near
        // edge-on), a logo is a dark sliver: fade it with its facing
        const facing = _fwd.set(0, 0, 1).applyQuaternion(_faceQ).z;
        const logoK = logoAlpha * smoothstep(0.45, 0.8, facing);
        setOpacity(logo, logoK);

        if (rim) {
          if (rim.geometry !== logo.geometry) rim.geometry = logo.geometry;
          rim.position.copy(logo.position);
          rim.quaternion.copy(logo.quaternion);
          rim.scale.copy(logo.scale).multiplyScalar(RIM_SCALE);
          (rim.material as THREE.MeshBasicMaterial).opacity = RIM_OPACITY * logoK;
        }
      }
    });


    return (
      <group ref={ref}>
        {/* Radial glow sprite underneath */}
        <sprite ref={glowRef} position={[0, -1.1, 0]} scale={[4, 2, 1]}>
          <spriteMaterial map={glowTex} transparent opacity={0.3} depthWrite={false} />
        </sprite>

        {/* Inclusion slivers inside crystal volume */}
        <instancedMesh
          ref={inclusionRef}
          args={[_inclusionGeo, undefined, INCLUSION_COUNT]}
          frustumCulled={false}
        >
          <meshStandardMaterial
            color="#dceef5"
            emissive="#b8d8e8"
            emissiveIntensity={0.3}
            transparent
            opacity={SLIVER_OPACITY}
            roughness={0.3}
            depthWrite={false}
          />
        </instancedMesh>

        {/* Internal cloud: a faint white volume at 0.82 scale. A sibling of
            the glass, so the glass sees it in its backdrop pass */}
        <mesh ref={intactCloudRef} geometry={intactGeo} scale={CLOUD.scale} userData={{ baseOpacity: CLOUD.opacity }}>
          <meshStandardMaterial color="#ffffff" transparent opacity={CLOUD.opacity} roughness={1} depthWrite={false} />
        </mesh>

        {/* Hero logo inside the intact crystal (cycles, faces the camera) */}
        {heroLogos[0] && (
          <mesh ref={heroLogoRef} geometry={heroLogos[0].geometry}>
            <meshStandardMaterial
              attach="material-0"
              color={logoLook.color}
              emissive={logoLook.emissive}
              emissiveIntensity={logoLook.emissiveIntensity}
              roughness={logoLook.roughness}
              metalness={logoLook.metalness}
              envMapIntensity={logoLook.envMapIntensity}
              transparent
              opacity={1}
            />
            {/* Darker walls: the extrusion edge is what gives it form */}
            <meshStandardMaterial
              attach="material-1"
              color={logoLook.side}
              emissive={logoLook.emissive}
              emissiveIntensity={logoLook.emissiveIntensity * 0.25}
              roughness={logoLook.roughness}
              metalness={logoLook.metalness}
              envMapIntensity={logoLook.envMapIntensity}
              transparent
              opacity={1}
            />
          </mesh>
        )}

        {/* Rim: inverted hull just outside the hero logo, a defined edge */}
        {heroLogos[0] && (
          <mesh
            ref={heroRimRef}
            geometry={heroLogos[0].geometry}
            renderOrder={HERO_RIM_RENDER_ORDER}
          >
            <meshBasicMaterial
              color={logoLook.rim}
              side={THREE.BackSide}
              transparent
              opacity={RIM_OPACITY}
              depthWrite={false}
            />
          </mesh>
        )}

        {/* Merged (intact) crystal */}
        <mesh ref={mergedRef} geometry={intactGeo}>
          <MeshTransmissionMaterial
            {...glass}
            buffer={mergedFbo.texture}
            thickness={thicknessFor(TARGET_SIZE)}
            resolution={CRYSTAL_MATERIAL.resolution.intact}
          />
        </mesh>

        {/* Shards */}
        {shards.map((shard, i) => (
          <mesh
            key={i}
            ref={(el) => { shardMeshRefs.current[i] = el; }}
            geometry={shard.geometry}
            position={shard.centroid.toArray() as [number, number, number]}
            visible={false}
          >
            <MeshTransmissionMaterial
              {...glass}
              buffer={shardFbo.texture}
              thickness={thicknessFor(shard.size, true)}
              resolution={CRYSTAL_MATERIAL.resolution.shard}
            />
          </mesh>
        ))}

        {/* Shard internal clouds (and slivers on the largest shards) */}
        {shards.map((shard, i) => (
          <group key={`cloud-${i}`} ref={(el) => { shardCloudRefs.current[i] = el; }} visible={false}>
            <mesh geometry={shard.geometry} scale={CLOUD.scale} userData={{ baseOpacity: CLOUD.opacity }}>
              <meshStandardMaterial color="#ffffff" transparent opacity={0} roughness={1} depthWrite={false} />
            </mesh>
            {shardSlivers[i] && (
              <mesh
                geometry={_inclusionGeo}
                rotation={shardSlivers[i]!.rotation}
                scale={[shardSlivers[i]!.thickness, shardSlivers[i]!.length, shardSlivers[i]!.thickness]}
                userData={{ baseOpacity: SLIVER_OPACITY }}
              >
                <meshStandardMaterial color="#dceef5" emissive="#b8d8e8" emissiveIntensity={0.3} transparent opacity={0} roughness={0.3} depthWrite={false} />
              </mesh>
            )}
          </group>
        ))}

        {/* Shard logos: one per large shard (5), each a different icon. Drawn
            only into the shard backdrop, so they are seen through the ice */}
        {unitLogos[0] &&
          shardLogoSlots.map((slot) => (
            <group key={`slot-${slot.rank}`}>
              <mesh
                ref={(el) => { shardRimRefs.current[slot.rank] = el; }}
                geometry={unitLogos[0].geometry}
                renderOrder={SHARD_RIM_RENDER_ORDER}
                frustumCulled={false}
                visible={false}
              >
                <meshBasicMaterial
                  color={logoLook.rim}
                  side={THREE.BackSide}
                  transparent
                  opacity={0}
                  depthWrite={false}
                />
              </mesh>
              <mesh
                ref={(el) => { shardLogoRefs.current[slot.rank] = el; }}
                geometry={unitLogos[0].geometry}
                renderOrder={SHARD_LOGO_RENDER_ORDER}
                frustumCulled={false}
                visible={false}
              >
                <meshStandardMaterial
                  attach="material-0"
                  color={logoLook.color}
                  emissive={logoLook.emissive}
                  emissiveIntensity={logoLook.emissiveIntensity}
                  roughness={logoLook.roughness}
                  metalness={logoLook.metalness}
                  envMapIntensity={logoLook.envMapIntensity}
                  transparent
                  opacity={0}
                  depthWrite={false}
                />
                <meshStandardMaterial
                  attach="material-1"
                  color={logoLook.side}
                  emissive={logoLook.emissive}
                  emissiveIntensity={logoLook.emissiveIntensity * 0.25}
                  roughness={logoLook.roughness}
                  metalness={logoLook.metalness}
                  envMapIntensity={logoLook.envMapIntensity}
                  transparent
                  opacity={0}
                  depthWrite={false}
                />
              </mesh>
            </group>
          ))}
      </group>
    );
  },
);


export default GlassCrystal;
