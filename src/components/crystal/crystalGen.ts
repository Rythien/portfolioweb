/**
 * The crystal chunk and its shards, from one procedural source.
 *
 * Pure (three.js only, no DOM), deterministic, and run at build time by
 * scripts/gen-crystal.mjs, which writes public/models/crystal-chunk.bin.
 * The intact mesh and every shard come from the SAME displaced-and-clipped
 * mesh: shards are Voronoi cells cut out of it, so a shard's outer surface
 * is literally a piece of the intact surface (same positions, normals and
 * UVs) and only the fracture faces are new (flat normals).
 */
import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/* ── Tuning: retune the chunk here, then `npm run gen:crystal` ── */

export const SEED = 90;
/** Icosphere recursion depth (4 -> 5120 faces): fine relief needs the verts. */
export const ICO_SUBDIVISIONS = 4;
export const FBM_AMP = 0.14;
export const FBM_FREQ = 1.6;
export const FBM_OCTAVES = 4;
/** Fine relief baked into the geometry after the clip (it erodes the flat
 * cuts too): [frequency, amplitude] pairs, one value-noise octave each.
 * The normal map is left for sub-millimetre frost only. */
export const DETAIL_OCTAVES: [number, number][] = [[6, 0.025], [11, 0.012]];
export const AXIS_SCALE: [number, number, number] = [1.08, 1.0, 0.92];
export const PLANE_COUNT = 8;
export const PLANE_MIN = 0.66;
export const PLANE_MAX = 0.92;
/** Largest bounding-box side in world units; matches the previous rock so
 * hover radius, park layout and logo sizing keep their tuning. */
export const TARGET_SIZE = 2.426;
/** Faces meeting sharper than this get split normals (crisp cut edges). */
export const CREASE_DEG = 35;
export const SHARD_COUNT = 10;

/* ── Seeded randomness ────────────────────────────────────────── */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(ix: number, iy: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 1440662683) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(ix + dx, iy + dy, iz + dz, seed);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), ux), l(c(0, 1, 0), c(1, 1, 0), ux), uy),
    l(l(c(0, 0, 1), c(1, 0, 1), ux), l(c(0, 1, 1), c(1, 1, 1), ux), uy),
    uz,
  );
}

