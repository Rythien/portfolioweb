"use client";

import { useThemeStore } from "@/store/useThemeStore";

export default function ModePill() {
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
      <button
        onClick={toggle}
        aria-label={`Switch to ${mode === "wake" ? "dream" : "wake"} mode`}
        className="group flex items-center gap-0 rounded-full border border-rule bg-surface/80 backdrop-blur-md font-mono text-label uppercase tracking-widest transition-colors hover:border-rule-hover focus-visible:outline-offset-4"
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
