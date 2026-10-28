"use client";

import React, { useEffect, useRef, useState } from "react";

interface AsciiDitherHeroProps {
  mode?: "dither" | "ascii";
  onModeToggle?: () => void;
}

export default function AsciiDitherHero({
  mode = "dither",
  onModeToggle,
}: AsciiDitherHeroProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentMode, setCurrentMode] = useState<"dither" | "ascii">(mode);

  const switchMode = (m: "dither" | "ascii") => {
    setCurrentMode(m);
    onModeToggle?.();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    // Mouse coordinates with easing and drag inertia
    const mouse = {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2,
      isDown: false,
      dragRotX: 0,
      dragRotY: 0,
      targetRotX: 0,
      targetRotY: 0,
      lastMouseX: 0,
      lastMouseY: 0,
    };

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      mouse.targetX = clientX;
      mouse.targetY = clientY;

      if (mouse.isDown) {
        const deltaX = clientX - mouse.lastMouseX;
        const deltaY = clientY - mouse.lastMouseY;
        mouse.targetRotY += deltaX * 0.008;
        mouse.targetRotX += deltaY * 0.008;
      }
      mouse.lastMouseX = clientX;
      mouse.lastMouseY = clientY;
    };

    const handleMouseDown = (e: MouseEvent) => {
      mouse.isDown = true;
      const rect = canvas.getBoundingClientRect();
      mouse.lastMouseX = e.clientX - rect.left;
      mouse.lastMouseY = e.clientY - rect.top;
    };

    const handleMouseUp = () => {
      mouse.isDown = false;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    let isVisible = true;
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(canvas);

    // ==========================================
    // RENDERER 1: WEBGL 8x8 BAYER DITHER SPHERE
    // ==========================================
    let gl: WebGLRenderingContext | null = null;
    let glProgram: WebGLProgram | null = null;

    if (currentMode === "dither") {
      gl = canvas.getContext("webgl", { alpha: true, antialias: false });
      if (gl) {
        const vsSource = `
          attribute vec2 a_position;
          void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
          }
        `;

        const fsSource = `
          precision highp float;
          uniform vec2 u_resolution;
          uniform vec2 u_mouse;
          uniform float u_time;
          uniform vec2 u_rotation;

          // Recursive Bayer 8x8 ordered dither math
          float bayer2(vec2 a) {
            a = floor(a);
            return fract(dot(a, vec2(0.5, a.y * 0.75)));
          }
          float bayer4(vec2 a) {
            return bayer2(0.5 * a) * 0.25 + bayer2(a);
          }
          float bayer8(vec2 a) {
            return bayer4(0.5 * a) * 0.25 + bayer2(a);
          }

          // 3D Simplex-like procedural harmonic noise
          float hash31(vec3 p) {
            return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
          }

          float noise3(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
                  mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
              mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                  mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z
            );
          }

          // Raymarching Scene: Organic Breathing Deformed Sphere
          float sceneSDF(vec3 p) {
            // Apply mouse drag rotation
            float cosY = cos(u_rotation.y + u_time * 0.2);
            float sinY = sin(u_rotation.y + u_time * 0.2);
            p.xz = mat2(cosY, -sinY, sinY, cosY) * p.xz;

            float cosX = cos(u_rotation.x);
            float sinX = sin(u_rotation.x);
            p.yz = mat2(cosX, -sinX, sinX, cosX) * p.yz;

            // Breathing noise displacement
            float n = noise3(p * 1.4 + vec3(0.0, u_time * 0.25, 0.0));
            float sphere = length(p) - (1.18 + n * 0.22);
            return sphere * 0.8;
          }

          vec3 calcNormal(vec3 p) {
            vec2 e = vec2(0.003, 0.0);
            return normalize(vec3(
              sceneSDF(p + e.xyy) - sceneSDF(p - e.xyy),
              sceneSDF(p + e.yxy) - sceneSDF(p - e.yxy),
              sceneSDF(p + e.yzx) - sceneSDF(p - e.yzx)
            ));
          }

          void main() {
            vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
            vec2 mouseNorm = (u_mouse - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
            mouseNorm.y = -mouseNorm.y;

            // Cursor Magnifying Lens / Gravitational Bulge
            vec2 delta = uv - mouseNorm;
            float dist = length(delta);
            float lens = exp(-dist * 4.5) * 0.08;
            uv -= normalize(delta + 0.0001) * lens;

            // Camera setup
            vec3 ro = vec3(0.0, 0.0, 3.2);
            vec3 rd = normalize(vec3(uv, -1.6));

            // Raymarch loop
            float t = 0.0;
            float hit = 0.0;
            vec3 p = ro;

            for (int i = 0; i < 48; i++) {
              p = ro + rd * t;
              float d = sceneSDF(p);
              if (d < 0.002) {
                hit = 1.0;
                break;
              }
              if (t > 5.5) break;
              t += d;
            }

            vec3 col = vec3(0.043, 0.043, 0.043); // Void black #0B0B0B

            if (hit > 0.5) {
              vec3 n = calcNormal(p);
              vec3 light = normalize(vec3(1.2, 1.8, 1.5));
              float diff = max(0.0, dot(n, light));
              float rim = pow(1.0 - max(0.0, dot(n, -rd)), 2.5);

              float luminance = diff * 0.75 + rim * 0.65;

              // 8x8 Bayer Matrix Dither Threshold
              float ditherThreshold = bayer8(gl_FragCoord.xy / 2.0);

              if (luminance > ditherThreshold) {
                col = vec3(0.93, 0.92, 0.90); // Off-white #EDEBE6
              } else {
                col = vec3(0.043, 0.043, 0.043);
              }
            } else {
              // Atmospheric dither halo around the sphere
              float haloDist = length(uv);
              float halo = smoothstep(1.3, 0.3, haloDist) * 0.18;
              if (halo > bayer8(gl_FragCoord.xy / 3.0)) {
                col = vec3(0.18, 0.18, 0.18);
              }
            }

            gl_FragColor = vec4(col, 1.0);
          }
        `;

        const compileShader = (type: number, src: string) => {
          if (!gl) return null;
          const s = gl.createShader(type);
          if (!s) return null;
          gl.shaderSource(s, src);
          gl.compileShader(s);
          return s;
        };

        const vs = compileShader(gl.VERTEX_SHADER, vsSource);
        const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
        if (vs && fs) {
          glProgram = gl.createProgram();
          if (glProgram) {
            gl.attachShader(glProgram, vs);
            gl.attachShader(glProgram, fs);
            gl.linkProgram(glProgram);
            gl.useProgram(glProgram);

            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
              gl.STATIC_DRAW
            );

            const aPos = gl.getAttribLocation(glProgram, "a_position");
            gl.enableVertexAttribArray(aPos);
            gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
          }
        }
      }
    }

    // ==========================================
    // RENDERER 2: REAL 3D ASCII GLOBE (CANVAS 2D)
    // ==========================================
    const ctx = currentMode === "ascii" ? canvas.getContext("2d") : null;
    const ASCII_CHARS = " ·:+*#%@";

    let time = 0;

    const render = () => {
      animId = requestAnimationFrame(render);
      if (!isVisible) return;

      time += prefersReducedMotion ? 0.002 : 0.015;

      // Mouse drag inertia interpolation
      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;
      mouse.dragRotX += (mouse.targetRotX - mouse.dragRotX) * 0.08;
      mouse.dragRotY += (mouse.targetRotY - mouse.dragRotY) * 0.08;

      if (!mouse.isDown) {
        // Slow auto rotation
        mouse.targetRotY += 0.003;
      }

      if (currentMode === "dither" && gl && glProgram) {
        gl.viewport(0, 0, width, height);
        const uRes = gl.getUniformLocation(glProgram, "u_resolution");
        const uMouse = gl.getUniformLocation(glProgram, "u_mouse");
        const uTime = gl.getUniformLocation(glProgram, "u_time");
        const uRot = gl.getUniformLocation(glProgram, "u_rotation");

        gl.uniform2f(uRes, width, height);
        gl.uniform2f(uMouse, mouse.x, height - mouse.y);
        gl.uniform1f(uTime, time);
        gl.uniform2f(uRot, mouse.dragRotX, mouse.dragRotY);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      } else if (currentMode === "ascii" && ctx) {
        // 3D ASCII Terminal Globe Projection
        ctx.fillStyle = "#0B0B0B";
        ctx.fillRect(0, 0, width, height);

        const fontSize = Math.max(10, Math.floor(width / 75));
        ctx.font = `${fontSize}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const radius = Math.min(width, height) * 0.32;
        const centerX = width * 0.58; // Positioned toward right half on desktop
        const centerY = height * 0.48;

        const rotY = mouse.dragRotY + time * 0.4;
        const rotX = mouse.dragRotX + 0.25;

        const totalPoints = 900;
        for (let i = 0; i < totalPoints; i++) {
          const theta = Math.acos(1 - (2 * (i + 0.5)) / totalPoints);
          const phi = Math.PI * (1 + Math.sqrt(5)) * i;

          const px = radius * Math.sin(theta) * Math.cos(phi);
          const py = radius * Math.cos(theta);
          const pz = radius * Math.sin(theta) * Math.sin(phi);

          // Rotate Y
          const cosY = Math.cos(rotY);
          const sinY = Math.sin(rotY);
          const x1 = px * cosY + pz * sinY;
          const z1 = -px * sinY + pz * cosY;

          // Rotate X
          const cosX = Math.cos(rotX);
          const sinX = Math.sin(rotX);
          const y2 = py * cosX - z1 * sinX;
          const z2 = py * sinX + z1 * cosX;

          // Perspective projection
          const fov = 650;
          const scale = fov / (fov + z2);
          const screenX = centerX + x1 * scale;
          const screenY = centerY + y2 * scale;

          if (z2 > -radius * 0.8) {
            // Calculate normal and diffuse light
            const nx = x1 / radius;
            const ny = y2 / radius;
            const nz = z2 / radius;
            const light = Math.max(0, nx * 0.4 + ny * 0.6 + nz * 0.7);

            const charIndex = Math.floor(light * (ASCII_CHARS.length - 1));
            const char = ASCII_CHARS[Math.max(0, Math.min(ASCII_CHARS.length - 1, charIndex))];

            // Cursor lens interaction
            const dx = screenX - mouse.x;
            const dy = screenY - mouse.y;
            const d = Math.hypot(dx, dy);
            const isNearCursor = d < 120;

            ctx.fillStyle = isNearCursor
              ? "#FFFFFF"
              : z2 > 0
              ? `rgba(237, 235, 230, ${0.4 + light * 0.6})`
              : "rgba(142, 139, 130, 0.25)";

            ctx.fillText(char, screenX, screenY);
          }
        }
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      observer.disconnect();
    };
  }, [currentMode]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 overflow-hidden select-none pointer-events-auto"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* Mode Switcher pill (christendijoux.com Lab style) */}
      <div className="absolute top-24 right-6 sm:right-10 lg:right-12 z-20 flex items-center gap-1 bg-[#0B0B0B]/80 border border-white/10 px-1 py-1 font-mono text-[11px] backdrop-blur-sm">
        <button
          onClick={() => switchMode("dither")}
          className={`px-2.5 py-1 transition-colors ${
            currentMode === "dither"
              ? "bg-[#EDEBE6] text-[#0B0B0B] font-semibold"
              : "text-[#8E8B82] hover:text-[#EDEBE6]"
          }`}
        >
          BAYER 8×8
        </button>
        <button
          onClick={() => switchMode("ascii")}
          className={`px-2.5 py-1 transition-colors ${
            currentMode === "ascii"
              ? "bg-[#EDEBE6] text-[#0B0B0B] font-semibold"
              : "text-[#8E8B82] hover:text-[#EDEBE6]"
          }`}
        >
          ASCII GLOBE
        </button>
      </div>

      {/* Subtle Drag Prompt */}
      <div className="hidden sm:block absolute bottom-8 right-6 sm:right-10 lg:right-12 z-20 font-mono text-[10px] text-[#8E8B82] tracking-widest uppercase pointer-events-none">
        [ DRAG TO ROTATE 3D MESH ]
      </div>
    </div>
  );
}
