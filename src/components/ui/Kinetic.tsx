"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface KineticHeadingProps {
  children: string;
  as?: "h1" | "h2" | "h3" | "span" | "div";
  className?: string;
  minWeight?: number;
  maxWeight?: number;
  radius?: number;
  stagger?: number;
}

export function useProximityWeight(
  containerRef: React.RefObject<HTMLElement | null>,
  radius = 160,
  minWeight = 300,
  maxWeight = 700
) {
  useEffect(() => {
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isFinePointer || isReduced) return;

    const container = containerRef.current;
    if (!container) return;

    const letters = container.querySelectorAll<HTMLElement>("[data-kinetic-char]");
    if (!letters.length) return;

    let mouseX = -1000;
    let mouseY = -1000;
    let isMoving = false;
    let idleTimeout: NodeJS.Timeout;
    let animId: number;

    const weights = new Float32Array(letters.length).fill(minWeight);
    const targetWeights = new Float32Array(letters.length).fill(minWeight);

    // Pre-calculate letter center positions
    let letterRects: { x: number; y: number }[] = [];
    const measure = () => {
      letterRects = Array.from(letters).map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      });
    };

    measure();
    window.addEventListener("resize", measure, { passive: true });
    window.addEventListener("scroll", measure, { passive: true });

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      isMoving = true;

      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        isMoving = false;
      }, 300);
    };

    const updateWeights = () => {
      if (isMoving) {
        for (let i = 0; i < letterRects.length; i++) {
          const dx = mouseX - letterRects[i].x;
          const dy = mouseY - letterRects[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < radius) {
            const factor = 1 - dist / radius;
            targetWeights[i] = minWeight + (maxWeight - minWeight) * Math.pow(factor, 1.8);
          } else {
            targetWeights[i] = minWeight;
          }
        }
      } else {
        for (let i = 0; i < targetWeights.length; i++) {
          targetWeights[i] = minWeight;
        }
      }

      // Smooth interpolation
      for (let i = 0; i < letters.length; i++) {
        const diff = targetWeights[i] - weights[i];
        if (Math.abs(diff) > 0.5) {
          weights[i] += diff * 0.2;
          letters[i].style.fontVariationSettings = `'wght' ${Math.round(weights[i])}`;
        }
      }

      animId = requestAnimationFrame(updateWeights);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    animId = requestAnimationFrame(updateWeights);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      cancelAnimationFrame(animId);
      clearTimeout(idleTimeout);
    };
  }, [containerRef, radius, minWeight, maxWeight]);
}

export default function KineticHeading({
  children,
  as: Component = "h2",
  className = "",
  minWeight = 300,
  maxWeight = 700,
  radius = 180,
  stagger = 0.02,
}: KineticHeadingProps) {
  const containerRef = useRef<HTMLElement | null>(null);

  useProximityWeight(containerRef, radius, minWeight, maxWeight);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chars = el.querySelectorAll<HTMLElement>("[data-kinetic-char]");
    if (!chars.length) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      gsap.set(chars, { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      // Hide only after GSAP is ready to animate
      gsap.set(chars, { opacity: 0, y: 14 });

      gsap.to(chars, {
        opacity: 1,
        y: 0,
        duration: 0.65,
        stagger,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: "top 90%",
          toggleActions: "play none none none",
          once: true,
          fastScrollEnd: true,
        },
      });
    }, el);

    return () => ctx.revert();
  }, [stagger]);

  const words = children.split(" ");

  return (
    <Component
      ref={containerRef as React.RefObject<HTMLHeadingElement>}
      className={`font-[family-name:var(--font-display)] relative leading-[1.1] tracking-tight [text-wrap:balance] ${className}`}
    >
      <span className="sr-only">{children}</span>
      <span aria-hidden="true" className="block select-none overflow-visible">
        {words.map((word, wIdx) => (
          <span
            key={wIdx}
            className="inline-block whitespace-nowrap mr-[0.28em] py-[0.22em] -my-[0.22em] overflow-visible"
          >
            {word.split("").map((char, cIdx) => (
              <span key={cIdx} className="inline-block overflow-visible">
                <span
                  data-kinetic-char
                  className="inline-block transition-[font-variation-settings] duration-75 will-change-transform will-change-opacity"
                  style={{ fontVariationSettings: `'wght' ${minWeight}` }}
                >
                  {char}
                </span>
              </span>
            ))}
          </span>
        ))}
      </span>
    </Component>
  );
}
