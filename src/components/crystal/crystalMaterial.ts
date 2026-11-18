/**
 * ONE material for the intact crystal and every shard. Kinds may differ
 * only in thickness (scaled by their size), backdrop resolution, sample
 * count and normal map (the intact mesh has its fine relief in geometry,
 * the shards get it from the map); every other value, and the roughness
 * and streak textures themselves (the same texture objects), are shared.
 */
import * as THREE from "three";
import { noise3 } from "./frostUtils";
import { TARGET_SIZE, reliefHeight } from "./crystalGen";
import { getGfxProfile, sliceIdle, type GfxProfile } from "@/components/scene/warm";

export const CRYSTAL_MATERIAL = {
  /** Frost strength in the normal map (baked in: the material's own
   * normalScale is 1 so the fine relief keeps its true slope). */
  frostStrength: 0.06,
  /** Frost tiles this many times around the chunk inside the one map. */
  frostRepeat: 3,
  ior: 1.35,
  /** Thickness per world unit of the mesh's largest side. */
  thicknessRatio: 0.45 / TARGET_SIZE,
  /** Shards are optically thinner (thickness is the one value they may
   * change): at full ratio their refraction smeared the logo inside. */
  shardThicknessScale: 0.35,
  /** Ice disperses far less than a prism. */
  chromaticAberration: 0.045,
  anisotropicBlur: 0.05,
  /** 1, so the roughness map (roughnessRange) gives the final values. */
  roughness: 1,
  /** Wet-polished pits .. frosted ridges, from the shared relief field. */
  roughnessRange: [0.02, 0.18] as [number, number],
  /** Frost follows the silhouette: roughness eases from roughnessRange[0]
   * (looking straight through the thick middle: clear) to the map's value
   * at grazing angles by (1 - |n.v|)^frostRimPower. Real ice is clearest
   * through the middle. drei's refraction blur is driven by roughness, so
   * this is what keeps the headline readable through the centre. */
  frostRimPower: 2,
  /** Wet sheen on fresh faces. */
  clearcoat: 0.6,
  clearcoatRoughness: 0.1,
  distortion: 0.1,
  distortionScale: 0.2,
  temporalDistortion: 0.02,
  /** Refraction samples per pixel (drei recompiles per value). */
  samples: { intact: 8, shard: 3, seal: 4 },
  attenuationDistance: 5,
  envMapIntensity: 1.0,
  /** Thin film: oil-slick streaks, masked to the crevices (inverse relief). */
  iridescence: 0.3,
  iridescenceIOR: 1.6,
  /** Film thickness in nm (three r187: separate min / max). */
  iridescenceThicknessMinimum: 180,
  iridescenceThicknessMaximum: 520,
  /** The film also darkens the glass slightly where it sits. */
  streakDarken: 0.32,
  /** Fresnel rim along the silhouette. */
  rim: { color: "#ffffff", power: 4, intensity: 0.7 },
  /** Internal cloud: ice is never optically empty. */
  cloud: { scale: 0.82, opacity: 0.015 },
  /**
   * Glass that stays clear when the crystal is small on screen. Frost,
   * cloud and blur are surface effects with a fixed footprint, so at the
   * parked size (~130 px radius at 1440) they turned the crystal into
   * opaque putty. At or under radiusPx they drop to these fractions of
   * their base, easing back to full by fullPx. (Thickness needs no help:
   * drei multiplies it by the mesh's model scale.)
   */
  small: { radiusPx: 180, fullPx: 260, frost: 0.4, cloud: 0.3, blur: 0.5 },
  /** Thin elongated inclusion slivers (intact count; shards share them). */
  slivers: 2,
  /** Backdrop FBO size (square). */
  resolution: { intact: 1024, shard: 384 },
  /** The reduced profile (slow renderer, scene/warm.ts): the hero glass at
   * 4 samples over a 512 px backdrop. Everything else is unchanged. */
  reduced: { intactSamples: 4, intactResolution: 512 },
  /** Shards smaller than this on screen skip the backdrop (cheap glass).
   * Two thresholds so a shard near the line never flickers. */
  cheapShardPx: { off: 56, on: 64 },
  /** The non-transmissive stand-in (far Archive seals, tiny shards):
   * MeshPhysicalMaterial, transmission off, alpha-blended. */
  cheap: {
    wake: { opacity: 0.5, envMapIntensity: 1.2 },
    /** Matched by eye to the real glass at Archive seal distances. */
    dream: { opacity: 0.82, envMapIntensity: 1.2 },
  },
  tint: {
    wake: { color: "#e8f1f5", attenuationColor: "#d8edf8" },
    dream: { color: "#c4b5fd", attenuationColor: "#c9bcf2" },
  },
} as const;

