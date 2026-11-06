"use client";

import { useRef, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import GlassCrystal from "@/components/crystal/GlassCrystal";

const HEADLINE = "Designing interfaces that breathe with life.";
const FONT_URL = "/fonts/inter-tight-bold.ttf";
const TILE_COUNT = 3;

function MarqueeText() {
  const groupRef = useRef<THREE.Group>(null);
  const firstTextRef = useRef<THREE.Mesh>(null);
  const offsetRef = useRef(0);
  const tileWidthRef = useRef(0);
  const { camera, size } = useThree();

  const cam = camera as THREE.PerspectiveCamera;
  const fovRad = (cam.fov / 2) * (Math.PI / 180);
  const visHeight = 2 * cam.position.z * Math.tan(fovRad);
  const visWidth = visHeight * (size.width / size.height);

  const fontSize = visHeight * 0.2;

  const measureTile = useCallback(() => {
    const mesh = firstTextRef.current as unknown as {
      geometry: THREE.BufferGeometry;
    };
    if (!mesh?.geometry) return;
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (bb && bb.max.x - bb.min.x > 0.1) {
      tileWidthRef.current = bb.max.x - bb.min.x;
    }
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (tileWidthRef.current === 0) {
      measureTile();
      return;
    }

    const tw = tileWidthRef.current;
    const speed = visWidth * 0.03;
    offsetRef.current -= speed * delta;
    offsetRef.current = ((offsetRef.current % tw) + tw) % tw;

    const children = groupRef.current.children;
    for (let i = 0; i < children.length; i++) {
      children[i].position.x = offsetRef.current + i * tw - tw;
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: TILE_COUNT }, (_, i) => (
        <Text
          key={i}
          ref={i === 0 ? firstTextRef : undefined}
          font={FONT_URL}
          fontSize={fontSize}
          letterSpacing={-0.04}
          color="#1a1a1e"
          anchorX="left"
          anchorY="middle"
          onSync={i === 0 ? measureTile : undefined}
        >
          {HEADLINE + "  "}
        </Text>
      ))}
    </group>
  );
}

function LabCrystal({ seed, position }: { seed: number; position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.y = t * 0.15;
    groupRef.current.rotation.x = Math.sin(t * 0.1) * 0.2;
  });

  return (
    <group position={position}>
      <GlassCrystal ref={groupRef} seed={seed} />
    </group>
  );
}

const VARIANTS: { seed: number; label: string }[] = [
  { seed: 3131, label: "A" },
  { seed: 7654, label: "B" },
  { seed: 4209, label: "C" },
  { seed: 8888, label: "D" },
];

export default function LabCanvas() {
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "#E9E7E2",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 14], fov: 50 }}
        gl={{ antialias: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#E9E7E2"]} />
        <MarqueeText />
        {VARIANTS.map((v, i) => (
          <LabCrystal key={v.label} seed={v.seed} position={[(i - 1.5) * 4, 0, 0]} />
        ))}
        <Environment background={false} resolution={512}>
          <color attach="background" args={["#000000"]} />
          <Lightformer form="rect" intensity={3} position={[4, 5, -3]} scale={[4, 1, 1]} rotation-x={Math.PI / 4} color="#ffffff" />
          <Lightformer form="rect" intensity={2.5} position={[-5, 3, 2]} scale={[3, 0.6, 1]} rotation-y={Math.PI / 3} color="#ffffff" />
          <Lightformer form="rect" intensity={1.8} position={[0, -4, 4]} scale={[6, 0.8, 1]} color="#ffffff" />
          <Lightformer form="rect" intensity={0.1} position={[2, 0, -5]} scale={[8, 8, 1]} color="#111111" />
          <Lightformer form="rect" intensity={0.1} position={[-3, -2, 3]} scale={[6, 6, 1]} color="#0a0a0a" />
        </Environment>
      </Canvas>
    </div>
  );
}
