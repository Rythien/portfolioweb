"use client";

import { useRef, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

const HEADLINE = "Designing interfaces that breathe with life.";
const FONT_URL = "/fonts/inter-tight-bold.ttf";
const TILE_COUNT = 3;

function MarqueeText() {
  const groupRef = useRef<THREE.Group>(null);
  const firstTextRef = useRef<THREE.Mesh>(null);
  const offsetRef = useRef(0);
  const tileWidthRef = useRef(0);
  const { camera, size } = useThree();

  // Compute visible width at z=0 from perspective camera
  const cam = camera as THREE.PerspectiveCamera;
  const fovRad = (cam.fov / 2) * (Math.PI / 180);
  const visHeight = 2 * cam.position.z * Math.tan(fovRad);
  const visWidth = visHeight * (size.width / size.height);

  // Font size: ~20% of visible height for big bold text
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

    // Speed: 0.03 * visible width per second
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
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ antialias: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#E9E7E2"]} />
        <MarqueeText />
      </Canvas>
    </div>
  );
}
