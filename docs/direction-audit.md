# Audit against docs/direction.md

Date: 2026-11-18. Read from source, not from rendered pages. Ranked by how much each one hurts:
how visible it is, multiplied by how badly it breaks the spec (accessibility failures and
credibility count double). Nothing has been fixed.

## Critical

1. **The hero headline is set in Inter Tight, a fourth face.** It is the largest type on the site and
   it sits outside the three-family system (§1). The `·` tile separator also breaks §1.7.
   `src/components/scene/Marquee.tsx:14-16`
2. **The home page has no DOM `<h1>`.** The headline exists only in WebGL. The fallback `<h1>` is
   `aria-hidden`, renders only without WebGL, and sits at `ink/10` (1.1:1) with an arbitrary size.
   Screen readers and crawlers get no page title (§1.6).
   `src/components/sections/Hero.tsx:42-47`, `src/components/scene/SceneRoot.tsx:56-61`
3. **/cv fails text contrast.** Every section heading and date uses `text-ink-faint` (2.10:1, below
   AA), at 12px (`text-xs`), below the 14px label floor (§1.4, §3).
   `src/app/cv/page.tsx:75, 89, 94, 107, 122, 154, 167`
4. **Subpages run a second type system.** Newsreader Light whole headings, Tailwind sizes instead of
   tokens, 12px mono labels, `rounded-sm`, equal three-up cards (§1.2, §1 tokens, §8, §9).
   - Serif headings: `src/app/projects/page.tsx:42, 97`, `src/app/project/[slug]/page.tsx:61`,
     `src/app/cv/page.tsx:40, 98, 111`, plus Recognition rows on home:
     `src/components/sections/Recognition.tsx:74`
   - `text-xs` labels: `src/app/projects/page.tsx:27, 50, 108`,
     `src/app/project/[slug]/page.tsx:43, 58, 68, 87, 148, 155, 166, 198`,
     `src/app/cv/page.tsx:18, 46, 125, 157, 168`
   - `rounded-sm`: `src/app/projects/page.tsx:56, 71, 84`,
     `src/app/project/[slug]/page.tsx:79, 188`, `src/app/cv/page.tsx:30, 126, 134, 142`
   - Equal three-up cards: `src/app/projects/page.tsx:67-71`, `src/app/cv/page.tsx:125-149`
5. **Copy reads as filler, and Recognition makes claims that don't hold up.** "breathe with life",
   "lasting mark", "crafting… outlive the noise", "synthesizing historic Newari spatial craft",
   "60/120 FPS", "mathematical baseline grids". The Recognition rows "Full-Stack Award",
   "Community Recognition" and "Featured Lab" read as invented next to a degree (§1.7).
   `src/content/site.ts:28-29, 45-47, 53, 89, 95, 108-146`

## High

6. **DREAM puts glow on DOM type, and there are three different violets.** Heading halo is
   `rgba(168,148,255)`, glass glow is `rgba(99,102,241)` (Tailwind indigo), and the cursor ring is
   `rgba(167,139,250)`. That breaks the colour lock (§3) and the no-glow-on-text rule (§5, §7).
   `src/app/globals.css:124-125, 133-134, 142-143` (text), `:291-294` (glass), `:404-410` (cursor)
7. **Contact has two CTAs and two display statements back to back.** "SAY hello." + "Send Email",
   then the footer's "GET IN touch" mailto right after it (§9: one label per intent, one display per
   page). `src/components/sections/Contact.tsx:86-89, 95-102`, `src/components/sections/Footer.tsx:54-60`
8. **Two marquees.** The WebGL hero marquee plus the footer ticker (§4: one marquee).
   `src/components/sections/Footer.tsx:7, 38-48`, `src/app/globals.css:569-583`
9. **Disciplines and Recognition are the same layout family.** Both are `divide-y` rows with a hover
   fill. Recognition still leads with the "06 Total Distinctions" count-up scoreboard (§6, §9).
   `src/components/sections/Disciplines.tsx:52, 63`,
   `src/components/sections/Recognition.tsx:52-57, 62, 68`
10. **Section numbering and too many labels above headings.** Home has six sections, so the limit is
    two labels; there are about five. (§6)
    - `(01)` row numbers: `src/components/sections/Disciplines.tsx:66-68`
    - `01 / 03` project counter: `src/components/sections/Works.tsx:176-178`
    - Hero meta row (role + coordinates): `src/components/sections/Hero.tsx:49-56`
    - Hero-bottom discipline strip with dots: `src/components/sections/Hero.tsx:66-78`
    - About language label: `src/components/sections/About.tsx:79`
    - Subpages: `Case Study // 0n` `src/app/project/[slug]/page.tsx:59`,
      `Fig. 0n ·` `:82, 191`, `01 / Listen` steps `src/app/cv/page.tsx:158-170`,
      `02 / 07 · Journey` `src/components/sections/Journey.tsx:107-109`

## Medium

11. **Magnetic pull is unbounded and the release bounces.** Pull is 0.32 × distance from centre, so
    the footer's full-width display link can move about 100px. The release uses `elastic.out` (§4:
    8px clamp, no overshoot). `src/components/common/CustomCursor.tsx:55-56, 126`
