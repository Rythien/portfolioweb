"use client";

import React from "react";
import { PORTFOLIO_DATA } from "@/data/portfolio";
import ChristenAsciiGlobe from "@/components/canvas/ChristenAsciiGlobe";

export default function Journey() {
  const { from, to } = PORTFOLIO_DATA.journey;

  return (
    <section
      id="journey"
      aria-labelledby="journey-heading"
      className="py-24 sm:py-32 lg:py-40 border-t border-white/[0.08] bg-[#050505]"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
        <div className="flex items-center justify-between font-mono text-xs text-[#8e8b82] tracking-widest uppercase mb-12 sm:mb-16">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-[#edebe6]" />
            [ 02 / 07 ] · JOURNEY &amp; SPATIAL TRAJECTORY
          </span>
          <span>INDIAN SUBCONTINENT → GLOBAL FRONTIER</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Spatial Narrative */}
          <div className="lg:col-span-5 space-y-8">
            <h2
              id="journey-heading"
              className="font-[family-name:var(--font-display)] text-3xl sm:text-5xl font-normal tracking-tight text-[#edebe6]"
            >
              From Newari Woodcraft to Realtime Shaders.
            </h2>

            <div className="border border-white/10 p-6 bg-[#0c0c0e] space-y-6 font-mono text-xs">
              <div className="flex justify-between items-start border-b border-white/10 pb-4">
                <div>
                  <div className="text-[#8e8b82]/60 uppercase">FROM · ORIGINS</div>
                  <div className="text-white font-semibold text-sm mt-1">{from.location}</div>
                  <div className="text-[#8e8b82] mt-0.5">{from.coords}</div>
                </div>
                <div className="text-right">
                  <div className="text-[#8e8b82]/60 uppercase">NOW · PRESENT</div>
                  <div className="text-white font-semibold text-sm mt-1">{to.location}</div>
                  <div className="text-[#8e8b82] mt-0.5">27.7172° N · 85.3240° E</div>
                </div>
              </div>

              <p className="text-sm font-sans font-light text-[#8e8b82] leading-relaxed">
                {from.description}
              </p>

              <div className="flex items-center justify-between text-[11px] text-[#8e8b82]/70 pt-2 border-t border-white/5">
                <span>NEWARI SACRED GEOMETRY</span>
                <span>→ REALTIME WEBGL</span>
              </div>
            </div>
          </div>

          {/* Right Column: christendijoux.com 3D ASCII GLOBE */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="relative aspect-square w-full max-w-[min(560px,75vh)] border border-white/10 bg-[#08080a] p-4 overflow-hidden">
              <ChristenAsciiGlobe interactive={true} />
              <div className="absolute bottom-3 left-4 font-mono text-[10px] text-[#8e8b82]/70 tracking-widest uppercase pointer-events-none">
                [ 3D ASCII GLOBE · DRAG TO SPIN ]
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
