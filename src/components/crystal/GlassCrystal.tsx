"use client";

import { forwardRef, useEffect, useMemo, useRef } from "react";
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
  getStreakMap,
  thicknessFor,
} from "./crystalMaterial";
import { getHeroLogos, getUnitLogos } from "./logoGeometry";

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
 * place of the intact mesh; crystalfreeze=<s> pins rotation and the logo.
 */
const DEBUG = (() => {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const freeze = q.has("crystalfreeze") ? Number(q.get("crystalfreeze")) : null;
  if (freeze !== null) setCrystalTimeOverride(freeze);
  return { assembled: q.get("crystalview") === "assembled", freeze };
})();

const _swayEuler = new THREE.Euler();
const _swayQ = new THREE.Quaternion();
const _parentInvQ = new THREE.Quaternion();

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

export function useCrystalData(seed = DEFAULT_SEED) {
  const buf = useLoader(THREE.FileLoader, CRYSTAL_URL, arrayBuffer) as unknown as ArrayBuffer;
  return useMemo(() => {
    const [intact, ...shardGeos] = decodeCrystal(buf);
    return { intact, shards: buildShards(shardGeos, seed) };
  }, [buf, seed]);
}

/*
 * Logo contrast. WAKE: matte mid-grey metal, clearly lighter than the
 * black marquee type behind it. No metalness: a metallic logo mirrored
 * the large dark lightformer panels and went near-black. DREAM: pale
 * lavender glowing inside the violet glass. The ghost is a flat copy
 * drawn over the glass for readability through refraction; the rim is
 * an inverted hull that keeps a defined edge against the light page.
 */
const LOGO_LOOK = {
  wake: {
    color: "#b4bcc8",
    emissive: "#5d6472",
    emissiveIntensity: 2.0,
    roughness: 0.45,
    metalness: 0.0,
    envMapIntensity: 0.9,
    ghost: "#9aa3b1",
    rim: "#6f7889",
  },
  dream: {
    color: "#efe9ff",
    emissive: "#9b89ff",
    emissiveIntensity: 0.5,
    roughness: 0.35,
    metalness: 0.25,
    envMapIntensity: 1.2,
    ghost: "#d9ccff",
    rim: "#c8b8ff",
  },
} as const;
const GHOST_OPACITY = 0.14;
const RIM_SCALE = 1.02;
const RIM_OPACITY = 0.35;
const GHOST_RENDER_ORDER = 10;
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

