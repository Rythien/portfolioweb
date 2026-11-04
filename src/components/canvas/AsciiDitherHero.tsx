"use client";

import React, { useEffect, useRef, useState } from "react";

interface AsciiDitherHeroProps {
  initialMode?: "ascii" | "dither";
  className?: string;
}

export default function AsciiDitherHero({
  initialMode = "ascii",
  className = "",
}: AsciiDitherHeroProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentMode, setCurrentMode] = useState<"ascii" | "dither">(initialMode);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let animId: number;
    let width = 0;
    let height = 0;

    // Mouse coordinates with easing and drag inertia
    const mouse = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      isDown: false,
      dragRotX: 0,
      dragRotY: 0,
      targetRotX: 0,
      targetRotY: 0,
      lastMouseX: 0,
      lastMouseY: 0,
    };

    const resize = () => {
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      width = Math.max(1, rect.width || window.innerWidth);
      height = Math.max(1, rect.height || window.innerHeight);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      if (mouse.targetX === 0 && mouse.targetY === 0) {
        mouse.x = mouse.targetX = width * 0.65;
        mouse.y = mouse.targetY = height * 0.5;
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      mouse.targetX = clientX;
      mouse.targetY = clientY;

      if (mouse.isDown) {
        const deltaX = clientX - mouse.lastMouseX;
        const deltaY = clientY - mouse.lastMouseY;
        mouse.targetRotY += deltaX * 0.007;
        mouse.targetRotX += deltaY * 0.007;
        mouse.targetRotX = Math.max(-1.1, Math.min(1.1, mouse.targetRotX));
      }
      mouse.lastMouseX = clientX;
      mouse.lastMouseY = clientY;
    };

    const handlePointerDown = (e: PointerEvent) => {
      mouse.isDown = true;
      const rect = container.getBoundingClientRect();
      mouse.lastMouseX = e.clientX - rect.left;
      mouse.lastMouseY = e.clientY - rect.top;
    };

    const handlePointerUp = () => {
      mouse.isDown = false;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);

    let isVisible = true;
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(container);

    let gl: WebGLRenderingContext | null = null;
    let glProgram: WebGLProgram | null = null;
    let glVertexShader: WebGLShader | null = null;
    let glFragmentShader: WebGLShader | null = null;
    let glBuffer: WebGLBuffer | null = null;
    let ctx2d: CanvasRenderingContext2D | null = null;

    if (currentMode === "dither") {
      gl = canvas.getContext("webgl", {
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
      });

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

          // Bayer 8x8 ordered dither
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

          float sceneSDF(vec3 p) {
            float cosY = cos(u_rotation.y + u_time * 0.2);
            float sinY = sin(u_rotation.y + u_time * 0.2);
            p.xz = mat2(cosY, -sinY, sinY, cosY) * p.xz;

            float cosX = cos(u_rotation.x);
            float sinX = sin(u_rotation.x);
            p.yz = mat2(cosX, -sinX, sinX, cosX) * p.yz;

            float n = noise3(p * 1.3 + vec3(0.0, u_time * 0.2, 0.0));
            return length(p) - (1.15 + n * 0.22);
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

            // Cursor Magnifying Lens
            vec2 delta = uv - mouseNorm;
            float dist = length(delta);
            float lens = exp(-dist * 4.5) * 0.08;
            uv -= normalize(delta + 0.0001) * lens;

            // Shift sphere slightly to the right on desktop, center on mobile
            float aspect = u_resolution.x / u_resolution.y;
            if (aspect > 1.1) {
              uv.x -= 0.28;
            } else {
              uv.y += 0.08;
            }

            vec3 ro = vec3(0.0, 0.0, 3.2);
            vec3 rd = normalize(vec3(uv, -1.6));

            float t = 0.0;
            float hit = 0.0;
            vec3 p = ro;

            for (int i = 0; i < 44; i++) {
              p = ro + rd * t;
              float d = sceneSDF(p);
              if (d < 0.0025) {
                hit = 1.0;
                break;
              }
              if (t > 5.5) break;
              t += d;
            }

            // Pure two-tone #050505 and #edebe6
            vec3 ink = vec3(5.0 / 255.0, 5.0 / 255.0, 5.0 / 255.0);
            vec3 paper = vec3(237.0 / 255.0, 235.0 / 255.0, 230.0 / 255.0);

            vec3 col = ink;

            if (hit > 0.5) {
              vec3 n = calcNormal(p);
              vec3 light = normalize(vec3(1.1, 1.6, 1.4));
              float diff = max(0.0, dot(n, light));
              float rim = pow(1.0 - max(0.0, dot(n, -rd)), 2.8);
              float luminance = diff * 0.72 + rim * 0.55;

              float ditherThreshold = bayer8(gl_FragCoord.xy / 2.0);
              if (luminance > ditherThreshold) {
                col = paper;
              }
            } else {
              // Atmospheric halo
              float r = length(uv);
              float halo = smoothstep(1.3, 0.25, r) * 0.16;
              if (halo > bayer8(gl_FragCoord.xy / 3.0)) {
                col = mix(ink, paper, 0.25);
              }
            }

            gl_FragColor = vec4(col, 1.0);
          }
        `;

        const compile = (type: number, src: string) => {
          if (!gl) return null;
          const s = gl.createShader(type);
          if (!s) return null;
          gl.shaderSource(s, src);
          gl.compileShader(s);
          return s;
        };

        glVertexShader = compile(gl.VERTEX_SHADER, vsSource);
        glFragmentShader = compile(gl.FRAGMENT_SHADER, fsSource);

        if (glVertexShader && glFragmentShader) {
          glProgram = gl.createProgram();
          if (glProgram) {
            gl.attachShader(glProgram, glVertexShader);
            gl.attachShader(glProgram, glFragmentShader);
            gl.linkProgram(glProgram);
            gl.useProgram(glProgram);

            glBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, glBuffer);
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
    } else {
      ctx2d = canvas.getContext("2d");
    }

    const ASCII_CHARS = " .:-=+*#%@";
    let time = 0;

    const render = () => {
      animId = requestAnimationFrame(render);
      if (!isVisible) return;

      time += prefersReducedMotion ? 0.001 : 0.012;

      // Mouse drag inertia
      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;
      mouse.dragRotX += (mouse.targetRotX - mouse.dragRotX) * 0.08;
      mouse.dragRotY += (mouse.targetRotY - mouse.dragRotY) * 0.08;

      if (!mouse.isDown) {
        // Continuous ambient rotation
        mouse.targetRotY += 0.0025;
      }

      if (currentMode === "dither" && gl && glProgram) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        const uRes = gl.getUniformLocation(glProgram, "u_resolution");
        const uMouse = gl.getUniformLocation(glProgram, "u_mouse");
        const uTime = gl.getUniformLocation(glProgram, "u_time");
        const uRot = gl.getUniformLocation(glProgram, "u_rotation");

        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform2f(uMouse, mouse.x * dpr, (height - mouse.y) * dpr);
        gl.uniform1f(uTime, time);
        gl.uniform2f(uRot, mouse.dragRotX, mouse.dragRotY);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      } else if (currentMode === "ascii" && ctx2d) {
        ctx2d.save();
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx2d.clearRect(0, 0, width, height);

        const isMobile = width < 768;
        const fontSize = Math.max(10, Math.floor(Math.min(width, height) / 38));
        ctx2d.font = `${fontSize}px var(--font-mono), monospace`;
        ctx2d.textAlign = "center";
        ctx2d.textBaseline = "middle";

        const radius = Math.min(width, height) * (isMobile ? 0.38 : 0.34);
        const centerX = isMobile ? width * 0.5 : width * 0.65;
        const centerY = isMobile ? height * 0.44 : height * 0.5;

        const rotY = mouse.dragRotY + time * 0.35;
        const rotX = mouse.dragRotX + 0.22;

        const totalPoints = isMobile ? 650 : 1050;
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);

        for (let i = 0; i < totalPoints; i++) {
          const theta = Math.acos(1 - (2 * (i + 0.5)) / totalPoints);
          const phi = Math.PI * (1 + Math.sqrt(5)) * i;

          const px = radius * Math.sin(theta) * Math.cos(phi);
          const py = radius * Math.cos(theta);
          const pz = radius * Math.sin(theta) * Math.sin(phi);

          // Rotate around Y
          const x1 = px * cosY + pz * sinY;
          const z1 = -px * sinY + pz * cosY;

          // Rotate around X
          const y2 = py * cosX - z1 * sinX;
          const z2 = py * sinX + z1 * cosX;

          // Perspective projection
          const fov = 750;
          const scale = fov / (fov + z2);
          const screenX = centerX + x1 * scale;
          const screenY = centerY + y2 * scale;

          if (z2 > -radius * 0.75) {
            const nx = x1 / radius;
            const ny = y2 / radius;
            const nz = z2 / radius;
            const light = Math.max(0, nx * 0.45 + ny * 0.65 + nz * 0.65);

            const charIndex = Math.floor(light * (ASCII_CHARS.length - 1));
            const char = ASCII_CHARS[Math.max(0, Math.min(ASCII_CHARS.length - 1, charIndex))];

            // Cursor lens interaction
            const dx = screenX - mouse.x;
            const dy = screenY - mouse.y;
            const dist = Math.hypot(dx, dy);
            const isNearCursor = dist < 110;

            if (isNearCursor) {
              ctx2d.fillStyle = "#ffffff";
            } else if (z2 > 0) {
              ctx2d.fillStyle = `rgba(237, 235, 230, ${0.45 + light * 0.55})`;
            } else {
              ctx2d.fillStyle = "rgba(237, 235, 230, 0.22)";
            }

            ctx2d.fillText(char, screenX, screenY);
          }
        }

        ctx2d.restore();
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      ro.disconnect();
      observer.disconnect();

      if (gl) {
        if (glProgram) gl.deleteProgram(glProgram);
        if (glVertexShader) gl.deleteShader(glVertexShader);
        if (glFragmentShader) gl.deleteShader(glFragmentShader);
        if (glBuffer) gl.deleteBuffer(glBuffer);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
    };
  }, [currentMode]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-0 overflow-hidden select-none pointer-events-auto ${className}`}
    >
      {/* Key forces fresh canvas creation per mode so context2d / webgl never collide */}
      <canvas
        key={currentMode}
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* Mode Switcher Pill */}
      <div className="absolute top-24 right-6 sm:right-10 lg:right-16 z-20 flex items-center gap-1 bg-[#050505]/80 border border-white/10 px-1 py-1 font-mono text-label backdrop-blur-md rounded-sm">
        <button
          type="button"
          onClick={() => setCurrentMode("ascii")}
          className={`px-2.5 py-1 transition-colors ${
            currentMode === "ascii"
              ? "bg-[#edebe6] text-[#050505] font-semibold"
              : "text-[#edebe6]/75 hover:text-[#edebe6]"
          }`}
        >
          ASCII GLOBE
        </button>
        <button
          type="button"
          onClick={() => setCurrentMode("dither")}
          className={`px-2.5 py-1 transition-colors ${
            currentMode === "dither"
              ? "bg-[#edebe6] text-[#050505] font-semibold"
              : "text-[#edebe6]/75 hover:text-[#edebe6]"
          }`}
        >
          BAYER 8×8
        </button>
      </div>

      {/* Drag Prompt */}
      <div className="hidden sm:block absolute bottom-6 right-6 sm:right-10 lg:right-16 z-20 font-mono text-label text-[#edebe6]/75 tracking-widest uppercase pointer-events-none">
        [ DRAG 3D MESH TO ROTATE ]
      </div>
    </div>
  );
}
