"use client";

import React, { useEffect, useRef } from "react";

interface ChristenAsciiGlobeProps {
  className?: string;
  interactive?: boolean;
}

export default function ChristenAsciiGlobe({
  className = "",
  interactive = true,
}: ChristenAsciiGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let isVisible = true;
    let cols = 0;
    let rows = 0;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      if (!canvas || !canvas.parentElement) return;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Character grid calibration (standard 6.82px x 11px glyph cell)
      cols = Math.floor(width / 6.82);
      rows = Math.floor(height / 11);

      ctx.font = '11px "Geist Mono", "JetBrains Mono", ui-monospace, monospace';
      ctx.textBaseline = "top";
    };

    resize();

    // Mouse coordinates and rotational inertia
    const mouse = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      isDown: false,
      rotX: 0,
      rotY: 0,
      dragRotX: 0,
      dragRotY: 0,
      lastX: 0,
      lastY: 0,
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouse.targetX = (x / rect.width) * 2 - 1;
      mouse.targetY = -(y / rect.height) * 2 + 1;

      if (interactive && mouse.isDown) {
        const deltaX = x - mouse.lastX;
        const deltaY = y - mouse.lastY;
        mouse.dragRotY += deltaX * 0.008;
        mouse.dragRotX += deltaY * 0.008;
      }
      mouse.lastX = x;
      mouse.lastY = y;
    };

    const handleMouseDown = (e: MouseEvent) => {
      mouse.isDown = true;
      const rect = canvas.getBoundingClientRect();
      mouse.lastX = e.clientX - rect.left;
      mouse.lastY = e.clientY - rect.top;
    };

    const handleMouseUp = () => {
      mouse.isDown = false;
    };

    if (interactive) {
      window.addEventListener("mousemove", handleMouseMove, { passive: true });
      window.addEventListener("mousedown", handleMouseDown);
      window.addEventListener("mouseup", handleMouseUp);
    }

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(canvas);

    const ASCII_CHARS = " .·:-=+*#%@";

    // Christen Dijoux's mathematical spherical ray projection & orbital ring
    const renderFrame = (timestamp: number) => {
      if (!canvas) return;
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse lerping
      mouse.x += (mouse.targetX - mouse.x) * 0.06;
      mouse.y += (mouse.targetY - mouse.y) * 0.06;
      mouse.rotX += (mouse.dragRotX - mouse.rotX) * 0.08;
      mouse.rotY += (mouse.dragRotY - mouse.rotY) * 0.08;

      const cellW = width / cols;
      const radius = 0.44 * Math.min(cols * cellW, 11 * rows);
      const centerX = width / 2;
      const centerY = height / 2;

      const timeSpeed = prefersReducedMotion ? 0 : timestamp * 0.00025;
      const rotTime = timeSpeed + mouse.rotY;
      const lightTilt = 0.6 * Math.cos(0.7 * rotTime);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const nx = (c * cellW + cellW / 2 - centerX) / radius;
          const ny = (11 * r + 5.5 - centerY) / radius;
          const distSq = nx * nx + ny * ny;

          let luminance = 0;

          if (distSq < 1) {
            // Inside sphere
            const nz = Math.sqrt(1 - distSq);
            const longitude = Math.atan2(nx, nz) + 4 * rotTime;
            const latitude = Math.asin(ny);

            // Meridian and parallel coordinate grid lines
            const gridLines =
              Math.abs(Math.sin(6 * longitude)) < 0.12 ||
              Math.abs(Math.sin(8 * latitude)) < 0.1
                ? 0.35
                : 0;

            // Normal and diffuse lighting
            const diffuse = Math.max(0, nx * lightTilt + -0.5 * ny + 0.62 * nz);
            luminance = Math.min(1, 0.85 * diffuse + gridLines);
          } else if (distSq < 1.65) {
            // Orbital ring surrounding the globe
            const dist = Math.sqrt(distSq);
            const ringAngle = 3 * Math.atan2(ny, nx) + 6 * rotTime;
            if (Math.abs(dist - 1.25 - 0.02 * Math.sin(ringAngle)) < 0.035) {
              luminance = 0.55;
            }
          }

          if (luminance > 0.04) {
            const charIdx = Math.min(10, Math.floor(11 * luminance));
            const char = ASCII_CHARS[charIdx];

            // Tone: warm off-white #F2F2EE with opacity mapped to depth
            ctx.fillStyle = `rgba(242, 242, 238, ${0.2 + 0.8 * luminance})`;
            ctx.fillText(char, c * cellW, 11 * r);
          }
        }
      }
    };

    const loop = (timestamp: number) => {
      animId = requestAnimationFrame(loop);
      if (!isVisible) return;
      renderFrame(timestamp);
    };

    animId = requestAnimationFrame(loop);

    const handleResize = () => {
      resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      if (interactive) {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mousedown", handleMouseDown);
        window.removeEventListener("mouseup", handleMouseUp);
      }
    };
  }, [interactive]);

  return (
    <canvas
      ref={canvasRef}
      className={`block h-full w-full select-none cursor-grab active:cursor-grabbing ${className}`}
      aria-label="3D ASCII Globe"
    />
  );
}
