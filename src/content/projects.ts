export interface ProjectImage {
  /** WAKE variant. */
  src: string;
  /** DREAM variant, crossfaded in by the --dream flood value. */
  dreamSrc?: string;
  alt: string;
  caption?: string;
}

/** A decision made on the project, and why. */
export interface CaseDecision {
  title: string;
  /** Paragraphs: what was chosen, the alternative, the reasoning. */
  body: string[];
}

/**
 * The written case study (600-900 words). Every field is the author's own
 * account; nothing here is filled in by guesswork. A project without one
 * falls back to its overview, features and challenges.
 */
export interface CaseStudy {
  /** Paragraphs. */
  problem: string[];
  /** Who did what: team, the author's part, timeline. */
  role: string[];
  approach: string[];
  /** Two or three. */
  decisions: CaseDecision[];
  /** What the author would do differently now. */
  differently: string[];
  /** Optional outcome: results, reception, where it is used. */
  outcome?: string[];
}

export interface Project {
  slug: string;
  counter: string;
  title: string;
  /** The one word of the title set in Newsreader italic lowercase. */
  titleAccent?: string;
  subtitle?: string;
  category: string;
  type?: string;
  year: string;
  roles: string[];
  description: string;
  dreamDescription?: string;
  summary?: string;
  overview?: string;
  mainFeatures?: string[];
  technicalChallenges?: string[];
  caseStudy?: CaseStudy;
  placeholder?: boolean;
  link: string;
  links?: { live?: string; repo?: string };
  repo?: string;
  /** Panel and case-study hero. */
  cover: ProjectImage;
  /** Case-study gallery. */
  images: ProjectImage[];
  aspectRatio?: string;
  ogImage?: string;
  stack: {
    frontend: string[];
    backend?: string[];
    tools?: string[];
  };
  tags: string[];
}

/*
 * All project media is generated concept artwork (npm run gen:covers),
 * not screenshots or product renders, and is labelled as such.
 */
const CONCEPT = "Concept artwork";

/** "Concept artwork: <what it shows>." */
const caption = (shows: string) => `${CONCEPT}: ${shows}.`;

function conceptArt(slug: string, title: string, tools: string) {
  const file = (name: string) => ({
    src: `/projects/${slug}/${name}.webp`,
    dreamSrc: `/projects/${slug}/${name}-dream.webp`,
  });
  return {
    cover: {
      ...file("cover"),
      alt: `Concept artwork for ${title}: ice chips refracting the title`,
      caption: caption(`ice chips refracting the ${title} title`),
    },
    images: [
      {
        ...file("detail-1"),
        alt: `Concept artwork for ${title}: a single ice chip refracting the title, shallow depth of field`,
        caption: caption("one chip, close up, the title bent through it at a shallow depth of field"),
      },
      {
        ...file("detail-2"),
        alt: `Concept artwork for ${title}: ${tools} embossed beneath a row of glass chips`,
        caption: caption(`${tools} embossed beneath a row of glass chips`),
      },
      {
        ...file("detail-3"),
        alt: `Concept artwork for ${title}: the title smeared along a light trail through fog`,
        caption: caption("the title smeared along a light trail through fog"),
      },
    ],
  };
}

