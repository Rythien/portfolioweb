"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import KineticHeading from "@/components/ui/Kinetic";
import RealAsciiGlobe from "@/components/webgl/RealAsciiGlobe";
import { places, KATHMANDU, haversineDistanceKm } from "@/content/globe";

gsap.registerPlugin(ScrollTrigger);

export default function Journey() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [currentKm, setCurrentKm] = useState(0);

  const handlePlaceChange = useCallback((index: number, km: number) => {
    setActiveIdx(index);
    setCurrentKm(km);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      queueMicrotask(() => {
        setScrollProgress(1);
      });
      return;
    }

    const mm = gsap.matchMedia();

    // Desktop: Pinned scroll through the 7 places
    mm.add("(min-width: 1024px)", () => {
      const trigger = ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "+=220%",
        pin: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
        fastScrollEnd: true,
        onUpdate: (self) => {
          setScrollProgress(self.progress);
        },
      });

      return () => trigger.kill();
    });

    // Mobile: Not pinned, scroll still advances active place
    mm.add("(max-width: 1023px)", () => {
      const trigger = ScrollTrigger.create({
        trigger: el,
        start: "top 75%",
        end: "bottom 25%",
        scrub: true,
        invalidateOnRefresh: true,
        fastScrollEnd: true,
        onUpdate: (self) => {
          setScrollProgress(self.progress);
        },
      });

      return () => trigger.kill();
    });

    return () => mm.revert();
  }, []);

  const activePlace = places[activeIdx] || places[0];
  const latStr = `${Math.abs(activePlace.lat).toFixed(2)} ${
    activePlace.lat >= 0 ? "N" : "S"
  }`;
  const lonStr = `${Math.abs(activePlace.lon).toFixed(2)} ${
    activePlace.lon >= 0 ? "E" : "W"
  }`;

  const finalKm =
    activeIdx === 0
      ? 0
      : haversineDistanceKm(
          KATHMANDU.lat,
          KATHMANDU.lon,
          activePlace.lat,
          activePlace.lon
        );

  const displayKm = currentKm > 0 ? currentKm : finalKm;

  return (
    <section
      ref={sectionRef}
      id="journey"
      aria-label="Available worldwide"
      className="relative py-14 lg:py-0 border-b border-white/[0.08] bg-[#050505] lg:min-h-screen lg:flex lg:flex-col lg:justify-between overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full flex flex-col justify-between my-auto py-6 lg:py-16">
        {/* Small label as specified: 02 / 07 · Journey */}
        <div className="font-mono text-label uppercase tracking-widest text-[#edebe6]/75 mb-6 lg:mb-8 border-b border-white/[0.08] pb-3">
          02 / 07 · Journey
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
          {/* Left Column: Heading and active place details */}
          <div className="lg:col-span-6 flex flex-col order-2 lg:order-1">
            <KineticHeading
              as="h2"
              className="text-h1 font-light text-[#edebe6]"
            >
              Based in Kathmandu. Open to work worldwide.
            </KineticHeading>

            {/* One short line under it */}
            <p className="mt-3 sm:mt-4 font-[family-name:var(--font-sans)] text-body-lg text-[#edebe6]/80 leading-relaxed max-w-[65ch] [text-wrap:pretty]">
              Remote projects, any timezone.
            </p>

            {/* Per-place line */}
            <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-white/[0.1] flex flex-col gap-3">
              <div className="font-mono text-label text-[#edebe6] tracking-wide tabular-nums">
                {activePlace.name} · {activePlace.note} · {latStr}, {lonStr} ·{" "}
                <span className="tabular-nums font-semibold">
                  {displayKm.toLocaleString()} km
                </span>
              </div>

              {/* Minimal places directory */}
              <div className="mt-3 flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-1.5 font-mono text-label uppercase tracking-wider text-[#edebe6]/75">
                {places.map((place, idx) => {
                  const isCurrent = idx === activeIdx;
                  return (
                    <span
                      key={place.id}
                      className={`transition-colors ${
                        isCurrent ? "text-[#edebe6] font-semibold" : ""
                      }`}
                    >
                      {place.name}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: 3D ASCII Globe (draggable with inertia) */}
          <div className="lg:col-span-6 flex items-center justify-center order-1 lg:order-2">
            <RealAsciiGlobe
              progress={scrollProgress}
              onPlaceChange={handlePlaceChange}
              className="max-w-[340px] sm:max-w-[420px] lg:max-w-[500px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
