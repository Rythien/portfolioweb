# Direction: GLACIER / AFTERGLOW

Design read: solo creative-developer portfolio for design-literate hiring managers and clients,
with an editorial-grid + real-3D language. One idea carries the whole site: **a block of ice that
holds your tools, and the dream you see through it.** WAKE is the ice. DREAM is the light inside it.

Dials: variance 8 · motion 8 · density 3.

---

## Mood

**WAKE — the studio at altitude.** Cold paper, hard shadows, printed precision. Everything is
measured: hairlines, tabular numbers, a crystal sitting on the page like a specimen on a light
table. The feeling is *before*: morning, clarity, restraint. Nothing glows. Nothing drifts.

**DREAM — the same room at night.** Not a dark theme; a state change. The grid that held the page
together dissolves. Air gets thick: dust, slow fog, soft bloom on headlines. Surfaces turn to
frosted glass; the gem goes violet. The feeling is *after*: the ice has melted and the light got
out. Same content, remembered instead of read.

The flood transition is the hinge: it must visibly dissolve WAKE's discipline into DREAM's
atmosphere, never just recolor the background.

## Type scale

Two faces only, three jobs:

| Token      | Face                      | Size (fluid)                     | Weight | Tracking  | Leading |
|------------|---------------------------|----------------------------------|--------|-----------|---------|
| display    | Geist (bold wide grotesk) | clamp(4rem, 2.5rem + 9vw, 11rem) | 800    | -0.04em   | 0.92    |
| h1         | Geist, CAPS               | clamp(3rem, 2rem + 5vw, 6.5rem)  | 800    | -0.04em   | 0.92    |
| h2         | Geist, CAPS               | clamp(2rem, 1.5rem + 2.5vw, 3.5rem) | 700 | -0.03em   | 0.95    |
| accent     | Newsreader italic, lowercase | inherits statement size       | 400    | -0.01em   | 1.1     |
| body       | Geist                     | 17–19px                          | 400    | 0         | 1.6     |
| label      | Geist Mono                | **min 14px**                     | 500    | 0.08em    | 1.4     |
| number     | Geist Mono, tabular       | contextual                       | 500    | 0         | 1       |

Rules:
- Statements are CAPS grotesk with **exactly one** Newsreader italic lowercase accent word.
  The accent word is the emotional pivot of the sentence, never decoration.
- Mono is for numbers and labels **only** — never body copy.
- No label below 14px, none lighter than 500, none fainter than ink/80. Thin grey text is dead text.
- No em-dashes anywhere in visible copy. Periods, commas, colons.

## Spacing scale

8pt scale, nothing off-grid: **8 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 192**.

- Section padding: 128 desktop / 96 tablet / 64 mobile.
- Inside a section: 64 between header zone and content, 32 between sibling blocks, 16 within a block.
- 12-col grid, max-width 80rem, gutters 24. Body copy max 60ch, `text-wrap: pretty`.
- The left rail (section name, local time, progress line) owns the first ~64px of the viewport edge
  on desktop and replaces every in-flow section header.

## Motion rules

One easing family, two signatures:

- **Entrances:** `expo.out`, 0.8s, staggered 0.06s, translate 24–40px + fade. ScrollTrigger at
  `top 75%`, play once forward, reverse on leave-back.
- **Mode change:** `power2.inOut`. Everything that reacts to WAKE/DREAM (grid, fog, glass, glow,
  cursor) keys off the same flood progress so the page changes as one body, not as parts.
- Hover: transforms only (tilt max 6deg, magnetic pull max 8px), 0.3s, never opacity-only.
- Every animation answers "what does this communicate" in one sentence or it's cut.
- `prefers-reduced-motion`: entrances become fades, floods become crossfades, loops stop, magnetic
  and tilt effects off. Non-negotiable.

## WAKE vs DREAM, concretely

| Surface        | WAKE                               | DREAM                                        |
|----------------|------------------------------------|----------------------------------------------|
| Grid overlay   | visible hairlines                  | fades to 0                                   |
| Air            | none                               | dust particles + slow fog drift              |
| Headings       | sharp, tracking -0.04em            | soft glow/blur halo, tracking +0.02em        |
| Panels         | flat paper, 1px rules              | frosted glass (blur, inner border, highlight)|
| Cursor         | dot + label                        | soft glowing ring                            |
| Pixel gem      | ice blue                           | violet                                       |
| Copy           | factual registers                  | same content, dream registers where authored |

---

## Critique: the 10 most generic elements to replace

Measured against the direction above, worst first:

1. **"(01) · ABOUT" numbered eyebrow headers on every section.** The single loudest template
   signature on the page; five sections, five identical mono eyebrows. Replace with the fixed left
   rail (section name, local time, progress line) and delete every in-flow header row.
2. **Every section is the same layout family.** border-top, eyebrow row, max-w-7xl stack, repeated
   five times. A page with six sections needs at least four distinct layout families.
3. **DREAM mode is a palette swap.** Today it changes background, tint, and swaps some copy. The
   site's one big idea is the duality, and it's currently invisible below the hero. Fog, glass,
   glow, cursor, and grid must all change state.
4. **Works is a text list, not work.** Title + roles + paragraph rows with a gallery below, three
   identical blocks. For a visual portfolio this is the weakest possible treatment: replace with
   large image panels sliding in, orbiting tool-logo glass chips, case-study links.
5. **Disciplines is the agency divide-y list.** Number / title / description rows with a hover
   background: the most copied block in portfolio templates. Fold it into About or re-set it
   as a typographic composition, not a table.
6. **Recognition's "06 Total Distinctions" counter.** A count-up number ennobling a list that is
   mostly education and self-assigned milestones reads as fake metric. Keep the honest rows, cut
   the scoreboard.
7. **"Scroll to explore ↓" hint.** Pure template reflex; the marquee and crystal already invite
   scrolling. Delete.
8. **The footer does nothing.** Copyright bar with "Designed in Kathmandu". It's the last thing
   anyone sees: give it the ticker, the CONTACT statement, email copy, time and socials.
9. **mix-blend-difference header.** Stock Awwwards trick that fights the mode system (chrome should
   re-skin deliberately with WAKE/DREAM, not auto-invert) and produces illegible mid-tones over
   the crystal.
10. **Dead micro-typography and dead hovers.** 10px ink-faint tag chips, opacity-only link hovers,
    em-dashes in body copy, "crafted / lasting mark" filler verbs. Minimum 14px/500 labels,
    transform-based hovers, plain verbs.

Kept, deliberately: the crystal and all R3F work, the ink-flood transition, Lenis, the Geist +
Newsreader + Geist Mono stack (it already matches the type system), the WAKE palette's cold paper,
and the existing section order and anchor slugs (SEO + muscle memory).
