"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { SITE_DATA } from "@/content/site";
import { useMounted } from "@/utils/useMounted";
import { useSoundStore } from "@/store/useSoundStore";
import { initAudioContext, playTick } from "@/hooks/crystalAudio";
import Swap from "@/components/ui/Swap";

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

  // Backdrop appears once the page has scrolled past 40px
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 40);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <>
    {/* A sibling of the header, not a child: below lg it must sit under
        the section strip (z-40), which the header's z-50 would cover */}
    <div
      aria-hidden="true"
      data-on={scrolled ? "" : undefined}
      className="header-scrim fixed top-0 left-0 right-0 z-[39] pointer-events-none"
    />
    <header data-intro className="fixed top-0 left-0 right-0 z-50 pointer-events-none text-ink">
      {/* Below lg the header is solid so header + rail strip form one
          band; the scrim above adds the fade under it once scrolled */}
      <div aria-hidden="true" className="absolute inset-0 max-lg:bg-surface" />
      <div className="relative max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 h-20 flex items-center justify-between w-full">
        {/* Brand Name */}
        <div className="pointer-events-auto">
          <Link
            href="#top"
            className="hit font-[family-name:var(--font-sans)] text-sm sm:text-base tracking-tight font-medium text-ink"
          >
            <Swap>{SITE_DATA.brand.name}</Swap>
          </Link>
        </div>

        {/* Desktop Navigation */}
        {/* One magnet group: only the control nearest the pointer leans */}
        <nav data-magnet-group className="hidden md:flex items-center gap-6 lg:gap-10 pointer-events-auto font-mono text-[0.875rem] font-medium uppercase tracking-widest text-ink/80">
          <a href="#works" data-magnetic className="py-2">
            <Swap>Work</Swap>
          </a>
          <a href="#about" data-magnetic className="py-2">
            <Swap>About</Swap>
          </a>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            data-magnetic
            aria-pressed={soundOn}
            className="pressable flex items-center gap-2 py-2 font-mono text-[0.875rem] font-medium uppercase tracking-widest"
          >
            <span
              aria-hidden="true"
              className={`sound-wave ${soundOn ? "is-on" : ""}`}
            >
              <span />
              <span />
              <span />
            </span>
            <Swap>Sound {soundOn ? "On" : "Off"}</Swap>
          </button>

          <a href="#contact" data-magnetic className="py-2">
            <Swap>Contact</Swap>
          </a>
        </nav>

        {/* Mobile */}
        <div className="md:hidden pointer-events-auto flex items-center gap-3">
          <div
            aria-live="off"
            className="font-mono text-label text-ink/80 tabular-nums mr-1"
          >
            {mounted ? timeStr : "--:--"}
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
            className="hit pressable px-2 -mr-2 text-ink font-mono text-label"
          >
            <Swap>{isMobileMenuOpen ? "[Close]" : "[Menu]"}</Swap>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile Navigation"
          className="md:hidden pointer-events-auto bg-surface text-ink border-b border-rule px-6 py-8 flex flex-col gap-6 font-mono text-label"
          style={{ mixBlendMode: "normal" }}
        >
          <a
            href="#works"
            onClick={() => setIsMobileMenuOpen(false)}
            className="hit border-b border-rule"
          >
            <Swap>Work</Swap>
          </a>
          <a
            href="#about"
            onClick={() => setIsMobileMenuOpen(false)}
            className="hit border-b border-rule"
          >
            <Swap>About</Swap>
          </a>
          <a
            href="#disciplines"
            onClick={() => setIsMobileMenuOpen(false)}
            className="hit border-b border-rule"
          >
            <Swap>Disciplines</Swap>
          </a>
          <a
            href="#contact"
            onClick={() => setIsMobileMenuOpen(false)}
            className="hit border-b border-rule"
          >
            <Swap>Contact</Swap>
          </a>
          <button
            onClick={toggleSound}
            aria-pressed={soundOn}
            className="hit pressable flex items-center gap-2 font-mono text-label uppercase tracking-widest text-left"
          >
            <span
              aria-hidden="true"
              className={`sound-wave ${soundOn ? "is-on" : ""}`}
            >
              <span />
              <span />
              <span />
            </span>
            <Swap>Sound {soundOn ? "On" : "Off"}</Swap>
          </button>
        </nav>
      )}
    </header>
    </>
  );
}
