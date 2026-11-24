"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { damp } from "maath/easing";
import { SITE_DATA } from "@/content/site";
import { getSectionProgress, useScrollStore } from "@/store/useScrollStore";
import { patchVeilMaterial, updateVeil } from "./marqueeVeil";
import { introReveal } from "@/store/useIntroStore";
import { markHeroReady, warmObject } from "./warm";
import {
  TEXT_Z,
  VIS_HEIGHT,
  MOBILE_TEXT_Y,
  MOBILE_FONT_SHARE,
  DESKTOP_FONT_SHARE,
} from "./marqueeLayout";

const FREEZE = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("crystalfreeze");

const HEADLINE_TILE = `${SITE_DATA.hero.headlineLine1}  ${SITE_DATA.hero.headlineLine2}  ·  `;
// Subset of Inter Tight Bold (npm run gen:font): only what the headline can use
const FONT_URL = "/fonts/inter-tight-bold-subset.woff";

// Camera, plane and sizes: marqueeLayout.ts (the phone crystal reads them
// to stay above the type)

/**
 * Arrival: the line must look as if it had been running all along. It
 * stays invisible until the fonts are in, the tile width is known and
 * every tile has laid out and been placed. It then starts this fraction of
 * a tile in (mid-word at both edges, neither a tile boundary nor the
 * half-way point), at its steady speed, and fades in over FADE_IN_S while
 * it moves. Nothing is ever seen arriving, spreading or speeding up.
 */
const START_PHASE = 0.37;
const FADE_IN_S = 0.4;

/** document.fonts.ready, once per page (troika fetches FONT_URL itself;
 * this keeps the line back while the page's own fonts are still loading). */
let fontsReady = typeof document === "undefined" || !document.fonts;
if (!fontsReady) {
  document.fonts.ready.then(
    () => (fontsReady = true),
    () => (fontsReady = true),
  );
}

/** Ease-out: the type is there from the first frame and settles in (a
 * smoothstep spent its first 50 ms under one 8-bit step of contrast). */
const fadeCurve = (t: number) => 1 - (1 - t) * (1 - t);

/** Test hook, written every frame (window.__marqueeSpan). */
const span = { x0: 0, x1: 0, half: 0, speed: 0, fade: 0 };
if (typeof window !== "undefined") (window as unknown as { __marqueeSpan?: typeof span }).__marqueeSpan = span;

interface MarqueeProps {
  color: string;
  isMobile: boolean;
  reducedMotion: boolean;
  /** Writes the test hooks (__marqueeShownAt, __marqueeSpan): the WAKE line. */
  testHooks?: boolean;
}

