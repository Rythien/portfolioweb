"use client";

import React, { useEffect, useState } from "react";
import { SITE_DATA } from "@/content/site";
import { useMounted } from "@/utils/useMounted";

const TICKER_ITEMS = ["Available for work", "2026", "Kathmandu"];

function TickerRun() {
  return (
    <span className="ticker-run flex items-center shrink-0">
      {Array.from({ length: 4 }).map((_, rep) => (
        <React.Fragment key={rep}>
          {TICKER_ITEMS.map((item) => (
            <span key={`${rep}-${item}`} className="flex items-center">
              <span className="px-6 sm:px-10 whitespace-nowrap">{item}</span>
              <span aria-hidden="true" className="text-ink/30">
                ·
              </span>
            </span>
          ))}
        </React.Fragment>
      ))}
    </span>
  );
}

export default function Footer() {
  const mounted = useMounted();
  const [copied, setCopied] = useState(false);
  const [timeStr, setTimeStr] = useState("--:--");

  useEffect(() => {
    const update = () => {
      try {
        setTimeStr(
          new Date().toLocaleTimeString("en-GB", {
            timeZone: SITE_DATA.brand.timezone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        );
      } catch {
        setTimeStr("--:--");
      }
    };
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(SITE_DATA.contact.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer data-reveal className="relative z-[1] border-t border-rule select-none">
      {/* Slow ticker */}
      <div
        className="ticker overflow-hidden border-b border-rule py-4 font-mono text-label text-ink/80"
        aria-label={TICKER_ITEMS.join(", ")}
      >
        <div className="ticker-track flex w-max">
          <TickerRun />
          <span aria-hidden="true" className="contents">
            <TickerRun />
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full pt-16 sm:pt-24 pb-32 flex flex-col gap-12 sm:gap-16">
        {/* Big contact statement */}
        <a
          href={`mailto:${SITE_DATA.contact.email}`}
          data-cursor="Email"
          className="font-[family-name:var(--font-sans)] text-display uppercase text-ink hover:opacity-90 transition-opacity w-fit"
        >
          Get in <span className="accent-word">touch</span>
        </a>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-t border-rule pt-8">
          <button
            onClick={handleCopy}
            data-magnetic
            aria-label="Copy email address to clipboard"
            className="pressable w-fit px-6 py-4 border border-rule text-ink font-mono text-label hover:border-rule-hover"
          >
            {copied ? "Copied ✓" : `Copy: ${SITE_DATA.contact.email}`}
          </button>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-label text-ink/80">
            {SITE_DATA.contact.socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                data-magnetic
                className="hover:text-ink underline underline-offset-4 decoration-ink/20 hover:decoration-ink transition-colors"
              >
                {s.label} ↗
              </a>
            ))}
            <span
              className="tabular-nums text-ink/80 border-l border-rule pl-6"
              suppressHydrationWarning
              title={`${SITE_DATA.brand.city} local time`}
            >
              {SITE_DATA.brand.city} {mounted ? timeStr : "--:--"}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-label text-ink/80">
          <span>{SITE_DATA.footer.copyright}</span>
          <button
            onClick={scrollToTop}
            data-magnetic
            className="pressable text-ink underline underline-offset-4 decoration-ink/20 hover:decoration-ink transition-colors"
          >
            {SITE_DATA.footer.backToTop}
          </button>
        </div>
      </div>
    </footer>
  );
}
