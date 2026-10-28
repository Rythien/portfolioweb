"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";

export default function Hero() {
  const containerRef = useRef<HTMLElement | null>(null);
  const line1Ref = useRef<HTMLDivElement | null>(null);
  const line2Ref = useRef<HTMLDivElement | null>(null);
  const sublineRef = useRef<HTMLParagraphElement | null>(null);
  const linksRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from([line1Ref.current, line2Ref.current], {
        yPercent: 105,
        duration: 1.1,
        stagger: 0.12,
      })
        .from(
          sublineRef.current,
          {
            opacity: 0,
            y: 16,
            duration: 0.8,
          },
          "-=0.6"
        )
        .from(
          linksRef.current,
          {
            opacity: 0,
            y: 12,
            duration: 0.8,
          },
          "-=0.6"
        );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      id="hero"
      aria-label="Introduction"
      className="min-h-[85vh] flex flex-col justify-center max-w-6xl mx-auto px-6 sm:px-8 pt-24 pb-16"
    >
      {/* Monumental Name */}
      <h1 className="font-[family-name:var(--font-display)] font-normal text-[clamp(3.25rem,11vw,9rem)] leading-[0.92] tracking-[-0.01em] text-[#edebe6] select-none">
        <div className="overflow-hidden">
          <div ref={line1Ref}>Searon</div>
        </div>
        <div className="overflow-hidden">
          <div ref={line2Ref}>Maharjan</div>
        </div>
      </h1>

      {/* One plain line with role + city */}
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
    </section>
  );
}
