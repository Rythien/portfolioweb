"use client";

import React, { useState } from "react";
import LabShaderCanvas from "@/components/canvas/LabShaderCanvas";
import { PORTFOLIO_DATA } from "@/data/portfolio";

export default function Lab() {
  const [activeTab, setActiveTab] = useState<"glsl" | "particles" | "physics">("glsl");
  const [isNegativeMode, setIsNegativeMode] = useState(false);

  const toggleNegativeMode = () => {
    const next = !isNegativeMode;
    setIsNegativeMode(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "inverted");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  };

  const currentExperiment = PORTFOLIO_DATA.lab.find((l) => l.type === activeTab);

  return (
    <section
      id="lab"
      aria-labelledby="lab-heading"
      className="py-24 sm:py-32 lg:py-40 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 hairline-b"
    >
      <div className="flex items-center justify-between font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase mb-12 sm:mb-16">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-[var(--accent)]" />
          [ 07 / 10 ] · R&amp;D LAB &amp; PROTOTYPES
        </span>
        <span>INTERACTIVE SHADERS &amp; PHYSICS</span>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
        <div>
          <h2
            id="lab-heading"
            className="font-[family-name:var(--font-syne)] text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)]"
          >
            Algorithmic Playground.
          </h2>
          <p className="mt-3 max-w-xl text-sm sm:text-base text-[var(--text-secondary)] font-light leading-relaxed">
            Realtime sandbox investigating fluid mechanics, GLSL fragment math, and kinetic typography without framework overhead.
          </p>
        </div>

        {/* Easter Egg Trigger */}
        <button
          onClick={toggleNegativeMode}
          className="self-start lg:self-end border border-white/20 hover:border-[var(--accent)] px-4 py-2.5 font-mono text-xs flex items-center gap-3 transition-colors text-[var(--text-primary)]"
        >
          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          <span>[ EASTER EGG: INVERT SPECTRUM ]</span>
        </button>
      </div>

      {/* Lab Tabs Switcher */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 border-b border-white/10 pb-4 mb-8">
        {PORTFOLIO_DATA.lab.map((exp) => (
          <button
            key={exp.id}
            onClick={() => setActiveTab(exp.type)}
            className={`p-4 text-left border transition-all duration-200 font-mono text-xs ${
              activeTab === exp.type
                ? "border-[var(--accent)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <div className="text-[var(--accent)] mb-1">{exp.number} · {exp.tag}</div>
            <div className="font-semibold text-sm text-[var(--text-primary)]">
              {exp.title}
            </div>
          </button>
        ))}
      </div>

      {/* Interactive WebGL / Simulation Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8">
          <LabShaderCanvas mode={activeTab} />
        </div>

        {/* Experiment Specs Card */}
        <div className="lg:col-span-4 border border-white/10 p-6 bg-[var(--bg-surface)] font-mono text-xs space-y-4">
          <div className="text-[var(--accent)] uppercase font-semibold">
            [ PARAMETERS &amp; FORMULATION ]
          </div>
          <h3 className="font-[family-name:var(--font-syne)] text-xl font-bold text-[var(--text-primary)]">
            {currentExperiment?.title}
          </h3>
          <p className="text-[var(--text-secondary)] font-light text-sm leading-relaxed">
            {currentExperiment?.description}
          </p>
          <div className="pt-4 border-t border-white/10 space-y-2 text-[var(--text-muted)] text-[11px]">
            <div>• RENDER: HARDWARE ACCELERATED WEBGL 2.0</div>
            <div>• PRECISION: MEDIUMP FLOAT / 60 FPS SYNC</div>
            <div>• INTERACTION: POINTER VELOCITY &amp; ATTENUATION</div>
          </div>
        </div>
      </div>
    </section>
  );
}
