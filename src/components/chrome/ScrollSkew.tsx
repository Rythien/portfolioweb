"use client";

import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { QUICK, VELOCITY, prefersReducedMotion } from "@/lib/motion";
import { getVelocity } from "@/lib/scroll";

gsap.registerPlugin(useGSAP);

const clampSkew = gsap.utils.clamp(-VELOCITY.skewMax, VELOCITY.skewMax);

/**
 * Moment 5: section content leans with scroll velocity. Every [data-skew]
 * block shares one eased value, clamped to VELOCITY.skewMax degrees, which
 * settles back to 0 on the QUICK curve when scrolling stops. Off under
 * reduced motion (and there is no Lenis velocity then anyway).
 */
export default function ScrollSkew() {
  useGSAP(() => {
    if (prefersReducedMotion()) return;
    const targets = gsap.utils.toArray<HTMLElement>("[data-skew]");
    if (!targets.length) return;

    const setters = targets.map((t) => gsap.quickSetter(t, "skewY", "deg"));
    const state = { skew: 0 };
    const toSkew = gsap.quickTo(state, "skew", {
      ...QUICK,
      onUpdate: () => setters.forEach((set) => set(state.skew)),
    });

    const tick = () => {
      toSkew(clampSkew(getVelocity() * VELOCITY.skewPerPx));
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      gsap.set(targets, { clearProps: "transform" });
    };
  });

  return null;
}
