export interface Discipline {
  number: string;
  title: string;
  description: string;
}

export const SITE_DATA = {
  brand: {
    name: "Searon Maharjan",
    initials: "SM",
    role: "Web & Interactive Designer",
    city: "Kathmandu",
    country: "Nepal",
    coordinates: "27.7172° N · 85.3240° E",
    timezone: "Asia/Kathmandu",
    utcOffset: "+05:45",
    tagline: "Form for clarity. Depth for wonder.",
  },

  hero: {
    headlineLine1: "Designing interfaces that breathe with life.",
    headlineLine2: "Engineering systems that leave a lasting mark.",
    disciplines: [
      "Interactive Design",
      "Creative Engineering",
      "3D Product Visuals",
      "Motion Systems",
    ],
    hint: "Scroll to explore",
    hintTouch: "Touch to explore",
    socialLabel: "github.com/rythien",
    socialUrl: "https://github.com/rythien",
  },

  about: {
    sectionNum: "(01)",
    title: "About",
    statementPrefix: "I design digital spaces where architecture meets",
    statementItalic: "contemplation,",
    statementSuffix: "crafting tactile interfaces designed to outlive the noise.",
    body: "Based in Kathmandu, I work at the intersection of graphic design, realtime frontend engineering, and 3D visualization. Every system begins with structural clarity: planning the journey, choosing the type, and choreographing responsive motion that communicates intent rather than ornamentation.",
    // Stated as on the CV: no honours claim
    education: "BICT, Asia e University, 2025",
    secondaryLanguage: {
      lang: "Nepali / नेपाली",
      quote: "काठमाडौँको ऐतिहासिक शिल्प र आधुनिक डिजिटल प्रविधिको संगम: स्पष्टता, सौन्दर्य र स्थायित्व।",
      translation:
        "Rooted in Kathmandu: synthesizing historic Newari spatial craft with modern computational engineering. Clarity, elegance, and durability.",
    },
  },

  disciplines: {
    sectionNum: "(02)",
    title: "Disciplines",
    items: [
      {
        number: "01",
        title: "Interactive & Web Design",
        description:
          "Editorial layouts, human-centered UI/UX, and purposeful design systems tailored for web and mobile.",
      },
      {
        number: "02",
        title: "Creative Frontend Engineering",
        description:
          "Interfaces built in Next.js, React 19, TypeScript and Tailwind CSS.",
      },
      {
        number: "03",
        title: "3D Modeling & Animation",
        description:
          "Product and motion visuals in 3D: modeling, lighting and rendering in Blender.",
      },
      {
        number: "04",
        title: "Motion & Choreography",
        description:
          "Inertial smooth scroll with Lenis and scrubbed timeline choreography with GSAP ScrollTrigger.",
      },
      {
        number: "05",
        title: "Design Tokens & Typography",
        description:
          "Disciplined fluid typographic scales, mathematical baseline grids, and accessible color hierarchies.",
      },
      {
        number: "06",
        title: "Accessibility",
        description:
          "Keyboard-navigable pages, visible focus, reduced-motion fallbacks and checked color contrast.",
      },
    ] as Discipline[],
  },

  works: {
    sectionNum: "(03)",
    title: "Selected Works",
  },

  contact: {
    sectionNum: "(04)",
    title: "Contact",
    headingPrefix: "Say",
    headingAccent: "hello.",
    subtext:
      "Open for freelance commissions, full-time engineering roles, and collaborative creative direction worldwide.",
    // Email and phone: src/content/contactPoints.ts (kept out of the HTML)
    location: "Kathmandu, Nepal (UTC+05:45)",
    availability: "Available for Q1/Q2 Projects",
    socials: [
      { label: "GitHub", href: "https://github.com/rythien", handle: "github.com/rythien" },
      { label: "LinkedIn", href: "https://linkedin.com/in/searon-maharjan", handle: "linkedin/searon-maharjan" },
      { label: "Instagram", href: "https://instagram.com/searon.m", handle: "@searon.m" },
    ],
  },

  footer: {
    copyright: "© 2026 Searon Maharjan. All rights reserved.",
    backToTop: "Back to top ↑",
  },
};
