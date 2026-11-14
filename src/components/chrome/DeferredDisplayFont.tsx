"use client";

import { useEffect } from "react";

/**
 * Newsreader (~270KB of variable roman + italic) only sets accent words,
 * none of which are in the first paint. Any text using a face triggers
 * its download on layout, even off-screen, so the face is switched on
 * after load + idle instead: until then --font-display is a Georgia
 * stack (globals.css), then it becomes Newsreader with its metric-matched
 * fallback, so the swap doesn't shift layout.
 */
export default function DeferredDisplayFont({ family }: { family: string }) {
  useEffect(() => {
    let idleId: number | undefined;
    let timer: number | undefined;
    const apply = () => {
      const root = document.documentElement;
      root.style.setProperty("--font-display", family);
      root.setAttribute("data-display-font", "");
    };
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(apply, { timeout: 2000 });
      } else {
        timer = window.setTimeout(apply, 200);
      }
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [family]);
  return null;
}
