"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { damp } from "maath/easing";
import { SITE_DATA } from "@/content/site";
import { getSectionProgress, useScrollStore } from "@/store/useScrollStore";

const HEADLINE_TILE = `${SITE_DATA.hero.headlineLine1}  ${SITE_DATA.hero.headlineLine2}  ·  `;
const FONT_URL = "/fonts/inter-tight-bold.ttf";

const FBO_HALF_FOV_RAD = (50 / 2) * (Math.PI / 180);
const FBO_CAM_Z = 6;
const TEXT_Z = -3;
const CAM_TO_TEXT = FBO_CAM_Z - TEXT_Z;

interface MarqueeProps {
  color: string;
  isMobile: boolean;
  reducedMotion: boolean;
}

export default function Marquee({ color, isMobile, reducedMotion }: MarqueeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const tileRefs = useRef<(THREE.Mesh | null)[]>([]);
  const offsetRef = useRef(0);
  const tileWidthRef = useRef(0);
  const dampState = useRef({ vel: 0 });
  const { size } = useThree();

  const visHeight = 2 * CAM_TO_TEXT * Math.tan(FBO_HALF_FOV_RAD);
  const visWidth = visHeight * (size.width / size.height);
  const fontSize = isMobile ? visHeight * 0.14 : visHeight * 0.22;

  const [tileCount, setTileCount] = useState(6);

  const measureTile = useCallback(() => {
    const mesh = tileRefs.current[0] as unknown as {
      textRenderInfo?: { blockBounds?: [number, number, number, number] };
      geometry: THREE.BufferGeometry;
    };
    if (!mesh) return;

    // Prefer troika textRenderInfo.blockBounds for accurate advance width
    const info = mesh.textRenderInfo;
    if (info?.blockBounds) {
      const [x0, , x1] = info.blockBounds;
      const w = x1 - x0;
      if (w > 0.1) {
        tileWidthRef.current = w;
        setTileCount(Math.ceil(visWidth / w) + 2);
        return;
      }
    }

    // Fallback to geometry bbox
    if (mesh.geometry) {
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox;
      if (bb && bb.max.x - bb.min.x > 0.1) {
        tileWidthRef.current = bb.max.x - bb.min.x;
        setTileCount(Math.ceil(visWidth / tileWidthRef.current) + 2);
      }
    }
  }, [visWidth]);

  // Recompute tile count on resize
  useEffect(() => {
    if (tileWidthRef.current > 0) {
      setTileCount(Math.ceil(visWidth / tileWidthRef.current) + 2);
    }
  }, [visWidth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const heroP = getSectionProgress("top");
    if (heroP >= 1) {
      groupRef.current.visible = false;
      return;
    }

    const heroScroll = Math.max(0, (heroP - 0.5) / 0.5);
    const fade = heroScroll < 0.2 ? 1 : 1 - (heroScroll - 0.2) / 0.8;

    if (fade <= 0.001) {
      groupRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;

    // No vertical motion — pinned at resting y. Only fade opacity.
    const fading = fade < 0.999;
    const children = groupRef.current.children;
    for (let i = 0; i < children.length; i++) {
      const mat = (children[i] as THREE.Mesh).material as THREE.Material & {
        opacity: number;
      };
      if (mat) {
        mat.transparent = fading;
        mat.opacity = fade;
      }
    }

    if (reducedMotion) return;

    const tw = tileWidthRef.current;
    if (tw === 0) {
      measureTile();
      return;
    }

    const { velocity, direction } = useScrollStore.getState();
    damp(dampState.current, "vel", velocity * 0.0004, 0.4, delta);

    const baseSpeed = tw / 40;
    const scrollKick = dampState.current.vel * direction;
    const raw = baseSpeed + scrollKick;
    const speed = Math.sign(raw) * Math.min(Math.abs(raw), baseSpeed * 2.5);

    offsetRef.current -= speed * delta;
    const totalWidth = tileCount * tw;
    offsetRef.current = ((offsetRef.current % totalWidth) + totalWidth) % totalWidth;

    for (let i = 0; i < children.length; i++) {
      children[i].position.x = ((i * tw + offsetRef.current) % totalWidth) - tw;
    }
  });

  if (reducedMotion) {
    return (
      <group position={[0, 0, TEXT_Z]}>
        <Text
          font={FONT_URL}
          fontSize={fontSize}
          letterSpacing={-0.04}
          color={color}
          anchorX="center"
          anchorY="middle"
          onSync={(troika: any) => {
            if (troika.material) {
              troika.material.transparent = false;
              troika.material.alphaTest = 0.5;
            }
          }}
        >
          {SITE_DATA.hero.headlineLine1}
        </Text>
      </group>
    );
  }

  return (
    <group ref={groupRef} position={[0, 0, TEXT_Z]}>
      {Array.from({ length: tileCount }, (_, i) => (
        <Text
          key={i}
          ref={(el) => { tileRefs.current[i] = el as unknown as THREE.Mesh; }}
          font={FONT_URL}
          fontSize={fontSize}
          letterSpacing={-0.04}
          color={color}
          anchorX="left"
          anchorY="middle"
          onSync={i === 0 ? measureTile : undefined}
        >
          {HEADLINE_TILE}
        </Text>
      ))}
    </group>
  );
}
