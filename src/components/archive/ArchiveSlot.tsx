"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useArchiveProgress } from "@/store/useArchiveProgress";
import { getProjectBySlug } from "@/content/projects";
import { useThemeStore } from "@/store/useThemeStore";
import { useArchiveStore } from "@/store/useArchiveStore";
import { getGfxProfile, whenSettled } from "@/components/scene/warm";
import { crystalEvents } from "@/hooks/crystalState";

// The Archive (and three.js for it) is fetched on the visitor's first
// interaction with the WAKE page, never during the initial load, so
// Lighthouse (which never interacts) pays nothing for it
const Archive = dynamic(() => import("./Archive"), { ssr: false });
// THE VOID: the pixel-art game replacing the Archive, in development.
// Step 1 (one room, the gem, drifters) is behind ?dream=void until it
// carries the seals and the freed-project reward; the Archive stays the
// default till then
const VoidGame = dynamic(() => import("@/components/void/VoidGame"), { ssr: false });
const USE_VOID =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("dream") === "void";

/** The Archive's clip leads the ink edge by a hair, so no page shows at the rim. */
const CLIP_LEAD = 1.02;

/**
 * DREAM is THE ARCHIVE.
 *
 * Warm: on the first interaction (idle callback) the Archive mounts
 * hidden, compiles its shaders and allocates its buffers, then sleeps.
 * Enter: as the flood heads for DREAM the Archive starts rendering and is
 * revealed through a circle that tracks the flood itself, so the flood
 * IS the Archive arriving and the page underneath is never seen dimmed.
 * Once the flood settles the page is suspended (useArchiveStore.open:
 * scroll locked, inert, its R3F scene paused).
 * WAKE: the page resumes at its scroll position, the flood runs back from
 * the WAKE control and the Archive's circle shrinks into it.
 */
/** Where the visitor lands on waking: back where they were, or at Contact (the ending). */
export interface WakeOptions {
  to?: "contact";
}

export default function ArchiveSlot() {
  const router = useRouter();
  const open = useArchiveStore((s) => s.open);
  const [warm, setWarm] = useState(false);
  /** Archive rendering (any part of it on screen). */
  const [active, setActive] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Pre-mount (hidden) on the first interaction, but only on the full
  // profile and only once the hero, its shards and the flood are compiled
  // (scene/warm.ts): the Archive is never warmed ahead of the hero. A mode
  // switch or a load in DREAM mounts it at once, whatever the profile.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Test hook (Playwright finish shots of the DREAM page): never in the UI
    if (params.get("noarchive") === "1") return;
    if (useThemeStore.getState().mode === "dream") {
      queueMicrotask(() => setWarm(true));
      return;
    }
    const events = ["pointermove", "pointerdown", "wheel", "keydown", "touchstart", "scroll"] as const;
    let idle = 0;
    let cancelSettle = () => {};
    const go = () => {
      events.forEach((e) => window.removeEventListener(e, go));
      if (getGfxProfile() === "reduced") return;
      cancelSettle = whenSettled("page", 30, () => {
        if (getGfxProfile() === "reduced") return;
        const ric = window.requestIdleCallback;
        idle = ric ? ric(() => setWarm(true), { timeout: 1500 }) : window.setTimeout(() => setWarm(true), 200);
      });
    };
    events.forEach((e) => window.addEventListener(e, go, { passive: true }));
    // Nobody interacts before a mode switch, but a switch must still work
    const unsub = useThemeStore.subscribe((s) => {
      if (s.transitioning || s.mode === "dream") setWarm(true);
    });
    return () => {
      events.forEach((e) => window.removeEventListener(e, go));
      window.cancelIdleCallback?.(idle);
      window.clearTimeout(idle);
      cancelSettle();
      unsub();
    };
  }, []);

  // Every frame: follow the flood. The clip is written straight to the
  // root's style (no React render); state changes only on transitions.
  useEffect(() => {
    if (!warm) return;
    let raf = 0;
    let wasActive = false;
    let wasOpen = useArchiveStore.getState().open;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const mode = useThemeStore.getState().mode;
      const flooding = crystalEvents.floodActive;
      const level = flooding ? crystalEvents.dreamLevel : mode === "dream" ? 1 : 0;
      const isActive = level > 0.0005;
      const isOpen = !flooding && mode === "dream";

      const el = rootRef.current;
      if (el) {
        if (flooding && isActive) {
          const r = level * crystalEvents.floodMaxRadiusPx * CLIP_LEAD;
          el.style.clipPath = `circle(${r.toFixed(1)}px at ${crystalEvents.floodCenterX.toFixed(1)}px ${crystalEvents.floodCenterY.toFixed(1)}px)`;
        } else {
          el.style.clipPath = "";
        }
      }
      if (isActive !== wasActive) {
        wasActive = isActive;
        setActive(isActive);
      }
      if (isOpen !== wasOpen) {
        wasOpen = isOpen;
        if (isOpen) {
          useArchiveStore.getState().setSavedScroll(window.scrollY);
          (window as unknown as { __archiveOpenedAt?: number }).__archiveOpenedAt = performance.now();
        }
        useArchiveStore.getState().setOpen(isOpen);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [warm]);

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

  const wake = useCallback((origin: { x: number; y: number }, opts: WakeOptions = {}) => {
    // The ending wakes at Contact: the page resumes there, not where it was
    if (opts.to === "contact") {
      const el = document.getElementById("contact");
      if (el) useArchiveStore.getState().setSavedScroll(el.getBoundingClientRect().top + window.scrollY);
    }
    // A panel floated into this visit opens its case study once awake
    // (the ending's Contact wins over it)
    const pending = useArchiveProgress.getState().takePendingCase();
    const slug = opts.to === "contact" ? null : pending && getProjectBySlug(pending) ? pending : null;
    if (slug) {
      const go = () => router.push(`/project/${slug}`);
      const unsub = useThemeStore.subscribe((s) => {
        if (s.mode === "wake" && !s.transitioning) {
          unsub();
          go();
        }
      });
    }
    // Page and scene resume first so the flood can run back over them
    useArchiveStore.getState().setOpen(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      useThemeStore.getState().setMode("wake");
      return;
    }
    useThemeStore.getState().startTransition(origin);
  }, [router]);

  if (!warm) return null;
  if (USE_VOID) return <VoidGame rootRef={rootRef} active={active} open={open} onWake={wake} />;
  return <Archive rootRef={rootRef} active={active} open={open} onWake={wake} />;
}
