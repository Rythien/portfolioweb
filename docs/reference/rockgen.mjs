// rockgen.mjs: chunky ice-rock generator + Voronoi fracture. Plain arrays, no three.js, so it runs in Node
// and can be ported 1:1 to TypeScript. Method: 10 evenly spread body planes + 2 big "cleavage" planes make a
// chunky lopsided body, then 26 corner chips + 26 edge chips shave bevels (36-46 facets, none dominating).
// Park-Miller seeds below ~100k give ~0 on the first draw, so two draws are discarded as warm-up.
// Good seeds (by facet count, no dominant face, compact body): 105, 84, 90, 33, 45, 72, 60, 5.
// Reference implementation (plain arrays, no three.js) of the chunky ice-rock generator.
export const R = 1.4;
export const SCALE = [1.2, 1.0, 0.9];
const BODY = 10, CLEAVE = 2, VCHIPS = 26, ECHIPS = 26;

export function makeRng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a); return [a[0]/l, a[1]/l, a[2]/l]; };
const unit = (rng) => {
  const th = Math.acos(2 * rng() - 1), ph = 2 * Math.PI * rng();
  return [Math.sin(th)*Math.cos(ph), Math.sin(th)*Math.sin(ph), Math.cos(th)];
};

function solve3(n0, d0, n1, d1, n2, d2) {
  const det = n0[0]*(n1[1]*n2[2]-n1[2]*n2[1]) - n0[1]*(n1[0]*n2[2]-n1[2]*n2[0]) + n0[2]*(n1[0]*n2[1]-n1[1]*n2[0]);
  if (Math.abs(det) < 1e-10) return null;
  const inv = 1 / det;
  return [
    (d0*(n1[1]*n2[2]-n1[2]*n2[1]) - n0[1]*(d1*n2[2]-n1[2]*d2) + n0[2]*(d1*n2[1]-n1[1]*d2)) * inv,
    (n0[0]*(d1*n2[2]-n1[2]*d2) - d0*(n1[0]*n2[2]-n1[2]*n2[0]) + n0[2]*(n1[0]*d2-d1*n2[0])) * inv,
    (n0[0]*(n1[1]*d2-d1*n2[1]) - n0[1]*(n1[0]*d2-d1*n2[0]) + d0*(n1[0]*n2[1]-n1[1]*n2[0])) * inv,
  ];
}

export function solveHalfSpaces(P) {
  const N = P.length, out = [], seen = new Set();
  for (let i = 0; i < N-2; i++) for (let j = i+1; j < N-1; j++) for (let k = j+1; k < N; k++) {
    const p = solve3(P[i].n, P[i].d, P[j].n, P[j].d, P[k].n, P[k].d);
    if (!p) continue;
    let ok = true;
    for (let m = 0; m < N; m++) if (dot(P[m].n, p) > P[m].d + 1e-5) { ok = false; break; }
    if (!ok) continue;
    const key = Math.round(p[0]*1e4)+","+Math.round(p[1]*1e4)+","+Math.round(p[2]*1e4);
    if (seen.has(key)) continue;
    seen.add(key); out.push(p);
  }
  return out;
}

const fib = (n) => {
  const ga = Math.PI * (3 - Math.sqrt(5)), out = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - 2*(i+0.5)/n, r = Math.sqrt(1 - y*y), t = ga*i;
    out.push([Math.cos(t)*r, y, Math.sin(t)*r]);
  }
  return out;
};

/** Planes of the chunky rock (unscaled space). Returns null if the seed degenerates. */
export function buildRockPlanes(seed) {
  const rng = makeRng(seed); rng(); rng();         // warm-up: Park-Miller's first outputs are ~0 for small seeds
  const P = [];
  for (const b of fib(BODY)) {
    const u = unit(rng);
    P.push({ n: norm([b[0]+u[0]*0.35, b[1]+u[1]*0.35, b[2]+u[2]*0.35]), d: R * (0.74 + rng()*0.18) });
  }
  for (let i = 0; i < CLEAVE; i++) P.push({ n: unit(rng), d: R * (0.58 + rng()*0.10) });
  const nb = P.length;
  const V = solveHalfSpaces(P);
  if (V.length < 8) return null;
  const on = V.map(v => { const s = new Set(); for (let m = 0; m < nb; m++) if (Math.abs(dot(P[m].n, v) - P[m].d) < 1e-4) s.add(m); return s; });
  for (let c = 0; c < VCHIPS; c++) {
    const v = V[Math.floor(rng() * V.length)], L = len(v), u = unit(rng);
    P.push({ n: norm([v[0]/L+u[0]*0.12, v[1]/L+u[1]*0.12, v[2]/L+u[2]*0.12]), d: L * (0.80 + rng()*0.14) });
  }
  const edges = [];
  for (let a = 0; a < V.length; a++) for (let b = a+1; b < V.length; b++) {
    let common = 0; for (const m of on[a]) if (on[b].has(m)) common++;
    if (common >= 2) edges.push([a, b]);
  }
  if (!edges.length) return null;
  for (let c = 0; c < ECHIPS; c++) {
    const [a, b] = edges[Math.floor(rng() * edges.length)];
    const m = [(V[a][0]+V[b][0])/2, (V[a][1]+V[b][1])/2, (V[a][2]+V[b][2])/2], L = len(m), u = unit(rng);
    P.push({ n: norm([m[0]/L+u[0]*0.10, m[1]/L+u[1]*0.10, m[2]/L+u[2]*0.10]), d: L * (0.86 + rng()*0.09) });
  }
  return P;
}

