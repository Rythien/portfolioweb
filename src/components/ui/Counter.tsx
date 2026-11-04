"use client";

import React, { useEffect, useRef, useState } from "react";

interface CounterProps {
  value: number;
  duration?: number;
  padDigits?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export default function Counter({
  value,
  duration = 1.6,
  padDigits = 2,
  prefix = "",
  suffix = "",
  className = "",
}: CounterProps) {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      queueMicrotask(() => {
        setDisplayValue(value);
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;

          const startTime = performance.now();
          const totalDuration = duration * 1000;

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / totalDuration, 1);
            // Cubic out easing curve
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(easedProgress * value);

            setDisplayValue(current);

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              setDisplayValue(value);
            }
          };

          requestAnimationFrame(animate);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [value, duration]);

  const formattedNumber = displayValue.toString().padStart(padDigits, "0");

  return (
    <span
      ref={containerRef}
      className={`font-mono tabular-nums select-none ${className}`}
    >
      {prefix}
      {formattedNumber}
      {suffix}
    </span>
  );
}
