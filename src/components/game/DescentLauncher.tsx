"use client";

import { Component, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useThemeStore } from "@/store/useThemeStore";
import { useGameStore } from "@/store/useGameStore";

// The game chunk is fetched on the first PLAY click, never before
const Descent = dynamic(() => import("./descent/Descent"), { ssr: false });

const SKIP_KEY = "descent-skip";

/** A crash inside the game must never leave the page locked. */
class GameBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("DESCENT crashed", err);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** 7x7 pixel gem, white with a violet core. */
function PixelGem() {
  const px: [number, number, string][] = [];
  const rows = ["..###..", ".#####.", "##ooo##", "#ooooo#", ".#ooo#.", "..#o#..", "...#..."];
  rows.forEach((r, y) =>
    [...r].forEach((c, x) => {
      if (c === "#") px.push([x, y, "currentColor"]);
      if (c === "o") px.push([x, y, "#8f7bff"]);
    }),
  );
  return (
    <svg width="14" height="14" viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" className="relative max-[399px]:hidden">
      {px.map(([x, y, f]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={f} />
      ))}
    </svg>
  );
}

export default function DescentLauncher() {
  const mode = useThemeStore((s) => s.mode);
  const open = useGameStore((s) => s.open);
  const lastScore = useGameStore((s) => s.lastScore);
  const playRef = useRef<HTMLButtonElement>(null);
  const [skipped, setSkipped] = useState(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem(SKIP_KEY) === "1";
    } catch {
      // storage blocked: the launcher simply stays available
      return false;
    }
  });

  const close = (score?: number) => {
    if (typeof score === "number") useGameStore.getState().setLastScore(score);
    useGameStore.getState().setOpen(false);
    // Focus returns to the control that opened the game
    requestAnimationFrame(() => playRef.current?.focus());
  };

  const skip = () => {
    setSkipped(true);
    try {
      sessionStorage.setItem(SKIP_KEY, "1");
    } catch {}
  };

  const visible = mode === "dream" && !skipped && !open;

  return (
    <>
      {visible && (
        <div className="descent-launcher pointer-events-none fixed z-[100] bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))] left-4 right-4 sm:left-10 sm:right-10 md:right-auto lg:left-[max(4rem,calc((100vw-80rem)/2+4rem))] flex items-center justify-between md:justify-start md:gap-4 font-mono text-label uppercase">
          <button
            ref={playRef}
            type="button"
            onClick={() => useGameStore.getState().setOpen(true)}
            className="descent-play pressable group pointer-events-auto relative inline-flex min-h-11 items-center gap-2.5 px-3 md:px-4 uppercase text-ink focus-visible:outline-offset-4"
            aria-label="Play DESCENT, a small arcade game"
          >
            <span aria-hidden="true" className="descent-play-frame" />
            <PixelGem />
            <span className="relative font-semibold tracking-[0.12em]">Play</span>
            {lastScore !== null && (
              <span className="relative text-ink/70 tabular-nums" aria-label={`Last run ${lastScore} metres`}>
                {lastScore} m
              </span>
            )}
          </button>
          <a
            href="#about"
            onClick={skip}
            className="pointer-events-auto max-w-[6.5rem] py-1 text-right leading-snug text-ink/80 underline decoration-ink/40 underline-offset-4 hover:text-ink focus-visible:outline-offset-4 md:max-w-none md:text-left"
          >
            Skip the game
          </a>
        </div>
      )}
      {open && (
        <GameBoundary onError={() => close()}>
          <Descent onExit={close} />
        </GameBoundary>
      )}
    </>
  );
}
