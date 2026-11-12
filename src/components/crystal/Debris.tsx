"use client";

import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";
import * as THREE from "three";
import { useFractureStore } from "@/store/useFractureStore";
import { getCrystalPose } from "@/hooks/useCrystalPose";

const CHIP_COUNT = 35;
const TWO_PI = Math.PI * 2;

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

interface ChipData {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  tumbleAxis: THREE.Vector3;
  tumbleSpeed: number;
  driftCenter: THREE.Vector3;
  lissFreq: THREE.Vector3;
  lissPhase: THREE.Vector3;
  lissAmp: THREE.Vector3;
  scale: number;
}

function buildChips(seed: number): ChipData[] {
  const rng = seededRandom(seed);
  const chips: ChipData[] = [];

  for (let i = 0; i < CHIP_COUNT; i++) {
    const th = Math.acos(2 * rng() - 1);
    const ph = TWO_PI * rng();
    const r = 0.8 + rng() * 0.6;
    const origin = new THREE.Vector3(
      r * Math.sin(th) * Math.cos(ph),
      r * Math.sin(th) * Math.sin(ph),
      r * Math.cos(th),
    );
    const direction = origin.clone().normalize();
    const tumbleAxis = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
    const tumbleSpeed = 0.15 + rng() * 0.3;

    const spread = 3 + rng() * 2;
    const driftCenter = new THREE.Vector3(
      direction.x * spread + (rng() - 0.5) * 1.5,
      direction.y * spread + (rng() - 0.5) * 1.5,
      direction.z * spread * 0.4 + (rng() - 0.5) * 0.8,
    );
    const lissFreq = new THREE.Vector3(0.12 + rng() * 0.2, 0.1 + rng() * 0.18, 0.08 + rng() * 0.15);
    const lissPhase = new THREE.Vector3(rng() * TWO_PI, rng() * TWO_PI, rng() * TWO_PI);
    const lissAmp = new THREE.Vector3(0.3 + rng() * 0.6, 0.2 + rng() * 0.5, 0.15 + rng() * 0.3);
    const scale = 0.025 + rng() * 0.055;

    chips.push({
      origin, direction, tumbleAxis, tumbleSpeed,
      driftCenter, lissFreq, lissPhase, lissAmp, scale,
    });
  }
  return chips;
}

const _chipGeo = new THREE.TetrahedronGeometry(1, 0);

export default function Debris({ seed = 42 }: { seed?: number }) {
  const chips = useMemo(() => buildChips(seed), [seed]);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { scene: portalScene, camera: portalCamera } = useThree();
  const debrisFbo = useFBO(512, 512, { depthBuffer: true });
  const _mat = useRef(new THREE.Matrix4());
  const _pos = useRef(new THREE.Vector3());
  const _quat = useRef(new THREE.Quaternion());
  const _scl = useRef(new THREE.Vector3());

  useFrame((state) => {
    const inst = meshRef.current;
    if (!inst) return;

    const breakVal = useFractureStore.getState().breakVal;
    const elapsed = state.clock.elapsedTime;
    const pose = getCrystalPose();

    const visibility = smoothstep(0.08, 0.2, breakVal);
    inst.visible = visibility > 0.001;
    if (!inst.visible) return;

    // Shared transmission FBO
    inst.visible = false;
    state.gl.setRenderTarget(debrisFbo);
    state.gl.clear();
    state.gl.render(portalScene, portalCamera);
    state.gl.setRenderTarget(null);
    inst.visible = true;

    const physMat = inst.material as THREE.MeshPhysicalMaterial;
    if (physMat) {
      physMat.opacity = visibility;
      physMat.transparent = visibility < 1;
    }

    const driftFade = smoothstep(0.1, 0.4, breakVal);
    const explosionFade = 1 - smoothstep(0.3, 0.7, breakVal);
    const spreadDist = breakVal * 1.5 * explosionFade;

    for (let i = 0; i < chips.length; i++) {
      const c = chips[i];
      const t = elapsed;

      const dx = c.driftCenter.x + Math.sin(t * c.lissFreq.x + c.lissPhase.x) * c.lissAmp.x;
      const dy = c.driftCenter.y + Math.sin(t * c.lissFreq.y + c.lissPhase.y) * c.lissAmp.y;
      const dz = c.driftCenter.z + Math.sin(t * c.lissFreq.z + c.lissPhase.z) * c.lissAmp.z;

      _pos.current.set(
        c.origin.x + c.direction.x * spreadDist + driftFade * (dx - c.origin.x),
        c.origin.y + c.direction.y * spreadDist + driftFade * (dy - c.origin.y),
        c.origin.z + c.direction.z * spreadDist + driftFade * (dz - c.origin.z),
      );

      const tumbleAngle = driftFade * (breakVal * Math.PI * 0.5 + t * c.tumbleSpeed);
      _quat.current.setFromAxisAngle(c.tumbleAxis, tumbleAngle);
      _scl.current.setScalar(c.scale);

      _mat.current.compose(_pos.current, _quat.current, _scl.current);
      inst.setMatrixAt(i, _mat.current);
    }
    inst.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[_chipGeo, undefined, CHIP_COUNT]}
      frustumCulled={false}
      visible={false}
    >
      <meshPhysicalMaterial
        color="#dde8f0"
        transmission={0.85}
        thickness={0.3}
        roughness={0.1}
        ior={1.3}
        transparent
        opacity={0}
        envMapIntensity={0.8}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
