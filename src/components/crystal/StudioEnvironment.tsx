"use client";

import { Environment, Lightformer } from "@react-three/drei";

/**
 * Studio lighting for the ice, shared by WAKE and DREAM so the finish is
 * identical in both (only the tints differ). Every panel aims at the
 * crystal (Lightformer's default target is the origin).
 *
 * - key:    one large, bright, soft panel upper-left
 * - strip:  one narrow hard strip to the right, the crisp specular edge
 * - bounce: one low warm panel below, the glow underneath
 * - fill:   mid-grey surrounds, never black (black panels mirrored into
 *           every facet and muddied the reflections)
 */
const RIG = {
  wake: {
    surround: "#7c7d82",
    key: "#ffffff",
    strip: "#ffffff",
    bounce: "#ffb27a",
    fill: "#a9adb5",
  },
  dream: {
    surround: "#4a4566",
    key: "#efeaff",
    strip: "#ffffff",
    bounce: "#ffb08a",
    fill: "#8a82b8",
  },
} as const;

export default function StudioEnvironment({ variant }: { variant: "wake" | "dream" }) {
  const c = RIG[variant];
  return (
    <Environment background={false} resolution={512}>
      <color attach="background" args={[c.surround]} />
      {/* Key: big soft panel, upper left, slightly in front */}
      <Lightformer form="rect" intensity={3.2} position={[-5, 5, 3]} scale={[7, 5, 1]} color={c.key} />
      {/* Strip: narrow, hard and bright, to the right */}
      <Lightformer form="rect" intensity={9} position={[6, 0.6, 1.2]} scale={[0.35, 7, 1]} color={c.strip} />
      {/* Warm bounce, low and below */}
      <Lightformer form="rect" intensity={1.6} position={[0, -5, 1.5]} scale={[7, 2.5, 1]} color={c.bounce} />
      {/* Soft grey fills behind and to the left so nothing reflects black */}
      <Lightformer form="rect" intensity={0.6} position={[0, 1, -6]} scale={[10, 6, 1]} color={c.fill} />
      <Lightformer form="rect" intensity={0.45} position={[-6, -1, -1]} scale={[3, 6, 1]} color={c.fill} />
    </Environment>
  );
}
