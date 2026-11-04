"use client";

import React, { useEffect, useRef } from "react";
import { isLand } from "@/content/landMask";
import { places, KATHMANDU, haversineDistanceKm } from "@/content/globe";

interface RealAsciiGlobeProps {
  progress?: number; // 0 to 1
  onPlaceChange?: (placeIndex: number, currentKm: number) => void;
  className?: string;
}

// Convert lat/lon to 3D Cartesian on unit sphere
function toCartesian(lat: number, lon: number): [number, number, number] {
  const phi = (lat * Math.PI) / 180;
  const theta = (lon * Math.PI) / 180;
  return [
    Math.cos(phi) * Math.sin(theta),
    Math.sin(phi),
    Math.cos(phi) * Math.cos(theta),
  ];
}

// Spherical linear interpolation between two 3D unit vectors
function slerp(
  p1: [number, number, number],
  p2: [number, number, number],
  t: number
): [number, number, number] {
  let dot = p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2];
  dot = Math.max(-1, Math.min(1, dot));
  const omega = Math.acos(dot);
  if (Math.abs(omega) < 1e-4) return p1;
  const sinOmega = Math.sin(omega);
  const a = Math.sin((1 - t) * omega) / sinOmega;
  const b = Math.sin(t * omega) / sinOmega;
  return [
    a * p1[0] + b * p2[0],
    a * p1[1] + b * p2[1],
    a * p1[2] + b * p2[2],
  ];
}

const RAMP = " .:-=+*#";

