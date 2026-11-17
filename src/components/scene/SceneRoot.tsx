"use client";

import { useSyncExternalStore, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import * as THREE from "three";
import Compositor from "./Compositor";
import CrystalCursor from "@/components/crystal/CrystalCursor";
import { SITE_DATA } from "@/content/site";
import { TimerClock, muteClockDeprecationUntilSwapped } from "./timerClock";
import { exposePrograms } from "./programHook";
import { guardScene, probeProfile, setPhasePaused } from "./warm";
import { useArchiveStore } from "@/store/useArchiveStore";

// Armed before the Canvas builds its store; released in onCreated
let restoreConsole: (() => void) | null =
  typeof window !== "undefined" ? muteClockDeprecationUntilSwapped() : null;

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
  // Archive open: the scene stops rendering and is hidden (the marquee is
  // drawn inside this canvas, so hiding the canvas hides the marquee)
  const archiveOpen = useArchiveStore((s) => s.open);

  // Pause rendering when the tab is hidden or the Archive is open
  useEffect(() => {
    const apply = () => {
      const state = canvasRef.current;
      if (!state) return;
      // The page's shader warm-up pauses with it (scene/warm.ts)
      setPhasePaused("page", useArchiveStore.getState().open);
      if (document.hidden || useArchiveStore.getState().open) {
        state.setFrameloop("never");
      } else {
        state.setFrameloop(reducedMotion ? "demand" : "always");
        state.invalidate();
      }
    };
    apply();
    document.addEventListener("visibilitychange", apply);
    const unsub = useArchiveStore.subscribe((s, prev) => {
      if (s.open !== prev.open) apply();
    });
    // Reduced motion renders on demand: scrolling must ask for a frame,
    // or the crystal never swaps to its parked pose (or fades with Works)
    const onScroll = () => canvasRef.current?.invalidate();
    if (reducedMotion) window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("visibilitychange", apply);
      window.removeEventListener("scroll", onScroll);
      unsub();
    };
  }, [reducedMotion]);

  if (!webgl) return <SceneFallback />;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none"
      style={archiveOpen ? { visibility: "hidden" } : undefined}
    >
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
          exposePrograms("page", state.gl);
          // First program of the session: the fill-rate probe that picks
          // the profile; then the composite quad, guarded like every scene
          probeProfile(state.gl);
          guardScene(state.scene, state.gl, { phase: "page", priority: () => 9 });
          if (useArchiveStore.getState().open) state.setFrameloop("never");
          // Frame timing on THREE.Timer instead of the deprecated Clock
          state.set({ clock: new TimerClock() as unknown as THREE.Clock });
          restoreConsole?.();
          restoreConsole = null;
        }}
      >
        <Compositor reducedMotion={reducedMotion} isMobile={isMobile} />
      </Canvas>
    </div>
  );
}
