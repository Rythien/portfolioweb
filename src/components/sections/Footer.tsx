"use client";

import React from "react";
import { SITE_DATA } from "@/content/site";

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer data-reveal className="pt-16 sm:pt-24 pb-32 border-t border-rule font-mono text-label select-none text-ink-muted">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="text-center sm:text-left">
          {SITE_DATA.footer.copyright}
        </div>

        <div className="hidden md:block text-ink-faint">
          Designed in Kathmandu
        </div>

        <div>
          <button
            onClick={scrollToTop}
            data-magnetic
            className="text-ink hover:text-ink transition-colors underline underline-offset-4 decoration-ink/20 hover:decoration-ink"
          >
            {SITE_DATA.footer.backToTop}
          </button>
        </div>
      </div>
    </footer>
  );
}
