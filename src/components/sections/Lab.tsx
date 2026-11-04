"use client";

import React from "react";
import Link from "next/link";
import KineticHeading from "@/components/ui/Kinetic";
import { HiddenStar } from "@/contexts/StarContext";

const LAB_LINKS = [
  {
    num: "E—01",
    title: "Gray-Scott",
    type: "Reaction-Diffusion (WebGL2 GPU)",
  },
  {
    num: "E—02",
    title: "Type as Matter",
    type: "Spring-Driven Particle Typography",
  },
  {
    num: "E—03",
    title: "Flow Field",
    type: "Curl Noise Vector Ink Trails",
  },
];

export default function Lab() {
  return (
    <section
      id="lab"
      aria-label="Component and experiment lab"
      className="py-24 sm:py-32 border-b border-white/[0.08]"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-12 sm:mb-16">
          <div className="flex items-center gap-3 font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
            <span>#09 · LAB</span>
            <HiddenStar id="lab-star" />
          </div>
          <span className="font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
            COMPONENTS · 08 / EXPERIMENTS · 04
          </span>
        </div>

        {/* Section Title */}
        <div className="mb-14 sm:mb-20 max-w-2xl">
          <KineticHeading
            as="h2"
            className="text-h1 font-light text-[#edebe6]"
          >
            The site, taken apart.
          </KineticHeading>
          <p className="mt-4 font-[family-name:var(--font-sans)] text-body text-[#edebe6]/80 leading-relaxed max-w-[65ch] [text-wrap:pretty]">
            Small experiments with shaders and motion.
          </p>
        </div>

        {/* 3 Featured Lab Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12">
          {LAB_LINKS.map((item) => (
            <Link
              key={item.num}
              href="/lab"
              data-cursor="Lab"
              className="border border-white/[0.1] bg-white/[0.015] p-6 sm:p-8 rounded-sm hover:border-white/30 transition-colors group flex flex-col justify-between min-h-[180px]"
            >
              <div className="font-mono text-label tracking-widest text-[#edebe6]/75 group-hover:text-[#edebe6] transition-colors tabular-nums">
                {item.num}
              </div>
              <div className="mt-6 flex flex-col gap-1">
                <h3 className="font-[family-name:var(--font-display)] text-h3 font-light text-[#edebe6] group-hover:text-white transition-colors">
                  {item.title}
                </h3>
                <p className="font-mono text-label uppercase tracking-wider text-[#edebe6]/75">
                  {item.type}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* Enter Lab Button */}
        <div>
          <Link
            href="/lab"
            data-magnetic
            data-cursor="Enter"
            className="inline-flex items-center gap-3 px-6 py-3 border border-[#edebe6] bg-[#edebe6] text-[#050505] font-mono text-label uppercase tracking-widest font-semibold hover:bg-transparent hover:text-[#edebe6] transition-all"
          >
            <span>Enter the Lab (/lab)</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
