"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import ArchiveScene from "./ArchiveScene";
import { FLIGHT_KEYS, createInput, setPointer, type InputState } from "./input";
import { TimerClock, muteClockDeprecationUntilSwapped } from "@/components/scene/timerClock";

interface ArchiveProps {
  /** True while fading off on the way back to WAKE. */
  leaving: boolean;
  /** Back to the awake page; origin is where the flood retracts from. */
  onWake: (origin: { x: number; y: number }) => void;
}

const HINT_KEY = "archive-hint-seen";

export default function Archive({ leaving, onWake }: ArchiveProps) {
  const inputRef = useRef<InputState>(createInput());
  // Armed before the Canvas builds its store; released in onCreated
  const [restoreConsole] = useState(() => (typeof window !== "undefined" ? muteClockDeprecationUntilSwapped() : null));
  const stageRef = useRef<HTMLDivElement>(null);
  const wakeRef = useRef<HTMLButtonElement>(null);
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [lowPower] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [hint, setHint] = useState(() => {
    try {
      return sessionStorage.getItem(HINT_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const wakeFn = useRef(onWake);
  useEffect(() => {
    wakeFn.current = onWake;
  }, [onWake]);

  /** Wake from the control, so the flood retracts from where it sits. */
  const wakeFromButton = () => {
    const r = wakeRef.current?.getBoundingClientRect();
    wakeFn.current(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth - 40, y: 40 });
  };

  // The stage takes focus so the keyboard flies straight away
  useEffect(() => {
    stageRef.current?.focus({ preventScroll: true });
  }, []);

  // Keyboard: flight keys held in a set; Esc wakes
  useEffect(() => {
    const input = inputRef.current;
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        const r = wakeRef.current?.getBoundingClientRect();
        wakeFn.current(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth - 40, y: 40 });
        return;
      }
      if (e.target instanceof HTMLButtonElement) return;
      if (FLIGHT_KEYS.has(e.code)) {
        e.preventDefault();
        input.keys.add(e.code);
        input.moved = true;
      }
    };
    const up = (e: KeyboardEvent) => input.keys.delete(e.code);
    const clear = () => {
      input.keys.clear();
      input.held = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, []);

  // Hint fades a few seconds after the first real move
  useEffect(() => {
    if (!hint) return;
    const input = inputRef.current;
    let t = 0;
    const id = window.setInterval(() => {
      if (!input.moved) return;
      if (!t) t = performance.now();
      if (performance.now() - t > 3500) {
        setHint(false);
        try {
          sessionStorage.setItem(HINT_KEY, "1");
        } catch {}
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [hint]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const input = inputRef.current;
    setPointer(input, e.currentTarget, e.clientX, e.clientY);
    input.held = true;
    input.moved = true;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    setPointer(inputRef.current, e.currentTarget, e.clientX, e.clientY);
  };
  const onPointerUp = () => {
    inputRef.current.held = false;
  };

  return createPortal(
    <div
      className="archive-root fixed inset-0 z-[2000] overflow-hidden bg-[#07062B] text-[#ece8ff]"
      style={{ opacity: leaving ? 0 : 1, transition: "opacity 450ms ease-out" }}
    >
      <div
        ref={stageRef}
        tabIndex={0}
        role="application"
        aria-roledescription="game"
        aria-label="The Archive. Free float through a violet void. Hold the pointer to drift toward it, or use W A S D to move, arrow keys to look, Q and E for down and up. Escape returns to the awake page."
        className="archive-stage absolute inset-0 outline-none"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <Canvas
          dpr={lowPower ? [1, 1.25] : [1, 1.5]}
          camera={{ fov: 62, near: 0.1, far: 600, position: [0, 0, 18] }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={(state) => {
            state.set({ clock: new TimerClock() as unknown as THREE.Clock });
            restoreConsole?.();
          }}
          className="archive-canvas"
        >
          <ArchiveScene input={inputRef} reduced={reduced} lowPower={lowPower} />
        </Canvas>
        {/* Soft vignette: the void closes in at the edges */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(4,2,20,0.55) 100%)" }}
        />
      </div>

      <button
        ref={wakeRef}
        type="button"
        onClick={wakeFromButton}
        aria-label="Wake: return to the portfolio"
        className="pressable absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] min-h-11 rounded-full border border-white/25 bg-white/5 px-4 font-mono text-label uppercase tracking-[0.16em] text-white/85 backdrop-blur-md transition-colors hover:border-white/60 hover:text-white focus-visible:outline-offset-4"
      >
        Wake
      </button>

      {hint && (
        <p
          aria-hidden="true"
          className="archive-hint pointer-events-none absolute bottom-[max(2rem,calc(env(safe-area-inset-bottom)+1rem))] left-1/2 w-[min(92vw,52rem)] -translate-x-1/2 text-center font-mono text-label uppercase leading-relaxed tracking-[0.14em] text-white/70"
        >
          <span className="max-md:hidden">Hold to drift toward the pointer · W A S D move · arrows look · Q E sink / rise</span>
          <span className="md:hidden">Touch and hold to drift toward your finger</span>
        </p>
      )}
    </div>,
    document.body,
  );
}
