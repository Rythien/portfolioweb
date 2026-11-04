"use client";

import React from "react";
import { SITE_DATA } from "@/content/site";

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="py-16 sm:py-24 border-t border-white/[0.08] bg-[#08080a] text-[#8b8e99] font-mono text-label uppercase tracking-widest select-none">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Left: Copyright */}
        <div className="text-center sm:text-left">
          {SITE_DATA.footer.copyright}
        </div>

        {/* Center: System Architecture */}
        <div className="hidden md:block text-[#8b8e99]/60">
          DESIGNED FOR CONTEMPLATION · KATHMANDU
        </div>

        {/* Right: Back to Top */}
        <div>
          <button
            onClick={scrollToTop}
            data-magnetic
            className="text-[#f2efe9] hover:text-white transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white"
          >
            {SITE_DATA.footer.backToTop}
          </button>
        </div>
      </div>
    </footer>
  );
}
