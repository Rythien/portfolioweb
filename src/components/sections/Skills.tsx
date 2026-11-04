"use client";

import React from "react";
import KineticHeading from "@/components/ui/Kinetic";

const SKILL_CATEGORIES = [
  {
    category: "Design",
    items: [
      "Interface design (UI)",
      "User experience (UX)",
      "Responsive layouts",
      "Design systems",
      "Wireframes and prototypes",
      "Figma",
    ],
  },
  {
    category: "Code",
    items: [
      "HTML & CSS",
      "JavaScript",
      "TypeScript",
      "React",
      "Next.js",
      "Tailwind CSS",
      "Git",
    ],
  },
  {
    category: "3D",
    items: [
      "Blender (modeling and rendering)",
    ],
  },
];

export default function Skills() {
  return (
    <section
      id="skills"
      aria-label="Skills and tools"
      className="py-24 sm:py-32 border-b border-white/[0.08]"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-12 sm:mb-16">
          <span className="font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
            #05 · SKILLS
          </span>
          <span className="font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
            CAPABILITIES
          </span>
        </div>

        {/* Section Title */}
        <div className="mb-14 sm:mb-20 max-w-2xl">
          <KineticHeading
            as="h2"
            className="text-h1 font-light text-[#edebe6]"
          >
            Skills.
          </KineticHeading>
          <p className="mt-3 font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
            Design, code, and 3D modeling.
          </p>
        </div>

        {/* 3 Categories as open columns separated by hairlines */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 border-t border-white/[0.08] pt-12">
          {SKILL_CATEGORIES.map((cat, idx) => (
            <div
              key={cat.category}
              className={`flex flex-col justify-between ${
                idx > 0 ? "md:border-l md:border-white/[0.08] md:pl-8 lg:pl-12" : ""
              }`}
            >
              <div>
                <h3 className="font-mono text-label uppercase tracking-widest text-[#edebe6] font-semibold border-b border-white/[0.08] pb-3 mb-6">
                  {cat.category}
                </h3>
                <ul className="flex flex-col gap-3 font-[family-name:var(--font-sans)] text-body text-[#edebe6]/80 leading-relaxed">
                  {cat.items.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#edebe6]/50" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
