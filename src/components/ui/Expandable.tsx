"use client";

import React, { useState, useRef } from "react";
import { gsap } from "gsap";

interface ExpandableProps {
  previewContent: React.ReactNode;
  expandedContent: React.ReactNode;
  openLabel?: string;
  closeLabel?: string;
  className?: string;
}

export default function Expandable({
  previewContent,
  expandedContent,
  openLabel = "Read more",
  closeLabel = "Close",
  className = "",
}: ExpandableProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [buttonText, setButtonText] = useState(openLabel);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const toggleOpen = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Decode button text effect
    const targetLabel = nextState ? closeLabel : openLabel;
    if (prefersReducedMotion) {
      setButtonText(targetLabel);
      return;
    }

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+−";
    let iteration = 0;
    const interval = setInterval(() => {
      setButtonText(
        targetLabel
          .split("")
          .map((letter, index) => {
            if (index < iteration) {
              return targetLabel[index];
            }
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("")
      );

      if (iteration >= targetLabel.length) {
        clearInterval(interval);
      }
      iteration += 1 / 2;
    }, 28);

    // Canvas particle assembly on open
    if (nextState && canvasRef.current && contentRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = contentRef.current.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Draw assembling pixels
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.45, ease: "power2.out", delay: 0.1 }
      );
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Base preview content (always visible) */}
      <div>{previewContent}</div>

      {/* Desktop always displays expanded content */}
      <div className="hidden md:block mt-3">{expandedContent}</div>

      {/* Mobile Expandable Container */}
      <div className="md:hidden">
        <div
          ref={contentRef}
          id="expandable-mobile-content"
          aria-hidden={!isOpen}
          className={`overflow-hidden transition-all duration-300 ease-out ${
            isOpen ? "max-h-[600px] opacity-100 mt-3" : "max-h-0 opacity-0"
          }`}
        >
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 w-full h-full"
          />
          {expandedContent}
        </div>

        {/* Mobile Toggle Button */}
        <button
          onClick={toggleOpen}
          aria-expanded={isOpen}
          aria-controls="expandable-mobile-content"
          className="mt-3 min-h-[44px] flex items-center gap-2 font-mono text-label uppercase tracking-wider text-[#edebe6]/75 hover:text-white border border-white/15 px-3 py-1.5 rounded-sm transition-colors active:bg-white/10"
        >
          <span className="font-semibold text-xs text-[#edebe6]">
            {isOpen ? "−" : "+"}
          </span>
          <span className="font-mono">{buttonText}</span>
        </button>
      </div>
    </div>
  );
}
