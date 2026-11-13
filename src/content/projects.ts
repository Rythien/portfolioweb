export interface ProjectImage {
  src: string;
  alt: string;
  caption?: string;
}

export interface Project {
  slug: string;
  counter: string;
  title: string;
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
  placeholder?: boolean;
  link: string;
  links?: { live?: string; repo?: string };
  repo?: string;
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

export const projects: Project[] = [
  {
    slug: "pixel-plus",
    counter: "01 / 03",
    title: "Pixel Plus",
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
    images: [
      {
        src: "/opengraph-image",
        alt: "Pixel Plus storefront overview",
        caption: "Storefront and checkout architecture",
      },
      {
        src: "/opengraph-image",
        alt: "Shopping cart and checkout flow",
        caption: "Reactive cart and validation interface",
      },
    ],
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
    images: [
      {
        src: "/opengraph-image",
        alt: "4C Iced Coffee hero render",
        caption: "Photorealistic beverage packaging render",
      },
      {
        src: "/opengraph-image",
        alt: "Fluid splash simulation",
        caption: "Dynamic fluid dynamics and condensation",
      },
    ],
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
    images: [
      {
        src: "/opengraph-image",
        alt: "Kinetic Architecture interface",
        caption: "Kinetic spatial typography prototype",
      },
      {
        src: "/opengraph-image",
        alt: "Mobile touch interaction patterns",
        caption: "Accessible touch geometries",
      },
    ],
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
