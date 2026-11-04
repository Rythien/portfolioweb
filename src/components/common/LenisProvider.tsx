"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface LenisContextValue {
  lenis: Lenis | null;
  velocity: number;
}

const LenisContext = createContext<LenisContextValue>({
  lenis: null,
  velocity: 0,
});

export const useLenis = () => useContext(LenisContext);

export default function LenisProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [lenisInstance, setLenisInstance] = useState<Lenis | null>(null);
  const [velocity, setVelocity] = useState(0);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      return;
    }

    try {
      const lenis = new Lenis({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: "vertical",
        gestureOrientation: "vertical",
        smoothWheel: true,
        touchMultiplier: 1.25,
      });

      lenisRef.current = lenis;
      queueMicrotask(() => {
        setLenisInstance(lenis);
      });

      // Connect Lenis scroll to ScrollTrigger
      lenis.on("scroll", (e: { velocity: number }) => {
        ScrollTrigger.update();
        setVelocity(e.velocity || 0);
      });

      // Ensure ScrollTrigger coordinates align after Lenis initializes
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
      });

      // Refresh ScrollTrigger after custom fonts load to eliminate pin misalignment
      if (typeof document !== "undefined" && document.fonts) {
        document.fonts.ready.then(() => {
          ScrollTrigger.refresh();
        });
      }

      const handleWindowLoad = () => {
        ScrollTrigger.refresh();
      };
      window.addEventListener("load", handleWindowLoad);

      // Connect GSAP ticker to Lenis rAF
      const updateTicker = (time: number) => {
        lenis.raf(time * 1000);
      };

      gsap.ticker.add(updateTicker);
      gsap.ticker.lagSmoothing(0);

      return () => {
        window.removeEventListener("load", handleWindowLoad);
        gsap.ticker.remove(updateTicker);
        lenis.destroy();
        lenisRef.current = null;
        setLenisInstance(null);
      };
    } catch (err) {
      console.warn("Lenis initialization error:", err);
    }
  }, []);

  return (
    <LenisContext.Provider value={{ lenis: lenisInstance, velocity }}>
      {children}
    </LenisContext.Provider>
  );
}
