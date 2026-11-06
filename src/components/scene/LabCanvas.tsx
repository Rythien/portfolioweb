"use client";

import { useRef, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, MeshTransmissionMaterial, Environment } from "@react-three/drei";
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

/* ── 3D value noise for crystal displacement ─────────────────── */

function hash(n: number) {
  const s = Math.sin(n) * 43758.5453;
  return s - Math.floor(s);
}

function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const fx = x - ix,
    fy = y - iy,
    fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const n = ix + iy * 157 + iz * 113;
  return (
    hash(n) * (1 - ux) * (1 - uy) * (1 - uz) +
    hash(n + 1) * ux * (1 - uy) * (1 - uz) +
    hash(n + 157) * (1 - ux) * uy * (1 - uz) +
    hash(n + 158) * ux * uy * (1 - uz) +
    hash(n + 113) * (1 - ux) * (1 - uy) * uz +
    hash(n + 114) * ux * (1 - uy) * uz +
    hash(n + 270) * (1 - ux) * uy * uz +
    hash(n + 271) * ux * uy * uz
  );
}

/* ── Displaced icosahedron geometry (detail 5, icy look) ─────── */

function useCrystalGeometry() {
  return useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1.4, 5);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const dir = v.clone().normalize();
      const n1 = noise3(dir.x * 1.8, dir.y * 1.8, dir.z * 1.8);
      const raw = noise3(
        dir.x * 4.5 + 7.3,
        dir.y * 4.5 + 3.1,
        dir.z * 4.5 + 1.7
      );
      const ridged = 1 - Math.abs(raw * 2 - 1);
      const displacement = (n1 - 0.5) * 0.35 + ridged * 0.12;
      v.copy(dir).multiplyScalar(1.4 + displacement);
      pos.setXYZ(i, v.x, v.y, v.z);
    }

    geo.computeVertexNormals();
    return geo;
  }, []);
}

/* ── Crystal mesh ─────────────────────────────────────────────── */

function LabCrystal() {
  const meshRef = useRef<THREE.Mesh>(null);
  const geo = useCrystalGeometry();

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.rotation.y = t * 0.15;
    meshRef.current.rotation.x = Math.sin(t * 0.1) * 0.2;
  });

  return (
    <mesh ref={meshRef} geometry={geo} position={[0, 0, 0]}>
      <MeshTransmissionMaterial
        thickness={2.0}
        chromaticAberration={0.4}
        anisotropicBlur={0.3}
        roughness={0.08}
        distortion={0.3}
        distortionScale={0.25}
        temporalDistortion={0.08}
        transmission={1}
        ior={1.3}
        samples={8}
        resolution={1024}
        color="#f0f4fa"
        backside
        backsideThickness={0.6}
      />
    </mesh>
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
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <MarqueeText />
        <LabCrystal />
        <Environment preset="studio" />
      </Canvas>
    </div>
  );
}
