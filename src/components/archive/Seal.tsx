"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SEAL, type SealSpot } from "./layout";
import { sealProgress, sealSlug, type ArchiveState, type SealState } from "./archiveState";
import {
  ENDING, FREE, WALL, bodyRot, gapAzimuth, wallShardOffset, wallSlotOpen, wallSlots, SHARD_HIT,
  type SealTarget, type V3, type WallSlot,
} from "./game";
import type { Project } from "@/content/projects";
import { useArchiveProgress } from "@/store/useArchiveProgress";
import { timed } from "@/components/scene/costs";
import { OVERSHOOT, ease } from "@/lib/motion";
import { playMote } from "./archiveAudio";

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

/**
 * The lit facet's edge: a flat band just outside its pentagon, lying on the
 * facet, so the target has its own bright outline (not the seal's core
 * glow) that reads from across the void.
 */
function facetRimGeometry(seal: THREE.BufferGeometry, facet: number, width = 0.26): THREE.BufferGeometry {
  const pos = seal.getAttribute("position") as THREE.BufferAttribute;
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < 9; k++) {
    const p = new THREE.Vector3().fromBufferAttribute(pos, facet * 9 + k);
    if (!pts.some((q) => q.distanceToSquared(p) < 1e-6)) pts.push(p);
  }
  const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(pts.length);
  const n = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[2], pts[0])).normalize();
  if (n.dot(c) < 0) n.negate();
  // Outline order: by angle about the centre, in the facet's plane
  const u = new THREE.Vector3().subVectors(pts[0], c).normalize();
  const v = new THREE.Vector3().crossVectors(n, u);
  pts.sort((a, b) => {
    const da = a.clone().sub(c), db = b.clone().sub(c);
    return Math.atan2(da.dot(v), da.dot(u)) - Math.atan2(db.dot(v), db.dot(u));
  });
  const lift = n.clone().multiplyScalar(0.05);
  const out: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ao = a.clone().add(a.clone().sub(c).setLength(width)).add(lift);
    const bo = b.clone().add(b.clone().sub(c).setLength(width)).add(lift);
    const ai = a.clone().add(lift), bi = b.clone().add(lift);
    out.push(ai.x, ai.y, ai.z, bi.x, bi.y, bi.z, bo.x, bo.y, bo.z, ai.x, ai.y, ai.z, bo.x, bo.y, bo.z, ao.x, ao.y, ao.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  return g;
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

/** A white radial glow, tinted per sprite (the window's lit edge). */
let _edge: THREE.CanvasTexture | null = null;
function edgeGlowTexture(): THREE.CanvasTexture {
  if (_edge) return _edge;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  _edge = new THREE.CanvasTexture(c);
  _edge.colorSpace = THREE.SRGBColorSpace;
  return _edge;
}

/**
 * Points around the window's rim, in cage space with the window looking
 * along azimuth 0: its two upright edges and its sill and lintel, a
 * little outside the opening so they sit on the cut shards.
 */
function windowRim(): WallSlot[] {
  const ph = WALL.phases[0];
  const step = (WALL.spacing * 0.5) / WALL.radius;
  const az = ph.halfAz + step * 0.4;
  const lat = ph.halfLat + step * 0.4;
  const out: WallSlot[] = [];
  for (let l = -lat; l <= lat + 1e-6; l += step) out.push({ lat: l, az: -az }, { lat: l, az });
  for (let a = -az + step; a < az - 1e-6; a += step) out.push({ lat: -lat, az: a }, { lat, az: a });
  return out;
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

/** Panel layout (world units): the cover (16:10) over its caption block. */
const PANEL = (() => {
  const w = FREE.panelWidth;
  const coverH = w * 0.625;
  const textH = w * (420 / 2048);
  const gap = w * 0.035;
  const total = coverH + gap + textH;
  return { w, coverH, textH, coverY: total / 2 - coverH / 2, textY: -total / 2 + textH / 2 };
})();

/** Fragments of the body itself, thrown out when the seal bursts. */
const BURST = 14;
interface Fragment {
  dir: THREE.Vector3;
  /** Distance it settles at, from the seal centre. */
  out: number;
  scale: number;
  spin: THREE.Vector3;
  phase: number;
}
function makeFragments(seed: number): Fragment[] {
  const rnd = lcg(seed);
  return Array.from({ length: BURST }, () => {
    const th = Math.acos(2 * rnd() - 1);
    const ph = rnd() * Math.PI * 2;
    return {
      dir: new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th) * 1.1, Math.sin(th) * Math.sin(ph)).normalize(),
      // Clear of the panel's face (half width ~6.5) once they settle
      out: SEAL.radius * (2.4 + rnd() * 1.1),
      scale: 0.32 + rnd() * 0.36,
      spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(1.2),
      phase: rnd() * Math.PI * 2,
    };
  });
}

