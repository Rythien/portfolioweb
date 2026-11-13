"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { SITE_DATA } from "@/content/site";
import { useMounted } from "@/utils/useMounted";
import { useSoundStore } from "@/store/useSoundStore";
import { initAudioContext, playTick } from "@/hooks/useCrystalSound";

export default function Header() {
  const mounted = useMounted();
  const [timeStr, setTimeStr] = useState<string>("--:--");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const soundOn = useSoundStore((s) => s.enabled);
  const rawToggle = useSoundStore((s) => s.toggle);
  const toggleSound = () => {
    initAudioContext();
    rawToggle();
    if (!soundOn) playTick();
  };

  useEffect(() => {
    const updateTime = () => {
      try {
        const time = new Date().toLocaleTimeString("en-GB", {
          timeZone: SITE_DATA.brand.timezone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        setTimeStr(time);
      } catch {
        setTimeStr("19:30");
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none mix-blend-difference text-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 h-20 flex items-center justify-between w-full">
        {/* Brand Name */}
        <div className="pointer-events-auto">
          <Link
            href="#top"
            data-magnetic
            className="font-[family-name:var(--font-sans)] text-sm sm:text-base tracking-tight font-medium text-white hover:opacity-75 transition-opacity py-2"
          >
            {SITE_DATA.brand.name}
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-10 pointer-events-auto font-mono text-[0.875rem] font-medium uppercase tracking-widest text-white/90">
          <a
            href="#works"
            data-magnetic
            className="hover:opacity-70 transition-opacity py-2"
          >
            Work
          </a>
          <a
            href="#about"
            data-magnetic
            className="hover:opacity-70 transition-opacity py-2"
          >
            About
          </a>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            aria-label={soundOn ? "Mute sound" : "Unmute sound"}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity py-2"
          >
            <span>Sound</span>
            <span>{soundOn ? "On" : "Off"}</span>
          </button>

          {/* Live Clock */}
          <div
            aria-live="off"
            className="flex items-center gap-2 border-x border-white/15 px-4 py-1 tabular-nums"
            title={`${SITE_DATA.brand.city} Local Time`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span suppressHydrationWarning>
              {SITE_DATA.brand.city} {mounted ? timeStr : "--:--"}
            </span>
          </div>

          <a
            href="#contact"
            data-magnetic
            className="hover:opacity-70 transition-opacity py-2"
          >
            Contact
          </a>
        </nav>

        {/* Mobile */}
        <div className="md:hidden pointer-events-auto flex items-center gap-3">
          <div
            aria-live="off"
            className="font-mono text-label uppercase tracking-widest text-white/80 tabular-nums mr-1"
          >
            {mounted ? timeStr : "--:--"}
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="p-2 -mr-2 text-white font-mono text-xs uppercase tracking-widest focus:outline-none"
          >
            {isMobileMenuOpen ? "[Close]" : "[Menu]"}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden pointer-events-auto bg-surface text-ink border-b border-rule px-6 py-8 flex flex-col gap-6 font-mono text-label"
          style={{ mixBlendMode: "normal" }}
        >
          <a
            href="#works"
            onClick={() => setIsMobileMenuOpen(false)}
            className="py-2 border-b border-rule"
          >
            Work
          </a>
          <a
            href="#about"
            onClick={() => setIsMobileMenuOpen(false)}
            className="py-2 border-b border-rule"
          >
            About
          </a>
          <a
            href="#disciplines"
            onClick={() => setIsMobileMenuOpen(false)}
            className="py-2 border-b border-rule"
          >
            Disciplines
          </a>
          <a
            href="#contact"
            onClick={() => setIsMobileMenuOpen(false)}
            className="py-2"
          >
            Contact
          </a>
        </nav>
      )}
    </header>
  );
}
