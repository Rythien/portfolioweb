"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/useGameStore";

interface DescentProps {
  /** Called with the run's score (metres) on every exit path. */
  onExit: (score?: number) => void;
}

export default function Descent({ onExit }: DescentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const exitRef = useRef(onExit);
  useEffect(() => {
    exitRef.current = onExit;
  }, [onExit]);

  // Page lifecycle: scene/Lenis follow the store; here the scroll lock
  // and the cursor swap, restored on unmount whatever closed the game
  useEffect(() => {
    useGameStore.getState().setOpen(true);
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    html.classList.add("descent-open");
    return () => {
      html.style.overflow = prevOverflow;
      document.body.style.overflow = prevBodyOverflow;
      html.classList.remove("descent-open");
      useGameStore.getState().setOpen(false);
    };
  }, []);

  // Pause on blur / hidden tab; Esc exits
  useEffect(() => {
    const pause = () => {
      pausedRef.current = true;
      setPaused(true);
    };
    const onVis = () => document.hidden && pause();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        exitRef.current();
      }
    };
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Placeholder frame until the engine lands
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    c.width = 320;
    c.height = 568;
    const g = ctx.createLinearGradient(0, 0, 0, 568);
    g.addColorStop(0, "#07062B");
    g.addColorStop(1, "#1a1050");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 320, 568);
  }, []);

  return (
    <div
      className="descent-overlay fixed inset-0 z-[300] flex items-center justify-center bg-[#030214]"
      role="dialog"
      aria-modal="true"
      aria-label="DESCENT"
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label="DESCENT game canvas"
        className="h-full max-h-[100dvh] [image-rendering:pixelated]"
        style={{ aspectRatio: "320 / 568" }}
      />
      {paused && <p className="sr-only" aria-live="polite">Paused</p>}
      <button
        type="button"
        onClick={() => exitRef.current()}
        aria-label="Exit the game"
        className="absolute right-3 top-3 grid h-11 w-11 place-items-center font-mono text-[#e4dcff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8f7bff]"
      >
        X
      </button>
    </div>
  );
}
