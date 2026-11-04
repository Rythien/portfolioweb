"use client";

import React from "react";
import KineticHeading from "@/components/ui/Kinetic";
import Counter from "@/components/ui/Counter";

export default function Impact() {
  return (
    <section
      id="results"
      aria-label="Numbers and impact"
      className="py-24 sm:py-32 border-b border-white/[0.08]"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-12 sm:mb-16">
          <span className="font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
            #07 · NUMBERS
          </span>
          <span className="font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
            IMPACT & MILESTONES
          </span>
        </div>

        {/* Section Intro */}
        <div className="mb-14 sm:mb-20 max-w-2xl">
          <KineticHeading
            as="h2"
            className="text-h1 font-light text-[#edebe6]"
          >
            Numbers.
          </KineticHeading>
        </div>

        {/* 4 Numbers as open columns separated by hairlines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-b border-white/[0.08] divide-y sm:divide-y-0 sm:divide-x divide-white/[0.08]">
          {/* Number 1: 4 years */}
          <div className="py-8 sm:py-10 sm:px-6 lg:px-8 first:sm:pl-0 flex flex-col justify-between min-h-[180px]">
            <div className="font-mono text-display sm:text-6xl font-light text-[#edebe6] tabular-nums">
              <Counter value={4} />
            </div>
            <p className="font-[family-name:var(--font-sans)] text-body text-[#edebe6]/80 leading-relaxed mt-6 max-w-[65ch] [text-wrap:pretty]">
              years studying BICT (2021–2025)
            </p>
          </div>

          {/* Number 2: 1 full e-commerce */}
          <div className="py-8 sm:py-10 sm:px-6 lg:px-8 flex flex-col justify-between min-h-[180px]">
            <div className="font-mono text-display sm:text-6xl font-light text-[#edebe6] tabular-nums">
              <Counter value={1} />
            </div>
            <p className="font-[family-name:var(--font-sans)] text-body text-[#edebe6]/80 leading-relaxed mt-6 max-w-[65ch] [text-wrap:pretty]">
              full e-commerce website built from scratch (capstone)
            </p>
          </div>

          {/* Number 3: 6 steps */}
          <div className="py-8 sm:py-10 sm:px-6 lg:px-8 flex flex-col justify-between min-h-[180px]">
            <div className="font-mono text-display sm:text-6xl font-light text-[#edebe6] tabular-nums">
              <Counter value={6} />
            </div>
            <p className="font-[family-name:var(--font-sans)] text-body text-[#edebe6]/80 leading-relaxed mt-6 max-w-[65ch] [text-wrap:pretty]">
              steps on every project, from first sketch to launch
            </p>
          </div>

          {/* Number 4: Placeholder */}
          <div className="py-8 sm:py-10 sm:px-6 lg:px-8 last:sm:pr-0 flex flex-col justify-between min-h-[180px]">
            <div className="font-mono text-label uppercase tracking-widest text-[#edebe6]/60 pt-2">
              [PLACEHOLDER]
            </div>
            <p className="font-mono text-label text-[#edebe6]/75 leading-relaxed mt-6">
              [One more number: for example, 1 internship, or N projects built]
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
