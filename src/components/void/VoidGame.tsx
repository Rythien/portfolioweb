"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  BOONS, ENEMY_NAMES, ROOMS, SealState, TUNE, VIEW, chooseBoon, createWorld, restart, resumesAtSeal, roomBounds, step,
  type BoonId, type EnemyName, type Input, type Phase, type Wave, type World,
} from "./engine";
import { COLOR, buildAtlas, createAmbient, drawWorld, rebuildIsland, setCover } from "./render";
import { archiveProjects } from "@/content/projects";
import { useArchiveProgress } from "@/store/useArchiveProgress";

/** The project each room's seal holds (the Archive's order: seal i, project i). */
const SEAL_PROJECTS = ROOMS.map((_, i) => archiveProjects[i]);

/**
 * The room a run starts in: the first whose project is not yet freed (a
 * death never makes you refight what you freed). All freed: room 1.
 * Test hook ?voidroom=N overrides it.
 */
function startRoom(): number {
  const q = Number(new URLSearchParams(window.location.search).get("voidroom"));
  if (q >= 1 && q <= ROOMS.length) return q - 1;
  const freed = useArchiveProgress.getState().freed;
  const i = SEAL_PROJECTS.findIndex((p) => p && !freed.includes(p.slug));
  return i < 0 ? 0 : i;
}

/**
 * THE VOID: DREAM's game, and its shell. The contract ArchiveSlot holds
 * it by (the same one the retired 3D Archive had): a full-screen root it can clip to the flood,
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
/**
 * Input buffers (ms). Input was sampled once a frame as "held now", so a
 * click or a J tap whose down and up fell between two frames never
 * attacked at all (an automated run clicked for 14 s: 0 shattered). A
 * press is now remembered until the game uses it, for this long, which
 * also carries a press made just before a cooldown ends.
 */
const BUFFER = { attack: 150, dash: 120 } as const;
/** Frame times kept for the test hook (scripts/shot/void-record.mjs). */
const FRAME_LOG = 1200;

/**
 * Test hook (recordings, checks): ?voidwave=charger:4,drifter:2 replaces the
 * room's wave. The UI never sets it.
 */
