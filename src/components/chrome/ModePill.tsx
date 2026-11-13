"use client";

import { useThemeStore } from "@/store/useThemeStore";

export default function ModePill() {
  const mode = useThemeStore((s) => s.mode);
  const startTransition = useThemeStore((s) => s.startTransition);

  const handleClick = (e: React.MouseEvent) => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      useThemeStore.getState().toggle();
      return;
    }

    startTransition({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
      <button
        onClick={handleClick}
        aria-label={`Switch to ${mode === "wake" ? "dream" : "wake"} mode`}
        className="group flex items-center gap-0 rounded-full border border-rule bg-surface/90 backdrop-blur-xl font-mono text-label transition-colors hover:border-rule-hover focus-visible:outline-offset-4"
      >
        <span
          className={`px-4 py-2.5 rounded-full transition-all duration-300 ${
            mode === "wake"
              ? "bg-ink text-surface font-semibold"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          Wake
        </span>
        <span
          className={`px-4 py-2.5 rounded-full transition-all duration-300 ${
            mode === "dream"
              ? "bg-ink text-surface font-semibold"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          Dream
        </span>
      </button>
    </div>
  );
}
