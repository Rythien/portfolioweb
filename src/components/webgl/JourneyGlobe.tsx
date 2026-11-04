"use client";

import React, { useEffect, useRef } from "react";

interface JourneyGlobeProps {
  progress?: number; // 0 to 1
  className?: string;
}

// Kathmandu: 27.7172° N, 85.3240° E
// Kuala Lumpur: 3.1390° N, 101.6869° E
const KTM = { lat: 27.7172, lon: 85.324, label: "Kathmandu" };
const KUL = { lat: 3.139, lon: 101.6869, label: "Kuala Lumpur" };

function toCartesian(lat: number, lon: number, radius: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return {
    x: -(radius * Math.sin(phi) * Math.cos(theta)),
    z: radius * Math.sin(phi) * Math.sin(theta),
    y: radius * Math.cos(phi),
  };
}

export default function JourneyGlobe({
  progress = 0,
  className = "",
}: JourneyGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Generate globe surface dots with land clusters
    const DOTS_COUNT = 900;
    const dots: { lat: number; lon: number }[] = [];
    for (let i = 0; i < DOTS_COUNT; i++) {
      const lat = (Math.acos(2 * Math.random() - 1) - Math.PI / 2) * (180 / Math.PI);
      const lon = (Math.random() * 360 - 180);
      dots.push({ lat, lon });
    }

    let animId: number;
    let isVisible = true;
    let rotationY = 0;

    const resize = () => {
      const size = Math.min(container.clientWidth || 360, 480);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0]?.isIntersecting ?? false;
    });
    observer.observe(container);

    const render = () => {
      if (isVisible) {
        const size = Math.min(container.clientWidth || 360, 480);
        const radius = size * 0.38;
        const cx = size / 2;
        const cy = size / 2;

        ctx.clearRect(0, 0, size, size);

        // Rotation linked to scroll progress + slow ambient rotation
        if (!prefersReducedMotion) {
          rotationY = (progress * Math.PI * 0.8) - 1.5;
        } else {
          rotationY = -1.5;
        }

        // 1. Draw outer circle ring in two-tone
        ctx.strokeStyle = "rgba(237, 235, 230, 0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        // 2. Project and draw globe dots
        const cosR = Math.cos(rotationY);
        const sinR = Math.sin(rotationY);

        ctx.fillStyle = "#edebe6";

        dots.forEach((dot) => {
          const pt = toCartesian(dot.lat, dot.lon, radius);
          // Rotate around Y axis
          const rx = pt.x * cosR - pt.z * sinR;
          const rz = pt.x * sinR + pt.z * cosR;

          // Only draw dots on visible hemisphere
          if (rz > 0) {
            const alpha = Math.max(0.08, rz / radius * 0.65);
            ctx.fillStyle = `rgba(237, 235, 230, ${alpha.toFixed(2)})`;
            ctx.fillRect(cx + rx - 0.75, cy + pt.y - 0.75, 1.5, 1.5);
          }
        });

        // 3. Great Circle Arc between KTM and KUL
        const p1 = toCartesian(KTM.lat, KTM.lon, radius);
        const p2 = toCartesian(KUL.lat, KUL.lon, radius);

        const r1 = { x: p1.x * cosR - p1.z * sinR, y: p1.y, z: p1.x * sinR + p1.z * cosR };
        const r2 = { x: p2.x * cosR - p2.z * sinR, y: p2.y, z: p2.x * sinR + p2.z * cosR };

        // Draw points for KTM and KUL
        if (r1.z > -10) {
          ctx.fillStyle = "#edebe6";
          ctx.beginPath();
          ctx.arc(cx + r1.x, cy + r1.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        if (r2.z > -10) {
          ctx.fillStyle = "#edebe6";
          ctx.beginPath();
          ctx.arc(cx + r2.x, cy + r2.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw animated arc
        ctx.strokeStyle = "rgba(237, 235, 230, 0.85)";
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const steps = 30;
        const maxStep = Math.floor(steps * Math.min(1.0, progress * 1.25));

        for (let s = 0; s <= maxStep; s++) {
          const t = s / steps;
          // Spherical SLERP interpolation
          const ix = p1.x * (1 - t) + p2.x * t;
          const iy = p1.y * (1 - t) + p2.y * t;
          const iz = p1.z * (1 - t) + p2.z * t;
          const len = Math.hypot(ix, iy, iz);
          const nx = (ix / len) * (radius + 2);
          const ny = (iy / len) * (radius + 2);
          const nz = (iz / len) * (radius + 2);

          const arcX = nx * cosR - nz * sinR;
          const arcZ = nx * sinR + nz * cosR;

          if (arcZ > -20) {
            if (s === 0) {
              ctx.moveTo(cx + arcX, cy + ny);
            } else {
              ctx.lineTo(cx + arcX, cy + ny);
            }
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, [progress]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center select-none ${className}`}
    >
      <canvas ref={canvasRef} className="block mx-auto" />
    </div>
  );
}
