// The intact crystal and its shards are one object. Run: npm run test:crystal
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as THREE from "three";
import { generateCrystal, encodeCrystal, decodeCrystal, volumeOf, SHARD_COUNT } from "./crystalGen.ts";

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "public", "models", "crystal-chunk.bin");
const file = readFileSync(BIN);
const decoded = decodeCrystal(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
const [intact, ...shards] = decoded;

type Tri = { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; n: THREE.Vector3[]; fracture: boolean };
function tris(g: THREE.BufferGeometry): Tri[] {
  const P = g.attributes.position, N = g.attributes.normal, F = g.attributes.fracture;
  const v = (i: number) => new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i));
  const n = (i: number) => new THREE.Vector3(N.getX(i), N.getY(i), N.getZ(i));
  const out: Tri[] = [];
  for (let i = 0; i < P.count; i += 3) out.push({ a: v(i), b: v(i + 1), c: v(i + 2), n: [n(i), n(i + 1), n(i + 2)], fracture: F.getX(i) > 0.5 });
  return out;
}
const area = (t: Tri) => new THREE.Vector3().crossVectors(t.b.clone().sub(t.a), t.c.clone().sub(t.a)).length() / 2;

test("the committed crystal-chunk.bin is exactly what the generator produces", () => {
  const { intact: gi, shards: gs } = generateCrystal();
  const fresh = Buffer.from(encodeCrystal([gi, ...gs]));
  assert.ok(fresh.equals(file), "stale: run npm run gen:crystal");
});

test("shards are closed solids that together hold the intact volume", () => {
  assert.equal(shards.length, SHARD_COUNT);
  const vi = volumeOf(intact);
  const vs = shards.reduce((a, g) => a + volumeOf(g), 0);
  assert.ok(Math.abs(vs - vi) / vi < 1e-5, `volume ${vs} vs ${vi}`);
  for (const [i, g] of shards.entries()) {
    assert.ok(volumeOf(g) > 0, `shard ${i} inside out`);
    // Watertight: every directed edge is matched by its reverse
    const P = g.attributes.position;
    const k = (j: number) => `${P.getX(j).toFixed(5)},${P.getY(j).toFixed(5)},${P.getZ(j).toFixed(5)}`;
    const edges = new Map<string, number>();
    for (let t = 0; t < P.count; t += 3) {
      for (let e = 0; e < 3; e++) {
        const a = k(t + e), b = k(t + ((e + 1) % 3));
        if (a === b) continue;
        edges.set(`${a}>${b}`, (edges.get(`${a}>${b}`) ?? 0) + 1);
      }
    }
    let open = 0;
    for (const [e, c] of edges) {
      const [a, b] = e.split(">");
      if ((edges.get(`${b}>${a}`) ?? 0) !== c) open++;
    }
    assert.equal(open, 0, `shard ${i}: ${open} unmatched edges`);
  }
});

test("every shard's outer surface is a piece of the intact surface, same normals", () => {
  const I = tris(intact);
  const outer = shards.flatMap((g) => tris(g).filter((t) => !t.fracture));
  const bary = new THREE.Vector3();
  const tri = new THREE.Triangle();
  let worstDist = 0, worstNormal = 0;
  for (const t of outer) {
    if (area(t) < 1e-9) continue;
    const c = t.a.clone().add(t.b).add(t.c).divideScalar(3);
    let best: Tri | null = null, bestD = Infinity;
    for (const it of I) {
      tri.set(it.a, it.b, it.c);
      const d = tri.closestPointToPoint(c, new THREE.Vector3()).distanceTo(c);
      if (d < bestD) { bestD = d; best = it; }
    }
    worstDist = Math.max(worstDist, bestD);
    // The shard's normal at its centroid equals the intact normal there
    tri.set(best!.a, best!.b, best!.c);
    tri.getBarycoord(c, bary);
    const ni = best!.n[0].clone().multiplyScalar(bary.x).add(best!.n[1].clone().multiplyScalar(bary.y)).add(best!.n[2].clone().multiplyScalar(bary.z)).normalize();
    const ns = t.n[0].clone().add(t.n[1]).add(t.n[2]).normalize();
    worstNormal = Math.max(worstNormal, ni.angleTo(ns));
  }
  assert.ok(worstDist < 2e-4, `outer surface strays ${worstDist} from the intact mesh`);
  assert.ok(THREE.MathUtils.radToDeg(worstNormal) < 2, `normals differ by ${THREE.MathUtils.radToDeg(worstNormal).toFixed(2)} deg`);
  const ai = I.reduce((s, t) => s + area(t), 0);
  const ao = outer.reduce((s, t) => s + area(t), 0);
  assert.ok(Math.abs(ao - ai) / ai < 1e-4, `outer area ${ao} vs intact ${ai}`);
});

