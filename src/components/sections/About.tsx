"use client";

import React from "react";
import { PORTFOLIO_DATA } from "@/data/portfolio";

export default function About() {
  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="py-24 sm:py-32 lg:py-40 border-t border-white/[0.08] bg-[#050505]"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
        <div className="flex items-center justify-between font-mono text-xs text-[#8e8b82] tracking-widest uppercase mb-12 sm:mb-16">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-[#edebe6]" />
            [ 01 / 07 ] · PROFILE &amp; SPECIALIZATION
          </span>
          <span>KATHMANDU · NEPAL</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Left Column: Narrative */}
          <div className="lg:col-span-5 space-y-6">
            <h2
              id="about-heading"
              className="font-[family-name:var(--font-display)] text-3xl sm:text-5xl font-normal tracking-tight text-[#edebe6] leading-[1.05]"
            >
              From Newari Roots to Digital Architecture.
            </h2>

            <p className="text-base sm:text-lg text-[#8e8b82] font-light leading-relaxed">
              {PORTFOLIO_DATA.personal.bio}
            </p>

            <p className="text-sm sm:text-base text-[#8e8b82]/80 font-light leading-relaxed border-l border-white/20 pl-4 italic">
              &ldquo;{PORTFOLIO_DATA.personal.originStory}&rdquo;
            </p>
          </div>

          {/* Right Column: 3 Focus Cards (#01, #02, #03) */}
          <div className="lg:col-span-7 flex flex-col divide-y divide-white/10 border-t border-b border-white/10 lg:border-t-0">
            {PORTFOLIO_DATA.focusAreas.map((area) => (
              <div key={area.number} className="py-8 sm:py-10 group">
                <div className="flex items-center justify-between font-mono text-xs mb-2">
                  <span className="text-white font-semibold">{area.number} · {area.title.split(" ")[0].toUpperCase()}</span>
                  <span className="text-[#8e8b82]">{area.tagline}</span>
                </div>

                <h3 className="font-[family-name:var(--font-display)] text-2xl font-normal text-[#edebe6] mb-3">
                  {area.title}
                </h3>

                <p className="text-sm text-[#8e8b82] font-light leading-relaxed mb-4">
                  {area.description}
                </p>

                <div className="flex flex-wrap gap-2">
                  {area.tech.map((t) => (
                    <span
                      key={t}
                      className="font-mono text-[11px] px-2.5 py-1 border border-white/10 text-[#8e8b82]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
