"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useThemeStore, type Mode } from "@/store/useThemeStore";

const SURFACE: Record<Mode, string> = {
  wake: "#E9E7E2",
  dream: "#07062B",
};

const DURATION = 1400;
const MIDPOINT = 0.45;

function subscribeWebGL(cb: () => void) {
  window.addEventListener("webglcontextlost", cb);
  return () => window.removeEventListener("webglcontextlost", cb);
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function CircleReveal() {
  const transitioning = useThemeStore((s) => s.transitioning);
  const clickOrigin = useThemeStore((s) => s.clickOrigin);
  const mode = useThemeStore((s) => s.mode);
  const endTransition = useThemeStore((s) => s.endTransition);
  const setMode = useThemeStore((s) => s.setMode);

  const webglAvailable = useSyncExternalStore(subscribeWebGL, hasWebGL, () => true);

  const overlayRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const targetModeRef = useRef<Mode>("dream");
  const themeSwitchedRef = useRef(false);
  const animateRef = useRef<((now: number) => void) | null>(null);

  useEffect(() => {
    animateRef.current = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const t = Math.min(elapsed / DURATION, 1);

      if (!themeSwitchedRef.current && t >= MIDPOINT) {
        themeSwitchedRef.current = true;
        setMode(targetModeRef.current);
      }

      if (overlayRef.current && clickOrigin) {
        const maxR = Math.hypot(
          Math.max(clickOrigin.x, window.innerWidth - clickOrigin.x),
          Math.max(clickOrigin.y, window.innerHeight - clickOrigin.y)
        );
        const eased = 1 - Math.pow(1 - t, 3);
        const r = eased * maxR * 1.15;

        overlayRef.current.style.clipPath = `circle(${r}px at ${clickOrigin.x}px ${clickOrigin.y}px)`;
        overlayRef.current.style.opacity = t < 0.85 ? "1" : `${1 - (t - 0.85) / 0.15}`;
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame((ts) => animateRef.current?.(ts));
      } else {
        endTransition();
      }
    };
  }, [clickOrigin, endTransition, setMode]);

  useEffect(() => {
    // Only activate if WebGL is NOT available (shader handles it otherwise)
    if (!transitioning || !clickOrigin || webglAvailable) return;

    targetModeRef.current = mode === "wake" ? "dream" : "wake";
    themeSwitchedRef.current = false;
    startTimeRef.current = performance.now();

    if (overlayRef.current) {
      overlayRef.current.style.backgroundColor = SURFACE[targetModeRef.current];
      overlayRef.current.style.clipPath = `circle(0px at ${clickOrigin.x}px ${clickOrigin.y}px)`;
      overlayRef.current.style.opacity = "1";
    }

    rafRef.current = requestAnimationFrame((ts) => animateRef.current?.(ts));

    return () => cancelAnimationFrame(rafRef.current);
  }, [transitioning, clickOrigin, mode, webglAvailable]);

  // Only render when WebGL is NOT available
  if (webglAvailable || !transitioning) return null;

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="fixed inset-0 z-[999] pointer-events-none"
      style={{ clipPath: "circle(0px at 50% 50%)" }}
    />
  );
}