12. **Hovers are opacity-only** (§4). `src/components/common/Header.tsx:70, 81, 88, 96, 112`,
    `src/components/sections/Contact.tsx:100`, `src/components/sections/Footer.tsx:57`
13. **A `window` scroll listener sets React state** (§4 implementation).
    `src/components/common/Header.tsx:44-49`
14. **Label token bypassed or overridden.** Arbitrary sizes, `tracking-widest`/`wider`/`[0.12em]`
    on top of `text-label`, mono values at 14px/400 (§1.4).
    - `src/components/common/Header.tsx:77, 96` (`text-[0.875rem]`)
    - `src/components/sections/Disciplines.tsx:66`, `src/components/sections/Recognition.tsx:55, 70, 82`,
      `src/components/common/CustomCursor.tsx:164`, `src/components/sections/Works.tsx:183`
    - Mono `text-sm` values: `src/components/sections/Contact.tsx:150, 151, 160, 171`
    - 9px cursor label: `src/components/crystal/CrystalCursor.tsx:57` (raw colour at `:51`)
15. **Synthetic italics.** DREAM descriptions are italic Geist. The Devanagari quote is italic and
    falls back to a system face (§1.5). `src/components/sections/Works.tsx:218`,
    `src/components/sections/About.tsx:82`
16. **Locale noise beyond the one clock.** Coordinates in the hero, a second clock in Contact, the
    UTC offset in the location line, and "Kathmandu" in the ticker (§6).
    `src/components/sections/Hero.tsx:54-56`, `src/components/sections/Contact.tsx:138-144`,
    `src/content/site.ts:21, 158`, `src/components/sections/Footer.tsx:7`
17. **Off-palette surfaces.** `/journey` hardcodes `#050505`/`#edebe6` and the OG image uses the same
    dark palette, which matches neither mode (§3).
    `src/components/sections/Journey.tsx:103-143`, `src/app/opengraph-image.tsx:21-24`
18. **Glass has no reduced-transparency fallback** (§7). `src/app/globals.css:281-295, 440-457`,
    `src/components/chrome/ModePill.tsx:56`

## Low

19. **Hero frame.** `min-h-screen` instead of `100dvh`, and top padding `pt-28` (112) is off-scale.
    `src/components/sections/Hero.tsx:46`
20. **Motion drift from the language.** Entrance offsets outside 24-40px: Hero `y:15`
    `src/components/sections/Hero.tsx:29`, Recognition `y:20` `src/components/sections/Recognition.tsx:26`,
    work panels `x:120` `src/components/sections/Works.tsx:65`. Trigger at `top 80%` instead of 75%:
    `src/components/sections/Disciplines.tsx:32`, `src/components/sections/Works.tsx:72, 108`,
    `src/components/sections/Recognition.tsx:33`. Count-up sets React state every frame:
    `src/components/ui/Counter.tsx:50-66`
21. **Unmotivated loop and over-weight shadow on the work chip.** The 26 s orbit is not on the loop
    list, and the shadow is 0.08 against a 0.06 cap (§4, §7). `src/app/globals.css:451, 466-478`
22. **Token drift in globals.** `text-body` tops out at 20px against the 19px spec, and `text-h3` has
    no weight against 600 (§1). `src/app/globals.css:146-150, 158-162`
23. **Off-scale spacing** (§2): 20, 56, 80, 112 and 144px.
    `src/components/sections/About.tsx:70, 77` (`sm:mt-14`, `mt-14`, `sm:mt-20`),
    `src/components/sections/Disciplines.tsx:47` (`pt-32` on phones too), `:63` (`gap-y-5`),
    `src/components/sections/Contact.tsx:100, 109` (`py-5`),
    `src/components/sections/Footer.tsx:53` (`pt-14 sm:pt-20`),
    `src/components/chrome/SectionRail.tsx:130` (`pt-28`),
    `src/app/projects/page.tsx:26, 41`, `src/app/project/[slug]/page.tsx:42, 57`,
    `src/app/cv/page.tsx:17, 36, 74, 88, 121, 126, 134, 142` (`py-28 sm:py-36`, `mb-14`, `p-5`)
24. **Em-dashes in readable text** (§1.7). `src/app/cv/page.tsx:108` (on the page),
    `src/app/layout.tsx:46, 54, 60` (tab title, OG, Twitter), `src/app/opengraph-image.tsx:3` (alt)
25. **Middle-dot runs.** `src/components/sections/Hero.tsx:73-75`, `src/app/cv/page.tsx:48, 53, 62`,
    `src/components/sections/Journey.tsx:122`
26. **Shape lock.** The Archive panel uses `rounded-2xl`. `src/components/archive/Archive.tsx:356`
27. **Bracketed terminal control `[Menu]` / `[Close]`** (§6). `src/components/common/Header.tsx:131`

## Not verified

- Nothing was rendered. Contrast is computed from tokens with alpha composited in sRGB. Glow,
  backdrop and WebGL legibility need a browser pass in both modes.
- Geist italic availability (item 15) is inferred from the `next/font` config, which loads no italic
  style. Check it in DevTools > Rendered Fonts.
- `/journey` and `CrystalCursor` may be unlinked or legacy. If they are dead code, items 14 (cursor)
  and 17 (journey) turn into deletions instead of fixes.
