/**
 * ONE material for the intact crystal and every shard. Shards may differ
 * only in thickness (scaled by their size) and backdrop resolution; every
 * other value, and the frost and streak textures themselves (the same
 * texture objects), are shared.
 */
import * as THREE from "three";
import { noise3 } from "./frostUtils";
import { TARGET_SIZE } from "./crystalGen";

export const CRYSTAL_MATERIAL = {
  /** Normal map is sub-millimetre frost only; relief is in the geometry. */
  normalScale: 0.09,
  /** Frost normal map repeats around the chunk (it tiles in u and v). */
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
  samples: 8,
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
  cloud: { scale: 0.82, opacity: 0.1 },
  /** Thin elongated inclusion slivers (intact count; shards share them). */
  slivers: 5,
  /** Backdrop FBO size: the only other thing a shard may change. */
  resolution: { intact: 1024, shard: 768 },
  tint: {
    wake: { color: "#e8f1f5", attenuationColor: "#cfe3ea" },
    dream: { color: "#c4b5fd", attenuationColor: "#b4a0e8" },
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
  /** Sub-millimetre frost height (fully tileable, for the normal map). */
  frost: Float32Array;
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
  const frost = new Float32Array(n);
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < TEX; j++) {
    for (let i = 0; i < TEX; i++) {
      const u = i / TEX, v = j / TEX;
      const h = heightAt(u, v, 14, 4);
      relief[j * TEX + i] = h;
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
      // Frost: two fine tileable octaves plus faint wandering ripples
      const x = u * 48, y = v * 48;
      const f = tileNoise(x, y, 48, 3) * 0.6 + tileNoise(x * 2, y * 2, 96, 5) * 0.4;
      const ripple = Math.sin((v * 64 + u * 32 + f * 3) * TAU) * 0.08;
      frost[j * TEX + i] = f + ripple;
    }
  }
  for (let k = 0; k < n; k++) relief[k] = (relief[k] - lo) / (hi - lo);
  _field = { relief, frost };
  return _field;
}

function dataTexture(data: Uint8Array): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, TEX, TEX);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

let _frost: THREE.DataTexture | null = null;
/**
 * Sub-millimetre frost only: the eroded relief now lives in the geometry
 * (crystalGen DETAIL_OCTAVES). Tileable, so it can repeat finely.
 */
export function getFrostNormalMap(): THREE.DataTexture {
  if (_frost) return _frost;
  const H = iceField().frost;
  const data = new Uint8Array(TEX * TEX * 4);
  const k = 6;
  for (let j = 0; j < TEX; j++) {
    for (let i = 0; i < TEX; i++) {
      const hL = H[j * TEX + ((i - 1 + TEX) % TEX)], hR = H[j * TEX + ((i + 1) % TEX)];
      const hD = H[((j - 1 + TEX) % TEX) * TEX + i], hU = H[((j + 1) % TEX) * TEX + i];
      const dx = (hL - hR) * k, dy = (hD - hU) * k;
      const len = Math.hypot(dx, dy, 1);
      const o = (j * TEX + i) * 4;
      data[o] = ((dx / len) * 0.5 + 0.5) * 255;
      data[o + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      data[o + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      data[o + 3] = 255;
    }
  }
  _frost = dataTexture(data);
  _frost.repeat.set(CRYSTAL_MATERIAL.frostRepeat, CRYSTAL_MATERIAL.frostRepeat);
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

/* ── Rim + streak shading on top of drei's transmission material ── */

const shared = {
  rimColor: { value: new THREE.Color(CRYSTAL_MATERIAL.rim.color) },
  rimPower: { value: CRYSTAL_MATERIAL.rim.power },
  rimIntensity: { value: CRYSTAL_MATERIAL.rim.intensity },
  streakDarken: { value: CRYSTAL_MATERIAL.streakDarken },
};

const PATCHED = Symbol("crystalShader");

/**
 * Chain onto the material's own onBeforeCompile (drei's transmission
 * patch) and add a fresnel rim plus the darker film streaks. Uniforms are
 * shared objects, so every crystal material reads one config.
 */
export function applyCrystalShader(material: THREE.Material | null): void {
  if (!material) return;
  const m = material as THREE.Material & { [PATCHED]?: boolean };
  if (m[PATCHED]) return;
  m[PATCHED] = true;
  const base = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    Object.assign(shader.uniforms, shared);
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
