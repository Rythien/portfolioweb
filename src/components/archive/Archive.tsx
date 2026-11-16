"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import ArchiveScene from "./ArchiveScene";
import { FIRE_KEYS, FLIGHT_KEYS, TAP_MS, TAP_PX, createInput, setPointer, type InputState } from "./input";
import { createArchiveState, createHudEls, type ArchiveState, type HudEls } from "./archiveState";
import { useArchiveProgress } from "@/store/useArchiveProgress";

/** SVG arc path on a circle of radius r from angle a0 to a1 (degrees, 0 = right, clockwise). */
function arc(r: number, a0: number, a1: number): string {
  const p = (a: number) => [r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180)].map((v) => v.toFixed(2)).join(" ");
  return `M ${p(a0)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`;
}
import { TimerClock, muteClockDeprecationUntilSwapped } from "@/components/scene/timerClock";
import { exposePrograms } from "@/components/scene/programHook";
import { getGfxProfile, guardScene, prewarmScene, useGfxProfile, whenSettled } from "@/components/scene/warm";

interface ArchiveProps {
  /** The slot writes the flood-tracking clip-path straight onto this. */
  rootRef: React.RefObject<HTMLDivElement | null>;
  /** Any part on screen: render every frame. Otherwise it sleeps, warm. */
  active: boolean;
  /** Fully open (flood settled): input, focus and the hint are live. */
  open: boolean;
  /** Back to the awake page; origin is where the flood retracts from. */
  onWake: (origin: { x: number; y: number }, opts?: { to?: "contact" }) => void;
}


/**
 * The Archive's scene is guarded like the page's (scene/warm.ts): anything
 * whose program is not linked yet draws as a stand-in (lit materials) or
 * not at all (custom shaders: the void's own colour shows), and is compiled
 * in the background, one program at a time, never blocking a frame. What
 * the Archive draws goes first while it is on screen (priority 5); hidden
 * things are pre-warmed at the back of the queue, on the full profile only.
 * window.__archiveWarmMs is set once nothing of the Archive is left to link.
 */
function ArchiveWarm({ activeRef }: { activeRef: React.RefObject<boolean> }) {
  const { gl, scene, camera, invalidate } = useThree();
  // Layout effect: guarded before the canvas's first frame
  useLayoutEffect(() => {
    const unguard = guardScene(scene, gl, { phase: "archive", priority: () => (activeRef.current ? 5 : 50) });
    let cancelSettle = () => {};
    // A beat later: the seals mount a render after the shared glass exists
    const t = window.setTimeout(() => {
      invalidate();
      if (getGfxProfile() === "full") {
        prewarmScene(scene, gl, { phase: "archive", priority: 50, kinds: ["screen", "fbo"], camera });
      }
      cancelSettle = whenSettled("archive", Infinity, () => {
        (window as unknown as { __archiveWarmMs?: number }).__archiveWarmMs = performance.now();
        invalidate();
      });
    }, 300);
    return () => {
      unguard();
      cancelSettle();
      window.clearTimeout(t);
    };
  }, [gl, scene, camera, invalidate, activeRef]);
  return null;
}

