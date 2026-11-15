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

/* ── Radial glow texture ─────────────────────────────────────── */

export function createGlowTexture(size = 128): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // Pale blue-white ground glow under the crystal. It was warm white, and
  // the lower half of the ice (which refracts it) went grey against the
  // cool upper half
  g.addColorStop(0, "rgba(226,238,255,0.38)");
  g.addColorStop(0.25, "rgba(214,230,252,0.19)");
  g.addColorStop(0.6, "rgba(204,222,248,0.05)");
  g.addColorStop(1, "rgba(196,216,246,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
