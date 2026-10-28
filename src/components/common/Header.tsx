"use client";

import React from "react";
import Link from "next/link";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0b0b0b]/85 backdrop-blur-sm border-b border-white/[0.08]">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium tracking-tight text-[#edebe6] hover:text-white transition-colors"
        >
          Searon Maharjan
        </Link>

        <nav aria-label="Main Navigation" className="flex items-center gap-6 sm:gap-8 text-sm">
          <a
            href="#work"
            className="text-[#8e8b82] hover:text-[#edebe6] transition-colors"
          >
            Work
          </a>
          <a
            href="#about"
            className="text-[#8e8b82] hover:text-[#edebe6] transition-colors"
          >
            About
          </a>
          <a
            href="#contact"
            className="text-[#8e8b82] hover:text-[#edebe6] transition-colors"
          >
            Contact
          </a>
          <a
            href="/resume.pdf"
            target="_blank"
            rel="noreferrer"
            className="text-[#8e8b82] hover:text-[#edebe6] transition-colors"
          >
            Resume
          </a>
        </nav>
      </div>
    </header>
  );
}