export default function Archive({ rootRef, active, open, onWake }: ArchiveProps) {
  const inputRef = useRef<InputState>(createInput());
  // Seals freed on an earlier visit arrive already open
  const [initialGame] = useState(() => {
    const p = useArchiveProgress.getState();
    p.hydrate();
    return createArchiveState(useArchiveProgress.getState().freed);
  });
  const gameRef = useRef<ArchiveState>(initialGame);
  const hudRef = useRef<HudEls>(createHudEls());
  // Armed before the Canvas builds its store; released in onCreated
  const [restoreConsole] = useState(() => (typeof window !== "undefined" ? muteClockDeprecationUntilSwapped() : null));
  /** On screen (any part): its programs jump the warm-up queue. */
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  const gfx = useGfxProfile();
  const stageRef = useRef<HTMLDivElement>(null);
  const wakeRef = useRef<HTMLButtonElement>(null);
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [lowPower] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  /** The full control list, behind the "?" in the corner. */
  const [help, setHelp] = useState(false);
  const helpRef = useRef(false);
  useEffect(() => {
    helpRef.current = help;
  }, [help]);
  // The one-line hint: first visit only (saved with the Archive progress)
  const [hint, setHint] = useState(() => !useArchiveProgress.getState().hintSeen);
  const wakeFn = useRef(onWake);
  useEffect(() => {
    wakeFn.current = onWake;
  }, [onWake]);

  /** Wake from the control, so the flood retracts from where it sits. */
  const wakeFromButton = () => {
    const r = wakeRef.current?.getBoundingClientRect();
    wakeFn.current(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth - 40, y: 40 });
  };

  // The ending's last beat: wake, at Contact, from the centre
  useEffect(() => {
    const exit = () => wakeFn.current({ x: innerWidth / 2, y: innerHeight / 2 }, { to: "contact" });
    window.addEventListener("archive-ending-exit", exit);
    return () => window.removeEventListener("archive-ending-exit", exit);
  }, []);

  // The stage takes focus once open, so the keyboard flies straight away
  useEffect(() => {
    if (open) stageRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Keyboard (open only): flight keys held in a set; Esc wakes
  useEffect(() => {
    if (!open) return;
    const input = inputRef.current;
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        // Esc closes the control list first; only then does it wake
        if (helpRef.current) {
          setHelp(false);
          return;
        }
        const r = wakeRef.current?.getBoundingClientRect();
        wakeFn.current(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth - 40, y: 40 });
        return;
      }
      if (e.target instanceof HTMLButtonElement) return;
      if (FIRE_KEYS.has(e.code)) {
        e.preventDefault();
        if (!e.repeat) input.fire = true;
        return;
      }
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
      clear();
    };
  }, [open]);

  // Hint fades a few seconds after the first real move
  useEffect(() => {
    if (!hint || !open) return;
    const input = inputRef.current;
    let t = 0;
    const id = window.setInterval(() => {
      if (!input.moved) return;
      if (!t) t = performance.now();
      if (performance.now() - t > 3500) {
        setHint(false);
        useArchiveProgress.getState().seeHint();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [hint, open]);

  /** Where and when the current press began, to tell a tap from a hold. */
  const press = useRef({ t: 0, x: 0, y: 0 });
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    press.current = { t: performance.now(), x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    const input = inputRef.current;
    setPointer(input, e.currentTarget, e.clientX, e.clientY);
    input.held = true;
    input.moved = true;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    setPointer(inputRef.current, e.currentTarget, e.clientX, e.clientY);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const input = inputRef.current;
    if (input.held && e.type === "pointerup") {
      const pr = press.current;
      // A quick tap that barely moved releases the pulse; a hold drifts
      if (performance.now() - pr.t < TAP_MS && Math.hypot(e.clientX - pr.x, e.clientY - pr.y) < TAP_PX) input.fire = true;
    }
    input.held = false;
  };

  return createPortal(
    <div
      ref={rootRef}
      className="archive-root fixed inset-0 z-[2000] overflow-hidden bg-[#07062B] text-[#ece8ff]"
      style={{ visibility: active ? "visible" : "hidden", pointerEvents: open ? "auto" : "none" }}
      aria-hidden={!open}
      inert={!open}
    >
      <div
        ref={stageRef}
        tabIndex={0}
        role="application"
        aria-roledescription="game"
        aria-label="The Archive. Free float through a violet void. Hold the pointer to drift toward it, or use W A S D to move, arrow keys to look, Q and E for down and up. Fly through light motes to charge; with three, tap or press Space or F to release a pulse at a seal's lit facet. Escape returns to the awake page."
        className="archive-stage absolute inset-0 outline-none"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <Canvas
          // 1.25 cap in the Archive (the awake page keeps 1.5): full-screen
          // fog, transmission and the seals' backdrop all scale with it.
          // 1.0 on the reduced profile (slow renderer, scene/warm.ts)
          dpr={[1, gfx === "reduced" ? 1 : 1.25]}
          camera={{ fov: 62, near: 0.1, far: 600, position: [0, 0, 18] }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          frameloop={active ? "always" : "demand"}
          onCreated={(state) => {
            exposePrograms("archive", state.gl);
            state.set({ clock: new TimerClock() as unknown as THREE.Clock });
            restoreConsole?.();
          }}
          className="archive-canvas"
        >
          <ArchiveScene input={inputRef} reduced={reduced} lowPower={lowPower} game={gameRef} hud={hudRef} />
          <ArchiveWarm activeRef={activeRef} />
        </Canvas>
        {/* Soft vignette: the void closes in at the edges */}
        <div
          ref={(el) => { hudRef.current.vignette = el; }}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(4,2,20,0.55) 100%)" }}
        />
      </div>

      {/* HUD: compass arc toward the nearest unfreed seal; reticle whose
          three segments fill with charge */}
      <div aria-hidden="true" className="archive-hud pointer-events-none absolute inset-0 grid place-items-center">
        <svg viewBox="-100 -100 200 200" className="absolute size-[min(62vmin,32rem)] overflow-visible">
          <g ref={(el) => { hudRef.current.compass = el; }} style={{ transition: "opacity 400ms ease-out" }}>
            <path d={arc(88, -13, 13)} stroke="#f4efff" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            <path d="M 92 0 L 86.5 -3.4 L 86.5 3.4 Z" fill="#f4efff" />
          </g>
        </svg>
        <svg
          ref={(el) => { hudRef.current.reticle = el; }}
          viewBox="-20 -20 40 40"
          className="absolute size-14 overflow-visible"
        >
          <circle r="1.4" fill="#f4efff" opacity="0.9" />
          {/* Lights when the pulse is ready */}
          <circle
            ref={(el) => { hudRef.current.ready = el; }}
            r="16"
            fill="none"
            stroke="#ffe2a0"
            strokeWidth="0.8"
            style={{ opacity: 0, transition: "opacity 250ms ease-out", filter: "drop-shadow(0 0 3px #ffd98a)" }}
          />
        </svg>
      </div>

      {/* Progress, top centre */}
      <p
        aria-live="polite"
        className="archive-count archive-hud-item pointer-events-none absolute left-1/2 top-[max(1.4rem,calc(env(safe-area-inset-top)+0.9rem))] -translate-x-1/2 whitespace-nowrap font-mono text-label uppercase tracking-[0.2em] text-white/80"
      >
        Projects recovered <span ref={(el) => { hudRef.current.count = el; }} className="tabular-nums text-white">{initialGame.seals.filter((s) => s.freed).length}</span> / 3
      </p>

      {/* Charge, bottom left: one diamond per mote, then PULSE READY */}
      <div
        ref={(el) => { hudRef.current.motes = el; }}
        aria-hidden="true"
        className="archive-hud-item pointer-events-none absolute bottom-[max(1.6rem,calc(env(safe-area-inset-bottom)+1.1rem))] left-[max(1.25rem,env(safe-area-inset-left))] flex items-center gap-3 font-mono text-label uppercase tracking-[0.2em]"
      >
        <svg viewBox="0 0 46 14" className="h-3.5 w-[2.9rem] overflow-visible">
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              ref={(el) => { hudRef.current.diamonds[i] = el; }}
              d={`M ${7 + i * 16} 1 L ${13 + i * 16} 7 L ${7 + i * 16} 13 L ${1 + i * 16} 7 Z`}
              stroke="#fff3c4"
              strokeWidth="1.2"
              strokeLinejoin="round"
              fill="#fff3c4"
              fillOpacity="0"
              style={{ transition: "fill-opacity 200ms ease-out" }}
            />
          ))}
        </svg>
        <span
          ref={(el) => { hudRef.current.readyLabel = el; }}
          className="text-[#ffe2a0]"
          style={{ opacity: 0, transition: "opacity 250ms ease-out", textShadow: "0 0 8px rgba(255,217,138,0.6)" }}
        >
          Pulse ready
        </span>
      </div>

      <button
        ref={wakeRef}
        type="button"
        onClick={wakeFromButton}
        aria-label="Wake: return to the portfolio"
        className="archive-chrome pressable absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] min-h-11 rounded-full border border-white/25 bg-white/5 px-4 font-mono text-label uppercase tracking-[0.16em] text-white/85 backdrop-blur-md transition-colors hover:border-white/60 hover:text-white focus-visible:outline-offset-4"
      >
        Wake
      </button>

      {/* The ending's one line, over the pale fog */}
      <p
        ref={(el) => { hudRef.current.endLine = el; }}
        data-on="0"
        data-text="The archive is yours."
        aria-live="polite"
        className="archive-end pointer-events-none absolute inset-x-0 top-[72%] text-center font-[family-name:var(--font-display)] text-[clamp(2rem,4.2vw,3.75rem)] italic leading-tight text-[#1d0f45] opacity-0 transition-opacity duration-[1600ms] ease-out data-[on=1]:opacity-100"
      />

      {hint && (
        <p
          aria-hidden="true"
          className="archive-hint archive-hud-item pointer-events-none absolute bottom-[max(2rem,calc(env(safe-area-inset-bottom)+1rem))] left-1/2 -translate-x-1/2 whitespace-nowrap text-center font-mono text-label uppercase tracking-[0.2em] text-white/70"
        >
          Drift toward the light
        </p>
      )}

      {/* The full control list lives behind "?" (the stage's label carries
          it for screen readers too) */}
      <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] flex flex-col items-end gap-3">
        {help && (
          <div
            id="archive-controls"
            role="region"
            aria-label="Controls"
            className="w-[min(80vw,20rem)] rounded-2xl border border-white/20 bg-[#0d0830]/85 p-4 font-mono text-label uppercase leading-relaxed tracking-[0.12em] text-white/80 backdrop-blur-md"
          >
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <dt className="text-white">Hold</dt>
              <dd>Drift toward the pointer / finger</dd>
              <dt className="text-white">W A S D</dt>
              <dd>Move</dd>
              <dt className="text-white">Arrows</dt>
              <dd>Look</dd>
              <dt className="text-white">Q E</dt>
              <dd>Sink / rise</dd>
              <dt className="text-white">Tap / Space</dt>
              <dd>Release the pulse (3 motes)</dd>
              <dt className="text-white">Esc</dt>
              <dd>Wake</dd>
            </dl>
          </div>
        )}
        <button
          type="button"
          onClick={() => setHelp((h) => !h)}
          aria-expanded={help}
          aria-controls="archive-controls"
          aria-label={help ? "Hide controls" : "Show controls"}
          className="archive-chrome pressable grid size-11 place-items-center rounded-full border border-white/25 bg-white/5 font-mono text-label text-white/85 backdrop-blur-md transition-colors hover:border-white/60 hover:text-white focus-visible:outline-offset-4"
        >
          ?
        </button>
      </div>
    </div>,
    document.body,
  );
}
