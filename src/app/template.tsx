"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";

export default function Template({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    // Fade transition between routes with guaranteed cleanup of all inline styles.
    // Crucial: Never leave CSS transforms on this container because transforms
    // break CSS position:fixed for pinned ScrollTrigger elements (Journey, Projects).
    const tween = gsap.fromTo(
      el,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.35,
        ease: "power2.out",
        clearProps: "all",
      }
    );

    return () => {
      tween.kill();
      if (el) {
        gsap.set(el, { clearProps: "all" });
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      {children}
    </div>
  );
}
