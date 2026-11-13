"use client";

import { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame, useThree, createPortal } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";
import * as THREE from "three";
import WakeScene from "./WakeScene";
import DreamScene from "./DreamScene";
import { useThemeStore, type Mode } from "@/store/useThemeStore";
import { useFractureStore } from "@/store/useFractureStore";
import { getSectionProgress } from "@/store/useScrollStore";
import { crystalEvents } from "@/hooks/useCrystalPose";

/* ── Brush tuning ─────────────────────────────────────────────── */

const BRUSH_RADIUS = 0.06;     // fraction of screen height, at rest
const BRUSH_RADIUS_MAX = 0.09; // cap when cursor is moving fast
const RIM_WIDTH = 0.012;       // glowing rim thickness (mask-space)
const TRAIL_DECAY = 1.2;       // seconds for the liquid trail to fade

/* ── Brush stamp shader (renders into brush buffer) ───────────── */

const brushVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const brushFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uPrevFrame;
  uniform float uDecay;
  uniform vec2 uBrushPos;
  uniform float uBrushRadius;
  uniform float uBrushStrength;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform int uStampCount;
  uniform vec2 uStamps[16];
  uniform float uFloodRadius;
  uniform vec2 uFloodCenter;
  uniform float uFloodActive;
  uniform float uRestMode;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = rot * p * 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 aspectUv = uv * vec2(aspect, 1.0);

    // ── Flood mode ────
    if (abs(uFloodActive) > 0.5) {
      vec2 floodPos = uFloodCenter * vec2(aspect, 1.0);
      float floodDist = length(aspectUv - floodPos);
      float floodNoise = fbm(aspectUv * 6.0 + uTime * 0.8) * 0.04;
      float R = uFloodRadius;
      float circle = 1.0 - smoothstep(R - 0.04 + floodNoise, R + 0.02 + floodNoise, floodDist);
      gl_FragColor = vec4(vec3(circle), 1.0);
      return;
    }

    // ── Normal brush: metaball sum of falloffs ────
    float restValue = step(0.5, uRestMode);
    float prev = texture2D(uPrevFrame, uv).r;
    prev = prev + (restValue - prev) * (1.0 - uDecay);

    float field = 0.0;
    for (int i = 0; i < 16; i++) {
      if (i >= uStampCount) break;
      vec2 stampPos = uStamps[i] * vec2(aspect, 1.0);
      float dist = length(aspectUv - stampPos);
      // Hard-zero beyond the stamp radius: tails must not accumulate
      // past the composite threshold or the blob balloons into a disc.
      float falloff = smoothstep(1.0, 0.55, dist / uBrushRadius) * uBrushStrength;
      field += falloff;
    }
    field = clamp(field, 0.0, 1.0);

    // Screen blend: smooth merging like metaballs
    float result;
    if (uRestMode > 0.5) {
      result = prev * (1.0 - field);
    } else {
      result = 1.0 - (1.0 - prev) * (1.0 - field);
    }

    gl_FragColor = vec4(vec3(clamp(result, 0.0, 1.0)), 1.0);
  }