export function thicknessFor(meshSize: number, shard = false): number {
  return CRYSTAL_MATERIAL.thicknessRatio * meshSize * (shard ? CRYSTAL_MATERIAL.shardThicknessScale : 1);
}

/* ── Shared textures (built once, same objects everywhere) ─────── */

const TAU = Math.PI * 2;
const TEX = 256;

/** Height field periodic in u (the spherical seam). */
function heightAt(u: number, v: number, scale: number, octaves: number): number {
  const r = scale / TAU;
  const x = Math.cos(u * TAU) * r, z = Math.sin(u * TAU) * r, y = v * scale * 0.5;
  let h = 0, a = 0.5, f = 1;
  for (let o = 0; o < octaves; o++) {
    h += a * noise3(x * f + o * 17.3, y * f, z * f);
    a *= 0.5;
    f *= 2;
  }
  return h;
}

/** Value noise on a lattice that wraps every `period` cells: tiles in u and v. */
function tileNoise(x: number, y: number, period: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const w = (i: number) => ((i % period) + period) % period;
  const h = (i: number, j: number) => {
    const s = Math.sin(w(i) * 127.1 + w(j) * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/*
 * The maps below are built in idle slices (scene/warm.ts sliceIdle): built
 * synchronously when the glass first rendered, they blocked the main
 * thread for ~0.5 s on a slow machine. Each texture exists at once at its
 * final size and format, filled with a neutral value (flat normals, mid
 * roughness, no crevices), so the material's program never changes; the
 * real texels replace it a moment later.
 */

/** A texture at its final size, filled with one RGBA value. */
function placeholder(size: number, rgba: [number, number, number, number], wrapT: THREE.Wrapping): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let k = 0; k < data.length; k += 4) {
    data[k] = rgba[0];
    data[k + 1] = rgba[1];
    data[k + 2] = rgba[2];
    data[k + 3] = rgba[3];
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = wrapT;
  tex.needsUpdate = true;
  return tex;
}
function publish(tex: THREE.DataTexture, data: Uint8Array) {
  (tex.image.data as Uint8Array).set(data);
  tex.needsUpdate = true;
}

/**
 * ONE noise field drives every map: the roughness map and the iridescence
 * crevice mask both read `relief`, so wet-polished pits, frosted ridges
 * and the film in the crevices always line up. Built a row per step.
 */
function* iceFieldRows(out: { relief?: Float32Array }) {
  const n = TEX * TEX;
  const relief = new Float32Array(n);
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < TEX; j++) {
    for (let i = 0; i < TEX; i++) {
      const u = i / TEX, v = j / TEX;
      const h = heightAt(u, v, 14, 4);
      relief[j * TEX + i] = h;
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    yield;
  }
  for (let k = 0; k < n; k++) relief[k] = (relief[k] - lo) / (hi - lo);
  out.relief = relief;
}

/** Normal map texels per side: frostRepeat frost tiles of 256 each. */
const NTEX = 256 * CRYSTAL_MATERIAL.frostRepeat;

/** Sub-millimetre frost height at tile coordinates (tiles every 1). */
function frostAt(x: number, y: number): number {
  const fx = x * 48, fy = y * 48;
  const f = tileNoise(fx, fy, 48, 3) * 0.6 + tileNoise(fx * 2, fy * 2, 96, 5) * 0.4;
  return f + Math.sin((y * 64 + x * 32 + f * 3) * TAU) * 0.08;
}

/** Unit direction for a spherical UV (crystalGen sphericalUV, inverted). */
function uvDir(u: number, v: number): [number, number, number] {
  const phi = (u - 0.5) * TAU, lat = (v - 0.5) * Math.PI;
  const c = Math.cos(lat);
  return [c * Math.cos(phi), Math.sin(lat), c * Math.sin(phi)];
}

function* normalMapRows(withRelief: boolean, tex: THREE.DataTexture) {
  const N = NTEX, R = CRYSTAL_MATERIAL.frostRepeat;
  const rel = new Float32Array(N * N);
  const fro = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const u = i / N, v = (j + 0.5) / N;
      if (withRelief) {
        const [x, y, z] = uvDir(u, v);
        rel[j * N + i] = reliefHeight(x, y, z);
      }
      fro[j * N + i] = frostAt((u * R) % 1, (v * R) % 1);
    }
    yield;
  }
  const data = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) {
    const jd = Math.max(0, j - 1), ju = Math.min(N - 1, j + 1);
    const lat = ((j + 0.5) / N - 0.5) * Math.PI;
    // Arc length on the unit sphere per texel, in u (shrinks to the poles) and v
    const du = (TAU / N) * Math.max(0.15, Math.cos(lat));
    const dv = Math.PI / N;
    for (let i = 0; i < N; i++) {
      const il = (i - 1 + N) % N, ir = (i + 1) % N;
      // Frost as the old map had it: strength x 6 per texel difference, 256 texels a tile
      const sx = (rel[j * N + ir] - rel[j * N + il]) / (2 * du)
        + (fro[j * N + ir] - fro[j * N + il]) * CRYSTAL_MATERIAL.frostStrength * 6;
      const sy = (rel[ju * N + i] - rel[jd * N + i]) / ((ju - jd) * dv)
        + (fro[ju * N + i] - fro[jd * N + i]) * CRYSTAL_MATERIAL.frostStrength * 6;
      const len = Math.hypot(sx, sy, 1);
      const o = (j * N + i) * 4;
      data[o] = ((-sx / len) * 0.5 + 0.5) * 255;
      data[o + 1] = ((-sy / len) * 0.5 + 0.5) * 255;
      data[o + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      data[o + 3] = 255;
    }
    yield;
  }
  publish(tex, data);
}