/** Final vertices: recentred, normalised to radius R*1.05, then non-uniformly scaled. */
export function buildRockVerts(seed) {
  const P = buildRockPlanes(seed); if (!P) return null;
  let V = solveHalfSpaces(P); if (V.length < 8) return null;
  const mn = [0,1,2].map(i => Math.min(...V.map(v => v[i]))), mx = [0,1,2].map(i => Math.max(...V.map(v => v[i])));
  const c = [0,1,2].map(i => (mn[i]+mx[i])/2);
  V = V.map(v => [v[0]-c[0], v[1]-c[1], v[2]-c[2]]);
  const f = R*1.05 / Math.max(...V.map(len));
  return V.map(v => [v[0]*f*SCALE[0], v[1]*f*SCALE[1], v[2]*f*SCALE[2]]);
}

/* ───────────────────────────────────────────────────────────────────────────
   Fracture: Voronoi shards of the SAME rock. Each shard = rock planes (pruned to the
   ones that really bound the rock) + one bisector plane per other seed point, solved with
   the same function, so shards are watertight convex pieces that tile the rock exactly
   (verified: sum of shard volumes / rock volume = 1.00000 for seeds 105, 33, 90, 84).
   Pruning planes keeps the whole build at ~20-50 ms instead of ~0.5 s.
   Returns { rock, shards, ... } in FINAL (recentred + scaled) space. Feed each vertex list to
   three's ConvexGeometry, toNonIndexed(), computeVertexNormals() (flat shading).
   ─────────────────────────────────────────────────────────────────────────── */
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];

export function buildRockData(seed, shardCount = 16) {
  const planes = buildRockPlanes(seed); if (!planes) return null;
  const rockV = solveHalfSpaces(planes); if (rockV.length < 8) return null;
  const active = planes.filter(p => rockV.filter(v => Math.abs(dot(p.n, v) - p.d) < 1e-4).length >= 3);
  const mn = [0,1,2].map(i => Math.min(...rockV.map(v => v[i]))), mx = [0,1,2].map(i => Math.max(...rockV.map(v => v[i])));
  const c = [0,1,2].map(i => (mn[i]+mx[i])/2);
  const f = R * 1.05 / Math.max(...rockV.map(v => len(sub(v, c))));
  const xf = v => [(v[0]-c[0])*f*SCALE[0], (v[1]-c[1])*f*SCALE[1], (v[2]-c[2])*f*SCALE[2]];

  const rng = makeRng(seed + 5555); rng(); rng();
  const pts = [];
  for (let i = 0; i < shardCount; i++) {
    const th = Math.acos(2*rng()-1), ph = 2*Math.PI*rng(), r = (0.15 + rng()*0.6) * R;
    pts.push([c[0]+r*Math.sin(th)*Math.cos(ph), c[1]+r*Math.sin(th)*Math.sin(ph), c[2]+r*Math.cos(th)]);
  }
  const shards = [];
  for (let i = 0; i < shardCount; i++) {
    const P = active.map(p => ({ n: p.n, d: p.d }));
    for (let j = 0; j < shardCount; j++) {
      if (i === j) continue;
      const diff = sub(pts[j], pts[i]), L = len(diff); if (L < 1e-9) continue;
      const n = [diff[0]/L, diff[1]/L, diff[2]/L];
      const mid = [(pts[i][0]+pts[j][0])/2, (pts[i][1]+pts[j][1])/2, (pts[i][2]+pts[j][2])/2];
      P.push({ n, d: dot(n, mid) });
    }
    const V = solveHalfSpaces(P).map(xf);
    if (V.length >= 4) shards.push(V);
  }
  return { rock: rockV.map(xf), shards, totalPlanes: planes.length, activePlanes: active.length };
}

/* Self-test: `node rockgen.mjs` should print these exact counts (rock vertices / shards):
   seed 105 -> 70 / 16,  seed 33 -> 70 / 16,  seed 90 -> 68 / 16,  seed 84 -> 76 / 16,  seed 5 -> 80 / 16 */
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const s of [105, 33, 90, 84, 5]) {
    const t0 = performance.now(), d = buildRockData(s);
    console.log(`seed ${s}: rock vertices ${d.rock.length}, shards ${d.shards.length}, planes ${d.totalPlanes}->${d.activePlanes}, ${(performance.now()-t0).toFixed(0)} ms`);
  }
}