/** 0 at the moment of freeing, easing to 1 as the burst slows to a drift. */
const flyK = (age: number) => (age <= 0 ? 0 : 1 - Math.exp(-age / FREE.flyTau));
const easeInOut = ease.smooth;
/** Game feedback: a freed panel blooms with a small overshoot. */
const easeOutBack = ease.backOut(OVERSHOOT.seal);

/* ── The freed project's panel: cover, then title, roles and year ── */

/** Title, roles and year in the site's own type, under the cover. */
function panelTextTexture(p: Project): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 420;
  const x = c.getContext("2d")!;
  const css = getComputedStyle(document.documentElement);
  const sans = css.getPropertyValue("--font-sans").trim() || "system-ui, sans-serif";
  const mono = css.getPropertyValue("--font-mono").trim() || "monospace";
  const ls = (v: string) => ((x as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = v);
  x.textBaseline = "alphabetic";
  // Hairline and the counter row, as on the awake page's cards
  x.fillStyle = "rgba(244,240,255,0.35)";
  x.fillRect(0, 8, c.width, 3);
  x.font = `500 46px ${mono}`;
  ls("6px");
  x.fillStyle = "rgba(244,240,255,0.78)";
  x.fillText(`${p.counter}   ${p.category}`.toUpperCase(), 0, 84);
  x.textAlign = "right";
  x.fillText(p.year, c.width, 84);
  x.textAlign = "left";
  x.font = `700 168px ${sans}`;
  ls("-4px");
  x.fillStyle = "#f6f2ff";
  x.fillText(p.title.toUpperCase(), -6, 270);
  // Roles: one line, shrunk to fit the panel's width
  const roles = `ROLES: ${p.roles.join(", ")}`.toUpperCase();
  let px = 44;
  ls("5px");
  do {
    x.font = `500 ${px}px ${mono}`;
    px -= 2;
  } while (x.measureText(roles).width > c.width && px > 20);
  x.fillStyle = "rgba(244,240,255,0.78)";
  x.fillText(roles, 0, 370);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Freeing and touching write the shared state (module helpers: React-compiler rules). */
function markTouched(s: SealState, slug: string) {
  s.touched = true;
  useArchiveProgress.getState().recover(slug);
  playMote(3);
  window.dispatchEvent(new CustomEvent("archive-recovered", { detail: slug }));
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
  /** The one seal wearing real transmission (nearest unfreed; -1: none). */
  nearest: number;
}

interface SealProps {
  spot: SealSpot;
  index: number;
  /** Cover of the project held inside. */
  cover: string;
  /** The ring label, e.g. "NOVA DELIVERS · WEB APPLICATION / FULL-STACK · 2026". */
  label: string;
  /** The project held inside (its panel when freed). */
  project: Project | undefined;
  reduced: boolean;
  /** ONE glass material for every seal body and ONE for every orbiting
   * shard (ArchiveScene owns them; they read the shared backdrop). */
  glassMaterial: THREE.Material;
  shardMaterial: THREE.Material;
  /** Their non-transmissive stand-ins, worn while another seal is nearest. */
  cheapGlassMaterial: THREE.Material;
  cheapShardMaterial: THREE.Material;
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
function wearMaterial(o: THREE.Mesh | null, m: THREE.Material) {
  if (o && o.material !== m) o.material = m;
}
function exposeGap(index: number, gapAz: number, phase: (typeof WALL.phases)[number]) {
  const w = window as unknown as { __archiveGap?: Record<number, { az: number; phase: typeof phase }> };
  (w.__archiveGap ??= {})[index] = { az: gapAz, phase };
}
function writeTarget(r: SealRegistry, index: number, t: SealTarget) {
  r.targets[index] = t;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _w = new THREE.Vector3();
const _end = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _wo: V3 = [0, 0, 0];

/** A brighter rim than the hero's: it has to separate a seal from violet fog at any distance. */
export const SEAL_RIM = { intensity: 1.1, power: 2.6 };
export const SHARD_RIM = { intensity: 1.0, power: 2.4 };
/** Seal body size (tallest side), for its glass thickness. */
export const SEAL_SIZE = SEAL.radius * 2 * 1.22;

export default function Seal({ spot, index, cover, label, project, reduced, glassMaterial, shardMaterial, cheapGlassMaterial, cheapShardMaterial, registry, state }: SealProps) {
  const body = useRef<THREE.Group>(null);
  const coverRef = useRef<THREE.Mesh>(null);
  const facetMesh = useRef<THREE.Mesh>(null);
  const facetMat = useRef<THREE.ShaderMaterial>(null);
  const facetRim = useRef<THREE.Mesh>(null);
  const swarm = useRef<THREE.InstancedMesh>(null);
  const glass = useRef<THREE.Mesh>(null);
  const edges = useRef<THREE.LineSegments>(null);
  const ring = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const glow = useRef<THREE.Sprite>(null);
  const cracks = useRef<THREE.LineSegments>(null);
  const crackCount = useRef(0);
  const panel = useRef<THREE.Group>(null);
  const panelCover = useRef<THREE.MeshBasicMaterial>(null);
  const panelText = useRef<THREE.MeshBasicMaterial>(null);
  const panelGlow = useRef<THREE.Sprite>(null);
  const flash = useRef<THREE.Sprite>(null);
  /** The window's lit rim (fights only), turned with the cage. */
  const rimGroup = useRef<THREE.Group>(null);
  const rimSprites = useRef<(THREE.Sprite | null)[]>([]);
  /** Panel art is fetched when the seal is freed, not up front. */
  const panelTex = useRef<{ cover: THREE.Texture; text: THREE.CanvasTexture } | null>(null);
  /** Last shard positions (local) and scale, so the ending converges from where they are. */
  const endFrom = useRef<THREE.Vector3[] | null>(null);
  /** Reused every frame for the hit target (no per-frame allocation). */
  const target = useRef<SealTarget>({
    center: [0, 0, 0],
    rotY: 0,
    radii: SEAL_RADII,
    facet: [0, 0, 1],
    shards: Array.from({ length: SEAL.fight.includes(index) ? wallSlots().length : SEAL.orbiters }, () => ({ p: [0, 0, 0] as V3, r: 0.5 })),
    freed: false,
  });
  const coverTex = useMemo(() => timed("seal: cover texture", () => coverTexture(cover)), [cover]);
  const ringTex = useMemo(() => timed("seal: ring texture", () => nameRingTexture(`${label}   ·   `)), [label]);
  const glowTex = useMemo(() => timed("seal: glow texture", () => innerGlowTexture()), []);
  const geo = useMemo(() => timed("seal: geometry", () => sealGeometry(101 + index * 37)), [index]);
  // Every facet's overlay, built once: the lit one moves after each hit
  const facets = useMemo(() => timed("seal: facets", () => Array.from({ length: 12 }, (_, f) => facetGeometry(geo, f))), [geo]);
  const facetRims = useMemo(() => timed("seal: facet rims", () => Array.from({ length: 12 }, (_, f) => facetRimGeometry(geo, f))), [geo]);
  const fight = SEAL.fight.includes(index);
  // A fight is walled in; the other seals keep their loose orbiters
  const orbiters = useMemo(() => timed("seal: orbiters", () => (fight ? [] : makeOrbiters(900 + index * 53))), [index, fight]);
  const slots = useMemo(() => (fight ? wallSlots() : []), [fight]);
  const rim = useMemo(() => (fight ? windowRim() : []), [fight]);
  const edgeTex = useMemo(() => (fight ? edgeGlowTexture() : null), [fight]);
  const fragments = useMemo(() => timed("seal: fragments", () => makeFragments(1300 + index * 71)), [index]);
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
    // The panel too: nothing refracts it (the glass is gone by then)
    const hide = [glass.current, edges.current, facetMesh.current, ring.current, cracks.current, panel.current, flash.current, rimGroup.current, facetRim.current].filter(Boolean) as THREE.Object3D[];
    registerSeal(registry, index, body.current, hide);
    return () => unregisterSeal(registry, index, hide);
  }, [registry, index]);

  /** Orbit angle per orbiter, accumulated (its speed changes when freed). */
  const angles = useRef<number[] | null>(null);

  useFrame((frame, delta) => {
    const t = frame.clock.elapsedTime;
    const k = FREEZE ? 0 : reduced ? 0.35 : 1;
    const s = state.seals[index];
    const progress = sealProgress(s);
    // Seconds since freed (Infinity: freed on an earlier visit)
    const age = s.freed ? state.t - s.freedAt : -1;
    const fly = s.freed ? flyK(age) : 0;
    const burstGone = s.freed && age > 0.12;
    const end = state.ending;
    const et = end ? state.t - end.t0 : -1;
    const conv = end ? easeInOut(et / ENDING.converge) : 0;

    // Only the nearest seal refracts; the others wear the cheap glass
    const real = registry.nearest === index;
    wearMaterial(glass.current, real ? glassMaterial : cheapGlassMaterial);
    wearMaterial(swarm.current, real ? shardMaterial : cheapShardMaterial);

    // A fight: the cage turns, carrying its window round, and the body
    // turns with it so the lit facet looks out through the window
    const phase = WALL.phases[Math.min(s.hits, WALL.phases.length - 1)];
    // archivefreeze=1 (tests): everything holds still, the window parked
    // over the lit facet so a frozen fight can be won
    const fc0 = facets[s.litFacet % facets.length].center;
    const gapAz = FREEZE
      ? Math.atan2(fc0.z, fc0.x) - bodyRot(phase, 0)
      : gapAzimuth(phase, state.t, SEAL.gapOffset[index] ?? 0);
    // Test hook (scripts/shot/fight.mjs): the window's azimuth, live
    if (fight) exposeGap(index, gapAz, phase);
    // The seal turns on its own clock (WALL spin), not with the cage: a
    // shot exists only while its facet is inside the window
    if (body.current && fight && !s.freed) {
      body.current.rotation.y = bodyRot(phase, FREEZE ? 0 : state.t);
    } else if (body.current) {
      body.current.rotation.y += delta * 0.08 * k * (index % 2 ? -1 : 1);
      body.current.position.y = reduced || FREEZE ? 0 : Math.sin(t * 0.4 + index) * 0.25;
    }
    const by = body.current?.position.y ?? 0;

    // The glass bursts: it swells for a beat, then it is shards
    if (glass.current) {
      glass.current.visible = !burstGone;
      glass.current.scale.setScalar(s.freed ? 1 + Math.min(1, Math.max(0, age) / 0.12) * 0.15 : 1);
    }
    if (edges.current) edges.current.visible = !burstGone;
    if (cracks.current) cracks.current.visible = !burstGone;
    if (coverRef.current) coverRef.current.visible = !burstGone;
    if (ring.current) {
      const m = ring.current.material as THREE.MeshBasicMaterial;
      m.opacity = 1 - Math.min(1, fly * 2.5);
      ring.current.visible = m.opacity > 0.01;
    }
    if (flash.current) {
      const a = s.freed ? age / FREE.burst : 1;
      flash.current.visible = a >= 0 && a < 1;
      if (flash.current.visible) {
        const sz = SEAL.radius * (1.5 + 5 * Math.sqrt(a));
        flash.current.scale.set(sz, sz, 1);
        (flash.current.material as THREE.SpriteMaterial).opacity = 1 - a;
      }
    }

    // The lit facet follows the state
    const f = facets[s.litFacet % facets.length];
    if (facetMesh.current) {
      if (facetMesh.current.geometry !== f.geo) facetMesh.current.geometry = f.geo;
      facetMesh.current.visible = !s.freed;
    }
    // The target's own bright edge, breathing; gone once freed
    if (facetRim.current) {
      const rg = facetRims[s.litFacet % facetRims.length];
      if (facetRim.current.geometry !== rg) facetRim.current.geometry = rg;
      facetRim.current.visible = !s.freed;
      (facetRim.current.material as THREE.MeshBasicMaterial).opacity = reduced ? 0.95 : 0.8 + 0.2 * Math.sin(t * 3.1);
    }
    if (facetMat.current) {
      facetMat.current.uniforms.uTime.value = reduced ? 0 : t;
      facetMat.current.uniforms.uCenter.value.copy(f.center);
    }
    // Lit from within: brighter the closer the project is to being freed,
    // a flare when it is, then a low glow; all of it goes with the ending
    const lightK = s.freed ? 6 + 34 * Math.exp(-Math.max(0, age) * 2.2) : 5 + progress * 18;
    if (light.current) light.current.intensity = lightK * (1 - conv);
    if (glow.current) {
      const g = s.freed ? 0.22 + 0.7 * Math.exp(-Math.max(0, age) * 1.4) : 0.35 + progress * 0.5;
      (glow.current.material as THREE.SpriteMaterial).opacity = g * (1 - conv);
      glow.current.position.y = by;
    }
    if (coverRef.current) {
      coverRef.current.quaternion.copy(frame.camera.quaternion);
      coverRef.current.position.y = by;
    }
    if (ring.current) {
      ring.current.rotation.y -= delta * 0.12 * k;
      ring.current.position.y = by - SEAL.radius * 0.75;
    }

    // Shards: orbiters fly out and slow to a drift when freed; the body's
    // own fragments burst from its surface; the ending gathers them all
    const n = orbiters.length;
    const W = slots.length;
    const ang = (angles.current ??= orbiters.map((o) => o.phase));
    const tg = target.current;
    const sw = swarm.current;
    const local = end ? _end.set(end.point[0] - spot.pos[0], end.point[1] - spot.pos[1], end.point[2] - spot.pos[2]) : null;
    if (end && !endFrom.current) endFrom.current = Array.from({ length: n + BURST + W }, () => new THREE.Vector3());
    for (let i = 0; i < n + BURST + W; i++) {
      let scale: number;
      if (i >= n + BURST) {
        // The shield wall: a closed cage but for the window
        const j = i - n - BURST;
        const slot = slots[j];
        const open = wallSlotOpen(slot, phase);
        wallShardOffset(slot, gapAz, _wo, WALL.radius * (1 + (FREE.flyOut - 1) * fly));
        _p.set(_wo[0], _wo[1] + by, _wo[2]);
        // Each shard points out of the cage, with a slow wobble of its own
        _e.set(slot.lat + Math.sin(t * 0.6 + j) * 0.15 * k, -(slot.az + gapAz), (j % 7) * 0.4 + t * 0.2 * k);
        // Freed: the cage flies out and thins, so the panel reads
        scale = open ? 0 : WALL.shardScale * (1 - 0.65 * fly);
        const sh = tg.shards[j];
        sh.p[0] = spot.pos[0] + _p.x;
        sh.p[1] = spot.pos[1] + _p.y;
        sh.p[2] = spot.pos[2] + _p.z;
        // An open slot never blocks
        sh.r = open ? -1 : scale * SHARD_HIT;
      } else if (i < n) {
        const o = orbiters[i];
        ang[i] += delta * o.speed * k * (1 - 0.7 * fly);
        const r = o.radius * (1 + (FREE.flyOut - 1) * fly);
        _p.set(Math.cos(ang[i]) * r, Math.sin(t * 0.5 + o.bob) * 0.3 * k, Math.sin(ang[i]) * r).applyQuaternion(o.tilt);
        _e.set(o.spin.x * t * k, o.spin.y * t * k, o.spin.z * t * k);
        scale = o.scale;
        const sh = tg.shards[i];
        sh.p[0] = spot.pos[0] + _p.x;
        sh.p[1] = spot.pos[1] + _p.y;
        sh.p[2] = spot.pos[2] + _p.z;
        sh.r = o.scale * SHARD_HIT;
      } else {
        const fr = fragments[i - n];
        const d = SEAL.radius * 0.6 + (fr.out - SEAL.radius * 0.6) * fly;
        _p.copy(fr.dir).multiplyScalar(d).applyAxisAngle(_up, t * 0.04 * k + fr.phase * 0.1);
        _p.y += by + Math.sin(t * 0.45 + fr.phase) * 0.35 * k * fly;
        _e.set(fr.spin.x * t * k, fr.spin.y * t * k, fr.spin.z * t * k);
        scale = s.freed ? fr.scale * Math.min(1, Math.max(0, age) / 0.08) : 0;
      }
      if (local && endFrom.current) {
        // Converge from wherever each shard was when the ending began
        const from = endFrom.current[i];
        if (from.lengthSq() === 0) from.copy(_p);
        _p.lerpVectors(from, local, conv);
        scale *= 1 - 0.75 * conv;
        if (et > ENDING.converge) scale = 0;
      }
      if (sw) {
        _q.setFromEuler(_e);
        _s.setScalar(Math.max(scale, 1e-4));
        _m.compose(_p, _q, _s);
        sw.setMatrixAt(i, _m);
      }
    }
    if (sw) sw.instanceMatrix.needsUpdate = true;

    // The window's rim: lit so the opening reads from anywhere, turned
    // with the cage, breathing; gone once the seal is free
    if (rimGroup.current) {
      rimGroup.current.visible = fight && !s.freed;
      rimGroup.current.rotation.y = -gapAz;
      rimGroup.current.position.y = by;
      const breathe = reduced ? 0.95 : 0.85 + 0.15 * Math.sin(t * 2.4);
      for (const sp of rimSprites.current) if (sp) (sp.material as THREE.SpriteMaterial).opacity = breathe;
    }

    // Cracks: rebuilt when a facet hit adds one
    if (cracks.current && s.cracks.length !== crackCount.current) {
      crackCount.current = s.cracks.length;
      cracks.current.geometry.dispose();
      cracks.current.geometry = crackGeometry(s.cracks, 31 + index * 7);
    }

    // The panel: blooms where the seal stood, always turned to you
    if (s.freed && !panelTex.current && project && panelCover.current && panelText.current) {
      panelTex.current = { cover: coverTexture(project.cover.dreamSrc ?? project.cover.src), text: panelTextTexture(project) };
      panelCover.current.map = panelTex.current.cover;
      panelText.current.map = panelTex.current.text;
      panelCover.current.needsUpdate = true;
      panelText.current.needsUpdate = true;
    }
    const bloomT = s.freed ? (age - FREE.bloomDelay) / FREE.bloom : 0;
    const alpha = Math.min(1, Math.max(0, bloomT / 0.6)) * (end ? 1 - Math.min(1, Math.max(0, et) / 1.2) : 1);
    if (panel.current) {
      panel.current.visible = alpha > 0.001;
      if (panel.current.visible) {
        panel.current.position.y = by + (reduced ? 0 : Math.sin(t * 0.35 + index) * 0.2);
        panel.current.quaternion.copy(frame.camera.quaternion);
        panel.current.scale.setScalar(Math.max(0.001, reduced ? Math.min(1, bloomT) : easeOutBack(bloomT)));
      }
    }
    if (panelCover.current) panelCover.current.opacity = alpha;
    if (panelText.current) panelText.current.opacity = alpha;
    if (panelGlow.current) (panelGlow.current.material as THREE.SpriteMaterial).opacity = alpha * (s.touched ? 0.75 : 0.45);
    // Floating into the panel marks the project (its case study opens on waking)
    if (s.freed && !s.touched && alpha > 0.6 && !end && panel.current) {
      _w.set(spot.pos[0], spot.pos[1] + panel.current.position.y, spot.pos[2]);
      if (frame.camera.position.distanceTo(_w) < FREE.touchRadius) markTouched(s, sealSlug(index));
    }

    // Hit target for the pulse, in world space
    tg.center[0] = spot.pos[0];
    tg.center[1] = spot.pos[1] + by;
    tg.center[2] = spot.pos[2];
    tg.rotY = body.current?.rotation.y ?? 0;
    tg.facet[0] = f.center.x;
    tg.facet[1] = f.center.y;
    tg.facet[2] = f.center.z;
    tg.freed = s.freed;
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
        <mesh ref={glass} geometry={geo} material={glassMaterial} />
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
        {/* The lit facet's bright edge: the target, legible from afar */}
        <mesh ref={facetRim} geometry={facetRims[state.seals[index].litFacet % 12]} renderOrder={3}>
          <meshBasicMaterial color="#fff2cf" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} fog={false} />
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
        <instancedMesh ref={swarm} args={[_shardGeo, shardMaterial, orbiters.length + BURST + slots.length]} frustumCulled={false} />
      )}
      {/* The window's lit rim (fights) */}
      {edgeTex && (
        <group ref={rimGroup}>
          {rim.map((r, i) => {
            const o = wallShardOffset(r, 0, [0, 0, 0], WALL.radius * 1.02);
            return (
              <sprite key={i} ref={(el) => { rimSprites.current[i] = el; }} position={o} scale={[1.2, 1.2, 1]} renderOrder={3}>
                <spriteMaterial map={edgeTex} color="#ffd98a" transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} toneMapped={false} />
              </sprite>
            );
          })}
        </group>
      )}
      {/* The burst: one white-violet flash as the glass gives way */}
      <sprite ref={flash} visible={false} renderOrder={4}>
        <spriteMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} toneMapped={false} />
      </sprite>
      {/* The freed project: its dream cover, then title, roles and year */}
      <group ref={panel} visible={false}>
        <sprite ref={panelGlow} scale={[PANEL.w * 1.7, PANEL.w * 1.25, 1]} renderOrder={-1}>
          <spriteMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} fog={false} opacity={0} />
        </sprite>
        <mesh position={[0, PANEL.coverY, 0]} renderOrder={5}>
          <planeGeometry args={[PANEL.w, PANEL.coverH]} />
          <meshBasicMaterial ref={panelCover} color="#f6f3ff" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} fog={false} />
        </mesh>
        <mesh position={[0, PANEL.textY, 0]} renderOrder={5}>
          <planeGeometry args={[PANEL.w, PANEL.textH]} />
          <meshBasicMaterial ref={panelText} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} fog={false} />
        </mesh>
      </group>
    </group>
  );
}