`;

/* ── Composite shader (mixes wake + dream using brush mask) ───── */

const compositeVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const compositeFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uWakeScene;
  uniform sampler2D uDreamScene;
  uniform sampler2D uBrushMask;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uFlash;
  uniform float uRimWidth;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
               mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    mat2 r = mat2(0.8,0.6,-0.6,0.8);
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = r * p * 2.0; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float mask = texture2D(uBrushMask, uv).r;

    // Wobbly edge: displace threshold with animated FBM noise
    float wobble = fbm(uv * 10.0 + uTime * 0.35) * 0.03;
    float threshold = 0.5 + wobble;

    // Glowing rim band (uRimWidth thick)
    float rim = smoothstep(threshold - uRimWidth * 2.0, threshold - uRimWidth * 0.5, mask)
              * (1.0 - smoothstep(threshold + uRimWidth * 0.5, threshold + uRimWidth * 2.0, mask));

    // Small soft outer halo
    float halo = smoothstep(threshold - 0.05, threshold - 0.01, mask)
               * (1.0 - smoothstep(threshold - 0.01, threshold + 0.025, mask));

    // Reveal: hard edge at wobbled threshold
    float reveal = smoothstep(threshold - 0.01, threshold + 0.01, mask);

    // Chromatic aberration at edge
    float edgeStrength = rim + halo * 0.4;
    float aberration = edgeStrength * 0.003;

    vec4 wake = texture2D(uWakeScene, uv);
    vec4 dream = texture2D(uDreamScene, uv);

    float dreamR = texture2D(uDreamScene, uv + vec2(aberration, 0.0)).r;
    float dreamB = texture2D(uDreamScene, uv - vec2(aberration, 0.0)).b;
    vec3 dreamChroma = vec3(dreamR, dream.g, dreamB);

    vec3 finalWake = wake.rgb;
    vec3 finalDream = mix(dream.rgb, dreamChroma, edgeStrength);

    // Light purple tint over the real dream scene (#4b32b8 -> #1a1050),
    // kept subtle so the scene itself reads through
    vec3 purpleLight = vec3(0.294, 0.196, 0.722);
    vec3 purpleDark = vec3(0.102, 0.063, 0.314);
    float tintGrad = length(uv - 0.5) * 1.4;
    vec3 purpleTint = mix(purpleLight, purpleDark, clamp(tintGrad, 0.0, 1.0));
    finalDream = mix(finalDream, finalDream * 0.85 + purpleTint * 0.15, reveal * 0.22);

    vec3 result = mix(finalWake, finalDream, reveal);

    // Add rim glow (bright white) and halo
    result += vec3(1.0) * rim * 0.9;
    result += vec3(0.75, 0.65, 1.0) * halo * 0.4;

    result += vec3(uFlash);

    gl_FragColor = vec4(result, 1.0);
    #include <colorspace_fragment>
  }
`;

/* ── Module-scoped materials (mutated in useFrame, stable refs) ── */

const brushMaterial = new THREE.ShaderMaterial({
  vertexShader: brushVertexShader,
  fragmentShader: brushFragmentShader,
  uniforms: {
    uPrevFrame: { value: null },
    uDecay: { value: 0.985 },
    uBrushPos: { value: new THREE.Vector2(0.5, 0.5) },
    uBrushRadius: { value: 0.08 },
    uBrushStrength: { value: 1.0 },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uStampCount: { value: 0 },
    uStamps: {
      value: Array.from({ length: 16 }, () => new THREE.Vector2(0, 0)),
    },
    uFloodRadius: { value: 0 },
    uFloodCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uFloodActive: { value: 0 },
    uRestMode: { value: 0 },
  },
  depthTest: false,
  depthWrite: false,
});

const compositeMaterial = new THREE.ShaderMaterial({
  vertexShader: compositeVertexShader,
  fragmentShader: compositeFragmentShader,
  uniforms: {
    uWakeScene: { value: null },
    uDreamScene: { value: null },
    uBrushMask: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uRimWidth: { value: RIM_WIDTH },
  },
  depthTest: false,
  depthWrite: false,
});

const brushQuadScene = (() => {
  const scene = new THREE.Scene();
  const geo = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geo, brushMaterial);
  scene.add(mesh);
  return scene;
})();

const brushOrthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const fboCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
fboCamera.position.set(0, 0, 6);

/* ── Compositor component ─────────────────────────────────────── */

interface CompositorProps {
  reducedMotion: boolean;
  isMobile: boolean;
}

