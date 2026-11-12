"use client";

import { useSyncExternalStore, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import Compositor from "./Compositor";
import CrystalCursor from "@/components/crystal/CrystalCursor";
import { SITE_DATA } from "@/content/site";

/* ── External store subscriptions ─────────────────────────────── */

function subscribeMotion(cb: () => void) {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}
function getMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeWidth(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}
function getWidthSnapshot() {
  return window.innerWidth;
}

function subscribeWebGL(cb: () => void) {
  window.addEventListener("webglcontextlost", cb);
  return () => window.removeEventListener("webglcontextlost", cb);
}
function getWebGLSnapshot() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/* ── Fallback ─────────────────────────────────────────────────── */

function SceneFallback() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden"
    >
      <div className="relative">
        <h1 className="font-[family-name:var(--font-sans)] text-[clamp(3rem,8vw,8rem)] font-bold tracking-[-0.04em] text-ink/10 whitespace-nowrap select-none leading-none">
          {SITE_DATA.hero.headlineLine1}
        </h1>
        <div className="absolute inset-0 bg-gradient-to-b from-surface/0 via-surface/60 to-surface" />
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────── */

export default function SceneRoot() {
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    getMotionSnapshot,
    () => false
  );
  const width = useSyncExternalStore(
    subscribeWidth,
    getWidthSnapshot,
    () => 1440
  );
  const isMobile = width < 768;
  const webgl = useSyncExternalStore(
    subscribeWebGL,
    getWebGLSnapshot,
    () => true
  );

  const canvasRef = useRef<RootState | null>(null);

  // Pause rendering when tab is hidden
  useEffect(() => {
    const onVisibility = () => {
      const state = canvasRef.current;
      if (!state) return;
      if (document.hidden) {
        state.setFrameloop("never");
      } else if (!reducedMotion) {
        state.setFrameloop("always");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [reducedMotion]);

  if (!webgl) return <SceneFallback />;

  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none">
      <CrystalCursor />
      <Canvas
        dpr={[1, 1.5]}
        orthographic
        camera={{ left: -1, right: 1, top: 1, bottom: -1, near: 0, far: 1 }}
        gl={{
          alpha: true,
          antialias: false,
          powerPreference: "high-performance",
        }}
        style={{ position: "absolute", inset: 0 }}
        frameloop={reducedMotion ? "demand" : "always"}
        onCreated={(state) => {
          canvasRef.current = state;
        }}
      >
        <Compositor reducedMotion={reducedMotion} isMobile={isMobile} />
      </Canvas>
    </div>
  );
}
