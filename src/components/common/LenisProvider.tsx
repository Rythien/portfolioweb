"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useScrollStore, setSectionProgress } from "@/store/useScrollStore";
import { useArchiveStore } from "@/store/useArchiveStore";
import { DURATION, ease } from "@/lib/motion";
// Importing registers the ScrollTrigger scrollerProxy before any trigger exists
import { installRefreshes, setLenis, startVelocity } from "@/lib/scroll";
import ScrollSkew from "@/components/chrome/ScrollSkew";

gsap.registerPlugin(ScrollTrigger);

interface LenisContextValue {
  lenis: Lenis | null;
}

const LenisContext = createContext<LenisContextValue>({
  lenis: null,
});

export const useLenis = () => useContext(LenisContext);

const SECTION_IDS = ["top", "about", "disciplines", "works", "recognition", "contact"];

export default function LenisProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [lenisInstance, setLenisInstance] = useState<Lenis | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // Fonts, preloader hand-over and resize re-measure every trigger,
  // with or without Lenis (reduced motion has none)
  useEffect(() => installRefreshes(), []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      return;
    }

    try {
      const lenis = new Lenis({
        // Wheel glide: the grand duration on the entrance curve (expo.out)
        duration: DURATION.grand,
        easing: ease.entrance,
        orientation: "vertical",
        gestureOrientation: "vertical",
        smoothWheel: true,
        touchMultiplier: 1.25,
      });

      lenisRef.current = lenis;
      setLenis(lenis);
      queueMicrotask(() => {
        setLenisInstance(lenis);
      });

      // Lenis moved: ScrollTrigger reads it back through the proxy
      lenis.on(
        "scroll",
        (e: { velocity: number; progress: number; direction: number }) => {
          ScrollTrigger.update();
          useScrollStore.setState({
            progress: e.progress ?? 0,
            velocity: e.velocity ?? 0,
            direction: e.direction ?? 1,
          });
        }
      );

      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
      });

      if (typeof document !== "undefined" && document.fonts) {
        document.fonts.ready.then(() => {
          ScrollTrigger.refresh();
        });
      }

      const handleWindowLoad = () => {
        ScrollTrigger.refresh();
      };
      window.addEventListener("load", handleWindowLoad);

      const updateTicker = (time: number) => {
        lenis.raf(time * 1000);
      };

      // One loop: Lenis steps on GSAP's ticker, then velocity is read
      gsap.ticker.add(updateTicker);
      gsap.ticker.lagSmoothing(0);
      const stopVelocity = startVelocity();
      // Re-measure now that ScrollTrigger reads Lenis
      ScrollTrigger.refresh();

      return () => {
        window.removeEventListener("load", handleWindowLoad);
        stopVelocity();
        gsap.ticker.remove(updateTicker);
        setLenis(null);
        lenis.destroy();
        lenisRef.current = null;
        setLenisInstance(null);
      };
    } catch (err) {
      console.warn("Lenis initialization error:", err);
    }
  }, []);

  // Archive open: Lenis stops (no wheel smoothing under it), and
  // starts again on any exit path
  useEffect(() => {
    if (!lenisInstance) return;
    const apply = (open: boolean) => (open ? lenisInstance.stop() : lenisInstance.start());
    apply(useArchiveStore.getState().open);
    return useArchiveStore.subscribe((s, prev) => {
      if (s.open !== prev.open) apply(s.open);
    });
  }, [lenisInstance]);

  // Per-section progress via ScrollTrigger
  useEffect(() => {
    if (!lenisInstance) return;

    const triggers: ScrollTrigger[] = [];

    requestAnimationFrame(() => {
      SECTION_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        triggers.push(
          ScrollTrigger.create({
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            onUpdate: (self) => {
              setSectionProgress(id, self.progress);
            },
          })
        );
      });
    });

    return () => {
      triggers.forEach((t) => t.kill());
    };
  }, [lenisInstance]);

  return (
    <LenisContext.Provider value={{ lenis: lenisInstance }}>
      {children}
      {/* After the children, so the [data-skew] content exists when it mounts */}
      <ScrollSkew />
    </LenisContext.Provider>
  );
}