export default function Compositor({ reducedMotion, isMobile }: CompositorProps) {
  const { gl, size } = useThree();

  useEffect(() => {
    fboCamera.aspect = size.width / size.height;
    fboCamera.updateProjectionMatrix();
  }, [size]);

  const wakeScene = useMemo(() => new THREE.Scene(), []);
  const dreamScene = useMemo(() => new THREE.Scene(), []);

  const wakeTarget = useFBO(size.width, size.height, {
    depthBuffer: true,
    stencilBuffer: false,
  });

  const dreamTarget = useFBO(size.width, size.height, {
    depthBuffer: true,
    stencilBuffer: false,
  });

  const brushRes = useMemo(
    () => ({
      w: Math.max(64, Math.floor(size.width * 0.5)),
      h: Math.max(64, Math.floor(size.height * 0.5)),
    }),
    [size.width, size.height]
  );

  const brushTargetA = useFBO(brushRes.w, brushRes.h, {
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  const brushTargetB = useFBO(brushRes.w, brushRes.h, {
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });

  const pingPongRef = useRef(0);

  // Clear brush buffers to match initial mode
  const brushInitRef = useRef(false);
  useEffect(() => {
    if (brushInitRef.current) return;
    brushInitRef.current = true;
    const initMode = useThemeStore.getState().mode;
    const clearColor = initMode === "dream" ? "#ffffff" : "#000000";
    gl.setRenderTarget(brushTargetA);
    gl.setClearColor(clearColor, 1);
    gl.clear();
    gl.setRenderTarget(brushTargetB);
    gl.clear();
    gl.setRenderTarget(null);
    gl.setClearColor("#000000", 0);

    const f = floodRef.current;
    f.level = initMode === "dream" ? 1 : 0;
    f.target = f.level;
    f.dataMode = initMode;
    brushMaterial.uniforms.uRestMode.value = f.level;
  }, [gl, brushTargetA, brushTargetB]);

  // Brush state
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const prevMouseRef = useRef({ x: 0.5, y: 0.5 });
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 });
  const mouseActiveRef = useRef(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX / window.innerWidth;
      mouseRef.current.y = 1 - e.clientY / window.innerHeight;
      mouseActiveRef.current = true;
    };
    const onMouseLeave = () => {
      mouseActiveRef.current = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseRef.current.x = e.touches[0].clientX / window.innerWidth;
        mouseRef.current.y = 1 - e.touches[0].clientY / window.innerHeight;
        mouseActiveRef.current = true;
      }
    };
    const onTouchEnd = () => {
      mouseActiveRef.current = false;
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // JS-side brush field for cursor label detection
  const stampHistoryRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const blobFieldAtCursor = useRef(0);
  const brushRadiusRef = useRef(BRUSH_RADIUS);

  // Blob click → flood. Scoped to the hero section only, never window:
  // clicks in About/Works or on buttons/links/the pill must not flood.
  const startTransition = useThemeStore((s) => s.startTransition);
  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero) return;

    let lastFire = 0;
    const onClick = (e: MouseEvent) => {
      const now = performance.now();
      if (now - lastFire < 400) return;
      if (blobFieldAtCursor.current <= 0.5) return;

      // Hero must still be in view (same mapping as the hero headline fade)
      const heroScroll = Math.max(0, (getSectionProgress("top") - 0.5) / 0.5);
      if (heroScroll >= 0.5) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest("button, a")) return;
      if (useFractureStore.getState().hoverBreak) return;

      lastFire = now;
      startTransition({ x: e.clientX, y: e.clientY });
    };

    hero.addEventListener("click", onClick);
    return () => hero.removeEventListener("click", onClick);
  }, [startTransition]);

  useEffect(() => {
    return () => {
      wakeTarget.dispose();
      dreamTarget.dispose();
      brushTargetA.dispose();
      brushTargetB.dispose();
    };
  }, [wakeTarget, dreamTarget, brushTargetA, brushTargetB]);

  const compositeQuadRef = useRef<THREE.Mesh>(null);

  // Flood animation state — spring-driven level (0 = wake, 1 = dream)
  const floodRef = useRef({
    active: false,
    level: 0,
    target: 0,
    centerX: 0.5,
    centerY: 0.5,
    maxRadius: 2.0,
    dataMode: "wake" as Mode,
  });

  const transitioning = useThemeStore((s) => s.transitioning);
  const clickOrigin = useThemeStore((s) => s.clickOrigin);
  const endTransition = useThemeStore((s) => s.endTransition);
  const setMode = useThemeStore((s) => s.setMode);

  useEffect(() => {
    if (!transitioning || !clickOrigin) return;
    const f = floodRef.current;

    if (f.active) {
      // Mid-animation reversal: flip target, keep center for smooth retract
      f.target = f.target === 1 ? 0 : 1;
    } else {
      // Fresh start
      f.active = true;
      f.centerX = clickOrigin.x / window.innerWidth;
      f.centerY = 1 - clickOrigin.y / window.innerHeight;
      f.target = f.level < 0.5 ? 1 : 0;

      const aspect = window.innerWidth / window.innerHeight;
      const cx = f.centerX * aspect;
      const cy = f.centerY;
      f.maxRadius =
        Math.max(
          Math.hypot(cx, cy),
          Math.hypot(cx - aspect, cy),
          Math.hypot(cx, cy - 1),
          Math.hypot(cx - aspect, cy - 1)
        ) * 1.2;
    }

    // Acknowledge the signal so the next click can fire
    endTransition();
  }, [transitioning, clickOrigin, endTransition]);

  const getStamps = useCallback(() => {
    const sx = smoothMouseRef.current.x;
    const sy = smoothMouseRef.current.y;
    const px = prevMouseRef.current.x;
    const py = prevMouseRef.current.y;

    const dx = sx - px;
    const dy = sy - py;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const stamps: THREE.Vector2[] = [];
    const stepSize = 0.005;
    const count = Math.max(1, Math.min(16, Math.ceil(dist / stepSize)));

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 1 : i / (count - 1);
      stamps.push(new THREE.Vector2(px + dx * t, py + dy * t));
    }

    return stamps;
  }, []);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    crystalEvents.sceneReady = true;

    const lerpFactor = 0.15;
    smoothMouseRef.current.x +=
      (mouseRef.current.x - smoothMouseRef.current.x) * lerpFactor;
    smoothMouseRef.current.y +=
      (mouseRef.current.y - smoothMouseRef.current.y) * lerpFactor;

    const dx = smoothMouseRef.current.x - prevMouseRef.current.x;
    const dy = smoothMouseRef.current.y - prevMouseRef.current.y;
    const vel = Math.sqrt(dx * dx + dy * dy);
    const baseRadius = isMobile ? BRUSH_RADIUS * 0.8 : BRUSH_RADIUS;
    const dynamicRadius = Math.min(
      baseRadius + vel * 1.2,
      BRUSH_RADIUS_MAX,
    );
    brushRadiusRef.current = dynamicRadius;

    // ── Flood animation (spring toward target) ──────────────────
    const f = floodRef.current;
    if (f.active) {
      const rate = 3.5;
      f.level += (f.target - f.level) * (1 - Math.exp(-rate * delta));

      // Snap when visually complete
      if (Math.abs(f.level - f.target) < 0.003) {
        f.level = f.target;
        f.active = false;

        // Write final state to both buffers
        const finalColor = f.target === 1 ? "#ffffff" : "#000000";
        gl.setRenderTarget(brushTargetA);
        gl.setClearColor(finalColor, 1);
        gl.clear();
        gl.setRenderTarget(brushTargetB);
        gl.clear();
        gl.setRenderTarget(null);
        gl.setClearColor("#000000", 0);
        pingPongRef.current = 0;

        brushMaterial.uniforms.uFloodActive.value = 0.0;
        brushMaterial.uniforms.uRestMode.value = f.target;
      } else {
        brushMaterial.uniforms.uFloodRadius.value = f.level * f.maxRadius;
        brushMaterial.uniforms.uFloodActive.value = 1.0;
        brushMaterial.uniforms.uFloodCenter.value.set(f.centerX, f.centerY);
      }

      // Switch data-mode when crossing 0.5
      if (f.level >= 0.5 && f.dataMode === "wake") {
        f.dataMode = "dream";
        setMode("dream");
      } else if (f.level < 0.5 && f.dataMode === "dream") {
        f.dataMode = "wake";
        setMode("wake");
      }

      if (typeof window !== "undefined") {
        (window as any).__modeDebug = { floodProgress: f.level };
      }
    }

    // ── Camera shake ─────────────────────────────────────────────
    fboCamera.position.set(
      crystalEvents.shakeOffsetX,
      crystalEvents.shakeOffsetY,
      6,
    );

    // ── Render wake scene to FBO ────────────────────────────────
    gl.setRenderTarget(wakeTarget);
    gl.setClearColor("#E9E7E2", 1);
    gl.clear();
    gl.render(wakeScene, fboCamera);

    // ── Render dream scene to FBO ───────────────────────────────
    gl.setRenderTarget(dreamTarget);
    gl.setClearColor("#07062B", 1);
    gl.clear();
    gl.render(dreamScene, fboCamera);

    // Restore camera
    fboCamera.position.set(0, 0, 6);

    // ── Render brush buffer (ping-pong) ─────────────────────────
    const readTarget =
      pingPongRef.current === 0 ? brushTargetA : brushTargetB;
    const writeTarget =
      pingPongRef.current === 0 ? brushTargetB : brushTargetA;

    brushMaterial.uniforms.uPrevFrame.value = readTarget.texture;
    brushMaterial.uniforms.uDecay.value = f.active ? 1.0 : Math.exp(-delta / TRAIL_DECAY);
    brushMaterial.uniforms.uTime.value = time;
    brushMaterial.uniforms.uResolution.value.set(brushRes.w, brushRes.h);

    if (mouseActiveRef.current && !reducedMotion && !f.active) {
      brushMaterial.uniforms.uBrushRadius.value = dynamicRadius;
      brushMaterial.uniforms.uBrushStrength.value = 1.0;

      const stamps = getStamps();
      const stampUniforms = brushMaterial.uniforms.uStamps
        .value as THREE.Vector2[];
      brushMaterial.uniforms.uStampCount.value = stamps.length;
      for (let i = 0; i < stamps.length && i < 16; i++) {
        stampUniforms[i].copy(stamps[i]);
      }
    } else if (reducedMotion && !f.active) {
      brushMaterial.uniforms.uBrushRadius.value = 0.1;
      brushMaterial.uniforms.uBrushStrength.value = mouseActiveRef.current
        ? 1.0
        : 0.0;
      brushMaterial.uniforms.uStampCount.value = 1;
      (
        brushMaterial.uniforms.uStamps.value as THREE.Vector2[]
      )[0].set(mouseRef.current.x, mouseRef.current.y);
      brushMaterial.uniforms.uDecay.value = 0.95;
    } else {
      brushMaterial.uniforms.uStampCount.value = 0;
    }

    gl.setRenderTarget(writeTarget);
    gl.render(brushQuadScene, brushOrthoCamera);
    pingPongRef.current = 1 - pingPongRef.current;

    // ── Update composite uniforms ───────────────────────────────
    compositeMaterial.uniforms.uWakeScene.value = wakeTarget.texture;
    compositeMaterial.uniforms.uDreamScene.value = dreamTarget.texture;
    compositeMaterial.uniforms.uBrushMask.value = writeTarget.texture;
    compositeMaterial.uniforms.uResolution.value.set(size.width, size.height);
    compositeMaterial.uniforms.uTime.value = time;
    compositeMaterial.uniforms.uFlash.value = crystalEvents.flashOpacity;

    gl.setClearColor("#000000", 0);
    gl.setRenderTarget(null);

    // ── JS-side blob field for cursor label ──────────────────────
    const aspect = size.width / size.height;
    const history = stampHistoryRef.current;
    const now = time;

    // Add current stamp to history
    if (mouseActiveRef.current && !f.active) {
      history.push({ x: smoothMouseRef.current.x, y: smoothMouseRef.current.y, t: now });
    }
    // Decay old stamps
    while (history.length > 0 && now - history[0].t > TRAIL_DECAY * 1.5) history.shift();

    // Compute field at cursor position (mirrors the shader falloff)
    const cx = smoothMouseRef.current.x * aspect;
    const cy = smoothMouseRef.current.y;
    let field = 0;
    const radius = brushRadiusRef.current;
    for (let i = 0; i < history.length; i++) {
      const age = now - history[i].t;
      const decay = Math.exp(-age / TRAIL_DECAY);
      const sx = history[i].x * aspect;
      const sy = history[i].y;
      const d = Math.hypot(cx - sx, cy - sy);
      const t = Math.max(0, Math.min(1, (1.0 - d / radius) / 0.45));
      field += t * t * (3 - 2 * t) * decay;
    }
    blobFieldAtCursor.current = Math.min(field, 1);

    // Update cursor label: blob beats default, crystal beats blob
    const { cursorLabel, hoverBreak } = useFractureStore.getState();
    if (!hoverBreak && cursorLabel !== "BREAK") {
      if (field > 0.3) {
        useFractureStore.setState({ cursorLabel: "ENTER THE DREAM" });
      } else if (cursorLabel === "ENTER THE DREAM") {
        useFractureStore.setState({ cursorLabel: "" });
      }
    }

    prevMouseRef.current.x = smoothMouseRef.current.x;
    prevMouseRef.current.y = smoothMouseRef.current.y;
  });

  return (
    <>
      {createPortal(
        <WakeScene reducedMotion={reducedMotion} isMobile={isMobile} />,
        wakeScene,
        { camera: fboCamera }
      )}

      {createPortal(
        <DreamScene reducedMotion={reducedMotion} isMobile={isMobile} />,
        dreamScene,
        { camera: fboCamera }
      )}

      <mesh ref={compositeQuadRef} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
        <primitive object={compositeMaterial} attach="material" />
      </mesh>
    </>
  );
}
