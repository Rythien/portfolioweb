"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DURATION, counterTo } from "@/lib/motion";

gsap.registerPlugin(ScrollTrigger);

interface CounterProps {
  value: number;
  /** A duration token; defaults to grand (a count is a theatrical build). */
  duration?: number;
  padDigits?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * Counts up once when it scrolls into view. counterTo writes the digits
 * straight into the span, so nothing re-renders per frame.
 */
export default function Counter({
  value,
  duration = DURATION.grand,
  padDigits = 2,
  prefix = "",
  suffix = "",
  className = "",
}: CounterProps) {
  const numberRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = numberRef.current;
    if (!el) return;
    const tl = counterTo(el, value, {
      pad: padDigits,
      duration,
      trigger: el,
      scrollTrigger: { once: true, toggleActions: "play none none none" },
    });
    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [value, duration, padDigits]);

  return (
    <span className={`font-mono tabular-nums select-none ${className}`}>
      {prefix}
      <span ref={numberRef}>{"0".repeat(padDigits)}</span>
      {suffix}
    </span>
  );
}