const _normalMaps = new Map<boolean, THREE.DataTexture>();
/**
 * Sub-millimetre frost (frostRepeat tiles, at frostStrength), plus, with
 * `withRelief`, the fine relief (crystalGen DETAIL_OCTAVES, once around
 * the chunk, at its true slope). The intact mesh has the relief in its
 * geometry and takes the frost-only map; the shards (cut from the coarse
 * source mesh) take the relief from the map. Periodic in u; the mesh's
 * spherical UVs cover it exactly once. Flat until its slices are done.
 */
export function getFrostNormalMap(withRelief = false): THREE.DataTexture {
  const cached = _normalMaps.get(withRelief);
  if (cached) return cached;
  const tex = placeholder(NTEX, [128, 128, 255, 255], THREE.ClampToEdgeWrapping);
  _normalMaps.set(withRelief, tex);
  sliceIdle(normalMapRows(withRelief, tex));
  return tex;
}

let _rough: THREE.DataTexture | null = null;
let _crevice: THREE.DataTexture | null = null;
/** Both relief-driven maps, from one field, filled in one sliced job. */
function* reliefMapsRows(rough: THREE.DataTexture, crevice: THREE.DataTexture) {
  const field: { relief?: Float32Array } = {};
  yield* iceFieldRows(field);
  const R = field.relief!;
  // Roughness (G channel, as three reads it): wet-polished in the pits,
  // frosted matte on the ridges. The material's own roughness is 1, so
  // these texels are the final values.
  const [lo, hi] = CRYSTAL_MATERIAL.roughnessRange;
  const rd = new Uint8Array(TEX * TEX * 4);
  for (let k = 0; k < TEX * TEX; k++) {
    const t = THREE.MathUtils.smoothstep(R[k], 0.25, 0.8);
    const g = Math.round((lo + (hi - lo) * t) * 255);
    rd[k * 4] = rd[k * 4 + 1] = rd[k * 4 + 2] = g;
    rd[k * 4 + 3] = 255;
  }
  publish(rough, rd);
  yield;
  // Iridescence mask (R channel): the inverse of the relief, so the thin
  // film sits in the crevices, gathered into a few soft diagonal runs so
  // it still reads as streaks rather than speckle.
  const cd = new Uint8Array(TEX * TEX * 4);
  for (let j = 0; j < TEX; j++) {
    for (let i = 0; i < TEX; i++) {
      const u = i / TEX, v = j / TEX;
      const k = j * TEX + i;
      const c = THREE.MathUtils.smoothstep(1 - R[k], 0.45, 0.85);
      const warp = noise3(Math.cos(u * TAU) * 2, v * 4, Math.sin(u * TAU) * 2) - 0.5;
      const run = 0.35 + 0.65 * Math.pow(Math.max(0, Math.cos((u * 3 + v * 1.4 + warp * 0.6) * TAU)), 4);
      const sv = Math.round(Math.min(1, c * run * 1.3) * 255);
      cd[k * 4] = cd[k * 4 + 1] = cd[k * 4 + 2] = sv;
      cd[k * 4 + 3] = 255;
    }
    yield;
  }
  publish(crevice, cd);
}
function ensureReliefMaps() {
  if (_rough && _crevice) return;
  const mid = Math.round(((CRYSTAL_MATERIAL.roughnessRange[0] + CRYSTAL_MATERIAL.roughnessRange[1]) / 2) * 255);
  _rough = placeholder(TEX, [mid, mid, mid, 255], THREE.RepeatWrapping);
  _crevice = placeholder(TEX, [0, 0, 0, 255], THREE.RepeatWrapping);
  sliceIdle(reliefMapsRows(_rough, _crevice));
}

