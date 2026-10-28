"use client";

import React, { useState } from "react";
import ChristenAsciiGlobe from "@/components/canvas/ChristenAsciiGlobe";
import ChristenDitherHero from "@/components/canvas/ChristenDitherHero";

export default function Lab() {
  const [activeTab, setActiveTab] = useState<"ascii" | "dither" | "negative">("ascii");
  const [isNegative, setIsNegative] = useState(false);

  const toggleNegative = () => {
    const next = !isNegative;
    setIsNegative(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "inverted");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  };

  return (
    <section
      id="lab"
      aria-labelledby="lab-heading"
      className="py-24 sm:py-32 lg:py-40 border-t border-white/[0.08] bg-[#050505]"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
        <div className="flex items-center justify-between font-mono text-xs text-[#8e8b82] tracking-widest uppercase mb-12 sm:mb-16">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-[#edebe6]" />
            [ 05 / 07 ] · THE SITE, TAKEN APART · LAB
          </span>
          <span>COMPONENTS DISSECTED LIVE</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
          <div>
            <h2
              id="lab-heading"
              className="font-[family-name:var(--font-display)] text-3xl sm:text-5xl font-normal tracking-tight text-[#edebe6]"
            >
              The Site, Taken Apart.
            </h2>
            <p className="mt-3 max-w-xl text-sm sm:text-base text-[#8e8b82] font-light leading-relaxed">
              Every custom component and algorithm inspected live. No black boxes.
            </p>
          </div>

          {/* Quick Tab Switcher */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              onClick={() => setActiveTab("ascii")}
              className={`px-3 py-1.5 border transition-colors ${
                activeTab === "ascii"
                  ? "border-white text-white bg-white/10"
                  : "border-white/10 text-[#8e8b82] hover:text-white"
              }`}
            >
              E—01 · ASCII Globe
            </button>
            <button
              onClick={() => setActiveTab("dither")}
              className={`px-3 py-1.5 border transition-colors ${
                activeTab === "dither"
                  ? "border-white text-white bg-white/10"
                  : "border-white/10 text-[#8e8b82] hover:text-white"
              }`}
            >
              E—02 · DitherHero
            </button>
            <button
              onClick={toggleNegative}
              className="px-3 py-1.5 border border-white/20 text-[#edebe6] hover:border-white transition-colors"
            >
              [ {isNegative ? "EXIT INVERT" : "NEGATIVE MODE"} ]
            </button>
          </div>
        </div>

        {/* Live Interactive Experiment Window */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start border border-white/10 bg-[#08080a] p-6 sm:p-8">
          <div className="lg:col-span-8 relative aspect-[16/10] sm:aspect-[16/9] w-full border border-white/10 bg-[#050505] overflow-hidden flex items-center justify-center">
            {activeTab === "ascii" && (
              <div className="w-full h-full p-4">
                <ChristenAsciiGlobe interactive={true} />
              </div>
            )}
            {activeTab === "dither" && (
              <div className="w-full h-full relative">
                <ChristenDitherHero />
              </div>
            )}
          </div>

          {/* Spec details */}
          <div className="lg:col-span-4 font-mono text-xs space-y-4">
            <div className="text-white uppercase font-semibold">
              {activeTab === "ascii" ? "[ E—01 · ASCII 3D GLOBE ]" : "[ E—02 · 8x8 BAYER DITHERHERO ]"}
            </div>
            <p className="font-sans text-sm text-[#8e8b82] font-light leading-relaxed">
              {activeTab === "ascii"
                ? "A rotating sphere rendered entirely in character glyphs. Employs 3D ray-sphere projection, analytical latitude/longitude meridians, orbital particle ring, and depth-mapped luminance."
                : "A procedural 3D organic sphere raymarched via a single fullscreen triangle. Warped by 3D simplex noise, surface-lit, and dithered using a recursive 8x8 Bayer matrix with real-time cursor loupe."}
            </p>
            <div className="pt-4 border-t border-white/10 space-y-2 text-[#8e8b82] text-[11px]">
              <div>STACK: {activeTab === "ascii" ? "Canvas 2D · Monospace Math" : "WebGL 1.0 · Simplex GLSL"}</div>
              <div>FOOTPRINT: {activeTab === "ascii" ? "~4 KB minified" : "~6 KB minified"}</div>
              <div>TARGET FPS: 60 / 120 FPS synchronous</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
