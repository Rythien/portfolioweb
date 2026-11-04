"use client";

import React, { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SITE_DATA } from "@/content/site";
import { useDreamMode } from "@/contexts/DreamModeContext";

gsap.registerPlugin(ScrollTrigger);

export default function DreamTeaser() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { toggleDreamMode } = useDreamMode();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".dream-content",
        { opacity: 0, y: 35 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const handleOpenMode = () => {
    toggleDreamMode();
    setModalOpen(true);
  };

  return (
    <section
      ref={sectionRef}
      id="dream-mode"
      aria-label="Alternate 3D Mode Teaser"
      className="py-32 sm:py-44 border-t border-white/[0.08] relative overflow-hidden"
    >
      {/* Background ethereal atmospheric glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full relative z-10">
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-16 sm:mb-24 font-mono text-label uppercase tracking-widest text-[#8b8e99]">
          <span>{SITE_DATA.dreamMode.sectionNum} · {SITE_DATA.dreamMode.title}</span>
          <span>SPATIAL REALM [PHASE 2]</span>
        </div>

        {/* Teaser Block */}
        <div className="dream-content max-w-4xl flex flex-col gap-8 sm:gap-10">
          <h2 className="font-[family-name:var(--font-display)] text-display sm:text-7xl font-light text-[#f2efe9] leading-[1.08] tracking-[-0.03em] [text-wrap:pretty]">
            {SITE_DATA.dreamMode.headline}
          </h2>

          <p className="font-[family-name:var(--font-sans)] text-body-lg text-[#8b8e99] leading-relaxed max-w-[60ch] [text-wrap:pretty]">
            {SITE_DATA.dreamMode.description}
          </p>

          <div className="pt-4 flex flex-wrap items-center gap-6">
            <button
              onClick={handleOpenMode}
              data-magnetic
              data-cursor="Dream"
              className="px-8 py-4 bg-[#f2efe9] text-[#08080a] font-mono text-label uppercase tracking-widest font-semibold hover:bg-white transition-all duration-300 active:scale-95 border border-[#f2efe9]"
            >
              {SITE_DATA.dreamMode.buttonLabel}
            </button>

            <span className="font-mono text-label uppercase tracking-widest text-[#8b8e99]">
              [R3F CANVAS PIPELINE READY]
            </span>
          </div>
        </div>
      </div>

      {/* Phase 2 Notification Sheet Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
        >
          <div className="bg-[#111216] border border-white/20 p-8 sm:p-12 max-w-lg w-full flex flex-col gap-6 text-[#f2efe9]">
            <div className="flex items-center justify-between font-mono text-label uppercase tracking-widest text-[#8b8e99] border-b border-white/10 pb-3">
              <span>SYSTEM NOTICE</span>
              <span>PHASE 2 PORTAL</span>
            </div>

            <h3 className="font-[family-name:var(--font-display)] text-2xl font-light text-white">
              3D Alternate Mode Architecture Primed
            </h3>

            <p className="font-[family-name:var(--font-sans)] text-sm text-[#8b8e99] leading-relaxed">
              The React Three Fiber alternate universe canvas is currently wired into the layout. In Phase 2, this portal will smoothly load the realtime 3D spatial orbit world without reloading the page.
            </p>

            <div className="pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="w-full py-3 bg-[#f2efe9] text-[#08080a] font-mono text-xs uppercase tracking-widest font-semibold hover:bg-white transition-colors"
              >
                Return to Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
