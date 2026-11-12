import * as THREE from "three";

/* ── 3D value noise ──────────────────────────────────────────────── */

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hash(x: number, y: number, z: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return h - Math.floor(h);
}

export function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  return mix(
    mix(
      mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), ux),
      mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), ux),
      uy,
    ),
    mix(
      mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), ux),
      mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), ux),
      uy,
    ),
    uz,
  );
}

export function fbm3(x: number, y: number, z: number, octaves = 4): number {
  let v = 0, a = 0.5, s = 1;
  for (let i = 0; i < octaves; i++) {
    v += a * noise3(x * s, y * s, z * s);
    s *= 2.03;
    a *= 0.5;
  }
  return v;
}

/* ── Subdivide non-indexed geometry (midpoint, 1 tri → 4) ─────── */

export function subdivideNonIndexed(geo: THREE.BufferGeometry, levels = 1): THREE.BufferGeometry {
  let arr = Array.from(geo.attributes.position.array as Float32Array);

  for (let l = 0; l < levels; l++) {
    const next: number[] = [];
    const n = arr.length / 9;
    for (let t = 0; t < n; t++) {
      const b = t * 9;
      const ax = arr[b], ay = arr[b + 1], az = arr[b + 2];
      const bx = arr[b + 3], by = arr[b + 4], bz = arr[b + 5];
      const cx = arr[b + 6], cy = arr[b + 7], cz = arr[b + 8];
      const abx = (ax + bx) * .5, aby = (ay + by) * .5, abz = (az + bz) * .5;
      const bcx = (bx + cx) * .5, bcy = (by + cy) * .5, bcz = (bz + cz) * .5;
      const cax = (cx + ax) * .5, cay = (cy + ay) * .5, caz = (cz + az) * .5;
      next.push(ax, ay, az, abx, aby, abz, cax, cay, caz);
      next.push(abx, aby, abz, bx, by, bz, bcx, bcy, bcz);
      next.push(cax, cay, caz, bcx, bcy, bcz, cx, cy, cz);
      next.push(abx, aby, abz, bcx, bcy, bcz, cax, cay, caz);
    }
    arr = next;
  }

  const result = new THREE.BufferGeometry();
  result.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
  result.computeVertexNormals();
  return result;
}

/* ── Displace vertices along normals with FBM ────────────────── */

export function displaceAlongNormals(
  geo: THREE.BufferGeometry,
  strength: number,
  frequency: number,
  seed = 0,
): void {
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = norm.getX(i), ny = norm.getY(i), nz = norm.getZ(i);
    const d = (fbm3(x * frequency + seed, y * frequency + seed * .7, z * frequency + seed * 1.3, 4) - 0.5) * 2 * strength;
    pos.setXYZ(i, x + nx * d, y + ny * d, z + nz * d);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/* ── Spherical UV projection ─────────────────────────────────── */

export function generateSphericalUVs(geo: THREE.BufferGeometry): void {
  const pos = geo.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    uvs[i * 2] = 0.5 + Math.atan2(z, x) / (2 * Math.PI);
    const r = Math.sqrt(x * x + y * y + z * z);
    uvs[i * 2 + 1] = r > 1e-4 ? 0.5 + Math.asin(Math.max(-1, Math.min(1, y / r))) / Math.PI : 0.5;
  }
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
}

/* ── Frost normal map (DataTexture) ──────────────────────────── */

export function createFrostNormalMap(size = 256): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const scale = 8;
  const eps = 0.5 / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const h = fbm3(u * scale, v * scale, 0.42, 5);
      const hx = fbm3((u + eps) * scale, v * scale, 0.42, 5);
      const hy = fbm3(u * scale, (v + eps) * scale, 0.42, 5);
      const dx = -(hx - h) / eps * 0.15;
      const dy = -(hy - h) / eps * 0.15;
      const nz = 1;
      const len = Math.sqrt(dx * dx + dy * dy + nz * nz);
      const idx = (y * size + x) * 4;
      data[idx] = ((dx / len) * 0.5 + 0.5) * 255;
      data[idx + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      data[idx + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size);
  tex.format = THREE.RGBAFormat;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/* ── Radial glow texture ─────────────────────────────────────── */

export function createGlowTexture(size = 128): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(200,225,255,0.35)");
  g.addColorStop(0.25, "rgba(185,215,255,0.18)");
  g.addColorStop(0.6, "rgba(165,205,255,0.05)");
  g.addColorStop(1, "rgba(140,190,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
