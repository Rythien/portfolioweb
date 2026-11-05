# Visual Spec — daikifujita.com Reference

> Reference analysis of daikifujita.com for structure and feel only.
> Never copy text, assets, models, code, or shaders. All content and 3D must be original.
> Last reviewed: 2026-11-05

---

## 1. Site Identity

- **Title:** "Daiki Fujita — Web & Interactive Designer"
- **Description:** "Portfolio of Daiki Fujita, a Tokyo-based web & interactive designer. Read it awake, or float through it in a 3D dream."
- **Published:** November 4, 2026

---

## 2. Page Structure (WAKE / Default State)

Sections in scroll order:

| # | Section | Purpose |
|---|---------|---------|
| — | Header (fixed) | Brand name, city + live clock, Contact link |
| — | Hero | Role title, discipline tags, scroll/touch hint, social link |
| (01) | About | Bilingual statement (English + Japanese), italic emphasis on a keyword |
| (02) | Disciplines | 6 numbered rows with title + one-line sub-description |
| (03) | Selected Works | 3 projects with counter ("01 / 03"), title, roles, year, "Open the memory" CTA |
| (04) | Dream Mode | Teaser: "There is another way to *see* this archive." + enter CTA |
| (05) | Recognition | 14 award rows: year, project, award name |
| (06) | Contact | "Say hello." + email, social links, dream CTA |
| — | Footer | Work, About, Back to top navigation |

---

## 3. Layout Principles

- **Max-width container** (estimated ~1200–1280px) centered with generous horizontal padding
- **Full-width sections** with contained content
- **Grid:** 12-column grid on desktop, single column on mobile
- **Section headers:** Numbered label left-aligned, secondary label right-aligned, separated by thin border-bottom
- **Generous vertical spacing** between sections (~py-28 to py-44)

---

## 4. Typography System

| Role | Font Family | Weight | Style | Tracking |
|------|-------------|--------|-------|----------|
| Display / Hero | Serif (likely custom or variable) | Light (300) | Normal + Italic variant | Tight negative |
| Section headings | Same serif | Light | Normal | Tight |
| Body text | Sans-serif (geometric/neo-grotesque) | Normal (400) | Normal | Standard |
| Labels / Meta | Monospace | Normal–Semibold | Uppercase | Wide (0.06em+) |

**Type scale pattern:**
- Hero display: ~clamp(3.5rem–7.5rem)
- Section heading (h2): ~clamp(2.5rem–5rem)
- Body large: ~1.125–1.25rem
- Labels: 0.75rem (12px floor), all-caps, wide tracking

---

## 5. Color System

### WAKE Mode (Light / Default)
- **Background:** Off-white / warm paper (#E9E7E2 or similar warm cream)
- **Primary text:** Near-black (#08080a or #050505)
- **Muted text:** Mid-gray (~40–55% opacity of primary)
- **Borders:** Very subtle (~8–12% opacity)
- **Accents:** Same as primary text (monochrome system)

### DREAM Mode (Dark / 3D)
- **Background:** Deep navy/purple (#07062B or similar)
- **Text:** Light cream/white
- **3D scene:** Immersive WebGL environment with floating elements
- **Transition:** Liquid/ink shader dissolve between modes

> **Note:** The site uses "Dream mode" and "Enter the dream" terminology, not "WAKE/DREAM" labels.
> The page description uses "Read it awake, or float through it in a 3D dream."

---

## 6. Motion & Interaction

- **Smooth scroll:** Lenis-style inertial scrolling
- **Section reveals:** Fade-up on scroll entry (opacity 0→1, y offset)
- **Staggered animations:** Elements within a section stagger sequentially
- **Parallax:** Subtle vertical shift on project media
- **Custom cursor:** Dual-element (precision dot + lagging reticle with labels)
- **Magnetic hover:** Interactive elements pull toward cursor
- **Prefers-reduced-motion:** Respected throughout

---

## 7. Navigation

- **Fixed header** with mix-blend-difference for visibility over any background
- **Left:** Brand name (home link)
- **Center/Right:** Minimal links — Work, About, Contact
- **Live clock:** City name + local time, pulsing dot indicator
- **Mobile:** Hamburger/menu toggle with drawer

---

## 8. Hero Section

- **Full viewport height** (min-h-screen)
- **Top bar:** Role label + coordinates
- **Center:** Large serif headline (2 lines, second line italic)
- **Below headline:** Discipline tags in monospace, dot-separated
- **Bottom bar:** Scroll hint with bounce arrow, social link
- **Background:** Subtle WebGL/shader element (ambient, not dominant)

---

## 9. Project Presentation

- **Full-width blocks** (not cards), stacked vertically with large gaps
- **Per project:**
  - Counter ("01 / 03") + category + year in meta bar
  - Large serif title (clickable)
  - Role list + description in side column
  - Full-width media preview with parallax
  - CTA link at bottom
- **Media:** Large aspect-ratio containers (16:10) with overflow-hidden parallax

---

## 10. Section Labeling

- **Format:** `(01) · Section Title` left, secondary descriptor right
- **Typography:** Monospace, 12px, uppercase, wide tracking
- **Color:** Muted gray
- **Decoration:** Thin border-bottom separator
- **Consistent across all numbered sections**

---

## 11. Key Differences from Current Portfolio

| Aspect | daikifujita.com | Current Portfolio |
|--------|----------------|-------------------|
| Background | Off-white (#E9E7E2) in WAKE | Dark (#08080a) always |
| Color scheme | Two-tone inverted per mode | Single dark mode |
| Dream mode | Functional 3D environment | Placeholder button + modal |
| Project media | Real project screenshots | Uses /opengraph-image (clipped hero copy) |
| Developer copy | None visible | "Phase 2", "Pipeline Ready", etc. |
| Content | All real, specific | Placeholder brackets in projects.ts |

---

## 12. Principles to Adopt (Structure/Feel Only)

1. **WAKE = light editorial** — off-white background, dark text, contemplative pace
2. **DREAM = immersive 3D** — dark background, spatial environment, crystal/shard concept
3. **Liquid transition** — ink/shader dissolve between modes (original implementation)
4. **Typography hierarchy** — serif display, sans body, mono labels (already in place)
5. **Generous whitespace** — sections breathe, large vertical padding
6. **Monochrome discipline** — two-tone palette per mode, no decorative color
7. **Motion restraint** — subtle reveals and parallax, never gratuitous
8. **Content authenticity** — no placeholder text, no developer terminology in UI
