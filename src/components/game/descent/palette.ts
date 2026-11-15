/** DESCENT colours. One violet family, plus a single danger red. */
export const PALETTE = {
  bgTop: "#07062B",
  bgBottom: "#1a1050",
  /** The gradient darkens towards this as depth increases. */
  bgDeep: "#020110",
  ice: "#cfe3ea",
  iceShade: "#7f9fb0",
  highlight: "#e4dcff",
  glow: "#8f7bff",
  danger: "#ff5c7a",
  gem: "#ffffff",
  gemCore: "#8f7bff",
  gemShade: "#b9adff",
  hud: "#e4dcff",
  hudDim: "#8a80c8",
  vignette: "#030214",
} as const;

/** Per-band tint mixed over the background (index = band). */
export const BAND_TINTS = ["#1a1050", "#10204a", "#160a3a", "#0a0620", "#1a0726", "#05030f"] as const;

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
