/**
 * Test hook (?warmdebug=1): time a synchronous build step and record it in
 * window.__costs, so scripts/perf/slow.mjs can name main-thread blocks.
 * Without the flag it is a plain call.
 */
const ON = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("warmdebug") === "1";

export function timed<T>(label: string, fn: () => T): T {
  if (!ON) return fn();
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    const w = window as unknown as { __costs?: [string, number, number][] };
    (w.__costs ??= []).push([label, Math.round(t0), Math.round(performance.now() - t0)]);
  }
}
