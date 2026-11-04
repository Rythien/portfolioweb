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
      <div className="min-h-screen bg-[#050505] text-[#edebe6] flex flex-col justify-between selection:bg-[#edebe6] selection:text-[#050505]">
        <Header />

        <main className="max-w-6xl mx-auto px-6 sm:px-10 py-28 sm:py-36 w-full flex-1">
          {/* Top Bar with Back Link */}
          <div className="flex items-center justify-between border-b border-white/[0.1] pb-6 mb-12 font-mono text-xs uppercase tracking-widest text-[#edebe6]/60">
            <Link
              href="/"
              data-magnetic
              className="hover:text-white flex items-center gap-2"
            >
              <span>←</span>
              <span>Back to home</span>
            </Link>
            <span>EXPERIMENTAL LAB // 2026</span>
          </div>

          {/* Heading */}
          <header className="mb-12">
            <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-7xl font-light text-[#edebe6] tracking-tight">
              The site, taken apart.
            </h1>
            <p className="mt-4 font-[family-name:var(--font-sans)] text-base sm:text-lg text-[#edebe6]/70 max-w-2xl leading-relaxed">
              Every custom WebGL shader, interactive simulation, and mathematical primitive isolated into sandbox canvases.
            </p>
          </header>

          {/* Experiment Tabs */}
          <div className="flex flex-wrap gap-2 mb-8 font-mono text-xs uppercase tracking-wider">
            {EXPERIMENTS.map((exp) => (
              <button
                key={exp.id}
                type="button"
                onClick={() => setActiveExp(exp.id as "glsl" | "particles" | "physics" | "ascii")}
                className={`px-3.5 py-2 rounded-sm transition-colors text-left ${
                  activeExp === exp.id
                    ? "bg-[#edebe6] text-[#050505] font-semibold"
                    : "text-[#edebe6]/60 hover:text-[#edebe6] border border-white/10"
                }`}
              >
                <span>{exp.num} · </span>
                <span>{exp.title}</span>
              </button>
            ))}
          </div>

          {/* Active Canvas Showcase */}
          <div className="mb-8">
            {activeExp === "ascii" ? (
              <div className="relative w-full h-[460px] border border-white/10 bg-[#050505] overflow-hidden">
                <AsciiDitherHero initialMode="ascii" />
              </div>
            ) : (
              <LabShaderCanvas mode={activeExp} />
            )}
          </div>

          {/* Experiment Description Box */}
          <div className="border border-white/10 bg-white/[0.015] p-6 sm:p-8 rounded-sm font-mono text-xs text-[#edebe6]/80 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[#edebe6]/75 uppercase tracking-widest text-label">
              <span>ACTIVE SPECIFICATION</span>
              <span>TWO-TONE // RAW CANVAS & WEBGL</span>
            </div>
            <p className="font-[family-name:var(--font-sans)] text-base text-[#edebe6] mt-1">
              {EXPERIMENTS.find((e) => e.id === activeExp)?.desc}
            </p>
          </div>
        </main>

        <Footer />
      </div>
    </LenisProvider>
  );
}
