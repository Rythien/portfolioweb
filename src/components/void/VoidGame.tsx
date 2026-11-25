"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { TUNE, VIEW, createWorld, restart, step, type Input, type Phase, type World } from "./engine";
import { COLOR, buildAtlas, createAmbient, drawWorld } from "./render";

/**
 * THE VOID, step 1: the shell. Same contract as the Archive (ArchiveSlot
 * mounts one or the other): a full-screen root it can clip to the flood,
 * `active` while any of it is on screen, `open` once DREAM has settled
 * (the page behind is suspended), `onWake` to leave.
 *
 * The world is drawn at 480 x 270 into an offscreen canvas and blitted at
 * the largest integer scale that fits, smoothing off, letterboxed into the
 * DREAM void. Scanlines and a vignette sit on top (off under reduced
 * motion). Keyboard first: W A S D / arrows move, Space dashes, J or the
 * mouse attacks (the mouse aims), Escape wakes. Losing focus pauses.
 */

interface VoidProps {
  rootRef: RefObject<HTMLDivElement | null>;
  active: boolean;
  open: boolean;
  onWake: (origin: { x: number; y: number }, opts?: { to?: "contact" }) => void;
}

/** Longest frame fed to the rules: a hitch never teleports anything. */
const MAX_DT = 1 / 20;
/** Frame times kept for the test hook (scripts/shot/void-record.mjs). */
const FRAME_LOG = 1200;

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export default function VoidGame({ rootRef, active, open, onWake }: VoidProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wakeRef = useRef<HTMLButtonElement | null>(null);
  const activeRef = useRef(active);
  const openRef = useRef(open);
  const wakeFn = useRef(onWake);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  /** The run's phase, mirrored for the card (set only when it changes). */
  const [phase, setPhase] = useState<Phase>("play");
  const [stats, setStats] = useState({ room: 1, kills: 0 });
  /** Counts phase changes, so a second death waits for its own fade. */
  const [endKey, setEndKey] = useState(0);
  const [shownKey, setShownKey] = useState(-1);
  const worldRef = useRef<World | null>(null);
  const reducedRef = useRef(false);
  const fallAgainRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current = active;
    openRef.current = open;
    wakeFn.current = onWake;
  }, [active, open, onWake]);

  // Focus the stage once DREAM settles, so the keyboard plays at once
  useEffect(() => {
    if (open) stageRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const world: World = createWorld(1, reduced);
    worldRef.current = world;
    reducedRef.current = reduced;
    let lastPhase: Phase = "play";
    const atlas = buildAtlas(world.room);
    const amb = createAmbient();
    const off = document.createElement("canvas");
    off.width = VIEW.w;
    off.height = VIEW.h;
    const octx = off.getContext("2d")!;
    const ctx = cvs.getContext("2d", { alpha: false })!;

    /* ── Display: integer scale, letterbox, scanlines, vignette ── */
    const view = { s: 1, dx: 0, dy: 0, dw: VIEW.w as number, dh: VIEW.h as number, overlay: null as HTMLCanvasElement | null };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const cw = Math.round(cvs.clientWidth * dpr), ch = Math.round(cvs.clientHeight * dpr);
      if (cw === 0 || ch === 0) return;
      cvs.width = cw;
      cvs.height = ch;
      // The largest integer scale that fits, allowed to overflow by up to
      // 2%: that only crops the room's outer void (two empty tiles, 60
      // device px at 3x), and a scrollbar gutter (1436 of 1440) must not
      // drop a full-window game from 3x to 2x
      view.s = Math.max(1, Math.floor(Math.min(cw / VIEW.w, ch / VIEW.h) * 1.02));
      view.dw = VIEW.w * view.s;
      view.dh = VIEW.h * view.s;
      view.dx = Math.floor((cw - view.dw) / 2);
      view.dy = Math.floor((ch - view.dh) / 2);
      // The letterbox is the DREAM void, painted once: frames only blit
      // over the game's own rectangle
      ctx.fillStyle = COLOR.void0;
      ctx.fillRect(0, 0, cw, ch);
      // Scanlines (the last device row of every logical row, darkened) and
      // the vignette, baked into ONE overlay bitmap here: computing a
      // full-screen gradient and pattern every frame cost a software canvas
      // ~10 ms. Off under reduced motion.
      view.overlay = null;
      if (!reduced) {
        const o = document.createElement("canvas");
        o.width = view.dw;
        o.height = view.dh;
        const ox = o.getContext("2d")!;
        if (view.s >= 3) {
          ox.fillStyle = "rgba(7,6,43,0.32)";
          for (let y = view.s - 1; y < view.dh; y += view.s) ox.fillRect(0, y, view.dw, 1);
        }
        const g = ox.createRadialGradient(view.dw / 2, view.dh / 2, view.dh * 0.35, view.dw / 2, view.dh / 2, Math.hypot(view.dw, view.dh) * 0.55);
        g.addColorStop(0, "rgba(7,6,43,0)");
        g.addColorStop(1, "rgba(7,6,43,0.55)");
        ox.fillStyle = g;
        ox.fillRect(0, 0, view.dw, view.dh);
        view.overlay = o;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cvs);

    /* ── Input ── */
    const held = new Set<string>();
    const input: Input = { mx: 0, my: 0, dash: false, attack: false, aimX: 0, aimY: 0 };
    let dashLatch = false;
    let pointerDown = false;
    let pointerX = 0, pointerY = 0;
    const toLogical = (clientX: number, clientY: number) => {
      const r = cvs.getBoundingClientRect();
      const dpr = cvs.width / Math.max(1, r.width);
      pointerX = ((clientX - r.left) * dpr - view.dx) / view.s;
      pointerY = ((clientY - r.top) * dpr - view.dy) / view.s;
    };
    const resume = () => {
      if (!pausedRef.current) return;
      pausedRef.current = false;
      setPaused(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!openRef.current) return;
      if (e.code === "Escape") {
        e.preventDefault();
        const r = wakeRef.current?.getBoundingClientRect();
        wakeFn.current(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth - 40, y: 40 });
        return;
      }
      resume();
      // R: fall again, from the card (dead or cleared)
      if (e.code === "KeyR" && world.phase !== "play") {
        e.preventDefault();
        restart(world);
        return;
      }
      if (e.code in MOVE_KEYS || e.code === "Space" || e.code === "KeyJ") e.preventDefault();
      if (e.code === "Space" && !e.repeat) dashLatch = true;
      held.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => held.delete(e.code);
    const onBlur = () => {
      held.clear();
      pointerDown = false;
      if (!openRef.current) return;
      pausedRef.current = true;
      setPaused(true);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!openRef.current || e.button !== 0) return;
      resume();
      pointerDown = true;
      toLogical(e.clientX, e.clientY);
    };
    const onPointerMove = (e: PointerEvent) => toLogical(e.clientX, e.clientY);
    const onPointerUp = () => {
      pointerDown = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    cvs.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    /* ── Loop ── */
    // Test hook: frame intervals, and the game's own work per frame (rules +
    // draw + blit), which is what the 60 fps floor is about; the interval
    // also carries the browser's compositing
    const frames = new Float32Array(FRAME_LOG);
    const work = new Float32Array(FRAME_LOG);
    let frameN = 0;
    const hook = window as unknown as { __void?: { world: World; frames: Float32Array; work: Float32Array; count: () => number } };
    hook.__void = { world, frames, work, count: () => frameN };
    let raf = 0;
    let prev = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const rawDt = (now - prev) / 1000;
      prev = now;
      if (!activeRef.current) return;
      const dt = Math.min(rawDt, MAX_DT);
      const playing = openRef.current && !pausedRef.current;
      const w0 = performance.now();
      if (playing) {
        frames[frameN % FRAME_LOG] = rawDt * 1000;
        let mx = 0, my = 0;
        for (const code of held) {
          const m = MOVE_KEYS[code];
          if (m) {
            mx += m[0];
            my += m[1];
          }
        }
        input.mx = Math.max(-1, Math.min(1, mx));
        input.my = Math.max(-1, Math.min(1, my));
        input.dash = dashLatch;
        dashLatch = false;
        input.attack = pointerDown || held.has("KeyJ");
        if (pointerDown) {
          input.aimX = pointerX - world.player.x;
          input.aimY = pointerY - (world.player.y - 6);
        } else {
          input.aimX = input.aimY = 0;
        }
        step(world, dt, input);
      }
      if (world.phase !== lastPhase) {
        lastPhase = world.phase;
        setPhase(world.phase);
        setStats({ room: world.roomReached, kills: world.kills });
        setEndKey((k) => k + 1);
      }
      drawWorld(octx, world, atlas, amb, playing ? dt : 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, view.dx, view.dy, view.dw, view.dh);
      if (view.overlay) ctx.drawImage(view.overlay, view.dx, view.dy);
      if (playing) work[frameN++ % FRAME_LOG] = performance.now() - w0;
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      cvs.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      delete hook.__void;
    };
  }, []);

  // The end card arrives once the arena has dimmed (at once under reduced
  // motion), and takes focus so Enter / Space work on it as well as R / Esc
  useEffect(() => {
    if (phase === "play") return;
    const id = window.setTimeout(() => {
      setShownKey(endKey);
      fallAgainRef.current?.focus({ preventScroll: true });
    }, reducedRef.current ? 0 : TUNE.death.fade * 1000);
    return () => window.clearTimeout(id);
  }, [phase, endKey]);
  const cardOn = phase !== "play" && shownKey === endKey;

  const fallAgain = () => {
    const w = worldRef.current;
    if (!w || w.phase === "play") return;
    restart(w);
    stageRef.current?.focus({ preventScroll: true });
  };

  const wakeFromButton = () => {
    const r = wakeRef.current?.getBoundingClientRect();
    onWake(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth - 40, y: 40 });
  };

  if (typeof document === "undefined") return null;
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
        aria-label="The Void. You are the gem. W A S D or the arrow keys move, Space dashes, J or a click attacks. Escape returns to the awake page."
        className="absolute inset-0 focus-visible:outline-offset-[-6px]"
        style={{ touchAction: "none" }}
      >
        <canvas ref={canvasRef} className="block size-full" style={{ imageRendering: "pixelated" }} />
      </div>

      <p className="pointer-events-none absolute left-1/2 top-[max(1.4rem,calc(env(safe-area-inset-top)+0.9rem))] -translate-x-1/2 whitespace-nowrap font-mono text-label uppercase tracking-[0.2em] text-white/80">
        The void · Room 1
      </p>

      <button
        ref={wakeRef}
        type="button"
        onClick={wakeFromButton}
        aria-label="Wake: return to the portfolio"
        className="pressable absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] min-h-11 rounded-full border border-white/25 bg-white/5 px-4 font-mono text-label uppercase tracking-[0.16em] text-white/85 backdrop-blur-md focus-visible:outline-offset-4"
      >
        Wake
      </button>

      <p className="pointer-events-none absolute bottom-[max(1.6rem,calc(env(safe-area-inset-bottom)+1.1rem))] left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-label uppercase tracking-[0.2em] text-white/60">
        W A S D move · Space dash · J / click attack · Esc wake
      </p>

      {phase !== "play" && (
        <div
          role="dialog"
          aria-labelledby="void-end-title"
          aria-describedby="void-end-detail"
          className="absolute inset-0 grid place-items-center transition-opacity duration-300 ease-out motion-reduce:transition-none"
          style={{ opacity: cardOn ? 1 : 0, pointerEvents: cardOn ? "auto" : "none" }}
        >
          <div className="flex flex-col items-center gap-5 text-center">
            <h2 id="void-end-title" className="font-mono text-[clamp(1.75rem,3.2vw,2.75rem)] uppercase tracking-[0.3em] text-white">
              {phase === "dead" ? "You woke" : "Room clear"}
            </h2>
            <p id="void-end-detail" className="font-mono text-label uppercase tracking-[0.2em] text-white/70">
              {phase === "dead" ? `Room ${stats.room} reached · ${stats.kills} shattered` : `All ${stats.kills} drifters shattered`}
            </p>
            <div className="mt-2 flex gap-3">
              <button
                ref={fallAgainRef}
                type="button"
                onClick={fallAgain}
                className="pressable min-h-11 rounded-full border border-white/40 bg-white/10 px-5 font-mono text-label uppercase tracking-[0.16em] text-white focus-visible:outline-offset-4"
              >
                R · Fall again
              </button>
              <button
                type="button"
                onClick={wakeFromButton}
                className="pressable min-h-11 rounded-full border border-white/25 bg-white/5 px-5 font-mono text-label uppercase tracking-[0.16em] text-white/85 focus-visible:outline-offset-4"
              >
                Esc · Wake
              </button>
            </div>
          </div>
        </div>
      )}

      {paused && (
        <p className="pointer-events-none absolute inset-0 grid place-items-center font-mono text-label uppercase tracking-[0.2em] text-white/85">
          Paused · any key to resume
        </p>
      )}
    </div>,
    document.body,
  );
}