function waveFromUrl(): Wave | undefined {
  const q = new URLSearchParams(window.location.search).get("voidwave");
  if (!q) return undefined;
  const wave: Wave = {};
  for (const part of q.split(",")) {
    const [name, n] = part.split(":");
    if ((ENEMY_NAMES as readonly string[]).includes(name)) wave[name as EnemyName] = Math.max(0, Math.min(20, Number(n) || 0));
  }
  return wave;
}

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
  const [stats, setStats] = useState({ room: 1, kills: 0, atSeal: false });
  /** The room on screen and what is happening in it, for the HUD line. */
  const [hudRoom, setHudRoom] = useState({ room: 1, note: "" });
  /** Counts phase changes, so a second death waits for its own fade. */
  const [endKey, setEndKey] = useState(0);
  const [shownKey, setShownKey] = useState(-1);
  const worldRef = useRef<World | null>(null);
  const reducedRef = useRef(false);
  const fallAgainRef = useRef<HTMLButtonElement | null>(null);
  /** The boons on offer and the room whose project they are named for (the run is paused), or null. */
  const [offer, setOffer] = useState<{ room: number; ids: BoonId[] } | null>(null);
  const boonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  /** Takes boon `i` of the offer (the shell's loop clears the card). */
  const takeBoonRef = useRef<(i: number) => void>(() => {});
  const wakeFnRef = useRef(onWake);

  useEffect(() => {
    activeRef.current = active;
    openRef.current = open;
    wakeFn.current = onWake;
    wakeFnRef.current = onWake;
  }, [active, open, onWake]);

  // Focus the stage once DREAM settles, so the keyboard plays at once
  useEffect(() => {
    if (open) stageRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!useArchiveProgress.getState().hydrated) useArchiveProgress.getState().hydrate();
    const world: World = createWorld(1, reduced, waveFromUrl(), startRoom());
    worldRef.current = world;
    reducedRef.current = reduced;
    let lastPhase: Phase = "play";
    let lastRoom = world.roomIndex;
    let lastHud = "";
    let lastOffer = "";
    takeBoonRef.current = (i: number) => {
      if (!chooseBoon(world, i)) return;
      stageRef.current?.focus({ preventScroll: true });
    };
    const atlas = buildAtlas(world.room);
    // The freed projects' DREAM covers, for the bloom (pixelated at its size)
    SEAL_PROJECTS.forEach((p, i) => {
      if (!p) return;
      const img = new Image();
      img.decoding = "async";
      img.onload = () => setCover(atlas, i, img);
      img.src = `/projects/${p.slug}/cover-dream-800.webp`;
    });
    /** Rooms whose freeing has been recorded (unlocks happen once). */
    const recorded = ROOMS.map(() => false);
    const amb = createAmbient();
    const off = document.createElement("canvas");
    off.width = VIEW.w;
    off.height = VIEW.h;
    const octx = off.getContext("2d")!;
    const ctx = cvs.getContext("2d", { alpha: false })!;

    /* ── Display: integer scale, letterbox, scanlines, vignette ── */
    const view = { s: 1, dx: 0, dy: 0, dw: VIEW.w as number, dh: VIEW.h as number, overlay: null as HTMLCanvasElement | null };
    const hud = { x: 0, y: 0 };
    /** Share of the viewport height the island takes (test hook). */
    let fill = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const cw = Math.round(cvs.clientWidth * dpr), ch = Math.round(cvs.clientHeight * dpr);
      if (cw === 0 || ch === 0) return;
      cvs.width = cw;
      cvs.height = ch;
      // The largest integer scale at which the ISLAND (cliffs included,
      // plus a 4 px margin) fits, centred on it. The logical frame around
      // it is empty void, so cropping it costs nothing, and fitting the
      // island instead of the whole 480 x 270 frame is what lets 3x reach
      // 1280-wide screens (it fell to 2x, the arena at half the height)
      const b = roomBounds(world.room);
      const need = { w: b.x1 - b.x0 + 8, h: b.y1 - b.y0 + 8 };
      view.s = Math.max(1, Math.floor(Math.min(cw / need.w, ch / need.h)));
      view.dw = VIEW.w * view.s;
      view.dh = VIEW.h * view.s;
      view.dx = Math.round(cw / 2 - ((b.x0 + b.x1) / 2) * view.s);
      view.dy = Math.round(ch / 2 - ((b.y0 + b.y1) / 2) * view.s);
      // The on-screen part of the logical frame, for the hearts
      hud.x = Math.max(0, Math.ceil(-view.dx / view.s));
      hud.y = Math.max(0, Math.ceil(-view.dy / view.s));
      fill = Math.min(1, ((b.y1 - b.y0) * view.s) / ch);
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
    /** When the last unused attack / dash press happened (performance.now), or -1. */
    let attackAt = -1;
    let dashAt = -1;
    /** The buffered attack came from the pointer: it aims where it was clicked, even released. */
    let attackByPointer = false;
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
      // A boon on offer: 1 / 2 / 3 take one; arrows move between them;
      // Enter / Space press the focused one (native button). Nothing else
      // reaches the game: the run is paused
      if (world.offer) {
        const n = world.offer.length;
        const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
        if (digit && Number(digit[1]) <= n) {
          e.preventDefault();
          takeBoonRef.current(Number(digit[1]) - 1);
          return;
        }
        const dir = e.code === "ArrowRight" || e.code === "ArrowDown" ? 1 : e.code === "ArrowLeft" || e.code === "ArrowUp" ? -1 : 0;
        if (dir) {
          e.preventDefault();
          const at = boonRefs.current.findIndex((b) => b === document.activeElement);
          boonRefs.current[((at < 0 ? (dir > 0 ? -1 : 0) : at) + dir + n) % n]?.focus({ preventScroll: true });
          return;
        }
        if (e.code === "Enter" || e.code === "Space") {
          // Focus is on the card: let the button take it; else take the first
          if (!boonRefs.current.includes(document.activeElement as HTMLButtonElement)) {
            e.preventDefault();
            takeBoonRef.current(0);
          }
          return;
        }
        return;
      }
      // R: fall again, from the death card (a won run is over)
      if (e.code === "KeyR" && world.phase === "dead") {
        e.preventDefault();
        restart(world, startRoom());
        recorded.fill(false);
        return;
      }
      if (e.code in MOVE_KEYS || e.code === "Space" || e.code === "KeyJ") e.preventDefault();
      if (e.code === "Space" && !e.repeat) dashAt = performance.now();
      if (e.code === "KeyJ" && !e.repeat) {
        attackAt = performance.now();
        attackByPointer = false;
      }
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
      attackAt = performance.now();
      attackByPointer = true;
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
    const hook = window as unknown as {
      __void?: {
        world: World; frames: Float32Array; work: Float32Array; count: () => number; off: HTMLCanvasElement;
        view: { s: number; dx: number; dy: number }; fill: () => number;
      };
    };
    // off: the logical 480 x 270 frame (scripts/verify/void-contrast.mjs reads its pixels)
    hook.__void = { world, frames, work, count: () => frameN, off, view, fill: () => fill };
    let raf = 0;
    let prev = performance.now();
    let wasActive = activeRef.current;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const rawDt = (now - prev) / 1000;
      prev = now;
      // DREAM entered again after a won run (the game stays mounted across
      // visits): that run is over, so a new one begins as the flood starts
      // in, instead of the button-less "waking at Contact" card sitting
      // there for good
      if (activeRef.current !== wasActive) {
        wasActive = activeRef.current;
        if (wasActive && world.phase === "won") {
          // A new run: no boons carried over
          restart(world, startRoom(), true);
          recorded.fill(false);
        }
      }
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
        input.dash = dashAt >= 0 && now - dashAt < BUFFER.dash;
        input.attack = pointerDown || held.has("KeyJ") || (attackAt >= 0 && now - attackAt < BUFFER.attack);
        // Aim at the pointer while it is held, or for a click still in the buffer
        if (pointerDown || (attackByPointer && attackAt >= 0)) {
          input.aimX = pointerX - world.player.x;
          input.aimY = pointerY - (world.player.y - 6);
        } else {
          input.aimX = input.aimY = 0;
        }
        const dashes = world.player.dashes;
        step(world, dt, input);
        // A press is spent once it has acted (the rules reset these the frame they fire)
        if (world.player.atkAge === 0) attackAt = -1;
        if (world.player.dashes !== dashes) dashAt = -1;
      }
      // A new room: bake its island, re-fit the scale to it
      if (world.roomIndex !== lastRoom) {
        lastRoom = world.roomIndex;
        rebuildIsland(atlas, world.room);
        resize();
      }
      // A seal freed: its project is recovered, so its Works card carries
      // "Recovered from the dream" (RecoveredMark reads `recovered`; `free`
      // alone never marked it). Freeing is not a request to read the case
      // study, so waking does not open it (the Archive's panel did)
      world.freed.forEach((f, i) => {
        if (!f || recorded[i]) return;
        recorded[i] = true;
        const p = SEAL_PROJECTS[i];
        if (p) useArchiveProgress.getState().recover(p.slug, { openOnWake: false });
      });
      const s = world.seal;
      const note = world.offer
        ? "choose a boon"
        : world.doorOpen
        ? "the way is open"
        : s.state === SealState.Freed
          ? `freed · ${SEAL_PROJECTS[world.roomIndex]?.title ?? ""}`
          : s.state !== SealState.Off
            ? "the seal wakes"
            : "";
      const hudKey = `${world.roomIndex + 1}:${note}`;
      if (hudKey !== lastHud) {
        lastHud = hudKey;
        setHudRoom({ room: world.roomIndex + 1, note });
      }
      const offerKey = world.offer ? `${world.roomIndex}:${world.offer.join()}` : "";
      if (offerKey !== lastOffer) {
        lastOffer = offerKey;
        setOffer(world.offer ? { room: world.roomIndex, ids: [...world.offer] } : null);
        // Keys held into the pause must not walk the gem off when it ends
        held.clear();
        pointerDown = false;
        attackAt = dashAt = -1;
      }
      if (world.phase !== lastPhase) {
        lastPhase = world.phase;
        setPhase(world.phase);
        setStats({ room: world.roomReached, kills: world.kills, atSeal: resumesAtSeal(world, startRoom()) });
        setEndKey((k) => k + 1);
      }
      drawWorld(octx, world, atlas, amb, playing ? dt : 0, hud);
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

  // Won: all three freed. The card says so, then the flood wakes the
  // visitor at Contact (the Archive's ending), from the middle of the screen
  useEffect(() => {
    if (phase !== "won") return;
    const id = window.setTimeout(
      () => wakeFnRef.current({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, { to: "contact" }),
      reducedRef.current ? 1200 : 2400,
    );
    return () => window.clearTimeout(id);
  }, [phase]);

  // The boon card takes focus as it opens (arrows / 1-3 / Enter work on it)
  useEffect(() => {
    if (offer) boonRefs.current[0]?.focus({ preventScroll: true });
  }, [offer]);

  const fallAgain = () => {
    const w = worldRef.current;
    if (!w || w.phase !== "dead") return;
    restart(w, startRoom());
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
        The void · Room {hudRoom.room} / 3{hudRoom.note ? ` · ${hudRoom.note}` : ""}
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
              {phase === "dead" ? "You woke" : "All three freed"}
            </h2>
            <p id="void-end-detail" className="font-mono text-label uppercase tracking-[0.2em] text-white/70">
              {phase === "dead" ? `Room ${stats.room} of 3 reached · ${stats.kills} shattered` : "Waking at Contact"}
            </p>
            {phase === "dead" && (
            <div className="mt-2 flex gap-3">
              <button
                ref={fallAgainRef}
                type="button"
                onClick={fallAgain}
                className="pressable min-h-11 rounded-full border border-white/40 bg-white/10 px-5 font-mono text-label uppercase tracking-[0.16em] text-white focus-visible:outline-offset-4"
              >
                {stats.atSeal ? "R · Back to the seal" : "R · Fall again"}
              </button>
              <button
                type="button"
                onClick={wakeFromButton}
                className="pressable min-h-11 rounded-full border border-white/25 bg-white/5 px-5 font-mono text-label uppercase tracking-[0.16em] text-white/85 focus-visible:outline-offset-4"
              >
                Esc · Wake
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {offer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="void-boon-title"
          aria-describedby="void-boon-hint"
          className="absolute inset-0 grid place-items-center bg-[#07062B]/70 px-4"
        >
          <div
            className="flex w-full max-w-[56rem] flex-col gap-5 border-2 p-5 sm:p-7"
            style={{ borderColor: COLOR.ice1, background: COLOR.void0, boxShadow: `6px 6px 0 ${COLOR.energy0}`, imageRendering: "pixelated" }}
          >
            <div className="flex flex-col gap-2 text-center">
              <p className="font-mono text-label uppercase tracking-[0.2em]" style={{ color: COLOR.energy1 }}>
                Freed · {SEAL_PROJECTS[offer.room]?.title ?? `Room ${offer.room + 1}`}
              </p>
              <h2 id="void-boon-title" className="font-mono text-[clamp(1.25rem,2.4vw,1.75rem)] uppercase tracking-[0.24em] text-white">
                Take one of its gifts
              </h2>
            </div>
            <ul className="grid gap-3 sm:grid-cols-3">
              {offer.ids.map((id, i) => (
                <li key={id}>
                  <button
                    ref={(el) => {
                      boonRefs.current[i] = el;
                    }}
                    type="button"
                    onClick={() => takeBoonRef.current(i)}
                    className="flex h-full w-full flex-col gap-2 border-2 bg-[#1a1050] p-4 text-left font-mono hover:bg-[#241764] focus-visible:bg-[#2c1d80] focus-visible:outline-2 focus-visible:outline-offset-4"
                    style={{ borderColor: COLOR.energy1, outlineColor: COLOR.ice0 }}
                  >
                    <span className="text-label uppercase tracking-[0.16em]" style={{ color: COLOR.ice0 }}>
                      [{i + 1}] {SEAL_PROJECTS[offer.room]?.title ?? ""}
                    </span>
                    <span className="text-[1.05rem] uppercase tracking-[0.12em] text-white">{BOONS[id].title}</span>
                    <span className="text-sm leading-snug" style={{ color: COLOR.ice1 }}>{BOONS[id].text}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p id="void-boon-hint" className="text-center font-mono text-label uppercase tracking-[0.2em] text-white/70">
              1 · 2 · 3 or arrows and Enter · the run waits
            </p>
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
