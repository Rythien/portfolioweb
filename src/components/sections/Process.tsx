"use client";

import React from "react";
import KineticHeading from "@/components/ui/Kinetic";

const STEPS = [
  {
    num: "01",
    title: "Listen",
    desc: "I start with the goal, the people who will use it, and what the project needs to do.",
  },
  {
    num: "02",
    title: "Map",
    desc: "I plan the pages and the paths people take through them, before drawing anything.",
  },
  {
    num: "03",
    title: "Sketch",
    desc: "Quick wireframes to test the layout and the flow while changes are still cheap.",
  },
  {
    num: "04",
    title: "Design",
    desc: "Type, color, spacing, and components, then a clickable prototype for websites and apps.",
  },
  {
    num: "05",
    title: "Build",
    desc: "I code it responsive from the start, with smooth motion where it helps and none where it doesn't.",
  },
  {
    num: "06",
    title: "Test and launch",
    desc: "I check it on real devices, test speed and accessibility, fix what I find, and ship it.",
  },
];

export default function Process() {
  return (
    <section
      id="process"
      aria-label="How I work"
      className="py-24 sm:py-32 border-b border-white/[0.08]"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-12 sm:mb-16">
          <span className="font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
            #03 · PROCESS
          </span>
          <span className="font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
            HOW I WORK
          </span>
        </div>

        {/* Section Intro */}
        <div className="mb-14 sm:mb-20">
          <KineticHeading
            as="h2"
            className="text-h1 font-light text-[#edebe6]"
          >
            Process.
          </KineticHeading>
          <p className="mt-3 font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
            Six steps, the same on every project.
          </p>
        </div>

        {/* Numbered Process List (01 to 06) */}
        <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {STEPS.map((step) => (
            <div
              key={step.num}
              data-cursor="Step"
              className="py-8 sm:py-10 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-start group hover:bg-white/[0.015] transition-colors"
            >
              <div className="md:col-span-2 font-mono text-label tracking-widest text-[#edebe6]/75 group-hover:text-[#edebe6] transition-colors tabular-nums">
                {step.num}
              </div>
              <div className="md:col-span-4 font-[family-name:var(--font-display)] text-h3 font-light text-[#edebe6]">
                {step.title}
              </div>
              <div className="md:col-span-6 font-[family-name:var(--font-sans)] text-body text-[#edebe6]/80 leading-relaxed max-w-[65ch] [text-wrap:pretty]">
                {step.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
