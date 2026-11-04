"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useLenis } from "@/components/common/LenisProvider";

export default function ManifestoBand() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const { velocity } = useLenis();
  const currentPos = useRef(0);
  const currentSkew = useRef(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    const baseSpeed = 1.2;
    let targetSkew = 0;

    const onTick = () => {
      // Dynamic velocity influence
      const vel = velocity || 0;
      const effectiveSpeed = baseSpeed + vel * 0.8;
      currentPos.current -= effectiveSpeed;

      // Wrap around seamless loop half width
      const totalWidth = track.scrollWidth / 2;
      if (Math.abs(currentPos.current) >= totalWidth) {
        currentPos.current = 0;
      }

      // Smooth skew calculation based on scroll velocity
      targetSkew = Math.max(-14, Math.min(14, vel * -0.5));
      currentSkew.current += (targetSkew - currentSkew.current) * 0.1;

      gsap.set(track, {
        x: currentPos.current,
        skewX: currentSkew.current,
      });
    };

    gsap.ticker.add(onTick);

    return () => {
      gsap.ticker.remove(onTick);
    };
  }, [velocity]);

  const phrase = "Design. Build. Ship. – ";
  const repeated = Array(6).fill(phrase);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="relative w-full overflow-hidden border-y border-white/[0.12] bg-[#050505] py-8 sm:py-12 select-none"
    >
      <div
        ref={trackRef}
        className="flex whitespace-nowrap will-change-transform"
      >
        {repeated.map((text, idx) => (
          <span
            key={idx}
            className="inline-block font-[family-name:var(--font-display)] text-display tracking-tight text-[#edebe6]/90 pr-8 uppercase font-light"
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
