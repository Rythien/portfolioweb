"use client";

import React, { useEffect, useState, useRef } from "react";
import { gsap } from "gsap";
import { setIntroBreak, crystalEvents } from "@/hooks/useCrystalPose";

interface PreloaderProps {
  onComplete?: () => void;
}

const REVEAL_SELECTOR = "#main-content, [data-reveal]";

/**
 * Intro: the crystal's shards gather into the intact crystal (introBreak
 * 1 → 0 through the existing fracture system) behind a transparent
 * overlay while a mono counter runs 000 → 100. The page chrome and
 * sections reveal once assembled. Reduced motion: a plain fade.
 */
export default function Preloader({ onComplete }: PreloaderProps) {
  const [count, setCount] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [transparent, setTransparent] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const alreadySeen = sessionStorage.getItem("searon_preloader_seen");
      if (alreadySeen || urlParams.get("nopreload") === "1") {
        queueMicrotask(() => {
          setIsDone(true);
          onComplete?.();
        });
        return;
      }
    } catch {
      // Ignore storage errors
    }

    const finish = () => {
      try {
        sessionStorage.setItem("searon_preloader_seen", "1");
      } catch {}
      setIsDone(true);
      onComplete?.();
    };

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      // Simple fade: opaque surface overlay out, no gather.
      setCount(100);
      const tween = gsap.to(containerRef.current, {
        autoAlpha: 0,
        duration: 0.6,
        delay: 0.4,
        ease: "power2.out",
        onComplete: finish,
      });
      return () => {
        tween.kill();
      };
    }

    // Hide the page content first, then let the canvas show through the
    // overlay so the gather is visible while the counter runs.
    gsap.set(REVEAL_SELECTOR, { autoAlpha: 0 });
    setTransparent(true);

    // Shards start fully broken and gather over ~1.6s.
    setIntroBreak(1);
    const gatherObj = { v: 1 };
    const counterObj = { v: 0 };

    const tl = gsap.timeline({ paused: true, onComplete: finish });

    // Start once the scene has rendered a frame, so the gather is
    // actually visible; cap the wait at 4s for slow devices.
    let rafId = 0;
    const waitStart = performance.now();
    const waitForScene = () => {
      if (crystalEvents.sceneReady || performance.now() - waitStart > 4000) {
        tl.play();
      } else {
        rafId = requestAnimationFrame(waitForScene);
      }
    };
    rafId = requestAnimationFrame(waitForScene);

    tl.to(
      counterObj,
      {
        v: 100,
        duration: 1.5,
        ease: "power1.inOut",
        onUpdate: () => setCount(Math.round(counterObj.v)),
      },
      0
    )
      .to(
        gatherObj,
        {
          v: 0,
          duration: 1.6,
          ease: "power3.inOut",
          onUpdate: () => setIntroBreak(gatherObj.v),
        },
        0
      )
      // Counter slot out, then the page reveals around the settled crystal
      .to(containerRef.current, { autoAlpha: 0, duration: 0.4, ease: "power2.out" }, 1.7)
      .to(
        REVEAL_SELECTOR,
        {
          autoAlpha: 1,
          duration: 0.8,
          ease: "expo.out",
          stagger: 0.08,
        },
        1.8
      );

    return () => {
      cancelAnimationFrame(rafId);
      tl.kill();
      setIntroBreak(0);
      gsap.set(REVEAL_SELECTOR, { clearProps: "opacity,visibility" });
    };
  }, [onComplete]);

  if (isDone) return null;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[1000] text-ink flex flex-col justify-end p-6 sm:p-10 lg:p-16 select-none overflow-hidden pointer-events-none ${
        transparent ? "" : "bg-surface"
      }`}
      aria-live="polite"
      aria-label="Loading portfolio"
    >
      <div className="flex items-end justify-between font-mono text-label text-ink/80">
        <span className="tabular-nums text-2xl sm:text-3xl font-medium">
          {count.toString().padStart(3, "0")}
        </span>
        <span>Assembling</span>
      </div>
    </div>
  );
}
