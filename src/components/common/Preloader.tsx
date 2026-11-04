"use client";

import React, { useEffect, useState, useRef } from "react";
import { gsap } from "gsap";

interface PreloaderProps {
  onComplete?: () => void;
}

export default function Preloader({ onComplete }: PreloaderProps) {
  const [count, setCount] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nameLine1Ref = useRef<HTMLSpanElement | null>(null);
  const nameLine2Ref = useRef<HTMLSpanElement | null>(null);
  const metaLineRef = useRef<HTMLDivElement | null>(null);
  const counterSlotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Check if previously visited in this session or test flag
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
      // Ignore storage errors in private browsing
    }

    // Check reduced motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      try {
        sessionStorage.setItem("searon_preloader_seen", "1");
      } catch {}
      queueMicrotask(() => {
        setIsDone(true);
        onComplete?.();
      });
      return;
    }

    // Animate counter 000 -> 100
    let current = 0;
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 5) + 2;
      if (current >= 100) {
        current = 100;
        clearInterval(interval);
        setCount(100);

        // Sequence masked lines reveal
        const tl = gsap.timeline({
          onComplete: () => {
            try {
              sessionStorage.setItem("searon_preloader_seen", "1");
            } catch {}
            setIsDone(true);
            onComplete?.();
          },
        });

        // 1. Fade the counter slot slightly
        tl.to(counterSlotRef.current, {
          opacity: 0.35,
          duration: 0.3,
          ease: "power2.out",
        })
          // 2. Reveal masked name lines
          .fromTo(
            [nameLine1Ref.current, nameLine2Ref.current],
            { yPercent: 110 },
            {
              yPercent: 0,
              duration: 0.75,
              stagger: 0.12,
              ease: "power3.out",
            },
            "-=0.1"
          )
          .fromTo(
            metaLineRef.current,
            { opacity: 0, y: 10 },
            {
              opacity: 1,
              y: 0,
              duration: 0.5,
              ease: "power2.out",
            },
            "-=0.4"
          )
          // 3. Pause for comprehension
          .to({}, { duration: 0.5 })
          // 4. Slide out curtain smoothly
          .to(containerRef.current, {
            yPercent: -100,
            duration: 0.85,
            ease: "power4.inOut",
          });
      } else {
        setCount(current);
      }
    }, 24);

    return () => clearInterval(interval);
  }, [onComplete]);

  if (isDone) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[1000] bg-[#08080a] text-[#f2efe9] flex flex-col justify-between p-6 sm:p-10 lg:p-16 select-none overflow-hidden"
      aria-live="polite"
      aria-label="Loading portfolio"
    >
      {/* Top Left Monospace Counter */}
      <div
        ref={counterSlotRef}
        className="font-mono text-xs uppercase tracking-widest flex items-center gap-3 text-[#edebe6]/80"
      >
        <span className="w-2 h-2 rounded-full bg-[#edebe6] animate-pulse" />
        <span className="tabular-nums">
          SYSTEM LOAD · {count.toString().padStart(3, "0")} / 100
        </span>
      </div>

      {/* Top Right Reference Meta */}
      <div className="font-mono text-label uppercase tracking-widest text-[#edebe6]/75 text-right hidden sm:block tabular-nums">
        KTM 27.7172° N · 85.3240° E
      </div>

      {/* Center Masked Name Reveal */}
      <div className="my-auto max-w-4xl">
        <div className="overflow-hidden py-[0.1em] -my-[0.1em]">
          <span
            ref={nameLine1Ref}
            className="block font-[family-name:var(--font-display)] text-display tracking-[-0.035em] leading-[1.05] font-light translate-y-[110%]"
          >
            Searon
          </span>
        </div>
        <div className="overflow-hidden mt-1 sm:mt-2 py-[0.1em] -my-[0.1em]">
          <span
            ref={nameLine2Ref}
            className="block font-[family-name:var(--font-display)] text-display tracking-[-0.035em] leading-[1.05] font-light italic translate-y-[110%]"
          >
            Maharjan
          </span>
        </div>
        <div
          ref={metaLineRef}
          className="mt-6 font-mono text-label uppercase tracking-widest text-[#edebe6]/75 opacity-0"
        >
          Website & App Designer · Kathmandu
        </div>
      </div>

      {/* Bottom Bar: Status */}
      <div className="flex items-center justify-between border-t border-white/[0.08] pt-4 font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
        <span>PORTFOLIO © 2026</span>
        <span>TWO-TONE · NO ASSET OVERHEAD</span>
      </div>
    </div>
  );
}
