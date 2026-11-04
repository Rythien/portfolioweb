"use client";

import React from "react";
import KineticHeading from "@/components/ui/Kinetic";
import { HiddenStar } from "@/contexts/StarContext";

const FOCUS_AREAS = [
  {
    tag: "#01 · WEB",
    title: "Website design",
    description:
      "Clear, fast, responsive websites, from landing pages to full online stores.",
  },
  {
    tag: "#02 · APP",
    title: "App design",
    description:
      "Mobile app screens and flows that are easy to learn and easy to use.",
  },
  {
    tag: "#03 · BUILD",
    title: "Frontend development",
    description:
      "I turn designs into working code with React, Next.js, and Tailwind.",
  },
  {
    tag: "#04 · 3D",
    title: "3D with Blender",
    description:
      "Models and renders for product visuals and interface details.",
  },
];

export default function Focus() {
  return (
    <section
      id="focus"
      aria-label="Core focus areas"
      className="py-24 sm:py-32 border-b border-white/[0.08]"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-12 sm:mb-16">
          <div className="flex items-center gap-3 font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
            <span>#04 · FOCUS</span>
            <HiddenStar id="focus-star" />
          </div>
          <span className="font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
            WHAT I DO
          </span>
        </div>

        {/* Section Intro */}
        <div className="mb-14 sm:mb-20 max-w-2xl">
          <KineticHeading
            as="h2"
            className="text-h1 font-light text-[#edebe6]"
          >
            Core focus.
          </KineticHeading>
        </div>

        {/* Open Rows (#01 to #04) */}
        <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {FOCUS_AREAS.map((area) => (
            <div
              key={area.tag}
              data-cursor="Discipline"
              className="py-8 sm:py-10 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-start group hover:bg-white/[0.015] transition-colors"
            >
              <div className="md:col-span-2 font-mono text-label uppercase tracking-widest text-[#edebe6]/75 group-hover:text-[#edebe6] transition-colors tabular-nums">
                {area.tag}
              </div>
              <div className="md:col-span-4 font-[family-name:var(--font-display)] text-h3 font-light text-[#edebe6]">
                {area.title}
              </div>
              <div className="md:col-span-6 font-[family-name:var(--font-sans)] text-body text-[#edebe6]/80 leading-relaxed max-w-[65ch] [text-wrap:pretty]">
                {area.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
