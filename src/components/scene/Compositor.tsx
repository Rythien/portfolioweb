"use client";

import { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame, useThree, createPortal } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";
import * as THREE from "three";
import WakeScene from "./WakeScene";
import DreamScene from "./DreamScene";
import { useThemeStore, type Mode } from "@/store/useThemeStore";

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
  uniform vec2 uBrushPos;      // normalized 0-1
  uniform float uBrushRadius;  // normalized
  uniform float uBrushStrength;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform int uStampCount;
  uniform vec2 uStamps[16];    // interpolated positions
  uniform float uFloodRadius;  // expanding radius for toggle flood
  uniform vec2 uFloodCenter;   // origin of flood in normalized coords
  uniform float uFloodActive;  // 1.0 = flooding, -1.0 = draining, 0.0 = off

  varying vec2 vUv;

  // FBM noise for organic edge distortion
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

    // Read previous frame and decay
    float prev = texture2D(uPrevFrame, uv).r * uDecay;

    // Stamp brush at interpolated positions
    float brush = 0.0;
    for (int i = 0; i < 16; i++) {
      if (i >= uStampCount) break;
      vec2 stampPos = uStamps[i] * vec2(aspect, 1.0);
      float dist = length(aspectUv - stampPos);

      // FBM distortion on the edge
      float noiseOffset = fbm(aspectUv * 8.0 + uTime * 0.5) * 0.02;
      dist += noiseOffset;

      // Soft circular brush
      float stamp = smoothstep(uBrushRadius, uBrushRadius * 0.3, dist);
      brush = max(brush, stamp * uBrushStrength);
    }

    float result = max(prev, brush);

    // Flood fill from pill click
    if (uFloodActive > 0.5) {
      // Filling: expanding circle from flood center
      vec2 floodPos = uFloodCenter * vec2(aspect, 1.0);
      float floodDist = length(aspectUv - floodPos);
      float floodNoise = fbm(aspectUv * 6.0 + uTime * 0.8) * 0.04;
      float flood = smoothstep(uFloodRadius + 0.02 + floodNoise, uFloodRadius - 0.04 + floodNoise, floodDist);
      result = max(result, flood);
    } else if (uFloodActive < -0.5) {
      // Draining: shrinking circle from flood center
      vec2 floodPos = uFloodCenter * vec2(aspect, 1.0);
      float floodDist = length(aspectUv - floodPos);
      float floodNoise = fbm(aspectUv * 6.0 + uTime * 0.8) * 0.04;
      float drain = smoothstep(uFloodRadius - 0.04 + floodNoise, uFloodRadius + 0.02 + floodNoise, floodDist);
      result = min(result, 1.0 - drain);
    }

    result = clamp(result, 0.0, 1.0);

    gl_FragColor = vec4(result, result, result, 1.0);
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

  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;

    float mask = texture2D(uBrushMask, uv).r;

    // Smooth the mask edge
    float reveal = smoothstep(0.05, 0.5, mask);

    // Chromatic aberration at the boundary
    float edgeStrength = smoothstep(0.05, 0.25, mask) - smoothstep(0.25, 0.5, mask);
    float aberration = edgeStrength * 0.004;

    vec4 wake = texture2D(uWakeScene, uv);
    vec4 dream = texture2D(uDreamScene, uv);

    // Sample with offset for chromatic split at edge
    float dreamR = texture2D(uDreamScene, uv + vec2(aberration, 0.0)).r;
    float dreamB = texture2D(uDreamScene, uv - vec2(aberration, 0.0)).b;
    vec3 dreamChroma = vec3(dreamR, dream.g, dreamB);

    float wakeR = texture2D(uWakeScene, uv + vec2(aberration * 0.5, 0.0)).r;
    float wakeB = texture2D(uWakeScene, uv - vec2(aberration * 0.5, 0.0)).b;
    vec3 wakeChroma = vec3(wakeR, wake.g, wakeB);

    // Blend between normal and chromatic versions based on edge proximity
    vec3 finalWake = mix(wake.rgb, wakeChroma, edgeStrength);
    vec3 finalDream = mix(dream.rgb, dreamChroma, edgeStrength);

    // Glowing white rim at mask edge
    float edgeMask = smoothstep(0.1, 0.3, mask) - smoothstep(0.3, 0.5, mask);
    float outerHalo = smoothstep(0.0, 0.15, mask) - smoothstep(0.15, 0.4, mask);
    float rim = edgeMask * 0.8 + outerHalo * 0.3;

    // Composite wake + dream
    vec3 result = mix(finalWake, finalDream, reveal);
    result += vec3(1.0) * rim;

    gl_FragColor = vec4(result, 1.0);
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

  // Keep FBO camera aspect updated
  useEffect(() => {
    fboCamera.aspect = size.width / size.height;
    fboCamera.updateProjectionMatrix();
  }, [size]);

  // Scenes for portal rendering
  const wakeScene = useMemo(() => new THREE.Scene(), []);
  const dreamScene = useMemo(() => new THREE.Scene(), []);

  // FBO for wake scene
  const wakeTarget = useFBO(size.width, size.height, {
    depthBuffer: true,
    stencilBuffer: false,
  });

  // FBO for dream scene
  const dreamTarget = useFBO(size.width, size.height, {
    depthBuffer: true,
    stencilBuffer: false,
  });

  // Ping-pong brush buffer at half resolution
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

  // Clear brush buffers to black on init
  const brushInitRef = useRef(false);
  useEffect(() => {
    if (brushInitRef.current) return;
    brushInitRef.current = true;
    gl.setRenderTarget(brushTargetA);
    gl.setClearColor("#000000", 1);
    gl.clear();
    gl.setRenderTarget(brushTargetB);
    gl.clear();
    gl.setRenderTarget(null);
    gl.setClearColor("#000000", 0);
  }, [gl, brushTargetA, brushTargetB]);

  // Brush state
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const prevMouseRef = useRef({ x: 0.5, y: 0.5 });
  const smoothMouseRef = useRef({ x: 0.5, y: 0.5 });
  const mouseActiveRef = useRef(false);

  // Touch support
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

  // Dispose FBO targets on unmount
  useEffect(() => {
    return () => {
      wakeTarget.dispose();
      dreamTarget.dispose();
      brushTargetA.dispose();
      brushTargetB.dispose();
    };
  }, [wakeTarget, dreamTarget, brushTargetA, brushTargetB]);

  // Composite quad
  const compositeQuadRef = useRef<THREE.Mesh>(null);

  // Flood animation state (driven by theme store transitions)
  const floodRef = useRef({
    active: false,
    direction: 1 as 1 | -1,
    startTime: 0,
    centerX: 0.5,
    centerY: 0.5,
    maxRadius: 2.0,
    themeSwitched: false,
  });

  const transitioning = useThemeStore((s) => s.transitioning);
  const clickOrigin = useThemeStore((s) => s.clickOrigin);
  const endTransition = useThemeStore((s) => s.endTransition);
  const setMode = useThemeStore((s) => s.setMode);

  useEffect(() => {
    if (transitioning && clickOrigin) {
      const currentMode = useThemeStore.getState().mode;
      const f = floodRef.current;
      f.active = true;
      f.direction = currentMode === "wake" ? 1 : -1;
      f.startTime = performance.now();
      f.centerX = clickOrigin.x / window.innerWidth;
      f.centerY = 1 - clickOrigin.y / window.innerHeight;
      f.themeSwitched = false;
      // Compute max radius needed to cover entire screen from click point
      const aspect = window.innerWidth / window.innerHeight;
      const cx = f.centerX * aspect;
      const cy = f.centerY;
      f.maxRadius = Math.max(
        Math.hypot(cx, cy),
        Math.hypot(cx - aspect, cy),
        Math.hypot(cx, cy - 1),
        Math.hypot(cx - aspect, cy - 1)
      ) * 1.2;
    }
  }, [transitioning, clickOrigin]);

  // Interpolate stamps between previous and current mouse position
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

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    // Lerp mouse position for smooth brush trailing
    const lerpFactor = 0.15;
    smoothMouseRef.current.x +=
      (mouseRef.current.x - smoothMouseRef.current.x) * lerpFactor;
    smoothMouseRef.current.y +=
      (mouseRef.current.y - smoothMouseRef.current.y) * lerpFactor;

    // Compute brush radius based on cursor velocity
    const dx = smoothMouseRef.current.x - prevMouseRef.current.x;
    const dy = smoothMouseRef.current.y - prevMouseRef.current.y;
    const vel = Math.sqrt(dx * dx + dy * dy);
    const baseRadius = isMobile ? 0.06 : 0.08;
    const dynamicRadius = baseRadius + Math.min(vel * 2.0, 0.04);

    // ── Flood animation ─────────────────────────────────────────
    const f = floodRef.current;
    if (f.active) {
      const elapsed = (performance.now() - f.startTime) / 1200;
      const t = Math.min(elapsed, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      brushMaterial.uniforms.uFloodCenter.value.set(f.centerX, f.centerY);

      if (f.direction === 1) {
        brushMaterial.uniforms.uFloodRadius.value = eased * f.maxRadius;
        brushMaterial.uniforms.uFloodActive.value = 1.0;
      } else {
        brushMaterial.uniforms.uFloodRadius.value = (1 - eased) * f.maxRadius;
        brushMaterial.uniforms.uFloodActive.value = -1.0;
      }

      if (!f.themeSwitched && t >= 0.45) {
        f.themeSwitched = true;
        const target: Mode = f.direction === 1 ? "dream" : "wake";
        setMode(target);
      }

      if (t >= 1) {
        f.active = false;
        brushMaterial.uniforms.uFloodActive.value = 0.0;
        endTransition();
      }
    }

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

    // ── Render brush buffer (ping-pong) ─────────────────────────
    const readTarget =
      pingPongRef.current === 0 ? brushTargetA : brushTargetB;
    const writeTarget =
      pingPongRef.current === 0 ? brushTargetB : brushTargetA;

    // Set brush uniforms
    brushMaterial.uniforms.uPrevFrame.value = readTarget.texture;
    brushMaterial.uniforms.uDecay.value = f.active ? 1.0 : 0.985;
    brushMaterial.uniforms.uTime.value = time;
    brushMaterial.uniforms.uResolution.value.set(brushRes.w, brushRes.h);

    if (mouseActiveRef.current && !reducedMotion) {
      brushMaterial.uniforms.uBrushRadius.value = dynamicRadius;
      brushMaterial.uniforms.uBrushStrength.value = 1.0;

      const stamps = getStamps();
      const stampUniforms = brushMaterial.uniforms.uStamps
        .value as THREE.Vector2[];
      brushMaterial.uniforms.uStampCount.value = stamps.length;
      for (let i = 0; i < stamps.length && i < 16; i++) {
        stampUniforms[i].copy(stamps[i]);
      }
    } else if (reducedMotion) {
      // Simple circular reveal on hover
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

    // Reset clear color and render to screen
    gl.setClearColor("#000000", 0);
    gl.setRenderTarget(null);

    // Store previous mouse for next frame interpolation
    prevMouseRef.current.x = smoothMouseRef.current.x;
    prevMouseRef.current.y = smoothMouseRef.current.y;
  });

  return (
    <>
      {/* Wake scene rendered to FBO via portal */}
      {createPortal(
        <WakeScene reducedMotion={reducedMotion} isMobile={isMobile} />,
        wakeScene
      )}

      {/* Dream scene rendered to FBO via portal */}
      {createPortal(
        <DreamScene reducedMotion={reducedMotion} isMobile={isMobile} />,
        dreamScene
      )}

      {/* Full-screen composite quad rendered to screen */}
      <mesh ref={compositeQuadRef} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
        <primitive object={compositeMaterial} attach="material" />
      </mesh>
    </>
  );
}
