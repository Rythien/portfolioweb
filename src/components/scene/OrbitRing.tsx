"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { damp } from "maath/easing";
import { useScrollStore } from "@/store/useScrollStore";
import { getCrystalPose, getCrystalTimeOverride } from "@/hooks/useCrystalPose";
import { SCENE_LABEL } from "@/lib/palette";

/* ── Orbit ring (follows the crystal's pose) ───────────────────────
 * A band of mono caps circling the crystal, and a faint partial arc
 * further out turning the other way. Both are alpha masks drawn white;
 * the colour is the mode's label colour (lib/palette), so one texture
 * serves WAKE and DREAM.
 *
 * A halo, not an orbit: ~1.3x the crystal's on-screen radius, tilted
 * shallow, so it stays in the crystal's own area. The type is an
 * engraving, not a label (caps ~0.03 world units, the phrase ~6 times
 * round). The arc nearest the camera dims (nearFade) so the front pass
 * never sits heavier than the back.
 */

const RING = {
  /** Just past the chunk's bounding radius (1.45, crystalGen at
   * TARGET_SIZE), so it never cuts a corner: ~1.3x the crystal's visible
   * half-width. Both scale with the pose, so it hugs at any size. */
  radius: 1.5,
  /** Band height (world units): hugs the caps. */
  height: 0.05,
  label: ["SELECTED WORK", "2026", "SEARON MAHARJAN"],
  /** Of the band height. */
  fontShare: 0.85,
  /** Letterspacing, em (the chrome's labels, opened up for the ring). */
  tracking: 0.2,
  /** Space either side of each star, em. */
  starGap: 1.5,
  /** The star's half-size, em. */
  starR: 0.3,
  opacity: 0.7,
  /** Texels across the ring at a pixel ratio of 1: caps ~10 texels tall. */
  texWidth: 4096,
} as const;

const ARC = {
  /** Just outside the ring: inside the crystal's area, on screen. */
  radius: 1.5 * 1.2,
  height: 0.035,
  /** Of a full turn. */
  span: 0.6,
  /** Of the ring's opacity. */
  opacity: 0.28,
  texWidth: 4096,
  /** Degrees between ticks; every fifth is long. */
  tickDeg: 2,
  /** Each end fades over this share of the arc. */
  endFade: 0.2,
} as const;

/** Rotation rates, radians (or texture turns) per second. */
const SPIN = { ring: 0.08, crawl: 0.02, arc: -0.03 } as const;

/**
 * The near arc's fade, by view depth: 0 at the ring's centre plane, 1 at
 * the point nearest the camera (in radii). Full alpha up to `from`,
 * `floor` of it by `to`.
 */
const NEAR = { from: 0.4, to: 1.0, floor: 0.4 } as const;

/** Tilt off edge-on (radians) and its slow sway: shallow, so the halo
 * stays a narrow ellipse around the crystal. */
const TILT = { base: 0.3, sway: 0.05 } as const;

