"use client";

import { useThemeStore, type Mode } from "@/store/useThemeStore";
import { crystalEvents } from "@/hooks/crystalState";
import Swap from "@/components/ui/Swap";

/**
 * The WAKE / DREAM control, in one of two places:
 *
 * - floating (default): the glass pill at the bottom centre, from lg up,
 *   where the copy column leaves the bottom centre clear;
 * - docked: a compact segmented toggle inside the header, below lg. A
 *   floating pill there sat on body copy and links in every section
 *   (scripts/verify/pill-cover.mjs), and the header is already a solid
 *   band below lg, so the control costs no reading space at all.
 *
 * Exactly one of the two is displayed at any width.
 */
export default function ModePill({ docked = false }: { docked?: boolean }) {
  const mode = useThemeStore((s) => s.mode);
  const startTransition = useThemeStore((s) => s.startTransition);

  const select = (next: Mode) => (e: React.MouseEvent) => {
    // During a flood: clicking the segment it is heading to is a no-op,
    // clicking the other one reverses mid-animation. At rest, the
    // active segment is a no-op.
    if (crystalEvents.floodActive) {
      if (crystalEvents.floodTarget === next) return;
    } else if (next === mode) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      useThemeStore.getState().setMode(next);
      return;
    }

    startTransition({ x: e.clientX, y: e.clientY });
  };

  const segment = (value: Mode, label: string) => (
    <button
      onClick={select(value)}
      aria-pressed={mode === value}
      aria-label={`Switch to ${value} mode`}
      className={`pressable mode-pill-seg text-label h-full flex items-center justify-center rounded-full focus-visible:outline-offset-4 ${
        docked ? "mode-pill-seg--docked px-2 sm:px-2.5" : "px-4"
      } ${mode === value ? "bg-ink text-surface font-semibold" : "text-ink/80"}`}
    >
      <Swap>{label}</Swap>
    </button>
  );

  if (docked) {
    return (
      <div
        role="group"
        aria-label="Site mode"
        className="lg:hidden h-9 grid grid-cols-2 rounded-full border border-rule bg-surface font-mono p-0.5"
      >
        {segment("wake", "Wake")}
        {segment("dream", "Dream")}
      </div>
    );
  }

  return (
    <div
      data-intro
      className="max-lg:hidden fixed left-1/2 -translate-x-1/2 z-[100] bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]"
    >
      {/* The whole pill is one magnet (its own wrapper keeps the centring
          transform out of GSAP's way). Two equal grid columns, so both
          segments take the wider label's width */}
      <div
        role="group"
        aria-label="Site mode"
        data-magnetic
        className="mode-pill h-[var(--pill-h)] grid grid-cols-2 rounded-full border border-rule bg-surface/90 backdrop-blur-xl font-mono transition-colors hover:border-rule-hover"
      >
        {segment("wake", "Wake")}
        {segment("dream", "Dream")}
      </div>
    </div>
  );
}
