"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import { createGame, step, takeEvents, STEP, type GameState, type Input } from "./engine.ts";
import { applyEvents, createView, fitDisplay, logicalSize, renderFrame, type View } from "./render.ts";
import { playEvents } from "./audio.ts";

interface DescentProps {
  /** Called with the run's score (metres) on every exit path. */
  onExit: (score?: number) => void;
}

/** Longest frame fed to the accumulator; a hitch never fast-forwards. */
const MAX_FRAME = 0.25;

/* ── Save: one localStorage key, and a blocked context still plays ── */

const SAVE_KEY = "descent";
interface Save {
  best: number;
  seenControls: boolean;
}
function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Save>;
      return { best: Math.max(0, Number(v.best) || 0), seenControls: !!v.seenControls };
    }
  } catch {
    // blocked or corrupt storage: play without a best
  }
  return { best: 0, seenControls: false };
}
function writeSave(v: Save): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(v));
  } catch {
    // blocked storage: the run still counts on the page
  }
}

interface Death {
  score: number;
  best: number;
  newBest: boolean;
}

export default function Descent({ onExit }: DescentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [death, setDeath] = useState<Death | null>(null);
  /** Current run's score, read by every exit path. */
  const scoreRef = useRef(0);
  const exitRef = useRef(onExit);
  useEffect(() => {
    exitRef.current = onExit;
  }, [onExit]);

  const fullBleed = typeof window !== "undefined" && window.innerWidth < 768;
  const [size] = useState(() =>
    typeof window === "undefined"
      ? { w: 320, h: 568 }
      : logicalSize(window.innerWidth, window.innerHeight, window.innerWidth < 768),
  );

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
        exitRef.current(scoreRef.current > 0 ? scoreRef.current : undefined);
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

  // Game loop: fixed-step simulation, interpolated render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const view: View = createView(canvas, size.w, size.h, reducedMotion, fullBleed);
    // Test hooks, only behind URL params (Playwright checks); never in the UI
    const params = new URLSearchParams(window.location.search);
    const debug = params.get("descentdebug") === "1";
    const save = loadSave();
    const input: Input = { steer: 0, targetX: null, dash: false };
    const hooks: { game?: GameState; input: Input; runs: number } = { input, runs: 0 };
    if (debug) (window as unknown as { __descent?: unknown }).__descent = hooks;

    const newGame = (): GameState => {
      const g = createGame({
        seed: debug && params.get("descentseed") ? Number(params.get("descentseed")) + hooks.runs : (Date.now() >>> 0) ^ 0x9e3779b9,
        viewH: size.h,
        reducedMotion,
        invulnerable: debug && params.get("descentgod") === "1",
        startDepth: debug ? Number(params.get("descentstart") || 0) : 0,
        best: save.best,
      });
      view.hud = { shown: g.score, bestFlash: 0, deadT: -1, best: save.best };
      view.particles = [];
      view.trail = [];
      scoreRef.current = 0;
      hooks.game = g;
      hooks.runs += 1;
      return g;
    };
    let game = newGame();

    const restart = () => {
      game = newGame();
      acc = 0;
      setDeath(null);
    };

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    // Keyboard steering and dash (pointer and touch arrive with input)
    const held = { left: false, right: false };
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") held.left = true;
      else if (k === "ArrowRight" || k === "d" || k === "D") held.right = true;
      else if (k === " " || k === "ArrowDown") {
        if (!e.repeat) input.dash = true;
      } else if (k === "r" || k === "R") {
        if (!e.repeat) restart();
      } else return;
      e.preventDefault();
      input.steer = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") held.left = false;
      else if (k === "ArrowRight" || k === "d" || k === "D") held.right = false;
      input.steer = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const onResize = () => fitDisplay(view);
    onResize();
    window.addEventListener("resize", onResize);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, MAX_FRAME);
      last = now;
      if (!pausedRef.current) {
        acc += dt;
        while (acc >= STEP) {
          step(game, input, STEP);
          input.dash = false;
          acc -= STEP;
        }
      }
      const events = takeEvents(game);
      playEvents(events);
      applyEvents(view, events);
      scoreRef.current = Math.floor(game.score);
      for (const e of events) {
        if (e.type !== "dead") continue;
        const newBest = e.score > save.best;
        if (newBest) save.best = e.score;
        writeSave(save);
        setDeath({ score: e.score, best: save.best, newBest });
      }
      renderFrame(view, game, pausedRef.current ? 1 : acc / STEP, pausedRef.current ? 0 : dt, fullBleed);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [size, fullBleed]);

  return (
    <div
      className="descent-overlay fixed inset-0 z-[300] flex items-center justify-center bg-[#030214] bg-[radial-gradient(ellipse_at_center,#120c3d_0%,#06041c_45%,#030214_80%)]"
      role="dialog"
      aria-modal="true"
      aria-label="DESCENT"
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label="DESCENT game canvas"
        className={fullBleed ? "h-full w-full" : "h-full max-h-[100dvh]"}
        style={fullBleed ? undefined : { aspectRatio: `${size.w} / ${size.h}` }}
      />
      {paused && <p className="sr-only" aria-live="polite">Paused</p>}
      <p className="sr-only" aria-live="assertive" aria-atomic="true">
        {death
          ? `The fall ended at ${death.score} metres. ${death.newBest ? "A new best." : `Best ${death.best} metres.`} Press R to fall again or Escape to return to the page.`
          : ""}
      </p>
      <button
        type="button"
        onClick={() => exitRef.current(scoreRef.current > 0 ? scoreRef.current : undefined)}
        aria-label="Exit the game"
        className="absolute right-3 top-3 grid h-11 w-11 place-items-center font-mono text-[#e4dcff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8f7bff]"
      >
        X
      </button>
    </div>
  );
}
