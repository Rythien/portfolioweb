export interface Project {
  id: string;
  counter: string;
  title: string;
  category: string;
  year: string;
  roles: string[];
  description: string;
  link: string;
  repo?: string;
  image: string;
  aspectRatio?: string;
}

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
    body: "Based in Kathmandu, I work at the intersection of graphic design, realtime frontend engineering, and 3D visualization. Every system begins with structural clarity—planning the journey, choosing the type, and choreographing responsive motion that communicates intent rather than ornamentation.",
    secondaryLanguage: {
      lang: "Nepali / नेपाली",
      quote: "काठमाडौँको ऐतिहासिक शिल्प र आधुनिक डिजिटल प्रविधिको संगम — स्पष्टता, सौन्दर्य र स्थायित्व।",
      translation:
        "Rooted in Kathmandu: synthesizing historic Newari spatial craft with modern computational engineering—clarity, elegance, and durability.",
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
    projects: [
      {
        id: "pixel-plus",
        counter: "01 / 03",
        title: "Pixel Plus",
        category: "Web Application / Full-Stack",
        year: "2024",
        roles: ["Frontend Engineering", "UI/UX Design", "REST API & DB Architecture"],
        description:
          "A complete full-stack e-commerce web platform designed and built from scratch as a final-year BICT capstone project. Features an interactive product catalog, reactive shopping cart, dynamic checkout validation, and a MongoDB backend.",
        link: "https://github.com/rythien",
        repo: "https://github.com/rythien",
        image: "/opengraph-image",
        aspectRatio: "aspect-[16/10]",
      },
      {
        id: "4c-iced-coffee",
        counter: "02 / 03",
        title: "4C Iced Coffee",
        category: "3D Commercial Animation",
        year: "2024",
        roles: ["3D Product Modeling", "Fluid Dynamics", "Lighting & Camera Motion"],
        description:
          "Commercial 3D product animation video produced for 4C Iced Coffee in Blender. Focuses on photorealistic beverage packaging, custom condensation shaders, dynamic fluid splash simulation, and kinetic commercial pacing.",
        link: "https://github.com/rythien",
        repo: "https://github.com/rythien",
        image: "/opengraph-image",
        aspectRatio: "aspect-[16/10]",
      },
      {
        id: "kinetic-archive",
        counter: "03 / 03",
        title: "Kinetic Architecture",
        category: "Interactive Interface / Mobile",
        year: "2024",
        roles: ["Interface Architecture", "Interaction Design", "Prototyping"],
        description:
          "An exploratory mobile and web interface investigation into kinetic spatial typography, fluid micro-interactions, and accessible touch geometries designed for next-generation digital archives.",
        link: "https://github.com/rythien",
        repo: "https://github.com/rythien",
        image: "/opengraph-image",
        aspectRatio: "aspect-[16/10]",
      },
    ] as Project[],
  },

  dreamMode: {
    sectionNum: "(04)",
    title: "Alternate Dimension",
    headline: "There is another way to see this archive.",
    description:
      "A spatial real-time 3D universe built with React Three Fiber is currently being prepared for Phase 2. Step into a floating world of artifacts, geometry, and light.",
    buttonLabel: "Enter Dream Mode (Phase 2)",
    route: "#dream-mode",
  },

  recognition: {
    sectionNum: "(05)",
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
    sectionNum: "(06)",
    title: "Contact",
    heading: "Say hello.",
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
