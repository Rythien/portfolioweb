"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PORTFOLIO_DATA } from "@/data/portfolio";

export default function Header() {
  const [time, setTime] = useState<string>("");
  const [isInverted, setIsInverted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Live Kathmandu time (UTC+5:45)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format to Asia/Kathmandu
      const formatted = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kathmandu",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now);
      setTime(formatted);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleInverted = () => {
    const nextState = !isInverted;
    setIsInverted(nextState);
    if (nextState) {
      document.documentElement.setAttribute("data-theme", "inverted");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  };

  const navLinks = [
    { label: "01 · ABOUT", href: "#about" },
    { label: "02 · JOURNEY", href: "#journey" },
    { label: "03 · PATH", href: "#path" },
    { label: "04 · PROJECTS", href: "#projects" },
    { label: "05 · LAB", href: "#lab" },
    { label: "06 · CONTACT", href: "#contact" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[var(--bg-void)]/80 hairline-b transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
        {/* Brand Monogram */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            aria-label="Searon Maharjan Home"
            className="group flex items-center gap-2.5 font-mono text-xs tracking-widest uppercase"
          >
            <span className="flex h-7 w-7 items-center justify-center border border-[var(--border-strong)] bg-[var(--bg-surface)] font-bold text-[var(--accent)] transition-all duration-300 group-hover:border-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white">
              {PORTFOLIO_DATA.personal.initials}
            </span>
            <span className="hidden sm:inline font-semibold text-[var(--text-primary)]">
              SEARON MAHARJAN
            </span>
          </Link>

          {/* Availability pill */}
          <div className="hidden lg:flex items-center gap-2 border border-white/10 px-2.5 py-1 text-[11px] font-mono text-[var(--text-secondary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            <span>AVAILABLE Q3/Q4</span>
          </div>
        </div>

        {/* Live Kathmandu Time & Coordinates */}
        <div className="hidden md:flex items-center gap-6 font-mono text-xs text-[var(--text-secondary)] tracking-wider">
          <div className="flex items-center gap-2">
            <span className="text-[var(--accent)]">KTM</span>
            <span>{time ? `${time} NPT (UTC+5:45)` : "CALCULATING..."}</span>
          </div>
          <span className="text-[var(--border-strong)]">/</span>
          <span className="text-[var(--text-muted)]">27.71°N 85.32°E</span>
        </div>

        {/* Desktop Navigation */}
        <nav
          aria-label="Main Navigation"
          className="hidden xl:flex items-center gap-6 font-mono text-xs tracking-wider"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Action Controls: Easter Egg Invert Mode + Mobile Trigger */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleInverted}
            title="Toggle Negative Matrix Mode (Easter Egg)"
            aria-label={`Toggle Negative Film Mode: Currently ${
              isInverted ? "Inverted" : "Dark Obsidian"
            }`}
            className="group min-h-[44px] flex items-center gap-2 border border-[var(--border-strong)] px-3 py-2 font-mono text-[11px] tracking-wider text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            <span
              className={`h-2.5 w-2.5 border border-current rounded-full transition-transform duration-300 ${
                isInverted ? "bg-[var(--accent)] rotate-180" : "bg-transparent"
              }`}
            />
            <span className="hidden sm:inline">
              {isInverted ? "MODE: INVERTED" : "MODE: VOID"}
            </span>
          </button>

          {/* Mobile Menu Toggle Button (Strict 44x44px touch target) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
            className="xl:hidden flex flex-col justify-center items-center min-h-[44px] min-w-[44px] h-11 w-11 border border-[var(--border-strong)] p-2 space-y-1.5 text-[var(--text-primary)]"
          >
            <span
              className={`block h-0.5 w-5 bg-current transition-transform duration-300 ${
                mobileMenuOpen ? "rotate-45 translate-y-2" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-current transition-opacity duration-300 ${
                mobileMenuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-5 bg-current transition-transform duration-300 ${
                mobileMenuOpen ? "-rotate-45 -translate-y-2" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden hairline-b bg-[var(--bg-void)] px-6 py-6 transition-all duration-300">
          <nav className="flex flex-col space-y-4 font-mono text-sm tracking-wider">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors border-b border-white/5"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 flex flex-col gap-1 font-mono text-xs text-[var(--text-muted)]">
              <div>KATHMANDU · {time || "19:07"} NPT (UTC+5:45)</div>
              <div>27.7172° N · 85.3240° E</div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
