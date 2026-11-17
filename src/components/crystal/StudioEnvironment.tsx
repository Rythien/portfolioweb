"use client";

import { Environment, Lightformer } from "@react-three/drei";

/**
 * Three-point studio for the ice, one structure for WAKE and DREAM (only
 * the tints change). Every panel aims at the crystal (Lightformer's
 * default target is the origin). The glass's highlights are these panels
 * mirrored in its facets, so each one is placed for what it draws:
 *
 * - KEY:    a large soft rect upper-left, warm white, ~2.2. Big enough
 *           that the whole top third of the rock catches it as one broad,
 *           soft highlight instead of separate hot spots.
 * - EDGE:   a narrow hard strip to the right, cool white, ~3.5, placed
 *           behind-right: the silhouette reflects at grazing angles, so
 *           that is where a strip draws one crisp specular line along the
 *           right outline (to the side, it lands mid-facet instead).
 * - BOUNCE: a wide low card below, cool pale blue: lifts the
 *           underside and keeps the lower half reading cool (the glass
 *           otherwise refracts the warm page there).
 * - SURROUNDS: mid-grey background and fills, never black: black panels
 *           mirror into every facet and muddy the reflections.
 *
 * The fourth light, a small bright point behind the crystal, is not an
 * environment panel: the glass refracts its backdrop render, not the
 * environment, so GlassCrystal draws it in the backdrop pass (BACKLIGHT).
 */
/**
 * Key and edge are one level for both modes. The bounce is per mode, as the
 * card it replaces was (1.6 / 0.15): it balances the lower half against
 * the key, and the two pages under the glass differ (bright paper vs deep
 * navy). Tuned with scripts/verify/glass-tone.mjs (WAKE passes 5/5).
 */
const KEY = 2.2;
const EDGE = 3.5;

const RIG = {
  wake: {
    surround: "#7c7d82",
    fill: "#a9adb5",
    key: "#fff3e3", // warm white
    edge: "#e6f0ff", // cool white
    bounce: "#d6e6ff", // cool pale blue
    bounceIntensity: 1.85,
  },
  dream: {
    surround: "#4a4566",
    fill: "#8a82b8",
    key: "#e6dcff", // violet (light: a deeper violet starved the upper half)
    edge: "#e6f0ff", // cool white
    bounce: "#cfd4ff",
    bounceIntensity: 0.12,
  },
} as const;

export default function StudioEnvironment({ variant }: { variant: "wake" | "dream" }) {
  const c = RIG[variant];
  const bounceI = c.bounceIntensity;
  return (
    <Environment background={false} resolution={512}>
      <color attach="background" args={[c.surround]} />
      {/* KEY: large soft rect, upper left, a little in front */}
      <Lightformer form="rect" intensity={KEY} position={[-4.5, 5.5, 3.5]} scale={[10, 6, 1]} color={c.key} />
      {/* EDGE: narrow hard strip to the right and well behind. A facet at
          angle t in from the silhouette reflects direction (sin 2t, -cos 2t),
          so the outline itself mirrors what is behind-right: direction
          ~(0.45, -1) puts the line ~12 deg in, along the right outline.
          In front of the back fill (z -6) so it is not hidden by it */}
      <Lightformer form="rect" intensity={EDGE} position={[2.4, 0.4, -5.2]} scale={[0.3, 9, 1]} color={c.edge} />
      {/* BOUNCE: wide low card below */}
      <Lightformer form="rect" intensity={bounceI} position={[0, -4, 0.4]} scale={[9, 5, 1]} color={c.bounce} />
      {/* SURROUNDS: soft grey behind and to the left so nothing reflects black */}
      <Lightformer form="rect" intensity={0.6} position={[0, 1, -6]} scale={[10, 6, 1]} color={c.fill} />
      <Lightformer form="rect" intensity={0.45} position={[-6, -1, -1]} scale={[3, 6, 1]} color={c.fill} />
    </Environment>
  );
}