/** Broken state: logos on the largest shards only. */
const SHARD_LOGO_COUNT = 8;
const SHARD_LOGO_FILL = 0.7;
/** Minimum logo width in group units (world units at pose scale 1). */
const SHARD_LOGO_MIN = 0.35;
const SHARD_LOGO_SWAY = THREE.MathUtils.degToRad(20);
const INCLUSION_COUNT = 10;

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
    const r = rng() * maxR * 0.6;
    const th = Math.acos(2 * rng() - 1);
    const ph = TWO_PI * rng();
    _pos.set(
      r * Math.sin(th) * Math.cos(ph),
      r * Math.sin(th) * Math.sin(ph),
      r * Math.cos(th),
    );
    const length = 0.06 + rng() * 0.14;
    const thickness = 0.006 + rng() * 0.008;
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
        iridescenceMap: getStreakMap(),
        // Rim + streak shading chained onto drei's own shader patch
        ref: (m: unknown) => applyCrystalShader(m as THREE.Material | null),
      }),
      [tint],
    );

    const glowTex = useMemo(() => createGlowTexture(128), []);
    const inclusions = useMemo(() => buildInclusions(seed, INCLUSION_COUNT, R), [seed]);
    const heroLogos = useMemo(() => getHeroLogos(), []);
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
        return { shard: i, vol: Math.abs(vol), shortSide: dims[1] };
      });
      return info
        .sort((p, q) => q.vol - p.vol)
        .slice(0, SHARD_LOGO_COUNT)
        .map((r, rank) => ({
          shard: r.shard,
          rank,
          size: SHARD_LOGO_FILL * r.shortSide,
          swayFreq: 0.45 + rank * 0.07,
          swayPhase: rank * 1.7,
        }));
    }, [shards]);
    const reducedMotion = useMemo(
      () =>
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      [],
    );

    const { scene: portalScene, camera: portalCamera } = useThree();
    const mergedRef = useRef<THREE.Mesh>(null);
    const heroLogoRef = useRef<THREE.Mesh>(null);
    const heroGhostRef = useRef<THREE.Mesh>(null);
    const heroRimRef = useRef<THREE.Mesh>(null);
    const shardLogoRefs = useRef<(THREE.Mesh | null)[]>([]);
    const shardGhostRefs = useRef<(THREE.Mesh | null)[]>([]);
    const shardRimRefs = useRef<(THREE.Mesh | null)[]>([]);
    const shardMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
    const inclusionRef = useRef<THREE.InstancedMesh>(null);
    const glowRef = useRef<THREE.Sprite>(null);
    const showShardsRef = useRef(false);
    const _invQ = useRef(new THREE.Quaternion());
    const _off = useRef(new THREE.Vector3());
    const mergedFbo = useFBO(1024, 1024, { depthBuffer: true });
    const shardFbo = useFBO(CRYSTAL_MATERIAL.resolution.shard, CRYSTAL_MATERIAL.resolution.shard, { depthBuffer: true });

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
        if (heroGhostRef.current) heroGhostRef.current.visible = false;
        if (heroRimRef.current) heroRimRef.current.visible = false;
        if (inclusionRef.current) inclusionRef.current.visible = false;
        if (glowRef.current) glowRef.current.visible = false;
        for (let i = 0; i < shards.length; i++) {
          const m = shardMeshRefs.current[i];
          if (m) m.visible = false;
        }
        for (const l of shardLogoRefs.current) if (l) l.visible = false;
        for (const g of shardGhostRefs.current) if (g) g.visible = false;
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
        if (iMat) iMat.opacity = (assembled ? 1 : 1 - crossfade) * fade;
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

        heroMesh.visible = !mergedHidden || assembled;
        const heroOpacity = (assembled ? 1 : 1 - crossfade) * fade * heroAlpha;
        const hMat = heroMesh.material as THREE.MeshStandardMaterial;
        if (hMat) hMat.opacity = heroOpacity;

        const ghost = heroGhostRef.current;
        if (ghost) {
          if (ghost.geometry !== heroMesh.geometry) ghost.geometry = heroMesh.geometry;
          ghost.position.copy(heroMesh.position);
          ghost.quaternion.copy(heroMesh.quaternion);
          ghost.scale.copy(heroMesh.scale);
          ghost.visible = heroMesh.visible && heroOpacity > 0.001;
          (ghost.material as THREE.MeshBasicMaterial).opacity = GHOST_OPACITY * heroOpacity;
        }

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

      // Ghost layers (and the over-glass shard logos) sit on top of the
      // glass; they must never be part of the backdrop the glass refracts
      const ghosts = [
        heroGhostRef.current,
        ...shardGhostRefs.current,
        ...shardLogoRefs.current,
        ...shardRimRefs.current,
      ];
      const ghostWasVisible = ghosts.map((g) => !!g?.visible);
      const hideGhosts = () => ghosts.forEach((g) => { if (g) g.visible = false; });
      const restoreGhosts = () =>
        ghosts.forEach((g, i) => { if (g) g.visible = ghostWasVisible[i]; });

      // Render refraction backdrop for merged mesh
      if (mergedRef.current?.visible) {
        mergedRef.current.visible = false;
        hideGhosts();
        state.gl.setRenderTarget(mergedFbo);
        if (sceneBg) state.gl.setClearColor(sceneBg, 1);
        state.gl.clear();
        state.gl.render(portalScene, portalCamera);
        state.gl.setRenderTarget(null);
        restoreGhosts();
        mergedRef.current.visible = true;
      }

      // Render shared backdrop FBO for shard transmission
      if (showShards) {
        for (let i = 0; i < shards.length; i++) {
          const m = shardMeshRefs.current[i];
          if (m) m.visible = false;
        }
        hideGhosts();
        state.gl.setRenderTarget(shardFbo);
        if (sceneBg) state.gl.setClearColor(sceneBg, 1);
        state.gl.clear();
        state.gl.render(portalScene, portalCamera);
        state.gl.setRenderTarget(null);
        restoreGhosts();
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
      }

      // ── Shard logos: follow their shard's position, not its tumble.
      // Each faces the camera with its own small sway, and fades in as
      // the shard separates; fully gone (alpha 0 at breakVal .15) before
      // the intact crystal starts to reappear, so nothing is left behind
      const logoAlpha = showShards && !assembled ? smoothstep(0.15, 0.4, breakVal) * fade : 0;
      const parent = heroLogoRef.current?.parent ?? null;
      if (parent) _parentInvQ.copy(parent.quaternion).invert();
      else _parentInvQ.identity();
      for (const slot of shardLogoSlots) {
        const logo = shardLogoRefs.current[slot.rank];
        const ghost = shardGhostRefs.current[slot.rank];
        const rim = shardRimRefs.current[slot.rank];
        const shardMesh = shardMeshRefs.current[slot.shard];
        const on = logoAlpha > 0.001 && !!shardMesh;
        if (logo) logo.visible = on;
        if (ghost) ghost.visible = on;
        if (rim) rim.visible = on;
        if (!on || !logo || !shardMesh) continue;

        // Icons after the current hero logo, so a shard never repeats it
        const geo = unitLogos[(cyc.index + 1 + slot.rank) % Math.max(nLogos, 1)]?.geometry;
        if (geo && logo.geometry !== geo) logo.geometry = geo;

        logo.position.copy(shardMesh.position);
        const sway = reducedMotion ? 0 : SHARD_LOGO_SWAY;
        _swayEuler.set(
          Math.sin(elapsed * slot.swayFreq * 0.8 + slot.swayPhase) * sway * 0.5,
          Math.sin(elapsed * slot.swayFreq + slot.swayPhase) * sway,
          0,
        );
        _swayQ.setFromEuler(_swayEuler);
        logo.quaternion.multiplyQuaternions(_parentInvQ, _swayQ);
        logo.scale.setScalar(Math.max(SHARD_LOGO_MIN, slot.size * shardMesh.scale.x));
        (logo.material as THREE.MeshStandardMaterial).opacity = logoAlpha;

        if (ghost) {
          if (ghost.geometry !== logo.geometry) ghost.geometry = logo.geometry;
          ghost.position.copy(logo.position);
          ghost.quaternion.copy(logo.quaternion);
          ghost.scale.copy(logo.scale);
          (ghost.material as THREE.MeshBasicMaterial).opacity = GHOST_OPACITY * logoAlpha;
        }

        if (rim) {
          if (rim.geometry !== logo.geometry) rim.geometry = logo.geometry;
          rim.position.copy(logo.position);
          rim.quaternion.copy(logo.quaternion);
          rim.scale.copy(logo.scale).multiplyScalar(RIM_SCALE);
          (rim.material as THREE.MeshBasicMaterial).opacity = RIM_OPACITY * logoAlpha;
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
            opacity={0.5}
            roughness={0.3}
            depthWrite={false}
          />
        </instancedMesh>

        {/* Hero logo inside the intact crystal (cycles, faces the camera) */}
        {heroLogos[0] && (
          <mesh ref={heroLogoRef} geometry={heroLogos[0].geometry}>
            <meshStandardMaterial
              color={logoLook.color}
              emissive={logoLook.emissive}
              emissiveIntensity={logoLook.emissiveIntensity}
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

        {/* Ghost of the hero logo drawn over the glass for legibility */}
        {heroLogos[0] && (
          <mesh
            ref={heroGhostRef}
            geometry={heroLogos[0].geometry}
            renderOrder={GHOST_RENDER_ORDER}
            frustumCulled={false}
          >
            <meshBasicMaterial
              color={logoLook.ghost}
              transparent
              opacity={GHOST_OPACITY}
              depthTest={false}
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
              thickness={thicknessFor(shard.size)}
              resolution={CRYSTAL_MATERIAL.resolution.shard}
            />
          </mesh>
        ))}

        {/* Shard logos: one per large shard, each a different icon, with a
            ghost copy over the glass like the hero logo */}
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
                  depthTest={false}
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
                  color={logoLook.color}
                  emissive={logoLook.emissive}
                  emissiveIntensity={logoLook.emissiveIntensity}
                  roughness={logoLook.roughness}
                  metalness={logoLook.metalness}
                  envMapIntensity={logoLook.envMapIntensity}
                  transparent
                  opacity={0}
                  depthTest={false}
                  depthWrite={false}
                />
              </mesh>
              <mesh
                ref={(el) => { shardGhostRefs.current[slot.rank] = el; }}
                geometry={unitLogos[0].geometry}
                renderOrder={GHOST_RENDER_ORDER}
                frustumCulled={false}
                visible={false}
              >
                <meshBasicMaterial
                  color={logoLook.ghost}
                  transparent
                  opacity={0}
                  depthTest={false}
                  depthWrite={false}
                />
              </mesh>
            </group>
          ))}
      </group>
    );
  },
);

useLoader.preload(THREE.FileLoader, CRYSTAL_URL, arrayBuffer);

export default GlassCrystal;
