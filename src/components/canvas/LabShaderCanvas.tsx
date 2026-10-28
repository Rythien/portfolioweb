"use client";

import React, { useEffect, useRef } from "react";

interface LabShaderCanvasProps {
  mode: "glsl" | "particles" | "physics";
}

export default function LabShaderCanvas({ mode }: LabShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    const width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    const height = (canvas.height = 480);

    const mouse = {
      x: width / 2,
      y: height / 2,
      isDown: false,
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleMouseDown = () => {
      mouse.isDown = true;
    };

    const handleMouseUp = () => {
      mouse.isDown = false;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    // MODE 1: WebGL GLSL Shader Ripple
    if (mode === "glsl") {
      const gl = canvas.getContext("webgl");
      if (gl) {
        const vsSource = `
          attribute vec2 a_position;
          void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
          }
        `;

        const fsSource = `
          precision mediump float;
          uniform vec2 u_resolution;
          uniform vec2 u_mouse;
          uniform float u_time;

          void main() {
            vec2 st = gl_FragCoord.xy / u_resolution;
            vec2 mouseNorm = u_mouse / u_resolution;
            mouseNorm.y = 1.0 - mouseNorm.y;

            vec2 diff = st - mouseNorm;
            float dist = length(diff);

            // Ripple equation
            float wave = sin(dist * 40.0 - u_time * 4.5) * exp(-dist * 4.5);
            vec2 uv = st + (diff / (dist + 0.001)) * wave * 0.04;

            // Background darkness & vermilion caustic accents
            float grid = step(0.97, fract(uv.x * 16.0)) + step(0.97, fract(uv.y * 12.0));
            vec3 col = vec3(0.04, 0.04, 0.06);
            col += vec3(1.0, 0.23, 0.15) * wave * 2.2;
            col += vec3(grid * 0.08);

            gl_FragColor = vec4(col, 1.0);
          }
        `;

        const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
          const s = gl.createShader(type);
          if (!s) return null;
          gl.shaderSource(s, source);
          gl.compileShader(s);
          return s;
        };

        const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
        const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
        const program = gl.createProgram();
        if (vs && fs && program) {
          gl.attachShader(program, vs);
          gl.attachShader(program, fs);
          gl.linkProgram(program);
          gl.useProgram(program);

          const posBuffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW
          );

          const aPos = gl.getAttribLocation(program, "a_position");
          gl.enableVertexAttribArray(aPos);
          gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

          const uRes = gl.getUniformLocation(program, "u_resolution");
          const uMouse = gl.getUniformLocation(program, "u_mouse");
          const uTime = gl.getUniformLocation(program, "u_time");

          const startTime = performance.now();

          const renderGL = () => {
            const now = (performance.now() - startTime) * 0.001;
            gl.viewport(0, 0, width, height);
            gl.uniform2f(uRes, width, height);
            gl.uniform2f(uMouse, mouse.x, mouse.y);
            gl.uniform1f(uTime, now);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            animId = requestAnimationFrame(renderGL);
          };

          renderGL();

          return () => {
            cancelAnimationFrame(animId);
            canvas.removeEventListener("mousemove", handleMouseMove);
            canvas.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("mouseup", handleMouseUp);
          };
        }
      }
    }

    // MODE 2 & 3: High performance Canvas 2D particle/physics simulation
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (mode === "particles") {
      // 300 Eulerian curl-noise particles
      const particles: Array<{
        x: number;
        y: number;
        vx: number;
        vy: number;
        life: number;
        maxLife: number;
        color: string;
      }> = [];

      for (let i = 0; i < 280; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: 0,
          vy: 0,
          life: Math.random() * 100,
          maxLife: 100,
          color: Math.random() > 0.8 ? "#ff3b26" : "#f5f5f3",
        });
      }

      let time = 0;
      const renderParticles = () => {
        time += 0.01;
        ctx.fillStyle = "rgba(5, 5, 5, 0.15)";
        ctx.fillRect(0, 0, width, height);

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          // Curl noise angle
          const angle =
            Math.sin(p.x * 0.005 + time) * Math.cos(p.y * 0.005 + time) * Math.PI * 2;
          p.vx += Math.cos(angle) * 0.3;
          p.vy += Math.sin(angle) * 0.3;

          // Drag
          p.vx *= 0.94;
          p.vy *= 0.94;

          // Mouse attraction / repel
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < 160) {
            p.vx += (dx / d) * 1.5;
            p.vy += (dy / d) * 1.5;
          }

          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, 2, 2);
        }

        animId = requestAnimationFrame(renderParticles);
      };

      renderParticles();
    } else if (mode === "physics") {
      // Kinetic Monospace Glyphs
      const glyphs = "SEARON·MAHARJAN·KATHMANDU·27.71°N·85.32°E·NEWARI·CRAFT·WEBGL·GSAP·ARCHITECT".split(
        ""
      );
      const cols = 22;
      const rows = 10;
      const spacingX = width / cols;
      const spacingY = height / rows;

      interface GlyphNode {
        baseX: number;
        baseY: number;
        x: number;
        y: number;
        vx: number;
        vy: number;
        char: string;
      }

      const nodes: GlyphNode[] = [];
      let glyphIdx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = (c + 0.5) * spacingX;
          const y = (r + 0.5) * spacingY;
          nodes.push({
            baseX: x,
            baseY: y,
            x: x,
            y: y,
            vx: 0,
            vy: 0,
            char: glyphs[glyphIdx % glyphs.length],
          });
          glyphIdx++;
        }
      }

      const renderPhysics = () => {
        ctx.fillStyle = "#070709";
        ctx.fillRect(0, 0, width, height);

        ctx.font = "13px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          // Spring force back to baseX, baseY
          const fx = (n.baseX - n.x) * 0.1;
          const fy = (n.baseY - n.y) * 0.1;
          n.vx += fx;
          n.vy += fy;

          // Mouse repel
          const dx = n.x - mouse.x;
          const dy = n.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 140) {
            const push = (1 - dist / 140) * 12;
            n.vx += (dx / dist) * push;
            n.vy += (dy / dist) * push;
          }

          n.vx *= 0.85;
          n.vy *= 0.85;
          n.x += n.vx;
          n.y += n.vy;

          const isStretched = Math.hypot(n.x - n.baseX, n.y - n.baseY) > 6;
          ctx.fillStyle = isStretched ? "#ff3b26" : "rgba(245, 245, 243, 0.4)";
          ctx.fillText(n.char, n.x, n.y);
        }

        animId = requestAnimationFrame(renderPhysics);
      };

      renderPhysics();
    }

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [mode]);

  return (
    <div className="relative w-full h-full overflow-hidden border border-white/10 bg-[#08080a]">
      <canvas
        ref={canvasRef}
        className="w-full h-[440px] block cursor-crosshair"
      />
      <div className="absolute bottom-3 left-4 font-mono text-[11px] text-[#8e8e93] tracking-widest uppercase pointer-events-none">
        [ INTERACTIVE SURFACE · DRAG &amp; HOVER ]
      </div>
    </div>
  );
}
