"use client";

import { useFrame } from "@react-three/fiber";
import { tickCrystalPose, getCrystalPose, type CrystalPose } from "@/hooks/crystalState";

export * from "@/hooks/crystalState";

/** Scene-side: advances the shared crystal pose once per rendered frame. */
export function useCrystalPose(): CrystalPose {
  useFrame((st, dt) => {
    // World half-width at z=0 for the portal camera (st.viewport reports
    // pixels inside these portals, not world units)
    const cam = st.camera as { fov?: number; position: { z: number } };
    const fov = cam.fov ?? 50;
    const halfH = Math.tan((fov * Math.PI) / 360) * Math.abs(cam.position.z);
    const halfW = halfH * (st.size.width / Math.max(st.size.height, 1));
    tickCrystalPose(
      st.clock.elapsedTime,
      dt,
      halfW,
      st.size.width,
      st.size.height,
      Math.abs(cam.position.z),
    );
  });
  return getCrystalPose();
}
