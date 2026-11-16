import type * as THREE from "three";

/**
 * Test hook (scripts/perf/jank.mjs): `window.__programs.<canvas>()` lists
 * every shader program a renderer has built, by three's cache key, so a
 * script can diff before and after a scenario and see exactly which
 * material variants were compiled late (a link stalls the main thread).
 * Strings only, read on demand; costs nothing per frame.
 */
export function exposePrograms(canvas: "page" | "archive", gl: THREE.WebGLRenderer): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __programs?: Record<string, () => { key: string; name: string; used: number }[]> };
  w.__programs ??= {};
  w.__programs[canvas] = () =>
    (gl.info.programs ?? []).map((p) => {
      const q = p as unknown as { cacheKey: string; name: string; usedTimes: number };
      return { key: q.cacheKey, name: q.name, used: q.usedTimes };
    });
}