/** Roughness from the relief (see reliefMapsRows); mid roughness until built. */
export function getRoughnessMap(): THREE.DataTexture {
  ensureReliefMaps();
  return _rough!;
}

/** Iridescence crevice mask (see reliefMapsRows); empty until built. */
export function getCreviceMap(): THREE.DataTexture {
  ensureReliefMaps();
  return _crevice!;
}

/* ── The shared glass props (intact crystal, shards, Archive seals) ── */

/**
 * Props for drei's MeshTransmissionMaterial built from CRYSTAL_MATERIAL.
 * Everything that wears this ice uses it, so the finish cannot drift;
 * callers add only thickness and buffer. `kind` picks the sample count.
 *
 * Pass `resolution={UNUSED_FBO}`: drei allocates two FBOs of that size
 * per material even when `buffer` is supplied, and every caller here
 * supplies its own backdrop (sized by CRYSTAL_MATERIAL.resolution).
 */
export const UNUSED_FBO = 32;

/** intact: the hero crystal (and the Archive's reassembled one); shard:
 * hero shards and the seals' orbiters; seal: Archive seal bodies. */
export type GlassKind = keyof typeof CRYSTAL_MATERIAL.samples;

/** Backdrop size of the intact crystal for a profile. */
export function intactResolution(profile: GfxProfile = getGfxProfile()): number {
  return profile === "reduced" ? CRYSTAL_MATERIAL.reduced.intactResolution : CRYSTAL_MATERIAL.resolution.intact;
}

