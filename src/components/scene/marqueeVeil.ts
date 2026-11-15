/**
 * The marquee softens behind the crystal. Black headline type sitting
 * at full strength behind pale ice left no logo colour that could
 * separate from both, so inside a soft disc that follows the crystal the
 * type fades to VEIL.centre of its opacity.
 *
 * The marquee is drawn several times a frame: on screen and into the
 * crystal's backdrop FBOs (which is where the type seen *through* the
 * glass comes from). Every pass uses the same camera, so the disc is
 * kept in normalised viewport coordinates and each draw divides
 * gl_FragCoord by the size of whatever target is bound (onBeforeRender).
 */
import * as THREE from "three";
import { CRYSTAL_VISIBLE_R, getCrystalPose } from "@/hooks/crystalState";
import { useFractureStore } from "@/store/useFractureStore";

export const VEIL = {
  /** Disc radius as a multiple of the crystal's on-screen radius. */
  radius: 1.35,
  /** Opacity multiplier at the centre. */
  centre: 0.28,
  /** Fraction of the radius, at the rim, over which it eases back to 1. */
  feather: 0.35,
} as const;

const uniforms = {
  uVeilCentre: { value: new THREE.Vector2(0.5, 0.5) },
  /** Radius in viewport fractions (x and y differ: a circle on screen). */
  uVeilRadius: { value: new THREE.Vector2(0.1, 0.1) },
  /** 0 = no veil, 1 = full veil. */
  uVeilStrength: { value: 0 },
  uVeilRes: { value: new THREE.Vector2(1, 1) },
};

const PATCHED = Symbol("marqueeVeil");

/** Patch the base material troika derives the text material from. */
export function patchVeilMaterial(material: THREE.Material | null): void {
  if (!material) return;
  const m = material as THREE.Material & { [PATCHED]?: boolean };
  if (m[PATCHED]) return;
  m[PATCHED] = true;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        `uniform vec2 uVeilCentre;
uniform vec2 uVeilRadius;
uniform float uVeilStrength;
uniform vec2 uVeilRes;
void main() {`,
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        {
          vec2 vuv = gl_FragCoord.xy / uVeilRes;
          float vd = length( ( vuv - uVeilCentre ) / max( uVeilRadius, vec2( 1e-5 ) ) );
          float vk = mix( ${VEIL.centre.toFixed(3)}, 1.0, smoothstep( ${(1 - VEIL.feather).toFixed(3)}, 1.0, vd ) );
          gl_FragColor.a *= mix( 1.0, vk, uVeilStrength );
        }`,
      );
  };
  material.customProgramCacheKey = () => "marquee-veil-v1";
  // The material's hook, not the mesh's: troika's Text owns mesh.onBeforeRender,
  // and its derived material inherits this one through the prototype
  material.onBeforeRender = (renderer) => veilBeforeRender(renderer);
  material.needsUpdate = true;
}

const _size = new THREE.Vector2();
/** Per draw: the bound target's size, so FBO passes map the same disc. */
function veilBeforeRender(renderer: THREE.WebGLRenderer): void {
  const rt = renderer.getRenderTarget();
  if (rt) uniforms.uVeilRes.value.set(rt.width, rt.height);
  else uniforms.uVeilRes.value.copy(renderer.getDrawingBufferSize(_size));
}

const _c = new THREE.Vector3();
const _e = new THREE.Vector3();
/**
 * Once per frame: project the crystal's centre and visible radius.
 * The disc shrinks with the break and is gone at breakVal 1.
 */
export function updateVeil(camera: THREE.Camera, reducedMotion: boolean): void {
  const pose = getCrystalPose();
  const breakVal = useFractureStore.getState().breakVal;
  const x = reducedMotion ? 0 : pose.x;
  const y = reducedMotion ? 0 : pose.y;
  const z = reducedMotion ? 0 : pose.z;
  const scale = reducedMotion ? 1 : pose.scale;
  const intact = Math.max(0, 1 - breakVal);
  const r = CRYSTAL_VISIBLE_R * scale * VEIL.radius * intact;

  _c.set(x, y, z).project(camera);
  const cu = _c.x * 0.5 + 0.5, cv = _c.y * 0.5 + 0.5;
  _e.set(x + r, y, z).project(camera);
  const rx = Math.abs(_e.x * 0.5 + 0.5 - cu);
  _e.set(x, y + r, z).project(camera);
  const ry = Math.abs(_e.y * 0.5 + 0.5 - cv);

  uniforms.uVeilCentre.value.set(cu, cv);
  uniforms.uVeilRadius.value.set(rx, ry);
  uniforms.uVeilStrength.value = intact > 0 ? Math.min(1, pose.fade) : 0;
}
