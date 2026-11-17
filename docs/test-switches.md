# Test-only URL switches

Query parameters the Playwright scripts in `scripts/` use to put the site
into a known state. The UI never sets them; a visitor who types one in only
changes their own view.

## Page

| Switch | Read in | Effect | Used by |
| --- | --- | --- | --- |
| `nopreload=1` | `common/Preloader.tsx` | Skips the preloader. | almost every script |
| `mode=wake\|dream` | `store/useThemeStore.ts` | Starts in that mode. In DREAM the Archive opens at once. | most scripts |
| `noarchive=1` | `archive/ArchiveSlot.tsx` | Keeps the DREAM page visible instead of opening the Archive (DREAM hero and finish shots, logo tests). | `shot/crystal`, `shot/hero-logos`, `verify/logo-contrast`, `verify/glass-tone`, `verify/freeing`, `verify/ending`, `perf/*` |

## Hero crystal

| Switch | Read in | Effect | Used by |
| --- | --- | --- | --- |
| `crystalfreeze=<s>` | `crystal/GlassCrystal.tsx`, `scene/Marquee.tsx` | Pins the crystal's rotation, the logo cycle and the marquee at time `s`, and stills the glass shimmer, so two loads of the same pose match pixel for pixel. | `shot/crystal`, `verify/logo-contrast`, `verify/glass-tone` |
| `crystalview=assembled` | `crystal/GlassCrystal.tsx` | Shows the shards laid back together in place of the intact mesh. | `shot/crystal` |
| `crystallogo=0` | `crystal/GlassCrystal.tsx` | Hides the hero logo, to sample the bare glass. | `verify/glass-tone` |
| `crystallogo=matte` | `crystal/GlassCrystal.tsx` | Paints the logo and its contour flat magenta, so a test can find the logo's exact refracted silhouette. | `verify/logo-contrast` |

## Archive

| Switch | Read in | Effect | Used by |
| --- | --- | --- | --- |
| `archiveat=<i>` | `archive/ArchiveScene.tsx` | Parks the camera in front of seal `i`. | `shot/archive`, `perf/*` |
| `archiveaim=<i>` | `archive/ArchiveScene.tsx` | Parks the camera facing seal `i`'s lit facet. | `verify/freeing` |
| `archivecharge=<n>` | `archive/Play.tsx` | Starts with `n` charges (3 = pulse ready). | `verify/freeing` |
| `archivefreeze=1` | `archive/Seal.tsx` | Stops the seals and their orbiting shards moving. | `verify/freeing` |

The Archive also exposes `window` hooks for scripts: `__archiveAim(i)`,
`__archiveRecharge()`, `__archiveHits`, `__archiveFrames`, `__archiveInfo()`
(draw calls, triangles and programs per frame), `__archiveFlight`, and
`__archiveWarmMs` / `__archiveWarmBlockMs`.

## Stutter tooling

`scripts/perf/jank.mjs` (against `next build && next start -p 3100`)
measures rAF frame times over 20 s per scenario and reports p50 / p95 / p99
and frames over 32 ms. `--long` lists each long frame with its context,
`--gl` times the WebGL calls that can block (program links, uploads), and
`--programs` lists every shader program built during the window, with the
cache-key fields that differ from its nearest existing sibling.

Hooks it reads:

- `window.__programs.page()` / `.archive()` (`scene/programHook.ts`): every
  program each renderer has built, by three's cache key.
- `window.__archiveWarmLog` (`archive/Archive.tsx`): per warm-up step, the
  drawable, its compile time and how long its links took.
- `window.__archiveWarmMs`: set once the Archive warm-up has built (and,
  outside a transition, linked) every program. Scripts that play the
  Archive wait for it: until then a queued link can stall a frame between
  two actions.

## Shader warm-up and slow renderers

`src/components/scene/warm.ts` keeps shader compiles off the critical path
(see the comment at its top). Switches:

| Switch | Effect |
| --- | --- |
| `gfx=full\|reduced` | Forces the graphics profile instead of probing (reduced: hero glass backdrop 512 and 4 samples, Archive DPR 1, no Archive pre-warm). The choice is kept for the session (sessionStorage `gfx-profile-v1`) and logged as `[gfx] profile: ...`. |
| `warmdebug=1` | `window.__warmDebug` lists any guarded render that still built or first-used an unlinked program (empty = no draw blocked on a link); `window.__costs` times the procedural builds (`scene/costs.ts`). |

Hooks: `__gfxProfile` (profile, probe ms, renderer), `__warm()` (queue,
in-flight program, dropped pre-warm, slow issues), and the timestamps
`scripts/perf/slow.mjs` reads: `__screenDrawnAt` (composite on screen),
`__heroDrawnAt` (headline drawn with its real program),
`__crystalDrawnAt` / `__archiveGlassDrawnAt` (glass first drawn, stand-in
or real), `__archiveFirstFrameAt` (the void), `__floodStartedAt`,
`__marqueeSyncedAt` (troika laid the headline out).

`node scripts/perf/slow.mjs [--software] [--runs=2]` reports, per
scenario, time to visible content, frame-time percentiles and the longest
main-thread block (a MessageChannel heartbeat, which only stalls when the
main thread is busy). `--software` forces Firefox onto WARP (Microsoft
Basic Render Driver).

## Page layout checks

`window.__crystalBox()` (`crystal/screenBox.ts`) returns the hero crystal's
on-screen bounding box in CSS px (every vertex of the visible glass
projected through the scene camera) and its fade, or `null` when hidden.

| Script | Checks |
| --- | --- |
| `scripts/verify/crystal-clear.mjs` | The crystal never covers About / Disciplines copy, at 10 scroll positions per width and mode. |
| `scripts/verify/disciplines.mjs` | Discipline headings never reach their description; rows never touch; linked rows clear the header. |
| `scripts/verify/header-band.mjs` | Nothing but the header's own items shows through the nav band, anywhere down the page. |
