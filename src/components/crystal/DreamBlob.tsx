"use client";

import { useRef, useEffect } from "react";
import { useFractureStore } from "@/store/useFractureStore";

const VERT = /* glsl */ `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec2 uRes;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uActive;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p) {
    float v=0.0, a=0.5;
    mat2 r=mat2(0.8,0.6,-0.6,0.8);
    for(int i=0;i<4;i++){v+=a*noise(p);p=r*p*2.0;a*=0.5;}
    return v;
  }
  float smin(float a, float b, float k) {
    float h=max(k-abs(a-b),0.0)/k;
    return min(a,b)-h*h*k*0.25;
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
    vec2 m = (uMouse - 0.5) * vec2(aspect, 1.0);

    float n = fbm(p * 5.0 + uTime * 0.25) * 0.05;
    float R = 0.1;

    float d1 = length(p - m) - R + n;
    float a1 = uTime * 0.6;
    float d2 = length(p - m - vec2(cos(a1), sin(a1)) * R * 0.7) - R * 0.35 + n * 0.7;
    float a2 = uTime * 0.45 + 2.094;
    float d3 = length(p - m - vec2(cos(a2), sin(a2)) * R * 0.5) - R * 0.28 + n * 0.5;

    float d = smin(smin(d1, d2, 0.07), d3, 0.05);

    float rim = smoothstep(0.015, -0.005, d) - smoothstep(-0.005, -0.035, d);
    float inner = smoothstep(0.003, -0.015, d);

    float cDist = length(p - m) / max(R, 0.001);
    vec3 innerCol = mix(vec3(0.55,0.45,0.85), vec3(0.35,0.25,0.68), clamp(cDist*0.7,0.0,1.0));
    vec3 rimCol = vec3(0.72, 0.58, 1.0);

    vec3 color = innerCol * inner + rimCol * rim * 1.6;
    float alpha = (inner * 0.5 + rim * 0.9) * uActive;

    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

export default function DreamBlob() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const smoothRef = useRef({ x: 0.5, y: 0.5 });
  const activeRef = useRef(0);
  const mouseMoving = useRef(false);
  const lastMoveTime = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX / window.innerWidth;
      mouseRef.current.y = 1 - e.clientY / window.innerHeight;
      mouseMoving.current = true;
      lastMoveTime.current = performance.now();
    };
    const onLeave = () => { mouseMoving.current = false; };
    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true });
    if (!gl) return;

    function compile(src: string, type: number) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(VERT, gl.VERTEX_SHADER));
    gl.attachShader(prog, compile(FRAG, gl.FRAGMENT_SHADER));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uMouse = gl.getUniformLocation(prog, "uMouse");
    const uActive = gl.getUniformLocation(prog, "uActive");

    const verts = new Float32Array([-1,-1,0,0, 1,-1,1,0, -1,1,0,1, 1,1,1,1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const pLoc = gl.getAttribLocation(prog, "position");
    const uvLoc = gl.getAttribLocation(prog, "uv");
    gl.enableVertexAttribArray(pLoc);
    gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      canvas!.width = Math.floor(window.innerWidth * dpr * 0.4);
      canvas!.height = Math.floor(window.innerHeight * dpr * 0.4);
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
    }
    resize();
    window.addEventListener("resize", resize);

    const t0 = performance.now();
    function frame() {
      rafRef.current = requestAnimationFrame(frame);

      const { hoverBreak, cursorLabel } = useFractureStore.getState();
      const now = performance.now();
      const idle = now - lastMoveTime.current > 2000;

      // Blob active when mouse is moving, not hovering crystal, not in flood
      const wantActive = mouseMoving.current && !idle && !hoverBreak && cursorLabel !== "BREAK";
      const target = wantActive ? 1 : 0;
      activeRef.current += (target - activeRef.current) * (target > 0.5 ? 0.06 : 0.03);

      // Set cursor label when blob is visible
      if (activeRef.current > 0.15 && cursorLabel !== "BREAK") {
        useFractureStore.setState({ cursorLabel: "ENTER THE DREAM" });
      } else if (activeRef.current < 0.1 && cursorLabel === "ENTER THE DREAM") {
        useFractureStore.setState({ cursorLabel: "" });
      }

      if (activeRef.current < 0.005) {
        gl!.clearColor(0, 0, 0, 0);
        gl!.clear(gl!.COLOR_BUFFER_BIT);
        return;
      }

      smoothRef.current.x += (mouseRef.current.x - smoothRef.current.x) * 0.07;
      smoothRef.current.y += (mouseRef.current.y - smoothRef.current.y) * 0.07;

      gl!.useProgram(prog);
      gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      gl!.uniform1f(uTime, (now - t0) / 1000);
      gl!.uniform2f(uMouse, smoothRef.current.x, smoothRef.current.y);
      gl!.uniform1f(uActive, activeRef.current);

      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    }
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[2]"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
