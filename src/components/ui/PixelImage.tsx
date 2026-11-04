"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";

interface PixelImageProps {
  src: string;
  alt: string;
  caption?: string;
  figureNumber?: string;
  className?: string;
  aspectRatio?: string;
}

const RESOLUTION_STEPS = [32, 16, 8, 4, 2, 1];

// 8x8 Bayer matrix values normalized (0 to 63)
const BAYER_8X8 = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  25, 63, 31, 55, 23, 61, 29, 53, 21,
];

function subscribeTouch(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}

function getTouchSnapshot() {
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches
  );
}

export default function PixelImage({
  src,
  alt,
  caption,
  className = "",
  aspectRatio = "aspect-[16/10]",
}: PixelImageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isResolved, setIsResolved] = useState(false);
  const [hasRealImage, setHasRealImage] = useState(false);
  const [peekRadius, setPeekRadius] = useState(0);
  const [peekPos, setPeekPos] = useState({ x: 50, y: 50 });
  const hasTriggered = useRef(false);

  const isTouchDevice = useSyncExternalStore(
    subscribeTouch,
    getTouchSnapshot,
    () => false
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Check if image is placeholder
    const isPlaceholder =
      !src ||
      src.trim() === "" ||
      src.includes("opengraph") ||
      src.includes("placeholder");

    const renderProceduralPlaceholder = () => {
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 375;
      if (w === 0 || h === 0) return;

      canvas.width = w;
      canvas.height = h;

      // Dark #0B0B0B intentional background
      ctx.fillStyle = "#0b0b0b";
      ctx.fillRect(0, 0, w, h);

      // Subtle two-tone Bayer dither gradient
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      for (let y = 0; y < h; y++) {
        const ny = y / h;
        for (let x = 0; x < w; x++) {
          const nx = x / w;
          const idx = (y * w + x) * 4;

          // Subtle diagonal dark gradient
          const grad = 0.05 + 0.08 * (1 - (nx * 0.6 + ny * 0.4));
          const bayerThreshold = (BAYER_8X8[(y % 8) * 8 + (x % 8)] + 0.5) / 64;

          if (grad > bayerThreshold * 0.35) {
            data[idx] = 32;     // R
            data[idx + 1] = 32; // G
            data[idx + 2] = 32; // B
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // Subtle architectural grid overlay
      ctx.strokeStyle = "rgba(237, 235, 230, 0.06)";
      ctx.lineWidth = 1;

      // Center crosshair
      const cx = Math.floor(w / 2);
      const cy = Math.floor(h / 2);
      ctx.beginPath();
      ctx.moveTo(cx - 24, cy);
      ctx.lineTo(cx + 24, cy);
      ctx.moveTo(cx, cy - 24);
      ctx.lineTo(cx, cy + 24);
      ctx.stroke();

      // Corner ticks
      const inset = 16;
      ctx.beginPath();
      ctx.moveTo(inset, inset + 8);
      ctx.lineTo(inset, inset);
      ctx.lineTo(inset + 8, inset);

      ctx.moveTo(w - inset - 8, inset);
      ctx.lineTo(w - inset, inset);
      ctx.lineTo(w - inset, inset + 8);

      ctx.moveTo(inset, h - inset - 8);
      ctx.lineTo(inset, h - inset);
      ctx.lineTo(inset + 8, h - inset);

      ctx.moveTo(w - inset - 8, h - inset);
      ctx.lineTo(w - inset, h - inset);
      ctx.lineTo(w - inset, h - inset - 8);
      ctx.stroke();

      setIsResolved(true);
      setHasRealImage(false);
    };

    if (isPlaceholder) {
      renderProceduralPlaceholder();
      window.addEventListener("resize", renderProceduralPlaceholder);
      return () => window.removeEventListener("resize", renderProceduralPlaceholder);
    }

    // Real image loading & resolving
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;

    let stepIndex = prefersReducedMotion ? RESOLUTION_STEPS.length - 1 : 0;

    const renderDither = (pixelSize: number) => {
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 375;
      if (w === 0 || h === 0) return;

      canvas.width = w;
      canvas.height = h;

      const scaledW = Math.max(1, Math.floor(w / pixelSize));
      const scaledH = Math.max(1, Math.floor(h / pixelSize));

      const offCanvas = document.createElement("canvas");
      offCanvas.width = scaledW;
      offCanvas.height = scaledH;
      const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
      if (!offCtx) return;

      offCtx.drawImage(img, 0, 0, scaledW, scaledH);
      const imgData = offCtx.getImageData(0, 0, scaledW, scaledH);
      const data = imgData.data;

      // 8x8 Bayer ordered dithering
      for (let y = 0; y < scaledH; y++) {
        for (let x = 0; x < scaledW; x++) {
          const idx = (y * scaledW + x) * 4;
          const lum =
            (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) / 255;
          const bayerThreshold = (BAYER_8X8[(y % 8) * 8 + (x % 8)] + 0.5) / 64;

          // Pure two-tone #050505 or #edebe6
          const isOn = lum > bayerThreshold;
          const val = isOn ? 237 : 11;
          data[idx] = val;
          data[idx + 1] = val;
          data[idx + 2] = val;
          data[idx + 3] = 255;
        }
      }

      offCtx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offCanvas, 0, 0, scaledW, scaledH, 0, 0, w, h);
    };

    img.onload = () => {
      setHasRealImage(true);
      renderDither(RESOLUTION_STEPS[stepIndex]);

      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry.isIntersecting && !hasTriggered.current) {
            hasTriggered.current = true;

            if (prefersReducedMotion) {
              renderDither(1);
              setIsResolved(true);
              return;
            }

            const stepTimer = setInterval(() => {
              stepIndex++;
              if (stepIndex >= RESOLUTION_STEPS.length) {
                clearInterval(stepTimer);
                renderDither(1); // Ends at full resolution (1px)
                setIsResolved(true);
                if (window.matchMedia("(pointer: coarse)").matches) {
                  setPeekRadius(800);
                }
              } else {
                renderDither(RESOLUTION_STEPS[stepIndex]);
              }
            }, 75);

            observer.disconnect();
          }
        },
        { threshold: 0.15 }
      );

      observer.observe(container);
    };

    img.onerror = () => {
      renderProceduralPlaceholder();
    };

    const handleResize = () => {
      if (img.complete && img.naturalWidth > 0) {
        renderDither(RESOLUTION_STEPS[stepIndex]);
      } else {
        renderProceduralPlaceholder();
      }
    };

    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [src]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTouchDevice || !hasRealImage) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPeekPos({ x, y });
    setPeekRadius(110);
  };

  const handleMouseLeave = () => {
    if (isTouchDevice || !hasRealImage) return;
    setPeekRadius(0);
  };

  return (
    <figure className={`flex flex-col gap-2 ${className}`}>
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        data-cursor={hasRealImage ? (isResolved ? "Inspect" : "Resolving") : undefined}
        className={`relative w-full ${aspectRatio} overflow-hidden bg-[#0b0b0b] border border-white/[0.12] rounded-sm select-none group`}
      >
        {/* Canvas Layer for 2-Tone Bayer Dither */}
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover block"
        />

        {/* Original Color Layer revealed only when real image exists */}
        {hasRealImage && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={src}
            alt={alt}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-[clip-path] duration-300 ease-out"
            style={{
              clipPath: isTouchDevice
                ? peekRadius > 0
                  ? "circle(150% at 50% 50%)"
                  : "circle(0px at 50% 50%)"
                : `circle(${peekRadius}px at ${peekPos.x}px ${peekPos.y}px)`,
            }}
          />
        )}

        {/* Hover hint badge only shown when real image exists */}
        {hasRealImage && (
          <div className="absolute bottom-3 right-3 pointer-events-none bg-[#050505]/80 backdrop-blur-sm border border-white/[0.1] px-2 py-0.5 font-mono text-label uppercase tracking-widest text-[#edebe6]/75 transition-opacity duration-300 group-hover:opacity-0">
            {isTouchDevice ? "Dithered preview" : "Hover for colour"}
          </div>
        )}
      </div>

      {/* Short Plain Caption */}
      {caption && (
        <figcaption className="font-mono text-label uppercase tracking-wider text-[#edebe6]/75 px-0.5">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
