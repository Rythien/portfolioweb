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
  normalScale: 0.14,
  ior: 1.35,
  /** Thickness per world unit of the mesh's largest side. */
  thicknessRatio: 0.45 / TARGET_SIZE,
  chromaticAberration: 0.08,
  anisotropicBlur: 0.1,
  roughness: 0.05,
  distortion: 0.1,
  distortionScale: 0.2,
  temporalDistortion: 0.02,
  samples: 8,
  attenuationDistance: 5,
  envMapIntensity: 1.0,
  /** Thin film: the oil-slick streaks, masked to the upper faces. */
  iridescence: 0.3,
  iridescenceIOR: 1.6,
  /** Film thickness in nm (three r187: separate min / max). */
  iridescenceThicknessMinimum: 180,
  iridescenceThicknessMaximum: 520,
  /** Streaks also darken the glass slightly where the film is. */
  streakDarken: 0.32,
  /** Fresnel rim along the silhouette. */
  rim: { color: "#ffffff", power: 3, intensity: 0.5 },
  /** Backdrop FBO size: the only other thing a shard may change. */
  resolution: { intact: 1024, shard: 768 },
  tint: {
    wake: { color: "#e8f1f5", attenuationColor: "#cfe3ea" },
    dream: { color: "#c4b5fd", attenuationColor: "#b4a0e8" },
  },
} as const;

export function thicknessFor(meshSize: number): number {
  return CRYSTAL_MATERIAL.thicknessRatio * meshSize;
}

/* ── Shared textures (built once, same objects everywhere) ─────── */

const TAU = Math.PI * 2;

/** Height field periodic in u (the spherical seam), so the map tiles. */
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

let _frost: THREE.DataTexture | null = null;
/**
 * Rough eroded surface with fine rippled frost: one fbm height field plus
 * thin ripples bent by that field, turned into normals by differencing the
 * grid (one noise lookup per texel, not three).
 */
export function getFrostNormalMap(size = 256): THREE.DataTexture {
  if (_frost) return _frost;
  const H = new Float32Array(size * size);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = i / size, v = j / size;
      const base = heightAt(u, v, 14, 4);
      // Fine frost ripples: faint, slanted, with the period itself warped
      // by the base field so they wander instead of banding (strong or
      // regular ripples read as stripes and alias at this resolution)
      const ripple = Math.sin((v * 44 + u * 18 + base * 14) * Math.PI) * 0.012;
      H[j * size + i] = base + ripple;
    }
  }
  const data = new Uint8Array(size * size * 4);
  const k = 2.2;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const hL = H[j * size + ((i - 1 + size) % size)], hR = H[j * size + ((i + 1) % size)];
      const hD = H[Math.max(0, j - 1) * size + i], hU = H[Math.min(size - 1, j + 1) * size + i];
      const dx = (hL - hR) * k * size * 0.05, dy = (hD - hU) * k * size * 0.05;
      const len = Math.hypot(dx, dy, 1);
      const o = (j * size + i) * 4;
      data[o] = ((dx / len) * 0.5 + 0.5) * 255;
      data[o + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      data[o + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  _frost = tex;
  return tex;
}

let _streaks: THREE.DataTexture | null = null;
/** A few diagonal streaks across the upper faces (R channel, 0..1). */
export function getStreakMap(size = 256): THREE.DataTexture {
  if (_streaks) return _streaks;
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = i / size, v = j / size;
      // v is latitude (1 = top): fade in over the upper faces only
      const upper = THREE.MathUtils.smoothstep(v, 0.56, 0.72);
      const warp = noise3(Math.cos(u * TAU) * 2, v * 4, Math.sin(u * TAU) * 2) - 0.5;
      // 3 streaks around the crystal, slanting across the faces
      const phase = u * 3 + v * 1.4 + warp * 0.6;
      const band = Math.pow(Math.max(0, Math.cos(phase * TAU)), 18);
      const s = Math.min(1, band * upper * 1.4);
      const o = (j * size + i) * 4;
      data[o] = data[o + 1] = data[o + 2] = Math.round(s * 255);
      data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  _streaks = tex;
  return tex;
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
