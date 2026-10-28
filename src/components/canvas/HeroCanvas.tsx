"use client";

import React, { useEffect, useRef } from "react";

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Respect reduced motion
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates and velocity tracking
    const mouse = {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2,
      vx: 0,
      vy: 0,
    };

    // Resilient particle grid
    const PARTICLE_COUNT = Math.min(120, Math.floor((width * height) / 12000));
    interface Particle {
      x: number;
      y: number;
      originX: number;
      originY: number;
      size: number;
      alpha: number;
      vx: number;
      vy: number;
      color: string;
    }

    const particles: Particle[] = [];

    // Vermilion accent color and muted titanium
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const isAccent = Math.random() < 0.12;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        originX: Math.random() * width,
        originY: Math.random() * height,
        size: isAccent ? Math.random() * 2 + 1.2 : Math.random() * 1.5 + 0.8,
        alpha: Math.random() * 0.45 + 0.15,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        color: isAccent ? "rgba(255, 59, 38, " : "rgba(245, 245, 243, ",
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    let isVisible = true;
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(canvas);

    let time = 0;

    const render = () => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      time += 0.015;

      // Smooth mouse interpolation
      mouse.vx = (mouse.targetX - mouse.x) * 0.06;
      mouse.vy = (mouse.targetY - mouse.y) * 0.06;
      mouse.x += mouse.vx;
      mouse.y += mouse.vy;

      ctx.clearRect(0, 0, width, height);

      // Subtle architectural grid coordinate crosshairs
      ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
      ctx.lineWidth = 1;

      // Draw particle nodes and connect proximate neighbors
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Gentle drift
        p.x += p.vx + Math.sin(time + i) * 0.15;
        p.y += p.vy + Math.cos(time + i) * 0.15;

        // Wrap around boundaries
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Interaction with mouse cursor
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 180;

        if (dist < maxDist) {
          const force = (1 - dist / maxDist) * 1.8;
          p.x -= (dx / dist) * force;
          p.y -= (dy / dist) * force;
        }

        // Draw particle
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.fillRect(p.x, p.y, p.size, p.size);

        // Connect nearby particles with subtle hairline
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist2 = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist2 < 110) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.035 * (1 - dist2 / 110)})`;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Cursor subtle ambient glow ring
      const gradient = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        0,
        mouse.x,
        mouse.y,
        220
      );
      gradient.addColorStop(0, "rgba(255, 59, 38, 0.045)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full opacity-70 transition-opacity duration-1000"
      />
      {/* Static CSS Fallback for Reduced Motion or No-JS */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,59,38,0.08),rgba(5,5,5,0))]" />
      <div className="noise-overlay absolute inset-0 opacity-40" />
    </div>
  );
}
