"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useScrollStore, setSectionProgress } from "@/store/useScrollStore";

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

const SECTION_IDS = ["top", "about", "disciplines", "works", "recognition", "contact"];

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

      lenis.on(
        "scroll",
        (e: { velocity: number; progress: number; direction: number }) => {
          ScrollTrigger.update();
          setVelocity(e.velocity || 0);
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
    <LenisContext.Provider value={{ lenis: lenisInstance, velocity }}>
      {children}
    </LenisContext.Provider>
  );
}