/** Fade a band material's alpha out over the side nearest the camera. */
function nearFade(radius: number) {
  const f = (n: number) => n.toFixed(4);
  return {
    onBeforeCompile(shader: THREE.WebGLProgramParametersWithUniforms) {
      shader.vertexShader = shader.vertexShader
        .replace("void main() {", "varying float vNear;\nvoid main() {")
        .replace(
          "#include <project_vertex>",
          `#include <project_vertex>
          {
            vec4 nc = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
            vNear = ( mvPosition.z - nc.z ) / ( length( modelViewMatrix[ 0 ].xyz ) * ${f(radius)} );
          }`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "varying float vNear;\nvoid main() {")
        .replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
          gl_FragColor.a *= mix( 1.0, ${f(NEAR.floor)}, smoothstep( ${f(NEAR.from)}, ${f(NEAR.to)}, vNear ) );`,
        );
    },
    customProgramCacheKey: () => `orbit-near-v2-${f(radius)}`,
  };
}

/** The chrome's mono family (next/font's --font-mono), resolved. */
function monoFamily(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim();
  return v || "ui-monospace, monospace";
}

/** Texture width for this renderer: base x pixel ratio, within the GPU's limit. */
function texWidthFor(gl: THREE.WebGLRenderer, base: number): number {
  return Math.min(Math.round(base * gl.getPixelRatio()), gl.capabilities.maxTextureSize);
}

/** A four-point star, centred on (x, y), r its half-size. */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const k = r * 0.22; // waist: concave sides
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + k, y - k, x + r, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r);
  ctx.quadraticCurveTo(x - k, y + k, x - r, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r);
  ctx.fill();
}

/**
 * The ring's type: the label, star-separated, a whole number of times
 * around, so the wrap has no seam. Whatever the repeats leave over is
 * shared out into the gaps around the stars.
 */
function drawRing(canvas: HTMLCanvasElement, family: string) {
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  const font = Math.round(h * RING.fontShare);
  ctx.font = `500 ${font}px ${family}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  const track = RING.tracking * font;
  // Each glyph carries its tracking after it (as CSS letter-spacing does)
  const wordWidth = (s: string) => [...s].reduce((a, c) => a + ctx.measureText(c).width + track, 0);
  const words = RING.label.map(wordWidth);
  const gap = RING.starGap * font;
  const starSlot = 2 * RING.starR * font;
  // Per word: the word, its gap, the star, its gap, and one tracking step
  // after the star so both sides of it carry the same space
  const unit = words.reduce((a, b) => a + b, 0) + RING.label.length * (2 * gap + starSlot + track);
  const repeats = Math.max(1, Math.round(w / unit));
  const gapFit = gap + (w / repeats - unit) / (2 * RING.label.length);
  // Caps centred in the band (all-caps type: the cap height is the box)
  const cap = ctx.measureText("H").actualBoundingBoxAscent;
  const y = (h + cap) / 2;
  let x = 0;
  for (let r = 0; r < repeats; r++) {
    RING.label.forEach((word) => {
      for (const c of word) {
        ctx.fillText(c, x, y);
        x += ctx.measureText(c).width + track;
      }
      x += gapFit;
      star(ctx, x + starSlot / 2, h / 2, RING.starR * font);
      x += starSlot + gapFit + track;
    });
  }
}

/** The outer arc: a hairline with ticks, its ends faded out. */
function drawArc(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  const line = Math.max(1, Math.round(h * 0.14));
  ctx.fillRect(0, Math.round((h - line) / 2), w, line);
  const ticks = Math.round((ARC.span * 360) / ARC.tickDeg);
  for (let i = 0; i <= ticks; i++) {
    const x = Math.round((i / ticks) * (w - line));
    const long = i % 5 === 0;
    const th = long ? h : Math.round(h * 0.45);
    ctx.fillRect(x, Math.round((h - th) / 2), line, th);
  }
  // Fade the ends: a partial arc that thins away, never stops dead
  ctx.globalCompositeOperation = "destination-in";
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(ARC.endFade, "rgba(255,255,255,1)");
  g.addColorStop(1 - ARC.endFade, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
}

/** A canvas texture sized to its band's world aspect (glyphs unstretched). */
function bandTexture(gl: THREE.WebGLRenderer, base: number, worldW: number, worldH: number) {
  const c = document.createElement("canvas");
  c.width = texWidthFor(gl, base);
  c.height = Math.max(4, Math.round((c.width * worldH) / worldW));
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = gl.capabilities.getMaxAnisotropy();
  tex.colorSpace = THREE.NoColorSpace;
  return { canvas: c, tex };
}

export default function OrbitRing({ variant, reducedMotion }: { variant: "wake" | "dream"; reducedMotion: boolean }) {
  const gl = useThree((s) => s.gl);
  const ringRef = useRef<THREE.Group>(null);
  const faceRef = useRef<THREE.Mesh>(null);
  const insideRef = useRef<THREE.Mesh>(null);
  const arcRef = useRef<THREE.Mesh>(null);
  const dampedPos = useRef(new THREE.Vector3(0, 0, 0));
  const dampedOpacity = useRef(0);
  /** The type is drawn (the mono font is in): until then nothing shows. */
  const drawnRef = useRef(false);

  const ring = useMemo(() => {
    const t = bandTexture(gl, RING.texWidth, 2 * Math.PI * RING.radius, RING.height);
    t.tex.wrapS = THREE.RepeatWrapping;
    t.tex.wrapT = THREE.ClampToEdgeWrapping;
    // The far side of the ring is seen from inside, where the type would
    // read mirrored: the inside wears the same type flipped, so both read
    // left to right (same canvas, its own uv transform)
    const inside = t.tex.clone();
    inside.repeat.x = -1;
    return { ...t, inside };
  }, [gl]);
  const ringGeo = useMemo(() => new THREE.CylinderGeometry(RING.radius, RING.radius, RING.height, 128, 1, true), []);
  const arc = useMemo(() => {
    const t = bandTexture(gl, ARC.texWidth, 2 * Math.PI * ARC.radius * ARC.span, ARC.height);
    drawArc(t.canvas);
    t.tex.needsUpdate = true;
    return t;
  }, [gl]);

  useEffect(() => {
    let live = true;
    const family = monoFamily();
    const font = Math.round(ring.canvas.height * RING.fontShare);
    // Drawn with whatever loads (the fallback if the face fails)
    const draw = () => {
      if (!live) return;
      drawRing(ring.canvas, family);
      ring.tex.needsUpdate = true;
      ring.inside.needsUpdate = true;
      drawnRef.current = true;
    };
    document.fonts.load(`500 ${font}px ${family}`).then(draw, draw);
    return () => {
      live = false;
    };
  }, [ring]);

  useEffect(
    () => () => {
      ring.tex.dispose();
      ring.inside.dispose();
      arc.tex.dispose();
      ringGeo.dispose();
    },
    [ring, arc, ringGeo],
  );

  useFrame((state, delta) => {
    const mesh = ringRef.current;
    const outer = arcRef.current;
    const face = faceRef.current;
    const inside = insideRef.current;
    if (!mesh || !outer || !face || !inside) return;
    // A frozen crystal pose (crystalfreeze) pins the ring with it; reduced
    // motion holds it still, but it still follows the crystal and fades
    const elapsed = reducedMotion ? 0 : (getCrystalTimeOverride() ?? state.clock.elapsedTime);
    const pose = getCrystalPose();

    damp(dampedPos.current, "x", pose.x, 0.3, delta);
    damp(dampedPos.current, "y", pose.y, 0.3, delta);
    damp(dampedPos.current, "z", pose.z, 0.3, delta);

    const scrollP = useScrollStore.getState().progress;
    const tilt = TILT.base + Math.sin(elapsed * 0.06) * TILT.sway;
    const roll = 0.2 + scrollP * 0.4;
    // Rings shrink with the parked crystal so they never circle the copy
    const s = Math.max(pose.scale, 0.05);
    for (const m of [mesh, outer]) {
      m.position.copy(dampedPos.current);
      m.scale.setScalar(s);
      m.rotation.x = tilt;
      m.rotation.z = roll;
    }
    mesh.rotation.y = elapsed * SPIN.ring;
    outer.rotation.y = elapsed * SPIN.arc;
    // The type crawls the same way round on both faces (the inside's u
    // runs backwards)
    const faceMat = face.material as THREE.MeshBasicMaterial;
    const insideMat = inside.material as THREE.MeshBasicMaterial;
    if (faceMat.map) faceMat.map.offset.x = elapsed * SPIN.crawl;
    if (insideMat.map) insideMat.map.offset.x = -elapsed * SPIN.crawl;

    // Fade out as the crystal breaks and as the hero scrolls away. The
    // ring is 1.3x the crystal's radius, so it would cross the copy the
    // crystal is being kept off: it leaves as the copy clamp takes hold
    const breakFade = Math.max(0, 1 - pose.breakVal * 3);
    const scrollFade = scrollP < 0.6 ? 1 : 1 - (scrollP - 0.6) / 0.4;
    const target = (drawnRef.current ? 1 : 0) * Math.min(breakFade, scrollFade) * pose.fade * (1 - pose.clamp);
    dampedOpacity.current = THREE.MathUtils.lerp(dampedOpacity.current, target, 1 - Math.exp(-4 * delta));
    const k = dampedOpacity.current;
    faceMat.opacity = insideMat.opacity = RING.opacity * k;
    (outer.material as THREE.MeshBasicMaterial).opacity = RING.opacity * ARC.opacity * k;
    mesh.visible = outer.visible = k > 0.002;
  });

  const color = SCENE_LABEL[variant];
  const ringFade = useMemo(() => nearFade(RING.radius), []);
  const arcFade = useMemo(() => nearFade(ARC.radius), []);
  return (
    <>
      {/* Inside first: the far side draws before the near one */}
      <group ref={ringRef} rotation={[TILT.base, 0, 0.2]} visible={false}>
        <mesh ref={insideRef} geometry={ringGeo}>
          <meshBasicMaterial map={ring.inside} color={color} transparent opacity={0} side={THREE.BackSide} depthWrite={false} fog={false} {...ringFade} />
        </mesh>
        <mesh ref={faceRef} geometry={ringGeo}>
          <meshBasicMaterial map={ring.tex} color={color} transparent opacity={0} side={THREE.FrontSide} depthWrite={false} fog={false} {...ringFade} />
        </mesh>
      </group>
      <mesh ref={arcRef} rotation={[TILT.base, 0, 0.2]} visible={false}>
        <cylinderGeometry args={[ARC.radius, ARC.radius, ARC.height, 96, 1, true, 0, 2 * Math.PI * ARC.span]} />
        <meshBasicMaterial map={arc.tex} color={color} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} fog={false} {...arcFade} />
      </mesh>
    </>
  );
}
