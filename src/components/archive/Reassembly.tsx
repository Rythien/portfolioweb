"use client";

import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";
import { decodeCrystal, TARGET_SIZE } from "@/components/crystal/crystalGen";
import { UNUSED_FBO, applyCrystalShader, crystalGlassProps, thicknessFor } from "@/components/crystal/crystalMaterial";
import { ENDING } from "./game";
import type { ArchiveState } from "./archiveState";

/**
 * The ending: every shard has converged (Seal.tsx moves them) and the
 * intact crystal (the hero's own procedural chunk, the same ice) forms in
 * front of the visitor. Mounted from the start but hidden (userData.warm
 * asks the Archive's warm-up to compile it anyway), so it costs nothing
 * per frame and never hitches in.
 */

const CRYSTAL_URL = "/models/crystal-chunk.bin";
const arrayBuffer = (loader: THREE.Loader) => (loader as THREE.FileLoader).setResponseType("arraybuffer");
/** On-screen size at ENDING.distance: about a third of the view. */
const SCALE = 1.5;

const easeOutBack = (x: number) => {
  const c = 1.5;
  const u = Math.min(1, Math.max(0, x)) - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

interface Props {
  game: React.RefObject<ArchiveState>;
  buffer: THREE.Texture;
  /** Hidden for the seals' backdrop pass, like every other piece of glass. */
  hide: (o: THREE.Object3D | null) => void;
  glowTex: THREE.Texture;
  reduced: boolean;
}

export default function Reassembly({ game, buffer, hide, glowTex, reduced }: Props) {
  const buf = useLoader(THREE.FileLoader, CRYSTAL_URL, arrayBuffer) as unknown as ArrayBuffer;
  const geo = useMemo(() => decodeCrystal(buf)[0], [buf]);
  // The seals' kind (4 samples): it then shares the seal body's program.
  // At "intact" (8 samples) it was its own program, and ANGLE took ~5 s to
  // compile it (the sample loop is unrolled), all of it on the GPU process
  // the page's frames wait behind
  const glass = useMemo(() => crystalGlassProps("dream", "seal"), []);
  const group = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Sprite>(null);
  const light = useRef<THREE.PointLight>(null);

  useFrame((state, delta) => {
    const g = game.current;
    const end = g.ending;
    const grp = group.current;
    if (!grp) return;
    grp.visible = !!end;
    if (!end) {
      if (flash.current) flash.current.visible = false;
      if (light.current) light.current.intensity = 0;
      return;
    }
    if (light.current) light.current.position.set(end.point[0], end.point[1], end.point[2]);
    const et = g.t - end.t0;
    const t0 = ENDING.converge - 0.4;
    const k = (et - t0) / ENDING.form;
    grp.position.set(end.point[0], end.point[1], end.point[2]);
    grp.scale.setScalar(Math.max(1e-4, SCALE * (reduced ? Math.min(1, Math.max(0, k)) : easeOutBack(k))));
    if (!reduced) {
      grp.rotation.y += delta * 0.25;
      grp.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    }
    // The moment it is whole: one flash, then a held inner light
    const fa = (et - ENDING.converge) / 0.9;
    if (flash.current) {
      flash.current.visible = fa >= 0 && fa < 1;
      if (flash.current.visible) {
        const sz = 4 + 16 * Math.sqrt(fa);
        flash.current.scale.set(sz, sz, 1);
        (flash.current.material as THREE.SpriteMaterial).opacity = 0.7 * (1 - fa);
      }
    }
    // Kept low: over the lifted fog the ice must read by its edges, not glare
    if (light.current) light.current.intensity = k > 0 ? 1.2 + 5 * Math.exp(-Math.max(0, fa) * 2) : 0;
  });

  return (
    <group>
      {/* Outside the hidden group and always visible (intensity 0 until the
          ending): three bakes the point-light count into every lit program,
          so a light appearing at the ending recompiled the whole Archive */}
      <pointLight ref={light} color="#e9dfff" intensity={0} distance={14} decay={1.4} />
      <group ref={group} visible={false}>
        <mesh ref={hide} geometry={geo} frustumCulled={false} userData={{ warm: true }}>
          <MeshTransmissionMaterial
            {...glass}
            buffer={buffer}
            thickness={thicknessFor(TARGET_SIZE)}
            resolution={UNUSED_FBO}
            ref={(m: unknown) => applyCrystalShader(m as THREE.Material | null)}
          />
        </mesh>
      </group>
      <ReassemblyFlash flashRef={flash} game={game} glowTex={glowTex} />
    </group>
  );
}

/** The flash sits at the crystal but outside its (scaled) group. */
function ReassemblyFlash({
  flashRef,
  game,
  glowTex,
}: {
  flashRef: React.RefObject<THREE.Sprite | null>;
  game: React.RefObject<ArchiveState>;
  glowTex: THREE.Texture;
}) {
  useFrame(() => {
    const end = game.current.ending;
    if (end && flashRef.current) flashRef.current.position.set(end.point[0], end.point[1], end.point[2]);
  });
  return (
    <sprite ref={flashRef} visible={false} renderOrder={6}>
      <spriteMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} toneMapped={false} />
    </sprite>
  );
}
