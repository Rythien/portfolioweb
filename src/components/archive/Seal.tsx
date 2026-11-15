"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";
import { applyCrystalShader, crystalGlassProps, thicknessFor } from "@/components/crystal/crystalMaterial";
import { SEAL, type SealSpot } from "./layout";
import { sealProgress, type ArchiveState } from "./archiveState";
import type { SealTarget, V3 } from "./game";

/** Test hook (archivefreeze=1): seals hold still, for repeatable hit shots. */
const FREEZE = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("archivefreeze") === "1";

/** Body half-axes for hit tests: a little inside the nudged dodecahedron. */
export const SEAL_RADII: V3 = [SEAL.radius * 0.92, SEAL.radius * 0.92 * 1.22, SEAL.radius * 0.92];

/**
 * Crack lines from each facet hit: a few branching walks over the surface
 * from the impact, in body space (so they turn with the seal).
 */
function crackGeometry(dirs: V3[], seed: number): THREE.BufferGeometry {
  const rnd = lcg(seed);
  const pts: number[] = [];
  const onSurface = (d: THREE.Vector3) =>
    new THREE.Vector3(d.x * SEAL_RADII[0], d.y * SEAL_RADII[1], d.z * SEAL_RADII[2]).multiplyScalar(1.06);
  for (const dir of dirs) {
    const o = new THREE.Vector3(...dir).normalize();
    const branches = 6 + Math.floor(rnd() * 3);
    for (let b = 0; b < branches; b++) {
      const d = o.clone();
      // A tangent heading for this branch
      let head = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).cross(d).normalize();
      const steps = 6 + Math.floor(rnd() * 6);
      let prev = onSurface(d);
      for (let k = 0; k < steps; k++) {
        head.applyAxisAngle(d, (rnd() - 0.5) * 0.9).normalize();
        d.addScaledVector(head, 0.07 + rnd() * 0.06).normalize();
        head = head.sub(d.clone().multiplyScalar(head.dot(d))).normalize();
        const cur = onSurface(d);
        pts.push(prev.x, prev.y, prev.z, cur.x, cur.y, cur.z);
        prev = cur;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

/**
 * A seal: one project frozen inside a faceted block of ice, orbited by
 * shards. One facet is lit; that is the target the pulse will be released
 * at (not built yet). Three hits free the project.
 *
 * Built from a slightly irregular dodecahedron: 12 pentagonal facets read
 * as cut ice at a distance, and each facet is 3 triangles in order, so a
 * facet is easy to address (facet i = triangles 3i..3i+2).
 */

function lcg(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Non-indexed dodecahedron, vertices nudged per facet so it is not a die. */
function sealGeometry(seed: number): THREE.BufferGeometry {
  const g = new THREE.DodecahedronGeometry(SEAL.radius, 0).toNonIndexed();
  const rnd = lcg(seed);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  // Same corner, same nudge (corners are shared by three facets)
  const nudge = new Map<string, THREE.Vector3>();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!nudge.has(key)) nudge.set(key, new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(SEAL.radius * 0.16));
    v.add(nudge.get(key)!);
    // Taller than wide: a standing seal, not a ball
    v.y *= 1.22;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  // Planar UVs for the frost maps (they tile)
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) * 0.35 + pos.getZ(i) * 0.2;
    uv[i * 2 + 1] = pos.getY(i) * 0.35;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/** One facet of the seal geometry, pushed out a hair, for the lit overlay. */
function facetGeometry(seal: THREE.BufferGeometry, facet: number): { geo: THREE.BufferGeometry; center: THREE.Vector3; normal: THREE.Vector3 } {
  const pos = seal.getAttribute("position") as THREE.BufferAttribute;
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < 9; k++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, facet * 9 + k));
  const center = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(9);
  const normal = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[2], pts[0])).normalize();
  if (normal.dot(center) < 0) normal.negate();
  const out = new Float32Array(27);
  pts.forEach((p, k) => {
    const q = p.clone().addScaledVector(normal, 0.03);
    out.set([q.x, q.y, q.z], k * 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(out, 3));
  return { geo, center, normal };
}

/** A small irregular shard: an octahedron with its corners pulled about. */
function shardGeometry(): THREE.BufferGeometry {
  const g = new THREE.OctahedronGeometry(1, 0).toNonIndexed();
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const rnd = lcg(4711);
  const seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(2)},${pos.getY(i).toFixed(2)},${pos.getZ(i).toFixed(2)}`;
    if (!seen.has(key)) seen.set(key, [0.55 + rnd() * 0.7, 0.8 + rnd() * 1.4, 0.4 + rnd() * 0.5]);
    const [sx, sy, sz] = seen.get(key)!;
    pos.setXYZ(i, pos.getX(i) * sx, pos.getY(i) * sy, pos.getZ(i) * sz);
  }
  g.computeVertexNormals();
  return g;
}

/** Soft violet glow for the light the seal holds. */
let _glow: THREE.CanvasTexture | null = null;
function innerGlowTexture(): THREE.CanvasTexture {
  if (_glow) return _glow;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(214,196,255,0.9)");
  g.addColorStop(0.35, "rgba(167,139,250,0.45)");
  g.addColorStop(1, "rgba(120,90,240,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  _glow = new THREE.CanvasTexture(c);
  _glow.colorSpace = THREE.SRGBColorSpace;
  return _glow;
}

/** Project covers, created once with the right colour space (they stream in). */
const _covers = new Map<string, THREE.Texture>();
function coverTexture(url: string): THREE.Texture {
  let t = _covers.get(url);
  if (!t) {
    t = new THREE.TextureLoader().load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    _covers.set(url, t);
  }
  return t;
}

const _shardGeo = typeof window !== "undefined" ? shardGeometry() : null;

/** Lit facet: a soft glow that breathes, brightest at the facet centre. */
const FACET_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uCenter;
  uniform float uSize;
  varying vec3 vLocal;
  void main() {
    // Brightest at the facet centre, a lit rim where it meets the cut
    float r = clamp(distance(vLocal, uCenter) / uSize, 0.0, 1.0);
    float breathe = 0.75 + 0.25 * sin(uTime * 2.2);
    // A warm wash, brightest at the centre, with a lit lip where the facet
    // meets its neighbours, so its outline reads as the target
    float a = (1.0 - smoothstep(0.0, 1.0, r)) * 0.45 + 0.12;
    a += smoothstep(0.72, 1.0, r) * 0.55;
    gl_FragColor = vec4(uColor * a * breathe, 1.0);
  }
`;
const FACET_VERT = /* glsl */ `
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

interface Orbiter {
  radius: number;
  speed: number;
  phase: number;
  tilt: THREE.Quaternion;
  scale: number;
  spin: THREE.Vector3;
  bob: number;
}

function makeOrbiters(seed: number): Orbiter[] {
  const rnd = lcg(seed);
  // Three rings, each tilted its own way, a few shards per ring
  const rings = [0, 1, 2].map(() =>
    new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 1.6, rnd() * Math.PI * 2, (rnd() - 0.5) * 1.6)),
  );
  const out: Orbiter[] = [];
  for (let i = 0; i < SEAL.orbiters; i++) {
    const ring = i % rings.length;
    out.push({
      radius: SEAL.radius * (1.75 + ring * 0.42 + rnd() * 0.25),
      speed: (0.16 + rnd() * 0.14) * (ring === 1 ? -1 : 1),
      phase: rnd() * Math.PI * 2,
      tilt: rings[ring],
      scale: 0.22 + rnd() * 0.38,
      spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(1.6),
      bob: rnd() * Math.PI * 2,
    });
  }
  return out;
}

/* ── Name ring: the project's name around the seal ────────────── */

function nameRingTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 4096;
  c.height = 160;
  const x = c.getContext("2d")!;
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim() || "monospace";
  x.font = `500 84px ${family}`;
  (x as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "14px";
  x.fillStyle = "rgba(244,240,255,0.92)";
  x.textBaseline = "middle";
  // Repeat the label until the band is full, so some of it always faces you
  let px = 40;
  while (px < c.width) {
    x.fillText(text, px, c.height / 2);
    px += x.measureText(text).width + 40;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ── Seal ─────────────────────────────────────────────────────── */

export interface SealRegistry {
  /** Hidden for the seals' backdrop pass (the glass and what sits on it). */
  backdropHidden: Set<THREE.Object3D>;
  /** Seal bodies (rotating groups), by seal index. */
  bodies: (THREE.Object3D | null)[];
  /** What a pulse can hit at each seal, refreshed every frame. */
  targets: SealTarget[];
}

interface SealProps {
  spot: SealSpot;
  index: number;
  /** Cover of the project held inside. */
  cover: string;
  /** The ring label, e.g. "PIXEL PLUS · WEB APPLICATION · 2024". */
  label: string;
  reduced: boolean;
  /** Shared backdrop the seals' glass refracts (one pass for all three). */
  buffer: THREE.Texture;
  registry: SealRegistry;
  state: ArchiveState;
}

/** Registry writes live outside the component (it is shared, mutable scene plumbing). */
function registerSeal(r: SealRegistry, index: number, body: THREE.Object3D | null, hide: THREE.Object3D[]) {
  hide.forEach((o) => r.backdropHidden.add(o));
  r.bodies[index] = body;
}
function unregisterSeal(r: SealRegistry, index: number, hide: THREE.Object3D[]) {
  hide.forEach((o) => r.backdropHidden.delete(o));
  r.bodies[index] = null;
}
function writeTarget(r: SealRegistry, index: number, t: SealTarget) {
  r.targets[index] = t;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** A brighter rim than the hero's: it has to separate a seal from violet fog at any distance. */
const SEAL_RIM = { intensity: 1.1, power: 2.6 };
const SHARD_RIM = { intensity: 1.0, power: 2.4 };

export default function Seal({ spot, index, cover, label, reduced, buffer, registry, state }: SealProps) {
  const body = useRef<THREE.Group>(null);
  const coverRef = useRef<THREE.Mesh>(null);
  const facetMesh = useRef<THREE.Mesh>(null);
  const facetMat = useRef<THREE.ShaderMaterial>(null);
  const swarm = useRef<THREE.InstancedMesh>(null);
  const glass = useRef<THREE.Mesh>(null);
  const edges = useRef<THREE.LineSegments>(null);
  const ring = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const glow = useRef<THREE.Sprite>(null);
  const cracks = useRef<THREE.LineSegments>(null);
  const crackCount = useRef(0);
  /** Reused every frame for the hit target (no per-frame allocation). */
  const target = useRef<SealTarget>({
    center: [0, 0, 0],
    rotY: 0,
    radii: SEAL_RADII,
    facet: [0, 0, 1],
    shards: Array.from({ length: SEAL.orbiters }, () => ({ p: [0, 0, 0] as V3, r: 0.5 })),
    freed: false,
  });
  const coverTex = useMemo(() => coverTexture(cover), [cover]);
  const ringTex = useMemo(() => nameRingTexture(`${label}   ·   `), [label]);
  const glowTex = useMemo(() => innerGlowTexture(), []);
  const geo = useMemo(() => sealGeometry(101 + index * 37), [index]);
  // Every facet's overlay, built once: the lit one moves after each hit
  const facets = useMemo(() => Array.from({ length: 12 }, (_, f) => facetGeometry(geo, f)), [geo]);
  const orbiters = useMemo(() => makeOrbiters(900 + index * 53), [index]);
  const glassProps = useMemo(() => crystalGlassProps("dream"), []);
  const sealSize = SEAL.radius * 2 * 1.22;
  const facetUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color("#ffd98a") },
      uCenter: { value: new THREE.Vector3() },
      uSize: { value: SEAL.radius * 0.7 },
    }),
    [],
  );

  // Glass, its edges, the lit facet and the name ring stay out of the
  // backdrop the glass refracts; the cover, glow and orbiters are in it
  useEffect(() => {
    const hide = [glass.current, edges.current, facetMesh.current, ring.current, cracks.current].filter(Boolean) as THREE.Object3D[];
    registerSeal(registry, index, body.current, hide);
    return () => unregisterSeal(registry, index, hide);
  }, [registry, index]);

  useFrame((frame, delta) => {
    const t = frame.clock.elapsedTime;
    const k = FREEZE ? 0 : reduced ? 0.35 : 1;
    const s = state.seals[index];
    const progress = sealProgress(s);
    if (body.current) {
      body.current.rotation.y += delta * 0.08 * k * (index % 2 ? -1 : 1);
      body.current.position.y = reduced || FREEZE ? 0 : Math.sin(t * 0.4 + index) * 0.25;
    }
    // The lit facet follows the state
    const f = facets[s.litFacet % facets.length];
    if (facetMesh.current) {
      if (facetMesh.current.geometry !== f.geo) facetMesh.current.geometry = f.geo;
      facetMesh.current.visible = !s.freed;
    }
    if (facetMat.current) {
      facetMat.current.uniforms.uTime.value = reduced ? 0 : t;
      facetMat.current.uniforms.uCenter.value.copy(f.center);
    }
    // Lit from within: brighter the closer the project is to being freed
    if (light.current) light.current.intensity = 5 + progress * 18;
    if (glow.current) {
      (glow.current.material as THREE.SpriteMaterial).opacity = 0.35 + progress * 0.5;
      glow.current.position.y = body.current?.position.y ?? 0;
    }
    if (coverRef.current) {
      coverRef.current.quaternion.copy(frame.camera.quaternion);
      coverRef.current.position.y = body.current?.position.y ?? 0;
    }
    if (ring.current) {
      ring.current.rotation.y -= delta * 0.12 * k;
      ring.current.position.y = (body.current?.position.y ?? 0) - SEAL.radius * 0.75;
    }
    const sw = swarm.current;
    if (sw) {
      orbiters.forEach((o, i) => {
        const a = o.phase + t * o.speed * k;
        _p.set(Math.cos(a) * o.radius, Math.sin(t * 0.5 + o.bob) * 0.3 * k, Math.sin(a) * o.radius).applyQuaternion(o.tilt);
        _e.set(o.spin.x * t * k, o.spin.y * t * k, o.spin.z * t * k);
        _q.setFromEuler(_e);
        _s.setScalar(o.scale);
        _m.compose(_p, _q, _s);
        sw.setMatrixAt(i, _m);
      });
      sw.instanceMatrix.needsUpdate = true;
    }
    // Cracks: rebuilt when a facet hit adds one
    if (cracks.current && s.cracks.length !== crackCount.current) {
      crackCount.current = s.cracks.length;
      cracks.current.geometry.dispose();
      cracks.current.geometry = crackGeometry(s.cracks, 31 + index * 7);
    }
    // Hit target for the pulse, in world space
    const tg = target.current;
    const by = body.current?.position.y ?? 0;
    tg.center[0] = spot.pos[0];
    tg.center[1] = spot.pos[1] + by;
    tg.center[2] = spot.pos[2];
    tg.rotY = body.current?.rotation.y ?? 0;
    tg.facet[0] = f.center.x;
    tg.facet[1] = f.center.y;
    tg.facet[2] = f.center.z;
    tg.freed = s.freed;
    orbiters.forEach((o, i) => {
      const a = o.phase + t * o.speed * k;
      _p.set(Math.cos(a) * o.radius, Math.sin(t * 0.5 + o.bob) * 0.3 * k, Math.sin(a) * o.radius).applyQuaternion(o.tilt);
      const sh = tg.shards[i];
      sh.p[0] = spot.pos[0] + _p.x;
      sh.p[1] = spot.pos[1] + _p.y;
      sh.p[2] = spot.pos[2] + _p.z;
      sh.r = o.scale * 1.15;
    });
    writeTarget(registry, index, tg);
  });

  return (
    <group position={spot.pos}>
      {/* The project, frozen inside: always turned to you, opaque so the
          ice refracts it, unfogged so it reads from across the void */}
      <mesh ref={coverRef} renderOrder={0}>
        <planeGeometry args={[SEAL.radius * 1.2, SEAL.radius * 1.2 * 0.75]} />
        <meshBasicMaterial map={coverTex} color="#f1edff" side={THREE.DoubleSide} toneMapped={false} fog={false} />
      </mesh>
      {/* Held light: a violet glow behind the cover, seen through the ice */}
      <sprite ref={glow} scale={[SEAL.radius * 2.6, SEAL.radius * 2.6, 1]} renderOrder={-1}>
        <spriteMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} opacity={0.35} />
      </sprite>
      <group ref={body}>
        <pointLight ref={light} color="#a78bfa" intensity={5} distance={SEAL.radius * 4} decay={1.4} />
        {/* The ice: the shared crystal material, DREAM tint */}
        <mesh ref={glass} geometry={geo}>
          <MeshTransmissionMaterial
            {...glassProps}
            buffer={buffer}
            thickness={thicknessFor(sealSize)}
            resolution={32}
            ref={(m: unknown) => applyCrystalShader(m as THREE.Material | null, SEAL_RIM)}
          />
        </mesh>
        {/* Crisp cut edges */}
        <lineSegments ref={edges}>
          <edgesGeometry args={[geo, 20]} />
          <lineBasicMaterial color="#f1ecff" transparent opacity={0.45} />
        </lineSegments>
        {/* The lit facet: the target */}
        <mesh ref={facetMesh} geometry={facets[state.seals[index].litFacet % 12].geo} renderOrder={2}>
          <shaderMaterial
            ref={facetMat}
            uniforms={facetUniforms}
            vertexShader={FACET_VERT}
            fragmentShader={FACET_FRAG}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {/* Cracks from facet hits */}
        <lineSegments ref={cracks} renderOrder={3}>
          <bufferGeometry />
          <lineBasicMaterial color="#fff6dc" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </lineSegments>
      </group>
      {/* The project's name, circling the seal's waist */}
      <mesh ref={ring} rotation-x={0.08}>
        <cylinderGeometry args={[SEAL.radius * 1.35, SEAL.radius * 1.35, SEAL.radius * 0.22, 128, 1, true]} />
        <meshBasicMaterial map={ringTex} transparent depthWrite={false} side={THREE.FrontSide} toneMapped={false} />
      </mesh>
      {/* Shards in orbit: three tilted rings, the middle one counter-rotating */}
      {_shardGeo && (
        <instancedMesh ref={swarm} args={[_shardGeo, undefined, orbiters.length]} frustumCulled={false}>
          <MeshTransmissionMaterial
            {...glassProps}
            buffer={buffer}
            thickness={thicknessFor(1.2, true)}
            resolution={32}
            flatShading
            ref={(m: unknown) => applyCrystalShader(m as THREE.Material | null, SHARD_RIM)}
          />
        </instancedMesh>
      )}
    </group>
  );
}
