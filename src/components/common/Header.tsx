"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function Header() {
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
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#050505]/85 backdrop-blur-md border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium tracking-tight text-[#edebe6] hover:text-white transition-colors"
        >
          Searon Maharjan
        </Link>

        <nav aria-label="Main Navigation" className="flex items-center gap-6 sm:gap-8 font-mono text-xs uppercase tracking-wider">
          <a
            href="#about"
            className="text-[#8e8b82] hover:text-[#edebe6] transition-colors"
          >
            About
          </a>
          <a
            href="#journey"
            className="text-[#8e8b82] hover:text-[#edebe6] transition-colors"
          >
            Journey
          </a>
          <a
            href="#projects"
            className="text-[#8e8b82] hover:text-[#edebe6] transition-colors"
          >
            Projects
          </a>
          <a
            href="#lab"
            className="text-[#8e8b82] hover:text-[#edebe6] transition-colors"
          >
            Lab
          </a>
          <a
            href="#contact"
            className="text-[#8e8b82] hover:text-[#edebe6] transition-colors"
          >
            Contact
          </a>
          <button
            onClick={toggleNegative}
            title="Toggle Negative Mode (Easter Egg)"
            className="text-[#8e8b82] hover:text-white transition-colors border border-white/20 px-2 py-0.5"
          >
            {isNegative ? "Invert ✕" : "Invert"}
          </button>
        </nav>
      </div>
    </header>
  );
}