test("fracture faces are new and flat (one normal per face)", () => {
  let faces = 0, checked = 0;
  for (const g of shards) {
    for (const t of tris(g).filter((x) => x.fracture)) {
      faces++;
      // Flat: all three vertex normals agree (int8 normal precision)
      assert.ok(t.n[0].angleTo(t.n[1]) < 0.02 && t.n[0].angleTo(t.n[2]) < 0.02, "fracture face normals differ");
      // ...and match the face, where the face is well-shaped enough for
      // int16 positions to define it (slivers' geometric normal is noise)
      const longest = Math.max(t.a.distanceTo(t.b), t.b.distanceTo(t.c), t.c.distanceTo(t.a));
      // (int16 positions move a vertex up to ~4e-5: below 5e-3 altitude
      // that alone tilts the geometric normal past the tolerance)
      if ((2 * area(t)) / longest < 5e-3) continue;
      const fn = new THREE.Vector3().crossVectors(t.b.clone().sub(t.a), t.c.clone().sub(t.a)).normalize();
      assert.ok(t.n[0].angleTo(fn) < 0.03, "fracture normal does not match its face");
      checked++;
    }
  }
  assert.ok(faces > 0 && checked > faces / 4, `${checked} of ${faces} checked`);
});

/** Orthographic silhouette mask from direction `dir` (inclusive edges). */
export function silhouette(geos: THREE.BufferGeometry[], dir: THREE.Vector3, px = 256, half = 1.4): Uint8Array {
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), dir.clone().negate(), Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
  const inv = m.clone().invert();
  const mask = new Uint8Array(px * px);
  const to2 = (v: THREE.Vector3) => {
    const q = v.clone().applyMatrix4(inv);
    return [((q.x / half) * 0.5 + 0.5) * px, ((q.y / half) * 0.5 + 0.5) * px];
  };
  for (const g of geos) {
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map((j) => to2(new THREE.Vector3(P.getX(i + j), P.getY(i + j), P.getZ(i + j))));
      const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(den) < 1e-12) continue;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(px - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(px - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const sx = x + 0.5, sy = y + 0.5;
          const w0 = ((b[1] - c[1]) * (sx - c[0]) + (c[0] - b[0]) * (sy - c[1])) / den;
          const w1 = ((c[1] - a[1]) * (sx - c[0]) + (a[0] - c[0]) * (sy - c[1])) / den;
          if (w0 >= -1e-9 && w1 >= -1e-9 && 1 - w0 - w1 >= -1e-9) mask[y * px + x] = 1;
        }
      }
    }
  }
  return mask;
}

test("the shards laid back together reconstruct the intact silhouette exactly", () => {
  const dirs = [
    [0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
    [1, 1, 1], [-1, 1, 1], [1, -1, 1], [1, 1, -1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1], [-1, -1, -1],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
  for (const d of dirs) {
    const a = silhouette([intact], d);
    const b = silhouette(shards, d);
    let diff = 0, cover = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diff++;
      cover += a[i];
    }
    assert.ok(cover > 5000, "empty silhouette");
    assert.equal(diff, 0, `view ${d.toArray().map((v) => v.toFixed(2))}: ${diff} of ${cover} pixels differ`);
  }
});
