"use client";

import React, { useState } from "react";
import Link from "next/link";
import Header from "@/components/common/Header";
import Footer from "@/components/sections/Footer";
import LenisProvider from "@/components/common/LenisProvider";
import LabShaderCanvas from "@/components/canvas/LabShaderCanvas";
import AsciiDitherHero from "@/components/canvas/AsciiDitherHero";

const EXPERIMENTS = [
  {
    id: "glsl",
    num: "E—01",
    title: "WebGL GLSL Caustic Ripple",
    desc: "Single-pass fragment shader computing distance-field ripples and screen caustics in two tones.",
  },
  {
    id: "particles",
    num: "E—02",
    title: "Curl Noise Vector Particle Field",
    desc: "280 Eulerian particles advected along procedural trigonometric curl noise with mouse repulsion.",
  },
  {
    id: "physics",
    num: "E—03",
    title: "Spring-Driven Kinetic Monospace Glyphs",
    desc: "Hooke's law spring grid distributing string characters that react elastically to cursor velocity.",
  },
  {
    id: "ascii",
    num: "E—04",
    title: "Real-time 3D ASCII Projection Mesh",
    desc: "Raycast unit sphere with Lambert shading, 8x8 Bayer dithering, and character ramp quantization.",
  },
];

export default function LabPage() {
  const [activeExp, setActiveExp] = useState<"glsl" | "particles" | "physics" | "ascii">("glsl");

  return (
    <LenisProvider>
      <div className="min-h-screen flex flex-col justify-between">
        <Header />

        <main className="max-w-6xl mx-auto px-6 sm:px-10 py-28 sm:py-36 w-full flex-1">
          <div className="flex items-center justify-between border-b border-rule pb-6 mb-12 font-mono text-xs uppercase tracking-widest text-ink-muted">
            <Link
              href="/"
              data-magnetic
              className="hover:text-ink flex items-center gap-2"
            >
              <span>←</span>
              <span>Back to home</span>
            </Link>
            <span>Experimental Lab · 2026</span>
          </div>

          <header className="mb-12">
            <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-7xl font-light text-ink tracking-tight">
              The site, taken apart.
            </h1>
            <p className="mt-4 font-[family-name:var(--font-sans)] text-base sm:text-lg text-ink-muted max-w-2xl leading-relaxed">
              Every custom WebGL shader, interactive simulation, and mathematical primitive isolated into sandbox canvases.
            </p>
          </header>

          <div className="flex flex-wrap gap-2 mb-8 font-mono text-xs uppercase tracking-wider">
            {EXPERIMENTS.map((exp) => (
              <button
                key={exp.id}
                type="button"
                onClick={() => setActiveExp(exp.id as "glsl" | "particles" | "physics" | "ascii")}
                className={`px-3.5 py-2 rounded-sm transition-colors text-left ${
                  activeExp === exp.id
                    ? "bg-ink text-surface font-semibold"
                    : "text-ink-muted hover:text-ink border border-rule"
                }`}
              >
                <span>{exp.num} · </span>
                <span>{exp.title}</span>
              </button>
            ))}
          </div>

          <div className="mb-8">
            {activeExp === "ascii" ? (
              <div className="relative w-full h-[460px] border border-rule overflow-hidden">
                <AsciiDitherHero initialMode="ascii" />
              </div>
            ) : (
              <LabShaderCanvas mode={activeExp} />
            )}
          </div>

          <div className="border border-rule bg-ink/[0.02] p-6 sm:p-8 rounded-sm font-mono text-xs text-ink/80 flex flex-col gap-2">
            <div className="flex items-center justify-between text-ink-muted uppercase tracking-widest text-label">
              <span>Active Specification</span>
            </div>
            <p className="font-[family-name:var(--font-sans)] text-base text-ink mt-1">
              {EXPERIMENTS.find((e) => e.id === activeExp)?.desc}
            </p>
          </div>
        </main>

        <Footer />
      </div>
    </LenisProvider>
  );
}
