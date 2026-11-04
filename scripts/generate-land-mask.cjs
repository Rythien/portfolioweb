const fs = require("fs");
const topojson = require("topojson-client");
const d3 = require("d3-geo");
const world = require("world-atlas/land-110m.json");

const land = topojson.feature(world, world.objects.land);

const W = 360;
const H = 180;
const totalBits = W * H;
const bytes = new Uint8Array(Math.ceil(totalBits / 8));

console.log("Sampling 360x180 world grid with d3-geo...");
for (let y = 0; y < H; y++) {
  const lat = 90 - (y + 0.5);
  for (let x = 0; x < W; x++) {
    const lon = -180 + (x + 0.5);
    if (d3.geoContains(land, [lon, lat])) {
      const bitIdx = y * W + x;
      bytes[bitIdx >> 3] |= 1 << (7 - (bitIdx & 7));
    }
  }
}

const b64 = Buffer.from(bytes).toString("base64");
console.log("Base64 string size:", b64.length, "bytes");

const code = `// Auto-generated 360x180 1-bit land mask from world-atlas (land-110m)
export const LAND_WIDTH = ${W};
export const LAND_HEIGHT = ${H};
export const LAND_MASK_B64 = "${b64}";

let maskCache: Uint8Array | null = null;

export function isLand(lat: number, lon: number): boolean {
  if (!maskCache) {
    if (typeof atob === "function") {
      const binStr = atob(LAND_MASK_B64);
      maskCache = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        maskCache[i] = binStr.charCodeAt(i);
      }
    } else {
      maskCache = Uint8Array.from(Buffer.from(LAND_MASK_B64, "base64"));
    }
  }
  let x = Math.floor(lon + 180) % LAND_WIDTH;
  if (x < 0) x += LAND_WIDTH;
  let y = Math.floor(90 - lat);
  if (y < 0) y = 0;
  if (y >= LAND_HEIGHT) y = LAND_HEIGHT - 1;

  const bitIdx = y * LAND_WIDTH + x;
  return ((maskCache[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) === 1;
}
`;

fs.writeFileSync("src/content/landMask.ts", code);
console.log(
  "Created src/content/landMask.ts successfully. File size:",
  fs.statSync("src/content/landMask.ts").size,
  "bytes"
);
