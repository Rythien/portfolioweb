"use client";

import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const reticleRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const [cursorLabel, setCursorLabel] = useState<string>("");
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // Check fine pointer and reduced motion preference
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    const isReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!isFinePointer || isReducedMotion) {
      return;
    }

    const dot = dotRef.current;
    const reticle = reticleRef.current;
    if (!dot || !reticle) return;

    // Enable custom cursor styles on body
    document.body.classList.add("has-custom-cursor");
    setIsActive(true);

    // Initial positioning off-screen
    gsap.set([dot, reticle], { xPercent: -50, yPercent: -50, x: -100, y: -100 });

    // GSAP quickTo for two different speeds (snappy dot, lagging reticle)
    const xDot = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power3.out" });
    const yDot = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power3.out" });

    const xReticle = gsap.quickTo(reticle, "x", {
      duration: 0.38,
      ease: "power3.out",
    });
    const yReticle = gsap.quickTo(reticle, "y", {
      duration: 0.38,
      ease: "power3.out",
    });

    let currentMagneticEl: HTMLElement | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX: mx, clientY: my } = e;
      xDot(mx);
      yDot(my);
      xReticle(mx);
      yReticle(my);

      // Magnetic handling if hovering over an element with data-magnetic
      if (currentMagneticEl) {
        const rect = currentMagneticEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const deltaX = (mx - centerX) * 0.32;
        const deltaY = (my - centerY) * 0.32;

        gsap.to(currentMagneticEl, {
          x: deltaX,
          y: deltaY,
          duration: 0.25,
          ease: "power2.out",
          overwrite: "auto",
        });
      }
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Check magnetic target
      const magneticTarget = target.closest("[data-magnetic]") as HTMLElement | null;
      if (magneticTarget) {
        currentMagneticEl = magneticTarget;
      }

      // Check cursor label
      const cursorTarget = target.closest("[data-cursor]") as HTMLElement | null;
      const interactiveTarget = target.closest("a, button, [role='button']");

      if (cursorTarget) {
        const label = cursorTarget.getAttribute("data-cursor") || "";
        setCursorLabel(label);
        gsap.to(reticle, {
          width: 76,
          height: 76,
          backgroundColor: "rgba(237, 235, 230, 0.12)",
          borderColor: "rgba(237, 235, 230, 0.6)",
          duration: 0.3,
          ease: "power2.out",
        });
        gsap.to(dot, { opacity: 0, scale: 0, duration: 0.2 });
      } else if (interactiveTarget) {
        setCursorLabel("");
        gsap.to(reticle, {
          width: 48,
          height: 48,
          backgroundColor: "rgba(237, 235, 230, 0.08)",
          borderColor: "rgba(237, 235, 230, 0.45)",
          duration: 0.25,
          ease: "power2.out",
        });
        gsap.to(dot, { scale: 1.4, duration: 0.2 });
      } else {
        setCursorLabel("");
        gsap.to(reticle, {
          width: 34,
          height: 34,
          backgroundColor: "transparent",
          borderColor: "rgba(237, 235, 230, 0.25)",
          duration: 0.3,
          ease: "power2.out",
        });
        gsap.to(dot, { opacity: 1, scale: 1, duration: 0.2 });
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const magneticTarget = target.closest("[data-magnetic]") as HTMLElement | null;
      if (magneticTarget && magneticTarget === currentMagneticEl) {
        gsap.to(magneticTarget, {
          x: 0,
          y: 0,
          duration: 0.6,
          ease: "elastic.out(1, 0.4)",
          overwrite: "auto",
        });
        currentMagneticEl = null;
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseover", handleMouseOver, { passive: true });
    document.addEventListener("mouseout", handleMouseOut, { passive: true });

    return () => {
      document.body.classList.remove("has-custom-cursor");
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
      if (currentMagneticEl) {
        gsap.killTweensOf(currentMagneticEl);
      }
    };
  }, []);

  if (!isActive) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
    >
      {/* Precision center dot */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 w-1.5 h-1.5 rounded-full bg-[#edebe6] -translate-x-1/2 -translate-y-1/2"
      />

      {/* Lagging interactive reticle */}
      <div
        ref={reticleRef}
        className="fixed top-0 left-0 w-8 h-8 rounded-full border border-[#edebe6]/25 flex items-center justify-center -translate-x-1/2 -translate-y-1/2 transition-colors duration-200 pointer-events-none"
      >
        {cursorLabel && (
          <span
            ref={labelRef}
            className="font-mono text-label uppercase tracking-widest text-[#edebe6] select-none text-center px-1 font-semibold leading-tight"
          >
            {cursorLabel}
          </span>
        )}
      </div>
    </div>
  );
}
