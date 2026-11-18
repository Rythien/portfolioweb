"use client";

import React, { useEffect, useState, useRef } from "react";
import { gsap } from "gsap";
import { DURATION, EASE, STAGGER, counterTo } from "@/lib/motion";
import { setIntroBreak, crystalEvents } from "@/hooks/crystalState";
import { markIntroDone } from "@/store/useIntroStore";

/** Counter digits: 000 -> 100. */
const PAD = 3;

interface PreloaderProps {
  onComplete?: () => void;
}

/** What the preloader holds back and fades in once the crystal has gathered. */
const REVEAL_SELECTOR = "#main-content, [data-intro]";

/**
 * Intro: the crystal's shards gather into the intact crystal (introBreak
 * 1 → 0 through the existing fracture system) behind a transparent
 * overlay while a mono counter runs 000 → 100. The page chrome and
 * sections reveal once assembled. Reduced motion: a plain fade.
 */
export default function Preloader({ onComplete }: PreloaderProps) {
  const [isDone, setIsDone] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // counterTo writes the digits straight into this span (no state per frame)
  const countRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const alreadySeen = sessionStorage.getItem("searon_preloader_seen");
      if (alreadySeen || urlParams.get("nopreload") === "1") {
        queueMicrotask(() => {
          setIsDone(true);
          markIntroDone();
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
      markIntroDone();
      onComplete?.();
    };

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      // Simple fade: opaque surface overlay out, no gather.
      if (countRef.current) countRef.current.textContent = "100";
      const tween = gsap.to(containerRef.current, {
        autoAlpha: 0,
        duration: DURATION.quick,
        delay: DURATION.quick,
        ease: EASE.state,
        onComplete: finish,
      });
      return () => {
        tween.kill();
      };
    }

    // Hide the page content first, then let the canvas show through the
    // overlay so the gather is visible while the counter runs.
    gsap.set(REVEAL_SELECTOR, { autoAlpha: 0 });
    // The overlay starts opaque (server HTML); drop its fill directly
    // rather than through state, which would re-render from the effect
    gsap.set(containerRef.current, { backgroundColor: "transparent" });

    // Shards start fully broken and gather over the grand duration.
    setIntroBreak(1);
    const gatherObj = { v: 1 };

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

    // Counter and gather run together as one state change (broken ->
    // whole); then the counter slot leaves and the page arrives around the
    // settled crystal, crossfading
    tl.addLabel("gather", 0)
      .add(
        counterTo(countRef.current, 100, {
          pad: PAD,
          duration: DURATION.grand,
          ease: EASE.state,
        }),
        "gather"
      )
      .to(
        gatherObj,
        {
          v: 0,
          duration: DURATION.grand,
          ease: EASE.state,
          onUpdate: () => setIntroBreak(gatherObj.v),
        },
        "gather"
      )
      .addLabel("settled")
      // The hero entrance starts as the counter slot leaves
      .call(markIntroDone, undefined, "settled")
      .to(
        containerRef.current,
        { autoAlpha: 0, duration: DURATION.quick, ease: EASE.state },
        "settled"
      )
      .to(
        REVEAL_SELECTOR,
        {
          autoAlpha: 1,
          duration: DURATION.standard,
          ease: EASE.entrance,
          stagger: STAGGER.standard,
        },
        "settled"
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
      className={`fixed inset-0 z-[1000] text-ink flex flex-col justify-end p-6 sm:p-10 lg:p-16 select-none overflow-hidden pointer-events-none bg-surface`}
      aria-live="polite"
      aria-label="Loading portfolio"
    >
      <div className="flex items-end justify-between font-mono text-label text-ink/80">
        <span ref={countRef} className="tabular-nums text-2xl sm:text-3xl font-medium">
          {"0".repeat(PAD)}
        </span>
        <span>Assembling</span>
      </div>
    </div>
  );
}
