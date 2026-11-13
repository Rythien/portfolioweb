"use client";

import { useThemeStore, type Mode } from "@/store/useThemeStore";
import { crystalEvents } from "@/hooks/useCrystalPose";

export default function ModePill() {
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
      data-magnetic
      aria-pressed={mode === value}
      aria-label={`Switch to ${value} mode`}
      className={`pressable text-label px-4 py-2.5 rounded-full transition-all duration-300 focus-visible:outline-offset-4 ${
        mode === value
          ? "bg-ink text-surface font-semibold"
          : "text-ink/80 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div data-reveal className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
      <div
        role="group"
        aria-label="Site mode"
        className="flex items-center gap-0 rounded-full border border-rule bg-surface/90 backdrop-blur-xl font-mono transition-colors hover:border-rule-hover"
      >
        {segment("wake", "Wake")}
        {segment("dream", "Dream")}
      </div>
    </div>
  );
}