/** fbm in [0, 1]: FBM_OCTAVES octaves, frequency doubling, gain 0.5. */
export function fbm(x: number, y: number, z: number, seed: number): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < FBM_OCTAVES; o++) {
    sum += amp * valueNoise(x * freq, y * freq, z * freq, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/* ── Step 1: icosphere ────────────────────────────────────────── */

function icosphere(levels: number): { verts: THREE.Vector3[]; faces: [number, number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
  let faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  for (let l = 0; l < levels; l++) {
    const cache = new Map<string, number>();
    const mid = (a: number, b: number) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      verts.push(verts[a].clone().add(verts[b]).normalize());
      cache.set(key, verts.length - 1);
      return verts.length - 1;
    };
    const next: [number, number, number][] = [];
    for (const [a, b, c] of faces) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  return { verts, faces };
}

/* ── Steps 2-4: displace, scale, clip; then fit and shade ─────── */

export interface ClipPlane {
  n: THREE.Vector3;
  d: number;
}

export function clipPlanes(): ClipPlane[] {
  const rng = mulberry32(SEED);
  const out: ClipPlane[] = [];
  for (let i = 0; i < PLANE_COUNT; i++) {
    const th = Math.acos(2 * rng() - 1);
    const ph = 2 * Math.PI * rng();
    const n = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
    out.push({ n, d: PLANE_MIN + rng() * (PLANE_MAX - PLANE_MIN) });
  }
  return out;
}

/** UVs from direction, identical for the intact mesh and every shard. */
export function sphericalUV(x: number, y: number, z: number): [number, number] {
  const r = Math.hypot(x, y, z) || 1;
  return [0.5 + Math.atan2(z, x) / (2 * Math.PI), 0.5 + Math.asin(Math.max(-1, Math.min(1, y / r))) / Math.PI];
}

/** A triangle straddling the atan2 wrap gets its u unwrapped (the frost
 * texture repeats), so the seam never smears the frost into a band. */
function unwrapSeam(us: number[]): number[] {
  if (Math.max(...us) - Math.min(...us) <= 0.5) return us;
  return us.map((u) => (u < 0.5 ? u + 1 : u));
}

/** The intact chunk as a non-indexed geometry with creased normals + UVs. */
export function buildChunk(): THREE.BufferGeometry {
  const { verts, faces } = icosphere(ICO_SUBDIVISIONS);
  const planes = clipPlanes();
  const p = verts.map((v) => {
    // Displace along the (radial) normal by seeded fbm
    const r = 1 + FBM_AMP * (2 * fbm(v.x * FBM_FREQ, v.y * FBM_FREQ, v.z * FBM_FREQ, SEED) - 1);
    const q = v.clone().multiplyScalar(r);
    q.set(q.x * AXIS_SCALE[0], q.y * AXIS_SCALE[1], q.z * AXIS_SCALE[2]);
    // Project anything past a plane back onto it: flat cuts, ridges kept.
    // Repeated so a vertex past two planes ends up inside both.
    for (let it = 0; it < 4; it++) {
      for (const pl of planes) {
        const over = q.dot(pl.n) - pl.d;
        if (over > 0) q.addScaledVector(pl.n, -over);
      }
    }
    // Fine relief on top, along the radial direction
    let dr = 0;
    DETAIL_OCTAVES.forEach(([f, a], o) => {
      dr += a * (2 * valueNoise(v.x * f, v.y * f, v.z * f, SEED + 7001 + o * 31) - 1);
    });
    const len = q.length();
    q.multiplyScalar((len + dr) / len);
    return q;
  });

  // Fit: centre the bounding box, uniform scale to TARGET_SIZE
  const box = new THREE.Box3().setFromPoints(p);
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const k = TARGET_SIZE / Math.max(size.x, size.y, size.z);
  for (const v of p) v.sub(c).multiplyScalar(k);

  const pos = new Float32Array(faces.length * 9);
  faces.forEach(([a, b, cc], i) => {
    for (const [j, idx] of [a, b, cc].entries()) pos.set([p[idx].x, p[idx].y, p[idx].z], i * 9 + j * 3);
  });
  const indexedish = new THREE.BufferGeometry();
  indexedish.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const geo = toCreasedNormals(indexedish, THREE.MathUtils.degToRad(CREASE_DEG));
  const P = geo.attributes.position;
  const uv = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i += 3) {
    const t = [0, 1, 2].map((j) => sphericalUV(P.getX(i + j), P.getY(i + j), P.getZ(i + j)));
    const us = unwrapSeam(t.map((q) => q[0]));
    for (let j = 0; j < 3; j++) uv.set([us[j], t[j][1]], (i + j) * 2);
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setAttribute("fracture", new THREE.BufferAttribute(new Float32Array(P.count), 1));
  return geo;
}

/* ── Voronoi fracture of that same mesh ───────────────────────── */

interface V {
  p: [number, number, number];
  n: [number, number, number];
  uv: [number, number];
}
interface Tri {
  v: [V, V, V];
  fracture: boolean;
}

const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Exact keys: points that must match are bit-identical by construction,
// and rounding would merge distinct near-coincident cut points
const key = (p: number[]) => `${p[0]},${p[1]},${p[2]}`;
/** Exact lexicographic order, for canonical edge interpolation. */
const before = (a: number[], b: number[]) => (a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2]);

function soupFrom(geo: THREE.BufferGeometry): Tri[] {
  const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
  const out: Tri[] = [];
  const get = (i: number): V => ({
    p: [P.getX(i), P.getY(i), P.getZ(i)],
    n: [N.getX(i), N.getY(i), N.getZ(i)],
    uv: [U.getX(i), U.getY(i)],
  });
  for (let i = 0; i < P.count; i += 3) out.push({ v: [get(i), get(i + 1), get(i + 2)], fracture: false });
  return out;
}

/** Edge/plane crossing, computed in a canonical vertex order so the two
 * triangles sharing an edge produce bit-identical points. */
function cross(a: V, da: number, b: V, db: number): V {
  const swap = before(b.p, a.p);
  const [A, dA, B, dB] = swap ? [b, db, a, da] : [a, da, b, db];
  const t = dA / (dA - dB);
  const l = (x: number, y: number) => x + (y - x) * t;
  const n: [number, number, number] = [l(A.n[0], B.n[0]), l(A.n[1], B.n[1]), l(A.n[2], B.n[2])];
  const nl = Math.hypot(n[0], n[1], n[2]) || 1;
  return {
    p: [l(A.p[0], B.p[0]), l(A.p[1], B.p[1]), l(A.p[2], B.p[2])],
    n: [n[0] / nl, n[1] / nl, n[2] / nl],
    uv: [l(A.uv[0], B.uv[0]), l(A.uv[1], B.uv[1])],
  };
}

export interface FractureStats {
  capFailures: number;
  /** Loops not star-shaped around their centroid (earcut fallback). */
  nonStarCaps: number;
}

/**
 * Keep the part of the soup with dot(n, x) <= d, and cap the opening
 * with flat fracture faces facing +n.
 */
function clipAndCap(soup: Tri[], n: [number, number, number], d: number, stats: FractureStats): Tri[] {
  const out: Tri[] = [];
  const segs: [V, V][] = [];
  for (const tri of soup) {
    const ds = tri.v.map((v) => {
      const s = dot(v.p, n) - d;
      return Math.abs(s) < 1e-9 ? -1e-9 : s; // on-plane counts as inside
    });
    const inside = ds.map((s) => s < 0);
    const nIn = inside.filter(Boolean).length;
    if (nIn === 3) {
      out.push(tri);
      continue;
    }
    if (nIn === 0) continue;
    // Sutherland-Hodgman on one triangle: walk edges, keep inside verts
    // and crossings; exactly two crossings form the cut segment
    const poly: V[] = [];
    const cut: V[] = [];
    for (let i = 0; i < 3; i++) {
      const a = tri.v[i], b = tri.v[(i + 1) % 3];
      const da = ds[i], db = ds[(i + 1) % 3];
      if (da < 0) poly.push(a);
      if (da < 0 !== db < 0) {
        const x = cross(a, da, b, db);
        poly.push(x);
        cut.push(x);
      }
    }
    for (let i = 1; i + 1 < poly.length; i++) out.push({ v: [poly[0], poly[i], poly[i + 1]], fracture: tri.fracture });
    if (cut.length === 2) segs.push([cut[0], cut[1]]);
  }
  if (segs.length === 0) return out;

  // Chain cut segments into closed loops
  const adj = new Map<string, { v: V; next: string[] }>();
  for (const [a, b] of segs) {
    const ka = key(a.p), kb = key(b.p);
    if (ka === kb) continue;
    if (!adj.has(ka)) adj.set(ka, { v: a, next: [] });
    if (!adj.has(kb)) adj.set(kb, { v: b, next: [] });
    adj.get(ka)!.next.push(kb);
    adj.get(kb)!.next.push(ka);
  }
  const visited = new Set<string>();
  const loops: V[][] = [];
  for (const start of adj.keys()) {
    if (visited.has(start)) continue;
    const loop: V[] = [];
    let prev = "";
    let cur = start;
    let ok = true;
    while (!visited.has(cur)) {
      visited.add(cur);
      const node = adj.get(cur)!;
      if (node.next.length !== 2) ok = false;
      loop.push(node.v);
      const nxt = node.next.find((k) => k !== prev && !visited.has(k)) ?? node.next.find((k) => k !== prev);
      prev = cur;
      if (!nxt) break;
      cur = nxt;
    }
    if (!ok || loop.length < 3) {
      stats.capFailures++;
      continue;
    }
    loops.push(loop);
  }

  // Triangulate each loop in the plane; flat normal = +n (outward)
  const nv = new THREE.Vector3(...n);
  const u = new THREE.Vector3().crossVectors(Math.abs(nv.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), nv).normalize();
  const w = new THREE.Vector3().crossVectors(nv, u);
  const mk = (v: V): V => ({ p: v.p, n: [n[0], n[1], n[2]], uv: sphericalUV(v.p[0], v.p[1], v.p[2]) });
  for (const loop of loops) {
    const pts2 = loop.map((v) => new THREE.Vector2(dot(v.p, u.toArray()), dot(v.p, w.toArray())));
    // A cross-section of this near-convex chunk inside a convex Voronoi
    // cell is star-shaped around its centroid: fan from there, so every
    // loop point is used. That is watertight by construction (cuts along
    // an earlier cap leave long collinear runs, where earcut emits
    // slivers and T-junctions). The fan's spokes are invisible: every
    // triangle of a fracture face shares one flat normal. Earcut with
    // T-junction repair is only the fallback for a non-star loop.
    let faces = starFan(pts2, loop, n);
    if (!faces) {
      stats.nonStarCaps++;
      faces = splitTJunctions(THREE.ShapeUtils.triangulateShape(pts2, []), pts2, loop, n);
    }
    for (const face of faces) {
      const a = mk(face[0]);
      let b = mk(face[1]), c = mk(face[2]);
      const e1 = [b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]];
      const e2 = [c.p[0] - a.p[0], c.p[1] - a.p[1], c.p[2] - a.p[2]];
      const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (dot(fn, n) < 0) [b, c] = [c, b];
      const us = unwrapSeam([a.uv[0], b.uv[0], c.uv[0]]);
      out.push({
        v: [{ ...a, uv: [us[0], a.uv[1]] }, { ...b, uv: [us[1], b.uv[1]] }, { ...c, uv: [us[2], c.uv[1]] }],
        fracture: true,
      });
    }
  }
  return out;
}

/** Fan from the polygon's area centroid, or null if not star-shaped. */
function starFan(pts2: THREE.Vector2[], loop: V[], n: [number, number, number]): V[][] | null {
  let a2 = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts2.length; i++) {
    const p = pts2[i], q = pts2[(i + 1) % pts2.length];
    const c = p.x * q.y - q.x * p.y;
    a2 += c;
    cx += (p.x + q.x) * c;
    cy += (p.y + q.y) * c;
  }
  if (Math.abs(a2) < 1e-12) return null;
  cx /= 3 * a2;
  cy /= 3 * a2;
  const sign = Math.sign(a2);
  for (let i = 0; i < pts2.length; i++) {
    const p = pts2[i], q = pts2[(i + 1) % pts2.length];
    const c = (p.x - cx) * (q.y - cy) - (q.x - cx) * (p.y - cy);
    if (c * sign <= 0) return null;
  }
  // Centroid back in 3D: barycentric-free, as the area-weighted mean of the
  // loop's fan triangles from loop[0] (stays exactly on the plane)
  let wx = 0, wy = 0, wz = 0, wt = 0;
  const o = loop[0].p;
  for (let i = 1; i + 1 < loop.length; i++) {
    const b = loop[i].p, c = loop[i + 1].p;
    const e1 = [b[0] - o[0], b[1] - o[1], b[2] - o[2]], e2 = [c[0] - o[0], c[1] - o[1], c[2] - o[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const w = dot(cr, n);
    wx += ((o[0] + b[0] + c[0]) / 3) * w;
    wy += ((o[1] + b[1] + c[1]) / 3) * w;
    wz += ((o[2] + b[2] + c[2]) / 3) * w;
    wt += w;
  }
  if (Math.abs(wt) < 1e-12) return null;
  const centre: V = { p: [wx / wt, wy / wt, wz / wt], n, uv: [0, 0] };
  return loop.map((v, i) => [centre, v, loop[(i + 1) % loop.length]]);
}

/**
 * Turn earcut faces (indices into the loop) into vertex triples. Where a
 * cut runs along an earlier cap, the loop has long collinear runs: earcut
 * emits zero-area triangles there (dropped here) and faces whose edges
 * pass over loop points. Such a face becomes a fan around its centroid
 * over its full boundary, so every surface edge on the cut has a matching
 * cap edge (watertight).
 */
function splitTJunctions(faces: number[][], pts2: THREE.Vector2[], loop: V[], n: [number, number, number]): V[][] {
  const out: V[][] = [];
  const all = loop.map((_, i) => i);
  for (const f of faces) {
    const [A0, B0, C0] = [pts2[f[0]], pts2[f[1]], pts2[f[2]]];
    const area2 = (B0.x - A0.x) * (C0.y - A0.y) - (B0.y - A0.y) * (C0.x - A0.x);
    // Degenerate relative to its own size (an absolute threshold let
    // near-collinear slivers through, and their fans overlapped)
    const l2 = Math.max(B0.distanceToSquared(A0), C0.distanceToSquared(B0), A0.distanceToSquared(C0));
    if (Math.abs(area2) < 1e-7 * l2) continue; // collinear run
    const ring: number[] = [];
    let split = false;
    for (let e = 0; e < 3; e++) {
      const i0 = f[e], i1 = f[(e + 1) % 3];
      ring.push(i0);
      const A = pts2[i0], B = pts2[i1];
      const AB = B.clone().sub(A);
      const len2 = AB.lengthSq();
      const on = all
        .filter((k) => k !== i0 && k !== i1)
        .map((k) => {
          const AP = pts2[k].clone().sub(A);
          const t = AP.dot(AB) / len2;
          const off = Math.abs(AB.x * AP.y - AB.y * AP.x) / Math.sqrt(len2);
          return { k, t, off };
        })
        .filter((q) => q.t > 1e-9 && q.t < 1 - 1e-9 && q.off < 1e-7)
        .sort((x, y) => x.t - y.t);
      if (on.length) split = true;
      for (const q of on) ring.push(q.k);
    }
    if (!split) {
      out.push([loop[f[0]], loop[f[1]], loop[f[2]]]);
      continue;
    }
    const cx = (loop[f[0]].p[0] + loop[f[1]].p[0] + loop[f[2]].p[0]) / 3;
    const cy = (loop[f[0]].p[1] + loop[f[1]].p[1] + loop[f[2]].p[1]) / 3;
    const cz = (loop[f[0]].p[2] + loop[f[1]].p[2] + loop[f[2]].p[2]) / 3;
    const centre: V = { p: [cx, cy, cz], n, uv: [0, 0] };
    for (let r = 0; r < ring.length; r++) out.push([centre, loop[ring[r]], loop[ring[(r + 1) % ring.length]]]);
  }
  return out;
}

function geometryFrom(soup: Tri[]): THREE.BufferGeometry {
  const count = soup.length * 3;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2), fr = new Float32Array(count);
  soup.forEach((t, i) => {
    t.v.forEach((v, j) => {
      const k = i * 3 + j;
      pos.set(v.p, k * 3);
      nor.set(v.n, k * 3);
      uv.set(v.uv, k * 2);
      fr[k] = t.fracture ? 1 : 0;
    });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setAttribute("fracture", new THREE.BufferAttribute(fr, 1));
  return g;
}

/** Voronoi sites inside the chunk (seeded). */
export function voronoiSites(): THREE.Vector3[] {
  const rng = mulberry32(SEED + 5555);
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < SHARD_COUNT; i++) {
    const th = Math.acos(2 * rng() - 1);
    const ph = 2 * Math.PI * rng();
    const r = (0.12 + rng() * 0.5) * (TARGET_SIZE / 2);
    out.push(new THREE.Vector3(r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)));
  }
  return out;
}

export interface CrystalData {
  intact: THREE.BufferGeometry;
  /** Shards in the intact mesh's own coordinates (laid back together). */
  shards: THREE.BufferGeometry[];
  stats: FractureStats;
}

export function generateCrystal(): CrystalData {
  const intact = buildChunk();
  const base = soupFrom(intact);
  const sites = voronoiSites();
  const stats: FractureStats = { capFailures: 0, nonStarCaps: 0 };
  const shards: THREE.BufferGeometry[] = [];
  sites.forEach((si, i) => {
    let soup = base;
    sites.forEach((sj, j) => {
      if (i === j) return;
      const n = sj.clone().sub(si).normalize();
      const mid = si.clone().add(sj).multiplyScalar(0.5);
      soup = clipAndCap(soup, [n.x, n.y, n.z], n.dot(mid), stats);
    });
    if (soup.length) shards.push(geometryFrom(soup));
  });
  return { intact, shards, stats };
}

/* ── Compact binary: build script writes it, the client reads it ── */

const MAGIC = 0x43525953; // "CRYS"
const VERSION = 2;

/**
 * Indexed and quantised: per geometry u32 vertexCount, u32 triangleCount,
 * then int16 position (scaled by the header's posScale), int8 snorm
 * normal, u8 fracture flag, u16 uv (range 0..2, the seam unwraps past 1),
 * u16 indices; each block padded to 4 bytes. Quantisation is
 * deterministic, so a shard vertex and the intact vertex it came from
 * decode to the same values.
 */
export function encodeCrystal(geos: THREE.BufferGeometry[]): ArrayBuffer {
  let maxAbs = 0;
  for (const g of geos) for (const v of g.attributes.position.array as Float32Array) maxAbs = Math.max(maxAbs, Math.abs(v));
  const posScale = maxAbs / 32767;
  const pad4 = (n: number) => (n + 3) & ~3;
  const indexed = geos.map((g) => {
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, F = g.attributes.fracture;
    const map = new Map<string, number>();
    const verts: number[][] = [];
    const index: number[] = [];
    for (let i = 0; i < P.count; i++) {
      const q = [
        Math.round(P.getX(i) / posScale), Math.round(P.getY(i) / posScale), Math.round(P.getZ(i) / posScale),
        Math.round(N.getX(i) * 127), Math.round(N.getY(i) * 127), Math.round(N.getZ(i) * 127),
        Math.round(F.getX(i)),
        Math.round((U.getX(i) / 2) * 65535), Math.round((U.getY(i) / 2) * 65535),
      ];
      const k = q.join(",");
      let idx = map.get(k);
      if (idx === undefined) {
        idx = verts.length;
        verts.push(q);
        map.set(k, idx);
      }
      index.push(idx);
    }
    if (verts.length > 65535) throw new Error("too many vertices for u16 indices");
    return { verts, index };
  });
  let bytes = 16;
  for (const { verts, index } of indexed) {
    const n = verts.length;
    bytes += 8 + pad4(n * 6) + pad4(n * 3) + pad4(n) + pad4(n * 4) + pad4(index.length * 2);
  }
  const buf = new ArrayBuffer(bytes);
  const dv = new DataView(buf);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, VERSION, true);
  dv.setUint32(8, geos.length, true);
  dv.setFloat32(12, posScale, true);
  let o = 16;
  for (const { verts, index } of indexed) {
    const n = verts.length;
    dv.setUint32(o, n, true);
    dv.setUint32(o + 4, index.length / 3, true);
    o += 8;
    const pos = new Int16Array(buf, o, n * 3);
    o += pad4(n * 6);
    const nor = new Int8Array(buf, o, n * 3);
    o += pad4(n * 3);
    const fr = new Uint8Array(buf, o, n);
    o += pad4(n);
    const uv = new Uint16Array(buf, o, n * 2);
    o += pad4(n * 4);
    verts.forEach((q, i) => {
      pos.set(q.slice(0, 3), i * 3);
      nor.set(q.slice(3, 6), i * 3);
      fr[i] = q[6];
      uv.set(q.slice(7, 9), i * 2);
    });
    new Uint16Array(buf, o, index.length).set(index);
    o += pad4(index.length * 2);
  }
  return buf;
}