export default function RealAsciiGlobe({
  progress = 0,
  onPlaceChange,
  className = "",
}: RealAsciiGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);

  // Drag & Inertia state
  const isDragging = useRef(false);
  const pointerStart = useRef({ x: 0, y: 0 });
  const lastPointer = useRef({ x: 0, y: 0 });
  const lastTime = useRef(0);
  const velocity = useRef({ x: 0, y: 0 });
  const rot = useRef({ x: -22 * (Math.PI / 180), y: 85 * (Math.PI / 180) });
  const targetRot = useRef({ x: -22 * (Math.PI / 180), y: 85 * (Math.PI / 180) });

  // Grid dimensions
  const dims = useRef({ cols: 62, rows: 32, charAspect: 0.55 });
  const isVisible = useRef(true);

  // Compute camera rotation target based on progress through the 7 places
  useEffect(() => {
    // 0: Kathmandu, 1: Kuala Lumpur, 2: Sydney, 3: New York, 4: London, 5: Berlin, 6: Paris
    const totalStops = places.length - 1; // 6 segments
    const scaled = Math.min(progress * totalStops, totalStops);
    const activeIdx = Math.min(Math.floor(scaled) + 1, places.length - 1);
    const segT = scaled - Math.floor(scaled);

    const activePlace = places[activeIdx] || places[0];
    const prevPlace = places[Math.max(0, activeIdx - 1)] || places[0];

    // Target longitude: center view on destination
    const targetLon = prevPlace.lon * (1 - segT) + activePlace.lon * segT;
    const targetLat = prevPlace.lat * (1 - segT) + activePlace.lat * segT;

    targetRot.current = {
      x: -targetLat * (Math.PI / 180),
      y: targetLon * (Math.PI / 180),
    };

    const maxDist = haversineDistanceKm(
      KATHMANDU.lat,
      KATHMANDU.lon,
      activePlace.lat,
      activePlace.lon
    );
    const currentKm = Math.round(maxDist * segT);

    onPlaceChange?.(activeIdx, currentKm);
  }, [progress, onPlaceChange]);

  // Pointer event handlers for inertia dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    lastPointer.current = { x: e.clientX, y: e.clientY };
    lastTime.current = performance.now();
    velocity.current = { x: 0, y: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastTime.current);
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;

    rot.current.y -= dx * 0.006;
    rot.current.x -= dy * 0.006;
    // Clamp pitch so Earth does not invert
    rot.current.x = Math.max(-1.25, Math.min(1.25, rot.current.x));

    velocity.current = {
      x: (dx / dt) * 16,
      y: (dy / dt) * 16,
    };

    lastPointer.current = { x: e.clientX, y: e.clientY };
    lastTime.current = now;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Main Render Loop (30 FPS)
  useEffect(() => {
    const container = containerRef.current;
    const pre = preRef.current;
    if (!container || !pre) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Measure character dimensions accurately
    const measureChar = () => {
      const span = document.createElement("span");
      span.textContent = "M";
      span.style.fontFamily = "var(--font-mono), monospace";
      span.style.fontSize = "10px";
      span.style.lineHeight = "1";
      span.style.position = "absolute";
      span.style.visibility = "hidden";
      document.body.appendChild(span);
      const rect = span.getBoundingClientRect();
      document.body.removeChild(span);

      const charW = rect.width || 6;
      const charH = rect.height || 10;
      const aspect = charW / charH;

      const containerW = container.clientWidth || 400;
      const containerH = container.clientHeight || 360;

      const cols = Math.max(38, Math.min(68, Math.floor(containerW / charW)));
      const rows = Math.max(22, Math.min(36, Math.floor(containerH / charH)));

      dims.current = { cols, rows, charAspect: aspect };
    };

    measureChar();
    const resizeObserver = new ResizeObserver(() => measureChar());
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver((entries) => {
      isVisible.current = entries[0]?.isIntersecting ?? false;
    });
    intersectionObserver.observe(container);

    let animId: number;
    let lastRenderTime = 0;
    const FPS_INTERVAL = 1000 / 30; // ~33ms per frame

    // Fixed light direction (upper right)
    const Lx = 0.55;
    const Ly = 0.65;
    const Lz = 0.8;
    const Llen = Math.hypot(Lx, Ly, Lz);
    const nLx = Lx / Llen;
    const nLy = Ly / Llen;
    const nLz = Lz / Llen;

    const ktmVec = toCartesian(KATHMANDU.lat, KATHMANDU.lon);

    const renderFrame = (now: number) => {
      animId = requestAnimationFrame(renderFrame);

      if (!isVisible.current) return;
      if (now - lastRenderTime < FPS_INTERVAL) return;
      lastRenderTime = now;

      // Handle Inertia or Smooth return to target
      if (isDragging.current) {
        // Direct pointer control
      } else {
        const speed = Math.hypot(velocity.current.x, velocity.current.y);
        if (speed > 0.005) {
          rot.current.y -= velocity.current.x * 0.005;
          rot.current.x -= velocity.current.y * 0.005;
          rot.current.x = Math.max(-1.25, Math.min(1.25, rot.current.x));
          velocity.current.x *= 0.92;
          velocity.current.y *= 0.92;
        } else {
          // Continuous ambient spin so the Earth is perpetually alive
          if (!prefersReducedMotion) {
            targetRot.current.y += 0.0018;
          }
          rot.current.y += (targetRot.current.y - rot.current.y) * 0.06;
          rot.current.x += (targetRot.current.x - rot.current.x) * 0.06;
        }
      }

      const { cols, rows, charAspect } = dims.current;
      const radius = 0.92;
      const sphereRadiusRows = (rows / 2) * radius;

      const currentRotX = rot.current.x;
      const currentRotY = rot.current.y;

      const cosX = Math.cos(currentRotX);
      const sinX = Math.sin(currentRotX);
      const cosY = Math.cos(currentRotY);
      const sinY = Math.sin(currentRotY);

      // Pre-allocate character grid
      const grid: string[][] = Array.from({ length: rows }, () =>
        Array(cols).fill(" ")
      );

      // 1. Raycast against unit sphere
      for (let r = 0; r < rows; r++) {
        const ny = ((rows - 1) / 2 - r) / sphereRadiusRows;
        for (let c = 0; c < cols; c++) {
          const nx =
            ((c - (cols - 1) / 2) * charAspect) / sphereRadiusRows;
          const r2 = nx * nx + ny * ny;

          if (r2 <= 1.0) {
            const nz = Math.sqrt(1.0 - r2);

            // Rotate surface normal into Earth space
            const y1 = ny * cosX - nz * sinX;
            const z1 = ny * sinX + nz * cosX;
            const x1 = nx;
            const px = x1 * cosY + z1 * sinY;
            const py = y1;
            const pz = -x1 * sinY + z1 * cosY;

            const lat =
              Math.asin(Math.max(-1, Math.min(1, py))) * (180 / Math.PI);
            const lon = Math.atan2(px, pz) * (180 / Math.PI);

            if (isLand(lat, lon)) {
              // Lambert diffuse lighting + lit limb boost
              const dot = Math.max(0, nx * nLx + ny * nLy + nz * nLz);
              const rim = Math.pow(1.0 - nz, 2.4) * 0.35;
              const brightness = Math.min(1.0, dot * 0.85 + rim);
              const rampIdx = Math.floor(brightness * (RAMP.length - 0.01));
              grid[r][c] = RAMP[rampIdx];
            }
          }
        }
      }

      // 2. Draw great-circle flight arcs
      const totalStops = places.length - 1;
      const scaled = Math.min(progress * totalStops, totalStops);
      const activeIdx = Math.min(Math.floor(scaled) + 1, places.length - 1);
      const activeSegT = scaled - Math.floor(scaled);

      const maxArcDrawIdx = prefersReducedMotion ? places.length - 1 : activeIdx;

      for (let i = 1; i <= maxArcDrawIdx; i++) {
        const destPlace = places[i];
        const destVec = toCartesian(destPlace.lat, destPlace.lon);
        const isActiveArc = i === activeIdx && !prefersReducedMotion;
        const arcProgress = isActiveArc ? activeSegT : 1.0;

        const ARC_STEPS = 30;
        const stepsToDraw = Math.floor(ARC_STEPS * arcProgress);

        for (let s = 0; s <= stepsToDraw; s++) {
          const t = s / ARC_STEPS;
          const baseVec = slerp(ktmVec, destVec, t);

          // Flight arc height lift
          const lift = 1.0 + Math.sin(Math.PI * t) * 0.22;
          const wx = baseVec[0] * lift;
          const wy = baseVec[1] * lift;
          const wz = baseVec[2] * lift;

          // Rotate world point into camera view space
          const x2 = wx * cosY - wz * sinY;
          const z2 = wx * sinY + wz * cosY;
          const vx = x2;
          const vy = wy * cosX + z2 * sinX;
          const vz = -wy * sinX + z2 * cosX;

          // Hide points on the far side of the sphere
          if (vz > 0 || vx * vx + vy * vy > 1.0) {
            const col = Math.round(
              (vx * sphereRadiusRows) / charAspect + (cols - 1) / 2
            );
            const row = Math.round((rows - 1) / 2 - vy * sphereRadiusRows);

            if (row >= 0 && row < rows && col >= 0 && col < cols) {
              if (s === stepsToDraw && isActiveArc) {
                grid[row][col] = "✦"; // Bright destination head
              } else if (isActiveArc) {
                // Leading head -> tail gradient
                grid[row][col] = s > stepsToDraw - 4 ? "O" : s > stepsToDraw - 10 ? "o" : ".";
              } else {
                // Faint persistent trail for completed arcs
                grid[row][col] = s === ARC_STEPS ? "✦" : ".";
              }
            }
          }
        }
      }

      // Convert grid array to single text frame (zero DOM churn)
      pre.textContent = grid.map((line) => line.join("")).join("\n");
    };

    animId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [progress]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      data-cursor="Drag"
      className={`relative w-full aspect-square max-w-[500px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none ${className}`}
    >
      <pre
        ref={preRef}
        aria-hidden="true"
        className="font-mono text-[9px] sm:text-[10.5px] leading-none tracking-[-0.04em] text-[#edebe6] overflow-hidden whitespace-pre pointer-events-none text-center"
      />

      {/* Screen-reader accessible transcript */}
      <div className="sr-only">
        3D Earth ASCII globe showing Kathmandu connections to{" "}
        {places.map((p) => `${p.name} (${p.note})`).join(", ")}.
      </div>
    </div>
  );
}
