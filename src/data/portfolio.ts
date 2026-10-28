import {
  FocusArea,
  SkillCategory,
  ExperienceItem,
  EducationItem,
  ProjectItem,
  LabExperiment,
  MetricItem,
} from "@/types";

export const PORTFOLIO_DATA = {
  personal: {
    name: "Searon Maharjan",
    initials: "SM",
    role: "Creative Developer & Frontend Architect",
    roleShort: "Creative Developer",
    location: "Kathmandu, Nepal",
    coordinates: "27.7172° N, 85.3240° E",
    elevation: "1,400m AMSL",
    timezone: "Asia/Kathmandu",
    utcOffset: "+05:45",
    status: "Available for Q3/Q4 contracts & select collaborations",
    bio: "Bridging the tactile craftsmanship of Kathmandu Valley with modern browser engineering. I build computational interfaces, realtime WebGL environments, and resilient digital architectures where code behaves like physical craft.",
    originStory:
      "Raised in Patan amidst generations of Newari woodcarvers, stone artisans, and temple architects, I inherited an obsession with structural harmony and ornamental discipline. Today, that centuries-old geometric vernacular translates into GPU shaders, math-driven motion systems, and editorial web experiences designed to outlive ephemeral trends.",
  },

  journey: {
    from: {
      location: "Patan (Lalitpur), Kathmandu Valley",
      coords: "27.6744° N · 85.3245° E",
      era: "Origins",
      description: "Steeped in Newari geometric craft, brick pagodas, and traditional wood lattice detailing (*Aakijhyal*).",
    },
    to: {
      location: "Global Distributed / Digital Frontier",
      coords: "27.7172° N · 85.3240° E → Worldwide",
      era: "Present",
      description: "Architecting interactive editorial spaces, WebGL web applications, and precision frontend systems for international studios and founders.",
    },
  },

  focusAreas: [
    {
      number: "#01",
      title: "Realtime Graphics & Shaders",
      tagline: "Bridging the GPU and the DOM",
      description:
        "Custom GLSL fragment shaders, physics-driven particle systems, and hardware-accelerated canvas experiences that preserve 60/120fps fidelity without thermal throttling.",
      tech: ["WebGL 2.0", "GLSL Shaders", "Three.js / OGL", "Canvas 2D API", "WebGPU Primitives"],
    },
    {
      number: "#02",
      title: "Editorial Design Systems",
      tagline: "Architecture over decoration",
      description:
        "High-contrast typographic hierarchies, asymmetric Swiss grids, and mathematically calibrated spacing tokens that elevate digital products to archival editorial publications.",
      tech: ["Next.js App Router", "Tailwind CSS", "Token Architecture", "Fluid Typography", "Radix Primitives"],
    },
    {
      number: "#03",
      title: "Choreographed Motion Systems",
      tagline: "Kinetic continuity & intent",
      description:
        "Scroll-driven narrative choreography, scrubbed timeline sequences, and micro-physics with GSAP and Lenis. Always paired with strict reduced-motion safeguards.",
      tech: ["GSAP 3.x", "ScrollTrigger", "Lenis Smooth Scroll", "Split-text Kinetics", "FLIP Layout"],
    },
  ] as FocusArea[],

  skills: {
    grouped: [
      {
        category: "Frontend Architecture",
        count: "08",
        items: [
          "TypeScript 5.x",
          "Next.js (App Router)",
          "React 19 & Concurrent Primitives",
          "Tailwind CSS v4",
          "Server Components (RSC)",
          "State Orchestration (Zustand)",
          "Accessible ARIA Patterns",
          "Performance Profiling & Web Vitals",
        ],
      },
      {
        category: "Graphics & Creative Coding",
        count: "06",
        items: [
          "WebGL & WebGPU (GLSL)",
          "Three.js & OGL",
          "Canvas 2D Math & Physics",
          "Shader Raymarching & Noise",
          "FBO Particles & Curl Noise",
          "SVG Path Manipulation",
        ],
      },
      {
        category: "Motion & Interaction",
        count: "06",
        items: [
          "GSAP Core & ScrollTrigger",
          "Lenis Smooth Scroll Engine",
          "Scrubbed Timeline Choreography",
          "Morphing Magnetic Cursors",
          "Intersection Observer Systems",
          "Responsive Motion Breakpoints",
        ],
      },
      {
        category: "Backend & Tooling",
        count: "05",
        items: [
          "Node.js & Edge Runtimes",
          "Turbopack & Vite Bundlers",
          "Git CLI & Monorepo Workflows",
          "Vercel Edge Deployment",
          "Headless CMS Architecture",
        ],
      },
    ] as SkillCategory[],

    areasOfExpertise: [
      "Realtime WebGL Experiences",
      "Editorial Brand Platforms",
      "Interactive 3D Scrollytelling",
      "Design System Engineering",
      "High-Performance Micro-Interactions",
      "Accessible Motion Choreography",
      "Typography & Baseline Grid Tuning",
      "Edge Computing & SSG Optimization",
    ],
  },

  experience: [
    {
      id: "exp-1",
      role: "Lead Creative Frontend Architect",
      company: "Kala Digital Lab",
      location: "Kathmandu & Remote",
      period: "2024 — PRESENT",
      summary:
        "Directing frontend engineering for international agency clients, focusing on high-concept WebGL campaign sites, design systems, and headless commerce platforms.",
      results: [
        "Architected bespoke GLSL and GSAP scrollytelling infrastructure delivering sustained 120 FPS on Apple Silicon and 60 FPS on low-power mobile devices.",
        "Reduced initial bundle sizes by 44% across 8 production platforms by replacing monolithic 3D dependencies with lean OGL and custom raw WebGL renderers.",
        "Mentored a 6-developer team on modern React Server Components, semantic accessibility (WCAG AA), and animation performance profiling.",
      ],
      stack: ["Next.js", "TypeScript", "GSAP ScrollTrigger", "WebGL / GLSL", "Tailwind CSS"],
    },
    {
      id: "exp-2",
      role: "Senior Creative Developer",
      company: "Vortex Interactive",
      location: "Remote (Singapore / Nepal)",
      period: "2022 — 2024",
      summary:
        "Spearheaded interactive experiences and bespoke marketing engines for tech founders and luxury consumer brands across APAC and Europe.",
      results: [
        "Shipped 14 high-impact product launch sites, achieving 3 Awwwards Site of the Day honors and 5 FWA of the Day selections.",
        "Engineered an interactive 3D product customizer with dynamic lighting and procedural grain textures, boosting visitor dwell time by +185%.",
        "Pioneered a zero-CLS image delivery pipeline with progressive blur placeholders, achieving consistent 98+ Google Lighthouse Performance scores.",
      ],
      stack: ["Three.js", "React", "Lenis", "GLSL Shaders", "Node.js Edge"],
    },
    {
      id: "exp-3",
      role: "Frontend Engineer",
      company: "Himalayan Tech Studios",
      location: "Kathmandu, Nepal",
      period: "2020 — 2022",
      summary:
        "Built enterprise SaaS dashboards, financial portals, and localized digital products serving millions of users across South Asia.",
      results: [
        "Engineered high-concurrency data visualization tables handling 50,000+ real-time tick updates without UI lockup using virtualized renderers.",
        "Rebuilt the core design system tokens and component library, accelerating sprint release velocity by 35% across four distinct cross-functional squads.",
        "Eliminated 100% of accessibility violations, bringing public-facing financial portals into full compliance with WCAG 2.1 AA mandates.",
      ],
      stack: ["TypeScript", "React", "D3.js", "Tailwind CSS", "Jest / Playwright"],
    },
  ] as ExperienceItem[],

  education: [
    {
      degree: "Bachelor of Science in Computer Science & Information Technology (B.Sc. CSIT)",
      institution: "Tribhuvan University, Institute of Science and Technology",
      location: "Kathmandu, Nepal",
      period: "2016 — 2020",
      details:
        "Specialized in Computer Graphics, Numerical Algorithms, Computational Geometry, and Distributed Operating Systems. Graduated with Honors.",
    },
    {
      degree: "Independent Research: Himalayan Spatial Geometry & Sacred Mathematics",
      institution: "Patan Heritage Guild Study Circle",
      location: "Lalitpur, Nepal",
      period: "2021 — 2022",
      details:
        "Explored the mathematical symmetries of Newari mandala planning and temple proportional systems (*Vastu Shastra*), translating traditional geometry into algorithmic code.",
    },
  ] as EducationItem[],

  metrics: [
    {
      number: "120 FPS",
      label: "Realtime Target",
      subtext: "Maintained across high-refresh displays with GPU-optimized draw calls",
    },
    {
      number: "98+",
      label: "Lighthouse Performance",
      subtext: "Strict zero-compromise benchmark on mobile and desktop viewports",
    },
    {
      number: "14+",
      label: "Awwwards & FWA Honors",
      subtext: "Global design recognitions for international studio collaborations",
    },
    {
      number: "0.08s",
      label: "Interaction Response",
      subtext: "Optimized input latency through hardware-accelerated transforms",
    },
  ] as MetricItem[],

  projects: [
    {
      id: "durbar-virtualis",
      title: "Durbar Virtualis",
      client: "Himalayan Heritage Archive",
      year: "2025",
      category: "Realtime Spatial Preservation",
      oneLiner: "Interactive 3D preservation of 17th-century Patan Durbar woodcraft via WebGL Gaussian splats.",
      description:
        "An archival digital exploration allowing users to navigate laser-scanned Newari royal palace courtyards with volumetric sunlight, realistic ambient occlusion, and bilingual historical annotations in Nepal Bhasa and English.",
      role: "Lead Creative Developer & Shader Engineer",
      stack: ["Next.js", "WebGL 2.0", "GLSL Raymarching", "GSAP ScrollTrigger", "Tailwind CSS"],
      metrics: "99.4% mobile 60fps stability · 450K+ global visitors",
      link: "https://durbar-virtualis.archive.np",
      github: "https://github.com/searonm/durbar-virtualis",
      accentColor: "#FF3B26",
      image: "/projects/durbar.svg",
      highlights: [
        "Procedural dust mote simulation reacting to camera velocity and cursor gestures.",
        "Lossless progressive mesh streaming pipeline with under 3-second time-to-interactive.",
        "Dynamic audio spatialization keyed to courtyard depth and reverberation.",
      ],
    },
    {
      id: "aeris-sound",
      title: "Aeris Sound Engine",
      client: "Aeris Acoustics",
      year: "2024",
      category: "Audiovisual Platform",
      oneLiner: "Hardware synthesizer web companion featuring realtime frequency spectrograms and audio DSP.",
      description:
        "A technical web interface for high-end studio monitoring hardware. Combines Web Audio API analysis with a GPU-rendered Lissajous particle visualizer that responds to polyphonic harmonic shifts in real time.",
      role: "Creative Developer & Interaction Designer",
      stack: ["TypeScript", "Web Audio API", "OGL", "GSAP", "Radix UI"],
      metrics: "12ms audio-visual sync latency · FWA of the Day",
      link: "https://aeris-sound.io",
      github: "https://github.com/searonm/aeris-sound",
      accentColor: "#E02E1B",
      image: "/projects/aeris.svg",
      highlights: [
        "Direct FFT frequency buffer streaming directly into custom vertex shader uniforms.",
        "Custom SVG bezier wave editor with multi-touch curve manipulation.",
        "Full keyboard accessibility navigation for all audio envelope knobs.",
      ],
    },
    {
      id: "chrono-mono",
      title: "Chrono Mono Watchworks",
      client: "Atelier Chrono",
      year: "2024",
      category: "Editorial Horology Showcase",
      oneLiner: "Minimalist timepiece showcase with scrubbed mechanical assembly and exploded tourbillon views.",
      description:
        "A high-luxury Swiss horology editorial site. Pin-scrubbed GSAP timelines deconstruct a 312-part mechanical calibre gear by gear as the user scrolls, paired with archival typography and micro-mechanical click haptics.",
      role: "Sole Creative Engineer",
      stack: ["React 19", "Three.js", "GSAP Timeline", "Lenis", "Tailwind CSS v4"],
      metrics: "+240% pre-order conversion rate · Awwwards Site of the Day",
      link: "https://chrono-mono.ch",
      github: "https://github.com/searonm/chrono-mono",
      accentColor: "#D4AF37",
      image: "/projects/chrono.svg",
      highlights: [
        "Reversible forward/backward gear transmission physics mapped to vertical wheel delta.",
        "Stepped microscopic zoom mode with chromatic aberration lens simulation.",
        "Instant fallback to progressive SVG blueprints on low-end hardware.",
      ],
    },
    {
      id: "void-protocol",
      title: "Void Protocol",
      client: "Void Labs Inc.",
      year: "2023",
      category: "Cryptographic Infrastructure",
      oneLiner: "Terminal-inspired cybersecurity platform featuring encrypted network visualization.",
      description:
        "A declassified-style technical dashboard and marketing landing page for a zero-knowledge cryptography suite. Features real-time node topology graphs, live hash generation, and a monospace command palette interface.",
      role: "Frontend Architect",
      stack: ["Next.js", "Canvas 2D", "Web Workers", "Tailwind CSS", "Zustand"],
      metrics: "Sub-100ms cold start · 1.2M active testnet sessions",
      link: "https://void-protocol.dev",
      github: "https://github.com/searonm/void-protocol",
      accentColor: "#00E5FF",
      image: "/projects/void.svg",
      highlights: [
        "OffscreenCanvas rendering worker offloading heavy node calculations from the main UI thread.",
        "Full keyboard-first navigation with vim-style keybindings (`j`/`k`/`g`/`G`).",
        "Integrated encrypted message playground demonstrating zero-knowledge proofs.",
      ],
    },
  ] as ProjectItem[],

  lab: [
    {
      id: "lab-1",
      number: "LAB · 01",
      title: "Harmonic Ripple Distortion",
      type: "glsl",
      tag: "Fragment Shader",
      description:
        "Interactive WebGL shader computing simulated liquid surface tension and refractive Snell's law distortion across pointer coordinates.",
    },
    {
      id: "lab-2",
      number: "LAB · 02",
      title: "Eulerian Fluid Particles",
      type: "particles",
      tag: "Compute Particle Sim",
      description:
        "10,000 instanced particles advected along a divergence-free curl noise velocity field, reacting to cursor acceleration vectors.",
    },
    {
      id: "lab-3",
      number: "LAB · 03",
      title: "Kinetic Monospace Typography",
      type: "physics",
      tag: "Spring Physics Engine",
      description:
        "Interactive glyph grid responding to distance fields with elastic spring restitution, damping, and localized gravitational lensing.",
    },
  ] as LabExperiment[],

  colophon: {
    stack: [
      { name: "Framework", value: "Next.js 16 (App Router) + React 19" },
      { name: "Language", value: "TypeScript 5.x (Strict Typing)" },
      { name: "Styling", value: "Tailwind CSS v4 + Bespoke CSS Properties" },
      { name: "Motion Engine", value: "GSAP 3.12 (ScrollTrigger) + Lenis v1.1" },
      { name: "Graphics Engine", value: "WebGL Raymarching + 8×8 Bayer Dither & 3D ASCII Globe" },
      { name: "Typography", value: "Syne (Display) · Geist Sans · JetBrains Mono" },
      { name: "Visual Lineage", value: "Inspired by the editorial mood of Christen Dijoux" },
      { name: "Design Rigor", value: "Apple HIG Principles · Hairline Grids · Newari Geometry" },
    ],
    ethics: [
      "No tracking pixels, third-party spyware, or external invasive analytics.",
      "Strict respect for prefers-reduced-motion across every animated element.",
      "High-contrast color calibration conforming to WCAG 2.2 Level AA / AAA standards.",
      "100% responsive architecture tested across 375px, 768px, and 1440px+ display viewports.",
    ],
  },

  contact: {
    email: "searon.maharjan@gmail.com",
    phone: "+977 984-1234567", // Marked placeholder
    availability: "Available for remote contracts & select advisory worldwide",
    location: "Kathmandu, Nepal (UTC+5:45)",
    socials: [
      { label: "GitHub", href: "https://github.com/searonm", handle: "github.com/searonm" },
      { label: "LinkedIn", href: "https://linkedin.com/in/searon-maharjan", handle: "linkedin/searon-maharjan" },
      { label: "Instagram", href: "https://instagram.com/searon.m", handle: "@searon.m" },
      { label: "X / Twitter", href: "https://x.com/searonm", handle: "@searonm" },
      { label: "Read.cv", href: "https://read.cv/searon", handle: "read.cv/searon" },
    ],
  },
};
