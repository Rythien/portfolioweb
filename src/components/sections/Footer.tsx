"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PORTFOLIO_DATA } from "@/data/portfolio";

export default function Footer() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kathmandu",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(now)
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-[var(--bg-void)] border-t border-white/10 pt-16 pb-12 text-[var(--text-secondary)] font-mono text-xs">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-white/10">
          {/* Logo & Identity */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center border border-[var(--border-strong)] bg-[var(--bg-surface)] font-bold text-[var(--accent)]">
                {PORTFOLIO_DATA.personal.initials}
              </span>
              <span className="font-semibold text-[var(--text-primary)]">
                SEARON MAHARJAN
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Creative Developer &amp; Frontend Architect based in the Kathmandu Valley.
            </p>
          </div>

          {/* Spatial Anchor */}
          <div>
            <div className="text-[10px] uppercase text-[var(--text-muted)] tracking-wider mb-2">
              SPATIAL COORDINATES
            </div>
            <div className="text-[var(--text-primary)]">27.7172° N · 85.3240° E</div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Kathmandu Valley, Nepal
            </div>
          </div>

          {/* Temporal Anchor */}
          <div>
            <div className="text-[10px] uppercase text-[var(--text-muted)] tracking-wider mb-2">
              TEMPORAL ANCHOR
            </div>
            <div className="text-[var(--accent)] font-semibold">
              {time ? `${time} NPT` : "19:07:26 NPT"}
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              UTC+05:45 Standard
            </div>
          </div>

          {/* Quick Return */}
          <div className="md:text-right">
            <button
              onClick={scrollToTop}
              className="px-4 py-2 border border-white/10 text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              [ RETURN TO TOP ↑ ]
            </button>
          </div>
        </div>

        {/* Bottom Legal & Copyright Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[var(--text-muted)]">
          <div className="flex items-center gap-6">
            <span>©2026 SEARON MAHARJAN. ALL RIGHTS RESERVED.</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#about" className="hover:text-[var(--text-primary)] transition-colors">
              IMPRINT
            </a>
            <a href="#colophon" className="hover:text-[var(--text-primary)] transition-colors">
              PRIVACY POLICY
            </a>
            <span className="text-[var(--accent)]">BUILT WITH INTENT</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
