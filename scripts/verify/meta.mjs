#!/usr/bin/env node
/**
 * Every route has its own title and social card; the launch files exist.
 *
 *   node scripts/verify/meta.mjs [--url=http://localhost:3000]
 *
 * Against a production server (next build && next start). For each page
 * route: <title>, meta description, og:title, og:image, twitter:card and
 * the canonical link must be present, and titles, og:titles and og:images
 * unique across routes. Every og:image must answer 200 as a 1200x630 PNG.
 * Then: the icons (32/192/512 and apple-icon) answer as PNGs of their
 * size; sitemap.xml lists only routes that answer 200; robots.txt points
 * at the sitemap; the manifest parses and its icons answer; an unknown
 * path answers 404 with the site's not-found page.
 */
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const ROUTES = ["/", "/projects", "/project/pixel-plus", "/project/4c-iced-coffee", "/project/kinetic-archive", "/cv", "/journey"];

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "✓" : "✗"} ${msg}`);
  if (!ok) failures++;
};
const decode = (s) => s?.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');
const metaOf = (html, attr, key) =>
  decode(html.match(new RegExp(`<meta[^>]*${attr}="${key}"[^>]*content="([^"]*)"`))?.[1] ??
    html.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*${attr}="${key}"`))?.[1]);
// The real origin may differ from the test server: compare paths
const local = (u) => (u ? base + new URL(u, base).pathname + new URL(u, base).search : u);

/** PNG width/height from the IHDR chunk. */
async function png(url) {
  const r = await fetch(url);
  const buf = Buffer.from(await r.arrayBuffer());
  const isPng = buf.subarray(1, 4).toString() === "PNG";
  return { status: r.status, type: r.headers.get("content-type"), w: isPng ? buf.readUInt32BE(16) : 0, h: isPng ? buf.readUInt32BE(20) : 0 };
}

const rows = [];
for (const route of ROUTES) {
  const r = await fetch(base + route);
  const html = await r.text();
  const row = {
    route,
    status: r.status,
    title: decode(html.match(/<title>([^<]*)<\/title>/)?.[1]),
    description: metaOf(html, "name", "description"),
    ogTitle: metaOf(html, "property", "og:title"),
    ogImage: metaOf(html, "property", "og:image"),
    card: metaOf(html, "name", "twitter:card"),
    canonical: html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/)?.[1] ?? html.match(/<link[^>]*href="([^"]*)"[^>]*rel="canonical"/)?.[1],
    noindex: /<meta[^>]*name="robots"[^>]*noindex/.test(html),
  };
  rows.push(row);
  const missing = ["title", "description", "ogTitle", "ogImage", "card", "canonical"].filter((k) => !row[k]);
  check(r.status === 200 && missing.length === 0, `${route}: "${row.title}"${missing.length ? ` (missing ${missing.join(", ")})` : ""}${row.noindex ? " [noindex]" : ""}`);
  if (row.ogImage) {
    const p = await png(local(row.ogImage));
    check(p.status === 200 && p.w === 1200 && p.h === 630, `  card ${new URL(row.ogImage).pathname} ${p.status} ${p.type} ${p.w}x${p.h}`);
  }
}
for (const key of ["title", "ogTitle", "ogImage", "description"]) {
  const vals = rows.map((r) => r[key] && (key === "ogImage" ? new URL(r[key]).pathname : r[key]));
  const dupes = vals.filter((v, i) => v && vals.indexOf(v) !== i);
  check(dupes.length === 0, `${key} unique across ${rows.length} routes${dupes.length ? `: duplicate ${dupes[0]}` : ""}`);
}

for (const [path, w] of [["/icon/32", 32], ["/icon/192", 192], ["/icon/512", 512], ["/apple-icon", 180]]) {
  const p = await png(base + path);
  check(p.status === 200 && p.w === w && p.h === w, `${path}: ${p.status} ${p.w}x${p.h}`);
}
const home = await (await fetch(base + "/")).text();
check(/<link[^>]*rel="icon"[^>]*\/icon\/32/.test(home) || /\/icon\/32[^>]*rel="icon"/.test(home), "home links /icon/32 as its icon");
check(/rel="apple-touch-icon"/.test(home), "home links the apple-touch-icon");
check(!/favicon\.ico/.test(home), "no stale favicon.ico link");

const sm = await (await fetch(base + "/sitemap.xml")).text();
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
check(locs.length >= 5, `sitemap.xml lists ${locs.length} URLs`);
for (const u of locs) {
  const s = (await fetch(local(u), { redirect: "manual" })).status;
  check(s === 200, `  ${new URL(u).pathname} answers ${s}`);
}
const robots = await (await fetch(base + "/robots.txt")).text();
check(/Sitemap: .*\/sitemap\.xml/.test(robots) && /Allow: \//.test(robots), "robots.txt allows / and names the sitemap");
const man = await fetch(base + "/manifest.webmanifest");
const mj = man.status === 200 ? await man.json() : null;
check(!!mj?.name && mj.icons?.length >= 2, `manifest: "${mj?.name}", ${mj?.icons?.length ?? 0} icons`);
for (const ic of mj?.icons ?? []) {
  const p = await png(base + ic.src);
  check(p.status === 200 && `${p.w}x${p.h}` === ic.sizes, `  manifest icon ${ic.src} ${ic.sizes}: ${p.w}x${p.h}`);
}
const nf = await fetch(base + "/no-such-page-" + Date.now());
const nfHtml = await nf.text();
check(nf.status === 404 && /drifted/.test(nfHtml), `unknown path: ${nf.status}, site not-found page ${/drifted/.test(nfHtml) ? "shown" : "MISSING"}`);

console.log(failures ? `\nFAIL: ${failures}` : "\nPASS");
process.exit(failures ? 1 : 0);