export function crystalGlassProps(
  variant: keyof typeof CRYSTAL_MATERIAL.tint,
  kind: GlassKind = "intact",
  profile: GfxProfile = getGfxProfile(),
) {
  const tint = CRYSTAL_MATERIAL.tint[variant];
  return {
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
    samples: kind === "intact" && profile === "reduced" ? CRYSTAL_MATERIAL.reduced.intactSamples : CRYSTAL_MATERIAL.samples[kind],
    attenuationDistance: CRYSTAL_MATERIAL.attenuationDistance,
    envMapIntensity: CRYSTAL_MATERIAL.envMapIntensity,
    color: tint.color,
    attenuationColor: tint.attenuationColor,
    normalMap: getFrostNormalMap(kind === "shard"),
    normalScale: new THREE.Vector2(1, 1),
    iridescence: CRYSTAL_MATERIAL.iridescence,
    iridescenceIOR: CRYSTAL_MATERIAL.iridescenceIOR,
    iridescenceThicknessMinimum: CRYSTAL_MATERIAL.iridescenceThicknessMinimum,
    iridescenceThicknessMaximum: CRYSTAL_MATERIAL.iridescenceThicknessMaximum,
    iridescenceMap: getCreviceMap(),
  };
}

/**
 * The stand-in for MeshTransmissionMaterial where refraction cannot be
 * seen: far Archive seals and shards a few dozen pixels across. Plain
 * MeshPhysicalMaterial, transmission off (no backdrop, no samples),
 * alpha-blended so what is inside still shows. Same tint, maps, coat and
 * film as the real glass, so the swap is invisible at that size.
 */
export function crystalCheapProps(variant: keyof typeof CRYSTAL_MATERIAL.tint) {
  const tint = CRYSTAL_MATERIAL.tint[variant];
  return {
    transmission: 0,
    transparent: true,
    depthWrite: false,
    opacity: CRYSTAL_MATERIAL.cheap[variant].opacity,
    color: tint.attenuationColor,
    roughness: CRYSTAL_MATERIAL.roughness,
    roughnessMap: getRoughnessMap(),
    clearcoat: CRYSTAL_MATERIAL.clearcoat,
    clearcoatRoughness: CRYSTAL_MATERIAL.clearcoatRoughness,
    envMapIntensity: CRYSTAL_MATERIAL.cheap[variant].envMapIntensity,
    normalMap: getFrostNormalMap(),
    normalScale: new THREE.Vector2(1, 1),
    iridescence: CRYSTAL_MATERIAL.iridescence,
    iridescenceIOR: CRYSTAL_MATERIAL.iridescenceIOR,
    iridescenceThicknessMinimum: CRYSTAL_MATERIAL.iridescenceThicknessMinimum,
    iridescenceThicknessMaximum: CRYSTAL_MATERIAL.iridescenceThicknessMaximum,
    iridescenceMap: getCreviceMap(),
  };
}

/* ── Rim + streak shading on top of drei's transmission material ── */

interface RimUniforms {
  rimColor: { value: THREE.Color };
  rimPower: { value: number };
  rimIntensity: { value: number };
  streakDarken: { value: number };
  frostRimPower: { value: number };
  clearRoughness: { value: number };
}

const shared: RimUniforms = {
  rimColor: { value: new THREE.Color(CRYSTAL_MATERIAL.rim.color) },
  rimPower: { value: CRYSTAL_MATERIAL.rim.power },
  rimIntensity: { value: CRYSTAL_MATERIAL.rim.intensity },
  streakDarken: { value: CRYSTAL_MATERIAL.streakDarken },
  frostRimPower: { value: CRYSTAL_MATERIAL.frostRimPower },
  clearRoughness: { value: CRYSTAL_MATERIAL.roughnessRange[0] },
};

const PATCHED = Symbol("crystalShader");