export default function Marquee({ color, isMobile, reducedMotion, testHooks = false }: MarqueeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const tileRefs = useRef<(THREE.Mesh | null)[]>([]);
  const offsetRef = useRef(0);
  const tileWidthRef = useRef(0);
  /** Tiles troika has laid out (onSync), by index. */
  const syncedRef = useRef(new Set<number>());
  /** Arrival: placed once (phase set), then the fade-in, 0..1. */
  const arrivalRef = useRef({ placed: false, shown: 0 });
  const dampState = useRef({ vel: 0 });
  const { size, camera, gl, scene } = useThree();

  const visHeight = VIS_HEIGHT;
  const visWidth = visHeight * (size.width / size.height);
  const fontSize = visHeight * (isMobile ? MOBILE_FONT_SHARE : DESKTOP_FONT_SHARE);

  const [tileCount, setTileCount] = useState(6);

  const measureTile = useCallback(() => {
    // Test hook (scripts/perf/slow.mjs): troika finished laying out the headline
    const tw = window as unknown as { __marqueeSyncedAt?: number };
    tw.__marqueeSyncedAt ??= performance.now();
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

  const onTileSync = useCallback(
    (i: number) => {
      syncedRef.current.add(i);
      if (i === 0 && !reducedMotion) measureTile();
    },
    [measureTile, reducedMotion],
  );

  // Recompute tile count on resize
  useEffect(() => {
    if (tileWidthRef.current > 0) {
      setTileCount(Math.ceil(visWidth / tileWidthRef.current) + 2);
    }
  }, [visWidth]);

  useFrame((_, rawDelta) => {
    updateVeil(camera, reducedMotion);
    const group = groupRef.current;
    if (!group) return;
    // A long frame (tab switch, a stall) must not jump the line
    const delta = Math.min(rawDelta, 0.1);
    const children = group.children;
    const a = arrivalRef.current;

    // Not placed yet: hidden until the fonts are in, the tile width is
    // known and every tile has laid out. Nothing can be seen stacked at
    // the centre or spreading out.
    if (!a.placed) {
      const want = reducedMotion ? 1 : tileCount;
      let ready = fontsReady && children.length === want && (reducedMotion || tileWidthRef.current > 0);
      for (let i = 0; ready && i < want; i++) if (!syncedRef.current.has(i)) ready = false;
      // ...and its program is linked (asked for here, ahead of the rest:
      // hidden, the warm-up would only pre-warm it), so the first visible
      // frame draws the type and the fade is never spent on nothing
      for (let i = 0; ready && i < want; i++) if (!warmObject(gl, children[i], scene, camera, { priority: 4 })) ready = false;
      if (!ready) {
        group.visible = false;
        return;
      }
      a.placed = true;
      markHeroReady();
      // Already some way along, as after a while of running
      offsetRef.current = START_PHASE * tileWidthRef.current;
    }

    // The hero timeline says when (introReveal); the fade is ours, over a
    // line that is already moving
    if (introReveal.marquee > 0 && a.shown < 1) {
      if (a.shown === 0 && testHooks) {
        // Test hook (scripts/perf/arrival.mjs, scripts/shot/marquee-arrival.mjs)
        (window as unknown as { __marqueeShownAt?: number }).__marqueeShownAt ??= performance.now();
      }
      a.shown = FREEZE ? 1 : Math.min(1, a.shown + delta / FADE_IN_S);
    }

    // Fully gone by heroScroll 0.5 (half a screen), before About heading
    // arrives. Hidden tiles skip drawing, but the offset below still
    // advances, so the line is already moving when it appears
    const heroScroll = Math.max(0, (getSectionProgress("top") - 0.5) / 0.5);
    group.visible = heroScroll < 0.5 && a.shown > 0;
    const fade = (1 - Math.min(heroScroll, 0.5) / 0.5) * fadeCurve(a.shown);

    // troika Text ignores material.opacity — must use fillOpacity
    for (let i = 0; i < children.length; i++) {
      const tile = children[i] as THREE.Mesh & { fillOpacity?: number; outlineOpacity?: number };
      tile.fillOpacity = fade;
      if (tile.outlineOpacity !== undefined) tile.outlineOpacity = fade;
    }

    if (reducedMotion) return;

    // Steady speed from the first frame: the scroll kick starts at zero,
    // so the base speed is all there is until the visitor scrolls
    const tw = tileWidthRef.current;
    const { velocity, direction } = useScrollStore.getState();
    damp(dampState.current, "vel", velocity * 0.0004, 0.4, delta);

    const baseSpeed = tw / 40;
    const scrollKick = dampState.current.vel * direction;
    const raw = baseSpeed + scrollKick;
    const speed = Math.sign(raw) * Math.min(Math.abs(raw), baseSpeed * 2.5);

    // Test hook: crystalfreeze pins the marquee too, so pixel comparisons
    // between two loads see the same type behind the crystal
    if (!FREEZE) offsetRef.current -= speed * delta;
    const totalWidth = tileCount * tw;
    offsetRef.current = ((offsetRef.current % totalWidth) + totalWidth) % totalWidth;

    // Laid out from one tile left of the viewport's left edge: tileCount
    // spans the view plus a tile either side, so no edge is ever empty
    const left = -visWidth / 2 - tw;
    let x0 = Infinity;
    let x1 = -Infinity;
    for (let i = 0; i < children.length; i++) {
      const x = ((i * tw + offsetRef.current) % totalWidth) + left;
      children[i].position.x = x;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x + tw);
    }
    // Test hook (scripts/shot/marquee-arrival.mjs): what the tiles span
    // against the view's half-width, in world units, and the speed
    if (testHooks) {
      span.x0 = x0;
      span.x1 = x1;
      span.half = visWidth / 2;
      span.speed = speed;
      span.fade = fade;
    }
  });

  const textY = isMobile ? MOBILE_TEXT_Y : 0;

  if (reducedMotion) {
    return (
      <group ref={groupRef} position={[0, textY, TEXT_Z]} visible={false}>
        <Text
          font={FONT_URL}
          fontSize={fontSize}
          letterSpacing={-0.04}
          color={color}
          anchorX="center"
          anchorY="middle"
          onSync={() => onTileSync(0)}
        >
          {SITE_DATA.hero.headlineLine1}
          <meshBasicMaterial ref={patchVeilMaterial} transparent />
        </Text>
      </group>
    );
  }

  return (
    <group ref={groupRef} position={[0, textY, TEXT_Z]} visible={false}>
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
          onSync={() => onTileSync(i)}
        >
          {HEADLINE_TILE}
          <meshBasicMaterial ref={patchVeilMaterial} transparent />
        </Text>
      ))}
    </group>
  );
}
