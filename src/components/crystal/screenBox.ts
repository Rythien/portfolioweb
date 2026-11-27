import * as THREE from "three";

/**
 * Test hook: the hero crystal's on-screen bounding box in CSS px, from its
 * real geometry (every vertex of every visible glass mesh projected through
 * the portal camera), not from the pose maths that places it. The layout
 * test (scripts/verify/crystal-clear.mjs) compares it with the page text.
 *
 * GlassCrystal registers its meshes each frame; window.__crystalBox() reads
 * them on demand, so nothing is projected unless a script asks.
 */
interface Probe {
  meshes: (THREE.Mesh | null)[];
  camera: THREE.Camera;
  width: number;
  height: number;
  fade: number;
}

let probe: Probe | null = null;
const _v = new THREE.Vector3();

export function setCrystalProbe(p: Probe | null) {
  probe = p;
}

export interface CrystalBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  fade: number;
}

function crystalBox(): CrystalBox | null {
  if (!probe || probe.fade < 0.01) return null;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const mesh of probe.meshes) {
    if (!mesh || !mesh.visible) continue;
    const mat = mesh.material as THREE.Material;
    if (mat && "opacity" in mat && (mat as THREE.MeshPhysicalMaterial).opacity < 0.01) continue;
    mesh.updateWorldMatrix(true, false);
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(probe.camera);
      const x = ((_v.x + 1) / 2) * probe.width;
      const y = ((1 - _v.y) / 2) * probe.height;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (!Number.isFinite(left)) return null;
  return { left, top, right, bottom, fade: probe.fade };
}

/**
 * Test hook (scripts/verify/shard-clamp.mjs): the top edge, in CSS px, of
 * every broken shard drawn this frame (meshes after the intact crystal).
 */
function shardTops(): number[] {
  if (!probe || probe.fade < 0.01) return [];
  const tops: number[] = [];
  for (const mesh of probe.meshes.slice(1)) {
    if (!mesh || !mesh.visible) continue;
    const mat = mesh.material as THREE.MeshPhysicalMaterial;
    if (mat && "opacity" in mat && mat.opacity < 0.01) continue;
    mesh.updateWorldMatrix(true, false);
    const pos = mesh.geometry.getAttribute("position");
    let top = Infinity;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(probe.camera);
      top = Math.min(top, ((1 - _v.y) / 2) * probe.height);
    }
    tops.push(top);
  }
  return tops;
}

if (typeof window !== "undefined") {
  (window as unknown as { __crystalBox: typeof crystalBox }).__crystalBox = crystalBox;
  (window as unknown as { __shardTops: typeof shardTops }).__shardTops = shardTops;
}