export interface RimOverride {
  color?: string;
  power?: number;
  intensity?: number;
}
const _rimSets = new Map<string, RimUniforms>();
function rimUniforms(o?: RimOverride): RimUniforms {
  if (!o) return shared;
  const key = JSON.stringify(o);
  let u = _rimSets.get(key);
  if (!u) {
    u = {
      rimColor: { value: new THREE.Color(o.color ?? CRYSTAL_MATERIAL.rim.color) },
      rimPower: { value: o.power ?? CRYSTAL_MATERIAL.rim.power },
      rimIntensity: { value: o.intensity ?? CRYSTAL_MATERIAL.rim.intensity },
      streakDarken: shared.streakDarken,
      frostRimPower: shared.frostRimPower,
      clearRoughness: shared.clearRoughness,
    };
    _rimSets.set(key, u);
  }
  return u;
}

/**
 * Chain onto the material's own onBeforeCompile (drei's transmission
 * patch) and add a fresnel rim plus the darker film streaks. Uniforms are
 * shared objects, so every crystal material reads one config; `rim` gives
 * a different rim only (the Archive's seals need a brighter one to
 * separate from the fog at any distance).
 */
export function applyCrystalShader(material: THREE.Material | null, rim?: RimOverride): void {
  if (!material) return;
  const m = material as THREE.Material & { [PATCHED]?: boolean };
  if (m[PATCHED]) return;
  m[PATCHED] = true;
  // Crystal glass fades (intact crossfade, shards fading in, the intro).
  // It is ALWAYS transparent: at opacity 1 that draws exactly as opaque,
  // and toggling it selected another program (three's OPAQUE define) that
  // then had to be compiled mid-fade; three also keeps drawing with the old
  // program until something else forces a program change, so which
  // variant a frame used depended on history. One variant, no race.
  // userData.warmAlpha marks crystal glass for scene/warm.ts (stand-in look,
  // no backdrop-pass variant).
  material.transparent = true;
  material.userData.warmAlpha = true;
  // drei's MeshTransmissionMaterial adds USE_TRANSMISSION to material.defines
  // inside onBeforeCompile, i.e. after three has keyed the program: the
  // first program ever built had the wrong key and the next draw built
  // another, synchronously. Set it up front so the first build is the one.
  const mtm = material as THREE.Material & { uniforms?: { buffer?: unknown }; defines?: Record<string, string> };
  if (mtm.uniforms?.buffer !== undefined) mtm.defines = { ...(mtm.defines ?? {}), USE_TRANSMISSION: "" };
  const base = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    Object.assign(shader.uniforms, rimUniforms(rim));
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        "uniform vec3 rimColor;\nuniform float rimPower;\nuniform float rimIntensity;\nuniform float streakDarken;\nuniform float frostRimPower;\nuniform float clearRoughness;\nvoid main() {",
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        #ifndef FLAT_SHADED
        {
          // Clear through the middle, frosted toward the silhouette
          vec3 frostView = isOrthographic ? vec3( 0.0, 0.0, 1.0 ) : normalize( vViewPosition );
          float frostW = pow( 1.0 - clamp( abs( dot( normalize( vNormal ), frostView ) ), 0.0, 1.0 ), frostRimPower );
          roughnessFactor = mix( clearRoughness, roughnessFactor, frostW );
        }
        #endif`,
      )
      .replace(
        "#include <dithering_fragment>",
        `{
          vec3 rimView = isOrthographic ? vec3( 0.0, 0.0, 1.0 ) : normalize( vViewPosition );
          float rimF = pow( 1.0 - clamp( abs( dot( normalize( normal ), rimView ) ), 0.0, 1.0 ), rimPower );
          #ifdef USE_IRIDESCENCEMAP
            gl_FragColor.rgb *= 1.0 - streakDarken * texture2D( iridescenceMap, vIridescenceMapUv ).r;
          #endif
          gl_FragColor.rgb += rimColor * rimF * rimIntensity;
        }
        #include <dithering_fragment>`,
      );
  };
  const baseKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${baseKey()}|crystal-rim-v2`;
  material.needsUpdate = true;
}
