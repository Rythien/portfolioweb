"use client";

import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import ChristenDitherHero from "@/components/canvas/ChristenDitherHero";

export default function Hero() {
  const containerRef = useRef<HTMLElement | null>(null);
  const line1Ref = useRef<HTMLDivElement | null>(null);
  const line2Ref = useRef<HTMLDivElement | null>(null);
  const [time, setTime] = useState<{ hours: string; minutes: string; seconds: string }>({
    hours: "21",
    minutes: "38",
    seconds: "00",
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kathmandu",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).formatToParts(now);

      const h = parts.find((p) => p.type === "hour")?.value || "21";
      const m = parts.find((p) => p.type === "minute")?.value || "38";
      const s = parts.find((p) => p.type === "second")?.value || "00";
      setTime({ hours: h, minutes: m, seconds: s });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!prefersReducedMotion && containerRef.current) {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          [line1Ref.current, line2Ref.current],
          { yPercent: 105 },
          { yPercent: 0, duration: 1.15, stagger: 0.12, ease: "power3.out" }
        );
      }, containerRef);

      return () => {
        clearInterval(interval);
        ctx.revert();
      };
    }

    return () => clearInterval(interval);
  }, []);

  return (
    <section
      ref={containerRef}
      id="hero"
      aria-label="Introduction"
      className="relative min-h-screen flex flex-col justify-between pt-16 overflow-hidden bg-[#050505]"
    >
      {/* Real christendijoux.com 3D Raymarched 8x8 Bayer Dither Sphere */}
      <ChristenDitherHero className="opacity-90" />

      {/* christendijoux.com 4-Column Editorial Metadata Strip */}
      <div className="relative z-10 w-full border-b border-white/[0.08] bg-[#050505]/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 py-3.5 grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-[11px] tracking-wider uppercase text-[#8e8b82]">
          <div>
            <div className="text-white font-medium">SEARON</div>
            <div className="text-[#8e8b82]/60">MAHARJAN</div>
          </div>
          <div>
            <div className="text-white font-medium">KATHMANDU</div>
            <div className="text-[#8e8b82]/60">NEPAL · 27.71°N 85.32°E</div>
          </div>
          <div className="hidden md:block">
            <div className="text-white font-medium">CREATIVE DEVELOPER</div>
            <div className="text-[#8e8b82]/60">FRONTEND &amp; REALTIME SHADERS</div>
          </div>
          <div className="text-right">
            <div className="text-[#8e8b82]/60">LOCAL TIME</div>
            <div className="text-white font-medium tabular-nums">
              <span>{time.hours}</span>
              <span className="animate-pulse">:</span>
              <span>{time.minutes}</span>
              <span className="animate-pulse">:</span>
              <span>{time.seconds}</span>
              <span className="text-[10px] text-[#8e8b82]/70 ml-1">NPT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Hero Typography Overlay */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 w-full flex-1 flex flex-col justify-center py-16 sm:py-20 pointer-events-none">
        <div className="max-w-2xl">
          <div className="font-mono text-xs uppercase tracking-widest text-[#8e8b82] mb-4 pointer-events-auto">
            [ PORTFOLIO · 2026 ]
          </div>

          <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(3.5rem,12vw,9.5rem)] leading-[0.88] tracking-[-0.015em] text-[#edebe6] select-none pointer-events-auto w-fit">
            <div className="overflow-hidden">
              <div ref={line1Ref}>Searon</div>
            </div>
            <div className="overflow-hidden">
              <div ref={line2Ref}>Maharjan</div>
            </div>
          </h1>

          <p className="mt-8 text-base sm:text-xl text-[#8e8b82] font-light leading-relaxed pointer-events-auto">
            Creative developer and frontend architect based in Kathmandu.
            Designing applications, realtime WebGL shaders, and high-performance digital systems.
          </p>

          <div className="mt-8 sm:mt-10 flex items-center gap-8 font-mono text-xs uppercase tracking-wider pointer-events-auto">
            <a
              href="#projects"
              className="px-5 py-3 bg-[#edebe6] text-[#050505] font-semibold hover:bg-white transition-colors"
            >
              SELECTED WORK ↓
            </a>
            <a
              href="#contact"
              className="px-5 py-3 border border-white/20 text-[#edebe6] hover:border-white transition-colors"
            >
              GET IN TOUCH →
            </a>
          </div>
        </div>
      </div>

      {/* Bottom of hero: thin line, scroll cue left, coordinates right */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 w-full pointer-events-none">
        <div className="border-t border-white/[0.08] py-5 flex items-center justify-between text-xs text-[#8e8b82] font-mono pointer-events-auto">
          <span>Scroll ↓</span>
          <span className="tracking-wider">27.7172° N · 85.3240° E · UTC+05:45</span>
        </div>
      </div>
    </section>
  );
}
