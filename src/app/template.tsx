"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ENTRANCE } from "@/lib/motion";

gsap.registerPlugin(ScrollTrigger);

export default function Template({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // A template remounts on every navigation: when this route leaves, every
  // ScrollTrigger of the page that left is killed (components revert their
  // own too; this is the backstop). Not getAll().kill(): the App Router
  // mounts the new route in the same commit, so its triggers already exist
  // by now. The old page's elements are out of the document, the new
  // page's are in, so that tells them apart.
  useEffect(() => {
    return () => {
      ScrollTrigger.getAll().forEach((t) => {
        const el = t.trigger as Element | undefined;
        if (el && !el.isConnected) t.kill(true);
      });
      requestAnimationFrame(() => ScrollTrigger.refresh());
    };
  }, []);

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
        ...ENTRANCE,
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
