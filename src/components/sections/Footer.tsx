"use client";

import React from "react";
import { SITE_DATA } from "@/content/site";

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

      {/* Closing statement straight onto the copyright bar; the email
          actions, socials and local time live with Contact above. Bottom
          padding clears the fixed WAKE/DREAM pill */}
      <div className="footer-end max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full pt-14 sm:pt-20 flex flex-col gap-10 sm:gap-12">
        <a
          href={`mailto:${SITE_DATA.contact.email}`}
          data-cursor="Email"
          className="font-[family-name:var(--font-sans)] text-display uppercase text-ink hover:opacity-90 transition-opacity w-fit"
        >
          Get in <span className="accent-word">touch</span>
        </a>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-rule pt-6 font-mono text-label text-ink/80">
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