export const projects: Project[] = [
  {
    slug: "pixel-plus",
    counter: "01 / 03",
    title: "Pixel Plus",
    titleAccent: "Plus",
    subtitle: "Full-stack e-commerce web platform",
    category: "Web Application / Full-Stack",
    type: "Web design",
    year: "2024",
    placeholder: true,
    roles: ["Frontend Engineering", "UI/UX Design", "REST API & DB Architecture"],
    description:
      "A complete full-stack e-commerce web platform designed and built from scratch as a final-year BICT capstone project. Features an interactive product catalog, reactive shopping cart, dynamic checkout validation, and a MongoDB backend.",
    summary:
      "A complete e-commerce website designed and built from scratch as a final-year BICT capstone project.",
    overview:
      "Designed and built a complete online store as a final-year university project, covering product listing, product pages, cart, checkout, user accounts, and administration.",
    mainFeatures: [
      "Interactive product catalog with filtering and search",
      "Reactive shopping cart with real-time validation",
      "Dynamic checkout flow with form validation",
    ],
    technicalChallenges: [
      "Handling state synchronization across cart and checkout flows",
      "Maintaining responsive layouts across mobile and desktop viewports",
    ],
    dreamDescription:
      "A digital storefront sculpted from light and logic: product flows, reactive carts, and checkout choreography woven into a single cohesive architecture.",
    link: "https://github.com/rythien",
    repo: "https://github.com/rythien",
    links: { repo: "https://github.com/rythien" },
    ...conceptArt(
      "pixel-plus",
      "Pixel Plus",
      "the React, Next.js, Tailwind CSS, TypeScript, Node.js and MongoDB logos",
    ),
    aspectRatio: "aspect-[16/10]",
    stack: {
      frontend: ["React", "Next.js", "Tailwind CSS", "TypeScript"],
      backend: ["Node.js", "MongoDB"],
      tools: ["Figma", "Git"],
    },
    tags: ["#webdesign", "#ecommerce", "#react", "#capstone"],
  },
  {
    slug: "4c-iced-coffee",
    counter: "02 / 03",
    title: "4C Iced Coffee",
    titleAccent: "Coffee",
    subtitle: "Commercial 3D product animation",
    category: "3D Commercial Animation",
    type: "3D / Blender",
    year: "2024",
    placeholder: true,
    roles: ["3D Product Modeling", "Fluid Dynamics", "Lighting & Camera Motion"],
    description:
      "Commercial 3D product animation video produced for 4C Iced Coffee in Blender. Focuses on photorealistic beverage packaging, custom condensation shaders, dynamic fluid splash simulation, and kinetic commercial pacing.",
    summary:
      "Commercial 3D product animation video produced for 4C Iced Coffee in Blender.",
    overview:
      "Produced a commercial-grade 3D product animation focusing on photorealistic beverage packaging, custom condensation shaders, and dynamic fluid splash simulation.",
    mainFeatures: [
      "Photorealistic beverage packaging with condensation",
      "Dynamic fluid splash simulation",
      "Kinetic commercial camera pacing",
    ],
    technicalChallenges: [
      "Achieving photorealistic glass and liquid materials",
      "Optimizing fluid simulation for render performance",
    ],
    dreamDescription:
      "Frozen condensation and fluid dynamics captured in 3D: photorealistic glass, kinetic splashes, and cinematic pacing rendered for a commercial audience.",
    link: "https://github.com/rythien",
    repo: "https://github.com/rythien",
    links: { repo: "https://github.com/rythien" },
    ...conceptArt("4c-iced-coffee", "4C Iced Coffee", "the Blender logo"),
    aspectRatio: "aspect-[16/10]",
    stack: {
      frontend: ["Blender", "EEVEE / Cycles"],
      tools: ["Blender", "After Effects"],
    },
    tags: ["#3d", "#blender", "#commercial", "#animation"],
  },
  {
    slug: "kinetic-archive",
    counter: "03 / 03",
    title: "Kinetic Architecture",
    titleAccent: "Architecture",
    subtitle: "Kinetic spatial typography interface",
    category: "Interactive Interface / Mobile",
    type: "App design",
    year: "2024",
    placeholder: true,
    roles: ["Interface Architecture", "Interaction Design", "Prototyping"],
    description:
      "An exploratory mobile and web interface investigation into kinetic spatial typography, fluid micro-interactions, and accessible touch geometries designed for next-generation digital archives.",
    summary:
      "An exploratory interface investigation into kinetic spatial typography and fluid micro-interactions.",
    overview:
      "An exploratory mobile and web interface investigation into kinetic spatial typography, fluid micro-interactions, and accessible touch geometries.",
    mainFeatures: [
      "Kinetic spatial typography system",
      "Fluid micro-interactions and touch gestures",
      "Accessible touch geometries for mobile",
    ],
    technicalChallenges: [
      "Balancing animation fluidity with accessible interaction patterns",
      "Touch geometry optimization for diverse device sizes",
    ],
    dreamDescription:
      "Spatial typography drifting through fluid micro-interactions: an interface experiment in kinetic geometry and accessible touch language.",
    link: "https://github.com/rythien",
    repo: "https://github.com/rythien",
    links: { repo: "https://github.com/rythien" },
    ...conceptArt(
      "kinetic-archive",
      "Kinetic Architecture",
      "the React, Framer Motion, TypeScript and Figma logos",
    ),
    aspectRatio: "aspect-[16/10]",
    stack: {
      frontend: ["React", "Framer Motion", "TypeScript"],
      tools: ["Figma"],
    },
    tags: ["#interface", "#mobile", "#kinetic", "#archive"],
  },
];

export function getProjects(): Project[] {
  return projects;
}

export function getFeaturedProjects(): Project[] {
  return projects;
}

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}
