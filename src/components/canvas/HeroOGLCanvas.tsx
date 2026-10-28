"use client";

import React, { useEffect, useRef } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

export default function HeroOGLCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    const container = containerRef.current;
    if (!container) return;

    let renderer: Renderer | null = null;
    let animId: number;

    try {
      renderer = new Renderer({
        alpha: true,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
        antialias: true,
        powerPreference: "low-power",
      });

      const gl = renderer.gl;
      if (!gl) return;

      container.appendChild(gl.canvas);
      gl.canvas.style.position = "absolute";
      gl.canvas.style.inset = "0";
      gl.canvas.style.width = "100%";
      gl.canvas.style.height = "100%";
      gl.canvas.style.pointerEvents = "none";
      gl.canvas.style.zIndex = "0";

      const geometry = new Triangle(gl);

      const vertex = /* glsl */ `
        attribute vec2 position;
        attribute vec2 uv;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `;

      const fragment = /* glsl */ `
        precision highp float;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec2 uMouse;
        uniform float uVelocity;
        varying vec2 vUv;

        float hash(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        void main() {
          vec2 uv = vUv;
          float aspect = max(1.0, uResolution.x / max(1.0, uResolution.y));
          vec2 p = vec2(uv.x * aspect, uv.y);
          vec2 mouse = vec2(uMouse.x * aspect, uMouse.y);

          vec2 delta = p - mouse;
          float d = length(delta);

          float wave = sin(d * 18.0 - uTime * 2.5) * exp(-d * 3.8);
          float rippleStrength = wave * clamp(uVelocity * 1.5, 0.0, 0.85);

          vec2 norm = d > 0.0001 ? delta / d : vec2(0.0);
          vec2 perturbedUv = uv + norm * (rippleStrength * 0.02);

          vec2 glowOrigin = vec2(0.55, 0.35);
          float glowDist = length((perturbedUv - glowOrigin) * vec2(aspect * 0.7, 1.0));
          float baseGradient = smoothstep(1.3, 0.0, glowDist);

          vec3 colBg = vec3(0.043, 0.043, 0.043);
          vec3 colGlow = vec3(0.098, 0.096, 0.093);
          vec3 colRipple = vec3(0.145, 0.142, 0.138);

          vec3 color = mix(colBg, colGlow, baseGradient * 0.75);
          color = mix(color, colRipple, clamp(rippleStrength * 1.8, 0.0, 1.0));

          vec2 grainUv = gl_FragCoord.xy;
          float grain = hash(grainUv + fract(uTime * 0.1)) * 0.042;
          color += vec3(grain);

          gl_FragColor = vec4(color, 1.0);
        }
      `;

      const initialWidth = Math.max(100, container.clientWidth || window.innerWidth);
      const initialHeight = Math.max(100, container.clientHeight || window.innerHeight);

      const uniforms = {
        uTime: { value: 0 },
        uResolution: { value: [initialWidth, initialHeight] },
        uMouse: { value: [0.5, 0.5] },
        uVelocity: { value: 0.0 },
      };

      const program = new Program(gl, {
        vertex,
        fragment,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });

      const mesh = new Mesh(gl, { geometry, program });

      const handleResize = () => {
        if (!container || !renderer) return;
        const width = Math.max(100, container.clientWidth || window.innerWidth);
        const height = Math.max(100, container.clientHeight || window.innerHeight);
        renderer.setSize(width, height);
        program.uniforms.uResolution.value = [width, height];
      };

      handleResize();
      window.addEventListener("resize", handleResize);

      const mouse = {
        x: 0.5,
        y: 0.5,
        targetX: 0.5,
        targetY: 0.5,
        velocity: 0,
      };

      const handleMouseMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;

        const normX = Math.max(0, Math.min(1, clientX / Math.max(1, rect.width)));
        const normY = Math.max(0, Math.min(1, 1 - clientY / Math.max(1, rect.height)));

        const dx = normX - mouse.targetX;
        const dy = normY - mouse.targetY;
        const speed = Math.hypot(dx, dy);

        mouse.targetX = normX;
        mouse.targetY = normY;
        mouse.velocity = Math.min(1.2, mouse.velocity + speed * 8.0);
      };

      window.addEventListener("mousemove", handleMouseMove, { passive: true });

      let isVisible = true;
      const observer = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting;
      });
      observer.observe(container);

      const render = (time: number) => {
        animId = requestAnimationFrame(render);
        if (!isVisible || !renderer) return;

        mouse.x += (mouse.targetX - mouse.x) * 0.08;
        mouse.y += (mouse.targetY - mouse.y) * 0.08;
        mouse.velocity *= 0.93;

        program.uniforms.uTime.value = time * 0.001;
        program.uniforms.uMouse.value = [mouse.x, mouse.y];
        program.uniforms.uVelocity.value = mouse.velocity;

        renderer.render({ scene: mesh });
      };

      animId = requestAnimationFrame(render);

      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("mousemove", handleMouseMove);
        observer.disconnect();
        if (gl.canvas.parentNode) {
          gl.canvas.parentNode.removeChild(gl.canvas);
        }
      };
    } catch (err) {
      console.warn("HeroOGLCanvas fallback:", err);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_50%_at_55%_35%,rgba(237,235,230,0.06),transparent_75%)]" />
    </div>
  );
}
