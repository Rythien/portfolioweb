/**
 * ONE material for the intact crystal and every shard. Shards may differ
 * only in thickness (scaled by their size), backdrop resolution and
 * sample count; every other value, and the relief and streak textures
 * themselves (the same texture objects), are shared.
 */
import * as THREE from "three";
import { noise3 } from "./frostUtils";
import { TARGET_SIZE, reliefHeight } from "./crystalGen";

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
  anisotropicBlur: 0.1,
  /** 1, so the roughness map (roughnessRange) gives the final values. */
  roughness: 1,
  /** Wet-polished pits .. frosted ridges, from the shared relief field. */
  roughnessRange: [0.02, 0.38] as [number, number],
  /** Wet sheen on fresh faces. */
  clearcoat: 0.6,
  clearcoatRoughness: 0.1,
  distortion: 0.1,
  distortionScale: 0.2,
  temporalDistortion: 0.02,
  /** Refraction samples per pixel (drei recompiles per value). */
  samples: { intact: 4, shard: 3 },
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
  cloud: { scale: 0.82, opacity: 0.03 },
  /** Thin elongated inclusion slivers (intact count; shards share them). */
  slivers: 3,
  /** Backdrop FBO size (square). */
  resolution: { intact: 512, shard: 384 },
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

interface IceField {
  /** Eroded relief, 0 (deepest pit) .. 1 (highest ridge), min-max normalised. */
  relief: Float32Array;
}

let _field: IceField | null = null;
/**
 * ONE noise field drives every map: the roughness map and the iridescence
 * crevice mask both read `relief`, so wet-polished pits, frosted ridges
 * and the film in the crevices always line up.
 */
function iceField(): IceField {
  if (_field) return _field;
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
  }
  for (let k = 0; k < n; k++) relief[k] = (relief[k] - lo) / (hi - lo);
  _field = { relief };
  return _field;
}

function dataTexture(data: Uint8Array): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, TEX, TEX);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
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

let _frost: THREE.DataTexture | null = null;
/**
 * The one normal map: the fine relief (crystalGen DETAIL_OCTAVES, once
 * around the chunk, at its true slope) plus sub-millimetre frost
 * (frostRepeat tiles, at frostStrength). Periodic in u; the mesh's
 * spherical UVs cover it exactly once.
 */
export function getFrostNormalMap(): THREE.DataTexture {
  if (_frost) return _frost;
  const N = NTEX, R = CRYSTAL_MATERIAL.frostRepeat;
  // Relief heights on the grid (one row of padding at the poles)
  const rel = new Float32Array(N * N);
  const fro = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const u = i / N, v = (j + 0.5) / N;
      const [x, y, z] = uvDir(u, v);
      rel[j * N + i] = reliefHeight(x, y, z);
      fro[j * N + i] = frostAt((u * R) % 1, (v * R) % 1);
    }
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
  }
  _frost = new THREE.DataTexture(data, N, N);
  _frost.wrapS = THREE.RepeatWrapping;
  _frost.wrapT = THREE.ClampToEdgeWrapping;
  _frost.needsUpdate = true;
  return _frost;
}

let _rough: THREE.DataTexture | null = null;
/**
 * Roughness from the relief (G channel, as three reads it): wet-polished
 * in the pits, frosted matte on the ridges. The material's own roughness
 * is 1, so these texels are the final values.
 */
export function getRoughnessMap(): THREE.DataTexture {
  if (_rough) return _rough;
  const R = iceField().relief;
  const [lo, hi] = CRYSTAL_MATERIAL.roughnessRange;
  const data = new Uint8Array(TEX * TEX * 4);
  for (let k = 0; k < TEX * TEX; k++) {
    // Pits stay polished over a wide band, ridges frost quickly
    const t = THREE.MathUtils.smoothstep(R[k], 0.25, 0.8);
    const g = Math.round((lo + (hi - lo) * t) * 255);
    data[k * 4] = data[k * 4 + 1] = data[k * 4 + 2] = g;
    data[k * 4 + 3] = 255;
  }
  _rough = dataTexture(data);
  return _rough;
}

let _crevice: THREE.DataTexture | null = null;
/**
 * Iridescence mask (R channel): the inverse of the relief, so the thin
 * film sits in the crevices, gathered into a few soft diagonal runs so
 * it still reads as streaks rather than speckle.
 */
export function getCreviceMap(): THREE.DataTexture {
  if (_crevice) return _crevice;
  const R = iceField().relief;
  const data = new Uint8Array(TEX * TEX * 4);
  for (let j = 0; j < TEX; j++) {
    for (let i = 0; i < TEX; i++) {
      const u = i / TEX, v = j / TEX;
      const k = j * TEX + i;
      const crevice = THREE.MathUtils.smoothstep(1 - R[k], 0.45, 0.85);
      const warp = noise3(Math.cos(u * TAU) * 2, v * 4, Math.sin(u * TAU) * 2) - 0.5;
      const run = 0.35 + 0.65 * Math.pow(Math.max(0, Math.cos((u * 3 + v * 1.4 + warp * 0.6) * TAU)), 4);
      const s = Math.round(Math.min(1, crevice * run * 1.3) * 255);
      data[k * 4] = data[k * 4 + 1] = data[k * 4 + 2] = s;
      data[k * 4 + 3] = 255;
    }
  }
  _crevice = dataTexture(data);
  return _crevice;
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

export function crystalGlassProps(variant: keyof typeof CRYSTAL_MATERIAL.tint, kind: "intact" | "shard" = "intact") {
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
    samples: CRYSTAL_MATERIAL.samples[kind],
    attenuationDistance: CRYSTAL_MATERIAL.attenuationDistance,
    envMapIntensity: CRYSTAL_MATERIAL.envMapIntensity,
    color: tint.color,
    attenuationColor: tint.attenuationColor,
    normalMap: getFrostNormalMap(),
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
}

const shared: RimUniforms = {
  rimColor: { value: new THREE.Color(CRYSTAL_MATERIAL.rim.color) },
  rimPower: { value: CRYSTAL_MATERIAL.rim.power },
  rimIntensity: { value: CRYSTAL_MATERIAL.rim.intensity },
  streakDarken: { value: CRYSTAL_MATERIAL.streakDarken },
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
  const base = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    Object.assign(shader.uniforms, rimUniforms(rim));
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        "uniform vec3 rimColor;\nuniform float rimPower;\nuniform float rimIntensity;\nuniform float streakDarken;\nvoid main() {",
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
  material.customProgramCacheKey = () => `${baseKey()}|crystal-rim-v1`;
  material.needsUpdate = true;
}
