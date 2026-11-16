#!/usr/bin/env node
// Generates the crystal chunk and its Voronoi shards from one procedural
// source (src/components/crystal/crystalGen.ts) and writes the compact
// binary the client loads: public/models/crystal-chunk.bin.
//   npm run gen:crystal
// Retune via the constants at the top of crystalGen.ts, then rerun.
// The committed .bin is checked against the generator by the unit tests.
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  generateCrystal,
  encodeCrystal,
  decodeCrystal,
  volumeOf,
  SEED,
  FBM_AMP,
  PLANE_COUNT,
  PLANE_MIN,
  PLANE_MAX,
} from "../../src/components/crystal/crystalGen.ts";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "models", "crystal-chunk.bin");
const t0 = performance.now();
const { intact, shards, source, stats } = generateCrystal();
const ms = performance.now() - t0;

if (stats.nonStarCaps) console.warn(`note: ${stats.nonStarCaps} cap(s) used the earcut fallback`);
if (stats.capFailures) {
  console.error(`FAIL: ${stats.capFailures} fracture cap loop(s) did not close`);
  process.exit(1);
}
// Shards are cut from the coarse source mesh; the intact mesh adds relief
const vi = volumeOf(source);
const vs = shards.reduce((a, g) => a + volumeOf(g), 0);
if (Math.abs(vs - vi) / vi > 1e-6) {
  console.error(`FAIL: shards hold ${vs} of the source volume ${vi}`);
  process.exit(1);
}

const buf = encodeCrystal([intact, ...shards]);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(buf));

// Round trip: what the client decodes must still conserve volume
const back = decodeCrystal(buf);
const bvs = back.slice(1).reduce((a, g) => a + volumeOf(g), 0);
console.log(`seed ${SEED}, fbm amp ${FBM_AMP}, ${PLANE_COUNT} planes at ${PLANE_MIN}-${PLANE_MAX}`);
console.log(`generated in ${ms.toFixed(0)} ms: intact ${intact.attributes.position.count / 3} tris, ${shards.length} shards`);
console.log(`volume source ${vi.toFixed(6)}, shards ${vs.toFixed(6)}, intact (with relief) ${volumeOf(intact).toFixed(6)}; decoded shards ${bvs.toFixed(6)}`);
console.log(`wrote ${out} (${(buf.byteLength / 1024).toFixed(1)} KB)`);
