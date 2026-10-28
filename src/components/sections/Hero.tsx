"use client";

import React, { useEffect, useRef, useState } from "react";
import HeroCanvas from "@/components/canvas/HeroCanvas";
import { PORTFOLIO_DATA } from "@/data/portfolio";
import { gsap } from "gsap";

export default function Hero() {
  const containerRef = useRef<HTMLElement | null>(null);
  const title1Ref = useRef<HTMLHeadingElement | null>(null);
  const title2Ref = useRef<HTMLHeadingElement | null>(null);
  const metaRef = useRef<HTMLDivElement | null>(null);
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    // Live local time
    const updateTime = () => {
      const now = new Date();
      setTime(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kathmandu",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(now)
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    // GSAP text reveal
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!prefersReducedMotion) {
      const ctx = gsap.context(() => {
        const tl = gsap.timeline({ delay: 0.2 });
        tl.from([title1Ref.current, title2Ref.current], {
          y: 80,
          opacity: 0,
          duration: 1.1,
          stagger: 0.12,
          ease: "power3.out",
        }).from(
          metaRef.current,
          {
            opacity: 0,
            y: 20,
            duration: 0.8,
            ease: "power2.out",
          },
          "-=0.5"
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
      aria-label="Hero Overview"
      className="relative min-h-[94vh] flex flex-col justify-between pt-24 pb-12 sm:pb-16 overflow-hidden hairline-b"
    >
      {/* Interactive WebGL / Canvas Background */}
      <HeroCanvas />

      {/* Architectural Corner Alignment Markers */}
      <div className="pointer-events-none absolute top-20 left-4 sm:left-8 font-mono text-[10px] text-white/20">
        + 27.7172°N
      </div>
      <div className="pointer-events-none absolute top-20 right-4 sm:right-8 font-mono text-[10px] text-white/20">
        + 85.3240°E
      </div>

      {/* Top Metadata Strip */}
      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 w-full pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 border-b border-white/10 font-mono text-xs tracking-wider text-[var(--text-secondary)]">
          <div>
            <span className="block text-[10px] text-[var(--text-muted)] uppercase mb-1">
              LOCATION
            </span>
            <span className="text-[var(--text-primary)]">KATHMANDU, NEPAL</span>
          </div>

          <div>
            <span className="block text-[10px] text-[var(--text-muted)] uppercase mb-1">
              LOCAL TIME
            </span>
            <span className="text-[var(--accent)] font-semibold">
              {time ? `${time} NPT` : "19:07:26 NPT"}
            </span>
          </div>

          <div className="hidden md:block">
            <span className="block text-[10px] text-[var(--text-muted)] uppercase mb-1">
              SPECIALIZATION
            </span>
            <span className="text-[var(--text-primary)]">REALTIME &amp; SHADERS</span>
          </div>

          <div className="hidden md:block text-right">
            <span className="block text-[10px] text-[var(--text-muted)] uppercase mb-1">
              AVAILABILITY
            </span>
            <span className="text-[var(--text-primary)]">SELECT CONTRACTS</span>
          </div>
        </div>
      </div>

      {/* Monumental Display Name & Role */}
      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 w-full my-auto py-8">
        <div className="overflow-hidden">
          <h1
            ref={title1Ref}
            className="font-[family-name:var(--font-syne)] text-[12vw] sm:text-[10vw] lg:text-[8.5vw] font-extrabold leading-[0.88] tracking-tighter text-[var(--text-primary)] uppercase select-none"
          >
            SEARON
          </h1>
        </div>

        <div className="overflow-hidden flex flex-col md:flex-row md:items-baseline justify-between gap-4">
          <h1
            ref={title2Ref}
            className="font-[family-name:var(--font-syne)] text-[12vw] sm:text-[10vw] lg:text-[8.5vw] font-extrabold leading-[0.88] tracking-tighter text-[var(--accent)] uppercase select-none"
          >
            MAHARJAN
          </h1>

          <div className="md:max-w-xs font-mono text-xs sm:text-sm text-[var(--text-secondary)] uppercase tracking-wider md:text-right pb-2">
            [ CREATIVE DEVELOPER &amp; FRONTEND ARCHITECT ]
          </div>
        </div>
      </div>

      {/* Bottom Mission Statement & Navigation Anchors */}
      <div
        ref={metaRef}
        className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 w-full"
      >
        <div className="pt-6 border-t border-white/10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <p className="max-w-xl text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed font-normal">
            Synthesizing Newari geometric heritage with high-order browser engineering.
            Crafting tactile WebGL shaders, fluid motion, and resilient digital architectures.
          </p>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono text-xs">
            <a
              href="#projects"
              data-cursor-text="VIEW"
              className="group inline-flex items-center gap-3 px-5 py-3 bg-[var(--accent)] text-white font-semibold uppercase tracking-widest transition-all duration-300 hover:bg-white hover:text-black"
            >
              <span>SELECTED PROJECTS</span>
              <span className="transition-transform duration-300 group-hover:translate-y-0.5">
                ↓
              </span>
            </a>

            <a
              href="#contact"
              className="inline-flex items-center gap-2 px-5 py-3 border border-white/20 text-[var(--text-primary)] uppercase tracking-widest hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors duration-200"
            >
              <span>INITIATE CONTACT</span>
              <span>→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
