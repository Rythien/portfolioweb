"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useThemeStore } from "@/store/useThemeStore";
import { useArchiveStore } from "@/store/useArchiveStore";
import { crystalEvents } from "@/hooks/crystalState";

// The Archive (and three.js for it) is fetched only once the page reaches
// DREAM, so WAKE visits, and Lighthouse, pay nothing for it
const Archive = dynamic(() => import("./Archive"), { ssr: false });

/** How long the Archive takes to fade off while the flood retracts. */
const LEAVE_MS = 450;

type Phase = "off" | "in" | "leaving";

/**
 * DREAM is THE ARCHIVE. Once the flood has fully reached DREAM the Archive
 * takes the whole viewport and the awake page is suspended underneath
 * (scroll locked, inert, its R3F scene paused through useArchiveStore).
 * WAKE fades the Archive off, restores the page at the scroll position it
 * left, and runs the flood back.
 */
export default function ArchiveSlot() {
  const mode = useThemeStore((s) => s.mode);
  const open = useArchiveStore((s) => s.open);
  const [phase, setPhase] = useState<Phase>("off");
  const leaveTimer = useRef<number>(0);

  // Enter: DREAM reached and the flood has settled
  useEffect(() => {
    if (mode !== "dream" || phase !== "off") return;
    // Test hook (Playwright finish shots of the DREAM page): never in the UI
    if (new URLSearchParams(window.location.search).get("noarchive") === "1") return;
    let raf = 0;
    const tick = () => {
      if (!crystalEvents.floodActive && useThemeStore.getState().mode === "dream") {
        useArchiveStore.getState().setSavedScroll(window.scrollY);
        useArchiveStore.getState().setOpen(true);
        setPhase("in");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [mode, phase]);

  // Page suspension follows the store flag, whatever path clears it
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    html.classList.add("archive-open");
    // Nothing behind the Archive is reachable by Tab or a screen reader
    const others = [...document.body.children].filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement && !el.classList.contains("archive-root") && !el.hasAttribute("inert"),
    );
    others.forEach((el) => el.setAttribute("inert", ""));
    return () => {
      others.forEach((el) => el.removeAttribute("inert"));
      html.style.overflow = prevOverflow;
      document.body.style.overflow = prevBodyOverflow;
      html.classList.remove("archive-open");
      window.scrollTo(0, useArchiveStore.getState().savedScroll);
    };
  }, [open]);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  const wake = useCallback((origin: { x: number; y: number }) => {
    setPhase("leaving");
    // Page and scene resume first so the flood can run under the fade
    useArchiveStore.getState().setOpen(false);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      useThemeStore.getState().setMode("wake");
      setPhase("off");
      return;
    }
    useThemeStore.getState().startTransition(origin);
    leaveTimer.current = window.setTimeout(() => setPhase("off"), LEAVE_MS);
  }, []);

  if (phase === "off") return null;
  return <Archive leaving={phase === "leaving"} onWake={wake} />;
}
