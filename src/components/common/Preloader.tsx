"use client";

import React, { useEffect, useState, useRef } from "react";
import { gsap } from "gsap";

interface PreloaderProps {
  onComplete?: () => void;
}

export default function Preloader({ onComplete }: PreloaderProps) {
  const [count, setCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const topCurtainRef = useRef<HTMLDivElement | null>(null);
  const bottomCurtainRef = useRef<HTMLDivElement | null>(null);
  const nameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Respect reduced motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      setIsFinished(true);
      onComplete?.();
      return;
    }

    let current = 0;
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 4) + 1;
      if (current >= 100) {
        current = 100;
        clearInterval(interval);
        setCount(100);

        // Sequence preloader outro
        const tl = gsap.timeline({
          onComplete: () => {
            setIsFinished(true);
            onComplete?.();
          },
        });

        tl.to(nameRef.current, {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out",
        })
          .to(
            nameRef.current,
            {
              opacity: 0,
              y: -20,
              duration: 0.4,
              delay: 0.4,
              ease: "power2.in",
            }
          )
          .to(
            topCurtainRef.current,
            {
              yPercent: -100,
              duration: 0.85,
              ease: "expo.inOut",
            },
            "-=0.1"
          )
          .to(
            bottomCurtainRef.current,
            {
              yPercent: 100,
              duration: 0.85,
              ease: "expo.inOut",
            },
            "<"
          );
      } else {
        setCount(current);
      }
    }, 28);

    return () => clearInterval(interval);
  }, [onComplete]);

  if (isFinished) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col pointer-events-none select-none overflow-hidden"
    >
      {/* Top Half Curtain */}
      <div
        ref={topCurtainRef}
        className="w-full flex-1 bg-[#050505] border-b border-white/10 flex items-end justify-center pb-8"
      >
        <div
          ref={nameRef}
          className="opacity-0 translate-y-6 text-center transition-transform"
        >
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--accent)] mb-2">
            INITIALIZING SYSTEM · KTM 27.71°N 85.32°E
          </div>
          <div className="font-[family-name:var(--font-syne)] text-4xl sm:text-6xl font-extrabold tracking-tighter text-[#f5f5f3]">
            SEARON MAHARJAN
          </div>
        </div>
      </div>

      {/* Bottom Half Curtain */}
      <div
        ref={bottomCurtainRef}
        className="w-full flex-1 bg-[#050505] border-t border-white/10 flex items-start justify-center pt-8"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="font-mono text-3xl sm:text-5xl font-light text-[#f5f5f3] tracking-widest tabular-nums">
            {count.toString().padStart(3, "0")}
            <span className="text-[var(--accent)] text-lg sm:text-2xl ml-1">
              %
            </span>
          </div>
          <div className="font-mono text-[11px] text-[#8e8e93] tracking-widest uppercase">
            CALIBRATING REALTIME GRAPHICS
          </div>
        </div>
      </div>
    </div>
  );
}
