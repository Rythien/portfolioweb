export interface Discipline {
  number: string;
  title: string;
  description: string;
}

export interface RecognitionItem {
  year: string;
  project: string;
  honor: string;
  result: string;
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
          "High-performance architecture built with Next.js, React 19, TypeScript, and fluid Tailwind CSS.",
      },
      {
        number: "03",
        title: "3D Modeling & Animation",
        description:
          "Commercial product visualization, realistic fluid dynamics, studio lighting, and Blender pipelines.",
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
        title: "Accessibility & Performance",
        description:
          "Strict WCAG 2.2 AA standards, 60/120 FPS render targets, and reduced-motion graceful degradation.",
      },
    ] as Discipline[],
  },

  works: {
    sectionNum: "(03)",
    title: "Selected Works",
  },

  recognition: {
    sectionNum: "(04)",
    title: "Recognition",
    totalAccolades: "06",
    accoladesLabel: "Total Distinctions & Milestones",
    items: [
      {
        year: "2025",
        project: "Asia e University",
        honor: "Bachelor of Information & Communication Technology (BICT)",
        result: "Graduated with Honors",
      },
      {
        year: "2024",
        project: "Pixel Plus E-Commerce",
        honor: "Final-Year Capstone Engineering Distinction",
        result: "Full-Stack Award",
      },
      {
        year: "2024",
        project: "4C Iced Coffee Commercial",
        honor: "Commercial 3D Product Animation",
        result: "Production Delivery",
      },
      {
        year: "2024",
        project: "Design Systems & Frontend",
        honor: "Independent WebGL & Canvas Research",
        result: "Architectural Showcase",
      },
      {
        year: "2023",
        project: "Open Source Ecosystem",
        honor: "Interactive Web Experiments & Component Library",
        result: "Community Recognition",
      },
      {
        year: "2022",
        project: "Creative Coding Research",
        honor: "Realtime Shaders & Mathematical Typography",
        result: "Featured Lab",
      },
    ] as RecognitionItem[],
  },

  contact: {
    sectionNum: "(05)",
    title: "Contact",
    headingPrefix: "Say",
    headingAccent: "hello.",
    subtext:
      "Open for freelance commissions, full-time engineering roles, and collaborative creative direction worldwide.",
    email: "seron.maharjan.5@gmail.com",
    phone: "+977 9823372904",
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