/** Decode to non-indexed float geometries (one per face, as the shard
 * volume and logo sizing code expects). */
export function decodeCrystal(buf: ArrayBuffer): THREE.BufferGeometry[] {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error("crystal-chunk.bin: bad magic");
  if (dv.getUint32(4, true) !== VERSION) throw new Error("crystal-chunk.bin: version mismatch, run npm run gen:crystal");
  const count = dv.getUint32(8, true);
  const posScale = dv.getFloat32(12, true);
  const pad4 = (n: number) => (n + 3) & ~3;
  let o = 16;
  const out: THREE.BufferGeometry[] = [];
  for (let gi = 0; gi < count; gi++) {
    const n = dv.getUint32(o, true);
    const t = dv.getUint32(o + 4, true);
    o += 8;
    const pos = new Int16Array(buf, o, n * 3);
    o += pad4(n * 6);
    const nor = new Int8Array(buf, o, n * 3);
    o += pad4(n * 3);
    const fr = new Uint8Array(buf, o, n);
    o += pad4(n);
    const uv = new Uint16Array(buf, o, n * 2);
    o += pad4(n * 4);
    const index = new Uint16Array(buf, o, t * 3);
    o += pad4(t * 6);
    const P = new Float32Array(t * 9), N = new Float32Array(t * 9), U = new Float32Array(t * 6), F = new Float32Array(t * 3);
    for (let k = 0; k < t * 3; k++) {
      const i = index[k];
      for (let c = 0; c < 3; c++) {
        P[k * 3 + c] = pos[i * 3 + c] * posScale;
        N[k * 3 + c] = nor[i * 3 + c] / 127;
      }
      U[k * 2] = (uv[i * 2] / 65535) * 2;
      U[k * 2 + 1] = (uv[i * 2 + 1] / 65535) * 2;
      F[k] = fr[i];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(P, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(N, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(U, 2));
    g.setAttribute("fracture", new THREE.BufferAttribute(F, 1));
    out.push(g);
  }
  return out;
}

/** Signed volume of a closed triangle soup. */
export function volumeOf(g: THREE.BufferGeometry): number {
  const P = g.attributes.position;
  let v = 0;
  for (let i = 0; i < P.count; i += 3) {
    const ax = P.getX(i), ay = P.getY(i), az = P.getZ(i);
    const bx = P.getX(i + 1), by = P.getY(i + 1), bz = P.getZ(i + 1);
    const cx = P.getX(i + 2), cy = P.getY(i + 2), cz = P.getZ(i + 2);
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return v;
}
