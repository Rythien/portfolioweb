"use client";

import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import HeroOGLCanvas from "@/components/canvas/HeroOGLCanvas";

export default function Hero() {
  const containerRef = useRef<HTMLElement | null>(null);
  const line1Ref = useRef<HTMLDivElement | null>(null);
  const line2Ref = useRef<HTMLDivElement | null>(null);
  const sublineRef = useRef<HTMLParagraphElement | null>(null);
  const linksRef = useRef<HTMLDivElement | null>(null);
  const bottomBarRef = useRef<HTMLDivElement | null>(null);
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    // Live Kathmandu time (NPT, UTC+5:45)
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

    // Staggered masked reveal on load
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!prefersReducedMotion && containerRef.current) {
      const ctx = gsap.context(() => {
        const tl = gsap.timeline({
          defaults: { ease: "power3.out" },
          delay: 0.1,
        });

        tl.fromTo(
          [line1Ref.current, line2Ref.current],
          { yPercent: 105 },
          { yPercent: 0, duration: 1.15, stagger: 0.14 }
        )
          .fromTo(
            sublineRef.current,
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: 0.8 },
            "-=0.55"
          )
          .fromTo(
            linksRef.current,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.75 },
            "-=0.55"
          )
          .fromTo(
            bottomBarRef.current,
            { opacity: 0 },
            { opacity: 1, duration: 0.85 },
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
      aria-label="Introduction"
      className="relative min-h-screen flex flex-col justify-between pt-20 overflow-hidden"
    >
      {/* Lightweight OGL WebGL Grain/Ripple Background */}
      <HeroOGLCanvas />

      {/* Main hero content - shares exact same max-w-6xl and px with Header */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 lg:px-12 w-full flex-1 flex flex-col justify-center py-12 sm:py-16">
        {/* Monumental Name: fills ~60-70% of container width, never clips */}
        <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(3.45rem,15.2vw,11.25rem)] leading-[0.88] tracking-[-0.015em] text-[#edebe6] select-none">
          <div className="overflow-hidden">
            <div ref={line1Ref}>Searon</div>
          </div>
          <div className="overflow-hidden">
            <div ref={line2Ref}>Maharjan</div>
          </div>
        </h1>

        {/* Subtitle */}
        <p
          ref={sublineRef}
          className="mt-8 sm:mt-10 text-base sm:text-lg text-[#8e8b82] font-normal"
        >
          Frontend developer based in Kathmandu.
        </p>

        {/* Two plain links */}
        <div
          ref={linksRef}
          className="mt-8 sm:mt-10 flex items-center gap-8 text-sm"
        >
          <a
            href="#work"
            className="text-[#edebe6] underline underline-offset-4 decoration-white/20 hover:decoration-white transition-colors"
          >
            Selected work ↓
          </a>
          <a
            href="#contact"
            className="text-[#8e8b82] hover:text-[#edebe6] transition-colors"
          >
            Get in touch →
          </a>
        </div>
      </div>

      {/* Bottom of hero: thin line, scroll cue left, live Kathmandu time right */}
      <div
        ref={bottomBarRef}
        className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 lg:px-12 w-full"
      >
        <div className="border-t border-white/[0.08] py-5 flex items-center justify-between text-xs text-[#8e8b82]">
          <span>Scroll ↓</span>
          <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-wider">
            Kathmandu {time ? `${time} NPT` : "20:51 NPT"}
          </span>
        </div>
      </div>
    </section>
  );
}
